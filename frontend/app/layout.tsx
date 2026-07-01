import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Web3Providers } from "@/components/Web3Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "OMI — Preparación de datos para Odoo",
  description:
    "Subí tus datos, elegí el módulo y la versión de Odoo, y OMI te muestra exactamente qué corregir antes de migrar.",
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
          // Mismo radius que Tailwind `rounded-md` (0.375rem), usado en
          // toda la landing -- si no coincide exacto, el modal se ve con
          // esquinas más redondeadas que el resto de la UI.
          borderRadius: "0.375rem",
          fontFamily: "Inter, system-ui, sans-serif",
        },
        layout: {
          logoPlacement: "none",
          socialButtonsPlacement: "top",
          socialButtonsVariant: "blockButton",
        },
        elements: {
          // `variables` solo define tokens; sin overrides de `elements`
          // Clerk sigue usando su propio padding/sombras/tipografía por
          // default en varios sub-componentes, lo que hacía que el modal
          // se sintiera "ajeno" a la landing.
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
        </body>
      </html>
    </ClerkProvider>
  );
}
