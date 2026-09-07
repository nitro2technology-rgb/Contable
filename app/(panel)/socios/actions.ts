"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { TIPOS_MOVIMIENTO_SOCIO } from "@/lib/catalogos";
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

/** Las páginas que cambian cuando se toca un movimiento de socio. */
function revalidarTodo() {
  revalidatePath("/socios");
  revalidatePath("/gastos");
  revalidatePath("/impuestos");
  revalidatePath("/");
}

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

  revalidarTodo();
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

  revalidarTodo();
}

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------

/**
 * Los honorarios son lo único que retribuye trabajo, así que son lo único que
 * la empresa registra como gasto. Un préstamo o un retiro es una cuenta por
 * cobrar; un aporte o un reparto de utilidades es patrimonio. Ninguno de esos
 * baja la utilidad.
 */
function generaGasto(tipo: string): boolean {
  return tipo === "HONORARIOS";
}

/** Descripción del gasto asociado, para que en /gastos se entienda de dónde sale. */
function conceptoGasto(socio: string, concepto: string, factura?: string | null): string {
  const proyecto = factura ? ` · ${factura}` : "";
  return `Honorarios ${socio}${proyecto} — ${concepto}`;
}

export async function guardarMovimiento(
  _estado: EstadoAccion,
  d: FormData
): Promise<EstadoAccion> {
  const socioId = texto(d, "socioId");
  const monto = dinero(d, "monto");
  const concepto = texto(d, "concepto");
  const tipo = opcion(d, "tipo", TIPOS_MOVIMIENTO_SOCIO, "PRESTAMO");
  const facturaId = texto(d, "facturaId") || null;

  if (!socioId) return fallo("Selecciona el socio al que corresponde el movimiento.");
  if (monto <= 0) return fallo("El monto debe ser mayor que cero.");
  if (!concepto) return fallo("Describe el concepto del movimiento.");

  const socio = await prisma.socio.findUnique({ where: { id: socioId }, select: { nombre: true } });
  if (!socio) return fallo("El socio ya no existe.");

  // Solo los honorarios se reparten contra un proyecto; en el resto, guardar el
  // vínculo sugeriría una relación que no existe.
  const facturaVinculada = generaGasto(tipo) ? facturaId : null;

  let numeroFactura: string | null = null;
  if (facturaVinculada) {
    const factura = await prisma.factura.findUnique({
      where: { id: facturaVinculada },
      select: { numero: true, subtotal: true, movimientosSocios: { where: { tipo: "HONORARIOS" }, select: { id: true, monto: true } } },
    });
    if (!factura) return fallo("La factura seleccionada ya no existe.");

    numeroFactura = factura.numero;

    // No se puede repartir más de lo facturado: el resto de lo cobrado tiene que
    // cubrir los gastos y los impuestos del proyecto.
    const id = texto(d, "id");
    const yaRepartido = factura.movimientosSocios
      .filter((m) => m.id !== id)
      .reduce((a, m) => a + num(m.monto), 0);

    const base = num(factura.subtotal);
    if (yaRepartido + monto > base) {
      const libre = base - yaRepartido;
      return fallo(
        `Excede lo facturado. De ${Math.round(base).toLocaleString("es-CO")} quedan ${Math.round(libre).toLocaleString("es-CO")} sin repartir.`
      );
    }
  }

  const fecha = fechaDe(d, "fecha");

  const datos = {
    socioId,
    fecha,
    tipo,
    monto,
    concepto,
    notas: texto(d, "notas"),
    fechaCompromiso: fechaOpcional(d, "fechaCompromiso"),
    facturaId: facturaVinculada,
  };

  const id = texto(d, "id");

  // El gasto espejo se crea, actualiza o borra en la misma transacción que el
  // movimiento: si se guardaran por separado, un fallo a medias dejaría la
  // utilidad descuadrada respecto a la cuenta del socio.
  const datosGasto = {
    fecha,
    concepto: conceptoGasto(socio.nombre, concepto, numeroFactura),
    proveedor: socio.nombre,
    categoria: "HONORARIOS" as const,
    base: monto,
    tasaIva: 0,
    ivaValor: 0,
    total: monto,
    ivaDescontable: false,
    deducible: true,
    notas: "Generado desde el módulo de socios.",
  };

  try {
    if (id) {
      const previo = await prisma.movimientoSocio.findUnique({
        where: { id },
        select: { gasto: { select: { id: true } } },
      });

      await prisma.$transaction(async (tx) => {
        await tx.movimientoSocio.update({ where: { id }, data: datos });

        if (generaGasto(tipo)) {
          if (previo?.gasto) {
            await tx.gasto.update({ where: { id: previo.gasto.id }, data: datosGasto });
          } else {
            await tx.gasto.create({ data: { ...datosGasto, movimientoSocioId: id } });
          }
        } else if (previo?.gasto) {
          // Cambió de honorarios a otro tipo: el gasto deja de existir.
          await tx.gasto.delete({ where: { id: previo.gasto.id } });
        }
      });
    } else {
      await prisma.$transaction(async (tx) => {
        const creado = await tx.movimientoSocio.create({ data: datos });
        if (generaGasto(tipo)) {
          await tx.gasto.create({ data: { ...datosGasto, movimientoSocioId: creado.id } });
        }
      });
    }
  } catch {
    return fallo("No se pudo guardar el movimiento.");
  }

  revalidarTodo();
  return exito();
}

export async function eliminarMovimiento(id: string) {
  // El gasto asociado cae en cascada por la relación, así que no quedan gastos
  // huérfanos ni utilidad inflada.
  await prisma.movimientoSocio.delete({ where: { id } });
  revalidarTodo();
}
