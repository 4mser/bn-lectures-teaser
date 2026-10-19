// Teaser trailer de B&N Lectures (v1c): una sola cadena de formas, en actos que crecen en escala, al ritmo del mapa
// de src/ritmo.json (la música y la imagen salen del mismo mapa):
//   Prólogo · un punto de luz en la oscuridad (frase 1).
//   Acto I · Lo pequeño: la carga suelta sus rayos → Lissajous → círculo que es la órbita de Bohr → orbital |ψ|² →
//     la nube se vuelve el cañón de una doble rendija → los impactos se ordenan en limaduras alrededor de dos cargas →
//     líneas de campo → las cargas son dos fuentes que interfieren → los frentes se funden en un solo círculo.
//   Acto II · Lo inmenso: el círculo es el ecuador de un toro → malla y pozo del espacio-tiempo → órbita con
//     precesión que cae al centro → agujero negro (raymarcheado en WebGL) → del disco salen tres cuerpos en ocho →
//     los tres caen en un evento y se abre el cono de luz.
//   Breakdown · Dijkstra se expande nota a nota (frase 2) y el camino encontrado da los vértices de un teseracto.
//   Acto III · Lo complejo: teseracto (build) → estalla y abre el Mandelbrot del drop (cortes en cada palmada) →
//     Julia → se cierra en un punto del que nace Lorenz → Lorenz siembra Gray-Scott → red neuronal → ADN → espiral
//     áurea que se hunde en su centro.
//   Silencio · queda un punto (frase 3a) · Drop · el punto estalla (frase 3b) · Final aprobado (src/final.ts).
// Todo es función pura de t (el render en paralelo saca siempre el mismo cuadro) y la matemática es real.
import { brillo, carga, chispa, linea, lote, particulas, rgba, azar, trazar, trazo, TAU, type Fuente, type Pt } from "./lab/luz";
import { RGB, SS, cl, eIO, eOut, lerp, pr } from "./theme";
import type { Disp } from "./disposicion";
import { PULSO, REAL_ESC, RITMO, entre, escena, golpe as golpeSeco, motivo as motivoSeco, pulsoGrilla as pulsoGrillaSeco, seccion, tc } from "./ritmo";
import { armar, zonaTexto } from "./titulos";
import { ajusta, codigo, decodifica, linea as lineaT, pieza, rebanadas, type Linea } from "./rotulos";
import { camara, camaraLorenz, pintarADNPrisma, pintarFluido, pintarHoyo, pintarLorenz, proyectar, type ParamLorenz } from "./gl";

type Ctx = CanvasRenderingContext2D;

// ── Curvas de animación ──
export const eBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  x = cl(x);
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
export const eIn = (x: number) => (x <= 0 ? 0 : Math.pow(2, 10 * cl(x) - 10));
// Resorte amortiguado: pasa de largo y se asienta.
export const muelle = (t: number, t0: number, d: number) => {
  const u = pr(t, t0, d);
  return u >= 1 ? 1 : 1 - Math.exp(-5 * u) * Math.cos(9 * u);
};

const S = (id: string) => seccion(id);
// Golpes con ataque suave (60 ms): los acentos son un swell de luz, nunca un salto en un cuadro.
const golpe = (t0: number, lista: number[] = RITMO.bombos, caida = 9) => {
  // el ataque arranca un cuadro antes del golpe, para que el pico de luz caiga en el cuadro del golpe
  const t = t0 + 1 / 30;
  let u = -Infinity;
  for (const x of lista) if (x <= t + 1e-6 && x > u) u = x;
  if (u === -Infinity) return 0;
  const e = t - u;
  const prev = lista.filter((x) => x < u).pop();
  const cola = prev !== undefined ? Math.exp(-(t - prev) * caida) : 0;
  return Math.max(cola, Math.exp(-e * caida) * Math.min(1, e / 0.03) ** 0.7);
};
const motivo = (t: number, caida = 6) => golpe(t, RITMO.motivo.map((m) => m.t), caida);
const pulsoGrilla = (t: number, caida = 6) => 0.6 * pulsoGrillaSeco(t, caida);
void golpeSeco;
void motivoSeco;
const BOMBOS = RITMO.bombos;
const PALMAS = RITMO.palmas;
const HATS = RITMO.hats;
const ARPEGIO = RITMO.arpegio as [number, number][];
const NOTAS_ARP = ARPEGIO.map((a) => a[0]);

const auxiliares = new Map<string, HTMLCanvasElement>();
export const auxiliar = (w: number, h: number, nombre = "") => {
  const k = `${nombre}${w}x${h}`;
  let c = auxiliares.get(k);
  if (!c) {
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    auxiliares.set(k, c);
  }
  return c;
};

// Brillo aditivo para los trazos que deben encenderse.
const luz = (ctx: Ctx, f: () => void) => {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  f();
  ctx.restore();
};
// Polilínea con estela: la cola tenue, la punta brillante.
const estela = (ctx: Ctx, pts: Pt[], rgb: string, a: number, ancho: number, tramos = 10, piso = 0.06) => {
  for (let s = 0; s < tramos; s++) {
    const i0 = Math.floor((s / tramos) * (pts.length - 1));
    const i1 = Math.floor(((s + 1) / tramos) * (pts.length - 1)) + 1;
    linea(ctx, pts.slice(i0, i1), rgb, a * (piso + (1 - piso) * ((s + 1) / tramos) ** 2), ancho);
  }
};
// Cuántos eventos de la lista sonaron entre t0 y t (incluido t0).
const cuenta = (lista: number[], t0: number, t: number) => lista.filter((x) => x >= t0 - 1e-6 && x <= t + 1e-6).length;
// Avance suave por eventos: cada evento suma 1 con una curva corta (el gesto cae en el golpe).
const pasos = (lista: number[], t0: number, t: number, dur = 0.18) => {
  let s = 0;
  for (const x of lista) if (x >= t0 - 1e-6 && x <= t + 1e-6) s += eIO(pr(t, x, Math.max(dur, 0.4)));
  return s;
};
const proy3 = (d: Disp, p: [number, number, number], ax: number, az: number, esc: number, cx = d.vis.cx, cy = d.vis.cy): [number, number, number] => {
  const [x, y, z] = p;
  const x1 = x * Math.cos(az) - y * Math.sin(az);
  const y1 = x * Math.sin(az) + y * Math.cos(az);
  const y2 = y1 * Math.cos(ax) - z * Math.sin(ax);
  const z2 = y1 * Math.sin(ax) + z * Math.cos(ax);
  const persp = 1 / (1 + z2 * 0.28);
  return [cx + x1 * esc * persp, cy + y2 * esc * persp, z2];
};
const rIntro = (d: Disp) => d.vis.r * 0.82;
// Toda transición entre escenas dura medio pulso como máximo y aterriza en el golpe (expo).
const TR = PULSO; // transiciones de un pulso, con easing suave
const eExpo = (x: number) => eIO(x); // (antes expo: ahora cúbica suave en ambos extremos)
// Llega a 1 justo en tg (empieza TR antes).
const llega = (t: number, tg: number, d = TR) => eExpo(pr(t, tg - d, d));

// ═══ PRÓLOGO (0-10 s): oscuridad y un punto de luz que respira con cada acorde del piano ═══
const ACORDES_PIANO = [0, 2, 4, 6, 8];
const puntoProlog = (d: Disp, t: number) => {
  const nace = muelle(t, 0, 1.2);
  const late = golpe(t, ACORDES_PIANO, 2.5) + 0.6 * motivo(t, 5);
  const crece = eIn(pr(t, 9.0, 1.0)); // se carga antes del golpe de las 10
  return { x: d.vis.cx, y: d.vis.cy, s: (4.5 + 2.2 * late + 5 * crece) * Math.min(1, nace), a: Math.min(1, nace) };
};
const prologo = (ctx: Ctx, d: Disp, t: number) => {
  if (t >= S("carga")) return;
  const p = puntoProlog(d, t);
  brillo(ctx, p.x, p.y, 520, RGB.azul, 0.05 * p.a * (1 + golpe(t, ACORDES_PIANO, 2)));
  carga(ctx, p.x, p.y, p.s, RGB.hielo, p.a, t);
  // un anillo muy tenue que se abre con cada acorde
  luz(ctx, () => {
    for (const a of ACORDES_PIANO) {
      const e = t - a;
      if (e < 0 || e > 2) continue;
      ctx.strokeStyle = rgba(RGB.hielo, 0.1 * Math.exp(-e * 1.6) * p.a);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20 + e * 150, 0, TAU);
      ctx.stroke();
    }
  });
};

// ═══ ACTO I · 1 · CARGA → RAYOS → LISSAJOUS → CÍRCULO (10-15,5 s; el gesto de la intro de la v1, desplazado 10 s) ═══
const T_I = S("carga");
const N_RAYOS = 44;
const M_RAYO = 48;
const lisAB = (t: number) => {
  const k = llega(t, S("atomo"));
  return [lerp(3, 1, k), lerp(2, 1, k)];
};
const giroIntro = (t: number) => 0.55 * Math.max(0, t - S("lissajous")) + 0.25 * pasos(BOMBOS, S("lissajous"), t, 0.2);
const lis = (d: Disp, a: number, b: number, s: number, t: number): Pt => {
  const R = rIntro(d);
  const x = R * Math.sin(a * s + Math.PI / 2);
  const y = R * Math.sin(b * s);
  const g = giroIntro(t);
  return [d.vis.cx + x * Math.cos(g) - y * Math.sin(g), d.vis.cy + x * Math.sin(g) + y * Math.cos(g)];
};
const intro = (ctx: Ctx, d: Disp, t: number) => {
  const lt = t - T_I;
  if (lt < 0 || t >= S("atomo") + TR) return;
  const { cx, cy } = d.vis;
  const late = pulsoGrilla(t, 5);
  const R = rIntro(d);
  const sale = llega(t, S("lissajous"));
  if (t < S("atomo")) {
    const s0 = 9;
    carga(ctx, cx, cy, lerp(s0 * (1 + 0.8 * golpe(t, [T_I], 4) + 0.4 * golpe(t, BOMBOS, 7)), 6, sale), RGB.hielo, lerp(1, 0.55, sale), t);
    brillo(ctx, cx, cy, 340, RGB.azul, 0.22 * golpe(t, [T_I], 2.5));
  }
  const tL = S("lissajous");
  if (t < tL + 0.05) {
    for (let j = 0; j < N_RAYOS; j++) {
      const ang = (j / N_RAYOS) * TAU + 0.11 + 0.5 * lt + 0.3 * pasos(BOMBOS, 0, t, 0.2);
      const crece = eOut(pr(lt, j * 0.004, 0.32));
      const dobla = llega(t, tL);
      const pts: Pt[] = [];
      for (let k = 0; k < M_RAYO; k++) {
        const u = k / (M_RAYO - 1);
        const rho = lerp(16, R * (1.12 + 0.12 * golpe(t, BOMBOS, 8)), u * crece);
        const p0: Pt = [cx + rho * Math.cos(ang), cy + rho * Math.sin(ang)];
        const s = ((j + u) / N_RAYOS) * TAU;
        const p1 = lis(d, 3, 2, s, t);
        pts.push([lerp(p0[0], p1[0], dobla), lerp(p0[1], p1[1], dobla)]);
      }
      luz(ctx, () => trazo(ctx, pts, RGB.hielo, ((0.5 - 0.25 * dobla) * crece + 0.25 * dobla) * 0.8, 1.7));
      if (dobla < 0.5) particulas(ctx, pts, t, 260, 3, RGB.hielo, 0.75 * crece * (1 - 2 * dobla), j + 3, 1.7);
    }
    if (t < tL) return;
  }
  const [a, b] = lisAB(t);
  const pts: Pt[] = [];
  for (let i = 0; i <= 720; i++) pts.push(lis(d, a, b, (i / 720) * TAU, t));
  const vaBohr = 1 - eExpo(pr(t, S("atomo"), TR));
  luz(ctx, () => {
    linea(ctx, pts, RGB.azul, (0.07 + 0.04 * late) * vaBohr, 26);
    linea(ctx, pts, RGB.azul, (0.24 + 0.12 * late) * vaBohr, 8);
    linea(ctx, pts, RGB.hielo, 0.9 * vaBohr, 2.4);
  });
  if (t < S("atomo")) {
    const [hx, hy] = lis(d, a, b, angElectron(t), t);
    carga(ctx, hx, hy, 8 + 5 * late, RGB.hielo, 1, t);
  }
};

// ═══ ACTO I · 2 · ÁTOMO DE BOHR (15-17,5 s): el círculo es la órbita n = 3; el electrón salta en los bombos ═══
// Radios rₙ ∝ n², velocidad angular ωₙ ∝ n⁻³ (suavizada para que se lea). Cada salto emite un fotón.
const SALTOS = [{ t: S("atomo") + 0.5, de: 3, a: 2 }, { t: S("atomo") + 1.0, de: 2, a: 1 }];
const nEn = (t: number) => {
  let n = 3;
  for (const s of SALTOS) if (t >= s.t) n = s.a;
  return n;
};
const radioN = (d: Disp, n: number) => rIntro(d) * (n * n) / 9;
const omega = (n: number) => TAU * Math.pow(3 / n, 1.2);
const angElectron = (t: number) => {
  // ángulo continuo: en la intro es el de la cabeza de la Lissajous; luego se integra con la ω de cada órbita
  const t0 = S("lissajous");
  if (t < SALTOS[0].t) return (t - t0) * TAU;
  let a = (SALTOS[0].t - t0) * TAU;
  let prev = SALTOS[0].t;
  let n = SALTOS[0].a;
  for (let i = 1; i < SALTOS.length; i++) {
    if (t < SALTOS[i].t) return a + omega(n) * (t - prev);
    a += omega(n) * (SALTOS[i].t - prev);
    prev = SALTOS[i].t;
    n = SALTOS[i].a;
  }
  return a + omega(n) * (t - prev);
};
// Desde el átomo, cada órbita es un anillo inclinado que gira en 3D (aplanamiento y orientación por órbita).
const formaOrbita = (n: number, t: number) => {
  const k = eOut(pr(t, S("atomo"), 0.3));
  const ap = lerp(1, 0.32 + 0.25 * Math.abs(Math.cos(1.7 * (t - S("atomo")) + n * 1.3)), k);
  const or = n * 1.05 + 1.4 * Math.max(0, t - S("atomo")) + 0.3 * pasos(BOMBOS, S("atomo"), t, 0.2);
  return { ap, or: or * k };
};
const enOrbita = (d: Disp, r: number, a: number, n: number, t: number): Pt => {
  const { ap, or } = formaOrbita(n, t);
  const x = r * Math.cos(a);
  const y = r * Math.sin(a) * ap;
  const g = giroIntro(t) + or;
  return [d.vis.cx + x * Math.cos(g) - y * Math.sin(g), d.vis.cy + x * Math.sin(g) + y * Math.cos(g)];
};
const posElectron = (d: Disp, t: number): Pt => {
  let r = radioN(d, 3);
  for (const s of SALTOS) if (t >= s.t) r = lerp(radioN(d, s.de), radioN(d, s.a), eIO(pr(t, s.t, 0.3)));
  return enOrbita(d, r, angElectron(t), nEn(t), t);
};
const atomo = (ctx: Ctx, d: Disp, t: number) => {
  const t0 = S("atomo");
  const t1 = S("orbital");
  if (t < t0 || t > t1 + TR) return;
  const { cx, cy } = d.vis;
  const vis = 1 - eExpo(pr(t, t1, TR));
  const kick = golpe(t, BOMBOS, 7);
  luz(ctx, () => {
    for (const n of [1, 2, 3]) {
      const k = n === 3 ? 1 : eOut(pr(t, t0 + (3 - n) * 0.06, 0.22));
      if (k <= 0) continue;
      const r = radioN(d, n) * lerp(0.6, 1, k);
      const actual = nEn(t) === n;
      ctx.beginPath();
      for (let q = 0; q <= 96 * k; q++) {
        const p = enOrbita(d, r, (q / 96) * TAU, n, t);
        if (q) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      }
      ctx.strokeStyle = rgba(RGB.azul, (actual ? 0.2 : 0.1) * vis);
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = rgba(RGB.hielo, (actual ? 0.85 : 0.4) * vis);
      ctx.lineWidth = actual ? 2.4 : 1.5;
      ctx.stroke();
    }
    // fotones: un paquete de onda que sale del punto del salto
    for (const s of SALTOS) {
      const e = t - s.t;
      if (e < 0 || e > 1.4) continue;
      const g = giroIntro(s.t);
      const a0 = angElectron(s.t) + g;
      const r0 = radioN(d, s.de);
      const pts: Pt[] = [];
      for (let i = 0; i <= 90; i++) {
        const u = i / 90;
        const rr = r0 + e * 1100 - u * 160;
        if (rr < r0) continue;
        const amp = 14 * Math.sin(Math.PI * u);
        const w = Math.sin(u * 9 * TAU - e * 30) * amp;
        pts.push([cx + rr * Math.cos(a0) - w * Math.sin(a0), cy + rr * Math.sin(a0) + w * Math.cos(a0)]);
      }
      trazo(ctx, pts, s.a === 1 ? "160,140,255" : "120,200,255", 0.9 * Math.exp(-e * 1.5) * vis, 2);
    }
  });
  // núcleo y electrón
  carga(ctx, cx, cy, (7 + 4 * kick) * vis, "255,214,170", vis, t);
  const [ex, ey] = posElectron(d, t);
  const sale = eExpo(pr(t, t1, TR));
  carga(ctx, ex, ey, (7 + 4 * golpe(t, SALTOS.map((s) => s.t), 6)) * (1 - sale), RGB.hielo, 1 - sale, t);
};

// ═══ ACTO I · 3 · ORBITAL 3d_z² (17,5-20 s): |ψ|² ∝ r⁴ e^{−2r/3} (3cos²θ − 1)², por muestreo de rechazo ═══
const NUBE: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  let k = 0;
  while (out.length < 9000 && k < 900000) {
    const x = (azar(k * 1.1 + 0.3) - 0.5) * 30;
    const y = (azar(k * 2.7 + 0.1) - 0.5) * 30;
    const z = (azar(k * 4.3 + 0.7) - 0.5) * 30;
    const r = Math.hypot(x, y, z) || 1e-6;
    const c = z / r;
    const p = (r ** 4 * Math.exp((-2 * r) / 3) * (3 * c * c - 1) ** 2) / 900;
    if (azar(k * 7.7 + 0.9) * 0.5 < p) out.push([x, y, z]);
    k++;
  }
  return out;
})();
const fuenteRendija = (d: Disp): Pt => [d.vis.cx, d.vis.cy - d.vis.r * 0.92 + 56]; // donde nace el paquete cuántico
const orbital = (ctx: Ctx, d: Disp, t: number) => {
  const t0 = S("orbital");
  const t1 = S("cuantico");
  if (t < t0 || t >= t1 + 0.1) return;
  const giro = 1.1 * (t - t0) + 0.35 * pasos(BOMBOS, t0, t, 0.25);
  const inc = 0.42;
  const esc = d.vis.r / 13.5;
  const [ex, ey] = posElectron(d, t0);
  const notas = cuenta(NOTAS_ARP, t0, t);
  const recoge = llega(t, t1);
  const [fx, fy] = fuenteRendija(d);
  const hat = golpe(t, HATS, 12);
  const L = lote();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < NUBE.length; i++) {
    const [x, y, z] = NUBE[i];
    const xr = x * Math.cos(giro) - y * Math.sin(giro);
    const yr = x * Math.sin(giro) + y * Math.cos(giro);
    const yy = yr * Math.sin(inc) - z * Math.cos(inc);
    const prof = yr * Math.cos(inc) + z * Math.sin(inc);
    // cada nota del arpegio suelta un puñado de puntos desde la órbita n = 1
    const nace = t0 + (Math.floor(azar(i * 3.1) * 8) / 8) * 0.5;
    const m = eOut(pr(t, nace, 0.3));
    if (m <= 0 || i > (notas + 4) * 900) continue;
    let px = lerp(ex, d.vis.cx + xr * esc, m);
    let py = lerp(ey, d.vis.cy + yy * esc, m);
    if (recoge > 0) {
      const k = cl(recoge * 1.3 - azar(i * 5.3) * 0.3);
      px = lerp(px, fx, k);
      py = lerp(py, fy, k);
    }
    const cerca = prof > 0;
    const a = (cerca ? 0.7 : 0.38) * Math.min(1, m * 2) * (1 + (i % 17 === 0 ? 1.5 * hat : 0));
    const rr = cerca ? 1.7 : 1.2;
    ctx.fillStyle = rgba(cerca ? (i % 5 ? "200,214,255" : "170,150,255") : RGB.azul, a);
    ctx.fillRect(px - rr, py - rr, 2 * rr, 2 * rr);
    if (i % 9 === 0) L.add(px, py, px + 0.1, py, i % 2 ? RGB.azul : "150,120,255", a * 0.35, 9);
  }
  ctx.restore();
  luz(ctx, () => L.draw(ctx, 0));
  brillo(ctx, d.vis.cx, d.vis.cy, d.vis.r * 0.9, "110,120,255", 0.12 * (1 - recoge));
  carga(ctx, d.vis.cx, d.vis.cy, 6 * (1 - recoge), "255,214,170", 1 - recoge, t);
  if (recoge > 0) carga(ctx, fx, fy, 8 * recoge, RGB.hielo, recoge, t);
};

// ═══ ACTO I · 4 · DOBLE RENDIJA (20-24 s): la nube se recoge en la fuente; en cada golpe (bombos y hats) llega una
// tanda de impactos que arma las franjas en la pantalla. Los frentes salen medio pulso antes y llegan en el golpe ═══
const geoRendija = (d: Disp) => {
  const yB = d.vis.cy - d.vis.r * 0.25;
  const yS = d.vis.cy + d.vis.r * 0.62;
  return { yB, yS, sep: d.vis.r * 0.13, g: 12 };
};
const EV_RENDIJA = [...new Set([...entre(BOMBOS, S("cuantico"), S("campo")), ...entre(HATS, S("cuantico"), S("campo")).filter((h) => Math.round(h * 4) % 2 === 0)])].sort((a, b) => a - b);
const IMPACTOS_R: number[] = (() => {
  const M = 600;
  const cdf: number[] = [];
  let acc = 0;
  for (let i = 0; i < M; i++) {
    const x = (i / (M - 1)) * 2 - 1;
    const sinc = Math.abs(x) < 1e-6 ? 1 : Math.sin(1.25 * x * Math.PI) / (1.25 * x * Math.PI);
    acc += Math.cos(5.5 * x * Math.PI) ** 2 * sinc * sinc;
    cdf.push(acc);
  }
  return Array.from({ length: 2400 }, (_, k) => {
    const u = azar(k * 1.37 + 5) * acc;
    let i = 0;
    while (cdf[i] < u) i++;
    return (i / (M - 1)) * 2 - 1 + (azar(k * 2.9) - 0.5) * 0.006;
  });
})();
const POR_EVENTO = 90;
const impactoEn = (d: Disp, k: number): Pt => {
  const { yS } = geoRendija(d);
  return [d.vis.cx + IMPACTOS_R[k] * d.vis.r * 0.95, yS + (azar(k * 5.3) - 0.5) * 80];
};
// Índice del último impacto visible en t, y el tiempo de cada uno.
const tImpacto = (k: number) => EV_RENDIJA[Math.floor(k / POR_EVENTO)] ?? Infinity;
const rendija = (ctx: Ctx, d: Disp, t: number) => {
  const t0 = S("cuantico");
  const t1 = S("campo");
  if (t < t0 - TR || t > t1 + TR) return;
  const { yB, yS, sep, g } = geoRendija(d);
  const cx = d.vis.cx;
  const [fx, fy] = fuenteRendija(d);
  const abre = llega(t, t0);
  const apaga = 1 - eExpo(pr(t, t1, TR));
  const xa = 60;
  const xb = d.W - 60;
  luz(ctx, () => {
    // barrera: se dibuja desde el centro hacia los bordes y abre sus dos rendijas
    const ext = llega(t, t0);
    const gg = g * abre;
    const tramosB: [number, number][] = [[lerp(cx, xa, ext), cx - sep - gg], [cx - sep + gg, cx + sep - gg], [cx + sep + gg, lerp(cx, xb, ext)]];
    for (const [a, b] of tramosB) if (b > a) trazo(ctx, [[a, yB], [b, yB]], RGB.hielo, 0.85 * apaga, 2.4);
    linea(ctx, [[cx - d.vis.r, yS + 46], [cx + d.vis.r, yS + 46]], RGB.azul, 0.3 * abre * apaga, 1.4);
    // frentes de cada bombo: circulares desde la fuente hasta la barrera; luego dos ondas desde las rendijas
    const v = (yS - fy) / 0.25;
    for (const e of EV_RENDIJA) {
      const age = t - (e - 0.25);
      if (age < 0 || age > 0.32) continue;
      const r = v * age;
      const af = Math.exp(-age * 1.4) * apaga;
      if (fy + r < yB) {
        const arco: Pt[] = [];
        for (let i = 0; i <= 40; i++) {
          const an = lerp(0.2 * Math.PI, 0.8 * Math.PI, i / 40);
          arco.push([fx + r * Math.cos(an), fy + r * Math.sin(an)]);
        }
        trazo(ctx, arco, RGB.azul, 0.6 * af, 1.6);
      } else {
        const rr = fy + r - yB;
        for (const sx of [cx - sep, cx + sep]) {
          const arco: Pt[] = [];
          for (let i = 0; i <= 40; i++) {
            const an = lerp(0.12 * Math.PI, 0.88 * Math.PI, i / 40);
            arco.push([sx + rr * Math.cos(an), yB + rr * Math.sin(an)]);
          }
          trazo(ctx, arco, RGB.hielo, 0.75 * af * (1 - rr / (yS - yB + 40)), 1.8);
        }
      }
    }
  });
  // impactos acumulados
  const L = lote();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const n = EV_RENDIJA.length * POR_EVENTO;
  for (let k = 0; k < Math.min(n, IMPACTOS_R.length); k++) {
    const te = tImpacto(k) + 0.04 * azar(k);
    if (te > t) continue;
    const age = t - te;
    const fresco = Math.exp(-age * 4);
    const [ix, iy] = impactoEn(d, k);
    const a = (0.4 + 0.6 * fresco) * apaga;
    ctx.fillStyle = rgba(fresco > 0.3 ? RGB.blanco : "150,180,255", a);
    const rr = 1.2 + 1.4 * fresco;
    ctx.fillRect(ix - rr, iy - rr, 2 * rr, 2 * rr);
    if (fresco > 0.15) L.add(ix, iy, ix + 0.1, iy, RGB.azul, fresco * 0.5, 7);
  }
  ctx.restore();
  luz(ctx, () => L.draw(ctx, 0));
  const pg = golpe(t, EV_RENDIJA, 8);
  for (const sx of [cx - sep, cx + sep]) carga(ctx, sx, yB, (3 + 3 * pg) * abre, RGB.hielo, abre * 0.7 * apaga, t);
  carga(ctx, fx, fy, (7 + 3 * golpe(t, BOMBOS, 6)) * apaga, RGB.hielo, apaga, t);
};

