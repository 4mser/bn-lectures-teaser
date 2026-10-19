"""Uso: PYTHONPATH=pylib python3 herramientas/ritmo_cancion.py [ruta del análisis]
Mapa de ritmo de la v1o sobre la canción real («Unbreakable Spirit», RaspberryMusic, Pixabay). Reemplaza a
audio/generar_musica.py: no genera música, solo lee public/musica.wav (la canción decodificada) y el análisis de
datos/analisis-cancion.json, y escribe src/ritmo.json.

Qué hace:
  1. Afina cada evento del análisis (impactos, braams, onsets de bombo, tom, caja y hats) al comienzo real de su
     ataque en el wav (como la v7d: primer instante en que la envolvente de 5 ms dobla el nivel previo). La rejilla
     (B(n) = compás 0 + n · 1,8464 s) se corre la mediana de esos ajustes.
  2. Detecta cada nota del ostinato de cuerdas (semicorcheas 3+3+2; lógica de herramientas/cuerdas.py de la v7d).
  3. Arma los drivers que lee la v1o con eventos reales (tabla de equivalencias de la v7d):
       arpegio → cada nota de cuerda · hats → notas sin acento · palmas → la caja o el tom más fuerte en cada tiempo
       débil (2 y 4) · bombo → golpes graves reales (impactos, bombos y toms fuertes) · motivo → los cinco primeros
       acentos 3+3+2 de cada compás · drops → impactos grandes y braams · risers → los risers del despegue y del
       quiebre · silencios → el hueco (23,66) y el silencio real (79,19) · golpes, ostinato y redoble del final →
       braam de 84,03, compás 46, último impacto (86,80) y notas de la coda.
  4. Escribe el montaje: tabla de nudos [segundo de la canción, segundo de escena]. La v1o sigue dibujándose en su
     propio tiempo de escena (sus secciones no cambian); el montaje dice qué segundo de escena suena en cada segundo
     de la canción (tramos lineales; dos nudos con el mismo segundo de canción son un corte).
Todos los tiempos de eventos quedan en segundos de la CANCIÓN; src/ritmo.ts los pasa a tiempo de escena."""
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
fuente = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "datos" / "analisis-cancion.json"
A = json.loads(fuente.read_text(encoding="utf-8"))
ORIG = json.loads(fuente.read_text(encoding="utf-8"))
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 22050
aud = np.frombuffer(subprocess.run([FF, "-v", "error", "-i", str(RAIZ / "public" / "musica.wav"), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                                   capture_output=True, check=True).stdout, dtype=np.float32)
DUR = len(aud) / SR


# ── 1. Afinado de los onsets ──
w5 = int(0.005 * SR)
env = np.sqrt(np.convolve(aud.astype(np.float64) ** 2, np.ones(w5) / w5, "same"))
paso = int(0.002 * SR)


def afina(t):
    a0, a1 = int((t - 0.08) * SR), int((t - 0.03) * SR)
    if a0 < 0:
        return t
    base = float(np.median(env[a0:a1])) + 1e-4
    for k in range(int((t - 0.03) * SR), int((t + 0.06) * SR), paso):
        if env[k] >= 2 * base:
            return round(k / SR, 3)
    return t


for i in A["impactos"]:
    i["t"] = afina(i["t"])
for b in A["braams"]:
    b["t"] = afina(b["t"])
for k in ("onsetsBombo", "onsetsTom", "onsetsCaja", "onsetsHats"):
    for o in A[k]:
        o["t"] = afina(o["t"])
desv = float(np.median([i["t"] - j["t"] for i, j in zip(A["impactos"], ORIG["impactos"])]))
B0 = round(A["primerCompas"] + desv, 4)
COMPAS = A["compas"]
PULSO = A["pulso"]
SEMI = COMPAS / 16
B = lambda n: B0 + n * COMPAS
for c in A["capas"]:
    c["t"] = round(c["t"] + desv, 4)
for r in A["risers"]:
    r["t1"] = round(r["t1"] + desv, 4)
print(f"corrimiento mediano de los impactos: {desv * 1000:+.0f} ms; compás 0 en {B0:.3f} s")
IMP = [i["t"] for i in A["impactos"]]
BRA = [b["t"] for b in A["braams"]]


def cerca(x, lista=None, tol=0.12):
    """Evento afinado más cercano a x (impacto o braam); si no hay a menos de tol, x."""
    lista = lista if lista is not None else IMP + BRA
    y = min(lista, key=lambda y: abs(y - x))
    return round(y if abs(y - x) <= tol else x, 3)


def compas_mas_cerca(x):
    n = round((x - B0) / COMPAS)
    return round(B(n), 3)


# ── 2. Notas del ostinato de cuerdas (v7d, herramientas/cuerdas.py) ──
HOP, WIN = 110, 1024
n = (len(aud) - WIN) // HOP
v = np.lib.stride_tricks.as_strided(aud, shape=(n, WIN), strides=(aud.strides[0] * HOP, aud.strides[0]))
S = np.abs(np.fft.rfft(v * np.hanning(WIN), axis=1))
fr = np.fft.rfftfreq(WIN, 1 / SR)
banda = (fr >= 150) & (fr <= 2500)
flujo = np.concatenate([[0], np.maximum(0, np.diff(np.log1p(S[:, banda] * 10), axis=0)).sum(axis=1)])
tt = (np.arange(n) * HOP + WIN / 2) / SR
k1 = int(1.0 / (HOP / SR))
pad = np.pad(flujo, (k1 // 2, k1 // 2), mode="edge")
med = np.array([np.median(pad[i:i + k1]) for i in range(0, n, 20)])
med = np.interp(np.arange(n), np.arange(0, n, 20), med)
crudas = []
for j in range(int((DUR - B0) / SEMI)):
    tg = B0 + j * SEMI
    i0, i1 = np.searchsorted(tt, tg - 0.04), np.searchsorted(tt, tg + 0.04)
    if i1 <= i0:
        continue
    i = i0 + int(np.argmax(flujo[i0:i1]))
    f = flujo[i]
    if f > 1.6 * med[i] and f > np.percentile(flujo, 40):
        a = i
        while a > i0 and flujo[a - 1] > 0.5 * f:
            a -= 1
        crudas.append({"t": round(float(tt[a]), 3), "j": j, "f": float(f)})
porc = {}
for x in crudas:
    porc.setdefault(x["j"] // 16, []).append(x["f"])
cuerdas = []
for x in crudas:
    m = np.median(porc[x["j"] // 16])
    cuerdas.append({"t": x["t"], "j": x["j"], "acento": bool(x["j"] % 8 in (0, 3, 6) or x["f"] > 1.35 * m), "fuerza": round(float(min(1.0, x["f"] / (2 * m))), 3)})
tramos = []
ini = None
for c in A["capas"]:
    if c["capa"] != "ostinato":
        continue
    if c["tipo"] == "entra" and ini is None:
        ini = c["t"]
    elif c["tipo"] == "sale" and ini is not None:
        tramos.append([ini, c["t"]])
        ini = None
hay = {x["j"] for x in cuerdas}
for a, b in tramos:
    for j in range(int(np.ceil((a - B0) / SEMI - 0.3)), int((b - B0) / SEMI)):
        if j not in hay:
            cuerdas.append({"t": round(B0 + j * SEMI, 3), "j": j, "acento": j % 8 in (0, 3, 6), "fuerza": 0.3, "inferida": True})
cuerdas.sort(key=lambda x: x["t"])
# Onsets audibles con el mismo detector que herramientas/sincronia_audio.py (flujo espectral de banda ancha): los
# cortes y los cortes por pulso se pegan al ataque que se oye, no a la rejilla teórica.
_h, _n = 256, 1024
_S = np.array([np.abs(np.fft.rfft(aud[i:i + _n] * np.hanning(_n))) for i in range(0, len(aud) - _n, _h)])
_f = np.maximum(0, np.diff(np.log1p(_S * 10), axis=0)).sum(1)
_f = (_f - np.median(_f)) / (_f.std() + 1e-9)
_tf = ((np.arange(len(_f)) + 1) * _h + _n / 2) / SR
ONSETS = [(float(_tf[i]), float(_f[i])) for i in range(3, len(_f) - 3)
          if _f[i] == _f[i - 3:i + 4].max() and _f[i] > 1.2 + np.median(_f[max(0, i - 40):i + 40])]


def pega(t, tol=0.06):
    """Onset audible más fuerte a ±tol de t (o t)."""
    c = [o for o in ONSETS if abs(o[0] - t) <= tol]
    return round(max(c, key=lambda o: o[1])[0], 3) if c else round(t, 3)


# cada nota de cuerda se pega a su ataque audible de banda ancha si lo tiene a ±40 ms (las inferidas quedan en la rejilla)
for x in cuerdas:
    if not x.get("inferida"):
        x["t"] = pega(x["t"], 0.04)
print(f"notas de cuerda: {len(cuerdas)} ({sum(1 for x in cuerdas if x.get('inferida'))} inferidas, {sum(x['acento'] for x in cuerdas)} acentos)")


def unir(listas, sep=0.09):
    out = []
    for t in sorted(t for l in listas for t in l):
        if not out or t - out[-1] >= sep:
            out.append(round(t, 3))
    return out


# ── 3. Drivers de la v1o con eventos reales (segundos de la canción) ──
bombos = unir([IMP, [o["t"] for o in A["onsetsTom"] if o["v"] >= 0.5], [o["t"] for o in A["onsetsBombo"] if o["v"] >= 0.45]])
# palmas: en la v1o caían en los tiempos débiles, una por segundo (el pulso de los cortes de los fractales). Aquí,
# una por medio compás real (0,92 s): la caja o el tom más fuerte a ±70 ms de uno de sus dos tiempos. En el coro
# cae en el 2 y el 4; en el clímax la caja fuerte va en el 1 y el 3.
golpes_med = [(o["t"], o["v"]) for o in A["onsetsCaja"] + A["onsetsTom"]]
palmas = []
for h in range(int((DUR - B0) / (2 * PULSO)) + 1):
    x0 = B0 + h * 2 * PULSO
    cand = [(t, vv) for t, vv in golpes_med if vv >= 0.5 and any(abs(t - (x0 + q * PULSO)) <= 0.07 for q in (0, 1))]
    if cand:
        palmas.append(round(max(cand, key=lambda q: q[1])[0], 3))
palmas = unir([palmas], 0.3)
hats = [x["t"] for x in cuerdas if not x["acento"]]
arpegio = [[x["t"], 84 + round(8 * x["fuerza"]) if x["acento"] else 66 + round(10 * x["fuerza"])] for x in cuerdas]
acentos = [x["t"] for x in cuerdas if x["acento"]]
motivo = []
for c in range(int((DUR - B0) / COMPAS) + 1):
    en = unir([[t for t in acentos if B(c) - 0.03 <= t < B(c) + 1.45]], 0.08)[:5]
    if len(en) < 5:  # sin ostinato audible: la rejilla 3+3+2 del compás (posiciones 0, 3, 6, 8 y 11)
        rej = [round(B(c) + q * SEMI, 3) for q in (0, 3, 6, 8, 11)]
        en = sorted(en + [g for g in rej if all(abs(g - t) > 0.06 for t in en)])[:5]
    # cada nota del motivo cae en el ataque audible más fuerte a ±110 ms (el acento de cuerda suele ir junto a un
    # golpe de caja o tom; si no hay ninguno queda en la nota)
    en = unir([[pega(t, 0.11) for t in en]], 0.08)
    motivo += [{"t": t, "nota": 78, "inst": "cuerda"} for t in en]
efectos = [{"t": i["t"], "tipo": "impacto_fuerte" if i["v"] >= 0.75 else "impacto"} for i in A["impactos"]]
efectos += [{"t": round(w["t0"] + desv, 3), "tipo": "whoosh", "fin": round(w["t1"] + desv, 3)} for w in A["whooshes"]]
drops = sorted({i["t"] for i in A["impactos"] if i["v"] >= 0.75} | {b["t"] for b in A["braams"] if b["v"] >= 0.75})
# risers: los que en la v1o tienen pareja (el que lleva al drop 1 → despegue; el del teseracto → riser del quiebre)
risers = []
for r in A["risers"]:
    if abs(r["t0"] - 23.64) < 0.2 or abs(r["t0"] - 57.63) < 0.2:
        risers.append({"t0": r["t0"], "t1": r["t1"]})
for r in risers:
    efectos.append({"t": r["t0"], "tipo": "riser", "fin": r["t1"]})
efectos.sort(key=lambda e: e["t"])
silencios = [[h["t0"], h["t1"]] for h in A["huecosAgudos"] if abs(h["t0"] - 23.66) < 0.1] + [[s["t0"], s["t1"]] for s in A["silencios"] if not s.get("final")]

# pulsos: cada tiempo de la canción, pegado a su ataque audible (lo usan los cortes por pulso de los fractales)
pulsos = [pega(B0 + k * PULSO, 0.07) for k in range(int((DUR - B0) / PULSO) + 1)]
# bombos y palmas también al ataque audible (±60 ms)
bombos = unir([[pega(t) for t in bombos]])
palmas = unir([[pega(t) for t in palmas]], 0.3)

# ── 4. Montaje: [segundo de la canción, segundo de escena de la v1o] ──
T_FIN = cerca(86.80)
M = [
    # Prólogo y acto I (intro A, A2, respiro y precarga)
    [0.47, 0.0],  # golpe que abre → el punto de luz
    [round(B(1), 3), 2.5],  # PREGUNTA en el compás 1
    [cerca(4.64), 3.0],  # impacto B2 → Lissajous (el riser corto 3,1-4,6 dobla los rayos)
    [cerca(8.35), 5.0],  # impacto B4 → Bohr
    [round(B(5), 3), 7.0],  # compás 5 → orbital
    [cerca(13.86), 9.0],  # impacto y braam B7 → fluido cuántico
    [cerca(21.25), 14.0],  # impacto y braam B11 → líneas de campo
    [23.66, 16.3],  # hueco: respiración (las líneas casi quietas)
    [cerca(24.94), 16.5],  # impacto B13: empieza el colapso, en cámara lenta con el gran riser
    # Acto II en el coro
    [cerca(28.63), 17.5],  # impacto mayor → agujero negro
    [cerca(31.40), 20.0],  # braam más fuerte → la cámara baja al disco
    [round(B(18), 3), 23.0],  # toro
    [round(B(19), 3), 25.0],  # órbita
    [cerca(37.86), 27.0],  # impacto B20 → tres cuerpos
    [cerca(40.63), 29.65],  # golpe → corte
    # Acto III (primera parte) en el coro: Gray-Scott, Chladni, ADN y prisma
    [cerca(40.63), 50.1],
    [43.28, 52.0],  # Chladni: la placa asoma en el golpe de 43,18 (un pulso antes de su sección) y se asienta
    [cerca(46.17), 55.0],  # impacto y braam → ADN
    [round(B(27), 3), 59.0],  # prisma
    [pega(B(29), 0.3), 62.8],  # quiebre (su primer golpe audible) → corte
    # Breakdown en el quiebre
    [pega(B(29), 0.3), 30.0],  # «Y ALGUIEN QUE NO DEJÓ DE»
    [57.20, 32.0],  # «DE», la última palabra: sus rebanadas se abren en el golpe de 57,27
    [cerca(58.19), 32.5],  # BUSCAR en el golpe de B31
    [round(B(32), 3), 34.0],  # teseracto con el riser del quiebre
    [cerca(61.85, BRA), 36.0],  # braam descendente → fluido (la caída)
    [round(B(34), 3), 38.0],  # clímax → Mandelbrot (7 pulsos = 7 tiempos)
    [round(B(34) + 7 * PULSO, 3), 41.5],  # Julia
    [round(B(34) + 9 * PULSO, 3), 42.5],  # último corte; plano final largo
    [cerca(70.17), 45.5],  # impacto y braam → Lorenz
    [cerca(73.86), 49.4],  # impacto → corte
    [cerca(73.86), 63.4],  # espiral áurea
    [round(B(40) + 2 * PULSO, 3), 65.5],  # girasol
    [round(B(41) + 2 * PULSO, 3), 67.5],  # nautilus, crescendo hasta 78,4
    [79.19, 70.0],  # silencio real → la estrella
    [cerca(80.30), 71.5],  # golpe final → TÚ
    [round(B(44), 3), 74.0],  # coda → el final aprobado
    [T_FIN, 79.5],  # último impacto → convergencia en la marca
    [round(DUR, 3), round(79.5 + DUR - T_FIN, 3)],
]


# cada nudo (salvo el arranque, el hueco, el silencio y el final de la cola) se pega al ataque audible
for m in M[1:-1]:
    if m[0] not in (23.66, 79.19):
        m[0] = pega(m[0])


def escena(t):
    for (s0, e0), (s1, e1) in zip(M, M[1:]):
        if s1 > s0 and s0 <= t < s1:
            return e0 + (t - s0) * (e1 - e0) / (s1 - s0)
    return t - M[0][0] + M[0][1] if t < M[0][0] else M[-1][1] + t - M[-1][0]


# ── Final: golpes, notas de la coda y redoble ──
braam84 = cerca(84.03)
b46 = round(B(46), 3)
# LECTURES entra letra a letra con los ocho primeros ataques reales de la coda (cuerdas, toms, cajas y bombos);
# «Próximamente» en el bombo de 89,46 y la web dos tiempos después del compás 48, ya en la cola (sin ataques).
coda = unir([[x["t"] for x in cuerdas], [o["t"] for k in ("onsetsTom", "onsetsCaja", "onsetsBombo") for o in A[k]]], 0.1)
ost = [t for t in coda if t > T_FIN + 0.15][:8]
prox = cerca(89.46, [o["t"] for o in A["onsetsBombo"]])
golpes = [{"t": braam84, "tipo": "suave"}, {"t": b46, "tipo": "suave"}, {"t": T_FIN, "tipo": "final"},
          {"t": prox, "tipo": "nota"}, {"t": round(B(48) + 2 * PULSO, 3), "tipo": "nota"}]
ostinato = [{"t": t, "vel": round(max(0.23, 0.9 - 0.04 * i), 2)} for i, t in enumerate(ost)]
swells = [{"tipo": "redoble", "t0": b46, "t1": T_FIN}]

V1O = json.loads((RAIZ / "src" / "ritmo.json").read_text(encoding="utf-8")) if (RAIZ / "src" / "ritmo.json").exists() else {}
secciones = V1O["secciones"]  # las secciones de escena de la v1o, sin cambios
R = {
    "fuente": A["fuente"],
    "nota": "Eventos en segundos de la canción; src/ritmo.ts los pasa a tiempo de escena con «montaje».",
    # grilla de ESCENA (la de la v1o: 120 BPM, compás de 2 s): la usan las transiciones y el final aprobado
    "bpm": 120, "pulso": 0.5, "compas": 2.0, "corchea": 0.25,
    "cancion": {"bpm": A["bpm"], "pulso": PULSO, "compas": COMPAS, "primerCompas": B0, "afinado": round(desv, 4), "total": round(DUR, 3),
                "downbeats": [round(B(c), 3) for c in range(int((DUR - B0) / COMPAS) + 1)],
                "impactos": [{"t": i["t"], "v": i["v"]} for i in A["impactos"]], "braams": [{"t": b["t"], "dur": b["dur"], "v": b["v"]} for b in A["braams"]]},
    "montaje": M,
    "secciones": secciones,
    "seccionesCancion": [],
    "pulsos": pulsos,
    "bombos": bombos, "palmas": palmas, "hats": hats, "arpegio": arpegio, "motivo": motivo, "efectos": efectos,
    "drops": drops, "risers": risers, "silencios": silencios, "golpes": golpes, "ostinato": ostinato, "swells": swells,
    "cuerdas": [{k: x[k] for k in ("t", "acento", "fuerza") if k in x} | ({"inferida": True} if x.get("inferida") else {}) for x in cuerdas],
}
# segundo de la canción en que empieza cada sección de escena (para el README y la revisión)
for s in secciones:
    hit = None
    for (s0, e0), (s1, e1) in zip(M, M[1:]):
        if s1 > s0 and e0 - 1e-6 <= s["t"] < e1 - 1e-6:
            hit = round(s0 + (s["t"] - e0) * (s1 - s0) / (e1 - e0), 3)
            break
    R["seccionesCancion"].append({"id": s["id"], "t": hit})
import os
SALIDA = RAIZ / os.environ.get("SALIDA", "src/ritmo.json")  # v1o-c: SALIDA=src/cancion.json (eventos reales aparte)
SALIDA.write_text(json.dumps(R, ensure_ascii=False, indent=1), encoding="utf-8")

# ── Verificación de los onsets contra el audio: distancia al pico de flujo de banda ancha más cercano ──
Sw = np.abs(np.fft.rfft(v * np.hanning(WIN), axis=1))
fl = np.concatenate([[0], np.maximum(0, np.diff(np.log1p(Sw * 10), axis=0)).sum(axis=1)])
picos = [tt[i] for i in range(3, len(fl) - 3) if fl[i] == fl[i - 3:i + 4].max() and fl[i] > np.percentile(fl, 75)]
picos = np.array(picos)
for nombre, lista in (("impactos", IMP), ("bombos", bombos), ("palmas", palmas), ("acentos de cuerda", acentos), ("notas de cuerda", [x["t"] for x in cuerdas if not x.get("inferida")])):
    d = np.array([np.min(np.abs(picos - t)) for t in lista]) * 1000
    print(f"{nombre:18s} {len(lista):4d}  a ±33 ms de un onset: {100 * (d <= 33.4).mean():3.0f} %  mediana {np.median(d):4.0f} ms")
print("secciones (escena → canción):", ", ".join(f"{s['id']} {s['t']}" for s in R["seccionesCancion"]))
print(SALIDA.name, "escrito")
