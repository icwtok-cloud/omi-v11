import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.error_handling import unhandled_exception_handler
from app.core.safe_logging import log_event
from app.api import projects, payments, webhooks, users

# El schema de la base ahora lo maneja Alembic (ver alembic/), no la app.
# - En Render, el startCommand corre `alembic upgrade head` antes de
#   levantar uvicorn (ver render.yaml).
# - En tests/CI, conftest.py crea su propia base sqlite en memoria con
#   Base.metadata.create_all() para cada test, así que tampoco depende
#   de esto acá.
# No se crea ni se altera ninguna tabla en el import de este módulo.

app = FastAPI(
    title="OMI API",
    description="Motor de validación y preparación de datos para migrar a Odoo",
    version="1.0.0",
)

app.add_exception_handler(Exception, unhandled_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_correlation_and_access_log(request: Request, call_next):
    """Le da a cada request un ID propio (`request.state.request_id`),
    devuelto en el header `X-Request-ID` -- así un usuario puede pegar
    ese ID en un ticket de soporte y se puede grep-ear un request
    puntual en los logs de Render, sin tener que adivinar por
    timestamp. También deja un access log de una línea por request
    (path, status, duración) -- hoy no existía NINGÚN log de qué
    requests llegan, solo el handler de errores no manejados logueaba
    algo. Se guarda ANTES de leer el body para no interferir con el
    streaming de uploads grandes."""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()

    response = await call_next(request)

    duration_ms = round((time.perf_counter() - started) * 1000, 1)
    response.headers["X-Request-ID"] = request_id
    # Endurece los endpoints de descarga (ZIP/PDF, que sirven contenido
    # derivado de un archivo subido por el usuario) contra MIME-sniffing
    # -- sin esto, un browser podría reinterpretar el contenido de una
    # respuesta como algo distinto al Content-Type declarado. Barato y
    # sin downside aplicarlo a toda respuesta, no solo a las de descarga.
    response.headers["X-Content-Type-Options"] = "nosniff"
    log_event(
        "http_request",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=duration_ms,
    )
    return response


app.include_router(projects.router)
app.include_router(payments.router)
app.include_router(webhooks.router)
app.include_router(users.router)


@app.get("/health")
def health_check():
    """Liveness: el proceso está arriba y puede responder. No verifica
    dependencias -- si esto falla, no hay nada que reintentar, hay que
    reiniciar el proceso."""
    return {"status": "ok"}


@app.get("/health/ready")
def readiness_check():
    """Readiness: además de estar vivo, puede hablar con la DB. Antes,
    `/health` siempre devolvía "ok" incluso con la base caída -- un
    monitor externo (o el propio Render) nunca se enteraba de una
    caída real de la base, solo de que el proceso web seguía
    respondiendo. Se abre una sesión propia (no la dependency `get_db`)
    para no depender del resto del stack de la app en este chequeo."""
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception as e:
        log_event("readiness_check_failed", error_type=type(e).__name__)
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "database": "unreachable"},
        )
    finally:
        db.close()