// ═══ ACTO I · 5 · LIMADURAS Y LÍNEAS DE CAMPO (24-27 s): los impactos se ordenan como limaduras alrededor de un
// dipolo; el frente de orden avanza un paso por bombo. Con la palmada nacen las líneas de campo ═══
const dipolo = (d: Disp): [Pt, Pt] => [[d.vis.cx - d.vis.r * 0.42, d.vis.cy], [d.vis.cx + d.vis.r * 0.42, d.vis.cy]];
const campoDip = (d: Disp, x: number, y: number): Pt => {
  const [a, b] = dipolo(d);
  let ex = 0;
  let ey = 0;
  for (const [q, [qx, qy]] of [[1, a], [-1, b]] as [number, Pt][]) {
    const dx = x - qx;
    const dy = y - qy;
    const r2 = dx * dx + dy * dy + 40;
    const k = q / (r2 * Math.sqrt(r2));
    ex += k * dx;
    ey += k * dy;
  }
  const n = Math.hypot(ex, ey) || 1;
  return [ex / n, ey / n];
};
const LIM_G = 24;
// Líneas de campo de un conjunto de cargas, recalculadas en cada cuadro. Salen de las positivas (o entran a las
// negativas si no hay positivas), en número proporcional a la carga; llegan al borde del cuadro (la caja de
// integración queda fuera de la imagen) o mueren en una carga: nunca se cortan dentro de la imagen.
type Carga = { x: number; y: number; q: number };
const lineasDe = (d: Disp, cargas: Carga[], porUnidad: number): Pt[][] => {
  const F: Fuente[] = cargas.map((c) => ({ x: c.x, y: c.y, q: c.q }));
  const pos = cargas.filter((c) => c.q > 0.01);
  const desde = pos.length ? pos : cargas.filter((c) => c.q < -0.01);
  const signo = pos.length ? 1 : -1;
  const qmax = Math.max(...cargas.map((c) => Math.abs(c.q)));
  const out: Pt[][] = [];
  desde.forEach((c, ci) => {
    const n = Math.max(6, Math.round((porUnidad * Math.abs(c.q)) / qmax));
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU + 0.07 + ci * 0.31;
      out.push(trazar(F, c.x + 9 * Math.cos(an), c.y + 9 * Math.sin(an), signo, 1100, 5, [-500, -500, d.W + 500, d.H + 500]));
    }
  });
  return out;
};
// Dibuja las líneas con brillo; si crecen (k < 1), la punta se desvanece en vez de cortarse.
const dibujaLineas = (ctx: Ctx, lineas: Pt[][], t: number, a: number, k = 1, semilla = 0) => {
  luz(ctx, () => {
    lineas.forEach((pts, i) => {
      const n = Math.max(2, Math.round(pts.length * k));
      const corte = pts.slice(0, n);
      if (k < 1) {
        const cuerpo = corte.slice(0, Math.max(2, Math.round(n * 0.75)));
        trazo(ctx, cuerpo, i % 2 ? RGB.azul : RGB.hielo, 0.55 * a, 1.4);
        estela(ctx, corte.slice(Math.max(0, cuerpo.length - 1)).reverse(), i % 2 ? RGB.azul : RGB.hielo, 0.55 * a, 1.4, 6, 0);
      } else trazo(ctx, corte, i % 2 ? RGB.azul : RGB.hielo, 0.55 * a, 1.4);
      particulas(ctx, corte, t, 340, 3, RGB.hielo, 0.65 * a, i + semilla, 1.6);
    });
  });
};
const colorQ = (q: number) => (q >= 0 ? "255,190,120" : "120,170,255");
// Desvanecido suave hacia los bordes del cuadro (para las limaduras).
const bordeSuave = (d: Disp, x: number, y: number) => {
  const m = Math.min(x, d.W - x, y, d.H - y);
  return cl(m / 110) ** 1.5;
};

// ═══ ACTO I · 5 · CAMPO DE DOS CARGAS QUE ORBITAN (12,5-16 s): las rendijas se vuelven dos cargas que giran una
// alrededor de la otra; las líneas de campo (densas, con brillo y partículas que corren) se recalculan cuadro a
// cuadro. En el compás 7 la carga de la derecha pasa de − a + (las líneas se reorganizan: de dipolo a repulsión) y en
// el pulso 3 vuelve a −; las cargas caen en espiral, se funden en un punto y ese punto es el agujero negro del drop ═══
const T_CAMPO = S("campo");
// v1o-c: el campo se mueve con la canción real. En cada golpe fuerte (impacto o caja/tom del medio compás) las cargas
// pasan a la configuración siguiente (se acercan, se separan, cambian de signo y las líneas se reorganizan); las
// partículas de las líneas avanzan un paso con cada nota del ostinato; en el hueco (23,66-24,87) todo queda quieto; en
// el riser (24,94-28,64) las cargas giran cada vez más rápido, se cierran y las líneas se estrechan y brillan, hasta
// fundirse en el agujero negro.
const H0_CAMPO = escena(23.66);
const H1_CAMPO = escena(24.87);
const R0_CAMPO = escena(24.94);
// v1o-d: dipolo fijo (+1 y −1): los golpes solo cambian la geometría (distancia y un giro extra), con un morph suave,
// así las líneas se recalculan continuas y nunca cambian de número ni de forma de golpe.
const CONFIG_CAMPO: number[] = [0.42, 0.3, 0.52, 0.36, 0.47, 0.28, 0.4, 0.55];
const GOLPES_CAMPO = entre(REAL_ESC.fuertes, T_CAMPO + 0.6, H0_CAMPO - 0.05);
const NOTAS_CAMPO = entre(REAL_ESC.cuerdas, T_CAMPO - 0.3, S("hoyo"));
const configCampo = (t: number): [number, number] => {
  let r = CONFIG_CAMPO[0];
  let giro = 0;
  GOLPES_CAMPO.forEach((g, i) => {
    const k = eIO(pr(t, g, 0.32));
    if (k <= 0) return;
    r = lerp(r, CONFIG_CAMPO[(i + 1) % CONFIG_CAMPO.length], k);
    giro += 0.45 * k;
  });
  return [r, giro];
};
// ángulo acumulado: 0,9 rad/s, casi quieto en el hueco y acelerando en el riser (ω = 0,9 + 6,1·u²)
const angCampo = (t: number) => {
  const a = Math.min(t, H0_CAMPO) - T_CAMPO;
  const h = cl(t - H0_CAMPO, 0, R0_CAMPO - H0_CAMPO);
  const L = T_HOYO - R0_CAMPO;
  const u = cl((t - R0_CAMPO) / L);
  return 0.9 * Math.max(0, a) + 0.04 * h + (t > R0_CAMPO ? L * (0.9 * u + (6.1 / 3) * u * u * u) : 0);
};
const enHueco = (t: number) => eIO(pr(t, H0_CAMPO - 0.05, 0.2)) * (1 - eIO(pr(t, H1_CAMPO, 0.15)));
const riserCampo = (t: number) => cl((t - R0_CAMPO) / (T_HOYO - R0_CAMPO));
// avance de las partículas: un paso con cada nota (ataque de 70 ms) sobre una deriva lenta
const flujoCampo = (t: number) => 0.25 * (t - T_CAMPO) + NOTAS_CAMPO.reduce((a, n) => a + 0.11 * eOut(pr(t, n, 0.07)), 0);
const cargasCampo = (d: Disp, t: number): Carga[] => {
  const { yB, sep } = geoRendija(d);
  const R0 = d.vis.r * 0.42;
  const cae = eIn(pr(t, T_HOYO - 1.3, 1.3));
  const [rc, giro] = configCampo(t);
  const cierra = 1 - 0.55 * riserCampo(t) ** 1.6;
  const r = R0 * (rc / 0.42) * cierra * (1 - cae);
  // en la entrada las cargas están donde estaban las rendijas (eje horizontal) y desde ahí empiezan a orbitar
  const ent = eIO(pr(t, T_CAMPO, 0.7));
  const th = (angCampo(t) + giro + 5.5 * cae ** 1.5) * ent;
  const rr = lerp(sep, r, ent);
  const cy = lerp(yB, d.vis.cy, ent);
  return [
    { x: d.vis.cx - rr * Math.cos(th), y: cy - rr * Math.sin(th), q: 1 },
    { x: d.vis.cx + rr * Math.cos(th), y: cy + rr * Math.sin(th), q: -1 },
  ];
};
// Líneas de campo completas: salen de cada carga en número ∝ |q|, repartidas simétricamente alrededor del eje que
// une las cargas; se integran con RK4 de paso adaptativo (más fino cerca de las cargas) hasta otra carga (y ahí se
// cierran en su centro) o fuera del cuadro. Las que salen de una negativa y llegan a una positiva ya las dibujó la
// positiva: no se repiten.
type LineaCampo = { pts: Pt[]; llega: boolean };
const lineasCampo = (d: Disp, cargas: Carga[], porUnidad: number): LineaCampo[] => {
  const E = (x: number, y: number): Pt => {
    let ex = 0;
    let ey = 0;
    for (const c of cargas) {
      const dx = x - c.x;
      const dy = y - c.y;
      const r2 = dx * dx + dy * dy + 1;
      const k = c.q / (r2 * Math.sqrt(r2));
      ex += k * dx;
      ey += k * dy;
    }
    const n = Math.hypot(ex, ey) || 1;
    return [ex / n, ey / n];
  };
  const caja = [-420, -420, d.W + 420, d.H + 420];
  const out: LineaCampo[] = [];
  cargas.forEach((c, ci) => {
    const n = Math.max(4, Math.round(porUnidad * Math.abs(c.q)));
    const otra = cargas[(ci + 1) % cargas.length];
    const eje = Math.atan2(otra.y - c.y, otra.x - c.x);
    const s = c.q > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const an = eje + ((i + 0.5) / n) * TAU;
      let x = c.x + 6 * Math.cos(an);
      let y = c.y + 6 * Math.sin(an);
      const pts: Pt[] = [[c.x, c.y], [x, y]];
      let llega = false;
      let fin: Carga | null = null;
      for (let k = 0; k < 2600; k++) {
        let dmin = Infinity;
        for (const o of cargas) dmin = Math.min(dmin, Math.hypot(x - o.x, y - o.y));
        const h = s * Math.min(7, Math.max(1.2, 0.18 * dmin));
        const k1 = E(x, y);
        const k2 = E(x + (h / 2) * k1[0], y + (h / 2) * k1[1]);
        const k3 = E(x + (h / 2) * k2[0], y + (h / 2) * k2[1]);
        const k4 = E(x + h * k3[0], y + h * k3[1]);
        x += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
        y += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        pts.push([x, y]);
        if (x < caja[0] || x > caja[2] || y < caja[1] || y > caja[3]) break;
        fin = cargas.find((o) => o !== c && o.q * c.q < 0 && Math.hypot(x - o.x, y - o.y) < 3.5) ?? null;
        if (fin) {
          pts.push([fin.x, fin.y]);
          llega = true;
          break;
        }
      }
      if (c.q < 0 && llega) continue;
      out.push({ pts, llega });
    }
  });
  return out;
};
// ═══ v1o-e · ONDAS DE HUYGENS (19,4-24,9 s): las dos rendijas son dos fuentes que emiten frentes circulares con
// cada nota del ostinato (más fuertes en los acentos 3+3+2 y en la batería); donde los frentes de una y otra fuente se
// cruzan, la interferencia se enciende. La cámara se acerca lento. En el hueco los frentes se congelan y se apagan;
// en el impacto de 24,94 se recogen en las líneas de campo y las fuentes son las dos cargas. ═══
const T_ONDAS = S("ondas");
const Z_ONDAS = 1.2;
type Frente = { t: number; a: number };
const FRENTES: Frente[] = (() => {
  const fin = escena(23.66);
  const ac = new Set(REAL_ESC.acentos);
  const out: Frente[] = [];
  for (const n of entre(REAL_ESC.cuerdas, T_ONDAS - 0.02, fin)) out.push({ t: n, a: ac.has(n) ? 1 : 0.5 });
  for (const b of entre(REAL_ESC.bateria, T_ONDAS - 0.02, fin)) {
    const c = out.find((f) => Math.abs(f.t - b) < 0.04);
    if (c) c.a = Math.max(c.a, 1.3);
    else out.push({ t: b, a: 1.2 });
  }
  return out.sort((x, y) => x.t - y.t);
})();
const ondas = (ctx: Ctx, d: Disp, t: number) => {
  const T1 = S("campo");
  if (t < T_ONDAS - 0.45 || t >= T1 + 0.4) return;
  const H0 = escena(23.66);
  const H1 = escena(24.87);
  const { yB, sep } = geoRendija(d);
  // tiempo de las ondas: corre normal, en el hueco se congela (avanza al 6 %)
  const tau = t < H0 ? t : H0 + 0.06 * (t - H0);
  const quieto = eIO(pr(t, H0 - 0.05, 0.4)) * (1 - 0.0 * pr(t, H1, 0.1));
  const vis = eIO(pr(t, T_ONDAS - 0.1, 0.35)) * (1 - 0.45 * quieto) * (1 - eIO(pr(t, T1 - 0.1, 0.35)));
  const z = lerp(1, Z_ONDAS, eIO(pr(t, T_ONDAS, H0 - T_ONDAS)));
  const { yB: yF, sep: sF } = geoRendija(d);
  // las fuentes: brillan con cada frente (son las rendijas y serán las cargas)
  const late = golpe(tau, FRENTES.map((f) => f.t), 10);
  const fa = eIO(pr(t, T_ONDAS - 0.45, 0.45)) * (1 - eIO(pr(t, T1, 0.25)));
  const fuentes = () => {
    for (const sx of [d.vis.cx - sF, d.vis.cx + sF]) {
      const X = d.vis.cx + (sx - d.vis.cx) * z;
      const Y = d.vis.cy + (yF - d.vis.cy) * z;
      carga(ctx, X, Y, (6 + 3 * late * (1 - quieto)) * Math.max(0.5, fa), RGB.hielo, fa, t);
    }
  };
  if (vis <= 0.005) {
    fuentes();
    return;
  }
  const V = d.vis.r * 1.05; // px por segundo
  const ancho = 9;
  const s1: Pt = [d.vis.cx - sep, yB];
  const s2: Pt = [d.vis.cx + sep, yB];
  const vivos = FRENTES.filter((f) => f.t <= tau && (tau - f.t) * V < d.vis.r * 2.2);
  const redu = 3;
  const fw = Math.ceil(d.W / redu);
  const fh = Math.ceil(d.H / redu);
  const aux = auxiliar(fw, fh, "ondas");
  const actx = aux.getContext("2d")!;
  const img = actx.createImageData(fw, fh);
  const px = img.data;
  const R2 = (d.vis.r * 1.5) ** 2;
  const rad = vivos.map((f) => ({ r: (tau - f.t) * V + 6, a: f.a * Math.exp(-(tau - f.t) * 0.9) }));
  for (let j = 0; j < fh; j++) {
    // coordenadas del mundo (antes del acercamiento de cámara)
    const y = d.vis.cy + (j * redu - d.vis.cy) / z;
    for (let i = 0; i < fw; i++) {
      const x = d.vis.cx + (i * redu - d.vis.cx) / z;
      const d1 = Math.hypot(x - s1[0], y - s1[1]);
      const d2 = Math.hypot(x - s2[0], y - s2[1]);
      let w1 = 0;
      let w2 = 0;
      for (const f of rad) {
        const u1 = (d1 - f.r) / ancho;
        const u2 = (d2 - f.r) / ancho;
        if (u1 > -3 && u1 < 3) w1 += f.a * Math.exp(-u1 * u1) / Math.sqrt(1 + d1 / 140);
        if (u2 > -3 && u2 < 3) w2 += f.a * Math.exp(-u2 * u2) / Math.sqrt(1 + d2 / 140);
      }
      const o = (j * fw + i) * 4;
      // cada frente solo es una línea tenue; donde se cruzan los de ambas fuentes, la interferencia se enciende
      const m = Math.max(0, 1 - ((x - d.vis.cx) ** 2 + (y - yB) ** 2) / R2) * vis;
      const v = (0.45 * (w1 + w2) + 1.6 * w1 * w2) * m;
      px[o] = Math.min(255, 70 * v);
      px[o + 1] = Math.min(255, 120 * v);
      px[o + 2] = Math.min(255, 255 * v);
      px[o + 3] = 255;
    }
  }
  actx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(aux, 0, 0, fw * redu, fh * redu);
  ctx.filter = "blur(6px)";
  ctx.globalAlpha = 0.5;
  ctx.drawImage(aux, 0, 0, fw * redu, fh * redu);
  ctx.restore();
  fuentes();
};
// Recorta una polilínea: quita los primeros a px y los últimos b px (donde las líneas se juntan en la carga).
const recorta = (pts: Pt[], a: number, b: number): Pt[] => {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = L[L.length - 1];
  return pts.filter((_, i) => L[i] >= a && L[i] <= tot - b);
};
const campo = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_CAMPO - 0.2 || t >= T_HOYO + 0.6) return;
  const cargas = cargasCampo(d, t);
  // entrada ágil (0,6 s) que aterriza en el golpe del compás 10: las rendijas ya brillan como cargas y las líneas
  // crecen desde ellas mientras las franjas del fluido cuántico se apagan
  const nace = eIO(pr(t, T_CAMPO - 0.2, 0.2));
  const crece = eOut(pr(t, T_CAMPO - 0.15, 0.5));
  const rot = -0.12 * (Math.min(t, H0_CAMPO) - T_CAMPO) - 0.12 * Math.max(0, t - H1_CAMPO);
  const quieto = enHueco(t);
  const rz = riserCampo(t);
  // v1o-e: hereda el acercamiento de las ondas (×1,2) y vuelve a su encuadre durante el primer segundo
  const esc = (1.04 + 0.05 * eIO(pr(t, T_CAMPO, 3.5)) + 0.25 * eIn(pr(t, T_HOYO - 1.0, 1.0))) * lerp(Z_ONDAS / 1.04, 1, eIO(pr(t, T_CAMPO, 1.2)));
  ctx.save();
  ctx.translate(d.vis.cx, d.vis.cy);
  ctx.rotate(rot * eIO(pr(t, T_CAMPO, 0.7)));
  ctx.scale(esc, esc);
  ctx.translate(-d.vis.cx, -d.vis.cy);
  const lineas = lineasCampo(d, cargas, 30);
  const sale = 1 - eIO(pr(t, T_HOYO - 0.1, 0.6)); // las líneas se recogen dentro del agujero que nace
  const pk = golpe(t, BOMBOS, 6) * (1 - quieto);
  const brilloL = crece * (1 - 0.7 * eIn(pr(t, T_HOYO - 0.5, 0.5))) * sale * (1 - 0.35 * quieto) * (1 + 0.9 * rz * rz) * (1 + 0.15 * pk + 0.25 * golpe(t, GOLPES_CAMPO, 7));
  const flujo = T_CAMPO + flujoCampo(t);
  luz(ctx, () => {
    lineas.forEach((l, i) => {
      const L = recorta(l.pts, 12, l.llega ? 12 : 0);
      if (L.length < 2) return;
      const n = Math.max(2, Math.round(L.length * crece));
      const corte = L.slice(0, n);
      const rgb = i % 2 ? RGB.azul : RGB.hielo;
      linea(ctx, corte, rgb, 0.1 * brilloL, 5);
      linea(ctx, corte, rgb, 0.62 * brilloL, 1.3);
      particulas(ctx, corte, flujo, 340, 3, RGB.hielo, 0.6 * brilloL, i + 31, 1.6);
    });
  });
  cargas.forEach((c, i) => carga(ctx, c.x, c.y, (8 + 3 * pk) * lerp(0.5, 1, nace), colorQ(c.q), nace * sale, t + i));
  // el punto donde se funden: crece justo antes del drop
  const funde = eIn(pr(t, T_HOYO - 0.5, 0.5)) * (1 - eIO(pr(t, T_HOYO, 0.6)));
  if (funde > 0.01) carga(ctx, d.vis.cx, d.vis.cy, 6 + 16 * funde, RGB.hielo, funde, t);
  ctx.restore();
};

// ═══ ACTO I · 7 · CUATRO COMBINACIONES DE SIGNOS (12-13 s): ++, +−, −+, −− en cuatro corcheas; cada corte cae
// en su nota ═══
const SIGNOS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const signos = (ctx: Ctx, d: Disp, t: number) => {
  const t0 = -10;
  const t1 = -9;
  if (t < t0 || t >= t1) return;
  const k = Math.min(3, Math.floor((t - t0) / (PULSO / 2)) % 4);
  const [s1, s2] = SIGNOS[k];
  const [qa, qb] = dipolo(d);
  dibujaLineas(ctx, lineasDe(d, [{ x: qa[0], y: qa[1], q: s1 }, { x: qb[0], y: qb[1], q: s2 * 1.0001 }], 24), t, 1, 1, 21 + k);
  const fl = golpe(t, [t0, t0 + 0.25, t0 + 0.5, t0 + 0.75], 10);
  carga(ctx, qa[0], qa[1], 8 + 5 * fl, colorQ(s1), 1, t);
  carga(ctx, qb[0], qb[1], 8 + 5 * fl, colorQ(s2), 1, t + 1);
};

