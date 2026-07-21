# Paso 6 · Esquema de datos y núcleo de Naeth (Postgres)

**Proyecto Naeth** — diseño en papel del modelo de datos canónico sobre el sustrato
decidido en `paso5-sustrato.md` (Postgres + pgvector, HNSW). Es el núcleo que usan
**las dos interfaces**: la web (humano) y MCP (agentes).

**Fecha**: 2026-05-30 · **revisado 2026-06-24** para nacer *listo para multi-master*
(implicaciones del [Paso 8](paso8-sync.md)) y *embeddings por-nodo* (del [Paso 7](paso7-local-windows.md)).
**Alcance**: esquema en papel. Tablas, índices, mecánica ADD-only, búsqueda híbrida y
cómo encaja MCP. **Sin construir** (el DDL es ilustrativo del diseño; nada se ejecuta sin
tu OK).
**Reglas**: ADD-only estricto, soberanía por export, sin LLM en escritura.

---

## 1. Principios que fijan el esquema

1. **ADD-only estricto**: nunca se destruye información. Editar y borrar **no** pisan
   datos; añaden versiones y eventos. (El reconcile por LLM destruye contexto, lo que
   descartamos.) Es la política central de Naeth.
2. **Append puro para multi-master** (revisión 2026-06-24): todo lo "mutable" del diseño
   original (reemplazo, validez, borrado) se modela como **filas-evento inmutables** en
   tablas propias (`supersession`, `tombstone`). Así sincronizar entre nodos es **unión
   de filas** en todas las tablas, sin reconciliar mutaciones in-place ([Paso 8](paso8-sync.md)).
3. **Lo derivado es caché local, no verdad ni dato sincronizado**: `is_current` (y demás
   banderas de vigencia) se **recalculan** en cada nodo a partir de las tablas-evento;
   sirven para índices parciales baratos. **No viajan** en el sync.
4. **Búsqueda híbrida local**: semántica (pgvector HNSW) + texto (tsvector) + filtros, en
   una sola query. Sin LLM, sin API.
5. **Soberanía por export**: la verdad vive en Postgres, portable (`pg_dump`, export a
   Markdown). Sin lock-in.
6. **Identidad de cliente** (hueco 4.2.6 del Paso 1): toda escritura registra quién la
   hizo (claude.ai / claude-code / web / mcp).
7. **Embedding asíncrono y por-nodo**: la escritura es barata y síncrona; el embedding
   (el coste real) va a una cola async. El modelo y la **dimensión del vector son por-nodo**
   ([Paso 7](paso7-local-windows.md)) y la columna `embedding` **no se sincroniza**.

---

## 2. Tabla núcleo: `memory`

El registro atómico, **inmutable**: cada versión es una fila; nada se sobreescribe ni se
actualiza (salvo la caché derivada local y el relleno async del embedding).

| Columna | Tipo | Significado |
|---|---|---|
| `id` | uuid PK | identidad de esta versión |
| `content_hash` | text | sha256 del contenido (idempotencia/dedup en alta) |
| `title` | text | título legible |
| `content` | text | el cuerpo de la memoria |
| `memory_type` | text | ontología extensible (observation, decision, learning, error, ...) |
| `tags` | text[] | etiquetas |
| `path` | text | jerarquía lógica ("carpeta" para el árbol, ej. `naeth/decisiones`) |
| `metadata` | jsonb | extensible (lo que no merezca columna propia) |
| `embedding` | vector(N) | **dimensión por-nodo** (bge-m3 1024 / e5-small 384); nulo hasta que la cola async lo rellena; **no se sincroniza** |
| `tsv` | tsvector | generado de `title`+`content` para FTS |
| `source_client` | text | quién lo escribió (claude.ai / claude-code / web / mcp:*) |
| `created_at` | timestamptz | alta de esta versión (orden + desempate por `id`) |
| `valid_from` | timestamptz | desde cuándo es válida (temporal ligero, sin LLM) |
| `is_current` | bool | **caché derivada local**: no superseded ni tombstoned; recomputada, **no sincronizada** |

