"""
Integración con Lemon Squeezy como pasarela de pago alternativa a cripto.

Flujo:
  1. El frontend llama POST /payments/lemonsqueezy/start.
  2. Creamos un Payment(provider=lemonsqueezy, status=pending) y le
     pedimos a la API de Lemon Squeezy que genere un checkout para el
     variant correspondiente, pasando el id de ese Payment como
     `custom_data.payment_id`.
  3. Devolvemos la URL de checkout al frontend.
  4. Cuando el usuario paga, Lemon Squeezy dispara un webhook a
     /webhooks/lemonsqueezy. Ese handler lee `custom_data.payment_id`,
     encuentra ESTE Payment, y aplica apply_payment_confirmation().

  IMPORTANTE (suscripciones): Lemon Squeezy guarda el custom_data del
  checkout de forma PERMANENTE y lo reenvía en TODOS los webhooks
  futuros relacionados a esa suscripción -- incluidas las renovaciones
  mensuales, meses después del pago inicial. Esto significa que el
  webhook ve el MISMO payment_id una y otra vez, mes tras mes. La lógica
  de diferenciar "primera confirmación" de "renovación" vive en
  app/api/webhooks.py, no acá -- este archivo solo arma el checkout.
"""

from __future__ import annotations

import httpx

from app.core.config import settings
from app.models.db_models import Payment, PaymentType

LEMONSQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1"


class LemonSqueezyError(RuntimeError):
    pass


def _variant_id_for(payment_type: PaymentType) -> str:
    variant_id = {
        PaymentType.per_project: settings.lemonsqueezy_variant_id_per_project,
        PaymentType.subscription: settings.lemonsqueezy_variant_id_subscription,
        PaymentType.annual: settings.lemonsqueezy_variant_id_annual,
    }.get(payment_type, "")
    if not variant_id:
        raise LemonSqueezyError(
            f"No hay variant_id configurado para payment_type={payment_type.value} "
            "-- revisá las env vars de Render."
        )
    return variant_id


def create_checkout(payment: Payment, user_email: str) -> str:
    variant_id = _variant_id_for(payment.payment_type)

    body = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_data": {
                    "email": user_email,
                    "custom": {"payment_id": payment.id},
                },
                "product_options": {
                    # Vuelve a la página del proyecto -- PaywallPanel.tsx
                    # lee ?ls_payment_id=... al montar y retoma el
                    # polling. El desbloqueo real SIEMPRE lo dispara el
                    # webhook, nunca esta redirección.
                    "redirect_url": (
                        f"{settings.frontend_urls[0]}/proyectos/{payment.project_id}?ls_payment_id={payment.id}"
                        if payment.project_id
                        else f"{settings.frontend_urls[0]}/app?ls_payment_id={payment.id}"
                    ),
                },
                # Habilita el trial configurado en el variant (si lo
                # hay) también quedar reflejado -- Lemon Squeezy toma el
                # trial del variant automáticamente, no hace falta
                # pedirlo acá explícitamente.
            },
            "relationships": {
                "store": {"data": {"type": "stores", "id": settings.lemonsqueezy_store_id}},
                "variant": {"data": {"type": "variants", "id": variant_id}},
            },
        }
    }

    try:
        response = httpx.post(
            f"{LEMONSQUEEZY_API_BASE}/checkouts",
            json=body,
            headers={
                "Accept": "application/vnd.api+json",
                "Content-Type": "application/vnd.api+json",
                "Authorization": f"Bearer {settings.lemonsqueezy_api_key}",
            },
            timeout=15,
        )
    except httpx.RequestError as e:
        raise LemonSqueezyError(f"No se pudo contactar a Lemon Squeezy: {e}") from e

    if response.status_code >= 400:
        raise LemonSqueezyError(
            f"Lemon Squeezy devolvió {response.status_code} al crear el checkout: {response.text}"
        )

    data = response.json()
    try:
        return data["data"]["attributes"]["url"]
    except (KeyError, TypeError) as e:
        raise LemonSqueezyError(f"Respuesta inesperada de Lemon Squeezy: {data}") from e
