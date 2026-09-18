# Discovery: la vista CDA diseñada en Pencil, con animaciones propias

Fecha: 15/09/2026, en curso. Brief y respuestas de Eneko en
`docs/plan/cda-vista-diseno-brief-2026-09-14.md`. El `.pen` vivo es `docs/design/cda-ficha.pen`
y sus exportaciones `docs/design/exports/*.png`.

Las ocho secciones del entregable se escriben al cerrar la discovery. Lo que hay hoy es el anexo A,
escrito a las 17:50 mientras se itera la pieza 2 (la tira V2e), porque la referencia de JetBrains
salió en la conversación y conviene tenerla entera antes de seguir eligiendo.

## Anexo A · Lo que hace bien el editor de JetBrains, y qué se lleva la ficha

Criterio: la ficha CDA no es un editor, es una lectura. Se copia lo que ayuda a orientarse y a leer
sin pedir nada; se descarta lo que existe para escribir. Cada cosa lleva su capa (0 reposo, 1 scroll,
2 ratón, 3 clic), que es la regla de integración propuesta el 15/09: cada capa la abre un gesto y se
retira sola. Fuente al lado de cada fila; lo que va de memoria y no se ha comprobado hoy en la doc
lleva ⚠.

| Lo de JetBrains | Qué hace | La ficha se lleva | Capa |
|---|---|---|---|
| Sticky lines (2024.1, hasta 5, clic para ir) [1] | Las declaraciones que te envuelven se quedan fijas arriba al hacer scroll | La firma del bloque fija; si también la sección de la doc, es la duda 1 | 1 |
| Barra de scroll con marcas (error stripe) [2] | La barra enseña dónde hay errores, avisos y TODO, por color | La tira de 48 px con la silueta del fichero, el bloque actual en acento y marcas ámbar en las anotaciones ⚠ | 0 |
| Inspections widget [2] | Arriba de la barra, un resumen: cuántos errores y avisos tiene el fichero | Un contador arriba de la tira: "4 notas · 2 ⚠" del bloque. Barato y evita abrir el margen para saberlo | 0 |
| Lens mode [2] | Al pasar el ratón por la barra, una vista del código de ese punto sin hacer scroll | La lente del bloque vecino: firma, primera línea de su doc, líneas, anotaciones, abrir. Ratón o clic es la duda 2 | 2 |
| CodeGlance Pro [3] | Minimapa con colores; opción "Show Minimap on scrollbar hover" (plegado hasta pasar el ratón, con retardo configurable), "quick hide", lente al pasar el ratón por el minimapa | La tira plegada a 8 px en reposo y entera con el ratón (fila 3 de los ejemplos). Si se elige, el retardo es obligatorio: sin él salta al ir al margen | 0 y 2 |
| Reader mode [4] | Para ficheros de solo lectura: los comentarios de doc renderizados como texto (Ctrl+Alt+Q o el icono del gutter), ligaduras, más interlineado, inlay hints de usos, formato virtual | Es la pieza 1 tal cual: la doc renderizada dentro del código con el icono en el gutter y "ver el docstring en crudo". Faltan como ajustes: ligaduras e interlineado, junto al tema y los brackets | 0 |
| Code Vision [5] | Encima de una clase o método, una línea gris: usos, herederos, autor. Configurable arriba o al final de línea | Encima de `def`, una línea gris: "3 usos · llama a 4 · Eneko, 28/08". Es la entrada natural a la capa 3: clic en "3 usos" abre el margen con V2b. Sin ella, el margen no tiene por dónde abrirse desde el código | 0, y 3 al clic |
| Inlay hints [5] | Nombres de parámetro y tipos inferidos, en gris dentro de la línea | Poco: los nombres ya están en la firma. Quizá en las llamadas del cuerpo (`core.search(query, k=k, …)`) no hace falta. Descartado por ahora | |
| Breadcrumbs [2] | Fichero › clase › método, abajo del editor | Las migas de la cabecera (`naeth / app / mcp_server.py / memory_search`). Ya están | 0 |
| Gutter [2] | Números de línea, anotaciones e iconos de acción según contexto | El gutter de la pieza 1: números, el icono de libro en la doc. Ya está | 0 |
| Structure popup y ventana Structure ⚠ | La lista de símbolos del fichero, con filtro, para saltar | El carril de la izquierda lista los bloques del fichero; la tira es su versión visual. No hace falta una tercera | 0 |
| Ctrl + ratón sobre un símbolo, y Quick Documentation ⚠ | El símbolo se subraya como enlace y sale la doc en un globo | El peek V1: símbolo subrayado, globo con firma y resumen, clic para ir. Ya elegido | 2 |
| Highlight usages of element at caret ⚠ | Con el cursor en una variable se iluminan todos sus usos en el fichero | Al pasar el ratón por un parámetro en la firma se iluminan sus usos en el cuerpo y su fila en PARÁMETROS. Es una animación propia barata, y enseña algo | 2 |
| Semantic highlighting y Rainbow Brackets ⚠ | Cada variable local con su color; los paréntesis anidados por colores | Los ajustes de apariencia del código que pidió Eneko en la pieza 1: tema (GitHub Default), brackets por nivel, variables por color, ligaduras, interlineado | 0 |
| Indent guides y línea actual ⚠ | Líneas finas verticales por nivel de sangría; la línea del cursor sombreada | Las guías de sangría, sí, cuestan nada y ayudan en Python. La línea actual no tiene sentido sin cursor; en su lugar, la línea que el vídeo o la anotación señala (ya está, L440) | 0 |
| Plegado (folding) con vista previa ⚠ | Un bloque plegado enseña una línea de resumen | La `description` plegada de la pieza 1, con su resumen y rango. Ya está | 0 |
| Method separators ⚠ | Líneas finas entre métodos | No: la ficha enseña un bloque, no el fichero | |
| Search Everywhere, Recent files ⚠ | Doble Shift busca todo; los ficheros recientes | Para la biblioteca, no para la ficha: buscar un símbolo en cualquier libro, y "seguir donde lo dejaste" | |
| New UI (2022.3 en adelante) ⚠ | Menos iconos, ventanas de herramientas escondidas por defecto, más aire | Es la misma dirección que "más aire y menos cajas" del 15/09. Nada que copiar, sí que confirmar | |

