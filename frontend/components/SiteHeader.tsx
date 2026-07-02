import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-brand flex items-center justify-center text-white text-xs font-bold">
            OMI
          </div>
          <span className="font-extrabold text-lg tracking-tight">OMI Engine</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-graphite">
          <Link href="/#como-funciona" className="hover:text-ink transition-colors">Cómo funciona</Link>
          <Link href="/#modulos" className="hover:text-ink transition-colors">Módulos</Link>
          <Link href="/#latam" className="hover:text-ink transition-colors">LatAm</Link>
          <Link href="/#precios" className="hover:text-ink transition-colors">Precios</Link>
          <Link href="/guias" className="hover:text-ink transition-colors">Guías</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/app" className="text-sm font-medium text-graphite hover:text-ink transition-colors">
            Iniciar sesión
          </Link>
          <Link
            href="/app"
            className="bg-brand text-white text-sm font-semibold rounded-md px-4 py-2 hover:bg-brand-dark transition-colors"
          >
            Empezar gratis
          </Link>
        </div>
      </div>
    </header>
  );
}
