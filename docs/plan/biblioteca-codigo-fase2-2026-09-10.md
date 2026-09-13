# Biblioteca de código: plan de fase 2

**Fecha**: jueves 10/09/2026, 20:50.
**Entrada**: el [discovery](../discovery/biblioteca-codigo-2026-09-10.md) (fase 1, medido) y la
[guía de documentación](../guia-documentacion.md) (cerrada a las 20:26). Este plan no reabre lo
decidido allí: tabla propia, tools propias, extracción del código, traducción al ingestar, bloques
en el grafo, filtro "Doc y más de cinco líneas", Python primero. Sin tope de horas.
**Qué es**: fase 2 de la metodología, planificación. Sub-fases atómicas, en orden, cada una con
entregable verificable, cómo se comprueba, qué se rompe si falla, y qué toca de producción. Sin
código, sin SQL, sin migraciones escritas.
**Cómo leer**: cada afirmación sobre el código lleva fichero y línea, del 10/09. Lo que la
planificación no puede saber sin probar va marcado `⚠` y tiene una sub-fase que lo mide.
**Criterio de éxito del plan**: que la sub-fase 0 se empiece sin decidir nada, y que cada sub-fase
diga qué se rompe si falla.

**Criterio de éxito de la biblioteca entera**, propuesto para no decidirlo con el resultado delante:
(1) `naeth/app` y `cenit_core` a cero avisos `D1xx`, revisados por Eneko módulo a módulo; (2) al
menos los 131 bloques Python de hoy en la biblioteca, buscables desde Claude Code con la tool nueva
y visibles en el visor; y (3) **repetir el simulacro del 10/09** en sus bloques de Python, Yogin y
CENIT (11,5 de 16 fallados, Naeth `7ddf94d1`) y medir la diferencia. El tercero es el único que
mide lo que se quería: recuperar, no almacenar. La cifra objetivo la pone él antes de repetirlo.

---

## 0. Tres cosas del código que cambian el diseño del discovery

Verificadas a las 20:50, antes de planificar encima:

1. **La cola no sirve para bloques tal cual.** `job.memory_id` es FK a `memory(id)`
   (`schema.sql:107-117`), y `process_once` lee `SELECT id, title, content FROM memory WHERE id =
   ANY(...)` (`worker.py:115-118`). Generalizar el worker es tocar la cola, la FK y el bucle. **La
   alternativa es más barata y es la que va**: la pasada de extracción embebe los bloques ella misma
   con `embed_passages` (`embeddings.py:34-37`) y escribe la fila con el vector dentro. El vector
   viaja en la fila por el sync, como en `memory` (`sync.py:150-156`, las columnas no monótonas se
   conservan); los dos nodos usan el mismo modelo y dimensión (`docker-compose.yml:189-190`,
   `intfloat/multilingual-e5-large`, 1024). El worker no cambia.
2. **Los nodos del grafo salen del árbol, no de `/api/graph`.** `/api/graph` devuelve un conteo,
   las aristas y los wikilinks (`mcp_server.py:561-571`), y el comentario dice por qué: el visor ya
   tiene el árbol cargado y repetir los nodos crearía dos fuentes de verdad. Para que un bloque sea
   un nodo, tiene que llegar por donde llegan los nodos: una ruta de árbol de la biblioteca que el
   front funda con `data.tree`, con `id`, `title`, `memory_type`, `path`, `tags` y `created_at`
   (`core.py:361-375`). El color y el filtro por proyecto salen del primer segmento del `path`
   (`web/src/lib/graph.ts:22`, `:79-80`), así que un bloque tiene que presentarse con un `path` cuyo
   primer segmento sea su proyecto: `naeth/code`, `cenit/code`, `yogin/code`. Es un path de
   presentación, no una columna de la tabla.
3. **`relation` no puede unir prosa con código.** Sus dos extremos son FK a `memory(id)`
   (`schema.sql:82-83`). La capa de Naeth encima de un bloque (anotaciones, "importante", la nota de
   prosa que lo explica) necesita tabla propia, que además es lo que da las aristas prosa-código del
   grafo. Son **dos tablas nuevas**, no una, y las dos se clasifican en el sync antes de nacer.

---

## 1. El modelo, cerrado para que la sub-fase 4 no decida nada

### `code_block` · lo extraído del código, inmutable, una fila por versión

| Columna | Qué | Origen |
|---|---|---|
| `id` uuid | PK | `gen_random_uuid()` |
| `repo` text | Slug: `naeth`, `cenit`, `yogin-api`, `yogin-website`, `gridwatch` | Argumento del extractor |
| `file` text | Ruta relativa a la raíz del repo, barras normales | griffe `filepath` |
| `symbol` text | Nombre cualificado: `app.core.search` | griffe `path` |
| `kind` text | `module`, `class`, `function`, `method`, `script` | griffe `kind` |
| `lang` text | `python`, `javascript`, `typescript`, `powershell`, `shell` | Extractor |
| `signature` text | Parámetros y retorno, como texto | griffe `parameters`, `returns` |
| `lineno`, `endlineno` int | Rango en el fichero | griffe |
| `doc` text | El docstring o JSDoc, tal cual | griffe `docstring.value` |
| `doc_lang` text | `es` o `en`, por repo | Extractor |
| `doc_translated` text, nullable | Traducción generada | La pasada, marcada derivada |
| `source` text | El fragmento entero | Recorte del fichero por líneas |
| `commit` text | `HEAD` del repo al extraer | griffe `git_info.commit_hash` |
| `file_sha256` text | Del fichero entero | Extractor |
| `content_hash` text | De `source` más `doc` | Idempotencia: la misma pasada no duplica |
| `embedding` vector(1024) | Del texto `doc` más `source`, en ese orden | La pasada, con `embed_passages` |
| `tsv` tsvector generado | Sobre `symbol`, `doc` y `source`, configuración `simple` | Como `memory.tsv` (`schema.sql:42-44`) |
| `extracted_at` timestamptz | Fecha de la pasada | |
| `is_current` boolean | Cache: la última versión de `(repo, symbol)` | Recalculada por la pasada |

