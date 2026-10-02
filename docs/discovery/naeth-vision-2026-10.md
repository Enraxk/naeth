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

*Sub-fase 2.2, hecha el 02/10/2026 entre las 18:45 y las 19:00.* Quince fichas completas y tres de
una línea (Q2). Procedimiento por producto, 25 minutos como máximo: `gh api` para licencia, estrellas
y último push [S1]; la documentación, los precios y las páginas de formato y de MCP por WebFetch; el
navegador integrado si la página necesita JavaScript. Cada dato lleva su fuente S (URL y fecha en
el anexo S) o `⚠ no publicado`. Los cinco que ya estaban en el ranking de mayo
([`../../pasos/investigacion.md`](../../pasos/investigacion.md)) se parten de allí y se anota lo
que cambió.

La última línea de cada ficha, "qué copia Naeth y qué evita", es juicio nuestro sobre los datos de
esa ficha y no lleva fuente propia. Las doce columnas de cada ficha están atadas a las decisiones: qué es; tipos de contenido y si son
enchufables (D1, D12); ingesta; formato y exportación (D11); sync y local-first (D3); multiusuario
(D5); dónde corre (D6); MCP y clientes IA (el principio inamovible); licencia y precio; cómo se lee
y navega (estética); salud del proyecto; qué copia Naeth y qué evita.

### Mem0

- **Qué es**: una capa de memoria para agentes. Un LLM extrae "memorias" (hechos cortos) de las
  conversaciones y luego se recuperan por búsqueda. Hay una plataforma en la nube y una librería o
  servidor open source [S3].
- **Tipos de contenido**: texto de conversación e imágenes, que un modelo de visión convierte en
  memorias; el open source no menciona PDF ni documentos [S5]. Tipos enchufables: ⚠ no publicado.
- **Ingesta**: un LLM es obligatorio para extraer; **guarda lo extraído, no el original**
  ("Extracted information is stored as standard memories") [S5].
- **Formato y exportación**: JSON con esquemas Pydantic, solo en la plataforma [S6]. El open source
  guarda en Qdrant o Postgres con pgvector, y el historial en SQLite [S3]; formato portable: ⚠ no
  publicado.
- **Sync y local-first**: no lo hay; librería local o servidor central. ⚠ No publicado.
- **Multiusuario**: por ámbitos de entidad (usuario, agente, ejecución) dentro de un proyecto, con
  "unlimited end users" en todos los planes; SSO y auditoría, solo en Enterprise [S2].
- **Dónde corre**: en su nube; on-prem solo en Enterprise [S2]; el open source, con Postgres y
  pgvector [S3].
- **MCP y clientes IA**: MCP **remoto y alojado** (`mcp.mem0.ai`), con OAuth en el navegador o API
  key para entornos sin navegador, 11 tools; nombra Claude Desktop, Claude Code, Codex, Cursor y VS
  Code, no claude.ai; **solo contra la plataforma, no contra el open source** [S4].
- **Licencia y precio**: Apache-2.0 [S1]. Gratis con 10.000 altas y 1.000 búsquedas al mes; Starter
  19 $; Pro 249 $, que es donde entran el grafo y la consolidación; Enterprise a medida [S2].
- **Cómo se lee**: no está hecho para leerse; es una API para agentes. El panel de la plataforma:
  ⚠ sin ver.
- **Salud**: 66.476 estrellas, último push el 01/10/2026 [S1].
- **Qué copia Naeth**: los ámbitos de entidad como multiusuario ligero (es lo que la E6 hace con
  `owner_id`), y el MCP remoto con OAuth más API key para clientes sin navegador. **Qué evita**:
  quedarse solo con lo que extrae un LLM, que pierde la frase original (Naeth guarda la nota
  entera), y un MCP que solo sirve a la versión de pago.

### Zep y Graphiti

- **Qué es**: Graphiti es un framework open source de grafo de conocimiento **temporal**; Zep es la
  plataforma gestionada encima, con un motor de grafos propio y un grafo por usuario [S8].
- **Tipos de contenido**: "episodios" de texto, JSON o mensajes; ficheros y documentos no se
  mencionan [S8]. **La ontología sí es enchufable**: los tipos de entidad se definen como modelos
  Pydantic [S8].
- **Ingesta**: un LLM extrae entidades y hechos (OpenAI, Anthropic, Gemini, Groq o Azure); una tool
  aparte mete un hecho a mano sin extracción [S9].
- **Formato y exportación**: el grafo vive en Neo4j, FalkorDB o Neptune (Kuzu, en desuso) [S8];
  exportación: ⚠ no publicado.
- **Versiones**: **bi-temporales**: cada hecho tiene ventana de validez y, cuando cambia, el viejo
  se invalida en vez de borrarse, así que se puede consultar cualquier momento pasado [S8].
- **Sync y local-first**: ⚠ no publicado.
- **Multiusuario**: en Graphiti, espacios por `group_id` [S9]; en Zep, grafos por usuario y gestión
  de usuarios incluida [S8], con plazas del MCP contadas por plan [S7].
- **Dónde corre**: Graphiti, donde se quiera con la base de grafos propia; Zep, en su nube, y en la
  VPC del cliente solo en Enterprise [S7]. La página de precios ya no menciona ninguna edición
  self-hosted de Zep [S7].
- **MCP y clientes IA**: el de Graphiti va por HTTP (`localhost:8000/mcp/`) o stdio, con 13 tools, y
  **sin autenticación propia** [S9]; nombra Claude Desktop y Cursor [S9].
- **Licencia y precio**: Apache-2.0 los dos repos [S1]. Zep: gratis con 10.000 créditos al mes, Flex
  125 $, Flex Plus 375 $, Enterprise a medida; SOC 2 e HIPAA, solo en Enterprise [S7].
- **Cómo se lee**: como grafo; FalkorDB trae una interfaz web propia [S9]. Para leer documentos: no
  está pensado.
- **Salud**: Graphiti 31.381 estrellas (unas 24.000 en mayo) y Zep 4.946; los dos con push el 01 o
  el 02/10 [S1].
- **Qué copia Naeth**: la **validez temporal** de un hecho (Naeth sabe qué nota sustituye a cuál,
  pero no desde cuándo deja de ser verdad); la ontología enchufable como modelo para tipos de
  contenido (D12); la trazabilidad de episodio a hechos, que es la de obra a partes de la E2.
  **Qué evita**: un LLM obligatorio para meter nada y un servidor de grafos de dependencia; un MCP
  sin autenticación.

### Letta

- **Qué es**: una plataforma de agentes con estado (antes MemGPT): el agente gestiona su propia
  memoria y la conserva entre conversaciones [S12].
- **Tipos de contenido**: la memoria del agente, en Markdown; documentos y PDF dentro de esa
  memoria: ⚠ no publicado [S10]. Tipos enchufables: no aplica.
- **Ingesta**: la escribe el propio agente, o una persona editando los ficheros [S10].
- **Formato y exportación**: **ficheros Markdown con frontmatter YAML en un repositorio git de
  verdad** (MemFS), con un `MEMORY.md` de índice: "Each memory except a `MEMORY.md` index is
  projected as Markdown with YAML frontmatter" [S10]. Se edita con herramientas normales y cada
  cambio es un commit [S10].
- **Sync y local-first**: por git: en local el repo está en la máquina, en la nube lo aloja Letta, y
  lo editado vale "everywhere" al hacer push; los conflictos los resuelve git [S10].
- **Multiusuario**: equipos con permisos (Teams Pro, 20 $ por plaza) y, en Enterprise, roles y SSO
  SAML u OIDC [S11].
- **Dónde corre**: en su nube o en un servidor propio, que su documentación explica ("Run a Letta
  agent runtime for local and remote SDK sessions") [S13]; la página de precios no lo menciona [S11].
- **MCP y clientes IA**: es cliente MCP de las herramientas que use el agente, y además ofrece un MCP
  alojado (`api.letta.com/mcp`) con 6 tools para crear agentes y hablar con ellos. **Solo con bearer
  token: "OAuth-only clients are not supported yet"**, así que claude.ai no entra; nombra Cursor, VS
  Code y Claude Code [S12].
- **Licencia y precio**: Apache-2.0 [S1]. Gratis con 3 agentes, Pro 20 $, API 20 $ más 0,10 $ por
  agente activo, Teams Pro 20 $ por plaza, Enterprise a medida [S11].
- **Cómo se lee**: como ficheros, con cualquier editor [S10]; o hablando con el agente [S12].
- **Salud**: 25.003 estrellas (unas 17.000 en mayo); el último push al servidor es del 10/09/2026,
  tres semanas antes que el resto [S1].
- **Qué copia Naeth**: **el formato**: Markdown con frontmatter en un repo git es exactamente "lo
  abierto" de D11, y es casi la forma de la memoria nativa de Claude Code (un `MEMORY.md` de índice
  más un fichero por nota). Versionar con git da historial y resolución de conflictos sin construir
  nada. **Qué evita**: un MCP que deja fuera a los clientes que solo hablan OAuth.

### Basic Memory

- **Qué es**: notas en Markdown que escriben a la vez la IA y la persona, con un índice para buscar
  y un MCP delante. Es **el producto más parecido a Naeth de toda la lista** [S14, S15].
- **Tipos de contenido**: notas; dentro de cada una, "observaciones" y enlaces wiki que forman el
  grafo [S15]. Documentos y PDF: no los menciona [S14]. Tipos enchufables: ⚠ no publicado.
- **Ingesta**: la escribe la IA por MCP o la persona en su editor; sin LLM en medio [S15].
- **Formato y exportación**: **Markdown plano con frontmatter y enlaces wiki**, más un índice en
  SQLite o Postgres; exportar es copiar los ficheros, que salen iguales, en el mismo formato y
  con los mismos enlaces [S15].
- **Sync y local-first**: lo local funciona sin red; la nube sincroniza en los dos sentidos con
  rclone y resolución de conflictos, y se puede llevar a la nube un proyecto y dejar otro en local
  [S15]. En local, el sync entre máquinas es a mano (git, Syncthing) [S15].
- **Multiusuario**: Teams, un espacio compartido en la nube, con edición a la vez en tiempo real, al
  mismo precio por plaza [S15].
- **Dónde corre**: en local sin servidor ("Just files plus a local SQLite index") o en su nube,
  montada sobre WorkOS AuthKit, Neon Postgres y Tigris S3 [S15].
- **MCP y clientes IA**: stdio en local y https en la nube; nombra Claude Desktop, Claude Code,
  Codex, Cursor y VS Code, y ChatGPT con las tools `search` y `fetch` [S15]. claude.ai como
  conector remoto: ⚠ no publicado (la nube va por https, pero no lo nombra).
- **Licencia y precio**: AGPL-3.0 [S1]. Local, gratis; la nube, 15 $ al mes por plaza [S14, S15].
- **Cómo se lee**: con cualquier editor de Markdown; con Obsidian sin configurar nada, apuntándolo a
  la carpeta [S15]; en la nube, una web y una app móvil [S15].
