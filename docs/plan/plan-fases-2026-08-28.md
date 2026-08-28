# Plan de fases · Naeth · 28/08/2026

## Resumen en 5 líneas

El análisis del 28/08 acierta en el diagnóstico de fondo (el camino de lectura es el cuello) y en los
tres huecos que importan: no hay filtros, no hay introspección y `memory_search` devuelve el contenido
entero. Falla en las cifras derivadas, porque las sacó de un `system_status` que suma peras y manzanas,
y se equivoca en dos afirmaciones negativas: la pasada léxica sobre lo no embebido **ya existe**, y el
conflicto de superficie **no está en curso** (las cinco filas son del 23/07 y no ha habido ninguna
más). Se deja fuera lo que el visor tiene abierto: dos handoffs de diseño sin aplicar y el alta de
memoria construida, verde y sin desplegar. Cuatro fases, cada una cerrando con despliegue en los dos
nodos y su tag, en el orden en que se pueden terminar.

---

## Auditoría del análisis del 28/08

Método: cada afirmación se contrastó contra el repositorio (con ruta y línea), contra la base viva
(consultas SQL de solo lectura sobre `memory.*` en `cenit-data-modules-db-1`, ejecutadas el 28/08 a las
12:5x) o contra Naeth (con id de memoria). Las afirmaciones negativas llevan escrita la búsqueda
concreta con la que se comprobaron. Lo no comprobado va marcado.

### Sección 1 · Datos de partida

| Afirmación | Veredicto | Evidencia |
|---|---|---|
| 757 filas escritas | Desactualizado | 760 el 28/08 a las 12:52. `SELECT count(*) FROM memory.memory`. Correcto al escribirse |
| 458 memorias vigentes | Desactualizado | 459. `SELECT count(*) FROM memory.memory_current` |
| 275 versiones superadas, derivado de 757 - 458 - 24, el 36,3% | **Incorrecto** | La resta usa 24 tombstones de los que **4 son de relación**, y supone que ninguna fila está superada y retirada a la vez (hay una que sí). Real: **282** filas en `supersession`, el 37,1% de 760 |
| 24 retiradas, el 5,0% de las 482 líneas | **Incorrecto en composición** | `SELECT target_kind, count(*) FROM memory.tombstone` da **20 de memoria y 4 de relación**. `core.status()` suma las dos sin separarlas ([core.py:311](../../naeth/app/core.py)) |
| 1,57 versiones por línea | Aproximadamente correcto, por casualidad | Real sobre líneas vigentes: 732/459 = **1,59**. Distribución medida con CTE recursiva: 326 líneas de una sola versión, 73 de dos, y una cola hasta **13** |
| 456 relaciones | **Incorrecto** | 456 filas en `relation`, pero 4 están retiradas: **452 vivas**. `core.status()` cuenta la tabla entera sin descontar tombstones ([core.py:310](../../naeth/app/core.py)) |
| Cola de embeddings 0 pendientes / 0 errores | Confirmado | `system_status` y `SELECT count(*) FROM memory_current WHERE embedding IS NULL` = 0 |
| Retardo medio 7.873 s (2 h 11 min) | Desactualizado, y engañoso por construcción | Ahora da 3.538 s. Es la media de **toda la tabla `job` desde junio**, no una ventana reciente ([core.py:313-320](../../naeth/app/core.py)): no dice cuánto tarda hoy |
| 203 sin modelo declarado, el 44,3% | **Confirmado** | `core.authors()`: 134 `claude-ai` + 69 `claude-code`, ambos `unknown_legacy`. 203/459 = 44,2% |
| 80 rutas distintas sobre 26 proyectos | Desactualizado por una | 81 rutas, 26 proyectos. `count(DISTINCT path)` y `count(DISTINCT split_part(path,'/',1))` |
| 7,8 vigentes al día en la última semana | **No comprobable** | Depende de instantáneas pasadas que no están guardadas. Medido de otra forma: **86 filas escritas en 7 días**, 12,3 al día brutas (incluye supersedes) |

### Sección 2 · Diagnóstico

