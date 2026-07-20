import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Web3Providers } from "@/components/Web3Providers";
import { WhatsAppFloatingButton } from "@/components/WhatsAppFloatingButton";
import Script from "next/script";
import { SITE_URL } from "@/lib/site";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "OMI — Validador de datos para migraciones Odoo",
    template: "%s | OMI",
  },
  description:
    "Subí tus datos, elegí el módulo y la versión de Odoo, y OMI te muestra exactamente qué corregir antes de migrar. Validación determinística contra las reglas reales de Odoo 14 a 19, sin IA.",
  alternates: {
    canonical: SITE_URL,
    languages: {
      es: SITE_URL,
      pt: `${SITE_URL}/pt`,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_419",
    url: SITE_URL,
    siteName: "OMI",
    title: "OMI — Validador de datos para migraciones Odoo",
    description:
      "Detectá los errores que van a romper tu migración de Odoo antes de importar. Validación determinística, sin IA, de Odoo 14 a 19.",
  },
  twitter: {
    card: "summary_large_image",
    title: "OMI — Validador de datos para migraciones Odoo",
    description:
      "Detectá los errores que van a romper tu migración de Odoo antes de importar. Validación determinística, sin IA, de Odoo 14 a 19.",
  },
  robots: {
    index: true,
    follow: true,
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#2954E5",
          colorBackground: "#FFFFFF",
          colorText: "#0E1116",
          colorTextSecondary: "#5B6270",
          colorInputBackground: "#FFFFFF",
          colorInputText: "#0E1116",
          borderRadius: "0.375rem",
          fontFamily: "Inter, system-ui, sans-serif",
        },
        layout: {
          logoPlacement: "none",
          socialButtonsPlacement: "top",
          socialButtonsVariant: "blockButton",
        },
        elements: {
          card: "shadow-none border border-line rounded-md",
          headerTitle: "font-sans font-extrabold text-ink tracking-tight",
          headerSubtitle: "font-sans text-graphite",
          formFieldLabel: "font-sans text-ink",
          formFieldInput:
            "font-sans border border-line rounded-md focus:border-brand focus:ring-brand",
          formButtonPrimary:
            "font-sans bg-brand hover:bg-brand-dark rounded-md text-sm normal-case shadow-none",
          socialButtonsBlockButton:
            "font-sans border border-line rounded-md hover:bg-canvas",
          socialButtonsBlockButtonText: "font-sans text-ink",
          dividerLine: "bg-line",
          dividerText: "font-sans text-graphite",
          footer: "font-sans",
          footerActionText: "font-sans text-graphite",
          footerActionLink: "font-sans text-brand hover:text-brand-dark",
        },
      }}
    >
      <html lang="es">
        <body className="font-sans bg-canvas text-ink min-h-screen">
          <Web3Providers>{children}</Web3Providers>
          <WhatsAppFloatingButton />
          <Script id="ls-affiliate-config" strategy="afterInteractive">
            {`window.lemonSqueezyAffiliateConfig = { store: "omilat" };`}
          </Script>
          <Script
            src="https://lmsqueezy.com/affiliate.js"
            strategy="afterInteractive"
          />
        </body>
      </html>
    </ClerkProvider>
  );
}