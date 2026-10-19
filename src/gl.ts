// Mundo raymarcheado en WebGL2 (el agujero negro del motor GPU de teaser-cuerpo / teaser-v5, biblioteca
// `gpu-hoyo-negro`): curvatura de Schwarzschild de juguete, disco de acreción delgado con Doppler beaming y
// turbulencia. Se dibuja en un canvas WebGL propio y se compone sobre el lienzo 2D. Función pura de sus uniformes.
type Uniformes = Record<string, number | number[]>;

const VS = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const HOYO = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform mat3 uCamRot;
uniform float uFov;
uniform float uRs, uDiscoIn, uDiscoOut, uHoyoGiro, uHoyoBrillo, uHoyoCalor, uRevela, uTono;
out vec4 o;
#define TAU 6.28318530718
float sat(float x) { return clamp(x, 0.0, 1.0); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
// uTono: 0 = hielo y blanco, 1 = ámbar tenue, 2 = azul profundo (se mezcla de forma continua)
vec3 rampa(vec3 a, vec3 b, vec3 c, float T) { return T < 0.5 ? mix(a, b, T * 2.0) : mix(b, c, T * 2.0 - 1.0); }
vec3 colorDisco(float T) {
  vec3 hielo = rampa(vec3(0.02, 0.07, 0.35), vec3(0.2, 0.55, 1.0), vec3(1.0, 0.97, 0.94), T);
  vec3 ambar = rampa(vec3(0.16, 0.09, 0.05), vec3(0.8, 0.64, 0.44), vec3(1.0, 0.95, 0.88), T);
  vec3 azul = rampa(vec3(0.01, 0.03, 0.22), vec3(0.12, 0.32, 1.0), vec3(0.72, 0.84, 1.0), T);
  return uTono < 1.0 ? mix(hielo, ambar, smoothstep(0.0, 1.0, uTono)) : mix(ambar, azul, smoothstep(0.0, 1.0, uTono - 1.0));
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 hoyo(vec2 frag) {
  vec2 uv = (frag - 0.5 * uRes) / (0.5 * uRes.y);
  vec3 rd = normalize(uCamRot * vec3(uv * uFov, 1.0));
  vec3 p = uCamPos, v = rd;
  vec3 col = vec3(0.0);
  float trans = 1.0;
  float h2 = dot(cross(p, v), cross(p, v));
  for (int i = 0; i < 300; i++) {
    float r = length(p);
    if (r < uRs) break;
    if (r > 30.0 && dot(p, v) > 0.0) break;
    float dt = clamp(0.06 * (r - uRs * 0.6), 0.004, 0.6);
    vec3 a = -1.5 * uRs * h2 * p / pow(r, 5.0);
    vec3 pn = p + v * dt + 0.5 * a * dt * dt;
    vec3 vn = normalize(v + a * dt);
    if (p.y * pn.y < 0.0) {
      float f = p.y / (p.y - pn.y);
      vec3 x = mix(p, pn, f);
      float rr = length(x.xz);
      if (rr > uDiscoIn && rr < uDiscoOut * uRevela) {
        float ang = atan(x.z, x.x);
        float w = sqrt(uRs * 0.5) / pow(rr, 1.5) * 1.6;
        float lr = log(rr);
        float a2 = ang - uTime * w * uHoyoGiro;
        float tur = fbm(vec3(lr * 16.0, cos(a2) * 2.6, sin(a2) * 2.6));
        float fil = fbm(vec3(lr * 46.0 + tur * 2.0, cos(a2) * 6.0, sin(a2) * 6.0));
        float dens = pow(sat(tur * 1.25), 2.2) * 1.6 + pow(sat(fil * 1.3 - 0.3), 3.0) * 1.4;
        float T = pow(uDiscoIn / rr, 0.75) * pow(max(0.0, 1.0 - sqrt(uDiscoIn / rr)), 0.25) * 2.2;
        vec3 vel = normalize(vec3(-x.z, 0.0, x.x));
        float beta = sqrt(0.5 * uRs / max(rr - uRs, 0.01)) * 0.85;
        float gam = 1.0 / sqrt(1.0 - beta * beta);
        float g = 1.0 / (gam * (1.0 - beta * dot(vel, -v)));
        float grav = sqrt(max(0.0, 1.0 - uRs / rr));
        float D = g * grav;
        float I = pow(T, 2.4) * pow(D, 4.0) * dens;
        vec3 c = colorDisco(sat(T * D * 0.75));
        c = mix(c, c * vec3(1.35, 0.72, 0.42), sat((1.0 - D) * 1.8) * uHoyoCalor);
        float borde = smoothstep(uDiscoIn, uDiscoIn * 1.06, rr) * smoothstep(uDiscoOut * uRevela, uDiscoOut * uRevela * 0.45, rr);
        float alpha = sat(I * 1.5) * borde;
        col += trans * c * I * borde * 1.15 * uHoyoBrillo;
        trans *= 1.0 - alpha * 0.85;
      }
    }
    p = pn; v = vn;
    if (trans < 0.02) break;
  }
  return col;
}
void main() {
  vec3 c = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) c += hoyo(gl_FragCoord.xy + (vec2(i, j) - 0.5) * 0.5);
  c *= 0.25;
  c = aces(c * 1.1);
  o = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;

const COMUN = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform mat3 uCamRot;
uniform float uFov;
out vec4 o;
#define PI 3.14159265359
#define TAU 6.28318530718
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x) { return clamp(x, 0.0, 1.0); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 rayo(vec2 frag) { vec2 uv = (frag - 0.5 * uRes) / (0.5 * uRes.y); return normalize(uCamRot * vec3(uv * uFov, 1.0)); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 espectro(float l) {
  vec3 x = vec3((l - 400.0) / 300.0);
  vec3 c1 = vec3(3.54585104, 2.93225262, 2.41593945), x1 = vec3(0.69549072, 0.49228336, 0.27699880), y1 = vec3(0.02312639, 0.15225084, 0.52607955);
  vec3 c2 = vec3(3.90307140, 3.21182957, 3.96587128), x2 = vec3(0.11748627, 0.86755042, 0.66077860), y2 = vec3(0.84897130, 0.88445281, 0.73949448);
  vec3 a = c1 * (x - x1); vec3 b = c2 * (x - x2);
  return sat3(vec3(1.0) - a * a - y1) + sat3(vec3(1.0) - b * b - y2);
}
vec3 pelicula(float d, float n, float cosI) {
  float sinT2 = (1.0 - cosI * cosI) / (n * n);
  float cosT = sqrt(max(0.0, 1.0 - sinT2));
  float opd = 2.0 * n * d * cosT;
  vec3 acc = vec3(0.0); vec3 norm = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    float l = 400.0 + 33.0 * float(i);
    vec3 s = espectro(l);
    acc += s * (0.5 + 0.5 * cos(TAU * opd / l + PI));
    norm += s;
  }
  return acc / norm;
}
`;

// Prisma de Newton (teaser-cuerpo, mundo PRISMA): haz blanco volumétrico, abanico espectral de 44 longitudes de onda
// (dispersión ∝ λ) y el vidrio raymarcheado con Fresnel, bordes que brillan y película delgada.
const PRISMA = COMUN + `
uniform float uFan, uHaz, uEntra, uVidrio, uLineal;
float sdTri(vec3 p, vec2 h) { vec3 q = abs(p); return max(q.z - h.y, max(q.x * 0.866025 + p.y * 0.5, -p.y) - h.x * 0.5); }
float mapPr(vec3 p) { return sdTri(p, vec2(0.7, 0.55)) - 0.012; }
vec3 nrm(vec3 p) { vec2 e = vec2(0.002, 0); return normalize(vec3(mapPr(p + e.xyy) - mapPr(p - e.xyy), mapPr(p + e.yxy) - mapPr(p - e.yxy), mapPr(p + e.yyx) - mapPr(p - e.yyx))); }
float distSeg(vec3 ro, vec3 rd, vec3 a, vec3 b, out float tRay) {
  vec3 ba = b - a, oa = ro - a;
  float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa), rdoa = dot(rd, oa);
  float s = sat((baoa - bard * rdoa) / max(baba - bard * bard, 1e-6));
  float tt = dot(a + ba * s - ro, rd);
  tRay = tt;
  vec3 pr = ro + rd * max(tt, 0.0);
  float s2 = sat(dot(pr - a, ba) / baba);
  return length(pr - (a + ba * s2));
}
vec3 escena(vec2 frag) {
  vec3 ro = uCamPos, rd = rayo(frag);
  vec3 A = vec3(-9.0, -0.35, 0.0), P = vec3(-0.35, 0.0, 0.0), Q = vec3(0.35, 0.05, 0.0);
  vec3 col = vec3(0.0);
  float tr;
  // el haz entra desde la izquierda (uEntra: cuánto recorrió)
  vec3 Pe = mix(A, P, uEntra);
  float d0 = distSeg(ro, rd, A, Pe, tr);
  col += vec3(1.0, 0.98, 0.95) * (exp(-d0 * d0 / 0.0006) * 1.4 + 0.012 / (d0 * d0 * 40.0 + 0.02)) * uHaz;
  if (uEntra >= 1.0) {
    float d1 = distSeg(ro, rd, P, Q, tr);
    col += vec3(1.0) * exp(-d1 * d1 / 0.001) * 1.6 * uHaz;
    for (int i = 0; i < 44; i++) {
      float lam = 400.0 + 300.0 * (float(i) + 0.5) / 44.0;
      float dev = (lam - 580.0) / 200.0;
      vec3 dir = normalize(vec3(1.0, -0.12 - dev * 0.55 * uFan, dev * 0.08));
      float d = distSeg(ro, rd, Q, Q + dir * 9.0 * sat(uFan * 1.5), tr);
      float w = 0.0012 + 0.0009 * max(tr - 4.0, 0.0);
      col += espectro(lam) * (exp(-d * d / w) * 0.2 + 0.001 / (d * d * 30.0 + 0.01)) * uHaz * sat(uFan * 3.0);
    }
  }
  float t = 0.0; bool hit = false;
  for (int i = 0; i < 90; i++) { vec3 p = ro + rd * t; float d = mapPr(p); if (d < 0.0008) { hit = true; break; } t += d; if (t > 30.0) break; }
  if (hit) {
    vec3 p = ro + rd * t; vec3 n = nrm(p);
    float cosI = sat(dot(n, -rd));
    float fres = 0.04 + 0.96 * pow(1.0 - cosI, 5.0);
    vec3 rf = reflect(rd, n);
    float studio = smoothstep(0.85, 1.0, rf.y) * 1.5 + smoothstep(0.9, 1.0, rf.x) * 0.8 + smoothstep(0.92, 1.0, -rf.z) * 0.6;
    vec3 e = vec3(0.012, 0, 0);
    float lap = mapPr(p + e.xyy) + mapPr(p - e.xyy) + mapPr(p + e.yxy) + mapPr(p - e.yxy) + mapPr(p + e.yyx) + mapPr(p - e.yyx);
    float edge = smoothstep(0.004, 0.03, lap);
    vec3 disp = pelicula(500.0 + 300.0 * rf.y, 1.5, cosI);
    vec3 vidrio = col * 0.7 + (vec3(studio) * fres * 1.2 + edge * vec3(0.9, 0.95, 1.0) * 1.2) * mix(vec3(1.0), disp * 1.4, 0.5);
    col = mix(col, vidrio, uVidrio);
  }
  return col;
}
void main() {
  vec3 c = vec3(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) c += escena(gl_FragCoord.xy + (vec2(i, j) - 0.5) * 0.5);
  c *= 0.25;
  if (uLineal > 0.5) { o = vec4(c, 1.0); return; }
  c = aces(c * 1.1);
  o = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;

// Hélice de ADN de partículas (teaser-cuerpo, forma 10): dos hebras turquesa y pares de bases, ~180 000 puntos con
// profundidad de campo (el tamaño del punto es el círculo de confusión y su brillo se reparte en él).
const ADN_VS = `#version 300 es
precision highp float;
in vec4 a;
uniform vec2 uRes;
uniform vec3 uCamPos;
uniform mat3 uCamRot;
uniform float uFov, uGiro, uFoco, uApert, uLargo, uBrillo, uPalma, uRecoge, uRadio, uFlujo, uSenal;
uniform vec3 uRecogeA, uRecogeB;
out vec3 vCol;
out float vA;
float h11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec3 gauss3(float k) {
  float u1 = max(h11(k * 1.7 + 0.3), 1e-4), u2 = h11(k * 2.9 + 0.7), u3 = h11(k * 4.1 + 0.1), u4 = h11(k * 5.3 + 0.9);
  float r = sqrt(-2.0 * log(u1)), r2 = sqrt(-2.0 * log(max(u3, 1e-4)));
  return vec3(r * cos(6.2831853 * u2), r * sin(6.2831853 * u2), r2 * cos(6.2831853 * u4));
}
void main() {
  float sel = a.x;
  // s recorre el eje de la hélice; con uFlujo las partículas avanzan a lo largo del haz
  float sEje = fract(a.y + uFlujo);
  float x = (sEje - 0.5) * uLargo;
  float R = 0.62;
  float tw = 2.1;
  float ang = x * tw + uGiro;
  vec3 p;
  vec3 col;
  float c;
  if (sel < 0.78) {
    float off = sel < 0.39 ? 0.0 : 2.3;
    p = vec3(x, R * cos(ang + off), R * sin(ang + off)) + gauss3(a.z * 977.0) * 0.028;
    // dos hebras con un color sutilmente distinto: turquesa y azul hielo con un toque cálido
    col = off == 0.0 ? mix(vec3(0.05, 0.95, 0.78), vec3(0.6, 1.0, 0.95), pow(a.w, 6.0)) : mix(vec3(0.42, 0.7, 1.0), vec3(1.0, 0.93, 0.82), pow(a.w, 5.0));
    // brillo interno que recorre la hélice como una señal
    c = 0.03 * (1.0 + 1.3 * exp(-pow(x - uSenal, 2.0) / 0.5));
  } else {
    float xk = (floor(x / 0.17) + 0.5) * 0.17;
    float ak = xk * tw + uGiro;
    vec3 A = vec3(xk, R * cos(ak), R * sin(ak));
    vec3 B = vec3(xk, R * cos(ak + 2.3), R * sin(ak + 2.3));
    p = mix(A, B, a.z) + gauss3(a.w * 911.0) * 0.012;
    col = mix(vec3(0.1, 0.7, 1.0), vec3(0.2, 1.0, 0.6), h11(xk * 13.1));
    // los pares de bases son peldaños de luz que se encienden en secuencia, con la señal del arpegio
    c = 0.05 * (0.6 + 0.4 * sin(a.z * 3.14159)) * (1.0 + 2.0 * uPalma) * (1.0 + 4.0 * exp(-pow(xk - uSenal, 2.0) / 0.12));
  }
  c *= smoothstep(uLargo * 0.5, uLargo * 0.5 - 2.0, abs(x));
  // la hélice vive sobre el eje del haz del prisma (de uRecogeA a uRecogeB): al desenrollarse (uRadio → 0) sus dos
  // hebras convergen en ese haz y se vuelven luz blanca (uRecoge) que sigue fluyendo hacia el prisma
  p = mix(uRecogeA, uRecogeB, sEje) + vec3(0.0, p.y, p.z) * uRadio;
  col = mix(col, vec3(1.0, 0.97, 0.92), uRecoge);
  c *= mix(1.0, 0.55, uRecoge);
  // bokeh: algunas partículas sueltas flotan alrededor de la hélice
  bool bok = a.x > 0.993;
  if (bok) {
    vec3 centro = mix(uRecogeA, uRecogeB, 0.5);
    p = centro + vec3((a.y - 0.5) * 9.0 + 0.05 * uGiro, (a.z - 0.5) * 4.0 + 0.03 * sin(uGiro + a.w * 6.0), (a.w - 0.5) * 5.0);
    col = mix(vec3(0.2, 0.75, 0.7), vec3(0.75, 0.85, 0.8), h11(a.z * 17.0));
    c = 0.35 * (1.0 - uRecoge);
  }
  vec3 d = p - uCamPos;
  vec3 v = transpose(uCamRot) * d;
  float z = max(v.z, 0.05);
  vec2 uv = v.xy / (z * uFov);
  gl_Position = vec4(uv.x * uRes.y / uRes.x, uv.y, 0.0, 1.0);
  float coc = abs(z - uFoco) / z * uApert * uRes.y;
  float s = clamp(1.5 + coc, 1.5, 48.0);
  if (bok) s = 10.0 + 26.0 * h11(a.y * 23.0);
  gl_PointSize = s;
  vA = c * uBrillo * 2.2 / (s * s * 0.45 + 1.0);
  if (bok) vA *= 1.6;
  vCol = col;
}`;
const ADN_FS = `#version 300 es
precision highp float;
in vec3 vCol;
in float vA;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float f = exp(-r2 * 2.5);
  o = vec4(vCol * vA * f, 1.0);
}`;

let lienzo: HTMLCanvasElement | null = null;
let gl: WebGL2RenderingContext | null = null;
const programas = new Map<string, WebGLProgram>();
const compilar = (g: WebGL2RenderingContext, tipo: number, src: string) => {
  const s = g.createShader(tipo)!;
  g.shaderSource(s, src);
  g.compileShader(s);
  if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) ?? "shader");
  return s;
};
const programa = (g: WebGL2RenderingContext, fs: string, vs = VS) => {
  // la clave incluye el vertex shader: el ADN y el Lorenz comparten fragment shader
  const clave = vs + fs;
  let p = programas.get(clave);
  if (p) return p;
  p = g.createProgram()!;
  g.attachShader(p, compilar(g, g.VERTEX_SHADER, vs));
  g.attachShader(p, compilar(g, g.FRAGMENT_SHADER, fs));
  g.bindAttribLocation(p, 0, vs === VS ? "p" : "a");
  g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p) ?? "link");
  programas.set(clave, p);
  return p;
};
let vaoPantalla: WebGLVertexArrayObject | null = null;
let vaoPuntos: WebGLVertexArrayObject | null = null;
const N_ADN = 1500000;
const iniciar = (w: number, h: number) => {
  if (!lienzo) {
    lienzo = document.createElement("canvas");
    gl = lienzo.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (gl) {
      vaoPantalla = gl.createVertexArray();
      gl.bindVertexArray(vaoPantalla);
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      // puntos de la hélice: cuatro números al azar (deterministas) por punto
      vaoPuntos = gl.createVertexArray();
      gl.bindVertexArray(vaoPuntos);
      const datos = new Float32Array(N_ADN * 4);
      let sem = 12345;
      for (let i = 0; i < datos.length; i++) {
        sem = (sem * 1103515245 + 12345) >>> 0;
        datos[i] = (sem >>> 8) / 16777216;
      }
      const bp = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, bp);
      gl.bufferData(gl.ARRAY_BUFFER, datos, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    }
  }
  if (!gl || !lienzo) return null;
  if (lienzo.width !== w || lienzo.height !== h) {
    lienzo.width = w;
    lienzo.height = h;
  }
  return gl;
};
const uniformes = (g: WebGL2RenderingContext, p: WebGLProgram, U: Uniformes) => {
  for (const [k, v] of Object.entries(U)) {
    const loc = g.getUniformLocation(p, k);
    if (!loc) continue;
    if (typeof v === "number") g.uniform1f(loc, v);
    else if (v.length === 2) g.uniform2fv(loc, v);
    else if (v.length === 3) g.uniform3fv(loc, v);
    else if (v.length === 9) g.uniformMatrix3fv(loc, false, v);
  }
};
const pintar = (fs: string, w: number, h: number, U: Uniformes): HTMLCanvasElement | null => {
  if (!iniciar(w, h) || !gl || !lienzo) return null;
  gl.bindVertexArray(vaoPantalla);
  gl.disable(gl.BLEND);
  const p = programa(gl, fs);
  gl.useProgram(p);
  gl.viewport(0, 0, w, h);
  gl.uniform2f(gl.getUniformLocation(p, "uRes"), w, h);
  uniformes(gl, p, U);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.finish();
  return lienzo;
};

