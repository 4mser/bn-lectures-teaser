"""Música y diseño de sonido del teaser trailer de B&N Lectures (v1d). Todo sintetizado aquí con numpy.

Mismo sonido que la v1 «luminosa» (120 BPM, Re mayor, I–V–vi–IV, motivo de 5 notas F#5 A5 E5 F#5 D6, pluck,
campanitas, pad cálido, efectos afinados) desarrollado desde el MATERIAL ORIGINAL de la v1 «luminosa» (sus patrones de arpegio, bajo, bombo, palmas y hats,
su motivo, sus builds, sus drops y la sección del logo con la respuesta lidia), repetido con variaciones:
  intro (0–4 s) → build 1 (4–14) → drop 1 (14–30) → breakdown con glitches (30–34) → build 2 (34–36) → drop 2
  (36–52) → sección del logo de la v1 (52–64) → build 3 (64–66) → silencio (66–67,5) → «tú» (67,5–70) → final
  con epiciclos (70–75,5) → coda (75,5–84).

Grilla fija: compás = 2 s, pulso = 0,5 s. Además de public/musica.wav escribe src/ritmo.json con la grilla, las
secciones, cada golpe, nota y efecto, para que la imagen caiga en el golpe por construcción.

Uso: PYTHONPATH=pylib python3 audio/generar_musica.py
"""
import json
import os
import wave
from pathlib import Path

import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
COMPASES = 44  # compases de la grilla (88 s; v1o: +2 compases en el drop 2 para el fluido y el final largo del fractal)
TOTAL = COMPASES * BAR  # 88 s
RAIZ = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(11)
N = int(SR * TOTAL)

# Secciones (segundo de inicio). La imagen usa los mismos nombres (src/ritmo.ts).
SECCIONES = [
    ("carga", 0.0), ("lissajous", 3.0), ("atomo", 5.0), ("orbital", 7.0), ("cuantico", 9.0), ("campo", 14.0),
    ("hoyo", 17.5), ("toro", 23.0), ("orbita", 25.0), ("tres", 27.0), ("busqueda", 30.0), ("teseracto", 34.0),
    ("fluido", 36.0), ("mandelbrot", 38.0), ("julia", 41.5), ("lorenz", 45.5), ("grayscott", 50.0), ("chladni", 52.0),
    ("adn", 55.0), ("prisma", 59.0), ("aurea", 63.0), ("girasol", 65.5), ("nautilus", 67.5), ("silencio", 70.0),
    ("tu", 71.5), ("final", 74.0), ("coda", 79.5),
]


# v1o: los dos compases nuevos del drop 2 (26 y 27) repiten I–V, así desde el compás 28 la armonía sigue igual que
# antes (cada compás toca el acorde que tocaba dos compases antes)
def acorde(c):
    return (c - 2 * (c >= 26)) % 4


def T(compas, pulso=0.0):
    return compas * BAR + pulso * BEAT


def midi(nombre):
    notas = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    return 12 * (int(nombre[-1]) + 1) + notas[nombre[:-1]]


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


# ── Buses: seco y envío a reverb, estéreo ──
seco = np.zeros((N, 2))
envio = np.zeros((N, 2))
ducking = np.ones(N)  # sidechain del bombo para pad y bajo
lado = {k: np.zeros((N, 2)) for k in ("pad", "bajo")}


def poner(dest, t0, s, gan=1.0, pan=0.0):
    i0 = int(round(t0 * SR))
    if i0 >= N or i0 + len(s) <= 0:
        return
    if i0 < 0:
        s, i0 = s[-i0:], 0
    i1 = min(N, i0 + len(s))
    s = s[: i1 - i0] * gan
    dest[i0:i1, 0] += s * np.sqrt((1 - pan) / 2) * np.sqrt(2)
    dest[i0:i1, 1] += s * np.sqrt((1 + pan) / 2) * np.sqrt(2)


def env(largo, ataque, caida):
    t = np.arange(largo) / SR
    e = np.minimum(1, t / max(ataque, 1e-4)) * np.exp(-t / caida)
    r = min(largo, int(0.03 * SR))
    e[-r:] *= np.linspace(1, 0, r)
    return e


# ── Instrumentos ──
def piano(m, dur, vel=1.0):
    """Piano suave aditivo: parciales algo inarmónicos que caen más rápido cuanto más agudos, y un golpecito de martillo."""
    largo = int((dur + 1.6) * SR)
    t = np.arange(largo) / SR
    f = hz(m)
    B = 0.0004
    s = np.zeros(largo)
    for n in range(1, 9):
        fn = f * n * np.sqrt(1 + B * n * n)
        if fn > 9000:
            break
        a = vel ** (0.6 + 0.15 * n) / n ** 1.15
        s += a * np.sin(2 * np.pi * fn * t + n) * np.exp(-t * (0.9 + 0.55 * n) * (1 + f / 1400))
    s *= np.minimum(1, t / 0.004)
    # suelta la tecla
    k = int(dur * SR)
    if k < largo:
        s[k:] *= np.exp(-(t[k:] - dur) * 5)
    golpe = rng.standard_normal(int(0.012 * SR)) * np.exp(-np.arange(int(0.012 * SR)) / SR * 400) * 0.02 * vel
    s[: len(golpe)] += golpe
    return s