// ═══ ACTO I · 6 · INTERFERENCIA (27-30 s): las dos cargas son fuentes; un frente por corchea. En el redoble las
// fuentes se juntan en el centro y sus frentes se funden en un solo círculo: el ecuador del toro del drop ═══
const posFuentes = (d: Disp, t: number): [Pt, Pt] => {
  const [a, b] = dipolo(d);
  const k = llega(t, S("hoyo") - TR, 0.6);
  return [[lerp(a[0], d.vis.cx, k), a[1]], [lerp(b[0], d.vis.cx, k), b[1]]];
};
const interferencia = (ctx: Ctx, d: Disp, t: number) => {
  const t0 = -10;
  const t1 = -9;
  if (t < t0 - TR || t >= t1) return;
  const vis = llega(t, t0) * (1 - eExpo(pr(t, t1 - 0.25 - TR, TR)));
  const redu = 3;
  const fw = Math.ceil(d.W / redu);
  const fh = Math.ceil(d.H / redu);
  const aux = auxiliar(fw, fh, "i");
  const actx = aux.getContext("2d")!;
  const img = actx.createImageData(fw, fh);
  const [s1, s2] = posFuentes(d, t);
  const lam = d.vis.r * 0.24;
  const k = TAU / lam;
  const om = TAU / (PULSO / 2);
  const tt = t - t0 + 0.6;
  const alcance = tt * (lam / (PULSO / 2)) + 4;
  const cx = d.vis.cx;
  const cy = d.vis.cy;
  const R2 = (d.vis.r * 1.45) ** 2;
  const px = img.data;
  for (let j = 0; j < fh; j++) {
    const y = j * redu;
    for (let i = 0; i < fw; i++) {
      const x = i * redu;
      const d1 = Math.hypot(x - s1[0], y - s1[1]);
      const d2 = Math.hypot(x - s2[0], y - s2[1]);
      const a1 = d1 < alcance ? Math.cos(k * d1 - om * tt) / Math.sqrt(1 + d1 / lam) : 0;
      const a2 = d2 < alcance ? Math.cos(k * d2 - om * tt) / Math.sqrt(1 + d2 / lam) : 0;
      const m = Math.max(0, 1 - ((x - cx) ** 2 + (y - cy) ** 2) / R2) * vis;
      const v = Math.max(0, a1 + a2) * m;
      const o = (j * fw + i) * 4;
      px[o] = Math.min(255, 40 * v);
      px[o + 1] = Math.min(255, 85 * v);
      px[o + 2] = Math.min(255, 255 * v);
      px[o + 3] = 255;
    }
  }
  actx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(aux, 0, 0, fw * redu, fh * redu);
  ctx.restore();
  // el círculo que queda: crece desde el centro hasta el radio del ecuador del toro y se fija en el hueco
  const kr = llega(t, t1 - 0.25, 0.5);
  if (kr > 0)
    luz(ctx, () => {
      ctx.beginPath();
      ctx.arc(cx, cy, rIntro(d) * kr, 0, TAU);
      ctx.strokeStyle = rgba(RGB.azul, 0.25 * kr);
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = rgba(RGB.hielo, 0.9 * kr);
      ctx.lineWidth = 2.4;
      ctx.stroke();
    });
  const fe = 1 - eExpo(pr(t, t1 - 0.25 - TR, TR));
  const pc = golpe(t, BOMBOS, 7);
  carga(ctx, s1[0], s1[1], (8 + 3 * pc) * fe, "255,190,120", fe, t);
  carga(ctx, s2[0], s2[1], (8 + 3 * pc) * fe, "120,170,255", fe, t + 1);
};

// ═══ ACTO II · 1-3 · TORO → POZO DEL ESPACIO-TIEMPO → ÓRBITA CON PRECESIÓN (30-40 s) ═══
// Toro x = (R + r cos v) cos u, y = (R + r cos v) sin u, z = r sen v, con R + r = 1 (el ecuador = el círculo).
// Pozo: paraboloide de Flamm (Schwarzschild), z(ρ) = 2√(rs (ρ − rs)) − 2√(rs (1 − rs)), hundido hacia el centro.
const T_TORO = S("toro");
const T_POZO = S("hoyo"); // (v1g: el pozo nace dentro de la formación del agujero negro)
const T_ORB = S("orbita");
const T_HOYO = S("hoyo");
const T_FIN_ESP = S("tres"); // el espacio-tiempo (toro, pozo, órbita) termina donde nacen los tres cuerpos
const RT = 0.7;
const rT = 0.3;
const NU = 60;
const NV = 26;
const RS0 = 0.11;
// el pozo solo late con los bombos cuando ya es órbita (antes no hay pulsos de escala)
const rsPozo = (t: number) => (t < T_TORO ? RS0 : RS0 * (1 + 0.12 * golpe(t, BOMBOS, 6)));
const flamm = (rho: number, rs: number) => 2 * Math.sqrt(rs * Math.max(0, rho - rs)) - 2 * Math.sqrt(rs * (1 - rs));
const ondaBombo = (rho: number, t: number) => {
  let z = 0;
  for (let i = BOMBOS.length - 1; i >= 0; i--) {
    const tk = BOMBOS[i];
    if (tk > t) continue;
    const dt = t - tk;
    if (dt > 1.6) break;
    const frente = dt * 0.9;
    z += 0.05 * Math.exp(-(((rho - frente) / 0.07) ** 2)) * Math.exp(-dt * 1.8);
  }
  return z;
};
// v1i · Agujero negro → malla → pozo → toro, en un solo plano de cámara (17,5-23,4 s):
//   A (17,5-20,2) el punto de las cargas se vuelve el agujero negro; el disco gira (más rápido con cada bombo, con
//     easing), se enciende con las notas y cambia de color por compás (hielo → ámbar tenue → azul); la cámara se acerca.
//   (en A la cámara además baja hacia el plano del disco)
//   B1 (20-21) la cámara se aleja; bajo el agujero nace la malla plana, del centro hacia el horizonte.
//   B2 (21-22,7) la gravedad curva la malla en el pozo de Flamm (de adentro hacia afuera) y el agujero baja con ella
//     hasta quedar sentado en el fondo; la cámara sube para mirar dentro del pozo.
//   C (22,5-23,4) el espacio curvado se vuelve el toro.
// La malla (lienzo 2D) y el agujero (WebGL) comparten la cámara: la escala del shader sale de la de proy3.
const RHO_IN = 0.26; // garganta del pozo: el disco cabe justo dentro
const RD = 0.24; // radio exterior del disco, en unidades del mundo
const GL_POR_U = 2.5 / RD; // unidades del shader (uDiscoOut = 2,5) por unidad del mundo
const Z_FONDO = flamm(RHO_IN, RS0) * 0.85;
const T_BAJA = T_HOYO + 2.5; // 20 s
const T_MALLA = T_BAJA + 0.15;
const T_CURVA = T_HOYO + 3.5; // 21 s
// cuánto se curvó el espacio en el radio rho (lo de adentro primero)
const curva = (t: number, rho = RHO_IN) => eIO(pr(t, T_CURVA + 0.35 * (rho - RHO_IN), 1.45));
const zHoyo = (t: number) => lerp(0.1, Z_FONDO + 0.035, curva(t));
const camEspacio = (t: number) => ({
  ax:
    t < T_TORO
      ? 1.2 + 0.21 * eIO(pr(t, T_HOYO, 2.9)) - 0.39 * eIO(pr(t, T_CURVA - 0.1, 1.8))
      : lerp(1.02, 1.08, eIO(pr(t, T_TORO, 0.8))),
  az: 0.22 * (t - T_HOYO) + 0.5 * Math.max(0, t - T_TORO) + 0.9 * Math.max(0, t - T_ORB) + 0.15 * pasos(BOMBOS, T_TORO, t, 0.4),
});
// escala de la cámara (px por unidad): se acerca al agujero, luego se aleja hasta el encuadre del toro
const alejamiento = (t: number) => lerp(1, 1.08, eIO(pr(t, T_TORO, 1.0)));
const escEspacio = (d: Disp, t = T_TORO + 1) => {
  const e1 = rIntro(d) * 0.92;
  if (t >= T_TORO) return e1 * alejamiento(t);
  const k = d.vis.r / 450;
  const l0 = Math.log(560 * k);
  const l1 = Math.log(1650 * k);
  const l = lerp(l0, l1, eIO(pr(t, T_HOYO - 0.2, 2.9)));
  return Math.exp(lerp(l, Math.log(e1), eIO(pr(t, T_BAJA + 0.2, 2.4))));
};
// punto del mundo que queda en el centro de la zona visual: el agujero al principio, el origen al final
const mira = (t: number) => lerp(zHoyo(t), 0, eIO(pr(t, T_BAJA, 2.5)));
const proyE = (d: Disp, p: [number, number, number], t: number) => {
  const { ax, az } = camEspacio(t);
  return proy3(d, [p[0], p[1], p[2] - mira(t)], ax, az, escEspacio(d, t));
};
const superficie = (u: number, v: number, f: number, t: number): [number, number, number] => {
  const tx = (RT + rT * Math.cos(v)) * Math.cos(u);
  const ty = (RT + rT * Math.cos(v)) * Math.sin(u);
  const tz = rT * Math.sin(v);
  const rho = lerp(RHO_IN, 1, (1 + Math.cos(v)) / 2);
  const pz = (flamm(rho, rsPozo(t)) * curva(t, rho) + (t >= T_TORO ? ondaBombo(rho, t) : 0)) * 0.85;
  return [lerp(tx, rho * Math.cos(u), f), lerp(ty, rho * Math.sin(u), f), lerp(tz, pz, f)];
};
// pozo (f = 1) → toro (f = 0)
const aplana = (t: number) => 1 - eIO(pr(t, T_TORO - 0.5, 0.9));
const fondoPozo = (d: Disp, t: number): Pt => {
  const q = proyE(d, [0, 0, zHoyo(t)], t);
  return [q[0], q[1]];
};
// Órbita que precesa: ρ(φ) = p / (1 + e cos(νφ)), ν = 0,88. Al final cae en espiral al centro.
const NU_ORB = 0.88;
const caida = (tp: number) => 1 - eIn(pr(tp, T_FIN_ESP - 0.6, 0.6)) * 0.97;
const orbita = (t: number) => {
  const t0 = T_ORB;
  const P = 0.46;
  const E = 0.5;
  const pts: [number, number][] = [];
  let phi = 0;
  const h = 1 / 240;
  const n = Math.max(0, Math.floor((t - t0) / h));
  for (let i = 0; i <= n; i++) {
    const rho = (P / (1 + E * Math.cos(NU_ORB * phi))) * caida(t0 + i * h);
    pts.push([rho, phi]);
    phi += (h * 3.2) / (rho * rho);
  }
  return pts;
};
const espacio = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_HOYO - 0.1 || t > T_FIN_ESP + TR) return;
  const f = aplana(t);
  const { ax, az } = camEspacio(t);
  const esc = escEspacio(d, t);
  const P = (u: number, v: number) => proyE(d, superficie(u, v, f, t), t);
  const desarma = eExpo(pr(t, T_ORB, TR));
  const L = lote();
  // el agujero tapa lo que pasa detrás de su sombra
  const hq = proyE(d, [0, 0, zHoyo(t)], t);
  const rSombra = 0.075 * esc * (1 - eIO(pr(t, T_TORO - 0.4, 0.8)));
  const dib = (pts: [number, number, number][], alfa: number) => {
    for (let k = 1; k < pts.length; k++) {
      const prof = (pts[k - 1][2] + pts[k][2]) / 2;
      let a = alfa * (0.12 + 0.46 * cl(0.55 - prof * 0.7));
      if (rSombra > 1 && prof > hq[2]) {
        const dd = Math.hypot((pts[k - 1][0] + pts[k][0]) / 2 - hq[0], (pts[k - 1][1] + pts[k][1]) / 2 - hq[1]);
        a *= cl((dd - rSombra) / (rSombra * 0.5));
      }
      if (a > 0.004) L.add(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], prof < 0 ? RGB.hielo : RGB.azul, a, prof < 0 ? 1.7 : 1.25);
    }
  };
  // la malla nace plana bajo el agujero y se extiende hacia afuera (anillos por radio, radios que se estiran)
  const nace = (rho: number) => eIO(pr(t, T_MALLA + (rho - RHO_IN) * 0.75, 0.5));
  luz(ctx, () => {
    for (let i = 0; i < NU; i++) {
      const u = (i / NU) * TAU;
      const k = (1 - desarma) * eIO(pr(t, T_MALLA + (i % 6) * 0.025, 0.95));
      if (k <= 0.01) continue;
      const pts: [number, number, number][] = [];
      const m = 36;
      // del anillo interior (v = π) hacia afuera, en los dos sentidos
      for (let j = 0; j <= m; j++) {
        const v = Math.PI + (j / m - 0.5) * TAU * k;
        pts.push(P(u, v));
      }
      dib(pts, 1);
    }
    for (let j = 0; j < NV; j++) {
      const v = (j / NV) * TAU;
      const rho = lerp(RHO_IN, 1, (1 + Math.cos(v)) / 2);
      const kk = nace(rho) * (1 - desarma);
      if (kk <= 0.01) continue;
      const pts: [number, number, number][] = [];
      const m = 96;
      for (let i = 0; i <= m; i++) pts.push(P((i / m) * TAU, v));
      dib(pts, (j === 0 ? 1.4 : 1) * kk);
    }
    L.draw(ctx, 1);
  });
  // el punto con masa (hasta que emerge el agujero negro), luego la masa central del toro y de la órbita
  const emerge = eIO(pr(t, T_HOYO - 0.1, 0.7)); // el punto de las cargas se vuelve el agujero negro
  const ef = 1 - eExpo(pr(t, T_FIN_ESP, TR));
  if (ef > 0.01) {
    const c0 = fondoPozo(d, t);
    const kz = llega(t, T_ORB);
    const c: Pt = [lerp(c0[0], d.vis.cx, kz), lerp(c0[1], d.vis.cy, kz)];
    const am = ef * (1 - emerge * (1 - eIO(pr(t, T_TORO - 0.3, 0.8))));
    const kb = t < T_TORO ? 0 : golpe(t, BOMBOS, 6);
    brillo(ctx, c[0], c[1], Math.min(esc, 500) * 0.75, RGB.azul, (0.22 + 0.1 * kb) * am);
    carga(ctx, c[0], c[1], (9 + 6 * kb) * am, RGB.hielo, am, t);
  }
  const ko = eOut(pr(t, T_ORB - 0.1, 0.4)) * (1 - eExpo(pr(t, T_FIN_ESP - 0.1, TR)));
  if (ko > 0.01) {
    const orb = orbita(t);
    const kz = llega(t, T_ORB);
    const escO = esc * lerp(1, 1.35, kz);
    const axO = lerp(ax, 0.55, kz);
    const pts = orb.map(([rho, phi]) => {
      const q = proy3(d, [rho * Math.cos(phi), rho * Math.sin(phi), (flamm(Math.max(rho, 0.16), rsPozo(t)) + ondaBombo(rho, t)) * 0.85 * (1 - kz)], axO, az, escO);
      return [q[0], q[1]] as Pt;
    });
    if (pts.length > 1) {
      luz(ctx, () => {
        estela(ctx, pts, RGB.azul, ko * 0.3, 16, 16, 0.2);
        estela(ctx, pts, RGB.azul, ko, 4.2, 16, 0.25);
        estela(ctx, pts, RGB.hielo, ko * 0.8, 1.8, 16, 0.15);
      });
      const [hx, hy] = pts[pts.length - 1];
      carga(ctx, hx, hy, 8 + 4 * golpe(t, BOMBOS, 9), RGB.hielo, ko, t);
    }
  }
};
// El agujero negro (raymarcheado) con la misma cámara que la malla: gira siempre, su giro se acelera con easing en
// cada bombo y la luz del disco sube con cada nota; el color cambia por compás. Sin pulsos de escala.
const hoyoFormado = (ctx: Ctx, d: Disp, t: number) => {
  const t0 = T_HOYO - 0.25;
  if (t < t0 - 0.1 || t > T_TORO + 0.4) return;
  const vis = eIO(pr(t, t0, 0.6)) * (1 - eIO(pr(t, T_TORO - 0.45, 0.85)));
  if (vis <= 0.005) return;
  const kicks = entre(BOMBOS, t0, T_TORO);
  const notas = entre(NOTAS_ARP, t0, T_TORO);
  const { ax, az } = camEspacio(t);
  const q = proyE(d, [0, 0, zHoyo(t)], t);
  const escH = escEspacio(d, t) / (1 + q[2] * 0.28);
  const tono = eIO(pr(t, T_HOYO + 1.1, 1.6)) + eIO(pr(t, T_HOYO + 3.1, 1.8));
  const c = pintarHoyo(d.W, d.H, {
    t: 1.5 * (t - t0) + 0.5 * pasos(kicks, t0, t, 0.45),
    dist: (0.5 * d.H * GL_POR_U) / (0.42 * escH),
    elev: Math.PI / 2 - ax,
    az: 0.3 - az,
    brillo: (1.0 + 0.22 * golpe(t, notas, 5) + 0.12 * golpe(t, kicks, 4)) * vis,
    calor: 0.45 * (1 - 0.6 * Math.min(1, tono) * (1 - Math.max(0, tono - 1))),
    revela: lerp(0.2, 1, eIO(pr(t, t0, 1.4))),
    rs: 0.2,
    tono,
  });
  if (!c) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(c, q[0] - d.W / 2, q[1] - d.H / 2, d.W, d.H);
  ctx.restore();
};

// ═══ ACTO II · 1 · AGUJERO NEGRO (14-16 s, drop 1): entra con el golpe (corte), el disco gira y se enciende con
// cada nota del arpegio, la lente gravitacional pulsa con cada bombo, la cámara empuja cada vez más rápido y sale con
// un corte limpio. Raymarcheo en WebGL (src/gl.ts) ═══
const T_TRES = S("tres");
const hoyo = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_HOYO || t >= T_TORO + 0.2) return;
  const lt = t - T_HOYO;
  const vaHoyo = 1 - eIO(pr(t, T_TORO - 0.35, 0.55));
  const kicks = entre(BOMBOS, T_HOYO, T_TORO);
  const notas = entre(NOTAS_ARP, T_HOYO, T_TORO);
  const pk = pasos(kicks, T_HOYO, t, 0.18);
  const kick = golpe(t, kicks, 7);
  const c = pintarHoyo(d.W, d.H, {
    t: lt * 1.2 + 0.25 * pasos(notas, T_HOYO, t, 0.3),
    dist: 9.6 - 0.22 * pk - 4.5 * eIO(pr(t, T_TORO - 0.8, 1.0)),
    elev: 0.1 + 0.012 * pk,
    az: 0.3 + 0.18 * lt,
    brillo: (1.0 + 0.35 * golpe(t, notas, 10) + 0.25 * kick) * (1 + 1.2 * golpe(t, [T_HOYO], 3)),
    calor: 0.45,
    revela: lerp(0.3, 1, eOut(pr(t, T_HOYO, 0.2))),
    rs: 0.2 * (1 + 0.22 * kick),
  });
  if (!c) return;
  ctx.save();
  ctx.globalAlpha = vaHoyo;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(c, 0, d.vis.cy - d.H / 2, d.W, d.H);
  ctx.restore();
  // onda de choque del golpe de entrada y un anillo por bombo
  luz(ctx, () => {
    for (const k of [T_HOYO, ...kicks]) {
      const e = t - k;
      if (e < 0 || e > 0.4) continue;
      ctx.beginPath();
      ctx.arc(d.vis.cx, d.vis.cy, 60 + e * (k === T_HOYO ? 2200 : 1200), 0, TAU);
      ctx.strokeStyle = rgba(RGB.hielo, (k === T_HOYO ? 0.6 : 0.25) * (1 - e / 0.4));
      ctx.lineWidth = k === T_HOYO ? 4 : 2;
      ctx.stroke();
    }
  });
};

// ═══ ACTO II · 5 · TRES CUERPOS (45-48 s): la órbita en ocho de Chenciner–Montgomery (G = m = 1), Verlet ═══
const T_CONO = S("busqueda"); // (sin cono de luz en la v1e: los tres cuerpos caen en la búsqueda)
const TRES = (() => {
  const dt = 0.002;
  const n = 3200;
  const p = [[0.97000436, -0.24308753], [-0.97000436, 0.24308753], [0, 0]];
  const v3 = [-0.93240737, -0.86473146];
  const v = [[-v3[0] / 2, -v3[1] / 2], [-v3[0] / 2, -v3[1] / 2], v3];
  const acc = (q: number[][]) =>
    q.map((qi, i) => {
      let ax = 0;
      let ay = 0;
      q.forEach((qj, j) => {
        if (i === j) return;
        const dx = qj[0] - qi[0];
        const dy = qj[1] - qi[1];
        const r3 = Math.pow(dx * dx + dy * dy, 1.5);
        ax += dx / r3;
        ay += dy / r3;
      });
      return [ax, ay];
    });
  const out: number[][][] = [];
  let q = p.map((x) => [...x]);
  let w = v.map((x) => [...x]);
  for (let s = 0; s < n; s++) {
    out.push(q.map((x) => [...x]));
    const a0 = acc(q);
    q = q.map((qi, i) => [qi[0] + w[i][0] * dt + 0.5 * a0[i][0] * dt * dt, qi[1] + w[i][1] * dt + 0.5 * a0[i][1] * dt * dt]);
    const a1 = acc(q);
    w = w.map((wi, i) => [wi[0] + 0.5 * (a0[i][0] + a1[i][0]) * dt, wi[1] + 0.5 * (a0[i][1] + a1[i][1]) * dt]);
  }
  return out;
})();
const COLORES3 = ["120,170,255", "236,240,255", "170,150,255"];
const tres = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_TRES - TR || t > T_CONO + 0.4) return;
  const u = (0.15 + 1.85 * pr(t, T_TRES - TR, T_CONO - T_TRES + TR)) % 1;
  const k = Math.min(TRES.length - 1, Math.floor(u * (TRES.length - 1)));
  const esc = d.vis.r * 0.92;
  const nace = llega(t, T_TRES);
  // los tres cuerpos viajan al nodo de partida de la búsqueda y se encienden en él
  const cae = eIO(pr(t, T_CONO - 0.6, 0.9));
  const s0 = inicioBusq(d, t);
  const kick = golpe(t, BOMBOS, 8);
  for (let b = 0; b < 3; b++) {
    const pts: Pt[] = [];
    for (let s = k - 900; s <= k; s += 3) {
      const ss = ((s % TRES.length) + TRES.length) % TRES.length;
      if (s < 0 && u < 0.5 && t < T_TRES + 0.2) continue;
      void ss;
      const ix = ((s % TRES.length) + TRES.length) % TRES.length;
      const x = d.vis.cx + TRES[ix][b][0] * esc;
      const y = d.vis.cy + TRES[ix][b][1] * esc;
      const bx = lerp(d.vis.cx, x, nace);
      const by = lerp(d.vis.cy, y, nace);
      pts.push([lerp(bx, s0[0], cae), lerp(by, s0[1], cae)]);
    }
    luz(ctx, () => {
      estela(ctx, pts, COLORES3[b], 0.3 * (1 - 0.6 * cae), 18, 8);
      estela(ctx, pts, COLORES3[b], 1 * (1 - 0.5 * cae), 4, 12);
    });
    const [x, y] = pts[pts.length - 1];
    carga(ctx, x, y, (8 + 4 * kick) * (0.4 + 0.6 * nace), COLORES3[b], 1 - eIO(pr(t, T_CONO + 0.1, 0.3)), t + b);
  }
};

