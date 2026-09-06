import { Sidebar } from "@/components/nav";
import { obtenerConfig } from "@/lib/consultas";
import { salir } from "../ingresar/actions";

/**
 * El layout solo necesita la razón social para el pie de la barra lateral. Si la
 * base no responde no vale la pena tumbar toda la pantalla por un rótulo: se usa
 * un valor por defecto y se deja que la página falle sola, de modo que el error
 * quede contenido y la navegación siga en pie.
 */
async function nombreEmpresa(): Promise<string> {
  try {
    return (await obtenerConfig()).razonSocial;
  } catch {
    return "Nitro2Tech S.A.S.";
  }
}

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const empresa = await nombreEmpresa();

  return (
    <div className="min-h-dvh">
      <Sidebar empresa={empresa} salir={salir} />
      <div className="lg:pl-60">
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
