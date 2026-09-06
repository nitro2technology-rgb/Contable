"use client";

import { PantallaError } from "@/components/pantalla-error";

/**
 * Frontera de la raíz. Es la que atrapa los fallos del layout del panel: una
 * frontera solo captura lo que hay por debajo suyo, nunca el layout de su propio
 * segmento, así que sin este archivo un error en `(panel)/layout.tsx` llegaría
 * sin filtrar hasta el usuario.
 */
export default function ErrorRaiz(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PantallaError {...props} origen="raiz" />;
}
