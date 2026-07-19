"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { listProjects, ProjectListItem, startLemonSqueezyCheckout } from "@/lib/api";
import { NewProjectModal } from "@/components/NewProjectModal";

// Os VALORES (chaves) seguem em espanhol -- são o contrato real com o
// backend (nomes de país que a API espera), só o RÓTULO exibido muda
// para português. Ver app/app/page.tsx (versão ES) para o equivalente --
// mesma lógica, mesmos valores, só o texto muda.
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

export default function HomePagePT() {
  const { isSignedIn, getToken } = useAuth();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [versionFilter, setVersionFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnnualCheckout] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("checkout") === "annual"
  );

  useEffect(() => {
    if (!isSignedIn) return;
    setLoadingProjects(true);
    listProjects(getToken)
      .then((p) => {
        setProjects(p);
        setProjectsError(null);
      })
      .catch(() => setProjectsError("Não foi possível carregar seus projetos."))
      .finally(() => setLoadingProjects(false));
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "annual") return;
    window.history.replaceState({}, "", window.location.pathname);
    startLemonSqueezyCheckout(getToken, "annual")
      .then((result) => {
        window.location.href = result.checkout_url;
      })
      .catch(() => {
        setProjectsError("Não foi possível iniciar o pagamento do plano anual. Tente de novo pelo botão na landing.");
      });
  }, [isSignedIn, getToken]);

  const availableVersionFilters = useMemo(
    () => Array.from(new Set(projects.map((p) => p.odoo_version))).sort(),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (versionFilter && p.odoo_version !== versionFilter) return false;
      if (!term) return true;
      const haystack = [
        `odoo ${p.odoo_version}`,
        p.odoo_country ? COUNTRY_LABELS[p.odoo_country] || p.odoo_country : "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [projects, search, versionFilter]);

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

      {isAnnualCheckout ? (
        <section className="px-6 md:px-12 pt-16 pb-24 max-w-lg mx-auto w-full text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand mb-4">
            Plano anual · USD 799
          </p>
          <h1 className="font-extrabold text-3xl md:text-4xl leading-[1.1] mb-4 tracking-tight">
            Já quase lá -- só falta confirmar quem é você
          </h1>
          {!isSignedIn ? (
            <>
              <p className="text-graphite mb-6">
                Entre com sua conta para ir direto ao pagamento do plano anual. Não precisa criar um projeto antes.
              </p>
              <SignInButton mode="modal">
                <button className="bg-verify text-white rounded-full px-6 py-2.5 font-medium hover:opacity-90 transition-opacity">
                  Entrar e continuar para o pagamento
                </button>
              </SignInButton>
            </>
          ) : (
            <p className="text-graphite mb-2">Redirecionando para o pagamento...</p>
          )}
          {projectsError && <p className="text-alert text-sm mt-4">{projectsError}</p>}
        </section>
      ) : (
        <>
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

      <section className="px-6 md:px-12 pb-24 max-w-3xl w-full">
        {!isSignedIn ? (
          <div className="border border-line bg-white/60 rounded-lg p-8 text-center">
            <p className="text-graphite mb-4">
              Você precisa entrar para ver e criar projetos.
            </p>
            <SignInButton mode="modal">
              <button className="bg-verify text-white rounded-full px-6 py-2.5 font-medium hover:opacity-90 transition-opacity">
                Entrar para começar
              </button>
            </SignInButton>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por versão ou país..."
                aria-label="Buscar projetos"
                className="flex-1 border border-line rounded-md px-3 py-2.5 bg-white text-ink text-sm"
              />
              {availableVersionFilters.length > 1 && (
                <select
                  value={versionFilter}
                  onChange={(e) => setVersionFilter(e.target.value)}
                  aria-label="Filtrar por versão do Odoo"
                  className="border border-line rounded-md px-3 py-2.5 bg-white text-ink text-sm"
                >
                  <option value="">Todas as versões</option>
                  {availableVersionFilters.map((v) => (
                    <option key={v} value={v}>
                      Odoo {v}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-ink text-paper rounded-full px-5 py-2.5 font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                + Novo projeto
              </button>
            </div>

            {projectsError && (
              <p className="text-alert text-sm bg-alert-light rounded-md px-4 py-2.5 mb-4">
                {projectsError}
              </p>
            )}

            {loadingProjects ? (
              <p className="text-graphite text-sm">Carregando seus projetos…</p>
            ) : filteredProjects.length === 0 ? (
              <div className="border border-line bg-white/60 rounded-lg p-8 text-center">
                <p className="text-graphite">
                  {projects.length === 0
                    ? "Você ainda não tem projetos. Crie o primeiro."
                    : "Nenhum projeto corresponde à busca."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProjects.map((p) => (
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
            )}
          </>
        )}
      </section>
        </>
      )}

      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        getToken={getToken}
        redirectBasePath="/pt/proyectos"
        locale="pt"
      />
    </main>
  );
}