| Afirmación | Veredicto | Evidencia |
|---|---|---|
| `memory_search` devuelve el contenido íntegro de cada resultado | **Confirmado** | [mcp_server.py:254-259](../../naeth/app/mcp_server.py): el `dict` de vuelta incluye `content: h["content"]`. Reproducido en esta sesión |
| Los scores van de 0,013 a 0,016, ruido de RRF | **Confirmado** | Reproducido: las búsquedas de esta sesión dan 0,0147 a 0,0164. Es aritmética del RRF con k=60 ([core.py:256](../../naeth/app/core.py)): el techo teórico es 1/61 + 1/61 = 0,0328 |
| Las preguntas de inventario no se pueden responder con las tools actuales | **Confirmado, con matiz** | Búsqueda: `grep -n "@mcp.tool" mcp_server.py` da **9 tools** y ninguna agrega. Matiz importante: `/api/tree` en loopback sí devuelve id, title, memory_type, path, tags y created_at de todo lo vigente ([mcp_server.py:374](../../naeth/app/mcp_server.py)). El hueco es del MCP, no del sistema |
| El ritual de escritura tiene skill y el de lectura no existe | **Confirmado** | Listado de skills disponibles: `NaethPersist` (checkpoint y cierre). Ninguna de lectura |

### Sección 3 · Nivel 1, cambios en el core

| Afirmación | Veredicto | Evidencia |
|---|---|---|
| 3.1 · `memory_search` no admite `path_prefix`, `tags`, `memory_type`, `since` ni `is_current` | **Confirmado** | Firma completa: `memory_search(query: str, k: int = 10)` ([mcp_server.py:254](../../naeth/app/mcp_server.py)) y `core.search(query, *, k, q_embedding)` ([core.py:232](../../naeth/app/core.py)). No hay más parámetros |
| 3.1 · Con `path_prefix=naeth/` competiría contra unas 60 notas | **Incorrecto en la cifra** | `SELECT count(*) FROM memory_current WHERE path LIKE 'naeth/%'` da **37**. El argumento aguanta igual (37 contra 459) |
| 3.2 · No existe tool de introspección | **Confirmado** | Las 9 tools son add, search, get, supersede, tombstone, relation_add, relation_list, relation_tombstone y system_status. Ninguna agrupa |
| 3.2 · Las dos memorias sin título son `14134724` y `f94961e3`, las dos en `cenit/build` | **Confirmado, exacto** | `SELECT id, path FROM memory_current WHERE title IS NULL OR btrim(title)=''` devuelve exactamente esas dos, del 21/07 a las 21:11 y 21:13. Son las únicas |
| 3.3 · `memory_search` no cubre lo que aún no está embebido | **Incorrecto** | `tsv` es `GENERATED ALWAYS ... STORED` sobre título y contenido ([schema.sql:27-29](../../naeth/db/schema.sql)), o sea que se calcula **en el INSERT**. Y la rama léxica del híbrido no filtra por embedding ([core.py:252-255](../../naeth/app/core.py)), a diferencia de la semántica, que sí lleva `WHERE embedding IS NOT NULL`. Una nota recién escrita ya entra por ahí. El hueco real es más pequeño y es otro: una consulta **parafraseada**, sin solape léxico, no la encuentra hasta que llega el embedding |
| 3.4 · El digest sería obligatorio en las cinco tools de escritura | **Incorrecto** | Solo **dos** escriben contenido: `memory_add` ([mcp_server.py:236](../../naeth/app/mcp_server.py)) y `memory_supersede` ([:285](../../naeth/app/mcp_server.py)). Las otras tres son tombstone y relaciones, y no tienen texto que resumir |
| 3.4 · `memory_search` pasaría a devolver id, title, path, memory_type, tags, created_at, digest y score | **Incompleto** | Hoy **no** devuelve `path` ni `created_at` ([mcp_server.py:255-258](../../naeth/app/mcp_server.py)). El cambio añade dos campos, además de quitar el contenido |
| 3.4 · Varias notas contienen dentro su propia versión refutada, así que el backfill no puede ser una pasada de LLM | **Confirmado** | Tres ejemplos verificados en el corpus vigente: `bee1b83e` lleva "CORRECCIÓN DEL 28/08 ... Es falso" sobre su propia afirmación anterior; `d87ecf64` lleva "CORREGIDO EL 22/08 ... eso no se verificó"; `ff25bbd6` lleva "ERA FALSO" sobre un criterio que ella misma explica |
| 3.4 · Backfill de 458 notas | Desactualizado | 459 |

