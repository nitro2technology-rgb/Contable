"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ESTADO_INICIAL, FormDialog } from "@/components/dialog";
import { fechaInput, money } from "@/lib/format";
import { registrarPago } from "../actions";

const METODOS = [
  ["TRANSFERENCIA", "Transferencia bancaria"],
  ["PSE", "PSE"],
  ["NEQUI", "Nequi"],
  ["DAVIPLATA", "Daviplata"],
  ["EFECTIVO", "Efectivo"],
  ["TARJETA", "Tarjeta"],
  ["OTRO", "Otro"],
] as const;

export function DialogoPago({ facturaId, saldo }: { facturaId: string; saldo: number }) {
  const [estado, accion] = useActionState(registrarPago, ESTADO_INICIAL);

  return (
    <FormDialog
      disparador={
        <Button variante="primario">
          <Plus className="size-4" aria-hidden="true" />
          Registrar pago
        </Button>
      }
      titulo="Registrar pago"
      descripcion={`Saldo pendiente: ${money(saldo)}`}
      etiquetaGuardar="Registrar"
      accion={accion}
      estado={estado}
    >
      <input type="hidden" name="facturaId" value={facturaId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Monto recibido (COP)" className="sm:col-span-2">
          <Input
            name="monto"
            inputMode="numeric"
            defaultValue={Math.round(saldo)}
            required
            autoFocus
          />
        </Field>

        <Field label="Fecha del pago">
          <Input type="date" name="fecha" defaultValue={fechaInput(new Date())} required />
        </Field>

        <Field label="Medio de pago">
          <Select name="metodo" defaultValue="TRANSFERENCIA">
            {METODOS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Referencia" className="sm:col-span-2" hint="Número de comprobante o transacción.">
          <Input name="referencia" />
        </Field>

        <Field label="Notas" className="sm:col-span-2">
          <Textarea name="notas" rows={2} />
        </Field>
      </div>
    </FormDialog>
  );
}