// ═══ ACTO II · 6 · CONO DE LUZ (48-50 s): los tres cuerpos caen en un evento y se abre su pasado y su futuro ═══
const T_BUSQ = S("busqueda");
const cono = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_CONO - 0.05 || t > T_BUSQ + TR) return;
  const k = eOut(pr(t, T_CONO, TR)) * (1 - eExpo(pr(t, T_BUSQ, TR)));
  const az = 0.5 + (t - T_CONO) * 1.3 + 0.2 * pasos(entre(BOMBOS, T_CONO, T_BUSQ), T_CONO, t, 0.25);
  const esc = d.vis.r * 0.95;
  const P = (x: number, y: number, z: number) => proy3(d, [x, y, z], 1.25, az, esc);
  const L = lote();
  for (const sgn of [1, -1]) {
    for (let r = 1; r <= 6; r++) {
      const h = (r / 6) * k;
      let prev: [number, number, number] | null = null;
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * TAU;
        const q = P(h * Math.cos(a), h * Math.sin(a), sgn * h);
        if (prev) L.add(prev[0], prev[1], q[0], q[1], r === 6 ? RGB.blanco : sgn > 0 ? RGB.hielo : "150,140,255", 0.25 + 0.1 * r, r === 6 ? 2 : 1.3);
        prev = q;
      }
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const q0 = P(0, 0, 0);
      const q1 = P(k * Math.cos(a), k * Math.sin(a), sgn * k);
      L.add(q0[0], q0[1], q1[0], q1[1], RGB.azul, 0.5, 1.2);
    }
  }
  luz(ctx, () => L.draw(ctx, 0.8));
  const mundo: Pt[] = [];
  for (let i = -30; i <= 30; i++) {
    const s = (i / 30) * k;
    const q = P(0.35 * Math.sin(s * 2.4) * Math.abs(s), 0, s);
    mundo.push([q[0], q[1]]);
  }
  luz(ctx, () => trazo(ctx, mundo, "255,214,170", 0.95, 2.4));
  const c = P(0, 0, 0);
  carga(ctx, c[0], c[1], 9 + 5 * golpe(t, BOMBOS, 7) + 6 * golpe(t, [T_CONO], 3), RGB.hielo, 1 - eExpo(pr(t, T_BUSQ, TR)), t);
};
// ═══ ACTO III · 1 · TESERACTO (56-60 s, build 2): vértices (±1)⁴ que giran en los planos XW e YZ; nacen de los
// nodos del camino que encontró Dijkstra ═══
const T_TES = S("teseracto");
const T_MAND = S("mandelbrot");
const T_FLU = S("fluido"); // v1o: el drop 2 abre con el fluido; el Mandelbrot nace de él a las 38 s
const VERT4: number[][] = Array.from({ length: 16 }, (_, i) => [0, 1, 2, 3].map((b) => ((i >> b) & 1 ? 1 : -1)));
const ARISTAS: [number, number][] = [];
for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) if (!(i & (1 << b)) ) ARISTAS.push([i, i | (1 << b)]);
const empuje = (t: number) => {
  // Push-in de cámara durante el riser: acelera hacia el drop, con un pequeño retroceso antes del golpe.
  const u = pr(t, T_TES, T_FLU - T_TES);
  const antic = Math.sin(Math.PI * pr(t, T_FLU - 0.3, 0.3)) * 0.08;
  return 1 + 0.55 * u * u * u - antic;
};
const angTes = (t: number) => {
  const lt = Math.max(0, t - T_TES);
  const u = pr(t, T_TES, T_FLU - T_TES);
  return { a: 1.2 * lt + 1.6 * u * u * u, b: 0.7 * lt + 0.4 + 0.9 * u * u };
};
const vertTes = (d: Disp, i: number, t: number): [number, number, number] => {
  const { a, b } = angTes(t);
  let [x, y, z, w] = VERT4[i];
  [x, w] = [x * Math.cos(a) - w * Math.sin(a), x * Math.sin(a) + w * Math.cos(a)];
  [y, z] = [y * Math.cos(b) - z * Math.sin(b), y * Math.sin(b) + z * Math.cos(b)];
  const k4 = 1 / (3 - w); // proyección de 4D a 3D
  const p3: [number, number, number] = [x * k4, y * k4, z * k4];
  const esc = d.vis.r * 1.15 * empuje(t);
  const q = proy3(d, p3, 0.55, 0.3 + 0.15 * t, esc);
  return q;
};
const teseracto = (ctx: Ctx, d: Disp, t: number) => {
  const t0 = T_TES;
  const vuela = (i: number) => muelle(t, t0 - 0.1 + i * 0.01, 0.3);
  const pos = (i: number, tt: number): [number, number, number] => {
    const v = vertTes(d, i, tt);
    const k = muelle(tt, t0 - 0.1 + i * 0.01, 0.3);
    if (k >= 1) return v;
    const m = nodoCamino(d, i, tt);
    return [lerp(m[0], v[0], k), lerp(m[1], v[1], k), v[2]];
  };
  const P = Array.from({ length: 16 }, (_, i) => pos(i, t));
  const p = golpe(t, BOMBOS, 8);
  // Aristas: se trazan después de que llegan los vértices, con desfase por índice. Detrás, dos ecos del mismo giro
  // un instante antes (desenfoque de movimiento): el cuerpo gana profundidad sin moverse de más.
  luz(ctx, () => {
    for (const [dt, ka] of [[0.07, 0.12], [0.035, 0.24]] as [number, number][]) {
      const Q = Array.from({ length: 16 }, (_, i) => pos(i, t - dt));
      const L = lote();
      ARISTAS.forEach(([i, j], k) => {
        if (eOut(pr(t, t0 + 0.05 + k * 0.004, 0.18)) < 1) return;
        L.add(Q[i][0], Q[i][1], Q[j][0], Q[j][1], RGB.azul, ka, 2.2);
      });
      L.draw(ctx, 0.6);
    }
    ARISTAS.forEach(([i, j], k) => {
      const kk = eOut(pr(t, t0 + 0.05 + k * 0.004, 0.18));
      if (kk <= 0) return;
      const a = P[i];
      const b = P[j];
      const fin: Pt = [lerp(a[0], b[0], kk), lerp(a[1], b[1], kk)];
      const prof = (a[2] + b[2]) / 2;
      const al = 0.3 + 0.6 * cl(0.6 - prof * 0.5);
      trazo(ctx, [[a[0], a[1]], fin], RGB.azul, al * 0.55, 3.2 + 1.2 * p);
      linea(ctx, [[a[0], a[1]], fin], RGB.hielo, al, prof < 0 ? 2.2 : 1.5);
    });
  });
  P.forEach(([x, y, z], i) => {
    const al = Math.min(1, vuela(i) * 1.5);
    const destello = golpe(t - (i % 4) * 0.02, BOMBOS, 9);
    carga(ctx, x, y, (5.5 + 5 * destello + (z < 0 ? 2 : 0)) * empuje(t) ** 0.5, RGB.hielo, al, t + i);
  });
  void p;
};


// Explosión del teseracto en el drop: cada arista se vuelve una astilla que sale despedida y gira.
const explosion = (ctx: Ctx, d: Disp, t: number) => {
  const t0 = T_FLU;
  const u = pr(t, t0, 0.6);
  if (t < t0 || u >= 1) return;
  const P = Array.from({ length: 16 }, (_, i) => vertTes(d, i, t0 - 0.001));
  luz(ctx, () => {
    for (let m = 0; m < 3; m++) {
      // tres muestras en el tiempo: desenfoque de movimiento
      const uu = Math.max(0, pr(t - m * 0.012, t0, 0.6));
      const k = eOut(uu);
      ARISTAS.forEach(([i, j], n) => {
        const a = P[i];
        const b = P[j];
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        const dx = mx - d.vis.cx;
        const dy = my - d.vis.cy;
        const dist = Math.hypot(dx, dy) || 1;
        const vel = 900 * (0.6 + azar(n) * 0.8);
        const ox = (dx / dist) * vel * k;
        const oy = (dy / dist) * vel * k;
        const rot = (azar(n + 3) - 0.5) * 4 * k;
        const hx = (b[0] - a[0]) / 2;
        const hy = (b[1] - a[1]) / 2;
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const ex = hx * c - hy * s;
        const ey = hx * s + hy * c;
        for (let q = 0; q < 3; q++) {
          // cada arista se parte en tres astillas que se separan un poco entre sí
          const f0 = q / 3;
          const f1 = (q + 1) / 3;
          const sep = (q - 1) * 60 * k * (0.5 + azar(n * 3 + q));
          const ax0 = mx + ox - ex + 2 * ex * f0 + (dx / dist) * sep;
          const ay0 = my + oy - ey + 2 * ey * f0 + (dy / dist) * sep;
          const ax1 = mx + ox - ex + 2 * ex * f1 + (dx / dist) * sep;
          const ay1 = my + oy - ey + 2 * ey * f1 + (dy / dist) * sep;
          if (m === 0) trazo(ctx, [[ax0, ay0], [ax1, ay1]], RGB.hielo, (1 - uu) * 0.9, 2.2);
          else linea(ctx, [[ax0, ay0], [ax1, ay1]], RGB.hielo, (1 - uu) * 0.3, 2.2);
        }
      });
      if (m === 0)
        for (let q = 0; q < 70; q++) {
          // chispas del estallido
          const ang = azar(q * 1.7 + 2) * TAU;
          const v = 1300 * (0.3 + azar(q * 2.3)) * k;
          chispa(ctx, d.vis.cx + Math.cos(ang) * v, d.vis.cy + Math.sin(ang) * v, 1.6 + azar(q) * 1.6, RGB.hielo, (1 - uu) * 0.9);
        }
    }
  });
};


// ═══ ACTO III · 4 · LORENZ (66,5-68,5 s): σ = 10, ρ = 28, β = 8/3, RK4; nace del punto donde se cerró Julia ═══
const T_LOR = S("lorenz");
const T_GS = S("grayscott");
const SIGMA = 10;
const RHO = 28;
const BETA = 8 / 3;
const DT_L = 0.006;
const PASOS_L = 6500;
const LORENZ: [number, number, number][] = (() => {
  const f = (x: number, y: number, z: number) => [SIGMA * (y - x), x * (RHO - z) - y, x * y - BETA * z];
  let s = [0.1, 0, 0];
  const out: [number, number, number][] = [[s[0], s[1], s[2]]];
  for (let i = 0; i < PASOS_L; i++) {
    const k1 = f(s[0], s[1], s[2]);
    const k2 = f(s[0] + (DT_L / 2) * k1[0], s[1] + (DT_L / 2) * k1[1], s[2] + (DT_L / 2) * k1[2]);
    const k3 = f(s[0] + (DT_L / 2) * k2[0], s[1] + (DT_L / 2) * k2[1], s[2] + (DT_L / 2) * k2[2]);
    const k4 = f(s[0] + DT_L * k3[0], s[1] + DT_L * k3[1], s[2] + DT_L * k3[2]);
    s = s.map((v, j) => v + (DT_L / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    out.push([s[0], s[1], s[2]]);
  }
  return out;
})();
const pasosLorenz = (t: number) => Math.round(PASOS_L * eIO(pr(t, T_LOR, 2.4)) ** 0.85);
const giroLorenz = (t: number) => {
  let a = 0.45 * (t - T_LOR);
  for (const b of BOMBOS) if (b >= T_LOR && b <= t) a += 0.08 * eIO(pr(t, b, 0.45));
  return a;
};
const proyLorenz = (d: Disp, p: [number, number, number], t: number): Pt => {
  const esc = (d.vis.r / 27) * (1 + 0.02 * golpe(t));
  const ang = giroLorenz(t);
  const [x, y, z] = [p[0], p[1], p[2] - 25];
  const xr = x * Math.cos(ang) - y * Math.sin(ang);
  const yr = x * Math.sin(ang) + y * Math.cos(ang);
  const inc = 1.25;
  const yz = yr * Math.sin(inc) + z * Math.cos(inc);
  const prof = yr * Math.cos(inc) - z * Math.sin(inc);
  const persp = 1 / (1 + prof * 0.01);
  return [xr * esc * persp, -yz * esc * persp];
};
// Al principio el primer punto de la curva está donde se cerró el fractal; luego el atractor se centra.
const centroLorenz = (d: Disp, t: number): Pt => {
  const p0 = proyLorenz(d, LORENZ[0], T_LOR);
  const k = eIO(pr(t, T_LOR, 0.8));
  return [d.vis.cx - p0[0] * (1 - k), d.vis.cy - p0[1] * (1 - k)];
};
const recogeLorenz = (t: number) => 0 * t;
const lorenz = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_LOR || t > T_GS + TR) return;
  const va = 1 - eExpo(pr(t, T_GS, TR)); // Gray-Scott nace de esta misma curva
  ctx.save();
  ctx.globalAlpha = va;
  const n = Math.max(2, pasosLorenz(t));
  const [ox, oy] = centroLorenz(d, t);
  const pts: Pt[] = LORENZ.slice(0, n).map((p) => {
    const q = proyLorenz(d, p, t);
    return [ox + q[0], oy + q[1]];
  });
  const head = pts[pts.length - 1];
  const rk = recogeLorenz(t);
  const fin = rk > 0 ? pts.map((q, i) => {
    // se recoge hacia la cabeza: lo más viejo primero
    const k = eIO(cl(rk * 1.6 - (i / pts.length) * 0.6));
    return [lerp(q[0], head[0], k), lerp(q[1], head[1], k)] as Pt;
  }) : pts;
  luz(ctx, () => {
    // halo continuo debajo de toda la curva, y la curva en tramos que se encienden hacia la cabeza
    linea(ctx, fin, RGB.azul, 0.05, 12);
    const tr = 30;
    for (let s = 0; s < tr; s++) {
      const a = Math.floor((s / tr) * (fin.length - 1));
      const b = Math.floor(((s + 1) / tr) * (fin.length - 1)) + 1;
      const u = (s + 1) / tr;
      const tramo = fin.slice(a, b);
      if (u > 0.6) linea(ctx, tramo, RGB.azul, 0.2 * u, 6);
      linea(ctx, tramo, u > 0.85 ? RGB.hielo : RGB.azul, 0.18 + 0.66 * u * u, u > 0.85 ? 2.2 : 1.6);
    }
    // polvo del atractor: puntos fijos de la trayectoria que titilan con los hats
    const hat = golpe(t, HATS, 10);
    const nh = HATS.filter((h) => h <= t).length;
    for (let q = 0; q < 90; q++) {
      const idx = Math.floor(azar(q * 4.7 + 1) * (fin.length - 1));
      const f = fin[idx];
      chispa(ctx, f[0], f[1], 1.5, q % 3 ? RGB.hielo : RGB.azul, (0.25 + 0.6 * hat * azar(q + nh * 13.1)) * (1 - rk));
    }
  });
  carga(ctx, head[0], head[1], 8 + 4 * golpe(t) + 5 * rk, RGB.hielo, 1, t);
  ctx.restore();
};
const cabezaLorenz = (d: Disp, t: number): Pt => {
  const n = Math.max(2, pasosLorenz(t));
  const [ox, oy] = centroLorenz(d, t);
  const q = proyLorenz(d, LORENZ[n - 1], t);
  return [ox + q[0], oy + q[1]];
};


// ═══ ACTO III · 6 · RED NEURONAL (70-72 s): crece una capa en cada pulso; procesa una entrada por pulso (tanh) ═══
const T_RED = S("chladni"); // (sin red neuronal: Gray-Scott pasa a las figuras de Chladni)
// Capas con identidad: entrada (3), ocultas h1 (6), h2 (8), h3 (6), salida (2).
const IDS = ["e", "h1", "h2", "h3", "s"];
const TAM: Record<string, number> = { e: 3, h1: 6, h2: 8, h3: 6, s: 2 };
const ARQS = [["e", "s"], ["e", "h1", "s"], ["e", "h1", "h2", "s"], ["e", "h1", "h2", "h3", "s"]];
const palmasRed = () => [T_RED + 0.25, T_RED + 0.5, T_RED + 0.75];
const arqEn = (t: number) => {
  const ps = palmasRed();
  let k = 0;
  while (k < ps.length && ps[k] <= t && k < 3) k++;
  return { k, desde: k > 0 ? ps[k - 1] : T_RED };
};
const peso = (a: string, b: string, j: number, i: number) => (azar(IDS.indexOf(a) * 97 + IDS.indexOf(b) * 41 + j * 13 + i * 3.7 + 1) - 0.5) * 2.6;
const sesgo = (b: string, j: number) => (azar(IDS.indexOf(b) * 31 + j * 5.3 + 77) - 0.5) * 0.6;
const entradaRed = (k: number) => [0, 1, 2].map((i) => Math.sin(k * 2.1 + i * 1.7) * 0.9 + (azar(k * 7 + i) - 0.5) * 0.4);
const pasada = (arq: string[], x: number[]) => {
  const acts = [x];
  for (let l = 1; l < arq.length; l++) {
    const prev = acts[l - 1];
    acts.push(Array.from({ length: TAM[arq[l]] }, (_, j) => Math.tanh(prev.reduce((s, v, i) => s + peso(arq[l - 1], arq[l], j, i) * v, sesgo(arq[l], j)))));
  }
  return acts;
};
const posNodo = (d: Disp, arq: string[], id: string, j: number): Pt => {
  const l = arq.indexOf(id);
  const ancho = d.vis.r * (d.fmt === "horizontal" ? 2.0 : 1.9);
  const gap = d.vis.r * 0.2;
  const n = TAM[id];
  const x = arq.length === 1 ? d.vis.cx : d.vis.cx - ancho / 2 + (ancho * l) / (arq.length - 1);
  return [x, d.vis.cy + (j - (n - 1) / 2) * gap];
};
// Posición animada de un nodo: al cambiar de arquitectura todos se reacomodan con resorte; la capa nueva nace
// colapsada en su lugar (subdivide el espacio entre sus vecinas) y se abre.
const nodoRed = (d: Disp, id: string, j: number, t: number): Pt | null => {
  const { k, desde } = arqEn(t);
  const ahora = ARQS[k];
  if (!ahora.includes(id)) return null;
  const objetivo = posNodo(d, ahora, id, j);
  const m = muelle(t, desde, 0.22);
  let origen: Pt;
  if (k === 0) {
    // nacimiento: todo sale del punto donde se recogió Lorenz
    const p0: Pt = [d.vis.cx, d.vis.cy];
    const mm = muelle(t, T_RED - 0.05 + (IDS.indexOf(id) * 3 + j) * 0.006, 0.25);
    return [lerp(p0[0], objetivo[0], mm), lerp(p0[1], objetivo[1], mm)];
  }
  const antes = ARQS[k - 1];
  if (antes.includes(id)) origen = posNodo(d, antes, id, j);
  else {
    const o = posNodo(d, ahora, id, j);
    origen = [o[0], d.vis.cy];
  }
  return [lerp(origen[0], objetivo[0], m), lerp(origen[1], objetivo[1], m)];
};
const recogeRed = (t: number) => 0 * t;
const red = (ctx: Ctx, d: Disp, t: number) => {
  const vaADN = 1 - eExpo(pr(t, T_ADN, TR));
  if (vaADN <= 0.01) return;
  const { k } = arqEn(t);
  const arq = ARQS[k];
  const kb = Math.max(0, Math.floor((t - T_RED) / PULSO));
  const enPulso = t - T_RED - kb * PULSO;
  const acts = pasada(arq, entradaRed(kb));
  const frente = enPulso / (PULSO / 2 / (arq.length - 1)); // la señal llega a la salida justo en la corchea (blip)
  const rc = recogeRed(t);
  const destino: Pt = [d.vis.cx, d.vis.cy];
  const P = (id: string, j: number): Pt | null => {
    const p = nodoRed(d, id, j, t);
    if (!p) return null;
    return rc > 0 ? [lerp(p[0], destino[0], eIO(cl(rc * 1.4 - IDS.indexOf(id) * 0.08))), lerp(p[1], destino[1], eIO(cl(rc * 1.4 - IDS.indexOf(id) * 0.08)))] : p;
  };
  luz(ctx, () => {
    for (let l = 0; l < arq.length - 1; l++) {
      const viaja = cl(frente - l);
      const a = arq[l];
      const b = arq[l + 1];
      // las aristas se tienden después de que el nodo nuevo llega
      const tiende = eOut(pr(t, arqEn(t).desde + 0.04, 0.15));
      for (let j = 0; j < TAM[b]; j++)
        for (let i = 0; i < TAM[a]; i++) {
          const p0 = P(a, i);
          const p1 = P(b, j);
          if (!p0 || !p1) continue;
          const c = peso(a, b, j, i) * acts[l][i];
          const fz = Math.min(1, Math.abs(c));
          const nuevo = k > 0 && (b === ARQS[k][ARQS[k].length - 2] || a === ARQS[k][ARQS[k].length - 2]) ? tiende : 1;
          const fin: Pt = [lerp(p0[0], p1[0], nuevo), lerp(p0[1], p1[1], nuevo)];
          trazo(ctx, [p0, fin], c > 0 ? RGB.azul : RGB.hielo, (0.08 + 0.28 * fz) * (1 - rc) * vaADN, 1.5);
          if (viaja > 0 && viaja < 1 && fz > 0.3 && nuevo >= 1) chispa(ctx, lerp(p0[0], p1[0], viaja), lerp(p0[1], p1[1], viaja), 2.6, RGB.hielo, fz * (1 - rc) * vaADN);
        }
    }
  });
  const flash = golpe(t, palmasRed(), 6);
  arq.forEach((id, l) => {
    const enc = eOut(cl((frente - l + 0.2) * 2)) * Math.exp(-Math.max(0, frente - l - 1) * 0.7);
    for (let j = 0; j < TAM[id]; j++) {
      const p = P(id, j);
      if (!p) continue;
      const a = Math.abs(acts[l][j]);
      ctx.strokeStyle = rgba(RGB.hielo, 0.5 * (1 - rc) * vaADN);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 14, 0, TAU);
      ctx.stroke();
      brillo(ctx, p[0], p[1], 64, acts[l][j] > 0 ? RGB.azul : RGB.hielo, (0.6 * a * enc + 0.4 * flash) * (1 - rc * 0.5) * vaADN);
      ctx.fillStyle = rgba(RGB.blanco, (0.25 + 0.75 * Math.min(1, a * enc + flash)) * vaADN);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 7.5, 0, TAU);
      ctx.fill();
    }
  });
};

