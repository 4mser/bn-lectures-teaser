import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { disposicion, type Disp } from "./disposicion";
import { auxiliar, colaEstallido, cuadroGS, cuadroQ, dibujar, rotulos, type Recursos } from "./escenas";
import { postProceso, zoomGL } from "./gl";
import { MEDIO_CUADRO, NOTAS_LECTURES, T_CONV, T_MARCA, derivaCierre, dibujarFinal, marcaLuz, marcaNitida } from "./final";
import { azar } from "./lab/luz";
import { FPS, REAL, RITMO, TOTAL, T_FINAL, escena, golpe, golpesDe, seccion, ultimoEn } from "./ritmo";
import { C, MONO, SANS, SS, eIO, eOut, lerp, pr } from "./theme";

const S = seccion;
// Dos intensidades del look (src/gl.ts, POST_FINAL). LOOK elige cuál se usa.
const DROPS = [...new Set([...(RITMO.drops as number[]), ...RITMO.efectos.filter((e) => e.tipo === "impacto_fuerte" || e.tipo === "impacto").map((e) => e.t)])].sort((a, b) => a - b);
export const LOOKS = {
  sutil: { bloom: 0.34, halo: 0.6, aberr: 0.012, vineta: 0.3, grano: 0.03, scan: 0.07, curva: 0.035, ruido: 0.5, flicker: 0.012, grade: 0.8, imp: 0.6, lineaA: 0.5 },
  marcada: { bloom: 0.48, halo: 1.0, aberr: 0.02, vineta: 0.4, grano: 0.045, scan: 0.14, curva: 0.07, ruido: 1.0, flicker: 0.025, grade: 1.0, imp: 1.0, lineaA: 0.9 },
  // v1j: el look que se nota (scanlines de 3 px, más halo de fósforo, CRT, cinta y gradación azul/cálida)
  retro: { bloom: 0.62, halo: 1.4, aberr: 0.042, vineta: 0.66, grano: 0.075, scan: 0.34, curva: 0.16, ruido: 1.5, flicker: 0.035, grade: 2.4, imp: 1.0, lineaA: 1.0 },
};
let LOOK: keyof typeof LOOKS = "retro";
export const usarLook = (l: keyof typeof LOOKS) => (LOOK = l);
// v1o-c: capa de reacción a la canción real (en segundos de la canción). Cada nota del ostinato de cuerdas manda un
// brillo fino que cruza las luces del cuadro en 0,16 s (más fuerte en los acentos 3+3+2, con dirección que alterna);
// cada golpe de batería, un barrido ancho que sube, un poco más de halo y un empuje de cámara de 0,7 % con easing.
const ACENTOS = new Set(REAL.acentos);
// hasta la convergencia en la marca: el cierre con el logo queda como en la aprobada
const T_FINAL_CANCION = (RITMO.seccionesCancion as { id: string; t: number | null }[]).find((s) => s.id === "coda")?.t ?? Infinity;
const reaccion = (ts: number, t: number) => {
  const r = { tic: 0, ticPos: -1, ticAng: 0, bat: 0, batPos: -1, empuje: 0 };
  if (ts >= T_FINAL_CANCION) return r;
  // v1o-d: el fluido y los fractales quedan como en la aprobada (el plano final reacciona dentro de su escena)
  if (t >= S("fluido") - 0.3 && t < S("lorenz")) return r;
  const i = ultimoEn(REAL.cuerdas, ts);
  if (i >= 0) {
    const e = ts - REAL.cuerdas[i];
    const ac = ACENTOS.has(REAL.cuerdas[i]);
    r.tic = Math.exp(-e * 12) * (ac ? 1 : 0.55);
    r.ticPos = e / 0.16;
    r.ticAng = ((i % 4) * Math.PI) / 4 + 0.3;
  }
  const j = ultimoEn(REAL.bateria, ts);
  if (j >= 0) {
    const e = ts - REAL.bateria[j];
    r.bat = Math.exp(-e * 6);
    r.batPos = e / 0.38;
    r.empuje = 0.007 * Math.min(1, e / 0.06) * Math.exp(-e * 4);
  }
  return r;
};
const lookPost = (t: number, frame: number, d: Disp) => {
  const pedido = (getInputProps() as { look?: keyof typeof LOOKS }).look;
  const L = LOOKS[pedido && LOOKS[pedido] ? pedido : LOOK];
  const imp = DROPS.reduce((a, x) => (t >= x ? Math.max(a, Math.exp(-(t - x) * 9)) : a), 0);
  // en cada drop una línea de interferencia cruza de abajo arriba en 0,4 s
  let lineaY = -1;
  let lineaA = 0;
  for (const x of DROPS) if (t >= x && t < x + 0.4) {
    lineaY = (t - x) / 0.4;
    lineaA = L.lineaA * Math.sin(Math.PI * (t - x) / 0.4);
  }
  // en la marca final el look queda, pero más leve (scanlines, aberración y grano), para que el logo se lea nítido
  const leve = 1 - 0.4 * eOut(pr(t, T_CONV + 0.6, 1.0));
  // en los fractales (36-41,5 s) solo se aplana la pantalla para que el fractal llegue a los bordes (casi sin
  // curvatura ni esquinas de tubo, viñeta suave) y el bloom baja apenas para no quemar las bandas finas
  // v1o: en el fluido y los fractales, un 17 % menos de exposición y de bloom (v1o-d: un 12 % menos todavía)
  const fr = eIO(pr(t, S("fluido") - 0.25, 0.4)) * (1 - eIO(pr(t, S("lorenz") - 0.2, 0.4)));
  return { ...reaccion((frame + 0.5) / FPS, t), px: SS, semilla: frame % 97, bloom: L.bloom * lerp(1, 0.7, 1 - leve) * lerp(1, 0.62, fr), expo: lerp(0.95, 0.69, fr), aberr: L.aberr * leve, vineta: L.vineta * lerp(1, 0.35, fr), grano: L.grano * leve, scan: L.scan * leve, curva: L.curva * lerp(1, 0.25, fr) * d.curvaK, esq: L.curva * lerp(1, 0.25, fr) * d.esquinaK, impacto: imp * L.imp, ruido: L.ruido, flicker: L.flicker, lineaY, lineaA, grade: L.grade, tiempo: t, halo: L.halo };
};

