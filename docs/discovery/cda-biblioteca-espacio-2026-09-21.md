# Discovery: la biblioteca de CDA como espacio que envejece contigo

Fecha: 21/09/2026, 19:00, en curso. Sale de la tarde del 21/09 en el chat «diseño CDA en Pencil»:
la transición 7 quedó cerrada por la mañana (anexo Q de `cda-vista-diseno-2026-09-15.md`), la 6 pasó
de reglas a un motor de físicas (lab `docs/lab/animacion/web/11-estanteria-con-fisicas.html`,
Eneko: «esto sí se siente como físicas»), y a las 18:38 Eneko propuso convertir la biblioteca en algo
parecido a un juego: «ir desbloqueando mejores estanterías dependiendo de la cantidad de libros que
voy leyendo». A las 18:50 añadió el contexto que faltaba (ver «Lo que este documento no decide»).

**Alcance (ampliado a las 20:00, ver Parte II).** La biblioteca de CDA (la estantería del anexo P, los libros que hoy son repos) como un
espacio que muestra lo que has hecho en vez de contártelo. Cinco familias de mecánicas, las cinco
aceptadas por Eneko el 21/09 a las 19:00 «pero hay que refinar cada una una a una». Fuera:
puntos, insignias, rachas, niveles, y cualquier cifra visible de «leídos» fuera de la solapa y de la
ficha. Fuera también, por decisión del 21/09: aplicar esto a Naeth (ver el final).

**Criterio de éxito.** Cada mecánica que se quede (1) pasa la prueba de la estantería real («¿lo
haría una estantería de verdad?»: se llena, se desgasta, se desordena, se reorganiza; no da
estrellas), (2) tiene ya su fuente de datos (estado de lectura, anotaciones, marcadores, fechas de
lectura, git), sin inventar contadores nuevos, (3) no rompe con un libro de dos páginas ni con uno de
doscientas, ni con uno que crece solo (grano de sal de Naeth), y (4) queda dibujada en el `.pen`
o descartada con motivo.

**Base de la estimación.** La discovery de la vista (anexos A a Q) fue una tarde por pieza; esto son
cinco piezas pequeñas, una tarde en total para el documento y otra para las hojas del `.pen`. Lo real
se apunta al lado.

## La regla que gobierna todo: mostrar, no contar

La decisión del 20/09 (anexo P) ya lo era: «la posición del libro es el estado de lectura, sin
iconos». Un libro de pie, inclinado o tumbado dice cómo lo dejaste; nadie te lo escribe. Este
documento es esa regla extendida a la habitación entera: **el mundo enseña lo que has hecho; no hay
un marcador que te lo cuente**. Es lo que hacen Unpacking, A Little to the Left y Animal Crossing
(la hierba se desgasta por donde caminas) y lo que no hacen Duolingo y las rachas. La trampa tiene
nombre, gamificación extrínseca, y se descarta por escrito: en una herramienta de trabajo se siente
como un jefe mirando, y en cuanto hay una métrica de «leídos» se pasan páginas para subirla.

## Familia 1 · La biblioteca crece, no se desbloquea

**La idea.** El primer día no hay estantería: hay un libro en el suelo, o sobre una caja de mudanza
(guiño a Unpacking). Al segundo, un tablón sobre dos ladrillos. Al quinto, un mueble pequeño. Al
vigésimo, una estantería de pared. Al cincuenta, dos módulos. No son niveles: son **los muebles que
necesitas**, y aparecen cuando los libros ya no caben. Con las físicas del lab 11, «no caben» es
literal: el que sobra se cae.

**Prueba de la estantería real.** Pasa: nadie compra una librería de tres metros para dos libros;
la compras cuando la pila del suelo molesta.

**Fuente de datos.** El número de libros (repos generados) y su grosor (`T = 6 + 0,25·N`).

**Grano de sal de Naeth.** Si un día los libros son proyectos de memoria, crecen solos con cada
checkpoint: la estantería tiene que poder crecer sin que el usuario haga nada y sin que se recoloque
lo que él dejó como lo dejó.