// ═══ BREAKDOWN · BÚSQUEDA (30-34 s): un árbol aleatorio de exploración rápida (RRT) crece como un árbol de luz desde
// donde caen los tres cuerpos hacia un objetivo, esquivando regiones prohibidas; las ramas brotan más con cada nota del
// arpegio y pulsos de luz las recorren. En el golpe de «buscar» el árbol encuentra el objetivo y el camino (podado y
// suavizado) se enciende en oro. Del camino salen los vértices del teseracto. Cámara viva: giro lento y acercamiento. ═══
type P2 = [number, number];
const RRT_S: P2 = [-0.7, 0.6];
const RRT_G: P2 = [0.66, -0.58];
const OBST: [number, number, number][] = [[-0.08, 0.08, 0.27], [0.42, 0.28, 0.19], [-0.45, -0.33, 0.21], [0.2, -0.3, 0.14], [-0.6, 0.12, 0.11], [0.62, -0.08, 0.1]];
const libre = (x: number, y: number) => x * x + y * y < 0.98 && OBST.every(([ox, oy, r]) => (x - ox) ** 2 + (y - oy) ** 2 > (r + 0.02) ** 2);
const segLibre = (a: P2, b: P2) => {
  for (let k = 0; k <= 8; k++) if (!libre(lerp(a[0], b[0], k / 8), lerp(a[1], b[1], k / 8))) return false;
  return true;
};
const RRT = (() => {
  const nodos: P2[] = [RRT_S];
  const padre: number[] = [-1];
  const PASO = 0.042;
  // exploración pura (sin sesgo al objetivo): el árbol llena el espacio libre; el objetivo es el nodo que lo alcanza
  for (let i = 1; nodos.length < 1500 && i < 40000; i++) {
    const ang = azar(i * 1.93 + 5) * TAU;
    const rr = Math.sqrt(azar(i * 7.31 + 2));
    const m: P2 = [Math.cos(ang) * rr, Math.sin(ang) * rr];
    let jb = 0;
    let db = Infinity;
    for (let j = 0; j < nodos.length; j++) {
      const dd = (nodos[j][0] - m[0]) ** 2 + (nodos[j][1] - m[1]) ** 2;
      if (dd < db) {
        db = dd;
        jb = j;
      }
    }
    const q = nodos[jb];
    const L = Math.sqrt(db);
    if (L < 1e-6) continue;
    const nuevo: P2 = L < PASO ? m : [q[0] + ((m[0] - q[0]) / L) * PASO, q[1] + ((m[1] - q[1]) / L) * PASO];
    if (!segLibre(q, nuevo)) continue;
    nodos.push(nuevo);
    padre.push(jb);
  }
  let meta = 0;
  for (let j = 0; j < nodos.length; j++) if (Math.hypot(nodos[j][0] - RRT_G[0], nodos[j][1] - RRT_G[1]) < Math.hypot(nodos[meta][0] - RRT_G[0], nodos[meta][1] - RRT_G[1])) meta = j;
  nodos.push(RRT_G);
  padre.push(meta);
  meta = nodos.length - 1;
  if (meta < 0) meta = nodos.length - 1;
  const crudo: number[] = [];
  for (let v = meta; v >= 0; v = padre[v]) crudo.unshift(v);
  // poda por línea de vista (no se usa: el camino conserva la forma de las ramas) y suavizado de Chaikin
  const poda: P2[] = [nodos[crudo[0]]];
  let i = 0;
  while (i < crudo.length - 1) {
    let j = crudo.length - 1;
    while (j > i + 1 && !segLibre(nodos[crudo[i]], nodos[crudo[j]])) j--;
    poda.push(nodos[crudo[j]]);
    i = j;
  }
  void poda;
  // el camino sigue las ramas del árbol (sin podar), suavizado
  let suave: P2[] = crudo.map((v) => nodos[v]);
  for (let it = 0; it < 3; it++) {
    const s: P2[] = [suave[0]];
    for (let k = 0; k < suave.length - 1; k++) {
      const a = suave[k];
      const b = suave[k + 1];
      s.push([lerp(a[0], b[0], 0.25), lerp(a[1], b[1], 0.25)], [lerp(a[0], b[0], 0.75), lerp(a[1], b[1], 0.75)]);
    }
    s.push(suave[suave.length - 1]);
    suave = s;
  }
  // profundidad de cada nodo (para los pulsos de luz)
  const prof = padre.map(() => 0);
  for (let v = 1; v < nodos.length; v++) prof[v] = prof[padre[v]] + 1;
  return { nodos, padre, meta, crudo, suave, prof, n: nodos.length };
})();
const T_CAMINO = T_BUSQ + 2.5;
const NOTAS_BUSQ = entre(NOTAS_ARP, T_BUSQ, T_CAMINO);
// cuántos nodos lleva el árbol: avance continuo más un brote en cada nota
const crecidos = (t: number) => {
  const lin = pr(t, T_BUSQ - 0.15, T_CAMINO - T_BUSQ - 0.05);
  const nt = pasos(NOTAS_BUSQ, T_BUSQ, t, 0.22) / Math.max(1, NOTAS_BUSQ.length);
  return RRT.n * cl(0.5 * lin + 0.5 * nt) ** 1.15;
};
const camBusq = (d: Disp, t: number) => ({
  rot: -0.12 + 0.07 * (t - T_BUSQ),
  esc: d.vis.r * 0.9 * (1 + 0.1 * eIO(pr(t, T_BUSQ - 0.6, 4.6))),
});
const enBusq = (d: Disp, p: P2, t: number): Pt => {
  const { rot, esc } = camBusq(d, t);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [d.vis.cx + (p[0] * c - p[1] * s) * esc, d.vis.cy - d.vis.r * 0.02 + (p[0] * s + p[1] * c) * esc];
};
const inicioBusq = (d: Disp, t: number) => enBusq(d, RRT_S, t);
const puntoCamino = (u: number): P2 => {
  const S2 = RRT.suave;
  const x = cl(u) * (S2.length - 1);
  const i = Math.min(S2.length - 2, Math.floor(x));
  return [lerp(S2[i][0], S2[i + 1][0], x - i), lerp(S2[i][1], S2[i + 1][1], x - i)];
};
const nodoCamino = (d: Disp, i: number, t = S("teseracto")): Pt => enBusq(d, puntoCamino(i / 15), t);
const busqueda = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_BUSQ - 0.6 || t > S("teseracto") + TR) return;
  const vis = eIO(pr(t, T_BUSQ - 0.6, 0.9)) * (1 - eExpo(pr(t, S("teseracto"), TR)));
  const n = crecidos(t);
  const nota = golpe(t, NOTAS_BUSQ, 6);
  const hallado = eOut(pr(t, T_CAMINO, 0.5));
  const { esc } = camBusq(d, t);
  const P = (p: P2) => enBusq(d, p, t);
  // regiones prohibidas: discos apenas insinuados
  luz(ctx, () => {
    for (const [ox, oy, r] of OBST) {
      const c = P([ox, oy]);
      ctx.strokeStyle = rgba(RGB.azul, 0.16 * vis);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.arc(c[0], c[1], r * esc, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  });
  // el árbol: ramas nuevas blancas y brillantes, las viejas se enfrían a azul
  const L = lote();
  const nn = Math.min(RRT.n, Math.ceil(n));
  for (let v = 1; v < nn; v++) {
    const k = cl(n - v);
    if (k <= 0) continue;
    const a = P(RRT.nodos[RRT.padre[v]]);
    const b = P(RRT.nodos[v]);
    const edad = (n - v) / Math.max(1, RRT.n * 0.18);
    const fresca = Math.exp(-edad * 3);
    const atenua = 1 - 0.3 * hallado;
    L.add(a[0], a[1], lerp(a[0], b[0], k), lerp(a[1], b[1], k), fresca > 0.3 ? RGB.hielo : RGB.azul, (0.34 + 0.6 * fresca + 0.25 * nota * fresca) * vis * atenua, 1.2 + 1.2 * fresca);
  }
  luz(ctx, () => L.draw(ctx, 1));
  // puntas que exploran
  for (let v = Math.max(1, nn - 22); v < nn; v++) {
    const p = P(RRT.nodos[v]);
    const f = 1 - (nn - v) / 22;
    chispa(ctx, p[0], p[1], 2 + 3 * f, RGB.blanco, f * vis * (1 - hallado));
  }
  // pulsos de luz que recorren ramas desde la raíz
  luz(ctx, () => {
    for (let q = 0; q < 46; q++) {
      const hoja = Math.floor(azar(q * 5.7 + 1) * Math.max(1, nn - 1));
      if (hoja <= 0 || RRT.prof[hoja] < 4) continue;
      const u = (azar(q * 2.3 + 9) + (t - T_BUSQ) * 0.8) % 1;
      let pasosAtras = Math.round((1 - u) * RRT.prof[hoja]);
      let v = hoja;
      while (pasosAtras-- > 0 && RRT.padre[v] >= 0) v = RRT.padre[v];
      const p = P(RRT.nodos[v]);
      brillo(ctx, p[0], p[1], 10, RGB.azul, 0.5 * vis * (1 - hallado));
      ctx.fillStyle = rgba(RGB.blanco, 0.8 * vis * (1 - hallado));
      ctx.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3);
    }
  });
  // el camino hallado, en oro, y una luz que lo recorre
  if (hallado > 0) {
    const m = Math.max(2, Math.round(RRT.suave.length * hallado));
    const pts = RRT.suave.slice(0, m).map((p) => P(p));
    luz(ctx, () => {
      trazo(ctx, pts, "255,214,170", vis * 0.35, 10);
      trazo(ctx, pts, "255,214,170", vis, 3);
    });
    const u = ((t - T_CAMINO) * 0.7) % 1;
    const c = P(puntoCamino(u));
    carga(ctx, c[0], c[1], 6 * vis * hallado, "255,226,190", vis * hallado, t);
  }
  // objetivo: una mira que respira con las notas
  const g = P(RRT_G);
  luz(ctx, () => {
    ctx.strokeStyle = rgba(hallado > 0 ? "255,214,170" : RGB.hielo, (0.45 + 0.35 * nota) * vis);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(g[0], g[1], 14, 0, TAU);
    ctx.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(g[0] + dx * 19, g[1] + dy * 19);
      ctx.lineTo(g[0] + dx * 26, g[1] + dy * 26);
      ctx.stroke();
    }
  });
  carga(ctx, g[0], g[1], 5 + 6 * hallado, hallado > 0 ? "255,214,170" : RGB.hielo, vis * (0.5 + 0.5 * hallado), t + 3);
  const s0 = P(RRT_S);
  carga(ctx, s0[0], s0[1], (6 + 3 * nota) * vis, RGB.hielo, vis, t);
};

// ═══ ACTO III · 2-3 · MANDELBROT Y JULIA (36-41,5 s): z ↦ z² + c, sin giro. Lógica de cortes de la v7d: en cada
// pulso (bombo) el zoom salta un escalón (corte seco) sobre un avance continuo, y cambia el modo de imagen: color pleno,
// solo dentro de la lente, o negativo plateado; cada palmada además corre la fase de la paleta. Coloreado: conteo
// suave en bandas ricas, promedio de franjas (stripe average) para el detalle fino, brillo del borde por estimación de
// distancia e interior con trampa de órbita. Zoom profundo al valle de los caballitos de mar, hasta la espiral. En el
// golpe de las 39,5 s el plano pasa a Julia; su c avanza un escalón por pulso. ═══
const T_JULIA = S("julia");
const C_ZOOM: [number, number] = [-0.743643887037151, 0.13182590420533];
const PALMAS_F = entre(PALMAS, T_MAND, T_LOR + 0.01);
const N_MAND = Math.round((T_JULIA - T_MAND) / PULSO); // 7 pulsos
const ANCHO0 = 0.03; // v1o: arranca ya dentro del valle de los caballitos de mar (sus espirales salen del fluido)
const LZ = Math.log(ANCHO0 / 6e-5);
const pulsoF = (t: number, t0: number) => Math.max(0, Math.floor((t - t0) / PULSO + 1e-6));
// zoom por escalones: 30 % continuo y 70 % en saltos en cada pulso
const anchoMandel = (t: number) => {
  const tau = cl(t - T_MAND, 0, T_JULIA - T_MAND);
  const k = Math.min(N_MAND, pulsoF(t, T_MAND));
  return ANCHO0 * Math.exp(-LZ * (0.3 * (tau / (T_JULIA - T_MAND)) + 0.7 * (k / N_MAND)));
};
// Julia: c = 0,7885·e^{iα}, un escalón por pulso más una deriva lenta
const pulsoJ = (t: number) => Math.min(2, pulsoF(t, T_JULIA));
const alfaJulia = (t: number) => 2.62 + 0.05 * (t - T_JULIA) + 0.11 * pulsoJ(t);
const anchoJulia = (t: number) => 3.1 * Math.exp(-0.18 * pulsoJ(t) - 0.05 * (t - T_JULIA));
// fase de la paleta: deriva lenta y un salto en cada palmada
// fase de la paleta: deriva lenta y un salto en cada palmada; en el plano final las palmadas la mueven con easing
// y la deriva es algo más rápida (la paleta fluye suave)
const T_PLANO = T_JULIA + 1.0;
const faseColor = (t: number) =>
  0.03 * (t - T_MAND) + 0.03 * Math.max(0, t - T_PLANO) + PALMAS_F.reduce((a, p) => a + (p < T_PLANO - 1e-6 ? (p <= t + 1e-6 ? 0.13 : 0) : 0.13 * eIO(pr(t, p, 0.7))), 0);
// Modo y paleta por pulso. Modo 0 = color pleno; 1 = solo dentro de la lente (fuera negro); 2 = duotono índigo y
// crema (el conjunto oscuro sobre luz). Después de las 40,5 s no hay más cortes: la lente se cierra en un punto.
type Paleta = [number, number, number, number][];
// azul y violeta con dorado
const AVO: Paleta = [
  [0.0, 0.03, 0.02, 0.1],
  [0.16, 0.2, 0.1, 0.42],
  [0.34, 0.36, 0.26, 0.82],
  [0.5, 0.3, 0.5, 0.95],
  [0.64, 0.95, 0.8, 0.5],
  [0.74, 1.0, 0.95, 0.84],
  [0.86, 0.42, 0.24, 0.58],
  [1.0, 0.03, 0.02, 0.1],
];
// turquesa y magenta con crema
const TMC: Paleta = [
  [0.0, 0.01, 0.05, 0.07],
  [0.18, 0.04, 0.32, 0.38],
  [0.36, 0.3, 0.78, 0.74],
  [0.52, 0.97, 0.93, 0.83],
  [0.68, 0.82, 0.32, 0.6],
  [0.84, 0.3, 0.07, 0.3],
  [1.0, 0.01, 0.05, 0.07],
];
// fuego ámbar con índigo
const FUEGO: Paleta = [
  [0.0, 0.04, 0.03, 0.16],
  [0.2, 0.18, 0.12, 0.44],
  [0.38, 0.62, 0.24, 0.16],
  [0.54, 0.97, 0.62, 0.26],
  [0.66, 1.0, 0.92, 0.74],
  [0.8, 0.5, 0.22, 0.32],
  [1.0, 0.04, 0.03, 0.16],
];
const PALETAS_F = [AVO, TMC, FUEGO];
// [modo, paleta] por pulso desde las 36 s (7 de Mandelbrot, 3 de Julia); el último corte es a las 40,5 s
const CORTES_F: [number, number][] = [[0, 0], [1, 1], [0, 2], [2, 0], [0, 1], [1, 2], [0, 0], [0, 1], [1, 0], [0, 2]];
const pulsoCorte = (t: number) => Math.min(CORTES_F.length - 1, pulsoF(t, T_MAND));
const modoFractal = (t: number) => CORTES_F[pulsoCorte(t)][0];
const paletaFractal = (t: number) => PALETAS_F[CORTES_F[pulsoCorte(t)][1]];
// centro del fractal: al cerrarse viaja al punto donde nace Lorenz (el centro del cuadro)
const T_CIERRE = T_LOR - 0.9; // v1o: después del plano final largo
const centroF = (d: Disp, t: number): Pt => {
  const k = eIO(pr(t, T_CIERRE, T_LOR - T_CIERRE));
  return [lerp(d.vis.cx, d.W / 2, k), lerp(d.vis.cy, d.H / 2, k)];
};
const suaveF = (x: number) => x * x * (3 - 2 * x);
const paletaF = (P: Paleta, u: number, out: number[]) => {
  u = ((u % 1) + 1) % 1;
  let i = 0;
  while (P[i + 1][0] < u) i++;
  const [a, r0, g0, b0] = P[i];
  const [b, r1, g1, b1] = P[i + 1];
  const f = suaveF((u - a) / (b - a));
  out[0] = r0 + (r1 - r0) * f;
  out[1] = g0 + (g1 - g0) * f;
  out[2] = b0 + (b1 - b0) * f;
};
// ventana: se abre en el drop y al final se cierra en un punto (sin cortes), desde el radio que cubre el cuadro
const ventanaFractal = (d: Disp, t: number) => {
  const [cx, cy] = centroF(d, t);
  const R = Math.hypot(Math.max(cx, d.W - cx), Math.max(cy, d.H - cy)) + 4;
  const abre = 1; // (v1o: no se abre: nace del fluido)
  // (1 − u)²: la lente se ve cerrarse durante unos 0,75 s y se desacelera al llegar al punto
  const u = pr(t, T_CIERRE, T_LOR - T_CIERRE);
  return R * abre * (1 - u) ** 2;
};
const radioLente = (d: Disp) => d.vis.r * 0.96;
const pintaFractal = (ctx: Ctx, d: Disp, t: number, julia: boolean, radio: number, nombre: string) => {
  const red = 2;
  const fw = Math.ceil(d.W / red);
  const fh = Math.ceil(d.H / red);
  const aux = auxiliar(fw, fh, nombre);
  const actx = aux.getContext("2d")!;
  const img = actx.createImageData(fw, fh);
  const modo = modoFractal(t);
  const al = alfaJulia(t);
  const jr = 0.7885 * Math.cos(al);
  const ji = 0.7885 * Math.sin(al);
  // plano final: caída lenta y continua hacia el punto fijo α de la Julia (una espiral), con una leve rotación
  const tp = Math.max(0, t - T_PLANO);
  const zf = julia ? Math.exp(-0.62 * tp) : 1;
  const w = (julia ? anchoJulia(t) : anchoMandel(t)) * zf;
  // (4:5: el ancho w ocupa el cuadro, 2,4 radios de la zona visual; en los otros formatos, los mismos 2,4 radios)
  const esc = w / (2.4 * d.vis.r);
  const rotF = julia ? 0.1 * tp * tp / (tp + 0.6) : 0;
  const cR = Math.cos(rotF);
  const sR = Math.sin(rotF);
  let zax = 0;
  let zay = 0;
  if (julia) {
    // z = (1 ± √(1 − 4c)) / 2: el de menor módulo
    const ar = 1 - 4 * jr;
    const ai = -4 * ji;
    const mg = Math.hypot(ar, ai);
    const sr = Math.sqrt((mg + ar) / 2);
    const si = Math.sign(ai) * Math.sqrt(Math.max(0, (mg - ar) / 2));
    const z1: [number, number] = [(1 - sr) / 2, -si / 2];
    const z2: [number, number] = [(1 + sr) / 2, si / 2];
    [zax, zay] = Math.hypot(z1[0], z1[1]) < Math.hypot(z2[0], z2[1]) ? z1 : z2;
  }
  // entrada: los remolinos del fluido se aquietan en las espirales del fractal
  const remolino = 1 - eIO(pr(t, T_MAND - 0.7, 1.7));
  const climax = 0.2 * eIO(pr(t, T_LOR - 1.4, 0.7)) * (1 - eIO(pr(t, T_LOR - 0.5, 0.4)));
  const maxIt = julia ? 260 : Math.round(200 + 120 * Math.log10(2.8 / w));
  const fase = faseColor(t);
  const P = paletaFractal(t);
  const neg = modo === 2;
  const [fcx, fcy] = centroF(d, t);
  const rv = Math.min(radio, modo === 1 ? radioLente(d) : radio);
  const px = img.data;
  const r2v = (rv / red) ** 2;
  const vcx = fcx / red;
  const vcy = fcy / red;
  const col = [0, 0, 0];
  const c0x = julia ? zax * (1 - zf) : C_ZOOM[0];
  const c0y = julia ? zay * (1 - zf) : C_ZOOM[1];
  const brilloF = (0.95 + 0.12 * golpe(t, BOMBOS, 5)) * (1 + climax); // la luz respira con el bombo; clímax suave al final
  for (let j = 0; j < fh; j++) {
    const yy = j * red - fcy;
    for (let i = 0; i < fw; i++) {
      const o = (j * fw + i) * 4;
      if ((i - vcx) ** 2 + (j - vcy) ** 2 > r2v) {
        px[o] = px[o + 1] = px[o + 2] = 0;
        px[o + 3] = 0;
        continue;
      }
      let xx = i * red - fcx;
      let yv = yy;
      if (remolino > 0.001) {
        const rr = Math.hypot(xx, yv);
        const an = remolino * 2.4 * Math.exp(-rr / 420);
        const ca = Math.cos(an);
        const sa = Math.sin(an);
        [xx, yv] = [xx * ca - yv * sa + remolino * 34 * Math.sin(yv * 0.011 + t * 1.7), xx * sa + yv * ca + remolino * 34 * Math.sin(xx * 0.013 - t * 1.3)];
      }
      if (rotF) [xx, yv] = [xx * cR - yv * sR, xx * sR + yv * cR];
      const pr0 = c0x + xx * esc;
      const pi0 = c0y - yv * esc;
      let zr = julia ? pr0 : 0;
      let zi = julia ? pi0 : 0;
      const cr = julia ? jr : pr0;
      const ci = julia ? ji : pi0;
      let dr = julia ? 1 : 0;
      let di = 0;
      let n = 0;
      let r2 = 0;
      let trap = 1e9;
      let trapP = 1e9;
      let st = 0;
      let stPrev = 0;
      if (!julia) {
        const q = (cr - 0.25) * (cr - 0.25) + ci * ci;
        if (q * (q + (cr - 0.25)) <= 0.25 * ci * ci || (cr + 1) * (cr + 1) + ci * ci <= 0.0625) n = maxIt;
      }
      while (n < maxIt) {
        const ndr = 2 * (zr * dr - zi * di) + (julia ? 0 : 1);
        di = 2 * (zr * di + zi * dr);
        dr = ndr;
        const nr = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = nr;
        r2 = zr * zr + zi * zi;
        if (r2 > 1e6) break;
        trap = Math.min(trap, Math.abs(r2 - 0.25));
        trapP = Math.min(trapP, Math.abs(zr) * Math.abs(zi));
        stPrev = st;
        st += 0.5 + 0.5 * Math.sin(5 * Math.atan2(zi, zr));
        n++;
      }
      let rr: number;
      let gg: number;
      let bb: number;
      if (n >= maxIt) {
        // interior con detalle: dos trampas de órbita (círculo y cruz)
        const k1 = Math.exp(-trap * 7);
        const k2 = Math.exp(-Math.sqrt(trapP) * 9);
        rr = 0.015 + 0.08 * k1 + 0.1 * k2;
        gg = 0.03 + 0.15 * k1 + 0.16 * k2;
        bb = 0.1 + 0.36 * k1 + 0.26 * k2;
      } else {
        const zl = Math.sqrt(r2);
        const lz = Math.log(zl);
        const fr = 1 + Math.log2(Math.log(1e3) / lz); // fracción para interpolar el promedio de franjas
        const nu = n + fr;
        const stA = n > 1 ? st / n : 0;
        const stB = n > 2 ? stPrev / (n - 1) : stA;
        const stripe = lerp(stB, stA, cl(fr));
        const dl = Math.hypot(dr, di) || 1e-20;
        const dpx = (0.5 * zl * lz) / dl / esc;
        paletaF(P, Math.log(nu + 1) * 0.3 + Math.sqrt(nu) * 0.11 + fase, col);
        const borde = Math.exp(-dpx * 0.4) * 0.5;
        const kS = cl((nu - 4) / 24);
        const luzS = 1 + kS * (0.55 * stripe - 0.25);
        const piso = 0.22 + 0.78 * Math.min(1, nu / 60);
        rr = col[0] * luzS * piso + borde * 0.85;
        gg = col[1] * luzS * piso + borde * 0.9;
        bb = col[2] * luzS * piso + borde;
      }
      if (neg) {
        // duotono: el conjunto en índigo sobre crema
        const l = Math.min(1, 0.3 * rr + 0.55 * gg + 0.15 * bb);
        rr = lerp(0.97, 0.12, l);
        gg = lerp(0.93, 0.1, l);
        bb = lerp(0.85, 0.3, l);
      }
      px[o] = 255 * Math.min(1, rr * brilloF);
      px[o + 1] = 255 * Math.min(1, gg * brilloF);
      px[o + 2] = 255 * Math.min(1, bb * brilloF);
      px[o + 3] = 255;
    }
  }
  actx.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(aux, 0, 0, fw * red, fh * red);
  ctx.restore();
  return { rv, modo };
};
// v1o · Fluido (36-38,4 s): del estallido del teseracto nace una tinta de color que se arremolina (shader en
// src/gl.ts) y se aquieta mientras el Mandelbrot aparece con sus mismas espirales
const fluido = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_FLU || t > T_MAND + 0.5) return;
  // la tinta crece hasta cubrir el cuadro: en 4:5 llega a 2,45 (la esquina más lejana queda a 2,4 radios); en los
  // otros formatos crece lo mismo en proporción hasta su esquina más lejana
  const escF = d.vis.r * 0.9;
  const esquina = Math.hypot(Math.max(d.vis.cx, d.W - d.vis.cx), Math.max(d.vis.cy, d.H - d.vis.cy)) / escF;
  const nace = 0.05 + 2.4 * Math.max(1, esquina / 2.395) * eOut(pr(t, T_FLU, 1.1));
  const calma = eIO(pr(t, T_MAND - 0.9, 1.2));
  const kicks = entre(BOMBOS, T_FLU, T_MAND);
  const c = pintarFluido(d.W, d.H, {
    t: 1.2 * (t - T_FLU) + 0.25 * pasos(kicks, T_FLU, t, 0.4),
    nace,
    calma,
    fase: 0.04 * (t - T_FLU),
    cx: d.vis.cx,
    cy: d.vis.cy,
    esc: escF,
  });
  if (!c) return;
  ctx.save();
  ctx.globalAlpha = 1 - eIO(pr(t, T_MAND - 0.1, 0.55));
  ctx.globalCompositeOperation = "lighter"; // fuera de la tinta el shader es negro: no tapa el estallido
  ctx.drawImage(c, 0, 0, d.W, d.H);
  ctx.restore();
};
const fractal = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_MAND - 0.7 || t >= T_LOR) return;
  const radio = ventanaFractal(d, t);
  if (radio >= 1) {
    // nace del fluido: entra con un fundido mientras sus remolinos se aquietan
    ctx.save();
    ctx.globalAlpha = eIO(pr(t, T_MAND - 0.7, 1.1));
    const { rv, modo } = pintaFractal(ctx, d, t, t >= T_JULIA, radio, t >= T_JULIA ? "mJ" : "mM");
    ctx.restore();
    // borde de la lente (en el modo lente y cuando la ventana se cierra)
    if (modo === 1 || rv < Math.hypot(d.W, d.H) * 0.98)
      luz(ctx, () => {
        ctx.strokeStyle = rgba(RGB.hielo, 0.6);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(centroF(d, t)[0], centroF(d, t)[1], rv, 0, TAU);
        ctx.stroke();
      });
  }
  if (t > T_LOR - 0.5) carga(ctx, d.W / 2, d.H / 2, 9, RGB.hielo, eIO(pr(t, T_LOR - 0.5, 0.5)) * (1 - eIO(pr(t, T_LOR, 0.5))), t);
};

