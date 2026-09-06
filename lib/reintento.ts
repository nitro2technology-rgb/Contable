/**
 * Política de reintento de la capa de datos.
 *
 * Vive aparte de `db.ts` y sin depender de Prisma para poder comprobarla con
 * errores sintéticos: si estuviera enredada con el cliente, la única forma de
 * verificarla sería cronometrar conexiones reales, que es justo lo que dio un
 * falso positivo la primera vez.
 */

/**
 * Códigos de Prisma que significan "la base no respondió", no "la consulta está
 * mal". Reintentar estos tiene sentido; reintentar cualquier otro, no.
 *
 * P1001 no se alcanza el servidor · P1002 se agotó el tiempo de conexión
 * P1008 se agotó el tiempo de la operación · P1017 el servidor cerró la conexión
 * P2024 se agotó la espera de una conexión del pool
 */
export const CODIGOS_TRANSITORIOS = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

/**
 * Prisma reporta el mismo problema de dos formas según cuándo ocurre:
 *
 * - Si la conexión ya estaba abierta y se cae, llega un
 *   `PrismaClientKnownRequestError` con `code: "P1001"`.
 * - Si nunca llegó a establecerse, llega un `PrismaClientInitializationError`,
 *   que expone `errorCode` en vez de `code` — y que en la práctica lo deja sin
 *   poblar, así que el nombre de la clase es la única señal fiable.
 *
 * Comprobar solo `code` deja fuera el segundo caso, que es precisamente el del
 * arranque en frío de Neon.
 */
export function esTransitorio(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const e = error as { code?: unknown; errorCode?: unknown; name?: unknown };

  if (typeof e.code === "string" && CODIGOS_TRANSITORIOS.has(e.code)) return true;
  if (typeof e.errorCode === "string" && CODIGOS_TRANSITORIOS.has(e.errorCode)) return true;

  // No se pudo abrir la conexión. Si la causa es permanente (cadena mal escrita,
  // motor incompatible) los reintentos cuestan menos de un segundo y el error
  // acaba saliendo igual; si es un arranque en frío, se resuelve solo.
  return e.name === "PrismaClientInitializationError";
}

export const INTENTOS = 3;

/** Espera antes del intento `n` (0-indexado): 300 ms y 600 ms. */
export function esperaMs(intento: number): number {
  return 300 * 2 ** intento;
}

/**
 * Ejecuta `operacion`, reintentando solo mientras el fallo sea transitorio.
 * Devuelve el resultado o propaga el último error.
 */
export async function conReintento<T>(
  operacion: () => Promise<T>,
  opciones: {
    intentos?: number;
    transitorio?: (e: unknown) => boolean;
    dormir?: (ms: number) => Promise<void>;
  } = {}
): Promise<T> {
  const intentos = opciones.intentos ?? INTENTOS;
  const transitorio = opciones.transitorio ?? esTransitorio;
  const dormir = opciones.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

  let ultimoError: unknown;

  for (let intento = 0; intento < intentos; intento++) {
    try {
      return await operacion();
    } catch (error) {
      if (!transitorio(error)) throw error;

      ultimoError = error;
      if (intento === intentos - 1) break;

      await dormir(esperaMs(intento));
    }
  }

  throw ultimoError;
}
