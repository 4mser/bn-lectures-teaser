// Trazos de las simulaciones con el estilo del reel de B&N Lab: brillo aditivo sobre negro, líneas finas,
// partículas que corren por las líneas de campo y rótulos en mono. Todo es función pura de sus argumentos
// (incluido t): sin estado entre cuadros, para que el render en paralelo saque siempre el mismo cuadro.
import { MONO, RGB } from "../theme";

export const TAU = Math.PI * 2;
type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

export const rgba = (rgb: string, a: number) => `rgba(${rgb},${Math.max(0, Math.min(1, a))})`;
// Pseudoaleatorio determinista en [0, 1).
export const azar = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const aditivo = (ctx: Ctx, f: () => void) => {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  f();
  ctx.restore();
};

// Halo radial.
export const brillo = (ctx: Ctx, x: number, y: number, r: number, rgb: string, a: number) => {
  if (a <= 0.004 || r <= 0) return;
  aditivo(ctx, () => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(rgb, a));
    g.addColorStop(0.22, rgba(rgb, a * 0.38));
    g.addColorStop(0.55, rgba(rgb, a * 0.1));
    g.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  });
};

// Carga que brilla: halo amplio, núcleo blanco y un destello en cruz que late apenas.
export const carga = (ctx: Ctx, x: number, y: number, s: number, rgb: string, a = 1, t = 0) => {
  if (a <= 0.01) return;
  const late = 1 + 0.06 * Math.sin(t * 2.3 + x * 0.01);
  brillo(ctx, x, y, s * 11 * late, rgb, 0.32 * a);
  brillo(ctx, x, y, s * 3.4, rgb, 0.95 * a);
  aditivo(ctx, () => {
    for (const ang of [0, Math.PI / 2]) {
      const largo = s * 7.5 * late;
      const dx = Math.cos(ang) * largo;
      const dy = Math.sin(ang) * largo;
      const g = ctx.createLinearGradient(x - dx, y - dy, x + dx, y + dy);
      g.addColorStop(0, rgba(rgb, 0));
      g.addColorStop(0.5, rgba("235,242,255", 0.75 * a));
      g.addColorStop(1, rgba(rgb, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1, s * 0.18);
      ctx.beginPath();
      ctx.moveTo(x - dx, y - dy);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
    }
  });
  ctx.fillStyle = rgba("250,252,255", a);
  ctx.beginPath();
  ctx.arc(x, y, s * 0.62, 0, TAU);
  ctx.fill();
};

// Chispa: un punto chico con su halo (las «cargas» de una distribución, o las partículas del campo).
export const chispa = (ctx: Ctx, x: number, y: number, r: number, rgb: string, a: number) => {
  if (a <= 0.01) return;
  brillo(ctx, x, y, r * 5, rgb, 0.45 * a);
  ctx.fillStyle = rgba("240,245,255", a);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
};

export const linea = (ctx: Ctx, pts: Pt[], rgb: string, a: number, ancho = 1, guion?: number[]) => {
  if (a <= 0.004 || pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = rgba(rgb, a);
  ctx.lineWidth = ancho;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (guion) ctx.setLineDash(guion);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.restore();
};

// Trazo con brillo: halo ancho y tenue, cuerpo y núcleo (líneas presentes, sin el tiriteo de 1 px).
export const trazo = (ctx: Ctx, pts: Pt[], rgb: string, a: number, ancho = 2) => {
  linea(ctx, pts, rgb, a * 0.09, ancho * 5.5);
  linea(ctx, pts, rgb, a * 0.26, ancho * 2.4);
  linea(ctx, pts, rgb, a, ancho);
};
// Lote de segmentos: se agrupan por color, alfa (cuantizado) y ancho, y cada grupo se traza en una sola pasada con
// su brillo. Para mallas de miles de segmentos.
export const lote = () => {
  const g = new Map<string, { rgb: string; a: number; w: number; s: number[] }>();
  return {
    add(x0: number, y0: number, x1: number, y1: number, rgb: string, a: number, w: number) {
      if (a <= 0.01) return;
      const aq = Math.round(a * 24) / 24;
      const k = `${rgb}|${aq}|${w}`;
      let e = g.get(k);
      if (!e) g.set(k, (e = { rgb, a: aq, w, s: [] }));
      e.s.push(x0, y0, x1, y1);
    },
    draw(ctx: Ctx, brilloK = 1) {
      ctx.save();
      ctx.lineCap = "round";
      for (const pasada of brilloK > 0 ? [[5, 0.08 * brilloK], [2.3, 0.24 * brilloK], [1, 1]] : [[1, 1]])
        for (const e of g.values()) {
          ctx.strokeStyle = rgba(e.rgb, e.a * pasada[1]);
          ctx.lineWidth = e.w * pasada[0];
          ctx.beginPath();
          for (let i = 0; i < e.s.length; i += 4) {
            ctx.moveTo(e.s[i], e.s[i + 1]);
            ctx.lineTo(e.s[i + 2], e.s[i + 3]);
          }
          ctx.stroke();
        }
      ctx.restore();
    },
  };
};

// Partículas que recorren una polilínea a velocidad vel (px/s), entrando y saliendo con fundido.
export const particulas = (ctx: Ctx, pts: Pt[], t: number, vel: number, n: number, rgb: string, a: number, semilla = 0, r = 1.6) => {
  if (a <= 0.01 || pts.length < 2) return;
  const acum = [0];
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acum[acum.length - 1];
  if (total < 1) return;
  for (let k = 0; k < n; k++) {
    const u = (((t * vel) / total + azar(semilla * 31 + k * 7.3)) % 1 + 1) % 1;
    const s = u * total;
    let i = 1;
    while (i < acum.length - 1 && acum[i] < s) i++;
    const f = (s - acum[i - 1]) / Math.max(1e-6, acum[i] - acum[i - 1]);
    const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f;
    const y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f;
    const fundido = Math.min(1, u * 6, (1 - u) * 4);
    chispa(ctx, x, y, r * (0.7 + 0.6 * azar(semilla + k)), rgb, a * fundido);
  }
};

// Rayos radiales desde una carga puntual, que se apagan con la distancia, con partículas que salen.
export const rayos = (ctx: Ctx, x: number, y: number, n: number, r0: number, r1: number, t: number, a: number, rgb = RGB.hielo, fase = 0.13) => {
  if (a <= 0.01) return;
  for (let j = 0; j < n; j++) {
    const ang = (j / n) * TAU + fase;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const g = ctx.createLinearGradient(x + c * r0, y + s * r0, x + c * r1, y + s * r1);
    g.addColorStop(0, rgba(rgb, 0.34 * a));
    g.addColorStop(1, rgba(rgb, 0));
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + c * r0, y + s * r0);
    ctx.lineTo(x + c * r1, y + s * r1);
    ctx.stroke();
    ctx.restore();
    particulas(ctx, [[x + c * r0, y + s * r0], [x + c * r1, y + s * r1]], t, 70, 2, rgb, a * 0.8, j + 1, 1.5);
  }
};

// Flecha con brillo: un trazo ancho y tenue debajo, uno fino encima y la cabeza rellena.
export const flecha = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, rgb: string, a = 1, ancho = 2.5, cabeza = 16, guion?: number[]) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const largo = Math.hypot(dx, dy);
  if (largo < 0.5 || a <= 0.01) return;
  const c = Math.min(cabeza, largo * 0.45);
  const ux = dx / largo;
  const uy = dy / largo;
  const bx = x1 - ux * c * 0.8;
  const by = y1 - uy * c * 0.8;
  aditivo(ctx, () => linea(ctx, [[x0, y0], [bx, by]], rgb, a * 0.22, ancho * 4));
  linea(ctx, [[x0, y0], [bx, by]], rgb, a, ancho, guion);
  ctx.save();
  ctx.fillStyle = rgba(rgb, a);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * c - uy * c * 0.45, y1 - uy * c + ux * c * 0.45);
  ctx.lineTo(x1 - ux * c + uy * c * 0.45, y1 - uy * c - ux * c * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

// Rótulo mono en mayúsculas, como «DISTANCIA 2d» en el reel.
export const rotulo = (ctx: Ctx, s: string, x: number, y: number, o: { size?: number; rgb?: string; a?: number; align?: CanvasTextAlign; peso?: number } = {}) => {
  const a = o.a ?? 1;
  if (a <= 0.01) return;
  const size = o.size ?? 15;
  ctx.save();
  ctx.font = `${o.peso ?? 400} ${size}px "${MONO}"`;
  ctx.letterSpacing = `${size * 0.18}px`;
  ctx.fillStyle = rgba(o.rgb ?? RGB.blanco, 0.62 * a);
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.fillText(s.toUpperCase(), x, y);
  ctx.restore();
};

// Una variable en cursiva matemática (KaTeX_Math) con subíndice opcional: θ₀, x₀, dq…
export const variable = (ctx: Ctx, base: string, sub: string, x: number, y: number, size: number, rgb: string, a = 1, align: CanvasTextAlign = "left") => {
  if (a <= 0.01) return;
  ctx.save();
  ctx.font = `italic ${size}px KaTeX_Math`;
  const wb = ctx.measureText(base).width;
  ctx.font = `${size * 0.68}px KaTeX_Main`;
  const ws = sub ? ctx.measureText(sub).width : 0;
  const total = wb + (sub ? ws + 1 : 0);
  const x0 = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  ctx.fillStyle = rgba(rgb, a);
  ctx.textBaseline = "middle";
  ctx.font = `italic ${size}px KaTeX_Math`;
  ctx.fillText(base, x0, y);
  if (sub) {
    ctx.font = `${size * 0.68}px KaTeX_Main`;
    ctx.fillText(sub, x0 + wb + 1, y + size * 0.3);
  }
  ctx.restore();
};

// El punto de observación P: punto blanco con un anillo y su rótulo.
export const puntoP = (ctx: Ctx, x: number, y: number, a = 1, rotuloP = "P", dx = 16, dy = -16) => {
  if (a <= 0.01) return;
  brillo(ctx, x, y, 26, RGB.blanco, 0.25 * a);
  ctx.fillStyle = rgba(RGB.blanco, a);
  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(RGB.blanco, 0.4 * a);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, TAU);
  ctx.stroke();
  if (rotuloP) variable(ctx, rotuloP, "", x + dx, y + dy, 30, RGB.blanco, a);
};

