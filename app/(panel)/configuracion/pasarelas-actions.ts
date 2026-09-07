"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/components/dialog";
import { prisma } from "@/lib/db";
import { booleano, decimal, dinero, exito, fallo, texto } from "@/lib/formulario";

export async function guardarPasarela(
  _estado: EstadoAccion,
  d: FormData
): Promise<EstadoAccion> {
  const nombre = texto(d, "nombre");
  if (!nombre) return fallo("El nombre de la pasarela es obligatorio.");

  // El porcentaje se captura como número legible (2,99) y se guarda como
  // fracción (0,0299): así el formulario habla como la gente y el cálculo como
  // las matemáticas.
  const porcentaje = decimal(d, "porcentaje", 0) / 100;
  if (porcentaje < 0 || porcentaje > 1) {
    return fallo("El porcentaje de comisión debe estar entre 0 y 100.");
  }

  const datos = {
    nombre,
    porcentaje,
    fijo: dinero(d, "fijo"),
    comisionTieneIva: booleano(d, "comisionTieneIva"),
    activo: booleano(d, "activo"),
    notas: texto(d, "notas"),
  };

  const id = texto(d, "id");

  try {
    if (id) await prisma.pasarelaPago.update({ where: { id }, data: datos });
    else await prisma.pasarelaPago.create({ data: datos });
  } catch {
    return fallo("No se pudo guardar la pasarela.");
  }

  revalidatePath("/configuracion");
  revalidatePath("/facturas");
  return exito();
}

export async function eliminarPasarela(id: string) {
  const usos = await prisma.pago.count({ where: { pasarelaId: id } });

  // Con pagos registrados se desactiva: borrarla dejaría esos pagos sin
  // explicar por qué se les descontó una comisión.
  if (usos > 0) {
    await prisma.pasarelaPago.update({ where: { id }, data: { activo: false } });
  } else {
    await prisma.pasarelaPago.delete({ where: { id } });
  }

  revalidatePath("/configuracion");
  revalidatePath("/facturas");
}
