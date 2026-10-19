"""Uso: PYTHONPATH=pylib python3 herramientas/sonidos_lectures.py [carpeta_revision]
Vuelve a poner sobre la canción real los sonidos del cierre de la v1o aprobada (audio/generar_musica.py de la tag
v1o-aprobada) y escribe public/musica.wav con la mezcla final:
  · una campanita por letra de LECTURES, en el cuadro exacto en que aparece la letra (las notas «ostinato» del final
    en src/ritmo.json), en arpegio ascendente con paneo de izquierda a derecha, como en la v1o;
  · el shimmer de la marca en la convergencia (golpe «final») y otra vez con la web;
  · un blip para «Próximamente» y otro para la web (golpes «nota»).
Tonalidad: el cromagrama de la coda da La menor (A dominante; E, G# y F presentes, C# ausente). Las notas salen de
La menor armónica: arpegio A5 C6 E6 A6 B6 C7 E7 A7, blips E6 y A6, shimmer en Am(add9).
Síntesis, reverb por convolución (2,6 s) y ecualización: las mismas de la v1o. Nivel: el RMS de los sonidos mientras
entran las letras queda 3 dB bajo el de la banda del ostinato (150 Hz-2,5 kHz) de la canción en ese tramo. La mezcla
se normaliza a −1 dBFS de pico (la canción decodificada ya pasaba de 0 dBFS)."""
import importlib.util
import json
import subprocess
import sys
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("editar_cancion", RAIZ / "herramientas" / "editar_cancion.py")
ed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ed)
SR = ed.SR
R = json.loads((RAIZ / "src" / "ritmo.json").read_text(encoding="utf-8"))
B0, CB = R["cancion"]["primerCompas"], R["cancion"]["compas"]
cancion_s = lambda e: B0 + e * CB / 2  # segundo de escena → segundo de la canción editada (un solo tramo)
rng = np.random.default_rng(7)

musica, _ = ed.cancion_editada()
N = len(musica)


def midi(nombre):
    notas = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    return 12 * (int(nombre[-1]) + 1) + notas[nombre[:-1]]


hz = lambda m: 440 * 2 ** ((m - 69) / 12)


# ── Instrumentos de la v1o (copiados de audio/generar_musica.py) ──
def campana(m, dur=1.6):
    largo = int(dur * SR)
    t = np.arange(largo) / SR
    f = hz(m)
    s = np.zeros(largo)
    for r, a, d in ((1, 1, 1.1), (2.76, 0.42, 3.5), (5.40, 0.2, 7), (8.93, 0.08, 12)):
        if f * r < 15000:
            s += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d)
    return s * np.minimum(1, t / 0.0015)


def s_blip(m):
    largo = int(0.5 * SR)
    t = np.arange(largo) / SR
    f = hz(m)
    s = (np.sin(2 * np.pi * f * t) + 0.12 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 9) * np.minimum(1, t / 0.012) ** 2
    return s * np.minimum(1, (largo - np.arange(largo)) / (0.12 * SR))


def banda(x, lo, hi):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = np.ones_like(f)
    if lo:
        H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        H *= 1 / np.sqrt(1 + (f / hi) ** 4)
    return np.fft.irfft(X * (H[:, None] if x.ndim > 1 else H), n=len(x), axis=0)


seco = np.zeros((N, 2))
envio = np.zeros((N, 2))


def poner(t0, s, gan, pan=0.0, rev=0.9):
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    i1 = min(N, i0 + len(s))
    s = s[: i1 - i0] * gan
    L = s * np.sqrt((1 - pan) / 2) * np.sqrt(2)
    Rr = s * np.sqrt((1 + pan) / 2) * np.sqrt(2)
    seco[i0:i1, 0] += L
    seco[i0:i1, 1] += Rr
    envio[i0:i1, 0] += L * rev
    envio[i0:i1, 1] += Rr * rev


def shimmer(t0, gan):
    notas = [midi(n) for n in ("A6", "B6", "C7", "E7", "A7", "B7")]  # Am(add9) (en la v1o: Dmaj9)
    for k, m in enumerate(notas):
        poner(t0 + k * 0.045, banda(campana(m, 2.4) * 0.5, None, 7000), gan, -0.7 + 1.4 * k / 5, rev=1.6)


# ── Tiempos: los mismos eventos que mueven la imagen ──
T_CONV = next(g["t"] for g in R["golpes"] if g["tipo"] == "final")
NOTAS = [g["t"] for g in R["golpes"] if g["tipo"] == "nota"]
# v1o-g: las letras entran con las gotas de la canción («gotas» en ritmo.json). Variante «sutil»: una campanita muy
# baja (−14 dB respecto de la de la v1o-f) en el mismo instante de cada gota, a su altura (E6, la nota de la gota);
# variante «sin» (por omisión): solo las gotas de la canción.
import os
VARIANTE = os.environ.get("CAMPANITAS", "sin")
GOTAS = R.get("gotas", [])
if VARIANTE == "sutil":
    for k, e in enumerate(GOTAS):
        poner(cancion_s(e), campana(midi("E6") + 12 * (k == len(GOTAS) - 1), 1.4), 10 ** (-14 / 20), -0.4 + 0.4 * k, rev=1.25)
