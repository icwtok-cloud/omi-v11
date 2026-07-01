"use client";

import { useEffect, useState } from "react";

// Países de ejemplo para el ciclo -- el listado completo de los 15
// soportados se muestra aparte, en la grilla estática debajo. Acá solo
// se afirma lo que el motor realmente hace: leer el addon oficial de
// localización de Odoo de cada país (verificado contra
// rules-generator/scripts/module_map.py). No se afirma validación de
// formato de CUIT/RFC/RUT -- ese chequeo hoy solo corre con el patrón
// argentino sin importar el país (ver backend/app/services/format_rules.py),
// así que decirlo acá sería prometer algo que el producto todavía no hace.
const SAMPLE_COUNTRIES = [
  { flag: "🇦🇷", name: "Argentina", addon: "l10n_ar" },
  { flag: "🇧🇷", name: "Brasil", addon: "l10n_br" },
  { flag: "🇲🇽", name: "México", addon: "l10n_mx" },
  { flag: "🇨🇱", name: "Chile", addon: "l10n_cl" },
  { flag: "🇨🇴", name: "Colombia", addon: "l10n_co" },
  { flag: "🇺🇾", name: "Uruguay", addon: "l10n_uy" },
];

const INTERVAL_MS = 1800;

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
 * Ciclo automático por país, mostrando el addon oficial de Odoo que
 * OMI lee para ese país -- reemplaza el mensaje "solo Argentina" por
 * uno que deje claro que el motor conoce la estructura real de cada
 * localización soportada.
 */
export function LocalizationPulse() {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SAMPLE_COUNTRIES.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const current = SAMPLE_COUNTRIES[index];

  return (
    <div className="inline-flex items-center gap-3 bg-white border border-line rounded-full pl-2 pr-4 py-1.5">
      <span
        key={current.name}
        className="inline-flex items-center gap-2 font-mono text-xs"
        aria-hidden="true"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="font-semibold text-ink">{current.name}</span>
        <span className="text-graphite">· {current.addon}</span>
      </span>
      <span className="sr-only">
        OMI lee el addon oficial de localización de Odoo para cada país
        soportado -- por ejemplo, l10n_ar para Argentina o l10n_mx para México.
      </span>
    </div>
  );
}
