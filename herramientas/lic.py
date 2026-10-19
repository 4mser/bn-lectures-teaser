"""Textura del cierre: LIC (line integral convolution) del campo real de dos cargas (+q a la izquierda, −q a la
derecha), como la foto de perfil de B&N Lectures: miles de hebras finas en azul profundo, radiales junto a cada carga
y en arcos amplios que llenan el cuadro, con viñeta. Una imagen por formato en public/img/campo-<formato>.png.
Las cargas van a media altura, a ±400·s px del centro (como en la foto, donde s = 1).

Uso: PYTHONPATH=pylib python3 herramientas/lic.py
"""
import subprocess
from pathlib import Path

import imageio_ffmpeg
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
# (nombre, ancho, alto, y de las cargas, escala): debe coincidir con src/disposicion.ts
FORMATOS = [("45", 1080, 1350, 675, 1.0), ("169", 1920, 1080, 540, 1.12), ("916", 1080, 1920, 960, 1.0)]
L = 70  # pasos de integración hacia cada lado (px)


def lic(W, H, cy, s, semilla=5):
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
    # Ruido escaso: hebras finas y brillantes, como en la foto.
    ruido = np.kron(rng.random(((H + 1) // 2, (W + 1) // 2)).astype(np.float32) ** 4.0, np.ones((2, 2), np.float32))[:H, :W]  # hebras de ~2 px
    acc = ruido.copy()
    peso = np.ones((H, W), np.float32)
    for signo in (1, -1):
        px, py = x.copy(), y.copy()
        for k in range(1, L + 1):
            ix = np.clip(px.astype(np.int32), 0, W - 1)
            iy = np.clip(py.astype(np.int32), 0, H - 1)
            px += signo * ux[iy, ix]
            py += signo * uy[iy, ix]
            fuera = (px < 0) | (px >= W - 1) | (py < 0) | (py >= H - 1)
            ix = np.clip(px.astype(np.int32), 0, W - 1)
            iy = np.clip(py.astype(np.int32), 0, H - 1)
            w = np.where(fuera, 0.0, np.float32(0.5 + 0.5 * np.cos(np.pi * k / L)))  # núcleo de Hann
            acc += w * ruido[iy, ix]
            peso += w
    v = acc / peso
    v = (v - np.percentile(v, 2)) / (np.percentile(v, 99.7) - np.percentile(v, 2))
    v = np.clip(v, 0, 1)
    # Envolvente: más brillo cerca de las cargas, viñeta hacia las esquinas, centro azul.
    cerca = np.clip((mag / np.percentile(mag, 60)) ** 0.33, 0, 2.2) / 2.2
    rn = np.hypot((x - W / 2) / (0.62 * max(W, H)), (y - cy) / (0.62 * max(W, H)))
    vin = np.clip(1 - 0.95 * rn ** 2, 0.04, 1) ** 1.4
    I = v ** 1.45 * (0.17 + 1.25 * cerca ** 1.7) * vin
    I = np.clip(I, 0, 1.25)
    # Paleta: casi negro → azul profundo → azul B&N → azul hielo.
    stops = np.array([0, 0.25, 0.55, 0.85, 1.25])
    cols = np.array([[1, 2, 8], [6, 16, 70], [20, 52, 185], [70, 125, 255], [190, 215, 255]], np.float32)
    rgb = np.stack([np.interp(I, stops, cols[:, c]) for c in range(3)], -1)
    # Fondo con viñeta: el azul profundo del centro baja a negro en las esquinas.
    base = np.stack([np.interp(rn, [0, 0.6, 1.1], [c0, c1, 0]) for c0, c1 in ((2, 1), (6, 3), (30, 12))], -1)
    return np.clip(rgb + base, 0, 255).astype(np.uint8)


for nombre, W, H, cy, s in FORMATOS:
    img = lic(W, H, cy, s)
    salida = RAIZ / "public" / "img" / f"campo-{nombre}.png"
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-i", "-", str(salida)], input=img.tobytes(), check=True)
    print("listo", salida)
