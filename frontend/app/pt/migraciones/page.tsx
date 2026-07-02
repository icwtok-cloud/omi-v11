import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/migraciones`;
const TITLE = "Em que ordem migrar os dados para o Odoo (e por que isso importa)";
const DESCRIPTION =
  "A ordem em que você importa os módulos para o Odoo afeta se as relações entre registros ficam bem montadas. O que depende do quê, e como evitar importar na ordem errada.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const ORDER_GROUPS = [
  {
    step: "1",
    modules: "Contatos, Produtos",
    body: "Não dependem de nenhum outro módulo -- vão primeiro. Tudo o mais os referencia.",
  },
  {
    step: "2",
    modules: "CRM",
    body: "Depende de Contatos: cada oportunidade precisa de um contato já existente para se associar.",
  },
  {
    step: "3",
    modules: "Estoque",
    body: "Depende de Produtos: não é possível ter estoque de um produto que ainda não existe no sistema.",
  },
  {
    step: "4",
    modules: "Vendas, Compras",
    body: "Dependem de Contatos e Produtos: um pedido precisa dos dois já carregados para fazer sentido.",
  },
];

export default function MigracionesPagePT() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Migrações", item: PAGE_URL },
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
            <span className="text-ink">Migrações</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            Importar "vendas" antes de "contatos" faz o Odoo rejeitar o pedido, ou
            aceitá-lo sem o contato associado -- uma relação vazia que depois ninguém
            percebe até alguém procurar esse cliente e ele não aparecer. A ordem de
            importação entre módulos relacionados não é arbitrária.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Ordem recomendada entre os módulos que dependem entre si</h2>
          <div className="space-y-6 mb-12">
            {ORDER_GROUPS.map((g) => (
              <div key={g.step} className="flex gap-5">
                <div className="w-10 h-10 rounded-full bg-brand text-white font-bold flex items-center justify-center shrink-0">
                  {g.step}
                </div>
                <div>
                  <h3 className="font-bold mb-1">{g.modules}</h3>
                  <p className="text-graphite leading-relaxed">{g.body}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-graphite leading-relaxed mb-10">
            Faturamento, Contabilidade e outros módulos com localização por país
            (l10n) têm suas próprias regras de campos obrigatórios, mas não
            dependências de ordem documentadas em relação a esses quatro grupos --
            vale a pena validá-los da mesma forma antes de importar, mas a ordem relativa
            entre eles é menos crítica.
          </p>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">A OMI monta essa ordem por você</p>
            <p className="text-graphite mb-6">
              Quando você exporta um projeto com vários módulos, o ZIP vem numerado
              conforme a ordem de importação recomendada -- não é preciso montar na mão.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analisar meus dados grátis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/pt/migraciones" locale="pt" />
        <SiteFooter locale="pt" />
      </main>
    </>
  );
}