Lo que sale de la tabla para la pieza 2:

- **La tira lleva tres cosas en reposo**, no una: silueta, marcas ámbar y el contador arriba. Con eso
  el margen puede estar cerrado por defecto sin perder información.
- **La línea Code Vision encima de `def` es la que abre el margen.** Resuelve "cómo integrar todo sin
  sobrecargar": el vecindario no está a la vista, está a un clic en la línea que dice cuántos usos
  tiene. Es lo siguiente a dibujar.
- **Dos animaciones propias salen de aquí**: la lente que aparece desde la tira, y los usos de un
  parámetro iluminándose al pasar el ratón por la firma. Van a la lista de la sección 4.

Fuentes: [1] https://www.jetbrains.com/help/idea/sticky-lines.html y
https://blog.jetbrains.com/idea/2024/02/intellij-idea-2024-1-eap-4/ · [2]
https://www.jetbrains.com/help/idea/using-code-editor.html · [3]
https://github.com/Nasller/CodeGlancePro · [4] https://www.jetbrains.com/help/idea/reader-mode.html ·
[5] https://www.jetbrains.com/help/idea/inlay-hints.html y
https://plugins.jetbrains.com/docs/intellij/inlay-hints.html. Consultadas el 15/09/2026.

## Anexo B · Decisiones de la pieza 2 (15/09/2026, 19:15, AskUser)

Sobre `docs/design/exports/P2-V2e-v2.png`, `P2-V2e-dudas.png` y `P2-V2e-v3.png`:

1. **Al hacer scroll se quedan fijas dos filas**: la firma del bloque y la sección de la doc en la
   que estás (`Notes · por qué devuelve el digest`), cada una con sus líneas a la derecha. Clic en
   una fila lleva a ella.
2. **La lente del bloque vecino sale al pasar el ratón por la tira con retardo, y el clic la
   fija** con un × hasta cerrarla. El retardo existe para que no salte al cruzar la tira hacia el
   margen; CodeGlance Pro lo trae configurable y por defecto a 0 ms, aquí se mide en la sección 4
   (punto de partida, 300 ms, sin base).
3. **La tira mide siempre 48 px**: silueta del fichero, bloque actual en acento, marcas ámbar de
   anotaciones ⚠ y el contador arriba. No se pliega.
4. **Entran la línea Code Vision y el contador.** Encima de `def`: «3 usos · llama a 4 · Eneko ·
   28/08/2026»; «3 usos» y «llama a 4» son enlaces que abren el margen con V2b enfocado en quién
   llama o en las dependencias. Arriba de la tira: «4 · ⚠2», clic baja a la primera anotación.
   **El margen está cerrado por defecto**; la línea Code Vision es su única entrada desde el código.

Queda por dibujar de la pieza 2: la columna de código con todo junto (v4) y el margen abierto
desde «3 usos» (V2b con V2c desplegable). Después, la pieza 3 (anotaciones y nota de prosa) y la
biblioteca.

## Anexo C · Decisiones de la pieza 3, anotaciones y nota de prosa (15/09/2026, 21:35)

Sobre `docs/design/exports/P3-V1-cuaderno.png`, `P3-V2-en-linea.png`, `P3-V3-hilo.png` y sus
`*-pulido.png`. Lo que dijo Eneko: V1 "limpio y fácil de entender, puede ser una opción base"; V2
"puede ser muy interesante y útil, así se sabe perfectamente dónde está y por qué"; V3 "solo me
parece útil si acabo teniendo un modelo en local que me responda". Y "les falta una pulidita a las
tres", que es la segunda ronda.

