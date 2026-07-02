import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line py-10">
      <div className="max-w-6xl mx-auto px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-graphite">
        <p>© 2026 OMI Engine</p>
        <Link href="/app" className="text-brand font-medium hover:underline">
          Analizar mis datos gratis →
        </Link>
      </div>
    </footer>
  );
}
