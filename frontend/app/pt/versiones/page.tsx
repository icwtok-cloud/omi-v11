import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RelatedHubs } from "@/components/RelatedHubs";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/versiones`;
const TITLE = "Qual versão do Odoo você tem e o que implica migrá-la";
const DESCRIPTION =
  "A OMI valida dados para Odoo 14 a 19, incluindo versões sem suporte oficial. O que significa uma versão estar fora de suporte e o que muda para sua migração.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const VERSIONS = [
  { v: "14.0", note: "Sem suporte oficial do Odoo -- a migração de dados tem mais urgência que a de versões ativas." },
  { v: "15.0", note: "Sem suporte oficial do Odoo -- mesma urgência que a 14.0." },
  { v: "16.0", note: "Suportada pela OMI." },
  { v: "17.0", note: "Suportada pela OMI." },
  { v: "18.0", note: "Suportada pela OMI." },
  { v: "19.0", note: "Suportada pela OMI." },
];

export default function VersionesPagePT() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Versões", item: PAGE_URL },
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
            <span className="text-ink">Versões</span>
          </nav>

          <h1 className="font-extrabold text-3xl md:text-4xl tracking-tight mb-4">{TITLE}</h1>
          <p className="text-lg text-graphite leading-relaxed mb-10">
            O Odoo oferece suporte oficial (patches de segurança e correções) apenas
            durante um período limitado após o lançamento de cada versão. Passado esse
            período, a versão continua funcionando -- mas qualquer problema novo que
            aparecer não é mais corrigido oficialmente. Isso não muda como se prepara
            um arquivo para importar, mas muda a urgência de migrar.
          </p>

          <h2 className="font-bold text-2xl tracking-tight mb-5">Versões que a OMI valida</h2>
          <div className="border border-line rounded-xl overflow-hidden mb-10">
            {VERSIONS.map((item, i) => (
              <div
                key={item.v}
                className={`flex items-center gap-4 px-6 py-4 ${i !== VERSIONS.length - 1 ? "border-b border-line" : ""}`}
              >
                <span className="font-mono font-bold text-lg w-16 shrink-0">{item.v}</span>
                <span className="text-sm text-graphite">{item.note}</span>
              </div>
            ))}
          </div>

          <h2 className="font-bold text-2xl tracking-tight mb-5">A versão importa para preparar os dados?</h2>
          <p className="text-graphite leading-relaxed mb-4">
            Sim, diretamente. Os campos obrigatórios, os modelos disponíveis e as
            regras de cada módulo mudam entre versões do Odoo. A OMI gera as
            regras de validação lendo o código-fonte real da versão que você
            escolhe -- não aplica um checklist genérico para todas.
          </p>
          <p className="text-graphite leading-relaxed mb-10">
            Se você não tem certeza de qual versão está usando, é possível ver em Ajustes {">"} Informações
            técnicas dentro da sua instância do Odoo (com o modo desenvolvedor ativado),
            ou perguntando a quem administra.
          </p>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center">
            <p className="font-bold text-lg mb-2">Valide seus dados contra sua versão real</p>
            <p className="text-graphite mb-6">
              Você escolhe a versão e o módulo, envia o arquivo, e a OMI valida contra as
              regras exatas dessa combinação.
            </p>
            <Link
              href="/app"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Analisar meus dados grátis →
            </Link>
          </div>
        </div>
        <RelatedHubs currentHref="/pt/versiones" locale="pt" />
        <SiteFooter locale="pt" />
      </main>
    </>
  );
}
