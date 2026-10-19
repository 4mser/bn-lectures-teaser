"""Uso: PYTHONPATH=pylib python3 herramientas/vacios.py video.mp4
Tramos casi vacíos: cuadros cuyo percentil 99,5 de luminancia es < 40 (sobre 255)."""
import subprocess
import sys

import numpy as np

v = sys.argv[1]
W, H = 216, 270
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", v, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, H, W)
p = np.percentile(f.reshape(len(f), -1), 99.5, axis=1)
vacio = p < 40
tramos = []
i = 0
while i < len(vacio):
    if vacio[i]:
        j = i
        while j + 1 < len(vacio) and vacio[j + 1]:
            j += 1
        tramos.append((i / 30, (j + 1) / 30))
        i = j + 1
    else:
        i += 1
print(f"tramos vacíos (p99,5 < 40): {len(tramos)}")
for a, b in tramos:
    print(f"  {a:6.2f}–{b:6.2f} s")