# v1o-g: sin el shimmer de la convergencia: caía sobre las gotas (a −2,6 dB de ellas en su banda) y las tapaba
# v1o-h: sin sonidos agregados en el cierre (ni shimmer ni blips de «Próximamente» y la web: sonaban como brillo).
# Con SONIDOS_CIERRE=v1o se vuelven a poner los blips y el shimmer de la web.
if os.environ.get("SONIDOS_CIERRE") == "v1o":
    poner(cancion_s(NOTAS[0]), s_blip(midi("E6")), 1.3, rev=1.0)
    poner(cancion_s(NOTAS[1]), s_blip(midi("A6")), 1.1, rev=1.0)
    shimmer(cancion_s(NOTAS[1]), 1.0)

# ── Reverb y ecualización de la v1o ──
L = int(2.6 * SR)
tt = np.arange(L) / SR
ir = np.zeros((L, 2))
for ch in range(2):
    r = rng.standard_normal(L) * np.exp(-tt * 2.4)
    claro = banda(r, 300, 9000)
    oscuro = banda(r, 300, 2500)
    mez = np.exp(-tt * 1.5)
    ir[:, ch] = claro * mez + oscuro * (1 - mez)
ir[: int(0.022 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(0))
nfft = 1 << int(np.ceil(np.log2(N + L)))
reverb = lambda x: np.stack([np.fft.irfft(np.fft.rfft(x[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:N] for c in range(2)], 1)


def eq_fx(x):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = 1 - 0.45 * np.exp(-((np.log2(np.maximum(f, 1)) - np.log2(3200)) / 0.7) ** 2)
    H *= 1 / np.sqrt(1 + (f / 8000) ** 6)
    H *= 1 / np.sqrt(1 + (40 / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X * H[:, None], n=len(x), axis=0)


fx = eq_fx(seco + reverb(eq_fx(banda(envio, 250, None))) * 0.8)

# ── Nivel: el de la v1o-f (shimmer y blips 3 dB bajo la banda del ostinato de la canción en la coda) ──
a, b = int(cancion_s(T_CONV) * SR), int((cancion_s(T_CONV) + 2.1) * SR)
rms = lambda x: np.sqrt((x ** 2).mean()) + 1e-12
ref = rms(banda(musica[a:b], 150, 2500))
# el nivel se fija con lo que suena siempre (los blips y el shimmer de la web), en su propio tramo
c, e_ = int(cancion_s(NOTAS[0]) * SR), int((cancion_s(NOTAS[1]) + 0.9) * SR)
if np.abs(fx).max() > 1e-9:
    fx *= ref / rms(fx[c:e_]) * 10 ** (-3 / 20)
if GOTAS:
    # cuánto suman los sonidos añadidos a cada gota (banda de la gota, 150 ms desde el ataque)
    for e in GOTAS:
        i0 = int(cancion_s(e) * SR)
        g = rms(banda(musica[i0:i0 + int(0.15 * SR)], 1300, 6000))
        f_ = rms(banda(fx[i0:i0 + int(0.15 * SR)], 1300, 6000))
        print(f"gota {cancion_s(e):.3f} s: lo añadido queda {20 * np.log10(f_ / g):+.1f} dB respecto de la gota")
mezcla = musica + fx
# la cola del último shimmer se apaga en los 0,6 s finales (sin corte seco en el último cuadro)
fin = int(0.6 * SR)
mezcla[-fin:] *= np.linspace(1, 0, fin)[:, None] ** 1.5
pico = np.abs(mezcla).max()
mezcla *= 10 ** (-1 / 20) / pico
print(f"variante {VARIANTE} · gotas (s): {[round(cancion_s(e), 3) for e in GOTAS]} · convergencia {cancion_s(T_CONV):.3f} · notas {[round(cancion_s(e), 3) for e in NOTAS]}")
print(f"nivel de los sonidos: {20 * np.log10(rms(fx[c:e_])):.1f} dB RMS (banda del ostinato {20 * np.log10(ref):.1f} dB) · pico previo {20 * np.log10(pico):+.1f} dBFS → normalizado a −1,0 dBFS (ganancia {-1 - 20 * np.log10(pico):+.1f} dB)")
pcm = (np.clip(mezcla, -1, 1) * 32767).astype(np.int16)
with wave.open(str(RAIZ / "public" / "musica.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("public/musica.wav escrito")
if len(sys.argv) > 1:
    car = Path(sys.argv[1])
    car.mkdir(parents=True, exist_ok=True)
    t0 = cancion_s(T_CONV) - 0.5
    FF = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([FF, "-v", "error", "-y", "-ss", f"{t0:.3f}", "-t", "4.6", "-i", str(RAIZ / "public" / "musica.wav"),
                    "-lavfi", "showspectrumpic=s=1400x500:legend=1:scale=log:fscale=log:color=intensity:start=200:stop=8000", str(car / "final_espectro.png")], check=True)
    print("espectrograma desde", round(t0, 3), "s en", car / "final_espectro.png")
