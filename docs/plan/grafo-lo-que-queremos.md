# El grafo: lo que queremos, y por dónde se decide

Documento vivo, abierto el 05/09/2026 al terminar la jornada del motor. No es un plan de ejecución:
es la lista de lo que puede entrar, para ir mirándola y decidiendo. El plan de la jornada está en
`grafo-vivo-2026-09-05.md`.

**El método, pedido por Eneko en esta ronda: medir, prototipar, y decidir después.** Ninguna entrada
de aquí pasa a ejecución sin su medición delante. La fase 0 del 05/09 funcionó así y salvó de elegir
motor por intuición; la del vecindario tumbó la mitad de una propuesta mía. Cada entrada lleva por
eso su casilla de **qué medir antes**.

---

## 1. Lo que tiene el grafo de Obsidian y nosotros no

Las 24 opciones son las reales de su binario, sacadas de `obsidian-typings@4.61.0`
(`GraphPluginInstanceOptions`), no de la documentación.

| Obsidian | Nosotros | Qué haría falta |
|---|---|---|
| `search` · buscar y filtrar en el grafo | **no** | Ya apuntado como pieza propia: buscar enciende en grafo y árbol |
| `showTags` · etiquetas como nodos | **no** | **695 tags distintos** en 528 memorias, sin usar |
| `hideUnresolved` · enlaces rotos | **no** | Tenemos **80 wikilinks rotos** medidos, invisibles hoy |
| `showOrphans` · huérfanas | sí | "ocultar sueltas" |
| `showAttachments` · adjuntos | no aplica | Naeth no tiene adjuntos |
| `colorGroups` · color por búsqueda | **no** | Nosotros coloreamos por proyecto, siempre |
| `showArrow` · dirección | **no** | **0 relaciones recíprocas de 501**: la dirección nunca es redundante |
| `textFadeMultiplier` | sí, fijo | `ZOOM_TEXTO_DESDE` y `ZOOM_TEXTO_PLENO`, listos para deslizador |
| `nodeSizeMultiplier` | sí, fijo | `escalaNodo`, hoy 1 y 2,2 en el compacto |
| `lineSizeMultiplier` | **no** | Grosor de arista fijo |
| `centerStrength`, `repelStrength`, `linkStrength`, `linkDistance` | sí, fijos | La fase de ajustes |
| `localJumps` · profundidad del grafo local | **no** | El mini es de un salto, fijo |
| `localBacklinks` / `localForelinks` / `localInterlinks` | **no** | El mini mezcla entrantes y salientes sin distinguir |
| `scale` · zoom guardado | **no** | No se persiste nada de la cámara |
| `collapse-*`, `close` · estado de los paneles | parcial | |
| Animate · time-lapse por fecha | **no** | |
| Captura del grafo (con fondo y transparente) | **no** | `getBackgroundScreenshot` / `getTransparentScreenshot` |
| Menú contextual con clic derecho | **no** | `onNodeRightClick` |

## 2. Lo que tenemos y Obsidian no

No para presumir: para no romperlo al copiar cosas de la lista de arriba.

- **Capa semántica por embeddings**: vecinos por significado, que Obsidian no puede tener porque no
  tiene embeddings. Se pide por nodo (16 ms) y no global (2,7 s).
- **Tres capas de arista** distinguidas por trazo: relación, wikilink, vecino semántico.
- **Formas por tipo de memoria**, con el vocabulario cerrado de Naeth.
- **El hilo entre las tres vistas**: señalar en el árbol, en el grafo o en la ficha enciende en las
  otras dos.
- **El mapa de posiciones compartido**: el vecindario de una ficha tiene la MISMA forma que en el
  grafo global. Medido: simulándolo aparte se pierde el 90% del orden de los vecinos.
- **La franja** que cuenta lo señalado sin tapar el lienzo.
- **Lista accesible** de los nodos, que en un lienzo no existe por defecto.

## 3. La lista, con lo que hay que medir antes de cada cosa

Eneko quiere las cuatro primeras, y las tres del tiempo "a ser posible". El orden lo decide lo que
digan las mediciones.

### 3.1 Lo que el grafo no cuenta de los datos que ya tiene

| # | Qué | Medido | Qué medir o probar antes |
|---|---|---|---|
| A | **Dirección** de las relaciones | 501 relaciones, **0 recíprocas** | Si las flechas se leen a los aumentos reales o son ruido: a encuadre completo una arista mide pocos píxeles. Prototipo con punta de flecha contra arista degradada (más limpia a tamaño pequeño) |
| B | **Tipo** de relación | `links_to` 286, `derived_from` **165**, `depends_on` 48, y dos sueltas | Con qué se codifica sin chocar: la forma del trazo ya la ocupan las tres capas, así que quedan color y grosor. Hay que ver si `derived_from` merece además dirección propia |
| C | **Etiquetas** como nodos | **695 distintas**, más que memorias | Cuántas aristas nuevas salen y cuántas cruzan proyecto, igual que se midió con los wikilinks (+162, 31% transversales). Y el coste: 695 nodos más sobre 455 es más que doblar el grafo |
| D | **Autoría** | 299 `code`, 41 `web`, 3 `visor`, **186 sin marcar** | Poco que medir, mucho que decidir: es otra dimensión compitiendo por el color, que ya lo ocupa el proyecto. Puede que sea filtro y no color |

### 3.2 El tiempo

| # | Qué | Medido | Qué medir o probar antes |
|---|---|---|---|
| E | **Edad** como señal visual | 230 memorias nuevas al mes; el corpus tiene cuatro meses | Si la edad se lee mejor como brillo, tamaño o saturación sin pelearse con lo que ya codifica cada canal |
| F | **Time-lapse** del crecimiento | jun 33, jul 209, ago 242, sep 44 | El más caro de los tres y el que menos se usa. Antes de construirlo, decidir si se mira una vez al mes o una vez al año |
| G | **Versiones** de cada nota | 148 con más de una; una con **21**, otra con 14, otra con 13 | Qué se codifica: ¿el número de versiones, o la fecha de la última? Son preguntas distintas ("cuánto se ha pensado esto" contra "cuándo se tocó") |

### 3.3 Lo apuntado de antes, sin hacer

| # | Qué | Estado |
|---|---|---|
| H | **Buscador** integrado con grafo y árbol | Pieza propia, sin empezar. `lib/search.svelte.ts` no toca `resalte` |
| I | **Ajustes de preferencia** (fuerzas, aparición, umbral de texto) | Los umbrales ya son constantes con nombre esperando el deslizador |
| J | **Degradado de color por vecindario** | Idea de Eneko: que una nota tire hacia el color de los proyectos con los que más habla. Medible: el 24% de aristas cruzan proyecto |
| K | **Wikilinks rotos** visibles | 80 medidos, y el contador de `memory_stats` solo ve 41 porque resuelve por menos vías |
| L | **Profundidad del grafo local** | El mini es de un salto fijo; Obsidian deja elegir |
| M | **Exportar el grafo como imagen** | Obsidian lo tiene con y sin fondo |

## 4. Lo que está pendiente de cerrar, y no es nuevo

- **`finally` sigue con el build del 28/08.** Nada de esta jornada está allí. Toca `git pull` y
  `./up.sh --build`, y el tag `2.2026.09` **al desplegar**.
- El plan del día (`grafo-vivo-2026-09-05.md`) tiene su fase 4 de cierre sin ejecutar.
