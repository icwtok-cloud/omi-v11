"""
Webhook que Clerk llama cuando pasan eventos de usuarios (creado,
actualizado, borrado). Lo configurás en el dashboard de Clerk apuntando
a https://tu-backend.onrender.com/webhooks/clerk

Verificamos la firma con svix (la librería que Clerk usa para firmar
sus webhooks) para asegurarnos de que el request viene realmente de
Clerk y no de cualquiera que le pegue a esta URL.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException, Header
from sqlalchemy.orm import Session
from svix.webhooks import Webhook, WebhookVerificationError
from fastapi import Depends

from app.core.config import settings
from app.core.database import get_db
from app.models.db_models import User

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
            db.delete(user)
            db.commit()

    return {"received": True}
