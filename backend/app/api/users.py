"""
Info del usuario logueado que el frontend necesita para saber qué
mostrar en el paywall (¿todavía tiene su proyecto gratis disponible?
¿cuánta cuota de suscripción le queda este mes?) sin tener que adivinar
ni duplicar la lógica de entitlements.py del lado del cliente.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.db_models import User
from app.services.entitlements import (
    SUBSCRIPTION_MONTHLY_EXPORT_LIMIT, reset_monthly_counter_if_needed,
)
from app.api.schemas import UserMeResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMeResponse)
def get_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Reflejar el reset de mes calendario acá también (no solo cuando se
    # exporta) para que el frontend no muestre "0/5 usados" desactualizado
    # si el usuario entra a la app recién empezado el mes nuevo.
    reset_monthly_counter_if_needed(user)
    db.commit()

    return UserMeResponse(
        free_project_used=user.free_project_used,
        has_active_subscription=user.has_active_subscription,
        subscription_expires_at=(
            user.subscription_expires_at.isoformat() if user.subscription_expires_at else None
        ),
        monthly_export_count=user.monthly_export_count,
        monthly_export_limit=SUBSCRIPTION_MONTHLY_EXPORT_LIMIT,
    )