### Sección 4 · Nivel 2

| Afirmación | Veredicto | Evidencia |
|---|---|---|
| 4.1 · Conviven tres formatos de wikilink (uuid, prefijo de 8, título) | **Incompleto: son cuatro** | Medido sobre las 459 vigentes con `regexp_matches(content, '\[\[([^\]]+)\]\]', 'g')`: título o prefijo de título **169**, uuid completo **87**, prefijo de 8 **43**, slug kebab-case **23**. El cuarto está documentado desde el 28/07 en [wikilinks.ts:1-27](../../naeth/web/src/lib/wikilinks.ts) |
| 4.1 · Hay 263 wikilinks | Desactualizado | **322**, repartidos en **159** notas |
| 4.1 · Al superseder el destino, el enlace apunta a la versión vieja y quien lo siga leerá historia creyendo que lee lo vigente | **Incorrecto para el visor** | [wikilinks.ts:19-22](../../naeth/web/src/lib/wikilinks.ts) no resuelve un uuid que no esté en el árbol de vigentes, a propósito y documentado. El enlace **no navega**: se queda como texto. El síntoma real es enlace **muerto**, no enlace rancio. Medido: **25 de 87** uuid apuntan a fila superada o retirada, y **10 de 43** prefijos de 8 no resuelven, o sea **35 enlaces muertos de 322** (10,9%). Para un agente sí es medio cierto: `memory_get` de un id superado devuelve el contenido viejo, pero acompañado de `is_current: false` y de la cadena ([mcp_server.py:271](../../naeth/app/mcp_server.py)) |
| 4.2 · Hay 5 vigentes con `product: claude-code` y `surface: web`, modelo `opus-4-8` | **Confirmado** | `core.authors()` y SQL directo |
| 4.2 · No están fechadas y la atribución no es concluyente entre el incidente del 08-11/08 y la duplicación del 25/08 | **Refutado, y las dos hipótesis con él** | Las cinco son del **23/07/2026, entre las 17:02 y las 17:04**, todas en `research-harness/*`. Y sobre las **760 filas del historial completo**, no hay ninguna otra: `SELECT ... FROM memory.memory WHERE author_product='claude-code' AND author_surface='web'` devuelve esas 5 y nada más. **El conflicto no está en curso**: cero casos en 36 días, incluidos los dos episodios que se le atribuían |
| 4.3 · `memory_search` siempre devuelve k resultados y nunca dice que no hay nada | **Confirmado** | `ORDER BY score DESC LIMIT %(k)s`, sin umbral ni corte ([core.py:258](../../naeth/app/core.py)) |
| 4.4 · No existe ritual de lectura | **Confirmado** | Mismo listado de skills que arriba |

### Sección 5 · Lo descartado

| Afirmación | Veredicto | Evidencia |
|---|---|---|
| Campo `state`, `review_after`, chunking, reranker cross-encoder y purga por antigüedad, todos descartados con su motivo | **Decisión ya tomada en Naeth** | `646d2eff-731b-4820-acc8-c58f348d97ee` (`naeth/core`) los registra uno a uno con el mismo razonamiento. Y el de `state` remite al rechazo de la escala de prioridad del 21/07, en `a4b58024` (`naeth/conventions`). **No se rediscuten en este plan** |

### Sección 7 · Lo que el análisis dice no tocar

