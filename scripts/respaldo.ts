/**
 * Vuelca toda la base a un JSON con fecha, para tener a qué volver antes de un
 * cambio de esquema o un borrado.
 *
 *   npm run db:respaldo
 *
 * Usa SQL directo a propósito, no el cliente tipado: un respaldo tiene que
 * funcionar justo cuando el esquema del código y el de la base no coinciden,
 * que es precisamente cuando más falta hace. Con el cliente generado, leer una
 * tabla a la que aún le faltan columnas falla.
 *
 * No sustituye a una copia de seguridad de verdad —para eso están las ramas de
 * Neon— pero permite reconstruir a mano lo que había.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Nombres fijos: nunca vienen de entrada externa. */
const TABLAS = [
  "Configuracion",
  "Cliente",
  "Servicio",
  "Socio",
  "MovimientoSocio",
  "Factura",
  "FacturaItem",
  "Pago",
  "Gasto",
  "GastoRecurrente",
] as const;

async function main() {
  const datos: Record<string, unknown> = { generado: new Date().toISOString() };
  const resumen: string[] = [];

  for (const tabla of TABLAS) {
    const filas = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${tabla}"`
    );
    datos[tabla] = filas;
    resumen.push(`${tabla}=${filas.length}`);
  }

  const carpeta = join(process.cwd(), "respaldos");
  mkdirSync(carpeta, { recursive: true });

  const nombre = `respaldo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const ruta = join(carpeta, nombre);

  // Los Decimal y los BigInt que devuelve el driver no son serializables tal
  // cual; se guardan como texto para no perder precisión.
  const json = JSON.stringify(
    datos,
    (_clave, valor) => {
      if (typeof valor === "bigint") return valor.toString();
      if (valor !== null && typeof valor === "object" && "toFixed" in valor) return String(valor);
      return valor;
    },
    2
  );

  writeFileSync(ruta, json, "utf8");

  console.log(`Respaldo escrito en respaldos/${nombre}`);
  console.log(resumen.join(" · "));
}

main()
  .catch((e) => {
    console.error("Falló el respaldo:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
