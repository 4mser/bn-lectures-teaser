// Tipografía como geometría (heredada de la v2): cada frase se rasteriza en Space Grotesk y se arma con tramos
// horizontales o puntos que salen de la forma de la escena y aterrizan en las letras en un golpe de la música.
// Una vez armada, la frase se funde con su versión nítida (con halo) para que se lea limpia. Todo queda en caché y
// es función pura de t.
import { SANS, SS, cl, eIO, eOut, lerp, pr } from "./theme";
import { rgba, type Pt } from "./lab/luz";
import type { Disp } from "./disposicion";

type Ctx = CanvasRenderingContext2D;
// c es el raster a resolución SS; w, h y px están en píxeles del cuadro (1×).
// pad y base (px del cuadro): margen izquierdo del raster y distancia del borde superior a la línea base.
export type Texto = { c: HTMLCanvasElement; halo: HTMLCanvasElement; w: number; h: number; px: number; alfa: Uint8ClampedArray; cw: number; pad: number; base: number };
const cache = new Map<string, Texto>();
const fuenteLista = (peso: number) => typeof document !== "undefined" && document.fonts.check(`${peso} 40px "${SANS}"`);
const fuente = (px: number, peso: number) => `${peso} ${px}px "${SANS}"`;
const eIn = (x: number) => (x <= 0 ? 0 : Math.pow(2, 10 * cl(x) - 10));

let medidorC: HTMLCanvasElement | null = null;
const medidor = () => {
  if (!medidorC) medidorC = document.createElement("canvas");
  return medidorC.getContext("2d")!;
};
// Tamaño de fuente para que el texto mida `ancho` px.
export const tamPara = (texto: string, ancho: number, peso = 700, track = -0.03) => {
  const x = medidor();
  x.font = fuente(100, peso);
  x.letterSpacing = `${track * 100}px`;
  return (100 * ancho) / x.measureText(texto).width;
};

export const rasterizar = (texto: string, px: number, peso: number, rgb: string, track = -0.03): Texto => {
  const k = `${texto}|${px.toFixed(1)}|${peso}|${rgb}|${track}`;
  const enCache = cache.get(k);
  if (enCache) return enCache;
  const P = px * SS;
  const c = document.createElement("canvas");
  let x = c.getContext("2d")!;
  x.font = fuente(P, peso);
  x.letterSpacing = `${track * P}px`;
  const m = x.measureText(texto);
  const asc = Math.max(m.actualBoundingBoxAscent, P * 0.74);
  const desc = Math.max(m.actualBoundingBoxDescent, P * 0.05);
  const pad = Math.round(P * 0.08);
  const cw = Math.ceil(m.width + 2 * pad);
  const ch = Math.ceil(asc + desc + 2 * pad);
  c.width = cw;
  c.height = ch;
  x = c.getContext("2d")!;
  x.font = fuente(P, peso);
  x.letterSpacing = `${track * P}px`;
  x.fillStyle = `rgb(${rgb})`;
  x.textBaseline = "alphabetic";
  x.fillText(texto, pad, pad + asc);
  const img = x.getImageData(0, 0, cw, ch).data;
  const alfa = new Uint8ClampedArray(cw * ch);
  for (let i = 0; i < cw * ch; i++) alfa[i] = img[i * 4 + 3];
  // Halo: el mismo texto desenfocado, para el brillo suave alrededor de las letras.
  const halo = document.createElement("canvas");
  const hp = Math.round(P * 0.35);
  halo.width = cw + 2 * hp;
  halo.height = ch + 2 * hp;
  const hx = halo.getContext("2d")!;
  hx.filter = `blur(${Math.max(4, P * 0.09)}px)`;
  hx.drawImage(c, hp, hp);
  const r: Texto = { c, halo, w: cw / SS, h: ch / SS, px, alfa, cw, pad: pad / SS, base: (pad + asc) / SS };
  if (fuenteLista(peso)) cache.set(k, r);
  return r;
};

