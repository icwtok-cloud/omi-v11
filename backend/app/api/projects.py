"""
Endpoints del flujo principal de OMI:

  POST /projects                              -> crea el proyecto (contenedor, sin archivo todavía)
  POST /projects/{id}/modules                 -> sube un archivo para un módulo del proyecto (hasta 8)
  POST /projects/{id}/modules/{mid}/validate  -> corre el motor de validación sobre ese módulo (gratis)
  GET  /projects/{id}/modules/{mid}/report    -> devuelve el reporte de ese módulo (gratis)
  POST /projects/{id}/modules/{mid}/apply-fixes -> aplica fixes elegidos por el usuario para ese módulo
  GET  /projects/{id}                         -> resumen del proyecto + todos sus módulos
  GET  /projects/{id}/download                -> entrega un ZIP con todos los módulos validados,
                                                   SOLO si paid/subscription

Un Project es el contenedor de la migración completa de un cliente (una
versión de Odoo, un país si aplica). Adentro, cada ProjectModule es un
módulo (contactos, crm, etc.) con su propio archivo/reporte/fixes,
acumulados sin perderse entre sí -- el pago y la descarga son a nivel
Project, no por módulo individual.
"""

from __future__ import annotations

import csv
import time
import uuid
import zipfile
from io import BytesIO
from pathlib import Path

import pandas as pd
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.core.safe_logging import log_event
from app.models.db_models import (
    Project, ProjectModule, ProjectStatus, ModuleStatus, MAX_MODULES_PER_PROJECT, User,
)
from app.services.rules_loader import load_rule_schema, list_available_combinations
from app.services.validation_engine import validate_dataframe
from app.services.module_dependencies import import_order, missing_dependencies
from app.services.report_pdf import build_module_report_pdf
from app.services.entitlements import (
    user_can_download, can_export_project, FREE_TIER_MODULE_LIMIT,
    can_process_validation_events, reset_annual_events_if_needed,
)
from app.api.schemas import (
    ValidationReportResponse, AvailableCombination, ProjectCreateRequest,
    ProjectCreateResponse, ProjectSummaryResponse, ModuleSummaryResponse,
    ModuleUploadResponse, ModuleValidateStartResponse, ModuleValidateStatusResponse,
)

router = APIRouter(prefix="/projects", tags=["projects"])

UPLOAD_DIR = Path(settings.upload_storage_path)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Si una validación sigue "en curso" pasado este tiempo, se asume que
# el proceso que la corría murió (deploy, OOM, crash) sin llegar a
# actualizar el status -- ver get_validate_status(). Generoso a
# propósito: un archivo de 150.000 filas puede tardar minutos.
VALIDATION_STALE_MINUTES = 15

# A partir de cuántas filas se loguea el evento "LargeFileProcessed" --
# puramente informativo/telemetría, no cambia ningún comportamiento.
# 100k es el orden de magnitud que el producto menciona como caso de
# uso real (migraciones de cientos de miles de registros).
LARGE_FILE_ROW_THRESHOLD = 100_000


@router.get("/available-combinations", response_model=list[AvailableCombination])
def get_available_combinations():
    """Alimenta el selector del frontend: qué módulo+versión están
    realmente soportados (tienen reglas generadas), para no dejar
    elegir una combinación inexistente."""
    return list_available_combinations()


def _detect_csv_separator(path: Path) -> str:
    """Muchos exports LatAm (sobre todo Excel guardado con configuración
    regional es-AR/es-ES, donde "," es el separador decimal) usan ";" como
    separador de columnas en vez de ",". Si asumimos "," siempre, un valor
    con una coma adentro (ej. la etiqueta "Cliente, VIP" de un export real
    de Odoo) rompe el parseo con "Expected N fields, saw N+1" -- justo el
    caso de un archivo perfectamente válido que terminaba pareciendo
    corrupto. Se sniffea el separador real de una muestra del archivo en
    vez de asumirlo, sin perder la velocidad del engine C de pandas."""
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        sample = f.read(4096)
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        return dialect.delimiter
    except csv.Error:
        return ","  # fallback: el default de siempre