def pluck(m, brillo=1.0):
    """Pluck del arpegio: aditivo tipo Karplus-Strong (los armónicos altos se apagan antes). brillo abre el filtro."""
    largo = int(0.42 * SR)
    t = np.arange(largo) / SR
    f = hz(m)
    s = np.zeros(largo)
    nmax = int(2 + 10 * brillo)
    for n in range(1, nmax + 1):
        if f * n > 12000:
            break
        s += np.sin(2 * np.pi * f * n * t) / n ** 1.3 * np.exp(-t * (7 + 5 * n / max(brillo, 0.15)))
    return s * np.minimum(1, t / 0.002)


def campana(m, dur=1.6):
    """Campanita/glockenspiel: parciales de barra (1, 2.76, 5.40, 8.93) con ataque nítido."""
    largo = int(dur * SR)
    t = np.arange(largo) / SR
    f = hz(m)
    s = np.zeros(largo)
    for r, a, d in ((1, 1, 1.1), (2.76, 0.42, 3.5), (5.40, 0.2, 7), (8.93, 0.08, 12)):
        if f * r < 15000:
            s += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d)
    return s * np.minimum(1, t / 0.0015)


def pad(ms, dur):
    """Pad cálido: diente de sierra suave (aditivo, 1/n²) con detune, ataque y caída lentos."""
    largo = int((dur + 0.8) * SR)
    t = np.arange(largo) / SR
    s = np.zeros(largo)
    for m in ms:
        for d in (0.996, 1.0, 1.004):
            f = hz(m) * d
            for n in range(1, 7):
                s += np.sin(2 * np.pi * f * n * t + n * d * 7) / (n * n)
    e = np.minimum(1, t / 0.6) * np.where(t > dur, np.exp(-(t - dur) * 4), 1)
    return s * e / len(ms)


def bajo(m, dur):
    largo = int(dur * SR)
    t = np.arange(largo) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t) + 0.05 * np.sin(6 * np.pi * f * t)
    return s * np.minimum(1, t / 0.008) * np.minimum(1, (dur - t) / 0.03).clip(0) * np.exp(-t * 1.2)


def bombo():
    largo = int(0.32 * SR)
    t = np.arange(largo) / SR
    fr = 46 + 85 * np.exp(-t * 32)
    s = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 11)
    s[: int(0.003 * SR)] += np.linspace(0.25, 0, int(0.003 * SR))
    return s


def ruido(largo):
    return rng.standard_normal(largo)


def banda(x, lo, hi):
    """Filtro de banda por FFT (fase cero), con flancos suaves."""
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = np.ones_like(f)
    if lo:
        H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        H *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if X.ndim == 2:
        H = H[:, None]
    return np.fft.irfft(X * H, n=len(x), axis=0)


def palmas():
    largo = int(0.22 * SR)
    t = np.arange(largo) / SR
    r = banda(ruido(largo), 1100, 5200)
    e = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.011, 0.022)) + 0.6 * np.exp(-np.clip(t - 0.03, 0, None) * 18) * (t >= 0.03)
    return r * e


def hat(abierto=False):
    largo = int((0.22 if abierto else 0.05) * SR)
    t = np.arange(largo) / SR
    return banda(ruido(largo), 7500, None) * np.exp(-t * (14 if abierto else 85))


# ── Efectos afinados (bus propio: se mezclan 6–10 dB bajo la música, en el mismo espacio de reverb) ──
ESCALA = [midi(n) for n in ("D5", "E5", "F#5", "A5", "B5", "D6", "E6", "F#6")]
efectos = []
fx_seco = np.zeros((N, 2))
fx_envio = np.zeros((N, 2))


def rosa(largo):
    """Ruido rosa (1/f) por forma espectral: más cuerpo y menos aspereza que el blanco."""
    X = np.fft.rfft(rng.standard_normal(largo))
    f = np.fft.rfftfreq(largo, 1 / SR)
    X *= 1 / np.sqrt(np.maximum(f, 20))
    x = np.fft.irfft(X, n=largo)
    return x / (np.abs(x).max() + 1e-9)


def barrido(x, f0, f1, ancho=0.9, curva=lambda u: u):
    """Pasa-banda que barre de f0 a f1 (en octavas, con una curva suave), por STFT con ventana de Hann."""
    nfft, salto = 2048, 512
    win = np.hanning(nfft)
    largo = len(x)
    y = np.zeros(largo + nfft)
    xp = np.concatenate([x, np.zeros(nfft)])
    f = np.fft.rfftfreq(nfft, 1 / SR)
    lf = np.log2(np.maximum(f, 1))
    for i in range(0, largo, salto):
        u = curva(min(1.0, i / max(1, largo - 1)))
        c = np.log2(f0) + (np.log2(f1) - np.log2(f0)) * u
        H = np.exp(-((lf - c) / ancho) ** 2)
        y[i : i + nfft] += np.fft.irfft(np.fft.rfft(xp[i : i + nfft] * win) * H, n=nfft) * win
    return y[:largo] / 1.5


