"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAvailableCombinations,
  createProject,
  AvailableCombination,
} from "@/lib/api";

type Locale = "es" | "pt";
type GetToken = Parameters<typeof getAvailableCombinations>[0];

const MODULE_LABELS: Record<Locale, Record<string, string>> = {
  es: {
    contactos: "Contactos",
    crm: "CRM",
    ventas: "Ventas",
    facturacion: "Facturación",
    inventario: "Inventario",
    productos: "Productos",
    contabilidad: "Contabilidad",
    compras: "Compras",
  },
  pt: {
    contactos: "Contatos",
    crm: "CRM",
    ventas: "Vendas",
    facturacion: "Faturamento",
    inventario: "Estoque",
    productos: "Produtos",
    contabilidad: "Contabilidade",
    compras: "Compras",
  },
};

const COUNTRY_LABELS: Record<Locale, Record<string, string>> = {
  es: {
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
  },
  pt: {
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
  },
};

// Módulos cuyas reglas varían por país (deben mostrar selector de país) --
// mismo set que en /proyectos/[id] y que el formulario original de /app.
const COUNTRY_SCOPED_MODULES = new Set(["contactos", "contabilidad", "facturacion"]);

const COPY: Record<
  Locale,
  {
    title: string;
    versionLabel: string;
    versionHint: string;
    versionLoading: string;
    versionPlaceholder: string;
    versionSlowHint: string;
    moduleLabel: string;
    moduleHint: string;
    modulePlaceholder: string;
    countryLabel: string;
    countryHint: (moduleLabel: string) => string;
    countryPlaceholder: string;
    combosError: string;
    cancel: string;
    submit: string;
    submitting: string;
  }
> = {
  es: {
    title: "Nuevo proyecto",
    versionLabel: "Versión de Odoo",
    versionHint: "la instancia completa de tu proyecto",
    versionLoading: "Cargando…",
    versionPlaceholder: "Elegí una versión",
    versionSlowHint:
      'Esto puede tardar hasta un minuto la primera vez (el servidor estaba "dormido" y se está despertando).',
    moduleLabel: "Primer módulo a validar",
    moduleHint: "después sumás el resto",
    modulePlaceholder: "Elegí un módulo",
    countryLabel: "País de localización",
    countryHint: (m) => `Las reglas de ${m} varían según el país`,
    countryPlaceholder: "Elegí un país",
    combosError: "No se pudieron cargar los módulos disponibles.",
    cancel: "Cancelar",
    submit: "Crear proyecto",
    submitting: "Creando...",
  },
  pt: {
    title: "Novo projeto",
    versionLabel: "Versão do Odoo",
    versionHint: "a instância completa do seu projeto",
    versionLoading: "Carregando…",
    versionPlaceholder: "Escolha uma versão",
    versionSlowHint:
      'Isso pode demorar até um minuto na primeira vez (o servidor estava "dormindo" e está acordando).',
    moduleLabel: "Primeiro módulo a validar",
    moduleHint: "depois você soma o resto",
    modulePlaceholder: "Escolha um módulo",
    countryLabel: "País de localização",
    countryHint: (m) => `As regras de ${m} variam de acordo com o país`,
    countryPlaceholder: "Escolha um país",
    combosError: "Não foi possível carregar os módulos disponíveis.",
    cancel: "Cancelar",
    submit: "Criar projeto",
    submitting: "Criando...",
  },
};

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  getToken: GetToken;
  /** Prefijo de ruta para el redirect tras crear el proyecto -- "/proyectos" en
   * ES, "/pt/proyectos" en PT. Mismo valor que ya usan hoy app/app/page.tsx
   * y app/pt/app/page.tsx respectivamente. */
  redirectBasePath: string;
  locale?: Locale;
}