// ── Imágenes: la textura LIC fija, la marca, la LIC animada del cierre y los cuadros de Gray-Scott ──
const useImagen = (src: string) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [handle] = useState(() => delayRender(`img ${src}`));
  useEffect(() => {
    const i = new Image();
    i.onload = () => {
      setImg(i);
      continueRender(handle);
    };
    i.onerror = () => continueRender(handle);
    i.src = staticFile(src);
  }, [src, handle]);
  return img;
};
// Un cuadro que cambia en cada cuadro del video: se carga con su propio delayRender y se guardan pocos en memoria.
const cuadros = new Map<string, HTMLImageElement>();
const useCuadro = (src: string | null) => {
  const [listo, setListo] = useState<string | null>(null);
  const handle = useMemo(() => (src && !cuadros.get(src)?.complete ? delayRender(`cuadro ${src}`) : null), [src]);
  useEffect(() => {
    if (!src) return;
    let hecho = false;
    const fin = () => {
      if (hecho) return;
      hecho = true;
      setListo(src);
      if (handle !== null) continueRender(handle);
    };
    let i = cuadros.get(src);
    if (i && i.complete) {
      fin();
      return;
    }
    if (!i) {
      i = new Image();
      cuadros.set(src, i);
      i.src = staticFile(src);
      while (cuadros.size > 12) cuadros.delete(cuadros.keys().next().value as string);
    }
    i.addEventListener("load", fin);
    i.addEventListener("error", fin);
    const img = i;
    return () => {
      img.removeEventListener("load", fin);
      img.removeEventListener("error", fin);
      if (!hecho && handle !== null) continueRender(handle);
    };
  }, [src, handle]);
  return src && listo === src ? (cuadros.get(src) ?? null) : null;
};
const N_LIC = 60;

