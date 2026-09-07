"use client";

import { useActionState, useState } from "react";
import { Info, Plus } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ESTADO_INICIAL, FormDialog } from "@/components/dialog";
import { IVA_COMISION } from "@/lib/fiscal";
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

export type PasarelaOpcion = {
  id: string;
  nombre: string;
  porcentaje: number;
  fijo: number;
  comisionTieneIva: boolean;
};

export function DialogoPago({
  facturaId,
  saldo,
  pasarelas,
}: {
  facturaId: string;
  saldo: number;
  pasarelas: PasarelaOpcion[];
}) {
  const [estado, accion] = useActionState(registrarPago, ESTADO_INICIAL);

  const [monto, setMonto] = useState<number>(Math.round(saldo));
  const [pasarelaId, setPasarelaId] = useState("");
  const [comision, setComision] = useState(0);
  const [conIva, setConIva] = useState(true);

  const comisionIva = conIva ? Math.round(comision * IVA_COMISION) : 0;
  const neto = monto - comision - comisionIva;
  const excede = comision > 0 && comision + comisionIva >= monto;

  /**
   * Elegir la pasarela solo PROPONE la comisión a partir de su tarifa: la
   * liquidación real rara vez coincide al peso con el porcentaje nominal, así
   * que la cifra que se guarda es siempre la que quede escrita en el campo.
   */
  function elegirPasarela(id: string) {
    setPasarelaId(id);
    const p = pasarelas.find((x) => x.id === id);
    if (!p) {
      setComision(0);
      return;
    }
    setComision(Math.round(monto * p.porcentaje + p.fijo));
    setConIva(p.comisionTieneIva);
  }

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
      ancho="max-w-xl"
    >
      <input type="hidden" name="facturaId" value={facturaId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Monto que pagó el cliente (COP)"
          className="sm:col-span-2"
          hint="Lo que abona a la factura, antes de descuentos de la pasarela."
        >
          <Input
            name="monto"
            inputMode="numeric"
            value={monto || ""}
            onChange={(e) => setMonto(Number(e.target.value.replace(/\D/g, "")) || 0)}
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
      </div>

      <fieldset className="mt-5 rounded-lg border border-edge p-4">
        <legend className="px-1.5 text-xs font-medium text-ink-2">
          Comisión descontada (opcional)
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          {pasarelas.length > 0 ? (
            <Field
              label="Pasarela"
              className="sm:col-span-2"
              hint="Solo propone la comisión con su tarifa; el valor que se guarda es el que escribas abajo."
            >
              <Select
                name="pasarelaId"
                value={pasarelaId}
                onChange={(e) => elegirPasarela(e.target.value)}
              >
                <option value="">Sin pasarela</option>
                {pasarelas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — {(p.porcentaje * 100).toFixed(2).replace(".", ",")} %
                    {p.fijo > 0 ? ` + ${money(p.fijo)}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="pasarelaId" value="" />
          )}

          <Field
            label="Comisión (COP)"
            className="sm:col-span-2"
            hint="Lo que realmente descontaron. Déjalo en cero si no hubo comisión."
          >
            <Input
              name="comision"
              inputMode="numeric"
              value={comision || ""}
              onChange={(e) => setComision(Number(e.target.value.replace(/\D/g, "")) || 0)}
              placeholder="0"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Checkbox
            name="comisionTieneIva"
            label={`La comisión está gravada con IVA del ${IVA_COMISION * 100} %`}
            hint="Desmárcalo si viene exenta o excluida. Cuando está gravada, ese IVA es descontable."
            checked={conIva}
            onChange={(e) => setConIva(e.target.checked)}
          />
        </div>

        {comision > 0 ? (
          <div className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-ink-2">Abona a la factura</span>
              <span className="tabular text-ink">{money(monto)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-ink-2">Comisión</span>
              <span className="tabular text-critical">−{money(comision)}</span>
            </div>
            {comisionIva > 0 ? (
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-ink-2">IVA de la comisión</span>
                <span className="tabular text-critical">−{money(comisionIva)}</span>
              </div>
            ) : (
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-ink-2">IVA de la comisión</span>
                <span className="tabular text-ink-muted">exenta</span>
              </div>
            )}
            <div className="mt-1 flex justify-between gap-3 border-t border-edge pt-1">
              <span className="font-medium text-ink">Llega a la cuenta</span>
              <span className={`tabular font-semibold ${excede ? "text-critical" : "text-ink"}`}>
                {money(neto)}
              </span>
            </div>

            <p className="mt-2 flex gap-2 text-xs text-ink-muted">
              <Info className="mt-0.5 size-3.5 shrink-0 text-s1" aria-hidden="true" />
              <span>
                La factura se abona por {money(monto)}: el cliente pagó eso. La comisión se registra
                aparte como gasto financiero.
              </span>
            </p>
          </div>
        ) : null}
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
