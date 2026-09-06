import type { EstadoFactura } from "@prisma/client";
import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  FileEdit,
  TriangleAlert,
} from "lucide-react";
import { Badge, type TonoBadge } from "@/components/ui";

/**
 * El estado nunca viaja solo en el color: cada uno lleva icono y texto, que es
 * la mitigacion exigida cuando el tono no alcanza el contraste minimo.
 */
const ESTADOS: Record<
  EstadoFactura,
  { etiqueta: string; tono: TonoBadge; icono: typeof CircleCheck }
> = {
  BORRADOR: { etiqueta: "Borrador", tono: "neutro", icono: FileEdit },
  EMITIDA: { etiqueta: "Emitida", tono: "info", icono: CircleDashed },
  PARCIAL: { etiqueta: "Pago parcial", tono: "aviso", icono: CircleDot },
  PAGADA: { etiqueta: "Pagada", tono: "bueno", icono: CircleCheck },
  VENCIDA: { etiqueta: "Vencida", tono: "critico", icono: TriangleAlert },
  ANULADA: { etiqueta: "Anulada", tono: "neutro", icono: Ban },
};

export function EstadoBadge({ estado }: { estado: EstadoFactura }) {
  const { etiqueta, tono, icono: Icono } = ESTADOS[estado];
  return (
    <Badge tono={tono} icono={<Icono className="size-3" aria-hidden="true" />}>
      {etiqueta}
    </Badge>
  );
}