def suave(u):
    return u * u * (3 - 2 * u)


def poner_fx(t0, s, gan, pan0=0.0, pan1=None, rev=0.6):
    """Coloca un efecto mono con paneo que se mueve de pan0 a pan1 y lo manda a la reverb compartida."""
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        s, i0 = s[-i0:], 0
    i1 = min(N, i0 + len(s))
    s = s[: i1 - i0] * gan
    p = np.linspace(pan0, pan0 if pan1 is None else pan1, len(s))
    L = s * np.sqrt((1 - p) / 2) * np.sqrt(2)
    R = s * np.sqrt((1 + p) / 2) * np.sqrt(2)
    fx_seco[i0:i1, 0] += L
    fx_seco[i0:i1, 1] += R
    fx_envio[i0:i1, 0] += L * rev
    fx_envio[i0:i1, 1] += R * rev


def s_blip(m):
    largo = int(0.5 * SR)
    t = np.arange(largo) / SR
    f = hz(m)
    s = (np.sin(2 * np.pi * f * t) + 0.12 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 9) * np.minimum(1, t / 0.012) ** 2
    return s * np.minimum(1, (largo - np.arange(largo)) / (0.12 * SR))


def blip(t0, m, gan=0.06, pan=0.0):
    """Blip: seno redondo afinado con ataque de 6 ms y cola corta; el armónico va apagado."""
    poner_fx(t0, s_blip(m), gan, pan, rev=0.9)
    efectos.append({"t": round(t0, 4), "tipo": "blip", "nota": int(m)})


def s_whoosh(largo_s=0.9, sube=True, nota=None):
    """Whoosh aireado: ruido rosa con un pasa-banda que barre en octavas (curva suave), ataque lento (~0,25 s),
    pico al 75 % del largo y caída suave; más una capa tonal (dos notas del acorde que suben una quinta)."""
    largo = int(largo_s * SR)
    t = np.arange(largo) / SR
    u = t / largo_s
    r = rosa(largo)
    f0, f1 = (250, 3200) if sube else (3200, 250)
    s = barrido(r, f0, f1, 0.8, suave)
    pico = 0.75
    forma = np.where(u < pico, np.sin(np.pi / 2 * np.clip(u / pico, 0, 1)) ** 2, np.cos(np.pi / 2 * np.clip((u - pico) / (1 - pico), 0, 1)) ** 1.5)
    s = s / (np.abs(s).max() + 1e-9) * forma
    m0 = nota if nota is not None else midi("D5")
    gl = 2 ** (0.583 * suave(np.clip(u, 0, 1)))  # sube una quinta
    tono = np.zeros(largo)
    for m, a in ((m0, 1.0), (m0 + 7, 0.6), (m0 + 12, 0.35)):
        tono += a * np.sin(2 * np.pi * np.cumsum(hz(m) * gl) / SR)
    tono *= forma * 0.14
    return s + tono


def whoosh(t_pico, largo_s=0.9, gan=0.05, izq_a_der=True, sube=True):
    s = s_whoosh(largo_s, sube)
    t0 = t_pico - largo_s * 0.75
    a, b = (-0.7, 0.7) if izq_a_der else (0.7, -0.7)
    poner_fx(t0, s, gan, a, b, rev=1.0)
    efectos.append({"t": round(t_pico, 4), "tipo": "whoosh"})


def s_impacto(fuerte=False):
    """Impacto con cuerpo: sub en la tónica (Re) con una caída de tono corta, transiente suave (no un clic) y un
    soplo de ruido rosa por debajo de 2,5 kHz. La cola la pone la reverb compartida."""
    largo = int((1.8 if fuerte else 1.0) * SR)
    t = np.arange(largo) / SR
    f = hz(midi("D2")) * (1 + 0.5 * np.exp(-t * 18))
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (2.2 if fuerte else 4.0)) * np.minimum(1, t / 0.016) ** 2
    cuerpo = np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * np.exp(-t * 7) * 0.25 * np.minimum(1, t / 0.016) ** 2
    aire = banda(rosa(largo), 120, 2500) * np.exp(-t * (5 if fuerte else 9)) * np.minimum(1, t / 0.012)
    s = sub * (0.95 if fuerte else 0.6) + cuerpo + aire * (0.35 if fuerte else 0.2)
    return s * np.minimum(1, (largo - np.arange(largo)) / (0.3 * SR))


def impacto(t0, fuerte=False):
    poner_fx(t0, s_impacto(fuerte), 0.32 if fuerte else 0.2, 0.0, rev=0.45)
    efectos.append({"t": round(t0, 4), "tipo": "impacto_fuerte" if fuerte else "impacto"})


