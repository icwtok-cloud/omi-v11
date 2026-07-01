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

# Tope de módulos del proyecto gratis -- 1 módulo, para poder probar que
# la plataforma funciona de verdad antes de pagar. Se enforce en
# app/api/projects.py (upload_module), no acá.
FREE_TIER_MODULE_LIMIT = 1

# Tope de proyectos EXPORTADOS por mes calendario para la suscripción --
# ya no es "ilimitado" como antes de la Fase 3. Se resetea el día 1 de
# cada mes (ver reset_monthly_counter_if_needed), no 30 días rodantes
# desde que se suscribió (más simple de explicar y de implementar).
SUBSCRIPTION_MONTHLY_EXPORT_LIMIT = 5


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


def reset_monthly_counter_if_needed(user: User) -> None:
    """Resetea monthly_export_count si cruzamos a un mes calendario
    nuevo desde el último reset. No hace commit -- el caller es
    responsable de persistir junto con el resto de los cambios de la
    misma operación (ver can_export_project / el endpoint de download)."""
    now = datetime.utcnow()
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if user.monthly_export_reset_at is None or user.monthly_export_reset_at < current_month_start:
        user.monthly_export_count = 0
        user.monthly_export_reset_at = current_month_start


def can_export_project(db: Session, user: User, project: Project) -> tuple[bool, str | None]:
    """Decide si ESTE export específico está permitido, y por qué vía
    (proyecto pagado puntual / proyecto gratis / cuota de suscripción).
    No incrementa ningún contador -- eso lo hace el caller (el endpoint
    de download) recién si el export efectivamente se concreta, en el
    mismo commit que el resto de sus side-effects (atómico, evita doble
    conteo en un retry). Devuelve (permitido, mensaje_de_error_si_no)."""
    if user.annual_event_limit is not None:
        # Socio con membresía anual (deal manual, ver README) -- no
        # paga por proyecto ni tiene tope de exportes/mes, su único
        # límite es la cuota de eventos (filas validadas) del año,
        # que se controla aparte en can_process_validation_events().
        # Acá solo se lo exime del gating normal de pago.
        return True, None

    if project.status == ProjectStatus.paid:
        return True, None  # ya pagó este proyecto puntual -- exportes ilimitados de ESE proyecto

    is_users_first_project = (
        db.query(Project).filter(Project.owner_id == user.id).count() == 1
    )
    if not user.free_project_used and is_users_first_project and project.owner_id == user.id:
        return True, None  # usa su proyecto gratis (1 vez por cuenta)

    reset_monthly_counter_if_needed(user)
    if user.has_active_subscription and user.subscription_expires_at and user.subscription_expires_at > datetime.utcnow():
        if user.monthly_export_count < SUBSCRIPTION_MONTHLY_EXPORT_LIMIT:
            return True, None
        return False, (
            f"Llegaste al límite de {SUBSCRIPTION_MONTHLY_EXPORT_LIMIT} "
            "proyectos exportados este mes con tu suscripción."
        )

    return False, "Necesitás pagar este proyecto o tener una suscripción activa para descargarlo."


def reset_annual_events_if_needed(user: User) -> None:
    """Resetea annual_events_used si cruzamos a un año calendario nuevo
    desde el último reset -- mismo patrón que reset_monthly_counter_if_needed
    pero por año, no por mes. No hace commit -- el caller es responsable
    de persistir junto con el resto de los cambios de la misma operación."""
    now = datetime.utcnow()
    current_year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    if user.annual_events_reset_at is None or user.annual_events_reset_at < current_year_start:
        user.annual_events_used = 0
        user.annual_events_reset_at = current_year_start


def can_process_validation_events(user: User, row_count: int) -> tuple[bool, str | None]:
    """Chequea la cuota de eventos (1 evento = 1 fila analizada) de la
    membresía anual de partner -- no aplica en absoluto a usuarios que
    no estén en este plan (annual_event_limit is None), que siguen
    exactamente igual que antes. Se cuenta CADA validación, incluso
    re-validar el mismo archivo (decisión explícita: más simple de
    implementar y de auditar que trackear qué filas ya se cobraron).
    No incrementa el contador -- eso lo hace el caller recién si la
    validación efectivamente corre, para no cobrar un intento fallido."""
    if user.annual_event_limit is None:
        return True, None

    reset_annual_events_if_needed(user)
    if user.annual_events_used + row_count > user.annual_event_limit:
        return False, (
            f"Este archivo llevaría tu cuenta a {user.annual_events_used + row_count:,} "
            f"eventos, por encima del límite anual de {user.annual_event_limit:,} de tu "
            "membresía. Esperá al próximo año calendario o contactá para ampliar tu cuota."
        )
    return True, None
