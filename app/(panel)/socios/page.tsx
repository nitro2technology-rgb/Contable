import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  CircleCheck,
  Clock,
  Info,
  Minus,
  PiggyBank,
  TriangleAlert,
} from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th, Tr } from "@/components/ui";
import { StatTile } from "@/components/stats";
import { BotonEliminar } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { diasEntre, fecha, fechaInput, money } from "@/lib/format";
import { rangoAnio, repartoPorProyecto, resumenPeriodo, saldosSocios } from "@/lib/consultas";
import { DialogoMovimiento, DialogoSocio } from "./form";
import { eliminarMovimiento, eliminarSocio } from "./actions";

export const metadata: Metadata = { title: "Socios" };
export const dynamic = "force-dynamic";

/**
 * Cómo se lee cada movimiento en el historial. `signo` es el efecto sobre el
 * saldo del socio: negativo cuando le deja debiendo.
 */
const TIPOS: Record<
  string,
  { texto: string; signo: -1 | 0 | 1; esGasto: boolean }
> = {
  PRESTAMO: { texto: "Préstamo", signo: -1, esGasto: false },
  RETIRO: { texto: "Retiro", signo: -1, esGasto: false },
  ABONO: { texto: "Abono", signo: 1, esGasto: false },
  HONORARIOS: { texto: "Honorarios", signo: 0, esGasto: true },
  DISTRIBUCION_UTILIDADES: { texto: "Distribución de utilidades", signo: 0, esGasto: false },
  APORTE_CAPITAL: { texto: "Aporte de capital", signo: 0, esGasto: false },
};