def riser(t0, t1, gan=0.06):
    """Riser: ruido rosa con banda que sube y un tono que asciende una octava hasta Re, con paneo que se abre."""
    largo = int((t1 - t0) * SR)
    t = np.arange(largo) / SR
    u = t / (t1 - t0)
    s = barrido(rosa(largo), 300, 4200, 0.9, lambda x: x ** 1.6)
    s /= np.abs(s).max() + 1e-9
    f = hz(midi("D4")) * 2 ** u
    tono = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    forma = u ** 2.2
    mez = (s * 0.8 + tono * 0.18) * forma
    poner_fx(t0, mez, gan, -0.3, 0.3, rev=0.9)
    efectos.append({"t": round(t0, 4), "tipo": "riser", "fin": round(t1, 4)})


def shimmer(t0, gan=0.06):
    """Shimmer: nube de campanitas en Dmaj9 que se abre en abanico y se va a la reverb."""
    notas = [midi(n) for n in ("D6", "F#6", "A6", "C#7", "E7", "A7")]
    for k, m in enumerate(notas):
        c = campana(m, 2.4) * 0.5
        poner_fx(t0 + k * 0.045, banda(c, None, 7000), gan, -0.7 + 1.4 * k / 5, rev=1.6)
    efectos.append({"t": round(t0, 4), "tipo": "shimmer"})


def glitch(t0, m, gan=0.04):
    """Tartamudeo afinado y suave: la misma nota en fusas, en seno con ataque corto."""
    for k in range(4):
        largo = int(0.05 * SR)
        tt = np.arange(largo) / SR
        s = np.sin(2 * np.pi * hz(m + 12 * (k % 2)) * tt) * np.exp(-tt * 40) * np.minimum(1, tt / 0.004)
        poner_fx(t0 + k * BEAT / 8, s, gan, (-0.5, 0.5)[k % 2], rev=0.8)
    efectos.append({"t": round(t0, 4), "tipo": "glitch"})


# ── Armonía ──
# Por compás: raíz del bajo, voicing del pad (sin raíz), voicing del piano (mano derecha).
ACORDES = [
    ("D", midi("D2"), [midi(n) for n in ("A3", "E4", "F#4", "C#5")]),  # Dmaj9
    ("A", midi("A1"), [midi(n) for n in ("E4", "A4", "B4", "C#5")]),  # Aadd9
    ("Bm", midi("B1"), [midi(n) for n in ("F#4", "A4", "C#5", "D5")]),  # Bm9
    ("G", midi("G1"), [midi(n) for n in ("B3", "D4", "F#4", "A4")]),  # Gmaj9
]
MOTIVO = [(0.0, "F#5", 0.75), (0.75, "A5", 0.75), (1.5, "E5", 0.5), (2.0, "F#5", 0.5), (2.5, "D6", 1.5)]
motivo_eventos = []


def motivo(compas, instrumento, gan, transp=0, eco=False):
    for p, n, d in MOTIVO:
        m = midi(n) + transp
        t0 = T(compas, p)
        s = piano(m, d * BEAT, 0.9) if instrumento == "piano" else campana(m, 1.8)
        poner(seco, t0, s, gan, 0.15)
        poner(envio, t0, s, gan * 0.9)
        if eco:
            poner(envio, t0 + 0.75 * BEAT, s, gan * 0.35)
        motivo_eventos.append({"t": round(t0, 4), "nota": int(m), "inst": instrumento})


kicks = []
claps = []
hats = []
arpegio = []
golpes = []  # golpes con nombre para el final: suave, final, nota
ostinato = []  # notas de la coda (LECTURES letra a letra y pulsos del campo)


def kick(tk, gan=0.25):
    poner(seco, tk, banda(bombo(), 38, None), gan)
    kicks.append(round(tk, 4))
    i0 = int(tk * SR)
    largo = int(BEAT * 0.9 * SR)
    d = 1 - 0.55 * np.exp(-np.arange(largo) / SR * 9)
    i1 = min(N, i0 + largo)
    ducking[i0:i1] = np.minimum(ducking[i0:i1], d[: i1 - i0])


def clap(tc_, gan=0.09, registrar=True):
    poner(seco, tc_, palmas(), gan, 0.1)
    poner(envio, tc_, palmas(), gan * 0.55)
    if registrar:
        claps.append(round(tc_, 4))


def hatp(th, abierto=False, gan=0.03, pan=0.0):
    poner(seco, th, hat(abierto), gan, pan)
    hats.append(round(th, 4))


def piano_acorde(c, v, gan=1.0):
    nombre, raiz, voces = ACORDES[acorde(c)]
    t0 = T(c)
    poner(seco, t0, piano(raiz + 24, BAR * 0.95, v), 0.08 * gan, -0.2)
    poner(envio, t0, piano(raiz + 24, BAR * 0.95, v), 0.06 * gan)
    for k, m in enumerate(voces):
        s = piano(m + (12 if m < midi("D4") else 0), BAR * 0.9, v)
        poner(seco, t0 + k * 0.035, s, 0.07 * gan, -0.3 + 0.2 * k)
        poner(envio, t0 + k * 0.035, s, 0.06 * gan)