// Escala de las escenas WebGL centradas en el cuadro (Lorenz, ADN, prisma) frente a la de 4:5 (0,5·alto px por
// unidad): src/Video.tsx la fija por formato. Se aplica al campo visual, a la apertura (desenfoque en px) y a proyectar.
let ZOOM = 1;
export const zoomGL = (z: number) => {
  ZOOM = z;
};
// Cámara que mira a un punto (por omisión el origen) desde (dist, elevación, azimut).
export const camara = (dist: number, elev: number, az: number, mira: number[] = [0, 0, 0]) => {
  const pos = [mira[0] + dist * Math.cos(elev) * Math.sin(az), mira[1] + dist * Math.sin(elev), mira[2] - dist * Math.cos(elev) * Math.cos(az)];
  const fw = [0, 1, 2].map((i) => (mira[i] - pos[i]) / dist);
  // derecha = up × forward (mano izquierda: x a la derecha, y arriba, z adelante)
  const up = [0, 1, 0];
  let rt = [up[1] * fw[2] - up[2] * fw[1], up[2] * fw[0] - up[0] * fw[2], up[0] * fw[1] - up[1] * fw[0]];
  const n = Math.hypot(rt[0], rt[1], rt[2]);
  rt = rt.map((x) => x / n);
  const u2 = [fw[1] * rt[2] - fw[2] * rt[1], fw[2] * rt[0] - fw[0] * rt[2], fw[0] * rt[1] - fw[1] * rt[0]];
  return { pos, rot: [...rt, ...u2, ...fw] };
};