export default async function PaginaSocios() {
  const anio = new Date().getUTCFullYear();
  const { inicio, fin } = rangoAnio(anio);

  const [saldos, movimientos, resumen, proyectos] = await Promise.all([
    saldosSocios(),
    prisma.movimientoSocio.findMany({
      orderBy: { fecha: "desc" },
      take: 100,
      include: {
        socio: { select: { id: true, nombre: true } },
        factura: { select: { id: true, numero: true, proyecto: true } },
      },
    }),
    resumenPeriodo(inicio, fin),
    repartoPorProyecto(anio),
  ]);

  const deudaTotal = saldos.reduce((a, s) => a + Math.max(-s.saldo, 0), 0);
  const capital = saldos.reduce((a, s) => a + s.aportado, 0);
  const honorariosTotal = saldos.reduce((a, s) => a + s.honorarios, 0);

  const opciones = saldos.map((s) => ({ id: s.id, nombre: s.nombre }));
  const opcionesProyecto = proyectos.map((p) => ({
    facturaId: p.facturaId,
    numero: p.numero,
    proyecto: p.proyecto,
    cliente: p.cliente,
    base: p.base,
    repartido: p.repartido,
    disponible: p.disponible,
  }));

  const conReparto = proyectos.filter((p) => p.repartido > 0 || p.base > 0).slice(0, 12);
  const hoy = new Date();

  return (
    <>
      <PageHeader
        titulo="Socios"
        descripcion="Cuenta corriente de cada socio y reparto de honorarios por proyecto."
      >
        <DialogoSocio />
        {saldos.length > 0 ? (
          <DialogoMovimiento socios={opciones} proyectos={opcionesProyecto} />
        ) : null}
      </PageHeader>

      <div className="mb-5 flex gap-3 rounded-xl border border-edge bg-surface-2 px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-s1" aria-hidden="true" />
        <div className="text-sm text-ink-2">
          <p>
            <strong className="font-medium text-ink">Los honorarios son gasto; los préstamos no.</strong>{" "}
            Pagarle a un socio por el trabajo de un proyecto baja la utilidad y aparece en Gastos.
            Prestarle dinero no: es una cuenta por cobrar que deja su saldo en negativo hasta que lo
            devuelva.
          </p>
          <p className="mt-1.5">
            Un préstamo solo se salda con un <strong className="font-medium text-ink">abono</strong>.
            Ni los honorarios ni el reparto de utilidades lo cancelan solos: si quieres cruzarlo
            contra utilidades, registra los dos movimientos para que quede el rastro.
          </p>
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          etiqueta="Deuda total de los socios"
          valor={deudaTotal}
          nota={deudaTotal > 0 ? "Pendiente de devolver" : "Nadie tiene saldo pendiente"}
          subirEsBueno={false}
          acento="var(--s8)"
        />
        <StatTile
          etiqueta={`Honorarios pagados ${anio}`}
          valor={honorariosTotal}
          nota="Registrados como gasto"
          acento="var(--s2)"
        />
        <StatTile
          etiqueta="Capital aportado"
          valor={capital}
          nota="Patrimonio, no deuda"
          acento="var(--s3)"
        />
        <StatTile
          etiqueta={`Utilidad ${anio}`}
          valor={resumen.utilidad}
          nota="Ya descontados los honorarios"
          acento="var(--s1)"
        />
      </div>

      {/* --- Tarjeta por socio -------------------------------------------- */}
      {saldos.length === 0 ? (
        <Card>
          <EmptyState
            titulo="Aún no hay socios registrados"
            descripcion="Registra a los socios de la S.A.S. para repartir honorarios por proyecto y llevar el control de préstamos y aportes."
          >
            <DialogoSocio />
          </EmptyState>
        </Card>
      ) : (
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          {saldos.map((s) => {
            const debe = s.saldo < 0;
            return (
              <Card key={s.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-ink">{s.nombre}</h2>
                    <p className="text-xs text-ink-muted">
                      {Math.round(s.participacion * 100)} % de participación ·{" "}
                      {s.movimientos} movimiento{s.movimientos === 1 ? "" : "s"}
                    </p>
                  </div>
                  {debe ? (
                    <Badge
                      tono="critico"
                      icono={<TriangleAlert className="size-3" aria-hidden="true" />}
                    >
                      Debe
                    </Badge>
                  ) : (
                    <Badge
                      tono="bueno"
                      icono={<CircleCheck className="size-3" aria-hidden="true" />}
                    >
                      Al día
                    </Badge>
                  )}
                </div>

                {/* El saldo se muestra desde la perspectiva del socio: negativo
                    cuando le debe a la empresa, con el signo a la vista. */}
                <p
                  className={`mt-4 text-3xl font-semibold tracking-tight ${
                    debe ? "text-critical" : "text-ink"
                  }`}
                >
                  {debe ? `−${money(-s.saldo)}` : money(0)}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {debe
                    ? "Saldo en contra: lo que le debe a la empresa"
                    : "Sin saldo pendiente con la empresa"}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-edge pt-4 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Tomado</dt>
                    <dd className="tabular text-ink">{money(s.prestado)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Devuelto</dt>
                    <dd className="tabular text-ink">{money(s.abonado)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Honorarios</dt>
                    <dd className="tabular text-ink">{money(s.honorarios)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Utilidades</dt>
                    <dd className="tabular text-ink">{money(s.distribuido)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Aportes</dt>
                    <dd className="tabular text-ink">{money(s.aportado)}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-edge pt-4">
                  <DialogoMovimiento
                    socios={opciones}
                    proyectos={opcionesProyecto}
                    socioIdPorDefecto={s.id}
                    disparador={
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-s1 hover:underline"
                      >
                        <PiggyBank className="size-3.5" aria-hidden="true" />
                        Registrar movimiento
                      </button>
                    }
                  />
                  <div className="flex items-center gap-3">
                    <DialogoSocio
                      socio={{
                        id: s.id,
                        nombre: s.nombre,
                        documento: "",
                        email: "",
                        telefono: "",
                        participacion: s.participacion,
                        activo: true,
                        notas: "",
                      }}
                      disparador={
                        <button
                          type="button"
                          className="text-xs font-medium text-ink-2 hover:text-s1"
                        >
                          Editar
                        </button>
                      }
                    />
                    <BotonEliminar
                      accion={eliminarSocio.bind(null, s.id)}
                      etiqueta={s.movimientos > 0 ? "Desactivar" : "Eliminar"}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* --- Reparto por proyecto ------------------------------------------ */}
      {conReparto.length > 0 ? (
        <Card className="mb-5">
          <CardHeader
            titulo="Reparto por proyecto"
            descripcion={`Cuánto de cada factura de ${anio} se han pagado los socios`}
          />
          <Table>
            <thead>
              <tr>
                <Th>Factura</Th>
                <Th>Proyecto</Th>
                <Th numerico>Base facturada</Th>
                <Th numerico>Repartido</Th>
                <Th numerico>Sin repartir</Th>
                <Th>Detalle</Th>
              </tr>
            </thead>
            <tbody>
              {conReparto.map((p) => (
                <Tr key={p.facturaId}>
                  <Td>
                    <Link
                      href={`/facturas/${p.facturaId}`}
                      className="font-medium text-ink hover:text-s1"
                    >
                      {p.numero}
                    </Link>
                  </Td>
                  <Td className="text-ink-2">{p.proyecto || p.cliente}</Td>
                  <Td numerico>{money(p.base)}</Td>
                  <Td numerico className={p.repartido > 0 ? "font-medium text-ink" : "text-ink-muted"}>
                    {p.repartido > 0 ? money(p.repartido) : "—"}
                  </Td>
                  <Td numerico className="text-ink-2">
                    {money(p.disponible)}
                  </Td>
                  <Td>
                    {p.socios.length === 0 ? (
                      <span className="text-xs text-ink-muted">Sin repartir</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {p.socios.map((x) => (
                          <Badge key={x.nombre} tono="neutro">
                            {x.nombre} {money(x.monto)}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {/* --- Historial ----------------------------------------------------- */}
      <Card>
        <CardHeader
          titulo="Historial de movimientos"
          descripcion="Honorarios, préstamos, retiros, abonos, aportes y utilidades"
        />
        {movimientos.length === 0 ? (
          <EmptyState
            titulo="Sin movimientos"
            descripcion="Registra aquí lo que cada socio cobra por un proyecto o toma de la caja."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Socio</Th>
                <Th>Tipo</Th>
                <Th>Concepto</Th>
                <Th>Proyecto</Th>
                <Th numerico>Monto</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const info = TIPOS[m.tipo];
                const dias = m.fechaCompromiso
                  ? diasEntre(hoy, new Date(m.fechaCompromiso))
                  : null;

                const Icono =
                  info.signo === -1 ? ArrowUpRight : info.signo === 1 ? ArrowDownLeft : Minus;

                return (
                  <Tr key={m.id}>
                    <Td className="tabular whitespace-nowrap text-ink-2">{fecha(m.fecha)}</Td>
                    <Td className="font-medium">{m.socio.nombre}</Td>
                    <Td>
                      <span className="flex items-center gap-1.5 text-xs text-ink-2">
                        <Icono
                          className={`size-3.5 shrink-0 ${
                            info.signo === -1
                              ? "text-critical"
                              : info.signo === 1
                                ? "text-good-text"
                                : "text-ink-muted"
                          }`}
                          aria-hidden="true"
                        />
                        {info.texto}
                        {info.esGasto ? (
                          <Badge tono="aviso" icono={<Briefcase className="size-3" aria-hidden="true" />}>
                            gasto
                          </Badge>
                        ) : null}
                      </span>
                    </Td>
                    <Td className="text-ink-2">
                      {m.concepto}
                      {dias !== null && dias < 0 ? (
                        <Badge
                          tono="critico"
                          icono={<TriangleAlert className="size-3" aria-hidden="true" />}
                        >
                          devolución vencida
                        </Badge>
                      ) : dias !== null && dias <= 15 ? (
                        <Badge tono="aviso" icono={<Clock className="size-3" aria-hidden="true" />}>
                          vence en {dias} d
                        </Badge>
                      ) : null}
                    </Td>
                    <Td>
                      {m.factura ? (
                        <Link
                          href={`/facturas/${m.factura.id}`}
                          className="text-xs text-s1 hover:underline"
                        >
                          {m.factura.numero}
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-muted">—</span>
                      )}
                    </Td>
                    <Td
                      numerico
                      className={
                        info.signo === -1
                          ? "font-medium text-critical"
                          : info.signo === 1
                            ? "font-medium text-good-text"
                            : "font-medium text-ink"
                      }
                    >
                      {info.signo === -1 ? "−" : info.signo === 1 ? "+" : ""}
                      {money(num(m.monto))}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-3">
                        <DialogoMovimiento
                          socios={opciones}
                          proyectos={opcionesProyecto}
                          movimiento={{
                            id: m.id,
                            socioId: m.socioId,
                            fecha: fechaInput(m.fecha),
                            tipo: m.tipo,
                            monto: num(m.monto),
                            concepto: m.concepto,
                            notas: m.notas,
                            fechaCompromiso: m.fechaCompromiso
                              ? fechaInput(m.fechaCompromiso)
                              : "",
                            facturaId: m.facturaId ?? "",
                          }}
                          disparador={
                            <button
                              type="button"
                              className="text-xs font-medium text-ink-2 hover:text-s1"
                            >
                              Editar
                            </button>
                          }
                        />
                        <BotonEliminar accion={eliminarMovimiento.bind(null, m.id)} />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="mt-4 text-xs text-ink-muted">
        Al borrar unos honorarios se borra también el gasto que generaron, para que la utilidad y la
        cuenta del socio nunca se contradigan.
      </p>
    </>
  );
}
