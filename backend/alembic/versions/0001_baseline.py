"""baseline -- schema inicial (users, projects, payments)

Esta migración representa el schema que YA existe en la base de Render
hoy (creado originalmente vía Base.metadata.create_all + dos ALTER TABLE
manuales documentados en migrations/manual/). No se corre con
`alembic upgrade head` contra esa base -- se hace `alembic stamp head`
para que Alembic empiece a trackear desde acá sin tocar nada (ver
README de despliegue / CHANGELOG.md).

Contra una base nueva (tests en CI, sqlite local, un entorno nuevo de
verdad) sí se ejecuta normal con `alembic upgrade head` y crea todo
desde cero, incluyendo las columnas que en prod se habían agregado
a mano: projects.odoo_country y projects.confirmed_manual_fixes.

Revision ID: 0001
Revises:
Create Date: 2026-06-30

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


project_status_enum = sa.Enum(
    "uploaded", "validated", "paid", "downloaded", name="projectstatus"
)
payment_type_enum = sa.Enum("per_project", "subscription", name="paymenttype")
payment_status_enum = sa.Enum(
    "pending", "confirmed", "expired", name="paymentstatus"
)
payment_network_enum = sa.Enum("polygon", "base", name="paymentnetwork")


def upgrade() -> None:
    bind = op.get_bind()

    project_status_enum.create(bind, checkfirst=True)
    payment_type_enum.create(bind, checkfirst=True)
    payment_status_enum.create(bind, checkfirst=True)
    payment_network_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column(
            "has_active_subscription", sa.Boolean(), nullable=True, default=False
        ),
        sa.Column("subscription_expires_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "projects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "owner_id", sa.String(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("odoo_module", sa.String(), nullable=False),
        sa.Column("odoo_version", sa.String(), nullable=False),
        # agregada a mano en prod el 2026-06-xx (ver render.yaml / main.py
        # previo al fix de CI) -- acá queda versionada como corresponde.
        sa.Column("odoo_country", sa.String(), nullable=True),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("storage_path", sa.String(), nullable=False),
        sa.Column("status", project_status_enum, nullable=True),
        sa.Column("validation_report", sa.JSON(), nullable=True),
        sa.Column("client_config_override", sa.JSON(), nullable=True),
        # agregada a mano en prod -- ver migrations/manual/001_*.sql
        sa.Column("confirmed_manual_fixes", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=True
        ),
        sa.Column("payment_type", payment_type_enum, nullable=False),
        sa.Column("network", payment_network_enum, nullable=True),
        sa.Column("expected_amount_usd", sa.Float(), nullable=False),
        sa.Column("status", payment_status_enum, nullable=True),
        sa.Column("tx_hash", sa.String(), nullable=True),
        sa.Column("confirmations_seen", sa.Integer(), nullable=True, default=0),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("projects")
    op.drop_table("users")

    payment_network_enum.drop(op.get_bind(), checkfirst=True)
    payment_status_enum.drop(op.get_bind(), checkfirst=True)
    payment_type_enum.drop(op.get_bind(), checkfirst=True)
    project_status_enum.drop(op.get_bind(), checkfirst=True)
