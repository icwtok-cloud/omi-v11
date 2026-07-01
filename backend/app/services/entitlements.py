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
    puntualmente, O tiene una suscripción activa vigente.

    Nota: esto solo cubre pago puntual + suscripción "activa" en el
    sentido de Clerk/Payment -- la cuota específica de 5 exportes/mes de
    la suscripción y el proyecto gratis se resuelven en
    `can_export_project()` (Fase 3), que es la función que de verdad
    gatea el endpoint de download. Esta función queda como está para no
    romper el chequeo que ya usan /validate y /report para mostrar
    `can_download` informativamente en el reporte."""
    if project.status == ProjectStatus.paid or project.status == ProjectStatus.exported:
        return True

    user = db.query(User).filter(User.id == project.owner_id).first()
    if user and user.has_active_subscription:
        if user.subscription_expires_at and user.subscription_expires_at > datetime.utcnow():
            return True

    return False
