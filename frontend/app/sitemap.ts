import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const HUB_PAGES = [
  { path: "/guias", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/guias/preparar-datos-para-importar-en-odoo", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/preguntas-frecuentes", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/versiones", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/datos", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/migraciones", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/casos-frecuentes", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/comparativas", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/comparativas/excel-vs-omi", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/compatibilidad", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/empresas", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/desarrollo", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/glosario", priority: 0.6, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...HUB_PAGES.map((hub) => ({
      url: `${SITE_URL}${hub.path}`,
      lastModified: new Date(),
      changeFrequency: hub.changeFrequency,
      priority: hub.priority,
    })),
  ];
}
