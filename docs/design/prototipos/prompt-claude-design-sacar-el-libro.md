# Prompt para Claude Design · la transición «sacar el libro de la pila»

Pégalo tal cual en https://claude.ai/design. Es una sola pieza: un prototipo HTML interactivo de la
animación, no una pantalla estática. Lo que ya está decidido va como restricción, no como sugerencia.

---

Quiero un prototipo HTML+CSS+JS de UNA animación, para verla y ajustarla, no una web. Es para
CodeDoc Archive (CDA): el código de un proyecto leído como un libro. En la biblioteca los libros
están tumbados en una pila, se ve el lomo de cada uno; al hacer clic en uno, el libro sale de la
pila, se pone de pie, gira y queda de frente, grande, en la vista de portada.

Lo que tiene que pasar, en este orden y con estos tiempos (420 ms en total, ease-out, cada paso
encadena con el anterior sin parar):

1. Reposo: cinco libros tumbados en una pila abajo a la izquierda (Yogin Website, Yogin API,
   GridWatch, Naeth, CENIT, de arriba abajo; CENIT el más grueso). Solo se ve el lomo de cada uno,
   con su nombre. Naeth está deslizado 28 px a la derecha porque el ratón está encima.
2. 0 a 90 ms: clic. Naeth sale de la pila deslizándose hacia la derecha, todavía tumbado. Deja su
   hueco en la pila. El resto de la pila se atenúa al 10 %.
3. 90 a 170 ms: se pone de pie en el plano de la pantalla (gira 90° sobre su esquina inferior
   derecha): el lomo pasa de horizontal a vertical y el nombre se lee de arriba abajo.
4. 170 a 290 ms: gira sobre el eje vertical del lomo y da la tapa: el lomo queda a la izquierda, la
   tapa al frente, y por la derecha asoma el canto de las páginas (un taco claro con líneas finas).
5. 290 a 420 ms: crece hasta su tamaño final, centrado en el tercio izquierdo de la pantalla, con una
   sombra suave sobre la mesa. A la derecha entra deslizándose una «solapa» con el nombre, un
   subtítulo, unas cifras y un botón «abrir el libro».

La vuelta (botón «volver a la pila», o Esc) es la misma secuencia al revés en 280 ms, y el libro
tiene que aterrizar exactamente en su hueco.

Restricciones técnicas, no negociables:
- El libro es una caja 3D con tres caras visibles: lomo, tapa y canto de páginas. `perspective` en
  el contenedor, `transform-style: preserve-3d`, `backface-visibility: hidden` en las caras.
- Solo cambian `transform` y `opacity` por fotograma. Nada de `width`, `height`, `top`, `left`,
  `filter: blur` ni `box-shadow` animados: tiene que ir a 144 Hz. Crecer es `scale()`. La sombra es
  un elemento aparte que solo cambia de opacidad.
- Con `prefers-reduced-motion` la animación se sustituye por un fundido de 120 ms del principio
  al final.
- Un deslizador de velocidad (0,25× a 4×) y un modo «paso a paso» con un botón «siguiente fase»,
  para poder mirar cada fase parada. Un contador de fps en una esquina.

Aspecto: fondo oscuro (#1c1d1f la mesa, #121315 alrededor), tipografía Inter y JetBrains Mono para
las cifras. El libro tiene la tapa de tela azul oscura (#2f4a6b), el lomo #1c2e45, el canto de
páginas #d9d2c0, y en la tapa y en el lomo solo el nombre «Naeth» en blanco (usa texto, no hace falta
logo). Proporción del libro de frente: 560 de ancho por 760 de alto; de canto, unos 40 de grosor.
Nada más en la tapa: ni subtítulo ni autor.

Dame un solo fichero HTML que funcione al abrirlo, sin dependencias externas.

---

Notas para después de recibirlo:
- Compararlo con `docs/design/prototipos/sacar-el-libro.html`, que hace lo mismo con caja CSS; lo que
  Claude Design resuelva mejor (sobre todo el canto durante el segundo giro y la sombra) se trae.
- Lo que se decida queda en el anexo M de la discovery, no en el prompt.
