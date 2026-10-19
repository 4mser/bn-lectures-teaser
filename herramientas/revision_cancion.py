"""Uso: PYTHONPATH=pylib python3 herramientas/revision_cancion.py video.mp4 carpeta [aprobada.mp4]
Hojas de revisión del montaje sobre la canción:
  · pares.png: en los 15 eventos más fuertes de la canción, el cuadro de 2 cuadros antes y el del golpe (+1);
  · tiras.png: cada transición re-cronometrada, de −0,3 s a +0,5 s;
  · comparacion.png (con la aprobada): cada sección, primero en la v1o y al lado en este montaje (mismo segundo de
    escena, medio segundo después de su comienzo)."""
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
RAIZ = Path(__file__).resolve().parent.parent
video, out = sys.argv[1], Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
R = json.loads((RAIZ / "src" / "ritmo.json").read_text(encoding="utf-8"))
FUENTE = "/System/Library/Fonts/Supplemental/Arial.ttf"


def cuadro(v, t, nombre, etiqueta):
    subprocess.run([FF, "-v", "error", "-y", "-ss", f"{max(0, t):.3f}", "-i", v, "-frames:v", "1", "-vf",
                    f"scale=216:270,drawtext=fontfile={FUENTE}:fontsize=17:fontcolor=yellow:box=1:boxcolor=black@0.7:x=4:y=4:text='{etiqueta}'",
                    str(nombre)], check=True)


def hoja(lista, cols, salida):
    d = out / "_t"
    d.mkdir(exist_ok=True)
    for f in d.glob("*.png"):
        f.unlink()
    for i, (v, t, et) in enumerate(lista):
        cuadro(v, t, d / f"c{i:03d}.png", et)
    filas = (len(lista) + cols - 1) // cols
    subprocess.run([FF, "-v", "error", "-y", "-i", str(d / "c%03d.png"), "-vf", f"tile={cols}x{filas}:padding=3:color=white", "-frames:v", "1", str(out / salida)], check=True)


EVENTOS = [28.63, 80.30, 13.86, 24.94, 31.40, 86.80, 35.09, 63.72, 21.25, 8.35, 46.17, 4.64, 61.85, 84.03, 79.19]
pares = []
for e in EVENTOS:
    pares += [(video, e - 2 / 30, f"{e:.2f} -2c"), (video, e + 1 / 30, f"{e:.2f} golpe")]
hoja(pares, 6, "pares.png")
CORTES = [m[0] for m in R["montaje"][1:-1]]
tiras = []
for c in sorted(set(CORTES)):
    for dt in (-0.3, -0.1, 0.0, 0.1, 0.25, 0.5):
        tiras.append((video, c + dt + 1 / 60, f"{c:.2f} {dt:+.1f}"))
hoja(tiras, 12, "tiras.png")
if len(sys.argv) > 3:
    ap = sys.argv[3]
    comp = []
    for s, sc in zip(R["secciones"], R["seccionesCancion"]):
        te = s["t"] + 0.5
        # segundo de la canción en que se ve ese segundo de escena
        tc = None
        for (s0, e0), (s1, e1) in zip(R["montaje"], R["montaje"][1:]):
            if s1 > s0 and e0 <= te < e1:
                tc = s0 + (te - e0) * (s1 - s0) / (e1 - e0)
                break
        if tc is None:
            continue
        comp += [(ap, te, f"v1o {s['id']}"), (video, tc, f"nueva {tc:.1f}")]
    hoja(comp, 10, "comparacion.png")
print("listo", out)
