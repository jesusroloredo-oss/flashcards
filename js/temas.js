/* ======================================================================
   TEMARIO: bloques y nombres de los temas.
   Para poner el título oficial de un tema, añádelo a NOMBRES.
   ====================================================================== */

export const BLOQUES = [
  { id: "juridicas", nombre: "Ciencias Jurídicas",           color: "var(--juridicas)", desde: 1,  hasta: 26 },
  { id: "sociales",  nombre: "Ciencias Sociales",            color: "var(--sociales)",  desde: 27, hasta: 37 },
  { id: "tecnicas",  nombre: "Materias Técnico-Científicas", color: "var(--tecnicas)",  desde: 38, hasta: 45 },
];

export const NOMBRES = {
  1:  "El Derecho: concepto y acepciones",
  7:  "El Ministerio del Interior",
  34: "Drogodependencias",
  35: "El desarrollo sostenible",
  36: "Gramática de la lengua española",
  37: "Ortografía de la lengua española",
};

export function bloqueDe(n) {
  return BLOQUES.find((b) => n >= b.desde && n <= b.hasta);
}
