/**
 * Reglas tributarias colombianas para una S.A.S.
 *
 * Punto clave del documento de especificaciones: como persona juridica NO hay
 * tope minimo para cobrar IVA. Se es responsable desde el primer peso facturado.
 * Por eso ninguna funcion de este archivo consulta un umbral de ingresos para
 * decidir si se cobra IVA — solo el tratamiento del servicio decide la tarifa.
 *
 * Las bases minimas en UVT si aplican a la RETENCION EN LA FUENTE, que es un
 * impuesto distinto (renta) y opera con topes por concepto.
 */

import type { ConceptoRetefuente, TratamientoIva } from "@prisma/client";

// ---------------------------------------------------------------------------
// IVA
// ---------------------------------------------------------------------------

export const TASAS_IVA: Record<TratamientoIva, number> = {
  GRAVADO_19: 0.19,
  GRAVADO_5: 0.05,
  EXENTO: 0,
  EXCLUIDO: 0,
};

export const ETIQUETAS_IVA: Record<TratamientoIva, string> = {
  GRAVADO_19: "Gravado 19%",
  GRAVADO_5: "Gravado 5%",
  EXENTO: "Exento (0%)",
  EXCLUIDO: "Excluido",
};

export const DESCRIPCION_IVA: Record<TratamientoIva, string> = {
  GRAVADO_19:
    "Tarifa general. Desarrollo de software a la medida, automatizacion y consultoria de datos.",
  GRAVADO_5: "Tarifa diferencial del 5%, para los bienes y servicios que la ley lista expresamente.",
  EXENTO:
    "Tarifa 0% CON derecho a descontar el IVA de los costos. Caso tipico: exportacion de servicios prestados a un cliente sin domicilio en Colombia (requiere el contrato registrado).",
  EXCLUIDO:
    "Fuera del ambito del IVA y SIN derecho a descontables. El IVA de los costos asociados se vuelve mayor valor del gasto.",
};

export function tasaIva(tratamiento: TratamientoIva): number {
  return TASAS_IVA[tratamiento];
}

/** Un tratamiento da derecho a descontar el IVA de los costos asociados. */
export function permiteDescontables(tratamiento: TratamientoIva): boolean {
  return tratamiento !== "EXCLUIDO";
}

// ---------------------------------------------------------------------------
// Retencion en la fuente a titulo de renta
// ---------------------------------------------------------------------------

/**
 * Tarifas y bases minimas por concepto. Las bases se expresan en UVT y se
 * comparan contra la base gravable del pago.
 */
export const RETEFUENTE: Record<
  ConceptoRetefuente,
  { etiqueta: string; tasa: number; baseUvt: number; nota: string }
> = {
  NINGUNO: {
    etiqueta: "No aplica",
    tasa: 0,
    baseUvt: 0,
    nota: "El cliente no practica retencion sobre este concepto.",
  },
  HONORARIOS: {
    etiqueta: "Honorarios y consultoria",
    tasa: 0.11,
    baseUvt: 0,
    nota: "11% para personas juridicas. No tiene base minima en UVT.",
  },
  SERVICIOS: {
    etiqueta: "Servicios generales",
    tasa: 0.04,
    baseUvt: 4,
    nota: "4% para declarantes de renta, con base minima de 4 UVT.",
  },
  COMPRAS: {
    etiqueta: "Compras generales",
    tasa: 0.025,
    baseUvt: 27,
    nota: "2,5% para declarantes, con base minima de 27 UVT.",
  },
  ARRENDAMIENTO: {
    etiqueta: "Arrendamiento de bienes muebles",
    tasa: 0.04,
    baseUvt: 0,
    nota: "4% sobre el valor del canon.",
  },
};

/** Porcentaje del IVA facturado que retienen los agentes de retencion de IVA. */
export const TASA_RETEIVA = 0.15;

// ---------------------------------------------------------------------------
// Calculo de una factura
// ---------------------------------------------------------------------------

export type LineaCalculo = {
  cantidad: number;
  precioUnitario: number;
  tratamientoIva: TratamientoIva;
  conceptoRetefuente: ConceptoRetefuente;
};

export type ClienteFiscal = {
  practicaRetefuente: boolean;
  practicaReteIva: boolean;
  practicaReteIca: boolean;
  tarifaReteIcaPorMil: number;
};

export type LineaCalculada = LineaCalculo & {
  tasaIva: number;
  tasaRetefuente: number;
  base: number;
  ivaValor: number;
};

export type TotalesFactura = {
  lineas: LineaCalculada[];
  subtotal: number;
  ivaTotal: number;
  retefuente: number;
  reteIva: number;
  reteIca: number;
  total: number;
  netoACobrar: number;
  /** Desglose del IVA por tarifa, para la declaracion. */
  ivaPorTratamiento: { tratamiento: TratamientoIva; base: number; iva: number }[];
};

/**
 * Redondeo a peso colombiano. La DIAN no maneja centavos en las declaraciones y
 * la facturacion electronica se expresa en pesos enteros.
 */
export function redondearPeso(valor: number): number {
  return Math.round(valor);
}

