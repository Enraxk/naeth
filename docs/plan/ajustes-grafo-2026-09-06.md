# El panel de ajustes del grafo

Plan del 06/09/2026, decidido con Eneko sobre el banco `canal-vivo`. Es la entrada **G-I** de
[`grafo-lo-que-queremos.md`](grafo-lo-que-queremos.md), ampliada: ya no son "los ajustes de fuerza",
es **que los valores del grafo dejen de ser constantes y pasen a ser mandos**.

## Por qué esto va antes que construir el tinte y las flechas

Veníamos de decidir en un banco qué tinte y qué punta de flecha se quedaban fijos en el código.
**El panel hace esa decisión innecesaria**: en cuanto exista, el visor es el banco, y los valores se
eligen mirando el grafo de verdad en vez de una maqueta. Lo que hoy es una discusión ("¿55% o 30%?")
pasa a ser un deslizador.

Y hay un motivo de fondo que apuntó Eneko: **si algún día usa Naeth alguien más, los ajustes por
persona dejan de ser un lujo**. Esta pieza es además el primer caso de uso real de F3 (el corpus
compartido) con riesgo casi nulo: si se pierde una preferencia no pasa nada, y si se pierde una
memoria sí.

## Las tres decisiones tomadas

| Decisión | Elegido | Consecuencia |
|---|---|---|
| Dónde se guarda | **`localStorage` ahora, Naeth cuando toque F3** | Un módulo con el almacén detrás de una interfaz, para que el cambio no toque el panel |
| Dónde vive | **Panel lateral en el propio Grafo** | Se ve el efecto de cada mando al instante. Ajustes solo enlazará |
| Hasta dónde llega | **Todo, incluido lo experimental, con vuelta a un estado seguro** | El "estado seguro" no es un extra: es lo que hace viable lo experimental |

## Lo que hay hoy, y que pasa a ser un mando

Inventario real del código, no una lista de deseos:

| Grupo | Qué | Valor de fábrica | Dónde vive hoy |
|---|---|---|---|
| Texto | umbral de aparición / texto pleno | 0,75 · 1,65 | `pintor.ts` |
| | tope de etiquetas con foco | 26 | `pintor.ts` |
| Nodos | escala con el aumento (exponente) | 0,6 | `pintor.ts` |
| | radio mínimo y máximo en pantalla | 1,6 · 40 | `pintor.ts` |
| Aristas | tinte por tipo de relación | nuevo | banco |
| | punta de flecha: tamaño y posición | 5 px, a media arista | banco |
| Física | distancia de reposo de una arista | 34 | `sim.ts` |
| | repulsión entre nodos | -38 | `sim.ts` |
| | frenado | 0,35 | `sim.ts` |

## Fase 0 · La medición que falta, y el único riesgo técnico

**La pregunta**: ¿se puede cambiar una fuerza con el deslizador en movimiento? Reconstruir el
simulador está medido y cuesta **entre 265 y 411 ms de hilo bloqueado**, que a diez cambios por
segundo es inaceptable. d3 permite reconfigurar una fuerza viva, pero eso hay que medirlo, no
suponerlo.

- **Entregable**: el coste en ms de reconfigurar `link.distance` y `charge.strength` sobre una
  simulación ya asentada, con el corpus real.
- **Y el criterio, declarado antes de medir**: por debajo de 16 ms los deslizadores de física se
  aplican **en continuo**; por encima, se aplican **al soltar**, y se dice en el propio panel.

## Fase 1 · El módulo de preferencias

`lib/prefs-grafo.svelte.ts`, siguiendo el patrón que ya existe en `prefs.svelte.ts`.

- **Un solo sitio** con cada valor, su rango, su paso y su valor de fábrica. Si un mando no está ahí,
  no existe.
- **El almacén, detrás de una interfaz** (`leer` / `escribir`), con implementación de `localStorage`.
  Cuando llegue F3, se cambia esa pieza y el panel no se entera.
- ⚠ **Arranque a prueba de balas, y esto no es opcional**: lo guardado se valida contra el rango, y
  lo que no cuadre se ignora y cae a fábrica. Sin eso, un valor malo guardado deja el grafo
  inservible **para siempre**, porque el panel para arreglarlo vive dentro del grafo roto.
- **Tests**: rangos respetados, restauración a fábrica, valor corrupto ignorado, y que un
  `localStorage` que lanza excepción no rompa el arranque (pasa en modo privado).

## Fase 2 · Las constantes se convierten en mandos

Las de `pintor.ts` y `sim.ts` pasan a leerse de las preferencias.

- ⚠ **Con los valores de fábrica, el grafo tiene que verse EXACTAMENTE igual que hoy.** Es un
  refactor, no un rediseño.
- **Test de no regresión**: las funciones puras (`radioEnPantalla`, `opacidadTexto`) devuelven con
  fábrica los mismos números que la suite ya fija hoy.
- `sim.ts` gana un método para reconfigurar en vivo, según lo que diga la fase 0.

## Fase 3 · El panel

Panel lateral en `Grafo.svelte`, plegable, con su estado recordado.

- Secciones: **Texto · Nodos · Aristas · Física · Experimental**.
- Cada mando enseña **su valor numérico**: un deslizador sin número no se puede comunicar ni comparar
  con lo medido.
- **Restaurar por sección y restaurar todo**, siempre visibles.
- Accesible con teclado, como el resto del visor: los `input[type=range]` ya lo son, pero el panel
  necesita su foco y su cierre con Escape.

## Fase 4 · Lo experimental y la salida de emergencia

Aquí entran los mandos que hoy no existen ni como constante (curvatura de arista, opacidad por capa,
separación por proyecto), y por eso son los que pueden dejar el grafo raro.

- **La salida**: además del botón de restaurar, una vía que funcione **con el grafo ya roto**. Lo más
  simple que funciona: `#/grafo?reset` limpia las preferencias antes de montar nada.
- Lo experimental va marcado como tal en el panel. Es información honesta, no un descargo.

## Fase 5 · Ajustes enlaza, y el banco se retira

- `Ajustes` gana una sección **Grafo** que resume los valores activos y enlaza al panel.
- ⚠ La frase "Solo lectura. Nada de esta página se puede cambiar desde aquí" **se matiza, no se
  borra**: sigue siendo verdad para las memorias, que es de lo que hablaba. Las preferencias de
  dibujo no pasan por los enforce de autoría ni de digest porque no son contenido.
- Los bancos `arista.html` y `canal-vivo.html` **se quedan** como registro de cómo se decidió, con
  una nota diciendo que el visor ya hace su trabajo.

## Lo que NO entra, dicho

- **Guardar en Naeth**: es F3, y hasta que exista la identidad no hay dónde.
- **Varios presets con nombre**: Eneko pidió "guardarlo como predeterminadas", en singular. Un
  conjunto de valores propios más los de fábrica. Más de eso es inventar.
- **Ajustes que cambien QUÉ se ve** (filtros, capas): eso ya vive en la barra del grafo y no es
  preferencia, es consulta.

## Verificación

| Qué | Cómo |
|---|---|
| No hay regresión | Con fábrica, el grafo se ve igual que hoy. Comparación de píxeles contra una captura previa |
| El arranque aguanta basura | Meter a mano un valor fuera de rango y un JSON roto en `localStorage`, y que el grafo monte |
| La física en vivo | El número de la fase 0, y el deslizador moviéndose sin que el grafo se congele |
| La salida funciona | Dejar el grafo inservible a propósito y recuperarlo con `?reset` |
| Suite acumulada | `npm test && npm run check && npm run build` al cerrar cada fase |
