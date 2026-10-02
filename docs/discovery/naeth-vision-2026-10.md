# Naeth a futuro: visión y arquitectura, medida

**Abierto el 02/10/2026. En curso: sub-fase 2.1.** Paso 2 de 3 de la visión de Naeth (Naeth
`7724e0d5`): (1) entrevista, hecha el 02/10; (2) este documento; (3) Agora revisa sus conclusiones
(sección 8). Después, un roadmap por horizontes sustituye a
[`../plan/roadmap-producto-2026-09-09.md`](../plan/roadmap-producto-2026-09-09.md) y a
[`../plan/mapa.md`](../plan/mapa.md).

**Horas de las medidas.** Las de la sesión 1 se tomaron entre las 14:00 y las 14:11 del 02/10/2026 según el reloj de la sesión; una primera versión de este anexo traía horas sueltas de 14:10 a 14:30 escritas a ojo, sin reloj, y se corrigieron.

**Regla de auditoría.** Toda afirmación no trivial lleva una marca: `[M#]` medida (comando, fecha y
salida en el anexo R), `[fichero:línea]`, `[S#]` fuente web (URL y fecha en el anexo S),
`[estimación: base]` o `⚠ sin verificar`. Lo que no tiene marca no entra. Mientras dura, el motor
de CDA está quieto (sub-fases 3 a 11 del plan de CDA) y producción no se toca: los experimentos van
en worktrees y la base de producción solo se lee.

---

## 0. Conclusiones

*Se escribe al final.*

## 1. Qué se pregunta y qué no

**El problema**, en palabras de la entrevista del 02/10/2026: Naeth se diseñó para guardar notas y
hoy le duelen cuatro cosas: cómo se ve (una copia de Obsidian), que solo entran notas, lo que
cuestan los dos nodos en cada cambio, y lo que cuesta encontrar y releer. Y la visión cambió:

- **Una biblioteca con todo el conocimiento**: notas, código y ficheros.
- **Un producto para otros.**
- **Naeth absorbiendo a CENIT**, que hoy lo aloja como módulo `memory`.

**Lo único inamovible**: que sea **agnóstico del cliente IA**, con entrada por MCP desde cualquier
cliente.

**Pasa a analizarse, aunque hasta el 02/10 funcionaba como ley**: que la instancia de Eneko sea el
producto (09/09), ADD-only, y que lo de cliente no salga de la máquina.

**A investigar y medir**: qué parte de CENIT absorbe Naeth; dónde corre para otros (autoalojado,
app de escritorio, alojado por Eneko); y las cuatro acepciones de "abierto": tipos de contenido
enchufables, formatos abiertos, abierto a otros clientes y plugins, y fuentes externas.

**Criterio de éxito de este documento**: (1) cada decisión de un solo sentido con opciones, coste
medido, qué cierra y una recomendación; (2) el mercado; (3) pruebas reales en el sistema; (4)
horizontes con el primer entregable de "ahora"; (5) la estética entera.

**Lo que este documento NO hace**: rediseñar lo que CDA ya decidió (se cita), ni arreglar
problemas vivos de producción (se usan como dato). El problema vivo del liderazgo entre nodos
(oscilación diaria desde el 22/09) va en una tarea aparte.

## 2. Lo que hay, medido

*Sub-fase 2.1 A, medido el 02/10/2026. Falta M10 (coste de embeber), que va con el experimento.*

**El corpus es pequeño y crece a unas 250 notas al mes.**
- 1.141 filas, de las que 678 están vigentes, 442 superadas y 26 retiradas; 646 relaciones [M2].
- 29 proyectos y 96 paths; un 37% de las vigentes (251) son `fact` [M3].
- Desde junio entran entre 266 y 404 filas al mes, y de 180 a 237 siguen vigentes [M6]. A ese
  ritmo, unas 3.000 vigentes al cabo de un año (la idea I-P del mapa ya lo decía, sin medir).

**Una nota es corta, y cabe entera en casi cualquier ventana.**
- Mediana de 2.260 caracteres, p95 de 5.673, máximo 36.266 [M5].
- Todo el schema `memory` ocupa 31 MB: 29 MB la tabla `memory` (con TOAST), 6,6 MB el índice de
  texto y 5,5 MB el HNSW [M4].

**ADD-only cuesta casi la mitad del texto.**
- Las 463 filas que ya no son vigentes guardan 1.529 KB de contenido, frente a 1.702 KB de las
  678 vigentes: el 47% del texto guardado es historia [M7].
- A esta escala no pesa (MB, no GB). Con ficheros dentro, la proporción importaría.

**La salud del corpus**, que mide el dolor "encontrar y releer" [M3]:
- 228 notas sin ninguna relación (el 34% de las vigentes) y 41 wikilinks rotos.
- La cadena de versiones más larga es el status de Naeth, con 32; la de Yogin tiene 28.
- 677 de 678 con digest; 2 sin título y 1 sin tags.

**La búsqueda es rápida, y casi todo su tiempo es embeber la consulta** [M8].
- Híbrida (léxica más semántica): p50 de 74 ms y p95 de 105 ms, en el loopback.
- Solo léxica: p50 de 6 ms. La diferencia, unos 68 ms, es pasar la consulta por e5-large.

**El visor carga el corpus entero de una vez** [M9].
- `/api/tree` pesa 202 KB para 678 notas: unos 300 bytes por nota, en 18 ms.
- `/api/graph` pesa 116 KB (678 nodos, 611 aristas, 227 enlaces), en 47 ms.
- Proyección lineal ⚠ sin verificar: a 10.000 elementos, unos 3 MB de árbol; a 100.000, unos
  30 MB. Una biblioteca "de todo" (fragmentos de PDF, bloques de código) llega a esas cifras
  mucho antes que las notas.

**La pila en reposo ocupa unos 3,8 GB, y casi todo son dos copias del modelo** [M13].
- `naeth-viewer` 1,6 GB y `naeth-worker` 1,8 GB: cada uno carga e5-large por su cuenta.
- `naeth-api` 135 MB, `modules-db` 123 MB y el resto de CENIT (Caddy, cloudflared, oauth2-proxy,
  Pocket-ID y su base, lanhealth) unos 200 MB.
- Para una app de escritorio, el modelo de embeddings es el problema, no Postgres.

**Los dos nodos se llevan la mayor parte del trabajo manual de CENIT** [M11].
- Desde el 17/07: 303 commits en CENIT, de los que 202 son automáticos de ownership y 101 manuales.
- De esos 101, 45 tocan el multi-nodo; en líneas, 7.028 del multi-nodo frente a 4.467 del resto
  (61%). ⚠ El filtro incluye todo `core/ops`, también el backup, y los documentos del paso 8, así
  que el 61% es un techo.
- En Naeth, 18 de 220 commits desde el 17/07 hablan de nodos, failover o sync.

**El failover funciona; lo que falla es la cesión ordenada al apagar** [M12].
- Del 22/09 al 02/10, 10 TAKEOVER del vigía de finally, prácticamente uno por día de uso del PC,
  cada uno seguido de "finally cede" y "local recupera" al arrancar.
- Leído en hora local (finally firma en UTC), la cesión y la recuperación caen en el mismo segundo:
  no hay hueco sin escritor.
- La causa está registrada: el hook de apagado del PC no corre desde el 14/08 (0xC0000142,
  `CENIT/core/ops/failover-status.ps1:122-128`), así que el PC se apaga sin ceder y el vigía hace lo
  que debe. El coste real es que lo escrito en los últimos minutos antes de apagar (hasta 5, lo que
  tarda CENIT-Sync) no está en finally mientras manda.
- Incidentes anteriores con horas, según el código de CENIT: 30/07, 5 h sin servicio por el
  discovery del IdP; 15/08, 11 h de 502 y 25 h con la API caída; 16/08, un TAKEOVER falso al
  arrancar el PC por Wi-Fi; del 09/09 al 21/09, árbitro divergido con escritura doble
  (`CENIT/core/reconciler/src/cenit_core/ownership.py:194-202`, commit `19e1618`).

