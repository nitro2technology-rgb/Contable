/**
 * Recorre todas las rutas del panel contra el build de produccion.
 *
 * Existe porque hay fallos que `next dev` no reproduce: la aplicacion compilaba
 * y funcionaba en desarrollo mientras 7 de 10 rutas devolvian 500 en produccion
 * por un grafo de chunks mal generado. Un `npm run build` verde no basta como
 * prueba de que el panel funciona.
 *
 * Uso:
 *   npm run build
 *   npm run verificar:rutas
 *
 * Requiere DATABASE_URL, DIRECT_URL, APP_PASSWORD y AUTH_SECRET en .env.
 */

import { spawn } from "node:child_process";
import { setTimeout as esperar } from "node:timers/promises";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const PUERTO = 3477;

const RUTAS = [
  "/",
  "/facturas",
  "/facturas/nueva",
  "/clientes",
  "/servicios",
  "/gastos",
  "/gastos-fijos",
  "/socios",
  "/impuestos",
  "/configuracion",
];

/** Lee .env sin dependencias: solo pares CLAVE="valor". */
function cargarEnv() {
  let texto;
  try {
    texto = readFileSync(new URL("../.env", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const linea of texto.split("\n")) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const valor = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = valor;
  }
}

/** Cookie de sesion valida, con la misma firma que usa `lib/auth.ts`. */
function crearCookie() {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto) throw new Error("Falta AUTH_SECRET");
  const carga = String(Date.now() + 3600_000);
  const firma = createHmac("sha256", secreto).update(carga).digest("hex");
  return `n2t_sesion=${carga}.${firma}`;
}

async function esperarServidor(base, intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    try {
      await fetch(`${base}/ingresar`);
      return true;
    } catch {
      await esperar(500);
    }
  }
  return false;
}

async function main() {
  cargarEnv();

  const base = `http://127.0.0.1:${PUERTO}`;
  const cookie = crearCookie();

  const servidor = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["next", "start", "-p", String(PUERTO)],
    { stdio: "ignore", shell: process.platform === "win32" }
  );

  let fallos = 0;

  try {
    if (!(await esperarServidor(base))) {
      console.error("El servidor no arrancó. ¿Ejecutaste `npm run build`?");
      process.exitCode = 1;
      return;
    }

    console.log(`\nRecorriendo ${RUTAS.length} rutas en el build de producción…\n`);

    for (const ruta of RUTAS) {
      const t0 = Date.now();
      let estado;
      try {
        const r = await fetch(base + ruta, { headers: { cookie }, redirect: "manual" });
        estado = r.status;
      } catch (e) {
        estado = `error: ${e.message}`;
      }
      const ms = Date.now() - t0;
      const bien = estado === 200;
      if (!bien) fallos++;
      console.log(`${bien ? "OK   " : "FALLA"} ${ruta.padEnd(18)} ${estado}  ${ms} ms`);
    }

    // Sin sesión no se debe poder entrar a ninguna ruta del panel.
    const sinCookie = await fetch(base + "/socios", { redirect: "manual" });
    const protege = sinCookie.status === 307 || sinCookie.status === 302;
    if (!protege) fallos++;
    console.log(
      `${protege ? "OK   " : "FALLA"} ${"(sin sesión)".padEnd(18)} ${sinCookie.status}  redirige al login`
    );

    console.log(fallos === 0 ? "\nTodas las rutas responden." : `\n${fallos} rutas fallaron.`);
    process.exitCode = fallos === 0 ? 0 : 1;
  } finally {
    servidor.kill();
    // En Windows `kill` no siempre alcanza al proceso hijo de npx.
    if (process.platform === "win32" && servidor.pid) {
      spawn("taskkill", ["/pid", String(servidor.pid), "/f", "/t"], { stdio: "ignore" });
    }
  }
}

main();
