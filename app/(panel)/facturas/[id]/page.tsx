import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, Building2, Info, Send } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Table, Td, Th, Tr } from "@/components/ui";
import { BotonEliminar } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { fecha, humanizar, money } from "@/lib/format";
import { ETIQUETAS_IVA, RETEFUENTE, TASA_RETEIVA } from "@/lib/fiscal";
import { obtenerConfig } from "@/lib/consultas";
import { EstadoBadge } from "../estado";
import { DialogoPago } from "./pago-form";
import { anularFactura, eliminarFactura, emitirFactura, eliminarPago } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const f = await prisma.factura.findUnique({ where: { id }, select: { numero: true } });
  return { title: f ? `Factura ${f.numero}` : "Factura" };
}

export default async function DetalleFactura({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [factura, config, pasarelas] = await Promise.all([
    prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: { orderBy: { orden: "asc" } },
        pagos: { orderBy: { fecha: "desc" }, include: { pasarela: { select: { nombre: true } } } },
      },
    }),
    obtenerConfig(),
    prisma.pasarelaPago.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  if (!factura) notFound();

  const pagado = factura.pagos.reduce((a, p) => a + num(p.monto), 0);
  const neto = num(factura.netoACobrar);
  const saldo = neto - pagado;
  const retenciones = num(factura.retefuente) + num(factura.reteIva) + num(factura.reteIca);
  const anulada = factura.estado === "ANULADA";

  return (
    <>
      <Link
        href="/facturas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-s1 no-print"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Facturas
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{factura.numero}</h1>
            <EstadoBadge estado={factura.estado} />
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {factura.cliente.nombre}
            {factura.proyecto ? ` · ${factura.proyecto}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          {factura.estado === "BORRADOR" ? (
            <form action={emitirFactura.bind(null, factura.id)}>
              <Button type="submit" variante="primario">
                <Send className="size-4" aria-hidden="true" />
                Emitir
              </Button>
            </form>
          ) : null}

          {saldo > 0 && !anulada ? (
            <DialogoPago
              facturaId={factura.id}
              saldo={saldo}
              pasarelas={pasarelas.map((p) => ({
                id: p.id,
                nombre: p.nombre,
                porcentaje: num(p.porcentaje),
                fijo: num(p.fijo),
                comisionTieneIva: p.comisionTieneIva,
              }))}
            />
          ) : null}

          {!anulada ? (
            <form action={anularFactura.bind(null, factura.id)}>
              <Button type="submit" variante="peligro">
                <Ban className="size-4" aria-hidden="true" />
                Anular
              </Button>
            </form>
          ) : null}

          {factura.estado === "BORRADOR" ? (
            <form action={eliminarFactura.bind(null, factura.id)}>
              <Button type="submit" variante="fantasma">
                Eliminar borrador
              </Button>
            </form>
          ) : null}
        </div>
      </header>

      {anulada ? (
        <div className="mb-5 flex gap-3 rounded-xl border border-edge bg-surface-2 px-4 py-3">
          <Ban className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <p className="text-sm text-ink-2">
            Esta factura está anulada. No cuenta en los ingresos ni en la declaración de IVA, pero se
            conserva para dejar el consecutivo completo.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-5">
          {/* --- Conceptos ------------------------------------------------ */}
          <Card>
            <CardHeader titulo="Conceptos facturados" />
            <Table>
              <thead>
                <tr>
                  <Th>Descripción</Th>
                  <Th numerico>Cant.</Th>
                  <Th numerico>V. unitario</Th>
                  <Th>IVA</Th>
                  <Th>Retefuente</Th>
                  <Th numerico>Base</Th>
                  <Th numerico>IVA</Th>
                </tr>
              </thead>
              <tbody>
                {factura.items.map((it) => (
                  <Tr key={it.id}>
                    <Td className="font-medium">{it.descripcion}</Td>
                    <Td numerico className="text-ink-2">
                      {num(it.cantidad)}
                    </Td>
                    <Td numerico className="text-ink-2">
                      {money(num(it.precioUnitario))}
                    </Td>
                    <Td>
                      <Badge tono={num(it.tasaIva) > 0 ? "info" : "neutro"}>
                        {ETIQUETAS_IVA[it.tratamientoIva]}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-ink-2">
                      {num(it.tasaRetefuente) > 0
                        ? `${RETEFUENTE[it.conceptoRetefuente].etiqueta} · ${(num(it.tasaRetefuente) * 100).toFixed(1).replace(".0", "")} %`
                        : "—"}
                    </Td>
                    <Td numerico>{money(num(it.base))}</Td>
                    <Td numerico className="text-ink-2">
                      {money(num(it.ivaValor))}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {/* --- Pagos ---------------------------------------------------- */}
          <Card>
            <CardHeader
              titulo="Pagos recibidos"
              descripcion={`${money(pagado)} de ${money(neto)} · ${Math.round((pagado / (neto || 1)) * 100)} %`}
            />
            {factura.pagos.length === 0 ? (
              <EmptyState
                titulo="Sin pagos registrados"
                descripcion="Cuando el cliente consigne, registra el pago para que el saldo y el estado se actualicen."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Fecha</Th>
                    <Th>Medio</Th>
                    <Th>Pasarela</Th>
                    <Th numerico>Monto</Th>
                    <Th numerico>Comisión</Th>
                    <Th numerico>Neto</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {factura.pagos.map((p) => (
                    <Tr key={p.id}>
                      <Td className="tabular text-ink-2">{fecha(p.fecha)}</Td>
                      <Td className="text-ink-2">{humanizar(p.metodo)}</Td>
                      <Td className="text-ink-2">{p.pasarela?.nombre ?? "—"}</Td>
                      <Td numerico className="font-medium">
                        {money(num(p.monto))}
                      </Td>
                      <Td numerico className={num(p.comision) > 0 ? "text-critical" : "text-ink-muted"}>
                        {num(p.comision) > 0
                          ? `−${money(num(p.comision) + num(p.comisionIva))}`
                          : "—"}
                      </Td>
                      <Td numerico className="text-ink-2">
                        {money(num(p.neto) || num(p.monto))}
                      </Td>
                      <Td>
                        <div className="flex justify-end no-print">
                          <BotonEliminar
                            accion={eliminarPago.bind(null, p.id, factura.id)}
                            confirmacion="¿Eliminar el pago?"
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {factura.notas ? (
            <Card>
              <CardHeader titulo="Notas" />
              <p className="whitespace-pre-wrap p-5 text-sm text-ink-2">{factura.notas}</p>
            </Card>
          ) : null}
        </div>

        {/* --- Barra lateral --------------------------------------------- */}
        <div className="space-y-5">
          <Card>
            <CardHeader titulo="Liquidación" />
            <dl className="space-y-2.5 p-5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="tabular text-ink">{money(num(factura.subtotal))}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">IVA</dt>
                <dd className="tabular text-ink">{money(num(factura.ivaTotal))}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-edge pt-2.5">
                <dt className="font-medium text-ink">Total factura</dt>
                <dd className="tabular font-semibold text-ink">{money(num(factura.total))}</dd>
              </div>

              {retenciones > 0 ? (
                <div className="space-y-2.5 border-t border-edge pt-2.5">
                  <p className="text-xs font-medium text-ink-muted">Retenciones practicadas</p>
                  {num(factura.retefuente) > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-2">Retención en la fuente</dt>
                      <dd className="tabular text-critical">
                        −{money(num(factura.retefuente))}
                      </dd>
                    </div>
                  ) : null}
                  {num(factura.reteIva) > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-2">ReteIVA ({TASA_RETEIVA * 100} %)</dt>
                      <dd className="tabular text-critical">−{money(num(factura.reteIva))}</dd>
                    </div>
                  ) : null}
                  {num(factura.reteIca) > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-2">ReteICA</dt>
                      <dd className="tabular text-critical">−{money(num(factura.reteIca))}</dd>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex justify-between gap-3 border-t border-edge pt-2.5">
                <dt className="text-ink-2">Neto a recibir</dt>
                <dd className="tabular font-medium text-ink">{money(neto)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Pagado</dt>
                <dd className="tabular text-good-text">{money(pagado)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-edge pt-2.5">
                <dt className="font-medium text-ink">Saldo</dt>
                <dd className="tabular text-lg font-semibold text-ink">{money(Math.max(saldo, 0))}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader titulo="Cliente" />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                <div>
                  <Link
                    href="/clientes"
                    className="font-medium text-ink hover:text-s1"
                  >
                    {factura.cliente.nombre}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {factura.cliente.nit || "Sin NIT"}
                    {factura.cliente.ciudad ? ` · ${factura.cliente.ciudad}` : ""}
                  </p>
                </div>
              </div>

              <dl className="space-y-1.5 border-t border-edge pt-3 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Emisión</dt>
                  <dd className="tabular text-ink-2">{fecha(factura.fechaEmision)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Vencimiento</dt>
                  <dd className="tabular text-ink-2">{fecha(factura.fechaVencimiento)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">UVT aplicada</dt>
                  <dd className="tabular text-ink-2">{money(config.valorUvt)}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <div className="flex gap-2 rounded-xl border border-edge bg-surface-2 px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-s1" aria-hidden="true" />
            <p className="text-xs text-ink-2">
              Las cifras quedaron congeladas al emitir. Cambiar el catálogo o las tarifas más
              adelante no altera esta factura.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
