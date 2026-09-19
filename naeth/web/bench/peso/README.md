# Peso tree-shaken, medido (19/09/2026)

Siete entradas, cada una con un import distinto, construidas con Vite 8.1.2 (rolldown + oxc) en
modo `lib`, formato ES, y medidas con `gzip -9`. Es la respuesta al hueco del 24/08/2026
(`docs/discovery/stack-diseno-animacion.md` §6.2): cuánto cuesta de verdad
`import { animate } from 'animejs'`. No es un banco del grafo: es una medida, y se deja aquí para
poder repetirla cuando suba la versión.

```
cd naeth/web/bench/peso
for e in a-animate b-animation-sub c-waapi d-libro e-todo f-svelte-motion g-svelte-transition; do
  PESO_ENTRY=$e.js npx vite build --config vite.peso.config.mjs >/dev/null
  f=out/$e/bundle.js; printf "%-22s crudo %7d  gzip %6d\n" $e $(stat -c %s $f) $(gzip -9 -c $f | wc -c)
done
```

| Entrada | Import | Crudo | Gzip |
|---|---|---:|---:|
| `a-animate` | `{ animate }` desde `animejs` | 40.963 | **13.405** |
| `b-animation-sub` | `{ animate }` desde `animejs/animation` | 40.963 | 13.405 (idéntico: el tree-shaking desde la raíz funciona) |
| `c-waapi` | `{ waapi }` desde `animejs/waapi` | 13.379 | **5.006** |
| `d-libro` | `{ animate, createTimeline, createScope, spring, cubicBezier, utils, waapi }` | 67.889 | **21.538** |
| `e-todo` | `* as anime` | 152.420 | 44.726 |
| `f-svelte-motion` | `{ Spring, Tween }` de `svelte/motion` | 30.144 | 9.608 (suelto; en la app comparte internos de Svelte que ya están) |
| `g-svelte-transition` | `{ fly, fade }` + `{ flip }` | 2.169 | 932 |

`out/` no se versiona. Lectura en `docs/discovery/animacion-en-codigo-2026-09-19.md` §6.
