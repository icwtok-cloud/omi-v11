"""
Endpoints del flujo principal de OMI:

  POST /projects                  -> sube archivo, crea proyecto
  POST /projects/{id}/validate    -> corre el motor de validación (gratis)
  GET  /projects/{id}/report      -> devuelve el reporte (gratis)
  POST /projects/{id}/apply-fixes -> aplica fixes elegidos por el usuario,
                                      genera el archivo corregido en storage
                                      (no lo entrega -- eso requiere pago)
  GET  /projects/{id}/download    -> entrega el archivo, SOLO si paid/subscription
"""

from __future__ import annotations

import uuid
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.db_models import Project, ProjectStatus, User
from app.services.rules_loader import load_rule_schema, list_available_combinations
from app.services.validation_engine import validate_dataframe
from app.services.entitlements import user_can_download
from app.api.schemas import ValidationReportResponse, AvailableCombination

router = APIRouter(prefix="/projects", tags=["projects"])

UPLOAD_DIR = Path(settings.upload_storage_path)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.get("/available-combinations", response_model=list[AvailableCombination])
def get_available_combinations():
    """Alimenta el selector del frontend: qué módulo+versión están
    realmente soportados (tienen reglas generadas), para no dejar
    elegir una combinación inexistente."""
    return list_available_combinations()


def _read_tabular_file(path: Path, original_filename: str) -> pd.DataFrame:
    suffix = Path(original_filename).suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)
    elif suffix in (".xlsx", ".xls"):
        return pd.read_excel(path)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Formato '{suffix}' no soportado. Usá CSV o Excel (.xlsx).",
        )


@router.post("")
async def create_project(
    odoo_module: str = Form(...),
    odoo_version: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo supera el máximo de {settings.max_upload_size_mb}MB",
        )

    # Validamos que la combinación módulo+versión exista ANTES de guardar
    # nada -- evita proyectos huérfanos sin reglas contra qué validar.
    try:
        load_rule_schema(odoo_module, odoo_version)
    except FileNotFoundError:
        raise HTTPException(
            status_code=400,
            detail=f"Módulo '{odoo_module}' versión '{odoo_version}' todavía no soportado",
        )

    project_id = str(uuid.uuid4())
    storage_path = UPLOAD_DIR / f"{project_id}_{file.filename}"
    storage_path.write_bytes(contents)

    project = Project(
        id=project_id,
        owner_id=user.id,
        odoo_module=odoo_module,
        odoo_version=odoo_version,
        original_filename=file.filename,
        storage_path=str(storage_path),
        status=ProjectStatus.uploaded,
    )
    db.add(project)
    db.commit()

    return {"project_id": project_id, "status": project.status.value}


@router.post("/{project_id}/validate", response_model=ValidationReportResponse)
def validate_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, user, db)

    schema = load_rule_schema(project.odoo_module, project.odoo_version)
    df = _read_tabular_file(Path(project.storage_path), project.original_filename)

    report = validate_dataframe(df, schema, client_override=project.client_config_override)

    project.validation_report = report.to_dict()
    project.status = ProjectStatus.validated
    db.commit()

    return ValidationReportResponse(
        project_id=project.id,
        can_download=user_can_download(db, project),
        **report.to_dict(),
    )


@router.get("/{project_id}/report", response_model=ValidationReportResponse)
def get_report(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, user, db)
    if not project.validation_report:
        raise HTTPException(status_code=404, detail="Este proyecto todavía no fue validado")

    return ValidationReportResponse(
        project_id=project.id,
        can_download=user_can_download(db, project),
        **project.validation_report,
    )


@router.get("/{project_id}/download")
def download_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project(project_id, user, db)

    if not user_can_download(db, project):
        raise HTTPException(
            status_code=402,  # Payment Required
            detail="Necesitás pagar este proyecto o tener una suscripción activa para descargarlo",
        )

    corrected_path = _ensure_corrected_file(project, db)
    project.status = ProjectStatus.downloaded
    db.commit()

    return FileResponse(
        path=corrected_path,
        filename=f"corregido_{project.original_filename}",
        media_type="application/octet-stream",
    )


def _ensure_corrected_file(project: Project, db: Session) -> Path:
    """Genera (si no existe ya) el archivo con los fixes automáticos
    aplicados. Los fixes manuales que el usuario haya elegido en el
    frontend se aplican en el endpoint apply-fixes, antes de llegar acá."""
    corrected_path = Path(project.storage_path).with_suffix(".corrected.csv")
    if corrected_path.exists():
        return corrected_path

    df = _read_tabular_file(Path(project.storage_path), project.original_filename)
    report = project.validation_report or {}

    for issue in report.get("issues", []):
        if issue.get("fix_is_automatic") and issue.get("suggested_fix") is not None:
            row_idx = issue["row_index"]
            col = issue["column"]
            if col in df.columns and row_idx in df.index:
                df.at[row_idx, col] = issue["suggested_fix"]

    df.to_csv(corrected_path, index=False)
    return corrected_path


def _get_owned_project(project_id: str, user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Este proyecto no te pertenece")
    return project
