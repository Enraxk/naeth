# Handoff: lenguaje de movimiento (Naeth)

## Overview

El visor tiene hoy **tres animaciones** y ninguna librería. Este documento no las cambia: les da un
significado, para que lo que se añada mañana caiga en la que le toca en vez de traer una duración
nueva.

Lo que aporta:

1. **Una escala de tres duraciones con una clase de gesto cada una.** Las tres ya existían; lo nuevo
   es saber cuál usar y por qué.
2. **Una segunda curva, acotada.** El rebasamiento vive en un token propio y solo lo usa la capa
   flotante anclada.
3. **`prefers-reduced-motion`, que hoy no se respeta en ninguna parte.** Es el fallo que este
   handoff corrige.
4. **La lista de lo que no se anima**, que es la mitad del lenguaje.

La regla de fondo, y la única que hay que recordar si se olvida el resto:
**el movimiento explica un cambio que si no habría que adivinar. Si no hay nada que explicar, no hay
movimiento.**

## About the Design Files

`spec/Lenguaje de movimiento.dc.html` es **la especificación**, no una ilustración de ella. Ábrelo en
un navegador: tiene un comparador que dispara las tres duraciones a la vez, un interruptor de
`reduced-motion` que las cambia en vivo, y un A/B de `con rebasamiento` / `solo fundido` sobre el
desplegable real. Un lenguaje de movimiento no se puede juzgar leído.

`spec/support.js` es el runtime que hace que ese fichero pinte. No forma parte del diseño y no se
porta a ninguna parte.

`lenguaje-de-movimiento.png` es la página entera en estático, para orientarse.

El trabajo no es recrear esa página: es **aplicar sus reglas al visor**, en `naeth/web/`
(Vite + Svelte 5 + TS + Tailwind v4). Todo el cambio es CSS y cabe en unas quince líneas.

## Fidelity

**Alta fidelidad y verificado contra el código vivo.** Las tres duraciones, sus curvas y sus
selectores salen de `src/components/Sidebar.svelte`, `src/views/Estado.svelte` y
`src/components/Header.svelte`, leídos el 23/08/2026. Los números de línea de este documento se
refieren a ese estado del repo.

---

## La escala

Tres duraciones, tres clases de gesto. **No es una escala de intensidad: son categorías distintas.**
La duración sale de qué clase de cambio hay que explicar. Elegir la duración es elegir la categoría;
si dudas entre dos, el gesto está mal planteado.

| Token | Duración | Clase de gesto | Qué significa |
|---|---|---|---|
| `--t-fast` | 120ms | **Cambia de forma** | Un elemento que ya está en pantalla y sigue en su sitio adopta otra forma. No ocupa más ni menos, no aparece ni se va, nada se recoloca a su alrededor |
| `--t-mid` | 220ms | **Entra o sale** | Algo que no estaba pasa a estar, o al revés. Cambia lo que tienes disponible, y por eso merece que se note |
| `--t-slow` | 400ms | **Cambia de valor** | Una medida se mueve de una cifra a otra. El recorrido no es decoración: es la única forma de ver cuánto ha cambiado. Es la más larga porque es la única que transporta información |

**Cada clase se estrena con la animación que ya la ocupaba**, así que ninguna de las tres actuales se
redefine:

| Clase | Hoy | Y también, cuando llegue |
|---|---|---|
| 120ms · forma | El chevron del árbol al plegar un grupo | El chevron del selector al elegir proyecto. Un icono que cambia de estado. Nada más |
| 220ms · presencia | El cajón lateral entrando en móvil | La hoja inferior en móvil (con `ease`). El desplegable del selector, el acuse de guardado y un tag que entra (con `--t-over`) |
| 400ms · valor | La barra de embebidas al cambiar el dato | Cualquier barra de un panel de estado. Nada que no sea una magnitud: esta duración no se presta para abrir cosas |

## Las dos curvas

| Token | Valor | Dominio |
|---|---|---|
| `--t-fast` / `--t-mid` / `--t-slow` | `ease` | Todo el chrome, sin excepción |
| `--t-over` | `cubic-bezier(.34,1.56,.64,1)` | **Solo** la capa flotante anclada, al abrir |

`--t-over` dura los mismos **220ms** que `--t-mid`. **No es una duración nueva: siguen siendo tres.**

**La curva va dentro del token.** Se escribe `transition: transform var(--t-fast)`, nunca
`transition: transform var(--t-fast) ease-in-out`. Así no queda sitio donde colar una tercera.

