import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/comparativas`;
const TITLE = "Comparativas para decidir cómo preparar tu migración a Odoo";
const DESCRIPTION =
  "Comparaciones honestas entre herramientas y enfoques para preparar datos antes de importarlos a Odoo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const COMPARISONS = [
  {
    href: "/comparativas/excel-vs-omi",
    title: "Excel vs OMI",
    body: "Qué resuelve cada uno al preparar datos para importar, y por qué no son excluyentes.",
  },
];

export default function ComparativasIndex() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
          Comparativas
        </p>
        <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
        <p className="text-graphite leading-relaxed mb-12 max-w-2xl">{DESCRIPTION}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {COMPARISONS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="block bg-white border border-line rounded-xl p-6 hover:border-brand transition-colors"
            >
              <h2 className="font-bold text-lg mb-2">{c.title}</h2>
              <p className="text-sm text-graphite leading-relaxed">{c.body}</p>
            </Link>
          ))}
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
