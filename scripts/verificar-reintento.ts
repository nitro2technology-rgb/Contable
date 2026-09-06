/**
 * Comprueba la política de reintento de la capa de datos contando intentos, no
 * cronometrando: un cronómetro no distingue "reintentó" de "la conexión tardó",
 * y esa confusión ya produjo un falso positivo una vez.
 */

import { conReintento, esperaMs, esTransitorio, INTENTOS } from "../lib/reintento";

let fallos = 0;

function ok(nombre: string, real: unknown, esperado: unknown) {
  const bien = real === esperado;
  if (!bien) fallos++;
  console.log(`${bien ? "OK   " : "FALLA"} ${nombre}: ${real} (esperado ${esperado})`);
}

/** Errores sintéticos con la forma exacta que produce cada caso real. */
const conexionCaida = Object.assign(new Error("Can't reach database server"), {
  name: "PrismaClientKnownRequestError",
  code: "P1001",
});

const nuncaConecto = Object.assign(new Error("Can't reach database server"), {
  name: "PrismaClientInitializationError",
});

const poolAgotado = Object.assign(new Error("Timed out fetching a connection"), {
  name: "PrismaClientKnownRequestError",
  code: "P2024",
});

const consultaMal = Object.assign(new Error("Unique constraint failed"), {
  name: "PrismaClientKnownRequestError",
  code: "P2002",
});

const registroAusente = Object.assign(new Error("Record not found"), {
  name: "PrismaClientKnownRequestError",
  code: "P2025",
});

async function main() {
  console.log("\n== Clasificación de errores ==");
  ok("conexión caída (P1001)", esTransitorio(conexionCaida), true);
  ok("nunca conectó (Initialization)", esTransitorio(nuncaConecto), true);
  ok("pool agotado (P2024)", esTransitorio(poolAgotado), true);
  ok("restricción única (P2002)", esTransitorio(consultaMal), false);
  ok("registro ausente (P2025)", esTransitorio(registroAusente), false);
  ok("no es un error", esTransitorio("texto suelto"), false);
  ok("nulo", esTransitorio(null), false);

  // Sin esperas reales: la prueba mide comportamiento, no duración.
  const sinDormir = { dormir: async () => {} };

  console.log("\n== Reintento ante fallo transitorio ==");
  let intentos = 0;
  try {
    await conReintento(async () => {
      intentos++;
      throw nuncaConecto;
    }, sinDormir);
    console.log("FALLA no propagó el error");
    fallos++;
  } catch (e) {
    ok("intentos realizados", intentos, INTENTOS);
    ok("propaga el error original", e === nuncaConecto, true);
  }

  console.log("\n== Sin reintento ante error de consulta ==");
  intentos = 0;
  try {
    await conReintento(async () => {
      intentos++;
      throw consultaMal;
    }, sinDormir);
    console.log("FALLA no propagó el error");
    fallos++;
  } catch (e) {
    ok("intentos realizados", intentos, 1);
    ok("propaga el error original", e === consultaMal, true);
  }

  console.log("\n== Recuperación: falla una vez y luego responde ==");
  intentos = 0;
  const valor = await conReintento(async () => {
    intentos++;
    if (intentos === 1) throw conexionCaida;
    return "datos";
  }, sinDormir);
  ok("intentos realizados", intentos, 2);
  ok("devuelve el resultado", valor, "datos");

  console.log("\n== Camino feliz: no reintenta de más ==");
  intentos = 0;
  await conReintento(async () => {
    intentos++;
    return 1;
  }, sinDormir);
  ok("intentos realizados", intentos, 1);

  console.log("\n== Espera exponencial ==");
  ok("primera espera", esperaMs(0), 300);
  ok("segunda espera", esperaMs(1), 600);

  console.log(fallos === 0 ? "\nTodo correcto." : `\n${fallos} comprobaciones fallaron.`);
  process.exit(fallos === 0 ? 0 : 1);
}

main();