**Ronda 1 (21/09, 19:05).** Eneko: el primer estado es **un libro sobre una caja de mudanza**; el
mueble nuevo «vamos a tirar mucho de Unpacking: a lo mejor llegamos al punto de que tienes que
montar tú la estantería, hay que verlo»; al borrar un repo **al libro no se le hace nada a no ser que
yo lo tire a la papelera** (el libro es tuyo, no del repo; la papelera es un gesto); las etapas y quién
las dibuja «lo tengo que hablar con Tania porque esto creo que va a crecer».

Y su pregunta de vuelta: «si voy a mapear todos mis repos, ¿cuál es el primer libro?». La respuesta
que sale de sus otras tres contestaciones, y que se propone como hipótesis para verla: **el primer
libro es el primero que sacas de la caja**. Si el día uno generas quince repos, no aparecen quince
libros en una balda: aparecen **quince libros en cajas** (o una caja con quince), y desembalar es
la primera vez que usas la biblioteca. La estantería llega también embalada y la montas tú donde
quieras; lo que no desembales se queda en su caja, en el suelo, y sigue siendo tuyo. Es Unpacking
literal, y resuelve tres cosas a la vez: el estado inicial (una habitación con cajas), quién pone el
mueble (tú), y qué es «llegar» a la biblioteca por primera vez (un ritual de veinte minutos que
además te enseña a coger, llevar y dejar sin tutorial). Coste: el encargo 2 de Tania cambia de
«composiciones con libros» a «la habitación con cajas, y las etapas del mueble», y hay que hablarlo
con ella antes de cerrar nada. ⚠ Hipótesis, no decisión: «hay que verlo», y verlo aquí significa un
lab o unas hojas del `.pen`, no más preguntas.

## Familia 2 · Los desbloqueos que sí valen son herramientas

**La idea.** Con 3 libros no necesitas buscador; con 30, sí, y ese día aparece **el fichero de
cartulinas** (el catálogo) encima del mueble. Con 10 libros aparece **la mesa de lectura** (varios
abiertos a la vez). Con 50, **la escalera** (baldas altas; lo que no tocas en meses sube solo). Es
progressive disclosure con forma de mobiliario: la interfaz se complica al ritmo de la colección, y
cada pieza tiene forma de objeto, no de menú.

**Prueba.** Pasa: el catálogo de una biblioteca existe porque hay demasiados libros para verlos.

**Fuente de datos.** El número de libros; cuántos están abiertos a la vez; la fecha de última lectura
por libro.

**Grano de sal.** El buscador y los filtros de la cabecera corrida (anexo J) ya existen para el
índice de un libro; el catálogo es su versión de biblioteca. No duplicar: el mismo buscador, otra
forma.

**Para refinar (ronda 2):** qué herramientas hay, cuál es la señal de cada una, y qué pasa con la
que aparece y no se usa.

## Familia 3 · El desgaste como memoria

**La idea.** Un libro que abres mucho tiene la tela gastada donde lo coges y el lomo agrietado por
la página por la que siempre entras. El que no tocas en tres meses **cría polvo** (una capa que se va
al cogerlo). El que tienes a medias lleva **la cinta colgando** por el canto (el marcapáginas, que
en el anexo H quedó sin forma decidida: aquí tiene una). Tus anotaciones asoman como **papelitos**
por el corte delantero, de color por tipo (importante ámbar, anotada azul, como en el índice). De un
vistazo a la estantería sabes qué estás leyendo, qué abandonaste y qué trabajaste.

**Prueba.** Pasa entera: es lo único de la lista que una estantería real hace sin que nadie lo
programe.

**Fuente de datos.** Aperturas por libro y por página (hay que guardarlas: hoy el estado de lectura
guarda la página y lo leído, no la frecuencia; es el único dato nuevo de todo el documento y hay que
decidir si se guarda), fecha de última lectura, marcadores, anotaciones con su tipo.

**Grano de sal.** En Naeth el «desgaste» tendría otra lectura (una nota que se reescribe mucho): no
se diseña ahora, pero la tela gastada no debe significar solo «leído».

**Para refinar (ronda 3):** qué señales entran (polvo, tela, cinta, papelitos, lomo agrietado) y
cuáles molestan; si el desgaste se ve desde lejos o solo al coger; y si se guarda la frecuencia de
apertura.

## Familia 4 · Rituales, no recompensas