**El visor de hoy** [M14]: seis vistas (inicio, nota, grafo, nueva, estado y ajustes) con el mismo
esqueleto: árbol de ficheros a la izquierda, buscador arriba, barra de iconos a la derecha, tema
oscuro, panel de relaciones con mini grafo en la nota, y grafo de fuerzas. Es el esqueleto de
Obsidian. Las capturas no entran en el repo (es público y salen títulos de notas de clientes);
quedan descritas aquí y se usan en A1.

**Lo que la exploración del 02/10 ya dejó medido en el código** (no se repite):
- Un tipo nuevo dentro de `memory` toca unas 30 a 70 líneas; con tablas propias, entre 970 y 1.900
  [estimación: mapa de piezas de la exploración del 02/10, sin medir; la mide el experimento].
- `relation`, `attachment` y `job` tienen FK solo a `memory` (`naeth/db/schema.sql:82-83,95,112`);
  `tombstone.target_kind` solo admite 'memory' y 'relation' (`schema.sql:72`); `attachment` existe
  y nadie la escribe ni la lee.
- En `core.py`, 29 sentencias SQL en 13 funciones tocan `memory` o `memory_current`. El roadmap
  del 09/09 decía 31; no se reproduce.
- `sync.py` aborta ante una tabla sin clasificar
  (`CENIT/core/reconciler/src/cenit_core/sync.py:332-346`), funde por `id` con reglas globales por
  nombre de columna (`sync.py:120-126,179-183`) y no tiene regla para `digest`.

## 3. La prueba de punta a punta

*Sub-fase 2.1 B. Hecho: montaje y E1 a E6 (la E4, derivada de la E2, sin construir).*

**El montaje** [M16]: un worktree de Naeth (`F:/src/Naeth-exp`, rama `exp/tipo-nuevo`), una copia
de los datos reales (`pg_dump` del schema `memory` sin las `oauth_*`, 8,3 MB, restaurado en un
Postgres `pgvector:0.8.5-pg17` propio en el 55432) y una API y un worker de la imagen de
producción, con el código del worktree y el modelo copiado a un volumen propio. Nada de esto toca
los contenedores ni la base de producción.

**Naeth arranca sin CENIT** [M16]: la API experimental respondió `/healthz` en unos 2 s sin
`cenit-net`, sin `CENIT_PATH` y sin más secreto que el DSN, y la búsqueda híbrida funcionó sobre la
copia. Lo único que hizo falta fue un Postgres con `vector`, `pg_trgm` y `fuzzystrmatch` (esta
última vive en el schema `memory` y el volcado no la trae) y el `search_path` del rol.

**Embeber cuesta un segundo por fragmento** [M10]: el worker embebió los 49 fragmentos de la E1 en
50,7 s en la CPU, unos 1,03 s cada uno. Re-embeber el corpus de hoy (1.141 filas) serían unos
20 minutos. ⚠ e5-large solo ve los primeros 512 tokens de cada fragmento (medido para el código
en la nota `1f423cc1`), y una página del PDF tiene de media 3.863 caracteres: buena parte de cada
página se queda sin embeber. Trocear un documento es un problema propio, no una fila por página.

**De paso: la caché del modelo no es la que dice el compose** [M17]. El compose monta el volumen
`fastembed_cache` en `/root/.cache/fastembed` "para no re-descargar"
(`naeth/docker-compose.yml:105,159,206`), pero fastembed guarda el modelo en
`/tmp/fastembed_cache` dentro del contenedor: el volumen está vacío y el contenedor del worker
lleva 2,1 GB en `/tmp`, con dos revisiones del modelo (30/08 y 24/09). Sobrevive a un reinicio y
se pierde al recrear el contenedor. Es de la instalación de hoy, no se arregla aquí.

### E1 · Opción A: el PDF y el código como filas de `memory`

Un script de ingesta de 103 líneas y **ningún cambio más**: ni esquema, ni sync, ni tools, ni
visor [M18]. Cada símbolo de primer nivel de `naeth/app/core.py` (24) y cada página con texto de
"Local-first software" (Kleppmann y otros, Ink & Switch, 2019; 25 páginas) entra como una memoria
con `memory_type` `code` o `document` y su origen en `metadata`.

| Medida | Resultado |
|---|---|
| Ingesta | 24 símbolos en 0,15 s; 25 páginas en 1,67 s [M18] |
| Embeber | 49 fragmentos en 50,7 s [M10] |
| Las 12 consultas de notas | recall@5 de 12/12, igual que antes; **ningún fragmento en su top 10** (0 de 120) [M19] |
| 2 consultas sobre el PDF | 2/2, la página buena en primer puesto [M19] |
| 2 consultas sobre el código | **0/2**: "cómo funde la búsqueda híbrida los rangos con RRF" devuelve notas sobre búsqueda híbrida y no `search`; "consulta SQL que devuelve las aristas del grafo" devuelve `_top`, no `graph_edges` [M19] |
| Visor | 49 nodos más en el árbol (727), +10 KB (unos 210 bytes por fragmento); en el grafo, 49 nodos sin ninguna arista [M18] |
| Digest | Mecánico: primera frase del docstring y arranque de la página. Uno escrito de verdad sería una llamada a un modelo por fragmento |

**Lo que dice la E1**:
1. **Meter un tipo dentro de `memory` cuesta casi nada y no estropea las notas**, a esta escala:
   49 fragmentos frente a 678 notas.
2. **Encontrar código no sale gratis.** Con el código tal cual (en inglés) y las consultas en
   castellano, el código no aparece. Es la razón del plan de CDA para embeber la documentación y
   la firma, y la prueba de que un tipo nuevo necesita su forma de trocear y de describir, se
   guarde donde se guarde.
3. **Lo que la opción A no da**: fragmentos que se agrupen en su libro (el PDF son 25 nodos
   sueltos sin aristas), versiones de un fichero que cambia (aquí cada versión sería una memoria
   nueva sin relación con la anterior), y el fichero mismo (solo entra el texto). Es lo que miden
   E2 y E3.

### E2 · Opción C2: un núcleo genérico `item` en paralelo a `memory`

Tres tablas nuevas y ninguna tocada: `item` (la obra: un fichero, un módulo), `item_part` (sus
fragmentos, con texto, `tsv` y embedding calculado en la ingesta, sin pasar por la cola `job`) y
`blob` (el fichero original, en disco por su sha256). La búsqueda funde por RRF notas y partes
sacando 50 candidatos de cada tabla por rama, para que cada una use su índice. Además, dos cambios
salidos de E1: del código se embeben nombre, firma y docstring en vez del cuerpo, y el PDF se
trocea en partes de unos 1.200 caracteres en vez de una por página [M20].

**Lo que costó, por capa** [M21] (líneas añadidas / quitadas en el worktree):

| Capa | Ficheros | Líneas |
|---|---|---|
| Esquema | `db/migrations/007-item-exp.sql` (más su copia en `schema.sql` para los tests: 45) | 60 |
| Ingesta (PDF y código, con blob y embedding) | `app/ingest_c.py` | 158 |
| Núcleo: búsqueda conjunta, `item_get`, items en el árbol | `app/core.py` | 86 / 2 |
| Tools MCP y rutas: `include_items` en `memory_search`, tool `item_get`, `/api/items/{id}`, `/api/search?items=1` | `app/mcp_server.py` | 46 / 3 |
| Visor: ruta `#/i/<id>`, lector mínimo, `openNode` en los 5 sitios que abrían un nodo como nota | 10 ficheros de `web/src` | 102 / 8 |
| Tests: 3 de backend, 1 de front, la tabla en la limpieza | `test_items.py`, `open.test.ts`, `conftest.py` | 84 / 1 |
| **Total** | 18 ficheros | **unas 536 líneas** (581 con la copia del esquema) |