def _read_tabular_file(path: Path, original_filename: str) -> pd.DataFrame:
    suffix = Path(original_filename).suffix.lower()
    try:
        if suffix == ".csv":
            sep = _detect_csv_separator(path)
            try:
                # La mayoría de los exports son UTF-8 (o UTF-8 con BOM,
                # que "utf-8-sig" pela solo). "utf-8-sig" no rompe con
                # archivos UTF-8 sin BOM, así que es un default seguro.
                return pd.read_csv(path, sep=sep, encoding="utf-8-sig")
            except UnicodeDecodeError:
                # Un export de Excel Windows guardado como "CSV" (no "CSV
                # UTF-8") usa cp1252/Latin-1 por default -- muy común en
                # archivos LatAm con acentos/ñ. Sin este fallback, un
                # archivo perfectamente válido rompía con un mensaje
                # genérico de "columnas desparejas" que no apuntaba al
                # problema real (encoding, no estructura).
                return pd.read_csv(path, sep=sep, encoding="cp1252")
        elif suffix in (".xlsx", ".xls"):
            return pd.read_excel(path)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Formato '{suffix}' no soportado. Usá CSV o Excel (.xlsx).",
            )
    except HTTPException:
        raise
    except (pd.errors.ParserError, UnicodeDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=400,
            detail=(
                "No pudimos leer tu archivo -- revisá que todas las filas "
                "tengan la misma cantidad de columnas y que esté guardado "
                "en un encoding de texto estándar (UTF-8 o Windows-1252). "
                "Si lo exportaste desde Excel, probá guardarlo de nuevo "
                "como 'CSV UTF-8'."
            ),
        )