1. **V1 es la base.** Las anotaciones van al pie del bloque, como cuaderno de lectura: sin cajas,
   icono, cabecera de una línea y texto con filete de cita; acciones (editar, enlazar, retirar)
   solo al pasar el ratón; la marca «importante» es una entrada más y la estrella de la cabecera;
   la nota de Naeth enlazada enseña título y digest con «abrir en Naeth»; anotar es un campo al
   final con `☆ importante`, `⌘K enlazar nota` y `⌘↵ guardar`.
2. **V2 entra como precisión opcional de la misma anotación, no como otro sistema.** Una anotación
   puede llevar línea o no. Si la lleva, sale anclada en el código (filete en acento, ancla en el
   gutter, `+` gris al pasar el ratón por una línea) y además en el cuaderno del pie con «en la
   línea 440» como enlace. **Pide `line integer null` en `code_annotation`**, que el plan de la
   sub-fase 4 no tiene: decisión pendiente antes de crear el esquema (sección 8).
3. **V3, el hilo lateral, se aparca** hasta que haya un modelo que responda (local o en servidor
   propio). Sin agente, V1 hace lo mismo con menos. Queda dibujado por si llega.
4. **Vocabulario.** «Notas» son las `Notes:` del docstring (las cuenta el contador de la tira,
   «4 · ⚠2»); «anotaciones» son la capa de Naeth (`code_annotation`); «nota de Naeth» o «nota
   enlazada» es la memoria con `memory_id`. El chip de la cabecera pasa a decir «2 anotaciones ·
   1 nota enlazada».

Especulación de Eneko al hilo de V3, apuntada sin más: alquilar un servidor "que no se caiga nunca"
para `naeth.dev`. A 15/09 `finally` ya es VPS y tiene los endpoints públicos; la pregunta sería
quién manda y quién replica, que es lo que CENIT resuelve con el failover.

Queda: la biblioteca (entrada a CDA, libro = repo).

## Anexo D · La biblioteca, primera ronda (15/09/2026, 23:10)

Tres propuestas nuevas tras descartar G y H: `B-I-indice.png` (índice tipográfico, la línea mide
las páginas), `B-III-lomos-reales.png` (lomos con las reglas de imprenta: pegados, grosor = páginas,
título en vertical, marca de editorial al pie, cinta en el que lees) y `B-II-pila.png` (libros
tumbados en una pila, el gordo abajo, el que lees asoma, detalle a la derecha). Lo que no cuadraba
en G, comprobado contra las guías de imprenta: lomos de igual ancho y distinta altura (al revés),
separados en vez de pegados, y el título en horizontal.

Eneko elige **II, la pila**, y añade:

1. **Los logos en los lomos.** Cada libro lleva el logo de su proyecto en el lomo.
2. **Un libro por proyecto, no por repo**: Yogin no tiene sentido como dos libros. Pendiente de
   decidir cómo se representa un proyecto con dos repos (¿un libro con dos partes o tomos?), porque
   el plan dice libro = repo y `code_block.repo` es el repo.
3. **Imágenes de stock para los lomos**, para que no se vean planos. ⚠ Pendiente medir qué pesa
   eso en el visor y dónde viven las imágenes.
4. **Estanterías** cuando haya más de N repos: no una megapila. Las pilas se agrupan en baldas.
5. Idea aparte, apuntada: la metáfora de libros podría valer también para Naeth, sus notas y nodos.

Solo Naeth tiene páginas reales (131); las demás son ≈ por líneas de código, marcadas con ≈.

**Orden propuesto para iterar, una pieza cada vez**: primero **el libro** (un solo objeto: lomo con
logo, textura, grosor, cinta, estados leyendo / sin empezar / por llegar), porque la pila y la
estantería se construyen con él; después la pila (asomar, levantar al pasar el ratón, detalle);
después la estantería (cuántas pilas por balda, cómo se agrupan); el detalle al final.

## Anexo E · El libro, decidido (16/09/2026, 18:20)

Ocho vueltas en el `.pen` (frames "9 · El libro" v1 a v8, exportaciones `L-libro*.png`), con tres
moodboards de Unsplash en el lienzo (lomos, colecciones, pilas). Lo que queda:

- **Un libro es un repo** (`code_block.repo`). Yogin son dos libros con el mismo lomo, como una
  colección de libros de texto (idea de Tania): mismo logo, tela y color de familia; cambia la parte
  (API, Website) y una banda de color. El modelo no cambia.
- **Forma: libro tumbado visto de canto, con la tapa de arriba en oblicuo** (A3 de la v8: 34 × 16),
  el lomo de frente y el canto de páginas saliendo por la derecha en oblicuo. Proporción 6:1: 380 px
  de largo; el grosor son las páginas, 0,36 px por página más 15 (Naeth 131 → 62; 45 → 31).
  Tapa con degradado de luz y pliegue donde dobla, tapa de 3 px de gruesa en el canto, ceja de 2 px
  en el lomo, curva del lomo con sombra y brillo fino. **Sin sombra** (B1): la tapa de abajo oscura
  es el apoyo. La sombra suave queda solo para el libro que se levanta al pasar el ratón.