Suite completa en verde: 75 tests de backend con `test.sh` (los 72 de antes y 3 nuevos), 273 de
front y `npm run check` sin errores [M21]. El tiempo de reloj del experimento fue de unos 12
minutos, de las 17:10 a las 17:22. ⚠ Es tiempo de Claude escribiendo, no de una persona: sirve para
comparar capas entre sí, no para estimar horas de trabajo humano.

**Lo que midió** [M20, M22]:

| Medida | E1 (dentro de `memory`) | E2 (núcleo `item`) |
|---|---|---|
| Recall@5 de las 12 consultas de notas | 12/12 | 12/12 |
| Fragmentos nuevos en el top 10 de esas consultas | 0 de 120 (49 fragmentos) | 2 de 120 (121 partes) |
| Consultas sobre el PDF | 2/2 | 2/2 |
| Consultas sobre el código | 0/2 | 1/2: `search` sale en 2.º; "las aristas del grafo" sigue sin `graph_edges` |
| Latencia de la búsqueda (p50 / p95) | 74 / 105 ms (producción, sin items) | 73 / 83 ms, buscando en las dos tablas |
| Nodos que añade al árbol | 49 sueltos, sin aristas | **2**: un nodo por fichero |
| Ingesta con embedding | 0,15 s + 1,67 s, y la cola tarda 50,7 s | 21,9 s el código y 78,7 s el PDF (97 partes), con el embedding dentro |
| `tools/list` del MCP | sin cambios (8.993 bytes, 10 tools) | 9.617 bytes, 11 tools: **+624 bytes, un 7%** |

**Lo que dice la E2**:
1. **El núcleo genérico cuesta unas 540 líneas para el primer tipo, la mitad o menos que la
   estimación de una tabla por tipo (970 a 1.900).** Y casi todo es fontanería que no se repite:
   el esquema, la búsqueda conjunta, el lector y `openNode` valen para cualquier tipo. Un tipo
   nuevo encima solo necesita su ingestor (aquí unas 80 líneas por tipo) y, si quiere, su lector.
2. **La obra como unidad es lo que necesita una biblioteca**: el PDF es un nodo y un libro, no 25
   ni 97 fragmentos sueltos.
3. **Trocear bien importa más que dónde se guarda**: partes de 1.200 caracteres y embeber el
   docstring con la firma subieron el código de 0/2 a 1/2 sin tocar el modelo.
4. **Buscar en dos tablas no cuesta nada que se note** a esta escala.

**Lo que la E2 NO cubrió, y queda abierto** (va a E3, E5 o a las decisiones):
- Relaciones entre una nota y un item: `relation` sigue con FK solo a `memory` (D2, E3).
- El sync entre nodos de las tres tablas nuevas y de los ficheros en disco (E5).
- Versiones de un fichero que cambia: `item` tiene `is_current` pero no hay supersesión.
- Autoría y digest obligatorios: la ingesta escribe directamente, sin pasar por las tools que los
  exigen.
- Filtros (path, tags, tipo, fecha) en la búsqueda conjunta: `search` los tiene, `search_all` no.
- Retirar un item (`tombstone` solo admite 'memory' y 'relation').
- Aristas de los items en el grafo: salen como nodos sueltos.

**Dos datos de paso** [M23]:
- **Editar en el bind mount desde Windows no recarga el contenedor.** El `--reload` de uvicorn no
  vio los cambios del worktree y hubo que reiniciar la API experimental. La afirmación de la
  exploración del 02/10 de que "editar en el checkout principal es desplegar" vale para finally
  (Linux); en el PC, con Docker Desktop, el cambio no entra hasta reiniciar. ⚠ Sin probar en el
  checkout principal, a propósito.
- La nota sin tags "Revisar el siguiente video" (`4880680b`) se cuela en consultas que no tienen
  nada que ver (primera en "cuatro agentes revisaron el documento de cobro"): un excerpt corto y
  genérico compite bien en la rama léxica.

### E3 · Opción C1: la nota pasa a ser un tipo de `item`

Solo SQL, sobre `exp3`, un clon de la copia con las tablas de la E2 ya dentro, y en dos tramos
para separar lo que cuesta cada paso [M24]:

- **C1a, identidad compartida**: cada nota tiene su fila en `item` con el mismo id (`kind` `note`,
  su `memory_type` en una columna `subtype`), y las FK de `relation`, `supersession`, `attachment`
  y `job` pasan a apuntar a `item`; `tombstone` admite `item`. `memory` sigue siendo una tabla.
- **C1b, una sola tabla de fragmentos**: el contenido y el embedding de cada nota pasan a
  `item_part` (una parte por nota, con el título de etiqueta para que el `tsv` sea el mismo),
  `memory` se aparta y en su sitio queda una vista con las mismas columnas.

**Lo que costó** [M24]: 31 líneas de SQL útil el tramo C1a y 19 el C1b. La migración tarda 12 ms
en copiar las 1.141 notas a `item` y 1,7 s en copiar su contenido a `item_part`, casi todo
mantenimiento de los índices HNSW y de texto.

**Cuánto código sigue funcionando sin tocarlo** [M25]. Se fotografió la salida de 43 lecturas de
`core.py` (11 funciones más las búsquedas léxica e híbrida de las 16 consultas) antes de migrar,
y se comparó después. Una pasada de control sin migrar dio 43 de 43 iguales.

| | Lecturas iguales | Lo que cambia |
|---|---|---|
| Tras C1a | 42 de 43 | `tree`, pero solo por el código de la E2: lista los items y ahora las notas también lo son (le falta `kind <> 'note'`) |
| Tras C1b | 41 de 43 | además, las muestras de `stats(hygiene)`: los totales son iguales, pero esas consultas llevan `LIMIT` sin `ORDER BY` y qué filas salen dependía del orden físico de la tabla. Es un defecto de producción, no de C1 |

En el código de producción hay 33 sentencias SQL que tocan `memory` o `memory_current`: 30 en
`core.py` (contadas por el árbol de sintaxis; la exploración decía 29), 2 en `worker.py` y 1 en
`mcp_server.py`. De ellas, 5 escriben [M25]:

- **Con C1a cambian 4, las 4 escrituras de `core.py`**: los dos INSERT de `add` y `supersede`
  tienen que crear antes la fila de `item` (sin ella, la FK lo impide: `ForeignKeyViolation`), y
  los dos UPDATE de `is_current` tienen que mantener también el de `item`. Ninguna lectura cambia,
  y el UPDATE del embedding del worker sigue valiendo.
- **Con C1b cambian las 5**: una vista con JOIN no admite escrituras ("cannot update view"), así
  que todo lo que escribe pasa a escribir en `item` e `item_part`, o hace falta un trigger
  INSTEAD OF por operación. Las 28 lecturas siguen funcionando a través de la vista.
- **Una relación entre una nota y un PDF entra sin más** en cuanto existe C1a: es la FK a `item`.
  Lo que la E2 dejó abierto para D2 se resuelve con el primer tramo.

**Lo que midió en la búsqueda** [M26], solo la base y con los 16 vectores de consulta ya
calculados (la API añade unos 70 ms de embeber la consulta, que no cambian):

| Búsqueda | p50 / p95 | Top 5 |
|---|---|---|
| Notas, antes de migrar (el SQL de hoy) | 4,1 / 5,4 ms | los puestos de la M19 |
| Notas y partes en dos tablas (la E2) | 3,7 / 5,2 ms | |
| Notas por la vista de compatibilidad (C1b) | 3,4 / 4,8 ms | idéntico al de antes en las 16 |
| Todo en una sola tabla de fragmentos (C1b) | 2,6 / 3,8 ms | idéntico al de la E2 en las 16 |

A esta escala no hay diferencia que importe: son 1.262 filas y el planificador las lee todas en
cualquiera de las formas. Lo que importa es qué pasa cuando sean 100.000, y eso lo dice el plan
[M27]: **por la vista de compatibilidad el HNSW no se puede usar** ni forzándolo; en la tabla
única, sí.

