"""Uso: python herramientas/render.py [tamaño_tramo] [concurrencia] [composición]
Empaqueta una vez, renderiza el audio y el video por tramos (cada tramo en su propio proceso, con reintentos),
une los tramos sin recodificar y les pone el audio. Resultado: out/<archivo>.mp4, con <archivo> de src/serie.ts
(con la composición ClaseYT: out/<archivo>-16x9.mp4, tramos en out/partes-ClaseYT/; con ClaseTT: <archivo>-9x16.mp4)."""
import os, re, subprocess, sys
import imageio_ffmpeg

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = imageio_ffmpeg.get_ffmpeg_exe()
TRAMO = int(sys.argv[1]) if len(sys.argv) > 1 else 500
CONC = sys.argv[2] if len(sys.argv) > 2 else "2"
COMP = sys.argv[3] if len(sys.argv) > 3 else "Clase"
YT = COMP == "ClaseYT"
TT = COMP == "ClaseTT"
PARTES = os.path.join(RAIZ, "out", "partes-" + COMP if COMP != "Clase" else "partes")
ARCHIVO = re.search(r'archivo: "([^"]+)"', open(os.path.join(RAIZ, "src", "serie.ts"), encoding="utf-8").read()).group(1)
SALIDA = os.path.join(RAIZ, "out", ARCHIVO + ("-16x9.mp4" if YT else "-9x16.mp4" if TT else ".mp4"))
env = dict(os.environ, TEMP=os.path.join(RAIZ, "tmp"), TMP=os.path.join(RAIZ, "tmp"), COMPOSICION=COMP)
os.makedirs(PARTES, exist_ok=True)


def correr(cmd, intentos=4):
    for k in range(intentos):
        r = subprocess.run(cmd, cwd=RAIZ, env=env, shell=True)
        if r.returncode == 0:
            return
        print("  falló, reintento", k + 1, flush=True)
    raise SystemExit("no se pudo: " + cmd)


correr("npx remotion bundle --out-dir=build", 2)
# El total de cuadros sale de la composición: se lo pido a Remotion.
# (a veces la lista sale vacía o por stderr: se reintenta y se busca en las dos salidas)
for _ in range(3):
    r = subprocess.run("npx remotion compositions build", cwd=RAIZ, env=env, shell=True, capture_output=True, text=True)
    m = re.search(COMP + r"\s+\d+\s+\d+x\d+\s+(\d+)", r.stdout + r.stderr)
    if m:
        break
else:
    raise SystemExit("no se pudo leer el total de cuadros de " + COMP)
total = int(m.group(1))
print("cuadros:", total, flush=True)
# La pista es la música tal cual (public/musica.wav): no hace falta renderizar el audio con Remotion.
audio = os.path.join(RAIZ, "public", "musica.wav")
lista = []
for i, a in enumerate(range(0, total, TRAMO)):
    b = min(total - 1, a + TRAMO - 1)
    v = os.path.join(PARTES, f"v{i:02d}.mp4")
    lista.append(v)
    if os.path.exists(v):
        continue
    print(f"tramo {i}: {a}-{b}", flush=True)
    correr(f'node herramientas/parte.mjs build {a} {b} "{v}.tmp.mp4" {CONC}')
    os.replace(v + ".tmp.mp4", v)
with open(os.path.join(PARTES, "lista.txt"), "w") as f:
    f.writelines(f"file '{p.replace(os.sep, '/')}'\n" for p in lista)
subprocess.run([FF, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", os.path.join(PARTES, "lista.txt"), "-i", audio,
                "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", SALIDA], check=True)
print("listo", SALIDA, flush=True)