export function NewProjectModal({
  isOpen,
  onClose,
  getToken,
  redirectBasePath,
  locale = "es",
}: NewProjectModalProps) {
  const router = useRouter();
  const t = COPY[locale];
  const moduleLabels = MODULE_LABELS[locale];
  const countryLabels = COUNTRY_LABELS[locale];

  const [combinations, setCombinations] = useState<AvailableCombination[]>([]);
  const [loadingCombinations, setLoadingCombinations] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingCombinations(true);
    getAvailableCombinations(getToken)
      .then(setCombinations)
      .catch(() => setError(t.combosError))
      .finally(() => setLoadingCombinations(false));
  }, [isOpen, getToken, t.combosError]);

  // Reset del formulario cada vez que se cierra, para que la próxima
  // apertura arranque limpia (mismo comportamiento que tenía el form
  // inline al desmontarse/remontarse en la página original).
  useEffect(() => {
    if (isOpen) return;
    setSelectedVersion("");
    setSelectedModule("");
    setSelectedCountry("");
    setError(null);
    setCreating(false);
  }, [isOpen]);

  // Cerrar con tecla Escape, patrón estándar de accesibilidad para diálogos.
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const availableVersions = Array.from(new Set(combinations.map((c) => c.version))).sort();

  const availableModules = Array.from(
    new Set(combinations.filter((c) => c.version === selectedVersion).map((c) => c.module))
  );

  const needsCountry = selectedModule ? COUNTRY_SCOPED_MODULES.has(selectedModule) : false;

  const availableCountries = needsCountry
    ? Array.from(
        new Set(
          combinations
            .filter(
              (c) => c.module === selectedModule && c.version === selectedVersion && c.country
            )
            .map((c) => c.country as string)
        )
      )
    : [];

  const isFormReady = selectedVersion && selectedModule && (!needsCountry || selectedCountry);

  async function handleSubmit() {
    if (!isFormReady) return;
    setCreating(true);
    setError(null);
    try {
      const project = await createProject(
        getToken,
        selectedVersion,
        needsCountry ? selectedCountry : null
      );
      router.push(`${redirectBasePath}/${project.project_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear el proyecto");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-paper border border-line rounded-lg p-6 md:p-8 space-y-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="new-project-modal-title" className="font-extrabold text-xl tracking-tight">
            {t.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.cancel}
            className="text-graphite hover:text-ink transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="new-project-version">
              {t.versionLabel}
              <span className="ml-2 text-xs font-normal text-graphite">{t.versionHint}</span>
            </label>
            <select
              id="new-project-version"
              className="w-full border border-line rounded-md px-3 py-2.5 bg-white text-ink disabled:opacity-50"
              value={selectedVersion}
              disabled={loadingCombinations}
              onChange={(e) => {
                setSelectedVersion(e.target.value);
                setSelectedModule("");
                setSelectedCountry("");
              }}
            >
              <option value="">
                {loadingCombinations ? t.versionLoading : t.versionPlaceholder}
              </option>
              {availableVersions.map((v) => (
                <option key={v} value={v}>
                  Odoo {v}
                </option>
              ))}
            </select>
            {loadingCombinations && (
              <p className="text-xs text-graphite mt-2">{t.versionSlowHint}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="new-project-module">
              {t.moduleLabel}
              <span className="ml-2 text-xs font-normal text-graphite">{t.moduleHint}</span>
            </label>
            <select
              id="new-project-module"
              className="w-full border border-line rounded-md px-3 py-2.5 bg-white text-ink disabled:opacity-50"
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setSelectedCountry("");
              }}
              disabled={!selectedVersion}
            >
              <option value="">{t.modulePlaceholder}</option>
              {availableModules.map((m) => (
                <option key={m} value={m}>
                  {moduleLabels[m] || m}
                </option>
              ))}
            </select>
          </div>

          {needsCountry && (
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="new-project-country">
                {t.countryLabel}
                <span className="ml-2 text-xs font-normal text-graphite">
                  {t.countryHint(moduleLabels[selectedModule] || selectedModule)}
                </span>
              </label>
              <select
                id="new-project-country"
                className="w-full border border-line rounded-md px-3 py-2.5 bg-white text-ink disabled:opacity-50"
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                disabled={!selectedModule}
              >
                <option value="">{t.countryPlaceholder}</option>
                {availableCountries.map((c) => (
                  <option key={c} value={c}>
                    {countryLabels[c] || c.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <p className="text-alert text-sm bg-alert-light rounded-md px-4 py-2.5">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-graphite hover:text-ink transition-colors"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormReady || creating}
            className="bg-ink text-paper rounded-full px-6 py-2.5 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {creating ? t.submitting : t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
