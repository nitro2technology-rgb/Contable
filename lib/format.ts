const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/** $ 1.250.000 */
export function money(valor: number): string {
  return COP.format(Math.round(valor));
}

/** 1.250.000 — sin simbolo, para columnas donde el encabezado ya dice la unidad. */
export function plain(valor: number): string {
  return NUM.format(Math.round(valor));
}

/**
 * Version compacta para valores grandes en stat tiles y ejes: $ 4,2 M.
 * Los millones son la escala natural de esta empresa, asi que se abrevia desde
 * el millon y no antes.
 */
export function moneyCompact(valor: number): string {
  const abs = Math.abs(valor);
  const signo = valor < 0 ? "-" : "";

  if (abs >= 1_000_000_000) return `${signo}$ ${(abs / 1_000_000_000).toFixed(1).replace(".", ",")} MM`;
  if (abs >= 1_000_000) return `${signo}$ ${(abs / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (abs >= 10_000) return `${signo}$ ${Math.round(abs / 1000)} k`;
  return money(valor);
}

export function pct(fraccion: number, decimales = 1): string {
  return `${(fraccion * 100).toFixed(decimales).replace(".", ",")} %`;
}

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function fecha(d: Date | string): string {
  return FECHA.format(new Date(d));
}

export function fechaLarga(d: Date | string): string {
  return FECHA_LARGA.format(new Date(d));
}

/** Valor para un <input type="date">, en UTC para no correrse un dia. */
export function fechaInput(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

export const MESES_CORTOS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/** Dias entre dos fechas, positivo si `b` es posterior. */
export function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Convierte un enum SCREAMING_SNAKE en texto legible: "LEGAL_CONTABLE" ->
 * "Legal contable". Las siglas se listan aparte porque la regla general las
 * dejaria como "Ia" o "Apis".
 */
const SIGLAS: Record<string, string> = {
  IA: "IA",
  APIS: "APIs",
  PSE: "PSE",
};

export function humanizar(valor: string): string {
  if (SIGLAS[valor]) return SIGLAS[valor];
  const s = valor.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
