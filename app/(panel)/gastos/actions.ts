"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { booleano, decimal, dinero, exito, fallo, fechaDe, opcion, texto } from "@/lib/formulario";
import { redondearPeso } from "@/lib/fiscal";
import { CATEGORIAS_GASTO, METODOS_PAGO, PERIODICIDADES } from "@/lib/catalogos";


function datosGasto(d: FormData) {
  const base = dinero(d, "base");
  const tasaIva = decimal(d, "tasaIva", 0);
  const ivaValor = redondearPeso(base * tasaIva);

  return {
    fecha: fechaDe(d, "fecha"),
    concepto: texto(d, "concepto"),
    proveedor: texto(d, "proveedor"),
    categoria: opcion(d, "categoria", CATEGORIAS_GASTO, "OTRO"),
    base,
    tasaIva,
    ivaValor,
    total: base + ivaValor,
    ivaDescontable: booleano(d, "ivaDescontable"),
    deducible: booleano(d, "deducible"),
    metodoPago: opcion(d, "metodoPago", METODOS_PAGO, "TRANSFERENCIA"),
    notas: texto(d, "notas"),
  };
}

/**
 * Los gastos que nacen de unos honorarios de socio se administran desde el
 * modulo de socios. Editarlos o borrarlos aqui dejaria el movimiento del socio
 * y el gasto diciendo cosas distintas, asi que se bloquea tambien en el
 * servidor: ocultar el boton no es una defensa.
 */
async function esDeSocio(id: string): Promise<boolean> {
  const g = await prisma.gasto.findUnique({
    where: { id },
    select: { movimientoSocioId: true },
  });
  return Boolean(g?.movimientoSocioId);
}

export async function guardarGasto(_estado: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const datos = datosGasto(d);

  if (!datos.concepto) return fallo("Describe el concepto del gasto.");
  if (datos.base <= 0) return fallo("El valor del gasto debe ser mayor que cero.");

  const id = texto(d, "id");

  if (id && (await esDeSocio(id))) {
    return fallo("Este gasto viene de unos honorarios de socio. Edítalo desde el módulo de Socios.");
  }

  try {
    if (id) await prisma.gasto.update({ where: { id }, data: datos });
    else await prisma.gasto.create({ data: datos });
  } catch {
    return fallo("No se pudo guardar el gasto.");
  }

  revalidatePath("/gastos");
  revalidatePath("/");
  revalidatePath("/impuestos");
  return exito();
}

export async function eliminarGasto(id: string) {
  if (await esDeSocio(id)) return;

  await prisma.gasto.delete({ where: { id } });
  revalidatePath("/gastos");
  revalidatePath("/");
  revalidatePath("/impuestos");
}

// ---------------------------------------------------------------------------
// Gastos fijos (plantillas recurrentes)
// ---------------------------------------------------------------------------

export async function guardarGastoFijo(
  _estado: EstadoAccion,
  d: FormData
): Promise<EstadoAccion> {
  const concepto = texto(d, "concepto");
  const base = dinero(d, "base");

  if (!concepto) return fallo("Describe el concepto del gasto fijo.");
  if (base <= 0) return fallo("El valor debe ser mayor que cero.");

  const diaCobro = Math.min(Math.max(Number(texto(d, "diaCobro")) || 1, 1), 28);

  const datos = {
    concepto,
    proveedor: texto(d, "proveedor"),
    categoria: opcion(d, "categoria", CATEGORIAS_GASTO, "SERVIDORES"),
    base,
    tasaIva: decimal(d, "tasaIva", 0),
    ivaDescontable: booleano(d, "ivaDescontable"),
    deducible: booleano(d, "deducible"),
    periodicidad: opcion(d, "periodicidad", PERIODICIDADES, "MENSUAL"),
    // Se limita a 28 para que el cargo exista en todos los meses, febrero incluido.
    diaCobro,
    fechaInicio: fechaDe(d, "fechaInicio"),
    activo: booleano(d, "activo"),
    notas: texto(d, "notas"),
  };

  const id = texto(d, "id");

  try {
    if (id) await prisma.gastoRecurrente.update({ where: { id }, data: datos });
    else await prisma.gastoRecurrente.create({ data: datos });
  } catch {
    return fallo("No se pudo guardar el gasto fijo.");
  }

  revalidatePath("/gastos-fijos");
  revalidatePath("/");
  return exito();
}

export async function eliminarGastoFijo(id: string) {
  const generados = await prisma.gasto.count({ where: { recurrenteId: id } });

  // Si ya genero movimientos, se desactiva: borrarla dejaria los gastos sin
  // origen y cambiaria el historico.
  if (generados > 0) {
    await prisma.gastoRecurrente.update({ where: { id }, data: { activo: false } });
  } else {
    await prisma.gastoRecurrente.delete({ where: { id } });
  }

  revalidatePath("/gastos-fijos");
  revalidatePath("/");
}

/**
 * Registra el cargo de un gasto fijo en el mes indicado. Es idempotente: si ya
 * existe el gasto de esa plantilla para ese mes, no lo duplica.
 */
export async function generarCargo(recurrenteId: string, anio: number, mes: number) {
  const plantilla = await prisma.gastoRecurrente.findUnique({ where: { id: recurrenteId } });
  if (!plantilla) return;

  const inicioMes = new Date(Date.UTC(anio, mes, 1));
  const finMes = new Date(Date.UTC(anio, mes + 1, 1));

  const existente = await prisma.gasto.findFirst({
    where: { recurrenteId, fecha: { gte: inicioMes, lt: finMes } },
    select: { id: true },
  });
  if (existente) return;

  const base = num(plantilla.base);
  const tasaIva = num(plantilla.tasaIva);
  const ivaValor = redondearPeso(base * tasaIva);

  await prisma.gasto.create({
    data: {
      fecha: new Date(Date.UTC(anio, mes, plantilla.diaCobro, 12)),
      concepto: plantilla.concepto,
      proveedor: plantilla.proveedor,
      categoria: plantilla.categoria,
      base,
      tasaIva,
      ivaValor,
      total: base + ivaValor,
      ivaDescontable: plantilla.ivaDescontable,
      deducible: plantilla.deducible,
      notas: "Generado desde un gasto fijo.",
      recurrenteId,
    },
  });

  revalidatePath("/gastos");
  revalidatePath("/gastos-fijos");
  revalidatePath("/");
  revalidatePath("/impuestos");
}
