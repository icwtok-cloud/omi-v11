"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { runValidation, ValidationReport } from "@/lib/api";
import { IssueRow } from "@/components/IssueRow";
import { PaywallPanel } from "@/components/PaywallPanel";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualFixesApplied, setManualFixesApplied] = useState<Set<number>>(new Set());

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

  if (report.structural_mismatch) {
    return (
      <main className="min-h-screen px-6 md:px-12 py-10 max-w-4xl mx-auto">
        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-alert mb-2">
            Reporte de validación
          </p>
          <h1 className="font-extrabold text-3xl mb-4 tracking-tight">
            Este archivo no parece corresponder al módulo elegido
          </h1>
          <p className="text-graphite text-sm">
            Solo {report.matched_columns_count} de {report.columns_seen.length} columnas
            de tu archivo coinciden con campos del módulo y la versión que elegiste.
            Es muy probable que el archivo sea de otro origen, o que tengas que elegir
            otro módulo/versión de Odoo antes de validar.
          </p>
        </header>

        <div className="mb-8 border border-alert bg-alert-light rounded-md px-5 py-4">
          <p className="font-medium text-alert mb-1">Columnas detectadas en tu archivo</p>
          <p className="font-mono text-sm text-alert">{report.columns_seen.join(", ")}</p>
        </div>

        <a
          href="/app"
          className="inline-block bg-ink text-paper rounded-full px-6 py-3 font-medium hover:opacity-90 transition-opacity"
        >
          Volver a subir un archivo
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 md:px-12 py-10 max-w-4xl mx-auto">
      <header className="mb-8">
        <a
          href="/app"
          className="inline-block text-sm text-graphite hover:text-ink mb-4 transition-colors"
        >
          ← Subir otro archivo
        </a>
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

      <section className="space-y-3 mb-12">
        {report.issues.map((issue, idx) => (
          <IssueRow
            key={idx}
            issue={issue}
            manualFixApplied={manualFixesApplied.has(idx)}
            onToggleManualFix={() => toggleManualFix(idx)}
          />
        ))}
        {report.issues.length === 0 && (
          <p className="text-graphite text-sm py-8 text-center">
            No encontramos errores. Tu archivo está listo para descargar.
          </p>
        )}
      </section>

      <PaywallPanel
        projectId={report.project_id}
        priceLabel="Descargá el archivo corregido, listo para importar a Odoo."
      />
    </main>
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
