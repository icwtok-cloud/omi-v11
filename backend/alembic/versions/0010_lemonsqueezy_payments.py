"""add lemon squeezy as payment provider alongside crypto

Agrega `provider` (crypto | lemonsqueezy) y `lemonsqueezy_order_id` a
`payments`. Puramente aditiva: `provider` tiene server_default='crypto'
para que todos los pagos historicos queden clasificados sin backfill.

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-17

"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

payment_provider_enum = sa.Enum("crypto", "lemonsqueezy", name="paymentprovider")


def upgrade() -> None:
    payment_provider_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "payments",
        sa.Column("provider", payment_provider_enum, nullable=False, server_default="crypto"),
    )
    op.add_column("payments", sa.Column("lemonsqueezy_order_id", sa.String(), nullable=True))
    op.create_unique_constraint(
        "uq_payments_lemonsqueezy_order_id", "payments", ["lemonsqueezy_order_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_payments_lemonsqueezy_order_id", "payments", type_="unique")
    op.drop_column("payments", "lemonsqueezy_order_id")
    op.drop_column("payments", "provider")
    payment_provider_enum.drop(op.get_bind(), checkfirst=True)
