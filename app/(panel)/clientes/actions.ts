"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/components/dialog";
import { prisma } from "@/lib/db";
import { booleano, decimal, exito, fallo, opcion, texto } from "@/lib/formulario";

const TIPOS = ["NATURAL", "JURIDICA"] as const;

export async function guardarCliente(
  _estado: EstadoAccion,
  d: FormData
): Promise<EstadoAccion> {
  const nombre = texto(d, "nombre");
  if (!nombre) return fallo("El nombre del cliente es obligatorio.");

  const datos = {
    nombre,
    nit: texto(d, "nit"),
    tipoPersona: opcion(d, "tipoPersona", TIPOS, "JURIDICA"),
    email: texto(d, "email"),
    telefono: texto(d, "telefono"),
    direccion: texto(d, "direccion"),
    ciudad: texto(d, "ciudad"),
    contacto: texto(d, "contacto"),
    practicaRetefuente: booleano(d, "practicaRetefuente"),
    practicaReteIva: booleano(d, "practicaReteIva"),
    practicaReteIca: booleano(d, "practicaReteIca"),
    tarifaReteIcaPorMil: decimal(d, "tarifaReteIcaPorMil", 9.66),
    notas: texto(d, "notas"),
    activo: booleano(d, "activo"),
  };

  const id = texto(d, "id");

  try {
    if (id) await prisma.cliente.update({ where: { id }, data: datos });
    else await prisma.cliente.create({ data: datos });
  } catch {
    return fallo("No se pudo guardar el cliente. Revisa los datos e inténtalo de nuevo.");
  }

  revalidatePath("/clientes");
  revalidatePath("/");
  return exito();
}

export async function eliminarCliente(id: string) {
  const facturas = await prisma.factura.count({ where: { clienteId: id } });

  // Un cliente con historia de facturacion no se borra: se archiva. Borrarlo
  // dejaria facturas huerfanas y rompería la trazabilidad contable.
  if (facturas > 0) {
    await prisma.cliente.update({ where: { id }, data: { activo: false } });
  } else {
    await prisma.cliente.delete({ where: { id } });
  }

  revalidatePath("/clientes");
  revalidatePath("/");
}