**De paso, y es de producción** [M27]: **la búsqueda de hoy tampoco puede usar su índice HNSW.**
El índice es parcial (`WHERE embedding IS NOT NULL AND is_current`, `naeth/db/schema.sql:169-171`) y la
búsqueda no filtra por `is_current`: va sobre `memory_current` a propósito
(`naeth/app/core.py:387`). Postgres solo usa un índice parcial si la consulta implica su
predicado, así que los 5,5 MB del índice [M4] no se usan nunca y cada búsqueda ordena todas las
notas vigentes. Con `AND is_current` añadido, el plan sí puede bajar al HNSW. En la copia, la caché
`is_current` coincide con `memory_current` en las 678 vigentes, así que añadirlo no cambia ningún
resultado. Hoy no se nota (4 ms); con decenas de miles de fragmentos, sí. No se arregla aquí.

**Lo que dice la E3**:
1. **C1a es barato y resuelve las relaciones entre tipos**: 31 líneas de SQL, 4 escrituras que
   cambian y ninguna lectura. Es el paso que hace que una nota y un PDF se puedan enlazar, versionar
   y retirar con la misma maquinaria.
2. **C1b simplifica la búsqueda, pero la vista de compatibilidad es una trampa**: deja las lecturas
   funcionando el primer día y en cambio les quita el índice. Si se va a C1b, las búsquedas
   tienen que ir a `item_part` directamente, no a través de `memory`.
3. **La búsqueda en una sola tabla sale más corta que la de la E2**: unas 20 líneas frente a unas
   40, y sin la mezcla de dos ramas por tabla. Pero el código de la E2 que lee `item` deja de valer
   tal cual: `tree` y la búsqueda conjunta contarían dos veces las notas.

### E4 · Opción B, tablas propias por tipo: derivada, no construida

No se construyó: se deriva de las capas que midió la E2, que ya metió dos tipos (documento y
código) [M21]. Todo lo de esta sección es [estimación: tabla de capas de la E2 y del anexo X].

**Lo que cuesta cada tipo nuevo en cada opción**, por capa:

| Capa | C2 o C1 (núcleo genérico) | B (tablas por tipo) |
|---|---|---|
| Esquema | nada | la obra y sus partes con sus índices: unas 25 líneas |
| Ingesta | su ingestor: unas 80 (la E2 hizo dos en 158) | igual, unas 80 |
| Búsqueda | nada: el tipo entra solo en la tabla de partes | dos ramas más (semántica y léxica) y su cruce en la fusión: unas 11 |
| Leer la obra, árbol | nada (`item_get`, `tree` ya sirven) | su `get` y su rama del árbol: unas 17 |
| MCP | nada, o un valor más de `kind` | su tool o su caso: unas 20 |
| Visor | nada si sirve el lector genérico; si no, su lector | su ruta y su lector: unas 50 |
| Tests | los del ingestor: unos 30 | los de cada capa: unos 40 |
| Sync | nada (las tablas ya están clasificadas) | clasificar dos tablas más: 2 |
| **Por tipo** | **unas 110, o 160 con lector propio** | **unas 245** |

La fontanería común se paga una vez en C2 (las 378 líneas de la E2 que no son sus dos
ingestores: 536 menos 158) y ninguna en B. Así que B sale más barato con pocos tipos, y C2 a partir
del tercero (si los tipos usan el lector genérico) o del quinto (si cada uno trae el suyo): con
3 tipos, B unas 735 y C2 entre 708 y 858; con 6, B unas 1.470 y C2 entre 1.038 y 1.338. La estimación de la exploración (970 a 1.900 para un solo tipo con tablas propias)
contaba además un `job` y un worker por tipo; la E2 mostró que se pueden evitar embebiendo en la
ingesta, y por eso aquí B sale por debajo.

**Lo que las líneas no cuentan, y decide más**: con tablas por tipo, una relación de una nota a un
PDF no puede tener FK (Postgres no tiene FK a "una de estas tablas"). O se pierde la integridad
(`target_kind` y un id sin FK), o se pone una tabla común de identidades, que es exactamente C1a.
**B necesita C1a en cuanto haya relaciones entre tipos**, y la E3 midió que C1a es lo barato
(31 líneas de SQL y 4 escrituras).

### E5 · El sync entre nodos con las tablas nuevas

El handoff real de CENIT (`cenit_core.handoff.run_handoff`, con el COPY por streaming y el merge
de `sync.py`) entre dos Postgres efímeros, cargados los dos con la copia de la E2 y después
divergidos a propósito [M28]. El código de CENIT corre desde un worktree (`F:/src/CENIT-exp`, rama
`exp/tipo-nuevo`, sin subir).

**Lo que pasó, en orden** [M29]:
1. **Con el `sync.py` de hoy, el handoff no arranca**: "el schema tiene tablas sin clasificar:
   blob, item, item_part". Es lo que debe hacer (`sync.py:332-346`): una tabla nueva obliga a
   decidir cómo viaja.
2. **Clasificadas como tablas de unión, falla `blob`, y arrastra a las otras dos.** `merge_sql` da
   por hecho que la clave es `id` (`ON CONFLICT ("id")`) y la de `blob` es su sha256; sin el blob,
   la FK rechaza el item nuevo, y sin el item, sus partes. **Y el destino queda a medias**: cada
   tabla va en su propia transacción, así que las notas y las supersesiones sí pasaron y los items
   no. El informe lo dice ("CON ERRORES"), pero nada lo deshace.
3. **Con la clave declarada por tabla, el handoff sale bien en los dos sentidos**, unos 20 s cada
   uno con 8 tablas: casi todo es arrancar `docker exec` y `psql` para cada paso, no mover datos.
4. **Converge todo lo que es de solo añadir o muta en un sentido**: notas, blobs, relaciones,
   supersesiones y tombstones salen idénticos en los dos nodos. En las partes también: la parte
   que llegó sin vector a los dos nodos y que solo embebió B tiene vector en ambos, y el código que
   A retiró tiene 0 de 24 partes vigentes en ambos. Las reglas de `is_current` (AND) y de
   `embedding` (COALESCE) se aplicaron a `item_part` sin tocarlas, porque son **por nombre de
   columna**: cómodo, y también una trampa, porque cualquier tabla futura con una columna así se
   lleva esa semántica sin que nadie la haya decidido.
5. **Lo que muta sin regla no converge**: B renombró el PDF y, tras sincronizar en los dos
   sentidos, cada nodo conserva su título (la fila local manda, `sync.py:163-165`). Hoy las notas
   no tienen este problema porque no se editan: se superan. Un item que se edite necesita lo
   mismo, versiones por supersesión, o una regla.
6. **Es idempotente**: repetir el handoff deja las huellas de las 7 tablas idénticas.
7. **Los ficheros no viajan.** El handoff mueve filas de Postgres y el store OAuth del módulo
   (un `tar` por streaming), nada más. El blob llega como fila y el fichero se queda en el nodo
   que lo ingirió. Como los blobs se nombran por su contenido, la unión es trivial (mismo nombre,
   mismo contenido) y el mismo patrón del `tar` serviría [estimación: `sync.py:316-329`, sin
   probar].
8. **La red de los embeddings huérfanos solo mira `memory`**
   (`enqueue_missing_embeddings_sql`, `sync.py:367-394`): una parte que llegue sin vector no se
   encola nunca. En la E2 no pasa porque el vector se calcula en la ingesta, pero si una ingesta
   se corta a medias, esas partes quedan invisibles para la búsqueda semántica sin aviso.

**Lo que costó en CENIT** [M29]: 5 líneas de código en `sync.py` (las tres tablas en el orden de
sus FK, un diccionario `PRIMARY_KEYS` y la línea que lo usa), más 2 tests. La suite del
reconciliador, 274 de 274 en verde.

**Lo que dice la E5**:
1. **El diseño del sync aguanta un tipo nuevo casi gratis** si sus tablas son de solo añadir y
   sus mutaciones van en un solo sentido. El coste real está en lo que no cumple eso: la edición
   (5) y los ficheros (7).
