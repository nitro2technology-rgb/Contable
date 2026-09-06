import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nitro2Tech · Contabilidad",
    template: "%s · Nitro2Tech",
  },
  description: "Software contable interno de Nitro2Tech S.A.S.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

/**
 * Aplica el tema guardado antes de la primera pintura. Sin esto, un usuario con
 * tema oscuro elegido a mano ve un destello claro en cada navegacion.
 */
const TEMA_INICIAL = `
try {
  var t = localStorage.getItem('n2t-tema');
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