### Qué es "la capa flotante anclada"

Lo que aparece **flotando encima del contenido y anclado a un elemento**: el desplegable del selector
de ruta, el popover de búsqueda del header, el aviso del acuse, un tag que entra.

Al abrir: sube **10px**, escala de **.985 a 1**, y las filas de dentro entran escalonadas **45ms**.

Se lo puede permitir porque es lo único del visor que no estaba y ahora tapa lo que estabas leyendo:
interrumpe de todas formas, así que más vale que se anuncie bien. Y porque lo abres tú, una vez,
cuando has decidido elegir una ruta.

**Tres límites, y son parte de la regla:**

- **Al cerrar no rebasa.** El rebasamiento es un gesto de llegada; algo que se va no puede pasarse de
  largo de un sitio al que no va. Cierra con `--t-mid` normal, misma duración.
- **El cajón y la hoja inferior quedan fuera.** Vienen de un borde de la pantalla, y una curva que
  rebasa en un borde saca el objeto por el otro lado. Ahí, `ease`.
- **El borde del campo no funde.** Pasa a `--accent` de golpe: es la respuesta a que acabas de
  pulsar, y lo que responde a tu dedo no se hace esperar.

---

## La migración, en cuatro pasos

### Paso 1 · Tokenizar lo que ya existe (precondición)

**Los tokens `--t-fast` / `--t-mid` / `--t-slow` existen en el design system pero el visor no los
usa: las tres duraciones están escritas a mano en tres ficheros.** Sin este paso, `--t-over` sería un
cuarto valor suelto en vez de un sistema, así que va primero.

`src/app.css`, junto al bloque de tokens:

```css
--t-fast: .12s ease;
--t-mid:  .22s ease;
--t-slow: .4s ease;
--t-over: .22s cubic-bezier(.34, 1.56, .64, 1);
```

Tres sustituciones, sin cambio visible:

```diff
  /* src/components/Sidebar.svelte:142 */
- .chev { flex: 0 0 auto; color: var(--dim); transition: transform .12s; display: inline-flex; }
+ .chev { flex: 0 0 auto; color: var(--dim); transition: transform var(--t-fast); display: inline-flex; }

  /* src/components/Sidebar.svelte:167, dentro de @media (max-width: 860px) */
- .sidebar { … transition: transform .22s ease; … }
+ .sidebar { … transition: transform var(--t-mid); … }

  /* src/views/Estado.svelte:169 */
- .est-bar > i { display: block; height: 100%; background: var(--ok); transition: width .4s ease; }
+ .est-bar > i { display: block; height: 100%; background: var(--ok); transition: width var(--t-slow); }
```

⚠ `.chev` hoy declara `.12s` **sin curva**. `ease` es el valor por defecto de CSS, así que el
resultado es idéntico; el token solo lo hace explícito.

También conviene añadir `--t-over` a `tokens/shape.css` del design system, junto a los otros tres,
para que las dos copias no se separen.

### Paso 2 · El popover de búsqueda, que ya existe y no se animaba

`.searchpop` (`src/components/Header.svelte:125`) es capa flotante anclada y hoy aparece de golpe.
Entra en el alcance: si una capa flotante se comporta distinto de la otra, no hay lenguaje, hay dos
casos.

⚠ **Cuidado con el `transform` que ya lleva.** `.searchpop` usa `transform: translateX(-50%)` para
centrarse. La subida tiene que componerse con eso, no sustituirlo:

```css
.searchpop {
  /* … lo que ya hay … */
  opacity: 0;
  transform: translateX(-50%) translateY(10px) scale(.985);
  transition: opacity var(--t-mid), transform var(--t-mid);
  pointer-events: none;
}
.searchpop.open {
  opacity: 1;
  transform: translateX(-50%);
  transition: opacity var(--t-mid), transform var(--t-over);  /* rebasa solo al abrir */
  pointer-events: auto;
}
```

El escalonado de las filas de dentro, 45ms por fila, con una variable por índice:

```svelte
{#each results as r, i}
  <div class="wp-row" style="--i:{i}">…</div>
{/each}
```

```css
.searchpop .wp-row { opacity: 0; transform: translateY(6px); }
.searchpop.open .wp-row {
  opacity: 1;
  transform: none;
  transition: opacity var(--t-mid), transform var(--t-over);
  transition-delay: calc(var(--i) * 45ms);
}
```

