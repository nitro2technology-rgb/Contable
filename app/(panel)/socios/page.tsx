import type { Metadata } from "next";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleCheck,
  Clock,
  Info,
  PiggyBank,
  TriangleAlert,
} from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th, Tr } from "@/components/ui";
import { StatTile } from "@/components/stats";
import { BotonEliminar } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { diasEntre, fecha, fechaInput, money } from "@/lib/format";
import { rangoAnio, resumenPeriodo, saldosSocios } from "@/lib/consultas";
import { DialogoMovimiento, DialogoSocio } from "./form";
import { eliminarMovimiento, eliminarSocio } from "./actions";

export const metadata: Metadata = { title: "Socios" };
export const dynamic = "force-dynamic";

const ETIQUETA_TIPO: Record<string, { texto: string; aumenta: boolean }> = {
  PRESTAMO: { texto: "Préstamo", aumenta: true },
  RETIRO: { texto: "Retiro", aumenta: true },
  ABONO: { texto: "Abono", aumenta: false },
  DISTRIBUCION_UTILIDADES: { texto: "Distribución de utilidades", aumenta: false },
  APORTE_CAPITAL: { texto: "Aporte de capital", aumenta: false },
};

export default async function PaginaSocios() {
  const anio = new Date().getUTCFullYear();
  const { inicio, fin } = rangoAnio(anio);

  const [saldos, movimientos, resumen] = await Promise.all([
    saldosSocios(),
    prisma.movimientoSocio.findMany({
      orderBy: { fecha: "desc" },
      take: 100,
      include: { socio: { select: { id: true, nombre: true } } },
    }),
    resumenPeriodo(inicio, fin),
  ]);

  const deudaTotal = saldos.reduce((a, s) => a + Math.max(s.saldo, 0), 0);
  const capital = saldos.reduce((a, s) => a + s.aportado, 0);
  const opciones = saldos.map((s) => ({ id: s.id, nombre: s.nombre }));

  const hoy = new Date();

  return (
    <>
      <PageHeader
        titulo="Socios"
        descripcion="Cuenta corriente de cada socio: lo que ha tomado, lo que ha devuelto y lo que queda pendiente."
      >
        <DialogoSocio />
        {saldos.length > 0 ? <DialogoMovimiento socios={opciones} /> : null}
      </PageHeader>

      <div className="mb-5 flex gap-3 rounded-xl border border-edge bg-surface-2 px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-s1" aria-hidden="true" />
        <p className="text-sm text-ink-2">
          Contablemente esto es una{" "}
          <strong className="font-medium text-ink">cuenta por cobrar a socios</strong>, no un gasto:
          no baja la utilidad ni es deducible. Se cruza contra las utilidades que se decreten a su
          favor. Un retiro sin utilidades decretadas ni devolución puede tratarse como dividendo o
          como préstamo, con consecuencias tributarias distintas — conviene consultarlo con el
          contador antes de cerrar el año.
        </p>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatTile
          etiqueta="Deuda total de los socios"
          valor={deudaTotal}
          nota={deudaTotal > 0 ? "Pendiente de devolver o cruzar" : "Nadie tiene saldo pendiente"}
          subirEsBueno={false}
          acento="var(--s8)"
        />
        <StatTile
          etiqueta="Capital aportado"
          valor={capital}
          nota="Patrimonio, no deuda"
          acento="var(--s3)"
        />
        <StatTile
          etiqueta={`Utilidad ${anio} disponible`}
          valor={Math.max(resumen.utilidad, 0)}
          nota="Antes de impuestos y reserva legal"
          acento="var(--s1)"
        />
      </div>

      {/* --- Tarjeta por socio -------------------------------------------- */}
      {saldos.length === 0 ? (
        <Card>
          <EmptyState
            titulo="Aún no hay socios registrados"
            descripcion="Registra a los socios de la S.A.S. para llevar el control de préstamos, retiros y aportes."
          >
            <DialogoSocio />
          </EmptyState>
        </Card>
      ) : (
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          {saldos.map((s) => {
            const debe = s.saldo > 0;
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

                <p
                  className={`mt-4 text-3xl font-semibold tracking-tight ${
                    debe ? "text-critical" : "text-ink"
                  }`}
                >
                  {money(Math.max(s.saldo, 0))}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {debe
                    ? "Saldo pendiente con la empresa"
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

      {/* --- Historial ----------------------------------------------------- */}
      <Card>
        <CardHeader
          titulo="Historial de movimientos"
          descripcion="Todos los préstamos, retiros, abonos y aportes registrados"
        />
        {movimientos.length === 0 ? (
          <EmptyState
            titulo="Sin movimientos"
            descripcion="Cuando un socio tome o devuelva dinero, regístralo aquí para que quede el rastro."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Socio</Th>
                <Th>Tipo</Th>
                <Th>Concepto</Th>
                <Th>Devolución</Th>
                <Th numerico>Monto</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const info = ETIQUETA_TIPO[m.tipo];
                const dias = m.fechaCompromiso
                  ? diasEntre(hoy, new Date(m.fechaCompromiso))
                  : null;

                return (
                  <Tr key={m.id}>
                    <Td className="tabular whitespace-nowrap text-ink-2">{fecha(m.fecha)}</Td>
                    <Td className="font-medium">{m.socio.nombre}</Td>
                    <Td>
                      <span className="flex items-center gap-1.5 text-xs text-ink-2">
                        {info.aumenta ? (
                          <ArrowUpRight className="size-3.5 shrink-0 text-critical" aria-hidden="true" />
                        ) : (
                          <ArrowDownLeft
                            className="size-3.5 shrink-0 text-good-text"
                            aria-hidden="true"
                          />
                        )}
                        {info.texto}
                      </span>
                    </Td>
                    <Td className="text-ink-2">{m.concepto}</Td>
                    <Td>
                      {m.fechaCompromiso ? (
                        <span className="flex items-center gap-2">
                          <span className="tabular text-xs text-ink-2">
                            {fecha(m.fechaCompromiso)}
                          </span>
                          {dias !== null && dias < 0 ? (
                            <Badge
                              tono="critico"
                              icono={<TriangleAlert className="size-3" aria-hidden="true" />}
                            >
                              vencido
                            </Badge>
                          ) : dias !== null && dias <= 15 ? (
                            <Badge tono="aviso" icono={<Clock className="size-3" aria-hidden="true" />}>
                              en {dias} d
                            </Badge>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-muted">—</span>
                      )}
                    </Td>
                    <Td
                      numerico
                      className={info.aumenta ? "font-medium text-critical" : "font-medium text-good-text"}
                    >
                      {info.aumenta ? "+" : "−"}
                      {money(num(m.monto))}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-3">
                        <DialogoMovimiento
                          socios={opciones}
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
    </>
  );
}
