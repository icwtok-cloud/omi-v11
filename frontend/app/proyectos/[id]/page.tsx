"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  runValidation,
  getReport,
  applyFixes,
  getProject,
  addModule,
  getAvailableCombinations,
  ValidationReport,
  ManualFix,
  ProjectSummary,
  AvailableCombination,
} from "@/lib/api";
import { IssueRow } from "@/components/IssueRow";
import { PaywallPanel } from "@/components/PaywallPanel";
import { DataPreview } from "@/components/DataPreview";

const MODULE_LABELS: Record<string, string> = {
  contactos: "Contactos",
  crm: "CRM",
  ventas: "Ventas",
  facturacion: "Facturación",
  inventario: "Inventario",
  productos: "Productos",
  contabilidad: "Contabilidad",
  compras: "Compras",
};

const COUNTRY_LABELS: Record<string, string> = {
  ar: "Argentina",
  bo: "Bolivia",
  br: "Brasil",
  cl: "Chile",
  co: "Colombia",
  cr: "Costa Rica",
  do: "República Dominicana",
  ec: "Ecuador",
  gt: "Guatemala",
  mx: "México",
  pa: "Panamá",
  pe: "Perú",
  py: "Paraguay",
  uy: "Uruguay",
  ve: "Venezuela",
};

