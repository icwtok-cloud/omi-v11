"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { listProjects, ProjectListItem, startLemonSqueezyCheckout } from "@/lib/api";
import { NewProjectModal } from "@/components/NewProjectModal";

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

export default function HomePage() {
  const { isSignedIn, getToken } = useAuth();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [versionFilter, setVersionFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Si se llega con ?checkout=annual (botón de la landing en #partners),
  // no mostramos el dashboard de proyectos -- va directo a una pantalla
  // mínima de "pagar" para no confundir a quien solo quiere suscribirse.
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
      .catch(() => setProjectsError("No se pudieron cargar tus proyectos."))
      .finally(() => setLoadingProjects(false));
  }, [isSignedIn, getToken]);

  // Botón "Suscribirme al plan anual" de la landing linkea acá con
  // ?checkout=annual -- si el usuario ya está logueado, dispara el
  // checkout de una. Si todavía no inició sesión, este efecto no hace
  // nada hasta que isSignedIn pase a true (el modal de SignInButton no
  // navega a otra URL, así que el query param sigue ahí cuando cierra
  // sesión el modal y este efecto se re-ejecuta solo).
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
        setProjectsError("No se pudo iniciar el pago del plan anual. Probá de nuevo desde el botón en la landing.");
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
        <span className="font-extrabold text-xl tracking-tight">OMI</span>
        {isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <SignInButton mode="modal">
            <button className="text-sm font-medium border border-ink rounded-full px-4 py-1.5 hover:bg-ink hover:text-paper transition-colors">
              Ingresar
            </button>
          </SignInButton>
        )}
      </header>

      {isAnnualCheckout ? (
        <section className="px-6 md:px-12 pt-16 pb-24 max-w-lg mx-auto w-full text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand mb-4">
            Plan anual · USD 799
          </p>
          <h1 className="font-extrabold text-3xl md:text-4xl leading-[1.1] mb-4 tracking-tight">
            Ya casi -- solo falta confirmar quién sos
          </h1>
          {!isSignedIn ? (
            <>
              <p className="text-graphite mb-6">
                Ingresá con tu cuenta para ir directo al pago del plan anual. No hace falta crear un proyecto antes.
              </p>
              <SignInButton mode="modal">
                <button className="bg-verify text-white rounded-full px-6 py-2.5 font-medium hover:opacity-90 transition-opacity">
                  Ingresar y continuar al pago
                </button>
              </SignInButton>
            </>
          ) : (
            <p className="text-graphite mb-2">Redirigiendo al pago...</p>
          )}
          {projectsError && <p className="text-alert text-sm mt-4">{projectsError}</p>}
        </section>
      ) : (
        <>
      <section className="px-6 md:px-12 pt-16 pb-12 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand mb-4">
          Preparación de datos para Odoo
        </p>
        <h1 className="font-extrabold text-4xl md:text-5xl leading-[1.1] mb-6 tracking-tight">
          Tus datos, listos para Odoo, antes de que Odoo los rechace.
        </h1>
        <p className="text-graphite text-lg leading-relaxed max-w-xl">
          Subí tu archivo, elegí el módulo y la versión, y vas a ver exactamente
          qué filas tienen un problema, por qué, y cómo se corrige — antes de pagar nada.
          Después vas a poder sumar el resto de los módulos de tu migración al
          mismo proyecto, sin perder lo que ya validaste.
        </p>
      </section>

      <section className="px-6 md:px-12 pb-24 max-w-3xl w-full">
        {!isSignedIn ? (
          <div className="border border-line bg-white/60 rounded-lg p-8 text-center">
            <p className="text-graphite mb-4">
              Necesitás ingresar para ver y crear proyectos.
            </p>
            <SignInButton mode="modal">
              <button className="bg-verify text-white rounded-full px-6 py-2.5 font-medium hover:opacity-90 transition-opacity">
                Ingresar para empezar
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
                placeholder="Buscar por versión o país..."
                aria-label="Buscar proyectos"
                className="flex-1 border border-line rounded-md px-3 py-2.5 bg-white text-ink text-sm"
              />
              {availableVersionFilters.length > 1 && (
                <select
                  value={versionFilter}
                  onChange={(e) => setVersionFilter(e.target.value)}
                  aria-label="Filtrar por versión de Odoo"
                  className="border border-line rounded-md px-3 py-2.5 bg-white text-ink text-sm"
                >
                  <option value="">Todas las versiones</option>
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
                + Nuevo proyecto
              </button>
            </div>

            {projectsError && (
              <p className="text-alert text-sm bg-alert-light rounded-md px-4 py-2.5 mb-4">
                {projectsError}
              </p>
            )}

            {loadingProjects ? (
              <p className="text-graphite text-sm">Cargando tus proyectos…</p>
            ) : filteredProjects.length === 0 ? (
              <div className="border border-line bg-white/60 rounded-lg p-8 text-center">
                <p className="text-graphite">
                  {projects.length === 0
                    ? "Todavía no tenés proyectos. Creá el primero."
                    : "Ningún proyecto coincide con la búsqueda."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProjects.map((p) => (
                  <Link
                    key={p.project_id}
                    href={`/proyectos/${p.project_id}`}
                    className="flex items-center justify-between gap-3 border border-line rounded-lg px-4 py-3 bg-white/60 hover:border-ink transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        Odoo {p.odoo_version}
                        {p.odoo_country ? ` · ${p.odoo_country.toUpperCase()}` : ""}
                      </p>
                      <p className="text-xs text-graphite mt-0.5">
                        {p.modules_count} {p.modules_count === 1 ? "módulo" : "módulos"} ·{" "}
                        {new Date(p.created_at).toLocaleDateString("es-AR")}
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
        redirectBasePath="/proyectos"
        locale="es"
      />
    </main>
  );
}