// ── Lienzo: toda la cadena generativa (supermuestreada), aberración cromática en los impactos y grano fino ──
const IMPACTOS: [number, number][] = [
  [S("toro"), 6],
  [S("fluido"), 7],
  [S("tu"), 8],
  ...RITMO.palmas.filter((p) => p > S("mandelbrot") && p < S("lorenz")).map((p) => [p, 3] as [number, number]),
];
const aberracion = (t: number) => IMPACTOS.reduce((a, [ti, k]) => (t >= ti ? Math.max(a, k * Math.exp(-(t - ti) * 13)) : a), 0);
const ruidos: HTMLCanvasElement[] = [];
const ruido = (k: number) => {
  if (!ruidos[k]) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const x = c.getContext("2d")!;
    const img = x.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = Math.floor(azar(i * 0.37 + k * 1000.1) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    ruidos[k] = c;
  }
  return ruidos[k];
};
type Imgs = { lic: HTMLImageElement | null; campo: HTMLImageElement | null; marca: HTMLImageElement | null; gs: HTMLImageElement | null; q: HTMLImageElement | null; gsFin: HTMLImageElement | null };
const Lienzo: React.FC<{ t: number; d: Disp; frame: number; im: Imgs }> = ({ t, d, frame, im }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(SS, 0, 0, SS, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.fillStyle = t >= T_FINAL ? "#000" : C.fondo;
    ctx.fillRect(0, 0, d.W, d.H);
    if (t >= T_FINAL) {
      // El final aprobado se dibuja tal cual, en su propio lienzo a 1×, y se compone aquí.
      const fin = auxiliar(d.W, d.H, "final");
      const fx = fin.getContext("2d")!;
      fx.setTransform(1, 0, 0, 1, 0, 0);
      fx.globalCompositeOperation = "source-over";
      fx.globalAlpha = 1;
      fx.filter = "none";
      fx.fillStyle = "#000";
      fx.fillRect(0, 0, d.W, d.H);
      dibujarFinal(fx, d, t, im.lic ?? im.campo, im.marca);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(fin, 0, 0, d.W, d.H);
      if (t < T_FINAL + 1.45) colaEstallido(ctx, d, t);
      // la marca B&N es el resultado de las partículas: se dibuja aquí, a resolución supermuestreada, bajo el look
      marcaLuz(ctx, d, t, im.marca, SS);
    } else {
      const rec: Recursos = { gs: im.gs, q: im.q, gsFin: im.gsFin };
      dibujar(ctx, d, t, rec);
    }
    {
      // Look retro-futurista de cine en todo el video (también el final; el logo va en HTML encima y queda nítido)
      const pp = postProceso(ctx.canvas, d.W * SS, d.H * SS, lookPost(t, frame, d));
      if (pp) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "copy";
        ctx.drawImage(pp, 0, 0);
        ctx.restore();
      }
      if (t >= T_FINAL) {
        const pedido = (getInputProps() as { look?: keyof typeof LOOKS }).look;
        marcaNitida(ctx, d, t, im.marca, SS, LOOKS[pedido && LOOKS[pedido] ? pedido : LOOK].curva * d.curvaK);
      }
      return;
    }
  });
  return <canvas ref={ref} width={d.W * SS} height={d.H * SS} style={{ position: "absolute", left: 0, top: 0, width: d.W, height: d.H }} />;
};

// ── Títulos nítidos (sistema de la v2, src/rotulos.ts): capa propia encima del look, sin postproceso ──
const Rotulos: React.FC<{ t: number; d: Disp }> = ({ t, d }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, d.W * SS, d.H * SS);
    ctx.setTransform(SS, 0, 0, SS, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    rotulos(ctx, d, t);
    // un poco del look para que se integren sin perder nitidez: halo de fósforo suave y scanlines finas
    const W2 = d.W * SS;
    const H2 = d.H * SS;
    const tmp = auxiliar(W2, H2, "rotulosHalo");
    const tx = tmp.getContext("2d")!;
    tx.setTransform(1, 0, 0, 1, 0, 0);
    tx.globalCompositeOperation = "copy";
    tx.filter = `blur(${5 * SS}px)`;
    tx.drawImage(ctx.canvas, 0, 0);
    tx.filter = "none";
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "destination-over";
    ctx.globalAlpha = 0.55;
    ctx.drawImage(tmp, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.26)";
    for (let y = 0; y < H2; y += 3 * SS) ctx.fillRect(0, y + 1.5 * SS, W2, 1.5 * SS);
    ctx.restore();
  });
  return <canvas ref={ref} width={d.W * SS} height={d.H * SS} style={{ position: "absolute", left: 0, top: 0, width: d.W, height: d.H }} />;
};

