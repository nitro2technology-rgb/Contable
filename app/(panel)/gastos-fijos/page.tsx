import type { Metadata } from "next";
import { CircleCheck, Plus } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th, Tr } from "@/components/ui";
import { StatTile } from "@/components/stats";
import { BarraApilada, SERIES } from "@/components/charts";
import { BotonEliminar } from "@/components/dialog";
import { num, prisma } from "@/lib/db";
import { fechaInput, humanizar, money, MESES_CORTOS } from "@/lib/format";
import { costoFijoMensual } from "@/lib/consultas";
import { MESES_POR_PERIODO } from "@/lib/catalogos";
import { DialogoGastoFijo } from "./form";
import { eliminarGastoFijo, generarCargo } from "../gastos/actions";

export const metadata: Metadata = { title: "Gastos fijos" };
export const dynamic = "force-dynamic";

export default async function PaginaGastosFijos() {
  const ahora = new Date();
  const anio = ahora.getUTCFullYear();
  const mes = ahora.getUTCMonth();

  const inicioMes = new Date(Date.UTC(anio, mes, 1));
  const finMes = new Date(Date.UTC(anio, mes + 1, 1));

  const [plantillas, resumen, cargosDelMes] = await Promise.all([
    prisma.gastoRecurrente.findMany({ orderBy: [{ activo: "desc" }, { concepto: "asc" }] }),
    costoFijoMensual(),
    prisma.gasto.findMany({
      where: { recurrenteId: { not: null }, fecha: { gte: inicioMes, lt: finMes } },
      select: { recurrenteId: true },
    }),
  ]);

  const yaCargado = new Set(cargosDelMes.map((g) => g.recurrenteId));

  const activas = plantillas.filter((p) => p.activo);
  const pendientes = activas.filter((p) => !yaCargado.has(p.id));

  // Reparto del costo fijo por categoría, normalizado a su equivalente mensual.
  const porCategoria = new Map<string, number>();
  for (const p of activas) {
    const base = num(p.base);
    const iva = base * num(p.tasaIva);
    const mensual = (base + (p.ivaDescontable ? 0 : iva)) / MESES_POR_PERIODO[p.periodicidad];
    porCategoria.set(p.categoria, (porCategoria.get(p.categoria) ?? 0) + mensual);
  }

  const segmentos = [...porCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([categoria, valor], i) => ({
      nombre: humanizar(categoria),
      valor,
      color: SERIES[i],
    }));

  return (
    <>
      <PageHeader
        titulo="Gastos fijos"
        descripcion="Los cargos recurrentes que sostienen la operación mes a mes."
      >
        <DialogoGastoFijo />
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatTile
          etiqueta="Costo fijo mensual"
          valor={resumen.total}
          nota="Equivalente mensual de todos los recurrentes"
          acento="var(--s2)"
        />
        <StatTile
          etiqueta="Costo fijo anual"
          valor={resumen.total * 12}
          nota="Proyección a 12 meses"
          acento="var(--s2)"
        />
        <StatTile
          etiqueta="Pendientes de registrar"
          valorTexto={String(pendientes.length)}
          nota={`Cargos de ${MESES_CORTOS[mes]} ${anio} sin movimiento`}
          subirEsBueno={false}
          acento="var(--s4)"
        />
      </div>

      {segmentos.length > 0 ? (
        <Card className="mb-5 p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Reparto del costo fijo mensual
          </h2>
          <BarraApilada segmentos={segmentos} />
        </Card>
      ) : null}

      <Card>
        {plantillas.length === 0 ? (
          <EmptyState
            titulo="Sin gastos fijos"
            descripcion="Registra los cargos recurrentes —servidores, APIs, dominios, herramientas— para saber cuánto necesitas facturar cada mes solo para cubrir la operación."
          >
            <DialogoGastoFijo />
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Concepto</Th>
                <Th>Categoría</Th>
                <Th>Periodicidad</Th>
                <Th numerico>Cargo</Th>
                <Th numerico>Equiv. mensual</Th>
                <Th>{MESES_CORTOS[mes]}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {plantillas.map((p) => {
                const base = num(p.base);
                const iva = Math.round(base * num(p.tasaIva));
                const mensual = Math.round((base + iva) / MESES_POR_PERIODO[p.periodicidad]);
                const cargado = yaCargado.has(p.id);

                return (
                  <Tr key={p.id} className={p.activo ? undefined : "opacity-55"}>
                    <Td>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{p.concepto}</p>
                          <p className="text-xs text-ink-muted">
                            {p.proveedor || "Sin proveedor"} · día {p.diaCobro}
                          </p>
                        </div>
                        {!p.activo ? <Badge tono="neutro">Inactivo</Badge> : null}
                      </div>
                    </Td>
                    <Td className="text-ink-2">{humanizar(p.categoria)}</Td>
                    <Td className="text-ink-2">{humanizar(p.periodicidad)}</Td>
                    <Td numerico>{money(base + iva)}</Td>
                    <Td numerico className="font-medium">
                      {money(mensual)}
                    </Td>
                    <Td>
                      {!p.activo ? (
                        <span className="text-xs text-ink-muted">—</span>
                      ) : cargado ? (
                        <Badge
                          tono="bueno"
                          icono={<CircleCheck className="size-3" aria-hidden="true" />}
                        >
                          Registrado
                        </Badge>
                      ) : (
                        <form action={generarCargo.bind(null, p.id, anio, mes)}>
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-md border border-edge px-2 py-1 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                          >
                            <Plus className="size-3" aria-hidden="true" />
                            Registrar
                          </button>
                        </form>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-3">
                        <DialogoGastoFijo
                          gasto={{
                            id: p.id,
                            concepto: p.concepto,
                            proveedor: p.proveedor,
                            categoria: p.categoria,
                            base,
                            tasaIva: num(p.tasaIva),
                            ivaDescontable: p.ivaDescontable,
                            deducible: p.deducible,
                            periodicidad: p.periodicidad,
                            diaCobro: p.diaCobro,
                            fechaInicio: fechaInput(p.fechaInicio),
                            activo: p.activo,
                            notas: p.notas,
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
                          accion={eliminarGastoFijo.bind(null, p.id)}
                          etiqueta="Eliminar"
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

      <p className="mt-4 text-xs text-ink-muted">
        Registrar un cargo crea el gasto real del mes en curso. La operación no duplica: si el cargo
        de este mes ya existe, no vuelve a crearlo.
      </p>
    </>
  );
}
