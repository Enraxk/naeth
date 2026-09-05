# Que el grafo de Naeth se sienta vivo

Plan del 05/09/2026. Sustituye al del 04/09, que está a salvo en `docs/plan/grafo-2026-09-04.md`.

## Contexto

El prototipo del grafo salió el 04/09 y funciona: 528 memorias, 479 vínculos, 24 componentes, con
filtros, zoom, teclado y 151 tests de front en verde. La crítica al verlo fue clara y toda de
sensación, no de datos: *"no se ve vivo, se ve un popurrí de colores y líneas"*, el clic que no
abría, el panel que tapa, y *"por mucho que haga zoom una nota va a seguir siendo pequeña cuando
tendría que hacerse más grande"*. La prioridad que fijaste: **"1º quiero que el sistema se sienta
bien, fluido y que responde y ya luego nos ponemos con las cosas más chungas"**.

El diagnóstico es de una línea, y está escrito en el propio código
(`views/graph/GraphPlain.svelte:12`): **"NO ANIMA EL LAYOUT... se pintan ya asentadas"**. El grafo
está muerto a propósito. Todo lo que produce la sensación de vida en Obsidian falta porque
decidimos que faltara. Este plan deshace esa decisión con lo que ahora sabemos.

## Lo investigado hoy sobre Obsidian, y por qué no hace falta tocar sus binarios

El paquete `obsidian-typings@4.61.0` tipa lo no documentado del binario real, con comentarios que
solo salen de leerlo. Incluye parches de `@pixi/color`, `@pixi/events` y `@pixi/settings` en la
versión **7.2.4**, así que la versión de PIXI está confirmada por evidencia, no por foro. Es fuente
de la comunidad, marcada `@unofficial`: no es documentación oficial, pero sí es el binario leído.

Lo que revela `GraphRenderer`, y que explica por qué "va también":

| Campo real | Lo que significa |
|---|---|
| `worker: Worker` | *"Web Worker thread running the graph simulation"*. La física no corre en el hilo principal |
| `idleFrames` | *"The simulation stops running at 60"*. Se detiene tras 60 frames quietos |
| `queueRender()` / `changed()` | Render bajo demanda, no bucle permanente |
| `scale` / `targetScale` | El zoom está interpolado entre ambos: se desliza, no salta |
| `panvX` / `panvY` | Velocidad de paneo: hay inercia |
| `nodeScale` | *"Scale of the nodes based on the zoom level"*: los nodos crecen al acercarse |
| `textAlpha`, `fTextShowMult` | La opacidad de los nombres depende de la escala |
| `moveText` | *"Displacement of the text, changed when the node is hovered"* |
| `weight` + `getSize()` | Tamaño por número de vecinos |
| `forward` / `reverse` | Adyacencia precomputada por id: los vecinos salen en O(1) |

De **Quartz v4** (reimplementación open source, d3-force + PIXI, 649 líneas leídas) salen las cifras
concretas: hover con vecinos a alpha 1 y **el resto a 0,2 con transición de 200 ms**, etiquetas a
escala `1/k` con opacidad `max((k - 1) / 3,75, 0)`, radio `2 + √grado`, y **el clic detectado como
arrastre corto de menos de 500 ms**, que es exactamente el bug que peleamos ayer.

## Lo medido hoy, que es lo que decide el motor

Corpus a 05/09/2026: **528 vigentes**, **479 aristas de relación**, **406 nodos con al menos una**,
197 notas con wikilinks y 401 destinos en bruto. Con la capa de wikilinks encendida, del orden de
**640 aristas y 450 nodos**.

Crecimiento real, contra `memory.memory` (Naeth lleva cuatro meses en producción):

| Mes | Versiones escritas | Vigentes que quedan |
|---|---|---|
| jun 2026 | 84 | 33 |
| jul 2026 | 362 | 209 |
| ago 2026 | 404 | 242 |
| sep 2026 (4 días) | 55 | 44 |

Unas **230 memorias vigentes nuevas al mes**, sostenido y sin señal de frenar. Proyección a densidad
constante (hoy 1,2 aristas por nota):

| Horizonte | Nodos | Aristas | Primitivas por frame |
|---|---|---|---|
| hoy | 528 | 640 | ~1.200 |
| +1 año | ~3.300 | ~4.000 | ~7.300 |
| +3 años | ~8.800 | ~10.600 | ~19.400 |

