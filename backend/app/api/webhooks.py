"""
Webhooks entrantes de Clerk (usuarios) y Lemon Squeezy (pagos con tarjeta).
"""

from __future__ import annotations

import hashlib
import hmac
from datetime import datetime

from fastapi import APIRouter, Request, HTTPException, Header, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from svix.webhooks import Webhook, WebhookVerificationError

from app.core.config import settings
from app.core.database import get_db
from app.core.safe_logging import log_event
from app.models.db_models import Payment, PaymentStatus, PaymentType, PaymentProvider, User
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
            user.email = f"deleted-{clerk_id}@deleted.omi.lat"
            db.commit()

    return {"received": True}


LEMONSQUEEZY_GRANT_EVENTS = {
    "order_created",
    "subscription_created",
    "subscription_payment_success",
}

LEMONSQUEEZY_REVOKE_EVENTS = {
    "subscription_cancelled",
    "subscription_expired",
}


@router.post("/lemonsqueezy")
async def lemonsqueezy_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_signature: str = Header(None, alias="X-Signature"),
):
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

    if not payment_id:
        log_event("LemonSqueezyWebhookMissingPaymentId", event_name=event_name)
        return {"received": True, "action": "unmatched"}

    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment or payment.provider != PaymentProvider.lemonsqueezy:
        log_event("LemonSqueezyWebhookPaymentNotFound", event_name=event_name, payment_id=payment_id)
        return {"received": True, "action": "unmatched"}

    if event_name in LEMONSQUEEZY_REVOKE_EVENTS:
        return _revoke_subscription(db, payment, event_name)

    if event_name not in LEMONSQUEEZY_GRANT_EVENTS:
        return {"received": True, "action": "ignored"}

    event_ref = f"{event_name}:{payload.get('data', {}).get('id', '')}"

    if payment.status != PaymentStatus.confirmed:
        payment.status = PaymentStatus.confirmed
        payment.confirmed_at = datetime.utcnow()
        payment.lemonsqueezy_order_id = event_ref
        apply_payment_confirmation(db, payment)
        db.commit()
        log_event(
            "PaymentConfirmed", payment_id=payment.id, user_id=payment.user_id,
            payment_type=payment.payment_type.value, provider="lemonsqueezy", event_name=event_name,
        )
        return {"received": True, "action": "confirmed"}

    if payment.payment_type not in (PaymentType.subscription, PaymentType.annual):
        return {"received": True, "action": "already_confirmed"}

    if payment.lemonsqueezy_order_id == event_ref:
        return {"received": True, "action": "already_confirmed"}

    renewal = Payment(
        user_id=payment.user_id,
        project_id=None,
        payment_type=payment.payment_type,
        provider=PaymentProvider.lemonsqueezy,
        expected_amount_usd=(
            settings.price_annual_usd
            if payment.payment_type == PaymentType.annual
            else settings.price_subscription_monthly_usd
        ),
        status=PaymentStatus.confirmed,
        confirmed_at=datetime.utcnow(),
        expires_at=datetime.utcnow(),
        lemonsqueezy_order_id=event_ref,
    )
    db.add(renewal)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"received": True, "action": "already_confirmed"}

    apply_payment_confirmation(db, renewal)
    db.commit()
    log_event(
        "SubscriptionRenewed", payment_id=renewal.id, user_id=renewal.user_id,
        provider="lemonsqueezy", event_name=event_name,
    )
    return {"received": True, "action": "renewed"}


def _revoke_subscription(db: Session, payment: Payment, event_name: str) -> dict:
    user = db.query(User).filter(User.id == payment.user_id).first()
    if not user:
        log_event("LemonSqueezyRevokeUserNotFound", event_name=event_name, payment_id=payment.id)
        return {"received": True, "action": "unmatched"}

    if payment.payment_type == PaymentType.annual:
        # Solo tocamos annual_event_limit si lo había seteado ESTE
        # mecanismo (annual_plan_expires_at no es None) -- si es un
        # partner con deal manual (annual_plan_expires_at sigue None),
        # nunca debería llegar acá porque no tiene Payment de Lemon
        # Squeezy asociado, pero el chequeo es defensivo por las dudas.
        if user.annual_plan_expires_at is not None:
            user.annual_event_limit = None
            user.annual_plan_expires_at = None
    else:
        user.has_active_subscription = False

    db.commit()
    log_event("SubscriptionRevoked", user_id=user.id, event_name=event_name, payment_type=payment.payment_type.value)
    return {"received": True, "action": "revoked"}
