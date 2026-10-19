"""LIC animada del campo de dos cargas para el cierre (técnica de Cabral-Leedom / Forssell): el núcleo de convolución a
lo largo de cada línea de campo lleva una ondulación cuya fase avanza con el tiempo, así las hebras FLUYEN de la carga
+q (izquierda) a la −q (derecha). La fase recorre la línea más rápido donde |E| es mayor (junto a las cargas).
Como el núcleo es Hann·(1 + m·cos(Φ(s) − θ)), cada cuadro es B + m·Re(C·e^{−iθ}): basta una sola integración por
formato para sacar los N cuadros del loop, que cierra sin costura (θ = 2πn/N).

Salida: public/img/campo-<formato>/fNN.jpg (N cuadros, loop de N/30 s). Hebras de 1 px, más finas y suaves que la
textura fija (herramientas/lic.py) y fondo más oscuro, como la foto de perfil.

Uso: PYTHONPATH=pylib python3 herramientas/lic_animada.py [formato ...]
"""
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
# (nombre, ancho, alto, y de las cargas, escala): debe coincidir con src/disposicion.ts
FORMATOS = [("45", 1080, 1350, 675, 1.0), ("169", 1920, 1080, 540, 1.12), ("916", 1080, 1920, 960, 1.0)]
N = 60  # cuadros del loop (2 s a 30 fps)
LOOP = N / 30
L = 70  # pasos de integración hacia cada lado (px)
M = 0.75  # cuánto pesa la ondulación que fluye frente a la hebra fija
CICLOS = 2  # ciclos de la ondulación por loop (1 Hz): longitud de onda de 38 a 95 px, hebras largas que fluyen
V_LEJOS, V_CERCA = 38.0, 95.0  # rapidez de las vetas (px/s): lejos de las cargas y junto a ellas


def lic_animada(W, H, cy, s, semilla=5):
    rng = np.random.default_rng(semilla)
    q = [(W / 2 - 400 * s, cy, 1.0), (W / 2 + 400 * s, cy, -1.0)]
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    ex = np.zeros((H, W), np.float32)
    ey = np.zeros((H, W), np.float32)
    for qx, qy, qq in q:
        dx, dy = x - qx, y - qy
        r3 = (dx * dx + dy * dy + 4.0) ** 1.5
        ex += qq * dx / r3
        ey += qq * dy / r3
    mag = np.hypot(ex, ey) + 1e-12
    ux, uy = ex / mag, ey / mag
    # rapidez local de las vetas y paso de fase por píxel recorrido
    cerca = np.clip((mag / np.percentile(mag, 97)) ** 0.5, 0, 1)
    dfase = (2 * np.pi * (CICLOS / LOOP) / (V_LEJOS + (V_CERCA - V_LEJOS) * cerca)).astype(np.float32)
    # ruido escaso de 1 px: hebras finas
    ruido = (rng.random((H, W)).astype(np.float32) ** 3.2).astype(np.float32)
    # fase aleatoria por píxel (Forssell): cada grano de ruido late con su propio desfase, sin bandas coherentes
    phi = (rng.random((H, W)) * 2 * np.pi).astype(np.float32)
    B = ruido.copy()
    Cr = ruido * np.cos(phi)
    Ci = ruido * np.sin(phi)
    P = np.ones((H, W), np.float32)
    for signo in (1, -1):
        px, py = x.copy(), y.copy()
        fase = np.zeros((H, W), np.float32)
        for k in range(1, L + 1):
            ix = np.clip(px.astype(np.int32), 0, W - 1)
            iy = np.clip(py.astype(np.int32), 0, H - 1)
            fase += signo * dfase[iy, ix]
            px += signo * ux[iy, ix]
            py += signo * uy[iy, ix]
            fuera = (px < 0) | (px >= W - 1) | (py < 0) | (py >= H - 1)
            # muestreo bilineal del ruido y de la fase: sin moiré de vecino más cercano
            x0 = np.clip(np.floor(px).astype(np.int32), 0, W - 2)
            y0 = np.clip(np.floor(py).astype(np.int32), 0, H - 2)
            fx = np.clip(px - x0, 0, 1).astype(np.float32)
            fy = np.clip(py - y0, 0, 1).astype(np.float32)
            ix = np.clip(px.astype(np.int32), 0, W - 1)
            iy = np.clip(py.astype(np.int32), 0, H - 1)
            w = np.where(fuera, 0.0, np.float32(0.5 + 0.5 * np.cos(np.pi * k / L))).astype(np.float32)
            n = ((ruido[y0, x0] * (1 - fx) + ruido[y0, x0 + 1] * fx) * (1 - fy) + (ruido[y0 + 1, x0] * (1 - fx) + ruido[y0 + 1, x0 + 1] * fx) * fy) * w
            B += n
            f = fase + phi[iy, ix]
            Cr += n * np.cos(f)
            Ci += n * np.sin(f)
            P += w
    # envolvente y paleta (más oscura que lic.py, como la foto)
    cerca2 = np.clip((mag / np.percentile(mag, 60)) ** 0.33, 0, 2.2) / 2.2
    rn = np.hypot((x - W / 2) / (0.62 * max(W, H)), (y - cy) / (0.62 * max(W, H)))
    vin = np.clip(1 - 0.95 * rn**2, 0.04, 1) ** 2.0
    stops = np.array([0, 0.25, 0.55, 0.85, 1.25])
    cols = np.array([[1, 2, 7], [5, 13, 58], [17, 45, 165], [62, 112, 245], [180, 205, 255]], np.float32)
    base = np.stack([np.interp(rn, [0, 0.6, 1.1], [c0, c1, 0]) for c0, c1 in ((1, 0), (3, 1), (14, 5))], -1)
    v0 = (B + M * Cr) / P
    lo, hi = np.percentile(v0, 2), np.percentile(v0, 99.8)
    for n in range(N):
        th = -2 * np.pi * CICLOS * n / N  # signo: las vetas van de +q a −q
        v = (B + M * (Cr * np.cos(th) + Ci * np.sin(th))) / P
        v = np.clip((v - lo) / (hi - lo), 0, 1)
        I = np.clip(v**2.0 * (0.45 + 1.45 * cerca2**1.6) * vin, 0, 1.25)
        rgb = np.stack([np.interp(I, stops, cols[:, c]) for c in range(3)], -1)
        yield np.clip(rgb + base, 0, 255).astype(np.uint8)


pedidos = sys.argv[1:] or [f[0] for f in FORMATOS]
for nombre, W, H, cy, s in FORMATOS:
    if nombre not in pedidos:
        continue
    carpeta = RAIZ / "public" / "img" / f"campo-{nombre}"
    carpeta.mkdir(parents=True, exist_ok=True)
    p = subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "30", "-i", "-",
                          "-q:v", "2", "-start_number", "0", str(carpeta / "f%02d.jpg")], stdin=subprocess.PIPE)
    for img in lic_animada(W, H, cy, s):
        p.stdin.write(img.tobytes())
    p.stdin.close()
    p.wait()
    print("listo", carpeta, N, "cuadros")
