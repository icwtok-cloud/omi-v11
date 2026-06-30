"""
Orquestador del generador de reglas de OMI v2 — con soporte LATAM.

Para módulos sin variación por país:
    output/{version}/{modulo}.json

Para módulos con variación por país (contactos, contabilidad, facturacion):
    output/{version}/{modulo}/{pais}.json

Uso:
    python build_rules.py                           # todo
    python build_rules.py --version 17.0            # solo una versión
    python build_rules.py --module contactos        # solo un módulo
    python build_rules.py --module contactos --country ar  # módulo+país
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from module_map import MODULE_MAP, SUPPORTED_VERSIONS, LATAM_COUNTRIES, TAX_ID_RULES
from introspect_models import introspect_addon, models_to_dict
from extract_default_data import extract_default_records, records_to_dict


THIS_DIR = Path(__file__).parent
ODOO_REPOS_DIR = THIS_DIR.parent / "odoo_repos"
OUTPUT_DIR = THIS_DIR.parent / "output"

MODELS_WITH_DEFAULTS = {
    "crm.stage", "product.category", "account.account",
    "res.currency", "crm.lead", "account.tax", "account.journal",
}


def _find_addon(odoo_root: Path, addon_name: str) -> Path | None:
    """Busca un addon en las ubicaciones posibles dentro del repo de Odoo."""
    candidates = [
        odoo_root / "addons" / addon_name,
        odoo_root / "odoo" / "addons" / addon_name,
        odoo_root / "odoo" / addon_name,
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def build_module_version(version: str, module_key: str) -> dict:
    """Genera el schema para un módulo+versión SIN variación por país."""
    module_cfg = MODULE_MAP[module_key]
    odoo_root = ODOO_REPOS_DIR / version

    if not odoo_root.exists():
        raise FileNotFoundError(f"No existe {odoo_root}. Corré clone_odoo.sh primero.")

    all_models: dict = {}
    all_defaults: list[dict] = []

    for addon_dir_name in module_cfg["addon_dirs"]:
        addon_path = _find_addon(odoo_root, addon_dir_name)
        if not addon_path:
            print(f"  AVISO: addon '{addon_dir_name}' no encontrado en {odoo_root}")
            continue

        introspected = introspect_addon(addon_path)
        all_models.update(introspected)

        defaults = extract_default_records(addon_path, MODELS_WITH_DEFAULTS)
        all_defaults.extend(records_to_dict(defaults))

    primary = {
        name: info
        for name, info in models_to_dict(all_models).items()
        if name in module_cfg["primary_models"]
    }

    return {
        "omi_module": module_key,
        "omi_module_label": module_cfg["label"],
        "odoo_version": version,
        "country": None,
        "models": primary,
        "default_records": all_defaults,
    }


def build_module_version_country(version: str, module_key: str, country: str) -> dict:
    """Genera el schema para un módulo+versión+país."""
    module_cfg = MODULE_MAP[module_key]
    odoo_root = ODOO_REPOS_DIR / version

    if not odoo_root.exists():
        raise FileNotFoundError(f"No existe {odoo_root}. Corré clone_odoo.sh primero.")

    country_label, _ = LATAM_COUNTRIES[country]
    all_models: dict = {}
    all_defaults: list[dict] = []

    # 1. Primero cargamos el addon base (sin localización)
    for addon_dir_name in module_cfg["addon_dirs"]:
        addon_path = _find_addon(odoo_root, addon_dir_name)
        if not addon_path:
            print(f"  AVISO: addon base '{addon_dir_name}' no encontrado")
            continue
        introspected = introspect_addon(addon_path)
        all_models.update(introspected)
        defaults = extract_default_records(addon_path, MODELS_WITH_DEFAULTS)
        all_defaults.extend(records_to_dict(defaults))

    # 2. Encima, cargamos el addon de localización del país
    l10n_addons = module_cfg.get("l10n_addon_dirs", {}).get(country, [])
    l10n_found = False
    for l10n_addon_name in l10n_addons:
        l10n_path = _find_addon(odoo_root, l10n_addon_name)
        if not l10n_path:
            print(f"  AVISO: addon l10n '{l10n_addon_name}' no encontrado para v{version} — usando solo base")
            continue
        l10n_found = True
        introspected = introspect_addon(l10n_path)
        # Merge: los campos del l10n extienden/pisan los del base
        for model_name, model_info in introspected.items():
            if model_name in all_models:
                existing_names = {f["name"] if isinstance(f, dict) else f.name
                                  for f in all_models[model_name].fields}
                for f in model_info.fields:
                    if f.name not in existing_names:
                        all_models[model_name].fields.append(f)
            else:
                all_models[model_name] = model_info

        defaults = extract_default_records(l10n_path, MODELS_WITH_DEFAULTS)
        all_defaults.extend(records_to_dict(defaults))

    primary = {
        name: info
        for name, info in models_to_dict(all_models).items()
        if name in module_cfg["primary_models"]
    }

    # 3. Agregar reglas específicas del país (Tax ID para contactos, etc.)
    country_rules = {}
    if module_key == "contactos" and country in TAX_ID_RULES:
        country_rules["tax_id"] = TAX_ID_RULES[country]

    return {
        "omi_module": module_key,
        "omi_module_label": module_cfg["label"],
        "odoo_version": version,
        "country": country,
        "country_label": country_label,
        "l10n_found": l10n_found,
        "country_rules": country_rules,
        "models": primary,
        "default_records": all_defaults,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", choices=SUPPORTED_VERSIONS, default=None)
    parser.add_argument("--module", choices=list(MODULE_MAP.keys()), default=None)
    parser.add_argument("--country", choices=list(LATAM_COUNTRIES.keys()), default=None)
    args = parser.parse_args()

    versions = [args.version] if args.version else SUPPORTED_VERSIONS
    modules = [args.module] if args.module else list(MODULE_MAP.keys())

    for version in versions:
        for module_key in modules:
            module_cfg = MODULE_MAP[module_key]

            if module_cfg.get("country_scoped"):
                # Módulo con variación por país
                countries = [args.country] if args.country else list(LATAM_COUNTRIES.keys())
                for country in countries:
                    out_dir = OUTPUT_DIR / version / module_key
                    out_dir.mkdir(parents=True, exist_ok=True)
                    out_path = out_dir / f"{country}.json"

                    print(f"Generando: v{version} / {module_key} / {country}...")
                    try:
                        schema = build_module_version_country(version, module_key, country)
                    except FileNotFoundError as e:
                        print(f"  SALTEADO: {e}")
                        continue

                    out_path.write_text(
                        json.dumps(schema, indent=2, ensure_ascii=False),
                        encoding="utf-8",
                    )
                    n_models = len(schema["models"])
                    l10n_status = "con l10n" if schema["l10n_found"] else "solo base"
                    print(f"  OK -> {out_path} ({n_models} modelos, {l10n_status})")

            else:
                # Módulo sin variación por país
                if args.country:
                    print(f"  INFO: {module_key} no varía por país, generando versión plana...")

                out_dir = OUTPUT_DIR / version
                out_dir.mkdir(parents=True, exist_ok=True)
                out_path = out_dir / f"{module_key}.json"

                print(f"Generando: v{version} / {module_key}...")
                try:
                    schema = build_module_version(version, module_key)
                except FileNotFoundError as e:
                    print(f"  SALTEADO: {e}")
                    continue

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
