// Uso: node herramientas/parte.mjs <build> <desde> <hasta> <salida> [concurrencia]
//      node herramientas/parte.mjs <build> audio <salida.wav>
// Renderiza un tramo del video sin audio (o solo el audio) desde un bundle ya hecho, en un proceso aparte,
// para poder reintentar tramos sueltos cuando la máquina anda corta de memoria.
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";

// La composición sale de COMPOSICION (Clase por omisión; ClaseYT es la versión horizontal).
const [build, a, b, c, d] = process.argv.slice(2);
const serveUrl = path.resolve(build);
const composition = await selectComposition({ serveUrl, id: process.env.COMPOSICION ?? "Clase", logLevel: "error", chromiumOptions: { gl: "angle" } });
if (a === "audio") {
  await renderMedia({ composition, serveUrl, codec: "wav", outputLocation: b, logLevel: "error" });
} else {
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 18,
    muted: true,
    imageFormat: "jpeg",
    jpegQuality: 92,
    frameRange: [Number(a), Number(b)],
    outputLocation: c,
    concurrency: Number(d ?? 2),
    logLevel: "error",
    disallowParallelEncoding: false,
    chromiumOptions: { gl: "angle" },
    timeoutInMilliseconds: 120000,
  });
}
console.log("listo", a, b);
