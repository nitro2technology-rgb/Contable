import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { num, prisma } from "@/lib/db";
import { obtenerConfig } from "@/lib/consultas";
import { EditorFactura } from "../editor";
import { siguienteNumero } from "../actions";

export const metadata: Metadata = { title: "Nueva factura" };
export const dynamic = "force-dynamic";

export default async function NuevaFactura() {
  const [clientes, servicios, numero, config] = await Promise.all([
    prisma.cliente.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.servicio.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    siguienteNumero(),
    obtenerConfig(),
  ]);

  return (
    <>
      <Link
        href="/facturas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-s1"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Facturas
      </Link>

      <PageHeader
        titulo="Nueva factura"
        descripcion="El IVA y las retenciones se calculan solos a partir del servicio y del perfil tributario del cliente."
      />

      {clientes.length === 0 ? (
        <Card>
          <EmptyState
            titulo="Primero registra un cliente"
            descripcion="No se puede emitir una factura sin un cliente: sus datos tributarios son los que determinan las retenciones."
          >
            <Link
              href="/clientes"
              className="inline-flex h-9 items-center rounded-lg bg-s1 px-3.5 text-sm font-medium text-white hover:brightness-110"
            >
              Ir a Clientes
            </Link>
          </EmptyState>
        </Card>
      ) : (
        <EditorFactura
          numeroSugerido={numero}
          valorUvt={config.valorUvt}
          clientes={clientes.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            nit: c.nit,
            practicaRetefuente: c.practicaRetefuente,
            practicaReteIva: c.practicaReteIva,
            practicaReteIca: c.practicaReteIca,
            tarifaReteIcaPorMil: num(c.tarifaReteIcaPorMil),
          }))}
          servicios={servicios.map((s) => ({
            id: s.id,
            nombre: s.nombre,
            precioBase: num(s.precioBase),
            tratamientoIva: s.tratamientoIva,
            conceptoRetefuente: s.conceptoRetefuente,
          }))}
        />
      )}
    </>
  );
}
