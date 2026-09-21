# Animación en código: el medio web entero, Anime.js 4.5 por dentro, y el libro de CDA como caso

**Abierto el 19/09/2026, 14:20.** Investigación previa a rehacer la transición 5 de CodeDoc Archive
(sacar el libro de la pila), y a la vez la base de animación para Naeth, NewCo y `yo_soy_sanas`.
Plan aprobado por Eneko a las 14:10 (`~/.claude/plans/shimmering-enchanting-horizon.md`).

**Por qué existe.** El 18/09 se hicieron dos prototipos de la transición 5 leyendo un cuarto de
Anime.js en una hora ([anexo N de la discovery de CDA](cda-vista-diseno-2026-09-15.md)), y Eneko los
rechazó por los cuatro frentes: la caja no parece un libro, el movimiento es rígido, los tiempos y el
orden no convencen, y la pila y el hueco no funcionan. Su conclusión: investigar «en condiciones», y
al reencuadrar hoy: **el objeto es la animación en código en general, con Anime.js como referente y
estudiado entero; el libro es el caso aplicado, no el fin. No hay piedra que dejar levantada.**

**Lo que ya está decidido y aquí no se reabre.** Que Anime.js entra en Naeth como banco de prácticas
(24/08, [`stack-diseno-animacion.md`](stack-diseno-animacion.md) §5 bis) con cuatro condiciones: el
chrome del visor sigue en CSS con sus tokens, la llamada va dentro de `$effect` con limpieza, guarda
de `prefers-reduced-motion` antes de disparar, importar por subruta y medir. La regla de los 144 Hz
(anexo M: solo `transform` y `opacity` por fotograma, sombra aparte, `scale()` para crecer). Un objeto
por libro (anexo N). 840 ms ida / 560 vuelta para la 5.

**Criterio de éxito**, declarado antes de empezar: (a) cada técnica del medio tiene una entrada
«para qué sirve, para qué no, coste» y un lab que corre; (b) los módulos de Anime.js 4.5 tienen
ejemplo que corre y entrada en la skill con `fichero:línea`; (c) el peso tree-shaken está medido con
cifra; (d) Eneko ha visto cada lab y ha dicho qué le sirve; (e) la 5 queda escrita fase a fase con
números elegidos viendo, para que el prototipo v3 sea ejecución y no exploración.

**Sobre los tiempos.** Las estimaciones del plan eran en horas de persona; el «real» de cada fase
es la hora del commit que la cierra (reloj de la máquina), y no incluye el tiempo de Eneko mirando los
labs, que es la parte que decide. Se apunta así para no inventar horas.

**Cómo leer las citas.** `src/x/y.js:NN` es el código de `juliangarnier/anime` en el tag v4.5.0
(descargado entero al scratchpad de la sesión el 19/09: 70 ficheros, 13.756 líneas). Lo que no se ha
ejecutado lleva `⚠ sin verificar`. El soporte de navegadores lleva fecha.

Entregables: este documento; el laboratorio en [`../lab/animacion/`](../lab/animacion/) (`web/`
por técnica, `animejs/` por módulo); la skill `~/.claude/skills/animejs/`; la revisión de
`craft-ui/references/animation-guide.md`; el anexo O de la discovery de CDA con el storyboard de la 5.

---

## 0 · Preparación (19/09; estimado 30 min; real: del plan aprobado a las 14:10 al commit `861fdca` de las 14:20)

### 0.1 El mapa real de Anime.js 4.5.0

`src/index.js` reexporta doce módulos y expone tres como espacio de nombres además de sueltos
(`easings`, `utils`, `svg`, `text`; `waapi` solo como espacio de nombres). El `package.json` declara
**21 subrutas** de import, y esa lista es la que decide el tree-shaking:

```
animejs            animejs/timer        animejs/animation    animejs/timeline
animejs/animatable animejs/draggable    animejs/scope        animejs/engine
animejs/events     animejs/layout       animejs/easings      animejs/easings/eases
animejs/easings/linear  animejs/easings/steps  animejs/easings/irregular  animejs/easings/spring
animejs/utils      animejs/svg          animejs/text         animejs/waapi
animejs/adapters   animejs/adapters/three
```

Dos módulos que **no estaban en el temario del plan** y entran:

- `src/adapters/three/` (8 ficheros): adaptador para animar objetos de Three.js (`Object3D`,
  uniforms) con el mismo `animate`. Es la respuesta de Anime al 3D real; el 3D de CSS no lo toca.
- `src/text/scramble.js`: `scrambleText`, además de `splitText` (`src/text/split.js`).

Y `src/animation/additive.js` + `src/animation/composition.js`: la composición de animaciones
concurrentes sobre el mismo target es un módulo propio, no un parámetro más. Es lo que decide qué
pasa cuando un clic interrumpe la transición 5 a medias.

Tamaño por módulo (líneas de `src/`, para saber dónde está la complejidad):

| Módulo | Líneas | Módulo | Líneas |
|---|---:|---|---:|
| `core/` (clock, colors, render, styles, targets, transforms, units, values) | 1.917 | `waapi/` | 623 |
| `layout/` | 1.612 | `easings/` (7 familias) | 641 |
| `draggable/` | 1.286 | `timer/` | 530 |
| `animation/` (+ additive, composition) | 1.275 | `timeline/` | 461 |
| `adapters/` (three) | 1.176 | `svg/` | 291 |
| `events/` (scroll) | 988 | `scope/` | 259 |
| `utils/` | 840 | `engine/` | 183 |
| `text/` (split, scramble) | 800 | `animatable/` | 161 |

(`wc -l` sobre el árbol descargado.) Dos sorpresas: `layout/` es el segundo módulo más grande de
la librería, y `events/` (scroll) casi dobla a `timeline/`. La timeline, que es lo que se usa más,
son 461 líneas: se lee entera.

### 0.2 El entorno donde se mide

- **Helium** 0.17.1 sobre **Chromium 153.0.8010** (`chrome.exe` en
  `%LOCALAPPDATA%\imput\Helium\Application`; hay una 0.17.2 descargada pendiente de aplicar).
  Todo lo moderno está: scroll-driven, View Transitions, `@starting-style`, Long Animation Frames.
- **El navegador integrado de Claude Desktop** es Chromium **152** (`Claude/2.2553.1`). Vale para
  ejecutar y leer cifras, pero su panel mide 985×907 y no es la pantalla de 2560×1440 a 144 Hz: las
  cifras que decidan algo se toman en Helium en la principal.
- Los monitores: 2560×1440 a 144 Hz (principal), 1920×1080 (secundaria).
- ⚠ El panel integrado pinta un fichero local como instantánea `data:` y **no carga los `.js` y
  `.css` relativos**. Por eso el laboratorio se sirve por HTTP: `lab-animacion` en
  `.claude/launch.json` (`python -m http.server 5181 --directory docs/lab`; ese fichero no está versionado, cae bajo el `*.json` del `.gitignore`), y las páginas se abren
  en `http://localhost:5181/animacion/...`. El lab de Svelte va aparte, en `naeth/web/bench/`,
  servido por Vite en el 5180 (`/bench/<x>.html` con su `.ts` al lado, como los bancos del grafo).

### 0.3 El medidor y la plantilla

[`00-medidor.js`](../lab/animacion/00-medidor.js): mide **fotogramas perdidos**, no fps de media.
Un contador de fps a 144 marca 140 y esconde un tirón de 40 ms cada dos segundos, que es justo lo
que se nota en una transición. Estima el periodo del monitor con la mediana de los intervalos del
primer segundo (no hay API que lo diga), cuenta como perdido cada fotograma cuyo intervalo pasa de
1,5 periodos, guarda el peor, y si el navegador trae `long-animation-frame` (Chromium 123+) cuenta
también los fotogramas largos del hilo principal. `Meter.begin('nombre')` y `Meter.end()` acotan
una animación y devuelven su resumen.

Primera medida, en el navegador integrado, con la plantilla (una caja 600 px por WAAPI nativa,
840 ms): **145 Hz estimados, 120 fotogramas, 1 perdido, peor 13,9 ms, 0 LoAF**. El «1 perdido» es el
primer fotograma tras el clic, cuando se crea la animación: se verá en todos los labs y hay que
descontarlo o mirar si desaparece con `will-change`.

[`00-lab.js`](../lab/animacion/00-lab.js): la barra común (velocidad 0,25× a 4×, interruptor de
reduced-motion **simulado** con `data-reduced` en `<html>`, reset del medidor, pie con el navegador y
el viewport). [`00-lab.css`](../lab/animacion/00-lab.css): la mesa oscura de CDA y la caja
«pregunta aislada», que va arriba en cada lab para que Eneko responda sí o no.
[`00-plantilla.html`](../lab/animacion/00-plantilla.html): el esqueleto que se copia.

---

## 1 · Fundamentos del movimiento (19/09; estimado 1 h; real: commit `2df159e` a las 14:23)

Lo que dicen las fuentes, reducido a reglas que se puedan comprobar en un lab, y para cada una qué
prototipo del 18/09 la rompía. Fuentes leídas hoy: los tokens de movimiento de **Material 3** en su
código (`material-components/material-web`, `tokens/versions/v0_192/_md-sys-motion.scss`), la
**HIG de Apple** (`developer.apple.com/design/human-interface-guidelines/motion`, con cambios hasta
el 09/09/2025), **Josh Comeau**, «A Friendly Introduction to Spring Physics» (actualizado el
03/11/2025), **Emil Kowalski**, «Great Animations» (`emilkowal.ski/ui/great-animations`), e **Issara
Willenskomer**, «The UX in Motion Manifesto» (Medium, 2017). Los libros de Val Head («Designing
Interface Animations», 2016) y Rachel Nabors («Animation at Work», 2017) se citan de memoria,
⚠ sin cita textual verificada hoy.

### 1.1 Doce reglas

