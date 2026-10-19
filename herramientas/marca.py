"""Extrae de public/img/bn-mark.png los contornos de la marca B&N (para los epiciclos de Fourier) y puntos del
interior (para las partículas que se reorganizan en el logo). Escribe src/marca.json en coordenadas normalizadas:
x en [-0.5, 0.5] a lo ancho de la marca, y centrada (misma escala que x).

Uso: PYTHONPATH=pylib python3 herramientas/marca.py
"""
import json
import subprocess
from collections import deque
from pathlib import Path

import imageio_ffmpeg
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
PNG = RAIZ / "public" / "img" / "bn-mark.png"
ESC = 2  # se trabaja a la mitad de resolución (la marca ya está a 2x)

raw = subprocess.run(
    [imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(PNG), "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
    capture_output=True, check=True,
).stdout
W0 = 1218
alfa = np.frombuffer(raw, np.uint8).reshape(-1, W0, 4)[..., 3]
# Recorte a la caja de la tinta y submuestreo.
ys, xs = np.where(alfa > 128)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
m = alfa[y0 : y1 + 1, x0 : x1 + 1][::ESC, ::ESC] > 128
h, w = m.shape
m = np.pad(m, 1)
H, W = m.shape


def componentes(mask):
    """Etiqueta componentes 4-conexas de True."""
    lab = np.zeros(mask.shape, int)
    n = 0
    for y in range(mask.shape[0]):
        for x in range(mask.shape[1]):
            if mask[y, x] and not lab[y, x]:
                n += 1
                q = deque([(y, x)])
                lab[y, x] = n
                while q:
                    cy, cx = q.popleft()
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n
                            q.append((ny, nx))
    return lab, n


# Moore: recorre el borde de una región (True) en el sentido de las agujas.
VEC = [(0, -1), (-1, -1), (-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1)]  # (dy, dx): oeste, noroeste, norte...


def borde(reg):
    ys, xs = np.where(reg)
    k = np.lexsort((xs, ys))[0]
    inicio = (ys[k], xs[k])
    pts = [inicio]
    actual = inicio
    atras = 0  # vengo desde el oeste
    for _ in range(200000):
        enc = False
        for i in range(8):
            d = (atras + 1 + i) % 8
            ny, nx = actual[0] + VEC[d][0], actual[1] + VEC[d][1]
            if reg[ny, nx]:
                atras = (d + 4) % 8
                # retrocede uno para empezar a mirar desde el vecino anterior
                atras = (atras + 0) % 8
                actual = (ny, nx)
                enc = True
                break
        if not enc or actual == inicio:
            break
        pts.append(actual)
    return pts


contornos = []
lab, n = componentes(m)
for i in range(1, n + 1):
    reg = lab == i
    if reg.sum() < 30:
        continue
    contornos.append(borde(reg))
# Huecos: componentes del fondo que no tocan el borde.
labf, nf = componentes(~m)
for i in range(1, nf + 1):
    reg = labf == i
    yy, xx = np.where(reg)
    if yy.min() == 0 or xx.min() == 0 or yy.max() == H - 1 or xx.max() == W - 1 or reg.sum() < 30:
        continue
    contornos.append(borde(reg))


def norm(y, x):
    return [round((x - 1 - w / 2) / w, 5), round((y - 1 - h / 2) / w, 5)]


def remuestrea(pts, n=240):
    p = np.array(pts, float)
    p = np.vstack([p, p[:1]])
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    u = np.linspace(0, d[-1], n, endpoint=False)
    return np.c_[np.interp(u, d, p[:, 0]), np.interp(u, d, p[:, 1])]


salida = []
for c in contornos:
    largo = len(c)
    r = remuestrea(c, max(96, min(320, largo)))
    salida.append([norm(y, x) for y, x in r])
salida.sort(key=lambda c: min(p[0] for p in c))
# Puntos del interior, deterministas.
rng = np.random.default_rng(3)
yy, xx = np.where(m)
sel = rng.choice(len(yy), 900, replace=False)
interior = [norm(yy[k] + rng.random() - 0.5, xx[k] + rng.random() - 0.5) for k in sel]
json.dump({"aspecto": round(h / w, 5), "contornos": salida, "interior": interior}, open(RAIZ / "src" / "marca.json", "w"))
print("contornos:", len(salida), [len(c) for c in salida], "aspecto", h / w)
