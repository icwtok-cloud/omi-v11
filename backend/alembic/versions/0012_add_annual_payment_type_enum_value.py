"""add 'annual' value to the paymenttype postgres enum

BUG FIX: agregué PaymentType.annual al enum de Python en 0011 pero me
olvidé de avisarle a Postgres -- el tipo nativo `paymenttype` (creado
en 0001_baseline como Enum("per_project", "subscription", ...)) seguía
sin conocer el valor "annual", así que cualquier INSERT con
payment_type="annual" fallaba con "invalid input value for enum
paymenttype: annual" (visto en producción al intentar el primer pago
del plan anual).

ALTER TYPE ... ADD VALUE no puede correr dentro de la misma transacción
en la que después se usa el valor nuevo (limitación real de Postgres,
no de Alembic) -- se corre en autocommit_block() para evitarlo.

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-19

"""
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE paymenttype ADD VALUE IF NOT EXISTS 'annual'")


def downgrade() -> None:
    # Postgres no soporta DROP VALUE en un enum nativo -- revertir esto
    # requiere recrear el tipo entero (renombrar, crear el viejo, migrar
    # filas, dropear el nuevo). No se implementa acá porque nunca hace
    # falta en la práctica: downgrade de este paso nunca se corrió y no
    # hay filas payment_type='annual' que revertir en un rollback real.
    pass
