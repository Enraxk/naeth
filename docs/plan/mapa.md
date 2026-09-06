# Mapa: todo lo que está abierto en Naeth

**Índice maestro. Se actualiza, no se archiva.** Última revisión: **06/09/2026**.

Existe porque el 04/09 se aprendió que un plan que solo vive en un sitio volátil caduca sin avisar,
y porque hay tres documentos vivos a la vez y ninguno dice cuál es cuál. Este los ordena y dice el
estado de cada cosa. **No prioriza**: eso lo decide Eneko.

**Estado del sistema**: visor v2 completo, `2.2026.09` en los dos nodos, failover cerrado (epoch
156), 529 vigentes de 907 filas, 236 tests de front.

**Los documentos**:
- [`grafo-lo-que-queremos.md`](grafo-lo-que-queremos.md) · la lista del grafo, 12 entradas
- [`naeth-ideas-2026-09-06.md`](naeth-ideas-2026-09-06.md) · la ronda de ideas, 16 más 4 frentes
- [`grafo-vivo-2026-09-05.md`](grafo-vivo-2026-09-05.md) · el diario de la jornada del grafo
- [`pendientes.md`](pendientes.md) · lo de fases anteriores, casi todo cerrado

**Los estados**: `listo` se puede medir ya · `frente` abierto y sin investigar · `absorbido` por otra
entrada, no es trabajo aparte · `bloqueado` espera una decisión o a otra pieza · `muerto` lo tumbó
una medición.

---

## La lista del grafo (12)

### Los datos que el grafo ya tiene y no cuenta

| | Qué | Estado | Nota |
|---|---|---|---|
| G-A | Dirección de las relaciones | **`medido`** | Cabe: punta de flecha en el 97% del escritorio. [Medición](../discovery/canal-arista-2026-09-06.md) |
| G-B | Tipo de relación | **`medido`** | Color, tres tintes, legible a 11,5 px. ⚠ Falta ver cómo convive con el resalte |
| G-C | Etiquetas como nodos | **`muerto`** | 403 de 695 tags se usan una vez: la mitad serían hojas de grado 1 |
| G-D | Autoría | `bloqueado` | 186 sin marcar. Decidir antes si es color o filtro |

### El tiempo

| | Qué | Estado | Nota |
|---|---|---|---|
| G-E | Edad como señal visual | `listo` | ¿brillo, tamaño o saturación? |
| G-F | Time-lapse del corpus | `bloqueado` | El más caro y el que menos se usa |
| G-G | Versiones por nota | `absorbido` | Se solapa con I-G, la puerta del tiempo |

### Lo apuntado de antes

| | Qué | Estado | Nota |
|---|---|---|---|
| G-H | Buscador integrado | `listo` | **No depende de nada.** Pieza de trabajo diario |
| G-I | Ajustes de preferencia | `listo` | Los umbrales ya son constantes con nombre |
| G-J | Degradado por vecindario | `bloqueado` | Aplazado con la estética |
| G-K | Wikilinks rotos visibles | `listo` | 80 medidos |
| G-L | Profundidad del grafo local | `listo` | Pequeño |
| G-M | Exportar como imagen | `listo` | Pequeño |

## La ronda de ideas (16)

### Lo que el corpus pide a gritos

| | Qué | Estado | Nota |
|---|---|---|---|
| I-A | La deuda de verificación | `absorbido` | 44 abiertas, 14 de más de un mes. La come F4 |
| I-B | Registro de lecturas | `listo` | Hoy no existe ninguno. **Requisito de I-M y del peso muerto** |
| I-C | Limpiar los tags | `bloqueado` | Decidir antes qué son los tags |
| I-D | Las 192 aisladas | `listo` | Medir 20 antes de proponer relaciones |

### Cambian cómo se usa

