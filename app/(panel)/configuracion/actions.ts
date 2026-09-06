"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/components/dialog";
import { prisma } from "@/lib/db";
import { decimal, dinero, exito, fallo, opcion, texto } from "@/lib/formulario";

const PERIODICIDADES = ["BIMESTRAL", "CUATRIMESTRAL"] as const;

export async function guardarConfiguracion(
  _estado: EstadoAccion,
  d: FormData
): Promise<EstadoAccion> {
  const valorUvt = dinero(d, "valorUvt");
  if (valorUvt <= 0) return fallo("El valor de la UVT debe ser mayor que cero.");

  const datos = {
    razonSocial: texto(d, "razonSocial") || "Nitro2Tech S.A.S.",
    nit: texto(d, "nit"),
    direccion: texto(d, "direccion"),
    ciudad: texto(d, "ciudad"),
    telefono: texto(d, "telefono"),
    email: texto(d, "email"),
    valorUvt,
    periodicidadIva: opcion(d, "periodicidadIva", PERIODICIDADES, "BIMESTRAL"),
    tarifaIcaPorMil: decimal(d, "tarifaIcaPorMil", 9.66),
    // La tarifa se captura en porcentaje y se guarda como fracción.
    tarifaRenta: Math.min(Math.max(decimal(d, "tarifaRenta", 35) / 100, 0), 1),
  };

  try {
    await prisma.configuracion.upsert({
      where: { id: 1 },
      create: { id: 1, ...datos },
      update: datos,
    });
  } catch {
    return fallo("No se pudo guardar la configuración.");
  }

  revalidatePath("/", "layout");
  return exito();
}
