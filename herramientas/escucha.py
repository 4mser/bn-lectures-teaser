"""Uso: ESCUCHA=1 PYTHONPATH=pylib python3 audio/generar_musica.py && PYTHONPATH=pylib python3 herramientas/escucha.py
«Escucha virtual» de los efectos: espectrograma de whoosh, impacto y blip (out/escucha.png) y, por efecto, el
porcentaje de energía en 3–8 kHz, el tiempo de ataque (10 → 90 % de la envolvente) y la caída de la cola."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SR = 44100
RAIZ = Path(__file__).resolve().parent.parent
M = np.load(RAIZ / "out" / "escucha.npz")
paneles = []
for nombre in ("whoosh", "impacto", "blip"):
    x = M[nombre]
    nfft, salto = 2048, 256
    win = np.hanning(nfft)
    cuadros = [np.abs(np.fft.rfft(x[i : i + nfft] * win)) for i in range(0, len(x) - nfft, salto)]
    S = np.array(cuadros).T
    f = np.fft.rfftfreq(nfft, 1 / SR)
    db = 20 * np.log10(S + 1e-9)
    db -= db.max()
    # eje de frecuencia logarítmico 40 Hz – 16 kHz, 300 filas
    filas = np.geomspace(40, 16000, 300)[::-1]
    idx = np.searchsorted(f, filas)
    img = np.clip((db[idx] + 80) / 80, 0, 1)
    rgb = np.stack([img ** 0.6 * 255, img ** 1.2 * 200, (0.3 + 0.7 * img) * 255 * (img > 0.02)], -1).astype(np.uint8)
    im = Image.fromarray(rgb).resize((420, 300))
    d = ImageDraw.Draw(im)
    for fz in (100, 1000, 3000, 8000):
        y = int(np.interp(fz, filas[::-1], np.arange(300)[::-1]))
        d.line([(0, y), (420, y)], fill=(90, 90, 90))
        d.text((4, y - 11), f"{fz} Hz", fill=(220, 220, 220))
    d.text((4, 4), nombre, fill=(255, 255, 0))
    paneles.append(im)
    P = (S ** 2).sum(1)
    alta = P[(f >= 3000) & (f < 8000)].sum() / P.sum() * 100
    envol = np.sqrt(np.convolve(x ** 2, np.ones(441) / 441, "same"))
    pico = envol.argmax()
    a10 = np.argmax(envol[: pico + 1] >= 0.1 * envol[pico])
    a90 = np.argmax(envol[: pico + 1] >= 0.9 * envol[pico])
    cola = envol[pico:]
    t60 = np.argmax(cola < envol[pico] * 10 ** (-40 / 20)) / SR
    print(f"{nombre:8s} energía 3–8 kHz {alta:4.1f} %  ataque 10→90 % {1000 * (a90 - a10) / SR:5.0f} ms  caída de −40 dB en {t60:.2f} s")
hoja = Image.new("RGB", (420 * 3 + 8, 300), (0, 0, 0))
for i, p in enumerate(paneles):
    hoja.paste(p, (i * 424, 0))
hoja.save(RAIZ / "out" / "escucha.png")
