import { cache } from "react";
import type { EstadoFactura } from "@prisma/client";
import { num, prisma } from "./db";
import { MESES_CORTOS } from "./format";
import { periodosIva } from "./fiscal";
import { MESES_POR_PERIODO } from "./catalogos";

/** Estados que representan una venta real y por tanto entran en los informes. */
export const ESTADOS_VIGENTES: EstadoFactura[] = ["EMITIDA", "PARCIAL", "PAGADA", "VENCIDA"];

// ---------------------------------------------------------------------------
// Configuracion
// ---------------------------------------------------------------------------

export const obtenerConfig = cache(async () => {
  const existente = await prisma.configuracion.findUnique({ where: { id: 1 } });
  const c = existente ?? (await prisma.configuracion.create({ data: { id: 1 } }));

  return {
    ...c,
    valorUvt: num(c.valorUvt),
    tarifaIcaPorMil: num(c.tarifaIcaPorMil),
    tarifaRenta: num(c.tarifaRenta),
  };
});

export type Config = Awaited<ReturnType<typeof obtenerConfig>>;

// ---------------------------------------------------------------------------
// Rango del anio
// ---------------------------------------------------------------------------

export function rangoAnio(anio: number) {
  return {
    inicio: new Date(Date.UTC(anio, 0, 1)),
    fin: new Date(Date.UTC(anio + 1, 0, 1)),
  };
}

export async function aniosConMovimiento(): Promise<number[]> {
  const [primeraFactura, primerGasto] = await Promise.all([
    prisma.factura.findFirst({ orderBy: { fechaEmision: "asc" }, select: { fechaEmision: true } }),
    prisma.gasto.findFirst({ orderBy: { fecha: "asc" }, select: { fecha: true } }),
  ]);

  const actual = new Date().getUTCFullYear();
  const candidatos = [primeraFactura?.fechaEmision, primerGasto?.fecha]
    .filter(Boolean)
    .map((d) => new Date(d as Date).getUTCFullYear());

  const desde = candidatos.length ? Math.min(...candidatos) : actual;
  const anios: number[] = [];
  for (let a = actual; a >= desde; a--) anios.push(a);
  return anios;
}

// ---------------------------------------------------------------------------
// Resumen financiero de un periodo
// ---------------------------------------------------------------------------

export type ResumenPeriodo = {
  /** Ingresos causados: base gravable facturada, sin IVA. El IVA no es ingreso. */
  ingresos: number;
  /** Costo real: base del gasto mas el IVA que no podemos descontar. */
  gastos: number;
  utilidad: number;
  /** Dinero efectivamente recibido en el periodo. */
  cobrado: number;
  ivaGenerado: number;
  ivaDescontable: number;
  retefuenteSoportada: number;
  reteIvaSoportada: number;
  reteIcaSoportada: number;
};

const VACIO: ResumenPeriodo = {
  ingresos: 0,
  gastos: 0,
  utilidad: 0,
  cobrado: 0,
  ivaGenerado: 0,
  ivaDescontable: 0,
  retefuenteSoportada: 0,
  reteIvaSoportada: 0,
  reteIcaSoportada: 0,
};

export async function resumenPeriodo(inicio: Date, fin: Date): Promise<ResumenPeriodo> {
  const [facturas, gastos, pagos] = await Promise.all([
    prisma.factura.findMany({
      where: { fechaEmision: { gte: inicio, lt: fin }, estado: { in: ESTADOS_VIGENTES } },
      select: {
        subtotal: true,
        ivaTotal: true,
        retefuente: true,
        reteIva: true,
        reteIca: true,
      },
    }),
    prisma.gasto.findMany({
      where: { fecha: { gte: inicio, lt: fin } },
      select: { base: true, ivaValor: true, ivaDescontable: true },
    }),
    prisma.pago.aggregate({
      where: { fecha: { gte: inicio, lt: fin } },
      _sum: { monto: true },
    }),
  ]);

  const r = { ...VACIO };

  for (const f of facturas) {
    r.ingresos += num(f.subtotal);
    r.ivaGenerado += num(f.ivaTotal);
    r.retefuenteSoportada += num(f.retefuente);
    r.reteIvaSoportada += num(f.reteIva);
    r.reteIcaSoportada += num(f.reteIca);
  }

  for (const g of gastos) {
    const iva = num(g.ivaValor);
    // Si el IVA no es descontable, es mayor valor del gasto y hay que sumarlo
    // al costo en lugar de acreditarlo contra el IVA generado.
    r.gastos += num(g.base) + (g.ivaDescontable ? 0 : iva);
    if (g.ivaDescontable) r.ivaDescontable += iva;
  }

  r.cobrado = num(pagos._sum.monto);
  r.utilidad = r.ingresos - r.gastos;

  return r;
}