Esto es lo que responde tu pregunta. **Obsidian usa WebGL porque pinta vaults de 10.000 notas, y
nosotros llegamos ahí en unos tres años, no nunca.** Por eso el plan no elige un motor: elige una
frontera. La capa de pintado queda detrás de una interfaz, de forma que cambiar canvas 2D por WebGL
el día que haga falta sea sustituir un módulo y no reescribir la vista.

## Decisión de arquitectura

Tres piezas separadas, cada una probable en aislamiento, que es lo que hoy no se puede hacer porque
`GraphPlain.svelte` mezcla las tres en 406 líneas:

- **`lib/sim.ts`**: la física. Sin DOM, sin Svelte, probable con Vitest.
- **`lib/paint/*.ts`**: el pintado, detrás de la interfaz `Pintor`. Una implementación hoy
  (`canvas.ts` o `svg.ts`, lo decide la fase 0), otra el día que crezcamos.
- **`views/graph/Lienzo.svelte`**: la interacción y el ciclo de vida. Fino a propósito.

Se conserva todo lo que ya está bien y tiene tests: `lib/graph.ts` (el modelo, las tres capas, la
deduplicación, las componentes), `lib/layout.ts` (el empaquetado determinista, que pasa a dar
**posiciones de partida y anclas**, no posiciones finales), `lib/colors.ts` y `lib/wikilinks.ts`.

---

## Fase 0. Medir antes de elegir

Lo pediste tú y es lo correcto: no tengo medido cuánto aguanta SVG con todo moviéndose, y no voy a
afirmarlo. Esta fase existe para no volver a dar algo por bueno sin comprobarlo.

**Banco de pruebas fuera de la app** (`web/bench/motor.html`, siguiendo el precedente de
`naeth/bench/`): misma simulación, dos pintores, datos reales de `/api/graph` y sintéticos a x5 y
x10 (que son la proyección a 1 y 3 años). Se mide fps sostenido, milisegundos por frame en el
percentil 95, y el coste de arrancar.

**Criterio de éxito, declarado antes de mirar:** un motor pasa si da **50 fps o más con el corpus de
hoy** y **30 fps o más a x5**. Si los dos pasan, gana el que no añada dependencia. Si ninguno pasa a
x5, se anota el techo y se sigue con el mejor, dejando WebGL escrito como escotilla con su umbral.

Se mide también **d3-force contra el Fruchterman-Reingold propio** (`layout.ts:63`) en tiempo por
tick con 528 y 5.000 nodos. La expectativa es que d3-force gane por Barnes-Hut (O(n log n) contra
nuestro O(n²)), pero es una expectativa, no un dato.

**Entregable:** `docs/discovery/motor-grafo-2026-09-05.md` con la tabla y la elección razonada. Va
al repo, no a un directorio volátil, que es la lección del 04/09.

## Fase 1. El núcleo vivo

**1.1 `lib/sim.ts`, la simulación.** Con d3-force si la fase 0 lo confirma (unos 11 kB gzip entre
`d3-force`, `d3-quadtree`, `d3-timer` y `d3-dispatch`; hoy no hay ningún d3 en el árbol).

- Fuerzas: `forceLink` por id con distancia, `forceManyBody` negativa, `forceCollide` por radio, y
  **`forceX`/`forceY` débiles hacia el centro de su componente**. Esa última es la que conserva lo
  que ya ganamos: las 24 componentes no se pisan ni salen despedidas, pero ahora respiran.
- **Determinismo conservado**: `simulation.randomSource()` recibe el `sembrado()` de `layout.ts:35`,
  y las posiciones de partida salen de `colocar()` (`layout.ts:169`). Arranca ya ordenado y la
  simulación solo asienta, en vez de explotar desde cero.
- **Se detiene sola** cuando alpha baja del mínimo, como el `idleFrames` de Obsidian, y despierta
  con `alphaTarget` al tocar algo. No quema CPU con el grafo quieto.
- **Al cambiar un filtro no se recalcula desde cero**: se quitan y añaden nodos conservando la
  posición de los que siguen, y se reinicia alpha. Eso es lo que mata los **265-411 ms de
  congelación** que medimos ayer, que hoy vienen de recalcular 160 iteraciones síncronas.
- Tests: determinismo del estado inicial, ninguna posición NaN con nodos amontonados, las
  componentes no se solapan, y un nodo anclado (`fx`/`fy`) no se mueve.

