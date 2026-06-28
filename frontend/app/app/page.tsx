"use client";

import { useEffect, useState } from "react";
import { useAuth, SignInButton, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  getAvailableCombinations,
  createProject,
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

export default function HomePage() {
  const { isSignedIn, getToken } = useAuth();
  const router = useRouter();

  const [combinations, setCombinations] = useState<AvailableCombination[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    getAvailableCombinations(getToken)
      .then(setCombinations)
      .catch(() => setError("No se pudieron cargar los módulos disponibles."));
  }, [isSignedIn, getToken]);

  const availableModules = Array.from(new Set(combinations.map((c) => c.module)));
  const availableVersions = combinations
    .filter((c) => c.module === selectedModule)
    .map((c) => c.version);

  async function handleSubmit() {
    if (!selectedModule || !selectedVersion || !file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await createProject(getToken, selectedModule, selectedVersion, file);
      router.push(`/proyectos/${result.project_id}`);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="module-select">
                  Módulo de Odoo
                </label>
                <select
                  id="module-select"
                  className="w-full border border-line rounded-md px-3 py-2.5 bg-white text-ink"
                  value={selectedModule}
                  onChange={(e) => {
                    setSelectedModule(e.target.value);
                    setSelectedVersion("");
                  }}
                >
                  <option value="">Elegí un módulo</option>
                  {availableModules.map((m) => (
                    <option key={m} value={m}>
                      {MODULE_LABELS[m] || m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="version-select">
                  Versión de Odoo
                </label>
                <select
                  id="version-select"
                  className="w-full border border-line rounded-md px-3 py-2.5 bg-white text-ink disabled:opacity-50"
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  disabled={!selectedModule}
                >
                  <option value="">Elegí una versión</option>
                  {availableVersions.map((v) => (
                    <option key={v} value={v}>
                      Odoo {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                <p className="text-sm text-ink">{file.name}</p>
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
              disabled={!selectedModule || !selectedVersion || !file || uploading}
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