const cacheR = new Map<string, [number, number, number][]>();
// Tramos horizontales de tinta (x0, x1, y) cada `paso` px, en px del cuadro y centrados en el origen.
export const tramos = (T: Texto, paso: number): [number, number, number][] => {
  const k = `${T.cw}x${T.h}|${T.px}|${paso}|${T.alfa.length}|${T.alfa[T.alfa.length >> 1]}`;
  const c = cacheR.get(k);
  if (c) return c;
  const out: [number, number, number][] = [];
  const ch = Math.round(T.h * SS);
  for (let yy = (paso * SS) / 2; yy < ch; yy += paso * SS) {
    const y = Math.floor(yy);
    let x0 = -1;
    for (let x = 0; x <= T.cw; x++) {
      const dentro = x < T.cw && T.alfa[y * T.cw + x] > 110;
      if (dentro && x0 < 0) x0 = x;
      if (!dentro && x0 >= 0) {
        if (x - x0 > SS) out.push([x0 / SS - T.w / 2, x / SS - T.w / 2, y / SS - T.h / 2]);
        x0 = -1;
      }
    }
  }
  cacheR.set(k, out);
  return out;
};
const cacheP = new Map<string, Pt[]>();
// Puntos del interior en una grilla de paso `paso` (px del cuadro), centrados en el origen.
export const grillaPuntos = (T: Texto, paso: number): Pt[] => {
  const k = `${T.cw}x${T.h}|${T.px}|${paso}`;
  const c = cacheP.get(k);
  if (c) return c;
  const out: Pt[] = [];
  const ch = Math.round(T.h * SS);
  const fila = paso * 0.866;
  let j = 0;
  for (let y = fila / 2; y < T.h; y += fila, j++)
    for (let x = (j % 2 ? paso : paso / 2); x < T.w; x += paso) {
      const ix = Math.floor(x * SS);
      const iy = Math.floor(y * SS);
      if (iy < ch && T.alfa[iy * T.cw + ix] > 128) out.push([x - T.w / 2, y - T.h / 2]);
    }
  cacheP.set(k, out);
  return out;
};

// ── Zona del texto en cada formato: debajo de la animación en 4:5 y 9:16, columna izquierda en 16:9 ──
export const zonaTexto = (d: Disp) =>
  d.fmt === "horizontal" ? { cx: d.txt.x + d.txt.w / 2, cy: d.txt.y, w: d.txt.w, h: 420 } : d.fmt === "alto" ? { cx: d.W / 2, cy: 1340, w: 900, h: 300 } : { cx: d.W / 2, cy: 1150, w: 930, h: 270 };

// Tamaño de una palabra para que llene `ancho` sin pasar de `alto` (altura de mayúscula ≈ 0,74 px).
export const tamPalabra = (texto: string, ancho: number, alto: number, peso = 700) => Math.min(tamPara(texto, ancho, peso), alto / 0.74);

// Coloca una línea de palabras (cada una su raster) centrada en (cx, cy); devuelve el centro de cada una.
export type Pieza = { T: Texto; x: number; y: number };
export const enLinea = (Ts: Texto[], cx: number, cy: number, espacio: number): Pieza[] => {
  const total = Ts.reduce((a, T) => a + T.w, 0) + espacio * (Ts.length - 1);
  let x = cx - total / 2;
  return Ts.map((T) => {
    const p = { T, x: x + T.w / 2, y: cy };
    x += T.w + espacio;
    return p;
  });
};

// Dibuja el raster nítido con halo (alfa a), opcionalmente cortado en columnas (ondula) o filas (glitch).
export const nitido = (ctx: Ctx, p: Pieza, a: number, o: { halo?: number; ondula?: (x: number) => number; glitch?: (y: number) => number } = {}) => {
  if (a <= 0.004) return;
  const { T } = p;
  const x0 = p.x - T.w / 2;
  const y0 = p.y - T.h / 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const hp = (T.halo.width - T.cw) / 2 / SS;
  ctx.globalAlpha = cl(a * (o.halo ?? 0.55));
  ctx.drawImage(T.halo, x0 - hp, y0 - hp, T.halo.width / SS, T.halo.height / SS);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = cl(a);
  if (o.ondula) {
    const n = Math.ceil(T.w / 3);
    for (let i = 0; i < n; i++) {
      const sx = i * 3;
      ctx.drawImage(T.c, sx * SS, 0, 3 * SS, T.c.height, x0 + sx, y0 + o.ondula(x0 + sx), 3.2, T.h);
    }
  } else if (o.glitch) {
    const n = 12;
    const fh = T.h / n;
    for (let i = 0; i < n; i++) ctx.drawImage(T.c, 0, i * fh * SS, T.c.width, fh * SS + 1, x0 + o.glitch(i / n), y0 + i * fh, T.w, fh + 0.5);
  } else ctx.drawImage(T.c, x0, y0, T.w, T.h);
  ctx.restore();
};

