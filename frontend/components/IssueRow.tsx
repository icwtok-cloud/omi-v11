"use client";

import { ValidationIssue } from "@/lib/api";

const ISSUE_LABELS: Record<string, string> = {
  missing_required: "Campo obligatorio vacío",
  invalid_format: "Formato inválido",
  unknown_relation: "No existe en Odoo",
  duplicate: "Duplicado",
  negative_value: "Valor negativo",
};

export function IssueRow({
  issue,
  onToggleManualFix,
  manualFixApplied,
}: {
  issue: ValidationIssue;
  onToggleManualFix?: () => void;
  manualFixApplied?: boolean;
}) {
  const label = ISSUE_LABELS[issue.issue_type] || issue.issue_type;

  return (
    <div className="border border-line rounded-md px-4 py-3 bg-white flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-graphite">
            Fila {issue.row_index + 1}
          </span>
          <span className="font-mono text-xs uppercase tracking-wide text-alert bg-alert-light rounded px-2 py-0.5">
            {label}
          </span>
          <span className="font-mono text-xs text-graphite">· {issue.column}</span>
        </div>
        <p className="text-sm text-ink">{issue.message}</p>
        {issue.fix_explanation && (
          <p className="text-xs text-graphite italic mt-1">{issue.fix_explanation}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {issue.suggested_fix !== null && issue.suggested_fix !== undefined && (
          <div className="font-mono text-xs bg-verify-light text-verify rounded px-2 py-1.5 whitespace-nowrap">
            {String(issue.current_value)} → {String(issue.suggested_fix)}
          </div>
        )}

        {issue.fix_is_automatic ? (
          <span
            className="font-mono text-xs text-verify whitespace-nowrap"
            title="Se corrige en el archivo que descargás al exportar -- tu archivo original nunca se modifica."
          >
            se corrige al exportar
          </span>
        ) : issue.suggested_fix !== null && issue.suggested_fix !== undefined ? (
          <button
            onClick={onToggleManualFix}
            title="OMI sugiere este valor pero no lo aplica solo -- confirmalo si es correcto para este caso."
            className={`text-xs font-medium rounded-full px-3 py-1.5 whitespace-nowrap transition-colors ${
              manualFixApplied
                ? "bg-verify text-white"
                : "border border-line text-graphite hover:border-verify hover:text-verify"
            }`}
          >
            {manualFixApplied ? "Fix aplicado" : "Aplicar fix"}
          </button>
        ) : (
          <span
            className="font-mono text-xs text-graphite whitespace-nowrap"
            title="OMI no puede adivinar este valor sin arriesgar un dato de negocio real. Si lo dejás así, Odoo puede rechazar la fila o importarla con datos incompletos."
          >
            revisalo antes de exportar
          </span>
        )}
      </div>
    </div>
  );
}
