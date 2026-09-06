"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Table2, BarChart3 } from "lucide-react";
import { Table, Td, Th, Tr } from "./ui";
import { money, moneyCompact } from "@/lib/format";

// ---------------------------------------------------------------------------
// Piezas compartidas
// ---------------------------------------------------------------------------

const EJE = {
  stroke: "var(--axis)",
  fontSize: 11,
  fill: "var(--ink-muted)",
} as const;

function TooltipContenido({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-edge-strong bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-xs font-medium text-ink">{label}</p>
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={p.dataKey} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: p.color }}
              aria-hidden="true"
            />
            <span className="text-ink-2">{p.name}</span>
            <span className="tabular ml-auto font-medium text-ink">{money(p.value ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LeyendaContenido({
  payload,
}: {
  payload?: { value?: string; color?: string; dataKey?: string | number }[];
}) {
  if (!payload?.length) return null;
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3">
      {payload.map((p) => (
        <li key={String(p.dataKey)} className="flex items-center gap-1.5 text-xs text-ink-2">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: p.color }}
            aria-hidden="true"
          />
          {p.value}
        </li>
      ))}
    </ul>
  );
}

/**
 * Envoltura con alternador grafico/tabla. La vista de tabla es el canal de
 * respaldo exigido por la revision de accesibilidad: ningun valor queda
 * disponible solo a traves del color.
 */
export function ChartCard({
  titulo,
  descripcion,
  columnas,
  filas,
  altura = 260,
  children,
}: {
  titulo: string;
  descripcion?: string;
  columnas: string[];
  filas: (string | number)[][];
  altura?: number;
  children: React.ReactNode;
}) {
  const [tabla, setTabla] = React.useState(false);

  return (
    <div className="rounded-xl border border-edge bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-4 border-b border-edge px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
          {descripcion ? <p className="mt-0.5 text-xs text-ink-muted">{descripcion}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setTabla((v) => !v)}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-edge px-2 text-xs text-ink-2 hover:bg-surface-2"
          aria-pressed={tabla}
        >
          {tabla ? (
            <>
              <BarChart3 className="size-3.5" aria-hidden="true" /> Gráfico
            </>
          ) : (
            <>
              <Table2 className="size-3.5" aria-hidden="true" /> Tabla
            </>
          )}
        </button>
      </div>

      <div className="p-5 pt-4">
        {tabla ? (
          <div style={{ minHeight: altura }}>
            <Table>
              <thead>
                <tr>
                  {columnas.map((c, i) => (
                    <Th key={c} numerico={i > 0}>
                      {c}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, i) => (
                  <Tr key={i}>
                    {fila.map((celda, j) => (
                      <Td key={j} numerico={j > 0}>
                        {typeof celda === "number" ? money(celda) : celda}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <div style={{ height: altura }}>{children}</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flujo de caja: ingresos vs. gastos (columnas) + utilidad neta (linea)
// ---------------------------------------------------------------------------

export type PuntoFlujo = {
  mes: string;
  ingresos: number;
  gastos: number;
  utilidad: number;
};

export function FlujoCajaChart({ datos }: { datos: PuntoFlujo[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2}>
        <CartesianGrid stroke="var(--grid)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="mes"
          tickLine={false}
          axisLine={{ stroke: "var(--axis)" }}
          tick={{ fill: EJE.fill, fontSize: EJE.fontSize }}
          dy={4}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={62}
          tick={{ fill: EJE.fill, fontSize: EJE.fontSize }}
          tickFormatter={(v: number) => moneyCompact(v)}
        />
        <Tooltip
          content={<TooltipContenido />}
          cursor={{ fill: "var(--surface-2)" }}
        />
        <Legend content={<LeyendaContenido />} />
        <Bar
          dataKey="ingresos"
          name="Ingresos"
          fill="var(--s1)"
          maxBarSize={24}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="gastos"
          name="Gastos"
          fill="var(--s2)"
          maxBarSize={24}
          radius={[4, 4, 0, 0]}
        />
        <Line
          type="monotone"
          dataKey="utilidad"
          name="Utilidad neta"
          stroke="var(--s3)"
          strokeWidth={2}
          strokeLinecap="round"
          dot={{ r: 4, fill: "var(--s3)", stroke: "var(--surface)", strokeWidth: 2 }}
          activeDot={{ r: 5, fill: "var(--s3)", stroke: "var(--surface)", strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontales, codificacion secuencial (un solo tono, mas oscuro = mas)
// ---------------------------------------------------------------------------

const RAMPA = ["var(--seq-700)", "var(--seq-550)", "var(--seq-400)", "var(--seq-250)", "var(--seq-100)"];

export type BarraH = { nombre: string; valor: number };

export function BarrasHorizontales({
  datos,
  etiquetaSerie,
}: {
  datos: BarraH[];
  etiquetaSerie: string;
}) {
  // La magnitud ya la lleva la longitud de la barra; el tono la refuerza en el
  // mismo orden. Un solo tono, sin arcoiris.
  const paso = (i: number) => RAMPA[Math.min(i, RAMPA.length - 1)];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={datos}
        layout="vertical"
        margin={{ top: 4, right: 56, bottom: 0, left: 8 }}
        barCategoryGap={8}
      >
        <CartesianGrid stroke="var(--grid)" strokeWidth={1} horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fill: EJE.fill, fontSize: EJE.fontSize }}
          tickFormatter={(v: number) => moneyCompact(v)}
        />
        <YAxis
          type="category"
          dataKey="nombre"
          tickLine={false}
          axisLine={{ stroke: "var(--axis)" }}
          width={132}
          tick={{ fill: EJE.fill, fontSize: EJE.fontSize }}
        />
        <Tooltip content={<TooltipContenido />} cursor={{ fill: "var(--surface-2)" }} />
        <Bar dataKey="valor" name={etiquetaSerie} maxBarSize={24} radius={[0, 4, 4, 0]}>
          {datos.map((d, i) => (
            <Cell key={d.nombre} fill={paso(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Barra apilada de una sola fila — reparto parte/todo
// ---------------------------------------------------------------------------

export type SegmentoApilado = { nombre: string; valor: number; color: string };

export function BarraApilada({ segmentos }: { segmentos: SegmentoApilado[] }) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0);
  if (total <= 0) {
    return <p className="text-sm text-ink-muted">Sin datos en el periodo.</p>;
  }

  const visibles = segmentos.filter((s) => s.valor > 0);

  return (
    <div>
      {/* El gap de 2px en color de superficie es lo que separa los segmentos;
          no se dibuja borde sobre las marcas. */}
      <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded-md">
        {visibles.map((s) => (
          <div
            key={s.nombre}
            className="group relative h-full first:rounded-l-md last:rounded-r-md"
            style={{ width: `${(s.valor / total) * 100}%`, background: s.color }}
            title={`${s.nombre}: ${money(s.valor)}`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {visibles.map((s) => (
          <li key={s.nombre} className="flex items-center gap-1.5 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="text-ink-2">{s.nombre}</span>
            <span className="tabular font-medium text-ink">{moneyCompact(s.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Orden fijo de las ranuras categoricas. Nunca se cicla ni se generan tonos. */
export const SERIES = [
  "var(--s1)",
  "var(--s2)",
  "var(--s3)",
  "var(--s4)",
  "var(--s5)",
  "var(--s6)",
  "var(--s7)",
  "var(--s8)",
];
