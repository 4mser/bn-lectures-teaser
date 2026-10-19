"""Uso: PYTHONPATH=pylib python3 herramientas/cuantico.py
Fluido cuántico del acto I: ecuación de Schrödinger 2D por split-step de Fourier (ħ = m = 1). Un paquete gaussiano
nace donde se recogió el orbital, baja, choca con una barrera con dos rendijas (las mismas posiciones que usa
src/escenas.ts) y se difracta; las franjas de interferencia aparecen en la propia densidad |ψ|². Los bordes absorben.
El paso de tiempo por cuadro crece en cada bombo (el fluido avanza con la música). Escribe public/sim/q/fNNN.png
(270×338, coloreado: azul profundo → blanco, con un matiz violeta según la fase).
Con FORMATO=169 o FORMATO=916 escribe public/sim/q-169 o q-916: la misma simulación (misma escala de la grilla
frente a la zona visual `vis` de src/disposicion.ts, sin texto) en todo el cuadro de ese formato."""
import json
import math
import os
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
R = json.loads((RAIZ / "src" / "ritmo.json").read_text())
SEC = {s["id"]: s["t"] for s in R["secciones"]}
T0, T1 = SEC["cuantico"] - 0.4, SEC["campo"] + 0.6
FPS = 30
# formato: (ancho, alto, zona visual sin texto) de src/disposicion.ts
FMT = os.environ.get("FORMATO", "45")
WP, HP, CX, CY, RV = {"45": (1080, 1350, 540, 545, 450), "169": (1920, 1080, 960, 540, 420), "916": (1080, 1920, 540, 890, 470)}[FMT]
ESC = 4 * RV / 450
W, H = (270, 338) if FMT == "45" else (round(WP / ESC), round(HP / ESC))
yB = (CY - RV * 0.25) / ESC
sep = RV * 0.13 / ESC
x = np.arange(W)[None, :].astype(float)
y = np.arange(H)[:, None].astype(float)
# potencial: barrera con dos rendijas y bordes absorbentes
V = np.zeros((H, W), complex)
barrera = (np.abs(y - yB) < 1.6) & ~((np.abs(x - (CX / ESC - sep)) < 4.2) | (np.abs(x - (CX / ESC + sep)) < 4.2))
V[barrera] = 6.0
m = 22
borde = np.minimum.reduce([x + 0 * y, W - 1 - x + 0 * y, y + 0 * x, H - 1 - y + 0 * x])
V += -1j * 0.6 * np.clip((m - borde) / m, 0, 1) ** 2
# paquete: donde termina el orbital (la fuente), con momento hacia abajo
x0, y0 = CX / ESC, (CY - RV * 0.92) / ESC + 14
s0 = 13.0
k0 = 1.2
psi = np.exp(-((x - x0) ** 2 + (y - y0) ** 2) / (4 * s0 ** 2)) * np.exp(1j * k0 * y)
psi /= np.sqrt((np.abs(psi) ** 2).sum())
kx = 2 * np.pi * np.fft.fftfreq(W)[None, :]
ky = 2 * np.pi * np.fft.fftfreq(H)[:, None]
dt = 0.12
cin = np.exp(-1j * (kx ** 2 + ky ** 2) / 2 * dt)
pot = np.exp(-1j * V * dt / 2)


def golpe(t, lista, caida):
    pas = [v for v in lista if v <= t + 1e-6]
    return math.exp(-(t - pas[-1]) * caida) if pas else 0.0


out = RAIZ / "public" / "sim" / ("q" if FMT == "45" else f"q-{FMT}")
out.mkdir(parents=True, exist_ok=True)
for p in out.glob("f*.png"):
    p.unlink()
n = int(round((T1 - T0) * FPS)) + 1
ref = None
for q in range(n):
    t = T0 + q / FPS
    pasos = int(9 + 8 * golpe(t, R["bombos"], 5)) if t > SEC["cuantico"] - 0.1 else 0
    for _ in range(pasos):
        psi = pot * np.fft.ifft2(cin * np.fft.fft2(pot * psi))
    dens = np.abs(psi) ** 2
    # brillo con normalización suave por cuadro (el fluido transmitido se ve aunque la mayor parte se refleje)
    mx = np.percentile(dens, 99.7)
    ref = mx if ref is None else ref * 0.85 + mx * 0.15
    v = np.clip(dens / (ref * 1.1), 0, None) ** 0.55
    v = 1 - np.exp(-v * 1.4)
    fase = np.angle(psi)
    tinte = 0.5 + 0.5 * np.cos(fase)
    rgb = np.stack([
        255 * (0.10 * v + 0.75 * v ** 2.2 + 0.18 * v * tinte),
        255 * (0.22 * v + 0.72 * v ** 2.0),
        255 * (0.55 * v + 0.45 * v ** 1.2 + 0.12 * v * (1 - tinte)),
    ], -1)
    rgb[barrera] = np.maximum(rgb[barrera], 70)
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(out / f"f{q:03d}.png")
print(f"cuántico: {n} cuadros desde {T0:.2f} s")
