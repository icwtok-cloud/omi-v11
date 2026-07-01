"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { runValidation, applyFixes, ValidationReport, ManualFix } from "@/lib/api";
import { IssueRow } from "@/components/IssueRow";
import { PaywallPanel } from "@/components/PaywallPanel";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualFixesApplied, setManualFixesApplied] = useState<Set<number>>(new Set());

  // Estado del guardado de fixes contra el backend
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // Snapshot de los índices que estaban marcados la última vez que se confirmó.
  // Si manualFixesApplied cambia después de confirmar, hay que confirmar de nuevo.
  const [confirmedSnapshot, setConfirmedSnapshot] = useState<Set<number> | null>(null);

  useEffect(() => {
    if (!params.id) return;
    runValidation(getToken, params.id)
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al validar"))
      .finally(() => setLoading(false));
  }, [params.id, getToken]);

  function toggleManualFix(index: number) {
    setManualFixesApplied((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function setsAreEqual(a: Set<number>, b: Set<number>) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  async function handleConfirmFixes() {
    if (!report) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const fixes: ManualFix[] = report.issues
        .map((issue, idx) => ({ issue, idx }))
        .filter(({ idx }) => manualFixesApplied.has(idx))
        .map(({ issue }) => ({ row_index: issue.row_index, column: issue.column }));

      await applyFixes(getToken, report.project_id, fixes);
      setConfirmedSnapshot(new Set(manualFixesApplied));
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "No se pudieron guardar las correcciones");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-sm text-graphite">Analizando tu archivo...</p>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-alert bg-alert-light rounded-md px-5 py-3 text-sm">
          {error || "No se pudo cargar el reporte"}
        </p>
      </main>
    );
  }

  const okRows = report.total_rows - new Set(report.issues.map((i) => i.row_index)).size;
  const autoFixable = report.issues.filter((i) => i.fix_is_automatic).length;

  // Agrupa issues por tipo+columna para no mostrar N filas individuales
  // cuando hay miles de errores del mismo tipo (ej. 20.000 teléfonos mal formateados).
  type IssueGroup = {
    key: string;
    issue_type: string;
    column: string;
    fix_is_automatic: boolean;
    has_suggested_fix: boolean;
    fix_explanation: string | null;
    indices: number[];
  };
  const issueGroups: IssueGroup[] = [];
  const groupMap = new Map<string, IssueGroup>();
  report.issues.forEach((issue, idx) => {
    const key = `${issue.issue_type}::${issue.column}`;
    if (!groupMap.has(key)) {
      const g: IssueGroup = {
        key,
        issue_type: issue.issue_type,
        column: issue.column,
        fix_is_automatic: issue.fix_is_automatic,
        has_suggested_fix: issue.suggested_fix !== null && issue.suggested_fix !== undefined,
        // Es igual para todo el grupo (mismo issue_type+columna), alcanza
        // con tomarlo del primer issue.
        fix_explanation: issue.fix_explanation,
        indices: [],
      };
      groupMap.set(key, g);
      issueGroups.push(g);
    }
    groupMap.get(key)!.indices.push(idx);
  });

  const hasManualFixesSelected = manualFixesApplied.size > 0;
  const fixesAreConfirmed =
    confirmedSnapshot !== null && setsAreEqual(confirmedSnapshot, manualFixesApplied);

  // Si no hay fixes manuales seleccionados, no hace falta confirmar nada:
  // se puede pasar directo al pago.
  const readyForPayment = !hasManualFixesSelected || fixesAreConfirmed;

  return (
    <main className="min-h-screen px-6 md:px-12 py-10 max-w-4xl mx-auto">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-verify mb-2">
          Reporte de validación
        </p>
        <h1 className="font-extrabold text-3xl mb-4 tracking-tight">
          {report.total_issues === 0
            ? "Tu archivo está listo para Odoo"
            : `${report.total_issues} ${
                report.total_issues === 1 ? "problema encontrado" : "problemas encontrados"
              }`}
        </h1>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Filas totales" value={report.total_rows} />
          <Stat label="Filas sin errores" value={Math.max(okRows, 0)} tone="verify" />
          <Stat label="Se corrigen solas" value={autoFixable} tone="brand" />
        </div>
      </header>

      {report.columns_expected_missing.length > 0 && (
        <div className="mb-8 border border-alert bg-alert-light rounded-md px-5 py-4">
          <p className="font-medium text-alert mb-1">
            Faltan columnas obligatorias en tu archivo
          </p>
          <p className="font-mono text-sm text-alert">
            {report.columns_expected_missing.join(", ")}
          </p>
        </div>
      )}

      <IssueGroupList
        groups={issueGroups}
        allIssues={report.issues}
        manualFixesApplied={manualFixesApplied}
        onToggle={(idx) => {
          toggleManualFix(idx);
          setConfirmedSnapshot(null);
        }}
        onToggleGroup={(indices) => {
          setManualFixesApplied((prev) => {
            const next = new Set(prev);
            const allOn = indices.every((i) => prev.has(i));
            indices.forEach((i) => (allOn ? next.delete(i) : next.add(i)));
            return next;
          });
          setConfirmedSnapshot(null);
        }}
      />

      {hasManualFixesSelected && (
        <div className="mb-12 border border-line rounded-md px-5 py-4 bg-white">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-medium text-ink mb-1">
                {fixesAreConfirmed
                  ? "Correcciones confirmadas"
                  : `${manualFixesApplied.size} ${
                      manualFixesApplied.size === 1
                        ? "corrección lista para confirmar"
                        : "correcciones listas para confirmar"
                    }`}
              </p>
              <p className="text-sm text-graphite">
                {fixesAreConfirmed
                  ? "Ya podés continuar con el pago y la descarga."
                  : "Confirmá para guardar estos cambios antes de pagar y descargar."}
              </p>
            </div>
            <button
              onClick={handleConfirmFixes}
              disabled={confirming || fixesAreConfirmed}
              className={`text-sm font-medium rounded-full px-4 py-2 whitespace-nowrap transition-colors ${
                fixesAreConfirmed
                  ? "bg-verify-light text-verify cursor-default"
                  : "bg-brand text-white hover:opacity-90 disabled:opacity-50"
              }`}
            >
              {confirming
                ? "Guardando..."
                : fixesAreConfirmed
                ? "Confirmado ✓"
                : "Confirmar correcciones"}
            </button>
          </div>
          {confirmError && (
            <p className="text-alert text-sm mt-3">{confirmError}</p>
          )}
        </div>
      )}

      {readyForPayment ? (
        <PaywallPanel
          projectId={report.project_id}
          priceLabel="Descargá el archivo corregido, listo para importar a Odoo."
        />
      ) : (
        <p className="text-graphite text-sm text-center py-4 border border-line rounded-md bg-white">
          Confirmá tus correcciones manuales para continuar con el pago.
        </p>
      )}
    </main>
  );
}