ADD-only: una fila nueva cuando cambia `content_hash`; la anterior queda con `is_current=false`. Es
la historia de esa función, y es lo que la definición de Naeth pide. Sin tabla de supersesión: la
versión la da `(repo, symbol, extracted_at)`.

### `code_annotation` · la capa de Naeth encima, ADD-only

| Columna | Qué |
|---|---|
| `id` uuid | PK |
| `block_id` uuid | FK a `code_block(id)`; la anotación sigue al bloque de esa versión |
| `memory_id` uuid, nullable | FK a `memory(id)`: la nota de prosa que explica o cita el bloque |
| `kind` text | `important` (la marca), `summary` (el resumen a mano para los bloques que no caben en el embedding), `note` (idea L, "leí esto y no me cuadra"), `link` (solo une con `memory_id`) |
| `text` text, nullable | El contenido de `summary` y `note` |
| `author` jsonb | Como `memory.author` (`schema.sql:47`) |
| `created_at` | |

Las aristas prosa-código del grafo son las filas con `memory_id`. Las de código-código (imports,
llamadas) no entran en esta fase: griffe da los imports por módulo y es trabajo de una fase
posterior.

### El sync

Las dos tablas van a `MERGE_TABLES` (`sync.py:82-88`): PK uuid, append-only. `is_current` de
`code_block` es una cache **local**, recalculada por la pasada en cada nodo, igual que la de
`memory` es "CACHE derivada local; NO se sincroniza" (`schema.sql:52`); no entra en
`MONOTONIC_MERGE_RULES` porque no hace falta reconciliarla: cada pasada la recalcula donde corre.
`embedding` sí viaja en la fila.

⚠ **`code_block` se escribe en los dos nodos por la pasada, o en uno y viaja por el sync.** Lo
segundo basta: la pasada corre en el nodo que manda y el handoff lleva las filas. Pero `is_current`
no viaja, así que el nodo que recibe tiene filas con `is_current` en su valor por defecto. La
sub-fase 4 decide si el default es `true` y la pasada solo baja las viejas, o si hay una recalculada
al arrancar. Es la única pieza del modelo con una decisión abierta, y es pequeña.

---

## 2. Las sub-fases, en orden

Cada una cierra con la suite acumulada en verde: backend con los 72 tests más los nuevos (compose
`test`, `rm -sf db` al terminar, una sola suite a la vez), front con `npm test && npm run check &&
npm run build`, hooks con su suite en `~/.claude/tools/tests/`, reconciler de CENIT con sus 261.

Regla de despliegue que gobierna el orden: **cada sub-fase que toca `naeth/app/` es un despliegue
del 8801 en los dos nodos**, con etiqueta al desplegar. Se agrupan para que sean pocos: la 2 (solo
docstrings), la 4 con la 5 y la 6 (esquema, extractor y tools, un solo despliegue), y la 7 es el
visor (`npm run build`). Ninguna coincide en el día con un despliegue de la fase 1 del roadmap en
CENIT.

### Sub-fase 0 · Pruebas de las que depende el diseño, sin tocar producción

**Qué se hace**:
1. griffe sobre `cenit_core` (`uvx --from griffe griffe dump cenit_core -s core/reconciler/src`),
   como se hizo con `naeth/app`, para confirmar que da lo mismo con un paquete que tiene clases y
   `dataclasses` (`ownership.py`, `handoff.py`).
2. Un render de prueba con mkdocstrings sobre tres docstrings ya buenos (`core.search`,
   `sync.classify`, `ownership.recycle_connections_sql`), para ver cómo pinta `Notes:` al final y
   cómo trata las mayúsculas y el `⚠`. Es lo que la vista del visor imitará o no.
3. ruff `D1xx` y `D417` con `convention = "google"` sobre `cenit_core`, para tener el número que en
   `naeth/app` ya es 44.
4. `pytest --doctest-modules` sobre `naeth/app` tal cual, para ver si arranca sin romper la suite
   (los módulos importan psycopg y fastmcp al cargarse; en el contenedor de test están).
5. Medir en el nodo vivo cuánto tarda `embed_passages` sobre 131 textos de bloque, para saber si la
   pasada de extracción puede embeber en línea o hay que trocearla.
**Entregable**: un apartado "Verificado en la sub-fase 0" al final de este documento, con los cinco
resultados, comandos y fecha.
**Cómo se comprueba**: cada resultado tiene su comando y su salida citada.
**Qué se rompe si falla**: nada. Si el punto 4 rompe la suite, la sub-fase 1 cablea doctest de otra
forma (un fichero de tests que importe las utilidades puras) en vez de `--doctest-modules`.
**Toca producción**: no.

### Sub-fase 1 · Lo mecanizable, en modo aviso

