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
    <ClerkProvider>
      <html lang="es">
        <body className="font-sans bg-canvas text-ink min-h-screen">
          <Web3Providers>{children}</Web3Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
