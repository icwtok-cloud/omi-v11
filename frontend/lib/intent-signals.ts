// Clasificación estática por página -- decidida por el contenido real
// que ya escribimos (no un análisis de texto en vivo, que sería frágil
// e imposible de auditar). "keywordSignal" y "migrationSignal" reflejan
// las reglas +20 / +30 del spec, aplicadas una sola vez según de qué
// habla la página, no recalculadas por palabra en el DOM.
export type StaticIntentSignal = {
  keywordSignal: number; // 0 o 20 -- la página habla de un problema técnico concreto
  migrationSignal: number; // 0 o 30 -- la página habla directamente de migración/error/import
};

export const PAGE_INTENT_SIGNALS: Record<string, StaticIntentSignal> = {
  // Problem-aware / alta señal: hablan de errores concretos o del acto de migrar
  "/datos": { keywordSignal: 20, migrationSignal: 30 },
  "/migraciones": { keywordSignal: 20, migrationSignal: 30 },
  "/casos-frecuentes": { keywordSignal: 20, migrationSignal: 30 },
  "/guias/preparar-datos-para-importar-en-odoo": { keywordSignal: 20, migrationSignal: 30 },
  "/comparativas/excel-vs-omi": { keywordSignal: 20, migrationSignal: 0 },
  // Decisión de negocio: alta intención pero no siempre "técnica"
  "/empresas": { keywordSignal: 0, migrationSignal: 30 },
  // Informativas: conceptos, glosario, compatibilidad general
  "/versiones": { keywordSignal: 0, migrationSignal: 0 },
  "/compatibilidad": { keywordSignal: 0, migrationSignal: 0 },
  "/glosario": { keywordSignal: 0, migrationSignal: 0 },
  "/preguntas-frecuentes": { keywordSignal: 0, migrationSignal: 0 },
  "/guias": { keywordSignal: 0, migrationSignal: 0 },
  "/comparativas": { keywordSignal: 0, migrationSignal: 0 },
  "/desarrollo": { keywordSignal: 0, migrationSignal: 0 },
};

export function getStaticSignal(path: string): StaticIntentSignal {
  return PAGE_INTENT_SIGNALS[path] ?? { keywordSignal: 0, migrationSignal: 0 };
}

export const INTENT_THRESHOLDS = {
  problemAware: 40,
  conversionReady: 70,
} as const;

export type IntentLevel = "informational" | "problem-aware" | "conversion-ready";

export function levelForScore(score: number): IntentLevel {
  if (score >= INTENT_THRESHOLDS.conversionReady) return "conversion-ready";
  if (score >= INTENT_THRESHOLDS.problemAware) return "problem-aware";
  return "informational";
}