| Afirmación | Veredicto | Evidencia |
|---|---|---|
| El visor va por su rama (v2.1, Nueva memoria en curso) | Confirmado pero incompleto | Ver el bloque siguiente: hay tres frentes abiertos ahí, no uno |
| El vocabulario de `memory_type` dice tres cosas: cuatro en la convención, seis en el visor, cinco en el corpus | **Confirmado, y hoy son cuatro listas** | Convención: 4 en `CLAUDE.md`. Visor en lectura: 6 en [Memoria.svelte:15](../../naeth/web/src/views/Memoria.svelte) (`learning` y `error`, con cero uso). Corpus: 5, medido hoy (fact 174, observation 142, decision 111, preference 30, **reference 2**). Y el alta sin commitear ofrece **4** ([Nueva.svelte](../../naeth/web/src/views/Nueva.svelte)), así que la cuarta lista nace con esta vista. Registrado en `f815e69a` (`naeth/conventions`) |
| La decisión sobre el conector duplicado es de Eneko y tiene coste real | Confirmado | `bee1b83e-181a-461c-bff1-516bf1e74eeb` (`naeth/authorship`). Se queda fuera del plan por eso mismo |

### Lo que el análisis se dejó fuera y sí está abierto

| Hallazgo | Evidencia |
|---|---|
| **`system_status` mezcla tombstones de memoria y de relación, y cuenta relaciones retiradas como vivas.** Es la causa directa de que las cifras derivadas de la sección 1 salgan mal | [core.py:307-311](../../naeth/app/core.py) |
| **`avg_lag_s` es media histórica de toda la tabla `job`**, no una ventana reciente, así que no responde "cuánto tarda un embedding hoy" | [core.py:313-320](../../naeth/app/core.py) |
| **La rama léxica del híbrido lleva `LIMIT 50` sin `ORDER BY` de nivel superior**, a diferencia de la semántica. Hoy sale bien porque el plan es `Limit → WindowAgg → Sort` (verificado con `EXPLAIN`), pero no lo garantiza el SQL, y meter filtros cambia el plan | [core.py:252-255](../../naeth/app/core.py) |
| **El símbolo de marca no existe en el repositorio.** Búsqueda: `grep -rn "M2 2h3v20H2z" .` excluyendo `docs/handoff` devuelve **cero**. Y [naeth/web/index.html](../../naeth/web/index.html) no declara favicon: son 11 líneas sin un solo `<link rel="icon">` | El símbolo, el wordmark y el lockup están cerrados en Claude Design (rondas 3a, 6a, 7 y 11) y en `f808491b` (`naeth/brand`), que además deja anotado "PENDIENTE: color y lockup", ya resueltos en el handoff |
| **El handoff de lenguaje de movimiento sigue sin aplicar.** Búsqueda: `grep -rn "prefers-reduced-motion" naeth/web/src/` devuelve **cero** | [design_handoff_lenguaje_movimiento/README.md](../../naeth/web/design_handoff_lenguaje_movimiento/README.md), sin versionar. Las tres transiciones que documenta existen y están escritas a mano: [Sidebar.svelte:142](../../naeth/web/src/components/Sidebar.svelte), [:167](../../naeth/web/src/components/Sidebar.svelte), [Estado.svelte:169](../../naeth/web/src/views/Estado.svelte) |
| **El alta de memoria está construida, verde y sin desplegar.** `npm test` da 73/73 y `npm run check` da 460 ficheros, 0 errores, 0 warnings, medidos hoy sobre el working tree | `Nueva.svelte` (399 líneas), `wikipick.ts` (71) y `wikipick.test.ts` (127), todos sin versionar, más el diff de `App.svelte`, `api.ts`, `Milkdown.svelte` y `Memoria.svelte` |
| **El README del visor sigue diciendo que Nueva memoria es un stub** | Tabla "Alcance" en [naeth/web/README.md](../../naeth/web/README.md) |
| **`.pen` está borrado sin commitear desde el 22/08**, y su borrado quedó explícitamente fuera de aquel commit | `git status` y la sub-fase F8 de [visor-v2-cierre.md](visor-v2-cierre.md) |
| **150 de 459 vigentes (33%) no tienen ninguna relación**, ni entrante ni saliente. Dato nuevo, sin juicio: es material para el modo higiene, no un defecto por sí mismo | Consulta con `NOT EXISTS` sobre `memory.relation` |

