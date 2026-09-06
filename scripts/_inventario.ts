import { prisma } from "../lib/db";

const SEMILLA = {
  clientes: ["Distribuidora Andina S.A.S.", "Logística del Caribe Ltda.", "Clínica San Rafael", "Startup Verde"],
  socios: ["Socio 1", "Socio 2"],
  servicios: ["Desarrollo de software a la medida", "Automatización de procesos", "Consultoría de datos", "Licenciamiento SaaS mensual", "Soporte y mantenimiento"],
};

function marca(nombre: string, lista: string[]) {
  return lista.includes(nombre) ? "[ejemplo]" : "[TUYO]  ";
}

async function main() {
  const [clientes, servicios, socios, facturas, gastos, fijos, pagos, movs, cfg] = await Promise.all([
    prisma.cliente.findMany({ orderBy: { creadoEn: "asc" } }),
    prisma.servicio.findMany({ orderBy: { creadoEn: "asc" } }),
    prisma.socio.findMany({ orderBy: { creadoEn: "asc" } }),
    prisma.factura.findMany({ orderBy: { creadoEn: "asc" }, select: { numero: true, proyecto: true, creadoEn: true } }),
    prisma.gasto.count(),
    prisma.gastoRecurrente.findMany({ orderBy: { creadoEn: "asc" }, select: { concepto: true, proveedor: true, creadoEn: true } }),
    prisma.pago.count(),
    prisma.movimientoSocio.count(),
    prisma.configuracion.findUnique({ where: { id: 1 } }),
  ]);

  console.log(`\n=== CLIENTES (${clientes.length}) ===`);
  clientes.forEach((c) => console.log(`  ${marca(c.nombre, SEMILLA.clientes)} ${c.nombre}  ·  creado ${c.creadoEn.toISOString().slice(0, 16).replace("T", " ")}`));

  console.log(`\n=== SERVICIOS (${servicios.length}) ===`);
  servicios.forEach((s) => console.log(`  ${marca(s.nombre, SEMILLA.servicios)} ${s.nombre}  ·  creado ${s.creadoEn.toISOString().slice(0, 16).replace("T", " ")}`));

  console.log(`\n=== SOCIOS (${socios.length}) ===`);
  socios.forEach((s) => console.log(`  ${marca(s.nombre, SEMILLA.socios)} ${s.nombre}  ·  creado ${s.creadoEn.toISOString().slice(0, 16).replace("T", " ")}`));

  console.log(`\n=== GASTOS FIJOS (${fijos.length}) ===`);
  fijos.forEach((g) => console.log(`  ${g.concepto} — ${g.proveedor}  ·  creado ${g.creadoEn.toISOString().slice(0, 16).replace("T", " ")}`));

  console.log(`\n=== FACTURAS (${facturas.length}) ===`);
  facturas.forEach((f) => console.log(`  ${f.numero}  ${f.proyecto}  ·  creada ${f.creadoEn.toISOString().slice(0, 16).replace("T", " ")}`));

  console.log(`\n=== CONTEOS ===`);
  console.log(`  pagos: ${pagos} · gastos: ${gastos} · movimientos de socios: ${movs}`);

  console.log(`\n=== CONFIGURACION (no es dato transaccional) ===`);
  console.log(`  razon social: ${cfg?.razonSocial} · NIT: ${cfg?.nit || "(vacio)"} · UVT: ${cfg?.valorUvt} · IVA: ${cfg?.periodicidadIva}`);
}

main().catch((e) => console.log("FALLO:", String(e.message).split("\n")[0])).finally(() => prisma.$disconnect());
