# Mapa: todo lo que está abierto en Naeth

**Índice maestro. Se actualiza, no se archiva.** Última revisión: **09/09/2026**.

Existe porque el 04/09 se aprendió que un plan que solo vive en un sitio volátil caduca sin avisar,
y porque hay tres documentos vivos a la vez y ninguno dice cuál es cuál. Este los ordena y dice el
estado de cada cosa. **No prioriza**: eso lo decide Eneko, y desde el 09/09 lo que prioriza es el
roadmap.

**Estado del sistema**: visor v2 completo con el panel de ajustes del grafo, `2.2026.09.2` en los dos
nodos, failover vivo (epoch 162), 551 vigentes de 943 filas, 263 tests de front y 261 en el
reconciler de CENIT.

⚠ **CAMBIO DE MARCO, 09/09/2026: Naeth pasa de proyecto a PRODUCTO, con CENIT dentro como núcleo.**
El objetivo, por orden: que lo use otra gente, que abra puertas, y el dinero al final. Eso reordena
esta lista, porque casi nada de lo de abajo está en el camino del producto: son mejoras de la
herramienta diaria, y siguen valiendo como tales.

**Los documentos**:
- [`roadmap-producto-2026-09-09.md`](roadmap-producto-2026-09-09.md) · **el que prioriza**. Seis
  fases al producto, con entregable verificable y lo que no entra
- [`../discovery/cenit-verificacion-2026-09-09.md`](../discovery/cenit-verificacion-2026-09-09.md) ·
  qué de CENIT es foso real y qué era una frase de README, verificado contra el código
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
| F3 | Corpus compartido | ⚠ **Más barato de lo que decía este mapa.** Ver abajo |
| F4 | El pase de mantenimiento | El coste de una pasada sobre 551 memorias |

⚠ **F3 se abarata, medido el 09/09.** Este mapa decía que la pregunta previa era "dónde vive la
identidad". Media respuesta ya estaba puesta: **el proxy inyecta el email y el `sub` de Pocket-ID en
la petición que entra a Naeth, y el código no lee ninguna cabecera** (una petición con un email
inventado devuelve 200). Así que F3 es **barato en la identidad y caro en los datos**: cero columnas
de propietario en las diez tablas de dominio (no quince: el recuento viejo incluía vistas y
escombros de migración), cero RLS, y 31 consultas en `app/core.py` que no filtran por nadie. Sigue en
pie lo del `sync.py`, que aborta ante cualquier tabla sin clasificar.

⚠ Y aparece un **prerrequisito que no estaba en ninguna lista**: el visor autenticado por SSO y el
loopback 8801 sin auth son **el mismo proceso y el mismo puerto**, así que hoy el código no puede
distinguir a Eneko autenticado de cualquier cosa que corra en su máquina. Es la fase 3 del roadmap.

## El producto (nuevo el 09/09)

Estas cuatro no estaban en el mapa porque no existían como trabajo hasta que Naeth pasó a ser
producto. **Van por el [roadmap](roadmap-producto-2026-09-09.md), que sí las ordena en el tiempo.**

| | Qué | Estado | Nota |
|---|---|---|---|
| P-A | Separar la plataforma de la instancia | `listo` | El trabajo número uno. `core/config.yaml` está commiteado con el despliegue de Eneko dentro |
| P-B | Naeth instalable solo | `listo` | Solo compose y documentación, cero código. Un día o dos |
| P-C | La cara pública | `bloqueado` | Depende de P-A (el repo de CENIT es privado) y de P-B para no dejar la visita a medias |
| P-D | Alojamiento de pago | `frente` | **Aparcado**: el dinero va último. Exige medir costes reales |

## Sueltos

| | Qué | Nota |
|---|---|---|
| S1 | El `role="tree"` con teclado | Construirlo entero, no completarlo |
| S2 | Merge de `digest` en el sync | Sin decidir. Toca CENIT |
| S3 | El tick que compare epochs | Cierra el takeover invisible. Es de CENIT |
| S4 | El corte de 50 de la rama léxica | Comprobar que no se cae una fila sin embedding |
| S5 | El grafo en el móvil | ⚠ "Funciona fatal" (Eneko, 08/09), sin diagnosticar. A 375 px la arista mediana mide 10,5 px |
| S6 | La asimetría PC/VPS del reconciler | Viva desde el 20/08. Es de la instancia, no de la plataforma: fuera del roadmap |

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
