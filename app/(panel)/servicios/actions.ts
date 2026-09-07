"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/components/dialog";
import { prisma } from "@/lib/db";
import { booleano, dinero, exito, fallo, opcion, texto } from "@/lib/formulario";
import { PERIODICIDADES } from "@/lib/catalogos";

const TRATAMIENTOS = ["GRAVADO_19", "GRAVADO_5", "EXENTO", "EXCLUIDO"] as const;
const CONCEPTOS = ["NINGUNO", "HONORARIOS", "SERVICIOS", "COMPRAS", "ARRENDAMIENTO"] as const;
const CATEGORIAS = [
  "DESARROLLO",
  "AUTOMATIZACION",
  "CONSULTORIA_DATOS",
  "CLOUD",
  "LICENCIAMIENTO_SAAS",
  "SOPORTE",
  "CAPACITACION",
  "OTRO",
] as const;

export async function guardarServicio(
  _estado: EstadoAccion,
  d: FormData
): Promise<EstadoAccion> {
  const nombre = texto(d, "nombre");
  if (!nombre) return fallo("El nombre del servicio es obligatorio.");

  const datos = {
    nombre,
    descripcion: texto(d, "descripcion"),
    categoria: opcion(d, "categoria", CATEGORIAS, "DESARROLLO"),
    precioBase: dinero(d, "precioBase"),
    tratamientoIva: opcion(d, "tratamientoIva", TRATAMIENTOS, "GRAVADO_19"),
    conceptoRetefuente: opcion(d, "conceptoRetefuente", CONCEPTOS, "SERVICIOS"),
    esRecurrente: booleano(d, "esRecurrente"),
    periodicidad: opcion(d, "periodicidad", PERIODICIDADES, "MENSUAL"),
    activo: booleano(d, "activo"),
    notas: texto(d, "notas"),
  };

  const id = texto(d, "id");

  try {
    if (id) await prisma.servicio.update({ where: { id }, data: datos });
    else await prisma.servicio.create({ data: datos });
  } catch {
    return fallo("No se pudo guardar el servicio.");
  }

  revalidatePath("/servicios");
  revalidatePath("/facturas");
  revalidatePath("/suscripciones");
  return exito();
}

export async function eliminarServicio(id: string) {
  const usos = await prisma.facturaItem.count({ where: { servicioId: id } });

  // Igual que con los clientes: si ya se facturo, se archiva en lugar de borrar.
  if (usos > 0) {
    await prisma.servicio.update({ where: { id }, data: { activo: false } });
  } else {
    await prisma.servicio.delete({ where: { id } });
  }

  revalidatePath("/servicios");
}
