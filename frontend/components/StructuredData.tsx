import { SITE_URL } from "@/lib/site";

// Entidad única y consistente: mismo @id de Organization en todo el sitio,
// referenciado (no duplicado) por WebSite y SoftwareApplication. Evita que
// motores generativos fragmenten a OMI en identidades distintas por página.
const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const SOFTWARE_ID = `${SITE_URL}/#software`;

type Faq = { q: string; a: string };

export function StructuredData({ faqs }: { faqs: Faq[] }) {
  const graph = [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "OMI",
      url: SITE_URL,
      description:
        "Validador determinístico de datos para migraciones Odoo. Sin IA, sin resultados que cambian entre corridas.",
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: SITE_URL,
      name: "OMI",
      publisher: { "@id": ORG_ID },
      inLanguage: "es",
    },
    {
      "@type": "SoftwareApplication",
      "@id": SOFTWARE_ID,
      name: "OMI",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Valida archivos CSV y Excel contra las reglas reales de Odoo (versiones 14 a 19) antes de migrar, agrupa los errores encontrados y genera un archivo corregido listo para importar.",
      offers: [
        {
          "@type": "Offer",
          name: "Gratis",
          price: "0",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "Por proyecto",
          price: "99",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "Mensual",
          price: "149",
          priceCurrency: "USD",
        },
      ],
      publisher: { "@id": ORG_ID },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