**Qué se hace**: `py-lint.ps1` (`.claude/hooks/py-lint.ps1:47`) pasa de `F821,F811,E9` a añadir
`D100,D101,D102,D103,D417` con `convention = "google"`, **en modo aviso, no bloqueo**, para
`naeth/app` y para `cenit_core`: los errores `F` y `E9` siguen bloqueando; los `D` se imprimen y
dejan pasar. Es el mismo camino de `warn` a `strict` que siguió el digest (`mcp_server.py:230-243`,
"NACE EN 'warn' Y NO EN 'strict'"), y por la misma razón: hoy `mcp_server.py` tiene 27 funciones
sin docstring, y un hook que bloquee el turno por ellas impide tocar el fichero para documentarlas.
Se endurece en la sub-fase 3, cuando los dos árboles estén a cero. El compose de test añade
`--doctest-modules` si la sub-fase 0.4 lo permite. En Yogin, `eslint-plugin-jsdoc` con
`require-jsdoc` en aviso, en los `eslint.config.js` que ya existen en los dos repos de Yogin
(Yogin-API tiene además el script `lint` y `eslint --fix` sobre `*.mjs` en `package.json:8-17`).
**Entregable**: el hook y el compose modificados; una edición de prueba de `oauth.py` muestra los
avisos `D` sin bloquear, y una con un `F821` sigue bloqueando.
**Cómo se comprueba**: las dos ediciones de prueba, con la salida del hook citada; la suite de hooks
en verde.
**Qué se rompe si falla**: un hook que bloquea por `D` deja `naeth/app` intocable hasta documentar
44 funciones de golpe. Por eso nace en aviso.
**Toca producción**: no. El hook es local; el compose de test no es el de la pila viva.

### Sub-fase 2 · `naeth/app` documentado al dedillo, un despliegue

**Qué se hace**: los 44 símbolos sin docstring y las cabeceras de módulo, con la guía delante, en
este orden y por este motivo: `oauth.py` (1 de 30, y es código muerto en producción: cada docstring
tiene que decirlo, como `login_post` en la guía §5.2), `mcp_server.py` (10 de 41; las 41 tools y
rutas llevan la doc del agente en `description` y el docstring complementa, guía §5.3), `worker.py`
(`main`), `embeddings.py`, y las cinco funciones de `core.py` que faltan. Los docstrings buenos que
ya existen se pasan a la forma Google con `Notes:` al final **solo si se toca esa función por otra
razón**; no se reescriben en masa, porque la guía dice que lo viejo se corrige al tocarlo. `Example:`
con doctest en las utilidades puras: `_like_escape`, `_digest`, `_product_from_client_name`, `_ts`.
**Revisión**: Eneko lee cada módulo entero después, no el diff. Es la recuperación que se busca, y
es la revisión que la guía §4 exige. Lo que no entienda al leer se reescribe antes de desplegar.
**Entregable**: `ruff --select D1xx,D417` a cero sobre `naeth/app` sin tests; los doctests corren en
la suite; despliegue en los dos nodos con etiqueta `2.2026.09.3` ⚠ o la que toque ese día.
**Cómo se comprueba**: ruff a cero; la suite de 72 más los doctests en verde; `failover-status.ps1`
dice qué nodo manda y los dos sirven la versión; y la lectura completa por Eneko, que es la prueba
que no automatiza nadie.
**Qué se rompe si falla**: un docstring no cambia comportamiento, pero un doctest mal escrito rompe
la suite, y un `Example:` inventado es lo que la guía prohíbe. El riesgo real es el 8801 recargando
en cada guardado durante una sesión larga de edición (`docker-compose.yml:187`, `:199`): se hace
desde una sesión que no necesite Naeth a mitad.
**Toca producción**: sí, un despliegue de código sin cambio de esquema.

### Sub-fase 3 · `cenit_core` documentado, y el linter pasa a estricto

**Qué se hace**: los 49 símbolos y 23 clases sin docstring de `cenit_core`, empezando por
`handoff.py` (5 de 17), `watchdog.py` (5 de 12) y `pocketid.py` (2 de 9), y las cabeceras que
falten. Mismo procedimiento y misma revisión que la 2. Al terminar, `py-lint.ps1` pasa los `D` a
bloqueo en los dos árboles.
**Entregable**: ruff a cero sobre `cenit_core`; el hook en estricto; el reconciler desplegado en los
dos nodos con su etiqueta.
**Cómo se comprueba**: ruff a cero; los 261 tests del reconciler en verde; una edición de prueba con
una función pública sin docstring queda bloqueada por el hook.
**Qué se rompe si falla**: el reconciler es lo que hace el failover; un docstring no lo toca, pero
el despliegue sí es un despliegue del reconciler y sigue su procedimiento (los dos nodos, con
`ownership` sin cambiar).
**Toca producción**: sí, el reconciler de CENIT. No el mismo día que la fase 1 del roadmap.

### Sub-fase 4 · Las dos tablas, clasificadas antes de existir

**Qué se hace**, en este orden y no en otro:
1. `code_block` y `code_annotation` en `MERGE_TABLES` de `sync.py:82-88`, con un test en
   `test_handoff.py` que las incluya en `TABLAS` (`:21`). Desplegar el reconciler en los dos nodos.
   **Antes** de crear nada: `preflight` aborta el handoff ante una tabla sin clasificar
   (`sync.py:332-345`), y el orden inverso repite `_emdash_backup` del 30/07 (`sync.py:106-110`).
2. `schema.sql` con las dos tablas y sus índices (HNSW parcial sobre `is_current`, GIN sobre `tsv`,
   btree sobre `(repo, symbol)` y `(repo, file)`), y la migración `007-code.sql` con
   `CREATE TABLE IF NOT EXISTS`. No toca `memory_current` ni columnas existentes, así que no aplica
   la trampa de la vista (`006-digest.sql:40-47`) ni la de la staging con `LIKE` (`:18-24`). Sí hay
   que levantar el read-only en el nodo que no manda para la sentencia, como en la 006 (`:25-27`).
