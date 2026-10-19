<p align="center">
  <img src="docs/assets/hero.gif" width="100%" alt="Cuatro momentos del teaser de B&N Lectures en 16:9: un agujero negro con su disco de acreción, un fractal de Julia en crema y violeta, una hélice de ADN hecha de partículas turquesa y la marca B&N LECTURES entre dos cargas, sobre las líneas de campo">
</p>

<p align="center">
  <a href="https://bnsolutions.cl/lectures"><b>bnsolutions.cl/lectures</b></a> &nbsp;·&nbsp;
  <!-- TODO: reemplazar por el enlace de YouTube cuando el teaser esté publicado -->
  <a href="TODO-enlace-youtube"><b>Ver el teaser</b></a> &nbsp;·&nbsp;
  <a href="https://bnsolutions.cl"><b>B&N Solutions</b></a> &nbsp;·&nbsp;
  <a href="README.en.md">Read in English</a>
</p>

B&N Lectures son clases animadas de matemática, física, computación, caos y geometría, hechas por B&N Solutions. Este repositorio tiene el código completo de su teaser: 93 segundos sin voz, montados sobre una canción, en 4:5, 16:9 y 9:16. Es parte de [B&N Lectures](https://github.com/4mser/bn-lectures), junto con [las clases](https://github.com/4mser/bn-lectures-clases) y [la biblioteca de simulaciones](https://github.com/4mser/bn-lectures-biblioteca).

La regla central es una sola: **cada cuadro es una función del tiempo y de la música.** Ninguna escena guarda estado entre cuadros, así que cualquier cuadro se puede renderizar solo, en cualquier orden y en paralelo, y sale igual. Y cada escena es física o matemática de verdad: la doble rendija resuelve la ecuación de Schrödinger, las líneas de campo se integran con RK4 y el atractor de Lorenz corre con un millón de partículas.

### `// 01` Qué hay aquí

| | |
|---|---|
| **El teaser completo** | Un proyecto [Remotion](https://www.remotion.dev) con tres composiciones: `Clase` (4:5, 1080×1350), `ClaseYT` (16:9, 1920×1080) y `ClaseTT` (9:16, 1080×1920, dentro de la zona segura de TikTok). Mismos tiempos y escenas; solo cambia la composición de cada cuadro. |
| **Un motor híbrido** | Escenas en canvas 2D (`src/escenas.ts`) y en WebGL2 (`src/gl.ts`): agujero negro raymarcheado, prisma, ADN, Lorenz y fluido. Encima, un look retro de CRT con bloom de fósforo, scanlines, curvatura, grano y aberración cromática en los golpes. |
| **Simulaciones precalculadas** | Schrödinger 2D, reacción-difusión de Gray-Scott y texturas LIC del campo de dos cargas, en Python con numpy. Se regeneran con un comando y salen idénticas byte a byte. |
| **Sincronía con la canción** | Un mapa de ritmo con cada nota de cuerda, bombo, caja, impacto y braam de la canción, en segundos. Cada corte, pulso y entrada de texto se ancla a esos tiempos. |
| **Las herramientas** | Render por tramos con reintentos, revisión de cuadros sueltos, hojas de contacto y medición de la sincronía sobre el mp4 terminado. |

### `// 02` Las escenas y su ciencia

Las diez escenas protagonistas, tal como se ven en el corte 16:9:

<table>
  <tr>
    <td width="50%" valign="top"><img src="docs/assets/cuantico.gif" width="100%" alt="Un paquete de ondas cuántico atraviesa dos rendijas y se abre en franjas de interferencia azules"><br><b>Fluido cuántico y doble rendija</b><br><sub>iħ ∂ψ/∂t = −(ħ²/2m) ∇²ψ + Vψ, por split-step de Fourier; las franjas salen de |ψ|²</sub></td>
    <td width="50%" valign="top"><img src="docs/assets/campo.gif" width="100%" alt="Líneas de campo eléctrico de un dipolo que salen de una carga y entran en la otra, con partículas que corren por ellas"><br><b>Campo de un dipolo</b><br><sub>E = Σ k qᵢ r̂ᵢ / rᵢ², líneas integradas con RK4 de paso adaptativo</sub></td>
  </tr>
  <tr>
    <td width="50%" valign="top"><img src="docs/assets/agujero-negro.gif" width="100%" alt="Agujero negro con un disco de acreción blanco que se curva por encima y por debajo de la sombra"><br><b>Agujero negro</b><br><sub>Rayos curvados con a = −(3/2) r_s h² r̂ / r⁴ y disco delgado con Doppler beaming; el pozo es el paraboloide de Flamm</sub></td>
    <td width="50%" valign="top"><img src="docs/assets/fractales.gif" width="100%" alt="Conjunto de Julia en crema, violeta y azul con espirales que giran"><br><b>Mandelbrot y Julia</b><br><sub>z ↦ z² + c, con conteo suave y estimación de distancia</sub></td>
  </tr>
  <tr>
    <td width="50%" valign="top"><img src="docs/assets/lorenz.gif" width="100%" alt="Atractor de Lorenz formado por una nube de partículas blancas con sus dos alas"><br><b>Atractor de Lorenz</b><br><sub>ẋ = σ(y − x), ẏ = x(ρ − z) − y, ż = xy − βz, con σ = 10, ρ = 28, β = 8/3; un millón de partículas</sub></td>
    <td width="50%" valign="top"><img src="docs/assets/chladni.gif" width="100%" alt="Placa de Chladni en 3D con granos que se juntan sobre las líneas nodales"><br><b>Figuras de Chladni</b><br><sub>Líneas nodales de cos(nπx) cos(mπy) − cos(mπx) cos(nπy) = 0; 100 000 granos saltan en cada golpe</sub></td>
  </tr>
  <tr>
    <td width="50%" valign="top"><img src="docs/assets/adn.gif" width="100%" alt="Doble hélice de ADN hecha de partículas turquesa que gira"><br><b>Doble hélice</b><br><sub>Hélice paramétrica de unas 180 000 partículas con pares de bases y profundidad de campo</sub></td>
    <td width="50%" valign="top"><img src="docs/assets/prisma.gif" width="100%" alt="Un haz de luz blanca entra a un prisma y sale abierto en un abanico de colores"><br><b>Prisma de Newton</b><br><sub>Dispersión en 44 longitudes de onda y vidrio raymarcheado con Fresnel</sub></td>
  </tr>
  <tr>
    <td width="50%" valign="top"><img src="docs/assets/fibonacci.gif" width="100%" alt="Espiral áurea dibujada sobre cuadrados de Fibonacci numerados"><br><b>Fibonacci y el girasol</b><br><sub>Espiral áurea con φ = (1 + √5)/2; girasol de Vogel: r = c√k, θ = k · 137,508°</sub></td>
    <td width="50%" valign="top"><img src="docs/assets/marca.gif" width="100%" alt="La marca B&N LECTURES aparece entre dos cargas brillantes sobre hebras azules del campo eléctrico"><br><b>El cierre</b><br><sub>LIC animada del campo de dos cargas (Cabral y Leedom, Forssell); las cargas escriben LEC, TUR y ES</sub></td>
  </tr>
</table>

El recorrido completo, en el orden del video:

| Tramo | Escenas | Ciencia |
|---|---|---|
| Lo pequeño | Carga y rayos → Lissajous → átomo de Bohr → orbital → fluido cuántico → ondas | Campo radial 1/r², curvas de Lissajous, órbitas rₙ ∝ n², densidad \|ψ\|², Schrödinger 2D, fuentes de Huygens que interfieren |
| El espacio | Campo del dipolo → agujero negro → pozo → órbita → tres cuerpos | Líneas de campo, curvatura de Schwarzschild, paraboloide de Flamm, órbita con precesión, la órbita en ocho de Chenciner y Montgomery (G = m = 1, Verlet) |
| La búsqueda | Árbol RRT → teseracto | Exploración aleatoria rápida (RRT) que crece con cada nota; hipercubo (±1)⁴ que gira en los planos XW e YZ, proyectado de 4D a 3D |
| Lo complejo | Tinta → Mandelbrot y Julia → Lorenz → Gray-Scott → Chladni | Warping de dominio sobre ruido fbm, fractales, caos determinista, reacción-difusión (F = 0,055; k = 0,062) sembrada con la silueta de Lorenz, modos de una placa vibrante |
| La forma | ADN → prisma → espiral áurea → girasol → nautilus | Doble hélice, dispersión, proporción áurea, filotaxis |
| El cierre | La estrella → «TÚ» → la marca | Partículas que aterrizan en los píxeles de la marca sobre la LIC del dipolo |

### `// 03` Cómo se sincroniza con la música

La animación se diseñó primero sobre una grilla fija de 120 BPM (un pulso = 0,5 s). Después se montó sobre «Unbreakable Spirit», que va a 129,98 BPM:

1. **Análisis.** `datos/analisis-cancion.json` tiene los tiempos de la canción: pulsos, downbeats, frases, impactos, braams, risers, silencios y onsets por banda. Solo hay tiempos, sin audio.
2. **Conform.** `herramientas/conform_pulso.py` hace que cada pulso de la animación sea un pulso de la canción (0,4616 s). Todo corre un 8,3 % más rápido; las escenas se ajustan repitiendo o quitando pulsos enteros, y los comienzos, finales y transiciones no se tocan. Escribe `src/ritmo.json`.
3. **Edición.** La canción se edita por compases enteros (`herramientas/editar_cancion.py`): los empalmes caen en downbeats, con un crossfade de igual potencia de 20 ms. Queda en 93,28 s.
4. **Eventos reales.** `herramientas/ritmo_cancion.py` detecta las 469 notas del ostinato de cuerdas, con sus acentos 3+3+2, y la batería (`src/cancion.json`). Cada nota manda un brillo fino que cruza las luces del cuadro; cada golpe, un barrido y un empuje de cámara de 0,7 %. `herramientas/eventos_reales.py` encuentra las tres gotas de la coda (88,62 · 89,08 · 89,55 s), que escriben LEC, TUR y ES.
5. **Lectura.** `src/ritmo.ts` lee esos mapas y los pasa a tiempo de escena. Las escenas solo preguntan «¿qué pasa en el segundo t?».

`herramientas/sincronia_audio.py` y `herramientas/correlacion_onsets.py` miden la sincronía sobre el mp4 terminado.

### `// 04` Cómo reproducirlo

**Requisitos**

| | Versión | Notas |
|---|---|---|
| Node.js | 20 o superior (probado con 20.20) | Con npm |
| Remotion | 4.0.534 | Fijada en `package.json`; `npm ci` la instala y la primera ejecución descarga Chrome Headless Shell. Remotion tiene su propia licencia: revisa [remotion.dev/license](https://www.remotion.dev/license) |
| Python | 3 (probado con 3.14) | Con `numpy`, `imageio-ffmpeg` (trae su propio ffmpeg) y `pillow`, en las versiones de `requirements.txt` |
| WebGL2 | Chrome con ANGLE | `remotion.config.ts` y las herramientas piden `gl: "angle"`. Probado en macOS con Apple Silicon |

**1. Instalar**

```bash
git clone https://github.com/4mser/bn-lectures-teaser.git
cd bn-lectures-teaser
npm ci
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

**2. Conseguir la música.** La licencia de Pixabay no permite redistribuir el archivo suelto, así que no viene en el repositorio. Descarga [«Unbreakable Spirit (Action Cinematic Epic)»](https://pixabay.com/music/adventure-unbreakable-spirit-action-cinematic-epic-591786/), de RaspberryMusic, y guárdala como:

```
musica/raspberrymusic-unbreakable-spirit-action-cinematic-epic-591786.mp3
```

Si prefieres dejarla en otra carpeta, pasa su ruta en `CANCION=/ruta/al/archivo.mp3`. Después arma la pista del video:

```bash
python herramientas/sonidos_lectures.py     # → public/musica.wav (canción editada por compases, −1 dBFS)
```

La pista sale idéntica byte a byte a la del video publicado. Los mapas de tiempo (`src/ritmo.json` y `src/cancion.json`) ya están en el repositorio.

**3. Generar los assets.** Unos dos minutos en un Mac con Apple Silicon:

```bash
python herramientas/lic.py                  # → public/img/campo-{45,169,916}.png
python herramientas/lic_animada.py          # → public/img/campo-{45,169,916}/fNN.jpg (loop de 60 cuadros)
for f in 45 169 916; do
  FORMATO=$f python herramientas/cuantico.py    # → public/sim/q, q-169, q-916
  FORMATO=$f python herramientas/grayscott.py   # → public/sim/gs, gs-169, gs-916
done
```

| Script | Qué calcula | Variables |
|---|---|---|
| `lic.py` | Textura LIC fija del campo de dos cargas, una por formato | — |
| `lic_animada.py` | LIC animada del cierre: las hebras fluyen de +q a −q en un loop de 2 s sin costura | Formatos como argumentos (`45 169 916`); sin argumentos, los tres |
| `cuantico.py` | Schrödinger 2D por split-step de Fourier: el paquete cruza la doble rendija | `FORMATO=45` (por omisión), `169` o `916` |
| `grayscott.py` | Gray-Scott sembrado con la silueta del atractor de Lorenz tal como se ve en pantalla | `FORMATO=45`, `169` o `916` |
| `marca.py` | Contornos y puntos de la marca para `src/marca.json` (ya versionado) | Solo si cambias `bn-mark.png` |

**4. Revisar y renderizar**

```bash
npx tsc --noEmit
node herramientas/cuadros.mjs out/cuadros 900,2700 ClaseYT   # cuadros sueltos, en números de cuadro (30 fps)
npm run dev                                                   # Remotion Studio, para recorrer la línea de tiempo

python herramientas/render.py 300 4 Clase     # → out/BN-Lectures-teaser.mp4       (4:5)
python herramientas/render.py 300 4 ClaseYT   # → out/BN-Lectures-teaser-16x9.mp4  (16:9)
python herramientas/render.py 300 4 ClaseTT   # → out/BN-Lectures-teaser-9x16.mp4  (9:16)
```

`render.py` recibe el tamaño del tramo en cuadros, la concurrencia y la composición. Renderiza por tramos, cada uno en su propio proceso y con reintentos, los une sin recodificar y les pone `public/musica.wav`. Si se corta, vuelve a correrlo y retoma desde el último tramo terminado. Si cambias la música, borra `out/partes*/` antes.

**Opcional: regenerar los mapas de tiempo.** Con el análisis de `datos/`, `python herramientas/conform_pulso.py` y luego `python herramientas/eventos_reales.py` reescriben `src/ritmo.json` igual byte a byte. `src/cancion.json` sale de la canción sin editar: decodifícala a `public/musica.wav` (`ffmpeg -i musica/<canción>.mp3 -ar 48000 public/musica.wav`), corre `SALIDA=src/cancion.json python herramientas/ritmo_cancion.py` y vuelve al paso 2.

### `// 05` Estructura

```
src/                 Root.tsx (composiciones) · Video.tsx (lienzo, look y capas) · escenas.ts · gl.ts · final.ts
                     titulos.ts · rotulos.ts · disposicion.ts (cada formato) · ritmo.ts + ritmo.json · cancion.json
                     lab/luz.ts (motor de líneas de campo de la serie)
herramientas/        simulaciones, LIC, edición y análisis de la canción, render por tramos, revisión de cuadros
datos/               análisis de tiempos de la canción (sin audio)
audio/               generador de la música sintética de las primeras versiones (fuera del flujo actual)
musica/              aquí va el mp3 de la canción (no versionado)
public/              fuentes y bn-mark.png; las herramientas escriben aquí sim/, img/campo-* y musica.wav
BITACORA.md          registro del desarrollo, versión por versión
docs/assets/         GIF y SVG de este README
```

Las 192 simulaciones y efectos de todos los videos de B&N, incluidas las de las versiones anteriores de este teaser, están catalogadas en [bn-lectures-biblioteca](https://github.com/4mser/bn-lectures-biblioteca), con siete módulos listos para reutilizar.

### `// 06` Equipo

| | |
|---|---|
| **Nicolás Moreno**<br>[@4mser](https://github.com/4mser) | Cofundador de B&N Solutions e ingeniero de software. Desarrolla el motor de animación, las simulaciones y los videos. |
| **Benjamín Campos**<br>[@B3njjaman](https://github.com/B3njjaman) | Cofundador de B&N Solutions e ingeniero físico. Creó el reel original de la serie y su motor de simulación. |
| **Javier Patiño** | Licenciado en Física y profesor de Electricidad y Magnetismo. Autor de los apuntes en que se basan las clases y la voz de B&N Lectures. |

### `// 07` Créditos

- **Música:** «Unbreakable Spirit (Action Cinematic Epic)», de RaspberryMusic, en [Pixabay](https://pixabay.com/music/adventure-unbreakable-spirit-action-cinematic-epic-591786/), bajo la licencia de contenido de Pixabay. No se incluye en el repositorio.
- **Fuentes:** Space Grotesk e IBM Plex Mono, bajo la SIL Open Font License 1.1 (`public/fonts/OFL.txt`).
- **Herramientas:** Remotion, React, TypeScript, WebGL2, numpy, Pillow e imageio-ffmpeg.
- **Técnicas de otros:** line integral convolution (Cabral y Leedom) y su versión animada (Forssell), la órbita en ocho de tres cuerpos (Chenciner y Montgomery), el modelo de Vogel para el girasol, el sistema de Lorenz y la reacción-difusión de Gray y Scott.

### `// 08` Licencia

El código y la documentación están bajo la [licencia MIT](LICENSE), © 2026 B&N Solutions.

**La marca queda fuera.** El nombre B&N Solutions, la marca y el logo B&N y el nombre «B&N Lectures» no están bajo MIT: siguen siendo de B&N Solutions, con todos los derechos reservados. `public/img/bn-mark.png` está incluido solo porque el render lo necesita. Si haces un video propio con este código, cambia la marca por la tuya. Los detalles están en [TRADEMARKS.md](TRADEMARKS.md).

La canción no se redistribuye, y las fuentes y las dependencias de npm mantienen sus propias licencias.

---

<p align="center">
  <img src="docs/assets/footer.svg" width="100%" alt="Líneas de campo de un dipolo que fluyen entre dos cargas, con el texto cuadro = f(t, música) y bnsolutions.cl/lectures">
</p>
