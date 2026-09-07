"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { PERIODICIDADES } from "@/lib/catalogos";
import { obtenerConfig } from "@/lib/consultas";
import { calcularFactura } from "@/lib/fiscal";
import {
  booleano,
  dinero,
  entero,
  exito,
  fallo,
  fechaDe,
  fechaOpcional,
  opcion,
  texto,
} from "@/lib/formulario";
import { siguienteNumero } from "../facturas/actions";

function revalidarTodo() {
  revalidatePath("/suscripciones");
  revalidatePath("/facturas");
  revalidatePath("/impuestos");
  revalidatePath("/");
}

export async function guardarSuscripcion(
  _estado: EstadoAccion,
  d: FormData
): Promise<EstadoAccion> {
  const clienteId = texto(d, "clienteId");
  const servicioId = texto(d, "servicioId");
  const monto = dinero(d, "monto");

  if (!clienteId) return fallo("Selecciona el cliente.");
  if (!servicioId) return fallo("Selecciona el servicio que se cobra.");
  if (monto <= 0) return fallo("El valor por periodo debe ser mayor que cero.");

  const datos = {
    clienteId,
    servicioId,
    monto,
    periodicidad: opcion(d, "periodicidad", PERIODICIDADES, "MENSUAL"),
    // Se limita a 28 para que el cobro exista en todos los meses, febrero incluido.
    diaFacturacion: Math.min(Math.max(entero(d, "diaFacturacion", 1), 1), 28),
    diasPlazo: Math.max(entero(d, "diasPlazo", 30), 0),
    fechaInicio: fechaDe(d, "fechaInicio"),
    fechaFin: fechaOpcional(d, "fechaFin"),
    activo: booleano(d, "activo"),
    notas: texto(d, "notas"),
  };

  const id = texto(d, "id");

  try {
    if (id) await prisma.suscripcion.update({ where: { id }, data: datos });
    else await prisma.suscripcion.create({ data: datos });
  } catch {
    return fallo("No se pudo guardar la suscripción.");
  }

  revalidarTodo();
  return exito();
}

export async function eliminarSuscripcion(id: string) {
  const facturas = await prisma.factura.count({ where: { suscripcionId: id } });

  // Si ya emitió facturas se desactiva en lugar de borrarse: eliminarla dejaría
  // esas facturas sin explicar de dónde salieron.
  if (facturas > 0) {
    await prisma.suscripcion.update({ where: { id }, data: { activo: false } });
  } else {
    await prisma.suscripcion.delete({ where: { id } });
  }

  revalidarTodo();
}

/**
 * Emite la factura de un periodo. Es idempotente: si ya existe la factura de
 * esa suscripción para ese mes, no la duplica — el botón se puede pulsar dos
 * veces sin cobrarle dos veces al cliente.
 */
export async function generarFactura(suscripcionId: string, anio: number, mes: number) {
  const s = await prisma.suscripcion.findUnique({
    where: { id: suscripcionId },
    include: { cliente: true, servicio: true },
  });
  if (!s || !s.activo) return;

  const inicioMes = new Date(Date.UTC(anio, mes, 1));
  const finMes = new Date(Date.UTC(anio, mes + 1, 1));

  const existente = await prisma.factura.findFirst({
    where: { suscripcionId, fechaEmision: { gte: inicioMes, lt: finMes } },
    select: { id: true },
  });
  if (existente) return;

  const config = await obtenerConfig();
  const monto = num(s.monto);

  const totales = calcularFactura(
    [
      {
        cantidad: 1,
        precioUnitario: monto,
        tratamientoIva: s.servicio.tratamientoIva,
        conceptoRetefuente: s.servicio.conceptoRetefuente,
      },
    ],
    {
      practicaRetefuente: s.cliente.practicaRetefuente,
      practicaReteIva: s.cliente.practicaReteIva,
      practicaReteIca: s.cliente.practicaReteIca,
      tarifaReteIcaPorMil: num(s.cliente.tarifaReteIcaPorMil),
    },
    config.valorUvt
  );

  const linea = totales.lineas[0];
  const fechaEmision = new Date(Date.UTC(anio, mes, s.diaFacturacion, 12));
  const fechaVencimiento = new Date(fechaEmision.getTime() + s.diasPlazo * 86_400_000);

  const periodo = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(inicioMes);

  await prisma.factura.create({
    data: {
      numero: await siguienteNumero(),
      clienteId: s.clienteId,
      suscripcionId: s.id,
      fechaEmision,
      fechaVencimiento,
      estado: "EMITIDA",
      proyecto: `${s.servicio.nombre} — ${periodo}`,
      subtotal: totales.subtotal,
      ivaTotal: totales.ivaTotal,
      retefuente: totales.retefuente,
      reteIva: totales.reteIva,
      reteIca: totales.reteIca,
      total: totales.total,
      netoACobrar: totales.netoACobrar,
      items: {
        create: {
          servicioId: s.servicioId,
          descripcion: `${s.servicio.nombre} — ${periodo}`,
          cantidad: 1,
          precioUnitario: monto,
          tratamientoIva: linea.tratamientoIva,
          conceptoRetefuente: linea.conceptoRetefuente,
          tasaIva: linea.tasaIva,
          tasaRetefuente: linea.tasaRetefuente,
          base: linea.base,
          ivaValor: linea.ivaValor,
        },
      },
    },
  });

  revalidarTodo();
}
