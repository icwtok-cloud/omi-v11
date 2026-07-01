from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.error_handling import unhandled_exception_handler
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

app.include_router(projects.router)
app.include_router(payments.router)
app.include_router(webhooks.router)
app.include_router(users.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
