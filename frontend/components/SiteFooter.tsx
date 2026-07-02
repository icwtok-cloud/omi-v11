import Link from "next/link";

const COPY = {
  es: {
    cta: "Analizar mis datos gratis →",
    ctaHref: "/app",
    privacy: "Privacidad y datos",
    privacyHref: "/privacidad",
  },
  pt: {
    cta: "Analisar meus dados grátis →",
    ctaHref: "/app",
    privacy: "Privacidade e dados",
    privacyHref: "/privacidad",
  },
};

export function SiteFooter({ locale = "es" }: { locale?: "es" | "pt" }) {
  const t = COPY[locale];
  return (
    <footer className="border-t border-line py-10">
      <div className="max-w-6xl mx-auto px-6 md:px-10 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-graphite">
          <p>© 2026 OMI Engine · un producto de Alterego</p>
          <Link href={t.ctaHref} className="text-brand font-medium hover:underline">
            {t.cta}
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-5 gap-y-2 text-xs text-graphite border-t border-line pt-5">
          <a href="mailto:hello@alterego.lat" className="hover:text-ink transition-colors">
            hello@alterego.lat
          </a>
          <Link href={t.privacyHref} className="hover:text-ink transition-colors">
            {t.privacy}
          </Link>
        </div>
      </div>
    </footer>
  );
}
