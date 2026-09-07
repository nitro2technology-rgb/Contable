import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CircleCheck,
  Clock,
  Info,
  TriangleAlert,
} from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th, Tr } from "@/components/ui";
import { HeroFigure, Meter, StatTile } from "@/components/stats";
import { BarrasHorizontales, ChartCard, FlujoCajaChart } from "@/components/charts";
import { money, moneyCompact, fecha, humanizar, diasEntre } from "@/lib/format";
import { num, prisma } from "@/lib/db";
import {
  aniosConMovimiento,
  cartera,
  costoFijoMensual,
  ingresoRecurrenteMensual,
  flujoMensual,
  gastosPorCategoria,
  ingresosPorCliente,
  obtenerConfig,
  rangoAnio,
  resumenIvaAnual,
  resumenPeriodo,
  saldosSocios,
} from "@/lib/consultas";
import { SelectorAnio } from "./selector-anio";

export const dynamic = "force-dynamic";

function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return (actual - anterior) / Math.abs(anterior);
}

export default async function Panel({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const { anio: anioParam } = await searchParams;
  const anioActual = new Date().getUTCFullYear();
  const anio = Number(anioParam) || anioActual;

  const { inicio, fin } = rangoAnio(anio);
  const anterior = rangoAnio(anio - 1);

  const config = await obtenerConfig();

  const [
    resumen,
    resumenAnterior,
    serie,
    car,
    fijos,
    socios,
    porCategoria,
    porCliente,
    periodosIvaAnio,
    proximasFacturas,
    anios,
    recurrente,
  ] = await Promise.all([
    resumenPeriodo(inicio, fin),
    resumenPeriodo(anterior.inicio, anterior.fin),
    flujoMensual(anio),
    cartera(),
    costoFijoMensual(),
    saldosSocios(),
    gastosPorCategoria(inicio, fin),
    ingresosPorCliente(inicio, fin),
    resumenIvaAnual(
      anio,
      config.periodicidadIva === "CUATRIMESTRAL" ? "CUATRIMESTRAL" : "BIMESTRAL"
    ),
    prisma.factura.findMany({
      where: { estado: { in: ["EMITIDA", "PARCIAL", "VENCIDA"] } },
      orderBy: { fechaVencimiento: "asc" },
      take: 6,
      include: { cliente: { select: { nombre: true } }, pagos: { select: { monto: true } } },
    }),
    aniosConMovimiento(),
    ingresoRecurrenteMensual(),
  ]);

  // El saldo del socio es negativo cuando debe; la deuda es su valor absoluto.
  const deudaSocios = socios.reduce((a, s) => a + Math.max(-s.saldo, 0), 0);
  const periodoIvaVigente = periodosIvaAnio.find((p) => p.vigente) ?? periodosIvaAnio.at(-1);

  const hoy = new Date();

  return (
    <>
      <PageHeader
        titulo="Flujo de caja"
        descripcion={`Ingresos − Gastos = Utilidad neta. Cifras de ${anio} en pesos colombianos, sin IVA.`}
      >
        <SelectorAnio anio={anio} anios={anios} />
      </PageHeader>

      {/* --- Cifra héroe + reparto --------------------------------------- */}
      <Card className="mb-5 overflow-hidden">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-10 lg:p-6">
          <div className="lg:border-r lg:border-edge lg:pr-10">
            <HeroFigure
              etiqueta={`Utilidad neta ${anio}`}
              valor={money(resumen.utilidad)}
              positivo={resumen.utilidad >= 0}
              nota={
                <span className="tabular">
                  {money(resumen.ingresos)} en ingresos − {money(resumen.gastos)} en gastos
                </span>
              }
            />
            {/* El medidor necesita un límite real: sin ingresos, la razón
                gasto/ingreso no existe y dibujarla con un divisor de emergencia
                mostraría una barra que no significa nada. */}
            <div className="mt-5">
              {resumen.ingresos > 0 ? (
                <Meter
                  etiqueta="Gastos sobre ingresos"
                  valor={resumen.gastos}
                  limite={resumen.ingresos}
                  nota={`Cada $100 facturados cuestan $${Math.round((resumen.gastos / resumen.ingresos) * 100)} en operación.`}
                />
              ) : (
                <p className="text-sm text-ink-muted">
                  Aún no hay ingresos registrados en {anio}. Empieza por{" "}
                  <Link href="/clientes" className="text-s1 underline-offset-2 hover:underline">
                    crear un cliente
                  </Link>{" "}
                  y emitirle una factura.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile
              etiqueta="Ingresos facturados"
              valor={resumen.ingresos}
              delta={variacion(resumen.ingresos, resumenAnterior.ingresos)}
              periodoDelta={String(anio - 1)}
              tendencia={serie.map((p) => p.ingresos)}
              acento="var(--s1)"
            />
            <StatTile
              etiqueta="Gastos operativos"
              valor={resumen.gastos}
              delta={variacion(resumen.gastos, resumenAnterior.gastos)}
              periodoDelta={String(anio - 1)}
              subirEsBueno={false}
              tendencia={serie.map((p) => p.gastos)}
              acento="var(--s2)"
            />
            <StatTile
              etiqueta="Cobrado en el año"
              valor={resumen.cobrado}
              nota={
                resumen.ingresos > 0
                  ? `${Math.round((resumen.cobrado / (resumen.ingresos || 1)) * 100)} % de lo facturado`
                  : undefined
              }
              acento="var(--s3)"
            />
            <StatTile
              etiqueta="Pendiente por cobrar"
              valor={car.total}
              nota={`${car.facturasAbiertas} factura${car.facturasAbiertas === 1 ? "" : "s"} abierta${car.facturasAbiertas === 1 ? "" : "s"}`}
              acento="var(--s4)"
            />
          </div>
        </div>
      </Card>

      {/* --- Avisos ------------------------------------------------------- */}
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-s1/10 text-s1">
              <Info className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-2">
                IVA del periodo {periodoIvaVigente?.etiqueta ?? "—"}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular text-ink">
                {money(Math.max(periodoIvaVigente?.aPagar ?? 0, 0))}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {(periodoIvaVigente?.aPagar ?? 0) < 0
                  ? `Saldo a favor de ${money(Math.abs(periodoIvaVigente!.aPagar))}.`
                  : "Estimado a pagar a la DIAN."}{" "}
                <Link href="/impuestos" className="text-s1 underline-offset-2 hover:underline">
                  Ver detalle
                </Link>
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                car.vencido > 0 ? "bg-critical/10 text-critical" : "bg-good/10 text-good-text"
              }`}
            >
              {car.vencido > 0 ? (
                <TriangleAlert className="size-4" aria-hidden="true" />
              ) : (
                <CircleCheck className="size-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-2">Cartera vencida</p>
              <p className="mt-0.5 text-lg font-semibold tabular text-ink">{money(car.vencido)}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {car.vencido > 0 ? (
                  <>
                    Hay facturas pasadas de fecha.{" "}
                    <Link href="/facturas" className="text-s1 underline-offset-2 hover:underline">
                      Revisar
                    </Link>
                  </>
                ) : (
                  "Ninguna factura pasada de fecha."
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
                deudaSocios > 0 ? "bg-warning/15 text-ink" : "bg-surface-2 text-ink-muted"
              }`}
            >
              {deudaSocios > 0 ? (
                <AlertTriangle className="size-4" aria-hidden="true" />
              ) : (
                <CircleCheck className="size-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-2">Cuentas por cobrar a socios</p>
              <p className="mt-0.5 text-lg font-semibold tabular text-ink">{money(deudaSocios)}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {deudaSocios > 0 ? (
                  <>
                    Se cruza contra utilidades futuras.{" "}
                    <Link href="/socios" className="text-s1 underline-offset-2 hover:underline">
                      Ver socios
                    </Link>
                  </>
                ) : (
                  "Ningún socio tiene saldo pendiente."
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* --- Gráficos ------------------------------------------------------ */}
      <div className="mb-5">
        <ChartCard
          titulo="Ingresos, gastos y utilidad por mes"
          descripcion={`${anio} · valores sin IVA`}
          altura={300}
          columnas={["Mes", "Ingresos", "Gastos", "Utilidad neta"]}
          filas={serie.map((p) => [p.mes, p.ingresos, p.gastos, p.utilidad])}
        >
          <FlujoCajaChart datos={serie} />
        </ChartCard>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <ChartCard
          titulo="Ingresos por cliente"
          descripcion={`Base facturada en ${anio}`}
          columnas={["Cliente", "Facturado"]}
          filas={porCliente.map((c) => [c.nombre, c.valor])}
        >
          <BarrasHorizontales
            datos={porCliente.map((c) => ({ nombre: c.nombre, valor: c.valor }))}
            etiquetaSerie="Facturado"
            vacio="Aún no le has facturado a ningún cliente este año."
          />
        </ChartCard>

        <ChartCard
          titulo="Gastos por categoría"
          descripcion={`Egresos operativos de ${anio}`}
          columnas={["Categoría", "Gasto"]}
          filas={porCategoria.map((c) => [humanizar(c.categoria), c.valor])}
        >
          <BarrasHorizontales
            datos={porCategoria.map((c) => ({ nombre: humanizar(c.categoria), valor: c.valor }))}
            etiquetaSerie="Gasto"
            vacio="Aún no hay gastos registrados este año."
          />
        </ChartCard>
      </div>

      {/* --- Próximos vencimientos + gasto fijo ---------------------------- */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader
            titulo="Próximos vencimientos"
            descripcion="Facturas abiertas, ordenadas por fecha de pago"
            accion={
              <Link
                href="/facturas"
                className="inline-flex items-center gap-1 text-xs font-medium text-s1 hover:underline"
              >
                Todas <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            }
          />
          {proximasFacturas.length === 0 ? (
            <EmptyState
              titulo="No hay facturas abiertas"
              descripcion="Cuando emitas una factura pendiente de pago aparecerá aquí."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Factura</Th>
                  <Th>Cliente</Th>
                  <Th>Vence</Th>
                  <Th numerico>Saldo</Th>
                </tr>
              </thead>
              <tbody>
                {proximasFacturas.map((f) => {
                  const pagado = f.pagos.reduce((a, p) => a + num(p.monto), 0);
                  const saldo = num(f.netoACobrar) - pagado;
                  const dias = diasEntre(hoy, new Date(f.fechaVencimiento));
                  const vencida = dias < 0;

                  return (
                    <Tr key={f.id}>
                      <Td>
                        <Link
                          href={`/facturas/${f.id}`}
                          className="font-medium text-ink hover:text-s1"
                        >
                          {f.numero}
                        </Link>
                      </Td>
                      <Td className="text-ink-2">{f.cliente.nombre}</Td>
                      <Td>
                        <span className="flex items-center gap-2">
                          <span className="tabular text-ink-2">{fecha(f.fechaVencimiento)}</span>
                          {vencida ? (
                            <Badge
                              tono="critico"
                              icono={<TriangleAlert className="size-3" aria-hidden="true" />}
                            >
                              {Math.abs(dias)} d vencida
                            </Badge>
                          ) : dias <= 7 ? (
                            <Badge
                              tono="aviso"
                              icono={<Clock className="size-3" aria-hidden="true" />}
                            >
                              en {dias} d
                            </Badge>
                          ) : null}
                        </span>
                      </Td>
                      <Td numerico className="font-medium">
                        {money(saldo)}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-medium text-ink-2">Cada mes, sin vender nada nuevo</p>

            <div className="mt-3 space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-ink-2">Entra (suscripciones)</span>
                <span className="tabular text-lg font-semibold text-ink">
                  {moneyCompact(recurrente.total)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-ink-2">Sale (gastos fijos)</span>
                <span className="tabular text-lg font-semibold text-ink">
                  {moneyCompact(fijos.total)}
                </span>
              </div>
            </div>

            <div className="mt-4 border-t border-edge pt-4">
              {/* La diferencia entre lo que entra y lo que sale sin esfuerzo
                  comercial es lo que dice si la empresa se sostiene sola. */}
              <p className="text-xs text-ink-2">
                {recurrente.total >= fijos.total && fijos.total > 0 ? (
                  <>
                    Lo recurrente ya cubre la operación, con{" "}
                    <strong className="tabular font-semibold text-good-text">
                      {moneyCompact(recurrente.total - fijos.total)}
                    </strong>{" "}
                    de margen.
                  </>
                ) : (
                  <>
                    Faltan{" "}
                    <strong className="tabular font-semibold text-ink">
                      {moneyCompact(fijos.total - recurrente.total)}
                    </strong>{" "}
                    al mes para cubrir la operación con ingresos recurrentes.
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                <Link href="/suscripciones" className="text-s1 underline-offset-2 hover:underline">
                  Suscripciones
                </Link>{" "}
                ·{" "}
                <Link href="/gastos-fijos" className="text-s1 underline-offset-2 hover:underline">
                  Gastos fijos
                </Link>
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader titulo="Socios" descripcion="Saldo de la cuenta corriente" />
            <div className="divide-y divide-edge">
              {socios.length === 0 ? (
                <EmptyState titulo="Sin socios registrados" />
              ) : (
                socios.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{s.nombre}</p>
                      <p className="text-xs text-ink-muted">
                        {Math.round(s.participacion * 100)} % de participación
                      </p>
                    </div>
                    <span
                      className={`tabular shrink-0 text-sm font-medium ${
                        s.saldo < 0 ? "text-critical" : "text-ink-muted"
                      }`}
                    >
                      {s.saldo < 0 ? `−${money(-s.saldo)}` : "Al día"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
