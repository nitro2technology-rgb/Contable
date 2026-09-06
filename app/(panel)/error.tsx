"use client";

import { PantallaError } from "@/components/pantalla-error";

/** Captura los fallos de las páginas del panel. La barra lateral sigue visible. */
export default function ErrorPanel(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PantallaError {...props} origen="panel" />;
}
