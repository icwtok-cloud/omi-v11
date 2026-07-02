"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  runValidation,
  getValidationStatus,
  getReport,
  applyFixes,
  getProject,
  addModule,
  getAvailableCombinations,
  ValidationReport,
  ModuleValidateStatus,
  ManualFix,
  ProjectSummary,
  AvailableCombination,
  reportPdfUrl,
  triggerAuthedDownload,
} from "@/lib/api";
import { IssueRow } from "@/components/IssueRow";
import { PaywallPanel } from "@/components/PaywallPanel";
import { DataPreview } from "@/components/DataPreview";

// Os VALORES seguem em espanhol (contrato com o backend); só os
// RÓTULOS exibidos mudam. Ver app/proyectos/[id]/page.tsx (versão ES)
// para a lógica original -- idêntica aqui, só muda o texto.
const MODULE_LABELS: Record<string, string> = {
  contactos: "Contatos",
  crm: "CRM",
  ventas: "Vendas",
  facturacion: "Faturamento",
  inventario: "Estoque",
  productos: "Produtos",
  contabilidad: "Contabilidade",
  compras: "Compras",
};

const COUNTRY_LABELS: Record<string, string> = {
  ar: "Argentina",
  bo: "Bolívia",
  br: "Brasil",
  cl: "Chile",
  co: "Colômbia",
  cr: "Costa Rica",
  do: "República Dominicana",
  ec: "Equador",
  gt: "Guatemala",
  mx: "México",
  pa: "Panamá",
  pe: "Peru",
  py: "Paraguai",
  uy: "Uruguai",
  ve: "Venezuela",
};

const COUNTRY_SCOPED_MODULES = new Set(["contactos", "contabilidad", "facturacion"]);

