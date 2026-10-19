import { formato, type Formato, eIO, lerp, pr } from "./theme";
import { seccion } from "./ritmo";

// Dónde va cada cosa en cada formato. No se escala una composición a otra: cada formato tiene su propia
// zona visual (vis), su bloque de texto, el lugar del logo final, el marco de los destellos de la serie y el cromo.
//  · 4:5 (1080×1350): visual arriba, texto abajo (la aprobada; no cambia).
//  · 16:9 (1920×1080): sin texto el visual va al centro y aprovecha el alto; con texto (PREGUNTA, BUSCAR, TÚ) el
//    texto va en una columna a la izquierda y el visual se corre a la derecha, con un paneo suave en los cambios.
//  · 9:16 (1080×1920): sin texto el visual va al centro de la zona segura de TikTok y aprovecha el alto; con texto
//    sube y el texto va debajo. Nada en los 200 px de arriba ni en los 380 de abajo, y nada importante en los 140 px de
//    la derecha entre y = 900 y y = 1600.
// Las escenas WebGL (Lorenz, ADN, prisma) se centran en el cuadro con su propia escala (gl, px por unidad del mundo).
export type Disp = {
  fmt: Formato;
  W: number;
  H: number;
  vis: { cx: number; cy: number; r: number };
  txt: { x: number; y: number; w: number; size: number; centrado: boolean };
  logo: { cx: number; cy: number; s: number; y2: number };
  clip: { w: number; h: number; suf: string; fx: number; fy: number; esc: number };
  cromo: { arriba: number; abajo: number; x0: number; x1: number };
  cargasY: number; // altura de las cargas del final (la foto de perfil)
  campo: string; // textura LIC del campo de dos cargas (herramientas/lic_animada.py)
  gl: number; // px por unidad del mundo en las escenas WebGL centradas en el cuadro (4:5: 0,5·H = 675)
  sim: string; // sufijo de las simulaciones precalculadas (public/sim/q<sim>, public/sim/gs<sim>)
  curvaK: number; // factor de la curvatura de CRT (el arco del borde largo mide en px lo mismo que en 4:5)
  esquinaK: number; // factor del radio de las esquinas del tubo (mismo radio en px que en 4:5)
};

type Vis = Disp["vis"];
// Tramos con texto (segundos de escena): [entra, dura, sale, dura]. El visual se corre al lugar «con texto» antes de
// que entre la frase y vuelve al centro cuando sale (frase 1: hasta el orbital; 2: la búsqueda; 3: el TÚ).
const S = seccion;
const TRAMOS_TEXTO: [number, number, number, number][] = [
  [-10, 1, S("orbital") + 0.1, 1.0],
  [S("busqueda") - 0.8, 0.8, S("teseracto") - 0.3, 1.0],
  [S("silencio") - 0.8, 0.8, S("final") - 0.45, 1.05],
];
export const conTexto = (t: number) => TRAMOS_TEXTO.reduce((m, [a, da, b, db]) => Math.max(m, eIO(pr(t, a, da)) * (1 - eIO(pr(t, b, db)))), 0);
const mezcla = (a: Vis, b: Vis, u: number): Vis => ({ cx: lerp(a.cx, b.cx, u), cy: lerp(a.cy, b.cy, u), r: lerp(a.r, b.r, u) });

export const disposicion = (W: number, H: number, t = 0): Disp => {
  const fmt = formato(W, H);
  if (fmt === "horizontal")
    return {
      fmt, W, H,
      vis: mezcla({ cx: 960, cy: 540, r: 420 }, { cx: 1320, cy: 540, r: 380 }, conTexto(t)),
      txt: { x: 128, y: 540, w: 640, size: 92, centrado: true },
      logo: { cx: 960, cy: 540 - 43 * 1.12, s: 1.12, y2: 830 },
      clip: { w: 1000, h: 640, suf: "-16x9", fx: 1330, fy: 560, esc: 0.78 },
      cromo: { arriba: 52, abajo: H - 52, x0: 128, x1: W - 128 },
      cargasY: 540,
      campo: "img/campo-169.png",
      gl: 630,
      sim: "-169",
      curvaK: 0.7,
      esquinaK: 1350 / H,
    };
  if (fmt === "alto")
    return {
      fmt, W, H,
      vis: mezcla({ cx: 540, cy: 890, r: 470 }, { cx: 540, cy: 740, r: 420 }, conTexto(t)),
      txt: { x: 72, y: 1214, w: 860, size: 98, centrado: false },
      logo: { cx: 540, cy: 917, s: 1, y2: 1290 },
      clip: { w: 900, h: 700, suf: "-9x16", fx: 540, fy: 935, esc: 1.0 },
      cromo: { arriba: 236, abajo: 1528, x0: 72, x1: W - 72 },
      cargasY: 960,
      campo: "img/campo-916.png",
      gl: 700,
      sim: "-916",
      curvaK: 0.7,
      esquinaK: 1350 / H,
    };
  return {
    fmt, W, H,
    vis: { cx: 540, cy: 545, r: 450 },
    txt: { x: 72, y: 1150, w: 936, size: 94, centrado: false },
    // el final calza con la foto de perfil: cargas a y = 675 y la marca 43 px más arriba (src/final.ts)
    logo: { cx: 540, cy: 632, s: 1, y2: 1005 },
    clip: { w: 860, h: 620, suf: "", fx: 540, fy: 650, esc: 0.9 },
    cromo: { arriba: 46, abajo: H - 46, x0: 72, x1: W - 72 },
    cargasY: 675,
    campo: "img/campo-45.png",
    gl: H / 2,
    sim: "",
    curvaK: 1,
    esquinaK: 1,
  };
};
