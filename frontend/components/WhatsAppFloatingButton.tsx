"use client";

import { usePathname } from "next/navigation";

// Número sin espacios ni signos, con código de país -- formato que
// requiere el link wa.me (https://wa.me/{numero}).
const WHATSAPP_NUMBER = "5491178222040";

export function WhatsAppFloatingButton() {
  const pathname = usePathname();
  const isPt = pathname?.startsWith("/pt");

  const prefilledMessage = isPt
    ? "Olá! Tenho uma dúvida sobre o OMI."
    : "¡Hola! Tengo una consulta sobre OMI.";

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(prefilledMessage)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg hover:scale-105 transition-transform"
    >
      <svg
        viewBox="0 0 24 24"
        fill="white"
        className="h-7 w-7"
        aria-hidden="true"
      >
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.79 14.12c-.24.68-1.4 1.3-1.93 1.34-.5.04-.94.22-3.15-.66-2.67-1.08-4.4-3.78-4.53-3.95-.13-.17-1.08-1.44-1.08-2.75 0-1.3.68-1.94.92-2.2.24-.26.53-.33.7-.33.18 0 .35 0 .5.01.16.01.38-.06.6.46.23.55.78 1.9.85 2.04.07.14.11.3.02.48-.09.18-.14.29-.27.44-.14.16-.29.35-.41.47-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.2.68-.79.87-1.06.18-.27.36-.22.6-.13.24.09 1.53.72 1.79.85.26.13.44.2.5.31.06.11.06.63-.18 1.31Z" />
      </svg>
    </a>
  );
}
