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

from app.core.safe_logging import logger


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    support_id = str(uuid.uuid4())[:8]

    # El traceback completo va SOLO a los logs del proceso (stdout de Render),
    # nunca en la respuesta HTTP. Los logs del proceso pueden incluir datos
    # de variables locales en el traceback -- por eso esto nunca se imprime
    # con safe_logging (que es para eventos deliberados), se usa el logger
    # base de Python a propósito, server-side only.
    logger.error(
        f"UNHANDLED support_id={support_id} path={request.url.path} "
        f"exc_type={type(exc).__name__}\n{traceback.format_exc()}"
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "Ocurrió un error inesperado. Contactá soporte con este ID.",
            "support_id": support_id,
        },
    )