> **Qué cambió respecto a 2026-05-30**: se quitaron `supersedes`, `valid_to` y
> `deleted_at` de la fila. El reemplazo vive en `supersession` (§3), el borrado en
> `tombstone` (§4), y la vigencia es `is_current` (caché). `embedding` pasa de `vector(384)`
> fijo a `vector(N)` por-nodo. La fila `memory` queda **100% inmutable** salvo el relleno
> async del embedding (local) y la recomputación de `is_current` (caché local).

**Mecánica ADD-only** (todo es INSERT):

- **Crear** = `INSERT` en `memory`. Si `content_hash` ya existe y está vigente, idempotente.
- **Editar** = `INSERT` de la versión nueva en `memory` + `INSERT` en `supersession`
  (`child` = nueva, `parent` = anterior). La anterior **permanece**; pasa a `is_current=false`.
- **Borrar** = `INSERT` en `tombstone` (`target` = la fila). La fila **permanece**;
  `is_current=false`.
- **Fundir ramas** ([Paso 8](paso8-sync.md) §5) = `INSERT` de la versión fusión + `INSERT`
  en `supersession` con **una fila por cada rama padre**. Resuelve el conflicto sin perder
  ninguna rama.

**Vista de lo vigente** (la verdad, derivada de las tablas-evento):

```sql
CREATE VIEW memory_current AS
SELECT m.* FROM memory m
WHERE NOT EXISTS (SELECT 1 FROM tombstone t WHERE t.target_id = m.id)
  AND NOT EXISTS (SELECT 1 FROM supersession s WHERE s.parent_id = m.id);
-- is_current cachea exactamente este predicado para los índices parciales (§7).
```

El historial completo queda consultable recorriendo `supersession` hacia atrás; "¿qué
decidí antes sobre X?" no necesita LLM ni grafo de entidades (temporal ligero).

---

## 3. Tabla `supersession` (versionado, append-only)

El reemplazo entre versiones, como aristas inmutables (antes era la columna `supersedes`).
**Permite varios padres** para poder fundir ramas de conflicto ([Paso 8](paso8-sync.md)).

```
id uuid PK · child_id uuid → memory · parent_id uuid → memory
created_at timestamptz · source_client text
```

- Una edición normal añade **una** fila (`child` reemplaza a un `parent`).
- Una **fusión** añade **N** filas con el mismo `child` y distintos `parent` (una por rama).
- `parent_id` con **más de un `child` vigente** = **conflicto de rama** (dos ediciones
  offline de la misma versión); se detecta y se marca para fundir:

```sql
SELECT s.parent_id, array_agg(s.child_id) AS ramas
FROM supersession s JOIN memory_current c ON c.id = s.child_id
GROUP BY s.parent_id HAVING count(*) > 1;
```

---

## 4. Tabla `tombstone` (borrados, append-only y unificada)

El borrado lógico como evento inmutable (antes era la columna `deleted_at`). Unificada
para `memory` y `relation`.

```
id uuid PK · target_id uuid · target_kind text (memory | relation)
created_at timestamptz · source_client text
```

- "Borrado" = **existe** una fila `tombstone` para ese `target_id`. Nunca hay `DELETE`
  físico ni `UPDATE`.
- Sincroniza por unión como cualquier otra tabla; al reconciliar, la unión de tombstones
  es idempotente (un borrado en cualquier nodo gana, monotónico).

---

## 5. Tabla `relation` (aristas explícitas del grafo)

```
id uuid PK · source_id uuid → memory · target_id uuid → memory
predicate text (links_to, depends_on, ...) · metadata jsonb
source_client text · created_at timestamptz
```

- ADD-only: las relaciones **no** se borran in-place; se registran en `tombstone`
  (`target_kind='relation'`). Vigente = `NOT EXISTS` tombstone para su `id`.
- Recorrido de vecindad (foco + N saltos) con `WITH RECURSIVE` + índices en
  `source_id`/`target_id`.