2. **Un handoff que falla a mitad deja el destino inconsistente** (2). Con más tablas con FK
   entre sí, eso pasa de molestia a riesgo: va a D3.
3. Todo esto es para mantener dos nodos. Si D3 elige un solo nodo, los puntos 2, 5 y 7 dejan de
   ser problemas del sync y se quedan solo en el backup.

### E6 · Un dueño por fila y RLS

Sobre `exp6`, un clon de la copia con las tablas de la E2: una columna `owner_id` en las ocho
tablas de contenido, con el valor por defecto tomado de un parámetro de sesión (`naeth.owner`),
RLS activada y forzada, y una política por tabla [M30]. Todo lo que ya existía queda de Eneko.
Después, una copia del corpus entero para un segundo dueño: 2.282 notas, la mitad de cada uno.

**Cuatro cosas que no se ven en el diseño y salen al probarlo** [M30, M31]:
1. **Hoy la RLS no serviría de nada: Naeth entra como superusuario.** En producción la API se
   conecta como `cenit`, con `rolsuper` y `rolbypassrls` activados, y un superusuario se salta la
   RLS siempre, también con `FORCE`. Hace falta un rol propio de la aplicación (5 líneas), y el
   invariante de CENIT de dejar el nodo que no manda en solo lectura por rol (`sync.py:56-72`)
   pasaría a ese rol.
2. **La vista `memory_current` se salta la RLS aunque el rol no lo haga**: sin dueño de sesión,
   la tabla devuelve 0 filas y la vista 678, porque una vista consulta con los permisos de su
   dueño. Toda la búsqueda pasa por esa vista. Se arregla con `security_invoker` en las tres
   vistas (3 líneas, Postgres 15 o posterior).
3. **La política escrita de la forma obvia cuesta un 38%**: con `current_setting(...)` evaluado en
   cada fila, la búsqueda pasa de 9,8 a 13,6 ms con el mismo número de filas. Con el dueño en una
   subconsulta, que se evalúa una vez por consulta, el coste baja a unos 0,8 ms (de 0,4 a 1,2 en
   tres vueltas) [M32].
4. **Dos fugas entre dueños que la RLS no cubre**: una relación desde una nota del dueño 2 hacia
   una nota de Eneko entra (la comprobación de una FK no pasa por la RLS), y con un id inventado
   falla, así que sirve para saber si un id existe en otro dueño; y guardar un fichero con el mismo
   sha256 que uno de Eneko choca con su clave aunque el dueño 2 no vea ningún blob, lo que dice
   que alguien lo tiene y además le impide guardar el suyo. Las dos se cierran metiendo el dueño
   en las claves (`(owner_id, sha256)` y FK compuestas), que ya es un cambio de esquema de verdad.

**Lo que no cambia** [M31]: conectando como el rol nuevo con el dueño Eneko, las 43 lecturas de
`core.py` dan lo mismo que antes de cualquier cambio, salvo `get`, que con su `SELECT *` devuelve
además `owner_id` (y las muestras empatadas de `stats(hygiene)`, que ya bailaban en la E3). Las 12
consultas de notas, en el puesto 1 o 2 como siempre. El dueño 2 ve sus 1.141 filas y ninguna de
Eneko; leer una nota de Eneko por su id devuelve nada. **Ninguna sentencia SQL del código cambia**:
el valor por defecto de `owner_id` sale del parámetro de sesión, y la RLS filtra sola.

**Lo que sí cambia, fuera del SQL**:
- Algo tiene que fijar el dueño en cada conexión. Con un solo dueño basta una variable de entorno
  (`PGOPTIONS`, como en estas pruebas, sin una línea de código); con varios, un sitio en
  `core.conn()` que lo fije por petición, y eso exige saber quién llama: identidad (D5).
- **El worker se rompe en silencio**: sin dueño de sesión no ve ninguna nota, y su código marca
  como hechos, con el error "memory ausente", los trabajos cuya nota no encuentra
  (`naeth/app/worker.py:139-143`). Las notas se quedarían sin embedding y sin aviso. Necesita un
  rol que se salte la RLS o recorrer los dueños.
- El sync de CENIT entra como `cenit` y se salta la RLS, que aquí es lo correcto: mueve las filas
  de todos los dueños.

**Lo que dice la E6**: la RLS de Postgres da el multiusuario casi gratis en código (0 sentencias)
y en latencia (menos de 1 ms con la política bien escrita), pero solo después de pagar tres
cosas que hoy no están: un rol que no sea superusuario, vistas que respeten la RLS y claves que
incluyan al dueño. Y el día que haya más de un dueño, cada proceso de fondo (worker, sync,
backup) tiene que decidir explícitamente si ve a todos o a uno.

## 4. El mercado

*Sub-fase 2.2.*

## 5. Las decisiones de un solo sentido

*Sub-fase 2.3: D1 a D13.*

## 6. La estética entera

*Sub-fase 2.4: A1 a A7.*

## 7. Horizontes

*Sub-fase 2.5.*

## 8. Lo decidido y lo abierto

*Cierre: las afirmaciones C1 a Cn para Agora.*

---

## Anexo R · Registro de medidas

Cada medida: id, fecha y hora, comando exacto, salida (resumida si es larga) y dónde se usa.

**M1 · Qué nodo manda** (02/10/2026, entre las 14:00 y las 14:11). Lectura de `core/state/ownership.yaml` local y de
`origin/main` sin hacer fetch, más el rol de Postgres local:

```
cat F:/src/CENIT/core/state/ownership.yaml            -> epoch: 201, owner: local
git -C F:/src/CENIT show origin/main:core/state/ownership.yaml  -> epoch: 201, owner: local
git log -1 -- core/state/ownership.yaml               -> 0395273 2026-10-02 09:47 "local recupera el mando al arrancar (epoch 201)"
docker exec cenit-data-modules-db-1 psql -U cenit -d cenit -t -A -c "select case when 'default_transaction_read_only=on' = any(rolconfig) then 'SI' else 'no' end from pg_roles where rolname='cenit'"  -> no
```

Manda el PC y su base admite escritura: las medidas sobre la base local son las de la copia que
manda. No se ejecutó `core/ops/failover-status.ps1` entero porque descifra secretos, llama al
reconciler y entra por SSH en finally; para esta medida bastaba la parte local.

**M2 · Recuentos y cola** (02/10, entre las 14:00 y las 14:11). Tool MCP `system_status`: 1.141 filas, 678 vigentes,
442 superadas, 646 relaciones, 26 tombstones (4 de relación); cola vacía, 1.184 hechos, retraso
medio 6,1 s; e5-large, 1024 dimensiones.

**M3 · Reparto e higiene** (02/10, entre las 14:00 y las 14:11). `memory_stats` en modo `counts` y `hygiene`: 29
proyectos, 96 paths; por tipo 251 fact, 213 observation, 176 decision, 38 preference; 798 tags
distintos; 228 vigentes sin relación, 41 wikilinks rotos, 2 sin título, 1 sin tags, 1 sin digest;
cadenas de 32 (status de Naeth), 28, 14, 12 y 10 versiones.

**M4 a M7 · Disco, tamaño, crecimiento y peso muerto** (02/10, entre las 14:00 y las 14:11). Todas con
`docker exec -e PGOPTIONS="-c default_transaction_read_only=on" cenit-data-modules-db-1 psql -U cenit -d cenit -At -c "<consulta>"`:

```
M4  pg_total_relation_size por relación de memory: memory 29 MB, memory_tsv_gin 6,6 MB,
    memory_embedding_hnsw 5,5 MB, oauth_token 448 kB, _emdash_backup 328 kB, relation 248 kB,
    job 232 kB, supersession 200 kB; total de tablas del schema 31 MB
M5  length(content) en memory_current: n 678, p50 2.260, p95 5.673, p99 7.802, máx 36.266, media 2.570
M6  por mes (filas, vigentes hoy, KB de content): 06 84/33/138, 07 362/207/904, 08 404/237/1.353,
    09 266/180/777, 10 25/21/59
M7  por is_current: f 463 filas, 5,6 MB por pg_column_size, 1.529 KB de content;
    t 678 filas, 7,3 MB, 1.702 KB
```