def _validate_file_signature(contents: bytes, suffix: str) -> None:
    """Valida que el contenido real del archivo coincida con lo que la
    extensión declara, en vez de confiar ciegamente en el nombre subido.
    XLSX/XLS son ZIP/OLE2 con firma binaria fija; CSV no tiene firma
    binaria, pero rechazamos contenido que parezca binario (control chars
    fuera de tab/newline en los primeros bytes) para evitar que un archivo
    ejecutable o binario disfrazado de .csv llegue al parser de pandas."""
    if suffix in (".xlsx", ".xls"):
        is_zip = contents[:4] == b"PK\x03\x04"       # xlsx moderno (zip)
        is_ole2 = contents[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # xls legacy
        if not (is_zip or is_ole2):
            raise HTTPException(
                status_code=400,
                detail="El archivo no tiene el formato Excel esperado (firma binaria inválida).",
            )
    elif suffix == ".csv":
        sample = contents[:2048]
        if b"\x00" in sample:
            raise HTTPException(
                status_code=400,
                detail="El archivo no parece un CSV de texto válido.",
            )


@router.post("", response_model=ProjectCreateResponse)
def create_project(
    body: ProjectCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crea el proyecto vacío -- todavía sin ningún módulo/archivo. El
    primer módulo se sube después con POST /projects/{id}/modules."""
    project = Project(
        owner_id=user.id,
        odoo_version=body.odoo_version,
        odoo_country=body.odoo_country,
        status=ProjectStatus.active,
    )
    db.add(project)
    db.commit()

    log_event(
        "ProjectCreated",
        project_id=project.id, owner_id=user.id,
        odoo_version=project.odoo_version, odoo_country=project.odoo_country,
    )
    return ProjectCreateResponse(project_id=project.id, status=project.status.value)


@router.get("/{project_id}", response_model=ProjectSummaryResponse)
def get_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, user, db)
    modules_in_project = [m.odoo_module for m in project.modules]
    return ProjectSummaryResponse(
        project_id=project.id,
        odoo_version=project.odoo_version,
        odoo_country=project.odoo_country,
        status=project.status.value,
        modules=[
            ModuleSummaryResponse(
                module_id=m.id,
                odoo_module=m.odoo_module,
                status=m.status.value,
                total_issues=(m.validation_report or {}).get("total_issues"),
                quality_score=(m.validation_report or {}).get("quality_score"),
                missing_dependencies=missing_dependencies(m.odoo_module, modules_in_project),
            )
            for m in project.modules
        ],
    )


@router.post("/{project_id}/modules", response_model=ModuleUploadResponse)
async def upload_module(
    project_id: str,
    odoo_module: str = Form(...),
    odoo_country: str | None = Form(None),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, user, db)

    # Se lee en chunks y se corta apenas se supera el límite, en vez de
    # `file.read()` completo -- ese hubiera cargado el archivo entero en
    # memoria ANTES de poder chequear el tamaño, permitiendo que un
    # upload de varios GB agote la memoria del dyno compartido de Render
    # (que también sirve a otros usuarios) antes de llegar al 413.
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    chunk_size = 1024 * 1024
    chunks = []
    total_read = 0
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Archivo supera el máximo de {settings.max_upload_size_mb}MB",
            )
        chunks.append(chunk)
    contents = b"".join(chunks)

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".csv", ".xlsx", ".xls"):
        raise HTTPException(
            status_code=400,
            detail=f"Formato '{suffix}' no soportado. Usá CSV o Excel (.xlsx).",
        )
    _validate_file_signature(contents, suffix)

    # El país es una propiedad del proyecto (una sola instancia de Odoo),
    # no de cada módulo -- se fija con el primer módulo que lo necesite.
    # Si el proyecto ya tiene país fijado, ese es el que manda (se ignora
    # cualquier valor distinto que venga en este request).
    effective_country = project.odoo_country or odoo_country

    # Validamos que la combinación módulo+versión+país exista ANTES de
    # guardar nada -- evita módulos huérfanos sin reglas contra qué validar.
    try:
        load_rule_schema(odoo_module, project.odoo_version, effective_country)
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    if project.odoo_country is None and effective_country:
        project.odoo_country = effective_country

    existing = next((m for m in project.modules if m.odoo_module == odoo_module), None)

    if existing is None and len(project.modules) >= MAX_MODULES_PER_PROJECT:
        raise HTTPException(
            status_code=400,
            detail=f"Este proyecto ya tiene el máximo de {MAX_MODULES_PER_PROJECT} módulos.",
        )

    # Tope del proyecto gratis: 1 módulo. Se aplica solo si este es el
    # proyecto elegible como gratis del usuario (su primer proyecto, y
    # todavía no gastó su cuota gratis) -- si ya pagó algo o tiene
    # suscripción, este chequeo ni se activa (el cobro real es al
    # exportar, ver can_export_project(), esto es solo el tope
    # intrínseco a qué significa "gratis").
    if existing is None and not user.free_project_used:
        is_users_first_project = (
            db.query(Project).filter(Project.owner_id == user.id).count() == 1
        )
        if is_users_first_project and len(project.modules) >= FREE_TIER_MODULE_LIMIT:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Tu proyecto de prueba gratis permite un solo módulo -- "
                    "pagá para agregar más."
                ),
            )

    module_id = existing.id if existing else str(uuid.uuid4())
    storage_path = UPLOAD_DIR / f"{project.id}_{module_id}_{file.filename}"
    storage_path.write_bytes(contents)

    if existing:
        # Re-subir el mismo módulo pisa la fila existente -- es un archivo
        # nuevo, así que se descarta cualquier reporte/fix viejo.
        #
        # RIESGO DE CORRUPCIÓN DE DATOS encontrado en auditoría: si el
        # usuario re-sube un archivo con el MISMO nombre de archivo que
        # el anterior, `storage_path` (línea de arriba) da exactamente
        # la misma ruta que la vez pasada. `_ensure_corrected_file` cachea
        # el archivo corregido en disco como
        # `storage_path.with_suffix(".corrected.csv")` y lo devuelve tal
        # cual si YA EXISTE, sin regenerarlo -- así que si quedó un
        # .corrected.csv de una descarga anterior de este mismo módulo
        # (incluso de un archivo con datos totalmente distintos), la
        # próxima descarga serviría en silencio las correcciones del
        # archivo VIEJO sobre el archivo NUEVO. Hay que borrar ese
        # cache acá, en el momento del re-upload, no esperar a
        # _ensure_corrected_file (que solo borra el original, nunca el
        # corregido).
        stale_corrected = Path(existing.storage_path).with_suffix(".corrected.csv")
        if stale_corrected.exists():
            stale_corrected.unlink()

        existing.original_filename = file.filename
        existing.storage_path = str(storage_path)
        existing.status = ModuleStatus.uploaded
        existing.validation_report = None
        existing.confirmed_manual_fixes = None
        existing.rows_processed = 0
        existing.rows_total = None
        existing.validation_started_at = None
        existing.validation_error = None
        module = existing
    else:
        module = ProjectModule(
            id=module_id,
            project_id=project.id,
            odoo_module=odoo_module,
            original_filename=file.filename,
            storage_path=str(storage_path),
            status=ModuleStatus.uploaded,
        )
        db.add(module)

    db.commit()

    log_event(
        "ModuleUploaded",
        project_id=project.id, module_id=module.id,
        odoo_module=odoo_module, file_size_bytes=len(contents),
        is_reupload=existing is not None,
    )
    return ModuleUploadResponse(
        project_id=project.id, module_id=module.id,
        odoo_module=module.odoo_module, status=module.status.value,
    )


@router.post(
    "/{project_id}/modules/{module_id}/validate",
    response_model=ModuleValidateStartResponse,
    status_code=202,
)
def validate_module(
    project_id: str,
    module_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dispara la validación en background y devuelve 202 de inmediato --
    no bloquea la request esperando a que termine (puede tardar minutos
    en un archivo de 150.000 filas). El frontend hace polling a
    GET .../validate-status hasta que status pase a "validated"/"failed".
    Ver _run_validation_job() más abajo."""
    project = _get_owned_project(project_id, user, db)
    module = _get_project_module(project, module_id)

    module.status = ModuleStatus.validating
    module.rows_processed = 0
    module.rows_total = None
    module.validation_started_at = datetime.utcnow()
    module.validation_error = None
    db.commit()

    background_tasks.add_task(_run_validation_job, module_id)

    return ModuleValidateStartResponse(
        project_id=project.id, module_id=module.id, status=module.status.value,
    )


def _run_validation_job(module_id: str) -> None:
    """Corre en background, DESPUÉS de que la response 202 ya se mandó --
    abre su propia sesión de DB porque no puede reusar la del request
    (esa ya se cerró). Nunca debe dejar un módulo trabado en
    "validating": cualquier excepción se captura y se guarda en
    validation_error con status=failed."""
    db = SessionLocal()
    try:
        module = db.query(ProjectModule).filter(ProjectModule.id == module_id).first()
        if not module:
            return
        project = db.query(Project).filter(Project.id == module.project_id).first()
        user = db.query(User).filter(User.id == project.owner_id).first()

        log_event(
            "ValidationStarted",
            project_id=project.id, module_id=module.id, odoo_module=module.odoo_module,
        )
        started_at = time.perf_counter()

        try:
            schema = load_rule_schema(module.odoo_module, project.odoo_version, project.odoo_country)
            df = _read_tabular_file(Path(module.storage_path), module.original_filename)
            row_count = len(df)

            if row_count >= LARGE_FILE_ROW_THRESHOLD:
                log_event(
                    "LargeFileProcessed",
                    project_id=project.id, module_id=module.id, rows=row_count,
                )
            if user.annual_event_limit is not None:
                log_event(
                    "PartnerValidation",
                    project_id=project.id, module_id=module.id, owner_id=user.id, rows=row_count,
                )

            # Solo aplica a socios con membresía anual (annual_event_limit
            # seteado) -- para cualquier otro usuario esto es un no-op.
            # Se chequea ANTES de correr la validación (que puede tardar
            # minutos en un archivo grande) para no gastar tiempo de CPU
            # en un intento que de todas formas se va a rechazar.
            allowed, err = can_process_validation_events(user, row_count)
            if not allowed:
                module.status = ModuleStatus.failed
                module.validation_error = err
                db.commit()
                log_event(
                    "ValidationFailed",
                    project_id=project.id, module_id=module.id, error_type="AnnualQuotaExceeded",
                )
                return

            def _persist_progress(done: int, total: int) -> None:
                module.rows_processed = done
                module.rows_total = total
                db.commit()

            report = validate_dataframe(
                df, schema, client_override=module.client_config_override,
                on_progress=_persist_progress,
            )

            module.validation_report = report.to_dict()
            module.status = ModuleStatus.validated
            if user.annual_event_limit is not None:
                reset_annual_events_if_needed(user)
                user.annual_events_used += len(df)
            db.commit()

            duration_ms = round((time.perf_counter() - started_at) * 1000, 1)
            rows_per_sec = round(row_count / max(duration_ms / 1000, 0.001), 1)
            log_event(
                "ValidationFinished",
                project_id=project.id, module_id=module.id,
                rows=row_count, issues=report.total_issues,
                quality_score=report.quality_score,
                duration_ms=duration_ms, rows_per_sec=rows_per_sec,
            )
        except Exception as e:
            module.status = ModuleStatus.failed
            module.validation_error = str(e)
            db.commit()
            log_event(
                "ValidationFailed",
                project_id=project.id, module_id=module.id, error_type=type(e).__name__,
            )
    finally:
        db.close()


@router.get(
    "/{project_id}/modules/{module_id}/validate-status",
    response_model=ModuleValidateStatusResponse,
)
def get_validate_status(
    project_id: str,
    module_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, user, db)
    module = _get_project_module(project, module_id)

    # Si el proceso de Render se reinicia (deploy, OOM, crash) mientras
    # _run_validation_job corre en background, ese except nunca llega a
    # ejecutarse -- el módulo queda en "validating" para siempre, sin
    # ningún cron que lo detecte (no hay uno en este proyecto). Sin
    # esto, el usuario solo veía un spinner infinito sin ninguna señal
    # de que algo se rompió ni forma de saber que puede reintentar
    # (re-POSTear /validate SÍ funciona -- el bug era que nada se lo
    # decía). Se detecta acá, en el polling, en vez de con un job
    # aparte: si sigue "validating" pasados VALIDATION_STALE_MINUTES,
    # se lo marca "failed" con un mensaje claro.
    if module.status == ModuleStatus.validating and module.validation_started_at:
        elapsed = datetime.utcnow() - module.validation_started_at
        if elapsed > timedelta(minutes=VALIDATION_STALE_MINUTES):
            module.status = ModuleStatus.failed
            module.validation_error = (
                "La validación no terminó en el tiempo esperado -- puede haber "
                "pasado un reinicio del servidor. Volvé a intentar la validación."
            )
            db.commit()

    return ModuleValidateStatusResponse(
        status=module.status.value,
        rows_processed=module.rows_processed or 0,
        rows_total=module.rows_total,
        started_at=(
            module.validation_started_at.isoformat() if module.validation_started_at else None
        ),
        error=module.validation_error,
    )


@router.get("/{project_id}/modules/{module_id}/report", response_model=ValidationReportResponse)
def get_module_report(
    project_id: str,
    module_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, user, db)
    module = _get_project_module(project, module_id)
    if not module.validation_report:
        raise HTTPException(status_code=404, detail="Este módulo todavía no fue validado")

    return ValidationReportResponse(
        project_id=project.id,
        module_id=module.id,
        can_download=(
            False
            if module.validation_report.get("structural_mismatch")
            else user_can_download(db, project)
        ),
        **module.validation_report,
    )


@router.get("/{project_id}/modules/{module_id}/report.pdf")
def get_module_report_pdf(
    project_id: str,
    module_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Informe técnico en PDF -- misma información que /report (JSON),
    en un formato que un partner puede mandarle directo al cliente como
    evidencia de la migración. No requiere pago: es el mismo reporte que
    ya se ve gratis dentro de OMI, solo en otro formato."""
    project = _get_owned_project(project_id, user, db)
    module = _get_project_module(project, module_id)
    if not module.validation_report:
        raise HTTPException(status_code=404, detail="Este módulo todavía no fue validado")

    pdf_bytes = build_module_report_pdf(
        odoo_module=module.odoo_module,
        odoo_version=project.odoo_version,
        odoo_country=project.odoo_country,
        report=module.validation_report,
    )
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="omi_{module.odoo_module}_reporte.pdf"'
        },
    )


@router.post("/{project_id}/modules/{module_id}/apply-fixes")
def apply_module_fixes(
    project_id: str,
    module_id: str,
    fixes: list[dict],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Guarda qué fixes manuales eligió aplicar el usuario para este módulo
    (lista de {"row_index": int, "column": str}). Se aplican recién al
    generar el archivo corregido, en _ensure_corrected_file()."""
    project = _get_owned_project(project_id, user, db)
    module = _get_project_module(project, module_id)
    if not module.validation_report:
        raise HTTPException(status_code=404, detail="Este módulo todavía no fue validado")

    module.confirmed_manual_fixes = fixes
    db.commit()

    # Mismo bug de fondo que el de re-subir un archivo con el mismo
    # nombre (ver CHANGELOG): _ensure_corrected_file cachea el .csv
    # corregido en disco y lo devuelve tal cual si ya existe. Si el
    # usuario ya había descargado el proyecto una vez (generando el
    # cache) y después vuelve a confirmar fixes manuales DISTINTOS,
    # sin esto la próxima descarga seguía sirviendo el corregido viejo
    # -- silenciosamente ignorando los nuevos fixes que el usuario
    # acaba de confirmar. Se borra el cache acá para forzar que se
    # regenere con los fixes actualizados en la próxima descarga.
    stale_corrected = Path(module.storage_path).with_suffix(".corrected.csv")
    if stale_corrected.exists():
        stale_corrected.unlink()

    log_event(
        "ManualFixApplied",
        project_id=project.id, module_id=module.id, fixes_count=len(fixes),
    )
    return {"confirmed_count": len(fixes)}


@router.get("/{project_id}/download")
def download_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, user, db)

    # Bloquea la fila del usuario ANTES de chequear/consumir cuota --
    # sin esto, dos requests concurrentes (doble click, retry por
    # timeout, o un abuso deliberado en paralelo) pueden leer la misma
    # cuota "disponible" antes de que cualquiera de las dos confirme el
    # incremento, resultando en más exports de los que la cuota permite.
    # `with_for_update()` en Postgres (producción) toma un row lock real
    # que hace esperar a la segunda request hasta que la primera
    # comitea; en SQLite (tests) es un no-op inofensivo -- el motor ya
    # serializa escrituras a nivel de archivo.
    user = db.query(User).filter(User.id == user.id).with_for_update().first()

    allowed, err = can_export_project(db, user, project)
    if not allowed:
        raise HTTPException(status_code=402, detail=err)  # Payment Required

    validated_modules = [m for m in project.modules if m.validation_report]
    if not validated_modules:
        raise HTTPException(status_code=400, detail="Este proyecto todavía no tiene ningún módulo validado")

    # Se numeran los archivos según el orden de importación recomendado
    # (ver module_dependencies.py) -- importar "ventas" antes que
    # "contactos" hace que Odoo rechace o vacíe relaciones a contactos
    # que todavía no existen. El orden alfabético no refleja esto.
    modules_by_name = {m.odoo_module: m for m in validated_modules}
    ordered_names = import_order(list(modules_by_name.keys()))

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for position, odoo_module in enumerate(ordered_names, start=1):
            module = modules_by_name[odoo_module]
            corrected_path = _ensure_corrected_file(module, db)
            zf.write(corrected_path, arcname=f"{position:02d}_{module.odoo_module}_corregido.csv")

    zip_buffer.seek(0)
    zip_size_bytes = zip_buffer.getbuffer().nbytes
    log_event(
        "ExportGenerated",
        project_id=project.id, modules_count=len(validated_modules),
        zip_size_bytes=zip_size_bytes,
    )

    # El contador se incrementa EXACTAMENTE acá, en el mismo commit que
    # el cambio de estado del proyecto -- atómico, evita doble conteo si
    # el cliente reintenta la request. Solo cuenta si este export no
    # estaba ya cubierto por un pago puntual (esos son ilimitados para
    # SU proyecto). Misma condición que can_export_project(), en el
    # mismo orden, para no divergir de lo que ya se autorizó arriba.
    if project.status != ProjectStatus.paid:
        is_users_first_project = (
            db.query(Project).filter(Project.owner_id == user.id).count() == 1
        )
        if not user.free_project_used and is_users_first_project:
            user.free_project_used = True
        else:
            user.monthly_export_count += 1

    project.status = ProjectStatus.exported
    db.commit()

    log_event("ExportDownloaded", project_id=project.id, zip_size_bytes=zip_size_bytes)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="omi_{project.id}.zip"'},
    )


def _ensure_corrected_file(module: ProjectModule, db: Session) -> Path:
    """Genera (si no existe ya) el archivo con los fixes automáticos
    aplicados para este módulo. Los fixes manuales que el usuario haya
    elegido en el frontend se aplican en el endpoint apply-fixes, antes
    de llegar acá."""
    corrected_path = Path(module.storage_path).with_suffix(".corrected.csv")
    if corrected_path.exists():
        return corrected_path

    df = _read_tabular_file(Path(module.storage_path), module.original_filename)
    report = module.validation_report or {}

    confirmed_manual = {
        (f["row_index"], f["column"]) for f in (module.confirmed_manual_fixes or [])
    }

    for issue in report.get("issues", []):
        row_idx = issue["row_index"]
        col = issue["column"]
        is_confirmed_manual = (row_idx, col) in confirmed_manual
        should_apply = issue.get("fix_is_automatic") or is_confirmed_manual
        if should_apply and issue.get("suggested_fix") is not None:
            if col in df.columns and row_idx in df.index:
                df.at[row_idx, col] = issue["suggested_fix"]

    df.to_csv(corrected_path, index=False)

    # A diferencia de una versión anterior, ya NO se borra el archivo
    # original acá. Antes se borraba apenas se generaba el corregido
    # ("zero-retention"), pero eso rompía la regeneración: tanto
    # re-subir un archivo con el mismo nombre como confirmar NUEVOS
    # fixes manuales invalidan el `.corrected.csv` (ver upload_module y
    # apply_module_fixes) para forzar que se regenere en la próxima
    # descarga -- pero sin el original en disco, esa regeneración
    # fallaba con `FileNotFoundError` en vez de servir los datos
    # correctos. Mantener el original vivo mientras el módulo exista es
    # el precio de poder corregir esos bugs de datos correctamente; la
    # limpieza de archivos abandonados (proyectos nunca descargados)
    # queda como tarea de limpieza programada aparte, no acá.
    return corrected_path


def _get_owned_project(project_id: str, user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Este proyecto no te pertenece")
    return project


def _get_project_module(project: Project, module_id: str) -> ProjectModule:
    module = next((m for m in project.modules if m.id == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Módulo no encontrado en este proyecto")
    return module
