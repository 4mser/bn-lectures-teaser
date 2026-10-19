import R from "./ritmo.json";
import C from "./cancion.json";

// Mapa de ritmo de la v1o (sus eventos generados, 120 BPM, compás de 2 s) conformado a la canción real por
// herramientas/conform_pulso.py: las secciones se alargan o acortan por pulsos enteros y el montaje lleva el tiempo de
// escena a la canción con la pendiente fija de un pulso de la v1o por pulso de la canción (2 s de escena por compás de
// 1,8464 s), con cortes solo en downbeats. Todo lo que pulsa en la imagen cae en un pulso real de la canción.
export const RITMO = R;
const M = R.montaje as [number, number][];
const CB = R.cancion.compas;
// Segundo de escena que se ve en el segundo t de la canción (pares de nudos: [desde, hasta] de cada tramo).
export const escena = (t: number) => {
  for (let i = 0; i + 1 < M.length; i += 2) if (t >= M[i][0] && t < M[i + 1][0]) return M[i][1] + ((t - M[i][0]) * 2) / CB;
  return t < M[0][0] ? M[0][1] + ((t - M[0][0]) * 2) / CB : M[M.length - 1][1] + ((t - M[M.length - 1][0]) * 2) / CB;
};
export const PULSO = R.pulso;
export const COMPAS = R.compas;
export const CORCHEA = R.corchea;
// El video dura lo que la canción, con su cola.
export const DURACION = R.cancion.total;
export const FPS = 30;
export const TOTAL = Math.round(DURACION * FPS);

// Segundo del compás c, pulso p.
export const tc = (c: number, p = 0) => c * COMPAS + p * PULSO;
export const seccion = (id: string) => {
  const s = R.secciones.find((x) => x.id === id);
  if (!s) throw new Error(`No hay sección ${id} en ritmo.json`);
  return s.t;
};

// Último tiempo de la lista que ya pasó (o −∞).
const ultimo = (lista: number[], t: number) => {
  let lo = 0;
  let hi = lista.length - 1;
  let r = -Infinity;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (lista[m] <= t + 1e-6) {
      r = lista[m];
      lo = m + 1;
    } else hi = m - 1;
  }
  return r;
};
export const entre = (lista: number[], a: number, b: number) => lista.filter((x) => x >= a - 1e-6 && x < b - 1e-6);

// Golpe: 1 justo en el evento y cae exponencialmente.
export const golpe = (t: number, lista: number[] = R.bombos, caida = 9) => {
  const u = ultimo(lista, t);
  return u === -Infinity ? 0 : Math.exp(-(t - u) * caida);
};
const MOTIVO = R.motivo.map((m) => m.t);
export const motivo = (t: number, caida = 6) => golpe(t, MOTIVO, caida);
export const BLIPS = R.efectos.filter((e) => e.tipo === "blip").map((e) => e.t);
export const blip = (t: number, caida = 12) => golpe(t, BLIPS, caida);
// Pulso de la grilla aunque no haya bombo (intro, breakdown).
export const pulsoGrilla = (t: number, caida = 6) => (t < 0 ? 0 : Math.exp(-((t / PULSO) % 1) * PULSO * caida));
export const enSilencio = (t: number) => R.silencios.some(([a, b]) => t >= a && t < b);

// ── Lo que usa el final aprobado (src/final.ts): golpes con nombre, notas de la coda y el redoble ──
export const T_FINAL = seccion("final");
export const golpesDe = (...tipos: string[]) => R.golpes.filter((g) => tipos.includes(g.tipo)).map((g) => g.t);
const NOTAS = R.ostinato.map((n) => n.t);
export const pulsoNota = (t: number, caida = 9) => {
  let i = -1;
  for (let k = 0; k < NOTAS.length; k++) if (NOTAS[k] <= t + 1e-6) i = k;
  return i < 0 ? 0 : Math.exp(-(t - NOTAS[i]) * caida) * R.ostinato[i].vel;
};
export const swell = (t: number, tipo: string) => {
  for (const s of R.swells) if (s.tipo === tipo && t >= s.t0 && t < s.t1) return (t - s.t0) / (s.t1 - s.t0);
  return 0;
};

// ── v1o-c: eventos REALES de la canción (src/cancion.json, herramientas/ritmo_cancion.py), en segundos de la canción
// (REAL) y llevados al tiempo de escena por el montaje (REAL_ESC). Son una capa de reacción encima de los drivers
// internos de la v1o: el tic-tac del ostinato de cuerdas, sus acentos 3+3+2, la batería, los impactos y los braams.
const ord = (l: number[]) => [...l].sort((a, b) => a - b);
// v1o-e: la canción está editada por compases enteros («edicion»: tramos [desde, hasta, nuevo comienzo] de la original);
// cada evento real pasa a los segundos de la canción editada (un compás repetido repite sus eventos)
const ED = (R as unknown as { edicion: [number, number, number][] }).edicion;
const editada = (l: number[]) => ord(ED.flatMap(([a, b, n]) => l.filter((t) => t >= a && t < b).map((t) => n + t - a)));
const unirT = (l: number[], sep = 0.06) => ord(l).filter((x, i, a) => i === 0 || x - a[i - 1] >= sep);
export const REAL = {
  cuerdas: editada(C.cuerdas.map((c) => c.t)),
  acentos: editada(C.cuerdas.filter((c) => c.acento).map((c) => c.t)),
  bateria: editada(unirT([...C.bombos, ...C.palmas])),
  fuertes: editada(unirT([...C.palmas, ...C.cancion.impactos.map((i) => i.t)], 0.25)),
  impactos: editada(C.cancion.impactos.map((i) => i.t)),
  braams: editada(C.cancion.braams.map((b) => b.t)),
};
const aEsc = (l: number[]) => ord(l.map(escena));
export const REAL_ESC = {
  cuerdas: aEsc(REAL.cuerdas),
  acentos: aEsc(REAL.acentos),
  bateria: aEsc(REAL.bateria),
  fuertes: aEsc(REAL.fuertes),
  impactos: aEsc(REAL.impactos),
};
// Último evento de la lista que ya sonó (índice y tiempo), o −1.
export const ultimoEn = (lista: number[], t: number) => {
  let lo = 0;
  let hi = lista.length - 1;
  let r = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (lista[m] <= t + 1e-6) {
      r = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return r;
};