**La idea.** Al terminar un libro entero, el colofón ya existe (anexo L). Se añade **la ficha de
préstamo** pegada en la guarda, como en las bibliotecas de antes: un sello con la fecha de cada
lectura completa. Es el «logro», pero está dentro del libro, lo ves tú solo y es un objeto bonito.
Para NewCo, **prestar libros**: un libro de otro repo o de un compañero en tu estantería con la
papeleta de préstamo asomando; en su biblioteca queda el hueco con «prestado a Eneko».

**Prueba.** Pasa: los sellos de préstamo y las papeletas existen.

**Fuente de datos.** Fechas de primera y última lectura (ya en la solapa, anexo L); lecturas
completas (hay que guardarlas si se quieren varias). Prestar depende de multiusuario, que no existe.

**Para refinar (ronda 4):** la ficha de préstamo sí o no; qué cuenta como «lectura completa»; y si
«prestar» se dibuja ahora o se apunta.

## Familia 5 · El tiempo y el lugar

**La idea.** La luz de la habitación sigue la hora real: por la tarde entra de lado, de noche es la
lámpara de la mesa. Cero función, y es lo que hace que un sitio sea un sitio. Y lo arriesgado, con
aviso de cursilería: **algo vivo**. El juego de mesa Bookshelf tiene un gato que duerme en la balda
más alta; un gato que se tumba sobre los libros que no lees es gracioso una vez y kitsch a la
tercera. Se lista para tacharlo a conciencia, no por olvido.

**Prueba.** La luz pasa. El gato no es una estantería: es un adorno; se decide por gusto y se dice.

**Fuente de datos.** El reloj del sistema. Nada más.

**Para refinar (ronda 5):** la luz sí o no (y si respeta el modo claro y oscuro del anexo H, donde
la mesa siempre es oscura); el gato.

## Lo que este documento no decide (21/09/2026, 18:50 a 19:00)

Eneko reveló a las 18:50 que **Naeth acabará siendo también una biblioteca**, y que CDA es, «de
manera encubierta», la fase de rediseño del visor: lo que hay hoy en `naeth/web` es «una copia
propia de Obsidian» (lista, markdown, grafo de fuerza, editor). CDA usa el código como piloto
porque un repo tiene estructura fija; el contenido de verdad serán las memorias. **Decisión del
mismo momento: se termina CDA, se prueba que funciona, y entonces se aplica a Naeth.** «Pensar todo
de una sentada no es viable.» Queda escrito para que la sesión que lo aborde arranque de aquí:

| Pregunta | Lo que dijo Eneko el 21/09 (con grano de sal) |
|---|---|
| ¿Qué es un libro cuando el contenido son memorias? | «Por proyecto puede estar bien. Pero esto hay que verlo de todos los ángulos»: las relaciones y muchas cosas hay que adaptarlas para que tenga sentido y no rompa nada. |
| ¿Código y memoria del mismo proyecto? | Con calma, a su momento. (La regla «Yogin, dos libros con el mismo lomo» es el precedente de volúmenes.) |
| ¿Lista, grafo de fuerza y editor Crepe? | «La biblioteca lo sustituye, pero no destruyendo lo que ya hay.» |
| ¿Producto o para ti? | «Tiro más por que esto ya es el producto, o una fase antes del producto.» Nada de early access: se lanza probado y testeado. |

Consecuencias que sí valen desde hoy, aunque no se diseñen: los libros tendrán grosores muy
distintos de verdad (`inkerlum` frente a `fiscal`), crecerán solos, y tendrán versiones, autoría
(agente o humano), tipo y relaciones, que es lo que Obsidian no tiene. Lo que se decida para la
estantería no puede asumir que los libros son solo repos. Y **el encargo a Tania puede crecer**
(composiciones con libros de grosores distintos y con la biblioteca en varias etapas): se le dice
cuando esté decidida la familia 1, no antes.

---

# Parte II · La habitación en 3D (21/09/2026, 20:00 a 20:15, dos rondas de preguntas)

