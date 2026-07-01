"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { key: "upload", label: "Subir archivo" },
  { key: "detect", label: "Detectar módulo" },
  { key: "validate", label: "Validar" },
  { key: "group", label: "Agrupar problemas" },
  { key: "fix", label: "Corregir" },
  { key: "score", label: "Quality Score" },
  { key: "export", label: "Exportar" },
] as const;

const STEP_DURATION_MS = 2000;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/**
 * Demo autoplay del flujo real de OMI (subir → detectar → validar → agrupar
 * → corregir → quality score → exportar). Arranca pausado si el usuario
 * prefiere menos movimiento (prefers-reduced-motion) y siempre expone un
 * botón de play/pausa -- contenido que se autoactualiza en loop necesita un
 * mecanismo para pararlo (WCAG 2.2.2).
 */
export function ProductDemo() {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, STEP_DURATION_MS);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) setPlaying(false);
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  return (
    <div className="border border-line rounded-xl bg-white overflow-hidden shadow-sm text-left">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 bg-canvas">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="ml-2 font-mono text-xs text-graphite">clientes_2026.csv</span>
        </div>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="font-mono text-xs text-graphite border border-line rounded-full px-2.5 py-1 hover:text-ink hover:border-ink transition-colors"
          aria-label={playing ? "Pausar demo" : "Reanudar demo"}
        >
          {playing ? "❚❚ Pausar" : "▶ Reanudar"}
        </button>
      </div>

      <div className="relative h-[240px] sm:h-[220px]" aria-hidden="true">
        {STEPS.map((s, i) => (
          <DemoFrame key={s.key} active={step === i}>
            {renderStepContent(i, step === i)}
          </DemoFrame>
        ))}
      </div>

      <div className="border-t border-line px-4 py-3 bg-canvas">
        <div className="flex items-center justify-center gap-1.5 mb-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  step === i ? "bg-brand" : "bg-line"
                }`}
              />
              {i < STEPS.length - 1 && <span className="w-3 h-px bg-line" />}
            </div>
          ))}
        </div>
        <p className="text-center font-mono text-[11px] text-graphite">
          {step + 1}/{STEPS.length} · {STEPS[step].label}
        </p>
      </div>

      <span className="sr-only">
        Demostración animada del flujo de OMI: subir un archivo, detectar el módulo y la
        versión de Odoo, validar cada fila, agrupar los problemas encontrados, aplicar las
        correcciones automáticas, calcular el Quality Score, y exportar el archivo corregido
        listo para importar a Odoo.
      </span>
    </div>
  );
}

function DemoFrame({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 px-6 py-6 flex items-center justify-center transition-opacity duration-500 ${
        active ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {children}
    </div>
  );
}

function AnimatedBar({
  active,
  duration = 1400,
}: {
  active: boolean;
  duration?: number;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!active) {
      setWidth(0);
      return;
    }
    const id = requestAnimationFrame(() => setWidth(100));
    return () => cancelAnimationFrame(id);
  }, [active]);
  return (
    <div className="w-40 h-1.5 bg-line rounded-full overflow-hidden">
      <div
        className="h-full bg-brand rounded-full transition-[width] ease-out"
        style={{ width: `${width}%`, transitionDuration: `${duration}ms` }}
      />
    </div>
  );
}

function FadeIn({
  active,
  delay = 0,
  children,
}: {
  active: boolean;
  delay?: number;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const id = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(id);
  }, [active, delay]);
  return (
    <div
      className={`transition-all duration-500 ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
      }`}
    >
      {children}
    </div>
  );
}

function IconUpload({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

function IconDownload({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 4v12M12 16l-4-4M12 16l4-4" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconSearch({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  );
}

function renderStepContent(index: number, active: boolean) {
  switch (index) {
    case 0:
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="w-48 border-2 border-dashed border-line rounded-lg py-6 flex flex-col items-center gap-2 bg-canvas">
            <IconUpload className="w-5 h-5 text-graphite" />
            <p className="font-mono text-xs text-ink">clientes_2026.csv</p>
          </div>
          <AnimatedBar active={active} />
        </div>
      );
    case 1:
      return (
        <div className="flex flex-col items-center gap-3">
          <p className="font-mono text-xs text-graphite">clientes_2026.csv</p>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <FadeIn active={active} delay={100}>
              <span className="font-mono text-xs bg-canvas border border-line rounded-full px-3 py-1">
                Odoo 17
              </span>
            </FadeIn>
            <FadeIn active={active} delay={280}>
              <span className="font-mono text-xs bg-canvas border border-line rounded-full px-3 py-1">
                Argentina
              </span>
            </FadeIn>
            <FadeIn active={active} delay={460}>
              <span className="font-mono text-xs bg-brand text-white rounded-full px-3 py-1">
                Módulo: Contactos
              </span>
            </FadeIn>
          </div>
          <FadeIn active={active} delay={700}>
            <p className="text-xs text-graphite flex items-center gap-1.5">
              <IconCheck className="w-3.5 h-3.5 text-verify shrink-0" />
              6 columnas mapeadas
            </p>
          </FadeIn>
        </div>
      );
    case 2:
      return (
        <div className="flex flex-col items-center gap-3 w-full">
          <IconSearch className="w-5 h-5 text-graphite" />
          <p className="font-mono text-xs text-graphite">Validando 482 filas contra Odoo 17…</p>
          <AnimatedBar active={active} duration={1600} />
        </div>
      );
    case 3:
      return (
        <div className="flex flex-col gap-2 w-full max-w-[280px]">
          <FadeIn active={active} delay={100}>
            <div className="flex items-center justify-between gap-3 bg-alert-light rounded-md px-3 py-2">
              <span className="font-mono text-xs text-alert">Formato inválido · email</span>
              <span className="font-mono text-xs text-alert shrink-0">34 filas</span>
            </div>
          </FadeIn>
          <FadeIn active={active} delay={350}>
            <div className="flex items-center justify-between gap-3 bg-alert-light rounded-md px-3 py-2">
              <span className="font-mono text-xs text-alert">No existe en Odoo · etapa_crm</span>
              <span className="font-mono text-xs text-alert shrink-0">12 filas</span>
            </div>
          </FadeIn>
          <FadeIn active={active} delay={600}>
            <div className="flex items-center justify-between gap-3 bg-alert-light rounded-md px-3 py-2">
              <span className="font-mono text-xs text-alert">Duplicado · CUIT</span>
              <span className="font-mono text-xs text-alert shrink-0">6 filas</span>
            </div>
          </FadeIn>
        </div>
      );
    case 4:
      return (
        <div className="flex flex-col gap-2 w-full max-w-[280px]">
          <FadeIn active={active} delay={100}>
            <div className="flex items-center justify-between gap-3 bg-verify-light rounded-md px-3 py-2">
              <span className="font-mono text-xs text-verify">juan@gmial.com → juan@gmail.com</span>
              <IconCheck className="w-4 h-4 text-verify shrink-0" />
            </div>
          </FadeIn>
          <FadeIn active={active} delay={350}>
            <div className="flex items-center justify-between gap-3 bg-verify-light rounded-md px-3 py-2">
              <span className="font-mono text-xs text-verify">34 filas se corrigen solas</span>
              <IconCheck className="w-4 h-4 text-verify shrink-0" />
            </div>
          </FadeIn>
          <FadeIn active={active} delay={600}>
            <p className="font-mono text-[11px] text-graphite text-center">
              12 quedan para revisión manual
            </p>
          </FadeIn>
        </div>
      );
    case 5:
      return (
        <div className="flex flex-col items-center gap-3">
          <FadeIn active={active} delay={100}>
            <span className="font-mono text-sm font-medium rounded-full px-4 py-1.5 bg-verify-light text-verify">
              Calidad: 94/100
            </span>
          </FadeIn>
          <FadeIn active={active} delay={350}>
            <div className="font-mono text-[11px] text-graphite flex flex-col items-center gap-0.5">
              <span>-4 Formato inválido (34 filas)</span>
              <span>-2 No existe en Odoo (12 filas)</span>
            </div>
          </FadeIn>
        </div>
      );
    case 6:
      return (
        <div className="flex flex-col items-center gap-2.5">
          <div className="w-12 h-12 rounded-lg bg-canvas border border-line flex items-center justify-center">
            <IconDownload className="w-5 h-5 text-brand" />
          </div>
          <p className="font-mono text-xs text-ink">clientes_2026_corregido.zip</p>
          <FadeIn active={active} delay={150}>
            <p className="font-mono text-[11px] text-graphite">+ reporte_tecnico.pdf</p>
          </FadeIn>
          <FadeIn active={active} delay={350}>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-verify">
              <IconCheck className="w-3.5 h-3.5 shrink-0" />
              Listo para importar a Odoo
            </span>
          </FadeIn>
        </div>
      );
    default:
      return null;
  }
}