**1.2 `lib/paint/`, el pintado.** Interfaz `Pintor` con `dibujar(vista, modelo, estado)`. La
implementación que gane en la fase 0, con **culling por viewport** (no se dibuja lo que no se ve,
que es lo que compra los años de la proyección) y `devicePixelRatio` para que no salga borroso.

**1.3 La interacción, en `Lienzo.svelte`.**

- **Arrastrar nodos**, que hoy no se puede: `fx`/`fy` mientras se arrastra, sueltos al soltar, con
  la simulación despierta durante el gesto.
- **Clic contra arrastre**: pulsación de menos de 500 ms y menos de 4 px abre la nota. Es el patrón
  de Quartz, y ya lo tenemos a medias en `GraphPlain.svelte:139`.
- **Zoom interpolado** hacia un `targetScale`, no el salto de `vb.k * 1,15` de hoy.
- **Inercia de paneo**, con fricción, como el `panvX`/`panvY` de Obsidian.
- **Hit-testing por distancia** sobre los nodos visibles. Con 528 es gratis; el culling lo mantiene
  gratis a x10.

**1.4 El hover que responde.** Adyacencia precomputada al construir el modelo (el `forward`/`reverse`
de Obsidian), para que los vecinos salgan en O(1) en vez de recorrer las 640 aristas en cada cruce
de nodo. Atenuación del resto **con transición**, no de golpe: los 200 ms de Quartz. Y el texto que
se desplaza y crece al pasar por encima.

**Criterio de éxito de la fase 1:** el grafo se puede arrastrar, los nodos se apartan, cambiar un
filtro no congela nada, y con el ratón quieto la CPU vuelve a cero.

## Fase 2. Que se lea

**2.1 El panel que tapa.** El `aside.panel` de `Grafo.svelte:191` está en `position: absolute` sobre
la esquina superior derecha del lienzo. Pasa a una franja que no se come el dibujo, y en móvil ya
tiene su rama a ancho completo abajo.

**2.2 Los nodos crecen al acercarse**, que es tu queja literal. Existe a medias
(`crecimiento`, `GraphPlain.svelte:110`, con techo en 3,2) pero está atado a un SVG con `viewBox`.
En el motor nuevo es el `nodeScale` de Obsidian, y las etiquetas siguen la misma curva.

**2.3 Hover cruzado árbol y grafo.** Idea tuya. Un `$state` compartido en `lib/ui.svelte.ts`, que ya
existe para el cajón de la sidebar y es el sitio natural: pasar el ratón por una fila del árbol
resalta el nodo en el grafo, y al revés. Es lo que hace que la aplicación se sienta una sola cosa.

**Sobre el color:** se queda por proyecto, como pediste. Tu idea del degradado hacia los proyectos
con los que una nota más se relaciona es buena y es medible (hoy el **24% de las aristas cruzan
proyecto**), pero es estética y va después, con su propia sub-fase, no mezclada aquí.

## Defectos abiertos, del uso real del 05/09/2026 a las 13:59

Feedback de Eneko sobre lo entregado en la fase 2. **Las cuatro causas están verificadas, no
supuestas**: cada una lleva el fichero y la línea, o la prueba en el navegador que la reproduce.

### D1. El botón de la franja huye justo cuando vas a pulsarlo

**Reproducido**: se señala una fila del árbol y la franja dice `naeth/conventions, 14 de 16
memorias en el grafo`; se mueve el ratón hacia la franja y pasa a `455 memorias, 650 vínculos...`,
con `hay_boton_abrir: false`. El botón **desaparece en el camino hacia él**.

**Causa raíz, y no es la franja**: la franja se alimenta del resalte, que es un estado de *hover*, y
el hover muere al salir de la zona (`entrarArbol(false)` en `lib/ui.svelte.ts`, y `fuera()` en
`Lienzo.svelte`). Un panel con acciones no puede alimentarse de un estado que se apaga al ir hacia
él. Hoy no hay forma de FIJAR una memoria: el clic sobre un nodo abre la nota, no la fija.

Dos salidas, y hay que elegir antes de tocar nada:

- **La franja recuerda lo último señalado** y no se vacía hasta que señales otra cosa o pulses
  Escape. Es un cambio pequeño y el botón deja de huir. Contra: la franja ya no vuelve sola a las
  cuentas del grafo.
- **El clic fija y el doble clic abre.** Más ortodoxo, pero cambia la interacción de un clic que
  ya funciona y que gustó.

### D2. La fila señalada se queda pegada al borde

