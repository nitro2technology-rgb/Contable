"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ConceptoRetefuente, TratamientoIva } from "@prisma/client";
import type { EstadoAccion } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { obtenerConfig } from "@/lib/consultas";
import { calcularFactura, type LineaCalculo } from "@/lib/fiscal";
import { dinero, exito, fallo, fechaDe, opcion, texto } from "@/lib/formulario";

const METODOS = [
  "TRANSFERENCIA",
  "EFECTIVO",
  "TARJETA",
  "PSE",
  "NEQUI",
  "DAVIPLATA",
  "OTRO",
] as const;

/** Consecutivo FV-0001, FV-0002… derivado del último número emitido. */
export async function siguienteNumero(): Promise<string> {
  const ultima = await prisma.factura.findFirst({
    orderBy: { creadoEn: "desc" },
    select: { numero: true },
  });

  const digitos = ultima?.numero.match(/(\d+)\s*$/)?.[1];
  const siguiente = digitos ? Number(digitos) + 1 : 1;
  return `FV-${String(siguiente).padStart(4, "0")}`;
}

type LineaEntrada = {
  servicioId?: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  tratamientoIva: TratamientoIva;
  conceptoRetefuente: ConceptoRetefuente;
};

function leerLineas(d: FormData): LineaEntrada[] {
  try {
    const crudo = JSON.parse(String(d.get("items") ?? "[]"));
    if (!Array.isArray(crudo)) return [];

    return crudo
      .map((l: Record<string, unknown>) => ({
        servicioId: (l.servicioId as string) || null,
        descripcion: String(l.descripcion ?? "").trim(),
        cantidad: Number(l.cantidad) || 0,
        precioUnitario: Number(l.precioUnitario) || 0,
        tratamientoIva: (l.tratamientoIva as TratamientoIva) ?? "GRAVADO_19",
        conceptoRetefuente: (l.conceptoRetefuente as ConceptoRetefuente) ?? "SERVICIOS",
      }))
      .filter((l) => l.descripcion && l.cantidad > 0);
  } catch {
    return [];
  }
}

export async function guardarFactura(
  _estado: EstadoAccion,
  d: FormData
): Promise<EstadoAccion> {
  const clienteId = texto(d, "clienteId");
  if (!clienteId) return fallo("Selecciona un cliente.");

  const lineas = leerLineas(d);
  if (lineas.length === 0) return fallo("Agrega al menos un concepto con descripción y cantidad.");

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return fallo("El cliente ya no existe.");

  const config = await obtenerConfig();

  const totales = calcularFactura(
    lineas as LineaCalculo[],
    {
      practicaRetefuente: cliente.practicaRetefuente,
      practicaReteIva: cliente.practicaReteIva,
      practicaReteIca: cliente.practicaReteIca,
      tarifaReteIcaPorMil: num(cliente.tarifaReteIcaPorMil),
    },
    config.valorUvt
  );

  const fechaEmision = fechaDe(d, "fechaEmision");
  const fechaVencimiento = fechaDe(d, "fechaVencimiento", fechaEmision);

  const cabecera = {
    clienteId,
    fechaEmision,
    fechaVencimiento,
    estado: opcion(d, "estado", ["BORRADOR", "EMITIDA"] as const, "EMITIDA"),
    proyecto: texto(d, "proyecto"),
    notas: texto(d, "notas"),
    subtotal: totales.subtotal,
    ivaTotal: totales.ivaTotal,
    retefuente: totales.retefuente,
    reteIva: totales.reteIva,
    reteIca: totales.reteIca,
    total: totales.total,
    netoACobrar: totales.netoACobrar,
  };

  const itemsData = totales.lineas.map((l, i) => ({
    servicioId: lineas[i].servicioId || null,
    descripcion: lineas[i].descripcion,
    cantidad: l.cantidad,
    precioUnitario: l.precioUnitario,
    tratamientoIva: l.tratamientoIva,
    conceptoRetefuente: l.conceptoRetefuente,
    tasaIva: l.tasaIva,
    tasaRetefuente: l.tasaRetefuente,
    base: l.base,
    ivaValor: l.ivaValor,
    orden: i,
  }));

  const id = texto(d, "id");
  let facturaId = id;

  try {
    if (id) {
      // Las líneas se reemplazan por completo: recalcular en sitio abriría la
      // puerta a que los totales y el detalle se desincronicen.
      await prisma.$transaction([
        prisma.facturaItem.deleteMany({ where: { facturaId: id } }),
        prisma.factura.update({
          where: { id },
          data: { ...cabecera, items: { create: itemsData } },
        }),
      ]);
    } else {
      const creada = await prisma.factura.create({
        data: {
          ...cabecera,
          numero: texto(d, "numero") || (await siguienteNumero()),
          items: { create: itemsData },
        },
      });
      facturaId = creada.id;
    }
  } catch (e) {
    const mensaje = e instanceof Error && e.message.includes("Unique") ? "Ese número de factura ya existe." : "No se pudo guardar la factura.";
    return fallo(mensaje);
  }

  revalidatePath("/facturas");
  revalidatePath("/");
  revalidatePath("/impuestos");
  redirect(`/facturas/${facturaId}`);
}