export type ParamHoyo = { t: number; dist: number; elev: number; az: number; brillo: number; calor: number; revela: number; rs: number; tono?: number };
export const pintarHoyo = (w: number, h: number, P: ParamHoyo) => {
  const c = camara(P.dist, P.elev, P.az);
  return pintar(HOYO, w, h, {
    uTime: P.t,
    uCamPos: c.pos,
    uCamRot: c.rot,
    uFov: 0.42,
    uRs: P.rs,
    uDiscoIn: 0.62,
    uDiscoOut: 2.5,
    uHoyoGiro: 1.0,
    uHoyoBrillo: P.brillo,
    uHoyoCalor: P.calor,
    uRevela: P.revela,
    uTono: P.tono ?? 0,
  });
};

// v1o · Fluido de color (36-38,5 s): tinta cremosa con remolinos, por warping de dominio sobre ruido fbm y un vórtice
// en espiral logarítmica alrededor del centro (los remolinos se vuelven las espirales del valle de los caballitos de
// mar). Colores de la paleta de la v1j (crema, turquesa, violeta, oro tenue). Nace del centro (uNace) y se aquieta
// (uCalma) cuando el fractal toma su lugar.
const FLUIDO = `#version 300 es
precision highp float;
uniform vec2 uRes, uCentro;
uniform float uTime, uNace, uCalma, uFase, uEsc;
out vec4 o;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 x) {
  vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s; }
vec3 paleta(float u) {
  u = fract(u);
  vec3 c0 = vec3(0.04, 0.05, 0.16), c1 = vec3(0.32, 0.22, 0.62), c2 = vec3(0.32, 0.72, 0.72), c3 = vec3(0.97, 0.93, 0.85), c4 = vec3(0.92, 0.76, 0.46), c5 = vec3(0.45, 0.25, 0.55);
  if (u < 0.18) return mix(c0, c1, smoothstep(0.0, 0.18, u));
  if (u < 0.36) return mix(c1, c2, smoothstep(0.18, 0.36, u));
  if (u < 0.55) return mix(c2, c3, smoothstep(0.36, 0.55, u));
  if (u < 0.68) return mix(c3, c4, smoothstep(0.55, 0.68, u));
  if (u < 0.84) return mix(c4, c5, smoothstep(0.68, 0.84, u));
  return mix(c5, c0, smoothstep(0.84, 1.0, u));
}
void main() {
  vec2 q = (gl_FragCoord.xy - uCentro) / uEsc;
  float r = length(q);
  // vórtice en espiral: el giro crece hacia el centro y con el tiempo
  float ang = atan(q.y, q.x) + (1.4 + 0.9 * uTime) * exp(-r * 0.9) + 0.6 * log(r + 0.05);
  vec2 p = vec2(cos(ang), sin(ang)) * r * 1.1;
  vec2 w1 = vec2(fbm(p + vec2(0.0, 0.3 * uTime)), fbm(p + vec2(5.2, 1.3) - 0.25 * uTime));
  vec2 w2 = vec2(fbm(p + 3.5 * w1 + vec2(1.7, 9.2) + 0.15 * uTime), fbm(p + 3.5 * w1 + vec2(8.3, 2.8)));
  float f = fbm(p + 3.0 * w2);
  vec3 col = paleta(f * 1.6 + length(w2) * 0.6 + uFase);
  // bandas finas como las del fractal, que aparecen al aquietarse
  col *= 0.82 + 0.18 * sin(f * 60.0 + uFase * 6.0) * uCalma;
  // nace del centro: borde de tinta que se expande
  float borde = smoothstep(uNace, uNace - 0.25, r);
  float filo = exp(-pow((r - uNace) / 0.06, 2.0)) * (1.0 - uCalma);
  col = col * borde + vec3(0.95, 0.92, 0.85) * filo * 0.5;
  o = vec4(pow(col, vec3(1.05)), 1.0);
}`;
export type ParamFluido = { t: number; nace: number; calma: number; fase: number; cx: number; cy: number; esc: number };
export const pintarFluido = (w: number, h: number, P: ParamFluido) =>
  pintar(FLUIDO, w, h, { uTime: P.t, uNace: P.nace, uCalma: P.calma, uFase: P.fase, uCentro: [P.cx, h - P.cy], uEsc: P.esc });

