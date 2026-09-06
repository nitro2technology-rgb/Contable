"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

/** Filtro de año. Vive en la URL para que el estado sea compartible y volver
 *  atrás en el navegador devuelva el año anterior. */
export function SelectorAnio({ anio, anios }: { anio: number; anios?: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const actual = new Date().getUTCFullYear();
  const lista = anios?.length ? anios : [actual, actual - 1, actual - 2];

  return (
    <Select
      aria-label="Año"
      value={String(anio)}
      className="w-32"
      onChange={(e) => {
        const nuevos = new URLSearchParams(params);
        nuevos.set("anio", e.target.value);
        router.push(`${pathname}?${nuevos.toString()}`);
      }}
    >
      {lista.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </Select>
  );
}
