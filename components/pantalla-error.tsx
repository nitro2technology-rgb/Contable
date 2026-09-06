"use client";

import { useEffect, useState } from "react";
import { DatabaseZap, RefreshCw } from "lucide-react";
import { Button, Card } from "./ui";

/**
 * Pantalla compartida por las dos fronteras de error.
 *
 * El fallo más frecuente aquí no es un bug sino la base despertando: Neon
 * suspende el cómputo tras unos minutos de inactividad y la primera consulta
 * puede agotar el tiempo de espera. Sin esta pantalla eso se ve como una traza y
 * parece que se rompió todo.
 */
export function PantallaError({
  error,
  reset,
  origen,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  origen: string;
}) {
  const [reintentando, setReintentando] = useState(false);

  useEffect(() => {
    console.error(`[${origen}]`, error);
  }, [error, origen]);

  // En producción Next redacta el mensaje, así que el detalle técnico solo se
  // muestra en desarrollo; en producción queda el digest para poder rastrearlo.
  const detalle = error.message || null;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-warning/15">
          <DatabaseZap className="size-5 text-ink" aria-hidden="true" />
        </div>

        <h1 className="text-lg font-semibold text-ink">No se pudo cargar la información</h1>

        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">
          Lo más probable es que la base de datos estuviera dormida. Neon suspende el servidor
          cuando lleva un rato sin uso y la primera consulta tarda unos segundos en despertarlo.
        </p>

        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">
          <strong className="font-medium text-ink">Tus datos están a salvo.</strong> Vuelve a
          intentarlo; casi siempre funciona al segundo intento.
        </p>

        <div className="mt-6 flex justify-center">
          <Button
            variante="primario"
            onClick={() => {
              setReintentando(true);
              reset();
            }}
            disabled={reintentando}
          >
            <RefreshCw
              className={`size-4 ${reintentando ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {reintentando ? "Reintentando…" : "Reintentar"}
          </Button>
        </div>

        {process.env.NODE_ENV === "development" && detalle ? (
          <pre className="mt-6 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-left text-xs text-ink-2">
            {detalle}
          </pre>
        ) : null}

        {error.digest ? (
          <p className="mt-4 text-xs text-ink-muted">
            Referencia: <code className="tabular">{error.digest}</code>
          </p>
        ) : null}
      </Card>
    </div>
  );
}