export default function ProjectPagePT() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { getToken } = useAuth();

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, ValidationReport>>({});
  const [loadingModuleId, setLoadingModuleId] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<ModuleValidateStatus | null>(null);
  const [validationStalled, setValidationStalled] = useState(false);

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

  const pollingModuleIdRef = useRef<string | null>(null);

  const POLL_INTERVALS_MS = [1500, 3000, 5000];
  const STALL_THRESHOLD_MS = 10 * 60 * 1000;

  const loadModuleReport = useCallback(
    async (moduleId: string, moduleStatus: string) => {
      pollingModuleIdRef.current = moduleId;
      setLoadingModuleId(moduleId);
      setValidationStalled(false);
      setValidationStatus(null);
      setError(null);
      try {
        if (moduleStatus !== "validated") {
          await runValidation(getToken, projectId, moduleId);
        }

        let pollCount = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (pollingModuleIdRef.current !== moduleId) return;

          const status = await getValidationStatus(getToken, projectId, moduleId);
          if (pollingModuleIdRef.current !== moduleId) return;
          setValidationStatus(status);

          if (status.status === "validated") {
            const report = await getReport(getToken, projectId, moduleId);
            if (pollingModuleIdRef.current !== moduleId) return;
            setReports((prev) => ({ ...prev, [moduleId]: report }));
            setLoadingModuleId(null);
            return;
          }
          if (status.status === "failed") {
            setError(status.error || "A validação falhou -- tente enviar o arquivo novamente.");
            setLoadingModuleId(null);
            return;
          }
          if (status.started_at && Date.now() - new Date(status.started_at).getTime() > STALL_THRESHOLD_MS) {
            setValidationStalled(true);
            setLoadingModuleId(null);
            return;
          }

          const interval =
            POLL_INTERVALS_MS[Math.min(pollCount, POLL_INTERVALS_MS.length - 1)];
          pollCount++;
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      } catch (e) {
        if (pollingModuleIdRef.current !== moduleId) return;
        setError(e instanceof Error ? e.message : "Erro ao validar o módulo");
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
      .catch((e) => setProjectError(e instanceof Error ? e.message : "Erro ao carregar o projeto"))
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
    } else {
      setError(null);
      setValidationStalled(false);
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
      setConfirmError(e instanceof Error ? e.message : "Não foi possível salvar as correções");
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
      setAddModuleError(e instanceof Error ? e.message : "Não foi possível enviar o módulo");
    } finally {
      setAddingModule(false);
    }
  }

  if (loadingProject) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-sm text-graphite">Carregando seu projeto...</p>
      </main>
    );
  }

  if (projectError || !project) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="text-alert bg-alert-light rounded-md px-5 py-3 text-sm">
          {projectError || "Não foi possível carregar o projeto"}
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
          Seu projeto · Odoo {project.odoo_version}
          {project.odoo_country ? ` · ${project.odoo_country.toUpperCase()}` : ""}
        </p>
        <h1 className="font-extrabold text-3xl mb-2 tracking-tight">
          {project.modules.length} de 8 módulos carregados
        </h1>
        <p className="text-graphite text-sm">
          Envie e valide um módulo por vez -- nada se perde entre um e outro.
          Você paga e baixa tudo junto quando terminar.
        </p>
      </header>

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
            + Adicionar módulo
          </button>
        )}
      </div>

      {project.modules
        .filter((m) => m.missing_dependencies.length > 0)
        .map((m) => (
          <p
            key={`dep-warning-${m.module_id}`}
            className="text-xs text-graphite bg-canvas border border-line rounded-md px-4 py-2 mb-3"
          >
            <strong>{MODULE_LABELS[m.odoo_module] || m.odoo_module}</strong> costuma depender de{" "}
            {m.missing_dependencies.map((d) => MODULE_LABELS[d] || d).join(", ")} -- se esses
            registros ainda não existirem no seu Odoo, algumas relações deste módulo podem
            ficar vazias ao importar. Não é um erro, é apenas uma recomendação de ordem.
          </p>
        ))}

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
              <option value="">Escolha um módulo</option>
              {addableModules.map((m) => (
                <option key={m} value={m}>
                  {MODULE_LABELS[m] || m}
                </option>
              ))}
            </select>
            <label className="border border-line rounded-md px-3 py-2.5 text-center cursor-pointer text-sm text-graphite hover:border-verify">
              {addModuleFile ? addModuleFile.name : "Escolher arquivo CSV/Excel"}
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
                País de localização
                <span className="ml-2 text-xs font-normal text-graphite">
                  As regras de {MODULE_LABELS[addModuleName] || addModuleName} variam por país -- fica fixo para todo o projeto
                </span>
              </label>
              <select
                id="add-module-country"
                className="w-full border border-line rounded-md px-3 py-2.5 bg-white text-ink"
                value={addModuleCountry}
                onChange={(e) => setAddModuleCountry(e.target.value)}
              >
                <option value="">Escolha um país</option>
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
            {addingModule ? "Enviando..." : "Adicionar e validar"}
          </button>
        </div>
      )}

      {activeModuleId && loadingModuleId === activeModuleId && (
        <ValidationProgress status={validationStatus} />
      )}

      {activeModuleId && error && loadingModuleId !== activeModuleId && !validationStalled && (
        <div className="py-10 text-center border border-alert bg-alert-light rounded-md">
          <p className="text-alert font-medium mb-3">{error}</p>
          <button
            onClick={() => {
              const mod = project.modules.find((m) => m.module_id === activeModuleId);
              if (mod) loadModuleReport(activeModuleId, mod.status);
            }}
            className="bg-alert text-white text-sm font-medium rounded-full px-5 py-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {activeModuleId && validationStalled && loadingModuleId !== activeModuleId && (
        <div className="py-10 text-center border border-alert bg-alert-light rounded-md">
          <p className="text-alert font-medium mb-3">
            Parece que a validação foi interrompida -- tente novamente.
          </p>
          <button
            onClick={() => {
              const mod = project.modules.find((m) => m.module_id === activeModuleId);
              if (mod) loadModuleReport(activeModuleId, mod.status);
            }}
            className="bg-alert text-white text-sm font-medium rounded-full px-5 py-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {activeModuleId && activeReport && loadingModuleId !== activeModuleId && (
        <ModuleReportView
          report={activeReport}
          getToken={getToken}
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
            priceLabel="Baixe todos os módulos validados, prontos para importar no Odoo."
            locale="pt"
          />
        ) : (
          <p className="text-graphite text-sm text-center py-4 border border-line rounded-md bg-white">
            Confirme suas correções manuais em cada módulo para continuar com o pagamento.
          </p>
        )}
      </div>
    </main>
  );
}