3. `_DOMAIN_TABLES` de `conftest.py:26` con las dos tablas, y los tests de `core` para las
   funciones de la sub-fase 6 se escriben aquí contra el esquema nuevo.
4. La decisión de `is_current` del §1 (default `true` y la pasada baja las viejas, o recalculada al
   arrancar), tomada con lo que diga la sub-fase 0.5 sobre el coste.
**Entregable**: las dos tablas en los dos nodos, vacías; `memory_stats` y el handoff siguen
funcionando; la suite con el esquema nuevo en verde.
**Cómo se comprueba**: `SELECT table_name FROM information_schema.tables WHERE table_schema='memory'`
en los dos nodos las lista; un `handoff --dry-run` no aborta en el preflight; la suite en verde.
**Qué se rompe si falla**: el handoff, si la tabla existe sin clasificar; y la suite, si
`_DOMAIN_TABLES` no las trunca y un test deja filas. Los dos fallos son de orden, y el orden está
arriba.
**Toca producción**: sí, esquema en los dos nodos. Se despliega junto con la 5 y la 6.

### Sub-fase 5 · El extractor, y la traducción

**Qué se hace**: un comando en `naeth/app/` (`python -m app.code extract --repo naeth --root
/srv/repos/naeth` ⚠ la ruta con la que el contenedor ve los repos hay que montarla) que: corre
griffe sobre el paquete; aplica el filtro (docstring y más de cinco líneas: `endlineno - lineno >=
5`); recorta `source` del fichero; calcula `file_sha256`, `commit` y `content_hash`; embebe
`doc + source` con `embed_passages`; inserta lo que no exista por `content_hash` y baja `is_current`
de la versión anterior de `(repo, symbol)`; y escribe un resumen por consola con lo insertado, lo
igual y lo retirado. Idempotente: la segunda pasada sobre el mismo commit inserta cero.
**Traducción**: `doc_translated` se genera en la pasada para las filas nuevas. Quién traduce es la
decisión abierta de esta sub-fase, y tiene una restricción que no estaba escrita: **GridWatch es
código de cliente** y no sale de la máquina, por la misma regla que el audio de un cliente
(`CLAUDE.md` global, transcripción). Cuatro opciones: (a) la API de Claude, para Naeth, CENIT y Yogin,
que son suyos, y GridWatch sin traducir; (b) un modelo local de texto sobre la RTX 3070, que hoy no
hay instalado (Whisper es audio; Handy con Nemotron es dictado), **y es la que Eneko quiere
estudiar el 10/09 a las 23:00: un agente local dedicado solo a traducir, coste cero por llamada**,
que además sirve para GridWatch porque nada sale de la máquina; (c) la traducción la hace el agente
de Claude Code en una tanda después de la pasada, con una tool `code_translate` que lea lo
pendiente; (d) sin traducir por ahora. La (b) exige medir antes qué modelo cabe en la 3070 con la
calidad que pide una traducción técnica castellano-inglés, y cuánto tarda por bloque: es una
investigación propia de media tarde, dentro de esta sub-fase. **Decidido el 10/09: se decide en la
sub-fase 5, con esa medición delante.** El campo y la marca de derivado no cambian con la opción.
**Entregable**: la pasada sobre `naeth/app` y `cenit_core` deja al menos 131 bloques en la tabla,
con embedding y hash; la segunda pasada inserta cero; un cambio de una línea en `core.search`
seguido de otra pasada crea una versión nueva y baja la vieja.
**Cómo se comprueba**: los tres escenarios de arriba, con recuentos por SQL; y tests de `core` para
el filtro, el hash y el paso a versión nueva, sobre un paquete de fixture de tres funciones.
**Qué se rompe si falla**: una pasada no idempotente duplica bloques en cada ejecución; un filtro
mal puesto mete los 99 triviales. Los dos se ven en el recuento del primer escenario.
**Toca producción**: sí, con la 4 y la 6.

### Sub-fase 6 · Las tools y las rutas

**Qué se hace**, en `core.py` y `mcp_server.py`:
- `core.code_search(query, q_embedding, repo, lang, kind, k)`: híbrida RRF sobre `code_block`
  vigente, calcada de `search` (`core.py:305-358`) con filtros dentro de cada rama; `code_get(id)`
  y `code_get_by(repo, symbol)`; `code_list(repo, file)`; `code_annotate(block_id, kind, text,
  memory_id)`.
- Tools MCP `code_search`, `code_get`, `code_list`, `code_annotate`, con `description` para el
  agente escrita como las de `memory_*` (`mcp_server.py:316-335` es el modelo), y docstring para el
  mantenedor según la guía. `code_search` devuelve símbolo, fichero, líneas, la primera frase de
  `doc`, `doc_lang`, y si el bloque está al día (`file_sha256` frente al fichero, solo si el
  contenedor ve el repo; si no, `commit`).
- Rutas `/api/code/tree` (los bloques como filas de árbol, con el `path` de presentación
  `<repo>/code` del §0.2), `/api/code/{id}`, `/api/code/search`, y `/api/graph` ampliado con las
  aristas de `code_annotation` que tengan `memory_id`.
- `memory_search` no cambia. La descripción de `memory_search` menciona que el código tiene su
  tool.
