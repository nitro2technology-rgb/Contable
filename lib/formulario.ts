import type { EstadoAccion } from "@/components/dialog";

export function exito(): EstadoAccion {
  return { ok: Date.now() };
}

export function fallo(mensaje: string): EstadoAccion {
  return { error: mensaje };
}

export function texto(d: FormData, campo: string): string {
  return String(d.get(campo) ?? "").trim();
}

/**
 * Lee un importe escrito por una persona. Acepta "1.250.000", "1250000",
 * "1.250.000,50" y "$ 1.250.000": se descartan los separadores de miles y la
 * coma decimal se convierte en punto.
 */
export function dinero(d: FormData, campo: string): number {
  const bruto = texto(d, campo);
  if (!bruto) return 0;

  const limpio = bruto
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

export function decimal(d: FormData, campo: string, porDefecto = 0): number {
  const bruto = texto(d, campo).replace(",", ".");
  if (!bruto) return porDefecto;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : porDefecto;
}

export function entero(d: FormData, campo: string, porDefecto = 0): number {
  const n = Math.trunc(decimal(d, campo, porDefecto));
  return Number.isFinite(n) ? n : porDefecto;
}

export function booleano(d: FormData, campo: string): boolean {
  const v = d.get(campo);
  return v === "on" || v === "true" || v === "1";
}

/**
 * Convierte el valor de un <input type="date"> a mediodia UTC. El mediodia evita
 * que un desfase de zona horaria mueva la fecha al dia anterior o siguiente.
 */
export function fechaDe(d: FormData, campo: string, porDefecto?: Date): Date {
  const bruto = texto(d, campo);
  if (!bruto) return porDefecto ?? new Date();
  const fecha = new Date(`${bruto}T12:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) ? (porDefecto ?? new Date()) : fecha;
}

export function fechaOpcional(d: FormData, campo: string): Date | null {
  const bruto = texto(d, campo);
  if (!bruto) return null;
  const fecha = new Date(`${bruto}T12:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function opcion<T extends string>(
  d: FormData,
  campo: string,
  validas: readonly T[],
  porDefecto: T
): T {
  const v = texto(d, campo) as T;
  return validas.includes(v) ? v : porDefecto;
}