- **Lomo**: el lockup del proyecto como título (Naeth, `docs/img/naeth-lockup-dark.svg`); los
  proyectos sin lockup, símbolo más nombre. A la derecha, las cifras: leyendo, «24 capítulos · 131
  páginas» y debajo «vas por la página 44 del capítulo 9»; sin empezar, solo la primera línea; por
  llegar, la sub-fase.
- **Canto**: hojas finas cada 3 px y la parte leída teñida (ámbar) proporcional a las páginas. Es
  el único indicador de progreso en el objeto. Los pósits se descartaron (su información va al
  detalle o a la portada); la cinta, la goma y los puntos por capítulo también.
- **Tela por libro, del propio proyecto, teñida con su color**: Naeth un cielo de estrellas; CENIT
  cables de red o fibra (es el Sistema Central de Interconexión, nota `0118a73a`); GridWatch alta
  tensión; Yogin una sala de yoga. Imagen elegida por Eneko, un fichero por proyecto.
- **Tres estados**: leyendo (tela de color, canto teñido), sin empezar (tela de color, canto crema),
  por llegar (tela apagada, borde, sub-fase en vez de cifras).
- **De un vistazo, antes de abrir**: qué libro es, cuánto tiene, cuánto llevas, si existe.

Aparcado, en la lista: la portada al elegir un libro, con más información, y la animación de
abrirlo hacia el índice; el color de familia debería salir del logo; los logos de los demás
proyectos van a `docs/design/assets/logos/` cuando Eneko los copie.

Siguiente: la pila con este libro.

## Anexo F · La pila con el libro, la navegación y la página en móvil (17/09/2026, 16:00)

- **La pila** (hojas 7): el que tiene el ratón encima se desliza 28 px tras 250 a 300 ms y vuelve
  sin retardo al salir; gana la sombra suave solo mientras está fuera; **ningún libro se queda
  sacado**; el detalle de la derecha anticipa el libro bajo el ratón. Arrastrar para ordenar,
  aparcado (segunda vuelta, el orden lo guarda el usuario).
- **Navegación D, elegida por Eneko** (hoja 8, tres secuencias dibujadas A, B y C): el libro es la
  interfaz. Biblioteca → animación de sacar el libro → portada (vista nueva) → animación de abrir →
  índice (seguir por donde ibas, resumen, cerrar) → páginas (página = bloque, capítulo = fichero) con
  animación de pasar página. A (biblioteca portada, ficha a pantalla completa) queda de respaldo.
  Reglas: animaciones cortas (< 400 ms), interrumpibles, `prefers-reduced-motion`; móvil primero
  para la página.
- **Lámina 0 · PLAN** en el `.pen`: checklist con hecho, siguiente en orden, reglas, aparcado y el
  check «A Eneko se le ha vuelto a ocurrir otra cosa». Cada hoja lleva el número de su punto.
- **Punto 1, la página en móvil, hecho** (hoja 9, `P1-movil-esencial.png`). Medido en el móvil de
  Eneko (Nothing Phone 3a, Brave con la barra abajo): viewport útil ≈ 412 × 752. Decidido: **en
  móvil solo lo esencial** (leer el bloque, moverse con botones, saber dónde estás, marcar
  importante y anotar corto, salir al índice y a la biblioteca); **sin gestos** (Nothing OS y Brave
  tienen los suyos); **sin el cromo del visor** (cabecera, rail, barra de estado se esconden al
  leer); el código se parte, sin scroll horizontal; navegación como Olympus (lector de cómics):
  cabecera fina arriba, contenido entero, y al final anterior y siguiente. Fuera en móvil: Code
  Vision, tira, peek, lente, vecindario, copiar, GitHub, docstring en crudo; un símbolo del código
  es un enlace a su página. **Nada del diseño móvil se reutiliza en escritorio** (dicho por Eneko).
  El índice en móvil salió de rebote: lockup y cifras, «seguir leyendo», buscar, capítulos con
  mini resumen (primera línea de la cabecera del fichero) y páginas leídas.
- Siguiente: punto 2, la página doble en escritorio.

## Anexo G · La página doble en escritorio, primera vuelta (17/09/2026, 23:20)

- **Pantallas de Eneko**: 1920×1080 (secundaria) y 2560×1440 (principal). Se diseña a **1920×1000**
  (Brave se come unos 80 px). El libro tiene tamaño: en 2560 **no se estira**, se centra en la mesa.
- **Hoja 10 A** (`Pt2-doble-A-sin-carril.png`): libro abierto a todo el ancho, código a la izquierda
  (1150 px) y vecindario + cuaderno a la derecha. Se dibujó también una B con el carril de la v4 como
  atril (200 px); Eneko no vio diferencia, y si no se nota es que sobra: **B borrada**.
- **Feedback de Eneko sobre A**: no se siente libro (sin marco, lomo plano, páginas asimétricas);
  el minimapa tiene que ser como CodeGlance en IntelliJ, **translúcido y encima del código**, y hacer
  de scrollbar; el índice es lo primero al abrir el libro, «volver al índice» hojea hacia atrás y la
  página que dejas queda con **marcapáginas temporal** (uno por libro; lo permanente es «importante»);
  las dos secciones de la derecha no arrancaban en la misma vertical (sangrado heredado de la pieza 3).