export type ParamPrisma = { dist: number; elev: number; az: number; fan: number; haz: number; entra: number };
export const pintarPrisma = (w: number, h: number, P: ParamPrisma) => {
  const c = camara(P.dist, P.elev, P.az, [0.9, -0.25, 0]);
  return pintar(PRISMA, w, h, { uTime: 0, uCamPos: c.pos, uCamRot: c.rot, uFov: 0.42 / ZOOM, uFan: P.fan, uHaz: P.haz, uEntra: P.entra, uVidrio: 1, uLineal: 0 });
};

export type ParamADN = { giro: number; dist: number; elev: number; az: number; brillo: number; palma: number; recoge: number; foco: number };
export const pintarADN = (w: number, h: number, P: ParamADN) => {
  const g = iniciar(w, h);
  if (!g || !lienzo) return null;
  const c = camara(P.dist, P.elev, P.az);
  // acumulación en coma flotante: un millón de aportes pequeños no se pierden en 8 bits
  const acum = fbo(g, "adn", w, h);
  g.bindFramebuffer(g.FRAMEBUFFER, acum.fb);
  g.viewport(0, 0, w, h);
  g.clearColor(0, 0, 0, 1);
  g.clear(g.COLOR_BUFFER_BIT);
  g.enable(g.BLEND);
  g.blendFunc(g.ONE, g.ONE);
  const p = programa(g, ADN_FS, ADN_VS);
  g.useProgram(p);
  g.uniform2f(g.getUniformLocation(p, "uRes"), w, h);
  uniformes(g, p, {
    uCamPos: c.pos,
    uCamRot: c.rot,
    uFov: 0.42,
    uGiro: P.giro,
    uFoco: P.foco,
    uApert: 0.02,
    uLargo: 8,
    uBrillo: P.brillo,
    uPalma: P.palma,
    uRecoge: P.recoge,
    uRadio: 1,
    uFlujo: 0,
    uSenal: -99,
    uRecogeA: [-4, 0, 0],
    uRecogeB: [4, 0, 0],
  });
  g.bindVertexArray(vaoPuntos);
  g.drawArrays(g.POINTS, 0, N_ADN);
  g.disable(g.BLEND);
  // revelado: exposición suave (1 − e^(−x)) al lienzo
  g.bindFramebuffer(g.FRAMEBUFFER, null);
  g.bindVertexArray(vaoPantalla);
  const pr = programa(g, REVELA);
  g.useProgram(pr);
  g.activeTexture(g.TEXTURE0);
  g.bindTexture(g.TEXTURE_2D, acum.tex);
  g.uniform1i(g.getUniformLocation(pr, "uTex"), 0);
  g.uniform2f(g.getUniformLocation(pr, "uRes"), w, h);
  g.drawArrays(g.TRIANGLES, 0, 3);
  g.bindVertexArray(null);
  g.finish();
  return lienzo;
};
const REVELA = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
out vec4 o;
void main() {
  vec3 x = texture(uTex, gl_FragCoord.xy / uRes).rgb;
  vec3 c = 1.0 - exp(-x * 1.6);
  o = vec4(pow(c, vec3(1.0 / 1.6)), 1.0);
}`;

// ═══ Postproceso de todo el cuadro (cadena del motor GPU de teaser-v5 / teaser-cuerpo) ═══
// El lienzo 2D ya compuesto entra como textura y sale con: bloom HDR de doble filtro (Kawase, cinco niveles), tonemap
// ACES, glow suave, aberración cromática solo hacia los bordes, viñeta, grano fino y dithering.
const POST_DOWN = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uUmbral;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec2 h = uTexel * 0.5;
  vec3 c = texture(uTex, uv).rgb * 4.0;
  c += texture(uTex, uv + vec2(-h.x, -h.y)).rgb + texture(uTex, uv + vec2(h.x, h.y)).rgb;
  c += texture(uTex, uv + vec2(h.x, -h.y)).rgb + texture(uTex, uv + vec2(-h.x, h.y)).rgb;
  c /= 8.0;
  if (uUmbral > 0.0) {
    c = pow(c, vec3(2.2));
    float l = max(c.r, max(c.g, c.b));
    c *= smoothstep(uUmbral, uUmbral + 0.25, l);
  }
  o = vec4(c, 1.0);
}`;
const POST_UP = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform sampler2D uBase;
uniform vec2 uTexel;
uniform vec2 uTexelBase;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * uTexelBase;
  vec2 h = uTexel * 0.5;
  vec3 c = texture(uTex, uv + vec2(-h.x * 2.0, 0.0)).rgb + texture(uTex, uv + vec2(h.x * 2.0, 0.0)).rgb;
  c += texture(uTex, uv + vec2(0.0, -h.y * 2.0)).rgb + texture(uTex, uv + vec2(0.0, h.y * 2.0)).rgb;
  c += (texture(uTex, uv + vec2(-h.x, h.y)).rgb + texture(uTex, uv + vec2(h.x, h.y)).rgb + texture(uTex, uv + vec2(-h.x, -h.y)).rgb + texture(uTex, uv + vec2(h.x, -h.y)).rgb) * 2.0;
  c /= 12.0;
  o = vec4(c + texture(uBase, uv).rgb, 1.0);
}`;
const POST_FINAL = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform sampler2D uBloom;
uniform vec2 uRes;
uniform float uSemilla, uBloomK, uExpo, uAberr, uVineta, uGrano;
uniform float uScan, uCurva, uEsq, uImpacto, uRuido, uFlicker, uLineaY, uLineaA, uGrade, uTiempo, uPx;
// v1o-c: reacción a la canción real. uTic: nota de cuerda (tic-tac) que decae; uTicPos: posición del brillo fino que
// cruza el cuadro en esa nota; uTicAng: dirección del cruce. uBat: golpe de batería; uBatPos: barrido de luz ancho.
// uEmpuje: leve empuje de cámara (escala) con easing en la batería.
uniform float uTic, uTicPos, uTicAng, uBat, uBatPos, uEmpuje;
out vec4 o;
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec2 uv0 = gl_FragCoord.xy / uRes;
  vec2 q0 = uv0 - 0.5;
  // curvatura de CRT muy leve (barril)
  vec2 uv = 0.5 + q0 * (1.0 + uCurva * dot(q0, q0)) / (1.0 + uEmpuje);
  vec2 q = uv - 0.5;
  float r2 = dot(q, q);
  // desplazamiento por la línea de interferencia (solo cerca de ella) y ruido de cinta horizontal
  float dl = (uv.y - uLineaY) * uRes.y;
  float enLinea = exp(-dl * dl / 180.0) * uLineaA;
  float cinta = (h12(vec2(floor(uv.y * uRes.y / 3.0), floor(uTiempo * 24.0))) - 0.5) * uRuido * 0.0012;
  uv.x += enLinea * 0.012 + cinta;
  // aberración cromática: crece hacia los bordes; más marcada en los impactos
  vec2 off = q * r2 * (uAberr + uImpacto * 0.04) + vec2(uImpacto * 0.0015, 0.0);
  vec3 c;
  c.r = texture(uTex, uv - off).r;
  c.g = texture(uTex, uv).g;
  c.b = texture(uTex, uv + off).b;
  vec3 lin = pow(c, vec3(2.2));
  vec3 bl = texture(uBloom, uv).rgb;
  vec3 hdr = lin * uExpo + bl * uBloomK * (1.0 + 0.45 * uBat + 0.2 * uTic);
  vec3 m = aces(hdr * 1.25);
  m = mix(hdr / (1.0 + hdr), m, 0.7);
  vec3 s = pow(m, vec3(1.0 / 2.2));
  // gradación de película: negros levemente azulados, altas luces cálidas, saturación contenida
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s = mix(vec3(l), s, 1.0 - 0.12 * uGrade);
  s += uGrade * (vec3(0.010, 0.016, 0.034) * (1.0 - l) + vec3(0.03, 0.012, -0.02) * smoothstep(0.55, 1.0, l));
  // reacción a la canción: solo sobre las luces (los trazos protagonistas), nunca un velo de pantalla completa
  float luces = smoothstep(0.34, 0.85, l);
  vec2 qa = q0 * vec2(uRes.x / uRes.y, 1.0);
  float cruce = dot(qa, vec2(cos(uTicAng), sin(uTicAng))) / 0.8 + 0.5;
  float glint = exp(-pow((cruce - uTicPos) / 0.06, 2.0)) * uTic;
  s += vec3(0.82, 0.9, 1.0) * luces * (0.75 * glint + 0.18 * uTic);
  float barre = exp(-pow((0.5 - qa.y / 1.1 - uBatPos) / 0.11, 2.0)) * uBat;
  s += vec3(0.72, 0.84, 1.0) * luces * 0.5 * barre;
  // línea de interferencia: una franja clara que cruza
  s += vec3(0.75, 0.85, 1.0) * enLinea * 0.18;
  // banda de seguimiento de cinta que baja lenta, apenas más oscura
  float banda = 1.0 - smoothstep(0.0, 0.07, abs(fract(uv.y + uTiempo * 0.09) - 0.5));
  s *= 1.0 - 0.045 * uRuido * banda;
  // scanlines finas de fósforo: período de 3 px de la salida (uPx = supermuestreo), para que sobrevivan a la reducción
  float scan = 0.5 + 0.5 * cos(gl_FragCoord.y * 6.28318 / (3.0 * uPx));
  s *= 1.0 - uScan * (1.0 - scan) * (0.6 + 0.4 * (1.0 - l));
  s *= 1.0 + uFlicker * (h12(vec2(floor(uTiempo * 30.0), 7.0)) - 0.5);
  // viñeta de CRT y borde del tubo
  s *= 1.0 - uVineta * smoothstep(0.12, 0.55, r2 * 1.6);
  vec2 bd = smoothstep(vec2(0.0), vec2(0.004), uv) * smoothstep(vec2(0.0), vec2(0.004), 1.0 - uv);
  s *= bd.x * bd.y;
  // esquinas redondeadas del tubo (proporcionales a la curvatura)
  vec2 ac = vec2(uRes.x / uRes.y, 1.0);
  // (uEsq: la curvatura del 4:5 con el radio en px del 4:5; en 4:5 es uCurva)
  vec2 dq = max(abs(q) * ac - (0.5 * ac - 0.035 * uEsq * 6.0), 0.0);
  s *= 1.0 - smoothstep(0.03 * uEsq * 6.0 - 0.004, 0.035 * uEsq * 6.0, length(dq));
  // grano analógico y dithering
  s += (h12(floor(gl_FragCoord.xy / uPx) + uSemilla * 37.0) - 0.5) * uGrano;
  s += (h12(gl_FragCoord.xy * 1.37 + uSemilla) - 0.5) / 255.0;
  o = vec4(s, 1.0);
}`;
type Fbo = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };
const fbos = new Map<string, Fbo>();
const fbo = (g: WebGL2RenderingContext, nombre: string, w: number, h: number): Fbo => {
  const k = `${nombre}${w}x${h}`;
  let f = fbos.get(k);
  if (f) return f;
  const tex = g.createTexture()!;
  g.bindTexture(g.TEXTURE_2D, tex);
  const flotante = !!g.getExtension("EXT_color_buffer_float");
  g.texImage2D(g.TEXTURE_2D, 0, flotante ? g.RGBA16F : g.RGBA8, w, h, 0, g.RGBA, flotante ? g.HALF_FLOAT : g.UNSIGNED_BYTE, null);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  const fb = g.createFramebuffer()!;
  g.bindFramebuffer(g.FRAMEBUFFER, fb);
  g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
  f = { fb, tex, w, h };
  fbos.set(k, f);
  return f;
};
let texFuente: WebGLTexture | null = null;
export type ParamPost = { esq?: number; tic?: number; ticPos?: number; ticAng?: number; bat?: number; batPos?: number; empuje?: number; semilla: number; bloom: number; expo: number; aberr: number; vineta: number; grano: number; scan: number; curva: number; impacto: number; ruido: number; flicker: number; lineaY: number; lineaA: number; grade: number; tiempo: number; halo: number; px?: number };
export const postProceso = (fuente: HTMLCanvasElement, w: number, h: number, P: ParamPost) => {
  const g = iniciar(w, h);
  if (!g || !lienzo) return null;
  g.bindVertexArray(vaoPantalla);
  g.disable(g.BLEND);
  if (!texFuente) {
    texFuente = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, texFuente);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  }
  g.activeTexture(g.TEXTURE0);
  g.bindTexture(g.TEXTURE_2D, texFuente);
  g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, fuente);
  g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
  // bajada: 5 niveles desde la mitad del tamaño de salida
  const pd = programa(g, POST_DOWN);
  const niveles: Fbo[] = [];
  let ancho = Math.max(1, w >> 1);
  let alto = Math.max(1, h >> 1);
  let entrada: WebGLTexture = texFuente!;
  for (let i = 0; i < 5; i++) {
    const f = fbo(g, `d${i}`, ancho, alto);
    g.bindFramebuffer(g.FRAMEBUFFER, f.fb);
    g.viewport(0, 0, ancho, alto);
    g.useProgram(pd);
    g.bindTexture(g.TEXTURE_2D, entrada);
    g.uniform1i(g.getUniformLocation(pd, "uTex"), 0);
    g.uniform2f(g.getUniformLocation(pd, "uTexel"), 1 / ancho, 1 / alto);
    g.uniform1f(g.getUniformLocation(pd, "uUmbral"), i === 0 ? 0.55 - 0.15 * P.halo : 0);
    g.drawArrays(g.TRIANGLES, 0, 3);
    niveles.push(f);
    entrada = f.tex;
    ancho = Math.max(1, ancho >> 1);
    alto = Math.max(1, alto >> 1);
  }
  // subida: cada nivel suma el de abajo
  const pu = programa(g, POST_UP);
  let abajo = niveles[4];
  for (let i = 3; i >= 0; i--) {
    const base = niveles[i];
    const f = fbo(g, `u${i}`, base.w, base.h);
    g.bindFramebuffer(g.FRAMEBUFFER, f.fb);
    g.viewport(0, 0, base.w, base.h);
    g.useProgram(pu);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, abajo.tex);
    g.activeTexture(g.TEXTURE1);
    g.bindTexture(g.TEXTURE_2D, base.tex);
    g.uniform1i(g.getUniformLocation(pu, "uTex"), 0);
    g.uniform1i(g.getUniformLocation(pu, "uBase"), 1);
    g.uniform2f(g.getUniformLocation(pu, "uTexel"), 1 / abajo.w, 1 / abajo.h);
    g.uniform2f(g.getUniformLocation(pu, "uTexelBase"), 1 / base.w, 1 / base.h);
    g.drawArrays(g.TRIANGLES, 0, 3);
    abajo = f;
  }
  // final
  g.bindFramebuffer(g.FRAMEBUFFER, null);
  g.viewport(0, 0, w, h);
  const pf = programa(g, POST_FINAL);
  g.useProgram(pf);
  g.activeTexture(g.TEXTURE0);
  g.bindTexture(g.TEXTURE_2D, texFuente);
  g.activeTexture(g.TEXTURE1);
  g.bindTexture(g.TEXTURE_2D, abajo.tex);
  g.uniform1i(g.getUniformLocation(pf, "uTex"), 0);
  g.uniform1i(g.getUniformLocation(pf, "uBloom"), 1);
  g.uniform2f(g.getUniformLocation(pf, "uRes"), w, h);
  uniformes(g, pf, { uSemilla: P.semilla, uBloomK: P.bloom, uExpo: P.expo, uAberr: P.aberr, uVineta: P.vineta, uGrano: P.grano, uScan: P.scan, uCurva: P.curva, uEsq: P.esq ?? P.curva, uImpacto: P.impacto, uRuido: P.ruido, uFlicker: P.flicker, uLineaY: P.lineaY, uLineaA: P.lineaA, uGrade: P.grade, uTiempo: P.tiempo, uPx: P.px ?? 1, uTic: P.tic ?? 0, uTicPos: P.ticPos ?? -1, uTicAng: P.ticAng ?? 0, uBat: P.bat ?? 0, uBatPos: P.batPos ?? -1, uEmpuje: P.empuje ?? 0 });
  g.drawArrays(g.TRIANGLES, 0, 3);
  g.activeTexture(g.TEXTURE0);
  g.finish();
  return lienzo;
};

