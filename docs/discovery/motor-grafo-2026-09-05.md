# Qué motor aguanta el grafo vivo

Fase 0 del plan `docs/plan/grafo-vivo-2026-09-05.md`. Medido el 05/09/2026 con
`naeth/web/bench/motor.html` contra el corpus real de producción, en Chromium sobre este PC
(monitor de 144 Hz).

## Cómo se midió

Cuatro combinaciones de pintado y física sobre los mismos datos, a tres escalas. La escala x1 es el
corpus de hoy servido por `/api/graph` y `/api/tree`; x5 y x10 lo replican para simular el corpus a
uno y a tres años, con un 8% de las aristas reenganchadas a otra réplica para que no salgan k
grafos aislados, que serían más fáciles de simular que uno grande de verdad.

Dos decisiones para que la comparación no estuviera amañada:

- **El pintor SVG juega en su mejor caso.** Crea los elementos una vez y luego solo actualiza
  atributos con `setAttribute`, sin pasar por Svelte. Es más rápido que lo que tiene la app hoy.
- **La física juega en su peor caso.** Corre con `alphaDecay(0)`, o sea sin enfriarse nunca, así
  que mide coste sostenido. En la app real la simulación se calma y para.

Las dos tandas dieron los mismos números con menos de 1 ms de diferencia. Y hay una captura del
grafo dibujado al final de la tanda: el banco pintaba de verdad, que es la comprobación que hay que
hacer antes de creerse unos fps.

## Lo medido

| escala | nodos | aristas | pintor | física | fps | física ms | pintado ms | p95 ms |
|---|---|---|---|---|---|---|---|---|
| x1 | 455 | 650 | canvas | d3 | 144 | 1,3 | 0,2 | 1,9 |
| x1 | 455 | 650 | svg | d3 | 144 | 1,3 | 1,5 | 3,5 |
| x1 | 455 | 650 | canvas | propia | 143 | 0,7 | 0,2 | 1,2 |
| x1 | 455 | 650 | svg | propia | 144 | 0,7 | 1,5 | 2,5 |
| x5 | 2.275 | 3.250 | canvas | d3 | **98** | 9,0 | 0,7 | 12,1 |
| x5 | 2.275 | 3.250 | svg | d3 | 38 | 9,0 | 7,6 | 18,6 |
| x5 | 2.275 | 3.250 | canvas | propia | 58 | 16,0 | 0,7 | 19,1 |
| x5 | 2.275 | 3.250 | svg | propia | 30 | 15,4 | 7,9 | 28,1 |
| x10 | 4.550 | 6.500 | canvas | d3 | **45** | 19,9 | 1,4 | 25,1 |
| x10 | 4.550 | 6.500 | svg | d3 | 19 | 19,7 | 15,1 | 38,3 |

La física propia a x10 no se midió: son 10,3 millones de pares por frame con su repulsión O(n²).
Extrapolando desde los 16 ms de x5, rondaría los 65 ms por tick.

## El criterio declarado no discrimina, y hay que decirlo

El plan escribió antes de mirar: *pasa quien dé 50 fps o más con el corpus de hoy y 30 fps o más a
x5; si los dos pasan, gana el que no añada dependencia*. **Las cuatro combinaciones pasan las dos
puertas.** Aplicando el criterio al pie de la letra, ganaría SVG con la física propia, que es la
que no añade nada.

No se elige eso, y el motivo no es que el criterio se haya quedado corto por casualidad: es que
miraba hoy y un año, y el corpus tiene tres años de proyección escrita en el mismo plan.

## La decisión: canvas 2D y d3-force

**Canvas para pintar.** No porque hoy haga falta, que hoy SVG da 144 fps de sobra, sino por tres
cosas que solo se ven en la tabla completa:

1. **A tres años solo canvas sigue en pie**: 45 fps contra 19.
2. **El p95 de SVG a x5 ya no cabe en un frame.** Son 18,6 ms sobre un presupuesto de 16,7 ms a
   60 Hz, y eso **antes** de añadir nada de lo que el banco no mide: hover, etiquetas, resaltado,
   arrastre y el resto de la aplicación. Canvas a x5 va en 12,1 ms y deja 4,6 de margen.
3. **Escribir el pintor canvas cuesta lo mismo que escribir el SVG.** No hay ahorro real en la
   opción conservadora, así que la puerta "gana el que no añada dependencia" no compra nada aquí.

**d3-force para la física.** Pierde a x1 por 0,6 ms, que con los dos por debajo de 1,5 ms no
significa nada, y gana a x5 por 7 ms, casi el doble: es el quadtree de Barnes-Hut contra el O(n²).
Y trae resueltos `forceCollide`, `forceLink` por id, `alphaTarget` y el anclado con `fx`/`fy` del
arrastre, que en la propia habría que escribir a mano. Son unos 11 kB gzip entre `d3-force`,
`d3-quadtree`, `d3-timer` y `d3-dispatch`.

## Lo que este banco corrige del diagnóstico de ayer

**Pintar 455 nodos y 650 aristas en SVG cuesta 1,5 ms.** Los **265 a 411 ms** que medimos ayer al
cambiar un filtro no venían del dibujo: venían de recalcular 160 iteraciones de layout de forma
síncrona en el hilo principal. El motor de pintado no era el problema y cambiarlo no habría
arreglado los filtros. Lo que los arregla es la simulación incremental de la fase 1.1, que conserva
las posiciones y solo reinicia alpha.

## El umbral del Web Worker, ahora con número

A x10 la física son **19,9 ms de los 21,3 totales, el 93% del coste**. El pintado es ruido a su
lado. Así que el día que esto no dé, lo que hay que mover es la física y no el pintor, que es
exactamente lo que hace Obsidian con su `worker`.

**El umbral concreto: cuando el tick pase de unos 8 ms.** Eso ocurre en torno a los 2.300 nodos,
o sea x5, o sea unos 18 meses al ritmo actual de 230 memorias nuevas al mes. Hasta ahí cabe de
sobra en el hilo principal y un worker sería complejidad sin problema que resolver.

## Un hallazgo de diseño que los números no dan

La captura del último caso enseña la componente mayor **apelmazada en un cuadrado**. La causa son
las anclas por componente con una fuerza uniforme de 0,05: a una isla de dos nodos la sujetan bien,
y a la componente de 269 la comprimen contra su centro más de lo que la repulsión puede abrirla.

**La fuerza del ancla tiene que escalar a la inversa del tamaño de su componente.** Va a la fase
1.1, y es de las cosas que solo aparecen mirando el dibujo.

## Limitaciones, dichas

- **No se mide texto.** En canvas `fillText` es más caro que un `<text>` en SVG. Con el tope de 45
  etiquetas de la vista actual debería ser despreciable, pero no está medido.
- **No hay culling por viewport.** Con él los dos mejoran, canvas más: el coste de SVG es tener los
  elementos en el DOM, no solo dibujarlos.
- **Los 144 fps de x1 son el techo del monitor**, no el del motor. Los milisegundos por frame son
  la medida que no depende de la pantalla.
- **El escalado sintético no es el corpus futuro**, es la mejor aproximación disponible: replica la
  topología real, que es lo único que sabemos de cómo va a crecer.
- **Un solo equipo.** Estos números son de este PC. En una máquina más lenta todo baja, y la
  conclusión relativa entre motores se mantiene, pero los umbrales absolutos se mueven.