const ISSUE_LABELS: Record<string, string> = {
  missing_required: "Campo obligatorio vacío",
  invalid_format: "Formato inválido",
  unknown_relation: "No existe en Odoo",
  duplicate: "Duplicado",
  negative_value: "Valor negativo",
};

function IssueGroupList({
  groups,
  allIssues,
  manualFixesApplied,
  onToggle,
  onToggleGroup,
}: {
  groups: Array<{
    key: string;
    issue_type: string;
    column: string;
    fix_is_automatic: boolean;
    has_suggested_fix: boolean;
    fix_explanation: string | null;
    indices: number[];
  }>;
  allIssues: import("@/lib/api").ValidationIssue[];
  manualFixesApplied: Set<number>;
  onToggle: (idx: number) => void;
  onToggleGroup: (indices: number[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <section className="mb-6">
        <p className="text-graphite text-sm py-8 text-center">
          No encontramos errores. Tu archivo está listo para descargar.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2 mb-6">
      {groups.map((g) => {
        const label = ISSUE_LABELS[g.issue_type] ?? g.issue_type;
        const isExpanded = expanded.has(g.key);
        const allGroupSelected = g.indices.every((i) => manualFixesApplied.has(i));
        const someGroupSelected = g.indices.some((i) => manualFixesApplied.has(i));

        return (
          <div key={g.key} className="border border-line rounded-md bg-white overflow-hidden">
            {/* Cabecera del grupo */}
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => toggle(g.key)}
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                <span className="font-mono text-xs uppercase tracking-wide text-alert bg-alert-light rounded px-2 py-0.5 shrink-0">
                  {label}
                </span>
                <span className="font-mono text-xs text-graphite shrink-0">· {g.column}</span>
                <span className="font-mono text-xs text-graphite ml-auto shrink-0">
                  {g.indices.length.toLocaleString()} {g.indices.length === 1 ? "fila" : "filas"}
                </span>
                <span className="text-graphite text-xs shrink-0 ml-2">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </button>

              {g.fix_is_automatic ? (
                <span className="font-mono text-xs text-verify whitespace-nowrap shrink-0">
                  se corrigen solas
                </span>
              ) : g.has_suggested_fix ? (
                <button
                  onClick={() => onToggleGroup(g.indices)}
                  className={`text-xs font-medium rounded-full px-3 py-1.5 whitespace-nowrap transition-colors shrink-0 ${
                    allGroupSelected
                      ? "bg-verify text-white"
                      : someGroupSelected
                      ? "border border-verify text-verify"
                      : "border border-line text-graphite hover:border-verify hover:text-verify"
                  }`}
                >
                  {allGroupSelected
                    ? "Todas aplicadas"
                    : someGroupSelected
                    ? `${g.indices.filter((i) => manualFixesApplied.has(i)).length}/${g.indices.length} aplicadas`
                    : "Aplicar a todas"}
                </button>
              ) : (
                <span className="font-mono text-xs text-graphite whitespace-nowrap shrink-0">
                  requiere revisión manual
                </span>
              )}
            </div>

            {g.fix_explanation && (
              <p className="text-xs text-graphite italic px-4 pb-3 -mt-1">
                {g.fix_explanation}
              </p>
            )}

            {/* Filas individuales — solo si está expandido */}
            {isExpanded && (
              <div className="border-t border-line divide-y divide-line">
                {g.indices.map((idx) => (
                  <div key={idx} className="px-4 py-2">
                    <IssueRow
                      issue={allIssues[idx]}
                      manualFixApplied={manualFixesApplied.has(idx)}
                      onToggleManualFix={() => onToggle(idx)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "verify" | "brand";
}) {
  const toneClass =
    tone === "verify" ? "text-verify" : tone === "brand" ? "text-brand" : "text-ink";
  return (
    <div className="border border-line rounded-md px-4 py-3 bg-white">
      <p className={`font-mono text-2xl ${toneClass}`}>{value}</p>
      <p className="text-xs text-graphite mt-1">{label}</p>
    </div>
  );
}
