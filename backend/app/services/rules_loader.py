"""
Carga los schemas de reglas (generados offline por rules-generator/) desde
disco, y los cachea en memoria del proceso -- son archivos chicos (48 en
total) y no cambian salvo que se despliegue una nueva versión del backend,
así que no hace sentido leerlos del disco en cada validación.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from app.core.config import settings


class RuleSchema:
    """Wrapper sobre el JSON crudo de un módulo+versión, con accesos
    convenientes para el validador."""

    def __init__(self, raw: dict):
        self.raw = raw
        self.module = raw["omi_module"]
        self.version = raw["odoo_version"]
        self.models: dict = raw["models"]
        self.default_records: list = raw["default_records"]

    def primary_model(self) -> dict:
        """Devuelve el primer modelo del schema -- por convención, el
        modelo principal contra el que se valida el archivo subido.
        (Para módulos con varios modelos relevantes, ver get_model()).
        """
        return next(iter(self.models.values()))

    def get_model(self, model_name: str) -> dict | None:
        return self.models.get(model_name)

    def required_fields(self, model_name: str | None = None) -> list[str]:
        model = self.get_model(model_name) if model_name else self.primary_model()
        if not model:
            return []
        return [f["name"] for f in model["fields"] if f.get("required")]

    def field_info(self, field_name: str, model_name: str | None = None) -> dict | None:
        model = self.get_model(model_name) if model_name else self.primary_model()
        if not model:
            return None
        for f in model["fields"]:
            if f["name"] == field_name:
                return f
        return None

    def default_values_for(self, model_name: str) -> list[dict]:
        return [r for r in self.default_records if r["model"] == model_name]


@lru_cache(maxsize=128)
def load_rule_schema(module: str, version: str) -> RuleSchema:
    """Carga (y cachea) el schema de un módulo+versión específico.
    Lanza FileNotFoundError si no existe -- el caller decide cómo
    responder al usuario en ese caso (módulo/versión todavía no soportada).
    """
    path = Path(settings.rules_base_path) / version / f"{module}.json"
    if not path.exists():
        raise FileNotFoundError(
            f"No hay reglas generadas para módulo='{module}' versión='{version}' "
            f"(esperado en {path})"
        )
    raw = json.loads(path.read_text(encoding="utf-8"))
    return RuleSchema(raw)


def list_available_combinations() -> list[dict]:
    """Recorre rules/ y devuelve qué combinaciones módulo+versión existen
    realmente -- esto alimenta el selector del frontend, para no ofrecer
    una combinación que todavía no se generó."""
    base = Path(settings.rules_base_path)
    if not base.exists():
        return []

    combos = []
    for version_dir in sorted(base.iterdir()):
        if not version_dir.is_dir():
            continue
        for schema_file in sorted(version_dir.glob("*.json")):
            combos.append({
                "version": version_dir.name,
                "module": schema_file.stem,
            })
    return combos
