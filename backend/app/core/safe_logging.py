"""
Logger central de OMI.

Regla dura: este módulo nunca acepta el contenido de un archivo, una fila,
o un valor de campo como argumento. Solo metadata: IDs, hashes, contadores,
nombres de columna (no valores), duraciones.

Si en el futuro alguien necesita loguear "qué pasó con la fila X", debe
loguear el row_index y el issue_type, nunca el valor real del dato.
"""

from __future__ import annotations

import logging
import sys

logger = logging.getLogger("omi")
logger.setLevel(logging.INFO)
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
if not logger.handlers:
    logger.addHandler(_handler)


def log_event(event: str, **safe_fields) -> None:
    """Loguea un evento con campos explícitamente seguros (metadata).
    No pasar nunca 'value', 'row', contenido de archivo, ni objetos crudos
    de pandas/dataframes acá."""
    parts = " ".join(f"{k}={v}" for k, v in safe_fields.items())
    logger.info(f"{event} {parts}")


def log_error(event: str, error: Exception, **safe_fields) -> None:
    """Loguea un error capturando tipo y mensaje de la excepción, pero sin
    el traceback completo hacia afuera (eso se ve en logs del proceso,
    nunca se devuelve al cliente -- ver app/core/error_handling.py)."""
    parts = " ".join(f"{k}={v}" for k, v in safe_fields.items())
    logger.error(f"{event} error_type={type(error).__name__} {parts}")
