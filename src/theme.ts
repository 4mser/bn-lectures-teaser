import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Lenguaje visual de B&N Lectures (heredado de los reels de B&N Lab): fondo negro, trazos que brillan, títulos en
// Space Grotesk y rótulos en IBM Plex Mono. Las dimensiones de cada formato están en src/disposicion.ts.
export type Formato = "vertical" | "horizontal" | "alto";
export const formato = (width: number, height: number): Formato => (width > height ? "horizontal" : height > width * 1.5 ? "alto" : "vertical");

export const C = {
  fondo: "#020306",
  texto: "#F4F5F8",
  texto2: "rgba(244,245,248,.74)",
  texto3: "rgba(244,245,248,.48)",
  texto4: "rgba(244,245,248,.30)",
  azul: "#5B86FF",
};
// Colores del canvas como "r,g,b", para armar rgba con alfa variable.
export const RGB = {
  pos: "70,122,255",
  neg: "255,176,72",
  hielo: "205,218,255",
  blanco: "244,245,248",
  azul: "91,134,255",
  malla: "64,110,255",
};

// Supermuestreo del lienzo: se dibuja al doble y el navegador lo reduce (bordes limpios, sin tiriteo).
export const SS = 2;
export const SANS = "Space Grotesk";
export const MONO = "IBM Plex Mono";

for (const w of ["300", "400", "500", "600", "700"]) {
  loadFont({ family: SANS, url: staticFile(`fonts/grotesk-${w}.woff2`), weight: w });
}
for (const w of ["400", "500"]) {
  loadFont({ family: MONO, url: staticFile(`fonts/plex-${w}.woff2`), weight: w });
}
// Curvas: todo se calcula desde t, sin estado.
export const cl = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const pr = (t: number, a: number, d: number) => cl((t - a) / d);
export const eOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const eIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
// Lleva un valor de a a b entre t0 y t0 + d con la curva eIO (para los parámetros de las simulaciones).
export const tramo = (t: number, t0: number, d: number, a: number, b: number) => lerp(a, b, eIO(pr(t, t0, d)));
// Número con coma decimal, como se escribe en Chile.
export const num = (v: number, d = 2) => v.toFixed(d).replace(".", ",").replace("-", "−");