**Entregable**: desde Claude Code, `code_search("reclamar jobs huérfanos lease")` devuelve
`app.worker.claim_batch` en el top 3, y `code_get` trae doc, fuente y anotaciones; desde el
navegador, `/api/code/tree` lista los 131.
**Cómo se comprueba**: tests de `core` para las cinco funciones (búsqueda con y sin filtros,
vigente contra histórico, anotación con y sin `memory_id`); las tools a mano desde Claude Code
contra el nodo que manda; y el despliegue conjunto de 4, 5 y 6 con etiqueta.
**Qué se rompe si falla**: las tools nuevas, no las viejas: `memory_*` no se tocan. Si el `/api/graph`
ampliado falla, el grafo del visor se queda sin aristas prosa-código, no sin grafo.
**Toca producción**: sí, el despliegue conjunto.

### Sub-fase 7 · El visor: la biblioteca y los bloques en el grafo

**El nombre, decidido el 10/09 a las 23:05**: **CodeDoc Archive**, sigla **CDA**. En el menú del
visor va `CDA`, al lado de Memoria y Grafo; el título de la vista lleva el nombre completo; la ruta
es `#/cda`. Las tools siguen en inglés con prefijo `code_` (`code_search`, `code_get`, `code_list`,
`code_annotate`), como `memory_*`. Sin apóstrofo en ningún sitio: va en URLs, ids y ficheros.

**Qué se hace**, en `naeth/web/`:
- Una vista `Cda` registrada en el router (`lib/router.svelte.ts:5-16`, `App.svelte:9-13`)
  con tres niveles: repo, fichero, símbolo. Por símbolo: `doc` renderizada con `lib/md.ts` (el
  `Notes:` al final, como lo pinte mkdocstrings en la sub-fase 0.2 o mejor), la firma, el fragmento
  con resaltado, `doc_translated` marcada como traducción, las anotaciones, y las notas de prosa que
  lo citan.
- Los bloques en el grafo: `data.tree` se funde con `/api/code/tree`; el color sale del primer
  segmento del `path` de presentación; `pintor.ts` dibuja una forma propia para `kind` de bloque
  (`pintor.ts:224-228` es donde viven las formas por tipo, y `pintor.test.ts:187` exige que un tipo
  desconocido siga dibujándose); el filtro de proyectos que ya existe (`graph.ts:231-233`) apaga
  `code` si estorba. Las aristas prosa-código llegan por `/api/graph`.
- El mini grafo de la ficha (`components/MiniGraph.svelte`) enseña los bloques enlazados a una nota.
**Entregable**: la vista en los dos nodos tras `npm run build`; el grafo con los bloques y sus
aristas; una nota de prosa con anotación `link` a un bloque los enseña en su mini grafo.
**Cómo se comprueba**: tests de front para la fusión de árboles y para la forma nueva (`graph.test.ts`,
`pintor.test.ts`, `tree.test.ts`); `check` y `build`; y en el navegador, la vista, el grafo con 131
nodos más y el filtro apagándolos.
**Qué se rompe si falla**: el visor, en los dos nodos. Rollback: el build anterior, o quitar
`NAETH_VIEWER_DIR` (`docker-compose.yml:194-197`).
**Toca producción**: sí, el visor. Puede ir después de la 8 sin bloquearla.

### Sub-fase 8 · Los hooks: revisar al cerrar el turno, y el índice al arrancar

Es lo que sobrevive del plan del cuaderno (1.3), con el modelo nuevo:
- `PostToolUse` sobre `Edit|Write`: apunta en el estado de sesión los ficheros de código editados en
  los repos de la lista (patrón de `time-context.ps1:52-55`).
- `Stop`: si hay código editado y el hook no ha preguntado aún en esta sesión, bloquea una vez con
  el mensaje: "código editado en A y B; revisa que cada símbolo tocado tenga docstring según la guía
  (`guia-documentacion.md`), con `Notes:` si hay porqué, y di qué has hecho". Una sola vez por
  sesión, con marca en el estado, y `stop_hook_active` si existe ⚠ se confirma con el volcado de
  stdin de la sub-fase 0 del plan del cuaderno, que sigue pendiente.
- `SessionStart` en un repo de la lista: una línea por stdout con cuántos bloques de ese repo tienen
  `file_sha256` distinto del fichero actual, leyendo `/api/code/tree` por el 8801 y fallando abierto.
  Es la señal de "la biblioteca va por detrás del código: pasa el extractor".
- Un `consultas.jsonl` local con cada `code_search` y `code_get` que un hook vea pasar
  (`PostToolUse` sobre `mcp__naeth__code_*`), para la medición de la sub-fase 11.
**Entregable**: tres hooks registrados en `~/.claude/settings.json`; la suite
`test-cuaderno.ps1` renombrada a lo que toque, con los casos: código sin revisar bloquea una vez,
segundo `Stop` pasa, repo fuera de la lista no hace nada, 8801 caído falla abierto.
**Cómo se comprueba**: la suite; y una sesión real en `F:\src\Naeth` editando `worker.py`, con el
bloqueo del `Stop` y la línea de `SessionStart` citadas.
**Qué se rompe si falla**: un hook que bloquea mal para todo el trabajo en todos los repos. Fallan
abiertos, el `Stop` bloquea una vez, y la lista de raíces está en la cabecera para vaciarla.
**Toca producción**: no.

### Sub-fase 9 · Yogin-API: de `//` a JSDoc, y el extractor de JavaScript

