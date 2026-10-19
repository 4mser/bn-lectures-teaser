"""Uso: PYTHONPATH=pylib python3 herramientas/grayscott.py
Precalcula la reacción-difusión de Gray-Scott (F = 0,055; k = 0,062, «coral») del acto III: la siembra es la
curva del atractor de Lorenz tal como se ve en pantalla al empezar la escena (misma integración RK4 y misma
proyección que src/escenas.ts), así el patrón de Turing nace de la forma anterior. Cada cuadro avanza más pasos
en los bombos (crece con la música). Escribe public/sim/gs/fNNN.png (270×338, coloreado) para el formato 4:5.
Con FORMATO=169 o FORMATO=916 escribe public/sim/gs-169 o gs-916: la misma simulación (misma escala de la grilla
frente al atractor) en todo el cuadro de ese formato, sembrada con la silueta del Lorenz tal como se ve en él
(centro del cuadro y la escala WebGL `gl` de src/disposicion.ts)."""
import json
import math
import os
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
R = json.loads((RAIZ / "src" / "ritmo.json").read_text())
SEC = {s["id"]: s["t"] for s in R["secciones"]}
T0, T1 = SEC["grayscott"], SEC["chladni"] + 0.5
FPS = 30
# formato: (ancho, alto, px por unidad WebGL) de src/disposicion.ts
FMT = os.environ.get("FORMATO", "45")
WP, HP, GL = {"45": (1080, 1350, 675), "169": (1920, 1080, 630), "916": (1080, 1920, 700)}[FMT]
ESC = 4 * GL / 675  # 4:5: grilla a 1/4 del cuadro de 1080×1350
W, H = (270, 338) if FMT == "45" else (round(WP / ESC), round(HP / ESC))

# Silueta del Lorenz GPU al final de su escena (src/gl.ts TRAY_LORENZ, vista de frente y aplanado):
# x → pantalla x, z → pantalla y, con 0,06 unidades por unidad de Lorenz, cámara a 4,6 y fov 0,42, centro (540, 675).
f = lambda v: np.array([10 * (v[1] - v[0]), v[0] * (28 - v[2]) - v[1], v[0] * v[1] - 8 / 3 * v[2]])
s = np.array([0.1, 0.0, 0.0])
L = []
dt = 0.005
for i in range(-1000, 153600):
    k1 = f(s); k2 = f(s + dt / 2 * k1); k3 = f(s + dt / 2 * k2); k4 = f(s + dt * k3)
    s = s + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    if i >= 0 and i % 4 == 0:
        L.append(s.copy())
L = np.array(L)
kp = 0.06 / (4.6 * 0.42) * GL
px = (WP / 2 + L[:, 0] * kp) / ESC
py = (HP / 2 - (L[:, 2] - 25) * kp) / ESC
U = np.ones((H, W))
V = np.zeros((H, W))
for a, b in zip(px, py):
    i, j = int(round(b)), int(round(a))
    if 1 <= i < H - 1 and 1 <= j < W - 1:
        U[i - 1:i + 2, j - 1:j + 2] = 0.5
        V[i - 1:i + 2, j - 1:j + 2] = 0.25
rng = np.random.default_rng(3)
V += rng.random((H, W)) * 0.01
V = np.clip(V, 0, 1)

Du, Dv, F, K = 0.16, 0.08, 0.055, 0.062


def lap(Z):
    return np.roll(Z, 1, 0) + np.roll(Z, -1, 0) + np.roll(Z, 1, 1) + np.roll(Z, -1, 1) - 4 * Z


def golpe(t, lista, caida):
    pas = [x for x in lista if x <= t + 1e-6]
    return math.exp(-(t - pas[-1]) * caida) if pas else 0.0


out = RAIZ / "public" / "sim" / ("gs" if FMT == "45" else f"gs-{FMT}")
out.mkdir(parents=True, exist_ok=True)
for p in out.glob("f*.png"):
    p.unlink()
n = int(round((T1 - T0) * FPS)) + 1
for q in range(n):
    t = T0 + q / FPS
    pasos = int(70 + 15 * golpe(t, R["bombos"], 3))  # crecimiento parejo, apenas más en los bombos
    for _ in range(pasos):
        uvv = U * V * V
        U += Du * lap(U) - uvv + F * (1 - U)
        V += Dv * lap(V) + uvv - (F + K) * V
    v = np.clip(V * 3.2, 0, 1)
    rgb = np.stack([25 + 190 * v ** 2.2, 70 + 165 * v ** 1.6, 190 + 65 * v ** 0.8], -1) * np.clip(v * 1.8, 0, 1)[..., None] ** 1.3
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(out / f"f{q:03d}.png")
print(f"gray-scott: {n} cuadros desde {T0} s, V max {V.max():.3f}")
