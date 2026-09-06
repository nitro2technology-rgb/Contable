"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, X } from "lucide-react";
import { Button, cx } from "./ui";

/**
 * `ok` es una marca de tiempo, no un booleano: si fuera booleano, guardar por
 * segunda vez en la misma sesion no cambiaria el valor y el modal no volveria a
 * cerrarse.
 */
export type EstadoAccion = { error?: string; ok?: number };

export const ESTADO_INICIAL: EstadoAccion = {};

function Guardar({ etiqueta }: { etiqueta: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variante="primario" disabled={pending}>
      {pending ? "Guardando…" : etiqueta}
    </Button>
  );
}

/**
 * Modal con formulario. El contenido solo se monta cuando esta abierto, para que
 * los campos vuelvan a su valor inicial en cada apertura sin gestionar reset.
 */
export function FormDialog({
  disparador,
  titulo,
  descripcion,
  etiquetaGuardar = "Guardar",
  ancho = "max-w-lg",
  accion,
  estado,
  children,
  abiertoInicial = false,
}: {
  disparador: React.ReactNode;
  titulo: string;
  descripcion?: string;
  etiquetaGuardar?: string;
  ancho?: string;
  accion: (datos: FormData) => void | Promise<void>;
  estado?: EstadoAccion;
  children: React.ReactNode;
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = React.useState(abiertoInicial);

  // Se cierra sola cuando la accion del servidor confirma que guardo.
  React.useEffect(() => {
    if (estado?.ok) setAbierto(false);
  }, [estado?.ok]);

  React.useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", cerrar);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", cerrar);
      document.body.style.overflow = "";
    };
  }, [abierto]);

  return (
    <>
      <span onClick={() => setAbierto(true)}>{disparador}</span>

      {abierto ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <button
            type="button"
            className="fixed inset-0 bg-black/45"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar"
            tabIndex={-1}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            className={cx(
              "relative my-auto w-full rounded-xl border border-edge bg-surface shadow-2xl",
              ancho
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-edge px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
                {descripcion ? (
                  <p className="mt-0.5 text-xs text-ink-muted">{descripcion}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <form action={accion}>
              <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

              <div className="flex items-center justify-end gap-2 border-t border-edge px-5 py-3">
                {estado?.error ? (
                  <p
                    role="alert"
                    className="mr-auto flex items-center gap-1.5 text-sm text-critical"
                  >
                    <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                    {estado.error}
                  </p>
                ) : null}
                <Button type="button" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Guardar etiqueta={etiquetaGuardar} />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Boton de eliminar con confirmacion en linea, sin `confirm()` del navegador. */
export function BotonEliminar({
  accion,
  etiqueta = "Eliminar",
  confirmacion = "¿Seguro?",
}: {
  accion: () => void | Promise<void>;
  etiqueta?: string;
  confirmacion?: string;
}) {
  const [confirmando, setConfirmando] = React.useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-xs font-medium text-ink-muted hover:text-critical"
      >
        {etiqueta}
      </button>
    );
  }

  return (
    <form action={accion} className="flex items-center gap-2">
      <span className="text-xs text-ink-2">{confirmacion}</span>
      <button type="submit" className="text-xs font-medium text-critical hover:underline">
        Sí
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-xs font-medium text-ink-muted hover:text-ink"
      >
        No
      </button>
    </form>
  );
}
