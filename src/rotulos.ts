// Sistema de títulos de la v2 (teaser-lectures, v2-oscura-titulos), pasado a canvas para la capa nítida que va encima
// del look retro (sin postproceso): mayúsculas en Space Grotesk con tracking cerrado, contraste de pesos (300 / 700) y
// de tamaños, entrada y salida en rebanadas horizontales desde lados alternos, palabra clave que se decodifica y se
// resuelve justo en el golpe, y anotaciones técnicas pequeñas en IBM Plex Mono que se escriben carácter a carácter.
// Los rasters son los de src/titulos.ts: los tramos que arman la palabra con la geometría de la escena (lienzo
// principal) aterrizan exactamente sobre las letras de esta capa. Todo es función pura de t.
import { MONO, SANS, SS, cl, eOut, pr } from "./theme";
import { azar, rgba } from "./lab/luz";
import { rasterizar, tamPara, type Pieza, type Texto } from "./titulos";

type Ctx = CanvasRenderingContext2D;
export const TRACK = -0.035;
const eIn = (x: number) => (x <= 0 ? 0 : Math.pow(2, 10 * cl(x) - 10));

// Una línea de título: raster + posición del borde izquierdo de la tinta (x) y de la línea base (yb).
export type Linea = { texto: string; peso: number; px: number; rgb: string; x: number; yb: number; T: Texto };
export const linea = (texto: string, peso: number, px: number, rgb: string, x: number, yb: number): Linea => ({
  texto, peso, px, rgb, x, yb, T: rasterizar(texto, px, peso, rgb, TRACK),
});
// La misma línea como pieza centrada (para armar con tramos en src/titulos.ts).
export const pieza = (L: Linea): Pieza => ({ T: L.T, x: L.x - L.T.pad + L.T.w / 2, y: L.yb - L.T.base + L.T.h / 2 });
export const ajusta = (texto: string, ancho: number, peso: number, max: number) => Math.min(max, tamPara(texto, ancho, peso, TRACK));

// Rebanadas (v2): la línea entra en bandas horizontales desde lados alternos, seco (0,18 s), y sale igual en t1.
export const rebanadas = (ctx: Ctx, L: Linea, t: number, t0: number, t1: number, bandas = 5, a = 1) => {
  if (t < t0 || t >= t1 || a <= 0.004) return;
  const { T } = L;
  const x0 = L.x - T.pad;
  const y0 = L.yb - T.base;
  ctx.save();
  ctx.globalAlpha = a;
  for (let b = 0; b < bandas; b++) {
    const k = eOut(pr(t, t0 + b * 0.018, 0.18));
    const sale = eIn(pr(t, t1 - 0.15 + b * 0.01, 0.13));
    const dir = b % 2 ? 1 : -1;
    const dx = dir * ((1 - k) - sale) * L.px * 2.4;
    const sy = (b / bandas) * T.h;
    const sh = T.h / bandas;
    ctx.drawImage(T.c, 0, Math.floor(sy * SS), T.c.width, Math.ceil(sh * SS), x0 + dx, y0 + sy, T.w, Math.ceil(sh * SS) / SS);
  }
  ctx.restore();
};

// Posición de cada carácter de la línea (mismo font y tracking que el raster).
const cachePos = new Map<string, number[]>();
const posiciones = (ctx: Ctx, L: Linea) => {
  const k = `${L.texto}|${L.px}|${L.peso}`;
  const c = cachePos.get(k);
  if (c) return c;
  ctx.save();
  ctx.font = `${L.peso} ${L.px}px "${SANS}"`;
  ctx.letterSpacing = `${TRACK * L.px}px`;
  const chars = [...L.texto];
  const xs = chars.map((_, i) => ctx.measureText(chars.slice(0, i).join("")).width);
  ctx.restore();
  if (document.fonts.check(`${L.peso} 40px "${SANS}"`)) cachePos.set(k, xs);
  return xs;
};
const DIGITOS = "0123456789";
// Decodificación (v2): desde tG − 0,5 s los caracteres aparecen como dígitos que cambian en cada cuadro (gris) y se
// resuelven en la palabra justo en el golpe tG. Después queda el raster nítido hasta t1 (a = alfa de salida).
export const decodifica = (ctx: Ctx, L: Linea, t: number, tG: number, t1: number, a = 1) => {
  const t0 = tG - 0.5;
  if (t < t0 || t >= t1 || a <= 0.004) return;
  if (t >= tG - 1e-6) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.drawImage(L.T.c, L.x - L.T.pad, L.yb - L.T.base, L.T.w, L.T.h);
    ctx.restore();
    return;
  }
  const xs = posiciones(ctx, L);
  const chars = [...L.texto];
  const paso = Math.floor(t * 30);
  ctx.save();
  ctx.font = `${L.peso} ${L.px}px "${SANS}"`;
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = a;
  chars.forEach((ch, i) => {
    const aparece = t0 + (i / chars.length) * 0.25;
    if (t < aparece || ch === " ") return;
    const fijo = ch === "." || ch === ",";
    // los dígitos aparecen con un fundido corto (sin saltos fuera del golpe)
    const k = Math.min(1, (t - aparece) / 0.22);
    ctx.fillStyle = fijo ? rgba(L.rgb, k) : rgba("244,245,248", 0.48 * k);
    ctx.fillText(fijo ? ch : DIGITOS[Math.floor(azar(i * 7 + paso) * 10)], L.x + xs[i], L.yb);
  });
  ctx.restore();
};

// Anotación técnica (v2, «Codigo»): mono pequeña en mayúsculas; cada carácter entra como un glifo azul que cambia y se
// asienta en 0,1 s. Sale en t1 con un fundido corto.
const GLIFOS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+−=·/";
export const codigo = (ctx: Ctx, texto: string, x: number, y: number, t: number, t0: number, t1: number, o: { size?: number; rgb?: string; a?: number; espaciado?: number; mayus?: boolean } = {}) => {
  if (t < t0 || t >= t1) return;
  const size = o.size ?? 13;
  const a = (o.a ?? 0.5) * (1 - pr(t, t1 - 0.12, 0.12));
  if (a <= 0.004) return;
  const chars = [...(o.mayus === false ? texto : texto.toUpperCase())];
  const paso = Math.floor(t * 30);
  ctx.save();
  ctx.font = `400 ${size}px "${MONO}"`;
  ctx.letterSpacing = `${size * (o.espaciado ?? 0.16)}px`;
  ctx.textBaseline = "alphabetic";
  let cx = x;
  chars.forEach((ch, i) => {
    const ti = t0 + i * 0.012;
    const w = ctx.measureText(ch).width;
    if (t >= ti && ch !== " ") {
      const listo = t >= ti + 0.1;
      ctx.fillStyle = listo ? rgba(o.rgb ?? "244,245,248", a) : rgba("91,134,255", Math.min(1, a * 1.6));
      ctx.fillText(listo ? ch : GLIFOS[Math.floor(azar(i * 7 + paso) * GLIFOS.length)], cx, y);
    }
    cx += w;
  });
  ctx.restore();
};