// ---------------------------------------------------------------------------
// Pagos
// ---------------------------------------------------------------------------

export async function registrarPago(
  _estado: EstadoAccion,
  d: FormData
): Promise<EstadoAccion> {
  const facturaId = texto(d, "facturaId");
  const monto = dinero(d, "monto");

  if (!facturaId) return fallo("Factura no identificada.");
  if (monto <= 0) return fallo("El monto del pago debe ser mayor que cero.");

  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { pagos: { select: { monto: true } } },
  });
  if (!factura) return fallo("La factura ya no existe.");

  const pagadoAntes = factura.pagos.reduce((a, p) => a + num(p.monto), 0);
  const saldo = num(factura.netoACobrar) - pagadoAntes;

  if (monto > saldo + 1) {
    return fallo(
      `El pago supera el saldo pendiente. Quedan por cobrar ${Math.round(saldo).toLocaleString("es-CO")} COP.`
    );
  }

  await prisma.pago.create({
    data: {
      facturaId,
      fecha: fechaDe(d, "fecha"),
      monto,
      metodo: opcion(d, "metodo", METODOS, "TRANSFERENCIA"),
      referencia: texto(d, "referencia"),
      notas: texto(d, "notas"),
    },
  });

  await sincronizarEstado(facturaId);

  revalidatePath(`/facturas/${facturaId}`);
  revalidatePath("/facturas");
  revalidatePath("/");
  return exito();
}

export async function eliminarPago(pagoId: string, facturaId: string) {
  await prisma.pago.delete({ where: { id: pagoId } });
  await sincronizarEstado(facturaId);

  revalidatePath(`/facturas/${facturaId}`);
  revalidatePath("/facturas");
  revalidatePath("/");
}

/**
 * Deriva el estado de la factura a partir de sus pagos y su fecha de
 * vencimiento. El estado nunca se escribe a mano desde la interfaz salvo para
 * anular: así no puede contradecir a los pagos registrados.
 */
export async function sincronizarEstado(facturaId: string) {
  const f = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { pagos: { select: { monto: true } } },
  });
  if (!f || f.estado === "ANULADA" || f.estado === "BORRADOR") return;

  const pagado = f.pagos.reduce((a, p) => a + num(p.monto), 0);
  const neto = num(f.netoACobrar);

  let estado: "PAGADA" | "PARCIAL" | "VENCIDA" | "EMITIDA";
  if (pagado >= neto - 1) estado = "PAGADA";
  else if (pagado > 0) estado = "PARCIAL";
  else if (new Date(f.fechaVencimiento) < new Date()) estado = "VENCIDA";
  else estado = "EMITIDA";

  if (estado !== f.estado) {
    await prisma.factura.update({ where: { id: facturaId }, data: { estado } });
  }
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

export async function emitirFactura(id: string) {
  await prisma.factura.update({ where: { id }, data: { estado: "EMITIDA" } });
  await sincronizarEstado(id);
  revalidatePath(`/facturas/${id}`);
  revalidatePath("/facturas");
  revalidatePath("/");
}

export async function anularFactura(id: string) {
  await prisma.factura.update({ where: { id }, data: { estado: "ANULADA" } });
  revalidatePath(`/facturas/${id}`);
  revalidatePath("/facturas");
  revalidatePath("/");
  revalidatePath("/impuestos");
}

export async function eliminarFactura(id: string) {
  // Solo se borra lo que nunca salió: un borrador. Lo emitido se anula.
  const f = await prisma.factura.findUnique({ where: { id }, select: { estado: true } });
  if (f?.estado !== "BORRADOR") {
    await anularFactura(id);
    return;
  }

  await prisma.factura.delete({ where: { id } });
  revalidatePath("/facturas");
  revalidatePath("/");
  redirect("/facturas");
}