// ADN y prisma en el mismo espacio 3D, con la misma cámara: la hélice está sobre el eje del haz que entra al prisma.
// Cuadro: el prisma (lineal) y las partículas se acumulan en coma flotante y se revelan juntos.
export type ParamADNPrisma = {
  mira: number[]; dist: number; elev: number; az: number; foco: number;
  giro: number; brillo: number; palma: number; radio: number; flujo: number; blanco: number; alfaADN: number; senal: number;
  haz: number; fan: number; vidrio: number;
};
export const pintarADNPrisma = (w: number, h: number, P: ParamADNPrisma) => {
  const g = iniciar(w, h);
  if (!g || !lienzo) return null;
  const c = camara(P.dist, P.elev, P.az, P.mira);
  const acum = fbo(g, "adn", w, h);
  g.bindFramebuffer(g.FRAMEBUFFER, acum.fb);
  g.viewport(0, 0, w, h);
  g.clearColor(0, 0, 0, 1);
  g.clear(g.COLOR_BUFFER_BIT);
  if (P.haz > 0.002 || P.vidrio > 0.002) {
    g.disable(g.BLEND);
    g.bindVertexArray(vaoPantalla);
    const pp = programa(g, PRISMA);
    g.useProgram(pp);
    g.uniform2f(g.getUniformLocation(pp, "uRes"), w, h);
    uniformes(g, pp, { uTime: 0, uCamPos: c.pos, uCamRot: c.rot, uFov: 0.42 / ZOOM, uFan: P.fan, uHaz: P.haz, uEntra: 1, uVidrio: P.vidrio, uLineal: 1 });
    g.drawArrays(g.TRIANGLES, 0, 3);
  }
  if (P.alfaADN > 0.002) {
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE);
    const p = programa(g, ADN_FS, ADN_VS);
    g.useProgram(p);
    g.uniform2f(g.getUniformLocation(p, "uRes"), w, h);
    uniformes(g, p, {
      uCamPos: c.pos, uCamRot: c.rot, uFov: 0.42 / ZOOM, uGiro: P.giro, uFoco: P.foco, uApert: 0.02 * ZOOM, uLargo: 8,
      uBrillo: P.brillo * P.alfaADN, uPalma: P.palma, uRecoge: P.blanco, uRadio: P.radio, uFlujo: P.flujo, uSenal: P.senal,
      uRecogeA: [-8.6, -0.37, 0], uRecogeB: [-0.35, 0, 0],
    });
    g.bindVertexArray(vaoPuntos);
    g.drawArrays(g.POINTS, 0, N_ADN);
    g.disable(g.BLEND);
  }
  g.bindFramebuffer(g.FRAMEBUFFER, null);
  g.bindVertexArray(vaoPantalla);
  const pr = programa(g, REVELA);
  g.useProgram(pr);
  g.activeTexture(g.TEXTURE0);
  g.bindTexture(g.TEXTURE_2D, acum.tex);
  g.uniform1i(g.getUniformLocation(pr, "uTex"), 0);
  g.uniform2f(g.getUniformLocation(pr, "uRes"), w, h);
  g.drawArrays(g.TRIANGLES, 0, 3);
  g.bindVertexArray(null);
  g.finish();
  return lienzo;
};

