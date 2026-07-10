"""add file_content to project_modules (backup del archivo original)

El upload_storage_path por defecto ("/tmp/omi_uploads") es filesystem
efimero en Render: cualquier reinicio del proceso (deploy, restart,
crash) borra los archivos subidos, aunque el registro en la base de
datos siga existiendo -- causaba FileNotFoundError al descargar
proyectos subidos antes del ultimo reinicio.

Se guarda una copia de los bytes originales en la base de datos como
backup: si el archivo ya no esta en disco, se puede reescribir desde
aca antes de leerlo (ver _ensure_file_on_disk en app/api/projects.py).

Migracion puramente aditiva -- columna nueva nullable, sin tocar nada
existente.

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-10

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "project_modules", sa.Column("file_content", sa.LargeBinary(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("project_modules", "file_content")
