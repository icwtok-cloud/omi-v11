"use client";

import { useEffect, useState } from "react";

type Locale = "es" | "pt";

const STEPS_BY_LOCALE: Record<Locale, { key: string; label: string }[]> = {
  es: [
    { key: "upload", label: "Subir archivo" },
    { key: "detect", label: "Confirmar módulo" },
    { key: "validate", label: "Validar" },
    { key: "group", label: "Agrupar problemas" },
    { key: "fix", label: "Corregir" },
    { key: "score", label: "Quality Score" },
    { key: "export", label: "Exportar" },
  ],
  pt: [
    { key: "upload", label: "Enviar arquivo" },
    { key: "detect", label: "Confirmar módulo" },
    { key: "validate", label: "Validar" },
    { key: "group", label: "Agrupar problemas" },
    { key: "fix", label: "Corrigir" },
    { key: "score", label: "Quality Score" },
    { key: "export", label: "Exportar" },
  ],
};

const UI_COPY: Record<Locale, { pause: string; resume: string; srDescription: string }> = {
  es: {
    pause: "❚❚ Pausar",
    resume: "▶ Reanudar",
    srDescription:
      "Demostración animada del flujo de OMI: subir un archivo, confirmar el módulo y la " +
      "versión de Odoo elegidos, validar cada fila, agrupar los problemas encontrados, aplicar las " +
      "correcciones automáticas, calcular el Quality Score, y exportar el archivo corregido " +
      "listo para importar a Odoo.",
  },
  pt: {
    pause: "❚❚ Pausar",
    resume: "▶ Retomar",
    srDescription:
      "Demonstração animada do fluxo da OMI: enviar um arquivo, confirmar o módulo e a " +
      "versão do Odoo escolhidos, validar cada linha, agrupar os problemas encontrados, aplicar as " +
      "correções automáticas, calcular o Quality Score, e exportar o arquivo corrigido " +
      "pronto para importar no Odoo.",
  },
};

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
 * Demo autoplay del flujo real de OMI (subir → confirmar módulo → validar → agrupar
 * → corregir → quality score → exportar). Arranca pausado si el usuario
 * prefiere menos movimiento (prefers-reduced-motion) y siempre expone un
 * botón de play/pausa -- contenido que se autoactualiza en loop necesita un
 * mecanismo para pararlo (WCAG 2.2.2).
 */