// Arco de ángulo con centro (cx,cy) entre a0 y a1 (radianes, sentido de canvas).
export const angulo = (ctx: Ctx, cx: number, cy: number, r: number, a0: number, a1: number, rgb: string, a: number, ancho = 1.5) => {
  if (a <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = rgba(rgb, a);
  ctx.lineWidth = ancho;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.min(a0, a1), Math.max(a0, a1));
  ctx.stroke();
  ctx.restore();
};

// Línea cargada continua: un tubo de luz con su halo, y chispas que titilan encima.
export const barraLuz = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, rgb: string, a: number, t: number, grosor = 5) => {
  if (a <= 0.01) return;
  aditivo(ctx, () => {
    linea(ctx, [[x0, y0], [x1, y1]], rgb, 0.1 * a, grosor * 9);
    linea(ctx, [[x0, y0], [x1, y1]], rgb, 0.22 * a, grosor * 3.5);
    linea(ctx, [[x0, y0], [x1, y1]], rgb, 0.85 * a, grosor);
  });
  linea(ctx, [[x0, y0], [x1, y1]], "235,242,255", 0.85 * a, grosor * 0.35);
  const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 26);
  for (let k = 0; k < n; k++) {
    const u = azar(k * 3.1 + 5);
    const titila = 0.5 + 0.5 * Math.sin(t * (1.5 + 2 * azar(k)) + k);
    chispa(ctx, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 1.3, rgb, a * 0.8 * titila);
  }
};

