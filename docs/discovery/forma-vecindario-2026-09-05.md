# La forma de un vecindario: qué se puede prometer y qué no

Medido el 05/09/2026 con `naeth/web/bench/vecindario.html` sobre el corpus de producción (455 nodos,
650 aristas) y 40 vecindarios de grado 3 o más.

## La pregunta

Eneko, viendo el mini grafo de una ficha: *"esa forma es la que tiene que tener"*, señalando cómo se
ve ese mismo vecindario dentro del grafo global. Y después, la que de verdad decide el diseño:
*"cuando tengamos más relaciones ese nodo puede llegar a cambiar de forma y quiero que cambie de
forma. ¿Cómo hacemos sostenible el congelado?"*.

O sea, dos cosas a la vez: que la forma **sea reconocible** y que **cambie cuando tenga que cambiar**.

## Cómo se mide una forma

La rotación no importa: un vecindario girado se reconoce igual. Así que se busca el giro que mejor
casa las dos disposiciones y se mide lo que queda. Dos métricas:

- **Error angular**: desviación media de cada vecino respecto a donde está en el global, tras ese
  giro.
- **Orden circular**: qué fracción de vecinos conserva a su vecino de al lado alrededor del centro.
  Es lo que el ojo reconoce de verdad, más que las distancias exactas.

## Lo primero que salió: el mini de hoy no representa ninguna forma

| opción | error | orden conservado | ms/ficha |
|---|---|---|---|
| A. recorte del simulador global | 0,0° | 100% | 0 |
| D. posiciones globales guardadas | **0,0°** | **100%** | 0 |
| B. simulación propia sembrada con las globales | 19,3° | 76% | 3,6 |
| C. simulación propia, lo que había | **66,5°** | **10%** | 3,8 |

**El 10% de orden conservado es el titular.** Y el dibujo lo enseña sin leer números: en el global el
vecindario tiene forma irregular, con vecinos a distintas distancias y direcciones; simulado aparte
sale **un anillo regular**. La física aislada convierte cualquier vecindario en el mismo anillo, o
sea el diseño radial que se había retirado esa misma mañana, reinventado sin querer.

Y la sorpresa útil: **D da fidelidad perfecta sin el simulador único vivo que iba a proponer**. Basta
guardar un mapa de posiciones. La pregunta de si los filtros pasaban a ser de pintado se vuelve
innecesaria.

## Lo segundo: cuánto aguanta ese mapa cuando el corpus crece

Notas nuevas enganchadas a notas existentes, que es como crece de verdad, al ritmo medido de unas
230 memorias vigentes al mes. La **deriva** es cuánto se mueve la forma de los vecindarios que **no**
han cambiado: es ruido puro, movimiento sin motivo.

| crecimiento | acomodo normal | acomodo suave | anclado selectivo | nodos clavados | rehacer de cero |
|---|---|---|---|---|---|
| un día (+8) | 5,4° | **3,0°** | 2,9° | 445 de 455 | 12,0° |
| un mes (+230) | 34,6° | **32,9°** | 39,2° | **227** de 455 | 44,5° |
| tres meses (+690) | 42,9° | **42,0°** | 59,7° | **59** de 455 | 47,4° |

Tres lecturas, y la tercera es la que importa.

**1. Mantener siempre gana a rehacer.** A un día, 3,0° contra 12,0°. Rehacer el mapa desde cero
cambia la forma de cosas que no han cambiado, que es exactamente lo que no se quiere.

**2. El anclado selectivo, que parecía la respuesta literal, es peor.** La idea era clavar los nodos
cuyo vecindario no ha cambiado y dejar libres los demás. Gana a un día por una décima de grado
(irrelevante) y **pierde claramente a partir del mes**: 39,2° contra 32,9°, y 59,7° contra 42,0° a
tres meses. Con media plantilla clavada, la otra media se retuerce entre los clavados y acaba peor
que si se hubieran movido todos un poco.

**3. Y el dato que explica todo lo anterior: la columna de clavados.** A un día, 445 de 455 nodos
conservan su vecindario exacto. **A un mes, solo 227: la mitad del corpus ha cambiado de
vecindario.** A tres meses, 59, o sea el 13%.

## La conclusión, que responde a la pregunta

**La forma es estable justo en la medida en que el corpus lo es, y eso no es un defecto del
algoritmo.** A escala de días, cualquier método razonable conserva la forma (3° de deriva). A escala
de meses la deriva sube a 33°, pero para entonces **la mitad de las notas han cambiado de vecindario
de verdad**: su forma no está derivando, está reflejando que ahora se relacionan con otras cosas.

Así que no hay nada que "hacer sostenible": la pregunta llevaba dentro una promesa que no se puede
cumplir, la de una forma permanente sobre un corpus que se renueva a la mitad cada mes. Lo que sí se
puede prometer, y es lo que se pedía, es esto:

- **Reconocible**: la ficha enseña exactamente la disposición que esa nota tiene en el grafo.
- **Estable mientras nada cambie**: 3° de deriva por jornada de trabajo.
- **Cambia cuando cambia**: y cambia porque el vecindario cambió, no porque se haya vuelto a sortear.

## Qué se implementa

**Las posiciones vienen de un mapa global mantenido, y la ficha arranca con ellas.** La simulación de
la ficha despierta solo cuando el usuario arrastra, así que sigue viva sin destruir la forma al
abrir.

El mapa se mantiene con `Simulador.cambiar(model, 0.06)`, que conserva las posiciones de lo que
sigue estando. Cuesta entre 380 ms y 1,6 s según cuánto haya crecido, y solo se paga cuando el
corpus cambia: troceado en unos pocos ticks por frame, no bloquea nada.

**Lo que NO hace falta**, y era la mitad de la propuesta inicial: un simulador único vivo en toda la
aplicación, y convertir los filtros de física en filtros de pintado. Las dos cosas se quedan como
están.

## Limitaciones, dichas

- **Un solo equipo y un solo corpus.** Los tiempos son de este PC; las derivas dependen de cómo
  crece Naeth, que es lo que hay pero no es una ley.
- **El crecimiento sintético engancha las notas nuevas al azar** entre las existentes. El corpus real
  las engancha por tema, así que la perturbación real probablemente sea algo más local y la deriva
  algo menor que la medida.
- **No se ha medido la percepción.** Que 33° de error angular se lea como "otra forma" es una
  suposición razonable, no un dato.