| | Qué | Estado | Nota |
|---|---|---|---|
| I-E | Avisar de contradicciones | `bloqueado` | La similitud comprimida puede hacerlo ruido |
| I-F | Qué haría falsa esta memoria | `listo` | La más rentable de la lista |
| I-G | La puerta del tiempo | `listo` | El diff entre versiones: pequeño y visible |
| I-H | Naeth pregunta | `absorbido` | Por F1 más F4 |

### Las locas

| | Qué | Estado | Nota |
|---|---|---|---|
| I-I | El corpus se lee a sí mismo | `absorbido` | Es el motor de F4 |
| I-J | Renovar en vez de caducar | `absorbido` | La come F4 |
| I-K | Naeth para un tercero | `absorbido` | Por F3, que va más lejos |
| I-L | Anotación al margen | `listo` | Comentar sin superseder. Habilita F1 |
| I-M | El paseo de domingo | `bloqueado` | Imposible sin I-B |
| I-N | Adjuntos | `listo` | La tabla existe y está vacía |
| I-O | No entra sin verificar | `bloqueado` | Caro. Solo para lo que sostiene dinero |
| I-P | Medir la escala | `listo` | 3.000 memorias en un año, y nada probado ahí |

## Los cuatro frentes

| | Qué | Qué investigar primero |
|---|---|---|
| F1 | Inteligencia dentro de Naeth | Qué pasa cuando se equivoca, no qué puede escribir |
| F2 | El móvil como cliente | Qué NO cubre una PWA con Web Push |
| F3 | Corpus compartido | Dónde vive la identidad, y qué le hace eso al `sync.py` de CENIT |
| F4 | El pase de mantenimiento | El coste de una pasada sobre 529 memorias |

## Sueltos

| | Qué | Nota |
|---|---|---|
| S1 | El `role="tree"` con teclado | Construirlo entero, no completarlo |
| S2 | Merge de `digest` en el sync | Sin decidir. Toca CENIT |
| S3 | El tick que compare epochs | Cierra el takeover invisible. Es de CENIT |
| S4 | El corte de 50 de la rama léxica | Comprobar que no se cae una fila sin embedding |

---

## Las cinco dependencias que mandan

1. **F4 alimenta a F1 y F2.** Sin pase de mantenimiento, la personalidad es solo tono y el móvil no
   tiene qué notificar.
2. **F4 se come a I-A, I-F, I-I y I-J.** Son cuatro caras del mismo trabajo, no cuatro tareas.
3. **I-B va antes que I-M** y antes de cualquier respuesta a "qué es peso muerto": sin saber qué se
   lee, no hay dato con el que responder.
4. **F3 se come a I-K** y arrastra el `sync.py` de CENIT, que aborta ante una tabla sin clasificar.
5. **G-H (el buscador) y F2 (la PWA) no dependen de nada.** Son las dos únicas piezas sueltas.

## Los dos canales saturados, que se vieron al dibujar el mapa

No es uno, son dos, y esto ordena media lista del grafo:

- **La arista**: la quieren G-A (dirección) y G-B (tipo). El patrón ya lo ocupan las tres capas, y el
  color ya lo ocupa el estado apagado/encendido del resalte. **Medido el 06/09**: caben las dos a la
  vez, flecha en el extremo y color en el trazo. Ver
  [`canal-arista-2026-09-06.md`](../discovery/canal-arista-2026-09-06.md).
- **El nodo**: hoy el color es el proyecto y la forma es el tipo de memoria, las dos ocupadas. Y lo
  quieren **G-D** (autoría), **G-E** (edad) y **G-J** (degradado por vecindario). Sin medir. Es el
  cuello de botella real de la lista, y la pregunta previa es cuántas dimensiones puede llevar un
  nodo de 4 px de radio sin volverse ruido.

⚠ Corrección del 06/09: este mapa decía en su primera versión que G-J competía por la arista. Es del
**nodo**: la idea era que una nota tire hacia el color de los proyectos con los que más habla.
