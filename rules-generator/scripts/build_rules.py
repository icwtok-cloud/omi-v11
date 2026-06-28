"""
Orquestador del generador de reglas de OMI.

Corre la introspección de modelos + extracción de defaults para cada
combinación de (versión de Odoo) x (módulo OMI), y escribe el resultado
como JSON en rules-generator/output/<version>/<modulo>.json

Estos JSON son el artefacto final de este subsistema. El backend de OMI
los consume tal cual (ver backend/rules/) -- el backend NUNCA vuelve a
tocar código fuente de Odoo ni hace introspección en runtime.

Uso:
    python build_rules.py                  # todas las versiones y módulos
    python build_rules.py --version 18.0   # solo una versión
    python build_rules.py --module crm     # solo un módulo
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from module_map import MODULE_MAP, SUPPORTED_VERSIONS
from introspect_models import introspect_addon, models_to_dict
from extract_default_data import extract_default_records, records_to_dict


THIS_DIR = Path(__file__).parent
ODOO_REPOS_DIR = THIS_DIR.parent / "odoo_repos"
OUTPUT_DIR = THIS_DIR.parent / "output"

# Modelos para los que vale la pena buscar registros default de fábrica.
# (no todos los modelos tienen datos "default" relevantes para validación)
MODELS_WITH_DEFAULTS = {
    "crm.stage", "product.category", "account.account",
    "res.currency", "crm.lead",
}


def build_module_version(version: str, module_key: str) -> dict:
    module_cfg = MODULE_MAP[module_key]
    odoo_root = ODOO_REPOS_DIR / version

    if not odoo_root.exists():
        raise FileNotFoundError(
            f"No existe {odoo_root}. Corré clone_odoo.sh primero."
        )

    addons_root = odoo_root / "addons"
    all_models: dict = {}
    all_defaults: list[dict] = []

    for addon_dir_name in module_cfg["addon_dirs"]:
        addon_path = addons_root / addon_dir_name
        if not addon_path.exists():
            # algunos módulos (ej "base") viven en odoo/odoo/addons en vez
            # de odoo/addons según la versión -- probamos el path alternativo
            alt_path = odoo_root / "odoo" / "addons" / addon_dir_name
            addon_path = alt_path if alt_path.exists() else addon_path

        introspected = introspect_addon(addon_path)
        all_models.update(introspected)

        defaults = extract_default_records(addon_path, MODELS_WITH_DEFAULTS)
        all_defaults.extend(records_to_dict(defaults))

    # Filtramos al schema final solo los modelos "primarios" de este módulo
    # OMI -- los demás modelos introspeccionados eran necesarios como
    # contexto (relaciones) pero no se exponen como schema validable directo.
    primary = {
        name: info
        for name, info in models_to_dict(all_models).items()
        if name in module_cfg["primary_models"]
    }

    return {
        "omi_module": module_key,
        "omi_module_label": module_cfg["label"],
        "odoo_version": version,
        "models": primary,
        "default_records": all_defaults,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", choices=SUPPORTED_VERSIONS, default=None)
    parser.add_argument("--module", choices=list(MODULE_MAP.keys()), default=None)
    args = parser.parse_args()

    versions = [args.version] if args.version else SUPPORTED_VERSIONS
    modules = [args.module] if args.module else list(MODULE_MAP.keys())

    for version in versions:
        out_dir = OUTPUT_DIR / version
        out_dir.mkdir(parents=True, exist_ok=True)

        for module_key in modules:
            print(f"Generando: versión={version} módulo={module_key}...")
            try:
                schema = build_module_version(version, module_key)
            except FileNotFoundError as e:
                print(f"  SALTEADO: {e}")
                continue

            out_path = out_dir / f"{module_key}.json"
            out_path.write_text(
                json.dumps(schema, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            n_models = len(schema["models"])
            n_defaults = len(schema["default_records"])
            print(f"  OK -> {out_path} ({n_models} modelos, {n_defaults} defaults)")

    print("\nListo. Copiá la carpeta output/ a backend/rules/ para que el backend la sirva.")


if __name__ == "__main__":
    main()