**Qué se hace**: los comentarios narrativos que ya existen pasan a `/** */` con las etiquetas de la
guía §2 (JS: narrativa antes de las etiquetas, tipos entre llaves), cabecera `@fileoverview` en
cada fichero de `src/`, `require-jsdoc` a estricto, y un extractor de JavaScript para la pasada
(TypeDoc no vale para `.mjs` sin tipos; el parser de JSDoc o `jsdoc -X`, que da JSON ⚠ sin probar,
es la sub-fase 0 de esta). Empezar por `utils/` (funciones puras, `@example` obligatorio) y seguir
por `services/` y `routes/`. `events.mjs` tiene 2.624 líneas y 20 marcadores: es el que más pide
la guía y el que más cuesta.
**Entregable**: Yogin-API en la biblioteca, con el mismo filtro; la reserva atómica y el menos cero
(los fallos del simulacro) documentados con `Notes:` y buscables.
**Cómo se comprueba**: eslint a cero avisos de `require-jsdoc`; la pasada inserta los bloques; los
tests de Yogin-API en verde (`npm test`, con `mongo-memory`).
**Qué se rompe si falla**: un JSDoc mal cerrado es un error de sintaxis en JavaScript y rompe el
arranque. Los tests lo cogen.
**Toca producción**: Yogin-API se despliega por su cauce; los comentarios no cambian comportamiento.

### Sub-fase 10 · GridWatch, en inglés y sin traducción fuera de casa

**Qué se hace**: la pasada sobre `ClientApp/src` con el extractor de TypeScript (TypeDoc sí vale
aquí), sin `doc_translated` salvo que la sub-fase 5 haya elegido la opción (c). Es el repo que ya
está documentado (424 bloques JSDoc) y el que enseña qué produce el `@fileoverview` a escala.
**Entregable**: GridWatch en la biblioteca con `doc_lang = en`.
**Cómo se comprueba**: la pasada inserta los bloques; `code_search` con `repo = gridwatch` los
encuentra.
**Qué se rompe si falla**: nada de GridWatch; es lectura del repo.
**Toca producción**: solo la tabla de Naeth.

### Sub-fase 11 · Medir: la biblioteca a 30 días y el simulacro repetido

**Qué se hace**, un mes después de la sub-fase 6: leer `consultas.jsonl` (cuántas `code_search` y
`code_get`, desde qué repo, cuántas acabaron en `code_get`), contar bloques con `file_sha256`
desactualizado y desde cuándo, contar anotaciones `important` y `summary`, y **repetir el simulacro
del 10/09** sobre los mismos bloques de preguntas, de memoria y sin abrir el código, con la cifra
objetivo fijada antes.
**Entregable**: una nota `naeth/status` o `biblioteca/status` con las cifras y la decisión: seguir,
cambiar el disparador, o parar.
**Cómo se comprueba**: los números salen de ficheros y de SQL, con el comando al lado; el simulacro
lo puntúa él como el primero, "contando con generosidad".
**Qué se rompe si falla**: nada; si no se hace, no se sabrá si sirvió, que es el fallo del playbook
del 15/08.
**Toca producción**: no.

---

## 3. Dependencias y orden, en una tabla

| Sub-fase | Depende de | Toca producción | Despliegue |
|---|---|---|---|
| 0 pruebas | nada | no | |
| 1 linter en aviso | 0.4 | no | |
| 2 `naeth/app` documentado | 1 | sí, `naeth/app` | uno, solo código |
| 3 `cenit_core` documentado, linter estricto | 2 | sí, reconciler | uno, reconciler |
| 4 tablas | 3 (por el orden del `classify`) | sí, esquema | conjunto con 5 y 6 |
| 5 extractor y traducción | 4, y la decisión de quién traduce | sí | conjunto |
| 6 tools y rutas | 4, 5 | sí | conjunto |
| 7 visor | 6 | sí, visor | `npm run build` |
| 8 hooks | 6 (para `SessionStart`), 0 del cuaderno (volcado de `Stop`) | no | |
| 9 Yogin | 6, y el extractor de JS | Yogin por su cauce | |
| 10 GridWatch | 9 (extractor de TS) | solo la tabla | |
| 11 medición | 6, un mes | no | |

La 2 y la 3 son las que más tiempo llevan y las que más valen para el objetivo de las entrevistas:
son leer y explicar cada función propia. Nada en 4 a 7 las acelera, y por eso van antes. Si hay que
elegir dónde empezar mañana, es la 0 por la tarde y la 2 al día siguiente.

---

## 4. Lo que queda decidido aquí, y lo que no

**Decidido aquí, sobre evidencia**: los bloques se embeben en la pasada y no por la cola (§0.1);
entran al grafo por el árbol con un `path` de presentación (§0.2); dos tablas, no una (§0.3); el
linter nace en aviso y pasa a estricto cuando los dos árboles estén a cero (sub-fase 1); los
docstrings viejos buenos no se reescriben en masa (sub-fase 2).

**Decidido el 10/09 a las 23:05, en la comprobación de comprensión del plan** (seis preguntas,
seis correctas, sin nada que dibujar): el nombre es **CodeDoc Archive, CDA**, con `CDA` en el
menú, el nombre completo en el título y ruta `#/cda`; y la traducción se decide en la sub-fase 5
con la medición de un modelo local sobre la 3070 delante.

**Abierto, con dueño y momento**:
- Quién traduce, y qué pasa con GridWatch: sub-fase 5, con la medición del modelo local (opción b).
- El default de `is_current` en el nodo que recibe por sync: sub-fase 4, con el dato de la 0.5.
- La cifra objetivo del simulacro repetido: Eneko, antes de la sub-fase 11.

---

## 5. Sin verificar

