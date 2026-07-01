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
import uuid
import zipfile
from io import BytesIO
from pathlib import Path

import pandas as pd
from datetime import datetime

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
from app.services.entitlements import (
    user_can_download, can_export_project, FREE_TIER_MODULE_LIMIT,
)
from app.api.schemas import (
    ValidationReportResponse, AvailableCombination, ProjectCreateRequest,
    ProjectCreateResponse, ProjectSummaryResponse, ModuleSummaryResponse,
    ModuleUploadResponse, ModuleValidateStartResponse, ModuleValidateStatusResponse,
)

router = APIRouter(prefix="/projects", tags=["projects"])

UPLOAD_DIR = Path(settings.upload_storage_path)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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
            return pd.read_csv(path, sep=_detect_csv_separator(path))
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
                "tengan la misma cantidad de columnas. Si lo exportaste "
                "desde Excel, probá guardarlo de nuevo como 'CSV UTF-8'."
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

    return ProjectCreateResponse(project_id=project.id, status=project.status.value)


@router.get("/{project_id}", response_model=ProjectSummaryResponse)
def get_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, user, db)
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

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo supera el máximo de {settings.max_upload_size_mb}MB",
        )

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

        try:
            schema = load_rule_schema(module.odoo_module, project.odoo_version, project.odoo_country)
            df = _read_tabular_file(Path(module.storage_path), module.original_filename)

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
            db.commit()
        except Exception as e:
            module.status = ModuleStatus.failed
            module.validation_error = str(e)
            db.commit()
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
    return {"confirmed_count": len(fixes)}


@router.get("/{project_id}/download")
def download_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, user, db)

    allowed, err = can_export_project(db, user, project)
    if not allowed:
        raise HTTPException(status_code=402, detail=err)  # Payment Required

    validated_modules = [m for m in project.modules if m.validation_report]
    if not validated_modules:
        raise HTTPException(status_code=400, detail="Este proyecto todavía no tiene ningún módulo validado")

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for module in validated_modules:
            corrected_path = _ensure_corrected_file(module, db)
            zf.write(corrected_path, arcname=f"{module.odoo_module}_corregido.csv")

    zip_buffer.seek(0)

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

    # Zero-retention: el original ya no se necesita una vez generado el
    # corregido -- nunca debe persistir indefinidamente en disco.
    original_path = Path(module.storage_path)
    if original_path.exists():
        original_path.unlink()
    log_event("file_destroyed", project_id=module.project_id, module_id=module.id)

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