// Módulos cuyas reglas varían por país (deben mostrar selector de país) --
// mismo set que en app/app/page.tsx.
const COUNTRY_SCOPED_MODULES = new Set(["contactos", "contabilidad", "facturacion"]);

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { getToken } = useAuth();

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, ValidationReport>>({});
  const [loadingModuleId, setLoadingModuleId] = useState<string | null>(null);

  // Fixes manuales seleccionados/confirmados por módulo -- el pago se
  // habilita a nivel proyecto, así que hace falta confirmar los fixes de
  // TODOS los módulos que tengan alguno seleccionado, no solo el que se
  // está viendo en este momento.
  const [manualFixesByModule, setManualFixesByModule] = useState<Record<string, Set<number>>>({});
  const [confirmedSnapshotByModule, setConfirmedSnapshotByModule] = useState<
    Record<string, Set<number> | null>
  >({});
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [combinations, setCombinations] = useState<AvailableCombination[]>([]);
  const [showAddModule, setShowAddModule] = useState(false);
  const [addModuleName, setAddModuleName] = useState("");
  const [addModuleCountry, setAddModuleCountry] = useState("");
  const [addModuleFile, setAddModuleFile] = useState<File | null>(null);
  const [addingModule, setAddingModule] = useState(false);
  const [addModuleError, setAddModuleError] = useState<string | null>(null);

  const loadModuleReport = useCallback(
    async (moduleId: string, moduleStatus: string) => {
      setLoadingModuleId(moduleId);
      try {
        const report =
          moduleStatus === "validated"
            ? await getReport(getToken, projectId, moduleId)
            : await runValidation(getToken, projectId, moduleId);
        setReports((prev) => ({ ...prev, [moduleId]: report }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al validar el módulo");
      } finally {
        setLoadingModuleId(null);
      }
    },
    [getToken, projectId]
  );

  useEffect(() => {
    if (!projectId) return;
    getProject(getToken, projectId)
      .then((summary) => {
        setProject(summary);
        if (summary.modules.length > 0) {
          const first = summary.modules[0];
          setActiveModuleId(first.module_id);
          loadModuleReport(first.module_id, first.status);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar el proyecto"))
      .finally(() => setLoadingProject(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    getAvailableCombinations(getToken)
      .then(setCombinations)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectModule(moduleId: string) {
    setActiveModuleId(moduleId);
    if (!reports[moduleId] && project) {
      const mod = project.modules.find((m) => m.module_id === moduleId);
      if (mod) loadModuleReport(moduleId, mod.status);
    }
  }

  function toggleManualFix(moduleId: string, index: number) {
    setManualFixesByModule((prev) => {
      const current = new Set(prev[moduleId] ?? []);
      if (current.has(index)) current.delete(index);
      else current.add(index);
      return { ...prev, [moduleId]: current };
    });
    setConfirmedSnapshotByModule((prev) => ({ ...prev, [moduleId]: null }));
  }

  function setsAreEqual(a: Set<number>, b: Set<number>) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  async function handleConfirmFixes(moduleId: string) {
    const report = reports[moduleId];
    if (!report) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const selected = manualFixesByModule[moduleId] ?? new Set<number>();
      const fixes: ManualFix[] = report.issues
        .map((issue, idx) => ({ issue, idx }))
        .filter(({ idx }) => selected.has(idx))
        .map(({ issue }) => ({ row_index: issue.row_index, column: issue.column }));

      await applyFixes(getToken, projectId, moduleId, fixes);
      setConfirmedSnapshotByModule((prev) => ({ ...prev, [moduleId]: new Set(selected) }));
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "No se pudieron guardar las correcciones");
    } finally {
      setConfirming(false);
    }
  }

  async function handleAddModule() {
    if (!addModuleName || !addModuleFile) return;
    setAddingModule(true);
    setAddModuleError(null);
    try {
      const result = await addModule(
        getToken,
        projectId,
        addModuleName,
        addModuleFile,
        needsCountryForAddModule ? addModuleCountry : null
      );
      const summary = await getProject(getToken, projectId);
      setProject(summary);
      setShowAddModule(false);
      setAddModuleName("");
      setAddModuleCountry("");
      setAddModuleFile(null);
      selectModule(result.module_id);
    } catch (e) {
      setAddModuleError(e instanceof Error ? e.message : "No se pudo subir el módulo");
    } finally {
      setAddingModule(false);
    }
  }

  if (loadingProject) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-sm text-graphite">Cargando tu proyecto...</p>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-alert bg-alert-light rounded-md px-5 py-3 text-sm">
          {error || "No se pudo cargar el proyecto"}
        </p>
      </main>
    );
  }

  const activeReport = activeModuleId ? reports[activeModuleId] : null;
  const usedModules = new Set(project.modules.map((m) => m.odoo_module));
  const addableModules = Array.from(
    new Set(
      combinations
        .filter((c) => c.version === project.odoo_version)
        .map((c) => c.module)
    )
  ).filter((m) => !usedModules.has(m));

  // El país es una propiedad del proyecto (una sola instancia de Odoo) --
  // si ya está fijado, no hace falta volver a pedirlo. Si no, y el módulo
  // que se está por agregar lo necesita, hay que elegirlo acá.
  const needsCountryForAddModule =
    !project.odoo_country && COUNTRY_SCOPED_MODULES.has(addModuleName);
  const addModuleCountryOptions = needsCountryForAddModule
    ? combinations
        .filter(
          (c) =>
            c.module === addModuleName && c.version === project.odoo_version && c.country
        )
        .map((c) => c.country as string)
    : [];
  const addModuleReady =
    addModuleName && addModuleFile && (!needsCountryForAddModule || addModuleCountry);

  // El pago es a nivel proyecto: hace falta que TODOS los módulos con
  // fixes manuales seleccionados estén confirmados, no solo el que se
  // está viendo ahora.
  const modulesWithSelection = Object.entries(manualFixesByModule).filter(
    ([, set]) => set.size > 0
  );
  const hasManualFixesSelected = modulesWithSelection.length > 0;
  const allSelectedConfirmed = modulesWithSelection.every(([moduleId, set]) => {
    const snapshot = confirmedSnapshotByModule[moduleId];
    return snapshot !== null && snapshot !== undefined && setsAreEqual(snapshot, set);
  });
  const readyForPayment = !hasManualFixesSelected || allSelectedConfirmed;

  return (
    <main className="min-h-screen px-6 md:px-12 py-10 max-w-4xl mx-auto">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-verify mb-2">
          Tu proyecto · Odoo {project.odoo_version}
          {project.odoo_country ? ` · ${project.odoo_country.toUpperCase()}` : ""}
        </p>
        <h1 className="font-extrabold text-3xl mb-2 tracking-tight">
          {project.modules.length} de 8 módulos cargados
        </h1>
        <p className="text-graphite text-sm">
          Subí y validá un módulo por vez -- nada se pierde entre uno y otro.
          Pagás y descargás todo junto cuando termines.
        </p>
      </header>

      {/* Tabs de módulos */}
      <div className="flex flex-wrap gap-2 mb-8">
        {project.modules.map((m) => (
          <button
            key={m.module_id}
            onClick={() => selectModule(m.module_id)}
            className={`text-sm font-medium rounded-full px-4 py-2 transition-colors ${
              activeModuleId === m.module_id
                ? "bg-ink text-paper"
                : "border border-line text-graphite hover:border-ink hover:text-ink"
            }`}
          >
            {MODULE_LABELS[m.odoo_module] || m.odoo_module}
            {typeof m.total_issues === "number" && (
              <span className="ml-2 opacity-70">{m.total_issues}</span>
            )}
          </button>
        ))}

        {addableModules.length > 0 && (
          <button
            onClick={() => setShowAddModule((v) => !v)}
            className="text-sm font-medium rounded-full px-4 py-2 border border-dashed border-line text-graphite hover:border-verify hover:text-verify transition-colors"
          >
            + Agregar módulo
          </button>
        )}
      </div>

      {showAddModule && (
        <div className="mb-8 border border-line rounded-md p-5 bg-white space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              className="border border-line rounded-md px-3 py-2.5 bg-white text-ink"
              value={addModuleName}
              onChange={(e) => {
                setAddModuleName(e.target.value);
                setAddModuleCountry("");
              }}
            >
              <option value="">Elegí un módulo</option>
              {addableModules.map((m) => (
                <option key={m} value={m}>
                  {MODULE_LABELS[m] || m}
                </option>
              ))}
            </select>
            <label className="border border-line rounded-md px-3 py-2.5 text-center cursor-pointer text-sm text-graphite hover:border-verify">
              {addModuleFile ? addModuleFile.name : "Elegir archivo CSV/Excel"}
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => setAddModuleFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {needsCountryForAddModule && (
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="add-module-country">
                País de localización
                <span className="ml-2 text-xs font-normal text-graphite">
                  Las reglas de {MODULE_LABELS[addModuleName] || addModuleName} varían según el país -- queda fijo para todo el proyecto
                </span>
              </label>
              <select
                id="add-module-country"
                className="w-full border border-line rounded-md px-3 py-2.5 bg-white text-ink"
                value={addModuleCountry}
                onChange={(e) => setAddModuleCountry(e.target.value)}
              >
                <option value="">Elegí un país</option>
                {addModuleCountryOptions.map((c) => (
                  <option key={c} value={c}>
                    {COUNTRY_LABELS[c] || c.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {addModuleError && (
            <p className="text-alert text-sm bg-alert-light rounded-md px-4 py-2.5">
              {addModuleError}
            </p>
          )}
          <button
            onClick={handleAddModule}
            disabled={!addModuleReady || addingModule}
            className="bg-brand text-white text-sm font-medium rounded-full px-5 py-2.5 disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {addingModule ? "Subiendo..." : "Agregar y validar"}
          </button>
        </div>
      )}

      {activeModuleId && loadingModuleId === activeModuleId && (
        <div className="py-16 text-center">
          <p className="font-mono text-sm text-graphite">Analizando tu archivo...</p>
        </div>
      )}

      {activeModuleId && activeReport && loadingModuleId !== activeModuleId && (
        <ModuleReportView
          report={activeReport}
          manualFixesApplied={manualFixesByModule[activeModuleId] ?? new Set()}
          confirmedSnapshot={confirmedSnapshotByModule[activeModuleId] ?? null}
          confirming={confirming}
          confirmError={confirmError}
          onToggle={(idx) => toggleManualFix(activeModuleId, idx)}
          onConfirm={() => handleConfirmFixes(activeModuleId)}
        />
      )}

      <div className="mt-10">
        {readyForPayment ? (
          <PaywallPanel
            projectId={project.project_id}
            priceLabel="Descargá todos los módulos validados, listos para importar a Odoo."
          />
        ) : (
          <p className="text-graphite text-sm text-center py-4 border border-line rounded-md bg-white">
            Confirmá tus correcciones manuales en cada módulo para continuar con el pago.
          </p>
        )}
      </div>
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

function ModuleReportView({
  report,
  manualFixesApplied,
  confirmedSnapshot,
  confirming,
  confirmError,
  onToggle,
  onConfirm,
}: {
  report: ValidationReport;
  manualFixesApplied: Set<number>;
  confirmedSnapshot: Set<number> | null;
  confirming: boolean;
  confirmError: string | null;
  onToggle: (idx: number) => void;
  onConfirm: () => void;
}) {
  function setsAreEqual(a: Set<number>, b: Set<number>) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  const okRows = report.total_rows - new Set(report.issues.map((i) => i.row_index)).size;
  const autoFixable = report.issues.filter((i) => i.fix_is_automatic).length;
  const hasManualFixesSelected = manualFixesApplied.size > 0;
  const fixesAreConfirmed =
    confirmedSnapshot !== null && setsAreEqual(confirmedSnapshot, manualFixesApplied);

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
        fix_explanation: issue.fix_explanation,
        indices: [],
      };
      groupMap.set(key, g);
      issueGroups.push(g);
    }
    groupMap.get(key)!.indices.push(idx);
  });

  return (
    <>
      <div className="mb-8">
        <h2 className="font-extrabold text-2xl mb-4 tracking-tight">
          {report.total_issues === 0
            ? "Este módulo está listo para Odoo"
            : `${report.total_issues} ${
                report.total_issues === 1 ? "problema encontrado" : "problemas encontrados"
              }`}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Filas totales" value={report.total_rows} />
          <Stat label="Filas sin errores" value={Math.max(okRows, 0)} tone="verify" />
          <Stat label="Se corrigen solas" value={autoFixable} tone="brand" />
        </div>
      </div>

      {report.columns_expected_missing.length > 0 && (
        <div className="mb-8 border border-alert bg-alert-light rounded-md px-5 py-4">
          <p className="font-medium text-alert mb-1">
            Faltan columnas obligatorias en tu archivo
          </p>
          <p className="font-mono text-sm text-alert mb-2">
            {report.columns_expected_missing.join(", ")}
          </p>
          <p className="text-sm text-alert">
            Esto no se puede corregir automáticamente porque el dato no está
            en tu archivo -- agregá esa columna en el origen y volvé a subirlo.
          </p>
        </div>
      )}

      <DataPreview columns={report.columns_seen} rows={report.preview_rows} />

      <IssueGroupList
        groups={issueGroups}
        allIssues={report.issues}
        manualFixesApplied={manualFixesApplied}
        onToggle={onToggle}
      />

      {hasManualFixesSelected && (
        <div className="mb-8 border border-line rounded-md px-5 py-4 bg-white">
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
              onClick={onConfirm}
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
          {confirmError && <p className="text-alert text-sm mt-3">{confirmError}</p>}
        </div>
      )}
    </>
  );
}

function IssueGroupList({
  groups,
  allIssues,
  manualFixesApplied,
  onToggle,
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
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function onToggleGroup(indices: number[]) {
    const allOn = indices.every((i) => manualFixesApplied.has(i));
    indices.forEach((i) => {
      const isOn = manualFixesApplied.has(i);
      if (allOn && isOn) onToggle(i);
      if (!allOn && !isOn) onToggle(i);
    });
  }

  if (groups.length === 0) {
    return (
      <section className="mb-6">
        <p className="text-graphite text-sm py-8 text-center">
          No encontramos errores en este módulo. Está listo para descargar.
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
