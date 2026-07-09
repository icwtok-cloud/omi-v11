"""
Manejo global de errores no controlados.

Regla: el cliente nunca ve un traceback, un mensaje de excepción interno,
ni el valor que causó el error. Recibe un support_id que el equipo puede
buscar en los logs del proceso (que sí tienen el detalle completo) sin
que ese detalle viaje por la red hacia afuera.
"""

from __future__ import annotations

import traceback
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.safe_logging import logger


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Reusa el request_id que ya generó el middleware de correlación
    # (`app/main.py`) si está disponible -- así el mismo ID que aparece
    # en el access log de esta request es el que el usuario ve en
    # pantalla, sin tener dos IDs distintos para el mismo request.
    support_id = getattr(request.state, "request_id", None) or str(uuid.uuid4())

    # El traceback completo va SOLO a los logs del proceso (stdout de Render),
    # nunca en la respuesta HTTP. Los logs del proceso pueden incluir datos
    # de variables locales en el traceback -- por eso esto nunca se imprime
    # con safe_logging (que es para eventos deliberados), se usa el logger
    # base de Python a propósito, server-side only.
    logger.error(
        f"UNHANDLED support_id={support_id} path={request.url.path} "
        f"exc_type={type(exc).__name__}\n{traceback.format_exc()}"
    )

    response = JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "Ocurrió un error inesperado. Contactá soporte con este ID.",
            "support_id": support_id,
        },
    )
    # Los handlers registrados con add_exception_handler(Exception, ...)
    # corren en ServerErrorMiddleware, que Starlette monta POR FUERA de
    # CORSMiddleware -- esta respuesta nunca pasa por CORSMiddleware, así
    # que sin este header el navegador la bloquea antes de que el frontend
    # pueda leer el mensaje (fetch() falla con "Failed to fetch" genérico,
    # tapando el mensaje bien armado de arriba). Hay que setearlo a mano acá.
    # Se refleja el Origin real de la request (si está en la whitelist) en
    # vez de asumir un único frontend_url fijo -- con más de un origen
    # permitido (ej. apex + www), hardcodear el primero rompía el CORS de
    # los demás exactamente en el peor momento (un error 500 real).
    request_origin = request.headers.get("origin")
    allowed_origin = (
        request_origin if request_origin in settings.frontend_urls else settings.frontend_urls[0]
    )
    response.headers["Access-Control-Allow-Origin"] = allowed_origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response