const ISSUE_LABELS: Record<string, string> = {
  missing_required: "Campo obrigatório vazio",
  invalid_format: "Formato inválido",
  unknown_relation: "Não existe no Odoo",
  duplicate: "Duplicado",
  negative_value: "Valor negativo",
  missing_contact_info: "Sem dados de contato",
};

function ModuleReportView({
  report,
  getToken,
  manualFixesApplied,
  confirmedSnapshot,
  confirming,
  confirmError,
  onToggle,
  onConfirm,
}: {
  report: ValidationReport;
  getToken: () => Promise<string | null>;
  manualFixesApplied: Set<number>;
  confirmedSnapshot: Set<number> | null;
  confirming: boolean;
  confirmError: string | null;
  onToggle: (idx: number) => void;
  onConfirm: () => void;
}) {
  const [pdfError, setPdfError] = useState<string | null>(null);
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
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="font-extrabold text-2xl tracking-tight">
            {report.total_issues === 0
              ? "Este módulo está pronto para o Odoo"
              : `${report.total_issues} ${
                  report.total_issues === 1 ? "problema encontrado" : "problemas encontrados"
                }`}
          </h2>
          <QualityScoreBadge score={report.quality_score} />
          <button
            onClick={() =>
              triggerAuthedDownload(
                getToken,
                reportPdfUrl(report.project_id, report.module_id),
                `omi_relatorio_${report.module_id}.pdf`
              ).catch((e) =>
                setPdfError(e instanceof Error ? e.message : "Não foi possível baixar o PDF")
              )
            }
            className="flex items-center gap-1.5 font-mono text-xs text-brand border border-brand rounded-full pl-2.5 pr-3.5 py-1.5 bg-white hover:bg-brand hover:text-white transition-colors ml-auto animate-[attention-pulse_1.4s_ease-in-out_2]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5 shrink-0"
            >
              <path d="M12 3v11M12 14l-3.5-3.5M12 14l3.5-3.5" />
              <path d="M4.5 15.5V17a2 2 0 002 2h11a2 2 0 002-2v-1.5" />
            </svg>
            Baixar relatório (PDF)
          </button>
        </div>
        {pdfError && <p className="text-alert text-xs mb-2">{pdfError}</p>}
        {report.quality_score_breakdown.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
            {report.quality_score_breakdown.map((b) => (
              <p key={b.issue_type} className="font-mono text-xs text-graphite">
                -{b.points_deducted} {ISSUE_LABELS[b.issue_type] ?? b.issue_type} (
                {b.rows_affected} {b.rows_affected === 1 ? "linha" : "linhas"})
              </p>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Linhas totais" value={report.total_rows} />
          <Stat label="Linhas sem erros" value={Math.max(okRows, 0)} tone="verify" />
          <Stat label="Se corrigem sozinhas" value={autoFixable} tone="brand" />
        </div>
      </div>

      {report.columns_expected_missing.length > 0 && (
        <div className="mb-8 border border-alert bg-alert-light rounded-md px-5 py-4">
          <p className="font-medium text-alert mb-1">
            Faltam colunas obrigatórias no seu arquivo
          </p>
          <p className="font-mono text-sm text-alert mb-2">
            {report.columns_expected_missing.join(", ")}
          </p>
          <p className="text-sm text-alert">
            Isso não pode ser corrigido automaticamente porque o dado não está
            no seu arquivo -- adicione essa coluna na origem e envie novamente.
          </p>
        </div>
      )}

      {!report.has_external_id && !report.structural_mismatch && (
        <div className="mb-8 border border-line bg-canvas rounded-md px-5 py-4">
          <p className="font-medium text-sm mb-1">Seu arquivo não traz External ID</p>
          <p className="text-sm text-graphite">
            O "External ID" é a coluna (normalmente chamada "id") que permite ao Odoo
            reconhecer que um registro já existe e ATUALIZÁ-LO, em vez de criar um novo. Sem
            um, se você corrigir e reimportar este mesmo arquivo mais de uma vez (algo muito
            comum: "esqueci um dado, corrijo e reimporto"), o Odoo pode criar registros
            duplicados em vez de atualizar os que você já importou. Se for importar uma única
            vez e não repetir o processo, não é necessário -- se for iterar sobre o mesmo
            arquivo, vale a pena adicionar uma coluna "id" com um identificador único e estável
            (ex. seu código interno de cliente/produto) antes de importar. A OMI não gera esse
            valor por você -- depende do seu sistema de origem.
          </p>
        </div>
      )}

      <ColumnMappingPanel
        columnMapping={report.column_mapping}
        columnMatchConfidence={report.column_match_confidence}
        unmatchedColumns={report.unmatched_columns}
      />

      <DataPreview columns={report.columns_seen} rows={report.preview_rows} locale="pt" />

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
                  ? "Correções confirmadas"
                  : `${manualFixesApplied.size} ${
                      manualFixesApplied.size === 1
                        ? "correção pronta para confirmar"
                        : "correções prontas para confirmar"
                    }`}
              </p>
              <p className="text-sm text-graphite">
                {fixesAreConfirmed
                  ? "Você já pode continuar com o pagamento e o download."
                  : "Confirme para salvar essas mudanças antes de pagar e baixar."}
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
                ? "Salvando..."
                : fixesAreConfirmed
                ? "Confirmado ✓"
                : "Confirmar correções"}
            </button>
          </div>
          {confirmError && <p className="text-alert text-sm mt-3">{confirmError}</p>}
        </div>
      )}
    </>
  );
}

