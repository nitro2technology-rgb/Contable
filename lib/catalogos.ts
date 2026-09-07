/**
 * Listas de opciones compartidas entre formularios y acciones de servidor.
 *
 * Viven aparte porque un módulo `"use server"` solo puede exportar funciones
 * asíncronas: si una constante se exportara desde ahí, el build falla.
 */

export const CATEGORIAS_GASTO = [
  "SERVIDORES",
  "APIS",
  "DOMINIOS",
  "SOFTWARE",
  "MARKETING",
  "NOMINA",
  "HONORARIOS",
  "BANCARIO",
  "OFICINA",
  "LEGAL_CONTABLE",
  "IMPUESTOS",
  "EQUIPOS",
  "VIAJES",
  "OTRO",
] as const;

export const METODOS_PAGO = [
  "TRANSFERENCIA",
  "EFECTIVO",
  "TARJETA",
  "PSE",
  "NEQUI",
  "DAVIPLATA",
  "OTRO",
] as const;

export const PERIODICIDADES = [
  "MENSUAL",
  "BIMESTRAL",
  "TRIMESTRAL",
  "CUATRIMESTRAL",
  "SEMESTRAL",
  "ANUAL",
] as const;

export const TRATAMIENTOS_IVA = ["GRAVADO_19", "GRAVADO_5", "EXENTO", "EXCLUIDO"] as const;

export const CONCEPTOS_RETEFUENTE = [
  "NINGUNO",
  "HONORARIOS",
  "SERVICIOS",
  "COMPRAS",
  "ARRENDAMIENTO",
] as const;

export const CATEGORIAS_SERVICIO = [
  "DESARROLLO",
  "AUTOMATIZACION",
  "CONSULTORIA_DATOS",
  "CLOUD",
  "LICENCIAMIENTO_SAAS",
  "SOPORTE",
  "CAPACITACION",
  "OTRO",
] as const;

export const TIPOS_MOVIMIENTO_SOCIO = [
  "PRESTAMO",
  "RETIRO",
  "ABONO",
  "HONORARIOS",
  "APORTE_CAPITAL",
  "DISTRIBUCION_UTILIDADES",
] as const;

/** Cuántos meses cubre cada periodicidad, para normalizar a costo mensual. */
export const MESES_POR_PERIODO = {
  MENSUAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  CUATRIMESTRAL: 4,
  SEMESTRAL: 6,
  ANUAL: 12,
} as const;