// ---------------------------------------------------------------------------
// Serie mensual para el grafico de flujo de caja
// ---------------------------------------------------------------------------

export type PuntoMensual = {
  mes: string;
  ingresos: number;
  gastos: number;
  utilidad: number;
};

export async function flujoMensual(anio: number): Promise<PuntoMensual[]> {
  const { inicio, fin } = rangoAnio(anio);

  const [facturas, gastos] = await Promise.all([
    prisma.factura.findMany({
      where: { fechaEmision: { gte: inicio, lt: fin }, estado: { in: ESTADOS_VIGENTES } },
      select: { fechaEmision: true, subtotal: true },
    }),
    prisma.gasto.findMany({
      where: { fecha: { gte: inicio, lt: fin } },
      select: { fecha: true, base: true, ivaValor: true, ivaDescontable: true },
    }),
  ]);

  const serie: PuntoMensual[] = MESES_CORTOS.map((mes) => ({
    mes,
    ingresos: 0,
    gastos: 0,
    utilidad: 0,
  }));

  for (const f of facturas) {
    serie[new Date(f.fechaEmision).getUTCMonth()].ingresos += num(f.subtotal);
  }
  for (const g of gastos) {
    const iva = num(g.ivaValor);
    serie[new Date(g.fecha).getUTCMonth()].gastos += num(g.base) + (g.ivaDescontable ? 0 : iva);
  }
  for (const p of serie) p.utilidad = p.ingresos - p.gastos;

  // Se recorta el futuro: un mes que aun no llega dibujaria una caida a cero
  // que no significa nada.
  const hoy = new Date();
  if (anio === hoy.getUTCFullYear()) return serie.slice(0, hoy.getUTCMonth() + 1);
  return serie;
}

// ---------------------------------------------------------------------------
// Cartera — lo que nos deben
// ---------------------------------------------------------------------------

export type Cartera = {
  total: number;
  vencido: number;
  facturasAbiertas: number;
};

export async function cartera(): Promise<Cartera> {
  const abiertas = await prisma.factura.findMany({
    where: { estado: { in: ["EMITIDA", "PARCIAL", "VENCIDA"] } },
    select: {
      netoACobrar: true,
      fechaVencimiento: true,
      pagos: { select: { monto: true } },
    },
  });

  const hoy = new Date();
  let total = 0;
  let vencido = 0;

  for (const f of abiertas) {
    const pagado = f.pagos.reduce((a, p) => a + num(p.monto), 0);
    const saldo = num(f.netoACobrar) - pagado;
    if (saldo <= 0) continue;
    total += saldo;
    if (new Date(f.fechaVencimiento) < hoy) vencido += saldo;
  }

  return { total, vencido, facturasAbiertas: abiertas.length };
}

// ---------------------------------------------------------------------------
// Socios — cuentas por cobrar
// ---------------------------------------------------------------------------

export type SaldoSocio = {
  id: string;
  nombre: string;
  participacion: number;
  /**
   * Cuenta corriente del socio, vista desde el socio: NEGATIVA cuando le debe a
   * la empresa. Solo la mueven los prestamos/retiros y los abonos.
   */
  saldo: number;
  /** Lo que ha tomado en prestamos y retiros. */
  prestado: number;
  /** Lo que ha devuelto. */
  abonado: number;
  aportado: number;
  distribuido: number;
  /** Honorarios cobrados por trabajo. No son deuda ni la cancelan. */
  honorarios: number;
  movimientos: number;
  ultimoMovimiento: Date | null;
};