Tope práctico: **no escalones más de seis filas**. A partir de ahí la última llega tarde y el
escalonado deja de ser una entrada para ser una espera.

### Paso 3 · Lo que llega con "Nueva memoria"

Ver el handoff `design_handoff_nueva_memoria`. En términos de movimiento:

| Elemento | Duración | Curva |
|---|---|---|
| Desplegable del selector de ruta | 220ms | `--t-over` al abrir, `--t-mid` al cerrar |
| Hoja inferior del selector, en móvil | 220ms | `--t-mid`, siempre. Viene de un borde |
| Aviso del acuse, al aparecer y al retirarse | 220ms | `--t-over` al aparecer, `--t-mid` al irse |
| Un tag que se añade o se quita | 220ms | `--t-over` al añadir, `--t-mid` al quitar |
| Chevron del proyecto activo en el selector | 120ms | `--t-fast` |
| Filtrado de la lista al escribir | — | **No se anima.** Ver "lo que no se anima" |

⚠ **Corrección al handoff anterior.** El README de `design_handoff_nueva_memoria` dice, en
"Interactions & Behavior": *"El popover aparece y desaparece sin transición"*. Eso ya no es cierto:
manda lo de aquí.

### Paso 4 · `prefers-reduced-motion`

**Hoy no se respeta en ninguna parte, y eso es el fallo que este handoff viene a corregir.**

La postura no es apagarlo todo. Lo que provoca malestar vestibular es el **desplazamiento** y el
**giro**: un objeto que recorre la pantalla o rota. Un fundido no. Así que **el fundido se queda**,
porque es lo que evita que un aviso aparezca de golpe encima de lo que estás leyendo, y **se va todo
lo que se mueve**.

El rebasamiento es lo primero que cae: una curva que se pasa de largo y vuelve es, literalmente, un
objeto cambiando de dirección en pantalla.

Va en **`src/app.css`**, una consulta de medios, una vez. No repartido por los componentes.

```css
@media (prefers-reduced-motion: reduce) {
  /* se va el giro */
  .chev { transition: none; }

  /* se va el crecimiento de la barra: salta a su cifra */
  .est-bar > i { transition: none; }

  /* la capa flotante pierde rebasamiento, subida y escalonado; conserva el fundido */
  .searchpop,
  .searchpop.open {
    transform: translateX(-50%);
    transition: opacity var(--t-mid);
  }
  .searchpop .wp-row,
  .searchpop.open .wp-row {
    transform: none;
    transition: none;
    opacity: 1;
  }
}

/* el cajón deja de deslizarse y aparece fundiendo en su sitio */
@media (prefers-reduced-motion: reduce) and (max-width: 860px) {
  .sidebar {
    transform: none;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--t-mid);
  }
  .sidebar.open { opacity: 1; pointer-events: auto; }
}
```

Cuando llegue el selector de ruta, sus clases se añaden al mismo bloque con el mismo criterio:
`transform: none`, `transition: opacity var(--t-mid)`.

---

## Lo que no se anima

Esta lista es la mitad del lenguaje. **Un sistema con tres animaciones no se define por las tres, se
define por todo lo demás.** Cada línea es una decisión, no un olvido: no las "arregles".

- **El hover.** El lavado de fila y el borde que pasa a accent cambian de golpe. Es la respuesta a
  dónde está tu puntero; un fundido de 120ms la convierte en una opinión sobre dónde estaba hace un
  momento.
- **El foco.** El anillo tiene que estar dibujado cuando llegas con el tabulador, no llegando. Quien
  navega con teclado va más rápido que cualquier transición.
- **El color del texto.** De `--dim` a `--ink`, instantáneo. Un texto que cambia de color despacio se
  lee como si todavía estuviera cargando.
- **La fila seleccionada.** El `inset 2px` de accent aparece ya puesto. Es una marca de estado, no un
  movimiento, y deslizarla entre filas sería inventar un objeto que no existe.
- **Navegar entre notas.** Abrir una nota no funde ni desliza: la nota está. Una transición de página
  son cuatrocientos milisegundos antes de poder leer, y el visor existe para leer rápido.
- **Una lista al filtrar.** Las coincidencias se sustituyen; las filas no se reordenan a la vista ni
  la caja crece. Con ochenta rutas, animar el filtrado es un baile que impide leer mientras escribes.
- **El árbol al revelar una ruta.** La rama se abre con su chevron a 120ms, pero el desplazamiento
  hasta la fila es instantáneo. Un scroll suave en una columna larga te deja mirando cómo pasan cosas
  que no te importan.
