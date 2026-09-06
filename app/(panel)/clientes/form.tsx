"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ESTADO_INICIAL, FormDialog } from "@/components/dialog";
import { guardarCliente } from "./actions";

export type ClienteForm = {
  id: string;
  nombre: string;
  nit: string;
  tipoPersona: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  contacto: string;
  practicaRetefuente: boolean;
  practicaReteIva: boolean;
  practicaReteIca: boolean;
  tarifaReteIcaPorMil: number;
  notas: string;
  activo: boolean;
};

export function DialogoCliente({
  cliente,
  disparador,
}: {
  cliente?: ClienteForm;
  disparador?: React.ReactNode;
}) {
  const [estado, accion] = useActionState(guardarCliente, ESTADO_INICIAL);
  const c = cliente;

  return (
    <FormDialog
      disparador={
        disparador ?? (
          <Button variante="primario">
            <Plus className="size-4" aria-hidden="true" />
            Nuevo cliente
          </Button>
        )
      }
      titulo={c ? "Editar cliente" : "Nuevo cliente"}
      descripcion="Los datos tributarios determinan las retenciones que se calculan al facturarle."
      accion={accion}
      estado={estado}
      ancho="max-w-2xl"
    >
      {c ? <input type="hidden" name="id" value={c.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre o razón social" className="sm:col-span-2">
          <Input name="nombre" defaultValue={c?.nombre} required autoFocus />
        </Field>

        <Field label="NIT o cédula">
          <Input name="nit" defaultValue={c?.nit} placeholder="900.123.456-7" />
        </Field>

        <Field label="Tipo de persona">
          <Select name="tipoPersona" defaultValue={c?.tipoPersona ?? "JURIDICA"}>
            <option value="JURIDICA">Persona jurídica</option>
            <option value="NATURAL">Persona natural</option>
          </Select>
        </Field>

        <Field label="Persona de contacto">
          <Input name="contacto" defaultValue={c?.contacto} />
        </Field>

        <Field label="Correo">
          <Input type="email" name="email" defaultValue={c?.email} />
        </Field>

        <Field label="Teléfono">
          <Input name="telefono" defaultValue={c?.telefono} />
        </Field>

        <Field label="Ciudad">
          <Input name="ciudad" defaultValue={c?.ciudad} />
        </Field>

        <Field label="Dirección" className="sm:col-span-2">
          <Input name="direccion" defaultValue={c?.direccion} />
        </Field>
      </div>

      <fieldset className="mt-5 rounded-lg border border-edge p-4">
        <legend className="px-1.5 text-xs font-medium text-ink-2">Retenciones que nos practica</legend>
        <div className="space-y-3">
          <Checkbox
            name="practicaRetefuente"
            label="Retención en la fuente (renta)"
            hint="11 % en honorarios y consultoría; 4 % en servicios generales, desde 4 UVT."
            defaultChecked={c?.practicaRetefuente ?? true}
          />
          <Checkbox
            name="practicaReteIva"
            label="Retención de IVA"
            hint="Solo si el cliente es agente de retención de IVA: retiene el 15 % del IVA facturado."
            defaultChecked={c?.practicaReteIva ?? false}
          />
          <Checkbox
            name="practicaReteIca"
            label="Retención de ICA"
            hint="Impuesto municipal de industria y comercio."
            defaultChecked={c?.practicaReteIca ?? false}
          />
          <Field label="Tarifa de ReteICA (por mil)" className="max-w-[180px]">
            <Input
              name="tarifaReteIcaPorMil"
              type="number"
              step="0.01"
              min="0"
              defaultValue={c?.tarifaReteIcaPorMil ?? 9.66}
            />
          </Field>
        </div>
      </fieldset>

      <div className="mt-5 space-y-4">
        <Field label="Notas">
          <Textarea name="notas" defaultValue={c?.notas} rows={2} />
        </Field>
        <Checkbox name="activo" label="Cliente activo" defaultChecked={c?.activo ?? true} />
      </div>
    </FormDialog>
  );
}
