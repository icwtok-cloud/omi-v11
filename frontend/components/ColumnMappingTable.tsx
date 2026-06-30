"use client";

/**
 * Muestra qué columna del archivo se interpretó como qué campo de Odoo,
 * y cuáles columnas quedaron sin interpretar.
 *
 * Por qué existe: antes de este componente, el usuario solo veía un
 * número ("3 de 13 columnas coinciden") sin saber CUÁLES ni POR QUÉ.
 * Alguien limpiando datos en serio necesita ver el mapeo real para
 * confiar en el resultado, sea que el archivo pase o no pase.
 */
export function ColumnMappingTable({
  columnMapping,
  unmatchedColumns,
}: {
  columnMapping: Record<string, string>;
  unmatchedColumns: string[];
}) {
  const mappedEntries = Object.entries(columnMapping);

  if (mappedEntries.length === 0 && unmatchedColumns.length === 0) return null;

  return (
    <div className="mb-8 border border-line rounded-md bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-line bg-paper-dim">
        <p className="font-medium text-sm text-ink">Mapeo de columnas</p>
        <p className="text-xs text-graphite mt-0.5">
          Así interpretamos las columnas de tu archivo contra los campos de Odoo
        </p>
      </div>

      {mappedEntries.length > 0 && (
        <div className="divide-y divide-line">
          {mappedEntries.map(([fileCol, odooField]) => (
            <div
              key={fileCol}
              className="px-5 py-2.5 flex items-center justify-between gap-3"
            >
              <span className="font-mono text-sm text-ink truncate">{fileCol}</span>
              <span className="text-graphite text-xs shrink-0">→</span>
              <span className="font-mono text-xs text-verify bg-verify-light rounded px-2 py-1 shrink-0">
                {odooField}
              </span>
            </div>
          ))}
        </div>
      )}

      {unmatchedColumns.length > 0 && (
        <div className="px-5 py-3 border-t border-line bg-alert-light/40">
          <p className="text-xs text-graphite mb-1.5">
            Columnas que no encontramos en el módulo elegido (se ignoran, no son un error):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unmatchedColumns.map((col) => (
              <span
                key={col}
                className="font-mono text-xs text-graphite border border-line rounded px-2 py-1"
              >
                {col}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
