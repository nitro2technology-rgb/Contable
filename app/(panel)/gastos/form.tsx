"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ESTADO_INICIAL, FormDialog } from "@/components/dialog";
import { fechaInput, humanizar, money } from "@/lib/format";
import { CATEGORIAS_GASTO } from "@/lib/catalogos";
import { guardarGasto } from "./actions";

const TASAS = [
  ["0", "Sin IVA"],
  ["0.19", "19 %"],
  ["0.05", "5 %"],
] as const;

const METODOS = [
  ["TRANSFERENCIA", "Transferencia"],
  ["TARJETA", "Tarjeta"],
  ["PSE", "PSE"],
  ["NEQUI", "Nequi"],
  ["DAVIPLATA", "Daviplata"],
  ["EFECTIVO", "Efectivo"],
  ["OTRO", "Otro"],
] as const;

export type GastoForm = {
  id: string;
  fecha: string;
  concepto: string;
  proveedor: string;
  categoria: string;
  base: number;
  tasaIva: number;
  ivaDescontable: boolean;
  deducible: boolean;
  metodoPago: string;
  notas: string;
};

export function DialogoGasto({
  gasto,
  disparador,
}: {
  gasto?: GastoForm;
  disparador?: React.ReactNode;
}) {
  const [estado, accion] = useActionState(guardarGasto, ESTADO_INICIAL);
  const g = gasto;

  const [base, setBase] = useState<number>(g?.base ?? 0);
  const [tasa, setTasa] = useState<string>(String(g?.tasaIva ?? 0));

  const iva = Math.round(base * Number(tasa));

  return (
    <FormDialog
      disparador={
        disparador ?? (
          <Button variante="primario">
            <Plus className="size-4" aria-hidden="true" />
            Nuevo gasto
          </Button>
        )
      }
      titulo={g ? "Editar gasto" : "Nuevo gasto"}
      accion={accion}
      estado={estado}
      ancho="max-w-2xl"
    >
      {g ? <input type="hidden" name="id" value={g.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Concepto" className="sm:col-span-2">
          <Input
            name="concepto"
            defaultValue={g?.concepto}
            required
            autoFocus
            placeholder="Servidor de producción — enero"
          />
        </Field>

        <Field label="Proveedor">
          <Input name="proveedor" defaultValue={g?.proveedor} placeholder="AWS, Vercel, Anthropic…" />
        </Field>

        <Field label="Categoría">
          <Select name="categoria" defaultValue={g?.categoria ?? "SERVIDORES"}>
            {CATEGORIAS_GASTO.map((c) => (
              <option key={c} value={c}>
                {humanizar(c)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Valor sin IVA (COP)">
          <Input
            name="base"
            inputMode="numeric"
            value={base || ""}
            onChange={(e) => setBase(Number(e.target.value.replace(/\D/g, "")) || 0)}
            required
          />
        </Field>

        <Field label="IVA">
          <Select name="tasaIva" value={tasa} onChange={(e) => setTasa(e.target.value)}>
            {TASAS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Fecha">
          <Input
            type="date"
            name="fecha"
            defaultValue={g?.fecha ?? fechaInput(new Date())}
            required
          />
        </Field>

        <Field label="Medio de pago">
          <Select name="metodoPago" defaultValue={g?.metodoPago ?? "TRANSFERENCIA"}>
            {METODOS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-ink-2">IVA</span>
          <span className="tabular text-ink">{money(iva)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3 border-t border-edge pt-1">
          <span className="font-medium text-ink">Total pagado</span>
          <span className="tabular font-semibold text-ink">{money(base + iva)}</span>
        </div>
      </div>

      <fieldset className="mt-4 space-y-3 rounded-lg border border-edge p-4">
        <legend className="px-1.5 text-xs font-medium text-ink-2">Tratamiento tributario</legend>
        <Checkbox
          name="ivaDescontable"
          label="El IVA es descontable"
          hint="Se resta del IVA generado en la declaración. Desmárcalo si el gasto no da derecho a descontable: entonces el IVA se suma al costo."
          defaultChecked={g?.ivaDescontable ?? true}
        />
        <Checkbox
          name="deducible"
          label="Es deducible de renta"
          hint="Debe tener relación de causalidad con la actividad y soporte válido."
          defaultChecked={g?.deducible ?? true}
        />
      </fieldset>

      <Field label="Notas" className="mt-4">
        <Textarea name="notas" defaultValue={g?.notas} rows={2} />
      </Field>
    </FormDialog>
  );
}
