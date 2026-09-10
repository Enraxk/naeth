# Cuaderno de código: plan de fase 2

> ⚠ **REENCUADRADO a las 18:38 del 10/09, antes de ejecutar nada.** Este plan se escribió para un
> "cuaderno" de fichas en Naeth con punteros al código, con tope de 8 horas. Eneko lo corrigió al
> leerlo: lo que quiere es **código documentado como producto** (docstrings y comentarios en el
> código, con su estilo, para generar documentación), **una biblioteca con apartado propio en
> Naeth** que se lea como documentación, **una tool MCP propia para bloques de código** (no
> `memory_get`), y **sin tope de horas**: se toma el tiempo que haga falta, empezando por Python
> (`naeth/app` y el reconciler de CENIT). Sobreviven de aquí: el aislamiento de la búsqueda (1.2),
> el hash del fichero como aviso de putrefacción (1.3, 1.4), el hook de `Stop` que obliga a revisar
> (1.3), los criterios de qué merece entrar (§2) y la semilla priorizada (1.1) como orden, no como
> corte. Lo demás vuelve a fase 1, investigación, con el marco nuevo. **No ejecutar las sub-fases
> tal cual.**

**Fecha**: jueves 10/09/2026, 17:42 a 18:30.
**Entrada obligatoria**: [`cuaderno-codigo-fase1-2026-09-10.md`](cuaderno-codigo-fase1-2026-09-10.md). Este documento no repite su terreno: lo cita.
**Qué es**: fase 2 de la metodología, planificación. Sub-fases atómicas, en orden, cada una con entregable verificable, cómo se comprueba y qué se rompe si falla. **Sin código, sin SQL, sin migraciones.**
**Cómo leer**: cada afirmación sobre el código lleva fichero y línea; cada negativa lleva el grep que la sostiene; lo no confirmado va marcado `⚠ sin verificar`. Todo lo medido es del 10/09 salvo que se diga otra cosa.
**Criterio de éxito de este plan**: que la sub-fase 0 se pueda empezar sin decidir nada, y que cada sub-fase diga qué se rompe si falla.

---

## 0. Lo que no cuadra del todo con la fase 1, comprobado antes de construir encima

Nada de esto bloquea. Son cinco ajustes que el plan ya incorpora, para que no se propaguen.

