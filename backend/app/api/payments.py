"""
Endpoints del flujo de pago cripto.

El frontend llama POST /payments/start cuando el usuario hace click en
"Pagar" y elige la red (Polygon o Base). Le devolvemos la dirección fija
de cobro + el monto EXACTO con micro-variación que tiene que enviar.

Después, el frontend hace polling a GET /payments/{id}/status cada
pocos segundos esperando que pase a "confirmed" (lo cual pasa solo, en
el worker de background -- ver app/workers/payment_listener.py).
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.safe_logging import log_event
from app.models.db_models import (
    Payment, PaymentType, PaymentStatus, PaymentNetwork, PaymentProvider, Project, User
)
from app.services.payment_matching import generate_unique_amount, expiry_timestamp
from app.services import lemonsqueezy
from app.services.lemonsqueezy import LemonSqueezyError
from app.api.schemas import (
    PaymentStartRequest, PaymentStartResponse, PaymentStatusResponse,
    LemonSqueezyCheckoutStartRequest, LemonSqueezyCheckoutStartResponse,
)

router = APIRouter(prefix="/payments", tags=["payments"])


def _expire_stale_pending_payments(db: Session, user_id: str) -> None:
    """Marca como expired los Payment pending de este usuario cuyo
    expires_at ya pasó. Sin esto, un pago abandonado (usuario cancela
    la wallet, cierra el checkout de Lemon Squeezy sin completar, etc.)
    se queda en "pending" para siempre -- lo único que antes lo movía a
    "expired" era el chequeo lazy en GET /payments/{id}/status, y si
    nadie vuelve a consultar ESE pago puntual, nunca pasa. El síntoma
    real: el tope de 3 pendientes simultáneos (ver más abajo) se
    llenaba de pagos zombies y bloqueaba pagos nuevos legítimos, sin
    ninguna forma de que se destrabara solo. Se llama al INICIO de
    cada intento de pago nuevo, así el usuario se autodesbloquea con
    su propio próximo intento -- no hace falta un worker de limpieza
    aparte para esto.
    """
    db.query(Payment).filter(
        Payment.user_id == user_id,
        Payment.status == PaymentStatus.pending,
        Payment.expires_at < datetime.utcnow(),
    ).update({"status": PaymentStatus.expired})
    db.commit()


@router.post("/start", response_model=PaymentStartResponse)
def start_payment(
    body: PaymentStartRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.payment_type not in (PaymentType.per_project.value, PaymentType.subscription.value):
        raise HTTPException(status_code=400, detail="payment_type inválido")
    if body.network not in (PaymentNetwork.polygon.value, PaymentNetwork.base.value):
        raise HTTPException(status_code=400, detail="network inválida")

    # Tope de pagos pendientes simultáneos por usuario -- sin esto, un
    # usuario autenticado podría spamear este endpoint y consumir gran
    # parte del pool finito de montos únicos que genera
    # generate_unique_amount(), disparando el 503 de "no se pudo
    # generar un monto único" para otros usuarios legítimos. No hace
    # falta Redis ni slowapi para esto -- es un simple count contra la
    # misma tabla que ya se consulta en todos lados.
    _expire_stale_pending_payments(db, user.id)
    pending_count = (
        db.query(Payment)
        .filter(Payment.user_id == user.id, Payment.status == PaymentStatus.pending)
        .count()
    )
    if pending_count >= 3:
        raise HTTPException(
            status_code=429,
            detail="Ya tenés pagos pendientes -- esperá a que se confirmen o expiren antes de iniciar uno nuevo.",
        )

    if body.payment_type == PaymentType.per_project.value:
        if not body.project_id:
            raise HTTPException(status_code=400, detail="project_id requerido para pago por proyecto")
        project = db.query(Project).filter(Project.id == body.project_id).first()
        if not project or project.owner_id != user.id:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        base_price = settings.price_per_project_usd
    else:
        base_price = settings.price_subscription_monthly_usd

    # `generate_unique_amount` chequea contra pendientes ya comiteados,
    # pero dos requests concurrentes podrían elegir el mismo candidato
    # antes de que cualquiera de las dos comitee (TOCTOU). El índice
    # único parcial sobre `expected_amount_usd` (migración 0005, solo
    # para status='pending') es el backstop real a nivel de DB -- si
    # igual choca, se reintenta con un monto nuevo en vez de romper el
    # request del usuario con un 500.
    for _ in range(5):
        amount = generate_unique_amount(db, base_price)
        payment = Payment(
            user_id=user.id,
            project_id=body.project_id if body.payment_type == PaymentType.per_project.value else None,
            payment_type=PaymentType(body.payment_type),
            network=PaymentNetwork(body.network),
            expected_amount_usd=amount,
            status=PaymentStatus.pending,
            expires_at=expiry_timestamp(),
        )
        db.add(payment)
        try:
            db.commit()
            break
        except IntegrityError:
            db.rollback()
    else:
        raise HTTPException(
            status_code=503,
            detail="No se pudo generar un monto de pago único, intentá de nuevo en unos segundos",
        )

    log_event(
        "PaymentStarted",
        payment_id=payment.id, user_id=user.id, payment_type=body.payment_type,
        network=body.network, project_id=body.project_id,
    )
    return PaymentStartResponse(
        payment_id=payment.id,
        receive_address=settings.payment_receive_address,
        network=body.network,
        expected_amount_usd=amount,
        expires_at=payment.expires_at.isoformat(),
    )


@router.get("/{payment_id}/status", response_model=PaymentStatusResponse)
def get_payment_status(
    payment_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment or payment.user_id != user.id:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    # Si expiró y nadie lo marcó, lo marcamos al consultar (lazy expiry).
    if payment.status == PaymentStatus.pending and payment.expires_at < datetime.utcnow():
        payment.status = PaymentStatus.expired
        db.commit()

    return PaymentStatusResponse(
        payment_id=payment.id,
        status=payment.status.value,
        confirmations_seen=payment.confirmations_seen,
        confirmations_required=settings.confirmations_required,
    )


@router.post("/lemonsqueezy/start", response_model=LemonSqueezyCheckoutStartResponse)
def start_lemonsqueezy_checkout(
    body: LemonSqueezyCheckoutStartRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.payment_type not in (
        PaymentType.per_project.value, PaymentType.subscription.value, PaymentType.annual.value
    ):
        raise HTTPException(status_code=400, detail="payment_type inválido")

    _expire_stale_pending_payments(db, user.id)
    pending_count = (
        db.query(Payment)
        .filter(Payment.user_id == user.id, Payment.status == PaymentStatus.pending)
        .count()
    )
    if pending_count >= 3:
        raise HTTPException(
            status_code=429,
            detail="Ya tenés pagos pendientes -- esperá a que se confirmen o expiren antes de iniciar uno nuevo.",
        )

    if body.payment_type == PaymentType.per_project.value:
        if not body.project_id:
            raise HTTPException(status_code=400, detail="project_id requerido para pago por proyecto")
        project = db.query(Project).filter(Project.id == body.project_id).first()
        if not project or project.owner_id != user.id:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        base_price = settings.price_per_project_usd
    elif body.payment_type == PaymentType.annual.value:
        base_price = settings.price_annual_usd
    else:
        base_price = settings.price_subscription_monthly_usd

    payment = Payment(
        user_id=user.id,
        project_id=body.project_id if body.payment_type == PaymentType.per_project.value else None,
        payment_type=PaymentType(body.payment_type),
        provider=PaymentProvider.lemonsqueezy,
        expected_amount_usd=base_price,
        status=PaymentStatus.pending,
        expires_at=expiry_timestamp(),
    )
    db.add(payment)
    db.commit()

    try:
        checkout_url = lemonsqueezy.create_checkout(payment, user.email)
    except LemonSqueezyError as e:
        db.delete(payment)
        db.commit()
        log_event("LemonSqueezyCheckoutFailed", user_id=user.id, error=str(e))
        raise HTTPException(status_code=502, detail="No se pudo iniciar el pago con Lemon Squeezy, intentá de nuevo.")

    log_event(
        "LemonSqueezyCheckoutStarted",
        payment_id=payment.id, user_id=user.id, payment_type=body.payment_type,
    )
    return LemonSqueezyCheckoutStartResponse(payment_id=payment.id, checkout_url=checkout_url)