export function calcularFactura(
  lineas: LineaCalculo[],
  cliente: ClienteFiscal,
  valorUvt: number
): TotalesFactura {
  const calculadas: LineaCalculada[] = lineas.map((linea) => {
    const base = redondearPeso(linea.cantidad * linea.precioUnitario);
    const tIva = tasaIva(linea.tratamientoIva);
    const reglaRete = RETEFUENTE[linea.conceptoRetefuente];

    return {
      ...linea,
      tasaIva: tIva,
      tasaRetefuente: reglaRete.tasa,
      base,
      ivaValor: redondearPeso(base * tIva),
    };
  });

  const subtotal = calculadas.reduce((acc, l) => acc + l.base, 0);
  const ivaTotal = calculadas.reduce((acc, l) => acc + l.ivaValor, 0);

  // Retefuente: se evalua por concepto, agrupando las lineas que comparten
  // concepto — la base minima en UVT se compara contra el total del concepto en
  // el mismo documento, no contra cada linea por separado.
  let retefuente = 0;
  if (cliente.practicaRetefuente) {
    const porConcepto = new Map<ConceptoRetefuente, number>();
    for (const l of calculadas) {
      porConcepto.set(
        l.conceptoRetefuente,
        (porConcepto.get(l.conceptoRetefuente) ?? 0) + l.base
      );
    }
    for (const [concepto, base] of porConcepto) {
      const regla = RETEFUENTE[concepto];
      if (regla.tasa === 0) continue;
      const baseMinima = regla.baseUvt * valorUvt;
      if (base >= baseMinima) {
        retefuente += redondearPeso(base * regla.tasa);
      }
    }
  }

  const reteIva = cliente.practicaReteIva ? redondearPeso(ivaTotal * TASA_RETEIVA) : 0;
  const reteIca = cliente.practicaReteIca
    ? redondearPeso(subtotal * (cliente.tarifaReteIcaPorMil / 1000))
    : 0;

  const total = subtotal + ivaTotal;
  const netoACobrar = total - retefuente - reteIva - reteIca;

  const agrupado = new Map<TratamientoIva, { base: number; iva: number }>();
  for (const l of calculadas) {
    const actual = agrupado.get(l.tratamientoIva) ?? { base: 0, iva: 0 };
    agrupado.set(l.tratamientoIva, {
      base: actual.base + l.base,
      iva: actual.iva + l.ivaValor,
    });
  }

  return {
    lineas: calculadas,
    subtotal,
    ivaTotal,
    retefuente,
    reteIva,
    reteIca,
    total,
    netoACobrar,
    ivaPorTratamiento: [...agrupado.entries()].map(([tratamiento, v]) => ({
      tratamiento,
      ...v,
    })),
  };
}


// ---------------------------------------------------------------------------
// Pasarelas de pago
// ---------------------------------------------------------------------------

/** IVA que grava la comision de una pasarela de pago en Colombia. */
export const IVA_COMISION = 0.19;

export type Pasarela = {
  porcentaje: number;
  fijo: number;
  comisionTieneIva: boolean;
};

export type ComisionCalculada = {
  /** Comision retenida, sin IVA. */
  comision: number;
  /** IVA sobre la comision. Es descontable, como el de cualquier otro costo. */
  comisionIva: number;
  /** Lo que realmente llega a la cuenta. */
  neto: number;
  /** Coste total de cobrar por esta via, para compararlo entre pasarelas. */
  costoTotal: number;
};

/**
 * Reparte lo que paga el cliente entre lo que se queda la pasarela y lo que
 * entra a la cuenta.
 *
 * La comision se calcula sobre el monto BRUTO que paga el cliente —IVA de la
 * venta incluido—, porque la pasarela cobra sobre lo que procesa, no sobre la
 * base gravable de la factura.
 */
export function calcularComision(monto: number, pasarela: Pasarela): ComisionCalculada {
  const comision = redondearPeso(monto * pasarela.porcentaje + pasarela.fijo);
  const comisionIva = pasarela.comisionTieneIva ? redondearPeso(comision * IVA_COMISION) : 0;
  const costoTotal = comision + comisionIva;

  return {
    comision,
    comisionIva,
    neto: monto - costoTotal,
    costoTotal,
  };
}

// ---------------------------------------------------------------------------
// Periodos de declaracion
// ---------------------------------------------------------------------------

export type PeriodoIva = {
  clave: string;
  etiqueta: string;
  inicio: Date;
  fin: Date;
};

const NOMBRES_BIMESTRE = [
  "Ene - Feb",
  "Mar - Abr",
  "May - Jun",
  "Jul - Ago",
  "Sep - Oct",
  "Nov - Dic",
];

const NOMBRES_CUATRIMESTRE = ["Ene - Abr", "May - Ago", "Sep - Dic"];

/** Periodos de IVA del anio, segun la periodicidad declarada por la empresa. */
export function periodosIva(anio: number, periodicidad: "BIMESTRAL" | "CUATRIMESTRAL"): PeriodoIva[] {
  const meses = periodicidad === "BIMESTRAL" ? 2 : 4;
  const nombres = periodicidad === "BIMESTRAL" ? NOMBRES_BIMESTRE : NOMBRES_CUATRIMESTRE;

  return nombres.map((etiqueta, i) => {
    const mesInicio = i * meses;
    return {
      clave: `${anio}-P${i + 1}`,
      etiqueta: `${i + 1}. ${etiqueta}`,
      inicio: new Date(Date.UTC(anio, mesInicio, 1)),
      // Fin exclusivo: primer instante del periodo siguiente.
      fin: new Date(Date.UTC(anio, mesInicio + meses, 1)),
    };
  });
}

/**
 * Umbral que define la periodicidad del IVA: 92.000 UVT de ingresos brutos en el
 * anio anterior. Por encima, bimestral; por debajo, cuatrimestral.
 */
export const UVT_UMBRAL_BIMESTRAL = 92_000;

export function periodicidadSugerida(
  ingresosAnioAnterior: number,
  valorUvt: number
): "BIMESTRAL" | "CUATRIMESTRAL" {
  return ingresosAnioAnterior >= UVT_UMBRAL_BIMESTRAL * valorUvt ? "BIMESTRAL" : "CUATRIMESTRAL";
}
