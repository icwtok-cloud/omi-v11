"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStaticSignal, levelForScore } from "@/lib/intent-signals";

// Motor de detección de intención -- 100% client-side, no manda nada a
// ningún backend ni analytics de terceros. El score nunca afecta el
// HTML que ve un crawler (SSR se renderiza igual siempre): esto es
// puramente una capa de comportamiento sobre contenido ya publicado.
//
// Reglas de scoring (ver spec): keyword técnico (+20) y referencia a
// migración/error/import (+30) son estáticas por página -- ya sabemos
// de qué habla cada hub, no hace falta parsear texto en vivo. Scroll
// repetido (+15), tiempo en página >60s (+10) y hover/click en un
// bloque de "problema" (+15) sí son señales dinámicas reales.
const TIME_ON_PAGE_MS = 60_000;
const TIME_SIGNAL = 10;
const SCROLL_REPEAT_SIGNAL = 15;
const PROBLEM_BLOCK_SIGNAL = 15;
const SCROLL_ACTIVE_DEPTH = 0.4;
const SCROLL_HIGH_DEPTH = 0.7;

export function useIntentScore() {
  const pathname = usePathname();
  const staticSignal = getStaticSignal(pathname ?? "");
  const staticScore = staticSignal.keywordSignal + staticSignal.migrationSignal;

  const [dynamicScore, setDynamicScore] = useState(0);
  const [scrollDepth, setScrollDepth] = useState(0);
  const lastDirection = useRef<"up" | "down" | null>(null);
  const reversals = useRef(0);
  const lastScrollY = useRef(0);
  const countedScrollRepeat = useRef(false);
  const countedTime = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!countedTime.current) {
        countedTime.current = true;
        setDynamicScore((s) => s + TIME_SIGNAL);
      }
    }, TIME_ON_PAGE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const depth = max > 0 ? window.scrollY / max : 0;
      setScrollDepth(depth);

      const direction = window.scrollY > lastScrollY.current ? "down" : "up";
      // Cuenta una "vuelta atrás" solo pasado el 40% de la página --
      // scrollear arriba/abajo cerca del tope no es señal de nada.
      if (
        depth > SCROLL_ACTIVE_DEPTH &&
        lastDirection.current &&
        direction !== lastDirection.current
      ) {
        reversals.current += 1;
        if (reversals.current >= 2 && !countedScrollRepeat.current) {
          countedScrollRepeat.current = true;
          setDynamicScore((s) => s + SCROLL_REPEAT_SIGNAL);
        }
      }
      lastDirection.current = direction;
      lastScrollY.current = window.scrollY;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const score = Math.min(100, staticScore + dynamicScore);

  return {
    score,
    level: levelForScore(score),
    scrollDepth,
    registerProblemBlockInteraction: () => {
      setDynamicScore((s) => s + PROBLEM_BLOCK_SIGNAL);
    },
  };
}

export function MicroCTA({ score, scrollDepth }: { score: number; scrollDepth: number }) {
  if (score < 40 || score >= 70) return null;
  return (
    <div className="my-8 flex items-center gap-3 bg-canvas border border-line rounded-lg px-5 py-4">
      <p className="text-sm text-graphite flex-1">
        ¿Querés validar tu archivo antes de importarlo en Odoo?
      </p>
      <Link
        href="/app"
        className="text-sm font-semibold text-brand hover:text-brand-dark whitespace-nowrap"
      >
        Analizar con OMI →
      </Link>
      {/* scrollDepth solo se usa para decidir si se monta este bloque desde el padre */}
      <span className="sr-only">{scrollDepth}</span>
    </div>
  );
}

export function TransitionBlock({ score, scrollDepth }: { score: number; scrollDepth: number }) {
  if (score < 70 && scrollDepth < SCROLL_HIGH_DEPTH) return null;
  return (
    <div className="my-10 bg-brand/5 border border-brand/30 rounded-xl p-6">
      <p className="text-graphite leading-relaxed mb-4">
        Este tipo de problema suele requerir validar los datos antes de
        migrarlos -- no después de que Odoo ya los rechazó.
      </p>
      <Link
        href="/app"
        className="inline-block bg-brand text-white font-semibold rounded-md px-5 py-2.5 hover:bg-brand-dark transition-colors text-sm"
      >
        Analizar mi archivo →
      </Link>
    </div>
  );
}

// Punto único de inserción para las páginas de contenido (server
// components -- por eso esto vive en un componente cliente aparte, no
// en el hook directamente). El nivel "conversion-ready" máximo ya lo
// resuelve la card final que cada hub tiene al pie -- por diseño, acá
// solo se activan los dos niveles progresivos intermedios, nunca algo
// que interrumpa la lectura antes de que el usuario haya mostrado
// señal real de interés.
export function IntentCTASlot() {
  const { score, scrollDepth } = useIntentScore();
  return (
    <>
      <MicroCTA score={score} scrollDepth={scrollDepth} />
      <TransitionBlock score={score} scrollDepth={scrollDepth} />
    </>
  );
}
