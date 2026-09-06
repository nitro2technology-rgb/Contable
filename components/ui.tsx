import * as React from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Superficies
// ---------------------------------------------------------------------------

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-xl border border-edge bg-surface",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  titulo,
  descripcion,
  accion,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-edge px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
        {descripcion ? (
          <p className="mt-0.5 text-xs text-ink-muted">{descripcion}</p>
        ) : null}
      </div>
      {accion ? <div className="shrink-0">{accion}</div> : null}
    </div>
  );
}

export function PageHeader({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{titulo}</h1>
        {descripcion ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-2">{descripcion}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </header>
  );
}

export function EmptyState({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{titulo}</p>
      {descripcion ? (
        <p className="max-w-sm text-sm text-ink-muted">{descripcion}</p>
      ) : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controles
// ---------------------------------------------------------------------------

type Variante = "primario" | "secundario" | "fantasma" | "peligro";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-s1 text-white hover:brightness-110 active:brightness-95 border border-transparent",
  secundario:
    "bg-surface text-ink border border-edge-strong hover:bg-surface-2",
  fantasma: "bg-transparent text-ink-2 hover:bg-surface-2 border border-transparent",
  peligro:
    "bg-transparent text-critical border border-edge-strong hover:bg-surface-2",
};

export function Button({
  variante = "secundario",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      className={cx(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5",
        "text-sm font-medium transition-[background,filter] duration-100",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTES[variante],
        className
      )}
      {...rest}
    />
  );
}

const CONTROL =
  "h-9 w-full rounded-lg border border-edge-strong bg-surface px-3 text-sm text-ink " +
  "placeholder:text-ink-muted disabled:opacity-60";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL, className)} {...rest} />;
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(CONTROL, "h-auto min-h-[72px] py-2 leading-relaxed", className)}
      {...rest}
    />
  );
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(CONTROL, "pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  hint,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-2.5", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-edge-strong accent-[var(--s1)]"
        {...rest}
      />
      <span>
        <span className="block text-sm text-ink">{label}</span>
        {hint ? <span className="block text-xs text-ink-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Distintivos
// ---------------------------------------------------------------------------

export type TonoBadge = "neutro" | "bueno" | "aviso" | "serio" | "critico" | "info";

const TONOS: Record<TonoBadge, string> = {
  neutro: "bg-surface-2 text-ink-2 border-edge",
  bueno: "bg-good/10 text-good-text border-good/25",
  aviso: "bg-warning/15 text-ink border-warning/40",
  serio: "bg-serious/15 text-ink border-serious/40",
  critico: "bg-critical/10 text-critical border-critical/30",
  info: "bg-s1/10 text-s1 border-s1/25",
};

export function Badge({
  tono = "neutro",
  children,
  icono,
}: {
  tono?: TonoBadge;
  children: React.ReactNode;
  /** Los tonos de estado nunca comunican por color solo: llevan icono + texto. */
  icono?: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5",
        "text-xs font-medium",
        TONOS[tono]
      )}
    >
      {icono}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tablas
// ---------------------------------------------------------------------------

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  className,
  numerico,
  children,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numerico?: boolean }) {
  return (
    <th
      scope="col"
      className={cx(
        "border-b border-edge px-4 py-2.5 text-xs font-medium text-ink-muted",
        numerico ? "text-right" : "text-left",
        className
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  className,
  numerico,
  children,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numerico?: boolean }) {
  return (
    <td
      className={cx(
        "border-b border-edge px-4 py-3 text-ink",
        numerico && "text-right tabular",
        className
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export function Tr({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cx("transition-colors hover:bg-surface-2", className)} {...rest}>
      {children}
    </tr>
  );
}
