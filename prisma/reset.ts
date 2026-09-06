/**
 * Vacía la base de datos por completo.
 *
 *   npm run db:reset -- --si-estoy-seguro
 *
 * Lleva seguro a propósito: apunta a la base de PRODUCCIÓN que use tu `.env`,
 * y sin el indicador solo muestra el inventario sin tocar nada. Un borrado de
 * contabilidad no debe poder ocurrir por un `npm run` escrito de más.
 *
 * No hay papelera: lo que se borra no se recupera salvo desde una copia de
 * seguridad o una rama de Neon.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Anfitrión de la base, sin credenciales, para que se vea sobre qué se opera. */
function anfitrion(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host;
  } catch {
    return "(DATABASE_URL no definida o ilegible)";
  }
}

async function inventario() {
  const [clientes, servicios, socios, facturas, items, pagos, gastos, fijos, movs, config] =
    await Promise.all([
      prisma.cliente.count(),
      prisma.servicio.count(),
      prisma.socio.count(),
      prisma.factura.count(),
      prisma.facturaItem.count(),
      prisma.pago.count(),
      prisma.gasto.count(),
      prisma.gastoRecurrente.count(),
      prisma.movimientoSocio.count(),
      prisma.configuracion.count(),
    ]);

  return { clientes, servicios, socios, facturas, items, pagos, gastos, fijos, movs, config };
}

function mostrar(titulo: string, i: Record<string, number>) {
  console.log(`\n${titulo}`);
  console.log(`  clientes ................ ${i.clientes}`);
  console.log(`  servicios ............... ${i.servicios}`);
  console.log(`  socios .................. ${i.socios}`);
  console.log(`  facturas ................ ${i.facturas}`);
  console.log(`  líneas de factura ....... ${i.items}`);
  console.log(`  pagos ................... ${i.pagos}`);
  console.log(`  gastos .................. ${i.gastos}`);
  console.log(`  gastos fijos ............ ${i.fijos}`);
  console.log(`  movimientos de socios ... ${i.movs}`);
  console.log(`  configuración ........... ${i.config}`);
}

async function main() {
  const confirmado = process.argv.includes("--si-estoy-seguro");

  console.log(`\nBase de datos: ${anfitrion()}`);

  const antes = await inventario();
  mostrar("Contenido actual:", antes);

  const total = Object.values(antes).reduce((a, b) => a + b, 0);

  if (total === 0) {
    console.log("\nLa base ya está vacía. No hay nada que borrar.");
    return;
  }

  if (!confirmado) {
    console.log(
      "\nNo se ha borrado nada. Para vaciarla de verdad:" +
        "\n  npm run db:reset -- --si-estoy-seguro\n"
    );
    return;
  }

  // El orden respeta las claves foráneas: primero lo que depende de otros.
  // Va en una transacción para que no pueda quedar a medias.
  await prisma.$transaction([
    prisma.pago.deleteMany(),
    prisma.facturaItem.deleteMany(),
    prisma.factura.deleteMany(),
    prisma.movimientoSocio.deleteMany(),
    prisma.socio.deleteMany(),
    prisma.gasto.deleteMany(),
    prisma.gastoRecurrente.deleteMany(),
    prisma.servicio.deleteMany(),
    prisma.cliente.deleteMany(),
    prisma.configuracion.deleteMany(),
  ]);

  const despues = await inventario();
  mostrar("Después del borrado:", despues);

  const restante = Object.values(despues).reduce((a, b) => a + b, 0);
  console.log(
    restante === 0
      ? "\nBase vacía. La configuración se recreará con los valores por defecto la próxima vez que abras el panel."
      : `\nATENCIÓN: quedaron ${restante} registros sin borrar.`
  );
}

main()
  .catch((e) => {
    console.error("\nFalló el borrado:", e instanceof Error ? e.message.split("\n")[0] : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
