"""Uso: PYTHONPATH=../pylib python3 herramientas/tambores_nautilus.py
Detecta en la pista final (public/musica.wav) el redoble de tambores que suena bajo el nautilus y lo guarda en
src/ritmo.json como «tamboresNautilus» (segundos de escena, con su fuerza). Cada golpe agrega un tabique a la concha.
Flujo espectral en tres bandas (40-180 Hz pesa más: toms y bombos), picos locales con 75 ms de separación mínima.
Coincide con los toms, cajas y bombos del análisis de la canción llevados a la edición (diferencias < 20 ms)."""
import json
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
RUTA = RAIZ / "src" / "ritmo.json"
R = json.loads(RUTA.read_text(encoding="utf-8"))
B0, CB = R["cancion"]["primerCompas"], R["cancion"]["compas"]
video = lambda e: B0 + e * CB / 2
escena = lambda t: round((t - B0) * 2 / CB, 4)
sec = {s["id"]: s["t"] for s in R["secciones"]}
# Ventana: desde que aparece el nautilus hasta que se apaga en el silencio (vis cae desde T_SIL − 0,45 escena).
a, b = video(sec["nautilus"]) - 0.06, video(sec["silencio"] - 0.4)
SR = 44100
FF = imageio_ffmpeg.get_ffmpeg_exe()
m0 = a - 0.4
raw = subprocess.run([FF, "-v", "error", "-ss", str(m0), "-t", str(b - m0 + 0.2), "-i", str(RAIZ / "public" / "musica.wav"),
                      "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32)
n, hop = 1024, 128
f = np.fft.rfftfreq(n, 1 / SR)
S = np.array([np.abs(np.fft.rfft(x[i:i + n] * np.hanning(n))) for i in range(0, len(x) - n, hop)])
tt = m0 + (np.arange(len(S)) * hop + n / 2) / SR


def flujo(lo, hi):
    m = (f >= lo) & (f < hi)
    return np.r_[0, np.maximum(0, np.diff(np.log1p(S[:, m] * 30), axis=0)).sum(1)]


bajo, medio, alto = flujo(40, 180), flujo(180, 2000), flujo(2000, 9000)
tot = bajo / bajo.max() + 0.8 * medio / medio.max() + 0.4 * alto / alto.max()
z = (tot - np.median(tot)) / (tot.std() + 1e-9)
ev = []
for i in range(2, len(z) - 2):
    if z[i] != z[i - 2:i + 3].max() or z[i] <= 1.2 or not (a <= tt[i] <= b):
        continue
    if ev and tt[i] - ev[-1][0] < 0.075:
        if z[i] > ev[-1][1]:
            ev[-1] = (tt[i], z[i])
        continue
    ev.append((tt[i], z[i]))
zmax = max(v for _, v in ev)
R["tamboresNautilus"] = [{"t": escena(t), "v": round(float(v / zmax), 3)} for t, v in ev]
RUTA.write_text(json.dumps(R, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{len(ev)} golpes entre {a:.2f} y {b:.2f} s de video:", [round(float(t), 3) for t, _ in ev])