def arp(c, brillo, gan=0.06, paso=4, desde=0):
    """Arpegio de pluck: paso = 4 → semicorcheas, 2 → corcheas."""
    nombre, raiz, voces = ACORDES[acorde(c)]
    notas = voces + [voces[1] + 12, voces[2] + 12, voces[3] + 12, voces[2] + 12]
    n = 4 * paso
    for k in range(desde, n):
        tt = T(c) + k * BEAT / paso
        b = brillo(k / n) if callable(brillo) else brillo
        m = notas[(k * 3) % len(notas)] + 12
        s = pluck(m, b)
        arpegio.append([round(tt, 4), int(m)])
        g = gan * (0.75 if k % 4 else 1.0)
        poner(seco, tt, s, g, 0.45 if k % 2 else -0.45)
        poner(envio, tt, s, g * 0.8)


def bajo_corcheas(c, gan=0.1, octava=False):
    nombre, raiz, voces = ACORDES[acorde(c)]
    for k in range(8):
        m = raiz + 12 + (12 if k in (3, 7) else 0)
        poner(lado["bajo"], T(c) + k * BEAT / 2, bajo(m, BEAT / 2 * 0.92), gan)
        if octava and k % 2 == 0:
            poner(lado["bajo"], T(c) + k * BEAT / 2, bajo(m + 12, BEAT / 2 * 0.9), gan * 0.35)


def bajo_largo(c, gan=0.12):
    nombre, raiz, voces = ACORDES[acorde(c)]
    for p in (0, 2):
        poner(lado["bajo"], T(c, p), bajo(raiz + 12, BEAT * 1.9), gan)


# ── Arreglo (v1g): el material de la v1 «luminosa» (mismos patrones de arpegio, bajo, bombo, palmas, hi-hats, motivo,
# builds y drops), desarrollado y repetido con variaciones para cubrir 84 s.
#   intro (0-1) · build 1 (2-6) · drop 1 (7-14) · breakdown (15-16) · build 2 (17) · drop 2 (18-25) ·
#   sección del logo de la v1 (26-31) · build 3 (32) · silencio · «tú» · final (35-37) · coda (38-41)
INTRO, BUILD1, DROP1, BREAK, BUILD2, DROP2, LOGO, BUILD3 = range(0, 2), range(2, 7), range(7, 15), range(15, 17), range(17, 18), range(18, 28), range(28, 34), range(34, 35)
FINAL_C = range(37, 40)
CODA_C = range(40, 44)


def arp_v1(c, br, gan=0.06):
    nombre, raiz, voces = ACORDES[acorde(c)]
    notas = voces + [voces[1] + 12, voces[2] + 12, voces[3] + 12, voces[2] + 12]
    for k in range(16):
        tt = T(c) + k * BEAT / 4
        b = br(k) if callable(br) else br
        m = notas[(k * 3) % len(notas)] + 12
        s = pluck(m, b)
        arpegio.append([round(tt, 4), int(m)])
        g = gan * (0.75 if k % 4 else 1.0)
        poner(seco, tt, s, g, 0.45 if k % 2 else -0.45)
        poner(envio, tt, s, g * 0.8)


for c in range(COMPASES):
    nombre, raiz, voces = ACORDES[acorde(c)]
    t0 = T(c)
    if c in range(35, 37):
        continue  # silencio y «tú» se escriben aparte
    gp = 0.05 if c in INTRO else 0.06 if c in BREAK else 0.04 if c in DROP1 or c in DROP2 else 0.045
    poner(lado["pad"], t0, pad(voces, BAR), gp)
    if c in INTRO or c in BREAK or c in LOGO or c in FINAL_C or c in CODA_C:
        piano_acorde(c, 0.6 if c in INTRO else 0.5, 0.6 if c in FINAL_C else 1.0)
    if c in BUILD1:
        arp_v1(c, lambda k, c=c: 0.15 + 0.85 * ((c - 2) * 16 + k) / 80)
    elif c in DROP1 or c in DROP2 or c in LOGO:
        arp_v1(c, 0.9)
    elif c in BUILD2 or c in BUILD3:
        arp_v1(c, lambda k: 0.25 + 0.75 * k / 16)
    elif c in BREAK and c == 16:
        arp_v1(c, lambda k: 0.15 + 0.2 * k / 16, 0.045)
    elif c in FINAL_C:
        arp(c, 0.45, 0.045, paso=2)
    if c in DROP1 or c in DROP2 or c in LOGO:
        for k in range(8):
            m = raiz + 12 + (12 if k in (3, 7) else 0)
            poner(lado["bajo"], t0 + k * BEAT / 2, bajo(m, BEAT / 2 * 0.92), 0.1)
            if c in DROP2 and k % 2 == 0:  # variación: el bajo se dobla a la octava en el segundo drop
                poner(lado["bajo"], t0 + k * BEAT / 2, bajo(m + 12, BEAT / 2 * 0.9), 0.035)
    if c in BUILD1:
        pk = [0, 2] if c < 4 else [0, 1, 2, 3]
    elif c in DROP1 or c in DROP2 or c in LOGO:
        pk = [0, 1, 2, 3]
    elif c in BUILD2 or c in BUILD3:
        pk = [0, 1, 1.5, 2, 2.5, 3]
    else:
        pk = []
    for p in pk:
        kick(T(c, p), 0.25 if c >= 4 else 0.18)
    if c in DROP1 or c in DROP2 or c in LOGO:
        for p in (1, 3):
            clap(T(c, p), 0.09)
        for k in range(16):
            contra = k % 4 == 2
            ab = contra and (c >= 11)
            hatp(T(c, k / 4), ab, 0.04 if contra else 0.018, 0.3 if k % 2 else -0.25)
    if c in (5, 6) or c in BUILD2:
        for k in range(8):
            hatp(T(c, k / 2 + 0.25), False, 0.032, -0.25)
    if c in (6,) or c in BUILD2 or c in BUILD3:
        pasos_r = [p / 2 for p in range(0, 4)] + [2 + p / 4 for p in range(0, 6)]
        for i, p in enumerate(pasos_r):
            clap(T(c, p), 0.03 + 0.05 * i / len(pasos_r), registrar=False)