A las 20:00, tras jugar el lab 12, Eneko subió la apuesta: «yo esto ya lo veo más como que hay una
habitación, vacía, y solo hay unas cajas con libros; te acercas a la caja, la abres y escoges por
qué libro empezar; cuando te lees el primero desbloqueas una mesa en la que sentarte a leer o
escribir; siempre puedes leer desde donde quieras, sentado, de pie, tumbado; cuando te hayas leído
dos o tres, puedes pedir muebles armados y colocarlos, o piezas y montar el mueble a tu gusto».
Y la pregunta: «dime si se me está yendo la olla o es buena idea para añadirme experiencia y
porfolio; si hay que usar Unreal o algún motor, se usa; si podemos hacerlo nosotros, lo hacemos».

Respuesta dada y aceptada: no se va la olla, se va el producto en una frase («moverte por el
entorno 3D»), y **Unreal no**: para web es pixel streaming (una GPU por usuario) o una exportación
experimental; la lectura es HTML y en un motor sería una textura (lo pagamos con el page curl). Si
hay habitación es **Three.js en la misma página**, con el DOM del lector delante, y las físicas con
**Rapier** (3D, wasm). Vale más como porfolio (un producto web en 3D que se abre desde un enlace) y
lo que Tania modele pasa a usarse de verdad como glTF. **Eneko: «mejor 3D en web».**

## II.1 Lo decidido en las dos rondas (20:04 y 20:10)

| Pregunta | Respuesta de Eneko | Consecuencia |
|---|---|---|
| Moverse | **La cámara va a sitios, y además se puede andar libre**; en móvil solo sitios. «Tengo que ver bien los pros y contras, creativos y técnicos» | Dos modos de cámara; el paseo es opcional y llega después (II.2) |
| Leer | **Según la postura**, tirando a salir a un lector HTML a pantalla completa «con una pequeña animación»; o seguir viendo el entorno con un botón de **modo concentración** que pone el HTML a pantalla completa; **tumbado** se ve el libro normal y el techo; **en móvil, el personaje no está en casa**: lo lee desde su propio móvil (el tuyo) | Tres posturas = tres modos ya diseñados: de pie es hojear delante de la balda (lectura rápida, sin anotar), sentado es la mesa (anexos H a L, el trabajo), tumbado es el móvil (anexo F). Modo concentración = el lector actual; «con entorno» = el lector en un marco con la habitación detrás, desenfocada |
| Orden | **Se salta la estantería CSS**: CDA v1 es el libro en HTML (ya diseñado) y la biblioteca directamente en 3D | La estantería de los anexos D, F y P no se construye en CSS; los labs 11 y 12 son el diseño de la mecánica, no la implementación; las físicas 2D pasan a Rapier |
| Cómo lo construye | **Aprende Three.js con ayuda, mixto**: «llevo mucho sin programar a mano; mi experiencia va a ser de lo que nos encontramos los dos» | La base (cámara, físicas, glTF, transición) la monta Claude explicándola; la escena, la luz y la colocación las toca Eneko; cada sesión deja algo que él ha escrito |
| Arte | **Primitivas ahora, Tania para producción después** (1 y 2) | El motor se construye con cajas grises; Tania entra cuando la mecánica esté probada, con un pipeline 3ds Max → glTF y presupuestos fijados (II.4) |
| Hardware | **Su PC a 144 Hz y un portátil con gráfica integrada a 60** | Presupuesto de polígonos, texturas y luces desde el día uno; se mide en los dos |
| La habitación v1 | «Hazme una lista y Tania y yo lo discutimos. Lo mismo con la estética» | II.4 y II.5 |
| Tiempo | «De momento no tengo límite» | La estimación se da en horas, no en semanas (II.6) |

## II.2 Andar libre: pros y contras, para decidirlo mirando

**Creativos, a favor**: presencia (la habitación es un sitio, no una escena); descubrir (mirar
detrás de la estantería, la ventana); el camino hasta el mueble hace que «desbloquear» se sienta
ganado; es lo que hace únicos a Unpacking y a los juegos de casa.
**Creativos, en contra**: el peaje del uso diario (la vez treinta que quieras mirar una función);
el mareo (cámara en primera persona a 60 Hz en portátil); «¿dónde dejé el libro?» obliga a tener
el catálogo desde el principio; y en móvil no existe, así que la experiencia se parte en dos.
**Técnicos, a favor**: Three.js lo da casi gratis (`PointerLockControls`, un colisionador de
cápsula contra la malla); el estado del mundo ya es 3D, no cambia nada.
**Técnicos, en contra**: colisiones y navegación (no atravesar la mesa, no salir por la ventana);
los atajos de teclado del paseo (WASD) chocan con los del lector; **todo el cuarto tiene que estar
acabado desde todos los ángulos** (con cámara a sitios, Tania pule lo que la cámara ve; con paseo,
pule todo: duplica su trabajo); el rendimiento se presupuesta para el peor punto de vista, no para
tres encuadres; y accesibilidad (`prefers-reduced-motion`: el paseo se sustituye por los sitios).
**Propuesta**: cámara a sitios como modo por defecto y único de la v1; «modo paseo» como interruptor
que llega en una versión posterior, cuando la habitación esté acabada por todos los lados. Se decide
mirando el piloto (II.6, F0), no ahora.