---

## Las fases

Cada fase cierra con despliegue en **los dos nodos** y su tag, según lo decidido: el tag se pone al
desplegar, y un arreglo que no llega a la máquina no existe (`9b58ac60`). Ninguna fase necesita a la
siguiente para cerrarse.

⚠ Recordatorio que gobierna las cuatro: en este PC `npm run build` escribe en `web/dist`, que está
bind-mounteado, así que **compilar es desplegar**. En `finally` hace falta además `up.sh --build`,
porque allí el visor sale de la imagen. Y tocar cualquier `.py` de `naeth/app/` dispara el reload:
hay que comprobar el **8801**, no el 8800 (`46abd771`).

### Fase 1 · El alta de memoria sale a producción

Cierra lo que ya está construido y verde en el working tree desde el 23/08. Es la única fase cuyo
trabajo mayoritario ya está hecho.

| Tarea | Sesiones |
|---|---|
| 1.1 · Aplicar las dos decisiones de producto en `Nueva.svelte`: selector de ruta (plano o agrupado) y lista de tipos que se ofrece | 1 |
| 1.2 · Alinear el vocabulario de `memory_type` en los tres sitios que hoy discrepan: convención, `Memoria.svelte:15` y `Nueva.svelte`. Incluye decidir qué pasa con las 2 `reference` | 1 |
| 1.3 · Actualizar la tabla "Alcance" del README del visor y resolver `.pen` | 0,5 |
| 1.4 · Commit, `npm run build`, despliegue en PC y en `finally`, tag `2.2026.08.2` | 0,5 |

**Entregable verificable.** Crear una memoria de verdad desde `naeth-visor.enraxk.dev` en el móvil, con
ruta, tipo, tags y un wikilink, y comprobar que llega entera. Más: `npm test` y `npm run check` en
verde, `curl -s http://127.0.0.1:8801/ | grep -c 'assets/index-'` distinto del hash anterior, y
`git describe --tags` dando lo mismo en los dos nodos.

### Fase 2 · La marca y el movimiento entran en el visor

Los dos handoffs de diseño que llevan semanas en disco sin aplicar. Van juntos porque comparten
fichero (`app.css`), verificación (los dos temas, los dos tamaños) y despliegue.

| Tarea | Sesiones |
|---|---|
| 2.1 · Los tres SVG canónicos versionados en el repo (símbolo 24×24, wordmark, lockup 99×24), con `fill="currentColor"` y `<title>`, tal y como salen del handoff | 0,5 |
| 2.2 · Favicon en `index.html` (hoy no hay ninguno) y el lockup donde toque en el chrome del visor | 1 |
| 2.3 · Tokens de movimiento en `app.css` (`--t-fast`, `--t-mid`, `--t-slow`, `--t-over`), las tres sustituciones sin cambio visible, el popover de búsqueda y `prefers-reduced-motion` | 1 |
| 2.4 · El símbolo en el README de la raíz, y despliegue en los dos nodos con tag | 0,5 |

**Entregable verificable.** El favicon se ve en la pestaña en los dos temas. El lockup se lee a 24 px de
alto, que es su suelo declarado. Las tres transiciones siguen igual a ojo tras tokenizarlas. Con
`prefers-reduced-motion` emulado en el navegador: el chevron no gira, la barra salta a su cifra y el
popover conserva el fundido pero pierde subida y rebasamiento. Contraste: 14,71:1 en claro y 13,31:1
en oscuro, que es lo que declara la hoja de color y coincide con los tokens que ya usa el visor.

### Fase 3 · Camino de lectura, la parte aditiva

Los pasos 1 a 3 del análisis, más el arreglo de la instrumentación que hizo que sus cifras salieran
mal. No rompe ningún contrato: todo son parámetros opcionales y una tool nueva.

