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
    Column, String, DateTime, ForeignKey, Float, Boolean, Enum, JSON, Integer
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

    projects = relationship("Project", back_populates="owner")
    payments = relationship("Payment", back_populates="user")


class ProjectStatus(str, enum.Enum):
    uploaded = "uploaded"
    validated = "validated"     # reporte gratis generado, esperando pago
    paid = "paid"                # pago confirmado, descarga habilitada
    downloaded = "downloaded"


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=gen_uuid)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)

    odoo_module = Column(String, nullable=False)   # ej "contactos"
    odoo_version = Column(String, nullable=False)  # ej "17.0"

    original_filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)  # path del archivo subido

    status = Column(Enum(ProjectStatus), default=ProjectStatus.uploaded)

    # Reporte de validación completo (errores, fixes sugeridos, preview).
    # Se guarda como JSON -- ver app/services/validation_engine.py por
    # la forma exacta de esta estructura.
    validation_report = Column(JSON, nullable=True)

    # Config real del cliente para override de defaults (categorías,
    # etapas, plan de cuentas propios), si la proveyó.
    client_config_override = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="projects")
    payment = relationship("Payment", back_populates="project", uselist=False)


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
