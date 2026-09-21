# Brief para Tania · el libro y la biblioteca de CodeDoc Archive

**20/09/2026.** Primer encargo real. Lo escribe Claude Code con Eneko; lo decide Eneko. Fuente de
todo lo que se cita: `docs/discovery/cda-vista-diseno-2026-09-15.md` (anexos D a O) y
`docs/discovery/animacion-en-codigo-2026-09-19.md`. Las imágenes de referencia están en
`docs/design/exports/` y en la página publicada para Tania (enlace en el informe de Claude).

> **Aviso del 21/09/2026.** La biblioteca puede pasar a tener **etapas** (de una caja de mudanza a
> una estantería por módulos) y una primera vez en la que los libros llegan **en cajas** y el mueble
> se monta. Está por ver (`docs/discovery/cda-biblioteca-espacio-2026-09-21.md`, familia 1) y Eneko
> te lo contará él. **No cambies nada de lo que sigue todavía**: la cámara (encargo 1), el animatic
> (3) y las texturas (4) valen igual; solo las composiciones del encargo 2 podrían crecer.
>
> **Segundo aviso, 21/09 a las 21:50.** Dos cosas más, decididas con Eneko: (1) **tu modelo sí se
> exporta a la web** (la biblioteca será una habitación 3D en el navegador; lo del 20/09 sobre «no se
> exporta nunca» queda anulado), y (2) **Blender en vez de 3ds Max, para todo**: tu licencia de Max es
> educativa y Autodesk prohíbe usarla para nada comercial, incluidos renders de referencia; Naeth va a
> ser producto. Se acepta que vaya un poco más lento. La versión vigente de este brief, reescrita con
> todo esto y legible sin conocer el código, está en la carpeta de Drive «CDA · Tania», junto con el
> pipeline de Blender a glTF y el diario de decisiones. Este fichero queda como registro del 20/09.

---

## 1 · Qué es esto, en cinco líneas

CodeDoc Archive (CDA) es una vista del visor de Naeth donde **el código de un proyecto se lee como un
libro**: cada repositorio es un libro, cada carpeta un capítulo, cada función una página. En la
biblioteca se ven los libros; al pulsar uno, sale, se pone de frente y se abre por el índice. Todo
esto se dibuja **con CSS en el navegador** (una caja de seis caras con `transform-style: preserve-3d`),
no con un motor 3D. Por eso lo que necesitamos de ti no es un modelo para un videojuego: es
**referencia** de cómo se ve y cómo se mueve un libro, y **piel** (texturas) para esa caja. **Tu
modelo no se exporta a la web nunca**: tus renders son fotos que miramos, y tus texturas son las
imágenes planas que van en cada cara de la caja CSS (ver la respuesta 4 al final).

La pantalla donde se ve: 2560×1440 (principal) y 1920×1080. Fondo oscuro. El código es el
protagonista; la biblioteca es la entrada, no el sitio donde se trabaja.

## 2 · El libro, con números

Las proporciones vienen del diseño ya decidido (anexos E y L):

| Cosa | Valor en pantalla | Equivalente físico (para modelar a escala real) |
|---|---|---|
| Portada (ancho × alto) | 560 × 760 px | 15 × 20,4 cm (formato de libro de tapa dura, casi A5 alto) |
| Grosor del taco | `6 + 0,25 × páginas` px, tope 80 | Naeth tiene 182 páginas → 52 px → 1,4 cm. CENIT es el más grueso |
| Tapa | tela, sobresale 8 px por los lados y 10 por abajo del taco, 3 por arriba | tapa dura con ceja de 2 mm |
| Lomo | del color de la tela pero un tono más oscuro, con el nombre en vertical | lomo recto (no redondeado) |
| Canto de las hojas | papel claro con las hojas visibles como líneas finas | sin tintar |

Colores del modo oscuro (los hex son los que usa el visor):

| Pieza | Hex | Nota |
|---|---|---|
| Tela de la tapa (Naeth) | `#2b3340` | azul grisáceo, tela con trama visible («T1», ver referencia) |
| Lomo | `#1c2e45` | |
| Guardas (interior de la tapa) | `#333d4c` | tela un tono más claro, no papel |
| Papel de las hojas | `#d9d2c0`, hoja vieja `#b3ad9d` | |
| Fondo de la escena | `#1c1d1f`, alrededor `#121315` | la estantería sale de ese fondo |
| Texto / detalles | `#e6e8eb`; acento `#5db0ff` | |

