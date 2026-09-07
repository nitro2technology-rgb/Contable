"use client";

import { useActionState, useState } from "react";
import { Info, Plus } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ESTADO_INICIAL, FormDialog } from "@/components/dialog";
import { MESES_POR_PERIODO } from "@/lib/catalogos";
import { ETIQUETAS_IVA } from "@/lib/fiscal";
import { fechaInput, humanizar, money } from "@/lib/format";
import { guardarSuscripcion } from "./actions";

const PERIODICIDADES = [
  "MENSUAL",
  "BIMESTRAL",
  "TRIMESTRAL",
  "CUATRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
] as const;

export type SuscripcionForm = {
  id: string;
  clienteId: string;
  servicioId: string;
  monto: number;
  periodicidad: string;
  diaFacturacion: number;
  diasPlazo: number;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
  notas: string;
};

export type ServicioOpcion = {
  id: string;
  nombre: string;
  precioBase: number;
  tratamientoIva: string;
  esRecurrente: boolean;
};

export function DialogoSuscripcion({
  clientes,
  servicios,
  suscripcion,
  disparador,
}: {
  clientes: { id: string; nombre: string }[];
  servicios: ServicioOpcion[];
  suscripcion?: SuscripcionForm;
  disparador?: React.ReactNode;
}) {
  const [estado, accion] = useActionState(guardarSuscripcion, ESTADO_INICIAL);
  const s = suscripcion;

  const [servicioId, setServicioId] = useState(s?.servicioId ?? "");
  const [monto, setMonto] = useState<number>(s?.monto ?? 0);
  const [periodicidad, setPeriodicidad] = useState<string>(s?.periodicidad ?? "MENSUAL");

  const servicio = servicios.find((x) => x.id === servicioId);
  const divisor = MESES_POR_PERIODO[periodicidad as keyof typeof MESES_POR_PERIODO] ?? 1;
  const equivalenteMensual = Math.round(monto / divisor);

  /** Al elegir el servicio se propone su precio de catálogo, pero se puede cambiar:
   *  cada cliente negocia el suyo. */
  function elegirServicio(id: string) {
    setServicioId(id);
    const elegido = servicios.find((x) => x.id === id);
    if (elegido && monto === 0) setMonto(elegido.precioBase);
  }

  return (
    <FormDialog
      disparador={
        disparador ?? (
          <Button variante="primario">
            <Plus className="size-4" aria-hidden="true" />
            Nueva suscripción
          </Button>
        )
      }
      titulo={s ? "Editar suscripción" : "Nueva suscripción"}
      descripcion="Un servicio que se le cobra al cliente cada periodo. Desde la lista se emite la factura de cada mes."
      accion={accion}
      estado={estado}
      ancho="max-w-2xl"
    >
      {s ? <input type="hidden" name="id" value={s.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente" className="sm:col-span-2">
          <Select name="clienteId" defaultValue={s?.clienteId ?? ""} required autoFocus>
            <option value="">Selecciona el cliente…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Servicio" className="sm:col-span-2">
          <Select
            name="servicioId"
            value={servicioId}
            onChange={(e) => elegirServicio(e.target.value)}
            required
          >
            <option value="">Selecciona el servicio…</option>
            {servicios.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
                {x.esRecurrente ? " (recurrente)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        {servicio ? (
          <div className="sm:col-span-2">
            <p className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-s1" aria-hidden="true" />
              <span>
                Cada factura heredará el tratamiento del servicio:{" "}
                <strong className="font-medium text-ink">
                  {ETIQUETAS_IVA[servicio.tratamientoIva as keyof typeof ETIQUETAS_IVA]}
                </strong>
                . Las retenciones se calculan con el perfil tributario del cliente.
              </span>
            </p>
          </div>
        ) : null}

        <Field label="Valor por periodo, sin IVA (COP)" hint="Puede diferir del precio de catálogo.">
          <Input
            name="monto"
            inputMode="numeric"
            value={monto || ""}
            onChange={(e) => setMonto(Number(e.target.value.replace(/\D/g, "")) || 0)}
            required
          />
        </Field>

        <Field label="Periodicidad">
          <Select
            name="periodicidad"
            value={periodicidad}
            onChange={(e) => setPeriodicidad(e.target.value)}
          >
            {PERIODICIDADES.map((p) => (
              <option key={p} value={p}>
                {humanizar(p)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Día de facturación" hint="Entre 1 y 28, para que exista en todos los meses.">
          <Input
            type="number"
            name="diaFacturacion"
            min="1"
            max="28"
            defaultValue={s?.diaFacturacion ?? 1}
          />
        </Field>

        <Field label="Días de plazo" hint="Desde la emisión hasta el vencimiento.">
          <Input type="number" name="diasPlazo" min="0" defaultValue={s?.diasPlazo ?? 30} />
        </Field>

        <Field label="Desde">
          <Input
            type="date"
            name="fechaInicio"
            defaultValue={s?.fechaInicio ?? fechaInput(new Date())}
            required
          />
        </Field>

        <Field label="Hasta" hint="Opcional: déjalo vacío si no tiene fin previsto.">
          <Input type="date" name="fechaFin" defaultValue={s?.fechaFin} />
        </Field>
      </div>

      <div className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-ink-2">Cobro por periodo</span>
          <span className="tabular text-ink">{money(monto)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3 border-t border-edge pt-1">
          <span className="font-medium text-ink">Ingreso mensual equivalente</span>
          <span className="tabular font-semibold text-ink">{money(equivalenteMensual)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Notas">
          <Textarea name="notas" defaultValue={s?.notas} rows={2} />
        </Field>
        <Checkbox name="activo" label="Suscripción activa" defaultChecked={s?.activo ?? true} />
      </div>
    </FormDialog>
  );
}