const CONFIDENCE_BADGE: Record<string, { label: string; className: string }> = {
  fuzzy: { label: "revisar", className: "text-alert bg-alert-light" },
};

function ColumnMappingPanel({
  columnMapping,
  columnMatchConfidence,
  unmatchedColumns,
}: {
  columnMapping: Record<string, string>;
  columnMatchConfidence: Record<string, string>;
  unmatchedColumns: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const mappedEntries = Object.entries(columnMapping);
  const fuzzyCount = mappedEntries.filter(
    ([col]) => columnMatchConfidence[col] === "fuzzy"
  ).length;

  if (mappedEntries.length === 0 && unmatchedColumns.length === 0) return null;

  return (
    <div className="mb-8 border border-line rounded-md bg-white overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span className="font-medium text-sm">
          Como interpretamos as colunas do seu arquivo
          {fuzzyCount > 0 && (
            <span className="ml-2 text-xs font-normal text-alert">
              {fuzzyCount} {fuzzyCount === 1 ? "para confirmar" : "para confirmar"}
            </span>
          )}
        </span>
        <span className="text-graphite text-xs">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="border-t border-line px-5 py-4 space-y-4">
          {mappedEntries.length > 0 && (
            <div>
              <p className="text-xs font-medium text-graphite mb-2">
                Colunas reconhecidas ({mappedEntries.length})
              </p>
              <div className="space-y-1">
                {mappedEntries.map(([col, field]) => {
                  const confidence = columnMatchConfidence[col];
                  const badge = CONFIDENCE_BADGE[confidence];
                  return (
                    <p key={col} className="font-mono text-xs text-ink flex items-center gap-2">
                      <span>
                        "{col}" → <span className="text-verify">{field}</span>
                      </span>
                      {badge && (
                        <span className={`rounded px-1.5 py-0.5 ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                    </p>
                  );
                })}
              </div>
              {fuzzyCount > 0 && (
                <p className="text-xs text-graphite italic mt-2">
                  As colunas marcadas "revisar" foram associadas por similaridade de texto, não por
                  nome exato nem sinônimo conhecido -- confirme que o campo escolhido faz sentido.
                </p>
              )}
            </div>
          )}
          {unmatchedColumns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-graphite mb-2">
                Colunas ignoradas ({unmatchedColumns.length}) -- não correspondem a nenhum
                campo conhecido, não são usadas nem exportadas
              </p>
              <p className="font-mono text-xs text-graphite">{unmatchedColumns.join(", ")}</p>
            </div>
          )}
        </div>
      )}
    </div>
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

  function onToggleGroup(indices: number[], issueType: string) {
    const allOn = indices.every((i) => manualFixesApplied.has(i));
    // Mesma lógica de proteção que a versão ES: valor negativo pode ser
    // uma nota de crédito legítima, não sempre um erro -- pede
    // confirmação extra só ao passar de "nada selecionado" para "tudo
    // selecionado" neste tipo.
    if (!allOn && issueType === "negative_value") {
      const confirmed = window.confirm(
        `Você vai aplicar a correção automática a ${indices.length} linha${indices.length === 1 ? "" : "s"} com valor negativo.\n\n` +
          "Um valor negativo pode ser uma nota de crédito legítima, nem sempre um erro. " +
          "Revise se nenhuma dessas linhas é intencional antes de continuar.\n\n" +
          "Aplicar a correção a todas mesmo assim?"
      );
      if (!confirmed) return;
    }
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
          Não encontramos erros neste módulo. Está pronto para baixar.
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
                  {g.indices.length.toLocaleString()} {g.indices.length === 1 ? "linha" : "linhas"}
                </span>
                <span className="text-graphite text-xs shrink-0 ml-2">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </button>

              {g.fix_is_automatic ? (
                <span
                  className="font-mono text-xs text-verify whitespace-nowrap shrink-0"
                  title="Corrigem-se no arquivo que você baixa ao exportar -- seu arquivo original nunca é modificado."
                >
                  corrigem-se ao exportar
                </span>
              ) : g.has_suggested_fix ? (
                <button
                  onClick={() => onToggleGroup(g.indices, g.issue_type)}
                  title="A OMI sugere um valor para cada linha mas não aplica sozinha -- confirme se está correto antes de exportar."
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
                <span
                  className="font-mono text-xs text-graphite whitespace-nowrap shrink-0"
                  title="A OMI não pode adivinhar esses valores sem arriscar um dado de negócio real. Se deixar assim, o Odoo pode rejeitar essas linhas ou importá-las com dados incompletos."
                >
                  revise antes de exportar
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
                      locale="pt"
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

function qualityScoreLabel(score: number): string {
  if (score >= 90) return "Excelente";
  if (score >= 75) return "Bom";
  if (score >= 60) return "Precisa de atenção";
  return "Alto risco na importação";
}

function QualityScoreBadge({ score }: { score: number }) {
  const toneClass =
    score >= 90 ? "text-verify bg-verify-light" : score >= 60 ? "text-brand bg-canvas" : "text-alert bg-alert-light";
  return (
    <span
      className={`font-mono text-sm font-medium rounded-full px-3 py-1 ${toneClass}`}
      title="Resume o quão pronta está esta base para o Odoo, considerando os problemas encontrados e o peso de cada tipo. Quanto mais baixo, maior o risco de a importação falhar ou entrar com dados incompletos."
    >
      {qualityScoreLabel(score)} · {score}/100
    </span>
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

const REASSURING_MESSAGES = [
  "Revisando cada linha contra as regras do Odoo...",
  "Procurando duplicados e valores fora do intervalo...",
  "Isso pode levar alguns minutos com arquivos grandes -- não feche esta aba.",
  "Verificando relações contra os dados conhecidos da sua versão do Odoo...",
];

function ValidationProgress({ status }: { status: ModuleValidateStatus | null }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % REASSURING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!status?.started_at) return;
    const startedAt = new Date(status.started_at).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [status?.started_at]);

  const hasProgress = status && status.rows_total !== null && status.rows_total > 0;
  const percent = hasProgress
    ? Math.min(100, Math.round((status!.rows_processed / status!.rows_total!) * 100))
    : null;

  return (
    <div className="py-16 text-center max-w-md mx-auto">
      <p className="font-mono text-sm text-ink mb-3">
        {hasProgress
          ? `Linha ${status!.rows_processed.toLocaleString()} de ${status!.rows_total!.toLocaleString()}`
          : "Analisando seu arquivo..."}
      </p>

      {percent !== null && (
        <div className="w-full h-2 bg-line rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-verify transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <p className="text-xs text-graphite mb-1">{REASSURING_MESSAGES[messageIndex]}</p>
      <p className="text-xs text-graphite">
        {elapsedSeconds < 60
          ? `${elapsedSeconds}s decorridos`
          : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s decorridos`}
      </p>
    </div>
  );
}