`components/Sidebar.svelte:41` usa `scrollIntoView({ block: 'nearest' })`, que por definición deja
la fila en el borde más cercano y no la centra. Cambiar a `center` es una palabra, pero hay que
comprobar que recorrer el grafo con el ratón no convierta el árbol en una máquina tragaperras.

### D3. Señalar en el grafo reabre carpetas que habías cerrado

`components/Sidebar.svelte:38` llama a `revealInTree()` dentro del efecto del *hover*. Colapsar una
carpeta es una decisión deliberada, y pasar el ratón por encima de algo no puede deshacerla.
Al quitarlo aparece la pregunta que hay que responder: qué se enseña cuando la fila está dentro de
una carpeta cerrada. Lo razonable es encender la carpeta que la contiene.

### D4. Sin nada señalado, el grafo escribe todos los nombres que le caben

`lib/pintor-canvas.ts:214`: sin foco, si los nodos visibles no pasan de `TOPE_ETIQUETAS` (110) se
escriben todos. Eneko lo prefiere en cero: nombres solo cuando hay algo señalado. Es coherente con
lo que ya se arregló para el caso con foco y deja el grafo en reposo limpio.

### D5. El buscador no habla ni con el árbol ni con el grafo

`lib/search.svelte.ts` (103 líneas, con `qo`, `doSearch` y `choose`) no toca `resalte` en ningún
sitio: buscar no enciende nada. **No es un defecto, es una pieza que falta**, y es la tercera vía de
señalar junto al árbol y el grafo. Merece su propia fase, no un parche: hay que decidir si enciende
mientras escribes o solo al recorrer los resultados, y qué pasa con los aciertos que están fuera del
grafo.

### Cómo se arreglan, decidido el 05/09/2026

Van los cuatro ANTES de la fase 3: tres son defectos de lo entregado hace una hora y aparcarlos en
la fase de ajustes los convertiría en deuda con nombre.

| # | Qué se hace | Cómo se comprueba que quedó hecho |
|---|---|---|
| D1 | **La franja pierde el botón** y se queda como información pura. Para abrir, el clic sobre el nodo, que ya funciona. Decisión de Eneko: el problema desaparece en vez de resolverse, y es la salida más simple de las tres | La franja no tiene `.f-abrir` en ninguno de sus dos ramos, y el clic sobre un nodo sigue abriendo la nota |
| D2 | `block: 'nearest'` pasa a `'center'` **solo en el efecto del hover**. El de navegar a una memoria no se toca, que ya estaba verificado y no molesta | Señalar un nodo y medir dónde queda la fila: cerca del centro del contenedor, no pegada a un borde |
| D3 | Fuera `revealInTree` del efecto del hover. Si la fila está dentro de una carpeta cerrada, **se enciende la carpeta** en vez de abrirla | Colapsar una carpeta, señalar en el grafo una nota de dentro: la carpeta sigue cerrada y su fila se enciende |
| D4 | `TOPE_ETIQUETAS` a **0**. No se retira el mecanismo: queda intacto para ser el deslizador de umbral de texto de la fase 3.5, así que no se pierde funcionalidad ni queda código muerto | Sin nada señalado, el lienzo no escribe ni un nombre; al señalar, salen los del vecindario |

D5, el buscador, no entra aquí: es una pieza que falta, no un defecto, y va con su propia fase.

### Corrección de rumbo del 05/09/2026, 14:29: colapsar SÍ oculta

Al probarlo, Eneko volvió sobre la decisión de "encender en vez de recortar" y pidió lo contrario
para el caso del colapso: **cerrar una carpeta la retira del grafo**. Se hace, y la objeción que
puse la primera vez pesa menos aquí de lo que dije: el escenario que yo temía era encontrarse el
grafo vacío por unos colapsos heredados, y esto es un gesto explícito y reversible sobre un árbol
que nace abierto.

El coste sigue existiendo y por eso se mide en vez de esconderlo: al ocultar una carpeta
desaparecen también **las aristas que salían de ella hacia otros proyectos**, que son el 24% del
corpus. `GraphModel` devuelve `ocultas` y la franja lo dice. Medido al cerrar `cenit`: de 455
memorias y 650 vínculos a 399 y 567, con `58 en carpetas cerradas` escrito en la franja.

El hover sigue encendiendo: son dos gestos distintos. Señalar una carpeta la ilumina con sus
vecinos; cerrarla la retira.

### El resalte se queda pegado (05/09/2026)