// ═══ ACTO III · 5 · GRAY-SCOTT (68,5-70 s): patrones de Turing que nacen de la curva de Lorenz y crecen más en cada
// bombo (precalculado en herramientas/grayscott.py, cuadro a cuadro) ═══
export const N_GS = 76;
export const cuadroGS = (t: number) => {
  if (t < T_GS - 0.35 || t > T_RED + TR) return -1;
  return Math.min(N_GS - 1, Math.max(0, Math.round((t - T_GS) * 30)));
};
const grayScott = (ctx: Ctx, d: Disp, t: number, img: HTMLImageElement | null) => {
  if (cuadroGS(t) < 0 || !img || !img.complete || !img.naturalWidth) return;
  const vis = eIO(pr(t, T_GS - 0.35, 0.5)) * (1 - eIO(pr(t, T_RED - 0.3, 0.45))); // la arena de Chladni toma su lugar
  const k = golpe(t, BOMBOS, 6);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = vis * (0.45 + 0.05 * k);
  ctx.drawImage(img, 0, 0, d.W, d.H);
  // halo: la misma imagen, desenfocada
  ctx.filter = "blur(12px)";
  ctx.globalAlpha = vis * (0.14 + 0.04 * k);
  ctx.drawImage(img, 0, 0, d.W, d.H);
  ctx.restore();
};

// ═══ ACTO III · 7 · ADN (38-39,5 s): la hélice de partículas del motor GPU (teaser-cuerpo), turquesa, con
// profundidad de campo. Gira un paso con cada nota del arpegio, la cámara empuja en cada bombo y los pares de bases
// se encienden en las palmadas. Al final se recoge en el haz de luz que entra al prisma ═══
const T_ADN = S("adn");
const T_PRISMA = S("prisma");
const T_AUREA = S("aurea");
// La hélice se desenrolla: sus hebras convergen en el haz blanco, las partículas siguen fluyendo por él, el prisma se
// materializa a su alrededor y en el golpe el haz se abre en el espectro. Un solo espacio 3D y una cámara continua.
const T_DESENROLLA = T_PRISMA - 1.1;
const MIRA_ADN = [-4.475, -0.185, 0];
const MIRA_PRISMA = [0.9, -0.25, 0];
const camADN = (t: number) => {
  const u = eIO(pr(t, T_ADN, T_PRISMA - T_ADN));
  // mirando a lo largo del eje desde el extremo: la hélice se aleja en profundidad y la cámara entra en ella girando
  return { mira: MIRA_ADN, dist: lerp(5.8, 3.6, u), elev: lerp(0.34, 0.18, u), az: lerp(1.05, 0.55, u) };
};
const camPrisma = (t: number) => {
  const u = eIO(pr(t, T_PRISMA, T_AUREA - T_PRISMA));
  return { mira: MIRA_PRISMA, dist: 5.4 - 0.9 * u, elev: lerp(0.18, 0.4, u), az: -0.35 + 0.16 * Math.max(0, t - T_PRISMA) };
};
const adnPrisma = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_ADN || t >= T_AUREA + 0.4) return;
  const lt = t - T_ADN;
  const k = eIO(pr(t, T_DESENROLLA, 1.35)); // cámara de la hélice → cámara del prisma
  const A = camADN(t);
  const B = camPrisma(t);
  const mira = [0, 1, 2].map((i) => lerp(A.mira[i], B.mira[i], k));
  const dist = lerp(A.dist, B.dist, k);
  const kicks = entre(BOMBOS, T_ADN, T_AUREA);
  const notas = entre(NOTAS_ARP, T_PRISMA, T_AUREA);
  const sale = 1 - eIO(pr(t, T_AUREA - 0.25, 0.65));
  const tf = Math.max(0, t - T_DESENROLLA);
  const c = pintarADNPrisma(d.W, d.H, {
    mira,
    dist,
    elev: lerp(A.elev, B.elev, k),
    az: lerp(A.az, B.az, k),
    foco: dist,
    giro: 1.3 * lt + 0.2 * pasos(NOTAS_ARP, T_ADN, t, 0.3),
    brillo: (1 + 0.2 * golpe(t, kicks, 6)) * eIO(pr(t, T_ADN, 0.5)), // (v1m: entra mientras la arena se vuelve hélice)
    palma: golpe(t, entre(PALMAS, T_ADN, T_DESENROLLA), 5),
    radio: 1 - eIO(pr(t, T_DESENROLLA, 0.85)),
    senal: -4 + ((0.42 * pasos(NOTAS_ARP, T_ADN, t, 0.25)) % 8),
    flujo: 0.09 * tf * tf + 0.05 * tf,
    blanco: eIO(pr(t, T_DESENROLLA + 0.2, 0.7)),
    alfaADN: lerp(1, 0.35, eIO(pr(t, T_PRISMA, 1.0))) * sale,
    haz: eIO(pr(t, T_DESENROLLA + 0.45, 0.6)) * (0.72 + 0.2 * golpe(t, notas, 8)) * sale,
    fan: eIO(pr(t, T_PRISMA, 0.6)) * (1 + 0.04 * golpe(t, notas, 8)),
    vidrio: eIO(pr(t, T_DESENROLLA + 0.5, 0.6)) * sale,
  });
  if (!c) return;
  // atmósfera turquesa de la hélice, que se apaga cuando la hélice se vuelve luz
  const vn = eIO(pr(t, T_ADN - 0.2, 0.7)) * (1 - eIO(pr(t, T_DESENROLLA, 0.9)));
  if (vn > 0.01) {
    const neb = ctx.createRadialGradient(d.vis.cx, d.vis.cy, 0, d.vis.cx, d.vis.cy, d.H * 0.7);
    neb.addColorStop(0, rgba("10,70,70", 0.55 * vn));
    neb.addColorStop(0.6, rgba("4,30,40", 0.35 * vn));
    neb.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, d.W, d.H);
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(c, 0, 0, d.W, d.H);
  const halo = 1 - 0.6 * k;
  ctx.globalAlpha = halo;
  ctx.filter = "blur(7px)";
  ctx.drawImage(c, 0, 0, d.W, d.H);
  ctx.filter = "blur(18px)";
  ctx.globalAlpha = 0.6 * halo;
  ctx.drawImage(c, 0, 0, d.W, d.H);
  ctx.restore();
};

// ═══ ACTO III · 8 · PATRONES ÁUREOS (59-66 s) ═══
// Fibonacci: un cuadrado por corchea del arpegio y la espiral dibujándose en paralelo, mientras la cámara retrocede y
// revela la escala. Luego el girasol (modelo de Vogel: semilla k en r = c√k, θ = k·137,508°; nacen con el arpegio y
// dibujan las espirales 21/34/55) y la concha del nautilus (espiral logarítmica con sus cámaras, una por nota), que al
// final se hunde en su centro: el punto del silencio.
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
const CUADROS = (() => {
  let minx = 0;
  let miny = 0;
  let maxx = 1;
  let maxy = 1;
  const out: { x: number; y: number; s: number; k: number }[] = [{ x: 0, y: 0, s: 1, k: 0 }];
  for (let i = 1; i < FIB.length; i++) {
    const s = FIB[i];
    const k = i % 4;
    let x: number;
    let y: number;
    if (k === 1) [x, y] = [maxx, miny];
    else if (k === 2) [x, y] = [maxx - s, maxy];
    else if (k === 3) [x, y] = [minx - s, maxy - s];
    else [x, y] = [minx, miny - s];
    out.push({ x, y, s, k });
    minx = Math.min(minx, x);
    miny = Math.min(miny, y);
    maxx = Math.max(maxx, x + s);
    maxy = Math.max(maxy, y + s);
  }
  return { out, cx: (minx + maxx) / 2, cy: (miny + maxy) / 2 };
})();
// Centro y ángulo inicial del cuarto de círculo de cada cuadrado.
const arcoDe = (i: number): [number, number, number] => {
  const { x, y, s, k } = CUADROS.out[i];
  if (i === 0) return [x + s, y + s, Math.PI];
  if (k === 1) return [x, y + s, -Math.PI / 2];
  if (k === 2) return [x, y, 0];
  if (k === 3) return [x + s, y, Math.PI / 2];
  return [x + s, y + s, Math.PI];
};
const T_GIR = S("girasol");
const T_NAU = S("nautilus");
const NOTAS_FIB = entre(NOTAS_ARP, T_AUREA, T_GIR).filter((_, i) => i % 2 === 0).slice(0, 10);
const cajaHasta = (n: number) => {
  // caja de los primeros n cuadrados (n continuo: se interpola entre cajas enteras)
  const caja = (m: number) => {
    let x0 = 0, y0 = 0, x1 = 1, y1 = 1;
    for (let i = 0; i < Math.max(1, m); i++) {
      const c = CUADROS.out[i];
      x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.s); y1 = Math.max(y1, c.y + c.s);
    }
    return [x0, y0, x1, y1];
  };
  const a = caja(Math.floor(n));
  const b = caja(Math.min(CUADROS.out.length, Math.floor(n) + 1));
  const f = eIO(n - Math.floor(n));
  return a.map((v, i) => lerp(v, b[i], f));
};
// Marco de la figura de Fibonacci en el tiempo t: la cámara encuadra los cuadrados que ya nacieron (retrocede), la
// figura gira lento y al final la cámara se acerca mientras los cuadrados se disuelven en las semillas del girasol.
const marcoFib = (d: Disp, t: number) => {
  const n = 1 + pasos(NOTAS_FIB, T_AUREA - 0.01, t, 0.3);
  const [x0, y0, x1, y1] = cajaHasta(Math.min(10, n + 0.6));
  const e = Math.min((d.vis.r * 1.8) / (x1 - x0), (d.vis.r * 1.8) / (y1 - y0)) * lerp(1, 1.35, eIO(pr(t, T_GIR - 0.6, 1.2)));
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const rot = 0.12 * (t - T_AUREA);
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const P = (x: number, y: number): Pt => {
    const ux = (x - mx) * e;
    const uy = (y - my) * e;
    return [d.vis.cx + ux * c - uy * sn, d.vis.cy + ux * sn + uy * c];
  };
  return { n, P, e };
};
const nacFib = (i: number) => (i === 0 ? T_AUREA - 0.01 : NOTAS_FIB[i - 1] ?? T_GIR);
const aurea = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_AUREA - 0.3 || t >= T_GIR + 0.8) return;
  const { n, P, e } = marcoFib(d, t);
  const vis = eIO(pr(t, T_AUREA - 0.3, 0.6));
  const disuelve = eIO(pr(t, T_GIR - 0.5, 1.0)); // los cuadrados se vuelven semillas
  const va = vis * (1 - disuelve);
  // fondo que cambia de tono con cada cuadrado: azul profundo → violeta tenue → dorado tenue
  const f = cl((n - 1) / 9);
  const c1 = f < 0.5 ? [lerp(8, 30, f * 2), lerp(14, 18, f * 2), lerp(42, 54, f * 2)] : [lerp(30, 48, f * 2 - 1), lerp(18, 34, f * 2 - 1), lerp(54, 22, f * 2 - 1)];
  const fondo = ctx.createRadialGradient(d.vis.cx, d.vis.cy, 0, d.vis.cx, d.vis.cy, d.H * 0.75);
  const vf = vis * (1 - eIO(pr(t, T_NAU - 0.4, 1.2)));
  fondo.addColorStop(0, rgba(c1.map(Math.round).join(","), 0.85 * vf));
  fondo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, d.W, d.H);
  if (va <= 0.01) return;
  const L = lote();
  luz(ctx, () => {
    CUADROS.out.forEach((c, i) => {
      const a = cl(n - i);
      if (a <= 0) return;
      const A = P(c.x, c.y);
      const B = P(c.x + c.s * a, c.y);
      const C = P(c.x, c.y + c.s * a);
      const D = P(c.x + c.s, c.y);
      const E = P(c.x + c.s, c.y + c.s * a);
      const F = P(c.x, c.y + c.s);
      const G = P(c.x + c.s * a, c.y + c.s);
      const al = 0.34 * va;
      L.add(A[0], A[1], B[0], B[1], RGB.hielo, al, 1.4);
      L.add(A[0], A[1], C[0], C[1], RGB.hielo, al, 1.4);
      L.add(D[0], D[1], E[0], E[1], RGB.hielo, al, 1.4);
      L.add(F[0], F[1], G[0], G[1], RGB.hielo, al, 1.4);
      // arco secundario (el otro cuarto de círculo), tenue
      const [qx, qy, a0] = arcoDe(i);
      const sec: Pt[] = [];
      for (let q = 0; q <= 16; q++) {
        const an = a0 + Math.PI + (Math.PI / 2) * a * (q / 16);
        sec.push(P(qx + c.s * Math.cos(an), qy + c.s * Math.sin(an)));
      }
      linea(ctx, sec, "190,170,255", 0.18 * va * a, 1);
      // luces en las esquinas al nacer el cuadrado
      const nac = golpe(t, [nacFib(i)], 5);
      for (const K of [A, D, P(c.x + c.s, c.y + c.s), F]) chispa(ctx, K[0], K[1], 1.8 + 2.4 * nac, "255,226,180", (0.35 + 0.65 * nac) * va * a);
    });
    L.draw(ctx, 0.5);
    const arco: Pt[] = [];
    CUADROS.out.forEach((c, i) => {
      const a = cl(n - i);
      if (a <= 0) return;
      const [qx, qy, a0] = arcoDe(i);
      for (let q = 0; q <= 24; q++) {
        const an = a0 + (Math.PI / 2) * a * (q / 24);
        arco.push(P(qx + c.s * Math.cos(an), qy + c.s * Math.sin(an)));
      }
    });
    if (arco.length > 1) {
      linea(ctx, arco, "255,190,110", 0.14 * va, 26);
      trazo(ctx, arco, "255,214,170", 0.95 * va, 3);
      const [hx, hy] = arco[arco.length - 1];
      carga(ctx, hx, hy, 6 + 3 * golpe(t, NOTAS_FIB, 8), "255,230,200", va, t);
    }
  });
  // el número de cada cuadrado nace con su nota y se desvanece (tipografía mono fina)
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  CUADROS.out.forEach((c, i) => {
    const tn = nacFib(i);
    const a = eIO(pr(t, tn, 0.15)) * (1 - eIO(pr(t, tn + 0.55, 0.5))) * va;
    if (a <= 0.01) return;
    const [x, y] = P(c.x + c.s / 2, c.y + c.s / 2);
    const tam = Math.max(16, Math.min(46, c.s * e * 0.28));
    ctx.font = `400 ${tam}px "IBM Plex Mono"`;
    ctx.fillStyle = rgba("244,236,220", 0.85 * a);
    ctx.fillText(String(FIB[i]), x, y);
  });
  // contador discreto: aₙ₊₁/aₙ → φ
  const m = Math.max(1, Math.min(FIB.length - 1, Math.floor(n) - 1));
  const r = FIB[m] / FIB[m - 1];
  const ac = eIO(pr(t, T_AUREA + 0.3, 0.5)) * va;
  if (ac > 0.01) {
    const y = d.H - 175;
    ctx.font = `400 26px "IBM Plex Mono"`;
    ctx.fillStyle = rgba("214,222,240", 0.75 * ac);
    ctx.fillText(`${FIB[m]} / ${FIB[m - 1]} = ${r.toFixed(4).replace(".", ",")}`, d.W / 2, y);
    ctx.font = `400 18px "IBM Plex Mono"`;
    ctx.fillStyle = rgba("255,214,160", 0.6 * ac);
    ctx.fillText("→ φ = 1,6180…", d.W / 2, y + 36);
  }
  ctx.restore();
  void SS;
};
const N_SEM = 1100;
const NOTAS_GIR = entre(NOTAS_ARP, T_GIR - 0.3, T_NAU - 0.2);
const semilla = (d: Disp, k: number, rot: number): Pt => {
  const c = (d.vis.r * 0.92) / Math.sqrt(N_SEM);
  const r = c * Math.sqrt(k + 0.5);
  const th = k * 2.399963 + rot;
  return [d.vis.cx + r * Math.cos(th), d.vis.cy + r * Math.sin(th)];
};
// espiral del nautilus: r = a·e^{bθ}
const B_NAU = 0.1759;
const TH_NAU = 4.2 * Math.PI;
const espNau = (d: Disp, th: number, rot: number): Pt => {
  const a = (d.vis.r * 0.9) / Math.exp(B_NAU * TH_NAU);
  const r = a * Math.exp(B_NAU * th);
  return [d.vis.cx + r * Math.cos(th + rot), d.vis.cy + r * Math.sin(th + rot) * 0.98];
};
// punto de origen de cada semilla: un punto sobre el borde de un cuadrado de Fibonacci (en el marco de t)
const origenSemilla = (d: Disp, k: number, t: number): Pt => {
  const { P } = marcoFib(d, t);
  const i = Math.min(9, Math.floor(Math.sqrt(azar(k * 1.7)) * 10));
  const c = CUADROS.out[i];
  const u = azar(k * 3.1) * 4;
  const lado = Math.floor(u);
  const f = u - lado;
  const [x, y] = lado === 0 ? [c.x + c.s * f, c.y] : lado === 1 ? [c.x + c.s, c.y + c.s * f] : lado === 2 ? [c.x + c.s * (1 - f), c.y + c.s] : [c.x, c.y + c.s * (1 - f)];
  return P(x, y);
};
const girasol = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_GIR - 0.6 || t >= T_NAU + 0.6) return;
  const rot = 0.18 * (t - T_GIR);
  const aNau = eIO(pr(t, T_NAU - 0.25, 0.7)); // las semillas se enrollan en la espiral del nautilus
  const vis = 1 - eIO(pr(t, T_NAU + 0.1, 0.5));
  const late = golpe(t, NOTAS_GIR, 9);
  const L = lote();
  for (let k = 0; k < N_SEM; k++) {
    const m = eIO(pr(t, T_GIR - 0.55 + 0.45 * (k / N_SEM) + 0.15 * azar(k * 5.3), 0.75));
    if (m <= 0.002) continue;
    let [x, y] = semilla(d, k, rot);
    if (m < 1) {
      const o = origenSemilla(d, k, t);
      x = lerp(o[0], x, m);
      y = lerp(o[1], y, m);
    }
    if (aNau > 0) {
      const q = espNau(d, (k / N_SEM) * TH_NAU, 0.18 * (t - T_GIR));
      x = lerp(x, q[0], aNau);
      y = lerp(y, q[1], aNau);
    }
    const u = k / N_SEM;
    const rgb = u < 0.25 ? "255,214,160" : u < 0.6 ? "255,236,214" : "190,210,255";
    L.add(x, y, x + 0.1, y, rgb, (0.5 + 0.4 * m) * vis, (1.6 + 3.2 * Math.sqrt(u)) * (0.6 + 0.4 * m) * (1 + 0.15 * late));
  }
  luz(ctx, () => L.draw(ctx, 0.45));
  const kp = eIO(pr(t, T_GIR + 0.7, 0.6)) * (1 - aNau) * vis;
  if (kp > 0.01)
    luz(ctx, () => {
      for (const fam of [21, 34]) {
        for (let s0 = 0; s0 < fam; s0++) {
          const pts: Pt[] = [];
          for (let k = s0; k < N_SEM; k += fam) pts.push(semilla(d, k, rot));
          if (pts.length > 1) linea(ctx, pts, fam === 21 ? "255,200,140" : "150,180,255", 0.16 * kp, 1.2);
        }
      }
    });
};
// Tabiques al ritmo del redoble de la canción («tamboresNautilus», herramientas/tambores_nautilus.py), en orden: cada
// golpe pone el tabique siguiente, junto al anterior, desde el primer giro hacia la punta y repartidos parejo por la
// concha. La concha sigue la curva de crecimiento de la aprobada, avanzando a saltos con los golpes (en 0,1 s recorre lo
// que antes crecía hasta el golpe siguiente), y se adelanta lo necesario para que el tabique nuevo tenga dónde caer.
const TAMB_NAU = ((RITMO as unknown as { tamboresNautilus?: { t: number; v: number }[] }).tamboresNautilus ?? []).slice().sort((a, b) => a.t - b.t);
const T_LLENA = T_NAU - 0.2 + 1.3;
const creceNau = (t: number) => eIO(pr(t, T_NAU - 0.2, 1.3));
const TH_MIN = TAU + 0.15;
const TABIQUES = (() => {
  const n = TAMB_NAU.length;
  const tab = TAMB_NAU.map((g, k) => ({ ...g, th: TH_MIN + (n > 1 ? (k / (n - 1)) * (TH_NAU - 0.1 - TH_MIN) : 0) }));
  const G = TAMB_NAU.filter((g) => g.t < T_LLENA);
  const sig = G.map((g, k) => G[k + 1]?.t ?? T_LLENA);
  return { G, sig, tab };
})();
// Tiempo escalonado: avanza a saltos con cada golpe (ataque de 0,1 s) y entre golpes queda quieto.
const tNau = (t: number) => {
  const { G, sig } = TABIQUES;
  if (!G.length || t < G[0].t) return t;
  let k = 0;
  while (k + 1 < G.length && G[k + 1].t <= t) k++;
  return t >= T_LLENA ? t : G[k].t + (sig[k] - G[k].t) * eOut(pr(t, G[k].t, 0.1));
};
// Punta mínima: el último tabique puesto más un margen, con el mismo ataque de 0,1 s.
const frenteNau = (t: number) => {
  const { tab } = TABIQUES;
  let k = -1;
  while (k + 1 < tab.length && tab[k + 1].t <= t) k++;
  if (k < 0) return 0;
  const prev = k > 0 ? tab[k - 1].th : tab[0].th - 0.3;
  return prev + (tab[k].th - prev) * eOut(pr(t, tab[k].t, 0.1)) + 0.14;
};
const nautilus = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_NAU - 0.3 || t >= T_SIL + 0.3) return;
  const rot = 0.18 * (t - T_GIR);
  const crece = Math.min(1, Math.max(creceNau(tNau(t)), frenteNau(t) / TH_NAU));
  const flPunta = TABIQUES.tab.reduce((m, g) => (t >= g.t ? Math.max(m, g.v * Math.exp(-(t - g.t) * 9)) : m), 0);
  const destello = TABIQUES.tab.reduce((m, g) => (t >= g.t ? Math.max(m, g.v * Math.exp(-(t - g.t) * 7)) : m), 0);
  // v1m: la cámara se hunde siguiendo la curva hacia el ojo de la espiral (zoom y giro centrados en el ojo) y el ojo
  // viaja al centro de la zona visual: es la misma estrella que queda en el silencio
  const hunde = eIO(pr(t, T_SIL - 1.3, 1.3));
  const zoom = Math.exp(3.0 * hunde);
  const vis = 1 - eIO(pr(t, T_SIL - 0.45, 0.5));
  const th1 = TH_NAU * crece;
  const ojo0 = espNau(d, 0, rot);
  const viaja = eIO(pr(t, T_SIL - 1.1, 1.1));
  const cO: Pt = [lerp(ojo0[0], d.vis.cx, viaja), lerp(ojo0[1], d.vis.cy, viaja)];
  const giroC = -1.1 * hunde;
  const cg = Math.cos(giroC);
  const sg = Math.sin(giroC);
  const Z = (p: Pt): Pt => {
    const x = (p[0] - ojo0[0]) * zoom;
    const y = (p[1] - ojo0[1]) * zoom;
    return [cO[0] + x * cg - y * sg, cO[1] + x * sg + y * cg];
  };
  const pared: Pt[] = [];
  const interior: Pt[] = [];
  for (let i = 0; i <= 260; i++) {
    const th = (i / 260) * th1;
    pared.push(Z(espNau(d, th, rot)));
    if (th > TAU) interior.push(Z(espNau(d, th - TAU, rot)));
  }
  luz(ctx, () => {
    linea(ctx, pared, "255,200,140", (0.12 + 0.1 * destello) * vis, 24);
    trazo(ctx, pared, "255,226,190", Math.min(1, 0.9 + 0.1 * destello) * vis, 2.6);
    // la punta que crece destella en cada golpe del crecimiento
    if (flPunta > 0.02) {
      const pu = pared[pared.length - 1];
      brillo(ctx, pu[0], pu[1], 60, "255,220,180", 0.35 * flPunta * vis);
    }
    if (interior.length > 1) trazo(ctx, interior, "255,226,190", 0.45 * vis, 1.6);
    // cámaras: un tabique por golpe de tambor, del giro anterior al actual (o hacia el ojo en el primer giro),
    // levemente curvo
    for (const g of TABIQUES.tab) {
      if (t < g.t || g.th > th1 + 1e-3) continue;
      const al = eOut(pr(t, g.t + 0.04, 0.06));
      const fl = g.v * Math.exp(-(t - g.t) * 7);
      const a = Z(espNau(d, g.th, rot));
      const b = Z(espNau(d, Math.max(0, g.th - TAU), rot));
      const mid: Pt = [(a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.12, (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.12];
      const pts: Pt[] = [];
      for (let q = 0; q <= 12; q++) {
        const u = q / 12;
        pts.push([(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * mid[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * mid[1] + u * u * b[1]]);
      }
      if (fl > 0.02) linea(ctx, pts, "150,185,255", 0.3 * fl * vis, 12);
      trazo(ctx, pts, "170,195,255", Math.min(1, 0.7 + 0.3 * fl) * al * vis, 1.4 + 1.6 * fl);
    }
  });
  if (t >= T_SIL) return; // desde aquí la misma estrella la dibuja el silencio, en el mismo lugar y con el mismo tamaño
  const ojo = Z(espNau(d, 0, rot));
  const llega = eIn(pr(t, T_SIL - 0.85, 0.85));
  brillo(ctx, ojo[0], ojo[1], 520, RGB.azul, 0.12 * 1.6 * llega);
  carga(ctx, ojo[0], ojo[1], 5 + 7 * llega, "255,236,214", eIO(pr(t, T_NAU, 0.5)), t);
};
// ═══ SILENCIO (77-78 s) Y DROP DEL «TÚ» (78-80 s): queda un punto de luz, el mismo del prólogo; en el drop estalla ═══
const T_SIL = S("silencio");
const T_TU = S("tu");
const T_FIN = S("final");
const silencio = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_SIL || t >= T_TU) return;
  const nota = golpe(t, [T_SIL], 1.8);
  brillo(ctx, d.vis.cx, d.vis.cy, 520, RGB.azul, 0.12 * (0.6 + nota));
  carga(ctx, d.vis.cx, d.vis.cy, 8 + 4 * nota + 4 * eIn(pr(t, T_TU - 0.6, 0.6)), "255,236,214", 1, t);
};
const N_ESTALLIDO = 2600;
const estallido = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_TU || t >= T_FIN + 1.45) return;
  const tau = t - T_TU;
  const sale = 1 - eIO(pr(t, T_FIN - 0.3, 1.0)); // la nube del estallido se deja ver mientras nacen los epiciclos
  const L = lote();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const kick = golpe(t, BOMBOS, 7);
  for (let i = 0; i < N_ESTALLIDO; i++) {
    const an = azar(i * 1.37) * TAU;
    const v = 1400 * Math.pow(azar(i * 2.11), 1.8) + 80;
    const kd = lerp(2.2, 3.4, azar(i * 3.7));
    const r = (v * (1 - Math.exp(-kd * tau))) / kd;
    const giro = 0.25 * (1 - Math.exp(-tau * 1.5)) * (azar(i * 5.1) - 0.3);
    const x = d.vis.cx + r * Math.cos(an + giro);
    const y = d.vis.cy + r * Math.sin(an + giro) * 0.92;
    // estela corta en la dirección del movimiento
    const r0 = (v * (1 - Math.exp(-kd * Math.max(0, tau - 0.03)))) / kd;
    const x0 = d.vis.cx + r0 * Math.cos(an + giro);
    const y0 = d.vis.cy + r0 * Math.sin(an + giro) * 0.92;
    const a = (0.35 + 0.65 * azar(i * 7.3)) * Math.exp(-tau * 0.35) * sale * (1 + 0.5 * kick);
    const rgb = i % 7 === 0 ? "255,214,170" : i % 3 === 0 ? RGB.azul : "220,230,255";
    L.add(x0, y0, x, y, rgb, Math.min(1, a), i % 11 === 0 ? 2.4 : 1.4);
  }
  ctx.restore();
  luz(ctx, () => L.draw(ctx, 0.8));
  // onda de choque y el núcleo que se apaga
  const ch = golpe(t, [T_TU], 1.4);
  luz(ctx, () => {
    ctx.beginPath();
    ctx.arc(d.vis.cx, d.vis.cy, 30 + tau * 1100, 0, TAU);
    ctx.strokeStyle = rgba(RGB.hielo, 0.5 * ch * sale);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = rgba(RGB.azul, 0.18 * ch * sale);
    ctx.lineWidth = 26;
    ctx.stroke();
  });
  brillo(ctx, d.vis.cx, d.vis.cy, 700, "120,160,255", 0.35 * golpe(t, [T_TU], 2.2));
  // puente al final: la nube se recoge en un resplandor donde nacerá la marca
  const puente = eIO(pr(t, T_FIN - 0.7, 0.7)) * (1 - eIO(pr(t, T_FIN + 0.6, 0.8)));
  if (puente > 0.01) {
    brillo(ctx, d.logo.cx, d.logo.cy, 460, "70,110,255", 0.5 * puente);
    brillo(ctx, d.logo.cx, d.logo.cy, 180, "170,200,255", 0.45 * puente);
  }
  carga(ctx, d.vis.cx, d.vis.cy, 14 * golpe(t, [T_TU], 3), "255,240,220", sale, t);
};
// ═══ Capas de ritmo (lenguaje audiovisual común) ═══
// Bombo → anillo que se expande desde el centro y empuja la grilla de puntos. Hi-hat → puntos que titilan.
// Arpegio → una nota es un punto que aparece sobre una Lissajous 3:2 grande; la altura fija el radio.
export const grilla = (ctx: Ctx, d: Disp, t: number, a: number) => {
  if (a <= 0.01) return;
  const paso = d.fmt === "horizontal" ? 60 : 54;
  const { cx, cy } = d.vis;
  // último bombo
  let tk = -1;
  for (let i = BOMBOS.length - 1; i >= 0; i--)
    if (BOMBOS[i] <= t) {
      tk = BOMBOS[i];
      break;
    }
  const dt = tk < 0 ? 99 : t - tk;
  const frente = dt * 1500;
  const caida = Math.exp(-dt * 2.2);
  ctx.fillStyle = rgba(RGB.hielo, 0.07 * a);
  const cols = Math.ceil(d.W / paso) + 1;
  const filas = Math.ceil(d.H / paso) + 1;
  for (let j = 0; j < filas; j++)
    for (let i = 0; i < cols; i++) {
      let x = i * paso + (d.W % paso) / 2;
      let y = j * paso + (d.H % paso) / 2;
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy) || 1;
      const emp = 9 * Math.exp(-(((r - frente) / 50) ** 2)) * caida;
      x += (dx / r) * emp;
      y += (dy / r) * emp;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  if (dt < 1.2) {
    ctx.strokeStyle = rgba(RGB.hielo, 0.12 * caida * a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, frente, 0, TAU);
    ctx.stroke();
  }
  // hi-hats
  for (let h = HATS.length - 1; h >= 0; h--) {
    const th = HATS[h];
    if (th > t) continue;
    const e = t - th;
    if (e > 0.18) break;
    for (let q = 0; q < 5; q++) {
      const i = Math.floor(azar(h * 11 + q) * cols);
      const j = Math.floor(azar(h * 7 + q + 0.5) * filas);
      chispa(ctx, i * paso + (d.W % paso) / 2, j * paso + (d.H % paso) / 2, 1.3, RGB.hielo, 0.7 * Math.exp(-e * 18) * a);
    }
  }
  // arpegio
  const Rl = Math.min(d.W, d.H) * 0.47;
  for (let n = ARPEGIO.length - 1; n >= 0; n--) {
    const [ta, nota] = ARPEGIO[n];
    if (ta > t) continue;
    const e = t - ta;
    if (e > 0.7) break;
    const s = ta * 1.3;
    const rr = Rl * lerp(0.86, 1.04, cl((nota - 62) / 28));
    const x = d.vis.cx + rr * Math.sin(3 * s + Math.PI / 2);
    const y = d.vis.cy + rr * Math.sin(2 * s) * (d.fmt === "horizontal" ? 0.9 : 1);
    chispa(ctx, x, y, 1.8, nota > 80 ? RGB.blanco : RGB.azul, 0.55 * Math.exp(-e * 5) * a);
  }
};
// Riser → la cámara acelera hacia adelante: estrellas que se estiran desde el centro.
const ESTRELLAS = Array.from({ length: 260 }, (_, i) => ({ x: azar(i * 1.3) * 2 - 1, y: azar(i * 2.7 + 4) * 2 - 1, z: azar(i * 5.1 + 9) }));
export const warp = (ctx: Ctx, d: Disp, t: number) => {
  for (const r of RITMO.risers) {
    if (r.t0 >= S("final") || t < r.t0 || t >= r.t1) continue;
    const T = r.t1 - r.t0;
    const tau = t - r.t0;
    const u = cl(tau / T);
    const recorrido = 0.15 * tau + (1.6 * tau ** 3) / (3 * T * T);
    const vel = 0.15 + 1.6 * u * u;
    const sale = 1 - pr(t, r.t1, 0.1);
    const { cx, cy } = d.vis;
    const F = Math.max(d.W, d.H) * 0.5;
    luz(ctx, () => {
      ESTRELLAS.forEach((e, i) => {
        const z = 1 - ((((e.z + recorrido) % 1) + 1) % 1);
        const z2 = Math.max(0.02, z + vel * 0.05);
        const x1 = cx + (e.x / z) * F * 0.5;
        const y1 = cy + (e.y / z) * F * 0.5;
        const x0 = cx + (e.x / z2) * F * 0.5;
        const y0 = cy + (e.y / z2) * F * 0.5;
        const a = cl((1 - z) * 1.4) * (0.25 + 0.75 * u) * sale;
        linea(ctx, [[x0, y0], [x1, y1]], i % 5 ? RGB.hielo : RGB.azul, a * 0.8, 1 + u);
      });
    });
  }
};


