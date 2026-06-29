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


# Módulos cuyas reglas varían por país (tienen subruta {module}/{country}.json)
COUNTRY_SCOPED_MODULES = {"contactos", "contabilidad", "facturacion"}

@lru_cache(maxsize=256)
def load_rule_schema(module: str, version: str, country: str | None = None) -> RuleSchema:
    """Carga (y cachea) el schema de un módulo+versión+país.

    Para módulos en COUNTRY_SCOPED_MODULES, `country` es obligatorio y la
    ruta esperada es: {version}/{module}/{country}.json
    Para el resto, la ruta sigue siendo: {version}/{module}.json
    Lanza FileNotFoundError si no existe -- el caller decide cómo responder.
    """
    base = Path(settings.rules_base_path)

    if module in COUNTRY_SCOPED_MODULES:
        if not country:
            raise ValueError(
                f"El módulo '{module}' requiere un país (ej. 'ar', 'mx')."
            )
        path = base / version / module / f"{country}.json"
    else:
        path = base / version / f"{module}.json"

    if not path.exists():
        raise FileNotFoundError(
            f"No hay reglas generadas para módulo='{module}' versión='{version}'"
            + (f" país='{country}'" if country else "")
            + f" (esperado en {path})"
        )
    raw = json.loads(path.read_text(encoding="utf-8"))
    return RuleSchema(raw)


def list_available_combinations() -> list[dict]:
    """Recorre rules/ y devuelve qué combinaciones módulo+versión(+país) existen.

    - Para módulos sin variación por país: devuelve {version, module, country: null}
    - Para módulos con variación por país: devuelve una entrada por país disponible,
      con {version, module, country: "ar"} etc.
    Esto alimenta el selector del frontend.
    """
    base = Path(settings.rules_base_path)
    if not base.exists():
        return []

    combos = []
    for version_dir in sorted(base.iterdir()):
        if not version_dir.is_dir():
            continue
        version = version_dir.name

        for item in sorted(version_dir.iterdir()):
            if item.is_file() and item.suffix == ".json":
                # Módulo plano (sin variación por país)
                combos.append({
                    "version": version,
                    "module": item.stem,
                    "country": None,
                })
            elif item.is_dir() and item.name in COUNTRY_SCOPED_MODULES:
                # Módulo con variación por país — una entrada por país
                for country_file in sorted(item.glob("*.json")):
                    combos.append({
                        "version": version,
                        "module": item.name,
                        "country": country_file.stem,
                    })
    return combos