- Que `--doctest-modules` arranque sobre `naeth/app` sin romper la suite. Sub-fase 0.4.
- Que griffe trate igual las `dataclasses` y clases de `cenit_core`. Sub-fase 0.1.
- El coste de embeber 131 bloques en línea en el nodo vivo. Sub-fase 0.5.
- Que `jsdoc -X` dé para `.mjs` lo que griffe da para Python. Sub-fase 9.
- Que el payload de `Stop` traiga `stop_hook_active`. Sub-fase 0 del plan del cuaderno, pendiente.
- La ruta con la que el contenedor de la API ve los repos para la pasada. Sub-fase 5.

---

## Verificado en la sub-fase 0 (viernes 11/09/2026, 11:22 a 11:30)

Las cinco pruebas, sin tocar producción. Comandos desde `F:\src\Naeth` salvo que se diga otra cosa;
los ficheros intermedios quedaron en el scratchpad de la sesión y no se conservan.

| # | Prueba | Resultado | Consecuencia para el plan |
|---|---|---|---|
| 0.1 | griffe sobre `cenit_core` | **Vale.** `uvx --from griffe griffe dump cenit_core -s src` desde `CENIT/core/reconciler`: 562 KB, 16 módulos, 103 funciones, 35 clases (las 9 `dataclass` de `handoff`, `inventory`, `ownership`, `recovery`, `status` y `watchdog` salen con su decorador), 40 métodos, y `git_info` con el commit `1563f65` y el remoto. 23 clases sin docstring | El extractor de la sub-fase 5 es el mismo para los dos árboles Python. Las dataclasses entran como `class` con sus métodos |
| 0.2 | Render de mkdocstrings sobre los cuatro docstrings canónicos de la guía | **`Notes:` es una sección de primera clase.** El parser Google de griffe (`griffe.Docstring(..., parser="google").parse()`) reconoce en los cuatro `text`, `parameters`, `returns` y una `admonition` de tipo `notes`. mkdocs con `mkdocstrings-python` (`docstring_style: google`) los pinta como tablas de Parameters y Returns y después `<details class="notes" open><summary>Notes</summary>` con la narrativa entera; las mayúsculas y el `⚠` se conservan tal cual | La vista CDA de la sub-fase 7 puede imitar exactamente eso: contrato en tabla, narrativa en un bloque desplegable abierto. Aviso del parser: pide tipo o anotación por parámetro; en el código real las anotaciones están en la firma y no avisa |
| 0.3 | ruff `D1xx` y `D417` con `convention = "google"` sobre `cenit_core` | **54 avisos**: 23 `D101` (clase pública sin docstring), 20 `D102` (método), 11 `D103` (función), **0 `D417`**. Por fichero: `handoff.py` 15, `manifest.py` 7, `pocketid.py` 6, `ownership.py` 5, `cloudflare.py` 5, `config.py` 4, `watchdog.py` 3, `status.py` 3, `recovery.py` 2, y uno en `sync.py`, `inventory.py`, `identity_sync.py` y `cli.py` | Con los 44 de `naeth/app`, son 98 símbolos a documentar entre las sub-fases 2 y 3. Cero `D417`: los `Args:` que existen ya están completos, así que la regla se puede exigir desde el primer día sin ruido |
| 0.4 | `--doctest-modules` sobre `naeth/app` en el compose de test | **Arranca sin romper la suite.** `docker compose --profile test run --rm test sh -c "... pytest app/tests --doctest-modules app -q"`: los seis módulos se importan en la colección (incluido `mcp_server.py`, que construye `FastMCP` al importarse, y `oauth.py`), **72 passed en 3,97 s**, cero doctests porque todavía no hay ninguno. `db` bajado después con `rm -sf db`; `api`, `viewer` y `worker` siguieron `healthy` | La sub-fase 1 puede añadir `--doctest-modules app` al comando del servicio `test` tal cual, sin fichero de tests aparte |
| 0.5 | Coste de embeber 131 bloques en el nodo vivo | **901 ms por bloque.** `docker exec -i naeth-worker-1 python` con `app.embeddings`: warmup 3,2 s (modelo ya en caché), 131 textos sintéticos de 962 caracteres de media en **118 s**, un lote de 32 en 27,6 s. Es CPU: el contenedor no ve la GPU | Embeber en la pasada (§0.1) sigue valiendo: dos minutos para `naeth/app` y `cenit_core`, y solo se embebe lo que cambia de hash. Para Yogin y GridWatch, con cientos de bloques, la pasada tarda del orden de un cuarto de hora: se lanza como comando largo, no dentro de una petición HTTP, y el resumen por consola va por lotes de 32. El default de `is_current` (§1, abierto) no depende de este dato |

Lo que sigue pendiente de otras sub-fases y no era de esta: el volcado de stdin de `Stop` para
`stop_hook_active` (sub-fase 8), y si `jsdoc -X` da para `.mjs` lo que griffe da para Python
(sub-fase 9).

**Siguiente**: sub-fase 1, el linter en modo aviso y el compose de test con `--doctest-modules`.

---

## Verificado en la sub-fase 1 (domingo 13/09/2026, 13:42 a 14:05)

Lo mecanizable, en modo aviso, en los tres repos. Sin tocar producción: ningún fichero de
`naeth/app` ni de `cenit_core` se editó; los hooks se probaron con fixtures por stdin.

