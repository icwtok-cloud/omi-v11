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
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.db_models import (
    Payment, PaymentType, PaymentStatus, PaymentNetwork, Project, User
)
from app.services.payment_matching import generate_unique_amount, expiry_timestamp
from app.api.schemas import PaymentStartRequest, PaymentStartResponse, PaymentStatusResponse

router = APIRouter(prefix="/payments", tags=["payments"])


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

    if body.payment_type == PaymentType.per_project.value:
        if not body.project_id:
            raise HTTPException(status_code=400, detail="project_id requerido para pago por proyecto")
        project = db.query(Project).filter(Project.id == body.project_id).first()
        if not project or project.owner_id != user.id:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        base_price = settings.price_per_project_usd
    else:
        base_price = settings.price_subscription_monthly_usd

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
    db.commit()

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