// ═══ Cargas del final (src/final.ts): a ±400·s px del centro, a la altura de las cargas de la foto de perfil ═══
export const posCargas = (d: Disp): [Pt, Pt] => [
  [d.W / 2 - 400 * d.logo.s, d.cargasY],
  [d.W / 2 + 400 * d.logo.s, d.cargasY],
];

// ═══ Guion: tres frases con el sistema de títulos de la v2 (src/rotulos.ts). Las líneas finas (300) entran en
// rebanadas; la palabra clave (700, azul, a todo el ancho) se arma con tramos que salen de la geometría de su escena
// (en el lienzo, con brillo) y se decodifica en la capa nítida, resuelta justo en su golpe. Debajo, una anotación
// técnica mono de lo que se ve. Sin HUD de esquinas. ═══
const BL = RGB.blanco;
const AZ = RGB.azul;
const F1_T1 = S("orbital"); // la frase 1 se va al terminar el átomo (sale en el golpe del orbital)
const T_PREG = 2.5;
const T_BUSCAR = T_BUSQ + 2.5;
const T2_1 = S("teseracto") - 0.45;
const T3_1 = T_FIN - 0.45;
const PALABRAS2 = ["Y", "ALGUIEN", "QUE", "NO", "DEJÓ", "DE"];
const TIEMPOS2 = [...RITMO.motivo.filter((m) => m.t >= T_BUSQ && m.t < T_BUSQ + 1.5).map((m) => m.t).slice(0, 5), T_BUSQ + 2];
// Columna del bloque de texto y bajada (línea base de la palabra clave) en cada formato.
const columna = (d: Disp) => {
  const Z = zonaTexto(d);
  const x = d.txt.x;
  // (en 9:16 el ancho de la columna deja libres los 140 px de la derecha de la zona segura de TikTok)
  const w = d.fmt === "vertical" ? d.W - 2 * x : d.txt.w;
  const yb = d.fmt === "horizontal" ? Z.cy + 110 : Z.cy + Z.h / 2 - 26;
  return { x, w, yb };
};
type Bloque = { finas: Linea[]; clave: Linea; nota: [number, number]; etiqueta: [number, number] };
// Apila las líneas finas sobre la palabra clave, alineadas a la izquierda, con interlineado cerrado (0,86 em).
const bloque = (d: Disp, finas: string[], clave: string, maxClave: number): Bloque => {
  const { x, w, yb } = columna(d);
  const pxF = Math.min(...finas.map((f) => ajusta(f, w, 300, 66)));
  const pxC = ajusta(clave, w, 700, maxClave);
  const C = lineaT(clave, 700, pxC, AZ, x, yb);
  let y = yb - pxC * 0.74 - pxF * 0.32;
  const F: Linea[] = [];
  for (let i = finas.length - 1; i >= 0; i--) {
    F.unshift(lineaT(finas[i], 300, pxF, BL, x, y));
    y -= pxF * 1.02;
  }
  return { finas: F, clave: C, nota: [x + 3, yb + 34], etiqueta: [x + 3, y + pxF * 1.02 - pxF * 0.74 - 22] };
};
const B1 = (d: Disp) => bloque(d, ["CADA GRAN DESCUBRIMIENTO", "EMPEZÓ CON UNA"], "PREGUNTA", 172);
const B2 = (d: Disp) => bloque(d, [PALABRAS2.join(" ")], "BUSCAR", 172);
// «TÚ.» con más contraste: a la derecha de las dos líneas finas, mucho más grande, misma línea base.
const B3 = (d: Disp): Bloque => {
  // (en 16:9 la columna es angosta y TÚ va bajo las líneas finas: se deja crecer como en 4:5)
  const B = bloque(d, ["ESE ALGUIEN", "PUEDES SER"], "TÚ", d.fmt === "horizontal" ? 280 : 200);
  const { x, w, yb } = columna(d);
  const F0 = B.finas[0];
  const anchoF = Math.max(...B.finas.map((f) => f.T.w - 2 * f.T.pad));
  const px = Math.min(300, ajusta("TÚ", w - anchoF - 48, 700, 300));
  const C = lineaT("TÚ", 700, px, AZ, x, yb);
  const anchoC = C.T.w - 2 * C.T.pad;
  if (anchoF + anchoC + 48 > w || px < 220) return B;
  const dy = yb - B.finas[1].yb;
  const finas = B.finas.map((f) => lineaT(f.texto, 300, f.px, BL, x, f.yb + dy));
  void F0;
  return { finas, clave: lineaT("TÚ", 700, px, AZ, x + w - anchoC, yb), nota: [x + w - anchoC + 3, yb + 34], etiqueta: [x + 3, B.etiqueta[1] + dy] };
};
// Tramos (lienzo principal, con brillo): la palabra clave se arma con la geometría de su escena y se deshace en ella.
const frase1 = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_PREG - 0.5 || t > S("orbital") + 0.7) return;
  const desde = (_q: Pt, k: number, n: number): Pt => lis(d, 3, 2, (k / n) * TAU, t);
  const hacia = (_q: Pt, k: number, n: number): Pt => posElectron(d, t - (k / n) * 0.2);
  armar(ctx, pieza(B1(d).clave), t, { t0: T_PREG - 0.5, t1: F1_T1, desde, hacia, rgb: AZ, dur: 0.42, esc: 0.03, durS: 0.25, soloTramos: true });
};
const frase2 = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_BUSCAR - 0.5 || t > S("teseracto")) return;
  const nn = Math.max(2, Math.floor(crecidos(t)));
  const desde = (_q: Pt, k: number): Pt => enBusq(d, RRT.nodos[(k * 37) % nn], t);
  const hacia = (_q: Pt, k: number): Pt => enBusq(d, RRT.suave[(k * 7) % RRT.suave.length], t);
  armar(ctx, pieza(B2(d).clave), t, { t0: T_BUSCAR - 0.5, t1: T2_1, desde, hacia, rgb: AZ, dur: 0.42, esc: 0.03, durS: 0.25, soloTramos: true });
};
const frase3 = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_TU - 0.5 || t > T_FIN) return;
  const centro = (_q: Pt, k: number): Pt => [d.vis.cx + (azar(k) - 0.5) * 10, d.vis.cy + (azar(k * 2.3) - 0.5) * 10];
  const afuera = (q: Pt, k: number): Pt => {
    const an = Math.atan2(q[1] - d.vis.cy, q[0] - d.vis.cx) + (azar(k) - 0.5) * 0.6;
    return [q[0] + Math.cos(an) * 260, q[1] + Math.sin(an) * 260];
  };
  armar(ctx, pieza(B3(d).clave), t, { t0: T_TU, t1: T3_1, desde: centro, hacia: afuera, rgb: AZ, dur: 0.4, esc: 0.03, durS: 0.25, soloTramos: true });
};
// Salida de la palabra clave en la capa nítida: se apaga mientras sus tramos vuelven a la escena.
const saleClave = (t: number, t1: number) => 1 - eIO(pr(t, t1, 0.12));
// Capa nítida (src/Video.tsx la dibuja encima del look, sin postproceso).
export const rotulos = (ctx: Ctx, d: Disp, t: number) => {
  if (t >= 0.4 && t < F1_T1 + 0.2) {
    const B = B1(d);
    codigo(ctx, "01 / 03", B.etiqueta[0], B.etiqueta[1], t, 0.5, F1_T1);
    rebanadas(ctx, B.finas[0], t, 0.5, F1_T1, 3);
    rebanadas(ctx, B.finas[1], t, 1.5, F1_T1 + 0.03, 3);
    decodifica(ctx, B.clave, t, T_PREG, F1_T1 + 0.12, saleClave(t, F1_T1));
    const notas: [number, number, string][] = [
      [T_PREG + 0.1, S("lissajous"), "Carga puntual · E = kq / r²"],
      [S("lissajous"), S("atomo"), "Lissajous 3:2 · x = sen 3t · y = sen 2t"],
      [S("atomo"), F1_T1, "Bohr · n = 3 → 2 → 1 · Eₙ = −13,6 eV / n²"],
    ];
    for (const [a, b, s] of notas) codigo(ctx, s, B.nota[0], B.nota[1], t, a, b, { size: 14, a: 0.62, mayus: false, espaciado: 0.12 });
  }
  if (t >= T_BUSQ - 0.1 && t < T2_1 + 0.2) {
    const B = B2(d);
    codigo(ctx, "02 / 03", B.etiqueta[0], B.etiqueta[1], t, T_BUSQ, T2_1);
    // «Y ALGUIEN QUE NO DEJÓ DE»: una palabra por nota del motivo, cada una en rebanadas
    const F = B.finas[0];
    let x = F.x;
    ctx.save();
    ctx.font = `300 ${F.px}px "Space Grotesk"`;
    ctx.letterSpacing = `${-0.035 * F.px}px`;
    const anchoEsp = ctx.measureText("A B").width - ctx.measureText("AB").width;
    PALABRAS2.forEach((w, i) => {
      const L = lineaT(w, 300, F.px, BL, x, F.yb);
      x += ctx.measureText(w).width + anchoEsp;
      rebanadas(ctx, L, t, TIEMPOS2[i], T2_1 + i * 0.01, 3);
    });
    ctx.restore();
    decodifica(ctx, B.clave, t, T_BUSCAR, T2_1 + 0.12, saleClave(t, T2_1));
    const crec = Math.min(RRT.n, Math.floor(crecidos(t)));
    codigo(ctx, `RRT · ${crec} / ${RRT.n} nodos`, B.nota[0], B.nota[1], t, T_BUSQ + 0.1, T_BUSCAR, { size: 14, a: 0.62, mayus: false, espaciado: 0.12 });
    codigo(ctx, `Objetivo hallado · camino de ${RRT.crudo.length - 1} pasos`, B.nota[0], B.nota[1], t, T_BUSCAR + 0.05, T2_1, { size: 14, a: 0.62, mayus: false, espaciado: 0.12 });
  }
  if (t >= T_SIL - 0.1 && t < T3_1 + 0.2) {
    const B = B3(d);
    codigo(ctx, "03 / 03", B.etiqueta[0], B.etiqueta[1], t, T_SIL, T3_1);
    rebanadas(ctx, B.finas[0], t, T_SIL, T3_1, 3);
    rebanadas(ctx, B.finas[1], t, T_TU, T3_1 + 0.03, 3);
    decodifica(ctx, B.clave, t, T_TU, T3_1 + 0.12, saleClave(t, T3_1));
    codigo(ctx, "n = 1", B.nota[0], B.nota[1], t, T_TU + 0.1, T3_1, { size: 14, a: 0.62, mayus: false, espaciado: 0.12 });
  }
};

// ═══ Orquestación ═══
// Qué dibujar en t. Las escenas se encadenan solas: cada una termina en la forma con que empieza la siguiente.
const alfaGrilla = (t: number) => {
  if (t < S("carga") || t >= T_SIL) return 0;
  const tramos: [number, number, number][] = [
    [S("carga"), T_HOYO, 1],
    [T_HOYO, T_TORO, 0],
    [T_TORO, T_BUSQ, 1],
    [T_BUSQ, S("teseracto"), 0.4],
    [S("teseracto"), T_FLU, 1],
    [T_FLU, T_LOR, 0],
    [T_LOR, T_GS, 1],
    [T_GS, T_RED, 0.4],
    [T_RED, T_ADN, 1],
    [T_ADN, T_AUREA, 0],
    [T_AUREA, T_SIL, 1],
  ];
  for (const [a, b, v] of tramos) if (t >= a && t < b) {
    const prev = tramos.find((x) => x[1] === a)?.[2] ?? 0;
    return lerp(prev, v, eOut(pr(t, a, TR)));
  }
  return 0;
};
export type Recursos = { gs: HTMLImageElement | null; q: HTMLImageElement | null; gsFin: HTMLImageElement | null };
export const dibujar = (ctx: Ctx, d: Disp, t: number, rec: Recursos) => {
  grilla(ctx, d, t, alfaGrilla(t));
  warp(ctx, d, t);
  prologo(ctx, d, t);
  intro(ctx, d, t);
  atomo(ctx, d, t);
  orbital(ctx, d, t);
  cuantico(ctx, d, t, rec.q);
  ondas(ctx, d, t);
  campo(ctx, d, t);
  espacio(ctx, d, t);
  hoyoFormado(ctx, d, t);
  tres(ctx, d, t);
  busqueda(ctx, d, t);
  if (t >= S("teseracto") && t < T_FLU) teseracto(ctx, d, t);
  fluido(ctx, d, t); // (debajo del fractal, que nace de él)
  fractal(ctx, d, t);
  if (t >= T_FLU && t < T_FLU + 1) explosion(ctx, d, t);
  lorenzGPU(ctx, d, t);
  grayScott(ctx, d, t, rec.gs);
  chladni(ctx, d, t, rec.gsFin);
  adnPrisma(ctx, d, t);
  aurea(ctx, d, t);
  girasol(ctx, d, t);
  nautilus(ctx, d, t);
  silencio(ctx, d, t);
  estallido(ctx, d, t);
  barridos(ctx, d, t);
  frase1(ctx, d, t);
  frase2(ctx, d, t);
  frase3(ctx, d, t);
};
void SS;
void tc;
void cabezaLorenz;

void signos;
void interferencia;
void cono;
void red;

