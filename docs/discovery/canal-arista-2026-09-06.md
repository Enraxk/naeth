# El canal de la arista: cuánto sitio hay de verdad para decir algo

Medido el 06/09/2026 con `naeth/web/bench/arista.html`, sobre el grafo real y con la misma física y
la misma fórmula de encuadre que usa `Lienzo.svelte`. Primera medición de la lista del grafo.

**La pregunta**: G-A (dirección de la relación) y G-B (tipo) quieren hablar las dos por el mismo
trazo. Y hay un canal ya ocupado que acota las respuestas: **el patrón del trazo es de las tres
capas** (relación sólida, wikilink punteada, semántica discontinua), así que el tipo no puede
usarlo. Antes de elegir cómo se pinta cada cosa había que saber cuánto mide una arista en pantalla.

**Los umbrales, declarados antes de medir** para que la comparación no estuviera amañada: 10 px para
una punta de flecha con dos lados distinguibles, 18 px para tres ciclos de un patrón, 30 px para que
un degradado a lo largo del trazo se perciba como dirección.

## Lo medido

Grafo real: **532 nodos, 651 aristas**, caja de 2.063 x 2.729 unidades. Arista en unidades de mundo:
p10 38,6 · **mediana 64,1** · p90 131,2.

| Lienzo | k | p10 | mediana | p90 | ≥10px | ≥18px | ≥30px |
|---|---|---|---|---|---|---|---|
| escritorio 1400x900 | 0,297 | 11,5 px | **19,0 px** | 38,9 px | **97%** | 57% | 18% |
| portátil 1100x700 | 0,231 | 8,9 px | 14,8 px | 30,3 px | 86% | 32% | 10% |
| móvil 375x520 | 0,164 | 6,3 px | 10,5 px | 21,5 px | **56%** | 15% | 2% |
| **mini de la ficha** | 1,70 | 46,0 px | **89,5 px** | 158,3 px | **100%** | **100%** | **98%** |

## ⚠ El error que casi se cuela, y por qué importa

La primera versión de este banco metía el mini de la ficha en la tabla de arriba: **el grafo entero
encuadrado en 276 x 220**. Daba 3,7 px de mediana y la conclusión "en el mini no cabe nada", que es
**cierta para un caso que no ocurre jamás**. El mini enseña UN VECINDARIO, tres nodos de mediana, no
532.

Medido como es de verdad (458 fichas con vecinos, vecindario a vecindario, con las posiciones
heredadas del mapa global), **el resultado se da la vuelta: el mini es donde MÁS sitio hay**. Su
aumento mediano es 1,70, casi seis veces el del grafo global, y el 98% de sus aristas admite hasta
un degradado.

Es el mismo patrón que ya mordió el 05/09 con el criterio de la fase 0: **el número estaba bien
calculado y contestaba a otra pregunta**.

## Lo que se ve, que es la mitad que no se deduce

Las candidatas pintadas a su tamaño real medido, no a un tamaño cómodo de demostración:

**Dirección (G-A)**

| Candidata | Veredicto |
|---|---|
| **Punta de flecha** | Se lee ya a 11,5 px y sin dudas a 19. **Es la ganadora**, y es lo que hace Obsidian |
| **Punto en el destino** | También legible a 11,5 px, y con una ventaja propia: **no depende del largo del trazo, solo del ancho**. Es el plan B para el móvil |
| Trazo que engorda | La asimetría no se percibe hasta unos 38 px. Sirve en el mini, no en el global |
| Degradado | Invisible por debajo de 30 px. **Se cae**: solo el 18% del global lo alcanza |
| Curva asimétrica | En pequeño es indistinguible de una recta. Se cae |

**Tipo (G-B)**

| Candidata | Veredicto |
|---|---|
| **Color, tres tintes** | Se distinguen ya a 11,5 px. **Gana** |
| Grosor, tres pesos | No se separan hasta unos 38 px. Se cae en el global |

## Lo que esto decide

1. **G-A cabe, y con margen.** Punta de flecha en el 97% de las aristas del escritorio a encuadre
   completo. La suposición de partida ("a encuadre completo una arista mide poquísimo") **era falsa**:
   son 19 px de mediana.
2. **G-A y G-B no chocan.** La flecha ocupa el extremo del trazo y el color ocupa el trazo: se pueden
   hacer las dos a la vez. Eso no estaba claro antes de medir.
3. **El móvil es el caso apretado, no el mini.** Con 56% por encima de 10 px, ahí la flecha falla en
   casi la mitad. Salida: el punto en el destino, que no depende del largo.
4. **El degradado y el grosor quedan descartados** para el grafo global, con número y con imagen.

## ⚠ Lo que hay que resolver antes de construir G-B

**El color de la arista NO está libre.** Hoy codifica el estado: `pintor-canvas.ts` pinta con
`tk.dim` lo apagado y `tk.ink` lo encendido, que es lo que hace que al señalar en el árbol se apague
el resto. Tinte por tipo y opacidad por estado **son separables en teoría** (tono contra alfa), pero
eso hay que verlo pintado, no razonarlo.

No es un problema de rendimiento: el pintado agrupa por capa para hacer un `stroke` por grupo, y
pasar de 3 grupos a 9 (capa x tipo) no mueve la aguja.
