"""
Introspector de modelos Odoo vía AST de Python.

Por qué AST y no importar Odoo de verdad:
Importar el ORM de Odoo requiere su runtime completo (PostgreSQL, config,
addons path resuelto, etc.) solo para leer la forma de una clase. Es lento,
frágil entre versiones, y es trabajo de más para lo que necesitamos: la
DECLARACIÓN de los campos, no su comportamiento en runtime. Parseando el
árbol de sintaxis de los archivos .py directamente, sacamos exactamente
esa declaración sin levantar nada.

Qué extrae por cada modelo encontrado:
  - nombre del modelo (_name o _inherit)
  - por cada field.X(...) asignado como atributo de clase:
      - nombre del campo
      - tipo (Char, Many2one, Selection, etc.)
      - si es required=True
      - si es relación: a qué modelo apunta (comodel_name / primer arg)
      - selection: lista de opciones válidas, si están inline como lista
        literal (si vienen de un método, se marca selection_dynamic=True
        y se resuelve aparte, ver notes en el README)
"""

from __future__ import annotations

import ast
import json
from dataclasses import dataclass, field, asdict
from pathlib import Path


FIELD_TYPES = {
    "Char", "Text", "Html", "Integer", "Float", "Monetary", "Boolean",
    "Date", "Datetime", "Binary", "Selection", "Many2one", "One2many",
    "Many2many", "Reference",
}


@dataclass
class FieldInfo:
    name: str
    type: str
    required: bool = False
    comodel_name: str | None = None       # para Many2one/One2many/Many2many
    selection_options: list | None = None  # para Selection, si es lista literal
    selection_dynamic: bool = False        # True si Selection viene de un método
    default_present: bool = False
    help_text: str | None = None


@dataclass
class ModelInfo:
    name: str                  # _name, ej "res.partner"
    inherits: list = field(default_factory=list)  # _inherit, puede ser str o list
    source_file: str = ""
    fields: list[FieldInfo] = field(default_factory=list)


def _literal_or_none(node: ast.AST):
    """Intenta evaluar un nodo AST como literal de Python. Si no puede
    (porque es una llamada a función, variable, etc.) devuelve None."""
    try:
        return ast.literal_eval(node)
    except (ValueError, SyntaxError, TypeError):
        return None


def _extract_field_call(call: ast.Call) -> FieldInfo | None:
    """Dado un ast.Call que se sospecha es fields.X(...), extrae su info.
    Devuelve None si no matchea el patrón fields.<Tipo>(...)."""
    func = call.func
    if not (isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name)):
        return None
    if func.value.id != "fields":
        return None
    field_type = func.attr
    if field_type not in FIELD_TYPES:
        return None

    info = FieldInfo(name="", type=field_type)

    # Primer argumento posicional: para relaciones es el comodel_name,
    # para Selection puede ser la lista de opciones (forma posicional vieja)
    # o el string de label (forma nueva). Lo resolvemos por kwargs primero.
    for kw in call.keywords:
        if kw.arg == "required":
            val = _literal_or_none(kw.value)
            info.required = bool(val) if val is not None else False
        elif kw.arg == "comodel_name":
            val = _literal_or_none(kw.value)
            if isinstance(val, str):
                info.comodel_name = val
        elif kw.arg == "selection":
            val = _literal_or_none(kw.value)
            if isinstance(val, list):
                # lista de tuplas (key, label) -> nos quedamos con las keys
                info.selection_options = [
                    item[0] if isinstance(item, (list, tuple)) else item
                    for item in val
                ]
            else:
                info.selection_dynamic = True
        elif kw.arg == "default":
            info.default_present = True
        elif kw.arg == "help":
            val = _literal_or_none(kw.value)
            if isinstance(val, str):
                info.help_text = val

    # Relaciones declaradas posicionalmente: fields.Many2one("res.partner", ...)
    if field_type in {"Many2one", "One2many", "Many2many"} and call.args:
        val = _literal_or_none(call.args[0])
        if isinstance(val, str) and info.comodel_name is None:
            info.comodel_name = val
        # One2many real es fields.One2many("modelo.relacionado", "campo_inverso", ...)

    # Selection declarado posicionalmente: fields.Selection([...], ...)
    if field_type == "Selection" and call.args:
        val = _literal_or_none(call.args[0])
        if isinstance(val, list):
            info.selection_options = [
                item[0] if isinstance(item, (list, tuple)) else item
                for item in val
            ]
        elif val is None:
            info.selection_dynamic = True

    return info


def parse_model_file(path: Path) -> list[ModelInfo]:
    """Parsea un archivo models/*.py y devuelve todos los ModelInfo
    encontrados (un archivo puede definir más de un modelo)."""
    try:
        source = path.read_text(encoding="utf-8", errors="replace")
        tree = ast.parse(source, filename=str(path))
    except (SyntaxError, UnicodeDecodeError):
        return []

    models: list[ModelInfo] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue

        model_name = None
        inherits: list = []
        fields_found: list[FieldInfo] = []

        for stmt in node.body:
            if not isinstance(stmt, ast.Assign):
                continue
            if len(stmt.targets) != 1 or not isinstance(stmt.targets[0], ast.Name):
                continue
            target_name = stmt.targets[0].id

            if target_name == "_name":
                val = _literal_or_none(stmt.value)
                if isinstance(val, str):
                    model_name = val
            elif target_name == "_inherit":
                val = _literal_or_none(stmt.value)
                if isinstance(val, str):
                    inherits = [val]
                elif isinstance(val, list):
                    inherits = val
            elif isinstance(stmt.value, ast.Call):
                finfo = _extract_field_call(stmt.value)
                if finfo is not None:
                    finfo.name = target_name
                    fields_found.append(finfo)

        # Un modelo es relevante si declara _name (modelo nuevo) o
        # _inherit + al menos un campo nuevo (extensión de un modelo existente).
        if model_name or (inherits and fields_found):
            models.append(ModelInfo(
                name=model_name or (inherits[0] if inherits else "unknown"),
                inherits=inherits,
                source_file=str(path),
                fields=fields_found,
            ))

    return models


def introspect_addon(addon_path: Path) -> dict[str, ModelInfo]:
    """Recorre <addon_path>/models/*.py y devuelve un dict
    {nombre_modelo: ModelInfo} combinando todos los campos encontrados
    para ese modelo (porque Odoo parte un modelo en varios archivos
    a veces, y _inherit puede reabrir el mismo modelo más de una vez)."""
    models_dir = addon_path / "models"
    if not models_dir.exists():
        return {}

    combined: dict[str, ModelInfo] = {}

    for py_file in sorted(models_dir.glob("*.py")):
        for model in parse_model_file(py_file):
            key = model.name
            if key not in combined:
                combined[key] = model
            else:
                # merge: sumamos campos nuevos, evitando duplicados por nombre
                existing_field_names = {f.name for f in combined[key].fields}
                for f in model.fields:
                    if f.name not in existing_field_names:
                        combined[key].fields.append(f)

    return combined


def models_to_dict(models: dict[str, ModelInfo]) -> dict:
    return {name: asdict(info) for name, info in models.items()}


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Uso: python introspect_models.py <ruta_a_carpeta_addon>")
        sys.exit(1)

    addon = Path(sys.argv[1])
    result = introspect_addon(addon)
    print(json.dumps(models_to_dict(result), indent=2, ensure_ascii=False))