// Arma una pieza con tramos que salen de `desde` (un punto de la escena por tramo) y llegan escalonados a partir de
// t0; a partir de t1 vuelven a ser tramos y se van hacia `hacia`. Entre medio, el raster nítido.
export type Armado = {
  t0: number;
  dur?: number;
  esc?: number; // escalonado total de los tramos (s)
  t1: number;
  durS?: number;
  desde: (p: Pt, k: number, n: number) => Pt;
  hacia?: (p: Pt, k: number, n: number) => Pt;
  paso?: number;
  rgb: string;
  ondula?: (x: number) => number;
  glitch?: (y: number) => number;
  halo?: number;
  soloTramos?: boolean; // la versión nítida la dibuja otra capa (src/rotulos.ts)
};
export const armar = (ctx: Ctx, p: Pieza, t: number, o: Armado) => {
  const dur = o.dur ?? 0.5;
  const esc = o.esc ?? 0.22;
  const durS = o.durS ?? 0.4;
  if (t < o.t0 || t > o.t1 + durS + esc + 0.05) return;
  const paso = o.paso ?? Math.max(2.5, p.T.px / 26);
  const R = tramos(p.T, paso);
  const listo = o.t0 + esc + dur * 0.75;
  const solido = eIO(pr(t, listo, 0.3)) * (1 - eIO(pr(t, o.t1, 0.12)));
  const vis = 1 - solido;
  if (vis > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const n = R.length;
    R.forEach(([x0, x1, y], k) => {
      const u = (x0 + p.T.w / 2) / p.T.w;
      const s = o.t0 + esc * (0.75 * u + 0.25 * ((k * 0.618) % 1));
      const m = eOut(pr(t, s, dur));
      if (m <= 0) return;
      const e = eIn(pr(t, o.t1 + esc * (0.75 * u + 0.25 * ((k * 0.382) % 1)), durS));
      const meta: Pt = [p.x + (x0 + x1) / 2, p.y + y];
      const ini = o.desde(meta, k, n);
      let c: Pt = [lerp(ini[0], meta[0], m), lerp(ini[1], meta[1], m)];
      if (e > 0 && o.hacia) {
        const fin = o.hacia(meta, k, n);
        c = [lerp(c[0], fin[0], e), lerp(c[1], fin[1], e)];
      }
      const L = ((x1 - x0) / 2) * lerp(0.2, 1, m) * (1 - 0.8 * e);
      const a = Math.min(1, m * 2.5) * (1 - e) * vis;
      if (a <= 0.01) return;
      const gy = o.glitch ? o.glitch((y + p.T.h / 2) / p.T.h) : 0;
      ctx.strokeStyle = rgba(o.rgb, a * 0.22);
      ctx.lineWidth = paso * 1.9;
      ctx.beginPath();
      ctx.moveTo(c[0] - L + gy, c[1]);
      ctx.lineTo(c[0] + L + gy, c[1]);
      ctx.stroke();
      ctx.strokeStyle = rgba(o.rgb, a);
      ctx.lineWidth = paso * 0.72;
      ctx.beginPath();
      ctx.moveTo(c[0] - L + gy, c[1]);
      ctx.lineTo(c[0] + L + gy, c[1]);
      ctx.stroke();
    });
    ctx.restore();
  }
  if (!o.soloTramos) nitido(ctx, p, solido, { halo: o.halo, ondula: o.ondula, glitch: o.glitch });
};
