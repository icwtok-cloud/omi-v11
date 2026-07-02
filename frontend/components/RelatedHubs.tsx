import Link from "next/link";

const ALL_HUBS = [
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
];

export function RelatedHubs({ currentHref }: { currentHref: string }) {
  const others = ALL_HUBS.filter((hub) => hub.href !== currentHref);

  return (
    <nav aria-label="Más recursos sobre migrar a Odoo" className="max-w-3xl mx-auto px-6 md:px-10 pb-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
        Más sobre migrar a Odoo
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
