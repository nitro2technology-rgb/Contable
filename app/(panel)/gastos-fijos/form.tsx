"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ESTADO_INICIAL, FormDialog } from "@/components/dialog";
import { fechaInput, humanizar, money } from "@/lib/format";
import { CATEGORIAS_GASTO } from "@/lib/catalogos";
import { guardarGastoFijo } from "../gastos/actions";

const PERIODICIDADES = [
  ["MENSUAL", "Mensual", 1],
  ["BIMESTRAL", "Bimestral", 2],
  ["TRIMESTRAL", "Trimestral", 3],
  ["CUATRIMESTRAL", "Cuatrimestral", 4],
  ["SEMESTRAL", "Semestral", 6],
  ["ANUAL", "Anual", 12],
] as const;

const TASAS = [
  ["0", "Sin IVA"],
  ["0.19", "19 %"],
  ["0.05", "5 %"],
] as const;

export type GastoFijoForm = {
  id: string;
  concepto: string;
  proveedor: string;
  categoria: string;
  base: number;
  tasaIva: number;
  ivaDescontable: boolean;
  deducible: boolean;
  periodicidad: string;
  diaCobro: number;
  fechaInicio: string;
  activo: boolean;
  notas: string;
};

export function DialogoGastoFijo({
  gasto,
  disparador,
}: {
  gasto?: GastoFijoForm;
  disparador?: React.ReactNode;
}) {
  const [estado, accion] = useActionState(guardarGastoFijo, ESTADO_INICIAL);
  const g = gasto;

  const [base, setBase] = useState<number>(g?.base ?? 0);
  const [tasa, setTasa] = useState<string>(String(g?.tasaIva ?? 0));
  const [periodicidad, setPeriodicidad] = useState<string>(g?.periodicidad ?? "MENSUAL");

  const iva = Math.round(base * Number(tasa));
  const divisor = PERIODICIDADES.find(([v]) => v === periodicidad)?.[2] ?? 1;
  const equivalenteMensual = Math.round((base + iva) / divisor);

  return (
    <FormDialog
      disparador={
        disparador ?? (
          <Button variante="primario">
            <Plus className="size-4" aria-hidden="true" />
            Nuevo gasto fijo
          </Button>
        )
      }
      titulo={g ? "Editar gasto fijo" : "Nuevo gasto fijo"}
      descripcion="Una plantilla del cargo recurrente. Desde la lista se registra el cargo de cada mes."
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
            placeholder="Servidor de producción"
          />
        </Field>

        <Field label="Proveedor">
          <Input name="proveedor" defaultValue={g?.proveedor} placeholder="AWS, Vercel, Neon…" />
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

        <Field label="Periodicidad">
          <Select
            name="periodicidad"
            value={periodicidad}
            onChange={(e) => setPeriodicidad(e.target.value)}
          >
            {PERIODICIDADES.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Día de cobro" hint="Entre 1 y 28, para que exista en todos los meses.">
          <Input
            type="number"
            name="diaCobro"
            min="1"
            max="28"
            defaultValue={g?.diaCobro ?? 1}
          />
        </Field>

        <Field label="Desde" className="sm:col-span-2">
          <Input
            type="date"
            name="fechaInicio"
            defaultValue={g?.fechaInicio ?? fechaInput(new Date())}
            required
          />
        </Field>
      </div>

      <div className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-ink-2">Cargo por periodo</span>
          <span className="tabular text-ink">{money(base + iva)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3 border-t border-edge pt-1">
          <span className="font-medium text-ink">Equivale al mes</span>
          <span className="tabular font-semibold text-ink">{money(equivalenteMensual)}</span>
        </div>
      </div>

      <fieldset className="mt-4 space-y-3 rounded-lg border border-edge p-4">
        <legend className="px-1.5 text-xs font-medium text-ink-2">Tratamiento tributario</legend>
        <Checkbox
          name="ivaDescontable"
          label="El IVA es descontable"
          defaultChecked={g?.ivaDescontable ?? true}
        />
        <Checkbox
          name="deducible"
          label="Es deducible de renta"
          defaultChecked={g?.deducible ?? true}
        />
      </fieldset>

      <div className="mt-4 space-y-4">
        <Field label="Notas">
          <Textarea name="notas" defaultValue={g?.notas} rows={2} />
        </Field>
        <Checkbox name="activo" label="Gasto fijo activo" defaultChecked={g?.activo ?? true} />
      </div>
    </FormDialog>
  );
}