- **Salud**: 4.076 estrellas (unas 4.200 en mayo) y push el 02/10/2026 [S1]; la web dice 57.000
  descargas al mes [S14].
- **Qué copia Naeth**: casi todo el planteamiento. Ficheros Markdown como verdad y la base como
  índice (lo contrario de Naeth hoy, que tiene la verdad en Postgres); poder elegir proyecto a
  proyecto entre local y nube; Obsidian como lector gratis; búsqueda híbrida con FastEmbed, como la
  de Naeth. **Qué evita, o dónde puede diferenciarse**: no trae ficheros que no sean notas, y no se
  ve una biblioteca para leer, solo un editor. Es la competencia directa: si Naeth acaba en
  "Markdown más índice más MCP", compite con un AGPL de 15 $ que ya existe.

### Supermemory

- **Qué es**: un motor de memoria y contexto para agentes, en API: extrae hechos, mantiene un perfil
  por usuario, resuelve contradicciones y olvida lo caducado; RAG y conectores en el mismo sistema
  [S17].
- **Tipos de contenido**: **los más amplios de la lista**: PDF, imágenes con OCR, vídeo con
  transcripción y código troceado por AST, más conectores con Google Drive, Gmail, Notion, OneDrive,
  GitHub y un rastreador web [S17]. Tipos enchufables: ⚠ no publicado.
- **Ingesta**: automática, con un LLM que extrae memorias y perfiles; "No embedding pipelines, no
  vector DB config, no chunking strategies" [S17]. La extracción avanzada de PDF es del plan Scale
  [S16].
- **Formato y exportación**: en local, todo en un directorio `./.supermemory` fácil de copiar [S17];
  un formato abierto o una exportación: ⚠ no publicado.
- **Sync y local-first**: un binario local con motor de grafos y embeddings propios
  (`bge-base-en-v1.5`), que con Ollama no saca nada de la máquina; misma API que la nube [S17].
  Sync entre los dos: ⚠ no publicado.
- **Multiusuario**: perfiles y memoria por `containerTag` (un usuario, un proyecto) [S17]; en Pro, 3
  plazas de equipo y usuarios finales sin límite; en Scale, plazas ilimitadas con acceso por
  etiqueta [S16].
- **Dónde corre**: su nube; el binario local; y self-hosting gestionado o aislado de la red en Scale
  y Enterprise [S16, S17].
