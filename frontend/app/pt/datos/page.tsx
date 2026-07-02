import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/datos`;
const TITLE = "Dados duplicados, sem SKU ou com alto volume: como prepará-los para o Odoo";
const DESCRIPTION =
  "Como detectar duplicados, códigos faltando e arquivos com milhares de linhas antes de importá-los no Odoo -- sem revisar linha por linha manualmente.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const CASES = [
  {
    title: "Tenho códigos ou identificadores duplicados",
    body: "Um mesmo código interno (SKU), CNPJ/CPF, código de barras ou de conta contábil repetido entre linhas costuma passar despercebido no Excel -- até o Odoo rejeitar ou, pior, sobrescrever um registro por outro. A OMI compara a coluna inteira, não linha por linha, e marca cada valor que deveria ser único e não é.",
  },
  {
    title: "Não tenho código interno (SKU) em algumas linhas",
    body: "Se um campo que o Odoo precisa como identificador vem vazio, não se gera um valor aleatório no seu lugar: a linha fica marcada como pendente para você decidir qual código corresponde antes de exportar. A OMI valida, não adivinha dados de negócio.",
  },
  {
    title: "Tenho um arquivo com milhares de linhas",
    body: "Revisar 80.000 produtos linha por linha manualmente não é viável. A OMI agrupa cada tipo de problema (duplicados, formatos, relações que não existem) em uma única visão -- você navega por tipo de erro, não por linha, e o Quality Score te diz de relance o quão pronta está a migração.",
  },
];

export default function DatosPagePT() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Dados", item: PAGE_URL },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <main className="min-h-screen">
        <SiteHeader locale="pt" />
        <div className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-6">
            <Link href="/pt" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Dados</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            Esses três problemas aparecem em quase qualquer migração com dados reais
            -- não são casos raros. Veja como a OMI aborda isso, sem modificar seu arquivo
            original e sem inventar nenhum dado de negócio.
          </p>

          <div className="space-y-8 mb-12">
            {CASES.map((c) => (
              <div key={c.title} className="border-l border-brand pl-5">
                <h2 className="font-bold text-lg mb-1.5">{c.title}</h2>
                <p className="text-graphite leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">Quantos duplicados tem o seu arquivo?</p>
            <p className="text-graphite mb-6">
              Envie e em segundos você tem o detalhe exato, agrupado por tipo de problema.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analisar meus dados grátis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/pt/datos" locale="pt" />
        <SiteFooter locale="pt" />
      </main>
    </>
  );
}
