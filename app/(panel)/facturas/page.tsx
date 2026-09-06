import type { Metadata } from "next";
import Link from "next/link";
import type { EstadoFactura, Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { Card, EmptyState, PageHeader, Table, Td, Th, Tr, cx } from "@/components/ui";
import { StatTile } from "@/components/stats";
import { num, prisma } from "@/lib/db";
import { money, fecha } from "@/lib/format";
import { ESTADOS_VIGENTES } from "@/lib/consultas";
import { EstadoBadge } from "./estado";

export const metadata: Metadata = { title: "Facturas" };
export const dynamic = "force-dynamic";

const FILTROS = [
  { clave: "todas", etiqueta: "Todas" },
  { clave: "abiertas", etiqueta: "Por cobrar" },
  { clave: "vencidas", etiqueta: "Vencidas" },
  { clave: "pagadas", etiqueta: "Pagadas" },
  { clave: "borradores", etiqueta: "Borradores" },
] as const;

type Filtro = (typeof FILTROS)[number]["clave"];

function condicion(filtro: Filtro): Prisma.FacturaWhereInput {
  switch (filtro) {
    case "abiertas":
      return { estado: { in: ["EMITIDA", "PARCIAL", "VENCIDA"] } };
    case "vencidas":
      return { estado: "VENCIDA" };
    case "pagadas":
      return { estado: "PAGADA" };
    case "borradores":
      return { estado: "BORRADOR" };
    default:
      return {};
  }
}

export default async function PaginaFacturas({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro: filtroParam } = await searchParams;
  const filtro = (FILTROS.find((f) => f.clave === filtroParam)?.clave ?? "todas") as Filtro;

  const [facturas, todas] = await Promise.all([
    prisma.factura.findMany({
      where: condicion(filtro),
      orderBy: { fechaEmision: "desc" },
      take: 200,
      include: {
        cliente: { select: { nombre: true } },
        pagos: { select: { monto: true } },
      },
    }),
    prisma.factura.findMany({
      select: {
        estado: true,
        subtotal: true,
        ivaTotal: true,
        netoACobrar: true,
        pagos: { select: { monto: true } },
      },
    }),
  ]);

  let facturado = 0;
  let ivaGenerado = 0;
  let cobrado = 0;
  let porCobrar = 0;

  for (const f of todas) {
    if (!ESTADOS_VIGENTES.includes(f.estado as EstadoFactura)) continue;
    facturado += num(f.subtotal);
    ivaGenerado += num(f.ivaTotal);
    const pagado = f.pagos.reduce((a, p) => a + num(p.monto), 0);
    cobrado += pagado;
    porCobrar += Math.max(num(f.netoACobrar) - pagado, 0);
  }

  return (
    <>
      <PageHeader
        titulo="Facturas"
        descripcion="Todo lo que hemos facturado, con su IVA, sus retenciones y su estado de pago."
      >
        <Link
          href="/facturas/nueva"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-s1 px-3.5 text-sm font-medium text-white hover:brightness-110"
        >
          <Plus className="size-4" aria-hidden="true" />
          Nueva factura
        </Link>
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile etiqueta="Facturado (base)" valor={facturado} acento="var(--s1)" />
        <StatTile
          etiqueta="IVA generado"
          valor={ivaGenerado}
          nota="No es ingreso: se le debe a la DIAN"
          acento="var(--s4)"
        />
        <StatTile etiqueta="Cobrado" valor={cobrado} acento="var(--s3)" />
        <StatTile etiqueta="Por cobrar" valor={porCobrar} acento="var(--s2)" />
      </div>

      {/* Los filtros van en una sola fila, encima de la tabla. */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <Link
            key={f.clave}
            href={f.clave === "todas" ? "/facturas" : `/facturas?filtro=${f.clave}`}
            className={cx(
              "inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-colors",
              filtro === f.clave
                ? "border-transparent bg-surface-3 text-ink"
                : "border-edge text-ink-2 hover:bg-surface-2"
            )}
            aria-current={filtro === f.clave ? "page" : undefined}
          >
            {f.etiqueta}
          </Link>
        ))}
      </div>

      <Card>
        {facturas.length === 0 ? (
          <EmptyState
            titulo={filtro === "todas" ? "Aún no hay facturas" : "Ninguna factura en este filtro"}
            descripcion={
              filtro === "todas"
                ? "Emite la primera factura para empezar a llevar el control de ingresos e IVA."
                : "Prueba con otro filtro."
            }
          >
            {filtro === "todas" ? (
              <Link
                href="/facturas/nueva"
                className="inline-flex h-9 items-center rounded-lg bg-s1 px-3.5 text-sm font-medium text-white hover:brightness-110"
              >
                Nueva factura
              </Link>
            ) : null}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Factura</Th>
                <Th>Cliente</Th>
                <Th>Emisión</Th>
                <Th>Vence</Th>
                <Th>Estado</Th>
                <Th numerico>Base</Th>
                <Th numerico>IVA</Th>
                <Th numerico>Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => {
                const pagado = f.pagos.reduce((a, p) => a + num(p.monto), 0);
                const saldo = num(f.netoACobrar) - pagado;
                const anulada = f.estado === "ANULADA";

                return (
                  <Tr key={f.id} className={anulada ? "opacity-55" : undefined}>
                    <Td>
                      <Link
                        href={`/facturas/${f.id}`}
                        className="font-medium text-ink hover:text-s1"
                      >
                        {f.numero}
                      </Link>
                      {f.proyecto ? (
                        <p className="max-w-[220px] truncate text-xs text-ink-muted">
                          {f.proyecto}
                        </p>
                      ) : null}
                    </Td>
                    <Td className="text-ink-2">{f.cliente.nombre}</Td>
                    <Td className="tabular text-ink-2">{fecha(f.fechaEmision)}</Td>
                    <Td className="tabular text-ink-2">{fecha(f.fechaVencimiento)}</Td>
                    <Td>
                      <EstadoBadge estado={f.estado} />
                    </Td>
                    <Td numerico>{money(num(f.subtotal))}</Td>
                    <Td numerico className="text-ink-2">
                      {money(num(f.ivaTotal))}
                    </Td>
                    <Td
                      numerico
                      className={saldo > 0 && !anulada ? "font-medium text-ink" : "text-ink-muted"}
                    >
                      {anulada ? "—" : saldo > 0 ? money(saldo) : "Pagada"}
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