Con el grafo vivo, el nodo que señalas se mueve, y con un hover normal se sale de debajo del cursor
y el resalte se apaga solo. El ciclo que salía era: señalas, el nodo se va, se apaga, vuelves a
señalar. Ahora el resalte solo cambia cuando el ratón encuentra **otro** nodo, y se suelta con
Escape, con un clic en el fondo o señalando en el árbol.

Se aprovechó para quitar la duplicación que lo hacía frágil: el lienzo tenía un `encima` propio
además del `resalte` compartido, o sea dos fuentes para el mismo dato. Ahora la única es `resalte`.

Y el nombre del nodo señalado se escribe más grande que el de sus vecinos: con todos al mismo
cuerpo, en un vecindario de cinco no hay forma de saber cuál era el que apuntabas.

## Fase 3. El mini grafo de la ficha

Hoy es radial, determinista y funciona (`components/MiniGraph.svelte`). Pasa a usar el motor nuevo
para que el vecindario se vea igual en los dos sitios y el hover cruzado también funcione ahí. Es la
última porque no bloquea nada.

## Fase 3.5. Ajustes de preferencia de usuario

Pedida por Eneko el 05/09/2026 tras probar la fase 1: *"ahora sí que se siente bien. Hay que
ajustar algunas cosas pero eso lo dejo para una fase de ajustes de preferencia de usuario (fuerza,
cómo se pinta cuando aparecen...)"*.

Son los cuatro deslizadores de fuerzas del grafo de Obsidian (centro, repulsión, fuerza de enlace y
distancia de enlace), más lo nuestro: cómo entra el grafo al abrirlo, la velocidad del asentamiento
y el umbral del texto. Persistidos en `localStorage` con el patrón de `prefs.svelte.ts`. Va después
del mini grafo porque son preferencias sobre un motor que para entonces ya no se toca.

## Fase 4. Cierre

Suite completa de los dos lados, `npm run build`, verificación en navegador en los dos temas y a
375 px, `git pull` y `./up.sh --build` en `finally` (que sigue con el build del 28/08), y **tag
`2.2026.09` al desplegar, no al commitear**.

---

## Movimiento reducido, que ahora sí hay que resolver

Una simulación es literalmente objetos desplazándose por pantalla, que es lo que retira
`prefers-reduced-motion` en `app.css:180-221`, y **no se puede resolver por tokens porque no es una
transición CSS**. Regla: con `reduce`, la simulación corre en silencio hasta asentarse y se pinta el
resultado; el arrastre y el zoom sí mueven, porque los mueve la mano del usuario. Va comprobado con
`matchMedia` en JS, y con un comentario en `app.css` que diga que el grafo lo resuelve en su
componente y por qué.

## Accesibilidad

Si gana canvas no se pierde nada: el SVG de hoy ya va con `aria-hidden="true"`, y lo que sostiene el
teclado es el `role="application"` del contenedor, que se conserva igual. Se añade movimiento por
teclado **entre nodos** (al vecino más cercano), para que las flechas no sirvan solo para pasear.

## Qué queda fuera, dicho

Estética heptápoda. El degradado de color por vecindario. Naeth 3.0. Web Worker para la simulación:
con 528 nodos un tick cabe de sobra en el hilo principal, y la fase 0 dará el número exacto al que
deja de caber, que es el umbral escrito para el día que toque.

## Verificación

| Qué | Cómo |
|---|---|
| El motor elegido aguanta | La tabla de la fase 0, con criterio declarado antes de mirar |
| Se siente vivo | Arrastrar un nodo aparta a sus vecinos y el grafo se reasienta |
| Ya no congela | Cambiar de capa o de proyecto no bloquea el hilo (medido, hoy son 265-411 ms) |
| No quema CPU | Con el grafo quieto y el ratón fuera, el perfil baja a cero |
| El clic abre | Con ratón de verdad sobre el lienzo, no con eventos sintéticos (la lección del 04/09) |
| El zoom sirve | Acercarse a una nota la hace grande y le saca el nombre |
| Cruzado | Hover en el árbol resalta en el grafo, y al revés |
| Movimiento reducido | Con `reduce` activo no hay simulación visible y el grafo sale asentado |
| Los dos nodos | El `curl` del README en PC y en `finally`, y `git describe --tags` da `2.2026.09` |

Un commit por sub-fase, sin trailer de coautoría, cero em dash y cero en dash en todo texto
incluidos comentarios y mensajes de commit. Cada sub-fase cierra re-ejecutando la suite acumulada
completa: `npm test && npm run check && npm run build`.
