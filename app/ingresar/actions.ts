"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESION, DURACION_COOKIE_SEG, claveCorrecta, crearToken } from "@/lib/auth";

export type EstadoIngreso = { error?: string };

export async function ingresar(
  _estado: EstadoIngreso,
  datos: FormData
): Promise<EstadoIngreso> {
  const clave = String(datos.get("clave") ?? "");
  const volver = String(datos.get("volver") ?? "/");

  if (!clave) return { error: "Escribe la contraseña." };

  if (!(await claveCorrecta(clave))) {
    return { error: "Contraseña incorrecta." };
  }

  const store = await cookies();
  store.set(COOKIE_SESION, await crearToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_COOKIE_SEG,
  });

  // Solo se aceptan rutas internas: evita un redirect abierto si alguien
  // manipula el parametro `volver`.
  redirect(volver.startsWith("/") && !volver.startsWith("//") ? volver : "/");
}

export async function salir() {
  const store = await cookies();
  store.delete(COOKIE_SESION);
  redirect("/ingresar");
}