- **Las aristas semánticas NO se almacenan aquí**: se calculan **bajo demanda** con
  pgvector kNN (2-4 ms a 1M, medido). El grafo "qué se parece" pide las K vecinas del
  nodo en foco, sin materializar millones de aristas.

---

## 6. Tabla `attachment` (q6: HTML, PDF, cualquier archivo)

```
id uuid PK · memory_id uuid → memory (el sidecar que lo representa)
filename text · mime text · size_bytes bigint · sha256 text
storage_path text (ruta en el volumen LUKS; los BYTES no van en Postgres)
extracted_text text (PDF/HTML → texto; alimenta el content/tsv/embedding del sidecar)
source_client text · created_at timestamptz
```

- El **binario vive en disco** (volumen LUKS), no en la BD (evita bloat).
- Cada adjunto genera un **sidecar `memory`** (content = texto extraído) → entra en
  búsqueda, embedding y grafo como un nodo más.
- Extracción: PDF con PyMuPDF, HTML con trafilatura, texto plano inline; imágenes →
  metadatos (OCR opcional más adelante).
- **Sync** ([Paso 8](paso8-sync.md)): la fila `attachment` viaja por unión; el **binario**
  se replica content-addressed por `sha256` (transferir faltantes, dedup).

---

## 7. Tabla `job` (cola de escritura async) — **local, no se sincroniza**

```
id bigserial PK · kind text (embed | extract | ...) · memory_id uuid
status text (pending|processing|done|error) · attempts int
created_at · started_at · finished_at · error text
```

- Tras un `INSERT` en `memory`, se encola `job(kind='embed')`. Un worker lo toma, genera
  el embedding en CPU y hace `UPDATE memory SET embedding = ...` (mutación **local**, no
  sincronizada).
- `bigserial` es local a cada nodo; la cola **no se sincroniza**: cada nodo regenera sus
  propios embeddings con su modelo ([Paso 7](paso7-local-windows.md) §8).
- Da observabilidad (el visor lee de aquí) y reintentos. Desfase = `finished_at - created_at`.

---

## 8. Índices

```sql
-- semántico: HNSW solo sobre lo vigente y ya embebido (usa la caché is_current)
CREATE INDEX ON memory USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL AND is_current;
-- texto completo
CREATE INDEX ON memory USING gin (tsv);
-- etiquetas
CREATE INDEX ON memory USING gin (tags);
-- árbol / jerarquía y orden temporal
CREATE INDEX ON memory (path);
CREATE INDEX ON memory (created_at);
-- tablas-evento (vigencia y sync)
CREATE INDEX ON supersession (parent_id);
CREATE INDEX ON supersession (child_id);
CREATE INDEX ON tombstone (target_id);
-- recorrido del grafo
CREATE INDEX ON relation (source_id);
CREATE INDEX ON relation (target_id);
-- cola
CREATE INDEX ON job (status) WHERE status = 'pending';
```

> El índice parcial HNSW usa `is_current` (caché local de la propia fila) porque un
> predicado de índice parcial no puede referenciar otras tablas. Por eso `is_current`
> existe como caché derivada (no como verdad): se recomputa tras cada edición/borrado/sync.

**Tuning de construcción del HNSW** (medido en el spike del Paso 5; solo afecta al BUILD,
no a las queries):

- `maintenance_work_mem = 2GB` (default 64 MB): si el grafo en construcción cabe en esta
  memoria, se ensambla en RAM. Subirlo dio **build 7,4× más rápido Y p95 de query 2,7×
  mejor**. Es **por conexión**: ponerlo antes del `CREATE INDEX` y `RESET` después. Regla:
  `n × (dim×4 + M×8)` bytes — **ojo: con bge-m3 (1024-dim) en el nodo local el grafo ocupa
  ~2,7× más que con 384-dim**, recalcular el `maintenance_work_mem` en ese nodo.
- `max_parallel_maintenance_workers = 4` (default 2): limitado por `max_parallel_workers`
  y `max_worker_processes` del server; ajustar a cores reales.
