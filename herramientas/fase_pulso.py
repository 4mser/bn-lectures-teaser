"""Uso: PYTHONPATH=pylib python3 herramientas/fase_pulso.py video.mp4 [carpeta_tiras]
Fase de los picos de cambio visual respecto de la grilla de pulsos de la canción (src/ritmo.json → cancion):
  · picos de cambio por cuadro (máximos locales del cambio medio entre cuadros, sobre su mediana móvil);
  · fase = posición del pico dentro de su pulso (0 = en el pulso), en 16 bins por pulso; las semicorcheas son los
    bins 0, 4, 8 y 12. Imprime el histograma y qué parte cae a ±1 bin de una semicorchea.
Con carpeta_tiras (y opcionalmente nombre=segundo …), arma tiras de 16 cuadros (un cuadro por semicorchea, cuatro pulsos) en tramos de movimiento
continuo: lissajous (6,0 s), agujero negro (30,5 s) y Lorenz (71,6 s)."""
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
RAIZ = Path(__file__).resolve().parent.parent
v = sys.argv[1]
R = json.loads((RAIZ / "src" / "ritmo.json").read_text(encoding="utf-8"))
B0, P = R["cancion"]["primerCompas"], R["cancion"]["pulso"]
W, H = 216, 270
raw = subprocess.run([FF, "-v", "error", "-i", v, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
dv = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
med = np.array([np.median(dv[max(0, i - 15):i + 16]) for i in range(len(dv))])
picos = [i for i in range(2, len(dv) - 2) if dv[i] == dv[i - 2:i + 3].max() and dv[i] > 1.5 * med[i] + 0.3 and dv[i] > 1.0]
t = np.array([(i + 1) / 30 for i in picos])  # el cambio aparece en el cuadro i + 1
t = t[t > B0]
fase = ((t - B0) / P) % 1
bins = np.floor(fase * 16 + 0.5).astype(int) % 16
h = np.bincount(bins, minlength=16)
print(f"picos de cambio visual: {len(t)}")
print("histograma de fase (16 bins por pulso; bin 0 = en el pulso):")
for k in range(16):
    marca = "  ← pulso" if k == 0 else ("  ← semicorchea" if k % 4 == 0 else "")
    print(f"  {k:2d} {h[k]:4d} {'#' * int(h[k])}{marca}")
semi = sum(h[k] for k in range(16) if min(k % 4, 4 - k % 4) <= 1)
print(f"en el pulso (bins 15, 0, 1): {100 * (h[15] + h[0] + h[1]) / len(t):.0f} %; a ±1 bin de una semicorchea: {100 * semi / len(t):.0f} % (al azar: 75 %)")
print(f"a ±1 cuadro del pulso: {100 * np.mean(np.minimum(fase, 1 - fase) * P <= 1 / 30 + 1e-6):.0f} % (al azar: {100 * 2 / 30 / P:.0f} %)")
if len(sys.argv) > 2:
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    tramos = [(a.split("=")[0], float(a.split("=")[1])) for a in sys.argv[3:]] or [("lissajous", 6.0), ("hoyo", 30.5), ("lorenz", 71.6)]
    for nombre, t0 in tramos:
        k0 = int(np.ceil((t0 - B0) / P))
        tmp = out / f"_{nombre}"
        tmp.mkdir(exist_ok=True)
        for j in range(16):
            ts = B0 + k0 * P + j * P / 4 + 1 / 60
            et = "pulso" if j % 4 == 0 else f"+{j % 4}/4"
            subprocess.run([FF, "-v", "error", "-y", "-ss", f"{ts:.3f}", "-i", v, "-frames:v", "1", "-vf",
                            f"scale=180:225,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.7:x=4:y=4:text='{ts:.2f} {et}'",
                            str(tmp / f"c{j:02d}.png")], check=True)
        subprocess.run([FF, "-v", "error", "-y", "-i", str(tmp / "c%02d.png"), "-vf", "tile=8x2:padding=3:color=white", "-frames:v", "1", str(out / f"tira_{nombre}.png")], check=True)
    print("tiras en", out)
