from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.core.error_handling import unhandled_exception_handler
from app.api import projects, payments, webhooks

# Crea las tablas si no existen. Para cambios de schema en producción,
# usar alembic (ver alembic.ini) en vez de depender de esto.
Base.metadata.create_all(bind=engine)

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


@app.get("/health")
def health_check():
    return {"status": "ok"}
