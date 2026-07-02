"use client";

import { ValidationIssue } from "@/lib/api";

type Locale = "es" | "pt";

const ISSUE_LABELS: Record<Locale, Record<string, string>> = {
  es: {
    missing_required: "Campo obligatorio vacío",
    invalid_format: "Formato inválido",
    unknown_relation: "No existe en Odoo",
    duplicate: "Duplicado",
    negative_value: "Valor negativo",
  },
  pt: {
    missing_required: "Campo obrigatório vazio",
    invalid_format: "Formato inválido",
    unknown_relation: "Não existe no Odoo",
    duplicate: "Duplicado",
    negative_value: "Valor negativo",
  },
};

const UI_COPY: Record<Locale, {
  row: string;
  autoFixTitle: string;
  autoFixLabel: string;
  suggestedTitle: string;
  fixApplied: string;
  applyFix: string;
  reviewTitle: string;
  reviewLabel: string;
}> = {
  es: {
    row: "Fila",
    autoFixTitle: "Se corrige en el archivo que descargás al exportar -- tu archivo original nunca se modifica.",
    autoFixLabel: "se corrige al exportar",
    suggestedTitle: "OMI sugiere este valor pero no lo aplica solo -- confirmalo si es correcto para este caso.",
    fixApplied: "Fix aplicado",
    applyFix: "Aplicar fix",
    reviewTitle: "OMI no puede adivinar este valor sin arriesgar un dato de negocio real. Si lo dejás así, Odoo puede rechazar la fila o importarla con datos incompletos.",
    reviewLabel: "revisalo antes de exportar",
  },
  pt: {
    row: "Linha",
    autoFixTitle: "É corrigido no arquivo que você baixa ao exportar -- seu arquivo original nunca é modificado.",
    autoFixLabel: "corrige-se ao exportar",
    suggestedTitle: "A OMI sugere este valor mas não aplica sozinha -- confirme se está correto para este caso.",
    fixApplied: "Correção aplicada",
    applyFix: "Aplicar correção",
    reviewTitle: "A OMI não pode adivinhar este valor sem arriscar um dado de negócio real. Se deixar assim, o Odoo pode rejeitar a linha ou importá-la com dados incompletos.",
    reviewLabel: "revise antes de exportar",
  },
};

export function IssueRow({
  issue,
  onToggleManualFix,
  manualFixApplied,
  locale = "es",
}: {
  issue: ValidationIssue;
  onToggleManualFix?: () => void;
  manualFixApplied?: boolean;
  locale?: Locale;
}) {
  const label = ISSUE_LABELS[locale][issue.issue_type] || issue.issue_type;
  const t = UI_COPY[locale];

  return (
    <div className="border border-line rounded-md px-4 py-3 bg-white flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-graphite">
            {t.row} {issue.row_index + 1}
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
            title={t.autoFixTitle}
          >
            {t.autoFixLabel}
          </span>
        ) : issue.suggested_fix !== null && issue.suggested_fix !== undefined ? (
          <button
            onClick={onToggleManualFix}
            title={t.suggestedTitle}
            className={`text-xs font-medium rounded-full px-3 py-1.5 whitespace-nowrap transition-colors ${
              manualFixApplied
                ? "bg-verify text-white"
                : "border border-line text-graphite hover:border-verify hover:text-verify"
            }`}
          >
            {manualFixApplied ? t.fixApplied : t.applyFix}
          </button>
        ) : (
          <span
            className="font-mono text-xs text-graphite whitespace-nowrap"
            title={t.reviewTitle}
          >
            {t.reviewLabel}
          </span>
        )}
      </div>
    </div>
  );
}
