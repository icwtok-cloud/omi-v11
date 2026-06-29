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
          borderRadius: "0.5rem",
          fontFamily: "Inter, system-ui, sans-serif",
        },
        layout: {
          logoPlacement: "none",
          socialButtonsPlacement: "top",
          socialButtonsVariant: "blockButton",
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