| Qué | Dónde | Resultado |
|---|---|---|
| Hook `py-lint.ps1` de Naeth con la parte `D` en aviso | `F:\src\Naeth\.claude\hooks\py-lint.ps1` | El bloqueo por `F821`, `F811` y `E9` no cambia. Tras pasarlo, corre `D100-D103` y `D417` con `convention = "google"`, excluye `tests\`, y si hay avisos devuelve JSON `additionalContext` con el recuento, las primeras 12 líneas y el puntero a la guía; `exit 0`. Probado: `oauth.py` da 11 avisos listados sin bloquear; un fichero con `F821` bajo una ruta `\naeth\app\` bloquea con `exit 2`; `tests/test_core.py` calla |
| Hook `py-lint.ps1` de CENIT | `F:\src\CENIT\.claude\hooks\py-lint.ps1`, registrado en `.claude/settings.json` como `PostToolUse` sobre `Edit\|Write` | Copia con filtro `\cenit_core\`. Probado: `handoff.py` da 15 avisos listados; un test y un fichero fuera de `cenit_core` callan. ⚠ La primera versión salió con las regex rotas (`'^.*\cenit_core\'`) porque el heredoc de la herramienta Bash come un nivel de barras y PowerShell tragó la regex inválida en silencio; se corrigió con el editor y se anotó en la memoria nativa |
| `--doctest-modules app` en el servicio `test` | `naeth/docker-compose.yml:229-232` | Suite acumulada con el comando nuevo: **72 passed en 3,74 s**, cero doctests todavía; `db` bajado con `rm -sf db`, pila `healthy` |
| `eslint-plugin-jsdoc` con `require-jsdoc` en `warn` | `Yogin-API/eslint.config.js` y `Yogin-Website/eslint.config.js`; el plugin `^64.3.10` como devDependency en los dos `package.json` | Solo símbolos exportados (`publicOnly`), y **`enableFixer: false`** porque el Website corre `eslint --fix` en lint-staged y el fixer de la regla insertaría bloques `/** */` vacíos en cada commit. Yogin-API: 59 ficheros, **0 errores, 55 avisos** (`billing.service.mjs` 25, `email-utils.mjs` 5). Yogin-Website: 360 ficheros, **255 avisos**; los 2 errores que reporta ya existían sin estos cambios (comprobado con `git stash`): `no-useless-assignment` en `use-accessible-tabs.js:20` y `react-hooks/set-state-in-effect` en `teacher-page-screen.jsx:20` |

Cuenta total de lo que las sub-fases 2, 3 y 9 tienen que llevar a cero: 44 en `naeth/app`, 54 en
`cenit_core`, 55 en Yogin-API, 255 en Yogin-Website.

**Sin commitear**, en tres repos: Naeth (hook, compose y este plan), CENIT (hook y `settings.json`),
Yogin (dos configs, dos `package.json` y dos `pnpm-lock.yaml`).

**Siguiente**: sub-fase 2, documentar `naeth/app` empezando por `oauth.py`, desde una sesión que no
dependa de Naeth a mitad, porque cada guardado recarga el 8801.

---

## Verificado en la sub-fase 2 (domingo 13/09/2026, 19:09 a 19:30)

`naeth/app` documentado al dedillo según la guía. Los 44 símbolos que faltaban más las
cabeceras y las privadas que llevan el porqué (`_build_auth`, `_embed_query`, `_authorship`,
`_issue`, `_revoke_pair`, `_ts`, `_valid_credentials`, `_login_html`).

| Qué | Resultado |
|---|---|
| ruff `D100-D103` y `D417` sobre `naeth/app` sin tests | **0** (los 39 que quedan son funciones `test_`, excluidas por diseño). `F821`, `F811`, `E9`: limpio |
| Suite acumulada en el compose | **76 passed en 4,76 s**: los 72 de antes y cuatro doctests nuevos (`content_hash`, `_like_escape`, `_digest`, `_ts`) |
| Ficheros | `oauth.py` (11 métodos y funciones, más cabecera con el estado real del módulo), `mcp_server.py` (27 tools y rutas, más `_build_auth`, `_embed_query`, `_authorship` y la cabecera, que citaba `naeth-local.enraxk.dev`, muerto desde el cutover), `core.py` (5, con el comentario de `pool` pasado a `Notes:`), `worker.py` (`main`) |
| El 8801 durante la edición | El hook contó en vivo de 11 a 0 en `oauth.py` y de 27 a 0 en `mcp_server.py`. Tras la última recarga el viewer se quedó en "Waiting for connections to close" (la sesión MCP de Claude Code mantiene la conexión abierta): `unhealthy`, 8801 sin responder. `docker restart naeth-viewer-1` y 200 a los 3 segundos. Es el fallo que el `status` documenta, y el motivo de hacer esta sub-fase desde una sesión que no dependa de Naeth |

**Dos cosas que salieron al documentar, y son la prueba de que documentar es revisar:**

1. **`Args:` es todo o nada.** Con la sección presente, `D417` exige todos los parámetros. La guía
   decía "solo lo que la firma no explica" y dos de sus ejemplos canónicos lo violaban. Corregidos
   la guía (§2.3 y los ejemplos 5.3 y 5.4) y el `CLAUDE.md` global.
2. **El comando del compose no recogía ningún doctest.** Con `pytest app/tests --doctest-modules
   app`, pytest recogía 72; con `--doctest-modules app` solo, 76. La sub-fase 1 dio el comando por
   bueno porque 72 era lo esperado sin doctests: un verde que no probaba nada. Corregido en
   `docker-compose.yml` con el aviso al lado.

**Pendiente de esta sub-fase, y no es mío**: la lectura de cada módulo entero por Eneko, que es
la prueba que no automatiza nadie; y el despliegue en `finally`, que es un despliegue de código sin
esquema. En el PC ya corre lo nuevo (bind mount con `--reload`).

**Siguiente**: sub-fase 3, `cenit_core` (54 avisos: `handoff.py` 15, `manifest.py` 7,
`pocketid.py` 6), y después el linter a estricto en los dos árboles.
