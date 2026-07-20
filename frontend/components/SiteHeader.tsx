import Link from "next/link";

type Locale = "es" | "pt";

const NAV_LINKS: Record<Locale, { href: string; label: string }[]> = {
  es: [
    { href: "/#como-funciona", label: "Cómo funciona" },
    { href: "/#modulos", label: "Módulos" },
    { href: "/#latam", label: "LatAm" },
    { href: "/#precios", label: "Precios" },
    { href: "/guias", label: "Guías" },
    { href: "/datos", label: "Datos" },
    { href: "/versiones", label: "Versiones" },
    { href: "/afiliados", label: "Afiliados" },
    { href: "/preguntas-frecuentes", label: "FAQ" },
  ],
  pt: [
    { href: "/pt#como-funciona", label: "Como funciona" },
    { href: "/pt#modulos", label: "Módulos" },
    { href: "/pt#latam", label: "LatAm" },
    { href: "/pt#precos", label: "Preços" },
    { href: "/pt/guias", label: "Guias" },
    { href: "/pt/datos", label: "Dados" },
    { href: "/pt/versiones", label: "Versões" },
    { href: "/pt/afiliados", label: "Afiliados" },
    { href: "/pt/preguntas-frecuentes", label: "FAQ" },
  ],
};

const COPY: Record<Locale, { home: string; login: string; cta: string; menu: string; toggleLabel: string; toggleHref: string }> = {
  es: {
    home: "/",
    login: "Iniciar sesión",
    cta: "Empezar gratis",
    menu: "Menú",
    toggleLabel: "PT",
    toggleHref: "/pt",
  },
  pt: {
    home: "/pt",
    login: "Entrar",
    cta: "Começar grátis",
    menu: "Menu",
    toggleLabel: "ES",
    toggleHref: "/",
  },
};

export function SiteHeader({ locale = "es" }: { locale?: Locale }) {
  const links = NAV_LINKS[locale];
  const t = COPY[locale];

  return (
    <header className="border-b border-line">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
        <Link href={t.home} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-brand flex items-center justify-center text-white text-xs font-bold">
            OMI
          </div>
          <span className="font-extrabold text-lg tracking-tight">OMI Engine</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-graphite">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink transition-colors">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-4">
          <Link href={t.toggleHref} className="text-sm font-medium text-graphite hover:text-ink transition-colors">
            {t.toggleLabel}
          </Link>
          <Link href="/app" className="text-sm font-medium text-graphite hover:text-ink transition-colors">
            {t.login}
          </Link>
          <Link
            href="/app"
            className="bg-brand text-white text-sm font-semibold rounded-md px-4 py-2 hover:bg-brand-dark transition-colors"
          >
            {t.cta}
          </Link>
        </div>

        {/* Menú móvil: <details>/<summary> nativo -- sin JS, sin "use client"
            adicional en un header que hoy es server component en todos los hubs. */}
        <details className="md:hidden relative">
          <summary
            className="list-none cursor-pointer border border-line rounded-md px-3 py-2 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden"
            aria-label={t.menu}
          >
            {t.menu}
          </summary>
          <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-line rounded-lg shadow-lg py-2 z-50">
            <nav className="flex flex-col text-sm">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-graphite hover:bg-canvas hover:text-ink transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-line mt-2 pt-2 px-4 flex flex-col gap-2">
              <Link href={t.toggleHref} className="text-sm font-medium text-graphite hover:text-ink transition-colors">
                {t.toggleLabel}
              </Link>
              <Link href="/app" className="text-sm font-medium text-graphite hover:text-ink transition-colors">
                {t.login}
              </Link>
              <Link
                href="/app"
                className="bg-brand text-white text-sm font-semibold rounded-md px-4 py-2 text-center hover:bg-brand-dark transition-colors"
              >
                {t.cta}
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
