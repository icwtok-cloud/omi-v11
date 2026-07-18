"""
Integración con Lemon Squeezy como pasarela de pago alternativa a cripto.

Flujo:
  1. El frontend llama POST /payments/lemonsqueezy/start (mismo patrón que
     el flujo cripto en app/api/payments.py).
  2. Acá creamos un Payment(provider=lemonsqueezy, status=pending) igual
     que en el flujo cripto, y le pedimos a la API de Lemon Squeezy que
     genere un checkout para el variant correspondiente (per_project o
     subscription), pasando el id de nuestro Payment como `custom_data`.
  3. Devolvemos la URL de checkout al frontend, que redirige o abre el
     overlay (checkout.lemonsqueezy.com).
  4. Cuando el usuario paga, Lemon Squeezy dispara un webhook a
     /webhooks/lemonsqueezy (ver app/api/webhooks.py). Ese handler lee
     `custom_data.payment_id` del evento, encuentra ESTE Payment, y aplica
     apply_payment_confirmation() -- el mismo efecto que produce el
     listener de blockchain al confirmar un pago cripto.

No usamos el SDK oficial de Lemon Squeezy (no está en requirements.txt)
para no sumar una dependencia más -- es un solo endpoint REST simple,
alcanza con httpx (ya usado en el proyecto).
"""

from __future__ import annotations

import httpx

from app.core.config import settings
from app.models.db_models import Payment, PaymentType

LEMONSQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1"


class LemonSqueezyError(RuntimeError):
    """La API de Lemon Squeezy respondió con un error o algo inesperado."""


def _variant_id_for(payment_type: PaymentType) -> str:
    variant_id = (
        settings.lemonsqueezy_variant_id_per_project
        if payment_type == PaymentType.per_project
        else settings.lemonsqueezy_variant_id_subscription
    )
    if not variant_id:
        raise LemonSqueezyError(
            f"No hay variant_id configurado para payment_type={payment_type.value} "
            "-- revisá LEMONSQUEEZY_VARIANT_ID_PER_PROJECT / "
            "LEMONSQUEEZY_VARIANT_ID_SUBSCRIPTION en las env vars de Render."
        )
    return variant_id


def create_checkout(payment: Payment, user_email: str) -> str:
    """Crea un checkout en Lemon Squeezy para este Payment ya persistido
    (pending) y devuelve la URL a la que hay que mandar al usuario.

    `custom_data.payment_id` es la pieza clave: es lo único que nos
    permite, en el webhook, volver de "orden de Lemon Squeezy" a "cuál
    Payment nuestro es este" -- Lemon Squeezy no sabe nada de nuestros
    ids de proyecto/usuario, solo nos devuelve de vuelta lo que le
    mandamos acá.
    """
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
                    # A dónde volver después de pagar. El query param es
                    # solo cosmético para el frontend (puede mostrar
                    # "¡listo!" antes de que llegue el webhook) -- el
                    # desbloqueo real SIEMPRE lo dispara el webhook, nunca
                    # esta redirección (el usuario podría cerrar la
                    # pestaña antes de volver).
                    "redirect_url": f"{settings.frontend_urls[0]}/payment/success?payment_id={payment.id}",
                },
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
