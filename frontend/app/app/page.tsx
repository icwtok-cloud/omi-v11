"use client";

import { useEffect, useState } from "react";
import { useAuth, SignInButton, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  getAvailableCombinations,
  createProject,
  addModule,
  AvailableCombination,
} from "@/lib/api";

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

// Módulos cuyas reglas varían por país (deben mostrar selector de país)
const COUNTRY_SCOPED_MODULES = new Set(["contactos", "contabilidad", "facturacion"]);

export default function HomePage() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();

  const [combinations, setCombinations] = useState<AvailableCombination[]>([]);
  // El proyecto es una sola instancia de Odoo (versión fija) -- se elige
  // primero. El módulo es el primer archivo que se sube adentro; se
  // pueden agregar más módulos después desde la pantalla del proyecto.
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingModules, setLoadingModules] = useState(true);

  useEffect(() => {
    if (!isSignedIn) return;
    setLoadingModules(true);
    getAvailableCombinations(getToken)
      .then(setCombinations)
      .catch(() => setError("No se pudieron cargar los módulos disponibles."))
      .finally(() => setLoadingModules(false));
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
      router.push(`/proyectos/${project.project_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  }

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
              Necesitás ingresar para subir un archivo.
            </p>
            <SignInButton mode="modal">
              <button className="bg-verify text-white rounded-full px-6 py-2.5 font-medium hover:opacity-90 transition-opacity">
                Ingresar para empezar
              </button>
            </SignInButton>
          </div>
        ) : (
          <div className="border border-line bg-white/60 rounded-lg p-6 md:p-8 space-y-6">
            {/* Fila 1: Versión + Módulo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="version-select">
                  Versión de Odoo
                  <span className="ml-2 text-xs font-normal text-graphite">
                    la instancia completa de tu proyecto
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
                    {loadingModules ? "Cargando…" : "Elegí una versión"}
                  </option>
                  {availableVersions.map((v) => (
                    <option key={v} value={v}>
                      Odoo {v}
                    </option>
                  ))}
                </select>
                {loadingModules && (
                  <p className="text-xs text-graphite mt-2">
                    Esto puede tardar hasta un minuto la primera vez (el servidor
                    estaba "dormido" y se está despertando).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="module-select">
                  Primer módulo a validar
                  <span className="ml-2 text-xs font-normal text-graphite">
                    después sumás el resto
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
                  <option value="">Elegí un módulo</option>
                  {availableModules.map((m) => (
                    <option key={m} value={m}>
                      {MODULE_LABELS[m] || m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fila 2: País (solo para módulos que lo requieren) */}
            {needsCountry && (
              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="country-select">
                  País de localización
                  <span className="ml-2 text-xs font-normal text-graphite">
                    Las reglas de {MODULE_LABELS[selectedModule] || selectedModule} varían según el país
                  </span>
                </label>
                <select
                  id="country-select"
                  className="w-full border border-line rounded-md px-3 py-2.5 bg-white text-ink disabled:opacity-50"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  disabled={!selectedModule}
                >
                  <option value="">Elegí un país</option>
                  {availableCountries.map((c) => (
                    <option key={c} value={c}>
                      {COUNTRY_LABELS[c] || c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Zona de upload */}
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
                    cambiar archivo
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
                    quitar
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-graphite mb-3">
                    Arrastrá tu archivo CSV o Excel acá
                  </p>
                  <label className="inline-block cursor-pointer text-verify font-medium underline">
                    o elegilo manualmente
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
              {uploading ? "Subiendo..." : "Analizar archivo gratis"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
