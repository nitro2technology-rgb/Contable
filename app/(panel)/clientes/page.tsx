import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th, Tr } from "@/components/ui";
import { BotonEliminar } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { money } from "@/lib/format";
import { ESTADOS_VIGENTES } from "@/lib/consultas";
import { DialogoCliente } from "./form";
import { eliminarCliente } from "./actions";

export const metadata: Metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

export default async function PaginaClientes() {
  const clientes = await prisma.cliente.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: {
      facturas: {
        select: {
          estado: true,
          subtotal: true,
          netoACobrar: true,
          pagos: { select: { monto: true } },
        },
      },
    },
  });

  const filas = clientes.map((c) => {
    let facturado = 0;
    let pendiente = 0;

    for (const f of c.facturas) {
      if (!ESTADOS_VIGENTES.includes(f.estado)) continue;
      facturado += num(f.subtotal);
      const pagado = f.pagos.reduce((a, p) => a + num(p.monto), 0);
      if (f.estado !== "PAGADA") pendiente += Math.max(num(f.netoACobrar) - pagado, 0);
    }

    return {
      ...c,
      tarifaReteIcaPorMil: num(c.tarifaReteIcaPorMil),
      facturas: c.facturas.length,
      facturado,
      pendiente,
    };
  });

  const totalFacturado = filas.reduce((a, f) => a + f.facturado, 0);
  const activos = filas.filter((f) => f.activo).length;

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descripcion={`${activos} cliente${activos === 1 ? "" : "s"} activo${activos === 1 ? "" : "s"} · ${money(totalFacturado)} facturados históricamente.`}
      >
        <DialogoCliente />
      </PageHeader>

      <Card>
        {filas.length === 0 ? (
          <EmptyState
            titulo="Aún no hay clientes"
            descripcion="Registra el primer cliente para poder emitirle facturas y calcular sus retenciones."
          >
            <DialogoCliente />
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Contacto</Th>
                <Th>Retenciones</Th>
                <Th numerico>Facturas</Th>
                <Th numerico>Facturado</Th>
                <Th numerico>Por cobrar</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => (
                <Tr key={c.id} className={c.activo ? undefined : "opacity-55"}>
                  <Td>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{c.nombre}</p>
                        <p className="text-xs text-ink-muted">
                          {c.nit || "Sin NIT"} ·{" "}
                          {c.tipoPersona === "JURIDICA" ? "Jurídica" : "Natural"}
                          {c.ciudad ? ` · ${c.ciudad}` : ""}
                        </p>
                      </div>
                      {!c.activo ? <Badge tono="neutro">Archivado</Badge> : null}
                    </div>
                  </Td>

                  <Td>
                    <div className="space-y-0.5 text-xs text-ink-2">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="flex items-center gap-1.5 hover:text-s1"
                        >
                          <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                          {c.email}
                        </a>
                      ) : null}
                      {c.telefono ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                          {c.telefono}
                        </span>
                      ) : null}
                      {!c.email && !c.telefono ? (
                        <span className="text-ink-muted">—</span>
                      ) : null}
                    </div>
                  </Td>

                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {c.practicaRetefuente ? <Badge tono="info">Retefuente</Badge> : null}
                      {c.practicaReteIva ? <Badge tono="info">ReteIVA</Badge> : null}
                      {c.practicaReteIca ? (
                        <Badge tono="info">ICA {c.tarifaReteIcaPorMil}‰</Badge>
                      ) : null}
                      {!c.practicaRetefuente && !c.practicaReteIva && !c.practicaReteIca ? (
                        <span className="text-xs text-ink-muted">No retiene</span>
                      ) : null}
                    </div>
                  </Td>

                  <Td numerico className="text-ink-2">
                    {c.facturas}
                  </Td>
                  <Td numerico className="font-medium">
                    {money(c.facturado)}
                  </Td>
                  <Td numerico className={c.pendiente > 0 ? "font-medium text-ink" : "text-ink-muted"}>
                    {c.pendiente > 0 ? money(c.pendiente) : "—"}
                  </Td>

                  <Td>
                    <div className="flex items-center justify-end gap-3">
                      <DialogoCliente
                        cliente={{
                          id: c.id,
                          nombre: c.nombre,
                          nit: c.nit,
                          tipoPersona: c.tipoPersona,
                          email: c.email,
                          telefono: c.telefono,
                          direccion: c.direccion,
                          ciudad: c.ciudad,
                          contacto: c.contacto,
                          practicaRetefuente: c.practicaRetefuente,
                          practicaReteIva: c.practicaReteIva,
                          practicaReteIca: c.practicaReteIca,
                          tarifaReteIcaPorMil: c.tarifaReteIcaPorMil,
                          notas: c.notas,
                          activo: c.activo,
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
                        accion={eliminarCliente.bind(null, c.id)}
                        etiqueta={c.facturas > 0 ? "Archivar" : "Eliminar"}
                        confirmacion={
                          c.facturas > 0 ? "¿Archivar el cliente?" : "¿Eliminar el cliente?"
                        }
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="mt-4 text-xs text-ink-muted">
        Un cliente con facturas emitidas no se elimina: se archiva, para no romper la trazabilidad
        contable. Consulta su histórico desde{" "}
        <Link href="/facturas" className="text-s1 underline-offset-2 hover:underline">
          Facturas
        </Link>
        .
      </p>
    </>
  );
}