**M8 · Latencia de búsqueda** (02/10, entre las 14:00 y las 14:11). Script en Python con `urllib` contra
`http://127.0.0.1:8801/api/search?q=<q>&k=10&semantic=<true|false>`, 10 consultas reales
repetidas 2 veces por modo, tras una de calentamiento: híbrida p50 74 ms, p95 105, máx 107; léxica
p50 6 ms, p95 27, máx 29.

**M9 · Peso del árbol y del grafo** (02/10, entre las 14:00 y las 14:11). 5 GET a cada ruta del mismo puerto:
`/api/tree` 202.120 bytes, 678 filas, p50 18 ms; `/api/graph` 115.905 bytes, 678 nodos, 611
aristas, 227 enlaces, p50 47 ms.

**M10 · Coste de embeber** (02/10, sesión 2). Se aplazó de la sesión 1 porque obligaba a cargar
una segunda copia de e5-large en un contenedor de producción. Medida en el worker experimental
sobre la tabla `job` de la copia:
`select ..., extract(epoch from max(finished_at)-min(started_at)) from memory.job j join memory.memory m on m.id=j.memory_id where m.source_client='exp:ingest'`
da 49 trabajos en 50,7 s (24 de código, 1.546 caracteres de media; 25 de PDF, 3.863).

**M11 · Coste de los dos nodos** (02/10, entre las 14:00 y las 14:11). En `F:/src/CENIT`:
`git log --since=2026-07-17` da 303 commits, 101 sin "ownership/epoch" en el asunto; `--numstat`
de esos 101 separando las rutas `sync.py|handoff|ownership|watchdog|recovery|identity_sync|core/ops/|test_(...)|paso8|runbook-multinodo|core/state`:
7.028 líneas frente a 4.467; 45 de los 101 tocan esos ficheros. En `F:/src/Naeth`: 220 commits
desde el 17/07, 18 con "finally|failover|nodo|sync|read-only|handoff|mirror" en el asunto.

**M12 · Liderazgo desde el 22/09** (02/10, entre las 14:00 y las 14:11). `git log --since=2026-09-22 -- core/state/ownership.yaml`
agrupado por día: 10 TAKEOVER, 11 cesiones y 11 recuperaciones del 22/09 al 02/10. Con
`--date=format-local`, cada "finally cede" y su "local recupera" llevan el mismo minuto (finally
firma en UTC). Incidentes anteriores tomados del código de CENIT en la exploración del 02/10
(`config.yaml:40-50,69-73`, `ownership.py:194-202`, `naeth/docker-compose.yml:63-71`, commits
`19e1618` y `b1bef0f`).

**M13 · Huella en reposo** (02/10, entre las 14:00 y las 14:11). `docker stats --no-stream`: naeth-worker 1,775 GiB,
naeth-viewer 1,592 GiB, cenit-identity-pocket-id-db 147 MiB, naeth-api 135 MiB, modules-db
123 MiB, cloudflared 18 MiB, pocket-id 13 MiB, lanhealth 11 MiB, caddy 11 MiB, oauth2-proxy 6 MiB.

**M16 · Montaje y arranque sin CENIT** (02/10, sesión 2). Comandos:

```
git -C F:/src/Naeth worktree add F:/src/Naeth-exp -b exp/tipo-nuevo
docker network create naeth-exp-net
docker run -d --name naeth-exp-db --network naeth-exp-net -p 127.0.0.1:55432:5432 -e POSTGRES_USER=cenit -e POSTGRES_PASSWORD=exp -e POSTGRES_DB=cenit pgvector/pgvector:0.8.5-pg17
docker exec cenit-data-modules-db-1 pg_dump -U cenit -d cenit -n memory --exclude-table='memory.oauth_*' -Fc > <scratchpad>/memory.dump   (8.305.436 bytes)
psql: create extension vector; create extension pg_trgm; alter role cenit set search_path = memory, public;
pg_restore --no-owner < memory.dump ; create extension fuzzystrmatch schema memory
-> 1.141 filas, 678 vigentes, 1.141 con embedding, 650 relaciones (646 vivas y 4 retiradas)
docker exec naeth-worker-1 tar -C /tmp -cf - fastembed_cache | docker run -i --rm -v naeth_exp_fastembed:/to ... tar -C /to -xf -
docker run -d --name naeth-exp-api --network naeth-exp-net -p 127.0.0.1:8810:8000 -v F:/src/Naeth-exp/naeth/app:/srv/app -v naeth_exp_fastembed:/tmp -e NAETH_DSN=postgresql://cenit:exp@naeth-exp-db:5432/cenit -e OAUTH_ENABLED=0 ... naeth-api:latest uvicorn app.api:app ...
-> /healthz 200 en unos 2 s; /api/search en modo hybrid sobre la copia
```

**M17 · Dónde vive el modelo de embeddings** (02/10, sesión 2). `docker exec naeth-worker-1`:
`ls /root/.cache/fastembed` vacío; `du -sh /tmp` 2,1 GB; `find / -name model.onnx` da dos
snapshots en `/tmp/fastembed_cache/models--qdrant--multilingual-e5-large-onnx/` (directorios del
30/08 y del 24/09); `docker inspect`: contenedor creado el 30/08, arrancado el 02/10 a las 07:46
UTC.

**M18 · E1, ingesta y peso** (02/10, sesión 2). `docker exec -w /srv naeth-exp-api python -m
app.ingest_a code /srv/app/core.py naeth` da 24 memorias en 0,15 s; con `pdf /tmp/local-first.pdf
research`, 25 en 1,67 s. `git diff --numstat` en el worktree: `103 0 naeth/app/ingest_a.py`, nada
más. `/api/tree` en el 8810: 212.492 bytes y 727 filas; `/api/graph`: 727 nodos, 611 aristas.

**M19 · E1, búsqueda** (02/10, sesión 2). Las 12 consultas de notas aprobadas por Eneko (anexo
Q, Q1) contra `/api/search?k=10` del 8810: recall@5 de 12/12 (puestos 2, 1, 1, 1, 1, 2, 1, 1, 1,
1, 1, 2, los mismos que antes de la ingesta) y 0 fragmentos `code` o `document` en los 120
resultados. Consultas nuevas: "los siete ideales del software local-first", página 1 en primer
puesto; "CRDT para fusionar cambios sin conflictos", página 16 en primer puesto; "cómo funde la
búsqueda híbrida los rangos con RRF", ningún fragmento de código entre los 5 primeros; "consulta
SQL que devuelve las aristas del grafo", `core.py · _top` en tercer puesto, que no es la función.

**M20 · E2, ingesta** (02/10, 17:10 a 17:13). Migración `007-item-exp.sql` aplicada solo a
`naeth-exp-db`. `docker exec -w /srv naeth-exp-api python -m app.ingest_c code /srv/app/core.py
naeth` da 1 item con 24 partes en 21,9 s; con `pdf /tmp/local-first.pdf research`, 1 item con 97
partes en 78,7 s. Partes: código media 1.546 caracteres; PDF media 995, máximo 1.197. 2 blobs,
4.688.862 bytes. Los 49 fragmentos de la E1 se borraron de la copia antes de medir la E2.

**M21 · E2, líneas y tests** (02/10, 17:22). `git diff --numstat` en el worktree tras
`git add -N` de los ficheros nuevos (tabla de la sección 3; detalle en el anexo X).
`bash ./test.sh -q` en `F:/src/Naeth-exp/naeth`: 75 passed en 178 s. En `naeth/web`:
`npm test` 14 ficheros, 273 tests; `npm run check` 491 ficheros, 0 errores. Comprobado en el
navegador sobre la API experimental (8810, sirviendo el `dist` del worktree): pulsar `core.py` en
el árbol lleva a `#/i/<id>` con 24 partes; `#/i/<id del PDF>` muestra sus 97 partes; sin errores en
consola.