export async function saldosSocios(): Promise<SaldoSocio[]> {
  const socios = await prisma.socio.findMany({
    orderBy: { nombre: "asc" },
    include: { movimientos: { orderBy: { fecha: "desc" } } },
  });

  return socios.map((s) => {
    let prestado = 0;
    let abonado = 0;
    let aportado = 0;
    let distribuido = 0;
    let honorarios = 0;

    for (const m of s.movimientos) {
      const v = num(m.monto);
      switch (m.tipo) {
        case "PRESTAMO":
        case "RETIRO":
          prestado += v;
          break;
        case "ABONO":
          abonado += v;
          break;
        case "HONORARIOS":
          honorarios += v;
          break;
        case "APORTE_CAPITAL":
          aportado += v;
          break;
        case "DISTRIBUCION_UTILIDADES":
          distribuido += v;
          break;
      }
    }

    return {
      id: s.id,
      nombre: s.nombre,
      participacion: num(s.participacion),
      // La deuda solo la crean los prestamos y retiros, y solo la salda un
      // abono explicito. Ni los honorarios ni el reparto de utilidades la
      // tocan: cruzarlos automaticamente hacia desaparecer de la vista lo que
      // el socio realmente debe. Si se quiere saldar un prestamo con una
      // utilidad, se registran los dos movimientos y queda el rastro.
      saldo: abonado - prestado,
      prestado,
      abonado,
      aportado,
      distribuido,
      honorarios,
      movimientos: s.movimientos.length,
      ultimoMovimiento: s.movimientos[0]?.fecha ?? null,
    };
  });
}


/**
 * Reparto de honorarios con cargo a cada factura: cuanto se facturó y cuanto
 * se han repartido ya los socios. Sirve para no repartir mas de lo cobrado.
 */
export type RepartoProyecto = {
  facturaId: string;
  numero: string;
  proyecto: string;
  cliente: string;
  fechaEmision: Date;
  /** Base facturada, sin IVA: es lo que realmente entra a la empresa. */
  base: number;
  repartido: number;
  disponible: number;
  socios: { nombre: string; monto: number }[];
};

export async function repartoPorProyecto(anio?: number): Promise<RepartoProyecto[]> {
  const rango = anio ? rangoAnio(anio) : null;

  const facturas = await prisma.factura.findMany({
    where: {
      estado: { in: ESTADOS_VIGENTES },
      ...(rango ? { fechaEmision: { gte: rango.inicio, lt: rango.fin } } : {}),
    },
    orderBy: { fechaEmision: "desc" },
    select: {
      id: true,
      numero: true,
      proyecto: true,
      fechaEmision: true,
      subtotal: true,
      cliente: { select: { nombre: true } },
      movimientosSocios: {
        where: { tipo: "HONORARIOS" },
        select: { monto: true, socio: { select: { nombre: true } } },
      },
    },
  });

  return facturas.map((f) => {
    const base = num(f.subtotal);
    const porSocio = new Map<string, number>();

    for (const m of f.movimientosSocios) {
      const n = m.socio.nombre;
      porSocio.set(n, (porSocio.get(n) ?? 0) + num(m.monto));
    }

    const repartido = [...porSocio.values()].reduce((a, b) => a + b, 0);

    return {
      facturaId: f.id,
      numero: f.numero,
      proyecto: f.proyecto,
      cliente: f.cliente.nombre,
      fechaEmision: f.fechaEmision,
      base,
      repartido,
      disponible: base - repartido,
      socios: [...porSocio.entries()].map(([nombre, monto]) => ({ nombre, monto })),
    };
  });
}


// ---------------------------------------------------------------------------
// Suscripciones — ingreso recurrente
// ---------------------------------------------------------------------------

/**
 * Ingreso recurrente mensual: lo que entra cada mes sin tener que vender nada
 * nuevo. Es la contraparte del costo fijo mensual, y la comparacion entre los
 * dos dice si la operacion se sostiene sola.
 */
export async function ingresoRecurrenteMensual(): Promise<{
  total: number;
  suscripciones: number;
}> {
  const activas = await prisma.suscripcion.findMany({
    where: { activo: true },
    select: { monto: true, periodicidad: true },
  });

  let total = 0;
  for (const s of activas) {
    total += num(s.monto) / MESES_POR_PERIODO[s.periodicidad];
  }

  return { total, suscripciones: activas.length };
}

// ---------------------------------------------------------------------------
// Gastos fijos mensuales
// ---------------------------------------------------------------------------

/** Costo mensual equivalente de las plantillas de gasto fijo activas. */
export async function costoFijoMensual(): Promise<{ total: number; plantillas: number }> {
  const activos = await prisma.gastoRecurrente.findMany({
    where: { activo: true },
    select: { base: true, tasaIva: true, ivaDescontable: true, periodicidad: true },
  });

  let total = 0;
  for (const g of activos) {
    const base = num(g.base);
    const iva = base * num(g.tasaIva);
    const costo = base + (g.ivaDescontable ? 0 : iva);
    total += costo / MESES_POR_PERIODO[g.periodicidad];
  }

  return { total, plantillas: activos.length };
}

