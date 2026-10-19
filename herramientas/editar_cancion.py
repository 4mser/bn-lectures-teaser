"""Uso: PYTHONPATH=pylib python3 herramientas/editar_cancion.py [carpeta_espectrogramas]
Arma public/musica.wav con la canción editada por compases enteros según «edicion» de src/ritmo.json (lo escribe
herramientas/conform_pulso.py): cada tramo [desde, hasta) de la canción original va uno tras otro y cada empalme cae
en un downbeat, con un crossfade de igual potencia de 20 ms centrado en el empalme. Lee el mp3 original
(musica/… o la ruta de CANCION; no se versiona ni se redistribuye suelto).
Con carpeta_espectrogramas, guarda un espectrograma de ±1,5 s alrededor de cada empalme y reporta el salto de energía
(dB RMS de los 100 ms antes y después) para comprobar que no se oye."""
import json
import os
import subprocess
import sys
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
RAIZ = Path(__file__).resolve().parent.parent
# The original mp3 is not versioned (Pixabay Content License): download it into musica/ or point CANCION at it.
MP3 = Path(os.environ.get("CANCION", RAIZ / "musica" / "raspberrymusic-unbreakable-spirit-action-cinematic-epic-591786.mp3"))
R = json.loads((RAIZ / "src" / "ritmo.json").read_text(encoding="utf-8"))
SR = 48000


def cancion_editada():
    """Canción editada en flotante (estéreo, 48 kHz) y las posiciones de sus empalmes (muestras)."""
    raw = subprocess.run([FF, "-v", "error", "-i", str(MP3), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    XF = int(0.020 * SR)  # crossfade total
    h = XF // 2
    out = np.zeros((0, 2))
    empalmes = []
    for i, (o0, o1, n0) in enumerate(R["edicion"]):
        a, b = int(round(o0 * SR)), int(round(o1 * SR))
        if i == 0:
            out = x[a:b + h].copy()
            continue
        # el tramo anterior ya trae h muestras de más (lo que sigue a su final en la original); este arranca h antes
        seg = x[max(0, a - h):b + h if i + 1 < len(R["edicion"]) else b].copy()
        u = np.linspace(0, 1, XF)[:, None]
        cola = out[-XF:]
        cab = seg[:XF]
        mezcla = cola * np.cos(u * np.pi / 2) + cab * np.sin(u * np.pi / 2)
        empalmes.append(len(out) - h)
        out = np.concatenate([out[:-XF], mezcla, seg[XF:]])
    return out, empalmes




def main():
    out, empalmes = cancion_editada()
    h = int(0.020 * SR) // 2
    dur = len(out) / SR
    print(f"duración: {dur:.3f} s (esperada {R['cancion']['total']:.3f}) · empalmes en", [round(e / SR, 3) for e in empalmes])
    pico = np.abs(out).max()
    pcm = (np.clip(out, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(RAIZ / "public" / "musica.wav"), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"public/musica.wav escrito · pico {20 * np.log10(pico):.1f} dBFS")
    if len(sys.argv) > 1:
        car = Path(sys.argv[1])
        car.mkdir(parents=True, exist_ok=True)
        mono = out.mean(axis=1)
        for k, e in enumerate(empalmes):
            rms = lambda s: 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9)
            antes, despues = rms(mono[e - int(0.1 * SR):e - h]), rms(mono[e + h:e + int(0.1 * SR)])
            # discontinuidad de muestra a muestra en el empalme frente a la típica del entorno
            dd = np.abs(np.diff(mono[e - h - 200:e + h + 200]))
            ref = np.percentile(np.abs(np.diff(mono[e - SR // 2:e + SR // 2])), 99.5)
            print(f"empalme {k + 1} en {e / SR:.3f} s: RMS 100 ms antes {antes:.1f} dB, después {despues:.1f} dB (salto {despues - antes:+.1f} dB); máx. diferencia entre muestras {dd.max():.4f} (p99,5 del entorno {ref:.4f})")
            t0 = e / SR - 1.5
            png = car / f"empalme_{k + 1}.png"
            subprocess.run([FF, "-v", "error", "-y", "-ss", f"{t0:.3f}", "-t", "3", "-i", str(RAIZ / "public" / "musica.wav"),
                            "-lavfi", "showspectrumpic=s=900x400:legend=1:scale=log:fscale=log:color=intensity", str(png)], check=True)
        print("espectrogramas en", car)


if __name__ == "__main__":
    main()
