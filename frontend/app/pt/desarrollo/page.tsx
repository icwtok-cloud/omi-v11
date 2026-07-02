import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/desarrollo`;
const TITLE = "Migrar addons, módulos personalizados e código do Odoo: o que a OMI NÃO faz";
const DESCRIPTION =
  "A OMI valida arquivos de dados (CSV/Excel) antes de importá-los no Odoo. Não migra código, XML, views nem módulos personalizados -- aqui explicamos o que ela resolve e o que você precisa para o resto.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

export default function DesarrolloPagePT() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Desenvolvimento", item: PAGE_URL },
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
            <span className="text-ink">Desenvolvimento</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            Se você chegou aqui buscando como atualizar módulos personalizados, migrar XML,
            adaptar o ORM entre versões ou portar views e automações do
            Studio: isso é trabalho de desenvolvimento sobre código, e a OMI não faz isso. É
            justo que você saiba antes de perder tempo, em vez de descobrir
            depois de enviar um arquivo.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">O que a OMI faz</h2>
          <p className="text-graphite leading-relaxed mb-4">
            Valida arquivos CSV ou Excel com dados -- contatos, produtos, pedidos,
            lançamentos contábeis -- contra as regras reais do módulo e da versão do
            Odoo para a qual você vai importá-los. É uma camada de preparação de dados, não
            de migração de código.
          </p>
          <p className="text-graphite leading-relaxed mb-10">
            Se o seu módulo personalizado adiciona campos novos a um modelo existente
            (por exemplo, um campo extra em Contatos), esses campos não fazem parte
            das regras que a OMI conhece hoje -- ela valida contra os campos padrão do
            Odoo para esse módulo e versão.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">O que você precisa para o resto</h2>
          <p className="text-graphite leading-relaxed mb-10">
            A atualização de código entre versões do Odoo (addons, ORM, views,
            segurança, automações) é trabalho de um desenvolvedor Odoo ou do seu
            parceiro de implementação, com as ferramentas de desenvolvimento próprias do
            ecossistema. A OMI entra depois disso: quando você já sabe para quais módulos e
            campos vai importar, e precisa garantir que os dados cheguem
            limpos.
          </p>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">Já tem o módulo pronto e precisa preparar os dados?</p>
            <p className="text-graphite mb-6">
              Aí sim podemos ajudar -- grátis para o primeiro projeto.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analisar meus dados grátis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/pt/desarrollo" locale="pt" />
        <SiteFooter locale="pt" />
      </main>
    </>
  );
}