- **Hoja 10 A2** (`Pt2-doble-A2-reposo.png`, `Pt2-doble-A2-minimapa-hover.png`): marco de tapa de
  14 px alrededor (color provisional `#2b3340`, la tela de Naeth cuando la haya), dos páginas
  simétricas de 876 px (816 de línea, unos 100 caracteres a 13 px, el ancho de ruff), lomo de 40 px
  como curva de sombra en cinco pasos, minimapa fuera del flujo: en reposo barra de 8 px con pulgar
  (qué parte de la página ves) y rayas ámbar de aviso; con el ratón encima, minimapa de 128 px al 86 %
  encima del código con las líneas en miniatura coloreadas, la ventana visible enmarcada y los avisos.
  El contador «4 notas · ⚠ 2 avisos» pasa a chip de la cabecera. **El minimapa es de la página (el
  bloque), no del fichero**: el mapa del fichero vive en el vecindario («24 bloques · 9 leídos»).
  Esto supera «la tira siempre 48 px» del anexo B (decidido por Eneko el 17/09).
- **Feedback de Eneko sobre A2, con cinco fotos de un cuaderno real** (tapa azul, cinta, sobre una
  tela): «no está mal pero no termina de parecer un libro». Lo que las fotos enseñan y a A2 le falta:
  1. **El taco de páginas**: bajo la página de arriba se ven los cantos de las demás, color crema,
     como líneas apiladas en el borde exterior y abajo. Es lo que más dice «libro».
  2. **La tapa sobresale** unos milímetros por fuera del taco, con esquinas redondeadas, y se ve
     distinta según el ángulo: no es un marco uniforme de 14 px.
  3. **La página no está plana**: se curva hacia el lomo con una sombra suave y se levanta un poco
     en el borde; hay un gradiente de luz de fuera hacia dentro. «Esto va a ser difícil pero
     podemos hacerlo».
  4. **El lomo** es donde las dos páginas se hunden, con la cinta saliendo por abajo.
  5. Las páginas llevan **marcas de esquina** pequeñas (en el cuaderno son las marcas de escaneo;
     en la nuestra podrían ser el sitio del número de página).
- **Más feedback A2**: en la página derecha (nodo `w1Ojp6`) sobra espacio al lado de las llamadas
  (las filas del vecindario usan 390 de 816 px) y al final del cuaderno; para el cuaderno basta con
  **bajar «anotar» al pie de la página**. El CodeGlance de IntelliJ hay que verlo en el navegador
  integrado antes de adaptarlo del todo (esta noche los dos navegadores no pintaban; pendiente).
  «Aun así falta pulir en general».
- Siguiente: hoja 10 A3 con el taco de páginas, la tapa que sobresale, la curvatura, el lomo con
  la cinta como marcapáginas (⚠ propuesta mía, no decidida: la cinta la descartó Eneko para el
  libro cerrado de la pila, pero como marcapáginas temporal del libro abierto tiene otro papel),
  el vecindario aprovechando el ancho y «anotar» al pie.
- **Referencia de Eneko (23:14)**: otra forma de entender el libro digital es mirar **los libros de
  los videojuegos** (Minecraft y otros): cómo dibujan la doble página, el paso de página y el marco
  con poco. Pendiente de mirar antes de A3.

## Anexo H · El libro abierto, decidido: taco, tapa, lomo y los dos modos (18/09/2026, 13:45)

Sexta vuelta del punto 2 en una mañana (A3, A4, A5, B1, B2, y las hojas de lomos). Lo que queda:

- **Referencias**: CodeGlance Pro a tamaño real (captura bajada al scratchpad con permiso): minimapa sin
  caja, 2 px por línea con sangría, ventana visible como banda clara, avisos en columna aparte, y un
  panel con el código al pasar el ratón. **Ese panel (la lente) Eneko lo descarta del todo**, y con
  él cae la lente del anexo B. Minecraft (una página, cuero, taco de cuatro líneas, «Page 1 of 1»,
  flecha en la esquina) y Skyrim (doble página, taco grueso, sombra suave en el centro, tapa como
  filo): los dos venden «libro» con planos, sin luz real.
- **Shaders descartados** (A4 los probó: papel con grano y tela por GLSL; Eneko: «descarta
  completamente las shaders»). Todo lo que se dibuje tiene que salir con CSS: planos, degradados
  cortos, sombras y capas de 1 px.
- **Taco**: `T = 6 + 0,25 · N` px con tope en 80; izquierda `T·(p−1)/N`, derecha `T·(N−p)/N`. En la
  44 de 131: 13 hojas y 26. La tapa se ensancha con `T` (lados `T + 8`, abajo `T + 10`, arriba 3 px
  porque en perspectiva la tapa de arriba casi no se ve). Hoja `Pt2-taco-segun-pagina.png`.
