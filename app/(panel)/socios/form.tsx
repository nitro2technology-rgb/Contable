"use client";

import { useActionState, useState } from "react";
import { Info, Plus, UserPlus } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { ESTADO_INICIAL, FormDialog } from "@/components/dialog";
import { fechaInput } from "@/lib/format";
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
    valor: "PRESTAMO",
    etiqueta: "Préstamo al socio",
    nota: "La empresa le presta dinero. Aumenta la cuenta por cobrar a socios y debe devolverse.",
    aumentaDeuda: true,
  },
  {
    valor: "RETIRO",
    etiqueta: "Retiro de dinero",
    nota: "El socio toma dinero de la caja sin que haya utilidades decretadas. Contablemente es igual a un préstamo: hay que devolverlo o cruzarlo contra utilidades.",
    aumentaDeuda: true,
  },
  {
    valor: "ABONO",
    etiqueta: "Abono / devolución",
    nota: "El socio devuelve dinero. Disminuye lo que debe.",
    aumentaDeuda: false,
  },
  {
    valor: "DISTRIBUCION_UTILIDADES",
    etiqueta: "Distribución de utilidades",
    nota: "Utilidades decretadas a favor del socio. Cruzan contra lo que ya había tomado y disminuyen su saldo.",
    aumentaDeuda: false,
  },
  {
    valor: "APORTE_CAPITAL",
    etiqueta: "Aporte de capital",
    nota: "El socio pone dinero en la empresa. Es patrimonio, no una deuda: no afecta la cuenta por cobrar.",
    aumentaDeuda: false,
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
};

export function DialogoMovimiento({
  socios,
  movimiento,
  socioIdPorDefecto,
  disparador,
}: {
  socios: { id: string; nombre: string }[];
  movimiento?: MovimientoForm;
  socioIdPorDefecto?: string;
  disparador?: React.ReactNode;
}) {
  const [estado, accion] = useActionState(guardarMovimiento, ESTADO_INICIAL);
  const m = movimiento;

  const [tipo, setTipo] = useState<string>(m?.tipo ?? "PRESTAMO");
  const definicion = TIPOS.find((t) => t.valor === tipo) ?? TIPOS[0];

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

        <div className="sm:col-span-2">
          <p className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-s1" aria-hidden="true" />
            <span>{definicion.nota}</span>
          </p>
        </div>

        <Field label="Monto (COP)">
          <Input name="monto" inputMode="numeric" defaultValue={m?.monto || ""} required />
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
            placeholder="Adelanto para gastos personales"
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