En la tapa va **solo el lockup de Naeth** (`docs/img/naeth-lockup-dark.svg`), centrado; ni
subtítulo ni autor. Cada libro es un proyecto: **Naeth** (182 páginas), **CENIT** (el más grueso),
**GridWatch**, **Yogin API**, **Yogin Website** (estos dos con el mismo lomo, son dos libros de la
misma familia). Cada uno con su tela: T1 es la de Naeth; **T2, T3 y T4 sirven para los otros
libros** (referencia en `Pt4-portada-P1-P2-telas.png`).

## 3 · Los cuatro encargos

Van en el orden en que nos sirven. Cada uno dice qué entregas, con qué restricción, y cómo sabremos
que está bien. Si algo del brief choca con lo que sabes de libros, de cámaras o de luz, **tu criterio
manda y nos lo dices**: para eso te lo pedimos.

### 3.1 Cámara y luz (una ficha de un folio)

**Qué es.** Desde dónde se mira la biblioteca y de dónde viene la luz. En el navegador la cámara es
un solo número (`perspective`) y un punto (`perspective-origin`), y en el prototipo anterior salió
mal: usamos una focal larguísima y el libro parecía un recorte plano.

**Qué entregas.** Un folio (texto, el formato da igual) con:
- Focal en mm (equivalente a sensor de 36 mm), altura de la cámara respecto a las baldas, distancia a la estantería,
  inclinación. Una para la biblioteca entera y otra para el libro de frente (abierto ocupa la pantalla; de frente, la portada ocupa un tercio a la izquierda).
- Luz principal: dirección (acimut y elevación) e intensidad relativa; luz de relleno; ambiente.
  La escena es oscura: la luz tiene que dibujar el volumen del libro sin encender el fondo.
- Un render fijo por cada configuración para que veamos lo que tú ves.

**Cómo lo usamos.** La focal se traduce a píxeles con `perspective = ancho_de_pantalla × focal / 36`
(a 2560 px de ancho, una focal de 35 mm da 2489 px; una de 50 mm, 3556; los 5200 px que teníamos
equivalen a un 73 mm, un teleobjetivo corto, y por eso aplanaba).
La luz se convierte en una capa de claro y otra de sombra por cara cuya opacidad cambia con el ángulo.

**Está bien cuando** un libro girado a tres cuartos se reconoce como libro, y la focal no deforma
la portada de frente.

### 3.2 El concepto de la biblioteca: la estantería (dos o tres composiciones)

**Qué es.** Hasta ahora la biblioteca era una pila de libros tumbados (referencia `B-II-pila-v2`).
Decidido el 20/09 (Eneko y Tania): **no hay mesa**. Al entrar se ve **una estantería con los
libros**, y los libros están **como los ha dejado el usuario**: de pie, inclinados contra el vecino,
tumbados sobre la balda o sobre otros (como en el boceto de Eneko). La posición es el estado de
lectura: no hay iconos ni etiquetas que lo digan. Los libros se identifican por el lomo. Hoy son
cinco; llegarán a veinte o treinta.

**Qué entregas.** Dos o tres composiciones distintas de la estantería, cada una como render fijo a
2560×1440 (y una vista a 1920×1080 de la que prefieras), más tres o cuatro líneas de por qué esa.
Valen volúmenes simples: **no hace falta modelar cada libro**, hace falta la composición: cuántas
baldas, qué proporción, cuánto ocupa en pantalla, por dónde entra la luz, y **cómo se ven los tres
estados de reposo** (de pie, inclinado, tumbado) unos junto a otros. Un cuarto render con la misma
escena y veinte libros, para ver cómo escala.

**Restricciones.** Fondo oscuro. La estantería no puede ocupar la pantalla entera: al pulsar un
libro tiene que quedar sitio para que salga y se abra de frente. Los lomos tienen que leerse a
1080p. Nada que no sea libro o estantería (ni plantas ni lámparas; una fuente de luz puede estar
fuera de plano).

**Está bien cuando** Eneko elige una de las composiciones. Esa es la que se lleva a Pencil.

### 3.3 El animatic de referencia (vídeo)

