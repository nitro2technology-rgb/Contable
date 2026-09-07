import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Info, Plus } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th, Tr } from "@/components/ui";
import { StatTile } from "@/components/stats";
import { BotonEliminar } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { fechaInput, humanizar, money, MESES_CORTOS } from "@/lib/format";
import { MESES_POR_PERIODO } from "@/lib/catalogos";
import { costoFijoMensual, ingresoRecurrenteMensual } from "@/lib/consultas";
import { DialogoSuscripcion } from "./form";
import { eliminarSuscripcion, generarFactura } from "./actions";

export const metadata: Metadata = { title: "Suscripciones" };
export const dynamic = "force-dynamic";

export default async function PaginaSuscripciones() {
  const ahora = new Date();
  const anio = ahora.getUTCFullYear();
  const mes = ahora.getUTCMonth();

  const inicioMes = new Date(Date.UTC(anio, mes, 1));
  const finMes = new Date(Date.UTC(anio, mes + 1, 1));

  const [suscripciones, clientes, servicios, recurrente, fijos, facturadasEsteMes] =
    await Promise.all([
      prisma.suscripcion.findMany({
        orderBy: [{ activo: "desc" }, { creadoEn: "desc" }],
        include: {
          cliente: { select: { nombre: true } },
          servicio: { select: { nombre: true, tratamientoIva: true } },
          _count: { select: { facturas: true } },
        },
      }),
      prisma.cliente.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
      prisma.servicio.findMany({
        where: { activo: true },
        orderBy: [{ esRecurrente: "desc" }, { nombre: "asc" }],
      }),
      ingresoRecurrenteMensual(),
      costoFijoMensual(),
      prisma.factura.findMany({
        where: { suscripcionId: { not: null }, fechaEmision: { gte: inicioMes, lt: finMes } },
        select: { suscripcionId: true, id: true },
      }),
    ]);

  const yaFacturada = new Map(facturadasEsteMes.map((f) => [f.suscripcionId, f.id]));
  const activas = suscripciones.filter((s) => s.activo);
  const pendientes = activas.filter((s) => !yaFacturada.has(s.id));

  // Lo recurrente cubre la operación cuando supera al costo fijo: es la señal de
  // que la empresa se sostiene sin depender de cerrar proyectos nuevos.
  const cobertura = fijos.total > 0 ? recurrente.total / fijos.total : 0;

  return (
    <>
      <PageHeader
        titulo="Suscripciones"
        descripcion="Servicios que se le cobran al cliente cada periodo, y la factura de cada mes."
      >
        {clientes.length > 0 && servicios.length > 0 ? (
          <DialogoSuscripcion
            clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
            servicios={servicios.map((s) => ({
              id: s.id,
              nombre: s.nombre,
              precioBase: num(s.precioBase),
              tratamientoIva: s.tratamientoIva,
              esRecurrente: s.esRecurrente,
            }))}
          />
        ) : null}
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          etiqueta="Ingreso recurrente mensual"
          valor={recurrente.total}
          nota={`${recurrente.suscripciones} suscripción${recurrente.suscripciones === 1 ? "" : "es"} activa${recurrente.suscripciones === 1 ? "" : "s"}`}
          acento="var(--s1)"
        />
        <StatTile
          etiqueta="Ingreso recurrente anual"
          valor={recurrente.total * 12}
          nota="Proyección a 12 meses"
          acento="var(--s1)"
        />
        <StatTile
          etiqueta="Cobertura del costo fijo"
          valorTexto={fijos.total > 0 ? `${Math.round(cobertura * 100)} %` : "—"}
          nota={
            fijos.total > 0
              ? cobertura >= 1
                ? "Lo recurrente ya cubre la operación"
                : `Faltan ${money(fijos.total - recurrente.total)} al mes`
              : "Sin gastos fijos registrados"
          }
          acento="var(--s3)"
        />
        <StatTile
          etiqueta="Pendientes de facturar"
          valorTexto={String(pendientes.length)}
          nota={`Cobros de ${MESES_CORTOS[mes]} ${anio} sin emitir`}
          subirEsBueno={false}
          acento="var(--s4)"
        />
      </div>

      <Card>
        {suscripciones.length === 0 ? (
          <EmptyState
            titulo="Sin suscripciones"
            descripcion={
              clientes.length === 0 || servicios.length === 0
                ? "Primero necesitas al menos un cliente y un servicio en el catálogo."
                : "Registra los servicios que cobras cada mes —soporte, mantenimiento, licencias— para emitir su factura con un clic y ver cuánto ingreso recurrente tienes."
            }
          >
            {clientes.length === 0 || servicios.length === 0 ? (
              <div className="flex gap-2">
                <Link
                  href="/clientes"
                  className="inline-flex h-9 items-center rounded-lg border border-edge-strong px-3.5 text-sm font-medium text-ink hover:bg-surface-2"
                >
                  Clientes
                </Link>
                <Link
                  href="/servicios"
                  className="inline-flex h-9 items-center rounded-lg border border-edge-strong px-3.5 text-sm font-medium text-ink hover:bg-surface-2"
                >
                  Servicios
                </Link>
              </div>
            ) : null}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Servicio</Th>
                <Th>Periodicidad</Th>
                <Th numerico>Por periodo</Th>
                <Th numerico>Equiv. mensual</Th>
                <Th numerico>Facturas</Th>
                <Th>{MESES_CORTOS[mes]}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {suscripciones.map((s) => {
                const monto = num(s.monto);
                const mensual = Math.round(monto / MESES_POR_PERIODO[s.periodicidad]);
                const facturaId = yaFacturada.get(s.id);

                return (
                  <Tr key={s.id} className={s.activo ? undefined : "opacity-55"}>
                    <Td>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{s.cliente.nombre}</p>
                          <p className="text-xs text-ink-muted">
                            desde {new Date(s.fechaInicio).getUTCFullYear()} · día{" "}
                            {s.diaFacturacion} · {s.diasPlazo} d de plazo
                          </p>
                        </div>
                        {!s.activo ? <Badge tono="neutro">Inactiva</Badge> : null}
                      </div>
                    </Td>
                    <Td className="text-ink-2">{s.servicio.nombre}</Td>
                    <Td className="text-ink-2">{humanizar(s.periodicidad)}</Td>
                    <Td numerico>{money(monto)}</Td>
                    <Td numerico className="font-medium">
                      {money(mensual)}
                    </Td>
                    <Td numerico className="text-ink-2">
                      {s._count.facturas}
                    </Td>
                    <Td>
                      {!s.activo ? (
                        <span className="text-xs text-ink-muted">—</span>
                      ) : facturaId ? (
                        <Link href={`/facturas/${facturaId}`}>
                          <Badge
                            tono="bueno"
                            icono={<CircleCheck className="size-3" aria-hidden="true" />}
                          >
                            Facturada
                          </Badge>
                        </Link>
                      ) : (
                        <form action={generarFactura.bind(null, s.id, anio, mes)}>
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-md border border-edge px-2 py-1 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                          >
                            <Plus className="size-3" aria-hidden="true" />
                            Emitir
                          </button>
                        </form>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-3">
                        <DialogoSuscripcion
                          clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
                          servicios={servicios.map((x) => ({
                            id: x.id,
                            nombre: x.nombre,
                            precioBase: num(x.precioBase),
                            tratamientoIva: x.tratamientoIva,
                            esRecurrente: x.esRecurrente,
                          }))}
                          suscripcion={{
                            id: s.id,
                            clienteId: s.clienteId,
                            servicioId: s.servicioId,
                            monto,
                            periodicidad: s.periodicidad,
                            diaFacturacion: s.diaFacturacion,
                            diasPlazo: s.diasPlazo,
                            fechaInicio: fechaInput(s.fechaInicio),
                            fechaFin: s.fechaFin ? fechaInput(s.fechaFin) : "",
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
                          accion={eliminarSuscripcion.bind(null, s.id)}
                          etiqueta={s._count.facturas > 0 ? "Desactivar" : "Eliminar"}
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

      <div className="mt-4 flex gap-3 rounded-xl border border-edge bg-surface-2 px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-s1" aria-hidden="true" />
        <p className="text-sm text-ink-2">
          Emitir crea la factura del mes en curso con el IVA y las retenciones que correspondan, y la
          deja pendiente de cobro. La operación no duplica: si la factura de este mes ya existe, el
          botón se convierte en un enlace a ella.
        </p>
      </div>
    </>
  );
}
