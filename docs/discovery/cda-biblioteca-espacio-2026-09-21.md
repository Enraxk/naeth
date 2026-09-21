# Discovery: la biblioteca de CDA como espacio que envejece contigo

Fecha: 21/09/2026, 19:00, en curso. Sale de la tarde del 21/09 en el chat «diseño CDA en Pencil»:
la transición 7 quedó cerrada por la mañana (anexo Q de `cda-vista-diseno-2026-09-15.md`), la 6 pasó
de reglas a un motor de físicas (lab `docs/lab/animacion/web/11-estanteria-con-fisicas.html`,
Eneko: «esto sí se siente como físicas»), y a las 18:38 Eneko propuso convertir la biblioteca en algo
parecido a un juego: «ir desbloqueando mejores estanterías dependiendo de la cantidad de libros que
voy leyendo». A las 18:50 añadió el contexto que faltaba (ver «Lo que este documento no decide»).

**Alcance.** La biblioteca de CDA (la estantería del anexo P, los libros que hoy son repos) como un
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
