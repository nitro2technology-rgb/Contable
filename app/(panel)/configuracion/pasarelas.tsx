"use client";

import { useActionState, useState } from "react";
import { CreditCard, Info, Plus } from "lucide-react";
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Input, Textarea } from "@/components/ui";
import { BotonEliminar, ESTADO_INICIAL, FormDialog } from "@/components/dialog";
import { calcularComision, IVA_COMISION } from "@/lib/fiscal";
import { money, pct } from "@/lib/format";
import { eliminarPasarela, guardarPasarela } from "./pasarelas-actions";

export type PasarelaForm = {
  id: string;
  nombre: string;
  porcentaje: number;
  fijo: number;
  comisionTieneIva: boolean;
  activo: boolean;
  notas: string;
  pagos: number;
};

/** Monto de referencia para enseñar cuánto cuesta cobrar por esta vía. */
const EJEMPLO = 1_000_000;

function DialogoPasarela({
  pasarela,
  disparador,
}: {
  pasarela?: PasarelaForm;
  disparador?: React.ReactNode;
}) {
  const [estado, accion] = useActionState(guardarPasarela, ESTADO_INICIAL);
  const p = pasarela;

  const [porcentaje, setPorcentaje] = useState<number>((p?.porcentaje ?? 0) * 100);
  const [fijo, setFijo] = useState<number>(p?.fijo ?? 0);
  const [conIva, setConIva] = useState<boolean>(p?.comisionTieneIva ?? true);

  const ejemplo = calcularComision(EJEMPLO, {
    porcentaje: porcentaje / 100,
    fijo,
    comisionTieneIva: conIva,
  });

  return (
    <FormDialog
      disparador={
        disparador ?? (
          <Button>
            <Plus className="size-4" aria-hidden="true" />
            Nueva pasarela
          </Button>
        )
      }
      titulo={p ? "Editar pasarela" : "Nueva pasarela de pago"}
      descripcion="Su tarifa propone la comisión al registrar un pago; la cifra final siempre la escribes tú."
      accion={accion}
      estado={estado}
    >
      {p ? <input type="hidden" name="id" value={p.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2">
          <Input
            name="nombre"
            defaultValue={p?.nombre}
            required
            autoFocus
            placeholder="Wompi, PayU, Mercado Pago, Stripe…"
          />
        </Field>

        <Field label="Comisión (%)" hint="Lo que se queda por cada transacción.">
          <Input
            name="porcentaje"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={porcentaje || ""}
            onChange={(e) => setPorcentaje(Number(e.target.value) || 0)}
            placeholder="2.99"
          />
        </Field>

        <Field label="Cargo fijo (COP)" hint="Por transacción, si lo hay.">
          <Input
            name="fijo"
            inputMode="numeric"
            value={fijo || ""}
            onChange={(e) => setFijo(Number(e.target.value.replace(/\D/g, "")) || 0)}
            placeholder="900"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Checkbox
          name="comisionTieneIva"
          label={`La comisión lleva IVA del ${IVA_COMISION * 100} %`}
          hint="Lo habitual en Colombia. Ese IVA es descontable, como el de cualquier otro costo."
          checked={conIva}
          onChange={(e) => setConIva(e.target.checked)}
        />
      </div>

      <div className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-sm">
        <p className="mb-2 text-xs font-medium text-ink-2">
          Comisión que se propondrá para un cobro de {money(EJEMPLO)}:
        </p>
        <div className="flex justify-between gap-3">
          <span className="text-ink-2">Comisión</span>
          <span className="tabular text-critical">−{money(ejemplo.comision)}</span>
        </div>
        {ejemplo.comisionIva > 0 ? (
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-ink-2">IVA de la comisión</span>
            <span className="tabular text-critical">−{money(ejemplo.comisionIva)}</span>
          </div>
        ) : null}
        <div className="mt-1 flex justify-between gap-3 border-t border-edge pt-1">
          <span className="font-medium text-ink">Llega a la cuenta</span>
          <span className="tabular font-semibold text-ink">{money(ejemplo.neto)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Notas">
          <Textarea name="notas" defaultValue={p?.notas} rows={2} />
        </Field>
        <Checkbox name="activo" label="Pasarela activa" defaultChecked={p?.activo ?? true} />
      </div>
    </FormDialog>
  );
}

export function Pasarelas({ pasarelas }: { pasarelas: PasarelaForm[] }) {
  return (
    <Card>
      <CardHeader
        titulo="Pasarelas de pago"
        descripcion="Su tarifa propone la comisión al cobrar; el valor definitivo se escribe en cada pago"
        accion={<DialogoPasarela />}
      />

      {pasarelas.length === 0 ? (
        <EmptyState
          titulo="Sin pasarelas configuradas"
          descripcion="Registra Wompi, PayU o la que uses con su tarifa. Al cobrar, el formulario propondrá esa comisión y podrás ajustarla a lo que realmente descontaron."
        >
          <DialogoPasarela />
        </EmptyState>
      ) : (
        <ul className="divide-y divide-edge">
          {pasarelas.map((p) => {
            const ejemplo = calcularComision(EJEMPLO, {
              porcentaje: p.porcentaje,
              fijo: p.fijo,
              comisionTieneIva: p.comisionTieneIva,
            });

            return (
              <li key={p.id} className={`px-5 py-4 ${p.activo ? "" : "opacity-55"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      <CreditCard className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      {p.nombre}
                      {!p.activo ? <Badge tono="neutro">Inactiva</Badge> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {pct(p.porcentaje, 2)}
                      {p.fijo > 0 ? ` + ${money(p.fijo)} por transacción` : ""}
                      {p.comisionTieneIva ? " · con IVA" : " · sin IVA"}
                      {p.pagos > 0 ? ` · ${p.pagos} pago${p.pagos === 1 ? "" : "s"}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-ink-2">
                      De {money(EJEMPLO)} llegan{" "}
                      <strong className="tabular font-medium text-ink">{money(ejemplo.neto)}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <DialogoPasarela
                      pasarela={p}
                      disparador={
                        <button
                          type="button"
                          className="text-xs font-medium text-ink-2 hover:text-s1"
                        >
                          Editar
                        </button>
                      }
                    />
                    <BotonEliminar
                      accion={eliminarPasarela.bind(null, p.id)}
                      etiqueta={p.pagos > 0 ? "Desactivar" : "Eliminar"}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-edge p-5">
        <p className="flex gap-2 text-xs text-ink-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-s1" aria-hidden="true" />
          <span>
            La comisión no reduce lo que el cliente abona a su factura: él pagó el total. Reduce lo
            que llega a la cuenta, y esa diferencia es un gasto financiero. Al registrar cada pago
            escribes el valor exacto que descontaron y si venía gravado con IVA o exento — la
            liquidación real rara vez coincide al peso con la tarifa nominal.
          </span>
        </p>
      </div>
    </Card>
  );
}
