"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileText,
  LayoutDashboard,
  Landmark,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Package,
  Receipt,
  Repeat,
  Settings,
  Sun,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cx } from "./ui";

const ENLACES = [
  { href: "/", etiqueta: "Panel", icono: LayoutDashboard },
  { href: "/facturas", etiqueta: "Facturas", icono: FileText },
  { href: "/clientes", etiqueta: "Clientes", icono: Users },
  { href: "/servicios", etiqueta: "Servicios", icono: Package },
  { href: "/gastos", etiqueta: "Gastos", icono: Receipt },
  { href: "/gastos-fijos", etiqueta: "Gastos fijos", icono: Repeat },
  { href: "/socios", etiqueta: "Socios", icono: Wallet },
  { href: "/impuestos", etiqueta: "Impuestos", icono: Landmark },
  { href: "/configuracion", etiqueta: "Configuración", icono: Settings },
];

function esActivo(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// ---------------------------------------------------------------------------
// Selector de tema
// ---------------------------------------------------------------------------

type Tema = "system" | "light" | "dark";

function SelectorTema() {
  const [tema, setTema] = React.useState<Tema>("system");

  React.useEffect(() => {
    const guardado = localStorage.getItem("n2t-tema");
    if (guardado === "light" || guardado === "dark") setTema(guardado);
  }, []);

  function aplicar(nuevo: Tema) {
    setTema(nuevo);
    if (nuevo === "system") {
      localStorage.removeItem("n2t-tema");
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem("n2t-tema", nuevo);
      document.documentElement.dataset.theme = nuevo;
    }
  }

  const opciones: { valor: Tema; icono: typeof Sun; titulo: string }[] = [
    { valor: "light", icono: Sun, titulo: "Claro" },
    { valor: "dark", icono: Moon, titulo: "Oscuro" },
    { valor: "system", icono: Monitor, titulo: "Sistema" },
  ];

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-edge p-0.5"
      role="radiogroup"
      aria-label="Tema"
    >
      {opciones.map(({ valor, icono: Icono, titulo }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={tema === valor}
          title={titulo}
          onClick={() => aplicar(valor)}
          className={cx(
            "flex size-7 items-center justify-center rounded-md transition-colors",
            tema === valor ? "bg-surface-3 text-ink" : "text-ink-muted hover:text-ink"
          )}
        >
          <Icono className="size-3.5" aria-hidden="true" />
          <span className="sr-only">{titulo}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra lateral
// ---------------------------------------------------------------------------

function Enlaces({ onNavegar }: { onNavegar?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5 px-3 py-3" aria-label="Secciones">
      {ENLACES.map(({ href, etiqueta, icono: Icono }) => {
        const activo = esActivo(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavegar}
            aria-current={activo ? "page" : undefined}
            className={cx(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              activo
                ? "bg-surface-3 font-medium text-ink"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <Icono className="size-4 shrink-0" aria-hidden="true" />
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

function Marca() {
  return (
    <div className="flex items-center gap-2.5 border-b border-edge px-5 py-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-s1 text-sm font-bold text-white">
        N2
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">Nitro2Tech</p>
        <p className="truncate text-xs text-ink-muted">S.A.S.</p>
      </div>
    </div>
  );
}

function PieLateral({ empresa, salir }: { empresa: string; salir: () => void }) {
  return (
    <div className="space-y-3 border-t border-edge px-3 py-3">
      <div className="flex items-center justify-between gap-2 px-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
          <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{empresa}</span>
        </span>
        <SelectorTema />
      </div>
      <form action={salir}>
        <button
          type="submit"
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <LogOut className="size-4 shrink-0" aria-hidden="true" />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}

export function Sidebar({ empresa, salir }: { empresa: string; salir: () => void }) {
  const [abierto, setAbierto] = React.useState(false);
  const pathname = usePathname();

  // El menu movil se cierra solo al cambiar de ruta.
  React.useEffect(() => setAbierto(false), [pathname]);

  return (
    <>
      {/* Escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-edge bg-surface lg:flex">
        <Marca />
        <Enlaces />
        <PieLateral empresa={empresa} salir={salir} />
      </aside>

      {/* Móvil */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-edge bg-surface px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2"
          aria-label="Abrir menú"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <div className="flex size-7 items-center justify-center rounded-md bg-s1 text-xs font-bold text-white">
          N2
        </div>
        <span className="text-sm font-semibold text-ink">Nitro2Tech</span>
      </header>

      {abierto ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-xl">
            <div className="flex items-center justify-between">
              <Marca />
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="mr-3 flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2"
                aria-label="Cerrar menú"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <Enlaces onNavegar={() => setAbierto(false)} />
            <PieLateral empresa={empresa} salir={salir} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
