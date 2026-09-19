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

**Cómo leer las citas.** `src/x/y.js:NN` es el código de `juliangarnier/anime` en el tag v4.5.0
(descargado entero al scratchpad de la sesión el 19/09: 70 ficheros, 13.756 líneas). Lo que no se ha
ejecutado lleva `⚠ sin verificar`. El soporte de navegadores lleva fecha.

Entregables: este documento; el laboratorio en [`../lab/animacion/`](../lab/animacion/) (`web/`
por técnica, `animejs/` por módulo); la skill `~/.claude/skills/animejs/`; la revisión de
`craft-ui/references/animation-guide.md`; el anexo O de la discovery de CDA con el storyboard de la 5.

---

## 0 · Preparación (19/09, 14:20 a 14:50; estimado 30 min, real 30)

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

## 1 · Fundamentos del movimiento (19/09, 14:55 a 15:35; estimado 1 h, real 40 min)

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

## 2 · El medio: con qué se anima en la web

_(pendiente)_

## 3 · Anime.js, el motor

_(pendiente)_

## 4 · Anime.js, orquestar e integrar

_(pendiente)_

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
