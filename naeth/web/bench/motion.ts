// Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
// No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE
// Banco de lo que trae Svelte 5 para animar, sin librería (19/09/2026).
//
// LA PREGUNTA. La decisión del 24/08/2026 dice que, si CSS no basta, la primera parada es
// `svelte/transition` y `svelte/motion` (0 KB extra) y solo después Anime.js. Nunca se ha
// ejercitado: `src/` no importa ninguno de los dos. Aquí se ve qué dan de verdad, para la tabla de
// decisión de `docs/discovery/animacion-en-codigo-2026-09-19.md`:
//   - `transition:` con `fly` y una transición propia, interrumpida a mitad (¿reversa limpia?);
//   - `animate:flip` sobre una lista reordenada (la pila de libros recolocándose);
//   - `Spring` siguiendo al ratón y `Tween` sobre un número;
//   - `css` frente a `tick` en una transición propia (¿va por WAAPI o por rAF?);
//   - si algo de esto respeta `prefers-reduced-motion` solo (no, y se comprueba).
// Es un banco: no entra en la suite ni se despliega. Se abre con el dev server en /bench/motion.html.

import { mount } from 'svelte'
import MotionLab from './MotionLab.svelte'

mount(MotionLab, { target: document.getElementById('app')! })
