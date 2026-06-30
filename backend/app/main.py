from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.core.error_handling import unhandled_exception_handler
from app.api import projects, payments, webhooks

# Crea las tablas si no existen. Para cambios de schema en producción,
# usar alembic (ver alembic.ini) en vez de depender de esto.
Base.metadata.create_all(bind=engine)

# Migración manual para una columna nueva en una tabla existente.
# Postgres soporta "ADD COLUMN IF NOT EXISTS"; SQLite (usado en los tests
# de CI) no tiene esa sintaxis y tira error de parseo. En SQLite la columna
# ya viene incluida porque create_all crea la tabla desde cero, así que acá
# solo hace falta correr el ALTER en Postgres.
from sqlalchemy import text

if engine.dialect.name == "postgresql":
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE projects
            ADD COLUMN IF NOT EXISTS odoo_country VARCHAR;
        """))
        conn.commit()

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