- **MCP y clientes IA**: remoto en `mcp.supermemory.ai/mcp`, **con OAuth** ("Supermemory uses OAuth,
  so no API key is required"), y su código es abierto [S17, S18]; plugins para Claude Code, Cursor,
  Codex y otros [S17]. claude.ai: no lo nombra [S18].
- **Licencia y precio**: MIT [S1]. Gratis con 5 $ de crédito; Pro 19 $; Max 100 $; Scale 399 $ (PDF
  avanzado, SOC 2, HIPAA, self-hosting); Enterprise a medida; y tarifa por uso, de 5 $ el millón de
  tokens de memoria de texto [S16].
- **Cómo se lee**: no está hecho para leer; da contexto a los agentes. Para leer: ⚠ sin ver.
- **Salud**: 31.057 estrellas, push el 02/10/2026 [S1]. Publica sus propias medidas (95% de
  recall@15) [S17], sin replicar.
- **Qué copia Naeth**: **la ingesta por tipo** (OCR, transcripción, código por AST): es la lista de
  extractores que la E1 y la E2 dijeron que hace falta; los conectores como "fuentes externas", la
  cuarta acepción de abierto; el mismo API en local y en la nube cambiando solo la URL; MCP con
  OAuth. **Qué evita**: el perfil de usuario resumido por un LLM como verdad, y precios por
  millón de tokens, que son de producto de API y no de biblioteca personal.

### NotebookLM, ahora Gemini Notebook

- **Qué es**: cuadernos de fuentes sobre los que se conversa con Gemini y se generan resúmenes,
  informes, mapas mentales, audio y vídeo. **Ha cambiado de nombre**: su ayuda redirige a "Gemini
  Notebook" [S19, S20].
- **Tipos de contenido**: **cualquier fuente habitual**: PDF, Word, PowerPoint, Markdown, texto,
  CSV, ePub, Docs, Slides y Sheets, imágenes, audio (transcrito al importar), web, vídeos públicos
  de YouTube (su transcripción) y libros de Play Books [S19]. No enchufables.
- **Ingesta**: subir o enlazar; lo de Drive se resincroniza solo cada pocos minutos; con más de cinco
  fuentes, las etiqueta y agrupa por tema solo; también busca fuentes nuevas en la web o en Drive
  [S19]. Hasta 500.000 palabras o 200 MB por fuente [S19].
- **Formato y exportación**: ⚠ no publicado en estas páginas. Una fuente es "a copy or auto-synced
  version" del documento [S19].
- **Sync y local-first**: no: solo en el navegador y la app móvil de Google [S20].
- **Multiusuario**: cuadernos compartidos, y públicos; la compartición avanzada es de pago [S20].
- **Dónde corre**: en Google; en la versión de empresa, dentro del proyecto de Google Cloud del
  cliente, con regionalización [S20].
- **MCP y clientes IA**: solo Gemini; API o MCP: ⚠ no publicado en estas páginas.
- **Licencia y precio**: cerrado. Gratis con 100 cuadernos y 50 fuentes por cuaderno; con los planes
  de Google AI (Plus, Pro, Ultra), de 200 a 500 cuadernos y de 100 a 600 fuentes [S20]. Los datos
  no se usan para entrenar salvo que se dé feedback [S20].
- **Cómo se lee**: **es el que mejor resuelve la lectura de la lista**: un visor de fuentes con una
  guía resumida de cada una, citas que llevan al pasaje, y salidas para leer o escuchar (informes,
  audio, vídeo, fichas) [S19, S20].
- **Salud**: producto de Google, con el nombre cambiado [S19]; la fecha del cambio: ⚠ no publicado.
- **Qué copia Naeth**: la **lista de tipos de fuente** como vara de medir de "biblioteca de todo";
  la fuente de Drive que se resincroniza sola (una fuente externa viva); la guía por fuente, que es
  el digest de Naeth aplicado a una obra; y que cada respuesta cite el pasaje. **Qué evita**: el
  encierro: sin formato de salida publicado, sin MCP y solo con un modelo.

### Obsidian

- **Qué es**: un editor de notas local sobre una carpeta de Markdown, con enlaces, grafo, Canvas y
  miles de plugins [S22].
- **Tipos de contenido**: notas en Markdown y lienzos en JSON Canvas, un formato abierto [S22]; lo
  demás (PDF, imágenes) vive en la carpeta y se ve dentro. **Enchufable por plugins**: 8.317 en el
  catálogo de la comunidad [S23].
- **Ingesta**: escribir; el Web Clipper oficial para la web [S22].
- **Formato y exportación**: **"Obsidian stores your notes locally as plain text Markdown files"**;
  no hay nada que exportar [S22].
- **Sync y local-first**: local-first de serie; Sync de pago con cifrado de extremo a extremo
  (AES-256) e historial de versiones [S21].
- **Multiusuario**: carpetas compartidas por Sync; no hay plan de equipo [S21].
- **Dónde corre**: escritorio y móvil, sin servidor [S22].
- **MCP y clientes IA**: **ningún MCP oficial**. Hay una CLI oficial ("Anything you can do in
  Obsidian you can do from the command line"), que exige la app abierta y que se ofrece para dar
  acceso a "agentic tools" a una carpeta sin darles el ordenador [S24]; y 56 plugins de la
  comunidad que mencionan MCP [S23].
- **Licencia y precio**: cerrado; la app es gratis también para uso comercial; Sync 4 o 5 $ por
  usuario al mes; Publish 8 o 10 $ por sitio; licencia comercial voluntaria de 50 $ al año [S21].
- **Cómo se lee**: un editor con vista de lectura, enlaces y grafo. Es **el esqueleto que el visor de
  Naeth copia** hoy (M14).
- **Salud**: 21.963 estrellas en el repositorio de releases, push el 02/10/2026 [S1].
- **Qué copia Naeth**: los formatos abiertos sin exportación (Markdown y JSON Canvas); que lo
  alrededor (IA, MCP) sea un plugin y no el núcleo; la CLI como puerta para agentes con acceso
  acotado. **Qué evita**: parecerse a Obsidian en la forma (A1); y depender de la app abierta para
  que un agente entre.

### Logseq

- **Qué es**: notas en bloques y esquema, con diario, consultas, anotación de PDF y tareas [S25].
- **Tipos de contenido**: bloques de texto; PDF anotables [S25]. Enchufable por su API de plugins
  [S25].
- **Ingesta**: escribir; importar PDF para anotarlos [S25].
- **Formato y exportación**: **ha cambiado de base**. El 24/04/2026 Logseq se partió en dos: "Logseq
  OG", sobre ficheros Markdown y Org, que solo recibirá "security fixes and patches", y la versión
  con base de datos, que se queda con todo el desarrollo [S27]. La 2.0, publicada el 13/07/2026, es
  esa versión con base de datos, en beta [S26], que guarda en SQLite y se respalda exportando esa
  base [S25]. Que vuelva a escribir Markdown: "still researching the best way to do this" [S27].
- **Sync y local-first**: local; el sync nuevo con colaboración en tiempo real (RTC) va cifrado de
  extremo a extremo y está en alfa, con aviso expreso de que "data loss is possible" [S25, S27].
- **Multiusuario**: colaboración en tiempo real por RTC, en alfa [S25].
- **Dónde corre**: escritorio, y una app móvil nueva en alfa [S25].
- **MCP y clientes IA**: ⚠ no publicado (ni el README ni el anuncio lo mencionan).
- **Licencia y precio**: AGPL-3.0 [S1]; la app es gratis; el precio del sync: ⚠ no publicado (el
  anuncio solo cita el acceso de los patrocinadores de 15 $ al mes a la beta de iOS) [S27].
- **Cómo se lee**: esquema de bloques con enlaces y consultas [S25]; la app: ⚠ sin ver.
- **Salud**: 45.109 estrellas y push el 02/10/2026 [S1]; la versión que se desarrolla está en beta y su
  sync en alfa [S25].
- **Qué copia Naeth**: nada de forma directa; **es la prueba en contra más clara para D11**: el
  producto de notas en Markdown más conocido después de Obsidian se ha pasado a una base de datos
  por velocidad de desarrollo y estabilidad ("Development will be much faster", "Stability will
  improve") [S27], y deja el Markdown como algo por investigar. **Qué evita**: dos productos en
  paralelo, uno congelado, y una migración de formato con riesgo de perder datos.

### Anytype

- **Qué es**: un espacio local-first de objetos tipados (notas, tareas, contactos, lo que se defina),
  con canales compartidos y chat; ahora se vende también para empresas ("Run your company on
  Anytype") [S28].
- **Tipos de contenido**: **objetos con tipos definidos por el usuario**: "you can create your own
  custom Types to match your needs", cada uno con sus propiedades, vistas y plantillas [S33]. Es el
  modelo de tipos enchufables más maduro de la lista.
- **Ingesta**: escribir e importar; las fuentes de importación: ⚠ no publicado en la página
  [S32].
- **Formato y exportación**: exporta a Markdown, a su formato propio (Any-Block, en JSON o en
  Protobuf), a PDF y a HTML; **no exporta** los miembros ni los chats, atados a claves de cifrado
  por usuario [S32].
- **Sync y local-first**: local-first con sync cifrado ("Encrypted, Swiss-based") [S28]; modo solo
  local [S31] y red propia autoalojada (any-sync, imagen Docker mantenida por ellos) [S34].
- **Multiusuario**: canales compartidos (10 en el plan gratis, ilimitados de pago); para empresas,
  SSO, panel de administración y self-hosting [S28].
- **Dónde corre**: escritorio y móvil; sync en su red, en una red propia o en ninguna [S28, S34].
- **MCP y clientes IA**: **MCP oficial** (`anytype-mcp`, MIT), que convierte en tools la API local
  de la app; se configura con una API key creada en la app; nombra Claude Desktop, Claude Code,
  Cursor, Windsurf y Raycast [S30]. Es local, no un conector remoto.
- **Licencia y precio**: **"Any Source Available License 1.0"**: se puede usar, modificar y
  redistribuir "only (a) for Non-Commercial Use, or (b) for Commercial Use in Allowed Networks"
  [S29]. Gratis con 100 MB en remoto; Plus 4 $, Pro 8 $ y Ultra 16 $ al mes (de 1 a 100 GB) [S28].
- **Cómo se lee**: objetos con vistas por tipo [S33]; la app: ⚠ sin ver.
- **Salud**: el cliente de escritorio, 8.875 estrellas; push el 02/10/2026 [S1]; el MCP, 526
  estrellas y push el 21/09 [S30].
- **Qué copia Naeth**: **los tipos definidos por el usuario** como respuesta a D12; exportar en un
  formato abierto y en uno propio sin pérdida, diciendo qué se pierde; poder elegir red (la suya,
  una propia o ninguna). Y **su licencia es el precedente más cercano a Q3**: código visible, gratis
  sin uso comercial y comercio solo dentro de su red, que es lo que plantea la licencia Naeth 1.0.
  **Qué evita**: que lo compartido (miembros, chat) no se pueda exportar.

### AnythingLLM

- **Qué es**: una aplicación para chatear con documentos propios con cualquier LLM, local o en la
  nube, con agentes, varios usuarios y bases vectoriales incluidas [S35].
- **Tipos de contenido**: documentos (PDF, TXT, DOCX y otros), audio y vídeo transcritos con un
  modelo propio [S35]. Tipos enchufables: no; lo enchufable son los proveedores (LLM, embeddings,
  bases vectoriales, voz) [S35].
- **Ingesta**: un servicio aparte (`collector`) trocea y procesa los documentos que se suben;
  embeddings con un modelo nativo por defecto [S35].
- **Formato y exportación**: vectores en LanceDB por defecto (o PGVector, Chroma y otros) [S35];
  formato abierto o exportación: ⚠ no publicado.
- **Sync y local-first**: escritorio local por defecto ("runs locally by default"), sin sync entre
  máquinas publicado [S35].
- **Multiusuario**: instancia con varios usuarios y permisos, **solo en la versión Docker** [S35];
  SSO y RBAC en Enterprise [S36].
- **Dónde corre**: escritorio (Mac, Windows, Linux), Docker propio gratis, o instancia alojada [S35,
  S36]; app de Android open source [S35].
- **MCP y clientes IA**: **solo cliente MCP**: sus agentes usan servidores MCP externos por stdio, SSE
  o streamable; no expone sus documentos a otros clientes [S37].
- **Licencia y precio**: MIT [S1]. Escritorio y Docker gratis; nube Basic 50 $ y Pro 99 $ al mes;
  Enterprise a medida, con on-premise, SSO y RBAC [S36].
- **Cómo se lee**: un chat por espacio de trabajo ("Chat with your docs") [S35]; los documentos se
  preguntan, no se leen. La vista de los documentos: ⚠ sin ver.
- **Salud**: 66.666 estrellas, push el 02/10/2026 [S1].
- **Qué copia Naeth**: la ingesta como servicio aparte que entiende formatos; el espacio de trabajo
  como unidad que se comparte con permisos; todo enchufable por proveedor. **Qué evita**: ser solo
  una interfaz de chat (el conocimiento no se lee, se pregunta), y no exponerse por MCP, que es lo
  único inamovible de Naeth.

### Khoj

- **Qué es**: un "segundo cerebro" con IA que responde con la web y con los documentos propios, y
  agentes con conocimiento propio [S38].
- **Tipos de contenido**: imágenes, PDF, Markdown, org-mode, Word y Notion [S38]. Tipos enchufables:
  ⚠ no publicado.
- **Ingesta**: indexa los documentos y las fuentes conectadas [S38].
- **Formato y exportación**: ⚠ no publicado; el último commit arregla la exportación del chat [S39].
- **Sync y local-first**: se instala en el ordenador propio o se usa su nube [S38].
- **Multiusuario**: una oferta para equipos y empresas (nube, on-premise o híbrida) [S38].
- **Dónde corre**: navegador, Obsidian, Emacs, escritorio, móvil y WhatsApp como clientes; servidor
  propio o su nube [S38].
- **MCP y clientes IA**: ⚠ no publicado en el README.
- **Licencia y precio**: AGPL-3.0 [S1]; los precios: ⚠ no publicado (la página de precios da 404 y la
  portada no muestra ninguno) [S40].
- **Cómo se lee**: un chat, con los clientes donde ya se escribe (Obsidian, Emacs) [S38].
- **Salud**: **se está apagando**. 37.558 estrellas, pero la última versión es una beta del
  26/03/2026, los últimos commits son del 24/06 y del 02/08 [S39], y la portada empuja ahora otro
  producto del mismo equipo, Pipali, "Your AI co-worker" [S40].
- **Qué copia Naeth**: llegar a donde ya se escribe (un plugin de Obsidian, Emacs, WhatsApp) en vez
  de exigir una aplicación propia. **Qué evita, y es la lección**: un proyecto open source de casi
  40.000 estrellas puede quedarse sin desarrollo en meses cuando su equipo cambia de producto; la
  salud de un proyecto se mide por la fecha del último commit, no por las estrellas.

### Capacities

- **Qué es**: un estudio de notas por objetos: cada cosa (libro, persona, idea, PDF) es un objeto de un
  tipo, enlazado con los demás, en vez de un fichero en una carpeta [S42].
- **Tipos de contenido**: **tipos definidos por el usuario**, sin límite en el plan gratis [S41, S42];
  PDF (para leer, subrayar y analizar con IA), imágenes, audio (con transcripción y resumen) y
  ficheros sueltos que solo se guardan y etiquetan [S42].
- **Ingesta**: escribir; guardar desde WhatsApp, Telegram, Twitter y el correo; subir ficheros (5 GB
  en el plan gratis) [S41].
- **Formato y exportación**: Markdown con frontmatter, CSV por colección y los ficheros en carpetas;
  los enlaces pasan a ser locales "so the graph character of your space is fully contained" [S44].
- **Sync y local-first**: en la nube con trabajo sin conexión, que se sincroniza al volver [S41,
  S42]; los ficheros se guardan en local y se sincronizan [S42].
- **Multiusuario**: solo compartir para ver; no hay espacios de edición compartida [S41].
- **Dónde corre**: escritorio, web y móvil, sobre su nube [S41].
- **MCP y clientes IA**: **MCP remoto en `api.capacities.io/mcp` con OAuth 2.1, PKCE, registro dinámico
  de clientes y tokens de refresco** (lo mismo que Naeth tras su IdP), con 8 tools de lectura y 11
  de escritura, en el plan Pro; nombra Claude, ChatGPT y Cursor [S43]. Avisa de que una pregunta
  amplia que deba recorrer todo el espacio sin filtro "may still be a poor fit" [S43]. La API REST
  anterior está obsoleta [S42].
- **Licencia y precio**: cerrado. Gratis (sin IA ni MCP); Pro 9,99 $ al mes; Believer desde 12,49 $;
  ampliación de IA de 8,33 $ [S41].
- **Cómo se lee**: páginas de objetos, colecciones, consultas y un grafo; el PDF se lee y se subraya
  dentro [S42].
- **Salud**: ⚠ no medible (cerrado, sin repositorio).
- **Qué copia Naeth**: los **tipos del usuario** como Anytype, pero en la nube; la exportación que
  convierte los enlaces en enlaces locales para que el grafo salga entero; separar "ficheros que se
  leen" (PDF) de "ficheros que solo se guardan"; y el aviso honesto de para qué no sirve su MCP.
  **Qué evita**: el MCP solo en el plan de pago y la colaboración limitada a ver.

### Cognee

- **Qué es**: una plataforma open source de memoria para agentes que convierte documentos, código y
  conversaciones en un grafo de conocimiento autoalojado; ahora se vende como "Company Brain" [S45].
- **Tipos de contenido**: documentos, conversaciones y **código, que entra como grafo de símbolos y
  dependencias** [S45]. **Enchufable**: modelos de datos y ontologías propios [S45], y fuentes nuevas
  escribiendo una subclase de `MemorySource` [S47].
- **Ingesta**: **ya no exige un LLM**: sin clave, extrae el grafo con el modelo local GLiNER y
  embebe en local; las fases que necesitan LLM se saltan solas [S45].
- **Formato y exportación**: **COGX**, un formato de intercambio con documentos, conversaciones,
  entidades y hechos (con ventanas de validez), bloques de memoria y metadatos; importa desde Mem0,
  LangMem, Letta, Zep y Graphiti y exporta un archivo COGX [S47]. Es suyo, no una especificación
  publicada aparte [S47].
- **Sync y local-first**: ⚠ no publicado; corre en local o en servidor [S45].
- **Multiusuario**: **multi-tenant por defecto**: sin desactivarlo, cada llamada a la API exige un
  usuario autenticado [S45]; en la nube, usuarios ilimitados por espacio [S46].
- **Dónde corre**: en local, en Docker (API, interfaz y MCP), en su nube o en la nube del cliente
  [S45, S46]. Desde la 1.0 puede ir entera sobre un solo Postgres, pero el grafo en Postgres es una
  demo y lo de producción es "a licensed product" [S45].
- **MCP y clientes IA**: servidor MCP propio (puerto 8001 en el compose), plugins para Claude Code y
  Codex, y guía para Cursor y Cline [S45].
- **Licencia y precio**: Apache-2.0 [S1]. Open source gratis; nube gratis con 1 millón de tokens y
  después 1 $ por millón y 5 $ por espacio extra; BYOC por contrato [S46].
- **Cómo se lee**: una interfaz local con el grafo [S45]; para leer documentos: ⚠ sin ver.
- **Salud**: 31.302 estrellas (unas 12.000 en mayo) y push el 02/10/2026 [S1].
- **Qué copia Naeth**: **un formato de intercambio entre sistemas de memoria** (COGX) como
  respuesta a D11 cuando el contenido no son solo notas; el código como grafo de símbolos, que es
  CDA; la ingesta que funciona sin LLM y mejora si lo hay; y que el multiusuario venga encendido
  de serie. **Qué evita**: que la versión de un solo Postgres sea de pago: es justo lo que Naeth ya
  tiene.

### Notion, con su IA y su MCP

- **Qué es**: el espacio de trabajo de documentos y bases de datos más extendido en equipos, con IA y
  agentes en el plan Business [S48].
- **Tipos de contenido**: páginas de bloques y bases de datos [S50]. Que una base de datos con sus
  propiedades haga de tipo definido por el equipo es lectura nuestra, no algo que diga la fuente.
  Ficheros: ⚠ no mirado aquí.
- **Ingesta**: escribir e integraciones; la búsqueda del MCP alcanza también fuentes conectadas
  [S49].
- **Formato y exportación**: PDF, HTML y "Markdown & CSV": cada página a Markdown y cada base de
  datos a CSV; los callouts salen como HTML porque Markdown no tiene equivalente, y los comentarios
  solo salen en HTML [S50]. Exportar con subpáginas: Business o Enterprise [S50].
- **Sync y local-first**: en la nube, con modo sin conexión en todos los planes [S48].
- **Multiusuario**: **es su fuerte**: espacios de equipo, permisos por base de datos, SSO SAML en
  Business, y SCIM, auditoría y retención cero de datos en los proveedores de IA en Enterprise [S48].
- **Dónde corre**: en su nube [S48].
- **MCP y clientes IA**: **MCP remoto alojado por Notion, con OAuth**; nombra Claude Code, Cursor y
  Codex; los dueños del espacio ven y revocan las conexiones [S49]. Restricción por plan: no la
  menciona [S49].
- **Licencia y precio**: cerrado. Gratis; Plus 9,50 €; Business 19,50 € por plaza al mes (la IA
  entera); Enterprise a medida [S48].
- **Cómo se lee**: páginas y bases de datos [S50]; sus vistas: ⚠ sin ver aquí.
- **Salud**: ⚠ no medible (cerrado).
- **Qué copia Naeth**: que el administrador vea y revoque qué clientes IA tiene conectados cada
  miembro (Naeth ya registra qué cliente escribe cada nota, pero no da ese panel); el MCP remoto con
  OAuth como lo normal; y exportar diciendo qué no tiene equivalente. **Qué evita**: que la
  exportación completa dependa del plan, y que lo abierto sea solo una salida, no el formato.

### Mem

- **Qué es**: notas con IA que se organizan solas: detecta tareas, mantiene la relación entre
  personas, proyectos y decisiones ("As new information arrives, Mem updates how people, projects,
  decisions, and priorities fit together") y tiene un modo de voz para reuniones [S51, S52].
- **Tipos de contenido**: notas, colecciones y notas de voz [S51]. Tipos enchufables: ⚠ no publicado.
- **Ingesta**: escribir o dictar; captura rápida en Mac y Windows [S52].
- **Formato y exportación**: "one-click exports of your notes and collections as Markdown files"
  [S51].
- **Sync y local-first**: no; en su nube, cifrado en reposo con AES-256 pero **no de extremo a
  extremo**, "because Mem needs to process your knowledge" [S51].
- **Multiusuario**: ⚠ no publicado [S51, S52].
- **Dónde corre**: su nube, con apps de escritorio [S52].
- **MCP y clientes IA**: un "Claude Connector" aparece en un titular de novedades, sin detalle;
  MCP y API: ⚠ no publicado [S52].
- **Licencia y precio**: cerrado. **Cobra por notas y mensajes al mes**: gratis con 25 notas, Plus 9 $
  con 50, Pro 29 $ con 100, y escalones hasta 199 $ con 2.000 [S51].
- **Cómo se lee**: notas y colecciones, con un chat encima [S51].
- **Salud**: ⚠ no medible (cerrado).
- **Qué copia Naeth**: la exportación a Markdown en un clic, y decir sin rodeos por qué no hay cifrado
  de extremo a extremo (es lo mismo que le pasa a Naeth con la búsqueda semántica). **Qué evita**:
  cobrar por número de notas, que castiga justo el uso que da valor a una memoria, y una
  organización hecha por la IA que el usuario no controla.

### De una línea

- **Reor**: notas locales con IA; **archivado** desde el 13/05/2025, con 8.548 estrellas [S1]. Fuera.
- **Tana**: notas en esquema con "supertags", que son tipos definidos por el usuario; MCP en todos
  los planes; gratis, Pro de 20 a 30 $ y Max de 80 a 120 $ al mes, y Business a medida [S53].
- **Heptabase**: tarjetas en pizarras visuales, con subrayado de PDF y transcripciones de YouTube;
  Pro 8,99 $, Premium 17,99 $ y Premium+ 53,99 $; MCP, API y exportación a Markdown: no los menciona
  [S54].

### La rejilla

Una fila por producto, con las columnas que deciden. La ficha de cada uno trae la fuente de cada
celda; aquí solo se resume. La última fila es Naeth hoy, para comparar.

| Producto | Tipos del usuario | Formato abierto | Local-first | Multiusuario | MCP | Licencia | Vivo |
|---|---|---|---|---|---|---|---|
| Mem0 | ⚠ | no (JSON, solo en la nube) | no | por ámbitos | remoto, OAuth, solo la nube | Apache-2.0 | sí |
| Zep y Graphiti | ontología propia | ⚠ | no | por grupo o usuario | local, sin autenticación | Apache-2.0 | sí |
| Letta | no aplica | Markdown en git | sí, por git | equipos | remoto, sin OAuth | Apache-2.0 | sí |
| Basic Memory | ⚠ | Markdown | sí | Teams | stdio y https | AGPL-3.0 | sí |
| Supermemory | ⚠ | ⚠ | binario local | por ámbitos y plazas | remoto, OAuth | MIT | sí |
| Gemini Notebook | no | ⚠ | no | compartir | ⚠ | cerrado | sí |
| Obsidian | por plugins | Markdown y JSON Canvas | sí | carpetas por Sync | sin oficial (CLI) | cerrado | sí |
| Logseq | por plugins | SQLite (Markdown en OG) | sí | RTC en alfa | ⚠ | AGPL-3.0 | sí, en beta |
| Anytype | sí | Markdown y propio | sí | canales y empresa | local, API key | source available | sí |
| AnythingLLM | no | ⚠ | escritorio | solo en Docker | solo cliente | MIT | sí |
| Khoj | ⚠ | ⚠ | servidor propio | equipos | ⚠ | AGPL-3.0 | apagándose |
| Capacities | sí | Markdown y CSV | sin conexión | solo ver | remoto, OAuth 2.1, de pago | cerrado | ⚠ |
| Cognee | ontologías | COGX (suyo) | ⚠ | multi-tenant de serie | servidor propio | Apache-2.0 | sí |
| Notion | bases de datos | Markdown y CSV al exportar | sin conexión | su fuerte | remoto, OAuth | cerrado | ⚠ |
| Mem | ⚠ | Markdown al exportar | no | ⚠ | ⚠ | cerrado | ⚠ |
| **Naeth hoy** | no (E1) | no: Postgres | no: dos nodos (M11) | no (E6) | remoto, OAuth, propio | Naeth 1.0, no comercial | sí |

### Lo que dice el mercado

1. **Nadie junta las tres cosas**: ingerir de todo, leerlo como una biblioteca y darlo a cualquier IA
   por MCP. Los que ingieren de todo no se leen: son una API o un chat (Supermemory, AnythingLLM,
   Cognee, y Gemini Notebook, que además no tiene MCP) [S17, S35, S45, S19]. Los que se leen bien
   no ingieren de todo o encierran el MCP en un plan de pago (Obsidian, Logseq, Anytype, Capacities,
   Notion) [S22, S25, S33, S43, S49]. Ese hueco es el de Naeth.
2. **Hay dos caminos para el formato, y los dos están vivos**: los ficheros como verdad (Basic Memory,
   el MemFS de Letta en git, Obsidian) y la base de datos con exportación (Anytype, Capacities,
   Notion, Mem) [S15, S10, S22, S32, S44, S50, S51]. Y uno de los grandes acaba de cambiar de
   bando: **Logseq dejó los ficheros por una base de datos** por velocidad y estabilidad [S27].
   Exportar a Markdown es ya lo mínimo; ser Markdown, una opción.
3. **Los tipos definidos por el usuario son lo normal** en las herramientas de conocimiento
   (Anytype, Capacities, los supertags de Tana) y en las de memoria con grafo (ontologías de
   Graphiti y Cognee) [S33, S42, S53, S8, S45]. D12 no pide nada raro.
4. **El MCP remoto con OAuth ya es lo normal en los productos cerrados** (Notion, Capacities,
   Supermemory, la nube de Mem0) [S49, S43, S18, S4], y **casi ningún open source lo tiene**: Graphiti
   va sin autenticación, Anytype y Basic Memory en local, Letta sin OAuth [S9, S30, S15, S12]. Naeth
   tiene MCP remoto con OAuth y autoalojado: es un diferencial real, y el principio inamovible.
5. **El multiusuario va por dos caminos**: ámbitos en la API (Mem0, Graphiti, Supermemory, Cognee,
   que lo trae encendido) o espacios compartidos de producto (Notion, Basic Memory Teams, Anytype)
   [S2, S9, S17, S45, S48, S15, S28]. La E6 está en el primero; el segundo es lo que pediría un
   "producto para otros".
6. **La ingesta que funciona sin LLM gana terreno**: Cognee ya no lo exige y Basic Memory nunca lo
   hizo [S45, S15]; los que lo exigen guardan lo que el LLM extrae, no el original (Mem0, Graphiti,
   Supermemory) [S5, S9, S17]. Naeth guarda el original: encaja con "funciona sin LLM y mejora con
   él".
7. **Las estrellas no dicen si un proyecto vive**: Khoj tiene 37.558 y está casi parado; Reor está
   archivado; Logseq desarrolla una beta que avisa de pérdida de datos [S1, S39, S25].
8. **La licencia de Naeth tiene precedente**: Anytype publica su código con uso no comercial y
   comercio solo en sus redes [S29]. El resto del open source de la lista es Apache-2.0, MIT o
   AGPL-3.0 [S1]. Va a Q3.

## 5. Las decisiones de un solo sentido

*Sub-fase 2.3, hecha el 02/10/2026 entre las 19:23 y las 19:36.* Trece decisiones, de la más difícil de deshacer a
la menos. Cada una con la misma plantilla: la pregunta; las opciones, siempre con "no hacer nada";
lo que cuesta cada una, con su M o su S; qué cierra y qué abre; cuánto cuesta deshacerla; la
recomendación; y qué decide Eneko. **Recomendar no es decidir**: decide Eneko, y Agora revisa las
recomendaciones antes (paso 3).

### D1 · El modelo de contenido

**La pregunta**: cómo entra en Naeth lo que no es una nota (un PDF, un módulo de código, un
fichero), y si la unidad es el fragmento o la obra.

| Opción | Qué es | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | Naeth guarda notas; los ficheros se enlazan desde una nota | Nada. Es lo que la visión descarta: "una biblioteca con todo" no cabe [sección 1] |
| A · Dentro de `memory` | cada fragmento, una fila de nota | 103 líneas; notas intactas; código 0/2; 49 nodos sueltos; sin obra, sin fichero, sin versiones [M18, M19] |
| B · Tablas por tipo | la obra y sus partes en tablas propias de cada tipo | unas 245 líneas por tipo; necesita además una identidad común para las relaciones [estimación: E4] |
| C2 · Núcleo genérico en paralelo | `item`, `item_part` y `blob` junto a `memory` | unas 536 líneas el primer tipo, unas 110 a 160 cada uno después; búsqueda conjunta sin coste medible [M20 a M22] |
| C2 más C1a · Núcleo con identidad común | lo anterior, y cada nota con su fila en `item` y las FK hacia `item` | C2 más 31 líneas de SQL y 4 escrituras de `core.py`; ninguna lectura cambia [M24, M25] |
| C1b · Todo en una tabla de partes | el contenido de las notas pasa a `item_part`; `memory`, a vista | 19 líneas más, las 5 escrituras cambian y **la vista pierde el HNSW**; la búsqueda en una tabla, más corta [M25, M27] |

**Qué cierra y qué abre**: A cierra la obra como unidad (el PDF son 25 nodos sueltos) y por tanto la
biblioteca. C2 abre la obra, el fichero original y los tipos nuevos con poco código cada uno. C1a
abre además que una nota y una obra se enlacen, se versionen y se retiren con la misma maquinaria
(D2). C1b cierra la puerta de atrás: `memory` deja de ser una tabla.

**Cuánto cuesta deshacerla**: A, poco (las filas llevan su tipo). C2, poco: tres tablas nuevas que
no tocan las viejas. C1a, medio: cambian las FK de cuatro tablas, el sync las ve (E5) y deshacerlo
es volver a apuntarlas a `memory`. C1b, mucho: todas las escrituras, la vista y el sync.

**Lo que dice el mercado**: los que tratan la obra como unidad son los que se leen (Gemini Notebook
por fuente, Capacities por objeto, Anytype por objeto) [S19, S42, S33]; los que la trocean sin
obra son APIs de memoria (Mem0, Supermemory) [S5, S17].

**Recomendación: C2 más C1a**, y C1b no hasta que una medida lo pida. El núcleo genérico es lo
barato desde el tercer tipo [estimación: E4], la identidad común es lo que da relaciones entre tipos por 31
líneas de SQL [M24], y las notas siguen en su tabla con su HNSW (que además hay que arreglar, M27).
**Depende de**: D2 (las relaciones), D4 (dónde vive el fichero), D11 (el formato), D12 (los tipos) y
D13 (cómo se trocea y se embebe, que pesa más que dónde se guarda: E2).

**Qué decide Eneko**: si la unidad de la biblioteca es la obra. Si lo es, A queda fuera.

### D2 · Las relaciones entre tipos

**La pregunta**: si una nota puede enlazar con un PDF, un módulo o una parte, y con qué garantía.

| Opción | Qué es | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | solo relaciones entre notas, como hoy (`relation` con FK a `memory`) | Nada; el PDF y la nota que lo comenta no se pueden unir [`naeth/db/schema.sql:82-83`] |
| Polimórfica sin FK | `target_kind` más un id, sin integridad | Pocas líneas; un enlace puede apuntar a algo que no existe, y la E6 vio que las FK son lo que sujeta (y también lo que filtra entre dueños) [M31] |
| Identidad común (C1a) | una tabla `item` de la que cuelga todo; las FK apuntan a ella | 31 líneas de SQL; la relación de una nota a un PDF entró a la primera [M24, M25] |
| Tablas de relación por tipo | una tabla por cada par de tipos | crece con el cuadrado de los tipos; ningún producto de la lista lo hace [sección 4] |

**Qué cierra y qué abre**: la identidad común abre además versiones (`supersession`) y retirada
(`tombstone`) para cualquier cosa, con la misma maquinaria que las notas. Sin FK se abre la
puerta a enlaces rotos que nadie ve, y Naeth ya cuenta 41 wikilinks rotos [M3].

**Cuánto cuesta deshacerla**: la identidad común, medio (D1); la polimórfica, poco hacia delante y
mucho hacia atrás (limpiar enlaces rotos).

**Recomendación: identidad común**, que es la misma decisión que C1a en D1. Con un aviso de la E6:
si hay varios dueños (D5), la FK tiene que incluir al dueño, porque una FK no pasa por la RLS
[M31].

**Qué decide Eneko**: nada aparte de D1; si D1 sale C2 más C1a, D2 sale sola.

### D3 · Uno o dos nodos

**La pregunta**: si Naeth sigue en dos nodos con failover (este PC y el VPS `finally`), o pasa a otra
forma. Q4 no dio una tolerancia única ("depende qué"), así que primero se mira qué se cae, cuándo
y para quién.

**Cuándo manda cada nodo** [M34]: del 22/09 al 02/10, el PC mandó el 63% del tiempo y finally el
37%. finally toma el mando al apagarse el PC, de madrugada (entre las 00:48 y las 02:33), y lo
devuelve al arrancar, por la mañana (entre las 09:18 y las 14:08).

**Cuándo se escribe** [M35]: en los últimos 30 días, 287 notas: 1 a las 00 h y las otras 286 entre
las 11 y las 23 h. **Ninguna entre la 01:00 y las 10:59**, que es justo cuando manda finally. Leer:
⚠ no medido (la API no guarda un registro de peticiones y se reinicia al arrancar el PC).

**Qué se cae, función por función**, si solo quedara un nodo:

| Función | Quién la usa | Si el único nodo es el PC | Si el único nodo es finally |
|---|---|---|---|
| Escribir desde Claude Code | Eneko en el PC | nada: Claude Code corre en el PC, así que nunca pide nada con el PC apagado | entra por el túnel: unos 55 ms más por llamada [M36] |
| Leer desde Claude Code | Eneko en el PC | nada, por lo mismo | lo mismo: unos 55 ms más, sobre una búsqueda de 74 [M8] |
| Escribir desde claude.ai o el móvil | Eneko fuera del PC | caído el 37% del tiempo, aunque en 30 días no hubo escrituras a esas horas [M34, M35] | nada |
| Leer desde claude.ai o el móvil | Eneko fuera del PC | caído el 37% del tiempo; ⚠ cuánto se usa a esas horas, sin medir | nada |
| El visor | Eneko | caído el 37% del tiempo; 3 de 685 notas entraron por él [M33] | nada |
| Calcular embeddings | el worker | se retrasa hasta que arranque el PC | nada |

**Las opciones**:

| Opción | Qué es | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | dos nodos con failover y merge en los dos sentidos | el trabajo de CENIT (hasta un 61% de sus líneas manuales desde el 17/07, un techo) [M11]; la cesión al apagar falla desde el 14/08 [M12]; un handoff que falla a mitad deja el destino a medias y lo que se edita no converge [E5, M29]; y cada tabla nueva hay que clasificarla [M29] |
| A · Un nodo, en finally | finally siempre arriba; el PC es un cliente más | se pierde el loopback (unos 55 ms por llamada) [M36]; desaparecen el failover, el merge y el vigía; queda un backup que hay que verificar (D7) |
| B · El PC manda y finally es un espejo de solo lectura | se copia en un solo sentido, sin merge ni failover | claude.ai y el visor leen siempre y solo escriben con el PC encendido; una copia en un sentido es lo más simple que hay del sync de hoy (sin unión, sin reglas monótonas, sin árbitro) [estimación: `sync.py`] |
| C · Un nodo, en el PC | sin VPS | claude.ai, el visor y el móvil, caídos el 37% del tiempo [M34] |
| D · Local-first | cada máquina con su copia, sincronizada como ficheros (git) o con CRDT | es el camino de Letta, Basic Memory y Anytype [S10, S15, S31]; con Postgres no encaja, y es casi rehacer el almacén (D11, D6) |
| E · Replicación lógica de Postgres | Postgres copia entre nodos | descartada en el Paso 8.1 de CENIT: su copia inicial choca con la clave y un slot huérfano retiene WAL sin límite [`CENIT/core/reconciler/src/cenit_core/sync.py:1-5`] |

**Qué cierra y qué abre**: A y B cierran el failover, el merge en dos sentidos y el problema del
hook de apagado, y abren la puerta a que CENIT deje de ser multi-nodo (D7). A abre además lo que
pide "un producto para otros" (Q3): una instalación es un nodo, como en todos los productos de la
sección 4. B conserva el PC como sitio donde se escribe. D abre "lo abierto" en su sentido más
fuerte, pero es otro producto.

**Cuánto cuesta deshacerla**: A y B, medio: volver a dos nodos es reconstruir lo que hay hoy, que
sigue en git. D, mucho.

**Lo que dijo Eneko** (02/10, 19:31, Q4b): fuera de casa consulta Naeth desde claude.ai para darle
contexto y deja notas rápidas "para luego"; de madrugada no usa claude.ai. Fuera de casa el PC
puede estar apagado, así que **hace falta leer y escribir con el PC apagado**, aunque en 30 días no
hubiera ninguna escritura a esas horas [M35]: una ausencia en los datos no dice que no haga falta.

**Recomendación: A, un solo nodo en finally, siempre arriba.** Lee y escribe desde cualquier sitio a
cualquier hora; el PC pasa a ser un cliente más, a unos 55 ms [M36], que sobre una búsqueda de 74 ms
[M8] se nota poco; y desaparecen el failover, el merge en dos sentidos, el vigía y el hook de
apagado que falla [M11, M12, E5]. B no sirve: deja escribir solo con el PC encendido. C tampoco: deja
a claude.ai sin Naeth el 37% del tiempo [M34]. Lo que queda por resolver con A es el backup, que pasa
a ser lo único que protege los datos (D7), y que el PC deja de tener la memoria en local (D10).

**Qué decide Eneko**: si acepta que su Naeth viva en el VPS y no en el PC, con lo que eso toca de
D10 ("lo de cliente no sale de la máquina").

### D4 · Dónde viven los ficheros

**La pregunta**: dónde se guarda el fichero original de una obra (el PDF, el audio), ahora que D1
lo trae.

| Opción | Qué es | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | solo entra el texto extraído; el original se queda fuera | nada; pero no se puede volver al original ni re-trocear con otra estrategia (D13) |
| Dentro de Postgres | el fichero como columna binaria | un solo PDF de la E2 pesa 4,6 MB [M20], el 15% de todo el schema `memory` de hoy (31 MB) [M4]; cada `pg_dump`, el sync y el backup lo arrastran |
| En disco, por su sha256 | Postgres guarda la ruta; el fichero, en una carpeta por contenido (lo de la E2) | no viaja con el sync de hoy [M29]; con un solo nodo (D3) es una carpeta más que respaldar |
| En un almacén de objetos (tipo S3) | lo mismo, en un servicio con API S3 | es lo que usa la nube de Basic Memory (Tigris S3) [S15]; sirve igual a un nodo propio que a uno alojado |
| En la carpeta del usuario | los ficheros son la verdad y la base los indexa (Obsidian, Basic Memory) | ver D11 |

**Qué cierra y qué abre**: guardar por sha256 hace que un fichero no se duplique y que encaje con
ADD-only (un fichero que cambia es otro sha256: D9). Fuera de Postgres, el backup tiene que llevar
la base y la carpeta a la vez, o una restauración saldrá con obras sin fichero.

**Cuánto cuesta deshacerla**: poco entre disco y S3 (mismo contenido, misma clave); mucho si se meten
en Postgres y luego hay que sacarlos.

**Recomendación: fuera de Postgres, por sha256, detrás de una interfaz de almacén con dos
implementaciones, disco local y S3.** Con D3 en un solo nodo, disco del VPS y backup del par base
más carpeta (D7). La capacidad del disco de finally: ⚠ sin medir. Para el vídeo, CDA ya decidió lo mismo: "Dónde
vive el vídeo: fuera de Naeth" [`cda-videos-2026-09-14.md:133`].

**Qué decide Eneko**: si los originales entran en Naeth o solo su texto. Y, con D10, si entran los
de clientes.

### D5 · Identidad y varios usuarios

**La pregunta**: cómo sabe Naeth de quién es cada cosa, ahora que Q3 incluye personas, equipos,
empresas y clientes.

| Opción | Qué es | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | una persona por instalación; quien quiera Naeth, instala el suyo | nada en código; deja fuera a equipos y empresas (Q3) |
| Una instancia por usuario | cada persona o equipo, su contenedor y su base | aislamiento total y cero cambios en el esquema; el coste es de operación, con 3,8 GB en reposo por instancia hoy [M13] |
| Un dueño por fila y RLS | `owner_id` y una política por tabla (la E6) | 0 sentencias de código y menos de 1 ms con la política bien escrita, pero antes un rol que no sea superusuario, vistas con `security_invoker` y claves con el dueño [M30 a M32] |
| Espacios con miembros y RLS | lo anterior, con `space_id` y una tabla de miembros; una persona sola es un espacio de uno | lo mismo más la pertenencia; es el modelo de Notion, Basic Memory Teams y Anytype [S48, S15, S28] |

**Lo que ya hay**: el IdP de CENIT (Pocket-ID) valida de verdad, y el proxy inyecta el email y el
`sub` en cada petición, pero Naeth no los lee [`cenit-verificacion-2026-09-09.md`; Naeth `23ea10af`].

**Qué cierra y qué abre**: una instancia por usuario no cierra nada en el esquema pero multiplica la
operación, y no da equipos (un espacio compartido entre dos personas). Los espacios con RLS abren
equipos y clientes en una sola instalación, y obligan a resolver lo que encontró la E6: el worker, el
sync y el backup tienen que elegir si ven a todos [M31].

**Cuánto cuesta deshacerla**: añadir `space_id` después, con datos de varios dueños mezclados, es
caro; hacerlo ahora, con un solo dueño, es una columna con un valor por defecto [M30].

**Recomendación: espacios con miembros y RLS**, empezando con un solo espacio, el de Eneko. Es la
única opción que cubre los cuatro grupos de Q3; en lo medido cuesta casi nada en código y en latencia
[M31, M32]; y meter la columna ahora, con un solo dueño, es lo barato.

**Qué decide Eneko**: si "equipos" entra en el primer horizonte o en uno lejano (D5 se puede preparar
sin abrirlo).

### D6 · Dónde corre y con qué base de datos

**La pregunta**: en qué forma se entrega Naeth a cada grupo de Q3, y si Postgres sigue siendo el
motor.

**Lo medido**: Naeth arranca sin CENIT con un Postgres con extensiones y un DSN [M16]; en reposo
ocupa unos 3,8 GB, casi todo dos copias del modelo de embeddings [M13]; el modelo son 2,1 GB que se
descargan [M17]; hoy no existe camino de instalación desde cero [`cenit-verificacion-2026-09-09.md`].

| Opción | Para quién de Q3 | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | solo Eneko | nada; Q3 queda fuera |
| Un compose de Naeth solo (Postgres, API y worker) | quien instala, Eneko, clientes | lo que falta según la verificación del 09/09 ("a un cambio de fichero compose") y una sola copia del modelo [M13] |
| Alojado por Eneko (lo mismo, con espacios) | quien no instala, equipos | D5 y una operación que hoy no existe (altas, cobro, soporte) |
| App de escritorio con SQLite y sqlite-vec, o PGlite | quien instala sin servidor | **un segundo motor**: las 33 sentencias SQL y lo propio de Postgres (RRF, `tsvector`, HNSW de pgvector, RLS) por duplicado [M25; estimación: E3 y E6] |

**Qué cierra y qué abre**: quedarse en Postgres cierra la app de escritorio sin servidor, que es lo
que ofrece Basic Memory en local [S15]; y deja abierto todo lo medido en E1 a E6, que es Postgres.

**Cuánto cuesta deshacerla**: añadir un motor después es caro pero no rompe nada; quitar Postgres
sería rehacer el núcleo.

**Recomendación: Postgres, con dos formas de entrega: el compose de Naeth solo (para quien instala,
para clientes y para Eneko) y la misma imagen alojada con espacios (D5).** La app de escritorio, a un
horizonte lejano y solo si el mercado lo pide. Primero, una sola copia del modelo: la mitad de la
huella [M13].

**Qué decide Eneko**: si "personas que no instalan" (alojado por él) entra en el primer horizonte,
porque es lo que trae operación nueva.

### D7 · Qué de CENIT se absorbe

**La pregunta**: con qué se queda Naeth de CENIT, ahora que D3 recomienda un solo nodo.

| Pieza de CENIT | Qué dice de ella la verificación del 09/09 | Con un solo nodo (D3) |
|---|---|---|
| Failover, árbitro por git y vigía | foso real | **sobra**: se retira con D3 |
| Sync por unión con reglas monótonas | foso real | **sobra** como sync; la lección (clasificar cada tabla, reglas por columna) sirve para importar y exportar (D11) |
| Respaldo cifrado (SOPS y age) con un verificador que descifra | foso real, "más sólido de lo que se creía" | **se absorbe**: con un nodo es lo único que protege los datos |
| Pocket-ID y el proxy OAuth | en uso de verdad | **se absorbe** para Eneko y para lo alojado (D5); quien instala necesita un camino propio: Naeth tiene un servidor de autorización propio sin usar (exploración del 02/10, ⚠ sin volver a verificar) |
| Reconciler de enrutado | parcial: genera un fichero de 29 líneas | se cambia por una receta de exposición dentro de Naeth |
| Ataduras a esta máquina (DPAPI, rutas de Windows) | rompen el arranque | se quedan en el despliegue de Eneko, fuera del producto |

[Las valoraciones, de `cenit-verificacion-2026-09-09.md`.]

**Opciones**: 0, no absorber nada (Naeth sigue de módulo de CENIT); absorberlo todo (CENIT entero pasa
a ser Naeth); o **absorber lo que un solo nodo necesita** (backup verificado, identidad, receta de
exposición) y dejar el resto como el despliegue de Eneko.

**Qué cierra y qué abre**: absorberlo todo arrastra el multi-nodo, que D3 retira. No absorber nada
deja el diagnóstico del 09/09 como está: "CENIT no es una distribución: es el despliegue de una
persona guardado en git".

**Cuánto cuesta deshacerla**: poco: las piezas siguen en el repo de CENIT.

**Recomendación: absorber backup, identidad y la receta de exposición; retirar failover, sync y
vigía.** Encaja con D3 y con el hallazgo del 09/09: Naeth está a un compose de ser autónomo
[`cenit-verificacion-2026-09-09.md`].

**Qué decide Eneko**: qué pasa con CENIT después: si sigue como su despliegue, con otros módulos, o se
apaga.

### D8 · La instancia es el producto

**La pregunta**: si sigue valiendo lo del 09/09, "El producto final tiene que ser el mismo que Eneko
usa y sobre el que sigue desarrollando" [`../plan/roadmap-producto-2026-09-09.md:19`].

| Opción | Qué es | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | la instalación de Eneko es la de referencia y no hay otra | nada; deja fuera a Q3 entero |
| El mismo código, dos despliegues | el producto es lo que Eneko usa, empaquetado; su instalación es una más, con su configuración aparte | separar la plataforma de la instancia, que el 09/09 era la fase 1 y sigue sin hacer [`b077b77a`]; con D3 y D7 se simplifica: un nodo, sin multi-nodo que empaquetar |
| Un producto aparte | una rama "producto" y otra "la de Eneko" | dos cosas que mantener, que es lo que la regla del 09/09 quería evitar |

**Qué cierra y qué abre**: la segunda opción abre los cuatro grupos de Q3 sin bifurcar el código, y
obliga a que nada de la instancia de Eneko (rutas de Windows, DPAPI, su IdP) se cuele en el producto
[`cenit-verificacion-2026-09-09.md`].

**Cuánto cuesta deshacerla**: poco; es una forma de organizar el despliegue.

**Recomendación: el mismo código, dos despliegues.** La regla del 09/09 se mantiene en lo que
importa (Eneko usa el producto) [`../plan/roadmap-producto-2026-09-09.md:19-23`], y deja de
significar que su instalación sea la única.

**Qué decide Eneko**: nada aparte de confirmar la lectura de la regla.

### D9 · ADD-only

**La pregunta**: si todo sigue siendo de solo añadir, sin borrar nunca nada.

**Lo medido**: el 47% del texto guardado ya es historia (versiones superadas) [M7]; a esta escala
pesa poco (31 MB) [M4], pero con ficheros sería otra cosa. Y la E5 enseñó lo que pasa con lo que se
edita sin versionar: no converge [M29].

| Opción | Qué es | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | ADD-only para todo: superar y retirar, nunca borrar | la historia crece sin tope; con varios dueños (D5) y clientes, sin un camino para borrar de verdad lo que alguien pide borrar (⚠ el alcance legal, sin verificar aquí) |
| ADD-only más purga explícita | lo normal sigue igual; una operación aparte, registrada, borra de verdad lo que se pida | una tool o un comando nuevo y una tabla de registro [estimación]; el backup tiene que poder purgarse también |
| Edición en el sitio | los cambios pisan la fila | rompe la historia y la trazabilidad de autoría, y el sync de hoy depende de ADD-only [`sync.py:13-40`] |

**Qué cierra y qué abre**: la purga explícita mantiene lo bueno (historia, autoría, correcciones al
lado de lo corregido) y abre lo que pide tener otros dentro: poder borrar. Con D4, un fichero
retirado puede dejar de ocupar si nadie más lo referencia.

**Cuánto cuesta deshacerla**: una purga ya hecha no se deshace, por diseño.

**Recomendación: ADD-only más purga explícita.** Lo de siempre por defecto, que a esta escala cuesta
poco aunque la historia sea ya el 47% del texto [M7, M4], y una salida registrada para lo que deba
desaparecer.

**Qué decide Eneko**: si quiere la purga ya o cuando entre el primero que no sea él (D5).

### D10 · Lo de cliente no sale de la máquina

**La pregunta**: qué queda de esta regla con D3 (un nodo en el VPS) y con ficheros (D4). Tiene dos
orígenes distintos: el audio de clientes se transcribe en local y no sube a ninguna API (regla de
Eneko), y el corpus no se enseña porque se escribe con franqueza sobre clientes y "eso no sale de
casa" [`../plan/roadmap-producto-2026-09-09.md:115-116`].

**Lo que ya pasa hoy**: las notas sobre clientes ya viven en dos máquinas (el PC y el VPS, por el
sync), y lo que devuelve una búsqueda por MCP entra en el contexto del modelo del cliente IA que pregunta
(así funciona MCP: el resultado de una tool va al modelo).
La regla, en la práctica, ya se refiere a los **originales** de clientes (audio, documentos), no a
las notas.

| Opción | Qué es | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | la regla como está, sin escribir | con D4 entraría un PDF de un cliente en el VPS sin que nadie lo haya decidido |
| Solo para originales | los originales de clientes no entran en Naeth; su texto o sus notas, sí | una marca o una carpeta excluida en la ingesta [estimación]; es lo que ya se hace con el audio |
| Originales cifrados | entran, cifrados con una clave que no está en el servidor | sin búsqueda sobre su contenido; un cifrado más que gestionar |
| Retirarla | todo puede entrar | choca con la confianza de los clientes, que es el motivo de la regla |

**Qué cierra y qué abre**: "solo para originales" cierra la puerta a que la biblioteca de todo se
trague por accidente el material de un cliente, y deja que entren las notas, como hoy.

**Cuánto cuesta deshacerla**: poco hacia la apertura; mucho hacia el cierre (sacar lo que ya entró).

**Recomendación: la regla se queda, escrita, y solo para los originales de clientes.** Con D3, las
notas siguen donde están hoy (en el VPS también); los originales, fuera, como el corpus que no se
enseña [`../plan/roadmap-producto-2026-09-09.md:115-116`].

**Qué decide Eneko**: si está de acuerdo en que la regla nunca se refirió a las notas.

### D11 · Formatos abiertos

**La pregunta**: si la verdad sigue en Postgres o pasa a ficheros, y qué garantía de salida tiene
quien use Naeth.

| Opción | Qué es | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | Postgres es la verdad y no hay exportación | nada; es lo que la sección 4 enseña que ya nadie hace: exportar a Markdown es lo mínimo [S32, S44, S50, S51] |
| Postgres como verdad y exportación abierta | una carpeta por proyecto y subtema, un Markdown con frontmatter por nota, los enlaces como enlaces locales, los ficheros por sha256 y la historia aparte | lo de Capacities y Notion [S44, S50]; ⚠ sin estimar en líneas |
| Ficheros como verdad y la base de índice | lo de Basic Memory, Letta y Obsidian [S15, S10, S22] | todo lo medido en E1 a E6 cuelga de Postgres (RRF, HNSW, RLS, versiones); y Logseq hizo el camino contrario por estabilidad [S27] |
| Un formato de intercambio entre sistemas | como COGX de Cognee [S47] | encaja si Naeth quiere importar de otros sistemas de memoria; COGX es suyo, no un estándar [S47] |

**Qué cierra y qué abre**: la exportación abierta da la garantía sin rehacer el núcleo, y abre leer
la bóveda con Obsidian (que es lo que da Basic Memory gratis) como lector de solo lectura.

**Cuánto cuesta deshacerla**: poco: una exportación se añade o se quita sin tocar el núcleo.

**Recomendación: Postgres como verdad y exportación abierta a Markdown con frontmatter**, que además
sirva de importación (ida y vuelta), probada con un corpus de ejemplo. Es lo que ya dan Capacities y
Notion [S44, S50]. Los ficheros como verdad, no: Logseq acaba de dejarlos por estabilidad [S27].

**Qué decide Eneko**: si le basta con exportar o quiere poder editar los ficheros y que vuelvan (eso
último es otra cosa: sync con ficheros).

### D12 · La superficie de extensión

**La pregunta**: cómo se añade un tipo nuevo (un ingestor, un lector) sin tocar el núcleo, que es la
primera acepción de "abierto".

**Lo medido**: en C2, un tipo nuevo es su ingestor (unas 80 líneas) y, si quiere, su lector [M21;
estimación: E4]; una tool genérica más hizo crecer `tools/list` un 7% [M22].

| Opción | Qué es | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | cada tipo nuevo se mete en el núcleo | cada tipo es un cambio del núcleo |
| Ingestores enchufables | un ingestor por tipo con un contrato (lee un fichero, devuelve obra y partes) | lo que hizo la E2 en dos tipos; el modelo de `MemorySource` de Cognee [S47] |
| Tipos definidos por el usuario | el usuario define tipos con sus propiedades, sin código | lo de Anytype, Capacities y Tana [S33, S42, S53]; un editor de esquema en el visor |
| Tools MCP por tipo | cada tipo trae sus tools | `tools/list` crece con cada una [M22], y un cliente IA no necesita saber qué tipos hay |

**Qué cierra y qué abre**: ingestores enchufables más tools genéricas mantienen la superficie MCP
pequeña y estable, que es lo que ve cada cliente IA; los tipos del usuario abren lo de Anytype sin
código.

**Cuánto cuesta deshacerla**: poco para los ingestores (un contrato interno); medio para los tipos
del usuario (datos de usuarios con esquemas propios).

**Recomendación: ingestores enchufables y tools genéricas ya; tipos definidos por el usuario en un
horizonte siguiente**, porque son normales en el mercado [S33, S42, S53] pero piden visor (sección 6).

**Qué decide Eneko**: si los tipos del usuario entran en el primer horizonte.

### D13 · El modelo de embeddings y su dimensión

**La pregunta**: si sigue e5-large (1.024 dimensiones) y cómo se trocea lo que no son notas.

**Lo medido**: un fragmento cuesta 1,03 s en CPU y re-embeber el corpus, unos 20 minutos [M10]; el
modelo solo ve 512 tokens, y una página media de PDF tiene 3.863 caracteres [M10]; hay dos copias del
modelo en memoria, 3,4 GB [M13]; y **trocear bien pesó más que dónde se guarda** (el código pasó de
0/2 a 1/2 solo por qué se embebe) [M19, M22].

| Opción | Qué es | Lo que cuesta |
|---|---|---|
| 0 · No hacer nada | e5-large, dos copias, y cada tipo trocea como pueda | 3,4 GB en reposo [M13] |
| e5-large con una sola copia y troceo por tipo | un servicio de embeddings compartido; cada ingestor decide qué embebe | la mitad de la huella [M13]; el troceo, dentro de D12 |
| Un modelo más pequeño | menos memoria y más rápido | hay que medir el recall con las 16 consultas antes; cambiar de dimensión obliga a re-embeber todo [M10] |
| Embeddings por API | sin modelo local | el texto sale a un tercero (D10) y cada embedding cuesta dinero |

**Qué cierra y qué abre**: guardar con cada vector el modelo que lo hizo abre cambiar de modelo
más adelante sin tirarlo todo de una vez.

**Cuánto cuesta deshacerla**: cambiar de modelo, unos 20 minutos de CPU con el corpus de hoy [M10]; con
una biblioteca de fragmentos, proporcional.

**Recomendación: e5-large, con una sola copia (la mitad de la huella) [M13], el modelo guardado junto
a cada vector y el troceo como parte de cada ingestor [M22].** Un modelo más pequeño solo después de
medirlo con las mismas 16 consultas.

**Qué decide Eneko**: nada ahora.

### La licencia

No es una de las trece: el plan la trataba como una restricción. Q3 la abrió a análisis con una
condición: es no comercial para los demás, no para Eneko.

**Lo que ya dice**: la Naeth License 1.0 (16/09/2026) permite el uso no comercial, exige atribución,
prohíbe entrenar IA y deja el uso comercial "solo con licencia escrita del titular" (Naeth
`c8ae08e4`). **Ya es una doble licencia**: la condición de Q3 se cumple con la de hoy, sin tocarla.
(Una primera versión de esta sección la presentaba como una opción nueva; se corrigió el 02/10 a las
19:44, al releer `c8ae08e4` en el checkpoint.)

| Opción | Qué es | Precedente |
|---|---|---|
| 0 · No hacer nada | la Naeth 1.0, y la licencia comercial escrita se redacta cuando alguien la pida | Anytype: código visible, gratis sin uso comercial y comercio solo en sus redes [S29] |
| Tener ya la licencia comercial | unos términos y un precio escritos para equipos, empresas y clientes | lo que hace falta para que tres de los cuatro grupos de Q3 (equipos, empresas, clientes) entren sin negociar cada vez |
| Pasar a AGPL-3.0 | libre, con obligación de publicar cambios si se ofrece como servicio | Basic Memory y Logseq [S1, S15]; incumple la condición de Q3 (cualquiera podría venderlo como servicio publicando su código) |

**Lo que cuadra con Q3**: equipos, empresas y clientes son uso comercial, así que necesitan la
licencia escrita. **Recomendación: mantener la Naeth 1.0 y tener redactada la licencia comercial antes
de abrir a esos grupos.** Lo pendiente de la nota del 16/09 sigue pendiente: una lectura en el
Servicio de Orientación Jurídica y el registro de la propiedad intelectual; y si entra otro autor,
una cesión de derechos (CLA) para que la doble licencia siga siendo posible (`c8ae08e4`).

### Cómo dependen unas de otras

- **D3 manda sobre D4, D7, D9 y D10**: un solo nodo simplifica dónde viven los ficheros, retira
  la mitad de CENIT y cambia dónde están las notas.
- **D1 y D2 son la misma decisión vista desde dos lados** (la identidad común).
- **D5 depende de Q3 y condiciona D6, D9 y la licencia**: tener a otros dentro trae espacios, purga y
  licencia comercial.
- **D11, D12 y D13 dependen de D1**: el formato, los tipos y el troceo se apoyan en la obra como
  unidad.

## 6. La estética entera

*Sub-fase 2.4: A1 a A7. A1 adelantada al 02/10/2026, 19:01; el resto, en 2.4.*

### A1 · Por qué el visor parece una copia de Obsidian

Ocho rasgos, cada uno con el sitio del visor donde vive. El lado de Obsidian se describe por su
interfaz por defecto, ⚠ sin una captura de referencia al lado; las seis vistas de Naeth están en la
M14.

| # | Rasgo | Dónde vive en Naeth | Su pareja en Obsidian |
|---|---|---|---|
| 1 | Tres columnas: árbol, contenido y una barra de iconos | `naeth/web/src/App.svelte:80` (`grid-template-columns: var(--side-w) 1fr 48px`), `components/Rail.svelte:14` | el explorador, el editor y la barra de iconos (allí a la izquierda, aquí a la derecha: el reparto es el mismo) |
| 2 | Un árbol de carpetas por ruta (`proyecto/subtema`) | `components/Sidebar.svelte:19`, `lib/tree.ts` | el explorador de ficheros de la bóveda |
| 3 | Enlaces `[[ ]]` | `lib/wikilinks.ts` (sintaxis medida en el corpus, 28/07) | su sintaxis de enlaces internos |
| 4 | Un grafo de fuerzas de todo, coloreado por grupo | `views/Graph.svelte`, `lib/sim.ts:217` | la vista de grafo |
| 5 | Un grafo local en el panel de cada nota | `components/MiniGraph.svelte:12-14` ("el mismo lienzo que el grafo grande"), `views/Memory.svelte:592` | el grafo local del panel derecho |
| 6 | Un panel de contexto con relaciones y esquema | `views/Memory.svelte:185` y `:572` | los paneles de enlaces entrantes y de esquema |
| 7 | Editor de Markdown en vivo y vista de lectura, que se alternan | `components/Milkdown.svelte`, `components/MarkdownView.svelte`, `views/Memory.svelte:80` | la vista previa en vivo y el modo lectura |
| 8 | Un buscador que se abre centrado sobre todo | `components/Header.svelte:19` | el selector rápido |

**Lo que dice A1**: el esqueleto entero (rasgos 1 a 4) es el de un **gestor de ficheros Markdown**,
y Naeth no guarda ficheros: guarda filas en Postgres con digest, autoría, cadena de versiones y
relaciones tipadas. Lo propio de Naeth vive **dentro** de la vista de una nota (rasgos 5 a 7), y lo
que más lo distingue no se ve en ninguna pantalla: el MCP, por donde entraron 682 de las 685 notas
vigentes; por el visor, 3 [M33]. El
visor cuenta un producto que no es el que hay. Lo que lo sustituye en la biblioteca ya está
decidido en los documentos de CDA ([`cda-vista-diseno-2026-09-15.md`](cda-vista-diseno-2026-09-15.md)
y [`cda-biblioteca-espacio-2026-09-21.md`](cda-biblioteca-espacio-2026-09-21.md)) y no se rehace
aquí; A2 a A7 dicen lo que falta.

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

**M33 · Por dónde entran las notas** (02/10, 19:01). La tool `memory_stats` en modo `counts`,
contra producción (solo lectura): 685 vigentes. Por autor: Claude Code 515 (`claude-opus-5` 359,
`claude-opus-5-5` 63, sin modelo 58, `claude-opus-4-8` 23, `claude-fable-5-1` 12), claude.ai 167
(sin modelo 127, `claude-opus-5` 36, `claude-opus-4-8` 4) y el visor (`naeth-web`) 3.

**M34 · Quién manda y cuándo** (02/10, 19:26). `git log --since=2026-09-21` del repo de CENIT,
commits `ownership:` (TAKEOVER del vigía, "finally cede", "local recupera"), con las horas de finally
pasadas de UTC a local. Del 22/09 a las 00:10 al 02/10 a las 17:28 (257,3 h): el PC manda 161,9 h
(62,9%) y finally 95,4 h (37,1%). TAKEOVER a las 02:10, 01:22, 20:37, 22:03, 15:43, 01:57, 02:24,
02:33, 02:07, 00:48 y 01:03; recuperaciones a las 12:04, 12:11, 21:48, 11:53, 16:00, 12:38, 12:59,
14:08, 11:23, 09:18 y 09:47.

**M35 · A qué hora se escribe** (02/10, 19:26). Producción, solo lectura: notas creadas en los
últimos 30 días por hora local (`Europe/Madrid`): 00 h 1; 11 h 7; 12 h 23; 13 h 11; 14 h 26; 15 h 15;
16 h 34; 17 h 20; 18 h 20; 19 h 18; 20 h 14; 21 h 51; 22 h 30; 23 h 17. Total 287; ninguna de la 01 a
las 10 h. Las lecturas no se pueden contar: `docker logs naeth-api-1` no tiene ninguna petición
`POST /mcp` y el contenedor arrancó el 02/10 a las 09:46.

**M36 · Loopback frente a túnel** (02/10, 19:29). 12 GET a `/healthz` por cada camino, con `curl`:
`http://127.0.0.1:8801` p50 2 ms (máximo 3); `https://memory.enraxk.dev` p50 57 ms (máximo 197),
todas 200. Ahora manda el PC, así que el túnel vuelve a esta misma máquina; con finally de único
nodo, el camino sería PC, Cloudflare y VPS: ⚠ sin medir, del mismo orden o más.

**M14 · Las vistas de hoy** (02/10, entre las 14:00 y las 14:11). Navegador integrado en `http://127.0.0.1:8801/`,
solo lectura, rutas `#/home`, `#/graph`, `#/m/<id>`, `#/new`, `#/status` y `#/settings`. Capturas
fuera del repo.

## Anexo S · Fuentes

Todas consultadas el 02/10/2026. Las de WebFetch se leyeron con una pregunta concreta; lo que la
página no decía se marca `⚠ no publicado` en la ficha, no se deduce.

| Id | Fuente |
|---|---|
| S1 | `gh api repos/<repo>` a las 18:47 para mem0ai/mem0, getzep/graphiti, getzep/zep, letta-ai/letta, basicmachines-co/basic-memory, supermemoryai/supermemory, logseq/logseq, anyproto/anytype-heart, anyproto/anytype-ts, Mintplex-Labs/anything-llm, khoj-ai/khoj, topoteretes/cognee, reorproject/reor y obsidianmd/obsidian-releases: licencia SPDX, estrellas, último push, archivado |
| S2 | https://mem0.ai/pricing |
| S3 | https://docs.mem0.ai/open-source/overview |
| S4 | https://docs.mem0.ai/platform/mem0-mcp |
| S5 | https://docs.mem0.ai/open-source/features/multimodal-support |
| S6 | https://docs.mem0.ai/platform/features/memory-export |
| S7 | https://www.getzep.com/pricing |
| S8 | https://github.com/getzep/graphiti (README) |
| S9 | `mcp_server/README.md` de getzep/graphiti, por `gh api` (WebFetch dio 503) |
| S10 | https://docs.letta.com/concepts/memfs/index.md |
| S11 | https://docs.letta.com/letta-code/pricing (redirección desde https://www.letta.com/pricing) |
| S12 | https://docs.letta.com/platform/hosted-mcp/index.md |
| S13 | https://docs.letta.com/llms.txt (índice; páginas de self-hosting, MemFS, MCP y equipos) |
| S14 | https://basicmemory.com |
| S15 | `README.md` de basicmachines-co/basic-memory, por `gh api` |
| S16 | https://supermemory.ai/pricing |
| S17 | `README.md` de supermemoryai/supermemory, por `gh api` |
| S18 | https://supermemory.ai/docs/supermemory-mcp/mcp |
| S19 | https://support.google.com/gemininotebook/answer/16215270 (redirigida desde la ayuda de notebooklm; leída en el navegador integrado, WebFetch daba 404) |
| S20 | https://support.google.com/gemininotebook/answer/16213268 (planes; navegador integrado) |
| S21 | https://obsidian.md/pricing |
| S22 | https://obsidian.md/ |
| S23 | `community-plugins.json` de obsidianmd/obsidian-releases, por `gh api`: 8.317 plugins; 56 nombran MCP en su id, nombre o descripción |
| S24 | https://obsidian.md/cli |
| S25 | `README.md` de logseq/logseq, por `gh api` |
| S26 | `gh api repos/logseq/logseq/releases`: la 2.0.1 del 13/07/2026, "Logseq 2.0 Beta (DB version)"; nightly del 02/10/2026 |
| S27 | https://logseq.io/p/e3YDyX5AYr ("Logseq is splitting into two versions", 24/04/2026) |
| S28 | https://anytype.io/pricing (navegador integrado; WebFetch no traía el contenido) |
| S29 | `LICENSE.md` de anyproto/anytype-ts, por `gh api` (Any Source Available License 1.0) |
| S30 | `gh api repos/anyproto/anytype-mcp` y su `README.md`: MIT, 526 estrellas, push el 21/09/2026 |
| S31 | https://doc.anytype.io/anytype/llms.txt (índice: tipos, exportación, self-hosting, solo local, API local) |
| S32 | https://doc.anytype.io/anytype/data/import-and-export.md |
| S33 | https://doc.anytype.io/anytype/organize/types.md |
| S34 | https://doc.anytype.io/anytype/data/sync-and-backup/self-host.md |
| S35 | `README.md` de Mintplex-Labs/anything-llm, por `gh api` |
| S36 | https://anythingllm.com/pricing |
| S37 | https://docs.anythingllm.com/mcp-compatibility/overview |
| S38 | `README.md` de khoj-ai/khoj, por `gh api` |
| S39 | `gh api repos/khoj-ai/khoj/releases` y `commits`: última versión 2.0.0-beta.28 del 26/03/2026; commits del 24/06 y del 02/08/2026 |
| S40 | https://khoj.dev (https://khoj.dev/pricing da 404) |
| S41 | https://capacities.io/pricing |
| S42 | https://docs.capacities.io/llms.txt (índice con el resumen de cada página: tipos, PDF, ficheros, audio, sin conexión, API obsoleta) |
| S43 | https://docs.capacities.io/raw/developer/model-context-protocol.md |
| S44 | https://docs.capacities.io/raw/reference/export.md |
| S45 | `README.md` de topoteretes/cognee, por `gh api` |
| S46 | https://www.cognee.ai/pricing |
| S47 | https://docs.cognee.ai/examples/migrate-memory-systems |
| S48 | https://www.notion.com/pricing (precios en euros) |
| S49 | https://developers.notion.com/docs/mcp |
| S50 | https://www.notion.com/help/export-your-content |
| S51 | https://get.mem.ai/pricing |
| S52 | https://get.mem.ai |
| S53 | https://tana.inc/pricing |
| S54 | https://heptabase.com/pricing |

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
| Q2 | 02/10 | Si añade o quita algún producto del mercado | Añade Cognee, Notion (IA y MCP) y Mem.ai, con ficha completa; no quita ninguno. Quedan 15 fichas completas y 3 de una línea (Reor, Tana, Heptabase) |
| Q3 | 02/10, 19:24 | Quiénes son los "otros", y cómo encaja con la licencia no comercial | Los cuatro grupos propuestos: personas que lo instalan, personas que lo usan alojado por Eneko, equipos y empresas, y clientes de Eneko. La licencia se abre a análisis como una decisión más, con una condición: "es no comercial para otros, no para mí" |
| Q4 | 02/10, 19:24 | Qué disponibilidad tolera si a cambio desaparecen los dos nodos | "Depende qué. Analizar más a fondo": no hay una tolerancia única; D3 la analiza por función (leer, escribir, cada cliente, el visor, la búsqueda) |
| Q4b | 02/10, 19:31 | Si lee o escribe Naeth con el PC apagado (desde claude.ai, la app o el móvil) | "Depende de dónde esté y qué pase": fuera de casa le pregunta a claude.ai con el contexto de Naeth y deja notas rápidas para luego; de madrugada no usa claude.ai |
| Q5 | | Qué es un libro cuando el contenido son notas; si quiere bocetos | |
| Q6 | | Cuántas horas por semana tiene para "Ahora" | |
