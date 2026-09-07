import type { Metadata } from "next";
import Link from "next/link";
import { Repeat, Users } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th, Tr } from "@/components/ui";
import { StatTile } from "@/components/stats";
import { BarrasHorizontales, ChartCard } from "@/components/charts";
import { BotonEliminar } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { fecha, fechaInput, humanizar, money } from "@/lib/format";
import { aniosConMovimiento, gastosPorCategoria, rangoAnio } from "@/lib/consultas";
import { SelectorAnio } from "../selector-anio";
import { DialogoGasto } from "./form";
import { eliminarGasto } from "./actions";

export const metadata: Metadata = { title: "Gastos" };
export const dynamic = "force-dynamic";

export default async function PaginaGastos({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const { anio: anioParam } = await searchParams;
  const anio = Number(anioParam) || new Date().getUTCFullYear();
  const { inicio, fin } = rangoAnio(anio);

  const [gastos, porCategoria, anios] = await Promise.all([
    prisma.gasto.findMany({
      where: { fecha: { gte: inicio, lt: fin } },
      orderBy: { fecha: "desc" },
      take: 300,
      include: { movimientoSocio: { select: { socio: { select: { nombre: true } } } } },
    }),
    gastosPorCategoria(inicio, fin),
    aniosConMovimiento(),
  ]);

  let totalBase = 0;
  let totalIva = 0;
  let ivaDescontable = 0;
  let noDeducible = 0;

  for (const g of gastos) {
    const iva = num(g.ivaValor);
    totalBase += num(g.base);
    totalIva += iva;
    if (g.ivaDescontable) ivaDescontable += iva;
    if (!g.deducible) noDeducible += num(g.base);
  }

  return (
    <>
      <PageHeader
        titulo="Gastos operativos"
        descripcion={`Egresos de ${anio}: servidores, APIs, dominios, marketing y todo lo demás.`}
      >
        <SelectorAnio anio={anio} anios={anios} />
        <Link
          href="/gastos-fijos"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-edge-strong px-3.5 text-sm font-medium text-ink hover:bg-surface-2"
        >
          <Repeat className="size-4" aria-hidden="true" />
          Gastos fijos
        </Link>
        <DialogoGasto />
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile etiqueta="Gasto del año (sin IVA)" valor={totalBase} acento="var(--s2)" />
        <StatTile etiqueta="IVA pagado" valor={totalIva} acento="var(--s4)" />
        <StatTile
          etiqueta="IVA descontable"
          valor={ivaDescontable}
          nota="Se resta del IVA generado"
          acento="var(--s3)"
        />
        <StatTile
          etiqueta="Gasto no deducible"
          valor={noDeducible}
          nota={noDeducible > 0 ? "No baja la base de renta" : "Todo el gasto es deducible"}
          subirEsBueno={false}
          acento="var(--s8)"
        />
      </div>

      {porCategoria.length > 0 ? (
        <div className="mb-5">
          <ChartCard
            titulo="Gasto por categoría"
            descripcion={`Distribución de los egresos de ${anio}, sin IVA`}
            altura={Math.max(220, porCategoria.length * 34)}
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
      ) : null}

      <Card>
        {gastos.length === 0 ? (
          <EmptyState
            titulo={`Sin gastos registrados en ${anio}`}
            descripcion="Registra los egresos para que la utilidad neta y el IVA descontable reflejen la realidad."
          >
            <DialogoGasto />
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Concepto</Th>
                <Th>Categoría</Th>
                <Th numerico>Base</Th>
                <Th numerico>IVA</Th>
                <Th numerico>Total</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <Tr key={g.id}>
                  <Td className="tabular whitespace-nowrap text-ink-2">{fecha(g.fecha)}</Td>
                  <Td>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{g.concepto}</p>
                        <p className="text-xs text-ink-muted">
                          {g.proveedor || "Sin proveedor"}
                          {!g.deducible ? " · no deducible" : ""}
                          {num(g.ivaValor) > 0 && !g.ivaDescontable ? " · IVA no descontable" : ""}
                        </p>
                      </div>
                      {g.recurrenteId ? (
                        <Badge tono="neutro" icono={<Repeat className="size-3" aria-hidden="true" />}>
                          Fijo
                        </Badge>
                      ) : null}
                      {g.movimientoSocio ? (
                        <Badge tono="aviso" icono={<Users className="size-3" aria-hidden="true" />}>
                          Socio
                        </Badge>
                      ) : null}
                    </div>
                  </Td>
                  <Td className="text-ink-2">{humanizar(g.categoria)}</Td>
                  <Td numerico>{money(num(g.base))}</Td>
                  <Td numerico className="text-ink-2">
                    {num(g.ivaValor) > 0 ? money(num(g.ivaValor)) : "—"}
                  </Td>
                  <Td numerico className="font-medium">
                    {money(num(g.total))}
                  </Td>
                  <Td>
                    {/* Un gasto nacido de unos honorarios se administra desde
                        Socios: editarlo aquí dejaría el movimiento del socio
                        diciendo una cifra y el gasto otra. */}
                    {g.movimientoSocio ? (
                      <div className="flex justify-end">
                        <Link
                          href="/socios"
                          className="text-xs font-medium text-ink-2 hover:text-s1"
                        >
                          Ver en Socios
                        </Link>
                      </div>
                    ) : (
                    <div className="flex items-center justify-end gap-3">
                      <DialogoGasto
                        gasto={{
                          id: g.id,
                          fecha: fechaInput(g.fecha),
                          concepto: g.concepto,
                          proveedor: g.proveedor,
                          categoria: g.categoria,
                          base: num(g.base),
                          tasaIva: num(g.tasaIva),
                          ivaDescontable: g.ivaDescontable,
                          deducible: g.deducible,
                          metodoPago: g.metodoPago,
                          notas: g.notas,
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
                      <BotonEliminar accion={eliminarGasto.bind(null, g.id)} />
                    </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
