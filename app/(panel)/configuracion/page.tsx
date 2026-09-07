import type { Metadata } from "next";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { obtenerConfig, rangoAnio, resumenPeriodo } from "@/lib/consultas";
import { periodicidadSugerida, UVT_UMBRAL_BIMESTRAL } from "@/lib/fiscal";
import { money, plain } from "@/lib/format";
import { num, prisma } from "@/lib/db";
import { FormularioConfiguracion } from "./form";
import { Pasarelas } from "./pasarelas";

export const metadata: Metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

export default async function PaginaConfiguracion() {
  const anioAnterior = new Date().getUTCFullYear() - 1;
  const { inicio, fin } = rangoAnio(anioAnterior);

  const [config, resumen, pasarelas] = await Promise.all([
    obtenerConfig(),
    resumenPeriodo(inicio, fin),
    prisma.pasarelaPago.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: { _count: { select: { pagos: true } } },
    }),
  ]);

  const sugerida = periodicidadSugerida(resumen.ingresos, config.valorUvt);
  const uvtDelAnio = resumen.ingresos / config.valorUvt;

  const sugerencia =
    resumen.ingresos > 0
      ? `Con ${money(resumen.ingresos)} de ingresos en ${anioAnterior} (${plain(uvtDelAnio)} UVT) te corresponde ${sugerida.toLowerCase()}.`
      : `Sin ingresos registrados en ${anioAnterior}. El umbral son ${plain(UVT_UMBRAL_BIMESTRAL)} UVT de ingresos brutos del año anterior.`;

  return (
    <>
      <PageHeader
        titulo="Configuración"
        descripcion="Datos de la empresa y parámetros tributarios que usa todo el sistema."
      />

      <div className="mb-5 flex gap-3 rounded-xl border border-edge bg-surface-2 px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-s1" aria-hidden="true" />
        <p className="text-sm text-ink-2">
          Cambiar estos parámetros afecta los cálculos <strong className="font-medium text-ink">de aquí en
          adelante</strong>. Las facturas ya emitidas conservan las tarifas con las que se
          liquidaron, para que el histórico contable no se mueva bajo los pies.
        </p>
      </div>

      <div className="max-w-3xl space-y-5">
        <FormularioConfiguracion
          sugerencia={sugerencia}
          config={{
            razonSocial: config.razonSocial,
            nit: config.nit,
            direccion: config.direccion,
            ciudad: config.ciudad,
            telefono: config.telefono,
            email: config.email,
            valorUvt: config.valorUvt,
            periodicidadIva: config.periodicidadIva,
            tarifaIcaPorMil: config.tarifaIcaPorMil,
            tarifaRenta: config.tarifaRenta,
          }}
        />

        <Pasarelas
          pasarelas={pasarelas.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            porcentaje: num(p.porcentaje),
            fijo: num(p.fijo),
            comisionTieneIva: p.comisionTieneIva,
            activo: p.activo,
            notas: p.notas,
            pagos: p._count.pagos,
          }))}
        />
      </div>
    </>
  );
}