# Motivo: como en la v1 (piano en la intro y en el breakdown, campanitas con eco cada dos compases en los drops,
# piano y campanitas en la sección del logo y la respuesta lidia antes del final).
motivo(0, "piano", 0.09)
for c in (7, 9, 11, 13):
    motivo(c, "campana", 0.07, eco=True)
motivo(15, "piano", 0.1)
for c in (18, 20, 22, 24, 26):
    motivo(c, "campana", 0.07, eco=True)
for c in (28, 30, 32):
    motivo(c, "campana", 0.07, eco=True)
    motivo(c, "piano", 0.06)
for p, n in ((0, "A5"), (0.5, "G#5"), (1, "F#5"), (1.5, "E5"), (2, "C#6"), (3, "D6")):
    s = campana(midi(n), 1.8)
    poner(seco, T(33, p), s, 0.05)
    poner(envio, T(33, p), s, 0.06)
    motivo_eventos.append({"t": round(T(33, p), 4), "nota": midi(n), "inst": "campana"})

# ── Efectos (suaves, en su bus) ──
blip(0.0, midi("D5"), 0.05)
shimmer(0.0, 0.03)
blip(0.5, midi("A5"))
blip(1.5, midi("B5"))
blip(2.5, midi("D6"), 0.07)
FUERTES_S = ("campo", "fluido", "tu")
CON_IMPACTO = ("cuantico", "hoyo", "toro", "tres", "teseracto", "mandelbrot", "lorenz", "chladni", "adn", "prisma", "aurea")
for k, (nombre, t0) in enumerate(SECCIONES[1:]):
    if nombre in ("silencio", "final", "coda", "busqueda"):
        continue
    fuerte = nombre in FUERTES_S
    whoosh(t0, 1.4 if fuerte else 1.0, 0.06 if fuerte else 0.045, izq_a_der=k % 2 == 0, sube=k % 3 != 2)
    if fuerte:
        impacto(t0, True)
        shimmer(t0, 0.06)
    elif nombre in CON_IMPACTO:
        impacto(t0, False)
    blip(t0 + 0.02, ESCALA[k % len(ESCALA)], 0.04)
# Breakdown: glitch afinado en cada pulso del segundo compás (como «Javier» en la v1); «de» y «buscar».
whoosh(T(15), 1.0, 0.04)
for p in range(4):
    glitch(T(16, p), ESCALA[p * 2 % len(ESCALA)])
blip(32.0, midi("A5"), 0.05)
blip(32.5, midi("D6"), 0.06)
shimmer(32.5, 0.04)
riser(T(6), T(6, 3.5), 0.05)
riser(T(17), T(17, 3.5), 0.06)
riser(T(34), 70.0, 0.065)
glitch(T(6, 3.5), midi("D6"))
glitch(T(17, 3.5), midi("D6"))

SILENCIOS = [(T(6, 3.5), T(7)), (T(17, 3.5), T(18)), (70.0, 71.5)]
for a, b in SILENCIOS:
    i0, i1 = int(a * SR), int(b * SR)
    piso = 0.04 if b - a > 0.5 else 0.15
    for bus in (seco, lado["pad"], lado["bajo"], fx_seco):
        bus[i0:i1] *= (np.linspace(1, 0, i1 - i0)[:, None] ** 0.5 * (1 - piso) + piso)
    ducking[i0:i1] = 1
for s, g in ((piano(midi("D6"), 1.2, 0.7), 0.1), (campana(midi("D6"), 2.2), 0.05)):
    poner(seco, 70.0, s, g)
    poner(envio, 70.0, s, g * 1.2)
motivo_eventos.append({"t": 70.0, "nota": midi("D6"), "inst": "piano"})
efectos.append({"t": 70.0, "tipo": "nota_silencio"})
for tk in (71.5, 72.0, 72.5):
    kick(tk, 0.28)