## II.3 Cómo se lee en cada postura (propuesta para dibujar)

- **De pie**, delante de la balda: pulsas un libro, sale y se abre en la mano (la transición 5,
  anexos O y Q, en 3D), y se **hojea**: índice, pasar página, buscar. Sin anotar, sin minimapa. Es
  la consulta rápida. Cerrar y dejar es la 6 (con Rapier, la mecánica del lab 11).
- **Sentado**, en la mesa: el libro va a la mesa, la cámara baja a la silla y aparece **el lector
  completo** (la doble página de los anexos H a L: anotaciones, minimapa, tira). Dos formas que
  Eneko quiere ver las dos: (a) el lector en un marco con la habitación detrás, desenfocada, y el
  botón de **modo concentración** que lo pone a pantalla completa; (b) salir directo a pantalla
  completa con una pequeña animación. Se dibujan las dos.
- **Tumbado**: el libro de frente y **el techo** detrás (la lámpara desde abajo). Es la lectura
  larga sin trabajar: sin tira, sin minimapa, letra más grande. En escritorio es un modo; en móvil
  es el único modo, y **el personaje no está en casa**: quien entra desde el móvil ve el libro en
  el móvil, y en la habitación (si alguien mira desde el PC) no hay nadie. Detalle que cuesta cero
  y cuenta la historia.
- **Modo concentración** en todas: oculta la habitación entera; es el lector HTML actual, así que
  no hay dos lectores.

## II.4 La lista para Tania y Eneko (qué hay en la habitación; ellos deciden qué entra en la v1)

Estructura: suelo, tres paredes y **techo** (se ve tumbado), una ventana (la luz de la familia 5),
una puerta (por donde «llegan» las cajas y los paquetes), un rodapié y un enchufe (los detalles que
hacen casa). Muebles: **cajas de mudanza** (cerrada, abierta, vacía y aplastada), **paquetes planos**
de mueble (tablón, mueble pequeño, módulo de estantería), **la estantería por módulos** (un módulo
que se repite, con sus dos costados y sus baldas), **la mesa** y **la silla**, **la lámpara** de mesa
y la de techo, **la papelera**, una alfombra (opcional). El libro: el ya encargado (encargos 1 a 4
del brief), ahora **como malla glTF de producción** y no solo como referencia; libros de nueve
tamaños y grosores como en el lab 11, con la tela T1 a T4. Piezas del constructor (tablas,
escuadras, baldas sueltas): **no en la v1**. Props (planta, taza, gato): a discutir; el gato sigue
en la lista para tacharlo a conciencia. Presupuesto para la integrada a 60 Hz, propuesto y ⚠ sin
medir: menos de 150k triángulos en escena, texturas de 1024 (2048 solo la tela del libro), una luz
direccional con sombra y una o dos puntuales sin sombra, y todo lo estático horneado (lightmap) si
hace falta. Se mide en el piloto y se ajusta.

## II.5 Estética: tres direcciones para empezar la conversación

1. **Biblioteca de noche**: madera oscura, lámpara cálida, sombras largas. Casa con el modo oscuro
   del visor (la mesa siempre oscura, anexo H) y esconde límites de polígonos en la penumbra.
2. **Estilizado, a lo Unpacking**: formas simples, colores planos, sin texturas realistas. Es lo más
   barato de modelar y de mover, y lo más difícil de que parezca «una demo de Three.js».
3. **Estudio de día**: luz de ventana, madera clara, paredes blancas. Bonito, caro (luz global) y
   choca con el visor oscuro salvo que el modo claro del anexo H se extienda a la habitación.
