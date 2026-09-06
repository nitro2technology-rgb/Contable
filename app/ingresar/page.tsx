import type { Metadata } from "next";
import { FormularioIngreso } from "./form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function PaginaIngreso({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const { volver } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-s1 text-lg font-bold text-white">
            N2
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Nitro2Tech S.A.S.</h1>
          <p className="mt-1 text-sm text-ink-2">Software contable interno</p>
        </div>

        <div className="rounded-xl border border-edge bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <FormularioIngreso volver={volver ?? "/"} />
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted">
          Acceso restringido a los socios.
        </p>
      </div>
    </main>
  );
}
