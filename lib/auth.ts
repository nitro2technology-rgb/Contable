/**
 * Acceso por contrasenia compartida entre los socios.
 *
 * La sesion es una cookie httpOnly con un token firmado por HMAC-SHA256. Se usa
 * Web Crypto (no `node:crypto`) porque el middleware corre en el runtime Edge.
 *
 * Limitacion conocida y aceptada: al ser una clave unica, el sistema no sabe
 * CUAL socio inicio sesion. Por eso el modulo de movimientos de socios exige
 * elegir el socio de forma explicita en cada registro.
 */

const COOKIE = "n2t_sesion";
const DURACION_DIAS = 30;

function encoder() {
  return new TextEncoder();
}

function secreto(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta la variable de entorno AUTH_SECRET");
  return s;
}

async function firmar(mensaje: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder().encode(secreto()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const firma = await crypto.subtle.sign("HMAC", key, encoder().encode(mensaje));
  return Array.from(new Uint8Array(firma))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparacion en tiempo constante: evita filtrar la firma por temporizacion. */
function igualdadSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function crearToken(): Promise<string> {
  const expira = Date.now() + DURACION_DIAS * 24 * 60 * 60 * 1000;
  const carga = String(expira);
  return `${carga}.${await firmar(carga)}`;
}

export async function tokenValido(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const punto = token.lastIndexOf(".");
  if (punto <= 0) return false;

  const carga = token.slice(0, punto);
  const firma = token.slice(punto + 1);

  if (!igualdadSegura(firma, await firmar(carga))) return false;

  const expira = Number(carga);
  return Number.isFinite(expira) && expira > Date.now();
}

export async function claveCorrecta(intento: string): Promise<boolean> {
  const real = process.env.APP_PASSWORD;
  if (!real) throw new Error("Falta la variable de entorno APP_PASSWORD");
  // Se comparan los hashes para que la comparacion no dependa de la longitud.
  const [a, b] = await Promise.all([firmar(intento), firmar(real)]);
  return igualdadSegura(a, b);
}

export const COOKIE_SESION = COOKIE;
export const DURACION_COOKIE_SEG = DURACION_DIAS * 24 * 60 * 60;