- **Cada hoja distinta**: semilla = número de página; tonos ±3 y fuerza de la caída de luz. Girar
  el eje de la luz se probó y se quitó (cuña visible en la esquina con la sombra pegada al lomo).
- **Modo oscuro y modo claro, los dos válidos** (B1 y B2): en claro todo es papel, código incluido
  (paleta GitHub Light sobre `#faf7f0`); en oscuro el taco va en grises. La mesa, la cabecera
  corrida, la biblioteca y la pila siguen oscuras en los dos: lo claro es el papel.
- **Lomo, decidido D5** tras dos tandas (L1 a L5 con degradado de página; D1 a D6 con página plana,
  porque «el problema en oscuro es el degradado»): **página plana y una sombra suave de 24 px de
  desenfoque desplazada hacia el lomo**, línea de 2 px en medio. Pencil la pinta hacia fuera aunque
  el nodo diga «inner»: en CSS es un `box-shadow` normal. La cinta por todo el lomo (B1b) se probó
  como alternativa y se descartó: se come el pliegue.
- Hojas vivas: `Q5P1Ym` (B1 oscuro D5), `Tz8Wo` (B2 claro D5), `XFRb3` (taco), `ocOBo`/`UX5Gl`/
  `BPIzm` (lomos). Exports `Pt2-doble-B1-D5.png`, `Pt2-doble-B2-D5.png`.
- Pendiente del punto 2: el hover del minimapa sobre B1/B2, el libro en 2560 centrado en la mesa,
  y la cinta como marcapáginas (sin decidir).
- **Cierre (13:44)**: la línea del centro pasa a ser **del color de la tela** (`#2b3340`), idea de
  Eneko: en oscuro es lo único que no es negro en el pliegue y enlaza con la tapa; en claro el libro
  queda de una pieza. **La cinta se quita de momento** (el marcapáginas del punto 4 queda sin forma
  decidida). Eneko: «Esta parte le doy por válido totalmente». Hojas vivas: `Uzj1F` (B1) y `EWgib`
  (B2). Lo que sigue del punto 2: el hover del minimapa sobre B1/B2 y el libro en 2560.
- **Punto 2 cerrado (14:20)**. Lo último decidido: el minimapa **no va encima del código**: tiene una
  **columna reservada de 64 px** a su derecha (el código nunca se mueve); en reposo solo la barra fina
  con pulgar y avisos, y al pasar el ratón por la columna se llena con el minimapa **estirado a la
  altura de la columna**, una línea por cada `alto / nº líneas` px con tope entre 3 y 12 (si la
  página es muy corta se queda corto y no se estira más). Pantallas: **1920×1000** (secundaria) y
  **2560×1360** (principal, Helium; no hace falta adaptarse a nada): el libro mide 1840 / 2000 px
  de ancho y las páginas toman el alto del viewport (a 1440p el bloque entero cabe en la página).
  En 1080p, con la columna, el código se queda en 704 px (unos 90 caracteres; 413 de 2.325 líneas de
  `naeth/app` pasan de 90): **scroll lateral dentro del bloque**, decidido por Eneko. Queda
  apuntado sin decidir: el hueco de la página derecha en 1440p (unos 400 px entre el cuaderno y
  «anotar») y la forma del marcapáginas. Hojas vivas: B1 (`R17bz2` reposo, `a3kqHJ` hover), B2
  (`FW9M5`, `kW3I1`), 2560 (`EhpkY`, `T365io`), taco (`XFRb3`), lomos (`ocOBo`, `UX5Gl`, `BPIzm`).
  Exports `Pt2-B1-*`, `Pt2-B2-*`, `Pt2-taco-segun-pagina`, `Pt2-lomos-*`.
- Siguiente: punto 3, el índice en escritorio.

## Anexo I · El índice en escritorio, lo que Eneko tiene en mente (18/09/2026, 14:35, dos rondas de AskUser)

- **Forma**: entre «doble página, lista y detalle» (izquierda capítulos, derecha el detalle del
  capítulo bajo el ratón) y «izquierda índice, derecha la ficha del libro»; «una lista a dos
  columnas» es la simple. Se dibujan la 1 y la 3 y elige.
- **Unidad**: capítulos plegables con sus páginas (fichero → bloques con número y estado).
- **Plegado**: todos plegados salvo el que estás leyendo. ⚠ **El índice puede ocupar varias
  páginas**, como en un libro: si no cabe, sigue en la página siguiente y se hojea.
- **Además de la lista**: seguir por donde ibas, buscar, progreso por capítulo, importantes y
  anotadas. Los cuatro.
- **Seguir por donde ibas**: dentro de la lista, marcado (la página donde ibas resaltada en su
  capítulo, con el marcapáginas al lado); nada aparte.
- **Buscar**: en el índice, arriba; filtra capítulos y páginas al escribir.
- **Al pulsar un capítulo**: va a **la página del capítulo**, una vista nueva (portadilla: resumen
  del fichero, sus páginas, desde ahí se entra). ⚠ **Es una página más, siempre**: cada capítulo
  empieza con su portadilla y al hojear se pasa por ella. Consecuencia: la numeración cuenta las
  portadillas (Naeth: 131 bloques + 24 capítulos = 155 páginas), y el taco y la cifra de la portada
  van con ese total. Va al plan como punto nuevo, después del índice.

