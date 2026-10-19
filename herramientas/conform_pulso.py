"""Uso: PYTHONPATH=pylib python3 herramientas/conform_pulso.py
Conform de la v1o aprobada sobre la canción real, amarrado al pulso. Escribe src/ritmo.json.

Reglas:
  · un pulso de la v1o (0,5 s) = un pulso de la canción (0,4616 s), siempre: la animación corre un 8,3 % más rápido
    y nada más; cada semicorchea de la v1o cae en una semicorchea real de la canción;
  · la estructura se ajusta solo con pulsos enteros (casi siempre compases enteros): una sección de la v1o se alarga
    repitiendo un compás de sus eventos dentro de la escena (la escena sigue su movimiento continuo) o se acorta
    quitando pulsos de su interior; el comienzo y el final de cada escena (y sus transiciones) no se tocan;
  · el montaje lleva la línea de escena a la canción con cortes solo en downbeats (B(n) = compás 0 + n · 1,8464 s);
  · los drivers son los eventos INTERNOS de la v1o (src/ritmo_v1o.json, el mapa aprobado), reubicados con las mismas
    ediciones; no se mezclan eventos medidos de la canción.

Fuentes: src/ritmo_v1o.json (v1o-aprobada) y la rejilla de datos/analisis-cancion.json, afinada al ataque
real (+14 ms, igual que herramientas/ritmo_cancion.py)."""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
V = json.loads((RAIZ / "src" / "ritmo_v1o.json").read_text(encoding="utf-8"))
A = json.loads((RAIZ / "datos" / "analisis-cancion.json").read_text(encoding="utf-8"))
AFINADO = 0.014  # mediana del corrimiento de los impactos al ataque real (herramientas/ritmo_cancion.py)
B0 = round(A["primerCompas"] + AFINADO, 4)
CB = A["compas"]  # compás de la canción
DUR = A["duracionAudio"]
B = lambda n: B0 + n * CB

# ── 1. Ediciones por sección de la v1o: [nuevo largo (s), punto P desde el comienzo donde se repite o se quita] ──
# Se alarga repitiendo los eventos del compás [P − 2, P) después de P; se acorta quitando [P, P + recorte).
SEC = list(V["secciones"])
# v1o-e: escena nueva «ondas» (frentes de Huygens entre la doble rendija y el campo); en la v1o no existe (largo 0)
SEC.insert([x["id"] for x in SEC].index("campo"), {"id": "ondas", "t": next(x["t"] for x in SEC if x["id"] == "campo")})
ids = [s["id"] for s in SEC]
largo_v1o = {s["id"]: (SEC[i + 1]["t"] if i + 1 < len(SEC) else V["total"]) - s["t"] for i, s in enumerate(SEC)}
EDIT = {
    "carga": (4.0, 2.0),  # +2 pulsos: Lissajous en el impacto del compás 2
    "lissajous": (4.0, 2.0),  # +1 compás
    "orbital": (4.0, 2.0),  # +1 compás: el fluido cuántico entra en el impacto y braam del compás 7
    "cuantico": (6.0, 2.0),  # +2 pulsos (el patrón de interferencia sigue cayendo)
    "ondas": (6.0, 0.0),  # v1o-e: compases 10-13 (19,42-24,94): frentes de Huygens desde las rendijas
    "campo": (4.0, 2.0),  # +1 pulso: el campo nace en el impacto de 24,94 y colapsa con el riser en el agujero negro
    "hoyo": (6.0, 5.5),  # +1 pulso al final: el agujero negro gira un pulso más
    "tres": (4.0, 2.0),  # +2 pulsos: los tres cuerpos caen en la búsqueda justo en el empalme del quiebre
    "teseracto": (4.0, 0.0),  # +1 compás con el riser del quiebre
    "nautilus": (3.0, 1.0),  # +1 pulso: TÚ en el golpe final
    "tu": (2.0, 1.5),  # −1 pulso: el final en el compás 44 de la canción original
    "final": (5.0, 2.0),  # −1 pulso: la convergencia en el último impacto (86,80 en la original)
}
nuevo = {}
t = 0.0
for s in SEC:
    L0 = largo_v1o[s["id"]]
    L1, P = EDIT.get(s["id"], (L0, L0))
    assert abs(L1 * 2 - round(L1 * 2)) < 1e-9 and abs(P * 2 - round(P * 2)) < 1e-9, s["id"]
    nuevo[s["id"]] = {"viejo": s["t"], "L0": L0, "nuevo": t, "L1": L1, "P": P}
    t += L1
TOTAL_ESC = t


def seccion_de(x):
    k = 0
    for i, s in enumerate(SEC):
        if s["t"] <= x + 1e-9 and largo_v1o[s["id"]] > 0:
            k = i
    return SEC[k]["id"]


def mapa(x, extremo=False):
    """Tiempo v1o → tiempo de escena nuevo (None si cae en un tramo quitado)."""
    e = nuevo[seccion_de(x)]
    off = x - e["viejo"]
    d = e["L1"] - e["L0"]
    if off < e["P"] - 1e-9:
        return e["nuevo"] + off
    if d >= 0:
        return e["nuevo"] + off + d
    if off < e["P"] - d - 1e-9:
        return (e["nuevo"] + e["P"]) if extremo else None
    return e["nuevo"] + off + d


def repeticiones(x):
    """Copias de un evento rítmico dentro del compás repetido de una sección alargada."""
    e = nuevo[seccion_de(x)]
    d = e["L1"] - e["L0"]
    off = x - e["viejo"]
    out = []
    if d > 0 and e["P"] - 2 - 1e-9 <= off < e["P"] - 1e-9 and off >= -1e-9:
        k = 0
        while True:
            o = off + 2 + 2 * k
            if o >= e["P"] + d - 1e-9:
                break
            out.append(e["nuevo"] + o)
            k += 1
    return out


