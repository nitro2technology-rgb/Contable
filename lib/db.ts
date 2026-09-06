import { PrismaClient, Prisma } from "@prisma/client";
import { conReintento, esTransitorio } from "./reintento";

/**
 * Neon suspende el cómputo tras unos minutos sin uso; la primera consulta que
 * llega después tiene que esperar a que despierte. El valor por defecto de
 * Prisma son 5 segundos, que a veces no alcanzan, y el resultado es un error de
 * conexión que parece una caída pero no lo es. Se amplían los tiempos sin tocar
 * el .env, respetando lo que ya venga escrito en la cadena.
 */
function urlConTiemposAmplios(): string | undefined {
  const bruta = process.env.DATABASE_URL;
  if (!bruta) return undefined;

  try {
    const url = new URL(bruta);
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "20");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    return url.toString();
  } catch {
    // Si la cadena no se puede analizar, se usa tal cual y que Prisma reporte.
    return bruta;
  }
}

function crearCliente() {
  const url = urlConTiemposAmplios();

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(url ? { datasourceUrl: url } : {}),
  }).$extends({
    query: {
      // Un solo punto de reintento para todas las consultas del sistema: cada
      // página del panel lanza varias en paralelo y no tendría sentido envolver
      // cada llamada a mano.
      $allOperations: ({ args, query }) => conReintento(() => query(args)),
    },
  });
}

type ClientePrisma = ReturnType<typeof crearCliente>;

const globalForPrisma = globalThis as unknown as { prisma?: ClientePrisma };

export const prisma = globalForPrisma.prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** `true` si el fallo es de conexión y no de la consulta. */
export const esErrorDeConexion = esTransitorio;

/**
 * Los campos monetarios son Decimal en Postgres para no perder precision. Los
 * Server Components no pueden serializar un Decimal hacia el cliente, asi que
 * toda cifra cruza esta funcion antes de salir de la capa de datos.
 */
export function num(valor: Prisma.Decimal | number | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return valor;
  return valor.toNumber();
}

export { Prisma };
