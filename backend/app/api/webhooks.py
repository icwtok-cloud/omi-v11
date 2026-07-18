"""
Webhook que Clerk llama cuando pasan eventos de usuarios (creado,
actualizado, borrado). Lo configurás en el dashboard de Clerk apuntando
a https://tu-backend.onrender.com/webhooks/clerk

Verificamos la firma con svix (la librería que Clerk usa para firmar
sus webhooks) para asegurarnos de que el request viene realmente de
Clerk y no de cualquiera que le pegue a esta URL.
"""

from __future__ import annotations

import hashlib
import hmac
from datetime import datetime

from fastapi import APIRouter, Request, HTTPException, Header
from sqlalchemy.orm import Session
from svix.webhooks import Webhook, WebhookVerificationError
from fastapi import Depends

from app.core.config import settings
from app.core.database import get_db
from app.core.safe_logging import log_event
from app.models.db_models import Payment, PaymentStatus, PaymentProvider, User
from app.services.entitlements import apply_payment_confirmation

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    db: Session = Depends(get_db),
    svix_id: str = Header(None, alias="svix-id"),
    svix_timestamp: str = Header(None, alias="svix-timestamp"),
    svix_signature: str = Header(None, alias="svix-signature"),
):
    body = await request.body()

    wh = Webhook(settings.clerk_webhook_signing_secret)
    try:
        event = wh.verify(
            body,
            {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            },
        )
    except WebhookVerificationError:
        raise HTTPException(status_code=400, detail="Firma de webhook inválida")

    event_type = event.get("type")
    data = event.get("data", {})

    if event_type == "user.created":
        clerk_id = data["id"]
        email = data.get("email_addresses", [{}])[0].get("email_address", "")
        existing = db.query(User).filter(User.id == clerk_id).first()
        if not existing:
            db.add(User(id=clerk_id, email=email))
            db.commit()

    elif event_type == "user.deleted":
        clerk_id = data["id"]
        user = db.query(User).filter(User.id == clerk_id).first()
        if user:
            # NO se borra la fila -- Project.owner_id y Payment.user_id
            # son FK NOT NULL sin cascade (ver db_models.py), y este
            # usuario puede tener proyectos o pagos (registros de
            # facturación que no deberían desaparecer). Un
            # `db.delete(user)` acá violaba la FK, tiraba un
            # IntegrityError sin manejar, devolvía 500, y Clerk
            # reintentaba el webhook indefinidamente -- de hecho el
            # borrado de cuenta ni siquiera se completaba nunca. En vez
            # de eso, se anonimiza: se borra el email (el único dato
            # personal identificable en este modelo) y se preserva la
            # fila para no romper la integridad referencial ni perder
            # el historial de pagos/proyectos.
            user.email = f"deleted-{clerk_id}@deleted.omi.lat"
            db.commit()

    return {"received": True}


# Eventos de Lemon Squeezy que confirman plata efectivamente cobrada.
# Deliberadamente NO incluye "order_refunded" ni "subscription_cancelled"
# -- revocar acceso ya pagado es una decisión de producto aparte que no
# tocamos acá (ver README si se decide implementar).
LEMONSQUEEZY_CONFIRMING_EVENTS = {
    "order_created",              # pago único (per_project) exitoso
    "subscription_created",       # primer cobro de una suscripción nueva
    "subscription_payment_success",  # renovación mensual exitosa
}


@router.post("/lemonsqueezy")
async def lemonsqueezy_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_signature: str = Header(None, alias="X-Signature"),
):
    """Webhook que Lemon Squeezy llama cuando pasa un evento de pago.
    Se configura en Lemon Squeezy dashboard > Settings > Webhooks,
    apuntando a https://tu-backend.onrender.com/webhooks/lemonsqueezy,
    tildando al menos order_created, subscription_created y
    subscription_payment_success (ver LEMONSQUEEZY_CONFIRMING_EVENTS).

    A diferencia del webhook de Clerk (que usa svix), Lemon Squeezy firma
    con un HMAC-SHA256 simple del body crudo en el header X-Signature --
    lo verificamos a mano con hmac.compare_digest para evitar timing
    attacks.
    """
    body = await request.body()

    if not settings.lemonsqueezy_webhook_signing_secret:
        raise HTTPException(status_code=500, detail="Webhook de Lemon Squeezy no configurado")

    expected_signature = hmac.new(
        settings.lemonsqueezy_webhook_signing_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not x_signature or not hmac.compare_digest(expected_signature, x_signature):
        raise HTTPException(status_code=400, detail="Firma de webhook inválida")

    payload = await request.json()
    event_name = payload.get("meta", {}).get("event_name")
    custom_data = payload.get("meta", {}).get("custom_data", {}) or {}
    payment_id = custom_data.get("payment_id")

    if event_name not in LEMONSQUEEZY_CONFIRMING_EVENTS:
        # Otros eventos (order_refunded, subscription_cancelled, etc.)
        # los reconocemos pero no accionamos nada -- 200 para que Lemon
        # Squeezy no los siga reintentando.
        return {"received": True, "action": "ignored"}

    if not payment_id:
        # No debería pasar si el checkout se creó con create_checkout()
        # (ver lemonsqueezy.py), pero si alguien paga un checkout creado
        # a mano desde el dashboard sin custom_data, no hay Payment
        # nuestro al cual asociar esto -- se loguea para revisión manual,
        # igual que UnmatchedPaymentReceived en el flujo cripto.
        log_event("LemonSqueezyWebhookMissingPaymentId", event_name=event_name)
        return {"received": True, "action": "unmatched"}

    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment or payment.provider != PaymentProvider.lemonsqueezy:
        log_event("LemonSqueezyWebhookPaymentNotFound", event_name=event_name, payment_id=payment_id)
        return {"received": True, "action": "unmatched"}

    if payment.status == PaymentStatus.confirmed:
        # Lemon Squeezy reintenta webhooks si no respondemos rápido con
        # 2xx -- idempotente: ya aplicamos los efectos la primera vez.
        return {"received": True, "action": "already_confirmed"}

    order_id = str(payload.get("data", {}).get("id", ""))
    payment.status = PaymentStatus.confirmed
    payment.confirmed_at = datetime.utcnow()
    payment.lemonsqueezy_order_id = order_id or None

    # Mismo servicio de negocio que usa el listener de blockchain --
    # desbloquear proyecto / activar suscripción es idéntico sin importar
    # de qué gateway vino la plata.
    apply_payment_confirmation(db, payment)
    db.commit()

    log_event(
        "PaymentConfirmed",
        payment_id=payment.id, user_id=payment.user_id,
        payment_type=payment.payment_type.value, provider="lemonsqueezy",
        event_name=event_name,
    )
    return {"received": True, "action": "confirmed"}
