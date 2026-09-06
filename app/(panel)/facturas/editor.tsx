"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ConceptoRetefuente, TratamientoIva } from "@prisma/client";
import { AlertCircle, Info, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { ESTADO_INICIAL } from "@/components/dialog";
import { calcularFactura, ETIQUETAS_IVA, RETEFUENTE, TASA_RETEIVA } from "@/lib/fiscal";
import { fechaInput, money } from "@/lib/format";
import { guardarFactura } from "./actions";

const TRATAMIENTOS: TratamientoIva[] = ["GRAVADO_19", "GRAVADO_5", "EXENTO", "EXCLUIDO"];
const CONCEPTOS: ConceptoRetefuente[] = [
  "NINGUNO",
  "HONORARIOS",
  "SERVICIOS",
  "COMPRAS",
  "ARRENDAMIENTO",
];

export type ClienteOpcion = {
  id: string;
  nombre: string;
  nit: string;
  practicaRetefuente: boolean;
  practicaReteIva: boolean;
  practicaReteIca: boolean;
  tarifaReteIcaPorMil: number;
};

export type ServicioOpcion = {
  id: string;
  nombre: string;
  precioBase: number;
  tratamientoIva: TratamientoIva;
  conceptoRetefuente: ConceptoRetefuente;
};

type Linea = {
  clave: string;
  servicioId: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  tratamientoIva: TratamientoIva;
  conceptoRetefuente: ConceptoRetefuente;
};

function lineaVacia(): Linea {
  return {
    clave: Math.random().toString(36).slice(2),
    servicioId: "",
    descripcion: "",
    cantidad: 1,
    precioUnitario: 0,
    tratamientoIva: "GRAVADO_19",
    conceptoRetefuente: "SERVICIOS",
  };
}

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variante="primario" disabled={pending}>
      {pending ? "Guardando…" : "Guardar factura"}
    </Button>
  );
}

