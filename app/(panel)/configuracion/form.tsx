"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CircleCheck } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { ESTADO_INICIAL } from "@/components/dialog";
import { guardarConfiguracion } from "./actions";

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variante="primario" disabled={pending}>
      {pending ? "Guardando…" : "Guardar cambios"}
    </Button>
  );
}

export type ConfigForm = {
  razonSocial: string;
  nit: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  email: string;
  valorUvt: number;
  periodicidadIva: string;
  tarifaIcaPorMil: number;
  tarifaRenta: number;
};

export function FormularioConfiguracion({
  config,
  sugerencia,
}: {
  config: ConfigForm;
  sugerencia: string;
}) {
  const [estado, accion] = useActionState(guardarConfiguracion, ESTADO_INICIAL);

  return (
    <form action={accion} className="space-y-5">
      <Card>
        <CardHeader titulo="Datos de la empresa" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Razón social" className="sm:col-span-2">
            <Input name="razonSocial" defaultValue={config.razonSocial} required />
          </Field>
          <Field label="NIT">
            <Input name="nit" defaultValue={config.nit} placeholder="901.234.567-8" />
          </Field>
          <Field label="Ciudad">
            <Input name="ciudad" defaultValue={config.ciudad} />
          </Field>
          <Field label="Dirección" className="sm:col-span-2">
            <Input name="direccion" defaultValue={config.direccion} />
          </Field>
          <Field label="Teléfono">
            <Input name="telefono" defaultValue={config.telefono} />
          </Field>
          <Field label="Correo">
            <Input type="email" name="email" defaultValue={config.email} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          titulo="Parámetros tributarios"
          descripcion="Estos valores alimentan el cálculo de retenciones e impuestos en todo el sistema."
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field
            label="Valor de la UVT (COP)"
            hint="La DIAN lo actualiza cada año. Define las bases mínimas de retención."
          >
            <Input name="valorUvt" inputMode="numeric" defaultValue={config.valorUvt} required />
          </Field>

          <Field label="Periodicidad de la declaración de IVA" hint={sugerencia}>
            <Select name="periodicidadIva" defaultValue={config.periodicidadIva}>
              <option value="BIMESTRAL">Bimestral</option>
              <option value="CUATRIMESTRAL">Cuatrimestral</option>
            </Select>
          </Field>

          <Field
            label="Tarifa de ICA propia (por mil)"
            hint="Tarifa del municipio donde tributamos. Bogotá, servicios: 9,66 ‰."
          >
            <Input
              type="number"
              name="tarifaIcaPorMil"
              step="0.01"
              min="0"
              defaultValue={config.tarifaIcaPorMil}
            />
          </Field>

          <Field
            label="Tarifa de renta (%)"
            hint="Tarifa general para personas jurídicas: 35 %."
          >
            <Input
              type="number"
              name="tarifaRenta"
              step="0.01"
              min="0"
              max="100"
              defaultValue={config.tarifaRenta * 100}
            />
          </Field>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {estado.error ? (
          <p role="alert" className="mr-auto flex items-center gap-1.5 text-sm text-critical">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {estado.error}
          </p>
        ) : null}
        {estado.ok ? (
          <p className="mr-auto flex items-center gap-1.5 text-sm text-good-text">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            Cambios guardados.
          </p>
        ) : null}
        <BotonGuardar />
      </div>
    </form>
  );
}
