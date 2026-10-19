"""Uso: PYTHONPATH=pylib python3 herramientas/correlacion_onsets.py video.mp4 [video2.mp4 …]
Cuánto se mueve la imagen con los eventos reales de la canción (src/cancion.json), por separado para las notas de
cuerda (el tic-tac del ostinato), sus acentos 3+3+2 y la batería (bombos, toms y cajas):
  · salto = aumento del cambio medio entre cuadros respecto del cuadro anterior (lo que el ojo ve como acento);
  · correlación de Pearson entre el salto y un tren de eventos (1 en el cuadro del evento y el siguiente);
  · ganancia = salto medio en los cuadros con evento / salto medio en todos los cuadros (1 = sin relación).
Solo cuenta el tramo con música (del compás 0 a la convergencia en la marca)."""
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
RAIZ = Path(__file__).resolve().parent.parent
C = json.loads((RAIZ / "src" / "cancion.json").read_text(encoding="utf-8"))
R = json.loads((RAIZ / "src" / "ritmo.json").read_text(encoding="utf-8"))
# v1o-e: la canción está editada por compases; los eventos pasan a sus segundos en la canción editada
ED = R.get("edicion", [[0, 1e9, 0]])
ed = lambda l: sorted(n + t - a for a, b, n in ED for t in l if a <= t < b)
LISTAS = {
    "cuerdas": ed([c["t"] for c in C["cuerdas"]]),
    "acentos 3+3+2": ed([c["t"] for c in C["cuerdas"] if c["acento"]]),
    "batería": ed(sorted(set(C["bombos"]) | set(C["palmas"]))),
}
A = 0.96
Bf = next((s["t"] for s in R.get("seccionesCancion", []) if s["id"] == "coda"), 86.8)
if len(sys.argv) > 2 and sys.argv[-1].count("-") == 1 and sys.argv[-1].replace("-", "").replace(".", "").isdigit():
    A, Bf = map(float, sys.argv.pop().split("-"))
for v in sys.argv[1:]:
    W, H = 216, 270
    raw = subprocess.run([FF, "-v", "error", "-i", v, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
    dv = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))  # dv[i]: cambio que aparece en el cuadro i + 1
    salto = np.maximum(0, np.diff(dv, prepend=dv[0]))
    n = len(salto)
    cuadro = np.arange(n) + 1
    tt = cuadro / 30
    sel = (tt >= A) & (tt < Bf)
    print(Path(v).name)
    for nombre, lista in LISTAS.items():
        x = np.zeros(n)
        for t in lista:
            k = int(np.floor(t * 30)) - 1  # índice de salto del cuadro que contiene el evento
            for j in (k, k + 1):
                if 0 <= j < n:
                    x[j] = 1
        a, b = salto[sel], x[sel]
        r = np.corrcoef(a, b)[0, 1]
        g = a[b > 0].mean() / a.mean()
        print(f"  {nombre:15s} r = {r:+.3f}   ganancia = {g:.2f}")