## Anexo J · Las caras del libro al abrir, decididas (18/09/2026, 18:40)

Tarde entera de guardas (G1 barra, G2 mapa, G3 simple, G4 pulida, G4a scrubber, G4b puntos, cuatro
papeles) y de secuencia. Lo que queda, hoja 11 del `.pen`, tres dobles páginas:

1. **Guarda con la portada | Anteportada con los créditos.** La guarda es papel del color de la tela
   un tono más claro (`#333d4c`), con el símbolo centrado como marca de agua al 4 %, y encima la
   portada interior: lockup, subtítulo, **el porqué** (cuatro líneas; lo escribe Eneko por libro o
   sale de una nota de Naeth), autor y versión. La anteportada: símbolo, «CodeDoc Archive», la firma
   del lector y la fecha de la primera lectura a mano (Caveat), y abajo los **créditos**: personas
   (de git y de las notas `personal/people` enlazadas; Claude como agente con el campo `author`),
   licencia, esta edición (versión, fecha y commit de generación, cifras). Ninguna de las dos
   lleva número, pero la anteportada cuenta en el taco.
2. **Tu ficha | Índice, página 1.** La ficha (vuelta de la anteportada): lockup, LEÍDO con la cifra y
   **la posición como scrubber** (llena hasta donde vas, rayas y números de capítulo debajo, el 0 es
   el prólogo, el marcapáginas encima sin número: «parecía un slider»), importantes (4 y «y 2 más») y
   anotadas como listas alineadas. El índice a la derecha: «ÍNDICE», buscador que filtra, chips de
   importantes, anotadas, leídas y sin leer, y los capítulos con el **prólogo como 0** (README.md).
3. **Índice, página 2 | Prólogo, página 3.**

- **Numeración**: números normales; el índice empieza en la 1; prólogo 3 a 5; cada capítulo suma su
  portadilla. Naeth: 155 bloques + 3 de prólogo + 24 portadillas = **182 páginas**, el marcapáginas
  en la 13. Las cifras cambian con cada regla nueva: el mock las recalcula, no se escriben a mano.
- **Sin datos repetidos** (análisis del 18/09 a las 18:33): cada dato en una sola cara; fuera las dos
  firmas, el resumen y los chips de la ficha, las cifras de la cabecera del índice y «última
  actividad». Se queda el nombre de Eneko tres veces porque son tres papeles (autor, lector, autor
  con commits).
- **Escala**: cada cara tiene fuente (git, README, LICENSE, Naeth, estado de lectura); solo el porqué
  y la dedicatoria son campos opcionales por libro. Es el contrato para el punto 9.
- ⚠ Trampa del `.pen`: **mover nodos entre hojas raíz los pierde** (créditos e índice 2 el 18/09);
  se reconstruyen o se copian, no se mueven. Y el índice de `Insert` no es fiable: `Move` después.
- Pendiente del punto 3: la página 1 del índice pulida, el índice al volver desde una página, y la
  guarda trasera y la contraportada (caras de atrás).
- **El índice, decidido (19:35)**: «como en un libro», no como un árbol (Eneko: parecía un explorador,
  demasiadas cosas, no se leía como índice, faltaba el porqué de cada capítulo). **Partes por carpeta
  de primer nivel** (I · El backend `app/`, II · El visor `web/src/`, III · Operación `ops/`) con sus
  cifras; **título humano** por capítulo (la primera línea de la cabecera del fichero; si no la hay,
  queda la ruta y se nota) con la ruta en pequeño, **resumen de una línea** debajo, línea de guía y
  número de página a la derecha; «leído» / «9 de 41» / «24 pp.» antes de la página. **Sin iconos**:
  los estados van por color y peso del texto (sin leer gris, leída tinta, importante ámbar, anotada
  con un filo azul, donde vas en negrita con el número azul y «seguir por aquí»), el marcapáginas es
  un filo azul en el margen del capítulo, las marcas del capítulo son texto («2 importantes ·
  2 anotadas»), y la leyenda al pie de la página 1. Solo el capítulo en curso enseña sus páginas
  (11 y «las 30 restantes»). **Buscador y filtros fuera del índice**, en la cabecera corrida; al
  usarlos el índice se reduce a lo que casa («filtrar: importantes» en ámbar, «buscar: search» en
  azul con el trozo en negrita). Tres densidades dibujadas (D1 título y página, D2 + leído, D3 +
  resumen): D3. Hojas `eNcE4` (p. 1), `Z9Ejo` (p. 2), `s2VaL`, `u75Gd`, `eKEZs` (la forma sola).

## Anexo K · La portadilla de capítulo (punto 3b), decidida (18/09/2026, 20:20)

Hoja 12 del `.pen` (`EUJ5k`), export `Pt3b-portadilla-capitulo.png`. Una doble página por capítulo,
como toda página del libro; cuenta en la numeración (mcp_server.py es la 6).

