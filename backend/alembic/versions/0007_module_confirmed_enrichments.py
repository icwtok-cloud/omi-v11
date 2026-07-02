"""add confirmed_enrichments to project_modules (Data Enrichment Engine)

Nueva etapa del pipeline (Data Enrichment, ver
app/services/enrichment_engine.py): permite generar campos TÉCNICOS
seguros (SKU/default_code, External ID) cuando faltan en el archivo,
nunca datos de negocio. Se guarda separado de confirmed_manual_fixes
-- son decisiones distintas del usuario (corregir un dato existente
vs. generar uno técnico que no existía).

Migración puramente aditiva -- columna nueva nullable, sin tocar nada
existente.

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "project_modules", sa.Column("confirmed_enrichments", sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("project_modules", "confirmed_enrichments")