**M22 · E2, búsqueda y MCP** (02/10, 17:15 a 17:17). Las 12 consultas de notas y las 4 nuevas
contra `/api/search?items=1&k=10` del 8810: recall@5 de 12/12 (mismos puestos que antes), 2 partes
en los 120 resultados (las dos en "deep-research no sirve para preguntas de mercado"); PDF 2/2;
código: "RRF" da `search` en 2.º, "aristas del grafo" da `_filters` en 1.º; latencia p50 73 ms,
p95 83 ms sobre las 16 consultas. `tools/list` por HTTP (`toolslist.py`, en `docs/discovery/exp-2026-10/` de la rama `exp/tipo-nuevo`:
`initialize` y `tools/list` contra `http://127.0.0.1:8810/mcp`): antes 10 tools y 8.993 bytes,
después 11 tools y 9.617 bytes.

**M23 · El `--reload` no ve el bind mount de Windows** (02/10, 17:15). Tras editar
`app/mcp_server.py` en el worktree, `tools/list` del 8810 seguía dando 10 tools; tras
`docker restart naeth-exp-api`, 11.

Nota a la M22, del 02/10 a las 17:59: con partes de unos 1.200 caracteres, "la página buena" deja
de ser una sola. El 2/2 del PDF se juzgó por contenido (la primera parte responde a la pregunta:
"página 2 · 5" define el software local-first y "página 15 · 4" explica cómo funde un CRDT). Con
el criterio estricto de la E1, la página exacta, salen en los puestos 4 (página 1) y 7 (página 16).

**M24 · E3, migración** (02/10, 17:58 a 18:02). `pg_dump -Fc cenit` y `pg_restore` a una base
`exp3` en `naeth-exp-db` (1.141 notas, 121 partes de la E2, 650 filas de `relation`). Los dos
tramos con `psql -v ON_ERROR_STOP=1` y `\timing`: `e3-c1a.sql` (39 líneas, 31 sin comentarios ni
vacías) con el INSERT de 1.141 filas a `item` en 12,4 ms y los ALTER de las FK entre 0,3 y 2,2 ms;
`e3-c1b.sql` (30 líneas, 19 útiles) con el INSERT de 1.141 partes en 1.711,6 ms. Los dos ficheros
en `docs/discovery/exp-2026-10/` de la rama `exp/tipo-nuevo`, con el resto de scripts del experimento.

**M25 · E3, lecturas y escrituras** (02/10, 17:59 a 18:01). `snapshot.py` en `naeth-exp-worker`
contra `exp3`: 43 llamadas a `core` (`get` de una cadena y de una nota suelta, `relation_list`,
`tree`, `graph_edges`, `graph_links`, `graph_knn`, `stats` en `counts` y `hygiene`, `authors`,
`status`, y `search` léxica e híbrida con las 16 consultas), salida en JSON comparada con la de
antes. Control sin migrar 43/43; tras C1a 42/43 (`tree`); tras C1b 41/43 (`tree` y las muestras
de `stats(hygiene)`, con los totales iguales). Recuento de sentencias: script con `ast` sobre
`core.py`, `worker.py` y `mcp_server.py` de producción, cadenas con SELECT, INSERT, UPDATE o WITH
que nombran `memory` o `memory_current`, sin docstrings y uniendo los trozos de una misma
f-string: 30, 2 y 1. Escrituras: `core.add` tras C1a da `ForeignKeyViolation` en
`memory_id_fkey`; tras C1b, `UPDATE memory SET embedding` y `UPDATE memory SET is_current` dan
"cannot update view memory"; un INSERT de `relation` de una nota al PDF entra (las tres dentro de
una transacción deshecha).

**M26 · E3, latencia en la base** (02/10, 18:00 y 18:01). `bench.py` en `naeth-exp-worker` contra
`exp3`: los 16 vectores de consulta, calculados una vez con `embed_query` en la CPU del worker
(11,5 s los 16), en una tabla `q`; por variante, una pasada de calentamiento que guarda el top 10
y 5 pasadas medidas (80 ejecuciones). Antes de migrar: solo notas p50 4,1 / p95 5,4 ms, la de la
E2 3,7 / 5,2. Tras C1b: el SQL de hoy por la vista 3,4 / 4,8, la tabla única 2,6 / 3,8. Puestos de
las 12 consultas de notas: 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2 en todas las variantes.

**M27 · Planes del HNSW** (02/10, 18:02 y 18:03). `EXPLAIN (costs off)` de la rama semántica con
el vector como literal. Con los parámetros por defecto, las tres formas leen la tabla entera
(`Seq Scan` y `Sort`). Con `enable_seqscan=off`: la tabla única baja a `Index Scan using
item_part_embedding_hnsw`; la vista de compatibilidad no (`Bitmap Heap Scan` sobre
`item_part_item_idx` y `Sort`). En la copia sin migrar (base `cenit`), `memory_current` tampoco lo
usa, ni con `enable_seqscan=off` ni con `enable_sort=off`; añadiendo `AND is_current`, con los dos
apagados, el plan es `Index Scan using memory_embedding_hnsw` bajo dos `Nested Loop Anti Join`.
Coherencia de la caché: 0 filas de `memory_current` con `is_current` falso y 0 filas con
`is_current` verdadero fuera de `memory_current`, de 678.

**M28 · E5, montaje** (02/10, 18:06 a 18:08). `git -C F:/src/CENIT worktree add F:/src/CENIT-exp
-b exp/tipo-nuevo` (en `0395273`); `ownership.py` solo empuja su propia rama (`git push origin
<rama>`), así que la rama nueva no sale. Dos contenedores `pgvector/pgvector:0.8.5-pg17`,
`naeth-exp-a` (55433) y `naeth-exp-b` (55434), con `pg_restore` del `pg_dump -Fc` de la base
`cenit` de `naeth-exp-db` (la copia con las tablas de la E2: 1.141 notas, 2 blobs, 2 items,
121 partes) y `ALTER ROLE cenit SET search_path`. En los dos, una parte con id fijo y sin vector;
después `e5-a.sql` (un PDF nuevo con su blob y 3 partes, la supersesión de `e72cf4ae`, retirar el
item de código y sus 24 partes) y `e5-b.sql` (una nota con una relación, un código nuevo con su
blob y 1 parte, el vector de la parte pendiente, y renombrar el PDF de la E2).

**M29 · E5, handoff** (02/10, 18:08 a 18:13). `e5.py` (en la misma carpeta de la rama) llama a
`run_handoff(Node("a", "naeth-exp-a"), Node("b", "naeth-exp-b"), SubprocessExecutor())` importando
`cenit_core` del worktree. Con el `sync.py` de `main`: `SyncError` en el preflight por `blob,
item, item_part`. Con las tres en `MERGE_TABLES`: `column "id" does not exist` en `blob`, y FK
violadas en `item` (`item_blob_sha256_fkey`) y en `item_part` (`item_part_item_id_fkey`); `memory`
1.142 a 1.143 y `supersession` 442 a 443 en el destino. Con `PRIMARY_KEYS = {"blob": "sha256"}`:
A a B en 20,1 s y B a A en 20,3 s, los dos OK. Huellas (`e5check.py`: recuento y md5 del contenido
sin columnas generadas, ordenado): `memory` 1.143, `blob` 4, `relation` 651, `supersession` 443 y
`tombstone` 30, iguales en los dos nodos; `item` distinto solo en el título del PDF renombrado;
`item_part` distinto solo en el `created_at` de la parte pendiente, insertada por separado en cada
nodo con 0,34 s de diferencia (artefacto del montaje). Repetir A a B (20,2 s): las 7 huellas,
idénticas. Suite del reconciliador en el worktree (`uv run --group dev pytest -q`): 274 passed,
con 2 tests nuevos; antes de copiar al worktree el `core/generated/Caddyfile.modules` (generado e
ignorado por git) fallaba `test_el_visor_tiene_ingress_en_los_dos_nodos`, por el entorno.

