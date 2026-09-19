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

## 5 · Anime.js, módulos especializados

_(pendiente)_

## 6 · Rendimiento y peso

_(pendiente)_

## 7 · La skill y la guía

_(pendiente)_

## 8 · El caso aplicado: el libro

_(pendiente)_

## Lo que no se ha podido comprobar

_(se rellena al cerrar cada fase)_
