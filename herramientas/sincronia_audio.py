"""Uso: PYTHONPATH=pylib python3 herramientas/sincronia_audio.py out/BN-Lectures-teaser.mp4
Sincronía medida sobre el AUDIO renderizado del mp4 (no sobre ritmo.json): onsets por flujo espectral del audio
y acentos visuales por picos del cambio por cuadro. Reporta, para los acentos visuales grandes, la distancia al onset
audible más cercano (en cuadros de 30 fps) y el desfase medio."""
import subprocess
import sys

import numpy as np

v = sys.argv[1]
SR = 22050
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", v, "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True).stdout
x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
hop = 256
nfft = 1024
win = np.hanning(nfft)
S = np.array([np.abs(np.fft.rfft(x[i : i + nfft] * win)) for i in range(0, len(x) - nfft, hop)])
flujo = np.maximum(0, np.diff(np.log1p(S * 10), axis=0)).sum(1)
flujo = (flujo - np.median(flujo)) / (flujo.std() + 1e-9)
tf = ((np.arange(len(flujo)) + 1) * hop + nfft / 2) / SR  # centro de la ventana
# picos de onset: máximos locales sobre un umbral adaptativo
on = []
for i in range(3, len(flujo) - 3):
    if flujo[i] == flujo[i - 3 : i + 4].max() and flujo[i] > 1.2 + np.median(flujo[max(0, i - 40) : i + 40]):
        on.append(tf[i])
on = np.array(on)
W, H = 216, 270
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", v, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
dv = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
# acentos visuales grandes: cambio que salta respecto de su entorno (la derivada del cambio)
salto = np.maximum(0, np.diff(dv, prepend=dv[0]))
idx = [i for i in range(2, len(salto) - 2) if salto[i] == salto[i - 2 : i + 3].max() and salto[i] > 3.0]
tv = np.array([(i + 1) / 30 for i in idx])
dist = np.array([np.min(np.abs(on - t)) * 30 if len(on) else 99 for t in tv])
firmado = np.array([((on[np.argmin(np.abs(on - t))] - t) * 30) for t in tv])
print(f"onsets audibles: {len(on)}; acentos visuales grandes: {len(tv)}")
print(f"acentos con un onset a ±1 cuadro: {(dist <= 1.01).sum()} de {len(tv)} ({100 * (dist <= 1.01).mean():.0f} %); a ±2 cuadros: {(dist <= 2.01).sum()}")
print(f"desfase medio (onset − acento): {firmado.mean():+.2f} cuadros; mediana {np.median(firmado):+.2f}")
for t, dd, fs in zip(tv, dist, firmado):
    if dd > 1.01:
        print(f"  acento en {t:6.2f} s sin onset a ±1 cuadro (el más cercano a {fs:+.1f} cuadros)")