- **Izquierda, la apertura**: insignia con la extensión y filo de 6 px en el margen, en el **color
  del lenguaje** (los de GitHub: Python `#3572a5`, TypeScript `#3178c6`, Svelte `#ff3e00`, PowerShell
  `#5391fe`); «CAPÍTULO 1 · PARTE I, EL BACKEND» a 14 px en ese color; el título humano grande, la
  ruta con las cifras del fichero (líneas, bloques, vigente, commit, fecha); la frase del capítulo; la
  **cabecera del fichero renderizada** entera (los `⚠` en ámbar) con «ver en crudo»; el **esquema**
  del capítulo dibujado (el fichero en el centro en su color, IMPORTA a la izquierda, LO USAN a la
  derecha, con curvas; sale de `code_edge`); y al pie tu lectura del capítulo con «seguir por
  memory_search, página 21 →» como texto azul (Eneko no quiso botón), o «empezar por…» si no lo has
  abierto. Cuando haya logos por proyecto, la insignia puede llevar el símbolo del repo; el color por
  lenguaje se queda.
- **Derecha, «Antes de leer»**, lo que no está en el índice ni en la ficha: **LO QUE MUERDE** (los
  `⚠` de todos sus docstrings, cada uno con su página), **LO QUE NAETH SABE DE ÉL** (las notas
  enlazadas a sus bloques, con tipo, path y fecha) y **TUS ANOTACIONES AQUÍ**. Rótulos en su color
  (ámbar, morado, azul) y los títulos de cada entrada en el mismo tono apagado (`#c4a06a`, `#a89bc4`,
  `#82a9cc`). La lista «Sus páginas» se quitó: ya está en el índice.
- Con el orden real de las 41 funciones, `memory_search` es la página 21; las hojas del índice usan
  una lista corta (13). Es mock: con datos reales cuadra solo.
- Siguiente: punto 4, la portada, y con ella las caras de atrás.

## Anexo L · La portada, la contraportada y las caras de atrás (punto 4), decididas (18/09/2026, 20:45)

Hojas 13 del `.pen` (`yALKf` formas y telas, `jOr8K` portada, `TeQCg` contraportada, `JUIEX`
colofón y guarda trasera), exports `Pt4-*`.

- **La vista de portada**: el libro cerrado **de frente (P1)**, grande, con el taco asomando a la
  derecha y abajo y sombra sobre la mesa; se dibujó también en tres cuartos (P2, con lomo y canto) y
  Eneko eligió P1 («me encanta, está perfecto»). **La tapa solo lleva el lockup**. El canto teñido
  del punto 6 se quitó de esta vista: no se entendía, y la solapa ya da la cifra.
- **La tela**: para Naeth, **T1**, la misma foto de Unsplash con el tinte azul al 70 % que lleva el
  libro en la pila. Para libros sin tela propia, **generar la tela es viable**: T2 lino liso del
  color de familia, T3 trama fina con planos, T4 cuero con degradado de luz; las tres con CSS.
- **La solapa** (interfaz, no impresa, a la derecha del libro): nombre, subtítulo, cifras, el botón
  **abrir el libro** (al índice pasando por las caras de apertura), seguir por donde ibas (con la
  página), anteportada y créditos (hojear despacio desde la guarda), dar la vuelta, volver a la
  pila; al pie, última y primera lectura.
- **La contraportada** (impresa en la tela, al dar la vuelta): el símbolo, el resumen largo (dos
  párrafos: el porqué y qué contiene), la URL del repo, la licencia en una línea, un **QR** que lleva
  a la web del proyecto o al repo si no tiene web (decisión de Eneko; sustituye al código de barras
  del commit), y «versión · commit · fecha». **Abrir desde la contraportada abre el libro por
  atrás** (colofón y guarda trasera) y se hojea hacia delante.
- **La última doble página**: el **colofón** (página 182, centrado y en pequeño: cuándo y desde qué
  commit se generó, con qué se compuso: Inter, JetBrains Mono, Shiki con GitHub Default, griffe,
  bge-m3; las cifras y las páginas leídas) y la **guarda trasera** (papel del color de la tela con
  la marca de agua, sin número; «Has llegado al final del libro», cuántas quedan sin leer y la
  primera, y seguir por donde ibas / volver al índice / cerrar y volver a la pila). El taco ahí está
  todo a la izquierda.
- Con esto el libro tiene todas sus caras: tapa, guarda, anteportada, portada, créditos, ficha,
  índice, prólogo, portadillas, páginas, colofón, guarda trasera, contraportada. Cada una con fuente.
- Siguiente: las transiciones (5 a 7).
- Regla que salió al dibujar la última página (20:45): el taco escalona también hacia abajo, así
  que **el alto de la página es `viewport − 3 − (T + 10)`** y el ancho `(ancho del libro − 2·(T + 8)
  − 2) / 2`, donde `T` es el taco total; en la primera y en la última página todo el taco cae a un
  lado y la tapa de ese lado mide `T + 8` y la del otro 8.