// ---------------------------------------------------------------------------
// Desgloses para los graficos
// ---------------------------------------------------------------------------

export async function gastosPorCategoria(inicio: Date, fin: Date) {
  const filas = await prisma.gasto.groupBy({
    by: ["categoria"],
    where: { fecha: { gte: inicio, lt: fin } },
    _sum: { base: true, ivaValor: true },
  });

  return filas
    .map((f) => ({ categoria: f.categoria, valor: num(f._sum.base) }))
    .sort((a, b) => b.valor - a.valor);
}

export async function ingresosPorCliente(inicio: Date, fin: Date, limite = 8) {
  const facturas = await prisma.factura.findMany({
    where: { fechaEmision: { gte: inicio, lt: fin }, estado: { in: ESTADOS_VIGENTES } },
    select: { subtotal: true, cliente: { select: { id: true, nombre: true } } },
  });

  const mapa = new Map<string, { nombre: string; valor: number }>();
  for (const f of facturas) {
    const actual = mapa.get(f.cliente.id) ?? { nombre: f.cliente.nombre, valor: 0 };
    actual.valor += num(f.subtotal);
    mapa.set(f.cliente.id, actual);
  }

  const ordenado = [...mapa.values()].sort((a, b) => b.valor - a.valor);

  // Nunca se generan tonos nuevos para una serie larga: la cola se pliega en
  // "Otros" y el detalle vive en la tabla de clientes.
  if (ordenado.length <= limite) return ordenado;
  const cabeza = ordenado.slice(0, limite - 1);
  const resto = ordenado.slice(limite - 1).reduce((a, c) => a + c.valor, 0);
  return [...cabeza, { nombre: "Otros", valor: resto }];
}

// ---------------------------------------------------------------------------
// Impuestos
// ---------------------------------------------------------------------------

export type ResumenIva = {
  clave: string;
  etiqueta: string;
  inicio: Date;
  fin: Date;
  generado: number;
  descontable: number;
  reteIvaSoportada: number;
  /** Positivo: saldo a pagar a la DIAN. Negativo: saldo a favor. */
  aPagar: number;
  ventasGravadas: number;
  ventasExentas: number;
  ventasExcluidas: number;
  vigente: boolean;
};

export async function resumenIvaAnual(
  anio: number,
  periodicidad: "BIMESTRAL" | "CUATRIMESTRAL"
): Promise<ResumenIva[]> {
  const periodos = periodosIva(anio, periodicidad);
  const { inicio, fin } = rangoAnio(anio);

  const [facturas, gastos] = await Promise.all([
    prisma.factura.findMany({
      where: { fechaEmision: { gte: inicio, lt: fin }, estado: { in: ESTADOS_VIGENTES } },
      select: {
        fechaEmision: true,
        ivaTotal: true,
        reteIva: true,
        items: { select: { base: true, tratamientoIva: true } },
      },
    }),
    prisma.gasto.findMany({
      where: { fecha: { gte: inicio, lt: fin }, ivaDescontable: true },
      select: { fecha: true, ivaValor: true },
    }),
  ]);

  const hoy = new Date();

  return periodos.map((p) => {
    let generado = 0;
    let reteIvaSoportada = 0;
    let ventasGravadas = 0;
    let ventasExentas = 0;
    let ventasExcluidas = 0;

    for (const f of facturas) {
      const d = new Date(f.fechaEmision);
      if (d < p.inicio || d >= p.fin) continue;
      generado += num(f.ivaTotal);
      reteIvaSoportada += num(f.reteIva);
      for (const it of f.items) {
        const base = num(it.base);
        if (it.tratamientoIva === "EXCLUIDO") ventasExcluidas += base;
        else if (it.tratamientoIva === "EXENTO") ventasExentas += base;
        else ventasGravadas += base;
      }
    }

    let descontable = 0;
    for (const g of gastos) {
      const d = new Date(g.fecha);
      if (d < p.inicio || d >= p.fin) continue;
      descontable += num(g.ivaValor);
    }

    return {
      ...p,
      generado,
      descontable,
      reteIvaSoportada,
      // La retencion de IVA que nos practicaron es un anticipo: se resta del
      // saldo a pagar del periodo.
      aPagar: generado - descontable - reteIvaSoportada,
      ventasGravadas,
      ventasExentas,
      ventasExcluidas,
      vigente: hoy >= p.inicio && hoy < p.fin,
    };
  });
}
