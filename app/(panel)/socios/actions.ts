"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/components/dialog";
import { prisma } from "@/lib/db";
import {
  booleano,
  decimal,
  dinero,
  exito,
  fallo,
  fechaDe,
  fechaOpcional,
  opcion,
  texto,
} from "@/lib/formulario";

const TIPOS = [
  "PRESTAMO",
  "RETIRO",
  "ABONO",
  "APORTE_CAPITAL",
  "DISTRIBUCION_UTILIDADES",
] as const;

export async function guardarSocio(_estado: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const nombre = texto(d, "nombre");
  if (!nombre) return fallo("El nombre del socio es obligatorio.");

  // La participación se captura en porcentaje y se guarda como fracción.
  const participacion = Math.min(Math.max(decimal(d, "participacion", 50) / 100, 0), 1);

  const datos = {
    nombre,
    documento: texto(d, "documento"),
    email: texto(d, "email"),
    telefono: texto(d, "telefono"),
    participacion,
    activo: booleano(d, "activo"),
    notas: texto(d, "notas"),
  };

  const id = texto(d, "id");

  try {
    if (id) await prisma.socio.update({ where: { id }, data: datos });
    else await prisma.socio.create({ data: datos });
  } catch {
    return fallo("No se pudo guardar el socio.");
  }

  revalidatePath("/socios");
  revalidatePath("/");
  return exito();
}

export async function eliminarSocio(id: string) {
  const movimientos = await prisma.movimientoSocio.count({ where: { socioId: id } });

  // Con movimientos registrados, el socio se marca inactivo: borrarlo eliminaria
  // en cascada su cuenta corriente y con ella la deuda pendiente.
  if (movimientos > 0) {
    await prisma.socio.update({ where: { id }, data: { activo: false } });
  } else {
    await prisma.socio.delete({ where: { id } });
  }

  revalidatePath("/socios");
  revalidatePath("/");
}

export async function guardarMovimiento(
  _estado: EstadoAccion,
  d: FormData
): Promise<EstadoAccion> {
  const socioId = texto(d, "socioId");
  const monto = dinero(d, "monto");
  const concepto = texto(d, "concepto");

  if (!socioId) return fallo("Selecciona el socio al que corresponde el movimiento.");
  if (monto <= 0) return fallo("El monto debe ser mayor que cero.");
  if (!concepto) return fallo("Describe el concepto del movimiento.");

  const datos = {
    socioId,
    fecha: fechaDe(d, "fecha"),
    tipo: opcion(d, "tipo", TIPOS, "PRESTAMO"),
    monto,
    concepto,
    notas: texto(d, "notas"),
    fechaCompromiso: fechaOpcional(d, "fechaCompromiso"),
  };

  const id = texto(d, "id");

  try {
    if (id) await prisma.movimientoSocio.update({ where: { id }, data: datos });
    else await prisma.movimientoSocio.create({ data: datos });
  } catch {
    return fallo("No se pudo guardar el movimiento.");
  }

  revalidatePath("/socios");
  revalidatePath("/");
  return exito();
}

export async function eliminarMovimiento(id: string) {
  await prisma.movimientoSocio.delete({ where: { id } });
  revalidatePath("/socios");
  revalidatePath("/");
}
