import { calcularFactura, periodosIva, periodicidadSugerida, RETEFUENTE } from "../lib/fiscal";

const UVT = 49799;
let fallos = 0;
function ok(nombre: string, real: number, esperado: number) {
  const bien = Math.abs(real - esperado) < 1;
  if (!bien) fallos++;
  console.log(`${bien ? "OK  " : "FALLA"} ${nombre}: ${real} (esperado ${esperado})`);
}

const clienteRetiene = { practicaRetefuente: true, practicaReteIva: false, practicaReteIca: false, tarifaReteIcaPorMil: 0 };
const clienteTodo    = { practicaRetefuente: true, practicaReteIva: true,  practicaReteIca: true,  tarifaReteIcaPorMil: 9.66 };
const clienteNada    = { practicaRetefuente: false, practicaReteIva: false, practicaReteIca: false, tarifaReteIcaPorMil: 0 };

console.log("\n== Caso 1: desarrollo 10.000.000, honorarios 11%, IVA 19% ==");
const c1 = calcularFactura([{ cantidad: 1, precioUnitario: 10_000_000, tratamientoIva: "GRAVADO_19", conceptoRetefuente: "HONORARIOS" }], clienteRetiene, UVT);
ok("subtotal", c1.subtotal, 10_000_000);
ok("IVA 19%", c1.ivaTotal, 1_900_000);
ok("total", c1.total, 11_900_000);
ok("retefuente 11%", c1.retefuente, 1_100_000);
ok("neto a cobrar", c1.netoACobrar, 10_800_000);

console.log("\n== Caso 2: mismo valor, cliente que retiene todo ==");
const c2 = calcularFactura([{ cantidad: 1, precioUnitario: 10_000_000, tratamientoIva: "GRAVADO_19", conceptoRetefuente: "HONORARIOS" }], clienteTodo, UVT);
ok("reteIVA 15% del IVA", c2.reteIva, 285_000);
ok("reteICA 9,66 por mil", c2.reteIca, 96_600);
ok("neto", c2.netoACobrar, 11_900_000 - 1_100_000 - 285_000 - 96_600);

console.log("\n== Caso 3: excluido de IVA, sin retenciones ==");
const c3 = calcularFactura([{ cantidad: 1, precioUnitario: 1_800_000, tratamientoIva: "EXCLUIDO", conceptoRetefuente: "SERVICIOS" }], clienteNada, UVT);
ok("IVA", c3.ivaTotal, 0);
ok("neto = subtotal", c3.netoACobrar, 1_800_000);

console.log("\n== Caso 4: base mínima de servicios (4 UVT = 199.196) ==");
const bajo  = calcularFactura([{ cantidad: 1, precioUnitario: 150_000, tratamientoIva: "GRAVADO_19", conceptoRetefuente: "SERVICIOS" }], clienteRetiene, UVT);
ok("bajo la base -> sin retefuente", bajo.retefuente, 0);
const alto = calcularFactura([{ cantidad: 1, precioUnitario: 250_000, tratamientoIva: "GRAVADO_19", conceptoRetefuente: "SERVICIOS" }], clienteRetiene, UVT);
ok("sobre la base -> 4%", alto.retefuente, 10_000);

console.log("\n== Caso 5: dos líneas del mismo concepto suman para la base mínima ==");
const suma = calcularFactura([
  { cantidad: 1, precioUnitario: 120_000, tratamientoIva: "GRAVADO_19", conceptoRetefuente: "SERVICIOS" },
  { cantidad: 1, precioUnitario: 120_000, tratamientoIva: "GRAVADO_19", conceptoRetefuente: "SERVICIOS" },
], clienteRetiene, UVT);
ok("240.000 >= 199.196 -> retiene 4%", suma.retefuente, 9_600);

console.log("\n== Caso 6: mezcla de tarifas en una factura ==");
const mix = calcularFactura([
  { cantidad: 1, precioUnitario: 5_000_000, tratamientoIva: "GRAVADO_19", conceptoRetefuente: "HONORARIOS" },
  { cantidad: 1, precioUnitario: 2_000_000, tratamientoIva: "EXCLUIDO",   conceptoRetefuente: "SERVICIOS" },
], clienteRetiene, UVT);
ok("subtotal", mix.subtotal, 7_000_000);
ok("IVA solo sobre lo gravado", mix.ivaTotal, 950_000);
ok("retefuente 11% + 4%", mix.retefuente, 550_000 + 80_000);
ok("grupos de tratamiento", mix.ivaPorTratamiento.length, 2);

console.log("\n== Periodos y periodicidad ==");
const bim = periodosIva(2026, "BIMESTRAL");
ok("6 bimestres", bim.length, 6);
console.log(`     primero: ${bim[0].etiqueta} ${bim[0].inicio.toISOString().slice(0,10)} -> ${bim[0].fin.toISOString().slice(0,10)}`);
console.log(`     último:  ${bim[5].etiqueta} ${bim[5].inicio.toISOString().slice(0,10)} -> ${bim[5].fin.toISOString().slice(0,10)}`);
ok("4 cuatrimestres -> 3 periodos", periodosIva(2026, "CUATRIMESTRAL").length, 3);
console.log(`     sugerida con 100M: ${periodicidadSugerida(100_000_000, UVT)}`);
console.log(`     sugerida con 6.000M: ${periodicidadSugerida(6_000_000_000, UVT)}`);

console.log(fallos === 0 ? "\nTodo correcto." : `\n${fallos} comprobaciones fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
