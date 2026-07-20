import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/site";

const PAGE_URL = `${SITE_URL}/pt/afiliados`;
const TITLE = "Programa de afiliados da OMI -- ganhe comissão por cada indicação";
const DESCRIPTION =
  "Participe do programa de afiliados da OMI. Compartilhe seu link, seu indicado paga um projeto, uma assinatura ou o plano anual, e você recebe comissão automática.";

const AFFILIATE_PORTAL_URL = "https://omilat.lemonsqueezy.com/affiliates";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
};

const STEPS = [
  {
    label: "Inscreva-se",
    text: "Você entra no portal de afiliados e se cadastra -- é grátis, sem taxa nem mínimo de vendas.",
  },
  {
    label: "Compartilhe seu link",
    text: "O Lemon Squeezy te dá um link único. Você passa para quem quiser: uma consultoria, um colega, sua própria audiência.",
  },
  {
    label: "Receba",
    text: "Quando alguém entra pelo seu link e paga (por projeto, mensal ou anual), a comissão é calculada e paga sozinha -- você não precisa fazer nenhuma conta.",
  },
];

export default function AfiliadosPagePt() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "OMI", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Afiliados", item: PAGE_URL },
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
        <SiteHeader />

        <section className="border-b border-line bg-ink text-paper">
          <div className="max-w-4xl mx-auto px-6 md:px-10 py-20 text-center">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-paper/70 border border-paper/25 rounded-full px-3 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-verify" />
              Programa de afiliados
            </span>
            <h1 className="font-extrabold text-3xl md:text-5xl tracking-tight mb-5">
              Indique a OMI. Ganhe comissão.
            </h1>
            <p className="text-paper/70 text-lg max-w-xl mx-auto mb-10">
              Se você conhece gente que está migrando para o Odoo -- consultorias,
              implementadores, colegas -- indique e ganhe comissão por cada
              pagamento que fizerem, sem limite de indicações.
            </p>
            <a
              href={AFFILIATE_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-brand text-white font-semibold rounded-md px-8 py-4 text-lg hover:bg-brand-dark transition-colors"
            >
              Participar do programa →
            </a>
            <p className="text-paper/50 text-xs mt-4">
              Leva você ao portal de afiliados (Lemon Squeezy) para se cadastrar.
            </p>
          </div>
        </section>

        <div className="max-w-3xl mx-auto px-6 md:px-10 py-16">
          <nav aria-label="breadcrumb" className="text-sm text-graphite mb-10">
            <Link href="/pt" className="hover:text-ink transition-colors">OMI</Link>
            {" / "}
            <span className="text-ink">Afiliados</span>
          </nav>

          <h2 className="font-extrabold text-2xl tracking-tight mb-8">Como funciona</h2>
          <div className="space-y-8 mb-14">
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex gap-5">
                <div className="shrink-0 w-9 h-9 rounded-full bg-verify-light text-verify font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <div>
                  <p className="font-bold text-lg mb-1">{step.label}</p>
                  <p className="text-graphite leading-relaxed">{step.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-line pt-10">
            <h2 className="font-extrabold text-2xl tracking-tight mb-4">Perguntas frequentes</h2>
            <div className="space-y-6">
              <div>
                <p className="font-bold mb-1">Quanto custa participar?</p>
                <p className="text-graphite leading-relaxed">Nada. Não há taxa nem compromisso de vendas mínimas.</p>
              </div>
              <div>
                <p className="font-bold mb-1">Com quais planos eu ganho comissão?</p>
                <p className="text-graphite leading-relaxed">
                  Com qualquer pagamento que seu indicado fizer através do seu link:
                  por projeto, assinatura mensal ou plano anual.
                </p>
              </div>
              <div>
                <p className="font-bold mb-1">Como e quando eu recebo?</p>
                <p className="text-graphite leading-relaxed">
                  O rastreamento de clicks, indicações e pagamentos é feito pelo
                  próprio portal de afiliados -- lá você vê seu histórico completo e
                  seus recebimentos.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-canvas border border-line rounded-xl p-8 text-center mt-14">
            <p className="font-bold text-lg mb-2">Pronto para começar</p>
            <p className="text-graphite mb-6">
              Leva dois minutos para se cadastrar no portal de afiliados.
            </p>
            <a
              href={AFFILIATE_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-brand text-white font-semibold rounded-md px-6 py-3 hover:bg-brand-dark transition-colors"
            >
              Ir para o portal de afiliados →
            </a>
          </div>
        </div>

        <SiteFooter />
      </main>
    </>
  );
}