// Barrido de luz en los cambios que no son un match cut: una banda diagonal suave cruza el cuadro en un pulso.
const BARRIDOS: number[] = []; // (v1f: sin barridos de luz: dejaban un velo gris)
const barridos = (ctx: Ctx, d: Disp, t: number) => {
  for (const b of BARRIDOS) {
    const u = pr(t, b - 0.3, 0.6);
    if (u <= 0 || u >= 1) continue;
    const x = lerp(-0.4, 1.4, eIO(u)) * d.W;
    const g = ctx.createLinearGradient(x - 260, -100, x + 260, 100);
    g.addColorStop(0, "rgba(140,170,255,0)");
    g.addColorStop(0.5, rgba("200,215,255", 0.22 * Math.sin(Math.PI * u)));
    g.addColorStop(1, "rgba(140,170,255,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, d.W, d.H);
    ctx.restore();
  }
};

void campoDip;
void LIM_G;
void bordeSuave;

void hoyo;

// ═══ ACTO I · 4 · FLUIDO CUÁNTICO (9-14 s): Schrödinger 2D por split-step (herramientas/cuantico.py). El paquete
// nace donde se recogió el orbital, atraviesa dos rendijas y la densidad |ψ|² dibuja las franjas de interferencia;
// al final las rendijas se vuelven las dos cargas del campo y la densidad se disuelve en sus líneas ═══
export const N_Q = 181;
export const cuadroQ = (t: number) => {
  const t0 = S("cuantico") - 0.4;
  if (t < t0 || t > S("ondas") + 0.6) return -1;
  return Math.min(N_Q - 1, Math.max(0, Math.round((t - t0) * 30)));
};
// v1o-h: los tambores de la canción bajo la doble rendija («tamboresRendija», herramientas/eventos_reales.py) actúan
// sobre la simulación misma, sin dibujar nada encima: en cada golpe la densidad |ψ|² se enciende (ataque de 40 ms y
// caída de 250 ms), con un resplandor difuso en las rendijas; en los golpes fuertes la cámara se empuja hasta un 2 %.
const TAMBORES = ((RITMO as unknown as { tamboresRendija?: { t: number; v: number }[] }).tamboresRendija ?? []).slice().sort((a, b) => a.t - b.t);
const tamborFranjas = (t: number) =>
  TAMBORES.reduce((m, k) => (k.t <= t + 1e-6 ? Math.max(m, k.v * eOut(Math.min(1, (t - k.t) / 0.04)) * Math.exp(-(t - k.t) / 0.25)) : m), 0);
const tamborEmpuje = (t: number) =>
  TAMBORES.reduce((m, k) => (k.v >= 0.55 && k.t <= t + 1e-6 ? Math.max(m, 0.02 * k.v * eOut(Math.min(1, (t - k.t) / 0.07)) * Math.exp(-(t - k.t) * 3.5)) : m), 0);
const cuantico = (ctx: Ctx, d: Disp, t: number, img: HTMLImageElement | null) => {
  if (cuadroQ(t) < 0 || !img || !img.complete || !img.naturalWidth) return;
  // v1o-e: se apaga en 0,5 s cruzándose con los primeros frentes, que salen en el golpe donde nacen las ondas
  const vis = eIO(pr(t, S("cuantico") - 0.4, 0.6)) * (1 - eIO(pr(t, S("ondas") - 0.2, 0.5)));
  const { yB, sep } = geoRendija(d);
  // al final las rendijas se encienden: son las fuentes de las ondas, en el mismo lugar
  const enciende = eIn(pr(t, S("ondas") - 0.45, 0.45)) * (t < S("ondas") ? 1 : 0);
  if (vis <= 0.005) {
    if (enciende > 0.01) for (const sx of [d.vis.cx - sep, d.vis.cx + sep]) carga(ctx, sx, yB, 3 + 5 * enciende, RGB.hielo, enciende, t);
    return;
  }
  const fr = tamborFranjas(t);
  const emp = 1 + tamborEmpuje(t);
  ctx.save();
  ctx.translate(d.vis.cx, d.vis.cy);
  ctx.scale(emp, emp);
  ctx.translate(-d.vis.cx, -d.vis.cy);
  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = vis;
  ctx.drawImage(img, 0, 0, d.W, d.H);
  ctx.filter = "blur(10px)";
  ctx.globalAlpha = vis * (0.45 + 0.25 * golpe(t, BOMBOS, 6) + 0.7 * fr);
  ctx.drawImage(img, 0, 0, d.W, d.H);
  // la onda se enciende con el tambor: |ψ|² más intensa (una copia nítida más, que decae entre golpes)
  ctx.filter = "none";
  ctx.globalAlpha = vis * 0.9 * fr;
  ctx.drawImage(img, 0, 0, d.W, d.H);
  ctx.globalAlpha = 1;
  ctx.restore();
  // resplandor difuso que nace en las rendijas con cada golpe (luz, no líneas)
  if (fr > 0.01) {
    const { yB: yR } = geoRendija(d);
    luz(ctx, () => brillo(ctx, d.vis.cx, yR, d.vis.r * 0.9 * emp, RGB.azul, 0.14 * fr * vis));
  }
  // las rendijas brillan con cada bombo (y luego son las cargas del campo)
  const pg = golpe(t, BOMBOS, 7);
  for (const sx of [d.vis.cx - sep, d.vis.cx + sep]) carga(ctx, sx, yB, (3 + 3 * pg) * vis + 5 * enciende, RGB.hielo, Math.max(0.7 * vis, enciende), t);
};

void rendija;
void T_POZO;

void lorenz;
// ═══ ACTO III · 4 · LORENZ DE UN MILLÓN DE PARTÍCULAS (41,5-46 s): nace del punto donde se cerró Julia, la cámara da
// una vuelta completa con la música y el flujo empuja en cada bombo; color según la velocidad. Efecto mariposa: dos
// trayectorias que nacen juntas (Δx₀ = 10⁻⁴) y se separan justo en un bombo. Al final la cámara queda de frente y el
// atractor se aplana: esa silueta siembra Gray-Scott ═══
const MARIPOSA = (() => {
  const f = (x: number, y: number, z: number) => [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z];
  const paso = (s: number[], dt: number) => {
    const k1 = f(s[0], s[1], s[2]);
    const k2 = f(s[0] + (dt / 2) * k1[0], s[1] + (dt / 2) * k1[1], s[2] + (dt / 2) * k1[2]);
    const k3 = f(s[0] + (dt / 2) * k2[0], s[1] + (dt / 2) * k2[1], s[2] + (dt / 2) * k2[2]);
    const k4 = f(s[0] + dt * k3[0], s[1] + dt * k3[1], s[2] + dt * k3[2]);
    return s.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
  };
  let a = [-6.0, -8.0, 22.0];
  let b = [-6.0001, -8.0, 22.0];
  const A: number[][] = [];
  const B: number[][] = [];
  let sep = -1;
  for (let i = 0; i < 9000; i++) {
    A.push(a);
    B.push(b);
    if (sep < 0 && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 4) sep = i;
    a = paso(a, 0.004);
    b = paso(b, 0.004);
  }
  return { A, B, sep: sep < 0 ? 6000 : sep };
})();
const parLorenz = (t: number): ParamLorenz => {
  const lt = Math.max(0, t - T_LOR);
  const u = pr(t, T_LOR, T_GS - T_LOR);
  const kend = eIO(pr(t, T_GS - 0.9, 0.9));
  const kicks = entre(BOMBOS, T_LOR, T_GS);
  return {
    flujo: lt * 900 + 260 * pasos(kicks, T_LOR, t, 0.4),
    esc: 0.04 + 0.96 * eIO(pr(t, T_LOR - 0.5, 1.1)),
    dist: lerp(5.3, 4.6, eIO(u)),
    elev: lerp(0.38, 0.0, kend) * (0.7 + 0.3 * Math.sin(lt * 0.9)),
    az: TAU * eIO(u),
    brillo: (1 + 0.3 * golpe(t, kicks, 6)) * (1 + 0.8 * kend) * eIO(pr(t, T_LOR - 0.5, 0.5)) * (1 - eIO(pr(t, T_GS - 0.1, 0.6))),
    aplana: kend,
  };
};
const T_MARIPOSA = entre(BOMBOS, T_LOR + 2.0, T_GS)[0] ?? T_LOR + 2;
const lorenzGPU = (ctx: Ctx, d: Disp, t: number) => {
  if (t < T_LOR - 0.5 || t > T_GS + TR) return;
  const P = parLorenz(t);
  const c = pintarLorenz(d.W, d.H, P);
  if (!c) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(c, 0, 0, d.W, d.H);
  ctx.filter = "blur(9px)";
  ctx.globalAlpha = 0.55;
  ctx.drawImage(c, 0, 0, d.W, d.H);
  ctx.restore();
  // efecto mariposa
  const cam = camaraLorenz(P);
  const t0 = T_LOR + 0.5;
  const n = Math.floor(MARIPOSA.sep * pr(t, t0, T_MARIPOSA - t0) + Math.max(0, t - T_MARIPOSA) * (MARIPOSA.sep / (T_MARIPOSA - t0)));
  const vm = eIO(pr(t, t0, 0.5)) * (1 - eIO(pr(t, T_GS - 0.7, 0.6)));
  if (vm <= 0.01 || n < 3) return;
  const mundo = (q: number[]) => [q[0] * 0.06 * P.esc, (q[2] - 25) * 0.06 * P.esc, q[1] * (1 - P.aplana) * 0.06 * P.esc];
  const sep = golpe(t, [T_MARIPOSA], 2.5);
  for (const [tray, rgb] of [[MARIPOSA.A, "255,226,180"], [MARIPOSA.B, "140,190,255"]] as [number[][], string][]) {
    const pts: Pt[] = [];
    for (let i = Math.max(0, n - 700); i <= Math.min(n, tray.length - 1); i += 2) {
      const q = proyectar(cam, d.W, d.H, mundo(tray[i]));
      pts.push([q[0], q[1]]);
    }
    if (pts.length < 2) continue;
    luz(ctx, () => {
      estela(ctx, pts, rgb, vm * 0.35, 9, 12, 0.05);
      estela(ctx, pts, rgb, vm, 2.2, 12, 0.05);
    });
    const [hx, hy] = pts[pts.length - 1];
    carga(ctx, hx, hy, (6 + 8 * sep) * vm, rgb, vm, t);
  }
};

// ═══ ACTO III · 6 · FIGURAS DE CHLADNI (48-51 s): la arena sobre una placa cuadrada que vibra se junta en las líneas
// nodales del modo (n, m): f = cos(nπx) cos(mπy) − cos(mπx) cos(nπy) = 0. Cada nota del motivo y cada bombo cambian
// el modo: la arena salta y se reordena ═══
const T_CHL = S("chladni");
// v1l · Figuras de Chladni en 3D (48-51 s): una placa cuadrada vista en perspectiva con cámara que orbita. La placa
// vibra con la forma del modo (n, m): f = cos(nπx)cos(mπy) − cos(mπx)cos(nπy); la malla ondula y brilla en los
// antinodos. ~100 k granos de arena: en cada golpe cambia el modo (cada vez más complejo), los granos de los antinodos
// saltan con rebotes amortiguados y se deslizan hasta las nuevas líneas nodales (f = 0). Entra desde el patrón de
// Turing (cada grano nace en un píxel claro del último cuadro de Gray-Scott) y sale condensándose en la hélice del ADN.
const MODOS: [number, number][] = [[1, 2], [1, 3], [2, 3], [2, 5], [3, 5], [4, 7], [5, 8]];
const TINTES = ["236,240,255", "255,232,204", "226,236,255", "214,226,255", "236,222,255", "200,244,236", "160,250,226"];
const EV_CHL = [...new Set([...RITMO.motivo.filter((m) => m.t >= T_CHL - 0.01 && m.t < T_CHL + 2).map((m) => m.t), ...entre(BOMBOS, T_CHL + 2, S("adn"))])].sort((a, b) => a - b);
const N_ARENA = 100000;
const fChl = (n: number, m: number, x: number, y: number) => Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) - Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);
// posiciones de reposo de cada grano en cada modo: el modo k parte de donde quedó el grano en el modo k − 1 y baja
// por |f|² hasta la línea nodal más cercana (así cada grano hace un recorrido corto y creíble)
let ARENA: Float32Array[] | null = null;
const arena = () => {
  if (ARENA) return ARENA;
  const out: Float32Array[] = [];
  let px = new Float32Array(N_ARENA);
  let py = new Float32Array(N_ARENA);
  for (let i = 0; i < N_ARENA; i++) {
    px[i] = azar(i * 1.31 + 7.7);
    py[i] = azar(i * 2.17 + 3.3);
  }
  for (let k = 0; k < MODOS.length; k++) {
    const [n, m] = MODOS[k];
    const c = new Float32Array(N_ARENA * 2);
    const nx = new Float32Array(N_ARENA);
    const ny = new Float32Array(N_ARENA);
    for (let i = 0; i < N_ARENA; i++) {
      // la placa vibra en el modo nuevo: cada grano sale despedido según cuánto se mueve su punto (en los antinodos
      // vuela lejos; en las líneas que siguen siendo nodales casi no se mueve) y luego baja a la línea nodal
      const [n0, m0] = MODOS[k];
      const fa = k === 0 ? 1 : Math.abs(fChl(n0, m0, px[i], py[i])) / 2;
      const alc = 0.2 + 0.45 * Math.sqrt(fa);
      let x = cl(px[i] + (azar(i * 3.1 + k * 5.3) - 0.5) * 2 * alc, 0, 1);
      let y = cl(py[i] + (azar(i * 4.3 + k * 2.9) - 0.5) * 2 * alc, 0, 1);
      for (let it = 0; it < 22; it++) {
        const e = 1e-3;
        const f = fChl(n, m, x, y);
        const gx = (fChl(n, m, x + e, y) - fChl(n, m, x - e, y)) / (2 * e);
        const gy = (fChl(n, m, x, y + e) - fChl(n, m, x, y - e)) / (2 * e);
        const g2 = gx * gx + gy * gy + 1e-3;
        x = cl(x - ((f * gx) / g2) * 0.65, 0, 1);
        y = cl(y - ((f * gy) / g2) * 0.65, 0, 1);
      }
      x += (azar(i * 5.1 + k) - 0.5) * 0.006;
      y += (azar(i * 6.3 + k) - 0.5) * 0.006;
      c[i * 2] = x;
      c[i * 2 + 1] = y;
      nx[i] = x;
      ny[i] = y;
    }
    out.push(c);
    px = nx;
    py = ny;
  }
  ARENA = out;
  return out;
};
// granos de entrada: píxeles claros del último cuadro de Gray-Scott (en pantalla)
let ORIGEN_GS: Float32Array | null = null;
const origenGS = (d: Disp, img: HTMLImageElement | null) => {
  if (ORIGEN_GS) return ORIGEN_GS;
  const o = new Float32Array(N_ARENA * 2);
  const pts: number[] = [];
  if (img && img.complete && img.naturalWidth) {
    const w = 270;
    const h = Math.round((270 * d.H) / d.W);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true })!;
    x.drawImage(img, 0, 0, w, h);
    const dat = x.getImageData(0, 0, w, h).data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (dat[(j * w + i) * 4 + 1] > 110) pts.push((i + 0.5) / w, (j + 0.5) / h);
  }
  for (let i = 0; i < N_ARENA; i++) {
    if (pts.length) {
      const q = Math.floor(azar(i * 7.7 + 1) * (pts.length / 2)) * 2;
      o[i * 2] = (pts[q] + (azar(i * 2.2) - 0.5) / 270) * d.W;
      o[i * 2 + 1] = (pts[q + 1] + (azar(i * 3.3) - 0.5) / 270) * d.H;
    } else {
      o[i * 2] = d.vis.cx + (azar(i * 9.1) - 0.5) * d.vis.r * 1.8;
      o[i * 2 + 1] = d.vis.cy + (azar(i * 8.3) - 0.5) * d.vis.r * 1.8;
    }
  }
  if (pts.length) ORIGEN_GS = o;
  return o;
};
// destino de salida: un punto de la hélice del ADN en su primer cuadro (misma geometría y cámara que src/gl.ts)
// destino de salida: un punto de la hélice del ADN tal como la dibuja src/gl.ts en ese instante (misma geometría,
// mismo giro y misma cámara), así los granos aterrizan sobre las partículas de la hélice
const DESTINO_ADN = new Float32Array(N_ARENA * 2);
const ALTURA_ADN = new Float32Array(N_ARENA);
const destinoADN = (d: Disp, t: number) => {
  const A = camADN(Math.max(t, T_ADN));
  const cam = camara(A.dist, A.elev, A.az, A.mira);
  const giro = 1.3 * Math.max(0, t - T_ADN);
  const RA = [-8.6, -0.37, 0];
  const RB = [-0.35, 0, 0];
  for (let i = 0; i < N_ARENA; i++) {
    // solo el tramo que la hélice GPU muestra (|x| < 2: en los extremos sus partículas se apagan)
    const s = 0.27 + 0.46 * azar(i * 4.4 + 2);
    const x = (s - 0.5) * 8;
    const off = i % 2 ? 2.3 : 0;
    const ang = x * 2.1 + giro + off;
    const p = [lerp(RA[0], RB[0], s), lerp(RA[1], RB[1], s) + 0.62 * Math.cos(ang), lerp(RA[2], RB[2], s) + 0.62 * Math.sin(ang)];
    const q = proyectar(cam, d.W, d.H, p);
    DESTINO_ADN[i * 2] = q[0];
    DESTINO_ADN[i * 2 + 1] = q[1];
    ALTURA_ADN[i] = cl(q[1] / d.H);
  }
  return DESTINO_ADN;
};
// v1m · remolino: desde el último cambio de modo la cámara deja de orbitar y se inclina hacia arriba, la placa se
// desvanece y la arena se levanta girando en espiral hasta formar las dos hebras, de abajo hacia arriba
const T_REMOLINO = S("adn") - 0.85;
const DUR_REMOLINO = 1.2;
const camChl = (t: number) => {
  const r = eIO(pr(t, T_REMOLINO, DUR_REMOLINO));
  // el giro de la órbita frena con easing hasta quedar quieto
  const tg = t < T_REMOLINO ? t - T_CHL : T_REMOLINO - T_CHL + 0.6 * (1 - Math.pow(1 - cl((t - T_REMOLINO) / 1.2), 2)) * 1.2 / 2;
  return { ax: lerp(0.62 + 0.08 * Math.sin((Math.min(t, T_REMOLINO) - T_CHL) * 0.9), 1.32, r), az: 0.5 + 0.32 * tg, esc: 0 };
};
const amplitud = (t: number, k: number, tk: number) => (0.035 + 0.11 * Math.exp(-(t - tk) * 3.2)) * (k >= 0 ? 1 : 0);
let bufChl: { w: number; h: number; acc: Float32Array; img: ImageData; c: HTMLCanvasElement } | null = null;
const chladni = (ctx: Ctx, d: Disp, t: number, gsFin: HTMLImageElement | null) => {
  const T_FIN_CHL = S("adn");
  if (t < T_CHL - 0.45 || t > T_FIN_CHL + 0.5) return;
  const AR = arena();
  const vis = eIO(pr(t, T_CHL - 0.45, 0.5));
  const entra = eIO(pr(t, T_CHL - 0.4, 0.75)); // de Turing a la placa
  const sale = pr(t, T_REMOLINO, DUR_REMOLINO); // de la placa a la hélice (lineal: cada grano lleva su propio easing)
  const apaga = 1 - eIO(pr(t, T_FIN_CHL + 0.15, 0.4)); // la hélice de partículas GPU toma el relevo
  const placaSale = eIO(pr(t, T_REMOLINO, 0.7));
  let k = 0;
  while (k + 1 < EV_CHL.length && k + 1 < MODOS.length && EV_CHL[k + 1] <= Math.min(t, T_REMOLINO - 0.05) + 1e-6) k++;
  const tk = EV_CHL[k] ?? T_CHL;
  const [n, m] = MODOS[k];
  const prev = k > 0 ? AR[k - 1] : null;
  const cur = AR[k];
  const u = pr(t, tk, 0.55);
  const desliza = eOut(u);
  const A = amplitud(t, k, tk) * (1 - placaSale);
  const fase = Math.sin(t * TAU * 6.5);
  const { ax, az } = camChl(t);
  const esc = d.vis.r * 0.76 * (1 + 0.1 * eIO(pr(t, T_CHL, 3)));
  const P3 = (x: number, y: number, z: number) => proy3(d, [(x - 0.5) * 2, (y - 0.5) * 2, z], ax, az, esc, d.vis.cx, d.vis.cy + d.vis.r * 0.06);
  const tinte = TINTES[k % TINTES.length];
  // ── la placa: malla que ondula con el modo y brilla en los antinodos ──
  const vp = vis * (1 - placaSale) * entra;
  if (vp > 0.01) {
    const L = lote();
    const NG = 30;
    const z = (x: number, y: number) => A * fChl(n, m, x, y) * fase;
    for (let dir = 0; dir < 2; dir++)
      for (let a = 0; a <= NG; a++) {
        const s = a / NG;
        let q0: [number, number, number] | null = null;
        for (let b = 0; b <= 40; b++) {
          const r = b / 40;
          const x = dir ? s : r;
          const y = dir ? r : s;
          const q = P3(x, y, z(x, y));
          if (q0) {
            const f = Math.abs(fChl(n, m, x, y)) / 2;
            const borde = a === 0 || a === NG ? 1 : 0;
            L.add(q0[0], q0[1], q[0], q[1], f > 0.5 ? RGB.hielo : RGB.azul, vp * (0.06 + 0.3 * f * (A / 0.146) + 0.4 * borde), borde ? 1.6 : 1);
          }
          q0 = q;
        }
      }
    luz(ctx, () => L.draw(ctx, 1));
  }
  // ── la arena ──
  const W1 = d.W;
  const H1 = d.H;
  if (!bufChl || bufChl.w !== W1 || bufChl.h !== H1) {
    const c = document.createElement("canvas");
    c.width = W1;
    c.height = H1;
    bufChl = { w: W1, h: H1, acc: new Float32Array(W1 * H1), img: c.getContext("2d")!.createImageData(W1, H1), c };
  }
  const B = bufChl;
  B.acc.fill(0);
  const O = entra < 1 ? origenGS(d, gsFin) : null;
  const D = sale > 0 ? destinoADN(d, t) : null;
  const vibra = A * 0.9;
  const refuerzo = 1 + 4 * (1 - entra) + 1.2 * Math.sin(Math.PI * cl(sale * 1.2));
  for (let i = 0; i < N_ARENA; i++) {
    let x = cur[i * 2];
    let y = cur[i * 2 + 1];
    let h = 0;
    if (prev && u < 1) {
      const x0 = prev[i * 2];
      const y0 = prev[i * 2 + 1];
      // salta más el grano que quedó en un antinodo del modo nuevo; rebota dos veces, amortiguado
      const fa = Math.abs(fChl(n, m, x0, y0)) / 2;
      h = 0.32 * fa * Math.abs(Math.sin(u * Math.PI * 2.2)) * (1 - u) * (1 - u);
      x = lerp(x0, x, desliza);
      y = lerp(y0, y, desliza);
    }
    // los granos tiemblan donde la placa todavía se mueve
    const fl = fChl(n, m, x, y);
    const tr = vibra * Math.abs(fl) * 0.05;
    x += (azar(i * 3.7 + Math.floor(t * 30)) - 0.5) * tr;
    y += (azar(i * 4.9 + Math.floor(t * 30)) - 0.5) * tr;
    const q = P3(x, y, A * fl * fase + h + 0.004);
    let sx = q[0];
    let sy = q[1];
    if (O && entra < 1) {
      // del patrón de Turing a la placa, con un arco hacia arriba
      const e = eIO(cl((entra - 0.25 * azar(i * 1.9)) / 0.75));
      sx = lerp(O[i * 2], sx, e);
      sy = lerp(O[i * 2 + 1], sy, e) - Math.sin(Math.PI * e) * 60 * azar(i * 2.7);
    }
    if (D && sale > 0) {
      // los de abajo primero: la hélice se arma de abajo hacia arriba
      const retraso = 0.42 * (1 - ALTURA_ADN[i]) + 0.08 * azar(i * 2.1);
      const e = eIO(cl((sale - retraso) / 0.5));
      // remolino: gira alrededor del eje vertical de la escena mientras sube
      // dos brazos coherentes (uno por hebra): el remolino se lee como espiral, no como polvo
      const giroR = 3.2 * Math.PI * e + (i % 2) * Math.PI + 0.5 * azar(i * 7.3);
      const radioR = (110 + 30 * azar(i * 5.5)) * Math.sin(Math.PI * e);
      sx = lerp(sx, D[i * 2], e) + radioR * Math.cos(giroR);
      sy = lerp(sy, D[i * 2 + 1], e) + radioR * 0.32 * Math.sin(giroR) - 70 * Math.sin(Math.PI * e);
    }
    const ix = sx | 0;
    const iy = sy | 0;
    if (ix < 0 || iy < 0 || ix >= W1 || iy >= H1) continue;
    // más brillo cerca de la cámara (profundidad) y en el salto
    // esparcidos (al entrar desde Turing y al volar a la hélice) cada grano brilla más: la luz no se diluye
    const br = (0.55 + 0.45 * cl(0.6 - q[2] * 0.5)) * (1 + 2.5 * h) * refuerzo;
    B.acc[iy * W1 + ix] += br;
  }
  const [tr0, tg0, tb0] = tinte.split(",").map(Number);
  const tur = eIO(sale); // al salir la arena toma el turquesa de la hélice
  const cr = lerp(tr0, 110, tur);
  const cg = lerp(tg0, 245, tur);
  const cb = lerp(tb0, 220, tur);
  const px = B.img.data;
  const ga = vis * apaga;
  for (let i = 0; i < W1 * H1; i++) {
    const v = B.acc[i];
    const o = i * 4;
    if (v <= 0) {
      px[o + 3] = 0;
      continue;
    }
    const a = 1 - Math.exp(-v * 0.42);
    px[o] = cr;
    px[o + 1] = cg;
    px[o + 2] = cb;
    px[o + 3] = 255 * a * ga;
  }
  B.c.getContext("2d")!.putImageData(B.img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = "blur(6px)";
  ctx.globalAlpha = 0.55;
  ctx.drawImage(B.c, 0, 0, d.W, d.H);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.drawImage(B.c, 0, 0, d.W, d.H);
  ctx.restore();
};

// La cola del estallido se dibuja también sobre el comienzo del final aprobado (src/Video.tsx).
export const colaEstallido = (ctx: Ctx, d: Disp, t: number) => estallido(ctx, d, t);
