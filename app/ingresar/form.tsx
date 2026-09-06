"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { ingresar, type EstadoIngreso } from "./actions";

function BotonEnviar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variante="primario" className="w-full" disabled={pending}>
      {pending ? "Verificando…" : "Entrar"}
    </Button>
  );
}

export function FormularioIngreso({ volver }: { volver: string }) {
  const [estado, accion] = useActionState<EstadoIngreso, FormData>(ingresar, {});

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="volver" value={volver} />

      <Field label="Contraseña">
        <Input
          type="password"
          name="clave"
          autoComplete="current-password"
          autoFocus
          required
          placeholder="••••••••"
        />
      </Field>

      {estado.error ? (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-sm text-critical"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {estado.error}
        </p>
      ) : null}

      <BotonEnviar />
    </form>
  );
}