**Qué es.** Cómo se coge un libro de una estantería y se abre, y cómo se cierra y se deja donde uno
quiere. Lo hemos escrito con números de manuales de diseño y no convence: parece una máquina.
Queremos verlo hecho por alguien que anima.

**Qué entregas.** Un vídeo MP4 a 60 fps, **a cámara lenta (10 veces más lento de lo real)**, con
estas secuencias, y una tabla con el fotograma en que empieza y acaba cada fase:

1. **Coger y abrir**: el libro está de pie entre otros; se inclina hacia fuera por arriba, sale, gira
   hasta dar la tapa, se acerca a la cámara hasta ocupar la parte izquierda de la pantalla, y **se
   abre** hasta quedar de plano con las dos páginas (referencia `Pt2-B1-oscuro-reposo`). Es una sola
   secuencia: pulsar un libro lo saca y lo abre.
2. **Cerrar y dejar**: el libro abierto se cierra, vuelve a la mano (a un tamaño intermedio, delante
   de la estantería) y **se deja** en un sitio de la balda que elige el usuario. Tres finales:
   de pie en un hueco, inclinado contra el vecino, tumbado sobre otros. Los vecinos hacen sitio.
3. Lo mismo empezando desde un libro que estaba **tumbado** sobre otros (variante corta).

**Lo que nos importa** (y lo que tú sabes hacer mejor que nosotros): la anticipación antes de
moverse, el arco del trayecto, cómo se solapan las fases (la siguiente empieza antes de que acabe
la anterior), el remate al llegar, y qué hacen los libros de al lado cuando uno sale o llega (el
hueco, los vecinos que se apartan o se apoyan). En tiempo real coger y abrir dura en torno a **1,2
segundos** y cerrar y dejar algo menos; a cámara lenta, unos 12 s.

**Restricciones.** El libro es UN objeto rígido salvo al abrirse (la tapa gira sobre el lomo; las
páginas no se mueven una a una); nada de partículas, motion blur ni efectos: solo el objeto, la luz
y la cámara de 3.1. Cámara fija. Los «vecinos que hacen sitio» se mueven, no se deforman.

**Está bien cuando** Eneko dice «así». De tu vídeo sacamos los tiempos y las curvas de cada fase y
los metemos en el código.

### 3.4 Texturas y materiales (imágenes PNG)

**Qué es.** La piel de la caja CSS. Cada cara del libro es un rectángulo plano al que le ponemos una
imagen.

**Qué entregas.** PNG a 2048 px de lado mayor, **planas, sin luz cocida** (la luz la pone el
navegador según el ángulo). Y, solo como referencia, una versión con luz de cada una:
- La tela de la tapa, **repetible** (tileable), en las cuatro variantes T1 a T4 (T1 es `#2b3340`
  con trama; T2 a T4 en los colores que veas para los otros libros).
- El lomo (misma tela, un tono más oscuro) con espacio para el nombre en vertical.
- El canto de las hojas, con las hojas como líneas finas, en tres grosores (fino, medio, grueso).
- La cabeza y el pie del taco (lo mismo, visto desde arriba y abajo).
- Opcional: la guarda (`#333d4c`, tela) y el relieve del lockup en la tapa (el lockup en sí lo
  ponemos nosotros como SVG).

**Lo que no hace falta:** normal maps, roughness, ni ningún mapa que un navegador no pueda usar.
Solo color.

**Está bien cuando** puestas sobre la caja CSS (te enseñamos la caja en el navegador) el libro pasa
de «caja de color» a «libro».

## 4 · Herramienta, ficheros y dónde va cada cosa

Trabajas en **3ds Max**: perfecto. Lo que pedimos no depende de la herramienta. Entregas:

```
docs/design/tania/
  ficha-camara-luz.md            (o .txt, o .pdf)
  biblioteca/                    renders de las composiciones, 2560×1440
  animatic/                      MP4 60 fps + tabla de fotogramas (txt o csv)
  texturas/                      PNG 2048, planas; carpeta ref/ con las versiones con luz
  fuente/                        el .max, y un FBX u OBJ del libro y de la escena
```

Si es más cómodo, todo en una carpeta compartida y lo movemos nosotros al repo.

## 5 · Orden, tiempo y cómo trabajamos

Orden sugerido, porque cada uno desbloquea al siguiente: **3.1 cámara y luz** (corto, y todo lo
demás se hace con esa cámara) → **3.2 la biblioteca** (Eneko elige antes de que animes nada) →
**3.3 el animatic** → **3.4 las texturas**.