- **Docker `--shm-size=8g`** (o `--ipc=host`): el build paralelo usa `/dev/shm`; 64 MB por
  defecto provoca un `DiskFull` engañoso. **Crítico en local (Docker Desktop) y en `finally`.**
  En compose: `shm_size: 8gb`.

En uso ADD-only incremental, HNSW indexa por inserción; el rebuild completo solo hace falta
en una importación masiva (o al cambiar de modelo de embeddings en un nodo).

> **Caveat de medición**: el spike midió **latencia** con vectores sintéticos
> (`hnsw.ef_search=100`), no **recall** real. La calidad con embeddings reales (bge-m3 en
> local, e5-small en `finally`) y el eje latencia-vs-recall de `ef_search` quedan por
> verificar con datos reales (fases 1-2 del [Paso 7](paso7-local-windows.md)). No bloquea el diseño.

---

## 9. Búsqueda híbrida (una sola query)

Semántica + texto + filtros, fusionadas con Reciprocal Rank Fusion (RRF):

```sql
WITH sem AS (
  SELECT id, row_number() OVER (ORDER BY embedding <=> :q) AS r
  FROM memory_current WHERE embedding IS NOT NULL ORDER BY embedding <=> :q LIMIT 50
),
txt AS (
  SELECT id, row_number() OVER (ORDER BY ts_rank(tsv, plainto_tsquery(:kw)) DESC) AS r
  FROM memory_current WHERE tsv @@ plainto_tsquery(:kw) LIMIT 50
)
SELECT m.*, (1.0/(60+sem.r) + 1.0/(60+txt.r)) AS score
FROM memory_current m
LEFT JOIN sem ON sem.id = m.id
LEFT JOIN txt ON txt.id = m.id
WHERE sem.id IS NOT NULL OR txt.id IS NOT NULL
ORDER BY score DESC LIMIT :k;
```

La query embebe `:q` con **el modelo de ESTE nodo** (consistencia interna por-nodo).
Filtros estructurados (path, tags, fechas, source_client) se añaden con `WHERE` normal.

---

## 10. Cómo encaja MCP (la otra interfaz)

El núcleo no sabe si lo llama la web o un agente: ambos pasan por la **misma API**
(FastAPI) que impone ADD-only. Herramientas MCP v1 ([Paso 7](paso7-local-windows.md) §4):
`memory.add`, `memory.search`, `memory.get`, `memory.supersede`, `memory.tombstone`,
`relation.add`, `relation.list`, `system.status`. **No hay editar/borrar destructivo**:
"editar" = añadir versión + supersession; "borrar" = tombstone. La política vive en el
núcleo, no en cada cliente.

---

## 11. Listo para multi-master (resumen para el Paso 8)

| Tabla | ¿Se sincroniza? | Cómo |
|---|---|---|
| `memory` (sin embedding) | **Sí** | unión por `id`; filas inmutables |
| `supersession` | **Sí** | unión por `id`; append puro |
| `tombstone` | **Sí** | unión por `id`; append puro, idempotente |
| `relation` | **Sí** | unión por `id` |
| `attachment` (filas) | **Sí** | unión; binario por `sha256` aparte |
| `memory.embedding` | **No** | por-nodo; cada nodo lo regenera |
| `memory.is_current` | **No** | caché derivada local; recomputada |
| `job` | **No** | cola local |

Mecanismo, conflictos y fases: [Paso 8](paso8-sync.md).

---

## 12. Lo que NO decide este documento

- El código (DDL real, migraciones, API): es el build, con tu OK.
- El modelo de embeddings exacto por nodo (bge-m3 local / e5-small `finally`; confirmable
  en deploy — [Paso 7](paso7-local-windows.md)).
- Particionado/sharding: innecesario a escala personal (1M va sobrado); se revisa si llega.
- El detalle de la extracción de cada tipo de archivo (se concreta al construir q6).

---

**Fin del Paso 6 (esquema en papel, revisado para multi-master).** Encaja con: ADD-only
append puro, búsqueda híbrida local, adjuntos (q6), cola async observable, identidad de
cliente, temporal ligero sin LLM, y **sync por unión de filas** ([Paso 8](paso8-sync.md)).