| Tarea | Sesiones |
|---|---|
| 3.1 · Filtros en `memory_search`: `path_prefix`, `tags`, `memory_type`, `since`, `is_current`. Filtrando antes de rankear, dentro de las dos CTE | 1 |
| 3.2 · `memory_stats`, modo recuento (path, subtema, tipo, tag, autor, mes) | 1 |
| 3.3 · `memory_stats`, modo higiene: sin título, sin tags, path fuera de taxonomía, longitud de cadenas, huérfanas, wikilinks que no resuelven | 1 |
| 3.4 · Arreglar `system_status`: tombstones separados por tipo, relaciones vivas descontando las retiradas, y `avg_lag_s` con ventana | 0,5 |
| 3.5 · La rama léxica: `ORDER BY` explícito antes del `LIMIT 50`, y comprobar que una fila sin embedding no se cae del corte | 0,5 |
| 3.6 · Suite de pytest, despliegue en los dos nodos con tag | 0,5 |

⚠ **La tarea 3.5 no es el "fallback léxico" del análisis, porque ese ya existe.** Lo que falta es
garantizar el corte, no añadir la pasada. Ver la fila correspondiente de la auditoría.

**Entregable verificable.** `memory_stats` reproduce a mano las cifras de esta auditoría: 459 vigentes,
282 superadas, 20 tombstones de memoria y 4 de relación, 452 relaciones vivas, 81 rutas, 26 proyectos,
las **dos** sin título (`14134724` y `f94961e3`), 150 huérfanas y **35 wikilinks que no resuelven de
322**. Si no encuentra esos números, está mal. Y tres consultas que hoy fallan, repetidas con y sin
filtro, con la nota esperada subiendo a las tres primeras posiciones.

### Fase 4 · El digest

El trabajo grande, y el único que rompe contrato. Va al final a propósito: los pasos anteriores son los
que dan los datos para decidir cómo hacer este.

| Tarea | Sesiones |
|---|---|
| 4.1 · Columna `digest` con tope duro, migración, y el parámetro en las **dos** tools que escriben contenido (`memory_add` y `memory_supersede`), no en cinco | 1 |
| 4.2 · `memory_search` deja de devolver `content` y pasa a devolver `path`, `created_at` y `digest` | 0,5 |
| 4.3 · Backfill revisado de las 459 vigentes, por tandas y por proyecto, con aprobación como cualquier otra escritura. **Nunca una pasada de LLM sin revisión**: la trampa de las notas que llevan dentro su versión refutada está confirmada con tres ejemplos | 4 |
| 4.4 · `NaethPersist` en sus **dos** copias (local y claude.ai, que divergen a mano, `ff25bbd6`) y el visor | 1 |
| 4.5 · Despliegue en los dos nodos con tag | 0,5 |

**Entregable verificable.** Rehacer el informe de estado del 28/08 con las tools nuevas y medir el
contexto consumido. Si no baja al menos un orden de magnitud respecto a las 40.000 palabras de aquel
día, el cambio no ha valido y hay que decirlo.

**Total estimado: unas 17 sesiones**, repartidas 3 / 3 / 4,5 / 7.

---

## Descartado de este plan

