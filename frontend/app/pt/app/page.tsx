"use client";

import { useEffect, useState } from "react";
import { useAuth, SignInButton, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getAvailableCombinations,
  createProject,
  addModule,
  listProjects,
  AvailableCombination,
  ProjectListItem,
} from "@/lib/api";

// Os VALORES (chaves) seguem em espanhol -- são o contrato real com o
// backend (nomes de módulo/país que a API espera), só o RÓTULO exibido
// muda para português. Ver app/app/page.tsx (versão ES) para o
// equivalente -- mesma lógica, mesmos valores, só o texto muda.
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

export default function HomePagePT() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();

  const [combinations, setCombinations] = useState<AvailableCombination[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingModules, setLoadingModules] = useState(true);

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    if (!isSignedIn) return;
    setLoadingModules(true);
    getAvailableCombinations(getToken)
      .then(setCombinations)
      .catch(() => setError("Não foi possível carregar os módulos disponíveis."))
      .finally(() => setLoadingModules(false));
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    setLoadingProjects(true);
    listProjects(getToken)
      .then(setProjects)
      .catch(() => {
        // se falhar, não bloqueia o fluxo de criar um projeto novo --
        // só não mostra a lista de projetos anteriores.
      })
      .finally(() => setLoadingProjects(false));
  }, [isSignedIn, getToken]);

  const availableVersions = Array.from(new Set(combinations.map((c) => c.version))).sort();

  const availableModules = Array.from(
    new Set(combinations.filter((c) => c.version === selectedVersion).map((c) => c.module))
  );

  const needsCountry = selectedModule ? COUNTRY_SCOPED_MODULES.has(selectedModule) : false;

  const availableCountries = needsCountry
    ? combinations
        .filter((c) => c.module === selectedModule && c.version === selectedVersion && c.country)
        .map((c) => c.country as string)
    : [];

  const isFormReady =
    selectedVersion &&
    selectedModule &&
    (!needsCountry || selectedCountry) &&
    file;

  async function handleSubmit() {
    if (!isFormReady) return;
    setUploading(true);
    setError(null);
    try {
      const project = await createProject(
        getToken,
        selectedVersion,
        needsCountry ? selectedCountry : null
      );
      await addModule(getToken, project.project_id, selectedModule, file!);
      router.push(`/pt/proyectos/${project.project_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar o arquivo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-line px-6 md:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-extrabold text-xl tracking-tight">OMI</span>
          <Link href="/app" className="text-xs font-medium text-graphite hover:text-ink transition-colors" title="Ver em español">
            ES
          </Link>
        </div>
        {isSignedIn ? (
          <UserButton afterSignOutUrl="/pt" />
        ) : (
          <SignInButton mode="modal">
            <button className="text-sm font-medium border border-ink rounded-full px-4 py-1.5 hover:bg-ink hover:text-paper transition-colors">
              Entrar
            </button>
          </SignInButton>
        )}
      </header>

      <section className="px-6 md:px-12 pt-16 pb-12 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand mb-4">
          Preparação de dados para o Odoo
        </p>
        <h1 className="font-extrabold text-4xl md:text-5xl leading-[1.1] mb-6 tracking-tight">
          Seus dados, prontos para o Odoo, antes que o Odoo os rejeite.
        </h1>
        <p className="text-graphite text-lg leading-relaxed max-w-xl">
          Envie seu arquivo, escolha o módulo e a versão, e você vai ver exatamente
          quais linhas têm um problema, por quê, e como se corrige — antes de pagar nada.
          Depois você vai poder adicionar o resto dos módulos da sua migração ao
          mesmo projeto, sem perder o que já validou.
        </p>
      </section>

      {isSignedIn && !loadingProjects && projects.length > 0 && (
        <section className="px-6 md:px-12 pb-10 max-w-3xl w-full">
          <h2 className="font-bold text-sm text-graphite uppercase tracking-wide mb-3">
            Seus projetos
          </h2>
          <div className="space-y-2">
            {projects.map((p) => (
              <Link
                key={p.project_id}
                href={`/pt/proyectos/${p.project_id}`}
                className="flex items-center justify-between gap-3 border border-line rounded-lg px-4 py-3 bg-white/60 hover:border-ink transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">
                    Odoo {p.odoo_version}
                    {p.odoo_country ? ` · ${p.odoo_country.toUpperCase()}` : ""}
                  </p>
                  <p className="text-xs text-graphite mt-0.5">
                    {p.modules_count} {p.modules_count === 1 ? "módulo" : "módulos"} ·{" "}
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="text-xs text-graphite">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="px-6 md:px-12 pb-24 max-w-3xl w-full">
        {isSignedIn && projects.length > 0 && (
          <h2 className="font-bold text-sm text-graphite uppercase tracking-wide mb-3">
            Novo projeto
          </h2>
        )}
        {!isSignedIn ? (
          <div className="border border-line bg-white/60 rounded-lg p-8 text-center">
            <p className="text-graphite mb-4">
              Você precisa entrar para enviar um arquivo.
            </p>
            <SignInButton mode="modal">
              <button className="bg-verify text-white rounded-full px-6 py-2.5 font-medium hover:opacity-90 transition-opacity">
                Entrar para começar
              </button>
            </SignInButton>
          </div>
        ) : (
          <div className="border border-line bg-white/60 rounded-lg p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="version-select">
                  Versão do Odoo
                  <span className="ml-2 text-xs font-normal text-graphite">
                    a instância completa do seu projeto
                  </span>
                </label>
                <select
                  id="version-select"
                  className="w-full border border-line rounded-md px-3 py-2.5 bg-white text-ink disabled:opacity-50"
                  value={selectedVersion}
                  disabled={loadingModules}
                  onChange={(e) => {
                    setSelectedVersion(e.target.value);
                    setSelectedModule("");
                    setSelectedCountry("");
                  }}
                >
                  <option value="">
                    {loadingModules ? "Carregando…" : "Escolha uma versão"}
                  </option>
                  {availableVersions.map((v) => (
                    <option key={v} value={v}>
                      Odoo {v}
                    </option>
                  ))}
                </select>
                {loadingModules && (
                  <p className="text-xs text-graphite mt-2">
                    Isso pode levar até um minuto na primeira vez (o servidor
                    estava "dormindo" e está acordando).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="module-select">
                  Primeiro módulo a validar
                  <span className="ml-2 text-xs font-normal text-graphite">
                    depois você adiciona o resto
                  </span>
                </label>
                <select
                  id="module-select"
                  className="w-full border border-line rounded-md px-3 py-2.5 bg-white text-ink disabled:opacity-50"
                  value={selectedModule}
                  onChange={(e) => {
                    setSelectedModule(e.target.value);
                    setSelectedCountry("");
                  }}
                  disabled={!selectedVersion}
                >
                  <option value="">Escolha um módulo</option>
                  {availableModules.map((m) => (
                    <option key={m} value={m}>
                      {MODULE_LABELS[m] || m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {needsCountry && (
              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="country-select">
                  País de localização
                  <span className="ml-2 text-xs font-normal text-graphite">
                    As regras de {MODULE_LABELS[selectedModule] || selectedModule} variam por país
                  </span>
                </label>
                <select
                  id="country-select"
                  className="w-full border border-line rounded-md px-3 py-2.5 bg-white text-ink disabled:opacity-50"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  disabled={!selectedModule}
                >
                  <option value="">Escolha um país</option>
                  {availableCountries.map((c) => (
                    <option key={c} value={c}>
                      {COUNTRY_LABELS[c] || c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files[0];
                if (dropped) setFile(dropped);
              }}
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                isDragging ? "border-verify bg-verify-light" : "border-line"
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <p className="text-sm text-ink">{file.name}</p>
                  <label className="cursor-pointer text-verify text-sm font-medium underline">
                    trocar arquivo
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-alert text-sm font-medium underline"
                  >
                    remover
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-graphite mb-3">
                    Arraste seu arquivo CSV ou Excel aqui
                  </p>
                  <label className="inline-block cursor-pointer text-verify font-medium underline">
                    ou escolha manualmente
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </>
              )}
            </div>

            {error && (
              <p className="text-alert text-sm bg-alert-light rounded-md px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!isFormReady || uploading}
              className="w-full bg-ink text-paper rounded-full py-3 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {uploading ? "Enviando..." : "Analisar arquivo grátis"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
