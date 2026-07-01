"""split project into project + project_module (corte limpio)

Rediseño: un Project pasa a ser el contenedor de la migración completa
de un cliente (una versión de Odoo, un país si aplica), y puede tener
hasta 8 ProjectModule adentro (uno por módulo: contactos, crm, etc.),
cada uno con su propio archivo/reporte/fixes. Antes, 1 Project = 1
archivo = 1 módulo.

Corte limpio confirmado con el dueño del producto: no hay pagos reales
ni proyectos de clientes en la base de Render todavía (CHANGELOG.md,
sección de deuda técnica), así que esta migración NO migra datos
existentes -- solo dropea las columnas viejas de `projects` y crea
`project_modules`. Si en algún momento hay datos reales que preservar,
esta migración ya no es aplicable tal cual -- hay que escribir una
migración de datos aparte antes de correr esta.

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-30

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


old_project_status_enum = sa.Enum(
    "uploaded", "validated", "paid", "downloaded", name="projectstatus"
)
new_project_status_enum = sa.Enum(
    "active", "paid", "exported", name="projectstatus_new"
)
module_status_enum = sa.Enum(
    "uploaded", "validating", "validated", "failed", name="modulestatus"
)


def upgrade() -> None:
    bind = op.get_bind()

    # --- 1. project_modules: tabla nueva con todo lo que antes vivía en projects ---
    # OJO: no llamar a module_status_enum.create() a mano acá. op.create_table
    # ya crea el tipo Enum automáticamente como parte de la creación de la
    # tabla -- si además lo creamos manualmente antes, la creación automática
    # de create_table lo intenta crear DE NUEVO en la misma transacción y
    # revienta con "type already exists" (no respeta checkfirst en ese
    # camino). Dejar que create_table sea el único que lo cree.
    op.create_table(
        "project_modules",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("odoo_module", sa.String(), nullable=False),
        sa.Column("original_filename", sa.String(), nullable=False),
        sa.Column("storage_path", sa.String(), nullable=False),
        sa.Column("status", module_status_enum, nullable=True),
        sa.Column("validation_report", sa.JSON(), nullable=True),
        sa.Column("client_config_override", sa.JSON(), nullable=True),
        sa.Column("confirmed_manual_fixes", sa.JSON(), nullable=True),
        sa.Column("rows_processed", sa.Integer(), nullable=True, default=0),
        sa.Column("rows_total", sa.Integer(), nullable=True),
        sa.Column("validation_started_at", sa.DateTime(), nullable=True),
        sa.Column("validation_error", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("project_id", "odoo_module", name="uq_project_module"),
    )
    op.create_index(
        "ix_project_modules_project_id", "project_modules", ["project_id"]
    )

    # --- 2. projects: dropear las columnas que se mudaron a project_modules ---
    # Corte limpio: sin migración de datos (ver docstring del módulo).
    op.drop_column("projects", "odoo_module")
    op.drop_column("projects", "original_filename")
    op.drop_column("projects", "storage_path")
    op.drop_column("projects", "validation_report")
    op.drop_column("projects", "client_config_override")
    op.drop_column("projects", "confirmed_manual_fixes")

    # --- 3. projects.status: nuevo enum (active/paid/exported en vez de
    # uploaded/validated/paid/downloaded) -- Postgres no permite editar
    # valores de un enum existente in-place de forma simple, así que se
    # crea el tipo nuevo, se migra la columna, se dropea el viejo.
    new_project_status_enum.create(bind, checkfirst=True)

    op.execute("ALTER TABLE projects ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE projects ALTER COLUMN status TYPE projectstatus_new "
        "USING (CASE status::text "
        "WHEN 'paid' THEN 'paid' "
        "WHEN 'downloaded' THEN 'exported' "
        "ELSE 'active' END)::projectstatus_new"
    )
    op.execute("ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'active'")

    old_project_status_enum.drop(bind, checkfirst=True)
    op.execute("ALTER TYPE projectstatus_new RENAME TO projectstatus")


def downgrade() -> None:
    bind = op.get_bind()

    # Revertir el enum de status primero (mismo patrón: tipo nuevo -> migrar -> dropear viejo).
    # Enum.create() no acepta un kwarg `name` -- hay que instanciar un
    # Enum nuevo con ese nombre en vez de reusar old_project_status_enum.
    project_status_old_enum = sa.Enum(
        "uploaded", "validated", "paid", "downloaded", name="projectstatus_old"
    )
    project_status_old_enum.create(bind, checkfirst=True)
    op.execute("ALTER TABLE projects ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE projects ALTER COLUMN status TYPE projectstatus_old "
        "USING (CASE status::text "
        "WHEN 'paid' THEN 'paid' "
        "WHEN 'exported' THEN 'downloaded' "
        "ELSE 'uploaded' END)::projectstatus_old"
    )
    op.execute("ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'uploaded'")
    sa.Enum(name="projectstatus").drop(bind, checkfirst=True)
    op.execute("ALTER TYPE projectstatus_old RENAME TO projectstatus")

    # Recrear las columnas viejas en projects (sin datos -- el corte limpio
    # tampoco es reversible con datos, solo con estructura).
    op.add_column("projects", sa.Column("odoo_module", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("original_filename", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("storage_path", sa.String(), nullable=True))
    op.add_column("projects", sa.Column("validation_report", sa.JSON(), nullable=True))
    op.add_column("projects", sa.Column("client_config_override", sa.JSON(), nullable=True))
    op.add_column("projects", sa.Column("confirmed_manual_fixes", sa.JSON(), nullable=True))

    op.drop_index("ix_project_modules_project_id", table_name="project_modules")
    op.drop_table("project_modules")
    module_status_enum.drop(bind, checkfirst=True)
