"""
Modelos de base de datos.

Nota sobre usuarios: Clerk es la fuente de verdad de identidad (email,
password, sesión). Acá NO guardamos contraseñas ni nada de eso -- solo
una tabla liviana `users` para tener un id propio al que referenciar
desde projects/payments, sincronizada vía webhook de Clerk
(ver app/api/webhooks.py).
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Float, Boolean, Enum, JSON, Integer,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)  # mismo id que Clerk (user_xxx)
    email = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # True si tiene una suscripción mensual activa (ver Payment más abajo).
    # Se recalcula en cada pago confirmado / vencimiento, no se confía
    # ciegamente en este campo para decisiones críticas de billing.
    has_active_subscription = Column(Boolean, default=False)
    subscription_expires_at = Column(DateTime, nullable=True)

    # Cuota gratis: se consume UNA sola vez, en el primer proyecto de la
    # cuenta (ver can_export_project() en entitlements.py) -- 1 módulo,
    # reporte + descarga incluidos, para poder probar que la plataforma
    # funciona de verdad antes de pagar.
    free_project_used = Column(Boolean, default=False)

    # Cuota de suscripción: hasta 5 proyectos EXPORTADOS por mes
    # calendario (no ilimitado). Se resetea comparando la fecha actual
    # contra monthly_export_reset_at -- ver
    # entitlements.reset_monthly_counter_if_needed().
    monthly_export_count = Column(Integer, default=0)
    monthly_export_reset_at = Column(DateTime, nullable=True)

    projects = relationship("Project", back_populates="owner")
    payments = relationship("Payment", back_populates="user")


class ProjectStatus(str, enum.Enum):
    active = "active"       # el proyecto existe, 0+ módulos subidos/validados, nada pagado aún
    paid = "paid"           # un pago per_project confirmado para este proyecto -- exportes ilimitados de ESTE proyecto
    exported = "exported"   # al menos una exportación exitosa ocurrió (auditoría; no bloquea re-exportar si ya está paid)


class ModuleStatus(str, enum.Enum):
    uploaded = "uploaded"
    validating = "validating"
    validated = "validated"
    failed = "failed"


# Módulos de Odoo soportados por OMI -- ver rules-generator/output/.
# Tope de 8 por proyecto (se enforce en la API, no acá).
MAX_MODULES_PER_PROJECT = 8


class Project(Base):
    """Contenedor de la migración completa de un cliente: una instancia de
    Odoo (una versión, un país si aplica), con hasta MAX_MODULES_PER_PROJECT
    módulos acumulados adentro (ver ProjectModule). El pago y la exportación
    son a nivel de Project, no de módulo individual -- el usuario sube y
    valida módulo por módulo sin perder progreso, y paga/exporta todo junto
    cuando está listo."""

    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=gen_uuid)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)

    odoo_version = Column(String, nullable=False)  # ej "17.0" -- fijo por proyecto, una sola instancia de Odoo
    odoo_country = Column(String, nullable=True)   # ej "ar", None si ningún módulo del proyecto varía por país

    status = Column(Enum(ProjectStatus), default=ProjectStatus.active)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="projects")
    payment = relationship("Payment", back_populates="project", uselist=False)
    modules = relationship(
        "ProjectModule", back_populates="project", cascade="all, delete-orphan"
    )


class ProjectModule(Base):
    """Un módulo (ej. "contactos") dentro de un Project, con su propio
    archivo subido, reporte de validación y fixes confirmados. Re-subir un
    archivo para el mismo módulo pisa esta fila (ver UNIQUE de abajo) -- es
    intencional, un módulo = un archivo vigente a la vez dentro del proyecto."""

    __tablename__ = "project_modules"
    __table_args__ = (
        UniqueConstraint("project_id", "odoo_module", name="uq_project_module"),
    )

    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)

    odoo_module = Column(String, nullable=False)   # ej "contactos"

    original_filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)  # path del archivo subido

    status = Column(Enum(ModuleStatus), default=ModuleStatus.uploaded)

    # Reporte de validación completo (errores, fixes sugeridos, preview).
    # Se guarda como JSON -- ver app/services/validation_engine.py por
    # la forma exacta de esta estructura.
    validation_report = Column(JSON, nullable=True)

    # Config real del cliente para override de defaults (categorías,
    # etapas, plan de cuentas propios), si la proveyó -- puede variar por
    # módulo (ej. defaults de crm distintos a los de contactos).
    client_config_override = Column(JSON, nullable=True)

    # Fixes manuales que el usuario confirmó explícitamente en el reporte
    # (issues con fix_is_automatic=False pero suggested_fix presente, que
    # el usuario eligió aplicar). Se guarda como lista de
    # {"row_index": int, "column": str} -- NO como índices del array de
    # issues, porque ese orden podría cambiar entre validaciones. Se
    # aplican en _ensure_corrected_file() junto con los automáticos.
    confirmed_manual_fixes = Column(JSON, nullable=True)

    # Progreso de validación (ver Fase 4 del roadmap) -- se persisten en
    # DB en vez de en memoria porque el dyno free de Render puede
    # reiniciar a mitad de una validación larga.
    rows_processed = Column(Integer, default=0)
    rows_total = Column(Integer, nullable=True)
    validation_started_at = Column(DateTime, nullable=True)
    validation_error = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="modules")


class PaymentType(str, enum.Enum):
    per_project = "per_project"
    subscription = "subscription"


class PaymentStatus(str, enum.Enum):
    pending = "pending"        # monto generado, esperando que llegue la tx
    confirmed = "confirmed"    # tx vista y con suficientes confirmaciones
    expired = "expired"        # pasó el tiempo límite sin pago


class PaymentNetwork(str, enum.Enum):
    polygon = "polygon"
    base = "base"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)  # null si es suscripción

    payment_type = Column(Enum(PaymentType), nullable=False)
    network = Column(Enum(PaymentNetwork), nullable=True)  # se fija cuando el usuario elige red

    # Monto único con micro-variación para poder identificar la tx entrante
    # contra la dirección fija única (ver app/services/payment_matching.py).
    # Ej: 99.0034 en vez de 99.00 exacto.
    expected_amount_usd = Column(Float, nullable=False)

    status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)

    tx_hash = Column(String, nullable=True)
    confirmations_seen = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    confirmed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)  # ventana para pagar, ej 30 min

    user = relationship("User", back_populates="payments")
    project = relationship("Project", back_populates="payment")