| Idea | Por qué no entra |
|---|---|
| **Migrar los 322 wikilinks a forma canónica `[[uuid\|texto]]`** con resolución al head de la cadena | Abre frente nuevo: forma canónica, validador en escritura y migración de 322 enlaces en 159 notas. La fase 3 entrega el **instrumento** (el modo higiene los cuenta), y la decisión se toma con los 35 muertos delante en vez de con una impresión |
| **`surface_conflict: true` en el servidor** | Refutado por la auditoría: son 5 filas, todas del 23/07 entre las 17:02 y las 17:04, y **cero en las 760 del historial desde entonces**. Sería un contador para algo que no está pasando |
| **Suelo de score para decir "no tengo nada de esto"** | Frente nuevo, y además el calibrado necesita el reparto de scores que hoy no se mide. Después de los filtros, que cambian esa distribución entera |
| **Ritual de lectura ("retomo X")** | Frente nuevo, y vive en las skills, no en este repo. Además la fase 3 le quita la mitad del trabajo: con filtros, traer `proyecto/status` es una llamada |
| **`role="tree"` completo con roving tabindex** | Cuesta como una vista entera, y así está anotado desde el 22/08 (`ba209da7`). Retirar el atributo mentiroso ya se hizo; lo que queda es construir, no cerrar |
| **Vista Grafo** | La pieza grande, y la única con decisiones de producto sin tomar. No cierra nada empezado |
| **Vista Ajustes** | Mismo motivo. El tema ya se cambia desde el rail, así que el stub no bloquea a nadie |
| **D9, el chunk de 664 kB** | Optimización, no cierre. Y el propio plan del 22/08 dice medirlo con el túnel de por medio, o sea que ni siquiera está claro que sea un problema |
| **Retirar el conector de cuenta duplicado** | Decisión de Eneko con coste real (deja sin Naeth a claude.ai y a la app de escritorio) y se toca en `claude.ai/settings/connectors`, no en el repo. `bee1b83e` |
| **Campo `state`, `review_after`, chunking, reranker y purga por antigüedad** | Ya descartados en Naeth con su motivo (`646d2eff`, `a4b58024`). No se rediscuten |
| **H3 y H5 de la auditoría de seguridad de CENIT** | Son de otro proyecto y otro repositorio (`fc3cd0fa`). H5 además es de Eneko |

---

## Decisiones que necesito de Eneko antes de empezar

1. **El selector de ruta de la vista de alta: plano o agrupado.** Bloquea la tarea 1.1. Los datos
   medidos hoy: **81 rutas** sobre 26 proyectos, cola muy larga, **30 rutas con una sola memoria**, y las
   diez primeras cubren cerca de la mitad del corpus. Plano son 81 opciones; agrupado deja las raras
   escondidas detrás de un despliegue. Registrado como decisión abierta en `f815e69a`.

2. **El vocabulario de `memory_type`.** Bloquea la tarea 1.2. Hoy hay **cuatro listas distintas**: la
   convención dice 4, `Memoria.svelte` ofrece 6, el corpus usa 5 y el alta nueva ofrece 4. Las opciones
   son cerrar en 4 y migrar las **2** memorias de `reference`, o adoptar `reference` como quinto tipo.
   En los dos casos, `learning` y `error` salen del visor: tienen **cero usos en 459 memorias**.

3. **Dónde va la marca en el visor.** Bloquea la tarea 2.2. El favicon no admite discusión, porque hoy
   no hay ninguno. Lo que sí la admite: si el lockup sustituye al texto "Naeth · visor" en la cabecera,
   si el símbolo solo va en el rail, o si el visor se queda como está y la marca solo entra por la
   pestaña y el README.

4. **El `.pen` borrado.** Bloquea la tarea 1.3. Se commitea el borrado o se restaura. Lleva pendiente
   desde el 22/08, cuando se dejó fuera de aquel commit a propósito.

5. **El contrato del digest en la fase 4.** Si el parámetro nace **obligatorio** en `memory_add` y
   `memory_supersede` desde el primer día (y entonces toda escritura desde cualquier cliente falla hasta
   que la skill esté actualizada en sus dos copias), o si nace opcional y se endurece después, como se
   hizo con `agent_model` y `AUTHORSHIP_ENFORCE=strict`.

---

## Lo que no se pudo contrastar

- **El "gotcha 2 del `userPreferences`"** que cita la sección 3.3. Ese bloque vive en claude.ai y no es
  legible desde aquí. Lo que sí está confirmado es que la regla del retardo de indexado existe y se
  considera vigente (`ff25bbd6`).
- **La curva de vigentes** (237 el 21/07, 284 el 28/07, 411 el 22/08). Son instantáneas que no quedaron
  guardadas; solo se puede comprobar el punto de hoy.
- **Los 5 casos de conflicto de superficie del 23/07** se sabe **cuándo** ocurrieron, pero no **por qué**.
  Fueron tres minutos, dos días después de que entrara la autoría del Paso 10, y no se han repetido. No
  se ha investigado la causa porque el plan ya no depende de ella.

---

*Naeth · plan de fases · 28/08/2026. Auditoría contra el repositorio, contra la base viva y contra Naeth.*
