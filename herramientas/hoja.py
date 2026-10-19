"""Uso: PYTHONPATH=pylib python3 herramientas/hoja.py <carpeta> <salida.png> [columnas] [ancho]
Junta los PNG de una carpeta en una hoja de contacto (con ffmpeg; en este equipo no hay Pillow).
Cada cuadro lleva su número y su segundo."""
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

carpeta, salida = Path(sys.argv[1]), sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
ancho = int(sys.argv[4]) if len(sys.argv) > 4 else 300
fs = sorted(carpeta.glob("f*.png"))
filas = (len(fs) + cols - 1) // cols
lista = carpeta / "_lista.txt"
lista.write_text("".join(f"file '{f.resolve()}'\nduration 1\n" for f in fs))
etiqueta = "drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.7:x=6:y=6:text='%{metadata\\:lavf.image2dec.source_basename}'"
nombres = [f.stem for f in fs]
# El nombre de cada cuadro se dibuja con un filtro por cuadro: más simple, un drawtext con el índice.
filtro = f"scale={ancho}:-2,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.7:x=5:y=5:text='%{{n}}',tile={cols}x{filas}:padding=4:color=white"
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lista), "-vf", filtro, "-frames:v", "1", salida], check=True)
lista.unlink()
for i, n in enumerate(nombres):
    s = int(n[1:]) / 30
    print(f"{i:2d} {n} {s:6.2f}s")