No ponemos plazo: **dinos tú cuánto te lleva cada uno** antes de empezar, y apuntamos al lado
cuánto llevó de verdad. Es como trabajamos aquí con todo.

Preguntas, cuando quieras, a Eneko. Si un punto del brief no se entiende, es culpa del brief, no
tuya: se reescribe.

## 6 · Lo que NO es este encargo

Nada de código ni de CSS. Ningún modelo para un motor 3D en la web (no hay WebGL en esto). Ninguna
pantalla del visor: el índice, las páginas y los textos ya están diseñados. El libro por dentro
(guardas, portada interior, índice) tampoco: está decidido y es texto.

---

Referencias adjuntas (en `docs/design/exports/`): `B-II-pila-v2.png` (la biblioteca actual),
`G-estanteria-lomos.png` (una idea vieja de estantería, descartada entonces), `L-libro-v8.png` (el
libro decidido), `Pt4-portada.png` y `Pt4-portada-P1-P2-telas.png` (la portada y las telas T1 a T4),
`Pt2-B1-oscuro-reposo.png` (el libro abierto), `Pt3b-portadilla-capitulo.png` (una página por
dentro, para que veas el tono), `Pt5-sacar-el-libro.png` (nuestro storyboard de sacar el libro, el
que no convence).

---

## 7 · Respuestas a tus dudas del 20/09

**1 · Motor de render y luces.** Da igual el motor: nada de lo que renderices se exporta. De la luz
nos llevamos tres números: de dónde viene la principal (acimut y elevación), cuánto relleno hay
respecto a ella, y cómo de dura es. Con eso hacemos la «luz falsa» del navegador (cada cara se
aclara u oscurece según su ángulo con esa dirección). Usa el motor con el que estés cómoda; Arnold
da una caída de luz física que sirve más como referencia de sombreado, Scanline vale de sobra
para cámara y composición. Lo que más nos ayudaría: **el libro renderizado desde ocho ángulos con
la misma luz** (una vuelta de 45° en 45°).

**2 · La pila en la mesa.** Tenías razón, y la decisión 3 lo ha resuelto de raíz: ya no hay mesa.
Lo que queda de tu observación vale igual para la estantería: un libro tumbado sobre otros se saca
distinto que uno de pie, y los vecinos tienen que reaccionar. Por eso el animatic pide los tres
estados de reposo y la variante «desde tumbado».

**3 · Avatar, silla y mesa.** Resuelto el 20/09 entre Eneko y tú, y la razón es mejor que la del
avatar: lo que Eneko quiere ver al entrar es **solo la estantería**, y lo que hace que sea suya es que
**cada libro está donde y como él lo dejó**. Al cerrar un libro, el usuario lo deja con la mano (de
pie, inclinado, tumbado sobre otros) y así sabe cuál está leyendo y ordena como quiera. Sin mesa,
sin silla, sin avatar: el que está delante de la estantería es el usuario. Eso cambia los encargos 2
y 3 (reescritos arriba) y te quita trabajo: ni mesa ni personaje. Sobre las «físicas»: en el
navegador son ligeras (arrastrar con peso al soltar, tres estados de reposo, los vecinos se apartan),
no un motor con colisiones; por eso en el animatic los libros no se deforman y los vecinos se mueven
como bloques.

**4 · Las texturas.** El malentendido es del brief. **No vamos a usar tu modelo en la web**, ni con
texturas ni sin ellas. El libro en el navegador son seis rectángulos planos (tapa, contratapa,
lomo, canto, cabeza, pie) colocados en 3D, y a cada rectángulo se le pone una imagen plana de
fondo. Lo que necesitamos son esas seis imágenes: como si desplegaras la caja del libro sobre la
mesa. Si pintas el material en Max, renderiza o «bake» cada cara a una imagen con luz plana, o
pásanos los bitmaps que has usado. Y más simple: con **la tela repetible y el canto de hojas
repetible** componemos las seis caras nosotros. En `docs/design/tania/plantillas/` hay **seis PNG
vacíos con el tamaño exacto de cada cara** (tapa 1120×1520, lomo 104×1520, canto 104×1494, cabeza
y pie 1088×104, contratapa 1120×1520) para pintar encima, y un README que explica de dónde salen
los números.