- **Los recuentos.** 417 pasa a 418 saltando. No hay contador incremental: la cifra es un dato, y
  verla subir de una en una la convierte en un espectáculo.
- **Los estados de carga.** Ni ruedas girando ni esqueletos pulsando. Se dice con texto y puntos
  suspensivos: `Guardando…`, `indexando…`. Una animación en bucle finge un progreso que nadie está
  midiendo.
- **Nada que se mueva solo.** Ningún elemento entra al hacer scroll, nada se mueve sin que lo hayas
  pulsado. Todo movimiento del visor es consecuencia de una acción tuya.

## Las reglas

1. **Tres duraciones, ni una más.** Un valor nuevo no se añade: se elige la categoría que
   corresponde. Si ninguna encaja, revisa el gesto antes que la escala.
2. **Dos curvas, cada una con su dominio.** `ease` en todo el chrome; `--t-over` solo en la capa
   flotante anclada, solo al abrir. La curva va dentro del token.
3. **Una propiedad, dos como mucho.** Preferiblemente `transform` y `opacity`. Nunca `height`, `top`
   ni `margin`: recolocan la página entera mientras dura. `width` es la excepción de la barra, y es
   una barra, no un layout.
4. **Nada se anima al cargar.** La aplicación aparece montada. Una entrada escalonada al abrir la
   página son trescientos milisegundos antes de poder leer, cada vez, para siempre.
5. **Toda transición se puede interrumpir.** Si pulsas dos veces seguidas, va al estado nuevo desde
   donde esté, sin esperar a terminar y sin encolarse. Es gratis: es lo que hace `transition` por
   defecto, y es la razón de no usar otra cosa.
6. **Ninguna librería.** Todo esto es `transition` de CSS sobre un estado de Svelte. Si un gesto pide
   una librería de animación, el gesto está fuera del sistema.
7. **`prefers-reduced-motion` siempre.** Ver paso 4.

## La excepción, y es una sola

Los documentos de investigación (`pasos/PasoN.html`, bajo el ámbito `.naeth-doc`) llevan un cursor
parpadeante detrás del prompt de terminal de la barra lateral. Es la única animación en bucle del
sistema, la única decorativa y la única que no responde a una acción. Se queda porque no está
diciendo nada sobre un cambio: está dibujando un objeto, un terminal, que en la realidad parpadea.

No cruza al visor.

⚠ **sin verificar.** No hay ni un `@keyframes` en todo `naeth/web/src`, así que ese CSS vive en el
repo público y no se ha podido leer para este documento. La regla que le falta, para quien lo toque:
con `prefers-reduced-motion: reduce`, el parpadeo **se detiene en visible** (`animation: none`, no
`animation-play-state`), porque un bucle indefinido es exactamente lo que la consulta pide apagar.

## Comprobaciones de aceptación

1. Buscar `\.\d+s` en `src/`: no debe quedar ninguna duración literal.
2. Buscar `cubic-bezier` en `src/`: solo debe aparecer en la definición de `--t-over`.
3. Con `prefers-reduced-motion: reduce` activo en el sistema operativo: el cajón funde sin
   deslizarse, el chevron salta de orientación, la barra salta a su cifra, y el popover de búsqueda
   sigue fundiendo sin subir ni escalonar.
4. Abrir y cerrar el popover de búsqueda deprisa varias veces: no se encola ni se queda a medias.
5. El popover cierra sin rebasar.
6. Nada se mueve al cargar la aplicación.

## Files

```
design_handoff_lenguaje_movimiento/
├─ README.md                          este documento
├─ lenguaje-de-movimiento.png         la especificación en estático
└─ spec/
   ├─ Lenguaje de movimiento.dc.html  la especificación viva, ábrela en un navegador
   └─ support.js                      runtime, no es diseño
```

## Ficheros del repo que se tocan

| Fichero | Qué |
|---|---|
| `src/app.css` | Los cuatro tokens y el bloque de `prefers-reduced-motion` |
| `src/components/Sidebar.svelte` | Tokenizar `.chev` (línea 142) y `.sidebar` (línea 167) |
| `src/views/Estado.svelte` | Tokenizar `.est-bar > i` (línea 169) |
| `src/components/Header.svelte` | `.searchpop`: entrada con `--t-over`, escalonado de filas |
| `tokens/shape.css` (design system) | Añadir `--t-over` junto a los otros tres |
