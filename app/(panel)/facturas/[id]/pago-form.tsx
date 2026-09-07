"use client";

import { useActionState, useState } from "react";
import { Info, Plus } from "lucide-react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ESTADO_INICIAL, FormDialog } from "@/components/dialog";
import { calcularComision } from "@/lib/fiscal";
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

  const pasarela = pasarelas.find((p) => p.id === pasarelaId);
  const comision = pasarela ? calcularComision(monto, pasarela) : null;

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
        <Field
          label="Monto que pagó el cliente (COP)"
          className="sm:col-span-2"
          hint="Lo que abona a la factura, antes de la comisión de la pasarela."
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

        {pasarelas.length > 0 ? (
          <Field
            label="Pasarela de pago"
            className="sm:col-span-2"
            hint="Si el dinero entró por una pasarela, su comisión se descuenta y se registra como gasto."
          >
            <Select
              name="pasarelaId"
              value={pasarelaId}
              onChange={(e) => setPasarelaId(e.target.value)}
            >
              <option value="">Pago directo, sin pasarela</option>
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

        {comision ? (
          <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm sm:col-span-2">
            <div className="flex justify-between gap-3">
              <span className="text-ink-2">Abona a la factura</span>
              <span className="tabular text-ink">{money(monto)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-ink-2">Comisión de {pasarela!.nombre}</span>
              <span className="tabular text-critical">−{money(comision.comision)}</span>
            </div>
            {comision.comisionIva > 0 ? (
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-ink-2">IVA de la comisión</span>
                <span className="tabular text-critical">−{money(comision.comisionIva)}</span>
              </div>
            ) : null}
            <div className="mt-1 flex justify-between gap-3 border-t border-edge pt-1">
              <span className="font-medium text-ink">Llega a la cuenta</span>
              <span className="tabular font-semibold text-ink">{money(comision.neto)}</span>
            </div>
            <p className="mt-2 flex gap-2 text-xs text-ink-muted">
              <Info className="mt-0.5 size-3.5 shrink-0 text-s1" aria-hidden="true" />
              <span>
                La factura se abona por {money(monto)}: el cliente pagó eso. La comisión se
                registra aparte como gasto financiero.
              </span>
            </p>
          </div>
        ) : null}

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