export function EditorFactura({
  clientes,
  servicios,
  numeroSugerido,
  valorUvt,
  factura,
}: {
  clientes: ClienteOpcion[];
  servicios: ServicioOpcion[];
  numeroSugerido: string;
  valorUvt: number;
  factura?: {
    id: string;
    numero: string;
    clienteId: string;
    fechaEmision: string;
    fechaVencimiento: string;
    proyecto: string;
    notas: string;
    estado: string;
    lineas: Omit<Linea, "clave">[];
  };
}) {
  const [estado, accion] = useActionState(guardarFactura, ESTADO_INICIAL);

  const [clienteId, setClienteId] = React.useState(factura?.clienteId ?? clientes[0]?.id ?? "");
  const [lineas, setLineas] = React.useState<Linea[]>(
    factura?.lineas.length
      ? factura.lineas.map((l) => ({ ...l, clave: Math.random().toString(36).slice(2) }))
      : [lineaVacia()]
  );

  const hoy = new Date();
  const en30 = new Date(hoy.getTime() + 30 * 86_400_000);

  const cliente = clientes.find((c) => c.id === clienteId);

  // Los totales se recalculan con la misma función que usa el servidor al
  // guardar, así que la vista previa no puede divergir del registro contable.
  const totales = React.useMemo(
    () =>
      calcularFactura(
        lineas.map((l) => ({
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          tratamientoIva: l.tratamientoIva,
          conceptoRetefuente: l.conceptoRetefuente,
        })),
        {
          practicaRetefuente: cliente?.practicaRetefuente ?? false,
          practicaReteIva: cliente?.practicaReteIva ?? false,
          practicaReteIca: cliente?.practicaReteIca ?? false,
          tarifaReteIcaPorMil: cliente?.tarifaReteIcaPorMil ?? 0,
        },
        valorUvt
      ),
    [lineas, cliente, valorUvt]
  );

  function actualizar(clave: string, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));
  }

  function aplicarServicio(clave: string, servicioId: string) {
    const s = servicios.find((x) => x.id === servicioId);
    if (!s) {
      actualizar(clave, { servicioId: "" });
      return;
    }
    actualizar(clave, {
      servicioId,
      descripcion: s.nombre,
      precioUnitario: s.precioBase,
      tratamientoIva: s.tratamientoIva,
      conceptoRetefuente: s.conceptoRetefuente,
    });
  }

  return (
    <form action={accion} className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
      {factura ? <input type="hidden" name="id" value={factura.id} /> : null}
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          lineas.map(({ clave: _clave, ...l }) => l)
        )}
      />

      <div className="space-y-5">
        {/* --- Cabecera ------------------------------------------------- */}
        <Card>
          <CardHeader titulo="Datos de la factura" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Cliente" className="sm:col-span-2">
              <Select
                name="clienteId"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                required
              >
                <option value="">Selecciona un cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                    {c.nit ? ` — ${c.nit}` : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Número">
              <Input name="numero" defaultValue={factura?.numero ?? numeroSugerido} required />
            </Field>

            <Field label="Estado">
              <Select name="estado" defaultValue={factura?.estado === "BORRADOR" ? "BORRADOR" : "EMITIDA"}>
                <option value="EMITIDA">Emitida</option>
                <option value="BORRADOR">Borrador</option>
              </Select>
            </Field>

            <Field label="Fecha de emisión">
              <Input
                type="date"
                name="fechaEmision"
                defaultValue={factura?.fechaEmision ?? fechaInput(hoy)}
                required
              />
            </Field>

            <Field label="Fecha de vencimiento">
              <Input
                type="date"
                name="fechaVencimiento"
                defaultValue={factura?.fechaVencimiento ?? fechaInput(en30)}
                required
              />
            </Field>

            <Field label="Proyecto" className="sm:col-span-2">
              <Input
                name="proyecto"
                defaultValue={factura?.proyecto}
                placeholder="Automatización del flujo de pedidos — fase 2"
              />
            </Field>
          </div>
        </Card>

        {/* --- Líneas ---------------------------------------------------- */}
        <Card>
          <CardHeader
            titulo="Conceptos facturados"
            descripcion="Cada línea lleva su propio tratamiento de IVA y de retención."
            accion={
              <Button type="button" onClick={() => setLineas((p) => [...p, lineaVacia()])}>
                <Plus className="size-4" aria-hidden="true" />
                Añadir línea
              </Button>
            }
          />

          <div className="divide-y divide-edge">
            {lineas.map((l, i) => {
              const base = Math.round(l.cantidad * l.precioUnitario);
              return (
                <div key={l.clave} className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-muted">Línea {i + 1}</span>
                    {lineas.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setLineas((p) => p.filter((x) => x.clave !== l.clave))}
                        className="flex items-center gap-1 text-xs text-ink-muted hover:text-critical"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Quitar
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-6">
                    {servicios.length > 0 ? (
                      <Field label="Desde el catálogo" className="sm:col-span-6">
                        <Select
                          value={l.servicioId}
                          onChange={(e) => aplicarServicio(l.clave, e.target.value)}
                        >
                          <option value="">Escribir a mano…</option>
                          {servicios.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nombre} — {ETIQUETAS_IVA[s.tratamientoIva]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    ) : null}

                    <Field label="Descripción" className="sm:col-span-6">
                      <Input
                        value={l.descripcion}
                        onChange={(e) => actualizar(l.clave, { descripcion: e.target.value })}
                        placeholder="Desarrollo del módulo de integración"
                        required
                      />
                    </Field>

                    <Field label="Cantidad" className="sm:col-span-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.cantidad}
                        onChange={(e) =>
                          actualizar(l.clave, { cantidad: Number(e.target.value) || 0 })
                        }
                      />
                    </Field>

                    <Field label="Valor unitario" className="sm:col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={l.precioUnitario}
                        onChange={(e) =>
                          actualizar(l.clave, { precioUnitario: Number(e.target.value) || 0 })
                        }
                      />
                    </Field>

                    <Field label="IVA" className="sm:col-span-1">
                      <Select
                        value={l.tratamientoIva}
                        onChange={(e) =>
                          actualizar(l.clave, {
                            tratamientoIva: e.target.value as TratamientoIva,
                          })
                        }
                      >
                        {TRATAMIENTOS.map((t) => (
                          <option key={t} value={t}>
                            {ETIQUETAS_IVA[t]}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Retefuente" className="sm:col-span-2">
                      <Select
                        value={l.conceptoRetefuente}
                        onChange={(e) =>
                          actualizar(l.clave, {
                            conceptoRetefuente: e.target.value as ConceptoRetefuente,
                          })
                        }
                      >
                        {CONCEPTOS.map((c) => (
                          <option key={c} value={c}>
                            {RETEFUENTE[c].etiqueta}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <p className="mt-3 text-xs text-ink-muted">
                    Base <span className="tabular font-medium text-ink">{money(base)}</span> · IVA{" "}
                    <span className="tabular font-medium text-ink">
                      {money(Math.round(base * (l.tratamientoIva === "GRAVADO_19" ? 0.19 : l.tratamientoIva === "GRAVADO_5" ? 0.05 : 0)))}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader titulo="Notas" />
          <div className="p-5">
            <Textarea
              name="notas"
              defaultValue={factura?.notas}
              rows={3}
              placeholder="Condiciones de pago, número de orden de compra, alcance acordado…"
            />
          </div>
        </Card>
      </div>

      {/* --- Resumen tributario en vivo ------------------------------------ */}
      <div className="lg:sticky lg:top-6">
        <Card>
          <CardHeader titulo="Resumen" descripcion="Se recalcula mientras escribes." />

          <dl className="space-y-2.5 p-5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">Subtotal</dt>
              <dd className="tabular font-medium text-ink">{money(totales.subtotal)}</dd>
            </div>

            {totales.ivaPorTratamiento
              .filter((t) => t.base > 0)
              .map((t) => (
                <div key={t.tratamiento} className="flex justify-between gap-3">
                  <dt className="text-ink-2">IVA · {ETIQUETAS_IVA[t.tratamiento]}</dt>
                  <dd className="tabular text-ink">{money(t.iva)}</dd>
                </div>
              ))}

            <div className="flex justify-between gap-3 border-t border-edge pt-2.5">
              <dt className="font-medium text-ink">Total factura</dt>
              <dd className="tabular font-semibold text-ink">{money(totales.total)}</dd>
            </div>

            {totales.retefuente > 0 || totales.reteIva > 0 || totales.reteIca > 0 ? (
              <div className="space-y-2.5 border-t border-edge pt-2.5">
                <p className="text-xs font-medium text-ink-muted">Retenciones del cliente</p>
                {totales.retefuente > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-2">Retención en la fuente</dt>
                    <dd className="tabular text-critical">−{money(totales.retefuente)}</dd>
                  </div>
                ) : null}
                {totales.reteIva > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-2">ReteIVA ({TASA_RETEIVA * 100} %)</dt>
                    <dd className="tabular text-critical">−{money(totales.reteIva)}</dd>
                  </div>
                ) : null}
                {totales.reteIca > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-2">ReteICA</dt>
                    <dd className="tabular text-critical">−{money(totales.reteIca)}</dd>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-between gap-3 border-t border-edge pt-2.5">
              <dt className="font-medium text-ink">Consignan</dt>
              <dd className="tabular text-lg font-semibold text-ink">
                {money(totales.netoACobrar)}
              </dd>
            </div>
          </dl>

          <div className="border-t border-edge p-5">
            <p className="flex gap-2 text-xs text-ink-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-s1" aria-hidden="true" />
              <span>
                Las retenciones no son una pérdida: la retefuente es un anticipo del impuesto de
                renta y el ReteIVA se descuenta en la declaración bimestral.
              </span>
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-edge p-5">
            {estado.error ? (
              <p role="alert" className="mr-auto flex items-center gap-1.5 text-sm text-critical">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                {estado.error}
              </p>
            ) : null}
            <BotonGuardar />
          </div>
        </Card>
      </div>
    </form>
  );
}
