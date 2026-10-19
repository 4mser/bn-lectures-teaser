"""Uso: PYTHONPATH=pylib python3 herramientas/eventos_reales.py [carpeta_revision]
Detecta en la canción editada dos familias de eventos que la imagen sigue uno a uno y los agrega a src/ritmo.json (en
segundos de escena; correr después de herramientas/conform_pulso.py):
  · «gotas»: los ataques agudos tipo gota de la coda (campana o pizzicato con parciales en 1,3-6 kHz), por flujo
    espectral en esa banda, con umbral alto y 0,2 s de separación mínima. LECTURES se escribe con ellas: «letras»
    reparte las 8 letras entre las gotas (si hay menos de 8, varias letras por gota, de forma pareja);
  · «tamboresRendija»: los golpes de tambor bajo la doble rendija (toms y bombos del análisis de la canción con
    v ≥ 0,38 e impactos), cada uno con su fuerza.
Con carpeta_revision guarda el espectrograma de la coda con las gotas marcadas."""
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("editar_cancion", RAIZ / "herramientas" / "editar_cancion.py")
ed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ed)
SR = ed.SR
RUTA = RAIZ / "src" / "ritmo.json"
R = json.loads(RUTA.read_text(encoding="utf-8"))
A = json.loads((RAIZ / "datos" / "analisis-cancion.json").read_text(encoding="utf-8"))
B0, CB = R["cancion"]["primerCompas"], R["cancion"]["compas"]
escena = lambda t: round((t - B0) * 2 / CB, 4)
editada = lambda l: sorted(n + t - a for a, b, n in R["edicion"] for t in l if a <= t < b)
x, _ = ed.cancion_editada()
x = x.mean(axis=1)

# ── Gotas de la coda: desde la convergencia en la marca hasta que la canción se apaga ──
T_CONV = next(g["t"] for g in R["golpes"] if g["tipo"] == "final")
c0 = B0 + T_CONV * CB / 2
a, b = c0 - 0.15, c0 + 3.5
n, hop = 2048, 240
seg = x[int(a * SR):int(b * SR)]
f = np.fft.rfftfreq(n, 1 / SR)
m = (f >= 1300) & (f <= 6000)
S = np.array([np.abs(np.fft.rfft(seg[i:i + n] * np.hanning(n)))[m] for i in range(0, len(seg) - n, hop)])
fl = np.maximum(0, np.diff(np.log1p(S * 20), axis=0)).sum(1)
z = (fl - np.median(fl)) / (fl.std() + 1e-9)
tt = a + (np.arange(len(fl)) + 1) * hop / SR + n / (2 * SR) - n / SR * 0.5
gotas = []
for i in np.argsort(-z):
    if z[i] < 3.0:
        break
    t = float(tt[i])
    if all(abs(t - g) >= 0.2 for g in gotas):
        gotas.append(t)
gotas.sort()
# ataque: el primer instante antes del pico en que el flujo pasa la mitad del pico
gotas = [round(g, 3) for g in gotas]
k = len(gotas)
reparto = [8 // k + (1 if i < 8 % k else 0) for i in range(k)] if k else []
letras = [g for g, r in zip(gotas, reparto) for _ in range(r)]
print("gotas (s):", gotas, "· letras por gota:", reparto)

# ── Tambores bajo la doble rendija ──
c_ini = B0 + next(s["t"] for s in R["secciones"] if s["id"] == "cuantico") * CB / 2
c_fin = B0 + next(s["t"] for s in R["secciones"] if s["id"] == "ondas") * CB / 2
crudos = [(o["t"] + 0.014, o["v"]) for k_ in ("onsetsTom", "onsetsBombo") for o in A[k_] if o["v"] >= 0.38]
crudos += [(i["t"] + 0.014, max(0.8, i["v"])) for i in A["impactos"]]
crudos = [(t, v) for t, v in crudos if c_ini - 0.4 <= t < c_fin + 0.05]  # antes del primer empalme: sin edición
crudos.sort()
tambores = []
for t, v in crudos:
    if tambores and t - tambores[-1][0] < 0.09:
        if v > tambores[-1][1]:
            tambores[-1] = (t, v)
        continue
    tambores.append((t, v))
print("tambores bajo la rendija (s, fuerza):", [(round(t, 3), round(v, 2)) for t, v in tambores])

R["gotas"] = [escena(g) for g in gotas]
R["letras"] = [escena(g) for g in letras]
R["tamboresRendija"] = [{"t": escena(t), "v": round(min(1.0, v), 3)} for t, v in tambores]
RUTA.write_text(json.dumps(R, ensure_ascii=False, indent=1), encoding="utf-8")
print("src/ritmo.json: gotas, letras y tamboresRendija")
if len(sys.argv) > 1:
    car = Path(sys.argv[1])
    car.mkdir(parents=True, exist_ok=True)
    FF = imageio_ffmpeg.get_ffmpeg_exe()
    t0, dur = c0 - 0.5, 4.5
    W = 1600
    marcas = ",".join(f"drawbox=x={int((g - t0) / dur * W)}:y=0:w=2:h=12:color=cyan@0.9:t=fill" for g in gotas)
    subprocess.run([FF, "-v", "error", "-y", "-ss", f"{t0:.3f}", "-t", str(dur), "-i", str(RAIZ / "public" / "musica.wav"),
                    "-lavfi", f"showspectrumpic=s={W}x480:legend=0:scale=log:fscale=log:color=intensity:start=500:stop=12000,{marcas}",
                    str(car / "gotas.png")], check=True)
    print(f"espectrograma desde {t0:.3f} s (marcas cian = gotas) en", car / "gotas.png")