for k, m in enumerate([midi(n) for n in ("D3", "A3", "E4", "F#4", "C#5", "E5")]):
    s = piano(m, 2.3, 0.7)
    poner(seco, 71.5 + k * 0.025, s, 0.06, -0.4 + 0.16 * k)
    poner(envio, 71.5 + k * 0.025, s, 0.07)
poner(lado["pad"], 71.5, pad([midi(n) for n in ("A3", "E4", "F#4", "C#5", "E5")], 2.4), 0.07)
for k, (p, n, _) in enumerate(MOTIVO):
    s = campana(midi(n), 1.8)
    poner(seco, 71.5 + p * BEAT, s, 0.06, 0.15)
    poner(envio, 71.5 + p * BEAT, s, 0.06)
    motivo_eventos.append({"t": round(71.5 + p * BEAT, 4), "nota": midi(n), "inst": "campana"})

whoosh(74.0, 1.0, 0.035)
for tg, tipo in ((75.0, "suave"), (77.5, "suave"), (79.5, "final")):
    golpes.append({"t": tg, "tipo": tipo})
    if tipo == "suave":
        kick(tg, 0.16)
        nombre, raiz, voces = ACORDES[acorde(int(tg // BAR))]
        for k, m in enumerate(voces):
            s = piano(m + 12, 1.2, 0.5)
            poner(seco, tg + k * 0.02, s, 0.05)
            poner(envio, tg + k * 0.02, s, 0.06)
    else:
        kick(tg, 0.3)
        impacto(tg, True)
        shimmer(tg, 0.07)
riser(77.5, 79.5, 0.05)
for i in range(16):
    clap(77.5 + i * 0.125, 0.02 + 0.05 * i / 16, registrar=False)
ESC_ARRIBA = [midi(n) for n in ("D6", "E6", "F#6", "A6", "B6", "D7", "E7", "F#7")]
for k in range(8):
    tt = 79.5 + 0.25 + k * 0.25
    m = ESC_ARRIBA[k]
    poner(seco, tt, campana(m, 1.4), 0.04, -0.5 + k / 7)
    poner(envio, tt, campana(m, 1.4), 0.05)
    ostinato.append({"t": round(tt, 4), "vel": round(0.9 - 0.04 * k, 3)})
for k in range(10):
    tt = 82.0 + k * 0.5
    m = [midi(n) for n in ("A5", "F#5", "D6", "E6")][k % 4]
    s = pluck(m, 0.35)
    poner(seco, tt, s, 0.035, 0.4 if k % 2 else -0.4)
    poner(envio, tt, s, 0.04)
    ostinato.append({"t": round(tt, 4), "vel": round(0.5 - 0.03 * k, 3)})
for tg in (82.5, 83.5):
    golpes.append({"t": tg, "tipo": "nota"})
blip(82.5, midi("F#6"), 0.04)
blip(83.5, midi("A6"), 0.035)
FIN = 83.5
for k, m in enumerate([midi(n) for n in ("D2", "A2", "E3", "F#3", "C#4", "E4", "A4")]):
    s = piano(m + 12, 3.6, 0.75)
    poner(seco, FIN + k * 0.03, s, 0.06, -0.4 + 0.13 * k)
    poner(envio, FIN + k * 0.03, s, 0.08)
poner(lado["pad"], FIN, pad([midi(n) for n in ("A3", "E4", "F#4", "C#5", "E5")], 3.2), 0.07)
shimmer(FIN, 0.05)

# ── Mezcla ──
lado["pad"] = banda(lado["pad"], 160, 7000)
lado["bajo"] = banda(lado["bajo"], 35, 900)
seco += (lado["pad"] + lado["bajo"]) * ducking[:, None]
envio += lado["pad"] * ducking[:, None] * 0.7

# Reverb por convolución: ruido estéreo que decae (2,6 s) con predelay, oscureciéndose con el tiempo.
L = int(2.6 * SR)
tt = np.arange(L) / SR
ir = np.zeros((L, 2))
for ch in range(2):
    r = ruido(L) * np.exp(-tt * 2.4)
    claro = banda(r, 300, 9000)
    oscuro = banda(r, 300, 2500)
    mezcla_t = np.exp(-tt * 1.5)
    ir[:, ch] = claro * mezcla_t + oscuro * (1 - mezcla_t)
ir[: int(0.022 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(0))
envio = banda(envio, 250, None)
nfft = 1 << int(np.ceil(np.log2(N + L)))
IR_F = [np.fft.rfft(ir[:, ch], nfft) for ch in range(2)]


def reverb(x):
    y = np.zeros((len(x), 2))
    for ch in range(2):
        y[:, ch] = np.fft.irfft(np.fft.rfft(x[:, ch], nfft) * IR_F[ch], nfft)[: len(x)]
    return y


musica = seco + reverb(envio) * 0.55
# Efectos: mismo espacio de reverb; ecualización que les deja 2–5 kHz a la música y corta lo áspero arriba de 8 kHz;
# compresión suave; y su nivel queda 8 dB bajo la música (RMS de toda la pieza).
def eq_fx(x):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = 1 - 0.45 * np.exp(-((np.log2(np.maximum(f, 1)) - np.log2(3200)) / 0.7) ** 2)  # −5 dB alrededor de 2–5 kHz
    H *= 1 / np.sqrt(1 + (f / 8000) ** 6)
    H *= 1 / np.sqrt(1 + (40 / np.maximum(f, 1)) ** 4)
    return np.fft.irfft(X * H[:, None], n=len(x), axis=0)


fx = eq_fx(fx_seco + reverb(eq_fx(fx_envio)) * 0.8)
pk = np.abs(fx).max() + 1e-9
fx = np.tanh(fx / pk * 1.6) / np.tanh(1.6) * pk  # compresión suave de los picos
rms = lambda x: np.sqrt((x ** 2).mean()) + 1e-12
fx *= rms(musica) / rms(fx) * 10 ** (-8 / 20)
NIVELES = {"musica": 20 * np.log10(rms(musica)), "efectos": 20 * np.log10(rms(fx))}
master = musica + fx
master = banda(master, 28, 16000)
# Entrada y salida: el acorde final se apaga suave hasta el último cuadro.
master[: int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]
fin_fade = int(2.5 * SR)
master[-fin_fade:] *= np.linspace(1, 0, fin_fade)[:, None] ** 1.5

# Saturación suave y normalización a −1,5 dBFS de pico (deja margen para el AAC).
master /= np.abs(master).max()
master = np.tanh(master * 1.4) / np.tanh(1.4)
master *= 10 ** (-1.5 / 20) / np.abs(master).max()  # pico −1,5 dBFS (≤ −1)

ruta = RAIZ / "public" / "musica.wav"
with wave.open(str(ruta), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((master * 32767).astype("<i2").tobytes())

ritmo = {
    "bpm": BPM,
    "pulso": BEAT,
    "compas": BAR,
    "corchea": BEAT / 2,
    "total": TOTAL,
    "secciones": [{"id": s, "t": t0} for s, t0 in SECCIONES],
    "bombos": sorted(kicks),
    "palmas": sorted(claps),
    "hats": sorted(hats),
    "arpegio": sorted(arpegio),
    "motivo": sorted(motivo_eventos, key=lambda e: e["t"]),
    "efectos": sorted(efectos, key=lambda e: e["t"]),
    "drops": [14.0, 36.0, 71.5, 79.5],
    "risers": [{"t0": T(6), "t1": T(6, 3.5)}, {"t0": T(17), "t1": T(17, 3.5)}, {"t0": T(34), "t1": 70.0}, {"t0": 77.5, "t1": 79.5}],
    "silencios": [list(s) for s in SILENCIOS],
    "golpes": golpes,
    "ostinato": ostinato,
    "swells": [{"tipo": "redoble", "t0": 77.5, "t1": 79.5}],
}
(RAIZ / "src" / "ritmo.json").write_text(json.dumps(ritmo, ensure_ascii=False, indent=1))

# Informe de niveles por sección y bandas (para revisar la mezcla sin oírla).
mono = master.mean(1)
print(f"pico {20 * np.log10(np.abs(master).max()):.2f} dBFS, {len(kicks)} bombos, {len(efectos)} efectos")
print(f"RMS antes del master: música {NIVELES['musica']:.1f} dB, efectos {NIVELES['efectos']:.1f} dB (diferencia {NIVELES['musica'] - NIVELES['efectos']:.1f} dB)")
bordes = [t0 for _, t0 in SECCIONES] + [TOTAL]
for (s, _), a, b in zip(SECCIONES, bordes, bordes[1:]):
    x = mono[int(a * SR) : int(b * SR)]
    X = np.abs(np.fft.rfft(x)) ** 2
    f = np.fft.rfftfreq(len(x), 1 / SR)
    tot = X.sum()
    bandas = [X[(f >= lo) & (f < hi)].sum() / tot * 100 for lo, hi in ((0, 120), (120, 500), (500, 4000), (4000, 20000))]
    rms = 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)
    print(f"{s:12s} {a:5.1f}s  rms {rms:6.1f} dBFS  <120 {bandas[0]:4.1f}%  120-500 {bandas[1]:4.1f}%  0,5-4k {bandas[2]:4.1f}%  >4k {bandas[3]:4.1f}%")

# Escucha virtual: cada efecto aislado, procesado igual que en la mezcla (seco + la misma reverb), para revisar su
# espectrograma con herramientas/escucha.py.
if os.environ.get("ESCUCHA"):
    muestras = {}
    for nombre, x, rev in (("whoosh", s_whoosh(0.9), 1.0), ("impacto", s_impacto(True), 0.45), ("blip", s_blip(midi("A5")), 0.9)):
        largo = len(x) + int(2.6 * SR)
        st = np.zeros((largo, 2))
        st[: len(x), 0] = st[: len(x), 1] = x
        y = eq_fx(st + reverb(np.vstack([eq_fx(st * rev), np.zeros((max(0, N - largo), 2))])[:largo]) * 0.8)
        muestras[nombre] = y.mean(1)
    np.savez(RAIZ / "out" / "escucha.npz", **muestras)
