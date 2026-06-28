"""
Resuelve el problema de "dirección fija única + identificar de quién es
cada pago" generando un monto único con micro-variación por cada
Payment pendiente.

Ejemplo: si el precio base es $99.00, este servicio genera $99.0034 para
un pago y $99.0071 para otro que llegue casi al mismo tiempo. Como
estamos en stablecoins con 6 decimales (USDC), hay sobrado espacio para
variación sin que sea perceptible para el usuario ni rompa nada.

Importante: el monto generado tiene que ser único entre los pagos
PENDIENTES en este momento (no contra todos los pagos históricos) --
una vez que un pago se confirma o expira, ese monto vuelve a estar
disponible para reusarse.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.db_models import Payment, PaymentStatus
from app.core.config import settings

PAYMENT_WINDOW_MINUTES = 30

# Rango de micro-variación: 0.0001 a 0.0099 -- imperceptible en USD pero
# da 99 valores posibles distintos por encima del precio base, de sobra
# para no pisarse en la práctica (si chocara, se regenera, ver abajo).
MIN_VARIATION = 0.0001
MAX_VARIATION = 0.0099


def _amount_in_use(db: Session, candidate: float) -> bool:
    existing = (
        db.query(Payment)
        .filter(
            Payment.status == PaymentStatus.pending,
            Payment.expected_amount_usd == candidate,
            Payment.expires_at > datetime.utcnow(),
        )
        .first()
    )
    return existing is not None


def generate_unique_amount(db: Session, base_price_usd: float) -> float:
    """Genera un monto único (no en uso por otro pago pendiente) a partir
    del precio base. Reintenta si hay colisión -- con 99 valores posibles
    y pagos concurrentes realistamente bajos, esto casi nunca reintenta
    más de una vez."""
    for _ in range(20):
        variation = round(random.uniform(MIN_VARIATION, MAX_VARIATION), 4)
        candidate = round(base_price_usd + variation, 4)
        if not _amount_in_use(db, candidate):
            return candidate

    raise RuntimeError(
        "No se pudo generar un monto único tras 20 intentos -- "
        "revisar volumen de pagos pendientes simultáneos."
    )


def expiry_timestamp() -> datetime:
    return datetime.utcnow() + timedelta(minutes=PAYMENT_WINDOW_MINUTES)


def find_pending_payment_by_amount(db: Session, amount_seen_on_chain: float, network: str) -> Payment | None:
    """Dado un monto visto en una transacción on-chain, busca el Payment
    pendiente que matchea exactamente. Se compara con una tolerancia
    mínima por la posible diferencia de redondeo entre decimales del
    token (6 para USDC) y los 4 decimales que usamos para la variación.
    """
    tolerance = 0.00005
    candidates = (
        db.query(Payment)
        .filter(
            Payment.status == PaymentStatus.pending,
            Payment.expires_at > datetime.utcnow(),
        )
        .all()
    )
    for payment in candidates:
        if abs(payment.expected_amount_usd - amount_seen_on_chain) < tolerance:
            return payment
    return None