export function ProductDemo({ locale = "es" }: { locale?: Locale }) {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const STEPS = STEPS_BY_LOCALE[locale];
  const ui = UI_COPY[locale];

  useEffect(() => {
    if (reducedMotion) setPlaying(false);
  }, [reducedMotion]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, STEP_DURATION_MS);
    return () => clearInterval(id);
  }, [playing, STEPS.length]);

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
          aria-label={playing ? ui.pause : ui.resume}
        >
          {playing ? ui.pause : ui.resume}
        </button>
      </div>

      <div className="relative h-[240px] sm:h-[220px]" aria-hidden="true">
        {STEPS.map((s, i) => (
          <DemoFrame key={s.key} active={step === i}>
            {renderStepContent(i, step === i, locale)}
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

      <span className="sr-only">{ui.srDescription}</span>
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

function renderStepContent(index: number, active: boolean, locale: Locale) {
  const pt = locale === "pt";
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
          <p className="text-[11px] text-graphite">
            {pt ? "Você escolheu isto antes de enviar:" : "Elegiste esto antes de subir:"}
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <FadeIn active={active} delay={100}>
              <span className="font-mono text-xs bg-canvas border border-line rounded-full px-3 py-1">
                Odoo 17
              </span>
            </FadeIn>
            <FadeIn active={active} delay={280}>
              <span className="font-mono text-xs bg-canvas border border-line rounded-full px-3 py-1">
                {pt ? "Brasil" : "Argentina"}
              </span>
            </FadeIn>
            <FadeIn active={active} delay={460}>
              <span className="font-mono text-xs bg-brand text-white rounded-full px-3 py-1">
                {pt ? "Módulo: Contatos" : "Módulo: Contactos"}
              </span>
            </FadeIn>
          </div>
          <FadeIn active={active} delay={700}>
            <p className="text-xs text-graphite flex items-center gap-1.5">
              <IconCheck className="w-3.5 h-3.5 text-verify shrink-0" />
              {pt ? "6 colunas mapeadas" : "6 columnas mapeadas"}
            </p>
          </FadeIn>
        </div>
      );
    case 2:
      return (
        <div className="flex flex-col items-center gap-3 w-full">
          <IconSearch className="w-5 h-5 text-graphite" />
          <p className="font-mono text-xs text-graphite">
            {pt ? "Validando 482 linhas contra Odoo 17…" : "Validando 482 filas contra Odoo 17…"}
          </p>
          <AnimatedBar active={active} duration={1600} />
        </div>
      );
    case 3:
      return (
        <div className="flex flex-col gap-2 w-full max-w-[280px]">
          <FadeIn active={active} delay={100}>
            <div className="flex items-center justify-between gap-3 bg-alert-light rounded-md px-3 py-2">
              <span className="font-mono text-xs text-alert">
                {pt ? "Formato inválido · email" : "Formato inválido · email"}
              </span>
              <span className="font-mono text-xs text-alert shrink-0">
                {pt ? "34 linhas" : "34 filas"}
              </span>
            </div>
          </FadeIn>
          <FadeIn active={active} delay={350}>
            <div className="flex items-center justify-between gap-3 bg-alert-light rounded-md px-3 py-2">
              <span className="font-mono text-xs text-alert">
                {pt ? "Não existe no Odoo · etapa_crm" : "No existe en Odoo · etapa_crm"}
              </span>
              <span className="font-mono text-xs text-alert shrink-0">
                {pt ? "12 linhas" : "12 filas"}
              </span>
            </div>
          </FadeIn>
          <FadeIn active={active} delay={600}>
            <div className="flex items-center justify-between gap-3 bg-alert-light rounded-md px-3 py-2">
              <span className="font-mono text-xs text-alert">
                {pt ? "Duplicado · CNPJ" : "Duplicado · CUIT"}
              </span>
              <span className="font-mono text-xs text-alert shrink-0">
                {pt ? "6 linhas" : "6 filas"}
              </span>
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
              <span className="font-mono text-xs text-verify">
                {pt ? "34 linhas se corrigem ao exportar" : "34 filas se corrigen al exportar"}
              </span>
              <IconCheck className="w-4 h-4 text-verify shrink-0" />
            </div>
          </FadeIn>
          <FadeIn active={active} delay={600}>
            <p className="font-mono text-[11px] text-graphite text-center">
              {pt ? "12 ficam para revisar antes de exportar" : "12 quedan para revisar antes de exportar"}
            </p>
          </FadeIn>
        </div>
      );
    case 5:
      return (
        <div className="flex flex-col items-center gap-3">
          <FadeIn active={active} delay={100}>
            <span className="font-mono text-sm font-medium rounded-full px-4 py-1.5 bg-verify-light text-verify">
              {pt ? "Qualidade: 94/100" : "Calidad: 94/100"}
            </span>
          </FadeIn>
          <FadeIn active={active} delay={350}>
            <div className="font-mono text-[11px] text-graphite flex flex-col items-center gap-0.5">
              <span>{pt ? "-4 Formato inválido (34 linhas)" : "-4 Formato inválido (34 filas)"}</span>
              <span>{pt ? "-2 Não existe no Odoo (12 linhas)" : "-2 No existe en Odoo (12 filas)"}</span>
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
          <p className="font-mono text-xs text-ink">
            {pt ? "clientes_2026_corrigido.zip" : "clientes_2026_corregido.zip"}
          </p>
          <FadeIn active={active} delay={150}>
            <p className="font-mono text-[11px] text-graphite">
              {pt ? "+ relatorio_tecnico.pdf" : "+ reporte_tecnico.pdf"}
            </p>
          </FadeIn>
          <FadeIn active={active} delay={350}>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-verify">
              <IconCheck className="w-3.5 h-3.5 shrink-0" />
              {pt ? "Pronto para importar no Odoo" : "Listo para importar a Odoo"}
            </span>
          </FadeIn>
        </div>
      );
    default:
      return null;
  }
}
