import Link from "next/link";

type Locale = "es" | "pt";

const ALL_HUBS: Record<Locale, { href: string; label: string }[]> = {
  es: [
    { href: "/guias", label: "Guías" },
    { href: "/migraciones", label: "Migraciones" },
    { href: "/versiones", label: "Versiones" },
    { href: "/compatibilidad", label: "Compatibilidad" },
    { href: "/datos", label: "Datos" },
    { href: "/casos-frecuentes", label: "Casos frecuentes" },
    { href: "/comparativas", label: "Comparativas" },
    { href: "/empresas", label: "Empresas" },
    { href: "/desarrollo", label: "Desarrollo" },
    { href: "/glosario", label: "Glosario" },
    { href: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
  ],
  pt: [
    { href: "/pt/guias", label: "Guias" },
    { href: "/pt/migraciones", label: "Migrações" },
    { href: "/pt/versiones", label: "Versões" },
    { href: "/pt/compatibilidad", label: "Compatibilidade" },
    { href: "/pt/datos", label: "Dados" },
    { href: "/pt/casos-frecuentes", label: "Casos frequentes" },
    { href: "/pt/comparativas", label: "Comparativos" },
    { href: "/pt/empresas", label: "Empresas" },
    { href: "/pt/desarrollo", label: "Desenvolvimento" },
    { href: "/pt/glosario", label: "Glossário" },
    { href: "/pt/preguntas-frecuentes", label: "Perguntas frequentes" },
  ],
};

const TITLE: Record<Locale, string> = {
  es: "Más sobre migrar a Odoo",
  pt: "Mais sobre migrar para o Odoo",
};

const ARIA: Record<Locale, string> = {
  es: "Más recursos sobre migrar a Odoo",
  pt: "Mais recursos sobre migrar para o Odoo",
};

export function RelatedHubs({ currentHref, locale = "es" }: { currentHref: string; locale?: Locale }) {
  const others = ALL_HUBS[locale].filter((hub) => hub.href !== currentHref);

  return (
    <nav aria-label={ARIA[locale]} className="max-w-3xl mx-auto px-6 md:px-10 pb-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
        {TITLE[locale]}
      </p>
      <div className="flex flex-wrap gap-2">
        {others.map((hub) => (
          <Link
            key={hub.href}
            href={hub.href}
            className="text-sm border border-line rounded-full px-3 py-1.5 hover:border-brand hover:text-brand transition-colors"
          >
            {hub.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
