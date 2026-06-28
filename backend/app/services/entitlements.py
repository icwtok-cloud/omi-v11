"""
Qué pasa cuando un pago se confirma -- separado del listener de blockchain
para que la lógica de negocio (qué se desbloquea) no esté mezclada con la
lógica de blockchain (cómo se detecta el pago).
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.db_models import Payment, PaymentType, Project, ProjectStatus, User


SUBSCRIPTION_DURATION_DAYS = 30


def apply_payment_confirmation(db: Session, payment: Payment) -> None:
    if payment.payment_type == PaymentType.per_project:
        if payment.project_id:
            project = db.query(Project).filter(Project.id == payment.project_id).first()
            if project:
                project.status = ProjectStatus.paid
                db.commit()

    elif payment.payment_type == PaymentType.subscription:
        user = db.query(User).filter(User.id == payment.user_id).first()
        if user:
            # si ya tenía suscripción activa, extiende desde el vencimiento
            # actual en vez de desde hoy (no le "regala" tiempo perdido,
            # pero tampoco le corta lo que ya tenía pago)
            base = user.subscription_expires_at or datetime.utcnow()
            if base < datetime.utcnow():
                base = datetime.utcnow()
            user.has_active_subscription = True
            user.subscription_expires_at = base + timedelta(days=SUBSCRIPTION_DURATION_DAYS)
            db.commit()


def user_can_download(db: Session, project: Project) -> bool:
    """Un usuario puede descargar un proyecto si: pagó ese proyecto
    puntualmente, O tiene una suscripción activa vigente."""
    if project.status == ProjectStatus.paid or project.status == ProjectStatus.downloaded:
        return True

    user = db.query(User).filter(User.id == project.owner_id).first()
    if user and user.has_active_subscription:
        if user.subscription_expires_at and user.subscription_expires_at > datetime.utcnow():
            return True

    return False