1. **Los filtros existen en `core.search`, pero la ruta del visor no los expone.** `core.search` acepta `path_prefix`, `tags`, `memory_type` y `since` (`naeth/app/core.py:305-308`), y el MCP los pasa (`mcp_server.py:336-341`). Pero `/api/search` solo lee `q`, `k` y `semantic` (`mcp_server.py:532-539`). Consecuencia: **el visor no puede acotar hoy una búsqueda al cuaderno ni excluirlo**, así que el aislamiento tiene que vivir en `core.search`, no en quien llama. Ver 1.2.
2. **`SessionStart` no admite `additionalContext` en JSON**, según la doc oficial consultada hoy (https://code.claude.com/docs/en/hooks, tabla de decision control: solo los eventos de herramienta). Sí convierte el **stdout en texto plano** en contexto (fase 1 §2). El hook de arranque del cuaderno va por stdout, como `time-context.ps1` (`~/.claude/hooks/time-context.ps1:17-19`, "stdout es SAGRADO").
3. **`PreToolUse` sí admite `additionalContext`** (misma tabla), y los matchers de `PreToolUse`/`PostToolUse` **casan tools MCP** con el nombre `mcp__<server>__<tool>`. Esto es lo que permite que un hook vea cuándo el agente escribe en Naeth. Lo que la doc no detalla es el esquema de `tool_input` por herramienta ni el campo `stop_hook_active` del evento `Stop`: **los dos se confirman en la sub-fase 0** con un volcado de stdin, no se suponen.
4. **La nota de Naeth que fija el tope dice "dos tardes"** (`dc15236d`, "un tope de dos tardes no lo es"); el documento de fase 1 no cuantifica. Este plan parte de esas dos tardes y las convierte en horas en 1.1.
5. **Editar `naeth/app/` recarga el 8801, confirmado**: el servicio `viewer` monta `./app:/srv/app` (`naeth/docker-compose.yml:199`) y arranca con `--reload` (`:187`). Cada guardado de un `.py` bajo `app/`, tests incluidos, reinicia el proceso por el que entra Claude Code. Por eso **todo lo que toca `naeth/app/` va en una sola sub-fase y un solo despliegue** (la 2), y se hace desde una sesión que no dependa de Naeth a mitad de edición.

---

## 1. Las cinco respuestas, en el orden pedido

### 1.1 El orden del barrido y el tope

**El barrido es por piezas, no por repos.** Es la única forma de que el primer repo no se coma el presupuesto: se construye una lista única ordenada, con piezas de los tres repos mezcladas, y se escriben fichas de arriba abajo hasta que se acaba el reloj. El orden de repos deja de ser una decisión.

**En qué se basa el orden.** Tres señales, de más a menos fiable, y las tres están medidas:

| Señal | Qué dice | Evidencia |
|---|---|---|
| **El simulacro** | Las piezas que ya falló. Son las únicas con medición directa de "no lo sé reescribir" | Naeth `7ddf94d1`: reserva atómica de Yogin, el menos cero, el merge monótono de CENIT, "por qué un campo va al último lugar de un índice compuesto", "qué devuelve el filtro atómico". Por bloques: Yogin 1,5 de 6, CENIT 1 de 4 |
| **El criterio 1, autoevaluado** | "¿Sabría reescribir esto hoy sin mirar?" en diez segundos por pieza | Es el criterio que él mismo señaló como orden (`dc15236d`), y es el único que no exige leer el código para aplicarse |
| **Marcadores de decisión en el código** | Dónde ya está escrito un porqué al lado del código (criterios 2 y 4 sin leer nada) | `grep -c "⚠\|MEDIDO\|deliberad\|a propósito\|NO tocar"` por fichero: `core.py` 15, `Lienzo.svelte` 13, `sim.ts` 10, `events.mjs` 20, `teachers.mjs` 8, `watchdog.py`/`ownership.py`/`identity_sync.py`/`config.py` 3 cada uno |

Y una cuarta señal de desempate, la única que no exige juicio: **el churn**, ficheros con más commits desde el 30/07 (`git log --since=2026-07-30 --name-only`): `Lienzo.svelte` 14, `events.mjs` 14, `pintor.ts` 10, `teachers.mjs` 8. Lo que más se toca es lo que más veces va a disparar el hook y lo que antes se pudre. La idea F (`naeth-ideas:110-121`) resuelve esa tensión con el hash del fichero, ver 1.3.

**Qué sale de cruzar las cuatro señales, como semilla del inventario** (la lista definitiva la cierra la sub-fase 4 con el criterio 1 aplicado a mano; esto es lo que ya se puede afirmar con fichero y línea):

| # | Repo | Pieza | Dónde | Señal |
|---|---|---|---|---|
| 1 | Yogin-API | La reserva atómica del slot: contar plazas vivas con `$expr` dentro del filtro del `findOneAndUpdate` | `src/routes/events.mjs:1140-1196` y `:2122`; `src/services/billing.service.mjs:1186` | Simulacro, el peor fallo |
| 2 | Yogin-API | El menos cero: `-Math.abs(0)` es `-0` y el modelo lo rechaza | `src/routes/events.mjs:1044`, `:2150`; `billing.service.mjs:584` | Simulacro |
| 3 | CENIT | El merge monótono: `is_current` por AND, `embedding` por COALESCE, y por qué es un semilattice | `core/reconciler/src/cenit_core/sync.py:113-124` | Simulacro, "la pieza más elegante" |
| 4 | CENIT | `classify()` sin default y `unknown_tables()` que aborta: lo que tumbó el `recover` del 30/07 | `sync.py:106-110`, `:129-156` | Criterio 4, incidente real |
| 5 | Yogin-API | El bloqueo del evento antes de tocar attendees (A·01 a A·03) | `src/routes/events.mjs:824`, `:1006` | Marcadores (20 en el fichero) |
| 6 | Yogin-API | El índice parcial de email, y el orden de campos de un índice compuesto | `scripts/migrate-email-partial-index.mjs` (3 commits desde el 30/07) | Simulacro, "por qué un campo va al último" ⚠ sin verificar que sea esta pieza |
| 7 | Naeth | Los filtros dentro de cada rama del RRF, y el `ORDER BY` que no es redundante | `naeth/app/core.py:278-314`, `:344-350` | Marcadores (15) |
| 8 | Naeth | `graph_knn` por nodo y la similitud comprimida (mediana 0,874 al azar) | `core.py:470-485` | Marcadores, y es lo que 1.2 tiene que medir |
| 9 | Naeth | El digest se rechaza, no se recorta; y no entra en el `content_hash` | `core.py:70-85`, `:88-119` | Criterio 2 |
| 10 | Naeth | `_resumen`: `written` frente a `excerpt`, y por qué el recorte se queda | `mcp_server.py:263-298` | Criterio 2 |
| 11 | CENIT | El handoff crea la staging con `LIKE`: por qué `finally` va primero en una migración | `handoff.py` (448 líneas) y `006-digest.sql:18-29` | Criterio 4, falló en producción el 28/08 |
| 12 | Naeth | `CREATE OR REPLACE VIEW memory_current` obligatorio tras cada columna | `db/migrations/006-digest.sql:40-47`, `003:29-35` | Criterio 4, dos incidentes |
| 13 | Naeth | El motor del grafo: `sim.ts` y el pintor sobre canvas | `web/src/lib/sim.ts` (10 marcadores), `views/graph/Lienzo.svelte` (13, churn 14) | Marcadores y churn |
| 14 | Naeth | `outsideCode`: trocear por vallas antes de tocar wikilinks | `web/src/lib/wikilinks.ts:197-201`, `:210`, `:256` | Criterio 4 (su hermana sin guarda es el frente fuera de alcance) |
| 15 | CENIT | El watchdog y la propiedad del testigo | `watchdog.py` (217 líneas, 3 marcadores), `ownership.py` (325, 3) | Marcadores |
| 16 | CENIT | Los guiones de operación: `failover-status`, `shutdown`, `healthcheck` | `core/ops/failover-status.ps1` (98), `shutdown.ps1` (2 marcadores), `healthcheck.sh` (184) | Criterio 4: lo que un agente rompería sin enterarse |
| 17 | Hooks | Las reglas de diseño de un hook: falla abierto, stdout sagrado, no bloquear sin poder leer | `~/.claude/hooks/time-context.ps1:12-19`; `.claude/hooks/py-lint.ps1:1-24` | Criterio 3, recetario, y es el patrón que la sub-fase 6 reutiliza |
| 18 | Yogin-API | Los organizadores enlazados y la liquidación mensual | `src/utils/linked-organizers.mjs`; `billing.service.mjs` (1.263 líneas) con sus tests de integración de 742 y 642 líneas | Criterio 3 |

Lo que **no** entra en la semilla, y por qué: Yogin-Website (40.565 líneas de JSX, `git ls-files | xargs wc -l`) son formularios y pantallas; ninguno de los cuatro criterios los señala y el churn reciente son metaimágenes (`api/og.js`, 4 commits). Solo entra si el criterio 1 lo pide en la sub-fase 4. Los **huecos de conocimiento** del simulacro (GIL, perfilado, semáforo) tampoco: no hay código propio que fichar, y el cuaderno es de código propio (`7ddf94d1`: "no se arreglan recitando").

**El tope: 8 horas en dos tardes de 4, y se corta por reloj.** Sale de las "dos tardes" de `dc15236d`. Se reparte así, y el reparto es parte de la guarda:

| Bloque | Horas | Sub-fase |
|---|---|---|
| Piloto de tres fichas, que además calibra cuánto cuesta una | 2 | 3 |
| Inventario priorizado, cerrado antes de barrer | 1 | 4 |
| Siembra en orden hasta agotar | 5 | 5 |

**Cuántas fichas caben es una medición, no una estimación.** El único precedente medido es el de los digests: 24 redactados y calibrados en una sesión (`fase-4-0-tope-y-prioridad.md:15-27`), pero un digest son 300 caracteres y una ficha exige leer la pieza y su contexto. La hipótesis de trabajo son 30 a 40 minutos por ficha, o sea **8 a 10 fichas en las 5 horas de siembra, 11 a 13 con el piloto**. El piloto sustituye ese número por el medido antes de gastar las 5 horas, igual que la fase 4.0 sustituyó "entre 200 y 400" por 24 casos reales (`fase-4-0:15-16`). Si el piloto dice 60 minutos por ficha, caben 5 y se asume: **lo que no entre se queda en la lista, no se estira el tope.** El corte lo da la línea `[reloj]` que inyecta el hook en cada turno, y el resto de la lista vive en `code/status` (ver 1.4), que es donde el disparador lo recoge cuando se toque esa pieza de forma natural.

### 1.2 El aislamiento: por path, con exclusión por defecto en `core.search`

**Decisión: el cuaderno es el proyecto `code` del árbol, con un subtema por repo** (`code/naeth`, `code/cenit`, `code/yogin`), y `core.search` **excluye `path LIKE 'code/%'` por defecto**, salvo que `path_prefix` empiece por `code`. Nada más.

Por qué por path y no por `memory_type`:

- **El path ya es el eje de todo lo que agrupa y filtra.** El árbol parte por el primer segmento (`web/src/lib/tree.ts:36-38`), el grafo colorea y filtra por él (`web/src/lib/graph.ts:22`, `:79-80`, `:231-233` con `filters.projects`), y `memory_stats` agrupa por él (`core.py:530-531`, `split_part(path,'/',1)`). Un proyecto `code` aparece en los tres sitios sin tocar ninguno, y en el grafo **ya se puede ocultar** con el filtro de proyectos que existe.
- **Un `memory_type` nuevo rompe cuatro listas a la vez** (fase 1 §1.2.e: `CLAUDE.md`, `Memoria.svelte:27`, `Nueva.svelte:36`, la descripción de la tool en `mcp_server.py:324-325`), y el mapa de formas del grafo (`pintor.ts:224-228`). Y el precedente de `tested_by` dice que un vocabulario sin CHECK se estrena solo. Las fichas usan los cuatro tipos que existen: `fact` para el mecanismo, `decision` para el porqué, `observation` para el aviso. **El vocabulario no cambia.**
- **Una tabla aparte** obliga a clasificarla en `sync.py:129-147` y pasa por el sync entero. Es el coste que tumbó `memory_knn` (`naeth-ideas:286-288`). No.

Por qué la exclusión va en `core.search` y no en quien llama: son tres llamadores (`memory_search` en `mcp_server.py:336-341`, `/api/search` en `:532-539`, y los hooks de la sub-fase 6), y el segundo hoy no pasa ningún filtro (punto 0.1). La regla en un solo sitio, con test, cubre a los tres. La rama léxica y la semántica reciben el mismo `AND`, igual que hoy los filtros positivos (`core.py:311-314`, "los filtros se aplican dentro de cada rama").

**Contrato de la regla**, para que la sub-fase 2 no tenga que decidirlo:

| Llamada | Qué devuelve |
|---|---|
| `memory_search("reserva atómica")` | Solo prosa. Nunca una ficha |
| `memory_search("reserva atómica", path_prefix="code/")` | Solo fichas |
| `memory_search("...", path_prefix="code/yogin")` | Fichas de ese repo |
| `memory_search("...", path_prefix="yogin/")` | Prosa de Yogin, como hoy |
| Búsqueda del visor sin parámetros | Solo prosa (hereda la regla) |

**El riesgo que la exclusión no resuelve, y que hay que medir**: el índice HNSW es uno para todo lo vigente (`schema.sql:184-186`), y pgvector con un `WHERE` sobre HNSW filtra **después** de recoger candidatos. Mientras el cuaderno sea una minoría del corpus, da igual. Si llega a ser mayoría, que la fase 1 §1.2.e da por posible en meses, los candidatos del índice serían casi todos código, se filtrarían, y **el recall semántico de la prosa caería sin aviso**. La imagen es `pgvector/pgvector:pg17` (`docker-compose.yml:19`), que trae el escaneo iterativo de la 0.8 como mitigación ⚠ sin verificar la versión exacta de la extensión. La salida limpia si hace falta es **un índice HNSW parcial para prosa y otro para código**: es solo un índice, no toca la vista ni la staging del handoff, así que es la migración barata. La sub-fase 2 deja medida la línea base (mediana de similitud entre pares al azar, método de `core.py:476-481`, y el `EXPLAIN` de la consulta con exclusión) y la sub-fase 8 la vuelve a medir con el cuaderno dentro.

**El ruido de vocabulario en la rama léxica** (`for`, `id`, `null` sin stopwords, fase 1 §1.2.e) desaparece por construcción con la exclusión: esos tokens del cuaderno ya no compiten con la prosa.

### 1.3 El disparador: el cuaderno se pone delante en tres momentos, y los tres son hooks

La regla del 15/08 (`cf1f596b`) tiene dos mitades y la segunda es la que manda: el acceso es necesario y no suficiente; **lo que elimina la consulta es que la pieza se dispare sola**. Un hook no puede forzar una skill (fase 1 §2, límite 2), así que la garantía es mecánica en los tres puntos donde de verdad se toma la decisión:

**Momento 1: antes de tocar un fichero que tiene ficha.** `PreToolUse` con matcher `Edit|Write`, como ya hace `guard-em-dash.ps1` (`~/.claude/settings.json:126-135`). El hook busca el `file_path` en un **índice local** y, si hay ficha, devuelve `additionalContext`: id, título, digest, y si el fichero ha cambiado desde que se escribió la ficha. Texto del aviso, aproximado: "este fichero tiene ficha en el cuaderno: X (`memory_get` antes de tocar). Escrita sobre el sha A; el fichero está en el sha B, así que puede estar desactualizada. Si cambias el mecanismo, `memory_supersede` de la ficha". Es el momento exacto en que no acordarse cuesta dinero, y no depende de nadie.

**Momento 2: al arrancar una sesión en uno de los tres repos.** `SessionStart`, stdout de una línea: "cuaderno: 11 fichas de este repo, 2 con el fichero cambiado: X, Y". Este hook es además quien **regenera el índice local**: un GET a `127.0.0.1:8801/api/tree`, se queda con las filas de `code/`, y escribe `~/.claude/cuaderno/index.json` (fichero → fichas, sha, repo). Con el índice en disco, el momento 1 no hace ninguna llamada de red y funciona aunque Naeth esté caído, con el índice de la última vez. Es la idea F (`naeth-ideas:110-121`) hecha mecanismo: para código, "qué haría falsa a esta memoria" es el sha del fichero, y aquí se comprueba solo.

**Momento 3: al terminar un turno en el que se ha escrito código.** Es el que convierte "cada vez que se escriba código, revisarlo" de propósito en mecanismo, y es el candidato realista que la fase 1 señaló (§2, límite 1). Dos hooks:

- `PostToolUse` con matcher `Edit|Write|mcp__naeth__memory_add|mcp__naeth__memory_supersede`: si el fichero editado es código y está en uno de los tres repos, lo apunta en un estado por sesión (el mismo patrón que `time-context.ps1`, `~/.claude/timelog/sessions/<id>.json`, `:52-55`). Si la tool es una escritura en Naeth con `path` bajo `code/`, apunta "ficha escrita", y **comprueba que `metadata` lleva las claves de la convención** (ver 1.4); si no, avisa por `additionalContext`. Es la guarda del vocabulario que la base no tiene.
- `Stop`: si en la sesión hay código escrito y ninguna ficha, **bloquea una vez** con `exit 2` y un mensaje: "se ha escrito código en A, B y C sin pasar por el cuaderno. Revisa el diff (skill `revisar`) y decide, por fichero: ficha nueva, `supersede` de la ficha N, o sin ficha y por qué. Escribe la decisión en la respuesta". Una sola vez por sesión, con marca en el estado, para que no entre en bucle; y `stop_hook_active` si existe (⚠ sub-fase 0). El agente puede decidir "sin ficha", y esa decisión queda en el transcript, que `archive-on-start.ps1` archiva: lo que se elimina es el **silencio**, que es el patrón del vibe coder.

**Lo que este diseño mide sin tabla**: cada vez que un hook pone una ficha delante o ve un `memory_get` de una ficha del índice, añade una línea a `~/.claude/cuaderno/consultas.jsonl` (evento, fichero, ficha, sesión). Es la idea B (`naeth-ideas:54-67`) en su versión mínima: local, sin esquema, sin sync, y responde en 30 días a la única pregunta que importa, **si se consulta**. El riesgo que la idea B señalaba (un registro de en qué trabaja a cada hora) no aparece: solo se anota lo que toca el cuaderno.

**Lo que NO es el disparador**, para no reabrirlo: no es una skill (se olvida), no es `CLAUDE.md` solo (contexto, no imposición, fase 1 §3), no es `FileChanged` (solo entrega la ruta y vigila nombres literales, doc consultada hoy; para "cualquier fichero de código" no sirve), y no es `PreToolUse` bloqueante en la escritura (impediría trabajar, y la revisión es del turno, no del guardado).

**Reglas de diseño heredadas, que no se discuten**: fallan abiertos (`time-context.ps1:13-15`, `py-lint.ps1:41-43`), stdout una línea y solo cuando aporta, y ningún hook bloquea por una herramienta que falte en la máquina.

### 1.4 Dónde vive el dato: `metadata` revivida, con convención escrita

Se miró `attachment` antes que nada, como se pidió. Lo que es (`naeth/db/schema.sql:91-104`): una fila por **binario copiado dentro del volumen de assets**, con `storage_path NOT NULL` "ruta relativa dentro del volumen de assets", `sha256 NOT NULL`, `extracted_text`, y un `memory_id` que es el sidecar que lo representa. El volumen existe y está montado en los tres servicios (`docker-compose.yml:104`, `:158`, `:205`). El sync ya la clasifica como tabla de unión (`sync.py:82-88`).

**Por qué no sirve para el cuaderno**, en orden de peso:

1. **Es una copia, y la ficha necesita un puntero.** `attachment` está pensada para que el fichero viva en Naeth. Una ficha de código apunta a un fichero que vive en el repo, y copiarlo crearía la segunda fuente de verdad que la putrefacción (fase 1 §1.2.c) exactamente no quiere. Rellenar `storage_path` con una ruta de repo es doblar la semántica de la tabla.
2. **No tiene ni un camino de código.** `grep -rn attachment naeth/ --include=*.py --include=*.ts --include=*.svelte` devuelve dos aciertos: el `CREATE TABLE` y la lista de truncado de los tests (`app/tests/conftest.py:26`). Ni inserción, ni lectura, ni MCP, ni API, ni visor. Revivirla es escribir todo eso; revivir `metadata` es añadir un parámetro a dos tools y un campo a dos salidas.
3. **No sigue a la versión.** `attachment.memory_id` apunta a una fila de `memory`, y cada `supersede` crea una fila nueva (`core.py:122-140`, "no hereda del padre"). Cada revisión de una ficha obligaría a reinsertar sus adjuntos. `metadata` viaja dentro de la fila y se reescribe con ella.

`attachment` es para la idea N (`naeth-ideas:178-182`): el mapa de Inkerlum, el PDF del contrato. Se queda vacía y sin tocar.

**Por qué no una columna nueva**: cinco pasos y el quinto es caro (fase 1 §1.3), con el `CREATE OR REPLACE VIEW` que falló en producción dos veces (`006-digest.sql:40-47`, `003:29-35`) y la coordinación de dos nodos. Para un puntero cuya forma va a cambiar durante la siembra, es pagar la migración cara por adelantado. Se promociona a columna **solo si una consulta necesita un índice que el JSON no dé**, y aun entonces un GIN sobre `metadata` es solo un índice, sin vista ni staging.

**Por qué `metadata`**: existe (`schema.sql:40`), `core.add` y `core.supersede` ya la escriben (`core.py:90`, `:115`, `:124`, `:139`), `/api/memory/{id}/supersede` la pasa (`mcp_server.py:516`) y el visor **la conserva al editar** (`web/src/views/Memoria.svelte:376`). Viaja en el sync porque se fija al insertar y las columnas no monótonas se conservan tal cual (`sync.py:150-156`). Lo que le falta es exactamente lo que fase 1 §1.2.c midió: no se puede escribir por MCP (`mcp_server.py:256-260`, `:368-373`) y `memory_get` no la devuelve (`:351-356`). Eso es la sub-fase 2.

**La convención de claves**, escrita aquí para que no se estrene sola (el precedente es `tested_by`, fase 1 §4.3):

| Clave | Qué | Ejemplo |
|---|---|---|
| `cuaderno` | Discriminador fijo, por si el path cambia algún día | `"code"` |
| `repo` | Slug del repo, kebab-case | `"yogin-api"`, `"cenit"`, `"naeth"` |
| `file` | Ruta relativa a la raíz del repo, con barras normales | `"src/routes/events.mjs"` |
| `lines` | Rango informativo, no se valida | `"1140-1196"` |
| `symbols` | Nombres por los que uno recuerda la pieza | `["findOneAndUpdate", "$expr", "claimSlot"]` |
| `sha256` | Del fichero **entero** al escribir la ficha. Cualquier cambio del fichero la marca "revisar" | |
| `commit` | `HEAD` del repo al escribir la ficha | |
| `kind` | Qué criterio la trajo: `mechanism` (1), `why` (2), `recipe` (3), `warning` (4), `style` (ver §2) | |

Hash del fichero entero y no del rango, a propósito: es honesto (no hay forma barata de saber si un cambio fuera del rango altera el mecanismo) y es lo que un hook calcula en un milisegundo. Afinar a rango es trabajo posterior si el aviso resulta ruidoso, y eso lo dirá `consultas.jsonl`.

**Y dos convenciones de contenido que esquivan dos defectos sin tocarlos**:

- **La línea de símbolos va en el texto, en tokens sueltos**, además de en `metadata`: "Símbolos: findOneAndUpdate, expr, claimSlot". Fase 1 §1.2.b midió que `c.execute(sql)` es un solo token y que buscar `execute` no encuentra la nota. Una línea con los nombres separados hace que la rama léxica los encuentre sin cambiar el `tsvector`.
- **La explicación va antes del fragmento, y los símbolos al principio.** El embedding se calcula sobre los primeros 512 tokens, que en código son unos 1.400 caracteres (fase 1 §1.2.b). Si el porqué y los nombres van delante, lo que la búsqueda semántica ve es lo que importa. No arregla el truncado, que es frente propio y está fuera de alcance; hace que el cuaderno no dependa de arreglarlo.

**`code/status`** es la nota de entrada del cuaderno, como cualquier `proyecto/status`: la lista priorizada, lo sembrado, lo que quedó fuera al cortar, y las mediciones. Es donde se retoma.

### 1.5 Antes o después de la fase 2 del roadmap: es independiente, y "estrictamente más barato después" no se sostiene

El argumento de la fase 1 (§1.5) era: la fase 2 del roadmap entrega un compose con su propio Postgres (`roadmap-producto-2026-09-09.md:65`), y después de eso el peaje de migración multi-nodo deja de ser obligatorio para probar. **Dos premisas fallan:**

1. **El cuaderno no necesita migración.** Con `metadata` revivida (1.4) y el path como aislamiento (1.2), no se añade ni una columna ni una tabla. Lo que se despliega es código de `naeth/app/` y del visor, que se despliega como cualquier entrega (`2.2026.09.x` en los dos nodos, igual que la fase 4 del digest). El peaje que "después" evitaba no existe en este plan.
2. **Aunque hiciera falta una columna, el peaje es de producción, no de las pruebas.** Los tests ya corren hoy contra una base que nace de `schema.sql` (`CLAUDE.md`, tests del backend), y por eso mismo no cogen el fallo de la vista (fase 1 §1.3, paso 3). La fase 2 del roadmap facilita instalar en una máquina limpia; los dos nodos de Eneko siguen siendo dos nodos con failover, y el roadmap dice que el multi-nodo se queda como lujo de la instancia de referencia (`roadmap:143`). Una migración seguiría yendo a `finally` primero y al PC después, con o sin fase 2.

**Lo que sí es cierto del argumento**: el riesgo número uno del roadmap es que su fase 1 rompa la instalación de Eneko (`roadmap`, tres riesgos), y su principio es aislar un cambio cada vez. De ahí sale la única restricción de secuencia real: **la sub-fase 2 de este plan, la que despliega `naeth/app/`, no se hace el mismo día que un despliegue de la fase 1 del roadmap en CENIT.** Es una restricción de calendario, no de orden.

**Veredicto**: refutado como "estrictamente". Es independiente, y hay una razón para empezar ya: el diagnóstico es un problema vivo (6 de 28), cada semana sin el hook de `Stop` es más código de agente sin revisar, y el disparador tarda una sesión en existir. La fase 4 del roadmap gana además una demo que se puede enseñar entera (`roadmap:115-116`, fase 1 §1.5), y gana más cuanto antes exista el cuaderno.

---

## 2. Los criterios: los cuatro, los que faltan, y cuál ordena

Los cuatro elegidos (`dc15236d`) se quedan. Se buscaron otros mirando qué deja fuera cada uno y qué dice el material medido. Siete candidatos; entran cuatro, se descartan tres con su razón:

| # | Criterio | ¿Entra? | Por qué |
|---|---|---|---|
| 5 | **Lo que el simulacro falló** | Sí, como **cabecera del orden** | Es el criterio 1 con medición en vez de autoevaluación. Da las tres primeras fichas sin discutir |
| 6 | **Lo que un agente ya rompió o casi** | Sí, dentro del 4 | El 4 dice "lo que se rompe si se toca mal"; esto es la versión con incidente detrás. `_emdash_backup` sin clasificar tumbó el `recover` del 30/07 (`sync.py:106-110`); el `docker compose down` del 22/08 tiró Naeth (`CLAUDE.md`). Un aviso con fecha vale más que uno hipotético |
| 7 | **Lo que enseña cómo escribe él** | **Sí, y es el que falta de verdad** | La decisión dice dos cosas: consultar cuando no recuerde, **y que el código de los agentes se parezca al suyo** (`dc15236d`, "QUÉ ES"). Ninguno de los cuatro cubre la segunda. La fase 1 §3 concluye que ese estilo no lo impone ningún linter y que solo se consigue con estilo documentado más revisión; y §6.6 dice que no está destilado. Una ficha `kind: style` es un fragmento suyo con la decisión escrita al lado, elegido por ser ejemplar, no por ser difícil. Tres o cuatro bastan, y son las que `CLAUDE.md` puede señalar como "escribe así" |
| 8 | **Lo que más se toca** (churn) | Sí, como **desempate**, no como criterio | Es la única señal computable sin juicio, y dice dónde el hook va a disparar más. Sola engañaría: un formulario con 14 commits no merece ficha |
| 9 | **Lo que un tercero necesitaría** (producto) | No, todavía | Es el criterio de la fase 4 del roadmap, no del diagnóstico. Cuando llegue la demo, se filtra el cuaderno por `kind`; no hace falta decidirlo al escribir |
| 10 | **Lo que tiene test que lo demuestra** | No como criterio, sí como **campo** | Un test es la ficha ejecutable. No ordena (la reserva atómica tiene test y el merge monótono también, y las dos entrarían igual), pero una ficha que nombra su test envejece mejor. Va en el contenido, "Lo demuestra: `tests/…`" |
| 11 | **Lo transferible entre repos** | No, es el 3 | Idempotencia, reintentos, fail-open: el 3 ya lo llama recetario. Añadirlo sería el mismo criterio con otro nombre |

**Cuál sirve como orden del barrido**: el **criterio 1**, autoevaluado en diez segundos por pieza, con el **5 como cabecera** (lo que el simulacro ya midió va primero, sin autoevaluar) y el **8 como desempate**. Los criterios 2, 3, 4 y 7 deciden **qué se escribe en la ficha** (el `kind`), no en qué orden: una pieza puede ser mecanismo y aviso a la vez, y el orden solo necesita una pregunta.

---

## 3. Las sub-fases, en el orden en que hay que hacerlas

Nueve sub-fases. Las de siembra (3, 4, 5) consumen el tope de 8 horas; las de construcción (0, 1, 2, 6, 7) son desarrollo y llevan estimación propia; la 8 es a 30 días. El orden tiene tres razones que conviene tener a mano: el inventario (4) va antes de tocar nada porque es lo que el punto 1 pedía y no depende de código; el backend (2) va antes del piloto (3) porque sin él las fichas no pueden llevar `metadata` por MCP y contaminarían la búsqueda; y los hooks (6) van **antes** de la siembra grande (5) porque un cuaderno sembrado sin disparador es el playbook del 15/08 otra vez, y porque así la siembra ya se mide.

Cada sub-fase cierra con la suite acumulada en verde (metodología del 16/07): las de backend con los 72 tests más los nuevos; las de hooks con la suite de hooks; las de front con `npm test && npm run check && npm run build`.

### Sub-fase 0 · Cinco comprobaciones de las que depende el diseño

**Objetivo**: convertir en hechos las cuatro cosas marcadas `⚠` de las que dependen las sub-fases 2 y 6, antes de escribir nada.
**Qué se hace**:
1. Un hook desechable de `PreToolUse` y otro de `Stop`, en un directorio de pruebas con `USERPROFILE` falso (el patrón de `~/.claude/tools/tests/test-time-context.ps1:1-10`), que vuelquen su stdin a fichero. Confirmar: que `tool_input` de `Edit` trae `file_path`, `old_string` y `new_string`; que `Stop` trae `stop_hook_active` o, si no, qué trae; que `additionalContext` de `PreToolUse` llega al modelo.
2. Un `GET 127.0.0.1:8801/api/tree` a mano, para ver el payload exacto que el índice local va a parsear (`core.py:361-375` dice qué campos; se comprueba el JSON real).
3. La versión de la extensión `vector` en el nodo vivo, por si el escaneo iterativo de HNSW existe (1.2).
4. La línea base de similitud: mediana entre pares al azar con el método de `core.py:476-481`, y `memory_stats` en modo `counts`, para comparar en la sub-fase 8.
5. Las tres piezas del simulacro localizadas con línea, confirmando la 6 de la tabla de 1.1, que está `⚠`.
**Entra / no entra**: entra medir; no entra arreglar nada de lo que se encuentre.
**Entregable**: un apartado "Verificado en la sub-fase 0" al final de este documento, con los cinco resultados y fecha.
**Cómo se comprueba**: los volcados de stdin están en disco y se citan; las cifras de 3 y 4 tienen comando al lado.
**Qué se rompe si falla**: nada en producción. Si el punto 1 sale mal (el payload no trae lo esperado), la sub-fase 6 se rediseña antes de escribirse, que es para lo que existe esta.
**Coste**: 1 hora.

### Sub-fase 1 · La convención del cuaderno, escrita donde se lee antes de escribir

**Objetivo**: que nadie, ni él ni un agente, tenga que decidir cómo es una ficha.
**Qué se hace**: un bloque en el `CLAUDE.md` global (donde viven las convenciones de Naeth, porque una regla que solo vive en Naeth no se consulta al escribir, `~/.claude/CLAUDE.md`, nota del em dash) con: el path `code/<repo>`, los cuatro `memory_type` de siempre, tags `["code", <repo>, ...]`, las claves de `metadata` de 1.4, las dos reglas de contenido (símbolos en texto, explicación antes del código), la plantilla de secciones (**Qué hace · Dónde vive · Por qué así y no de otra forma · Qué se rompe si se toca mal · Lo demuestra · Símbolos · Fragmento**), la regla del digest (dice qué afirma el mecanismo, no de qué va), y la lista de lo que **no** es una ficha (un fichero entero copiado, un hueco de conocimiento sin código propio, una nota de prosa con un fragmento pegado).
**Entra / no entra**: entra la convención y la plantilla; no entra escribir ninguna ficha, que es del piloto.
**Entregable**: el bloque en `CLAUDE.md` y una nota `code/status` en Naeth con la plantilla y el estado "convención escrita, sin fichas".
**Cómo se comprueba**: la sub-fase 3 escribe tres fichas siguiéndola y **no necesita decidir nada** que no esté aquí. Si necesita decidir algo, se vuelve a esta sub-fase y se añade.
**Qué se rompe si falla**: el cuaderno nace con tres formas distintas de ficha, que es lo que pasó con los tags (403 de 695 usados una vez, `naeth-ideas:22`).
**Coste**: 1 hora.

### Sub-fase 2 · El backend, en un solo despliegue

**Objetivo**: los cinco cambios de `naeth/app/` que el cuaderno necesita, juntos, con test, en los dos nodos, una vez.
**Qué se hace**, y es la lista cerrada:
1. `core.search`: exclusión por defecto de `path LIKE 'code/%'`, levantada cuando `path_prefix` empieza por `code`. Aplicada dentro de las tres consultas (`core.py:322-358`), como los filtros existentes.
2. `/api/search`: pasar `path_prefix` (y `memory_type`) desde la query string (`mcp_server.py:532-539`). Es lo que el visor usará en la sub-fase 7.
3. `memory_add` y `memory_supersede` del MCP: parámetro `metadata` opcional (`mcp_server.py:256-260`, `:368-373`), con la descripción de la tool diciendo para qué sirve.
4. `memory_get`: devolver `metadata` y **también `digest`**, que hoy tampoco devuelve (`:351-356`, fase 1 §1.3).
5. `core.tree`: incluir `metadata` (`core.py:361-375`). Es lo que lee el índice local del hook.
Y la descripción de `memory_search` (`mcp_server.py:316-335`) dice que el cuaderno existe y cómo se busca: `path_prefix='code/'`.
**Tests**: en `app/tests/test_core.py`, junto a los de filtros (`:167-232`): la exclusión por defecto, la exclusión levantada con `code/`, levantada con `code/yogin`, no levantada con `yogin/`, y `tree` con `metadata`. Suite acumulada: los 72 más estos, con `docker compose --profile test run --rm test` y **`docker compose rm -sf db` al terminar, nunca `down`** (`CLAUDE.md`, punto 2). Una sola suite a la vez (punto 3).
**Despliegue**: `finally` y el PC, etiqueta `2.2026.09.3` al desplegar, no al commitear. Sin migración: no hay columna, no hay vista, no hay staging. Ver 1.5 para la única restricción de calendario.
**Entra / no entra**: entra lo de la lista; no entra ningún cambio de esquema, ni tocar el `tsvector`, ni el truncado del embedding, ni `graph_links`.
**Entregable**: los dos nodos sirviendo la versión nueva; desde Claude Code, `memory_get` de una nota cualquiera devuelve `digest` y `metadata`.
**Cómo se comprueba**: los cinco tests nuevos en verde con la suite entera; y a mano desde Claude Code, `memory_search("zumbido")` sin una nota `code/` de prueba escrita antes, y con `path_prefix="code/"` solo esa nota. Contra el nodo que manda, comprobado con `failover-status.ps1` y no supuesto.
**Qué se rompe si falla**: **la búsqueda de todos los clientes**, claude.ai incluido, porque los tres llamadores pasan por `core.search`. Rollback: revertir el commit y redesplegar, que es lo mismo que desplegar. Y durante la edición, el 8801 se recarga en cada guardado (punto 0.5): no trabajar aquí desde una sesión que necesite Naeth a mitad.
**Coste**: una sesión, 3 a 4 horas con tests y despliegue.

### Sub-fase 3 · El piloto: tres fichas que calibran todo lo demás

**Objetivo**: escribir las tres fichas del simulacro siguiendo la convención, y medir lo que ninguna estimación puede dar.
**Qué se hace**: las piezas 1, 2 y 3 de la tabla de 1.1 (reserva atómica, menos cero, merge monótono), por MCP, con `metadata` completa. Por cada una se apunta: minutos de lectura, minutos de escritura, caracteres de la ficha, caracteres del fragmento, y si el digest cabe en 300 sin mentir. Es el método de la fase 4.0 (`fase-4-0:15-27`): casos reales medidos, no elección entre números.
**Entra / no entra**: entra escribir tres y medir; no entra escribir la cuarta aunque sobre tiempo. El sobrante va al inventario.
**Entregable**: tres fichas vigentes en `code/yogin` y `code/cenit`, y la tabla de medición en `code/status`, con el número resultante: **cuántas fichas caben en las 5 horas de siembra**.
**Cómo se comprueba**: desde Claude Code, tres búsquedas por símbolo con `path_prefix="code/"` (`findOneAndUpdate`, `expr`, `is_current`) devuelven cada una su ficha en el top 3; las mismas tres sin `path_prefix` no devuelven ninguna ficha; `memory_get` de cada una devuelve `metadata` con las ocho claves. Y una comprobación que solo él puede hacer: **al día siguiente, contestar de memoria las tres preguntas que falló**. Si sigue fallando con la ficha escrita, la plantilla está mal y se vuelve a la sub-fase 1.
**Qué se rompe si falla**: si el digest de 300 no puede describir un mecanismo, se sabe aquí con tres casos y no con doce; relajar el CHECK es gratis en dirección de subida (`fase-4-0:64-74`) pero es una migración en dos nodos, y esa decisión se toma con el dato del piloto. Si una ficha lleva `[[` dentro de un fragmento de bash, `graph_links` (`core.py:460-463`) lo verá como wikilink roto y `memory_stats` en modo higiene lo listará: se anota como limitación conocida, no se arregla aquí.
**Coste**: 2 horas del tope.

### Sub-fase 4 · El inventario priorizado, cerrado antes de barrer

**Objetivo**: la lista única, ordenada, con piezas de los tres repos, que la siembra recorre de arriba abajo.
**Qué se hace**: partir de la semilla de 18 de la tabla de 1.1, ampliarla con las salidas ya medidas (marcadores por fichero y churn, mismos comandos), y aplicar a cada candidata **una sola pregunta, diez segundos, sin abrir el fichero**: "¿sabría reescribir esto hoy sin mirar?". Las que respondan que no, ordenadas: simulacro primero (ya fichadas en el piloto), luego el resto por marcadores, y churn de desempate. Cada entrada con repo, fichero y línea, y el `kind` previsto. Tres o cuatro entradas con `kind: style` elegidas a propósito (criterio 7): fragmentos suyos que quiere que un agente imite.
**Entra / no entra**: entra listar y ordenar; **no entra leer código ni escribir fichas**. Si se abre un fichero para decidir, el criterio 1 se está aplicando mal.
**Entregable**: `code/status` supersedida con la lista, numerada, y la línea "presupuesto consumido: X de 8 h".
**Cómo se comprueba**: la lista tiene al menos 20 entradas de al menos tres repos, cada una con fichero y línea, y las 10 primeras no son todas del mismo repo. Esa última condición es la que el punto 1 del encargo pedía proteger.
**Qué se rompe si falla**: sin lista, el primer repo se come el tope. Con lista de un solo repo, igual.
**Coste**: 1 hora del tope.

### Sub-fase 5 · La siembra, hasta que se acaba el reloj

**Objetivo**: fichas en el orden de la lista, con el disparador ya vivo (sub-fase 6 va antes: ver la razón al principio del §3).
**Qué se hace**: de arriba abajo, una ficha por entrada, con la plantilla, con `metadata`, con el test nombrado si lo hay, y con relaciones a las notas de prosa que la explican (`derived_from` a la decisión, si existe). Al terminar cada una, apuntar el minuto. Cuando la línea `[reloj]` diga que las 5 horas están, **se para en la ficha que esté cerrada, no en la que esté a medias**: una ficha a medias se tombstonea, no se deja.
**Entra / no entra**: entra escribir en orden; no entra reordenar sobre la marcha ("esta es más interesante"), ni pasar del tope, ni escribir fichas de piezas que se descubran leyendo (van a la lista, al final).
**Entregable**: N fichas vigentes, `code/status` con lo sembrado, lo que quedó fuera y el tiempo real consumido.
**Cómo se comprueba**: `memory_stats` en `counts` da el proyecto `code` con N; cada ficha pasa la lista de la sub-fase 1 (path, tags, ocho claves, símbolos en texto, explicación antes del fragmento); el índice local de la sub-fase 6 las ve todas al arrancar una sesión en el repo; y el tiempo apuntado no pasa de 8 horas sumando las sub-fases 3, 4 y 5.
**Qué se rompe si falla**: si se pasa del tope, la siembra ha sustituido al trabajo, que es lo que la guarda existe para impedir. Si se sale del orden, el tope se gasta en lo llamativo y no en lo que se falló.
**Coste**: 5 horas del tope, y ni una más.

### Sub-fase 6 · Los hooks: el índice local y los tres momentos

**Objetivo**: que el cuaderno se ponga delante solo, con los mecanismos de 1.3.
**Qué se hace**: cuatro scripts en `~/.claude/hooks/`, globales porque son tres repos, con la lista de raíces de repo y de extensiones de código en la cabecera de cada uno:
1. `cuaderno-index.ps1` (`SessionStart`): GET a `/api/tree`, filtra `code/`, escribe `~/.claude/cuaderno/index.json`, calcula el sha actual de cada fichero del repo de `cwd`, y emite la línea de stdout. Si el 8801 no responde, usa el índice anterior y lo dice en la línea.
2. `cuaderno-pre-edit.ps1` (`PreToolUse`, `Edit|Write`): consulta el índice, emite `additionalContext` si hay ficha, anota en `consultas.jsonl`.
3. `cuaderno-track.ps1` (`PostToolUse`, `Edit|Write|mcp__naeth__memory_add|mcp__naeth__memory_supersede|mcp__naeth__memory_get`): estado por sesión; validación de claves de `metadata` en escrituras bajo `code/`; lectura de una ficha anotada en `consultas.jsonl`.
4. `cuaderno-stop.ps1` (`Stop`): bloqueo una sola vez por sesión si hay código sin pasar por el cuaderno.
Y su registro en `~/.claude/settings.json`, al lado de los que ya hay (`:53`, `:66`, `:112`).
**Tests**: `~/.claude/tools/tests/test-cuaderno.ps1`, con el patrón exacto de `test-time-context.ps1` (`USERPROFILE` en sandbox, JSON de fixture por stdin, `:16-38`): índice con fichero cambiado y sin cambiar, edición de fichero con ficha y sin ficha, escritura en `code/` con claves y sin ellas, `Stop` con código sin ficha (bloquea), segundo `Stop` de la misma sesión (pasa), `Stop` con ficha escrita (pasa), 8801 caído (falla abierto), repo fuera de la lista (silencio). La suite acumulada de hooks (`test-registro-hooks.ps1`, `test-time-context.ps1`) en verde con esta dentro.
**Entra / no entra**: entra lo de arriba; no entra el hook de `UserPromptSubmit` por palabras clave (segunda iteración, si `consultas.jsonl` dice que el momento 1 se queda corto), ni afinar el hash a rango de líneas.
**Entregable**: los cuatro hooks registrados, la suite en verde, y una sesión real en `F:\src\Yogin-workspace` en la que editar `events.mjs` muestra la ficha de la reserva atómica antes del `Edit`.
**Cómo se comprueba**: la suite; y la sesión real, con la línea de `consultas.jsonl` que deja.
**Qué se rompe si falla**: **un hook que bloquea mal para todo el trabajo en todos los repos**, no solo en estos tres. Por eso todos fallan abiertos, el `Stop` solo bloquea una vez, y la lista de raíces está en la cabecera para vaciarla en diez segundos. Si `Stop` entra en bucle pese a la marca, se desregistra ese hook solo y quedan los otros tres.
**Coste**: una sesión, 4 horas con la suite.

### Sub-fase 7 · El visor: que el cuaderno se vea y no estorbe

**Objetivo**: que el proyecto `code` del árbol sea útil y que el grafo no se llene de fichas por defecto.
**Qué se hace**: en `naeth/web/`: el filtro de proyectos del grafo (`lib/graph.ts:231-233`, `prefs-grafo.svelte.ts`) excluye `code` por defecto, con el conmutador que ya existe para volverlo a mostrar; la búsqueda del visor gana un conmutador "código" que pasa `path_prefix=code/` a `/api/search` (lo que la sub-fase 2 abrió); la ficha (`views/Memoria.svelte`) pinta el bloque de `metadata` de una nota `code/` (repo, fichero, símbolos, sha y commit, tal como están en la fila; el visor no tiene el índice local, así que "el fichero ha cambiado" es cosa de los hooks, no del visor). `npm ci && npm test && npm run check && npm run build`, y `build` es desplegar (memoria `0fcba192`).
**Entra / no entra**: entra lo de arriba; no entra editar fichas desde el visor mientras `unescapeMarkdown` no proteja las vallas (fase 1 §1.2.a, fuera de alcance): la convención dice que las fichas se escriben por MCP, y el visor las lee.
**Entregable**: el visor con el grafo limpio por defecto, la búsqueda con conmutador, y la ficha con su bloque.
**Cómo se comprueba**: tests de front en verde (`graph.test.ts` con `code` en los proyectos ocultos por defecto), `check` y `build`; y en el navegador, el grafo sin nodos `code` al abrir, con ellos al activar el proyecto, y una búsqueda por `findOneAndUpdate` que solo encuentra con el conmutador.
**Qué se rompe si falla**: el visor, en los dos nodos. Rollback: el build anterior, o quitar `NAETH_VIEWER_DIR` para volver al v1 (`docker-compose.yml:194-197`).
**Coste**: media sesión. Puede ir después de la 5 sin bloquear nada: el árbol ya muestra `code` sin tocarlo.

### Sub-fase 8 · La medición a 30 días, y la decisión

**Objetivo**: saber si el cuaderno se consulta, que es lo único que dice si existe.
**Qué se hace**, el 10/10/2026 o la primera sesión después: leer `consultas.jsonl` y `code/status`, y contestar con números: fichas puestas delante por el momento 1; `memory_get` de fichas tras un aviso; bloqueos de `Stop` que acabaron en ficha, en `supersede`, o en "sin ficha porque"; fichas con el fichero cambiado y cuántos días llevan así; y la similitud entre pares al azar contra la línea base de la sub-fase 0.
**Criterio de éxito del cuaderno entero**, propuesto para que no se decida después con el resultado delante: en 30 días, **al menos la mitad de las sesiones que editaron código en los tres repos acabaron en ficha, `supersede` o negativa escrita**, y **al menos 10 fichas se leyeron por `memory_get` después de que un hook las pusiera delante**. Lo primero mide la revisión; lo segundo, la recuperación. Si lo primero se cumple y lo segundo no, el cuaderno se escribe y no se lee, y el disparador es el que hay que cambiar. Si ninguno se cumple, se apaga el `Stop` y se deja el índice: un cuaderno que no se consulta no merece un hook que bloquea.
**Entregable**: `code/status` supersedida con la tabla y la decisión: seguir, ajustar el disparador, o parar.
**Cómo se comprueba**: los números salen de los ficheros, con el comando al lado.
**Qué se rompe si falla**: nada; si no se hace, el cuaderno queda como el playbook, sin saber si sirvió.
**Coste**: 1 hora.

---

## 4. Lo que está fuera de alcance, y de qué depende este plan

| Frente | ¿Depende el plan de él? | Qué hace el plan mientras tanto |
|---|---|---|
| El 66% de notas con embedding truncado (fase 1 §4.1) | **No** | La convención pone la explicación y los símbolos delante (1.4), y la rama léxica encuentra por la línea de símbolos. Cuando se arregle, las fichas mejoran solas |
| `unescapeMarkdown` sin guarda de bloque (fase 1 §4.2) | **No** | Las fichas se escriben por MCP y no se editan desde el visor (sub-fase 7). Si alguien edita una desde el visor, un `\_` dentro de una valla puede perder la barra: limitación escrita en la convención |
| El README caducado (fase 1 §4, desajustes) | **No** | Nada |
| `graph_links` sin excluir vallas (`core.py:460-463`), que la fase 1 cita y el encargo no lista | **No**, pero se nota | Un fragmento de bash con `[[` genera un wikilink roto en `memory_stats` higiene. Se anota en `code/status` como ruido conocido. Es la misma familia que `unescapeMarkdown` y va con ese frente |

Ninguna sub-fase se para por estos cuatro.

---

## 5. Sin verificar, y dónde se verifica

- Que `tool_input` de `Edit` trae `old_string` y `new_string`, y qué trae `Stop`. Sub-fase 0.1.
- Que `stop_hook_active` existe en el payload de `Stop`. Sub-fase 0.1. Si no existe, la marca por sesión basta.
- La versión exacta de la extensión `vector` y si el escaneo iterativo está disponible. Sub-fase 0.3.
- Que la pieza 6 de la semilla (`migrate-email-partial-index.mjs`) es la del "campo al último lugar del índice compuesto". Sub-fase 0.5.
- Que 30 a 40 minutos por ficha es la cifra real. Sub-fase 3 la sustituye.
- Que 300 caracteres de digest bastan para un mecanismo. Sub-fase 3, con tres casos.
- Que el selector de ruta de `Nueva.svelte` ofrece `code/<repo>` sin tocarlo (`lib/pathpick.ts`, que lee del árbol ⚠ no leído). Sub-fase 7, y si no, es un cambio de esa sub-fase.
- Cuántas búsquedas se hacen al día. Sigue sin registro; `consultas.jsonl` solo cuenta las del cuaderno, a propósito.
