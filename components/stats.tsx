import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cx } from "./ui";
import { moneyCompact, pct } from "@/lib/format";

// ---------------------------------------------------------------------------
// Chispograma (sparkline)
// ---------------------------------------------------------------------------

function Sparkline({ puntos, acento }: { puntos: number[]; acento: string }) {
  if (puntos.length < 2) return null;

  const w = 96;
  const h = 26;
  const min = Math.min(...puntos, 0);
  const max = Math.max(...puntos, 0);
  const rango = max - min || 1;

  const xy = puntos.map((v, i) => {
    const x = (i / (puntos.length - 1)) * w;
    const y = h - ((v - min) / rango) * h;
    return [x, y] as const;
  });

  const d = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ux, uy] = xy[xy.length - 1];

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--axis)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* El punto actual lleva el color de acento y un anillo del color de la
          superficie, para seguir legible donde cruza la linea. */}
      <circle cx={ux} cy={uy} r={4} fill={acento} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

export function StatTile({
  etiqueta,
  valor,
  valorTexto,
  delta,
  periodoDelta,
  subirEsBueno = true,
  tendencia,
  acento = "var(--s1)",
  nota,
  className,
}: {
  etiqueta: string;
  valor?: number;
  /** Texto ya formateado; tiene prioridad sobre `valor`. */
  valorTexto?: string;
  /** Variacion relativa frente al periodo anterior (0,12 = +12 %). */
  delta?: number | null;
  periodoDelta?: string;
  subirEsBueno?: boolean;
  tendencia?: number[];
  acento?: string;
  nota?: string;
  className?: string;
}) {
  const texto = valorTexto ?? moneyCompact(valor ?? 0);

  let deltaNodo: React.ReactNode = null;
  if (delta !== null && delta !== undefined && Number.isFinite(delta)) {
    const plano = Math.abs(delta) < 0.005;
    const bueno = plano ? null : delta > 0 === subirEsBueno;
    const Icono = plano ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

    deltaNodo = (
      <span
        className={cx(
          "inline-flex items-center gap-0.5 text-xs font-medium",
          bueno === null ? "text-ink-muted" : bueno ? "text-good-text" : "text-critical"
        )}
      >
        <Icono className="size-3.5" aria-hidden="true" />
        {plano ? "sin cambio" : `${delta > 0 ? "+" : ""}${pct(delta, 0)}`}
        {periodoDelta ? (
          <span className="font-normal text-ink-muted"> vs. {periodoDelta}</span>
        ) : null}
      </span>
    );
  }

  return (
    <div
      className={cx(
        "rounded-xl border border-edge bg-surface p-4",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-2">{etiqueta}</p>
          <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-ink">
            {texto}
          </p>
        </div>
        {tendencia && tendencia.length > 1 ? (
          <Sparkline puntos={tendencia} acento={acento} />
        ) : null}
      </div>

      {deltaNodo || nota ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {deltaNodo}
          {nota ? <span className="text-xs text-ink-muted">{nota}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cifra heroe — exactamente una por vista
// ---------------------------------------------------------------------------

export function HeroFigure({
  etiqueta,
  valor,
  nota,
  positivo,
}: {
  etiqueta: string;
  valor: string;
  nota?: React.ReactNode;
  positivo: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-2">{etiqueta}</p>
      <p
        className={cx(
          "mt-1 text-5xl font-semibold tracking-tight",
          positivo ? "text-ink" : "text-critical"
        )}
      >
        {valor}
      </p>
      {nota ? <div className="mt-2 text-sm text-ink-2">{nota}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Medidor — una razon contra un limite
// ---------------------------------------------------------------------------

export function Meter({
  etiqueta,
  valor,
  limite,
  formato = moneyCompact,
  nota,
}: {
  etiqueta: string;
  valor: number;
  limite: number;
  formato?: (n: number) => string;
  nota?: string;
}) {
  const razon = limite > 0 ? Math.min(valor / limite, 1) : 0;
  const excedido = limite > 0 && valor > limite;

  // La severidad la lleva el relleno; la pista es un paso mas claro de la misma
  // rampa, para que el estado se lea a lo largo de toda la barra.
  const relleno = excedido
    ? "var(--critical)"
    : razon > 0.85
      ? "var(--warning)"
      : "var(--seq-400)";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-ink-2">{etiqueta}</span>
        <span className="tabular text-xs text-ink-muted">
          <span className="font-medium text-ink">{formato(valor)}</span> de {formato(limite)}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--seq-100)" }}
        role="meter"
        aria-valuenow={Math.round(razon * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={etiqueta}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.max(razon * 100, valor > 0 ? 2 : 0)}%`, background: relleno }}
        />
      </div>
      {nota ? <p className="mt-1 text-xs text-ink-muted">{nota}</p> : null}
    </div>
  );
}