**M30 · E6, migración y roles** (02/10, 18:13 a 18:15). `createdb exp6` y `pg_restore` del mismo
volcado que `exp3` (con las tablas de la E2). `e6.sql` (23 líneas, 18 útiles): con `SET
naeth.owner` al dueño de Eneko, en `memory`, `relation`, `supersession`, `tombstone`,
`attachment`, `item`, `item_part` y `blob`: `owner_id uuid NOT NULL DEFAULT
current_setting('naeth.owner')::uuid`, `ENABLE` y `FORCE ROW LEVEL SECURITY` y una política
`owner_only` (USING y WITH CHECK); 7,5 ms el bloque y 250 ms el ANALYZE. Primera prueba como
`cenit`: 678 vigentes sin dueño de sesión. Producción, solo lectura: `select rolsuper,
rolbypassrls from pg_roles where rolname = current_user` da `t|t`, y el DSN de `naeth-api-1` usa
`cenit`. `e6-role.sql`: rol `naeth_app` (LOGIN, NOSUPERUSER, NOBYPASSRLS, SELECT, INSERT y UPDATE
en el schema, `search_path`), 5 líneas. Como `naeth_app` sin dueño: la tabla `memory` 0 filas y
`memory_current` 678; tras `ALTER VIEW ... SET (security_invoker = true)` en `memory_current`,
`_map` y `_map2`: 0 sin dueño y 678 con Eneko (por `PGOPTIONS="-c naeth.owner=..."`). Copia
para el dueño 2: `INSERT ... SELECT` de las 1.141 filas con ids nuevos, 1,27 s.

**M31 · E6, lecturas y aislamiento** (02/10, 18:15 y 18:16). `snapshot.py` como `naeth_app`
con el dueño Eneko contra `exp6`, comparado con la instantánea de la M25 (antes de cualquier
migración): 40 de 43 iguales; `get` de la cadena y de la nota, distintos solo por `owner_id` en
la nota y en la supersesión; `stats(hygiene)`, distinto solo en el orden de las cadenas
empatadas (las de 10, 7 y 6 versiones). Como dueño 2: 1.141 filas de `memory`, 0 de otro dueño;
la nota `e72cf4ae` de Eneko, 0 filas. En transacciones deshechas: INSERT de una relación del
dueño 2 hacia `e72cf4ae`, entra; hacia un id inexistente, `relation_target_id_fkey`; INSERT de un
blob con el sha256 de uno de Eneko, `duplicate key value violates unique constraint
"blob_pkey"`, con 0 blobs visibles para el dueño 2.

**M32 · E6, latencia** (02/10, 18:16 y 18:17). `bench.py`, variante de notas, p50 en ms, con
conexiones alternadas. Primera política, con `current_setting` por fila: base sin RLS en la base
`cenit` (1.141 filas) 9,9 y 9,6; `cenit` sobre `exp6` (2.282 filas, se salta la RLS) 9,6 y 10,0;
`naeth_app` con Eneko sobre `exp6` 13,5 y 13,7. Política con el dueño en subconsulta: sin RLS
9,6, 9,5 y 9,5; con RLS 10,0, 10,8 y 10,4. ⚠ La carga de la máquina subió durante la sesión: la
misma consulta sin RLS daba 4,1 ms en la M26 y aquí unos 9,6; por eso solo se comparan
pasadas alternadas entre sí.

**M14 · Las vistas de hoy** (02/10, entre las 14:00 y las 14:11). Navegador integrado en `http://127.0.0.1:8801/`,
solo lectura, rutas `#/home`, `#/graph`, `#/m/<id>`, `#/new`, `#/status` y `#/settings`. Capturas
fuera del repo.

## Anexo S · Fuentes

*Sub-fase 2.2.*

## Anexo X · Diffs del experimento

Todo está en dos ramas locales que no se suben: `exp/tipo-nuevo` de Naeth (`d498dfd`, con el
código de E1 y E2 y los scripts y bancos de E3 a E6 en `docs/discovery/exp-2026-10/`) y
`exp/tipo-nuevo` de CENIT (`3302803`, el cambio de `sync.py` de la E5 con sus tests).

**Limpieza al cerrar 2.1** (02/10, 18:19 a 18:21): borrados los contenedores `naeth-exp-api`,
`naeth-exp-worker`, `naeth-exp-db`, `naeth-exp-a` y `naeth-exp-b` con sus volúmenes anónimos, la red
`naeth-exp-net`, el volumen `naeth_exp_fastembed`, los dos worktrees y, del scratchpad de la sesión,
los volcados (`memory.dump`, `e2.dump`), el PDF y los vectores de consulta. `git worktree list` da
solo `main` en los dos repos y `docker ps -a` no tiene ningún `naeth-exp`. Producción, sin
reiniciar: los diez contenedores de Naeth y CENIT, arriba desde hace 9 horas.

| Experimento | Ficheros | Líneas añadidas / quitadas |
|---|---|---|
| E1 | `naeth/app/ingest_a.py` (nuevo) | 103 / 0 |
| E2 | `naeth/db/migrations/007-item-exp.sql` (nuevo) | 60 / 0 |
| E2 | `naeth/db/schema.sql` (copia de la 007 para los tests) | 45 / 0 |
| E2 | `naeth/app/ingest_c.py` (nuevo) | 158 / 0 |
| E2 | `naeth/app/core.py` | 86 / 2 |
| E2 | `naeth/app/mcp_server.py` | 46 / 3 |
| E2 | `naeth/app/tests/test_items.py` (nuevo) y `conftest.py` | 58 / 0 y 1 / 1 |
| E2 | `naeth/web/src/views/Item.svelte` (nuevo) | 54 / 0 |
| E2 | `naeth/web/src/lib/open.ts` (nuevo) y `open.test.ts` (nuevo) | 28 / 0 y 25 / 0 |
| E2 | `App.svelte`, `router.svelte.ts`, `types.ts`, `search.svelte.ts`, `Sidebar.svelte`, `MiniGraph.svelte`, `Graph.svelte`, `graph/Canvas.svelte` | 20 / 8 |
| E3 | `e3-c1a.sql` y `e3-c1b.sql` (solo SQL sobre `exp3`) | 39 y 30 (31 y 19 útiles) |
| E5 | CENIT, worktree `F:/src/CENIT-exp`: `core/reconciler/src/cenit_core/sync.py` | 11 / 0 (5 de código) |
| E5 | CENIT: `core/reconciler/tests/test_sync.py` (2 tests) | 14 / 0 |
| E6 | `e6.sql` y `e6-role.sql` (solo SQL sobre `exp6`) | 23 y 11 (18 y 8 útiles) |

## Anexo Q · Preguntas a Eneko

| Id | Fecha | Pregunta | Respuesta |
|---|---|---|---|
| Q1 | 02/10 | Qué PDF real usar (que no sea de cliente) y si aprueba las consultas de prueba | Uno público: "Local-first software" (Kleppmann y otros, Ink & Switch, 2019, inkandswitch.com, 4,6 MB). Las 12 consultas aprobadas tal cual: em dash `2c5df38a`, producto y CENIT `d91cf6c7`, deep-research `e72cf4ae`, licencia `c8ae08e4`, whisper `73c89873`, visor colgado `f741b79e`, código atómico `6fb343ed`, habitación 3D `1b4dd93e`, poe2-data `921daf83`, atlas `4b664f10`, Tania y Blender `6145849a`, cuatro agentes `f8dfc7af` |
| Q2 | | Si añade o quita algún producto del mercado | |
| Q3 | | Quiénes son los "otros", y cómo encaja con la licencia no comercial | |
| Q4 | | Qué disponibilidad tolera si a cambio desaparecen los dos nodos | |
| Q5 | | Qué es un libro cuando el contenido son notas; si quiere bocetos | |
| Q6 | | Cuántas horas por semana tiene para "Ahora" | |
