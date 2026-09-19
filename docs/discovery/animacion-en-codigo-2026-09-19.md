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

## 1 · Fundamentos del movimiento

_(pendiente)_

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
