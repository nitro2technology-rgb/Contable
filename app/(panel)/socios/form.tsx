"use client";

import { useActionState, useState } from "react";
import { Info, Plus, TriangleAlert, UserPlus } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ESTADO_INICIAL, FormDialog } from "@/components/dialog";
import { fechaInput, money } from "@/lib/format";
import { guardarMovimiento, guardarSocio } from "./actions";

// ---------------------------------------------------------------------------
// Socio
// ---------------------------------------------------------------------------

export type SocioForm = {
  id: string;
  nombre: string;
  documento: string;
  email: string;
  telefono: string;
  participacion: number;
  activo: boolean;
  notas: string;
};

export function DialogoSocio({
  socio,
  disparador,
}: {
  socio?: SocioForm;
  disparador?: React.ReactNode;
}) {
  const [estado, accion] = useActionState(guardarSocio, ESTADO_INICIAL);
  const s = socio;

  return (
    <FormDialog
      disparador={
        disparador ?? (
          <Button>
            <UserPlus className="size-4" aria-hidden="true" />
            Nuevo socio
          </Button>
        )
      }
      titulo={s ? "Editar socio" : "Nuevo socio"}
      accion={accion}
      estado={estado}
    >
      {s ? <input type="hidden" name="id" value={s.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2">
          <Input name="nombre" defaultValue={s?.nombre} required autoFocus />
        </Field>

        <Field label="Documento">
          <Input name="documento" defaultValue={s?.documento} />
        </Field>

        <Field label="Participación (%)" hint="Porcentaje del capital social.">
          <Input
            type="number"
            name="participacion"
            min="0"
            max="100"
            step="0.01"
            defaultValue={s ? s.participacion * 100 : 50}
          />
        </Field>

        <Field label="Correo">
          <Input type="email" name="email" defaultValue={s?.email} />
        </Field>

        <Field label="Teléfono">
          <Input name="telefono" defaultValue={s?.telefono} />
        </Field>

        <Field label="Notas" className="sm:col-span-2">
          <Textarea name="notas" defaultValue={s?.notas} rows={2} />
        </Field>
      </div>

      <div className="mt-4">
        <Checkbox name="activo" label="Socio activo" defaultChecked={s?.activo ?? true} />
      </div>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Movimiento
// ---------------------------------------------------------------------------

const TIPOS = [
  {
    valor: "HONORARIOS",
    etiqueta: "Honorarios por proyecto",
    nota: "Pago al socio por el trabajo hecho en un proyecto. Es GASTO de la empresa: baja la utilidad. No es deuda ni cancela la que tenga.",
    aumentaDeuda: false,
    esGasto: true,
    llevaProyecto: true,
  },
  {
    valor: "PRESTAMO",
    etiqueta: "Préstamo al socio",
    nota: "La empresa le presta dinero. Deja el saldo del socio en negativo hasta que lo devuelva. No es gasto.",
    aumentaDeuda: true,
    esGasto: false,
    llevaProyecto: false,
  },
  {
    valor: "RETIRO",
    etiqueta: "Retiro de dinero",
    nota: "El socio toma dinero de la caja sin respaldo de honorarios ni utilidades decretadas. Cuenta igual que un préstamo: deja el saldo en negativo.",
    aumentaDeuda: true,
    esGasto: false,
    llevaProyecto: false,
  },
  {
    valor: "ABONO",
    etiqueta: "Abono / devolución",
    nota: "El socio devuelve dinero. Es lo único que sube el saldo hacia cero.",
    aumentaDeuda: false,
    esGasto: false,
    llevaProyecto: false,
  },
  {
    valor: "DISTRIBUCION_UTILIDADES",
    etiqueta: "Distribución de utilidades",
    nota: "Utilidades decretadas a favor del socio. Es patrimonio, no gasto, y NO cancela lo que deba: si quieres saldar un préstamo con utilidades, registra además el abono.",
    aumentaDeuda: false,
    esGasto: false,
    llevaProyecto: false,
  },
  {
    valor: "APORTE_CAPITAL",
    etiqueta: "Aporte de capital",
    nota: "El socio pone dinero en la empresa. Es patrimonio: no es deuda ni gasto.",
    aumentaDeuda: false,
    esGasto: false,
    llevaProyecto: false,
  },
] as const;

export type MovimientoForm = {
  id: string;
  socioId: string;
  fecha: string;
  tipo: string;
  monto: number;
  concepto: string;
  notas: string;
  fechaCompromiso: string;
  facturaId: string;
};

export type ProyectoOpcion = {
  facturaId: string;
  numero: string;
  proyecto: string;
  cliente: string;
  base: number;
  repartido: number;
  disponible: number;
};

export function DialogoMovimiento({
  socios,
  proyectos,
  movimiento,
  socioIdPorDefecto,
  facturaIdPorDefecto,
  disparador,
}: {
  socios: { id: string; nombre: string }[];
  proyectos: ProyectoOpcion[];
  movimiento?: MovimientoForm;
  socioIdPorDefecto?: string;
  facturaIdPorDefecto?: string;
  disparador?: React.ReactNode;
}) {
  const [estado, accion] = useActionState(guardarMovimiento, ESTADO_INICIAL);
  const m = movimiento;

  const [tipo, setTipo] = useState<string>(m?.tipo ?? "HONORARIOS");
  const [facturaId, setFacturaId] = useState<string>(m?.facturaId ?? facturaIdPorDefecto ?? "");
  const [monto, setMonto] = useState<number>(m?.monto ?? 0);

  const definicion = TIPOS.find((t) => t.valor === tipo) ?? TIPOS[0];
  const proyecto = proyectos.find((p) => p.facturaId === facturaId);

  // Al editar, lo ya repartido incluye este mismo movimiento: hay que devolverlo
  // al disponible o el formulario se acusaría a sí mismo de excederse.
  const yaRepartido = proyecto
    ? proyecto.repartido - (m && m.facturaId === facturaId ? m.monto : 0)
    : 0;
  const disponible = proyecto ? proyecto.base - yaRepartido : 0;
  const excede = Boolean(proyecto) && monto > disponible;

  return (
    <FormDialog
      disparador={
        disparador ?? (
          <Button variante="primario">
            <Plus className="size-4" aria-hidden="true" />
            Registrar movimiento
          </Button>
        )
      }
      titulo={m ? "Editar movimiento" : "Registrar movimiento"}
      descripcion="Elige explícitamente el socio: el acceso es compartido y el sistema no puede deducirlo."
      accion={accion}
      estado={estado}
      ancho="max-w-xl"
    >
      {m ? <input type="hidden" name="id" value={m.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Socio" className="sm:col-span-2">
          <Select
            name="socioId"
            defaultValue={m?.socioId ?? socioIdPorDefecto ?? ""}
            required
            autoFocus
          >
            <option value="">Selecciona el socio…</option>
            {socios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tipo de movimiento" className="sm:col-span-2">
          <Select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </Select>
        </Field>

        <div className="space-y-2 sm:col-span-2">
          <p className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-s1" aria-hidden="true" />
            <span>{definicion.nota}</span>
          </p>

          {definicion.esGasto ? (
            <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-ink">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Se creará también un gasto por este monto, así que la utilidad bajará. Pagar
                honorarios a un socio suele exigir retención en la fuente y un soporte válido
                (cuenta de cobro o contrato): esto lo registra, no lo formaliza. Confírmalo con tu
                contador.
              </span>
            </p>
          ) : null}
        </div>

        {definicion.llevaProyecto ? (
          <Field
            label="Proyecto facturado"
            className="sm:col-span-2"
            hint="Opcional. Vincularlo permite ver cuánto de cada proyecto se ha repartido."
          >
            <Select
              name="facturaId"
              value={facturaId}
              onChange={(e) => setFacturaId(e.target.value)}
            >
              <option value="">Sin proyecto asociado</option>
              {proyectos.map((p) => (
                <option key={p.facturaId} value={p.facturaId}>
                  {p.numero} · {p.proyecto || p.cliente} — {money(p.disponible)} sin repartir
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="facturaId" value="" />
        )}

        {proyecto ? (
          <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm sm:col-span-2">
            <div className="flex justify-between gap-3">
              <span className="text-ink-2">Base facturada</span>
              <span className="tabular text-ink">{money(proyecto.base)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-ink-2">Ya repartido</span>
              <span className="tabular text-ink">{money(yaRepartido)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-3 border-t border-edge pt-1">
              <span className="font-medium text-ink">Quedaría sin repartir</span>
              <span className={`tabular font-semibold ${excede ? "text-critical" : "text-ink"}`}>
                {money(disponible - monto)}
              </span>
            </div>
            {excede ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-critical">
                <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                El monto supera lo que queda sin repartir de este proyecto.
              </p>
            ) : null}
          </div>
        ) : null}

        <Field label="Monto (COP)">
          <Input
            name="monto"
            inputMode="numeric"
            value={monto || ""}
            onChange={(e) => setMonto(Number(e.target.value.replace(/\D/g, "")) || 0)}
            required
          />
        </Field>

        <Field label="Fecha">
          <Input
            type="date"
            name="fecha"
            defaultValue={m?.fecha ?? fechaInput(new Date())}
            required
          />
        </Field>

        <Field label="Concepto" className="sm:col-span-2">
          <Input
            name="concepto"
            defaultValue={m?.concepto}
            required
            placeholder={
              definicion.esGasto
                ? "Desarrollo del módulo de integración"
                : "Adelanto para gastos personales"
            }
          />
        </Field>

        {definicion.aumentaDeuda ? (
          <Field
            label="Fecha pactada de devolución"
            className="sm:col-span-2"
            hint="Opcional, pero útil para hacer seguimiento."
          >
            <Input type="date" name="fechaCompromiso" defaultValue={m?.fechaCompromiso} />
          </Field>
        ) : null}

        <Field label="Notas" className="sm:col-span-2">
          <Textarea name="notas" defaultValue={m?.notas} rows={2} />
        </Field>
      </div>
    </FormDialog>
  );
}