Recomendación para discutir: la 1 como base con la sencillez de formas de la 2. Se decide con Tania
y con dos o tres renders suyos, como el libro.

## II.6 Alcance y estimación (con base; lo real se apunta al lado)

**Base.** No hay Three.js en ningún proyecto de Eneko: no existe un «real» previo. Lo más parecido
es el Grafo del visor (motor propio sobre canvas y d3-force, `lib/sim.ts` y `views/graph/`),
entregado el 05/09/2026 tras unas dos semanas de sesiones con Claude construyendo; y la investigación
de animación (14 h estimadas, dos tardes reales). Regla de esta casa: lo estimado con Claude
ejecutando suele sobrar (9 h 45 estimadas, 50 min reales, 15/09); **lo estimado con Eneko
aprendiendo al teclado se multiplica por dos o tres**, y esa cifra sí es nueva.

| Fase | Qué se entrega | Claude construye | Eneko al teclado, aprendiendo |
|---|---|---|---|
| **F0 · Piloto de viabilidad** | Una escena Three.js con Rapier: suelo, una estantería de primitivas, quince libros como cajas con tamaños del lab 11, coger, llevar y dejar con la sensación del 11, cámara a dos sitios, y la transición a un lector HTML de mentira. Medido en la 3070 a 144 y en una integrada a 60. **Decide si se sigue.** | 12 a 16 h | 30 a 40 h |
| **F1 · La habitación v1** | Cajas y desembalar, paquetes y montar, mesa y silla, cámara a sitios, estado del mundo guardado (posiciones y poses, no una lista), luz por hora, presupuesto de rendimiento cumplido | 40 a 50 h | 90 a 120 h |
| **F2 · Leer desde la habitación** | Las tres posturas, el lector con entorno y el modo concentración, tumbado con techo, móvil sin casa; las transiciones 5, 6 y 7 en 3D con lo decidido en los anexos O y Q | 20 a 30 h | 40 a 60 h |
| **F3 · Arte de Tania** | Pipeline 3ds Max → glTF con presupuestos, sustituir primitivas, la estética elegida, iluminación | 15 a 20 h (más el tiempo de Tania) | 30 a 40 h |
| **F4 · Lo que envejece** | Desgaste, papelera, ficha de préstamo; el constructor por piezas; modo paseo | 30 a 40 h | 60 a 90 h |
| **Total a una v1 enseñable (F0 a F3)** | | **90 a 115 h** | **190 a 260 h** |

A diez horas semanales, la v1 enseñable son **cinco o seis meses** aprendiendo, o **dos o tres**
si construye Claude. «Sin límite» no cambia la cifra de horas, solo el calendario. ⚠ El margen es
del doble en cualquier dirección: la primera semana de F0 lo estrecha.

**Lo que NO cambia respecto a lo decidido**: el libro por dentro (anexos H a L), las transiciones 5,
6 y 7 (anexos O y Q: pasan a 3D con los mismos números), el motor CDA que genera los libros (punto 9
del plan), y el orden: **F0 es lo primero**, porque decide si todo esto se hace o si la biblioteca
vuelve a CSS. Se empieza tras el checkpoint 9.

**Decidido a las 20:35** (tres preguntas más): el código de la habitación vive en **`naeth/web` como una
vista más** (mismo Svelte, mismo build y despliegue; Three.js y Rapier como dependencias cargadas solo
al entrar en la biblioteca, por import dinámico); **se arranca por F0**, el piloto, antes de cerrar la
discovery de la vista y sin esperar a la conversación con Tania (el piloto va con primitivas); y el
checkpoint 9 de Naeth se hace en cuanto esté el deck para Tania (`https://claude.ai/artifact/1UCRxu5Xty2ABvPNnZ8V96`,
privado hasta que Eneko lo comparta).

**Lo que cambia**: el visor entra en **generación 3** (cambia lo que se ve: regla de versiones del
22/08), la lámina del plan del `.pen` gana el punto «la habitación» en el check de «a Eneko se le ha
vuelto a ocurrir otra cosa» (se apunta, se numera, no se empieza hasta cerrar el punto en curso: el
punto en curso es el punto 9, cerrar la discovery, y F0 es su primera tarea), y el encargo de Tania
se reescribe cuando F0 diga que sí.