// ═══ Lorenz de un millón de partículas (como `gpu-lorenz` de teaser-v5): una trayectoria larga en una textura;
// cada partícula se sienta en un punto de ella y avanza a lo largo del flujo; color según la velocidad; profundidad de
// campo; acumulación en coma flotante ═══
const N_TRAY = 512 * 300;
export const TRAY_LORENZ: Float32Array = (() => {
  const out = new Float32Array(N_TRAY * 4);
  const f = (x: number, y: number, z: number) => [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z];
  let s = [0.1, 0, 0];
  const dt = 0.005;
  for (let i = -1000; i < N_TRAY; i++) {
    const k1 = f(s[0], s[1], s[2]);
    const k2 = f(s[0] + (dt / 2) * k1[0], s[1] + (dt / 2) * k1[1], s[2] + (dt / 2) * k1[2]);
    const k3 = f(s[0] + (dt / 2) * k2[0], s[1] + (dt / 2) * k2[1], s[2] + (dt / 2) * k2[2]);
    const k4 = f(s[0] + dt * k3[0], s[1] + dt * k3[1], s[2] + dt * k3[2]);
    s = s.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    if (i >= 0) {
      out[i * 4] = s[0];
      out[i * 4 + 1] = s[1];
      out[i * 4 + 2] = s[2];
      out[i * 4 + 3] = Math.hypot(k1[0], k1[1], k1[2]);
    }
  }
  return out;
})();
const LOR_VS = `#version 300 es
precision highp float;
in vec4 a;
uniform sampler2D uTray;
uniform vec2 uRes;
uniform vec3 uCamPos;
uniform mat3 uCamRot;
uniform float uFov, uFlujo, uEsc, uFoco, uApert, uBrillo, uAplana;
out vec3 vCol;
out float vA;
float h11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
void main() {
  float n = ${N_TRAY}.0;
  float fi = mod(floor(a.x * n) + uFlujo * (0.6 + 0.8 * a.w), n);
  int idx = int(fi);
  vec4 q = texelFetch(uTray, ivec2(idx % 512, idx / 512), 0);
  vec3 jit = (vec3(h11(a.y * 91.0), h11(a.z * 37.0), h11(a.w * 53.0)) - 0.5) * 0.9;
  // coordenadas de Lorenz → mundo: z hacia arriba, centrado en z = 25
  vec3 p = vec3(q.x + jit.x, (q.z - 25.0) + jit.z, (q.y + jit.y) * (1.0 - uAplana)) * 0.06 * uEsc;
  float sp = clamp((q.w - 20.0) / 160.0, 0.0, 1.0);
  vec3 lento = vec3(0.12, 0.28, 0.95), medio = vec3(0.55, 0.78, 1.0), rapido = vec3(1.0, 0.86, 0.62);
  vCol = sp < 0.5 ? mix(lento, medio, sp * 2.0) : mix(medio, rapido, sp * 2.0 - 1.0);
  vec3 v = transpose(uCamRot) * (p - uCamPos);
  float z = max(v.z, 0.05);
  vec2 uv = v.xy / (z * uFov);
  gl_Position = vec4(uv.x * uRes.y / uRes.x, uv.y, 0.0, 1.0);
  float coc = abs(z - uFoco) / z * uApert * uRes.y;
  float s = clamp(1.4 + coc, 1.4, 40.0);
  gl_PointSize = s;
  vA = 0.05 * uBrillo / (s * s * 0.45 + 1.0);
}`;
let texTray: WebGLTexture | null = null;
export type ParamLorenz = { flujo: number; esc: number; dist: number; elev: number; az: number; brillo: number; aplana: number };
export const camaraLorenz = (P: ParamLorenz) => camara(P.dist, P.elev, P.az);
export const pintarLorenz = (w: number, h: number, P: ParamLorenz) => {
  const g = iniciar(w, h);
  if (!g || !lienzo) return null;
  if (!texTray) {
    texTray = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, texTray);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA32F, 512, N_TRAY / 512, 0, g.RGBA, g.FLOAT, TRAY_LORENZ);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
  }
  const c = camaraLorenz(P);
  const acum = fbo(g, "adn", w, h);
  g.bindFramebuffer(g.FRAMEBUFFER, acum.fb);
  g.viewport(0, 0, w, h);
  g.clearColor(0, 0, 0, 1);
  g.clear(g.COLOR_BUFFER_BIT);
  g.enable(g.BLEND);
  g.blendFunc(g.ONE, g.ONE);
  const p = programa(g, ADN_FS, LOR_VS);
  g.useProgram(p);
  g.activeTexture(g.TEXTURE0);
  g.bindTexture(g.TEXTURE_2D, texTray);
  g.uniform1i(g.getUniformLocation(p, "uTray"), 0);
  g.uniform2f(g.getUniformLocation(p, "uRes"), w, h);
  uniformes(g, p, { uCamPos: c.pos, uCamRot: c.rot, uFov: 0.42 / ZOOM, uFlujo: P.flujo, uEsc: P.esc, uFoco: P.dist, uApert: 0.016 * ZOOM, uBrillo: P.brillo, uAplana: P.aplana });
  g.bindVertexArray(vaoPuntos);
  g.drawArrays(g.POINTS, 0, N_ADN);
  g.disable(g.BLEND);
  g.bindFramebuffer(g.FRAMEBUFFER, null);
  g.bindVertexArray(vaoPantalla);
  const pr = programa(g, REVELA);
  g.useProgram(pr);
  g.bindTexture(g.TEXTURE_2D, acum.tex);
  g.uniform1i(g.getUniformLocation(pr, "uTex"), 0);
  g.uniform2f(g.getUniformLocation(pr, "uRes"), w, h);
  g.drawArrays(g.TRIANGLES, 0, 3);
  g.bindVertexArray(null);
  g.finish();
  return lienzo;
};
// Proyección en JS con la misma cámara (para dibujar sobre la imagen GPU: las dos trayectorias del efecto mariposa).
export const proyectar = (c: { pos: number[]; rot: number[] }, w: number, h: number, p: number[]): [number, number, number] => {
  const d = [p[0] - c.pos[0], p[1] - c.pos[1], p[2] - c.pos[2]];
  const r = c.rot;
  const vx = r[0] * d[0] + r[1] * d[1] + r[2] * d[2];
  const vy = r[3] * d[0] + r[4] * d[1] + r[5] * d[2];
  const vz = r[6] * d[0] + r[7] * d[1] + r[8] * d[2];
  const z = Math.max(vz, 0.05);
  return [w / 2 + ((vx / (z * 0.42)) * h * ZOOM) / 2, h / 2 - ((vy / (z * 0.42)) * h * ZOOM) / 2, z];
};
