import type { Metadata } from "next";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th, Tr } from "@/components/ui";
import { BotonEliminar } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { money, humanizar } from "@/lib/format";
import { ETIQUETAS_IVA, RETEFUENTE, tasaIva } from "@/lib/fiscal";
import { DialogoServicio } from "./form";
import { eliminarServicio } from "./actions";

export const metadata: Metadata = { title: "Servicios" };
export const dynamic = "force-dynamic";

export default async function PaginaServicios() {
  const servicios = await prisma.servicio.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: { _count: { select: { items: true } } },
  });

  const gravados = servicios.filter(
    (s) => s.activo && tasaIva(s.tratamientoIva) > 0
  ).length;

  return (
    <>
      <PageHeader
        titulo="Servicios"
        descripcion="Catálogo de lo que vendemos, con su tratamiento de IVA y retención en la fuente."
      >
        <DialogoServicio />
      </PageHeader>

      <div className="mb-5 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
        <p className="text-sm text-ink">
          <strong className="font-semibold">Somos responsables de IVA desde el primer peso.</strong>{" "}
          Como S.A.S. no existe tope mínimo de ingresos para cobrarlo: lo que decide la tarifa es el
          tratamiento del servicio, no cuánto facturemos. Hoy {gravados} de {servicios.length}{" "}
          servicios del catálogo están gravados.
        </p>
      </div>

      <Card>
        {servicios.length === 0 ? (
          <EmptyState
            titulo="El catálogo está vacío"
            descripcion="Registra tus servicios para facturarlos con el IVA y la retención correctos, sin tener que recordarlos cada vez."
          >
            <DialogoServicio />
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Servicio</Th>
                <Th>Categoría</Th>
                <Th>Cobro</Th>
                <Th>IVA</Th>
                <Th>Retefuente</Th>
                <Th numerico>Precio base</Th>
                <Th numerico>Veces facturado</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {servicios.map((s) => {
                const rete = RETEFUENTE[s.conceptoRetefuente];
                return (
                  <Tr key={s.id} className={s.activo ? undefined : "opacity-55"}>
                    <Td>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{s.nombre}</p>
                          {s.descripcion ? (
                            <p className="mt-0.5 max-w-md text-xs text-ink-muted">
                              {s.descripcion}
                            </p>
                          ) : null}
                        </div>
                        {!s.activo ? <Badge tono="neutro">Archivado</Badge> : null}
                      </div>
                    </Td>

                    <Td className="text-ink-2">{humanizar(s.categoria)}</Td>

                    <Td>
                      {s.esRecurrente ? (
                        <Badge tono="info" icono={<RefreshCw className="size-3" aria-hidden="true" />}>
                          {humanizar(s.periodicidad)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-ink-muted">Por proyecto</span>
                      )}
                    </Td>

                    <Td>
                      <Badge tono={tasaIva(s.tratamientoIva) > 0 ? "info" : "neutro"}>
                        {ETIQUETAS_IVA[s.tratamientoIva]}
                      </Badge>
                    </Td>

                    <Td>
                      {rete.tasa > 0 ? (
                        <span className="text-xs text-ink-2">
                          {rete.etiqueta}{" "}
                          <span className="tabular font-medium text-ink">
                            {(rete.tasa * 100).toFixed(1).replace(".0", "")} %
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-ink-muted">No aplica</span>
                      )}
                    </Td>

                    <Td numerico className="font-medium">
                      {num(s.precioBase) > 0 ? money(num(s.precioBase)) : "—"}
                    </Td>

                    <Td numerico className="text-ink-2">
                      {s._count.items}
                    </Td>

                    <Td>
                      <div className="flex items-center justify-end gap-3">
                        <DialogoServicio
                          servicio={{
                            id: s.id,
                            nombre: s.nombre,
                            descripcion: s.descripcion,
                            categoria: s.categoria,
                            precioBase: num(s.precioBase),
                            tratamientoIva: s.tratamientoIva,
                            conceptoRetefuente: s.conceptoRetefuente,
                            esRecurrente: s.esRecurrente,
                            periodicidad: s.periodicidad,
                            activo: s.activo,
                            notas: s.notas,
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
                          accion={eliminarServicio.bind(null, s.id)}
                          etiqueta={s._count.items > 0 ? "Archivar" : "Eliminar"}
                        />
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