| # | Regla | Fuente | Qué rompía el 18/09 |
|---|---|---|---|
| 1 | **El movimiento explica un cambio; si no hay nada que explicar, no hay movimiento.** Nada de animar por animar, y nada en acciones frecuentes o lanzadas por teclado. | Apple HIG («Add motion purposefully»); Kowalski («never animate keyboard initiated actions»); el propio handoff del visor del 23/08 | Nada: sacar un libro es un cambio de escena que merece explicarse |
| 2 | **Ease-out para lo que responde a la mano, ease-in para lo que se va, ease-in-out para lo que se mueve entre dos sitios visibles.** El ease-out «empieza rápido y frena»: da sensación de respuesta inmediata. Lineal solo para valores continuos (progreso, color) y para el desplazamiento de un scroll. | Kowalski; Material 3 (`emphasized-decelerate` para entrar, `emphasized-accelerate` para salir); Willenskomer, principio 1 («when to use easing? Always») | Los dos prototipos usaban **una sola curva** (`cubicBezier(.22,.8,.2,1)`, un ease-out) para todas las fases, incluida la vuelta a la pila, que es una salida y pedía acelerar |
| 3 | **Las curvas con nombre y número, no a ojo.** Material 3: `standard` `cubic-bezier(0.2,0,0,1)`, `standard-decelerate` `(0,0,0,1)`, `standard-accelerate` `(0.3,0,1,1)`; `emphasized-decelerate` `(0.05,0.7,0.1,1)`, `emphasized-accelerate` `(0.3,0,0.8,0.15)`. Apple no publica curvas: usa muelles. | `_md-sys-motion.scss` (leído en el repo el 19/09) | El `(.22,.8,.2,1)` del prototipo está entre `standard` y `emphasized-decelerate`; no era malo, era **único** |
| 4 | **Duración según lo que recorre y lo que ocupa.** Material 3: `short` 50 a 200 ms (cambios pequeños en el sitio), `medium` 250 a 400 (lo que entra o sale, lo que cambia de forma), `long` 450 a 600 (transiciones de pantalla o de elementos grandes), `extra-long` 700 a 1000 (solo con `emphasized`, para cambios de toda la pantalla). Kowalski: «usually shorter than 300 ms» para lo que responde a un clic. | `_md-sys-motion.scss`; Kowalski | Los 840 ms que Eneko eligió viendo (anexo N) caen en `extra-long`, que Material reserva para lo que cambia toda la pantalla **con curva emphasized**. Es coherente: sacar el libro cambia toda la escena. Los 380 del anexo M eran `medium`, y se sintieron rápidos |
| 5 | **Solapar, no encadenar.** Las fases de un gesto se pisan: lo siguiente empieza antes de que lo anterior termine. Encadenadas parecen una máquina de estados; solapadas, un movimiento. Disney lo llama «follow through and overlapping action». | Willenskomer, principio 2 (Offset & Delay, «influenced by Follow Through and Overlapping Action»); Disney (Thomas y Johnston, 1981) | **Los dos prototipos encadenaban**: sale (0 a 180) → se levanta (180 a 340) → gira (340 a 580) → crece (580 a 840). Ninguna fase empezaba antes de acabar la anterior. Es el «rígido o mecánico» que dijo Eneko |
| 6 | **Anticipación y remate.** Un objeto que va a moverse se prepara un poco en sentido contrario, y al llegar rebasa un poco y vuelve. En UI, mínimos: la anticipación es un retroceso de unos píxeles y el remate lo da la curva (rebasamiento) o el muelle. | Disney («anticipation», «follow through»); Comeau (muelle: «slows to a stop in a way that CSS transitions can't replicate») | Ninguna anticipación (el libro salía de la pila sin «cogerlo»), ningún remate (llegaba seco a la portada y seco a la pila) |
| 7 | **Arcos.** Lo que se mueve de un sitio a otro por una mano va en curva, no en línea recta. Dos ejes con curvas distintas (x con ease-out, y con ease-in-out) ya dan un arco. | Disney («arcs») | La caja iba en recta de la pila al centro |
| 8 | **Acción secundaria: el entorno reacciona.** Cuando un objeto sale, lo que le rodea se recoloca, se atenúa o se aparta, y lo hace con su propia curva y un poco después. | Disney («secondary action»); Willenskomer, principios 2 y 3 (Offset & Delay; Parenting) | La pila solo bajaba a opacidad 0,1 y se quedaba con el hueco fijo. No se cerraba, no se abría, no reaccionaba al aterrizaje |
| 9 | **Escenificación: en cada momento el ojo mira a un sitio.** Una transición larga con tres cosas cambiando a la vez no se lee. Se decide qué es lo protagonista en cada tramo y lo demás se subordina. | Disney («staging»); Apple («brevity and precision») | En el giro sobre el lomo el libro crecía y giraba a la vez con la solapa entrando: tres protagonistas |
| 10 | **Muelle frente a bezier.** Un muelle se define por masa, rigidez y amortiguación, **no por duración**: la duración sale de la física, y el movimiento hereda la velocidad con la que llega (interrupciones limpias). Para lo que responde a la mano y para aterrizar, muelle; para color y opacidad, bezier. | Comeau (mass, tension, friction; «I wouldn't use them for color or opacity»); Kowalski («play around with spring animations») | Todo era bezier con duración fija; el aterrizaje en la pila era `reverse()` de la ida, sin peso |
| 11 | **Interrumpible siempre.** Un clic a mitad no espera: la animación toma el estado actual y va al nuevo destino con la velocidad que llevaba. Las `transition` de CSS lo hacen solas; las `@keyframes` no; en JS lo decide el modo de composición. | Kowalski («interruptible»); Apple («Let people cancel motion»); decisión propia del 17/09 (navegación D) | El prototipo Anime.js hacía `reverse()`, que sí es interrumpible; el CSS por clases reiniciaba la transición desde el estado de la clase |
| 12 | **Reduced-motion siempre, y no es «sin animación»: es sin desplazamiento ni giro.** Se queda el fundido; se va el movimiento. Y nunca es la única vía de comunicar algo. | Apple («Make motion optional»); Kowalski (`prefers-reduced-motion` → fundido); handoff del visor 23/08 | El prototipo CSS tenía el fundido de 120 ms; el de Anime.js no tenía guarda |

### 1.2 Lo que añade Willenskomer y no está en Disney

Los 12 principios de Disney (1981) son para **dibujos que gustan**; los 12 de UX in Motion (2017) son
para **interfaces que se entienden**, y solo dos de los suyos vienen de Disney (easing, y offset &
delay). Los que importan para el libro:

- **Tiempo real frente a no tiempo real.** Mientras el ratón está sobre la pila y el libro se
  desliza 28 px (hover), es tiempo real: el objeto sigue a la mano. Desde el clic hasta la portada
  es no tiempo real: «bloquea brevemente al usuario hasta que la transición termina». Por eso la
  regla 11: cuanto antes se pueda cancelar, mejor.
- **Dimensionality**, en su forma «Object Dimensionality»: «múltiples capas 2D dispuestas en el
  espacio 3D forman objetos con volumen real», y su utilidad es que el usuario entiende la
  utilidad del objeto por sus caras no visibles. Es exactamente la caja del libro: si el lomo, la
  tapa y el canto no se ven como caras de un mismo volumen, el principio no funciona, y eso es lo
  que Eneko llamó «la caja no parece un libro».
- **Dolly & Zoom**: crecer hasta la portada es un dolly (el objeto se acerca), no un zoom. Con
  `perspective` correcta las dos cosas se ven distintas; con la perspectiva de 5200 px del
  prototipo (casi ortográfica) se ven iguales, y el libro parecía un recorte que se agranda.
- **Parenting**: la solapa que entra a la derecha es hija del libro, no un elemento aparte con su
  propia animación: su posición sale de la del libro.

### 1.3 Lo que se lleva al laboratorio

Cada regla se convierte en una pregunta aislada de un lab: la 2 y la 3 en `03-easings` (la misma
caja con ocho curvas, incluidas las cinco de Material y dos muelles); la 5 en `07-timeline` (el
mismo gesto encadenado y solapado, lado a lado); la 6, la 7 y la 10 en `03-easings` y `05-pila`;
la 11 en `02-keyframes-composition` y `web/01-css-transition`; la 12 en todos, con el interruptor.
La 4 no se prueba: se decide con Material como tabla y el ojo de Eneko como juez (ya decidió 840).

### 1.4 Duración y curva de Material 3, la tabla que se usa de referencia

| Token | Valor | Uso que Material le da |
|---|---|---|
| `duration-short1..4` | 50, 100, 150, 200 ms | Cambios pequeños y en el sitio: un interruptor, un icono |
| `duration-medium1..4` | 250, 300, 350, 400 ms | Lo que entra o sale, lo que cambia de forma dentro de una pantalla |
| `duration-long1..4` | 450, 500, 550, 600 ms | Elementos grandes, transiciones entre pantallas |
| `duration-extra-long1..4` | 700, 800, 900, 1000 ms | Solo con `emphasized`: cambios que afectan a toda la pantalla |
| `easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Lo normal: mover entre dos sitios visibles |
| `easing-standard-decelerate` | `cubic-bezier(0, 0, 0, 1)` | Entrar |
| `easing-standard-accelerate` | `cubic-bezier(0.3, 0, 1, 1)` | Salir |
| `easing-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` en el token; en la spec es una curva partida que el token no representa | Lo que merece atención |
| `easing-emphasized-decelerate` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Entrar con énfasis |
| `easing-emphasized-accelerate` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Salir con énfasis |

(Los `legacy` `(0.4,0,0.2,1)` y sus variantes son Material 2; se citan para reconocerlos, no para
usarlos.) El handoff del visor usa `ease` (`cubic-bezier(0.25,0.1,0.25,1)`) y `--t-over`
`(.34,1.56,.64,1)`; no se toca, pero se sabe dónde cae: `ease` es un `standard` suave.

## 2 · El medio: con qué se anima en la web (19/09; estimado 2 h 30; real: commit `35e44b9` a las 14:35, sin contar lo que tarde Eneko en mirar los labs)

Soporte de navegadores: paquete `web-features` (1.210 entradas, descargado de jsDelivr el 19/09/2026);
«Baseline» es su vocabulario (fecha en que la última de las tres familias lo tuvo). Lo que importa
aquí es Chromium (Helium, y el visor se usa ahí), y se anota lo que Firefox y Safari no tienen para
el día que Naeth sea producto. Tamaños: `gzip -9` sobre el bundle de jsDelivr, medidos hoy.

### 2.1 CSS

**`transition`** (Baseline 2015). La forma más barata de animar un cambio de estado: se declara qué
propiedad, cuánto y con qué curva, y el navegador interpola cada vez que el valor cambia. Dos
propiedades que la hacen distinta de todo lo demás: **es interrumpible sola** (si el valor vuelve a
cambiar a mitad, la nueva transición arranca desde el valor computado actual, con continuidad) y
`transform` y `opacity` van al compositor. Lo que no da: secuencias (más de un paso), control de
tiempo (pausar, invertir, scrubber), y hasta 2024 no valía para `display`. Hoy sí:
**`transition-behavior: allow-discrete`** (Baseline agosto 2024: Chrome 117, Firefox 129, Safari
17.4) permite transicionar `display` y `content-visibility`, con la regla de que al entrar el
`display` cambia al 0 % y al salir al 100 %, para que el elemento esté visible toda la transición;
y **`@starting-style`** (misma fecha, Safari 17.5) da el estado de partida a un elemento que acaba
de aparecer, que es lo que faltaba para que una entrada tuviera transición. El visor ya lo usa
(`Header.svelte:155-157`, desde `fe38975`). Lab [`web/01`](../lab/animacion/web/01-css-transition.html):
la misma caja por `transition` y por `@keyframes` interrumpidas a mitad, y una tarjeta con
`display:none` real que entra y sale sin JS.

**`@keyframes` + `animation`** (Baseline 2015). Varios pasos, repeticiones, dirección alterna,
`fill`. Lo que no da: interrupción con continuidad (quitar la clase reinicia), y por defecto dos
animaciones sobre la misma propiedad se pisan. **`animation-composition`** (Baseline julio 2023:
Chrome 112, Firefox 115, Safari 16) cambia eso: `add` suma, `accumulate` acumula. Es la respuesta de
CSS al problema que tendrá el libro cuando dos cosas toquen `transform` a la vez; la otra respuesta
son las propiedades individuales `translate`, `rotate`, `scale` (Baseline agosto 2022), que se
animan por separado sin pisarse. **`@property`** (Baseline julio 2024: Chrome 85, Firefox 128,
Safari 16.4) registra una variable con tipo, y con eso una `--variable` se interpola en vez de
saltar: sirve para animar un ángulo o un color que después usan varias reglas. **`linear()`**
(Baseline diciembre 2023: Chrome 113, Firefox 112, Safari 17.2) admite una curva de muchos puntos, y
con eso **un muelle muestreado cabe en CSS puro** (Comeau, «Springs and Bounces in Native CSS»): se
simula el muelle en JS una vez, se sacan 60 puntos, y el resto es `transition`. Lab
[`web/02`](../lab/animacion/web/02-css-keyframes.html): las cuatro cosas en cuatro filas; el muelle
`linear()` (stiffness 170, damping 14) sale con 61 puntos y 1.117 ms hasta asentarse, al lado del
`cubic-bezier(.34,1.56,.64,1)` del visor para ver la diferencia entre un rebote de física y uno
dibujado.

**3D** (`perspective`, `transform-style: preserve-3d`, `backface-visibility`, `rotateX/Y/Z`,
`translateZ`; Baseline 2022). Es CSS y solo CSS: ninguna librería aporta nada aquí salvo mover los
ángulos. Se estudia en la fase 8 con la caja del libro; lo que hay que saber ya es que
`perspective` va en el **padre** (o como función dentro del `transform` del propio elemento, con
efecto distinto), que `preserve-3d` hay que repetirlo en cada nivel anidado, y que el 5200 px del
prototipo del 18/09 es casi ortográfico (Willenskomer, «dolly» frente a «zoom», §1.2).

**Scroll-driven** (`animation-timeline: scroll()` / `view()`, `scroll-timeline-name`,
`view-timeline-name`, `animation-range`, `timeline-scope`). **No es Baseline**: Chrome 115, Safari
26, **Firefox no** (a 19/09/2026). La animación no avanza con el tiempo sino con el scroll de un
contenedor (`scroll()`) o con la visibilidad de un elemento en él (`view()`); `animation-duration`
deja de contar y el easing por defecto es lineal respecto al scroll. Sin un listener, sin JS por
fotograma, y en Chromium en el compositor si solo toca `transform`/`opacity` (⚠ esto último es
conocimiento de la implementación, no lo dice MDN). El gemelo en JS es `new ScrollTimeline({source,
axis})` y `new ViewTimeline({subject, axis, inset})` pasados como `timeline` a `element.animate`.
Para CDA: el minimapa del libro y cualquier «al pasar por aquí, X». Lab
[`web/03`](../lab/animacion/web/03-scroll-driven.html): dos columnas iguales, una por CSS y otra
por JS+WAAPI, con barra de progreso y tarjetas que entran por `view()`.

**View Transitions** (`document.startViewTransition(cb)`; Baseline octubre 2025: Chrome 111,
Firefox 144, Safari 18; entre documentos con `@view-transition { navigation: auto }` solo Chrome
126 y Safari 18.2). El navegador captura una instantánea del estado viejo, deja que el callback
cambie el DOM como quiera, captura el nuevo, y anima entre los dos con un árbol de pseudoelementos
(`::view-transition-group(nombre)` → `-image-pair` → `-old` y `-new`). Lo que tiene
`view-transition-name` se anima por separado: el grupo interpola tamaño y posición, y las dos
imágenes se funden. Se personaliza con `@keyframes` sobre los pseudoelementos, o desde JS tras
`transition.ready` con `element.animate(..., { pseudoElement: '::view-transition-new(root)' })`.
Lo que hace bien: continuidad entre dos DOM que no tienen nada que ver, sin calcular nada. Lo que
no puede: **las instantáneas son imágenes planas**; no hay caras ocultas, no hay 3D, y el objeto
que «vuela» es una foto que cambia de tamaño. Para el libro sirve donde hay un cambio de vista
(portada → índice → página), no para el vuelo. Lab
[`web/04`](../lab/animacion/web/04-view-transitions.html): la pila y la portada como dos DOM
distintos, con el lomo de Naeth y la portada compartiendo `view-transition-name: naeth`, para ver
exactamente cómo se ve «una foto que se estira».

**`prefers-reduced-motion`** (Baseline 2020). Media query en CSS y `matchMedia` en JS. Ninguna de
las técnicas de esta sección la respeta sola: hay que escribirlo. El visor lo hace por tokens
(`app.css:192-245`); el grafo por JS (`Canvas.svelte:119-120`).

### 2.2 WAAPI nativa (Web Animations API)

Baseline 2020 (Chrome 84, Firefox 75, Safari 14). `element.animate(keyframes, opciones)` devuelve
un objeto `Animation` con todo lo que a CSS le falta: `play()`, `pause()`, `reverse()`,
`finish()`, `cancel()`, `currentTime` (el scrubber), `playbackRate` y `updatePlaybackRate()`, las
promesas `ready` y `finished`, `playState`. Los keyframes van como array de objetos (con `offset`
opcional) o como objeto de arrays. Opciones: `duration`, `delay`, `easing` (**por defecto
`linear`**, no `ease` como en CSS), `iterations`, `direction`, `fill`, **`composite`**
(`replace`, `add`, `accumulate`: dos animaciones sobre `transform` a la vez se suman con `add`),
`pseudoElement`, y `timeline` (para scroll-driven). `document.getAnimations()` da todas las vivas
(sirve para bajarlas todas a la mitad con reduced-motion, o para pausarlas al ocultar).

Dos cosas que MDN dice y conviene grabarse:

- **`fill: 'forwards'` indefinido está desaconsejado**: la animación queda viva ocupando memoria
  y su estilo manda sobre el CSS del elemento. La forma correcta de dejar el estado final es
  `onfinish: () => { anim.commitStyles(); anim.cancel(); }`: escribe el valor computado en
  `style` y quita la animación. El navegador además **retira solas** las animaciones `fill` que
  otra posterior tapa del todo (`replaceState: 'removed'`), salvo que se llame a `persist()`.
- Es «una de las formas más eficientes de animar en la web» porque `transform` y `opacity` van al
  compositor: **con el hilo principal bloqueado, la animación sigue**. Lab
  [`web/05`](../lab/animacion/web/05-waapi-nativa.html): la misma caja por WAAPI y por rAF con
  el mismo bezier resuelto a mano, y un botón que bloquea el hilo 40 ms de cada 50 durante 3 s.
  Con `reverse()`, `pause`, scrubber por `currentTime`, y `composite: 'add'`.

Todo lo que hacen Anime.js `waapi`, Motion y las transiciones `css` de Svelte es construir encima
de esto. Lo que WAAPI no tiene: timeline de varias animaciones con posiciones relativas (hay que
calcular los `delay` a mano), muelles (solo `linear()` muestreado, igual que en CSS), stagger,
valores que no sean propiedades CSS, y callbacks por fotograma (no hay `onUpdate`: si hace falta,
es rAF leyendo `currentTime`).

### 2.3 `requestAnimationFrame` a mano

Sin librería, para lo que no es una propiedad CSS: canvas, un número en pantalla, la física de un
arrastre, o cuando hay que decidir algo en cada fotograma. Tres reglas, las tres en el lab
[`web/06`](../lab/animacion/web/06-raf.html) una al lado de otra: **nunca «x += 4 por fotograma»**
(a 144 Hz va 2,4 veces más rápido que a 60), sino `x = f(t)` con el tiempo real; **la física a paso
fijo con acumulador** (simular a 240 Hz en pasos de 1/240 s las veces que haga falta por fotograma,
e interpolar el resto), que es lo que hacen Anime.js `createSpring` y `svelte/motion`; y **el bucle
se apaga solo** cuando nada se mueve, como `Canvas.svelte:122-131`. Con el hilo ocupado, todo lo
que va por rAF se atasca: es el precio, y por eso el vuelo del libro no va por aquí.

### 2.4 Svelte 5, lo que trae de serie

Banco [`naeth/web/bench/motion.html`](../../naeth/web/bench/motion.html) (`MotionLab.svelte`,
sirve Vite en el 5180; compila con `svelte-check` a 0 errores). Cuatro bloques:

- **`transition:` / `in:` / `out:`** (`svelte/transition`: `fade`, `blur`, `fly`, `slide`,
  `scale`, `draw`, `crossfade`). Solo corren cuando el elemento **entra o sale del DOM** por un
  `{#if}` o `{#each}`; no sirven para mover algo que se queda. `transition:` es bidireccional:
  invertida a mitad toma el estado actual. Una transición propia devuelve `{delay, duration,
  easing, css(t, u), tick(t, u)}`; **con `css` Svelte muestrea la función, genera keyframes y la
  ejecuta el navegador** (la doc: «web animations can run off the main thread»), con `tick` la
  llama en cada fotograma por rAF. Bloque 4 del banco: el mismo giro por las dos vías con el hilo
  ocupado. Modificador `|global` para que corra también cuando es el padre el que se crea.
- **`animate:flip`** (`svelte/animate`): en un `{#each}` con clave, cuando la lista se reordena
  cada elemento va de su sitio viejo al nuevo por `transform` (First, Last, Invert, Play). Bloque
  2: la pila de lomos, pulsar uno lo manda al final y los demás bajan. **Es la pila de CDA
  recolocándose a 0 KB**, y lo que `createLayout` de Anime.js hace con más opciones (fase 5).
- **`Tween` y `Spring`** (`svelte/motion`, clases desde 5.8.0; `tweened()` y `spring()` están
  deprecados): un valor que persigue a `target` y expone `current`. `Tween` con `duration`,
  `easing`, `delay`, `interpolate`; `Spring` con `stiffness`, `damping`, `precision`
  (adimensionales, 0 a 1: **no son los de Anime.js ni los de Comeau**) y `set(v, {instant,
  preserveMomentum})`. Los dos escriben el DOM por rAF: hilo principal. Bloque 3.
- **Reduced-motion**: nada de esto lo mira solo. El banco lo imprime arriba y lo tendría que
  aplicar el componente.

Lo que cierra esto respecto al 24/08: la doctrina «primero Svelte» es correcta para **entrar y
salir** (transiciones), **recolocar listas** (`flip`) y **valores que persiguen** (`Spring`,
`Tween`); no cubre secuencias con solape, scrubber, ni un objeto que se mueve sin entrar ni salir
del DOM. Eso es donde entra WAAPI directa o Anime.js.

### 2.5 Librerías y formatos, comparados

| | Versión | Licencia | gzip del bundle completo | Qué da que las otras no |
|---|---|---|---:|---|
| **Anime.js** | 4.5.0 | MIT | **40,6 KB** (`anime.umd.min.js`; la 4.3.6 daba 36,9 el 24/08: ha crecido con `layout`, `adapters` y `scramble`) | Timeline con posiciones relativas, muelles, SVG (morph, draw, motion path), texto, scroll, draggable, layout FLIP, adaptador Three.js; y una vía `waapi` que delega en el navegador. 21 subrutas para tree-shaking |
| **GSAP** | 3.15.0 | «Standard no-charge» (desde la compra por Webflow; todos los plugins incluidos) | **28,3 KB** (`gsap.min.js`, sin plugins) | ScrollTrigger, Flip, MorphSVG, SplitText, Draggable, MotionPath como plugins; el ecosistema y las 9 skills que ya tengo archivadas en `~/.claude/skills-archive/gsap-*`. Todo por su motor JS (rAF): nada en el compositor |
| **Motion** (antes Motion One + Framer Motion) | 13.4.0 | MIT | **48,8 KB** (`motion.js` UMD completo, vanilla) | Construido sobre WAAPI («hardware accelerated»), API mini `animate` de pocos KB (cifra del fabricante, no medida), layout animations y gestos en React. Es la librería de GridWatch hoy (`framer-motion@12`) |
| **dotLottie** (`@lottiefiles/dotlottie-web`) | 0.80.0 | MIT | **32,8 KB** + el wasm del reproductor (no medido) | Reproduce lo que un diseñador exporta de After Effects. No es para UI: es para ilustración animada |
| **Rive** (`@rive-app/canvas-lite`) | 2.42.2 | MIT (runtime) | **93 KB** (`rive.js` con el wasm embebido) | Máquinas de estado dibujadas en su editor, con entradas desde código. Para personajes y piezas interactivas de diseñador, no para transiciones de interfaz |
| `@formkit/auto-animate` | 0.10.0 | MIT | 3,2 KB (Bundlephobia) | Una línea para animar añadir, quitar y mover hijos. Lo que hace `animate:flip` ya |
| `@react-spring/web` | 10.1.2 | MIT | 20,1 KB (Bundlephobia) | Muelles en React. No aplica a Svelte |
| Theatre.js, Popmotion, Velocity, Anime v3 | | | | Theatre es un editor de secuencias para cinemáticas; los otros tres son legado sin desarrollo. Se nombran para reconocerlos |
| Three.js (y R3F) | | | | 3D real con WebGL. Fuera de alcance: el libro es CSS 3D. Anime.js 4.5 tiene adaptador para cuando llegue |

Bundlephobia da 40.279 B gzip para `animejs@4.5.0` y 27.350 para `gsap@3.15.0`, coherente con lo
medido. Todo lo tree-shaken sigue sin medir hasta la fase 6.

### 2.6 La tabla de decisión por tarea

Es lo que pasa a `craft-ui/references/animation-guide.md` (fase 7). Orden de preferencia de arriba
abajo dentro de cada fila: lo primero que baste, gana.

| Tarea | Con qué | Por qué no lo siguiente |
|---|---|---|
| Un elemento cambia de estado en el sitio (color, giro de un chevron, escala al pulsar) | `transition` CSS con token | Todo lo demás es más caro para lo mismo |
| Algo aparece o desaparece (popover, tarjeta, cajón) | `transition` + `@starting-style` + `allow-discrete`; en Svelte, `transition:` si lo gobierna un `{#if}` | `@keyframes` no se invierte a mitad |
| Una lista se reordena, entra o sale un elemento | `animate:flip` en Svelte; `auto-animate` en vanilla | `createLayout` de Anime.js solo si hace falta cambiar de padre o entrar desde un punto concreto |
| Un valor numérico se mueve (contador, barra) | `Tween` de Svelte; `animation` CSS con `@property` si es puro CSS | |
| Un valor persigue a la mano (arrastre, hover que sigue, física) | `Spring` de Svelte o `createSpring`/`createAnimatable` de Anime.js | CSS no tiene muelles vivos: solo uno muestreado con `linear()`, que no hereda velocidad |
| Algo avanza con el scroll | `animation-timeline` CSS (Chromium y Safari); Anime.js `onScroll` cuando haga falta Firefox o lógica | Un listener de scroll con rAF es lo que se quiere evitar |
| Cambio de vista completo (de pantalla A a B con continuidad) | View Transitions | Solo si el objeto no necesita 3D ni caras ocultas |
| Un objeto se mueve en secuencia de varias fases con solape, scrubber e inversión | Anime.js `createTimeline` con `waapi.animate` para `transform`/`opacity` | WAAPI sola obliga a calcular delays a mano; CSS no da scrubber ni inversión |
| Objeto 3D con caras | CSS 3D para la geometría; la timeline anterior para moverla | Ninguna librería hace la geometría |
| Muelle en el aterrizaje o rebote con peso | `createSpring` de Anime.js (o `Spring` de Svelte si es un valor) | Bezier rebasado (`--t-over`) es un dibujo, no física: vale para lo pequeño |
| Canvas, WebGL, o decidir algo por fotograma | rAF a mano con paso fijo y bucle que se apaga | |
| Ilustración animada de un diseñador | dotLottie o Rive | No para transiciones de UI |

Lo que **nunca** entra, y viene de la regla de los 144 Hz y del handoff del visor: animar `width`,
`height`, `top`, `left`, `margin`, `padding`, `box-shadow` con desenfoque grande, `filter: blur`
por fotograma; animar acciones de teclado; animar al cargar.

## 3 · Anime.js, el motor (19/09; estimado 2 h; real: commit `ff10113` a las 14:43)

Leído en `src/` de v4.5.0 y probado en seis labs (`docs/lab/animacion/animejs/01` a `06`). Todo
lo de abajo lleva `fichero:línea`.

### 3.1 Tres hallazgos que cambian lo de ayer

1. **El prototipo del 18/09 corrió con easing lineal en todas las fases.** Pasaba
   `defaults: { ease: 'cubicBezier(.22,.8,.2,1)' }` como **string**, y 4.5.0 retiró esa sintaxis:
   `src/easings/eases/parser.js:175-186` avisa por consola («String syntax for `ease:
   "cubicBezier(...)"` has been removed from the core») y **devuelve `none`, que es lineal**.
   Reproducido en el lab `01` (el aviso sale en consola). Lo mismo pasa con `steps(`, `irregular(` y
   `linear(` en string. La forma correcta: importar la función, `ease: cubicBezier(.22,.8,.2,1)`.
   Lo que sí va en string es el catálogo con nombre (`'outExpo'`, `'inOutQuad'`, `'outBack(2)'`,
   `'out(1.675)'`). Willenskomer, regla 1: el lineal «se nota, parece sin terminar, chirría»: es
   la mitad del «rígido o mecánico» de Eneko. La otra mitad es el encadenado sin solape (F1, regla 5).
2. **`createSpring()` está deprecado; es `spring()`** (`src/easings/spring/index.js:253-265`, con
   aviso). El anexo N lo recomendaba con el nombre viejo.
3. **Un muelle en 4.5 se puede definir por duración percibida y rebote**, `spring({ duration:
   840, bounce: .15 })`, con la fórmula de SwiftUI (WWDC 2023, citada en
   `spring/index.js:116-135`: stiffness = (2π/duración)², damping = (1 − bounce)·4π/duración). La
   duración real hasta asentarse la calcula el solver (`settlingDuration`, `:174-187`) y es la que
   usa la animación; con `{duration: 840, bounce: .15}` sale **1.460 ms** hasta el reposo
   (stiffness 55,95, damping 12,72), y `onComplete` del muelle salta a los 840 percibidos
   (`:82-91`). Con `{stiffness: 120, damping: 14}` salen 1.180 ms; con `{duration: 560, bounce: 0}`,
   1.100. En `animate` un muelle **ignora `duration`**: la manda él.

### 3.2 `animate(targets, params)` (`src/animation/animation.js:216-800`)

- **Targets** (`src/core/targets.js`): selector, elemento, `NodeList`, array, o **cualquier objeto
  JS** (lab `01`, fila 4: `{ n: 0 }` a 182 con `modifier: utils.round(0)`).
- **Parámetros** (`src/types/index.js:27-51`): por animación `duration`, `delay`, `loop`
  (número o `true`), `loopDelay`, `alternate`, `reversed`, `autoplay` (o un `ScrollObserver`),
  `playbackRate`, `frameRate`, `persist`, `composition`, `modifier`, `ease`; y **cada propiedad
  puede llevar los suyos**: `translateX: { to: 600, duration: 840, ease: 'outExpo' }`,
  `rotate: { to: '+=180', delay: 200, ease: 'outBack' }` (lab `01`, fila 3). Valores relativos
  `'+=', '-=', '*='`; `from`/`to`; unidades y colores se detectan (`src/core/values.js`,
  `colors.js`). Una función como valor recibe `(target, i, total)`.
- **Callbacks**: `onBegin`, `onBeforeUpdate`, `onUpdate`, `onRender`, `onLoop`, `onPause`,
  `onComplete`, y `then()` (promesa).
- **Keyframes**, dos formas (`animation.js:132-215`, `generateKeyframes`): **array** de pasos,
  cada uno con sus propiedades, `duration` y `ease` (`[{ x: 300, duration: 800 }, { y: -40,
  duration: 300 }, ...]`); u **objeto por porcentaje** `{ '0%': {...}, '40%': { x: 400, ease:
  'outExpo' }, '100%': {...} }` con una sola `duration`, donde el `ease` de una clave se aplica al
  tramo que **llega** a ella, como en WAAPI (`:196-203`). Lab `02`.
- **`composition`** (`src/animation/composition.js:95-270`, `composeTween`), lo que pasa cuando
  dos animaciones tocan la misma propiedad del mismo target:
  - `'replace'` (**defecto**): la nueva recorta a la anterior en el instante en que arranca
    (`:141-160`: ajusta `_changeDuration` de la anterior al punto de solape) y toma el mando
    desde el valor actual. **Es la interrupción con continuidad de la regla 11, gratis.** Si el
    target tiene 1.000 elementos o más, el defecto pasa a `'none'` por coste (`animation.js:273`).
  - `'none'`: no mira a nadie; las dos escriben y la última gana cada fotograma (tiembla).
  - `'blend'`: aditiva (`:221-260`, `src/animation/additive.js`): la nueva se **suma** a la
    anterior en una animación aparte; una vuelta a mitad de la ida dibuja un arco.
  Lab `02`: las tres con el mismo «interrumpir a mitad».
- `refresh()` relee los `from` (`:735`), `stretch(ms)` cambia la duración conservando la forma
  (`:713`), `revert()` deja el target como estaba (`:771`).

### 3.3 `createTimer` (`src/timer/timer.js:114-510`) y `createAnimatable` (`src/animatable/animatable.js:41-161`)

`Timer` es la clase base: `JSAnimation` y `Timeline` heredan de ella. Lo que da a todo: `currentTime`,
`progress`, `iterationProgress`, `currentIteration`, `reversed`, `speed` (= `playbackRate`, `:300-311`),
`paused`, `completed`, `pause()`, `resume()`, `play()`, `reverse()`, `restart()`, `seek(ms)`, `alternate()`,
`cancel()`, `stretch()`, `revert()`, `complete()`, `then()`. Detalle que importa: `reverse()` no es
«reproduce al revés» sino **`alternate()` + `resume()`** (`:442-447`): invierte la dirección en el punto
actual, así que a mitad de la ida vuelve desde ahí. Solo, `createTimer` es un reloj con `frameRate`
(lab `05`: 24 fps se ven a saltos) para lo que sea un contador o un tick.

`createAnimatable(target, { rotateY: { unit: 'deg', ease: spring(...) }, ... })` convierte cada
propiedad en un **método** `obj.rotateY(v)` que anima hacia el nuevo objetivo desde donde esté,
sin reiniciar (retarget), y sin argumentos devuelve el valor actual. Es la pieza para «un valor que
persigue a la mano», y para el **sombreado por ángulo** del libro: en `onUpdate` se lee
`tapa.rotateY()` y se escribe la opacidad de una capa de luz y otra de sombra (lab `05`). Lo único
del libro que necesita el motor JS por fotograma.

### 3.4 Easings (`src/easings/`)

- Catálogo con nombre (`eases/parser.js:43-90`): `in`, `out`, `inOut`, `outIn` × `Quad`, `Cubic`,
  `Quart`, `Quint`, `Sine`, `Circ`, `Expo`, `Bounce`, `Back(overshoot = 1.7)`, `Elastic(amplitude = 1,
  period = .3)`; y `in(p)`, `out(p)`, `inOut(p)` con potencia libre (`easeInPower`, `:34`). En string o
  como función (`eases.outExpo`).
- Funciones que hay que importar (`easings/index.js`): `cubicBezier(x1, y1, x2, y2)`, `steps(n,
  fromStart)`, `linear(...puntos)` (la misma idea que `linear()` de CSS), `irregular(length,
  randomness)`, `spring(params)`.
- `spring`: `mass` (1), `stiffness` (100), `damping` (10), `velocity` (0), o `duration` y `bounce`
  (§3.1); `settlingDuration` es la duración real. Lab `03`: el mismo desplazamiento con diez curvas
  en paralelo, incluidas las cinco de Material como `cubicBezier`, tres muelles, el lineal del
  prototipo y el `cubicBezier(.22,.8,.2,1)` bien pasado.

### 3.5 `stagger` (`src/utils/stagger.js:84-200`)

`stagger(valor | [desde, hasta], { start, from: índice | 'first' | 'center' | 'last' | 'random',
reversed, grid: [cols, filas], axis, ease, modifier, seed })` devuelve una función
`(target, i, total) => valor` y vale para cualquier parámetro, no solo `delay`. Lab `04`: la pila
cerrando el hueco con `delay: stagger(45, { start: 120 })` sobre los lomos de encima, y una rejilla
8×4 con onda desde el centro. Lo que decide el gesto es `from`, no la cifra: escalonar desde el
hueco cuenta «el hueco se cierra».

### 3.6 `utils` (`src/utils/`) y `engine` (`src/engine/engine.js`)

`utils.set(target, props)` escribe sin animar (estado inicial), `utils.get(target, prop, unidad?)`
lee con unidad (`'100px'`, `'6.25rem'`), `utils.remove(target)` mata todas las animaciones del
target (la limpieza a mano si no hay `createScope`), `utils.$` es el registro de targets,
`cleanInlineStyles`. Numéricas y **encadenables** (`chainable.js`: `utils.round(0).clamp(0, 100)`
devuelve una función): `round`, `clamp`, `snap`, `wrap`, `mapRange`, `lerp`, `damp(a, b, dt,
factor)` (interpolación independiente del refresco: la caja A del lab `web/06` hecha bien),
`degToRad`, `radToDeg`, `padStart`, `padEnd`. Aleatorias: `random(min, max, decimales)`,
`randomPick`, `shuffle`, `createSeededRandom`. Tiempo: `sync`, `keepTime`. Lab `06` imprime cada
una con su resultado.

`engine`: un solo bucle rAF para todo (`useDefaultMainLoop`, `:52`; con `false` se tickea desde
fuera con `engine.update()`), `engine.speed` (ralentí global: 0,25 deja todo el visor a cámara
lenta para revisar, lab `06`), `engine.fps` (**240 por defecto**, tope, no objetivo), `timeUnit`
(`'ms'` o `'s'`, `:128-144`), `precision` (4 decimales, `:147-152`), `pauseOnDocumentHidden`
(`:53`, true: es por lo que en el panel oculto del navegador integrado no corre nada).

### 3.7 Lo que se lleva a la skill y al libro

- Easing **siempre como función** cuando sea bezier, muelle, steps o linear; en string solo el
  catálogo. Un lint mental: si en el código hay `ease: 'cubicBezier`, está mal.
- `composition: 'replace'` es el defecto y es lo que quiere el libro para «clic a mitad»; `'blend'`
  para gestos que se suman (un salto sobre un desplazamiento).
- `spring({ duration, bounce })` para aterrizajes con duración controlada; `settlingDuration` es lo
  que hay que sumar al storyboard, no `duration`.
- `createAnimatable` + `onUpdate` para el sombreado por ángulo; nada más del libro necesita JS por
  fotograma.
- `engine.speed = .25` como modo revisión.

## 4 · Anime.js, orquestar e integrar: timeline, scope, waapi (19/09; estimado 1 h 30; real: ver el commit de cierre)

Labs `animejs/07` a `09`.

### 4.1 `createTimeline` (`src/timeline/timeline.js:137-461`, `position.js:30-75`)

Hereda de `Timer` (§3.3): todo lo de `currentTime`, `progress`, `speed`, `seek`, `pause`, `reverse`
vale igual sobre la timeline entera. Lo propio:

- **`add(targets, params, posición)`** para una animación, `add(params, posición)` para un timer
  hijo. Los `defaults` de la timeline (`ease`, `duration`...) los heredan los hijos que no digan lo
  suyo.
- **Posiciones** (`position.js:50-75`): número absoluto en ms; sin posición, al final de la
  timeline; `'<'` = **fin del último hijo añadido**; `'<<'` = inicio del último hijo; `'<-=120'`,
  `'<<+=90'`, `'+=100'` (relativo al final de la timeline), `'*=2'`; etiquetas: `tl.label('gira',
  posición)` y luego `'gira'`, `'gira+=60'`. ⚠ **`'<'` mira al último `add`, sea del target que
  sea**: en el lab `07` la atenuación de la pila añadida después del deslizamiento del libro movía la
  etiqueta siguiente 80 ms (se resolvió añadiendo la pila antes). Con etiquetas explícitas el
  problema desaparece: es la forma robusta.
- `set(targets, props, pos)` fija valores en un punto; `call(fn, pos)` llama a una función en un
  punto; `remove(targets, prop?)`; `refresh()`, `stretch(ms)`, `revert()`, `then()`.
- **`sync(animación, pos)`** (`:268-287`): mete en la timeline otra cosa con `pause()`: un timer,
  un `waapi.animate`, o una `Animation` nativa. Lo hace **animando su `currentTime` de 0 a
  `duration` con ease lineal**: es la timeline (JS) quien empuja el reloj de la animación sincronizada
  cada fotograma, y fuerza `persist = true` en las WAAPI para que no dejen de responder al terminar.
  Consecuencia: lo que se sincroniza así **deja de correr en el compositor** aunque sea WAAPI (§4.3).
- `reverse()` a mitad: `alternate()` + `resume()` (`timer.js:442-447`): invierte en el punto actual
  con continuidad. Lab `07`: «volver» a mitad sin salto.
- Lab `07`, la comparación que importa: **las cuatro fases de «sacar el libro» encadenadas (`'<'`)
  frente a solapadas** (cada etiqueta en `'<-=40 %'` de la fase anterior). Con las mismas
  duraciones por fase (220, 260, 300, 320), la encadenada dura 1.100 ms y la solapada 788. Es la
  regla 5 puesta en un botón.

### 4.2 `createScope` (`src/scope/scope.js:41-200`)

`createScope({ root, defaults, mediaQueries: { nombre: '(query)' } })`:

- `root` acota los selectores de dentro (acepta selector, elemento, `ref.current` de React,
  `nativeElement` de Angular, `:45-52`).
- `.add(self => { ... ; return () => limpieza })`: ejecuta el constructor con `self.matches.nombre`
  disponible y registra todo lo que se cree dentro (`register`, `:97`). **Cuando cambia una media
  query, `refresh()` revierte todo y vuelve a ejecutar los constructores** (`:126-140`): dos
  versiones de una animación (reducida y completa) sin escribir un `matchMedia` a mano.
- `.add('nombre', fn)` registra un método en `scope.methods`; `.addOnce(fn)` no se repite en el
  refresh.
- `.revert()` deshace todo lo registrado: **una sola llamada en la limpieza del `$effect`**. Lab
  `08`: montar deja `style` inline y una animación en bucle; `revert()` deja el `style` vacío y la
  limpieza del constructor ejecutada. Sin scope, cada `animate` de un componente sigue vivo después
  de desmontarlo escribiendo en nodos huérfanos.

Patrón Svelte 5 (condición 2 del 24/08, ahora con la pieza que le faltaba):

```svelte
<script lang="ts">
  import { createScope, animate, spring } from 'animejs'
  let root: HTMLElement
  $effect(() => {
    const scope = createScope({ root, mediaQueries: { reduced: '(prefers-reduced-motion: reduce)' } })
    scope.add((self) => {
      if (self.matches.reduced) { animate('.tapa', { opacity: [0, 1], duration: 120 }); return }
      animate('.tapa', { rotateY: [-22, -4], ease: spring({ duration: 560, bounce: .1 }) })
    })
    return () => scope.revert()
  })
</script>
```

### 4.3 `waapi.animate` (`src/waapi/waapi.js:186-540`)

Crea animaciones nativas (`el.animate`) **por propiedad** (una `Animation` por propiedad y
elemento, `:296-336`) y devuelve un `WAAPIAnimation` con la misma cara que `JSAnimation`: `speed`,
`currentTime`, `progress`, `pause`, `play`, `reverse`, `seek`, `restart`, `commitStyles`,
`complete`, `cancel`, `revert`, `then`. Lo que hace por dentro y hay que saber:

- **Easing**: cualquier easing de Anime se convierte a `linear()` muestreado con 100 puntos
  (`easingToLinear`, `:85`); los nombres CSS (`ease-out`, `cubic-bezier(...)`, `steps(...)`) pasan
  tal cual; un muelle usa su `settlingDuration` como duración (`:288`).
- **Transformadas individuales** (`x`, `y`, `rotateY`, `scale`...): las anima como **custom
  properties registradas** (`CSS.registerProperty('--translateX', …)`, `:195-215`) y escribe en el
  elemento `transform: translateX(var(--translateX)) rotate(var(--rotate))` (`:349-355`).
  Verificado en el lab `09`: `.c3` queda con ese `transform` inline y dos `Animation` nativas, la
  primera sobre `--translateX`. ⚠ **Si una custom property que alimenta `transform` se resuelve en
  el hilo principal (que es el modelo de Chromium para `var()` en `transform`), esta vía NO va al
  compositor**, aunque sea WAAPI. Es una hipótesis por lectura del código y del modelo del
  navegador, `⚠ sin verificar`: el lab `09` pone cinco variantes bajo un hilo bloqueado (nativa
  con `transform`; `waapi.animate` con `transform` en string; `waapi.animate` con `x`/`rotate`;
  motor JS; `waapi` dentro de `sync`) y el ojo de Eneko en Helium decide. Si se confirma, el vuelo
  del libro se escribe con `transform` entero (string) o con `el.animate` directo.
- `composition` se traduce a `composite` de WAAPI (`:290`); `persist` (`:257`) mantiene la
  animación viva al terminar (necesario dentro de una timeline); `commitStyles()` + `cancel()` es lo
  que MDN pide en vez de `fill: forwards` eterno, y `cancel()` de Anime ya lo hace (`:472-482`).
- Lo que no da frente al motor JS: `onUpdate` por fotograma con el valor, valores de función,
  objetos JS como target, SVG, colores por Anime (los deja al navegador).
- Dentro de una timeline (`sync`) la timeline empuja `currentTime` desde JS (§4.1): se gana
  orquestación y scrubber, se pierde el compositor.

### 4.4 Lo que se lleva a la skill y al libro

- Etiquetas siempre; `'<'` solo cuando el hijo anterior es evidente.
- Fases solapadas por etiqueta (`'anterior+=ms'`), nunca encadenadas.
- `createScope` por componente, `revert()` en la limpieza; `mediaQueries.reduced` como la vía de
  reduced-motion en JS.
- Para el vuelo del libro, tres opciones según lo que diga el lab `09` en Helium: (a) timeline de
  Anime con motor JS (`x`, `rotateY`), lo más cómodo, hilo principal; (b) `waapi.animate` con
  `transform` en string por fase, compositor, orquestación a mano con `delay`; (c) timeline de
  Anime como director (etiquetas, `call()`) que dispara `waapi.animate` sueltos con `transform` en
  string, sin `sync`, y el scrubber solo en modo revisión. La (c) es la que respeta la regla de los
  144 Hz sin renunciar a la timeline; se decide en la fase 8 con la medida.

## 5 · Anime.js, módulos especializados: svg, text, scroll, draggable, layout (19/09; estimado 2 h; real: ver el commit de cierre)

Labs `animejs/10` a `14`. Todo esto es **motor JS por fotograma** (atributos SVG, contenido de
texto, observadores, física): es donde Anime.js da lo que CSS y WAAPI no dan, y donde el coste es
el hilo principal.

### 5.1 `svg` (`src/svg/`, 291 líneas)

- `morphTo(path2, precision = .33)` (`morphto.js:21`): devuelve un valor de función para `points`
  o `d`; muestrea los dos trazados al mismo número de puntos y los interpola. Un logo que cambia de
  forma.
- `createDrawable(selector, start = 0, end = 0)` (`drawable.js:111`): envuelve el elemento en un
  proxy con un atributo `draw` `'0 1'` y traduce a `stroke-dasharray`/`dashoffset`. Verificado en
  el lab `10`: tras lanzar, `stroke-dasharray` vale `0.6 1009.4`. El símbolo de Naeth dibujándose.
- `createMotionPath(path, offset = 0)` (`motionpath.js:80`): devuelve `{ translateX, translateY,
  rotate }` como valores de función para que un elemento siga la curva, orientado. En CSS existe
  `offset-path` (Baseline 2022) para lo mismo sin JS; el morph de `d` solo lo hace Chromium.

### 5.2 `text` (`src/text/`, 800 líneas)

- `splitText(target, { lines, words, chars, accessible = true, includeSpaces, debug })`
  (`split.js:213-515`): parte con `Intl.Segmenter` (grafemas y palabras reales, no `split(' ')`),
  devuelve `{ lines, words, chars }` como arrays de `span`, se recalcula al redimensionar. Con
  `accessible` (defecto) **deja el texto entero en un `span` visualmente oculto para lectores de
  pantalla y pone `aria-hidden` en los trozos**: verificado en el lab `11` (`clip: rect(0,0,0,0)`
  + `aria-hidden="true"` en cada palabra). Es lo que hay que exigir a cualquier split de texto.
- `scrambleText({ chars: 'A-Z0-9' | 'lowercase' | 'uppercase' | 'numbers' | 'symbols' | 'braille'
  | 'blocks' | 'shades', ease, seed, override, settleRate = 30, revealDelay, onChange })`
  (`scramble.js:78`, tipos en `types/index.js:668-684`): un valor de función para `textContent`.
  El kicker de la portadilla con efecto terminal, si Eneko lo quiere (regla 1: solo si explica
  algo; aquí es puro carácter, y eso también cuenta si es una vez por capítulo).

### 5.3 `onScroll` (`src/events/scroll.js:412-600`, 988 líneas el módulo)

`animate(target, { ..., autoplay: onScroll({ container, target, axis, enter, leave, sync, repeat,
debug, onEnter, onLeave, onEnterForward, onLeaveBackward, onUpdate, onResize, onSyncComplete }) })`
(parámetros en `types/index.js:540-560`). Tres modos por `sync`: `true`, el progreso de la
animación es el del scroll entre `enter` y `leave`; un easing o un número de ms, se persigue con
suavizado; sin `sync`, la animación se dispara al entrar y `repeat` la rearma. Umbrales en texto
(`'bottom top+=40'`, `'center'`), `debug: true` los pinta. Frente al scroll-driven de CSS (§2.1):
da lógica (`onEnter` para cargar o contar), suavizado, y **Firefox**; cuesta JS por evento y por
tick. Lab `12`: la misma escena que `web/03`, CSS a la izquierda y `onScroll` a la derecha.

### 5.4 `createDraggable` (`src/draggable/draggable.js`, 1.286 líneas)

`createDraggable(target, { container, x, y (o `{ snap, mapTo, modifier }`), snap, containerPadding,
containerFriction, releaseContainerFriction, dragSpeed, dragThreshold, scrollSpeed, scrollThreshold,
minVelocity, maxVelocity, velocityMultiplier, releaseMass, releaseStiffness, releaseDamping,
releaseEase, cursor: { onHover, onGrab }, onGrab, onDrag, onRelease, onUpdate, onSettle, onSnap,
onResize })` (`types/index.js:606-640`). Es **tiempo real** (Willenskomer): el objeto sigue a la mano
sin easing, y la física (un muelle con `releaseStiffness`/`releaseDamping`, el contenedor con
fricción, el `snap`) aparece al soltar. Lab `13`: el libro se arrastra por la mesa con snap a 140 px.
Lo que decide para CDA no es técnico: si el libro se saca **arrastrando** en vez de con un clic, la
transición 5 pasa de no tiempo real a tiempo real, y eso cambia la naturaleza del gesto.

### 5.5 `createLayout` (`src/layout/layout.js:948-1612`, 4.3+; 1.612 líneas)

`const layout = createLayout(root, { duration, ease, swapAt, enterFrom, leaveTo, children,
properties })`; `layout.update(() => { cambia el DOM })` = `record()` + cambio + `animate()`
(`:1600-1604`). Registra los hijos con `data-layout-id`, mide antes y después, y anima la diferencia.
**Confirmado en 4.5.0 lo que el anexo N leyó**: la posición va por `translate` (`:1466-1469`,
propiedad individual, compositor), pero **si el tamaño cambia anima `width` y `height` de verdad**
(`:1458-1464`, con `composition: 'none'`). `swapAt` es el estado intermedio al cambiar de padre
(defecto `{ opacity: 0 }` con `ease: 'inOut(1.75)'`, `:976`); `enterFrom` y `leaveTo` para los que
aparecen o desaparecen. Lab `14`: un lomo pasa de la pila a la mesa (cambia de padre y de tamaño) y
los demás cierran el hueco. Veredicto: **para la pila sola (mismo tamaño, solo se mueven) vale y
respeta los 144 Hz; para el vuelo del libro no**, y `animate:flip` de Svelte hace la pila a 0 KB
(bench `motion.html`, bloque 2). `createLayout` gana solo si el libro cambia de padre en el DOM al
salir, cosa que la decisión «un objeto por libro» del anexo N justamente evita.

### 5.6 Lo que se lleva a la skill y al libro

- SVG: `createDrawable` para el símbolo; `morphTo` y `createMotionPath` son catálogo.
- Texto: `splitText` siempre con `accessible: true` (es el defecto; no quitarlo); `scrambleText` una
  vez por portadilla como mucho, si Eneko lo quiere.
- Scroll: CSS primero en Chromium/Safari; `onScroll` cuando haga falta lógica, suavizado o Firefox.
- Draggable: solo si el gesto pasa a ser de arrastre. Decisión de Eneko.
- Layout: para recolocar la pila si no se hace con Svelte; nunca para el vuelo.

## 6 · Rendimiento y peso (19/09; estimado 1 h; real: ver el commit de cierre)

### 6.1 El peso tree-shaken, medido

Cierra el hueco del 24/08 (`stack-diseno-animacion.md` §6.2). `animejs@4.5.0` instalado en
`naeth/web` (`package.json`, sin ningún uso en `src/` todavía), siete entradas construidas con
Vite 8.1.2 (rolldown + oxc) en modo `lib` ES y medidas con `gzip -9`; el banco y el comando quedan
en [`naeth/web/bench/peso/`](../../naeth/web/bench/peso/README.md) para repetirlo al subir de versión.

| Import | Gzip |
|---|---:|
| `import { animate } from 'animejs'` | **13,4 KB** |
| `import { animate } from 'animejs/animation'` | 13,4 KB (idéntico: **el tree-shaking desde la raíz funciona**, la subruta no hace falta) |
| `import { waapi } from 'animejs/waapi'` | **5,0 KB** |
| Lo que usaría el libro: `animate, createTimeline, createScope, spring, cubicBezier, utils, waapi` | **21,5 KB** |
| `import * as anime from 'animejs'` | 44,7 KB (el UMD del cdn, 40,6) |
| `import { Spring, Tween } from 'svelte/motion'` | 9,6 KB suelto (en la app comparte internos de Svelte que ya están: el coste real es menor, no medido) |
| `import { fly, fade } from 'svelte/transition'` + `flip` | 0,9 KB |

Lectura: la condición 4 del 24/08 («importar por subruta y medir») queda en «medir»: la subruta
no cambia nada con Vite 8. El coste real de Anime.js en el visor para el libro es **21,5 KB gzip**,
la mitad de lo que se temía, y la vía `waapi` sola son 5. `check` y `build` del visor siguen en
verde con la dependencia (488 ficheros, 0 errores; `build` regenera `dist/` con el mismo `src/`, así
que lo servido no cambia).

### 6.2 Lo que corre en el compositor, y lo que no

- **`transform` y `opacity` animadas por CSS o WAAPI**: el compositor las interpola sin pasar por
  el hilo principal; con el hilo bloqueado siguen (web.dev, «Animations guide»: «restrict
  animations to `opacity` and `transform` to keep animations on the compositing stage»). Labs
  `web/05` y `animejs/09`.
- **Todo lo que escribe JS por fotograma** (motor de Anime, rAF a mano, `Tween`/`Spring` de Svelte,
  `tick` de una transición, un `sync` de timeline): hilo principal. Con el hilo ocupado, se atasca.
- **Custom properties que alimentan `transform`** (la vía `waapi.animate` con `x`/`rotateY`): la
  hipótesis del §4.3, `⚠ sin verificar` hasta que Eneko mire el lab `09` en Helium con el hilo
  ocupado. Si se confirma, la regla para el vuelo es «`transform` entero en string o `el.animate`».
- **`filter`, `backdrop-filter`, `clip-path`**: Chromium los compone en GPU, pero un `blur` grande
  se re-rasteriza cada fotograma y cuesta; por eso la regla de los 144 Hz los deja fuera por
  fotograma. `⚠ sin medir hoy`.
- **`width`, `height`, `top`, `left`, `margin`, `padding`**: layout en cada fotograma, y layout
  arrastra a los hermanos. Es lo que hace `createLayout` cuando el tamaño cambia (§5.5) y lo que
  View Transitions hace sobre sus pseudoelementos (que son capas, no layout del documento).

### 6.3 Capas, `will-change` y rasterizado

- `will-change: transform` promueve el elemento a su propia capa por adelantado y evita el primer
  fotograma perdido al arrancar (el «1 perdido» de §0.3). web.dev: solo en elementos que van a
  cambiar, ponerlo antes y quitarlo después si es infrecuente, «layer creation can cause other
  performance issues» (memoria de GPU: cada capa es una textura del tamaño del elemento).
- **`preserve-3d` con muchas caras**: cada cara es una capa; el libro son seis más el taco y las
  sombras. Con un libro es nada; con veinte en la biblioteca, veinte veces. La pila lleva solo el
  lomo como capa; la caja completa se monta al sacar.
- **Rasterizado al escalar**: una capa rasterizada a escala 0,3 y ampliada con `scale(3.3)` se ve
  borrosa hasta que el navegador re-rasteriza (Chromium lo hace al terminar la animación o cuando
  la escala cambia mucho). Regla del anexo M confirmada por el modelo: la tela y el texto van al
  **tamaño final** y se escalan hacia abajo al principio; el texto dentro de 3D además necesita
  `backface-visibility: hidden` o `translateZ(0)` en la cara para no emborronarse. `⚠ sin medir
  hoy`: se mira en la fase 8 con la caja.
- **Cómo medir**: `00-medidor.js` (fotogramas perdidos y peor intervalo; LoAF en Chromium 123+),
  y en Helium el panel Rendering con «Frame Rendering Stats» y «Paint flashing» (si algo parpadea
  en verde durante el vuelo, hay pintado por fotograma y la regla se está rompiendo), y el panel
  Performance para ver si el hilo del compositor va solo.

## 7 · La skill `animejs` y la revisión de `animation-guide.md` (19/09; estimado 2 h; real: ver el commit de cierre)

**Skill** en `~/.claude/skills/animejs/` (fuera de este repo; vive con las demás skills de Eneko):

- `SKILL.md`: disparadores («Anime.js», «animejs», «createTimeline», «spring», «stagger», «morph
  SVG», «split text», «scroll-driven» con lógica, «draggable», «FLIP», «waapi.animate», o un objeto
  en varias fases con solape, scrubber e inversión) y el NO (el chrome del visor va en CSS; un
  hover o un chevron es `transition`; un proyecto con GSAP o Framer Motion no suma una segunda
  librería). Cuerpo: «antes de escribir una línea» (¿hace falta?, import y pesos medidos,
  reduced-motion), **las cinco trampas de 4.5** con `fichero:línea`, la tabla «para esto, esto»,
  el patrón Svelte 5 con `createScope` en `$effect` y el de Next.
- `references/modulos.md`: chuleta módulo a módulo con firmas y `fichero:línea` de 4.5.0.
- `references/buenas-practicas.md`: las doce reglas de §1 con su escritura en Anime.js, lo que no
  se anima, y tiempo real frente a no tiempo real.
- `references/rendimiento.md`: qué corre en qué hilo, capas y rasterizado, pesos, cómo medir.
- (El `frameworks.md` del plan quedó dentro de `SKILL.md`: dos patrones no daban para un fichero.)

**`craft-ui/references/animation-guide.md`**, revisada en cinco puntos, no reescrita: el peso de
Anime.js pasa de «no medido» a las cifras de §6.1; las tres trampas de 4.5 y el enlace a la skill;
la tabla de easings pasa de Material 2 (`(0.4,0,0.2,1)`) a los tokens de Material 3 leídos en su
código, con `linear()` como muelle legítimo en CSS en vez del «NEVER overshoot»; un bloque de CSS
nuevo que quita JS viejo (`@starting-style`, `allow-discrete`, `animation-composition`,
`@property`, scroll-driven con su soporte); el soporte de View Transitions con fechas y el aviso de
que las instantáneas son planas; y la regla de selección con «13 KB» medidos en vez de «37».

⚠ Pendiente de la verificación del plan: cargar la skill en una sesión limpia con tres peticiones
(una timeline, un morph SVG, un scroll-driven) y una cuarta que pida «animar el chevron del
visor» y tenga que responder CSS. Se hace cuando Eneko abra una sesión nueva, no desde esta.

## 8 · El caso aplicado: el libro (19/09; estimado 1 h 30; real: ver el commit de cierre)

### 8.1 La caja, lab `animejs/15`

Seis caras con `preserve-3d`: tapa y contratapa a `±G/2`, lomo girado −90° a la izquierda, y el
**taco de páginas como caja propia** un poco más pequeña que la tapa (canto, cabeza y pie con las
hojas dibujadas por `repeating-linear-gradient`). Luz desde la izquierda: una capa blanca y otra
negra por cara cuya opacidad sale del ángulo (`sin(ry)` para la tapa, `−cos(ry)` para el lomo),
escrita desde `onUpdate` de un `createAnimatable` con muelle `spring({ duration: 500, bounce: .1 })`
que mueve los tres ángulos al pulsar un preset. Sombra en la mesa aparte (solo `opacity`).
Deslizadores: `rx`, `ry`, `rz`, `perspective` (400 a 5200), `perspective-origin`, grosor `G`.
Presets: los cinco estados de la transición 5 más «tres cuartos». Verificado en el navegador
integrado: sin errores, la luz y la sombra cambian con el ángulo (a `ry` 34: luz de la tapa 0,17,
sombra del lomo 0,37) y la caja a tres cuartos se ve como un libro con lomo, tapa y cabeza. Lo que
decide Eneko: `perspective` y grosor, y desde dónde se mira.

### 8.2 La autopsia y el storyboard

Están en el **anexo O** de [`cda-vista-diseno-2026-09-15.md`](cda-vista-diseno-2026-09-15.md), que
es donde viven las decisiones de CDA: la autopsia en números de los dos prototipos (perspectiva
5200, easing lineal por la string retirada, fases encadenadas, pila que solo se atenúa), las
decisiones fijas, el storyboard con etiquetas y solape del 40 % (`coge`, `sale`, `levanta`,
`gira`, `crece`, 0 a 840 ms), con qué se hace cada parte, y la lista de lo que Eneko decide
mirando cada lab. Dos cosas quedan abiertas hasta que él mire: la perspectiva (lab 15) y si las
custom properties de `waapi.animate` van al compositor (lab 09), que decide cómo se escribe el
vuelo.

⚠ El texto del punto 5 de la lámina «0 · PLAN» del `.pen` no se ha podido actualizar: Pencil no
estaba abierto al cerrar la fase (el MCP no conecta). Queda para la próxima sesión con Pencil:
«5 · sacar el libro: investigado (19/09, `animacion-en-codigo-2026-09-19.md`, anexo O); v3 pendiente de
lo que Eneko decida en los labs 03, 04, 05, 07, 09, 13 y 15».

## 9 · La página que se dobla: el page curl (21/09; estimado 1 h con base en el anexo N; real: ver el commit de cierre)

Sale de la respuesta de Eneko al lab `animejs/16` el 20/09 a las 22:40: «me sigue pareciendo raro»,
con el texto ya real y sin rebote. El diagnóstico es que **una lámina rígida girando no es papel**:
el papel se dobla, la esquina libre va por delante y la hoja se aplana al caer. Y la pregunta que
faltaba: ¿está resuelto ya? Sí, tiene nombre (*page curl* o *page flip*) y tres familias. Lab
comparado sobre la misma página con texto real: `web/07-page-curl.html`.

### 9.1 Las tres familias, con evidencia

**Librerías de libro en DOM. StPageFlip (`page-flip` en npm).** MIT; versión 2.0.7; **último
commit el 18/04/2021** (API de GitHub, `commits?per_page=1`); 44,3 KB minificado y **10,5 KB gzip**
(jsDelivr `dist/js/page-flip.browser.min.js`, `gzip -9`, 21/09/2026). Es lo que envuelve
`react-pageflip`. Leído en `src/`:

- Modo HTML: cada página es un elemento real (vale nuestro DOM). El pliegue se pinta con un
  **`clip-path: polygon(...)` recalculado por JS en cada fotograma** más `transform: translate3d()
  rotate()` en la parte doblada (`Page/HTMLPage.ts:103-129`), y dos sombras con otro `clip-path`
  (`Render/HTMLRender.ts:153-258`). Es un **pliegue recto**: la hoja se dobla por una línea, como
  una servilleta, no en arco.
- Un bucle `requestAnimationFrame` **que no para nunca** mientras el libro existe
  (`Render/Render.ts:137-147`: `start()` encadena `loop` sin condición) y la animación es una lista
  de fotogramas precalculados que se indexan por tiempo (`:117-131`). Hilo principal, siempre.
- `flippingTime` (1000 por defecto), `drawShadow`, `maxShadowOpacity`, `showPageCorners`,
  `usePortrait` (clona las páginas), `useMouseEvents` (arrastre de la esquina con el ratón, que es
  lo que hace bonito el demo). Sin easing configurable.
- Veredicto: **no para 144 Hz** (JS por fotograma, `clip-path` cambiado a mano) y cinco años sin
  mantenimiento; sirve como **referencia de lo que es un pliegue recto** y de la interacción de
  arrastrar la esquina. Otras de la familia, descartadas sin probar: turn.js (jQuery, 2012,
  licencia comercial fuera de uso personal), los «flipbook» comerciales (PDF a canvas).

**La hoja en tiras anidadas, CSS puro.** La técnica clásica del «CSS 3D bending» (el pen de
`_fbrz`, `codepen.io/_fbrz/pen/eYrNeW`; ⚠ Cloudflare bloqueó la descarga, la técnica se ha
reconstruido, no leído): la hoja se parte en N tiras verticales, cada una **anidada dentro de la
anterior** con `transform-origin` en su borde izquierdo y un `rotateY` pequeño; las rotaciones se
acumulan y el conjunto es un arco. Lo nuestro (lab `web/07`, vía B): la tira 0 lleva el giro base
(0 → −180 con la curva del papel) y las otras N − 1 reparten un arco que crece y se apaga con
`sin(πt)` (0° al salir, máximo a mitad, 0° al llegar, para que la hoja caiga plana); cada tira tiene
dos caras (`backface-visibility: hidden`) y dentro de cada cara **una copia de la página desplazada**
`−i·ancho/N` y recortada con `overflow: hidden`; cada tira es **una `Animation` nativa sobre
`transform`** con 26 keyframes (el easing va dentro de los keyframes, muestreado de la bezier).
Coste: 2N capas y N copias del DOM de la página (con N = 10, veinte caras y diez copias de una página
con código). Comprobado en el panel integrado con las animaciones pausadas a mitad: la esquina libre
va por delante (la última tira a 200 px del lomo cuando la primera está a 90°), y el texto se curva
con la hoja. ⚠ Que las 2N capas sigan fluidas con el hilo bloqueado y que diez tiras basten para
que no se vea el polígono lo dice Eneko en Helium (lab `web/07`, botón «ocupar el hilo»).

**3D real. Three.js con la hoja como malla con huesos.** El tutorial de Wawa Sensei («3D Book
Slider», React Three Fiber): la hoja es un `BoxGeometry` con segmentos y un `SkinnedMesh` con un
hueso por segmento; el giro rota el primer hueso y cada hueso siguiente añade una fracción con tres
fuerzas de curva (interior, exterior y de giro). Es el arco de las tiras, en malla. **La página es
una textura**: en CDA la página es HTML vivo (código con enlaces, selección, anotaciones, minimapa)
y no vive dentro de un canvas. Solo cabría un híbrido: el DOM cuando la página está quieta y una
**foto** de la página como textura durante el giro; el navegador no da esa foto (no hay API de
captura del DOM; `html2canvas` es un re-render lento, ⚠ no medido), así que habría que mantener un
render paralelo de cada página. Además el 18/09 se descartaron los shaders para el aspecto. **Queda
como coste escrito, no como opción**: cambiaría la arquitectura de la vista entera por una
transición de 320 ms.

### 9.2 Lo que decide el compositor

- Las tiras van por `transform` en `Animation` nativas: compositor, como la hoja rígida (lab `09`).
- **`clip-path` animado**: Chromium lo anunció como «pronto en el compositor» en el blog de
  aceleración por hardware y la lista de `paint-dev` («Moving clip-path to the compositor»); ⚠ no
  se ha comprobado en Chromium 153 si una `Animation` nativa sobre `clip-path: polygon()` sigue con
  el hilo bloqueado. Da igual para StPageFlip (lo escribe JS por fotograma), pero sería la vía para
  un **pliegue recto propio** sin JS por fotograma: keyframes de `clip-path` precalculados. Es un
  lab de 30 min si Eneko prefiere el pliegue recto de C al arco de B.

### 9.3 Qué se propone

1. **B** (tiras anidadas) es la candidata para la 7: papel que se dobla, compositor, 0 KB, el DOM
   real dentro. Pendiente de que Eneko diga que se lee como papel y de la cifra con el hilo ocupado.
2. Si prefiere el pliegue recto de C: se hace propio con `clip-path` en keyframes, no con la
   librería (§9.2).
3. Si ninguna convence, la hoja rígida A con la standard sigue siendo la alternativa barata, y el
   fundido cruzado es la de reduced-motion y móvil; el 3D real no entra.
4. El anexo Q se corrige cuando haya respuesta: la 7 pasa de «hoja de dos caras» a «hoja en N
   tiras» y el hojeo de seis hojas a 2N capas por hoja (hay que mirar si seis hojas en tiras a la
   vez son demasiadas capas: sesenta caras).

Fuentes: [StPageFlip en GitHub](https://github.com/Nodlik/StPageFlip) y su `src/`;
[page-flip en npm](https://www.npmjs.com/package/page-flip); [react-pageflip](https://www.npmjs.com/package/react-pageflip);
[CSS 3D Bending Effect, pen de _fbrz](https://codepen.io/_fbrz/pen/eYrNeW) (⚠ bloqueado);
[3D Book Slider, Wawa Sensei](https://wawasensei.dev/tuto/3d-book-slider-landing-page-threejs-and-react);
[Updates in hardware-accelerated animation capabilities, Chrome](https://developer.chrome.com/blog/hardware-accelerated-animations);
[Moving clip-path to the compositor, paint-dev](https://groups.google.com/a/chromium.org/g/paint-dev/c/3bXUo0X3C5I).

## Lo que no se ha podido comprobar

1. ~~Que las custom properties de `waapi.animate` (`x`, `rotateY`) no van al compositor.~~
   **Comprobado el 20/09/2026** por Eneko en Helium a 144 Hz con el hilo bloqueado (lab `09`):
   solo las filas 1 (`el.animate` con `transform`) y 2 (`waapi.animate` con `transform` en string)
   siguen fluidas; la 3 (custom properties) y la 4 (motor JS) se atascan. El vuelo del libro se
   escribe con `transform` entero en string y la timeline dirige sin `sync` (§4.4, opción c).
2. **Que el scroll-driven de CSS corre en el compositor.** MDN no lo dice; es conocimiento de la
   implementación de Chromium.
3. **El coste real de `filter`/`backdrop-filter`/`clip-path` por fotograma** y el **rasterizado al
   escalar** (borroso hasta re-rasterizar) con la caja del libro: leído, no medido.
4. **El peso de `svelte/motion` dentro de la app** (9,6 KB suelto; comparte internos que ya
   están): no se ha construido la app con y sin.
5. **Los tamaños de Motion y Framer Motion tree-shaken**: solo el UMD completo (48,8 KB); el
   «2,3 KB mini» es del fabricante.
6. **La skill `animejs` en una sesión limpia** (cuatro peticiones de prueba, §7).
7. **Las animaciones en el panel del navegador integrado con el panel oculto**: `document.hidden`
   pausa `requestAnimationFrame`, las transiciones CSS y `engine.pauseOnDocumentHidden`; todo lo
   que aquí se dice «verificado» del lab es carga, consola, DOM y valores computados, no el ojo.
   El ojo es de Eneko en Helium.
8. **`adapters/three`**: citado, no probado (no hay Three.js en ningún proyecto hoy).
9. Val Head y Rachel Nabors citados de memoria en §1, sin cita textual.
10. **§9**: que 2N capas de tiras sigan fluidas con el hilo bloqueado, que diez tiras no dejen ver el polígono, y si `clip-path` animado por `Animation` nativa va al compositor en Chromium 153.
