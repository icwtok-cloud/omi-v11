"""
Reporte técnico en PDF, separado del ZIP de archivos corregidos.

Por qué existe esto: el ZIP es el artefacto de TRABAJO (los CSV
corregidos que se importan en Odoo). Un consultor necesita además algo
que MOSTRAR -- evidencia de qué se detectó y corrigió, para mandarle al
cliente como respaldo de la migración, sin exponerle el archivo interno
de trabajo. Deliberadamente no es "bonito" (sin logos, colores de
marketing) -- es un informe técnico: números, tablas, texto plano.
"""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)

ISSUE_TYPE_LABELS = {
    "missing_required": "Campo obligatorio vacío",
    "invalid_format": "Formato inválido",
    "unknown_relation": "No existe en Odoo",
    "duplicate": "Duplicado",
    "negative_value": "Valor negativo",
    "missing_contact_info": "Sin datos de contacto",
}


def build_module_report_pdf(
    *,
    odoo_module: str,
    odoo_version: str,
    odoo_country: str | None,
    report: dict,
) -> bytes:
    """Arma el PDF a partir del mismo dict que ya devuelve /report (JSON)
    -- sin volver a correr ninguna validación, es una vista distinta de
    los mismos datos."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2 * cm,
        leftMargin=2 * cm, rightMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    small_gray = ParagraphStyle(
        "SmallGray", parent=styles["Normal"], fontSize=9, textColor=colors.grey,
    )

    story = []

    story.append(Paragraph("OMI — Informe técnico de preparación de datos", styles["Title"]))
    story.append(Spacer(1, 4))
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    country_txt = f" · País: {odoo_country.upper()}" if odoo_country else ""
    story.append(Paragraph(
        f"Módulo: {odoo_module} · Odoo {odoo_version}{country_txt}", styles["Normal"],
    ))
    story.append(Paragraph(f"Generado: {generated_at}", small_gray))
    story.append(Spacer(1, 16))

    if report.get("structural_mismatch"):
        story.append(Paragraph(
            "Este archivo no corresponde al módulo/versión elegidos -- muy pocas "
            "columnas coinciden con los campos esperados. No se generó un análisis "
            "fila por fila.", styles["Normal"],
        ))
        doc.build(story)
        return buffer.getvalue()

    summary_data = [
        ["Filas totales", str(report.get("total_rows", 0))],
        ["Problemas encontrados", str(report.get("total_issues", 0))],
        ["Índice de calidad", f"{report.get('quality_score', 100)}/100"],
        ["Columnas reconocidas", str(report.get("matched_columns_count", 0))],
        ["External ID presente", "Sí" if report.get("has_external_id") else "No"],
    ]
    summary_table = Table(summary_data, colWidths=[7 * cm, 7 * cm])
    summary_table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 16))

    breakdown = report.get("quality_score_breakdown") or []
    if breakdown:
        story.append(Paragraph("Desglose del índice de calidad", styles["Heading2"]))
        rows = [["Categoría", "Filas afectadas", "Puntos"]]
        for b in breakdown:
            label = ISSUE_TYPE_LABELS.get(b["issue_type"], b["issue_type"])
            rows.append([label, str(b["rows_affected"]), f"-{b['points_deducted']}"])
        t = Table(rows, colWidths=[7 * cm, 4 * cm, 3 * cm])
        t.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(t)
        story.append(Spacer(1, 16))

    enrichment_opportunities = report.get("enrichment_opportunities") or []
    if enrichment_opportunities:
        story.append(Paragraph("Campos técnicos que OMI puede generar", styles["Heading2"]))
        rows = [["Campo", "Filas afectadas", "Cómo se genera"]]
        for o in enrichment_opportunities:
            rows.append([o["label"], str(o["rows_affected"]), o["algorithm"]])
        t = Table(rows, colWidths=[4 * cm, 3 * cm, 7 * cm])
        t.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(t)
        story.append(Paragraph(
            "Ninguno de estos campos se genera sin tu confirmación explícita "
            "-- son identificadores técnicos, nunca datos de negocio.",
            styles["Italic"],
        ))
        story.append(Spacer(1, 16))

    columns_expected_missing = report.get("columns_expected_missing") or []
    if columns_expected_missing:
        story.append(Paragraph("Columnas obligatorias faltantes", styles["Heading2"]))
        story.append(Paragraph(", ".join(columns_expected_missing), styles["Normal"]))
        story.append(Spacer(1, 16))

    column_mapping = report.get("column_mapping") or {}
    if column_mapping:
        story.append(Paragraph("Mapeo de columnas detectado", styles["Heading2"]))
        confidence = report.get("column_match_confidence") or {}
        rows = [["Columna del archivo", "Campo Odoo", "Confianza"]]
        for col, field_name in column_mapping.items():
            rows.append([col, field_name, confidence.get(col, "-")])
        t = Table(rows, colWidths=[6 * cm, 5 * cm, 3 * cm])
        t.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t)
        story.append(Spacer(1, 16))

    unmatched = report.get("unmatched_columns") or []
    if unmatched:
        story.append(Paragraph("Columnas ignoradas (sin campo Odoo conocido)", styles["Heading2"]))
        story.append(Paragraph(", ".join(unmatched), styles["Normal"]))
        story.append(Spacer(1, 16))

    issues = report.get("issues") or []
    if issues:
        story.append(Paragraph(f"Detalle de problemas ({len(issues)})", styles["Heading2"]))
        rows = [["Fila", "Columna", "Tipo", "Mensaje", "Fix"]]
        # Tope de 200 filas en el PDF -- un archivo de 150k filas con
        # miles de issues generaría un PDF de cientos de páginas,
        # inmanejable como "evidencia para el cliente". El ZIP/reporte
        # JSON completo sigue teniendo todo el detalle.
        for issue in issues[:200]:
            rows.append([
                str(issue["row_index"]),
                issue["column"],
                ISSUE_TYPE_LABELS.get(issue["issue_type"], issue["issue_type"]),
                Paragraph(issue["message"], styles["Normal"]),
                "Automático" if issue.get("fix_is_automatic") else "Manual",
            ])
        t = Table(rows, colWidths=[1.5 * cm, 3 * cm, 3 * cm, 6.5 * cm, 2.5 * cm], repeatRows=1)
        t.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(t)
        if len(issues) > 200:
            story.append(Spacer(1, 8))
            story.append(Paragraph(
                f"Mostrando 200 de {len(issues)} problemas. El detalle completo está "
                "disponible en el reporte dentro de OMI.", small_gray,
            ))

    doc.build(story)
    return buffer.getvalue()
