"use client";

import { useActionState, useState } from "react";
import { Info, Plus } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ESTADO_INICIAL, FormDialog } from "@/components/dialog";
import { DESCRIPCION_IVA, ETIQUETAS_IVA, RETEFUENTE } from "@/lib/fiscal";
import { humanizar } from "@/lib/format";
import { guardarServicio } from "./actions";

const CATEGORIAS = [
  "DESARROLLO",
  "AUTOMATIZACION",
  "CONSULTORIA_DATOS",
  "CLOUD",
  "LICENCIAMIENTO_SAAS",
  "SOPORTE",
  "CAPACITACION",
  "OTRO",
] as const;

const TRATAMIENTOS = ["GRAVADO_19", "GRAVADO_5", "EXENTO", "EXCLUIDO"] as const;
const CONCEPTOS = ["NINGUNO", "HONORARIOS", "SERVICIOS", "COMPRAS", "ARRENDAMIENTO"] as const;

export type ServicioForm = {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precioBase: number;
  tratamientoIva: string;
  conceptoRetefuente: string;
  activo: boolean;
  notas: string;
};

export function DialogoServicio({
  servicio,
  disparador,
}: {
  servicio?: ServicioForm;
  disparador?: React.ReactNode;
}) {
  const [estado, accion] = useActionState(guardarServicio, ESTADO_INICIAL);
  const s = servicio;

  // El texto explicativo cambia con la selección: el tratamiento del IVA es la
  // decisión con más consecuencias del formulario y conviene justificarla ahí
  // mismo, no en un manual aparte.
  const [tratamiento, setTratamiento] = useState<string>(s?.tratamientoIva ?? "GRAVADO_19");
  const [concepto, setConcepto] = useState<string>(s?.conceptoRetefuente ?? "SERVICIOS");

  return (
    <FormDialog
      disparador={
        disparador ?? (
          <Button variante="primario">
            <Plus className="size-4" aria-hidden="true" />
            Nuevo servicio
          </Button>
        )
      }
      titulo={s ? "Editar servicio" : "Nuevo servicio"}
      descripcion="Define el tratamiento tributario una vez; cada factura lo hereda."
      accion={accion}
      estado={estado}
      ancho="max-w-2xl"
    >
      {s ? <input type="hidden" name="id" value={s.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del servicio" className="sm:col-span-2">
          <Input
            name="nombre"
            defaultValue={s?.nombre}
            required
            autoFocus
            placeholder="Desarrollo de integración a la medida"
          />
        </Field>

        <Field label="Categoría">
          <Select name="categoria" defaultValue={s?.categoria ?? "DESARROLLO"}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {humanizar(c)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Precio base (COP)" hint="Se puede ajustar en cada factura.">
          <Input name="precioBase" inputMode="numeric" defaultValue={s?.precioBase ?? ""} placeholder="3.500.000" />
        </Field>
      </div>

      <fieldset className="mt-5 rounded-lg border border-edge p-4">
        <legend className="px-1.5 text-xs font-medium text-ink-2">Tratamiento tributario</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="IVA">
            <Select
              name="tratamientoIva"
              value={tratamiento}
              onChange={(e) => setTratamiento(e.target.value)}
            >
              {TRATAMIENTOS.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETAS_IVA[t]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Retención en la fuente">
            <Select
              name="conceptoRetefuente"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
            >
              {CONCEPTOS.map((c) => (
                <option key={c} value={c}>
                  {RETEFUENTE[c].etiqueta}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-3 space-y-2">
          <p className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-s1" aria-hidden="true" />
            <span>{DESCRIPCION_IVA[tratamiento as keyof typeof DESCRIPCION_IVA]}</span>
          </p>
          <p className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-s1" aria-hidden="true" />
            <span>{RETEFUENTE[concepto as keyof typeof RETEFUENTE].nota}</span>
          </p>
        </div>
      </fieldset>

      <div className="mt-5 space-y-4">
        <Field label="Descripción">
          <Textarea name="descripcion" defaultValue={s?.descripcion} rows={2} />
        </Field>
        <Field label="Notas internas">
          <Textarea name="notas" defaultValue={s?.notas} rows={2} />
        </Field>
        <Checkbox name="activo" label="Servicio activo" defaultChecked={s?.activo ?? true} />
      </div>
    </FormDialog>
  );
}
