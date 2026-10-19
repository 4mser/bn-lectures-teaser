// Uso: node herramientas/cuadros.mjs <carpeta> <cuadro1,cuadro2,...> [composicion]
// Empaqueta una vez y saca cada cuadro como PNG, para revisar el diseño sin renderizar el video entero.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const [carpeta, lista, id = "Clase"] = process.argv.slice(2);
fs.mkdirSync(carpeta, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), rspack: true });
const ids = id.split(",");
for (const cid of ids) {
  const inputProps = process.env.LOOK ? { look: process.env.LOOK } : {};
  const composition = await selectComposition({ serveUrl, id: cid, chromiumOptions: { gl: "angle" }, inputProps });
  const cuadros = cid.startsWith("Clase") ? lista.split(",").map(Number) : [0];
  for (const frame of cuadros) {
    const output = path.join(carpeta, cid.startsWith("Clase") ? `f${String(frame).padStart(5, "0")}.png` : `${cid}.png`);
    await renderStill({ composition, serveUrl, output, frame, imageFormat: "png", chromiumOptions: { gl: "angle" }, inputProps });
    console.log("listo", output);
  }
}
