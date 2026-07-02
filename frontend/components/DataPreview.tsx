"use client";

type Locale = "es" | "pt";

const COPY: Record<Locale, { title: (n: number) => string; empty: string }> = {
  es: {
    title: (n) => `Primeras ${n} filas, tal cual vinieron en tu archivo`,
    empty: "vacío",
  },
  pt: {
    title: (n) => `Primeiras ${n} linhas, exatamente como vieram no seu arquivo`,
    empty: "vazio",
  },
};

const HEADER: Record<Locale, string> = {
  es: "Vista previa de tu archivo",
  pt: "Pré-visualização do seu arquivo",
};

/**
 * Muestra una muestra de las primeras filas reales del archivo subido,
 * tal cual vinieron (sin pasar por el motor de validación), para que el
 * usuario pueda confirmar visualmente "sí, esto es lo que yo subí" antes
 * de decidir pagar o cambiar de módulo.
 */
export function DataPreview({
  columns,
  rows,
  locale = "es",
}: {
  columns: string[];
  rows: Record<string, unknown>[];
  locale?: Locale;
}) {
  if (rows.length === 0) return null;
  const t = COPY[locale];

  return (
    <div className="mb-8 border border-line rounded-md bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-canvas">
        <p className="font-medium text-sm text-ink">{HEADER[locale]}</p>
        <p className="text-xs text-graphite mt-0.5">{t.title(rows.length)}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left font-mono text-xs text-graphite px-4 py-2 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-line last:border-0">
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-2 text-ink whitespace-nowrap max-w-[200px] truncate"
                    title={String(row[col] ?? "")}
                  >
                    {row[col] === null || row[col] === undefined ? (
                      <span className="text-graphite italic">{t.empty}</span>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
