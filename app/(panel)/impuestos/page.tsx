import type { Metadata } from "next";
import { CircleCheck, Info, Landmark, TriangleAlert } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, Table, Td, Th, Tr } from "@/components/ui";
import { StatTile } from "@/components/stats";
import { BarraApilada, SERIES } from "@/components/charts";
import { money, moneyCompact, plain } from "@/lib/format";
import { prisma, num } from "@/lib/db";
import {
  aniosConMovimiento,
  ESTADOS_VIGENTES,
  obtenerConfig,
  rangoAnio,
  resumenIvaAnual,
  resumenPeriodo,
} from "@/lib/consultas";
import { ETIQUETAS_IVA, periodicidadSugerida, UVT_UMBRAL_BIMESTRAL } from "@/lib/fiscal";
import { SelectorAnio } from "../selector-anio";

export const metadata: Metadata = { title: "Impuestos" };
export const dynamic = "force-dynamic";

export default async function PaginaImpuestos({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const { anio: anioParam } = await searchParams;
  const anio = Number(anioParam) || new Date().getUTCFullYear();

  const { inicio, fin } = rangoAnio(anio);
  const anterior = rangoAnio(anio - 1);

  const config = await obtenerConfig();
  const periodicidad = config.periodicidadIva === "CUATRIMESTRAL" ? "CUATRIMESTRAL" : "BIMESTRAL";

  const [periodos, resumen, resumenAnterior, itemsPorTratamiento, anios] = await Promise.all([
    resumenIvaAnual(anio, periodicidad),
    resumenPeriodo(inicio, fin),
    resumenPeriodo(anterior.inicio, anterior.fin),
    prisma.facturaItem.groupBy({
      by: ["tratamientoIva"],
      where: {
        factura: {
          fechaEmision: { gte: inicio, lt: fin },
          estado: { in: ESTADOS_VIGENTES },
        },
      },
      _sum: { base: true, ivaValor: true },
    }),
    aniosConMovimiento(),
  ]);

  const ivaAnual = periodos.reduce((a, p) => a + p.aPagar, 0);
  const sugerida = periodicidadSugerida(resumenAnterior.ingresos, config.valorUvt);
  const periodicidadDesalineada = sugerida !== periodicidad;

  // Renta: la retefuente que nos practicaron durante el año es un anticipo.
  const baseRenta = Math.max(resumen.utilidad, 0);
  const rentaEstimada = Math.round(baseRenta * config.tarifaRenta);
  const rentaPorPagar = rentaEstimada - resumen.retefuenteSoportada;

  const segmentosVenta = itemsPorTratamiento
    .map((t, i) => ({
      nombre: ETIQUETAS_IVA[t.tratamientoIva],
      valor: num(t._sum.base),
      color: SERIES[i],
    }))
    .filter((s) => s.valor > 0);

  return (
    <>
      <PageHeader
        titulo="Impuestos"
        descripcion={`Lo que debemos declarar y pagar en ${anio}. Estimaciones a partir de lo registrado, no sustituyen la declaración del contador.`}
      >
        <SelectorAnio anio={anio} anios={anios} />
      </PageHeader>

      {/* --- Aviso de responsabilidad de IVA -------------------------------- */}
      <div className="mb-5 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
        <Landmark className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
        <p className="text-sm text-ink">
          <strong className="font-semibold">
            Como S.A.S. somos responsables de IVA desde el primer peso facturado.
          </strong>{" "}
          No existe tope mínimo de ingresos: lo que decide la tarifa es el tratamiento de cada
          servicio. Desarrollo, automatización y consultoría de datos van al 19 %; cloud y
          licenciamiento SaaS pueden estar exentos o excluidos según cómo se estructure el contrato.
        </p>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          etiqueta="IVA generado en el año"
          valor={resumen.ivaGenerado}
          nota="Cobrado a los clientes"
          acento="var(--s4)"
        />
        <StatTile
          etiqueta="IVA descontable"
          valor={resumen.ivaDescontable}
          nota="Pagado en gastos"
          acento="var(--s3)"
        />
        <StatTile
          etiqueta="IVA neto del año"
          valor={ivaAnual}
          nota={ivaAnual >= 0 ? "A pagar a la DIAN" : "Saldo a favor"}
          subirEsBueno={false}
          acento="var(--s2)"
        />
        <StatTile
          etiqueta="Retefuente que nos practicaron"
          valor={resumen.retefuenteSoportada}
          nota="Anticipo del impuesto de renta"
          acento="var(--s1)"
        />
      </div>

      {periodicidadDesalineada ? (
        <div className="mb-5 flex gap-3 rounded-xl border border-serious/40 bg-serious/10 px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
          <p className="text-sm text-ink">
            Estás declarando IVA de forma <strong className="font-semibold">{periodicidad.toLowerCase()}</strong>,
            pero con {money(resumenAnterior.ingresos)} de ingresos brutos en {anio - 1} —{" "}
            {plain(resumenAnterior.ingresos / config.valorUvt)} UVT — te correspondería{" "}
            <strong className="font-semibold">{sugerida.toLowerCase()}</strong>. El umbral es{" "}
            {plain(UVT_UMBRAL_BIMESTRAL)} UVT. Ajústalo en Configuración o confírmalo con tu
            contador.
          </p>
        </div>
      ) : null}

      {/* --- IVA por periodo ------------------------------------------------ */}
      <Card className="mb-5">
        <CardHeader
          titulo={`Declaración de IVA — ${periodicidad === "BIMESTRAL" ? "bimestral" : "cuatrimestral"}`}
          descripcion="IVA generado − IVA descontable − ReteIVA que nos practicaron"
        />
        <Table>
          <thead>
            <tr>
              <Th>Periodo</Th>
              <Th numerico>Ventas gravadas</Th>
              <Th numerico>IVA generado</Th>
              <Th numerico>IVA descontable</Th>
              <Th numerico>ReteIVA</Th>
              <Th numerico>Saldo</Th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => {
              const sinMovimiento =
                p.generado === 0 && p.descontable === 0 && p.ventasGravadas === 0;

              return (
                <Tr key={p.clave} className={sinMovimiento ? "opacity-55" : undefined}>
                  <Td>
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-ink">{p.etiqueta}</span>
                      {p.vigente ? <Badge tono="info">En curso</Badge> : null}
                    </span>
                  </Td>
                  <Td numerico className="text-ink-2">
                    {money(p.ventasGravadas)}
                  </Td>
                  <Td numerico>{money(p.generado)}</Td>
                  <Td numerico className="text-ink-2">
                    −{money(p.descontable)}
                  </Td>
                  <Td numerico className="text-ink-2">
                    −{money(p.reteIvaSoportada)}
                  </Td>
                  <Td numerico className="font-medium">
                    {p.aPagar >= 0 ? (
                      money(p.aPagar)
                    ) : (
                      <span className="text-good-text">
                        {money(Math.abs(p.aPagar))} a favor
                      </span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <Td className="font-semibold">Total {anio}</Td>
              <Td numerico className="font-medium">
                {money(periodos.reduce((a, p) => a + p.ventasGravadas, 0))}
              </Td>
              <Td numerico className="font-medium">
                {money(periodos.reduce((a, p) => a + p.generado, 0))}
              </Td>
              <Td numerico className="font-medium">
                −{money(periodos.reduce((a, p) => a + p.descontable, 0))}
              </Td>
              <Td numerico className="font-medium">
                −{money(periodos.reduce((a, p) => a + p.reteIvaSoportada, 0))}
              </Td>
              <Td numerico className="font-semibold">
                {money(ivaAnual)}
              </Td>
            </tr>
          </tfoot>
        </Table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --- Renta ------------------------------------------------------- */}
        <Card>
          <CardHeader
            titulo="Impuesto de renta estimado"
            descripcion={`Tarifa del ${Math.round(config.tarifaRenta * 100)} % sobre la utilidad`}
          />
          <dl className="space-y-2.5 p-5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">Ingresos facturados</dt>
              <dd className="tabular text-ink">{money(resumen.ingresos)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">Gastos operativos</dt>
              <dd className="tabular text-ink">−{money(resumen.gastos)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-edge pt-2.5">
              <dt className="font-medium text-ink">Utilidad antes de impuestos</dt>
              <dd className="tabular font-semibold text-ink">{money(resumen.utilidad)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">
                Renta estimada ({Math.round(config.tarifaRenta * 100)} %)
              </dt>
              <dd className="tabular text-ink">{money(rentaEstimada)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">Menos retefuente ya practicada</dt>
              <dd className="tabular text-good-text">−{money(resumen.retefuenteSoportada)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-edge pt-2.5">
              <dt className="font-medium text-ink">Saldo estimado</dt>
              <dd className="tabular text-lg font-semibold text-ink">
                {rentaPorPagar >= 0 ? money(rentaPorPagar) : `${money(Math.abs(rentaPorPagar))} a favor`}
              </dd>
            </div>
          </dl>
          <div className="border-t border-edge p-5">
            <p className="flex gap-2 text-xs text-ink-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-s1" aria-hidden="true" />
              <span>
                Cálculo simplificado: no incluye renta presuntiva, descuentos tributarios, reserva
                legal, diferencias entre contabilidad y fiscalidad ni anticipos del año siguiente.
                Sirve para provisionar, no para declarar.
              </span>
            </p>
          </div>
        </Card>

        {/* --- Composición de ventas --------------------------------------- */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Ventas por tratamiento de IVA</h2>
            <p className="mb-4 mt-0.5 text-xs text-ink-muted">
              Base facturada en {anio}, agrupada por tarifa
            </p>
            <BarraApilada segmentos={segmentosVenta} />
          </Card>

          <Card>
            <CardHeader titulo="Otras retenciones soportadas" />
            <dl className="space-y-2.5 p-5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">ReteIVA</dt>
                <dd className="tabular text-ink">{money(resumen.reteIvaSoportada)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">ReteICA</dt>
                <dd className="tabular text-ink">{money(resumen.reteIcaSoportada)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-edge pt-2.5">
                <dt className="text-ink-2">Total retenido por clientes</dt>
                <dd className="tabular font-medium text-ink">
                  {money(
                    resumen.retefuenteSoportada +
                      resumen.reteIvaSoportada +
                      resumen.reteIcaSoportada
                  )}
                </dd>
              </div>
            </dl>
            <div className="border-t border-edge p-5">
              <p className="flex gap-2 text-xs text-ink-2">
                <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-good" aria-hidden="true" />
                <span>
                  Ninguna retención es una pérdida: todas son anticipos que se descuentan de la
                  declaración correspondiente. Guarda los certificados que emitan los clientes.
                </span>
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs font-medium text-ink-2">UVT {anio}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
              {money(config.valorUvt)}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Umbral de IVA bimestral: {plain(UVT_UMBRAL_BIMESTRAL)} UVT ={" "}
              {moneyCompact(UVT_UMBRAL_BIMESTRAL * config.valorUvt)} de ingresos brutos.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
