import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/comparativas`;
const TITLE = "Comparativos para decidir como preparar sua migração para o Odoo";
const DESCRIPTION =
  "Comparações honestas entre ferramentas e abordagens para preparar dados antes de importá-los no Odoo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const COMPARISONS = [
  {
    href: "/pt/comparativas/excel-vs-omi",
    title: "Excel vs OMI",
    body: "O que cada um resolve ao preparar dados para importar, e por que não são excludentes.",
  },
];

export default function ComparativasIndexPT() {
  return (
    <main className="min-h-screen">
      <SiteHeader locale="pt" />
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-graphite mb-3">
          Comparativos
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
      <RelatedHubs currentHref="/pt/comparativas" locale="pt" />
      <SiteFooter locale="pt" />
    </main>
  );
}