def lista(xs, ritmica=True):
    out = []
    for x in xs:
        y = mapa(x)
        if y is not None:
            out.append(round(y, 4))
        if ritmica:
            out += [round(r, 4) for r in repeticiones(x)]
    return sorted(out)


R = dict(V)
R["fuente"] = "v1o aprobada (eventos generados) conformada a «Unbreakable Spirit» (RaspberryMusic, Pixabay)"
R["secciones"] = [{"id": i, "t": round(nuevo[i]["nuevo"], 4)} for i in ids]
R["total"] = round(TOTAL_ESC, 4)
R["bombos"] = lista(V["bombos"])
R["palmas"] = lista(V["palmas"])
R["hats"] = lista(V["hats"])
arp = []
for t0, n in V["arpegio"]:
    y = mapa(t0)
    if y is not None:
        arp.append([round(y, 4), n])
    arp += [[round(r, 4), n] for r in repeticiones(t0)]
R["arpegio"] = sorted(arp)
R["motivo"] = sorted([dict(m, t=round(mapa(m["t"]), 4)) for m in V["motivo"] if mapa(m["t"]) is not None], key=lambda m: m["t"])
R["efectos"] = sorted([dict(e, t=round(mapa(e["t"]), 4), **({"fin": round(mapa(e["fin"], True), 4)} if "fin" in e else {})) for e in V["efectos"] if mapa(e["t"]) is not None], key=lambda e: e["t"])
R["drops"] = lista(V["drops"], False)
R["risers"] = [{"t0": round(mapa(r["t0"], True), 4), "t1": round(mapa(r["t1"] - 1e-6, True), 4)} for r in V["risers"]]
R["silencios"] = [[round(mapa(a, True), 4), round(mapa(b - 1e-6, True), 4)] for a, b in V["silencios"]]
R["golpes"] = [dict(g, t=round(mapa(g["t"]), 4)) for g in V["golpes"]]
R["ostinato"] = [dict(o, t=round(mapa(o["t"]), 4)) for o in V["ostinato"]]
R["swells"] = [dict(s, t0=round(mapa(s["t0"], True), 4), t1=round(mapa(s["t1"] - 1e-6, True), 4)) for s in V["swells"]]

# ── 2. Montaje: tramos [compás de la canción desde, hasta, segundo de escena en «desde»]; pendiente fija 2 / 1,8464 ──
S = lambda i: nuevo[i]["nuevo"]
# ── 2. Edición de la canción por compases enteros (cortes y repeticiones en downbeats, crossfade corto) ──
# v1o-e: todas las escenas de la v1o en su orden y con sus transiciones. Para que quepan: se quitan los compases 22-28
# del coro (de B22 se pasa directo al quiebre, B29) y se repite el clímax completo (compases 34-41) antes de la caída
# del compás 42. Cada tramo es [desde, hasta) en segundos de la canción original.
EDICION_COMPASES = [(None, 22), (29, 42), (34, 42), (42, None)]
EDICION = []
n0 = 0.0
for a, b in EDICION_COMPASES:
    o0 = 0.0 if a is None else B(a)
    o1 = DUR if b is None else B(b)
    EDICION.append([round(o0, 4), round(o1, 4), round(n0, 4)])
    n0 += o1 - o0
DUR_NUEVA = round(n0, 4)
# Montaje: un solo tramo, pendiente fija (2 s de escena por compás); el compás 0 de la canción editada es el de la
# original
M = [[round(B0, 4), 0.0], [DUR_NUEVA, round((DUR_NUEVA - B0) * 2 / CB, 4)]]
R["cancion"] = {"bpm": A["bpm"], "pulso": A["pulso"], "compas": CB, "primerCompas": B0, "total": DUR_NUEVA, "totalOriginal": DUR}
R["edicion"] = EDICION
R["montaje"] = M
R["ediciones"] = {i: {"v1o": round(nuevo[i]["L0"], 3), "nuevo": nuevo[i]["L1"], "pulsos": round((nuevo[i]["L1"] - nuevo[i]["L0"]) * 2)} for i in ids if i in EDIT}


def escena(t):
    for (s0, e0), (s1, e1) in zip(M[::2], M[1::2]):
        if s0 <= t < s1:
            return e0 + (t - s0) * 2 / CB
    return M[0][1] + (t - M[0][0]) * 2 / CB


def cancion(e):
    """Segundos de la canción en que se ve el segundo de escena e (puede no verse)."""
    for (s0, e0), (s1, e1) in zip(M[::2], M[1::2]):
        if e0 - 1e-6 <= e < e1 - 1e-6:
            return round(s0 + (e - e0) * CB / 2, 3)
    return None


R["seccionesCancion"] = [{"id": i, "t": cancion(nuevo[i]["nuevo"])} for i in ids]
(RAIZ / "src" / "ritmo.json").write_text(json.dumps(R, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"escena: {TOTAL_ESC:.2f} s · compás 0 de la canción en {B0:.3f} s")
for i in ids:
    e = nuevo[i]
    print(f"  {i:11s} v1o {e['viejo']:5.1f} ({e['L0']:3.1f} s) → escena {e['nuevo']:5.1f} ({e['L1']:3.1f} s) · canción {cancion(e['nuevo'])}")
for g in R["golpes"]:
    print("  golpe", g["tipo"], "escena", g["t"], "canción", cancion(g["t"]))
print("montaje:", M)
print("edición:", EDICION, "→", DUR_NUEVA, "s")