// ── Logo del final aprobado: B&N nítido sobre las partículas, LECTURES una letra por nota, «Próximamente» y la web ──
const LETRAS = "LECTURES".split("");
// v1o-k: cada grupo de letras aparece en el cuadro del ataque de su gota, el mismo en que su carga destella y emite
// el anillo (src/final.ts, frentesLetras); la letra aparece con un pop (de 118 % a 100 % en 0,22 s) y una onda de luz se abre bajo ella. Las letras van en
// blanco limpio: la nube se aparta de su lugar justo antes (src/final.ts, «despeje»).
const Logo: React.FC<{ t: number; d: Disp }> = ({ t, d }) => {
  if (t < Math.min(T_MARCA, (NOTAS_LECTURES[0] ?? 99) - 0.3)) return null;
  const s = d.logo.s;
  const anchoLect = 591 * s;
  const tam = 52 * s;
  const [tProx, tWeb] = golpesDe("nota");
  return (
    <>
      <div style={{ position: "absolute", left: d.logo.cx - anchoLect / 2 + 3 * s, top: d.logo.cy + 118 * s, width: anchoLect, height: tam * 1.1 }}>
        {LETRAS.map((c, i) => {
          const tl = NOTAS_LECTURES[i] ?? 99;
          // v1o-k: la letra ya se ve en el cuadro del ataque (el cuadro se evalúa en su centro)
          const k = eOut(pr(t, tl - MEDIO_CUADRO, 0.06));
          const x = (i / (LETRAS.length - 1)) * (anchoLect - tam * 0.62);
          const ola = pr(t, tl - MEDIO_CUADRO, 0.38);
          return (
            <React.Fragment key={i}>
              {ola > 0 && ola < 1 ? (
                <div style={{ position: "absolute", left: x + tam * 0.3 - 40 * eOut(ola), top: tam * 0.55 - 40 * eOut(ola), width: 80 * eOut(ola), height: 80 * eOut(ola), borderRadius: "50%", background: "radial-gradient(circle, rgba(225,235,255,.55) 0%, rgba(120,160,255,.25) 45%, rgba(120,160,255,0) 70%)", opacity: 1 - ola }} />
              ) : null}
              <span style={{ position: "absolute", left: x, top: 0, fontFamily: SANS, fontWeight: 300, fontSize: tam, lineHeight: 1.1, color: C.texto, opacity: k, transform: `scale(${1 + 0.18 * (1 - k)})`, transformOrigin: "50% 60%", filter: k < 0.98 ? `blur(${(1 - k) * 3}px)` : undefined }}>
                {c}
              </span>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: d.logo.y2, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: SANS, fontWeight: 400, fontSize: d.fmt === "horizontal" ? 22 : 21, letterSpacing: "0.42em", marginRight: "-0.42em", color: "rgba(244,245,248,.78)", opacity: eOut(pr(t, tProx, 0.9)), textTransform: "uppercase" }}>Próximamente</span>
        <span style={{ fontFamily: MONO, fontSize: d.fmt === "horizontal" ? 18 : 17, letterSpacing: "0.12em", color: "rgba(120,155,255,.85)", opacity: eOut(pr(t, tWeb, 0.9)) }}>bnsolutions.cl</span>
      </div>
    </>
  );
};

// Destellos en los drops (no en el final, que ya trae su propio golpe).
const FUERTES = RITMO.efectos.filter((e) => e.tipo === "impacto_fuerte" && e.t < T_FINAL).map((e) => e.t);
const LEVES = RITMO.efectos.filter((e) => e.tipo === "impacto" && e.t < T_FINAL).map((e) => e.t);
const Destello: React.FC<{ t: number }> = ({ t }) => {
  if (t >= T_FINAL) return null;
  // solo un parpadeo mínimo en los drops (sin velos grises de pantalla completa)
  const a = 0 * golpe(t, FUERTES, 16); // sin velo de pantalla completa
  void LEVES;
  if (a < 0.01) return null;
  return <AbsoluteFill style={{ background: "#dfe7ff", opacity: a, mixBlendMode: "screen" }} />;
};

export const Video: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // segundo de escena de la v1o que corresponde a este cuadro de la canción (montaje de src/ritmo.json)
  // (al medio del cuadro: el golpe que cae dentro de un cuadro se ve en ese cuadro, no en el siguiente)
  const t = escena((frame + 0.5) / FPS);
  // v-formatos: el encuadre depende de t (en 16:9 y 9:16 el visual se corre cuando hay texto)
  const d = disposicion(width, height, t);
  zoomGL(d.gl / (0.5 * d.H));
  const campo = useImagen(d.campo);
  const marca = useImagen("img/bn-mark.png");
  // último cuadro de Gray-Scott: de sus píxeles claros nace la arena de Chladni
  const gsFin = useImagen(`sim/gs${d.sim}/f075.png`);
  const enCierre = t >= T_CONV - 0.05;
  const lic = useCuadro(enCierre ? d.campo.replace(".png", `/f${String(((Math.round(t * FPS) % N_LIC) + N_LIC) % N_LIC).padStart(2, "0")}.jpg`) : null);
  const kgs = cuadroGS(t);
  const gs = useCuadro(kgs >= 0 ? `sim/gs${d.sim}/f${String(kgs).padStart(3, "0")}.png` : null);
  const kq = cuadroQ(t);
  const q = useCuadro(kq >= 0 ? `sim/q${d.sim}/f${String(kq).padStart(3, "0")}.png` : null);
  const deriva = enCierre ? derivaCierre(t) : 1;
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: SANS }}>
      <AbsoluteFill style={deriva !== 1 ? { transform: `scale(${deriva})`, transformOrigin: `${d.W / 2}px ${d.logo.cy}px` } : undefined}>
        <Lienzo t={t} d={d} frame={frame} im={{ lic, campo, marca, gs, q, gsFin }} />
        {t < T_FINAL ? <Rotulos t={t} d={d} /> : null}
        {t >= T_FINAL ? <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 80% at 50% 50%, transparent 60%, rgba(0,0,0,.55) 100%)" }} /> : null}
        <Logo t={t} d={d} />
      </AbsoluteFill>
      <Destello t={t} />
      <Audio src={staticFile("musica.wav")} />
    </AbsoluteFill>
  );
};
export const DURACION_CUADROS = TOTAL;
void aberracion;
void ruido;
