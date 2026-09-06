/**
 * Datos de ejemplo para arrancar. Ejecutar con `npm run db:seed`.
 *
 * Todo lo que crea es realista pero ficticio: sirve para ver el panel con
 * cifras dentro antes de cargar la contabilidad real. Es idempotente en lo que
 * puede serlo (upsert por clave natural) y no borra nada existente.
 */

import { PrismaClient } from "@prisma/client";
import { calcularFactura } from "../lib/fiscal";

const prisma = new PrismaClient();

const HOY = new Date();
const ANIO = HOY.getUTCFullYear();

/** Fecha en UTC al mediodía, para que ningún huso la mueva de día. */
function dia(anio: number, mes: number, d: number): Date {
  return new Date(Date.UTC(anio, mes, d, 12));
}

async function main() {
  console.log("Sembrando datos de ejemplo…");

  // --- Configuración -------------------------------------------------------
  await prisma.configuracion.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      razonSocial: "Nitro2Tech S.A.S.",
      nit: "901.456.789-1",
      ciudad: "Bogotá D.C.",
      email: "contabilidad@nitro2tech.com",
      valorUvt: 49799,
      periodicidadIva: "BIMESTRAL",
      tarifaIcaPorMil: 9.66,
      tarifaRenta: 0.35,
    },
    update: {},
  });

  const config = await prisma.configuracion.findUniqueOrThrow({ where: { id: 1 } });
  const valorUvt = config.valorUvt.toNumber();

  // --- Socios --------------------------------------------------------------
  const sociosBase = [
    { nombre: "Socio 1", participacion: 0.5 },
    { nombre: "Socio 2", participacion: 0.5 },
  ];

  const socios = [];
  for (const s of sociosBase) {
    const existente = await prisma.socio.findFirst({ where: { nombre: s.nombre } });
    socios.push(
      existente ??
        (await prisma.socio.create({
          data: { nombre: s.nombre, participacion: s.participacion },
        }))
    );
  }

  if ((await prisma.movimientoSocio.count()) === 0) {
    await prisma.movimientoSocio.createMany({
      data: [
        {
          socioId: socios[0].id,
          fecha: dia(ANIO, 0, 15),
          tipo: "APORTE_CAPITAL",
          monto: 5_000_000,
          concepto: "Aporte inicial de capital",
        },
        {
          socioId: socios[1].id,
          fecha: dia(ANIO, 0, 15),
          tipo: "APORTE_CAPITAL",
          monto: 5_000_000,
          concepto: "Aporte inicial de capital",
        },
        {
          socioId: socios[0].id,
          fecha: dia(ANIO, 3, 8),
          tipo: "PRESTAMO",
          monto: 3_500_000,
          concepto: "Préstamo para gastos personales",
          fechaCompromiso: dia(ANIO, 9, 8),
        },
        {
          socioId: socios[0].id,
          fecha: dia(ANIO, 6, 20),
          tipo: "ABONO",
          monto: 1_200_000,
          concepto: "Abono parcial al préstamo de abril",
        },
        {
          socioId: socios[1].id,
          fecha: dia(ANIO, 5, 3),
          tipo: "RETIRO",
          monto: 800_000,
          concepto: "Retiro de caja para equipo portátil personal",
        },
      ],
    });
  }

  // --- Catálogo de servicios ----------------------------------------------
  const catalogo = [
    {
      nombre: "Desarrollo de software a la medida",
      categoria: "DESARROLLO" as const,
      precioBase: 8_500_000,
      tratamientoIva: "GRAVADO_19" as const,
      conceptoRetefuente: "HONORARIOS" as const,
      descripcion: "Construcción de aplicaciones e integraciones por proyecto.",
    },
    {
      nombre: "Automatización de procesos",
      categoria: "AUTOMATIZACION" as const,
      precioBase: 4_200_000,
      tratamientoIva: "GRAVADO_19" as const,
      conceptoRetefuente: "SERVICIOS" as const,
      descripcion: "Flujos automatizados sobre las herramientas del cliente.",
    },
    {
      nombre: "Consultoría de datos",
      categoria: "CONSULTORIA_DATOS" as const,
      precioBase: 6_000_000,
      tratamientoIva: "GRAVADO_19" as const,
      conceptoRetefuente: "HONORARIOS" as const,
      descripcion: "Diagnóstico, modelado y tableros analíticos.",
    },
    {
      nombre: "Licenciamiento SaaS mensual",
      categoria: "LICENCIAMIENTO_SAAS" as const,
      precioBase: 1_800_000,
      tratamientoIva: "EXCLUIDO" as const,
      conceptoRetefuente: "SERVICIOS" as const,
      descripcion:
        "Revisar con el contador: el tratamiento depende de cómo esté estructurado el contrato.",
    },
    {
      nombre: "Soporte y mantenimiento",
      categoria: "SOPORTE" as const,
      precioBase: 1_200_000,
      tratamientoIva: "GRAVADO_19" as const,
      conceptoRetefuente: "SERVICIOS" as const,
      descripcion: "Bolsa mensual de horas de soporte.",
    },
  ];

  const servicios = [];
  for (const s of catalogo) {
    const existente = await prisma.servicio.findFirst({ where: { nombre: s.nombre } });
    servicios.push(existente ?? (await prisma.servicio.create({ data: s })));
  }

  // --- Clientes ------------------------------------------------------------
  const clientesBase = [
    {
      nombre: "Distribuidora Andina S.A.S.",
      nit: "900.123.456-7",
      ciudad: "Bogotá D.C.",
      contacto: "Dirección de operaciones",
      practicaRetefuente: true,
      practicaReteIva: false,
      practicaReteIca: true,
    },
    {
      nombre: "Logística del Caribe Ltda.",
      nit: "830.987.654-3",
      ciudad: "Barranquilla",
      contacto: "Gerencia de tecnología",
      practicaRetefuente: true,
      practicaReteIva: true,
      practicaReteIca: false,
    },
    {
      nombre: "Clínica San Rafael",
      nit: "860.555.111-9",
      ciudad: "Medellín",
      contacto: "Coordinación de sistemas",
      practicaRetefuente: true,
      practicaReteIva: false,
      practicaReteIca: false,
    },
    {
      nombre: "Startup Verde",
      nit: "901.777.222-4",
      ciudad: "Bogotá D.C.",
      contacto: "Fundador",
      practicaRetefuente: false,
      practicaReteIva: false,
      practicaReteIca: false,
    },
  ];

  const clientes = [];
  for (const c of clientesBase) {
    const existente = await prisma.cliente.findFirst({ where: { nit: c.nit } });
    clientes.push(existente ?? (await prisma.cliente.create({ data: c })));
  }

  // --- Facturas ------------------------------------------------------------
  if ((await prisma.factura.count()) === 0) {
    const plan = [
      { cliente: 0, servicio: 0, mes: 0, cantidad: 1, precio: 8_500_000, pagada: true },
      { cliente: 1, servicio: 1, mes: 1, cantidad: 1, precio: 4_200_000, pagada: true },
      { cliente: 2, servicio: 2, mes: 2, cantidad: 1, precio: 6_000_000, pagada: true },
      { cliente: 0, servicio: 4, mes: 3, cantidad: 3, precio: 1_200_000, pagada: true },
      { cliente: 3, servicio: 3, mes: 4, cantidad: 1, precio: 1_800_000, pagada: true },
      { cliente: 1, servicio: 0, mes: 5, cantidad: 1, precio: 11_000_000, pagada: false },
      { cliente: 2, servicio: 1, mes: 6, cantidad: 2, precio: 3_800_000, pagada: false },
      { cliente: 0, servicio: 2, mes: 7, cantidad: 1, precio: 7_500_000, pagada: false },
    ].filter((p) => p.mes <= HOY.getUTCMonth());

    let n = 1;
    for (const p of plan) {
      const cliente = clientes[p.cliente];
      const servicio = servicios[p.servicio];

      const totales = calcularFactura(
        [
          {
            cantidad: p.cantidad,
            precioUnitario: p.precio,
            tratamientoIva: servicio.tratamientoIva,
            conceptoRetefuente: servicio.conceptoRetefuente,
          },
        ],
        {
          practicaRetefuente: cliente.practicaRetefuente,
          practicaReteIva: cliente.practicaReteIva,
          practicaReteIca: cliente.practicaReteIca,
          tarifaReteIcaPorMil: cliente.tarifaReteIcaPorMil.toNumber(),
        },
        valorUvt
      );

      const linea = totales.lineas[0];
      const emision = dia(ANIO, p.mes, 10);
      const vencimiento = dia(ANIO, p.mes + 1, 9);

      const factura = await prisma.factura.create({
        data: {
          numero: `FV-${String(n++).padStart(4, "0")}`,
          clienteId: cliente.id,
          fechaEmision: emision,
          fechaVencimiento: vencimiento,
          estado: p.pagada ? "PAGADA" : vencimiento < HOY ? "VENCIDA" : "EMITIDA",
          proyecto: servicio.nombre,
          subtotal: totales.subtotal,
          ivaTotal: totales.ivaTotal,
          retefuente: totales.retefuente,
          reteIva: totales.reteIva,
          reteIca: totales.reteIca,
          total: totales.total,
          netoACobrar: totales.netoACobrar,
          items: {
            create: {
              servicioId: servicio.id,
              descripcion: servicio.nombre,
              cantidad: p.cantidad,
              precioUnitario: p.precio,
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

      if (p.pagada) {
        await prisma.pago.create({
          data: {
            facturaId: factura.id,
            fecha: dia(ANIO, p.mes + 1, 5),
            monto: totales.netoACobrar,
            metodo: "TRANSFERENCIA",
            referencia: `TRF-${factura.numero}`,
          },
        });
      }
    }
  }

  // --- Gastos fijos --------------------------------------------------------
  const fijos = [
    { concepto: "Hosting y servidores", proveedor: "AWS", categoria: "SERVIDORES" as const, base: 620_000, tasaIva: 0.19, diaCobro: 3 },
    { concepto: "Despliegue frontend", proveedor: "Vercel", categoria: "SERVIDORES" as const, base: 90_000, tasaIva: 0.19, diaCobro: 5 },
    { concepto: "Base de datos gestionada", proveedor: "Neon", categoria: "SERVIDORES" as const, base: 80_000, tasaIva: 0.19, diaCobro: 5 },
    { concepto: "API de modelos de lenguaje", proveedor: "Anthropic", categoria: "APIS" as const, base: 450_000, tasaIva: 0.19, diaCobro: 1 },
    { concepto: "Dominios corporativos", proveedor: "Namecheap", categoria: "DOMINIOS" as const, base: 220_000, tasaIva: 0, diaCobro: 12, periodicidad: "ANUAL" as const },
    { concepto: "Publicidad digital", proveedor: "Google Ads", categoria: "MARKETING" as const, base: 700_000, tasaIva: 0.19, diaCobro: 15 },
    { concepto: "Honorarios de contabilidad", proveedor: "Contador externo", categoria: "LEGAL_CONTABLE" as const, base: 850_000, tasaIva: 0, diaCobro: 25 },
  ];

  if ((await prisma.gastoRecurrente.count()) === 0) {
    for (const f of fijos) {
      await prisma.gastoRecurrente.create({
        data: {
          concepto: f.concepto,
          proveedor: f.proveedor,
          categoria: f.categoria,
          base: f.base,
          tasaIva: f.tasaIva,
          diaCobro: f.diaCobro,
          periodicidad: f.periodicidad ?? "MENSUAL",
          fechaInicio: dia(ANIO, 0, 1),
        },
      });
    }
  }

  // --- Gastos reales -------------------------------------------------------
  if ((await prisma.gasto.count()) === 0) {
    const plantillas = await prisma.gastoRecurrente.findMany();
    const datos = [];

    for (let mes = 0; mes <= HOY.getUTCMonth(); mes++) {
      for (const p of plantillas) {
        // Los anuales solo se cargan en su mes.
        if (p.periodicidad === "ANUAL" && mes !== 0) continue;

        const base = p.base.toNumber();
        const ivaValor = Math.round(base * p.tasaIva.toNumber());

        datos.push({
          fecha: dia(ANIO, mes, p.diaCobro),
          concepto: `${p.concepto} — mes ${mes + 1}`,
          proveedor: p.proveedor,
          categoria: p.categoria,
          base,
          tasaIva: p.tasaIva.toNumber(),
          ivaValor,
          total: base + ivaValor,
          ivaDescontable: p.ivaDescontable,
          deducible: p.deducible,
          recurrenteId: p.id,
        });
      }
    }

    // Un par de gastos puntuales, para que no todo sea recurrente.
    datos.push(
      {
        fecha: dia(ANIO, 1, 22),
        concepto: "Portátil para desarrollo",
        proveedor: "Distribuidor de tecnología",
        categoria: "EQUIPOS" as const,
        base: 5_800_000,
        tasaIva: 0.19,
        ivaValor: 1_102_000,
        total: 6_902_000,
        ivaDescontable: true,
        deducible: true,
        recurrenteId: null,
      },
      {
        fecha: dia(ANIO, 4, 9),
        concepto: "Comisiones bancarias del semestre",
        proveedor: "Banco",
        categoria: "BANCARIO" as const,
        base: 180_000,
        tasaIva: 0,
        ivaValor: 0,
        total: 180_000,
        ivaDescontable: false,
        deducible: true,
        recurrenteId: null,
      }
    );

    await prisma.gasto.createMany({ data: datos });
  }

  const [nFacturas, nGastos, nClientes] = await Promise.all([
    prisma.factura.count(),
    prisma.gasto.count(),
    prisma.cliente.count(),
  ]);

  console.log(
    `Listo: ${nClientes} clientes, ${nFacturas} facturas, ${nGastos} gastos, ${socios.length} socios.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