// Traza una línea de campo de un conjunto de cargas puntuales, desde (x0,y0), con paso h.
// signo = 1 sigue al campo; −1 va en contra. Se corta al salir de la caja o al llegar a una carga.
export type Fuente = { x: number; y: number; q: number };
export const trazar = (fuentes: Fuente[], x0: number, y0: number, signo: number, pasos: number, h: number, caja: [number, number, number, number]): Pt[] => {
  const pts: Pt[] = [[x0, y0]];
  let x = x0;
  let y = y0;
  const campo = (px: number, py: number): Pt => {
    let ex = 0;
    let ey = 0;
    for (const f of fuentes) {
      const dx = px - f.x;
      const dy = py - f.y;
      const r2 = dx * dx + dy * dy + 1e-3;
      const k = f.q / (r2 * Math.sqrt(r2));
      ex += k * dx;
      ey += k * dy;
    }
    return [ex, ey];
  };
  for (let i = 0; i < pasos; i++) {
    // Punto medio (RK2) con el campo normalizado: avanza siempre h píxeles.
    const [ax, ay] = campo(x, y);
    const na = Math.hypot(ax, ay) || 1;
    const mx = x + (signo * h * ax) / na / 2;
    const my = y + (signo * h * ay) / na / 2;
    const [bx, by] = campo(mx, my);
    const nb = Math.hypot(bx, by) || 1;
    x += (signo * h * bx) / nb;
    y += (signo * h * by) / nb;
    pts.push([x, y]);
    if (x < caja[0] || x > caja[2] || y < caja[1] || y > caja[3]) break;
    if (fuentes.some((f) => f.q * signo < 0 && Math.hypot(x - f.x, y - f.y) < h * 1.5)) break;
  }
  return pts;
};
