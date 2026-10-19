# Bitácora del teaser de B&N Lectures

> Este archivo es el registro de desarrollo del teaser, versión por versión. Para instalarlo, generar los assets y
> renderizarlo, sigue el [README de la raíz](../README.md#-04-cómo-reproducirlo).

> **v1o-unbreakable (rama `v1o-unbreakable`).** La v1o aprobada, sin cambios de imagen, montada sobre la canción real
> «Unbreakable Spirit» (RaspberryMusic, Pixabay; no se versiona ni se redistribuye suelta: `public/musica.wav` está en
> `.gitignore`). Dura lo que la canción (91,43 s). `audio/generar_musica.py` quedó fuera del flujo. Ver «v1o sobre la
> canción real» más abajo.

Teaser de 88 s, sin voz, para B&N Lectures: clases animadas de matemática, física, computación, caos y geometría.
Motion graphics generativo hecho con matemática real, sincronizado con una música sintetizada a 120 BPM. Tres formatos:

| Composición | Formato | Salida |
|---|---|---|
| `Clase` | 4:5, 1080×1350 | `out/BN-Lectures-teaser.mp4` |
| `ClaseYT` | 16:9, 1920×1080 | `out/BN-Lectures-teaser-16x9.mp4` |
| `ClaseTT` | 9:16, 1080×1920 | `out/BN-Lectures-teaser-9x16.mp4` |

Nació de una copia de `../plantilla` (motor de líneas de campo de `src/lab/luz.ts` y fuentes), pero la línea de
tiempo ya no depende de una voz: la fija el mapa de ritmo.

## Cómo funciona

- `audio/generar_musica.py` sintetiza con numpy la música (Re mayor, I–V–vi–IV, motivo de 5 notas) y los efectos
  (blips afinados, whooshes, impactos, risers, glitches, shimmer). Escribe `public/musica.wav` (pico −1,5 dBFS) y
  `src/ritmo.json`: secciones, bombos, palmas, hi-hats, notas del arpegio y del motivo, y cada efecto, en segundos.
- `src/ritmo.ts` lee ese mapa. Cada corte, pulso y entrada de texto se ancla a esos tiempos.
- `src/escenas.ts` es una sola cadena de formas que se transforman unas en otras (carga → líneas de campo →
  Lissajous → toro → pozo del espacio-tiempo → teseracto → Mandelbrot con cortes en cada palmada → Lorenz → red
  neuronal → hélice de ADN → Fourier → doble rendija → interferencia → epiciclos que dibujan la marca → logo). Todo
  es función pura de t. Al final, la sección «Guion» arma cada frase con la geometría de su escena.
- `src/titulos.ts` rasteriza las frases y las arma con tramos o puntos que aterrizan en un golpe; luego las funde
  con su versión nítida con halo.
- `src/disposicion.ts` define la composición de cada formato (zona visual, texto y logo). En 9:16 respeta la zona
  segura de TikTok.
- `src/Video.tsx`: lienzo supermuestreado (×2, `SS` en `src/theme.ts`) con aberración cromática solo en los
  impactos y grano fino, y el logo final. Sin HUD ni cromo.

### v1g: música de la v1 desarrollada, escenas nuevas y look retro-futurista (84 s)

- Música: el material original de la v1 (arpegio, bajo, bombo, palmas, hats, motivo, builds, drops, sección del logo
  y respuesta lidia) desarrollado a 84 s. `herramientas/sincronia_audio.py` mide la sincronía sobre el audio del mp4.
- Escenas: carga y rayos (0) · Lissajous (3) · Bohr (5) · orbital (7) · fluido cuántico con doble rendija (9,
  `herramientas/cuantico.py`) · dos cargas que orbitan (14) · formación del agujero negro en el pozo (17,5) · toro (23)
  · órbita (25) · tres cuerpos (27) · Dijkstra (30) · teseracto (34) · Mandelbrot de zoom continuo (36) · Julia (39,5)
  · Lorenz de un millón de partículas con efecto mariposa (41,5) · Gray-Scott (46) · Chladni (48) · ADN (51) → prisma
  (55) · Fibonacci (59) · girasol (61,5) · nautilus (63,5) · silencio (66) · «tú» (67,5) · final aprobado (70).
- Postproceso (`src/gl.ts`, `LOOKS` en `src/Video.tsx`): bloom de fósforo, ACES, scanlines, curvatura y viñeta de
  CRT, aberración en bordes e impactos, grano y ruido de cinta, parpadeo mínimo, línea de interferencia en los drops y
  gradación de película. Se usa la intensidad «sutil»; `LOOK=marcada node herramientas/cuadros.mjs …` muestra la otra.

### v1i: agujero negro continuo, fractales con cortes de la v7d y títulos de la v2

- Agujero negro (17,5-23,4 s, `espacio` y `hoyoFormado` en `src/escenas.ts`): sin latido de escala. El disco gira
  siempre y su giro se acelera con easing en cada bombo; la luz sube con las notas; el color cambia por compás
  (hielo → ámbar tenue → azul, uniforme `uTono` en `src/gl.ts`). La cámara se acerca y baja hacia el plano del disco,
  bajo el agujero nace la malla plana y se extiende hacia afuera, la gravedad la curva en el pozo de Flamm y el
  agujero baja con ella hasta quedar en el fondo; luego el pozo se vuelve toro. La malla y el shader comparten cámara.
- Fractales (36-41,5 s): sin giro ni empujes. Lógica de la v7d: zoom por escalones en cada pulso sobre un avance
  continuo, modo por pulso (color pleno, lente, negativo plateado) y salto de paleta en cada palmada. Coloreado con
  conteo suave, promedio de franjas, brillo por estimación de distancia e interior con trampas de órbita.
- Títulos (`src/rotulos.ts`, capa nítida encima del look): sistema de la v2 en mayúsculas, pesos 300/700, rebanadas,
  palabra clave decodificada que se resuelve en su golpe y se arma con tramos de la escena, y anotaciones mono
  técnicas. Sin HUD de esquinas.

### v1j: búsqueda RRT, fractales a color, cierre continuo y look retro que se nota

- Palabras clave sin punto final: PREGUNTA, BUSCAR, TÚ.
- Búsqueda (30-34 s): Dijkstra se reemplaza por un RRT (árbol aleatorio de exploración rápida) que crece como un árbol
  de luz con cada nota, con pulsos que recorren sus ramas y cámara que gira y se acerca; en el golpe de «buscar» el
  camino al objetivo se enciende en oro y de él salen los vértices del teseracto.
- Fractales: paletas azul y violeta con dorado, turquesa y magenta con crema, fuego ámbar con índigo, y duotono índigo
  sobre crema, cambiando en cada pulso. Último corte a las 40,5 s; después la lente se cierra en el punto donde nace
  Lorenz (centro del cuadro), sin cortes.
- Look «retro» por omisión (`LOOKS` en `src/Video.tsx`): scanlines de 3 px de salida, más halo de fósforo, curvatura y
  viñeta, grano y banda de cinta, aberración en bordes, líneas de interferencia en los golpes fuertes y gradación con
  negros azulados y luces cálidas. Los títulos reciben halo y scanlines suaves; el logo final sigue en HTML, nítido.

### v1k: las partículas se convierten en la marca

- La marca B&N ya no es una imagen HTML que entra encima: las partículas aterrizan en los píxeles de
  `public/img/bn-mark.png`, se achican y se intensifican, y la superficie se llena de luz (umbral sobre un ruido suave)
  hasta volverse la marca; un brillo la recorre de izquierda a derecha y se asienta (`marcaLuz` en `src/final.ts`).
- La marca pasa por el look (halo de fósforo) y encima va su versión nítida con la misma curvatura de barril y
  scanlines suaves (`marcaNitida`), así queda nítida y alineada. En el cierre el look baja un poco (scanlines, grano,
  aberración y bloom). LECTURES, «Próximamente» y la web siguen en HTML.

### v1l: fractales legibles y Chladni en 3D

- Fractales: en los modos de pantalla completa cubren todo el cuadro (el look se aplana en ese tramo: casi sin
  curvatura ni esquinas de tubo); menos exposición, bloom y halo, scanlines y grano suaves; brillo de borde contenido y
  curva de gama para recuperar el detalle fino; duotono sin invertir; la lente lleva un aro nítido con halo.
- Chladni (48-51 s): placa en 3D con cámara que orbita, malla que vibra con la forma del modo y brilla en los
  antinodos; 100 k granos que saltan y se asientan en las líneas nodales en cada golpe, con modos cada vez más complejos
  y un tinte sutil por modo. Entra desde los píxeles claros del último cuadro de Gray-Scott y sale condensándose en la
  hélice del ADN (misma geometría y cámara del shader).

### v1m: fractales psicodélicos, remolino al ADN y una sola estrella

- Fractales: la paleta fluye sin parar y se acelera en cada bombo; paletas más vibrantes (incluida una psicodélica);
  caída continua y profunda (hasta 2,5·10⁻⁶) con saltos de profundidad en los golpes; simetría caleidoscópica en
  algunos pulsos (6, 8 y 4 sectores, entrando y saliendo suave); Julia que respira con c sobre el borde del cardioide;
  interior que también fluye con la paleta; estelas de feedback; warp y aberración que pulsan con el bombo.
- Chladni → ADN: desde el último cambio de modo la cámara deja de orbitar y se inclina, la placa se desvanece y la
  arena sube en un remolino de dos brazos hasta las dos hebras (de abajo hacia arriba), sobre las mismas posiciones que
  dibuja la hélice GPU, que entra mientras la arena se apaga.
- Espiral áurea → silencio: la cámara se hunde girando hacia el ojo de la espiral, que viaja al centro y es la misma
  estrella del silencio (mismo tamaño y halo); ahí respira y estalla en el «tú».
- Texto: «ESE ALGUIEN / PUEDES SER / TÚ».

### v1n: vuelven los fractales de la v1j

- El tramo de los fractales (36-41,5 s) es exactamente el de la v1j (render, paletas, cortes y movimiento). En ese
  tramo el look solo aplana la pantalla (curvatura, esquinas de tubo y viñeta atenuadas, para que el fractal llegue a
  los bordes) y baja apenas el bloom. Se conserva lo demás de la v1m.

### v1o: el drop 2 crece (88 s): fluido de entrada y plano final largo

- Música: el drop 2 tiene dos compases más (26 y 27 repiten I–V, así la armonía siguiente no cambia); todo lo que
  viene después se corre 4 s. Secciones nuevas: «fluido» (36 s) y «mandelbrot» (38 s).
- Fluido (36-38,4 s, shader `FLUIDO` en `src/gl.ts`): tinta cremosa (crema, turquesa, violeta, oro tenue) que nace del
  estallido del teseracto, se arremolina en espiral y se aquieta mientras el Mandelbrot aparece con sus remolinos.
- Fractal: misma lógica de cortes de la v1j desde las 38 s; después del último corte (42,5 s) un plano largo sin
  cortes: caída lenta hacia la espiral del punto fijo α de la Julia, con rotación leve y la paleta fluyendo, clímax
  de luz suave y la lente que se cierra en Lorenz (45,5 s). En ese tramo, 17 % menos de exposición y de bloom.

### Formatos 16:9 y 9:16 de la aprobada (rama `formatos`, desde la tag `unbreakable-aprobada-4x5`)

- Mismo video, tiempos, música, escenas, look y animaciones; solo cambia la composición de cada cuadro. La 4:5 sale
  idéntica píxel a píxel a la de la tag.
- `src/disposicion.ts`: en 16:9 y 9:16 la zona visual va al centro (en 9:16, al centro de la zona segura de TikTok) y
  se corre con un paneo suave cuando entra cada frase (`conTexto`): en 16:9 a la derecha, con el texto en una columna
  a la izquierda; en 9:16 hacia arriba, con el texto debajo, dentro de la zona segura (columna de 860 px que deja
  libres los 140 px de la derecha).
- Escenas WebGL centradas en el cuadro (Lorenz, ADN, prisma): escala propia por formato (`gl`, px por unidad;
  `zoomGL` en `src/gl.ts` ajusta campo visual, desenfoque y `proyectar`). El agujero negro sigue la zona visual.
- Fluido: la tinta crece hasta la esquina más lejana de cada formato. Fractales: la ventana se mide en radios de la
  zona visual (en 4:5 sigue siendo el ancho del cuadro).
- Simulaciones por formato (`public/sim/q-169`, `q-916`, `gs-169`, `gs-916`):
  `FORMATO=169 PYTHONPATH=pylib python3 herramientas/cuantico.py` (y `grayscott.py`; `FORMATO=916` para 9:16).
  Misma escala de la grilla frente a la escena, en todo el cuadro del formato.
- Campo LIC del final: `public/img/campo-169` y `campo-916`, de `herramientas/lic_animada.py` (copiado de
  `teaser-lectures`, cargas a la altura y escala de `cargasY` y `logo.s`).
- Look: la curvatura de CRT baja a 0,7 en 16:9 y 9:16 (el arco del borde largo mide en px lo mismo que en 4:5) y las
  esquinas del tubo tienen el mismo radio en px que en 4:5. La viñeta sigue el aspecto del cuadro.
- Render: `PYTHONPATH=pylib python3 herramientas/render.py 500 4 ClaseYT` (y `ClaseTT`).

### v1o-k: tres pulsos, en el cuadro de cada gota (rama `v1o-unbreakable-k`)

- En el cuadro que contiene el ataque de cada gota la carga destella, emite su anillo (que se abre por las hebras y se
  desvanece) y aparece su grupo de letras: izquierda y LEC, derecha y TUR, las dos y ES. No hay otros pulsos en el
  final (ni los periódicos ni el anillo de la revelación); el campo sigue fluyendo.

### v1o-j: izquierda, derecha y las dos (rama `v1o-unbreakable-j`)

- Gota 1 (88,62): solo la carga izquierda (que se enciende 0,6 s antes) suelta su frente y enciende LEC; gota 2
  (89,08): solo la derecha, TUR; gota 3 (89,55): las dos juntas, ES. Frentes más fuertes en el campo y con anillo
  (trazo fino y halo azul). Después de las gotas, los pulsos del campo siguen como respiración, más suaves y con un
  anillo tenue.

### v1o-i: las cargas escriben LECTURES (rama `v1o-unbreakable-i`)

- 0,45 s antes de cada gota, las dos cargas del final sueltan un frente de luz que viaja por las hebras del campo (la
  textura LIC hace de máscara) con una velocidad propia para cada carga, calculada para que ambos lleguen al grupo de
  letras justo en el ataque (`frentesLetras` en `src/final.ts`). Ahí se enciende LEC, TUR o ES. Los pulsos normales
  del final se omiten cerca de cada gota. Ya no cae el punto de luz desde arriba.

### v1o-h: rendija limpia, letras limpias y cierre sin sonidos agregados (rama `v1o-unbreakable-h`)

- Doble rendija: sin arcos ni líneas; el tambor enciende la simulación misma (|ψ|² más intensa, ataque de 40 ms y
  caída de 250 ms), con un resplandor difuso en las rendijas y un empuje de cámara de hasta 2 % en los golpes fuertes.
- LECTURES en blanco limpio, sin sombra: las partículas que pasan por el lugar de cada letra se desvanecen en los
  0,25 s previos a su gota (`src/final.ts`).
- Cierre solo con la canción: sin shimmer ni blips (`SONIDOS_CIERRE=v1o` los vuelve a poner). La mezcla se normaliza
  a −1 dBFS.

### v1o-g: LECTURES con las gotas de la coda y la rendija con los tambores (rama `v1o-unbreakable-g`)

- `herramientas/eventos_reales.py` (después de `conform_pulso.py`) detecta en la canción editada las gotas de la coda
  (ataques agudos en 1,3-6 kHz) y los tambores bajo la doble rendija (toms y bombos con v ≥ 0,38 e impactos) y los
  agrega a `src/ritmo.json` («gotas», «letras», «tamboresRendija»).
- LECTURES se escribe con las tres gotas reales que siguen a la convergencia (88,62 · 89,08 · 89,55 s): LEC, TUR y
  ES. Cada letra cae como una gota de luz que aterriza en el ataque, con un pop y una onda que se abre; las letras van
  sobre la nube con un halo oscuro suave, así se leen desde la primera gota.
- Audio: sin las campanitas de las letras (una versión sutil quedaba 18-21 dB bajo las gotas: no aportaba) y sin el
  shimmer de la convergencia (tapaba las gotas). Quedan los blips de «Próximamente» y la web y el shimmer de la web.
- Doble rendija: en cada tambor la fuente suelta un paquete de luz que cruza las rendijas y se abre en dos frentes,
  las franjas destellan y decaen, y en los golpes fuertes la cámara se empuja un 2 % con easing.

### v1o-f: los sonidos de LECTURES (rama `v1o-unbreakable-f`)

- `herramientas/sonidos_lectures.py` escribe la mezcla final de `public/musica.wav`: la canción editada
  (`cancion_editada()` de `herramientas/editar_cancion.py`) más los sonidos del cierre de la v1o, con su síntesis,
  reverb y ecualización: una campanita por letra de LECTURES en el instante en que entra la letra (arpegio de La
  menor A5 C6 E6 A6 B6 C7 E7 A7, paneo de izquierda a derecha), el shimmer de la marca en la convergencia y con la
  web, y un blip para «Próximamente» (E6) y otro para la web (A6). La tonalidad sale del cromagrama de la coda.
  Nivel 3 dB bajo la banda del ostinato; la mezcla se normaliza a −1 dBFS de pico.
- Orden: `conform_pulso.py` → `eventos_reales.py` → `sonidos_lectures.py` (`editar_cancion.py` solo para revisar
  los empalmes).

### v1o-e: canción editada por compases, todas las escenas en el orden de la v1o (rama `v1o-unbreakable-e`)

- Canción editada (`herramientas/editar_cancion.py`, tramos en «edicion» de `src/ritmo.json`): compases 0-21, salto
  del downbeat B22 al quiebre (B29; se quitan los compases 22-28 del coro), compases 29-41, el clímax completo otra
  vez (34-41) y desde la caída del compás 42 hasta el final. Empalmes en downbeats con crossfade de igual potencia de
  20 ms. Dura 93,28 s. Los eventos reales se llevan a la canción editada (`src/ritmo.ts`).
- Todas las escenas de la v1o en su orden y con sus transiciones, en un solo tramo amarrado al pulso: fluido en la
  caída, Mandelbrot y Julia en el clímax exactamente como en la aprobada, la lente se cierra y nace Lorenz, Gray-Scott,
  Chladni, ADN, prisma, espiral áurea, girasol, nautilus, la estrella, TÚ en el golpe final y la marca en el último
  impacto.
- Escena nueva «ondas» (19,4-24,9): las rendijas son dos fuentes de Huygens que emiten un frente con cada nota de
  cuerda (más fuerte en acentos y batería); la interferencia se enciende donde se cruzan; la cámara se acerca; en el
  hueco se congelan; en el impacto de 24,94 se vuelven el campo del dipolo.

### v1o-d: campo completo, fractales en el clímax (rama `v1o-unbreakable-d`)

- Rendija → campo: el fluido cuántico se apaga en 0,45 s mientras las rendijas se encienden y son las cargas en el
  mismo lugar; las líneas crecen desde ellas y todo aterriza en el golpe del compás 10 (19,42).
- Campo: dipolo fijo (+1, −1); los golpes cambian solo la geometría con un morph suave. Líneas completas (RK4 de
  paso adaptativo hasta la otra carga o fuera del cuadro), sembradas simétricamente alrededor del eje de las cargas,
  con el mismo grosor y brillo, recortadas cerca de las cargas para que no se forme una mancha.
- Fluido y fractales sin la capa de reacción global (como en la aprobada); el plano final conserva el giro por golpe
  y la caída por notas. Fractales un 12 % menos expuestos.
- Estructura: Lorenz pasa al coro, antes de Gray-Scott (compases 21-23). Los fractales ocupan el clímax de 63,74 a
  74,81 (5 s más de plano final, con la misma profundidad y la misma deriva de c que la aprobada) y el corte a la
  espiral áurea cae en el compás 40 con la lente cerrándose.

### v1o-c: capa de reacción a la canción real (rama `v1o-unbreakable-c`)

- `SALIDA=src/cancion.json PYTHONPATH=pylib python3 herramientas/ritmo_cancion.py` escribe los eventos reales (469
  notas de cuerda con acentos 3+3+2, bombos, toms, cajas, impactos y braams). `src/ritmo.ts` los expone en segundos
  de la canción (`REAL`) y de escena (`REAL_ESC`), encima de los drivers internos de la v1o.
- Todo el video (`src/gl.ts`, `src/Video.tsx`): cada nota de cuerda manda un brillo fino que cruza solo las luces del
  cuadro en 0,16 s (más fuerte en los acentos); cada golpe de batería, un barrido ancho, algo más de halo y un empuje
  de cámara de 0,7 % con easing. Se apaga en la convergencia de la marca.
- Líneas de campo (19,4-28,6 s): las cargas cambian de configuración (distancia y signo) en cada golpe fuerte, las
  partículas avanzan un paso por nota, el hueco queda quieto y en el riser giran cada vez más rápido, se cierran y
  las líneas se estrechan y brillan hasta el agujero negro.
- Plano final del fractal: rota 30° en cada golpe fuerte (aterriza en el golpe) y la paleta salta; la caída baja por
  escalones con las notas; destello en los acentos.
- `herramientas/correlacion_onsets.py` mide la correlación entre el cambio visual y los eventos reales.

### v1o-b: conform amarrado al pulso (rama `v1o-unbreakable-b`)

- La primera versión deformaba el tiempo con velocidades distintas por escena y el movimiento se desfasaba de la
  canción. Ahora un pulso de la v1o (0,5 s) es siempre un pulso de la canción (0,4616 s): toda la animación corre un
  8,3 % más rápido y nada más. `herramientas/conform_pulso.py` escribe `src/ritmo.json` desde los eventos INTERNOS de la
  v1o (`src/ritmo_v1o.json`, el mapa aprobado), reubicados con ediciones de pulsos enteros dentro de las escenas
  (se repite un compás de eventos o se quitan pulsos del medio; el comienzo, el final y las transiciones de cada escena
  no se tocan). El montaje tiene cuatro tramos con cortes solo en downbeats (compases 0, 22, 29 y 40).
- `herramientas/fase_pulso.py` mide la fase de los picos de cambio visual respecto de la grilla de la canción y arma
  tiras de 16 cuadros (uno por semicorchea).

### v1o sobre la canción real: montaje y sincronía (primera versión, rechazada)

- Música: la canción completa, decodificada a `public/musica.wav` (48 kHz). `herramientas/ritmo_cancion.py` lee el
  análisis de `../teaser-unbreakable` (129,98 BPM, compás 0 en 0,957 s una vez afinado), corre cada evento al comienzo
  real de su ataque (+14 ms de mediana), detecta las 469 notas del ostinato de cuerdas (lógica de la v7d) y escribe
  `src/ritmo.json` con los drivers de la v1o en segundos de la canción: arpegio = cada nota de cuerda; hats = notas
  sin acento; palmas = la caja o el tom más fuerte de cada medio compás; bombos = impactos, bombos y toms fuertes;
  motivo = los cinco primeros acentos 3+3+2 de cada compás; drops = impactos grandes y braams; risers = el despegue
  (23,6-28,7) y el del quiebre (57,6-61,9); silencios = el hueco (23,66) y el silencio (79,19); golpes, notas y
  redoble del final = braam de 84,03, compás 46, último impacto (86,81) y los primeros ataques de la coda.
- Montaje (`montaje` en `src/ritmo.json`, `escena()` en `src/ritmo.ts`): la v1o se sigue dibujando en su tiempo de
  escena, con sus secciones, transiciones y lógica intactas; cada nudo dice qué segundo de escena se ve en un segundo
  de la canción (tramos lineales; dos nudos en el mismo segundo de la canción son un corte). `src/ritmo.ts` pasa cada
  evento real a tiempo de escena, así cada pulso cae en el cuadro de su golpe.
- Estructura: prólogo y acto I en la intro (0,47-21,26); líneas de campo en la precarga, quietas en el hueco y
  colapsando en cámara lenta durante el despegue; agujero negro en el impacto mayor (28,64), la cámara baja al disco
  en el braam de 31,41; toro, órbita y tres cuerpos en el coro; corte en 40,62 a Gray-Scott → Chladni (43,28) → ADN
  (46,17) → prisma (50,79); corte en el quiebre (54,25) a la búsqueda con «Y ALGUIEN QUE NO DEJÓ DE» y BUSCAR en el
  golpe de 58,19; teseracto con el riser del quiebre; fluido en el braam descendente (61,88); Mandelbrot en el clímax
  (63,74, un corte por tiempo), Julia, plano final largo y Lorenz en el impacto y braam de 70,19; corte en 73,89 a la
  espiral áurea → girasol → nautilus; la estrella en el silencio (79,19), TÚ en el golpe final (80,35), el final
  aprobado desde el compás 44 (82,20) y la convergencia en la marca en el último impacto (86,81).
- Sincronía (`herramientas/sincronia_audio.py` sobre el mp4): 26 de 36 acentos grandes con un onset a ±1 cuadro
  (72 %). Revisión: `herramientas/revision_cancion.py` (pares en los 15 eventos más fuertes, tiras de cada corte y
  comparación por sección con la v1o aprobada).
- Para que el acto III quepa, Gray-Scott, Chladni, ADN y prisma pasan al coro (antes de la búsqueda); se conservan
  los encadenamientos fractal → Lorenz y teseracto → fluido → Mandelbrot.

## Comandos

Los pasos completos, con requisitos, están en el [README de la raíz](../README.md#-04-cómo-reproducirlo). En corto,
desde `teaser/` y con el entorno de Python activo (`requirements.txt`):

```bash
npm ci
python herramientas/sonidos_lectures.py                  # public/musica.wav (necesita musica/<canción>.mp3)
python herramientas/lic.py && python herramientas/lic_animada.py
for f in 45 169 916; do FORMATO=$f python herramientas/cuantico.py; FORMATO=$f python herramientas/grayscott.py; done
npx tsc --noEmit
node herramientas/cuadros.mjs out/cuadros 900,2700 ClaseYT   # cuadros sueltos (números de cuadro, 30 fps)
python herramientas/render.py 300 4 Clase                    # igual con ClaseYT y ClaseTT
```

Para regenerar los mapas de tiempo (ya versionados): `python herramientas/conform_pulso.py` y luego
`python herramientas/eventos_reales.py` reescriben `src/ritmo.json` byte a byte igual. Si cambia la música, borra
`out/partes*/` antes de volver a renderizar.
