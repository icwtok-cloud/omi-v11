"""
Extrae los registros de datos por defecto que Odoo carga de fábrica
(categorías de producto, etapas de CRM, plan de cuentas, monedas, etc.)

Estos NO viven en los archivos .py de modelos -- viven en archivos XML
dentro de cada addon, normalmente en data/*.xml, con la forma:

    <record id="..." model="crm.stage">
        <field name="name">New</field>
        <field name="sequence">1</field>
    </record>

Esto es lo que permite que OMI valide "etapa desconocida" o "categoría
faltante" contra los valores reales que esa versión de Odoo trae de
fábrica para ese módulo -- sin esto, esas reglas no tendrían contra qué
comparar.

Nota importante (ya marcada para vos, Tomás, ya que mencionaste que el
usuario puede dar su propia config real): esto genera el DEFAULT. El
override de cliente se resuelve en el backend, no acá -- este script solo
genera la base "de fábrica" por versión.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from pathlib import Path
from xml.etree import ElementTree as ET


@dataclass
class DefaultRecord:
    record_id: str           # el atributo id del <record>, ej "stage_lead1"
    model: str                # el atributo model, ej "crm.stage"
    values: dict = field(default_factory=dict)  # nombre_campo -> valor texto


def _parse_record(record_el: ET.Element) -> DefaultRecord | None:
    model = record_el.get("model")
    record_id = record_el.get("id")
    if not model or not record_id:
        return None

    values = {}
    for field_el in record_el.findall("field"):
        fname = field_el.get("name")
        if not fname:
            continue
        # Puede ser texto plano, o tener sub-elementos (raro en estos casos
        # simples). Para los modelos que nos interesan (stage, category,
        # account, currency) el valor relevante casi siempre es texto.
        values[fname] = (field_el.text or "").strip()

    return DefaultRecord(record_id=record_id, model=model, values=values)


def extract_default_records(addon_path: Path, target_models: set[str]) -> list[DefaultRecord]:
    """Recorre los XML de datos de un addon (data/, demo/ se excluye a
    propósito porque son datos de DEMOSTRACIÓN, no defaults reales de
    producción) y devuelve los <record> que correspondan a alguno de los
    target_models."""
    results: list[DefaultRecord] = []

    data_dir = addon_path / "data"
    if not data_dir.exists():
        return results

    for xml_file in sorted(data_dir.glob("*.xml")):
        try:
            tree = ET.parse(xml_file)
        except ET.ParseError:
            continue

        for record_el in tree.iter("record"):
            parsed = _parse_record(record_el)
            if parsed and parsed.model in target_models:
                results.append(parsed)

    return results


def records_to_dict(records: list[DefaultRecord]) -> list[dict]:
    return [asdict(r) for r in records]


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Uso: python extract_default_data.py <ruta_addon> <modelo1,modelo2,...>")
        sys.exit(1)

    addon = Path(sys.argv[1])
    models = set(sys.argv[2].split(","))
    found = extract_default_records(addon, models)
    print(json.dumps(records_to_dict(found), indent=2, ensure_ascii=False))
