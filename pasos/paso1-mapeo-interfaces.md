# Paso 1 · Mapeo de interfaces e integrabilidad

**Proyecto Naeth** — investigación documental de los 5 sistemas de memoria persistente OSS top del ranking previo (`investigacion.md`).

**Fecha**: 2026-05-21
**Alcance**: análisis documental puro. Sin instalación, sin spike, sin benchmarks. Solo lectura de READMEs, código en GitHub, papers, issues y releases.
**Objetivo**: decidir si los 5 sistemas son "buenos ciudadanos" en una arquitectura compuesta o son "cajas cerradas que quieren dueñar el stack". Output que alimentará el Paso 2 (diseño de arquitectura).
**Reglas autoimpuestas**:
1. Cero install.
2. Citar evidencia (archivo, issue, sección de paper) en claims no triviales.
3. Marcar `⚠ sin verificar` cuando algo no se confirma desde docs/código.
4. **No re-rankear** (eso está en `investigacion.md`). **No recomendar arquitectura** (eso es Paso 2). **No escribir código** (eso es Paso 3+).
5. Separar "lo que dice el README" de "lo que muestra el código" cuando hay discrepancia.

---

## 1. Resumen ejecutivo

### Tabla maestra de integrabilidad

| # | Sistema | Licencia real | API no-MCP | Import/export | Write-through externo | Concurrencia segura | Idea robable principal |
|---|---------|---------------|-----------|---------------|----------------------|---------------------|------------------------|
| 1 | **mcp-memory-service** | Apache-2.0 | REST FastAPI (76 endpoints) + CLI + SDK Python | Sí (`memory_ingest` + scripts migración) | **No** — siempre regenera embedding | Buena (WAL + doble lock) | Tool annotations + backends conmutables tras ABC `MemoryStorage` |
| 2 | **Hindsight** | MIT (⚠ sub-paquetes a auditar) | REST `/v1` + SDK Py/TS + Helm chart | Solo vía `pg_dump` (sin export REST) | **No** — pipeline `cognify` obligatorio | ACID Postgres + worker slots | Stack TEMPR (4 retrievers paralelos) + RRF + cross-encoder reranker |
| 3 | **Cognee** | Apache-2.0 | REST + SDK Py + CLI + Vercel adapter + Rust SDK | Ingesta 30+ connectors; sin export REST canónico ⚠ | **Parcial** — DataPoints permiten saltar `extract_graph` | Eventual entre 3 stores (sin tx distribuida) | Plugin Claude Code con 5 hooks de session lifecycle |
| 4 | **Basic Memory** | **AGPL-3.0** | REST FastAPI v2 (10 routers) + CLI Typer | **Trivial — el storage es Markdown en disco** | **Sí, nativo** — `watchfiles` reindexa al detectar archivo nuevo | Last-write-wins (sin file locks) | Storage = MD legible por humanos + wikilinks como grafo emergente |
| 5 | **Graphiti** | Apache-2.0 | REST FastAPI + SDK Python `graphiti-core` | Sin export propio (vía backend: `neo4j-admin dump`) | **No** — LLM obligatorio en `add_episode` | ACID del backend + dedup con LLM (race-prone) | Bi-temporalidad explícita `valid_at`/`invalid_at` + episodes con provenance |

### Patrones binarios (qué tienen y qué no)

| Capacidad | mcp-memory-service | Hindsight | Cognee | Basic Memory | Graphiti |
|---|:---:|:---:|:---:|:---:|:---:|
| MCP server first-class | ✅ | ✅ | ✅ | ✅ | ✅ |
| REST/HTTP API estable | ✅ | ✅ | ✅ | ✅ | ✅ |
| SDK Python | ✅ | ✅ | ✅ | (CLI) | ✅ |
| SDK JS/TS | ❌ | ✅ | ✅ (Vercel) | ✅ (port openclaw MIT) | ❌ |
| Tool annotations FastMCP | ✅ sistemático | ⚠ no verificado | ⚠ no verificado | ✅ sistemático | ⚠ no verificado |
| Embedding pre-computado externo aceptado | ❌ (regenera siempre) | ❌ | ❌ (parcial vía DataPoints) | n/a (FTS+vector local) | ❌ |
| Hooks/eventos al escribir | Solo SSE dashboard | Operations API (polling) + webhooks ⚠ | ❌ pipeline hooks formales | File watcher bidireccional | ❌ |
| Storage soberanía (human-readable) | ❌ (SQLite opaco) | ❌ (Postgres) | ❌ (poly-store) | ✅ (Markdown disco) | ❌ (Neo4j/Falkor/Kuzu) |
| Razonamiento temporal nativo | Parser NL + `memory_recall` | Temporal facts table | `SearchType.TEMPORAL` | Frontmatter dates | ✅ bi-temporalidad real |
| Multi-tenant nativo | `X-Agent-ID` | Schema-per-tenant + banks | NodeSets + Datasets | `list_workspaces` | `group_id` namespacing |
| Backend conmutable | ✅ (SQLite-vec/Chroma/CF/Milvus) | ✅ (PG/AlloyDB/Oracle) | ✅ (poly-store por capa) | ❌ (Markdown obligatorio) | ✅ (Neo4j/Falkor/Kuzu) |
| Embeddings 100% local sin API | ✅ (sentence-transformers/ONNX) | ✅ (vía Ollama) | ✅ (vía Ollama) | ✅ (fastembed local) | ✅ (vía Ollama + BGE) |
| LLM obligatorio en path escritura | ❌ | ✅ (extract+cognify) | ✅ (cognify) | ❌ | ✅ (extract+resolve) |
| Multi-cliente concurrente probado | Caveat docs WAL | ✅ (worker slots) | ⚠ LanceDB tiene conflicts | LWW filesystem | ACID backend |
| Bus factor visible | **1** (single maintainer) | Vectorize Inc. | 80+ contributors | basicmachines-co (~16 watchers) | Equipo Zep |

### Veredictos de integrabilidad (1 frase cada uno)

- **mcp-memory-service**: ciudadano técnicamente correcto pero territorialmente expansivo — quiere ser store-of-record único; bus factor 1 es riesgo a vendor en fork.
- **Hindsight**: quiere ser **EL** backend porque su valor está en el stack TEMPR conjunto; viable como caja-negra federada detrás de router, no como librería de componentes sueltos.
- **Cognee**: se vende como framework pero internamente es library modular; aceptable como "servicio especializado en KG generation" si te ahorras el plugin y el MCP server.
- **Basic Memory**: **el más buen ciudadano del top** — su storage *es* el filesystem, lo que permite que Naeth y Basic Memory escriban a los mismos archivos sin pedir permiso.
- **Graphiti**: integrable como "capa de razonamiento temporal delegada", pero *quiere* ser fuente de verdad porque su modelo asume ingesta de episodes crudos; delegar solo temporal implica duplicar storage.

---

## 2. Fichas técnicas por sistema

### 2.1 mcp-memory-service (doobidoo)

#### Datos básicos
- **Repo**: `https://github.com/doobidoo/mcp-memory-service`
- **Licencia**: **Apache 2.0** (confirmado leyendo `LICENSE` en `main`: "Apache License Version 2.0, January 2004"; copyright Heinrich Krupp, 2024). El badge del README también dice Apache 2.0; la mención cruzada a "MIT" que aparecía en `investigacion.md` se debe a contexto comparativo con MemPalace, no a doble licencia real.
- **Versión actual**: `v10.63.0` (20-May-2026); paquete PyPI `mcp-memory-service==10.63.0`. 333 releases totales.
- **Último commit**: sobre el día de la última release (20-May-2026).
- **Stars**: ~1.9k. **Forks**: 286. **Issues abiertos**: 7.

#### Superficie de integración
- **MCP tools (~18 modernas + capa `compat.py` con aliases legacy)**. El README dice "24 tools" pero el código real en `server_impl.py` registra ~18; la diferencia son aliases. Confirmadas: `memory_store`, `memory_store_session`, `memory_search`, `memory_list`, `memory_delete`, `memory_update`, `memory_cleanup`, `memory_health`, `memory_stats`, `memory_consolidate` (condicional a `CONSOLIDATION_ENABLED`), `memory_ingest`, `memory_harvest`, `memory_recall` (temporal NL), `memory_graph`, `memory_maintain`. ⚠ las 3-4 restantes no verificadas por nombre exacto.
- **Tool annotations**: `readOnlyHint=True` y `destructiveHint=True` aplicados explícitamente.
- **REST HTTP API**: FastAPI/uvicorn. Puerto **8000** (HTTP) y **8765** (MCP SSE remoto). README presume "76 endpoints". Auth: API keys, **OAuth 2.1 con Dynamic Client Registration**, header `X-Agent-ID` por agente, `MCP_ALLOW_ANONYMOUS_ACCESS=true` para abrir.
- **CLI**: entry points `memory`, `memory-server`, `mcp-memory-server` con `launch|server|info|health|logs|stop`.
- **SDK Python**: en `src/.../api/client.py` + `sync_wrapper.py`. **No hay SDK JS oficial.**
- **Dashboard web**: React, 8 pestañas (Dashboard/Search/Browse/Documents/Manage/Analytics/Quality/API Docs); WebSocket + SSE para eventos en vivo.
- **Estabilidad**: estables = SQLite-vec, Cloudflare, Hybrid, REST, MCP stdio, dashboard. Reciente = Milvus (v10.40 abr-2026 → v10.63 fixes). Deprecado = ChromaDB (movido a `docs/archive/` desde v10.38).

#### Modelo de datos
Clase `Memory` (`src/mcp_memory_service/models/memory.py`):

| Campo | Tipo | Default |
|---|---|---|
| `content` | str | requerido |
| `content_hash` | str | requerido (id natural) |
| `tags` | List[str] | `["untagged"]` |
| `memory_type` | Optional[str] | None (validado contra `MemoryTypeOntology`) |
| `metadata` | Dict[str, Any] | `{}` extensible |
| `embedding` | Optional[List[float]] | None |
| `created_at` / `updated_at` | float (unix) | `time.time()` |
| `created_at_iso` / `updated_at_iso` | str | ISO8601 derivado |
| `timestamp` | datetime | legado |

- **ID**: `content_hash` externo; no hay UUID interno. Tabla SQLite usa `id INTEGER PK AUTOINC` + `content_hash TEXT UNIQUE` con `deleted_at` (soft-delete desde v8.64).
- **Metadata extensible**: dict libre + propiedades SHODH (`quality_score`, `credibility`, `emotion`, `emotional_valence/arousal`, `episode_id`, `sequence_number`, `source_type`).
- **Ontología**: 9–12 tipos base (`observation`, `decision`, `learning`, `error`, `pattern`, `planning`, `ceremony`, `milestone`, `stakeholder`, `meeting`, `research`, `communication`) con subtipos. Extensible vía env var `MCP_CUSTOM_MEMORY_TYPES` (JSON).

#### Operaciones de escritura
- **Embedding pre-computado: NO en flujo normal.** `sqlite_vec.py:_generate_embedding(memory.content)` siempre regenera. Solo se aceptan embeddings externos vía `MCP_EXTERNAL_EMBEDDING_URL` (Ollama/vLLM/TEI/OpenAI-compatible) — el servidor llama, no recibe el vector ya hecho por un cliente. **⚠ Esto es un cuello de botella para arquitecturas federadas que quieran un embedding canónico compartido.**
- **Hooks/eventos**: SSE en el dashboard publica notificaciones cuando un agente almacena/elimina. **No hay webhooks HTTP salientes**, ni MCP notifications documentadas, ni log file estructurado pensado para `tail -f` externo.
- **Idempotencia/dedup**: exact-match por `content_hash UNIQUE` + dedup semántico opcional (KNN dentro de ventana temporal, umbral cosine 0.85). Parámetro `skip_semantic_dedup` por llamada.
- **Transaccionalidad**: SAVEPOINT por escritura con nombre único `store_{rand}` envolviendo INSERT en `memories` + `memory_embeddings`.

#### Operaciones de lectura
- **Semantic**: `retrieve()` KNN cosine sobre tabla `memory_embeddings` (sqlite-vec `vec0`).
- **Hybrid (BM25 + vector)**: `retrieve_hybrid()` con RRF o weighted average sobre FTS5.
- **Tag-based**: `search_by_tag()` con LIKE ESCAPE + filtro temporal; `tag_match=any|all` desde v10.54.
- **Temporal NL**: `memory_recall` con parser de expresiones temporales en lenguaje natural.
- **Por tipo**: `search_by_memory_type()` paginada.
- **Graph traversal**: `memory_graph` (tool MCP) + `storage/graph.py` y `milvus_graph.py`; transitive inference anunciada para v10.66 (unreleased) ⚠.
- **Formato respuesta**: JSON simplificado con `content`, `content_hash`, `tags`, `memory_type`, `metadata`, `created_at_iso`, `updated_at_iso`, `score`/`distance`, opcionalmente `embedding`.
- **Logging de queries**: ⚠ sin verificar; `_sanitize_log_value` existe en `operations.py`.

#### Import/export
- **`memory_ingest`**: import de documentos/directorios con chunking (PDF, MD, TXT y otros — lista exacta ⚠).
- **JSONL**: parseo confirmado para "JSONL transcript parsing" (Kiro/Claude Code session harvest).
- **JSON/Markdown**: soportados vía ingestion; **CSV no documentado**.
- **Migración entre backends**: scripts en `scripts/migration/` (p.ej. `migrate_to_cloudflare.py`); no es swap caliente.
- **Roundtrip lossless**: ⚠ no documentado explícitamente.
- **SHODH UMAS v1.0.0**: el README lo afirma pero **no encuentro la spec ni en `docs/` ni en wiki ni en `docs/integrations.md` ni en `docs/memory-ontology.md`**. La compatibilidad parece traducirse a "respetar los campos schema" más que a un contrato versionado publicado. ⚠ sin verificar dónde vive la spec.

#### Concurrencia y consistencia
- `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL` (sqlite_vec.py).
- Doble lock de aplicación: `asyncio.Lock` (SAVEPOINT por corrutina) + `threading.Lock` (proteger ext C `sqlite-vec` de segfaults).
- **Consistencia**: last-write-wins por `content_hash`; sin CRDT ni version vectors. `memory_update` versionado anunciado para v10.66 ⚠.
- **Multi-cliente**: troubleshooting menciona "database is locked under concurrent HTTP + MCP access" mitigado con WAL activo. Hybrid/Cloudflare resuelven multi-device. Concurrencia 3+ clientes contra SQLite-vec puro no estresada en docs ⚠.

#### Dependencias de runtime
- **Python ≥3.10**.
- Pesadas default: `torch>=2.0.0`, `sentence-transformers>=2.2.2`, `sqlite-vec>=0.1.0`, `fastapi`, `mcp>=1.8.0,<2.0.0`, `apscheduler`. ~33 deps directas.
- Extras: `dev`, `ml` (wandb), `sqlite` (onnxruntime), `sqlite-ml`, `milvus`, `full`.
- **Imagen `:quality-cpu`**: solo `onnxruntime`, **sin PyTorch en runtime**. Modelos pre-exportados a ONNX en build (`ms-marco-MiniLM-L-6-v2`, `nvidia-quality-classifier-deberta`).
- **Footprint** ⚠: full-fat con torch ≳ 2–3 GB; `:quality-cpu` ≲ 500 MB. RAM ~300–600 MB idle.

#### Estado del upstream
- **Cadencia altísima**: 27+ releases en mayo 2026 (10.41 → 10.63), 6 en abril. ~3–5 días por release.
- **Breaking changes recientes**: v10.47.2 (consolidation default `disabled`), v10.59.1 (OAuth `state` sin sanitizar — rompe clientes), v10.56.1 (`session_id` salta dedup semántico), v10.38+ (ChromaDB removido), v10.40 (Milvus añadido).
- **Bus factor: 1**. `doobidoo` con ~2298 commits; siguiente top contributor con ~36. Últimos 3 meses ~6 logins únicos (incluyendo dependabot). **Esencialmente single-maintainer**.
- **Issues**: solo 7 abiertos, ninguno bug crítico (#732 reasoning, #909 LLM harvest, #922 pymilvus 3.x migration, #669 external embeddings en Cloudflare/hybrid). Gestión muy limpia (o agresiva).

#### Veredicto de integrabilidad
Es un **ciudadano técnicamente correcto pero territorialmente expansivo**. La ABC `MemoryStorage` (11 métodos + 2 propiedades) es una superficie limpia para añadir backends custom, y `factory.py` selecciona backend por env var. Sin embargo asume que **él** computa el embedding, **él** gestiona la consolidación, **él** sirve el dashboard, **él** define la ontología, **él** es el broker MCP — no hay webhooks salientes ni MCP notifications que permitan a otro sistema reaccionar a una escritura sin polling. Funciona bien como **store-of-record único** detrás de adaptadores, o como **uno de varios backends federados** si Naeth implementa la interfaz `MemoryStorage` en un wrapper. No funciona como pieza igualitaria en pipeline cuando otra herramienta quiere imponer embeddings/IDs. El ritmo 3-días/release + bus factor 1 → riesgo a forkear; mejor integrar vía REST/MCP estable.

#### Ideas robables
1. **Tool annotations sistemáticas por tool MCP** (`readOnlyHint`/`destructiveHint`): permite policies de aprobación diferenciadas por destructividad. Replicar desde día uno.
2. **Backends conmutables tras ABC mínima** (`MemoryStorage`, 11 métodos) + `factory.py` env-var-selectable. Hybrid (local+cloud) emerge como composición trivial.
3. **Imagen Docker `:quality-cpu` con ONNX runtime sin PyTorch**: reduce footprint un orden de magnitud sin sacrificar inferencia. Dos imágenes oficiales (full/cpu-quality) con misma API.
4. **Ontología validada + extensible vía env var** (`MCP_CUSTOM_MEMORY_TYPES`): combina rigor (tipos coercionados con warning) con apertura (subtipos custom registrables). Mejor que metadata-libre y mejor que enum cerrado.
5. **Triada de operaciones de alto nivel** sobre el mismo store: `memory_recall` con parser NL temporal + `memory_graph` con transitive inference + `memory_consolidate` dream-inspired. Es la idea de "no solo CRUD vectorial".
6. **(Bonus) Dashboard con SSE para "ver memorias entrando en vivo"** — UX de confianza cuando varios agentes escriben en paralelo.

---

### 2.2 Hindsight (Vectorize)

#### Datos básicos
- **Repo**: `github.com/vectorize-io/hindsight`. Benchmarks separados: `github.com/vectorize-io/hindsight-benchmarks`.
- **Licencia**: **MIT**, `Copyright (c) 2025 Vectorize AI, Inc.` (confirmado en `/LICENSE` del repo principal). ⚠ el sub-paquete `hindsight-api` aparece referenciado como Apache 2.0 en una vista de README; auditar archivo a archivo antes de redistribuir.
- **Versión actual**: **v0.6.2** (14-may-2026).
- **Actividad**: ~1.388 commits en `main`. Cadencia semanal/semi-semanal (v0.5.3 17-abr → v0.6.2 14-may = 6 releases en 4 semanas).
- **Stars**: ~14.000, ~801 forks, 42 watchers.
- **Stack**: Python 71%, TypeScript 16%, Rust 3%.

#### Superficie de integración
- **MCP server**: habilitado por defecto, montado en `/mcp` del API server (puerto 8888). Por bank: `http://localhost:8888/mcp/{bank_id}/`. Transport HTTP. Binario aparte `hindsight-local-mcp` con stdio para Claude Desktop.
- **MCP tools**: 26 en single-bank, 29 en multi-bank: `retain`, `recall`, `reflect`, `create_mental_model`, `list_mental_models`, `get_mental_model`, `update_mental_model`, `delete_mental_model`, `refresh_mental_model`, `list_directives`, `create_directive`, `delete_directive`, `list_memories`, `get_memory`, `list_documents`, `get_document`, `delete_document`, `list_operations`, `get_operation`, `cancel_operation`, `list_tags`, `get_bank`, `update_bank`, `delete_bank`, `clear_memories`. Multi-bank añade `list_banks`, `create_bank`, `get_bank_stats`.
- **REST API** (puerto 8888): base `http://localhost:8888/v1/{tenant}/banks/{bank_id}/…`. Endpoints: `POST /memories/retain`, `POST /files/retain`, `POST /memories/recall`, `POST /reflect`, `GET /memories/list`, `GET /entities`, `GET /documents`, `GET/POST /banks`, `GET /banks/{id}/stats`, `POST /consolidate`, `GET /operations`, `GET /operations/{id}`.
- **SDKs**: Python `hindsight-client` (PyPI) y Node/TS `@vectorize-io/hindsight-client` (npm). Modo embebido Python `HindsightServer`.
- **Claude Code hooks**: integración first-class (v0.5.4 `user_id` template variables; v0.6.1 resolución por git worktree). ⚠ lista exacta de hooks no verificada.
- **Agent Skill**: `npx skills add https://github.com/vectorize-io/hindsight --skill hindsight-docs`.
- **Helm chart**: `helm/hindsight/` en el repo.
- **Postgres**: embedded `pg0` por defecto (volumen `/home/hindsight/.pg0`) o externo vía `HINDSIGHT_API_DATABASE_URL`. v0.6.0 añadió **Oracle 23ai** con Alembic unificado; v0.6.1 añadió **AlloyDB ScaNN**.
- **Variables de entorno principales**: `HINDSIGHT_API_LLM_PROVIDER` (`openai|anthropic|gemini|groq|ollama|lmstudio|minimax`), `HINDSIGHT_API_LLM_API_KEY`, `HINDSIGHT_API_LLM_MODEL` (default `gpt-4o-mini`), `HINDSIGHT_API_DATABASE_URL`, `HINDSIGHT_API_PORT` (8888), `HINDSIGHT_API_HOST` (0.0.0.0), `HINDSIGHT_DB_PASSWORD`.

#### Modelo de datos
Tablas Postgres documentadas (DeepWiki + README): `memories`, `entities`, `relations`, `temporal_facts`, `mental_models`, `banks`, `sessions`, `documents`, `opinions`. Aislamiento multi-tenant a nivel de **schema Postgres** vía variable de contexto `_current_schema`. Por tenant N banks.

⚠ Lista de tablas no leída directamente de los archivos Alembic; viene de DeepWiki + README. El paper organiza la memoria conceptualmente en **cuatro redes lógicas**: world facts, agent experiences, synthesized entity summaries (mental models), y evolving beliefs (opinions) — mapea con las tablas.

**Indexación vectorial**: pgvector default (embedded pg0); AlloyDB ScaNN (v0.6.1); Oracle 23ai vector index (v0.6.0). Embeddings configurables por provider — sin embedding propio empaquetado. ⚠ modelo de embedding por defecto sin verificar.

**Identificadores**: `bank_id`, `memory_id`, entity canonical IDs; `document_id` session-scoped desde v0.5.3. Metadata: tags, timestamps temporal anchors, entity/relation links, mental-model linkage, "disposition traits" que afectan formación de opiniones.

#### Operaciones de escritura
- **API REST**: `POST /v1/{tenant}/banks/{bank_id}/memories/retain` (batch texto) y `POST .../files/retain` (documento con parse async). MCP equivalente: tool `retain`.
- **Embedding externo aceptado**: ⚠ no documentado un endpoint para inyectar `embedding` precomputado. Flujo estándar exige pasar por el pipeline interno; quien quiera usar Hindsight como "vector store puro" tendrá que bypassear el API e ir a Postgres directo (rompiendo invariantes).
- **Pipeline interno** (3 fases, DeepWiki):
  1. **Extraction** — LLM parsea contenido en atomic facts con metadata entidad/temporal.
  2. **Cognify** — consolidación en background por `hindsight-worker` que sintetiza observaciones.
  3. **Indexing + Graph construction** — embeddings al índice vectorial + aristas del grafo de entidades.
  Endpoint expuesto: `POST /consolidate` para forzar el paso de cognify.
- **Hooks/eventos**: cognify es async, observable vía `GET /operations`. Webhooks listados en navegación (`/developer/api/webhooks`) pero sin detalle — ⚠ eventos publicados sin verificar.
- **Multi-tenancy/multi-user**: nativo. Schema por tenant + banks. v0.5.4 añadió `user_id`. Path `/v1/{tenant}/banks/{bank_id}/…` explícito.

#### Operaciones de lectura
- **Las 4 estrategias en paralelo (TEMPR)**: Semantic (vector pgvector), Keyword (BM25), Graph (entity/temporal/causal links), Temporal (time-range filter). Paper confirma fusion por **RRF + cross-encoder reranker**.
- **Invocables individualmente**: ⚠ la API pública `POST /memories/recall` expone el combo como caja. `RecallRequest` acepta budget levels `low|mid|high` que probablemente modula qué estrategias se activan, pero no hay selector explícito por estrategia documentado.
- **Reranker desactivable**: ⚠ no verificado.
- **Formato respuesta**: `MemoryFact[]` con metadata + `TokenUsage` (input/output tokens). `POST /reflect` es distinto: agente autónomo iterativo que llama `recall` internamente.
- **Cost/latency**: "Fast Benchmark" del repo benchmarks pondera Speed 25%, Cost 20%, Reliability 15%, Accuracy 40% sobre LoComo. Cifras absolutas (ms p50/p95) ⚠ no extraídas.

#### Import/export
- **Ingesta**: `POST /files/retain` (parsing async). Batch via `POST /memories/retain`. ⚠ formatos exactos sin verificar.
- **Export completo**: **no hay endpoint REST de export documentado**. Postgres-backed → `pg_dump` es el camino. ⚠ no hay primitiva oficial para "dump bank en JSONL/markdown".
- **Bulk-ingest**: `retain` batch nativo (array). No hay endpoint streaming/COPY documentado.

#### Concurrencia y consistencia
- Postgres → ACID estándar. Multi-cliente OK contra Postgres externo.
- Background workers (`hindsight-worker`) para cognify async, observables vía `/operations`. v0.5.5 introdujo "per-operation slot reservations" — control de concurrencia explícito sobre worker pool.
- **Embedded pg0**: ⚠ modelo exacto sin verificar (PGlite-like vs Postgres real con socket compartido). Volumen `/home/hindsight/.pg0` sugiere data dir persistente. Probablemente multi-conexión dentro del container, **no apto para múltiples APIs apuntando al mismo pg0**.
- v0.5.4 añadió `decommission-workers` CLI.

#### Dependencias de runtime
- Docker `ghcr.io/vectorize-io/hindsight:latest`. Puertos 8888 (API) y 9999 (UI). ⚠ peso imagen sin verificar.
- **LLM providers**: OpenAI, Anthropic, Gemini, Groq, **Ollama**, LM Studio, MiniMax. Ollama/LM Studio dan modo 100% local (benchmark OSS-20B usa este camino).
- **Embeddings**: vía el provider seleccionado. No embed model bundleado.
- **DBs**: Postgres (pgvector), Postgres+AlloyDB ScaNN, Oracle 23ai. pg0 embebido default.
- **Helm chart producción** en `helm/hindsight/`.
- Componentes: API server, worker(s), UI (9999), MCP montado en API.

#### Estado del upstream
- **Cadencia**: semanal/semi-semanal confirmada (6 releases en ~4 semanas).
- **Sponsor**: Vectorize AI Inc. (commercial) — bus factor bajo si Vectorize pivota; ahora developer-activity muy alta. Autores del paper: Chris Latimer, Nicoló Boschi, Andrew Neeser, Chris Bartholomew, Gaurav Srivastava, Xuan Wang, Naren Ramakrishnan. Naren Ramakrishnan y Xuan Wang figuran como faculty en Sanghani Center (Virginia Tech), consistente con la fuente original.
- **Breaking changes recientes**: v0.5.1 refactor openclaw integration (config movió de `process.env` a plugin config); v0.6.2 renombró `max_results` → `max_tokens` en algún hook; v0.6.0 introdujo Oracle 23ai como backend mayor.
- **Benchmarks repo separado**: leaderboard público reproducible. LongMemEval: Gemini-3 91.4%, OSS-120B 89.0%, OSS-20B 83.6% (vs 39.0% baseline full-context = +44.6 pp). LoComo: Gemini-3 89.61%, OSS-120B 85.67%, Memobase 75.78%, Zep 75.14%. Declara explícitamente que LoComo tiene "significant flaws" y recomienda LongMemEval. Reproducción declara requerir solo Postgres + MacBook. ⚠ no he encontrado independent reproduction publicado por terceros académicos.

#### Veredicto de integrabilidad
Hindsight **quiere ser el backend** — su valor de paper sale del stack TEMPR + RRF + cross-encoder + cognify worker actuando como sistema cerrado. Sí expone API REST y MCP limpios, multi-tenant nativo, y SDK Python/Node, lo que permite usarlo como "smart retrieval layer" detrás de Naeth siempre que aceptes su pipeline de cognify (no parece haber path documentado para inyectar embeddings precomputados o saltarse la extracción LLM en el `retain`). No hay write-through trivial: si Naeth quiere ser dueño del schema o el flujo de scoring, Hindsight resiste. Como **caja-negra federable detrás de un router**, encaja bien. Como **librería para arrancar componentes sueltos**, encaja mal — está diseñado como producto.

#### Ideas robables
1. **Stack de 4 retrievers en paralelo + RRF + cross-encoder reranker** (TEMPR: semantic + BM25 + graph + temporal). Paper muestra delta empírico (39% → 83.6% con mismo backbone) — receta documentada para replicar.
2. **Embedded Postgres (pg0) zero-setup** como modo default + Postgres externo / AlloyDB / Oracle como upgrade path. Excelente DX de onboarding.
3. **Separación benchmarks-en-repo-aparte con leaderboard público y reproducción en MacBook** — credibilidad académica + barra baja para terceros que auditen (vs Mem0/Zep que mezclan o no publican reproducibles).
4. **Tres ops conceptuales (`retain`/`recall`/`reflect`) + cuatro redes lógicas** (world / experiences / mental models / opinions) como vocabulario público. Modelo mental limpio, distinto del "memory chunk" plano.
5. **Soporte Ollama/LM Studio desde día 1** con benchmark OSS-20B publicado (83.6%) — honestidad sobre trade-off frontera-vs-local.
6. **MCP server montado en el mismo binario que el REST + binario `local-mcp` con stdio aparte** — cubre cloud (HTTP, multi-bank, auth) y desktop (stdio, single-user) sin duplicar lógica.

---

### 2.3 Cognee (topoteretes)

#### Datos básicos
- **Repo**: `github.com/topoteretes/cognee` (org Topoteretes).
- **Licencia**: **Apache-2.0** (confirmado en README).
- **Versión actual**: v1.1.0 (release 16-may-2026); PyPI con dev pre-release `1.1.0.dev1`.
- **Último commit**: rama main con ~7.577 commits totales; varias menores por trimestre. ⚠ día exacto del último commit sin verificar.
- **Stars**: **~17.4k** (el ~12k de `investigacion.md` está desactualizado).
- **GitHub Secure Open Source Program**: graduado el 11-ago-2025 — pasó auditoría de buenas prácticas (vulnerability management, dependencias, code review). Madurez operacional, no funcionalidad.
- **Contributors**: 80+.

#### Superficie de integración
- **MCP server oficial**: incluido en repo principal y documentado para Claude Code, Cursor, Continue, Cline, Roo Code. Docker (HTTP `http://localhost:8000/mcp`) o local (stdio).
- **Plugin Claude Code**: 5 hooks documentados — `SessionStart` (init memoria), `PostToolUse` (captura acciones), `UserPromptSubmit` (inyecta contexto recordado), `PreCompact` (preserva antes de compactar), `SessionEnd` (vuelca al grafo permanente). ⚠ path exacto `cognee-integrations/integrations/claude-code` no verificado literalmente; la URL `cognee-community` solo aloja adapters de DB, los hooks están confirmados por documentación y blog.
- **REST API**: confirmada, `http://localhost:8000` con docs interactivos en `/docs`.
- **SDK Python**: 87.3% del codebase. Patrón canónico `add → cognify → search` async. Python 3.10–3.14.
- **CLI**: `cognee-cli` con comandos por fase ECL.
- **SDK extras**: Vercel AI SDK adapter (`cognee-vercel-ai-sdk`), Rust SDK (`cognee-RS`) para edge.
- **Frameworks de agente**: LangGraph, Google ADK, OpenClaw, n8n, Claude Agent SDK, OpenAI Agent SDK.
- **Observabilidad/eval**: Langfuse, Keywords AI, DeepEval.
- **Cloud LLM**: AWS Bedrock.
- **Data ingestion**: ScrapeGraphAI confirmado. El claim "28+ connectors" del briefing aparece como "30+ connectors" en análisis de terceros (PDFs, Slack, Notion, imágenes, audio, databases); ⚠ no encontré listado canónico en docs.
- **Variables de entorno**: `LLM_API_KEY` requerida por defecto (OpenAI). Soporta Ollama y otros proveedores.

#### Modelo de datos
**ECL pipeline** (Extract, Cognify, Load):

- **Extract** (`add()`): ingesta texto/archivos/URLs, content-hash check para idempotencia, metadata en relacional.
- **Cognify** (`cognify()`): pipeline de 6 tasks:
  1. Classify documents → `Document` objects con tipo (PDF, texto, imagen, audio).
  2. Check permissions sobre dataset.
  3. Extract chunks → `DocumentChunk` con chunking configurable.
  4. Extract graph → LLM identifica entidades y relaciones, dedup nodos/edges.
  5. Summarize text → `TextSummary` DataPoints.
  6. Add data points → embeddings al vector store + nodos al grafo.
- **Load**: persistencia al poly-store.

**Poly-store** (3 planos coexistiendo, sincronizados por pipeline):

| Plano | Default | Alternativas |
|---|---|---|
| Grafo | NetworkX (in-memory) | Neo4j, FalkorDB, Kuzu, Memgraph, Google Cloud Spanner, TuringDB |
| Vectorial | LanceDB | Qdrant, Pinecone, Weaviate, Redis, Milvus, OpenSearch, Valkey, PGVector, Azure |
| Relacional | SQLite | PostgreSQL. Híbridos: DuckDB, FalkorDB |

**Schema del KG**: emerge dinámicamente — Cognee **no requiere ontología predefinida**. Tipos de nodo y nombres de relación extraídos vía LLM. 4 prompts built-in (default, simple, strict, guided) + custom.

**Ontología opcional**: puede recibir RDF/OWL externo. `RDFLibOntologyResolver` parsea OWL, construye lookup dicts, para entidades match reemplaza nombres LLM por URIs canónicas + extrae subgrafo ontológico (rdfs:subClassOf, owl:ObjectProperty) y merge al KG.

**DataPoints**: clase Pydantic en `cognee.infrastructure.engine`. Unidades atómicas de conocimiento; permiten definir entidades custom (`Person(name, age)`) con relaciones tipadas. Definir DataPoints manualmente = ontología-like de facto.

**Organización lógica**: Datasets (contenedores), NodeSets (tagging ligero por proyecto/usuario/workflow), Sessions (`session_id` para continuidad conversacional con caching).

**Multimodal first-class**: imágenes via vision models, audio via transcripción, todo al **mismo** knowledge graph. ⚠ vision model exacto por defecto sin verificar.

#### Operaciones de escritura
- **¿Saltar Cognify?**: Sí técnicamente — `add()` y `cognify()` son ops separadas. Dentro de Cognify puedes ensamblar pipeline custom omitiendo tasks (ej. saltar `summarize_text` para reducir LLM a 1 call/chunk). **Pero** si te saltas `extract_graph` y `add_data_points` no hay grafo ni vectores: solo metadata relacional. Aceptar memoria pre-procesada sin re-cognificarla requeriría escribir directamente al grafo/vector vía adapters, salteando la pipeline — posible pero no flujo de primera clase.
- **Tasks y pipelines custom**: bien documentado. Cada task es unidad independiente reutilizable; ensamblables. Doc: "remix tasks o insertar custom logic sin re-wirear el stack".
- **Hooks/eventos**: ⚠ no encontré sistema formal de hooks de pipeline (pre/post-task) en docs internas. Los "hooks" documentados son los de Claude Code consumidos por su plugin.
- **Idempotencia**: doble capa — content-hash en `add()` + pipeline-status tracking en `cognify()`. `incremental_loading=True` por defecto.

#### Operaciones de lectura
**15+ search modes** (`SearchType`):
`GRAPH_COMPLETION` (default graph-aware Q&A), `RAG_COMPLETION` (RAG clásico), `CHUNKS` (semántico), `CHUNKS_LEXICAL` (token-based Jaccard), `SUMMARIES`, `TRIPLET_COMPLETION` (S-P-O), `GRAPH_SUMMARY_COMPLETION`, `GRAPH_COMPLETION_COT` (chain-of-thought), `GRAPH_COMPLETION_CONTEXT_EXTENSION`, `CYPHER` (queries raw cuando backend lo soporta), `NATURAL_LANGUAGE` (NL→graph), `TEMPORAL` (time-aware), `CODING_RULES`, `FEELING_LUCKY` (autorouting), `FEEDBACK`.

- **Cypher-like**: soportado vía `SearchType.CYPHER` cuando backend lo permite (Neo4j, Memgraph, FalkorDB).
- **Hybrid**: `GRAPH_COMPLETION` empieza vector search sobre chunks/summaries/entity nodes, identifica subgrafo relevante, linealiza a texto, compone respuesta con LLM.
- **Formato respuesta**: varía por SearchType — texto compuesto, lista chunks rankeados, triplets `source -[rel]-> target`, dicts con `made_from` traceability.
- **¿Query a un solo store?**: Sí — `CHUNKS_LEXICAL`/`CHUNKS` → vectorial; `CYPHER`/`INSIGHTS` → grafo; `SUMMARIES` → relacional+vectorial. Cada SearchType es elección del plano del poly-store.

#### Import/export
- **Ingesta**: 30+ connectors mencionados. ⚠ listado canónico no localizado.
- **Export del estado actual**: ⚠ sin verificar. Indirectamente vía queries `GRAPH_COMPLETION`/`CYPHER` o acceso al backend directo (Neo4j dump).
- **Re-correr ECL**: modelo incremental por diseño (idempotencia por hash). No es "export pipeline" sino "ingesta sucesiva".
- **Migración entre stores**: ⚠ sin verificar documentación específica.

#### Concurrencia y consistencia
- **Concurrent operations**: docs confirman que search queries corren en paralelo con cognify sin global lock.
- **Multi-process**: LanceDB puede tener commit conflicts en multi-proceso (warning explícito en docs).
- **Transacciones distribuidas**: ⚠ no documentadas — el modelo parece eventual consistency entre los 3 planos, coordinado por la pipeline secuencial.
- **Multi-cliente**: vía REST API + MCP, sin documentación específica de aislamiento.

#### Dependencias de runtime
- **Docker compose**: oficial, con profiles. Deployment "production-ready" sugerido: Postgres+pgvector + MCP server.
- **Mínima local**: default stack es **NetworkX (in-memory) + SQLite + LanceDB**, sin servicios externos. **Cero-infra para arrancar.**
- **LLM**: `LLM_API_KEY` (OpenAI default), Ollama documentado como alternativa local.
- **Deployment targets**: Modal, Railway, Fly.io, Render, Daytona, además de self-host Docker.
- **Cognee Cloud**: oferta managed con notebooks y Graph Explorer UI.

#### Estado del upstream
- **Cadencia**: releases activas (varias menores/trimestre).
- **Secure OSS graduation** (ago-2025): valida prácticas de seguridad — vulnerability management, dependencias, code review.
- **Adopters**: "70+ empresas" según blog; **Bayer** (workflows research científico) y **University of Wyoming** (evidence graph construction) confirmados.
- **Financiación**: $7.5M seed (señal de roadmap comercial activo — Cognee Cloud crecerá).
- **Comunidad**: 80+ contributors, Discord y Reddit activos.

#### Veredicto de integrabilidad
Cognee se vende como "framework" pero internamente está construido como **library modular**: la pipeline ECL es ensamblable, los adapters de cada plano del poly-store son sustituibles (cognee-community los empaqueta como paquetes independientes), y el SDK Python expone primitivas (`add`, `cognify`, `search`, DataPoints, Tasks) sin obligarte a usar todas. Dicho esto, **quiere ser el cerebro**: el plugin de Claude Code engancha 5 hooks del ciclo de vida — incluyendo `UserPromptSubmit` que inyecta contexto y `SessionEnd` que vuelca al grafo permanente — lo cual es bastante invasivo (decide qué se recuerda y cómo se inyecta). Aceptarlo como "servicio especializado en KG generation" es viable: puedes consumir solo `cognify()` sobre tu propio storage layer y usar `SearchType.CYPHER`/`INSIGHTS` para queries puntuales, sin adoptar el MCP server ni el plugin. La barrera real son las 6 tasks de Cognify fuertemente acopladas al LLM (4–6 llamadas por chunk) y el modelo de dataset/permissions que asume un propietario único de la memoria.

#### Ideas robables
1. **ECL como separation of concerns**: tres fases claras (Extract idempotente, Cognify costosa-LLM, Load multi-store) con boundary nítido. Permite optimizar cada una y skipear Cognify para datos ya estructurados.
2. **Poly-store con backends configurables vía adapters comunitarios** (`cognee-community` con paquete por DB): patrón limpio para no casarse con vendor manteniendo API uniforme.
3. **Plugin Claude Code con los 5 hooks de session lifecycle**: `SessionStart/UserPromptSubmit/PostToolUse/PreCompact/SessionEnd` cubren todo el ciclo. Cualquier sistema de memoria persistente para Claude Code debería al menos contemplar `PreCompact` y `SessionEnd`.
4. **Search-type catálogo explícito** (15+ modos nombrados, `FEELING_LUCKY` auto-routing): mejor UX que un único endpoint `search()` opaco. NodeSets como tagging ligero ortogonal a Datasets también es elegante.
5. **Ontología opcional pero soportada** (RDF/OWL externo merge-able al grafo emergente): mezclar schema emergente LLM con vocabulario canónico cuando el dominio lo requiere.
6. **Idempotencia por content-hash + pipeline-status doble layer**: barato, robusto, no requiere transacciones distribuidas.

---

### 2.4 Basic Memory (basicmachines-co)

#### Datos básicos
- **Repo**: `basicmachines-co/basic-memory` (https://github.com/basicmachines-co/basic-memory).
- **Licencia**: **AGPL-3.0** (confirmado en archivo `LICENSE`: "GNU AFFERO GENERAL PUBLIC LICENSE, Version 3, 19 November 2007"). `pyproject.toml`: `AGPL-3.0-or-later`. **Implicación crítica para Naeth**: si Naeth se publica como SaaS hosted, la AGPL exige open-sourcear toda modificación que toque el código de Basic Memory.
- **Versión actual**: **v0.21.1** (16-may, año reportado por GitHub como 2024 en listado de releases pero el README declara v0.21.1 publicada 16-may-2026 — discrepancia de fechas ⚠ sin verificar; cadencia confirmada).
- **Último commit**: ~16-may (release v0.21.1). ⚠ HEAD exacto sin verificar.
- **Stars**: **~3.1k** (3.057 en página de la org, 3.100 en repo page). El número ~4.2k del briefing **no se confirma**.
- **Org**: `basicmachines-co` mantiene 18 repos: `basic-foundation`, `basic-components`, `basic-memory-skills`, `openclaw-basic-memory` (port TypeScript MIT) y `basic-memory-benchmarks`.

#### Superficie de integración
- **MCP server nativo** sobre **FastMCP 3.3.1** (pinned). `__all__` de `src/basic_memory/mcp/tools/__init__.py` exporta **23 tools** (24 listadas, una repetida; dos UI tools comentadas):
  - **CRUD notas**: `write_note`, `read_note`, `edit_note`, `move_note`, `delete_note`, `view_note`, `read_content`.
  - **Búsqueda**: `search`, `search_notes`, `recent_activity`, `list_directory`.
  - **Grafo/contexto**: `build_context` (URLs `memory://...`), `canvas` (genera canvas Obsidian).
  - **Proyectos/workspaces**: `list_memory_projects`, `create_memory_project`, `delete_project`, `list_workspaces`.
  - **Schema**: `schema_infer`, `schema_validate`, `schema_diff`.
  - **Cloud/info**: `cloud_info`, `release_notes`.
  - **ChatGPT adapter**: `fetch` (en `chatgpt_tools.py`, wrapper sobre `read_note`).
- **Tool annotations (FastMCP)** confirmadas: `write_note` declara `destructiveHint: True`, `idempotentHint: False`, `openWorldHint: False`.
- **REST API**: sí. `src/basic_memory/api/v2/routers/` con 10 routers FastAPI: `directory_router`, `importer_router`, `knowledge_router`, `memory_router`, `project_router`, `prompt_router`, `resource_router`, `schema_router`, `search_router`.
- **CLI**: dos entry points: `basic-memory` y `bm` (Typer). Subcomandos: `cloud`, `db`, `doctor`, `import_chatgpt`, `import_claude_conversations`, `import_claude_projects`, `import_memory_json`, `mcp`, `orphans`, `project`, `schema`, `status`, `tool`, `update`.
- **Obsidian**: bi-direccional. README: *"Point Obsidian at the project folder — the same wikilinks, frontmatter, and Markdown your AI writes appear in your graph view"*. No es solo-lectura desde Obsidian; cualquier editor Markdown vale (el storage **es** el archivo).
- **ChatGPT Custom GPTs**: soportado vía `chatgpt_tools.py` que expone `search` y `fetch` en el shape OpenAI espera (array de `{"type": "text", "text": "{...JSON...}"}`).
- **Basic Memory Cloud**: 14,25 USD/mes con "lifetime rate lock". Backend Neon Postgres + Tigris S3, sync rclone. ⚠ features extra del Cloud sin verificar más allá del sync.

#### Modelo de datos
- **Frontmatter YAML** parseado con `python-frontmatter`. Campos canónicos: `title` (default = filename stem), `type` (default `"note"`; permite `"guide"`, `"report"`, `"config"`, etc.), `permalink`, `tags` (lista, string CSV, o null), `metadata` (dict arbitrario). Todos los valores se normalizan a string para evitar `AttributeError` (fechas → ISO, números/bools → str).
- **Wikilinks** `[[Target]]` parseados como relaciones del grafo. `[[Target]]` bare = `links_to`; con prefijo (`depends_on [[Entity]]`, `"multi-word relation" [[Entity]]`) se tipan explícitamente.
- **Observations** con sintaxis bracket: `- [category] Text #tag1 #tag2 (context)`. Categorías libres (`[method]`, `[tip]`, `[resource]`).
- **SQLite index** vía SQLAlchemy + `aiosqlite` + Alembic. Schemas en `src/basic_memory/schema/`, modelos en `src/basic_memory/models/`. Actualizado por **file watcher** y on-demand vía `sync_service.py`. Tablas exactas ⚠ sin verificar; presencia de `repository/` + `models/` confirma ORM sobre entidades del grafo (entity, observation, relation).
- **Embeddings**: sí, precomputados. Deps `fastembed` y `sqlite-vec` en `pyproject.toml`. Módulo `indexing/` + opción `SearchRetrievalMode.VECTOR`/`HYBRID` en `search.py` confirman búsqueda híbrida (FTS + vector). Parámetros `min_similarity` y `search_type` (`text`, `title`, `permalink`, `vector`, `semantic`, `hybrid`).

#### Operaciones de escritura
- Tools cubren CRUD completo: `write_note` (con flag `overwrite`), `read_note`, `edit_note`, `move_note`, `delete_note`, más `view_note` y `read_content`.
- **Ingesta de Markdown externo**: **caso de uso de primera clase**. El watcher (`watch_service.py`) usa `watchfiles.awatch` y procesa eventos `Added`/`Modified`/`Deleted` sobre el filesystem; cualquier archivo `.md` que aparezca en el directorio del proyecto se indexa automáticamente. **Esto significa que un proceso externo (humano, otra herramienta, Naeth) puede dejar caer Markdown y Basic Memory lo recoge.**
- **Detección de moves** por comparación de checksum entre `deleted` y `added` en el mismo batch.
- **Debouncing** configurable via `app_config.sync_delay` pasado a `awatch(debounce=...)`. Ciclo de watch se reinicia cada `watch_project_reload_interval` para detectar nuevos proyectos.
- **Atomic writes**: comentario explícito sobre escrituras atómicas (estilo Vim) — "files that trigger DELETE events but still exist on disk are treated as modification". Sugiere write-then-rename. **Locks explícitos: no se detectan**; coordinación vía `asyncio.Event`, sin file locks tradicionales.

#### Operaciones de lectura
- Tres modos: **FTS** (`SearchRetrievalMode.FTS`), **vector/semantic**, **hybrid** (default si semantic está habilitado). Operadores booleanos (`AND`, `OR`, `NOT`), frases, patrones. Filtros: `note_types`, `entity_types`, `after_date`, `metadata_filters`, `tags`, `status`, `min_similarity`. Paginación (`page`, `page_size`). Multi-proyecto con `search_all_projects` (merge ranked).
- **Wikilink graph traversal**: `build_context` con URLs `memory://...` permite navegar contexto vía relaciones.
- **Formato respuesta**: `text` (markdown formateado con title, permalink, score, chunks) o `json` (`SearchResponse.model_dump(mode="json", exclude_none=True)`). Todas las tools tienen `output_format`.

#### Import/export
- **Export**: trivial. El storage es el filesystem; `cp -r ~/basic-memory ./backup` es export válido.
- **Import nativo** (CLI + router `importer_router`): `chatgpt_importer`, `claude_conversations_importer`, `claude_projects_importer`, `memory_json_importer` (formato del Memory MCP de Anthropic). `base.py` define interfaz común.
- **Compatibilidad PKM**: Obsidian confirmada. Logseq/Foam: ambos consumen wikilinks `[[...]]` + frontmatter YAML, así que es **compatible de facto** ⚠ sin verificar pruebas explícitas.

#### Concurrencia y consistencia
- Filesystem-based: si humano edita en Obsidian mientras Claude escribe vía MCP, **no hay file locks**. El watcher detecta el cambio del humano vía `watchfiles` y reindexa; el cambio del LLM se aplica vía atomic write (write-then-rename). En la práctica = **last-write-wins a nivel de archivo**, sin merge automático.
- Multi-cliente MCP simultáneo: cada cliente abre su sesión MCP; coordinación a nivel de SQLite (WAL mode probable ⚠) + filesystem.
- `v0.21.0` (changelog) menciona explícitamente "concurrent delete fixes" y "N+1 query eliminations" — upstream sigue endureciendo concurrencia.

#### Dependencias de runtime
- **Python ≥3.12** (`pyproject.toml`).
- Stack: SQLAlchemy, `aiosqlite`, FastAPI, FastMCP 3.3.1, Pydantic, PyYAML, Typer, `markdown-it`, `python-frontmatter`, `watchfiles`, `fastembed`, `sqlite-vec`, OpenAI, `asyncpg` (Postgres opcional). ~40 packages.
- Self-host mínimo: **SQLite + filesystem** (sin Postgres, sin Redis, sin contenedores). Postgres opcional vía testcontainers/Neon en Cloud.
- Instalación: `uv tool install basic-memory`.

#### Estado del upstream
- **Cadencia activa**: ~79 releases totales, ~1.329 commits en main, 202 forks, 16 watchers. v0.18.5 → v0.21.1 en pocos meses (febrero → mayo). Ritmo semanal/quincenal.
- **Org Basic Machines** mantiene productos complementarios: `basic-memory-skills` (skills tipo "reflection"/"defragmentation"), `basic-memory-benchmarks` (suite performance), port TypeScript MIT `openclaw-basic-memory` que **abre integración fuera del runtime Python**.
- Comunidad: stars 3.1k, descripción "AI conversations that actually remember". ⚠ Discord/forum específicos sin verificar.

#### Veredicto de integrabilidad
Basic Memory es **excelente como capa de soberanía** detrás de otro backend más rápido: su storage **es** Markdown en disco, por lo que cualquier sistema externo puede escribir/leer los mismos archivos sin pedir permiso, y el watcher de `watchfiles` se encarga de reindexar a SQLite + vector store. Es un **muy buen ciudadano** porque expone tres superficies independientes (MCP, REST FastAPI, CLI Typer) sobre el mismo modelo, declara tool annotations FastMCP correctamente y respeta atomic writes. Como sistema principal también funciona — tiene búsqueda híbrida (FTS + embeddings vía `fastembed`/`sqlite-vec`), grafo emergente vía wikilinks y CRUD MCP completo — pero su techo de rendimiento depende del filesystem y SQLite, y no hay locks fuertes ante concurrencia humano+LLM (last-write-wins). El hecho de que el storage sea archivos legibles por humanos lo hace particularmente adecuado para arquitectura compuesta tipo "Naeth genera Markdown canónico → Basic Memory lo materializa como vista soberana editable en Obsidian, sin lock-in".

#### Ideas robables
1. **Storage = Markdown en disco** como contrato (no como export): los archivos son la fuente de verdad; SQLite es índice derivado, regenerable desde cero leyendo el filesystem.
2. **Wikilinks `[[Target]]` como grafo emergente** sin BD de grafo dedicada — relaciones tipadas inline (`depends_on [[X]]`, `"multi-word" [[X]]`) más fallback `links_to`.
3. **Observations con sintaxis bracket** `- [category] text #tags (context)` — categorías abiertas, no enum, que permiten tipar hechos sin schema rígido.
4. **FastMCP tool annotations** (`destructiveHint`, `idempotentHint`, `openWorldHint`) declaradas por tool — patrón disciplinado que ayuda al cliente MCP a planificar.
5. **Bi-direccionalidad humano-LLM real** vía file watcher (`watchfiles` + debouncing + detección de moves por checksum) en lugar de "export periódico".
6. **Frontmatter como metadata extensible** con normalización defensiva (fechas → ISO, bools → str) para no romper YAML del usuario humano.
7. **Triple superficie** sobre un único modelo: MCP para LLMs, REST v2 para apps, CLI para humanos — y un adapter ChatGPT minimalista (`fetch`/`search`) como ejemplo de cómo bajar a otros protocolos.
8. **Compatibilidad de facto con ecosystem PKM** (Obsidian/Logseq/Foam) reutilizando convenciones existentes (wikilinks + frontmatter) en lugar de inventar formato propio.

---

### 2.5 Graphiti (getzep)

#### Datos básicos
- **Repo**: `getzep/graphiti` ([github.com/getzep/graphiti](https://github.com/getzep/graphiti))
- **Licencia**: **Apache-2.0** (confirmado en PyPI y GitHub).
- **Versión actual**: v0.29.0 (27-abril-2026, confirmado).
- **Stars**: **~26.3k** (forks ~2.6k) — la cifra de "~24k" de `investigacion.md` está desactualizada.
- **PyPI downloads**: 77,845 downloads/semana, 268,213 downloads/mes según `pypistats.org` para `graphiti-core` — coincide con la cifra del briefing (verificado).
- **Releases totales**: 194. Existen también releases independientes del MCP server (`mcp-v1.0.2`).
- **Último commit**: asociado a v0.29.0 (27/04/2026).

#### Superficie de integración
- **MCP server propio**: vive en el monorepo (`mcp_server/` con releases propias). Transport HTTP default en `http://localhost:8000/mcp/` (health check `/health`) y stdio alternativo. Tools confirmadas en docs: `add_episode`, `delete_episode`, `get_episodes`, `search_nodes`, `search_facts`, `delete_entity_edge`, `get_entity_edge`, `clear_graph`, `get_status`.
- **REST API**: servicio FastAPI en `server/` del monorepo.
- **SDK Python**: `graphiti-core` (Python 3.10+, `pip install graphiti-core` o `uv add graphiti-core`). Clase principal `Graphiti` con `add_episode`, `add_episode_bulk`, `search`, `_search` (low-level con `SearchConfig`), `retrieve_episodes`, `build_indices_and_constraints`, `close`.
- **Hybrid search exposure**: sí, expuesto en SDK y MCP/REST. Combina semantic embeddings + BM25 + graph traversal con tres rerankers seleccionables (RRF, MMR, cross-encoder LLM o BGE).
- **Variables de entorno principales**: `OPENAI_API_KEY` (o equivalentes de provider), `NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD`, `SEMAPHORE_LIMIT` (concurrencia, default 10), `GRAPHITI_TELEMETRY_ENABLED` (opt-out).

#### Modelo de datos
**Knowledge graph temporal** con tres primitivas:
- **Episodes**: dato crudo ingerido, ground truth y provenance.
- **Entities (nodes)**: personas, productos, políticas… con summaries evolutivos.
- **Edges**: relaciones temporales con validity window (`valid_at`/`invalid_at`).

**Bi-temporalidad confirmada**: edges (y según docs también nodos) llevan `valid_at` e `invalid_at` que marcan cuándo el hecho fue verdad y cuándo se invalidó. Los facts no se borran al cambiar; se marca `invalid_at`.

**Custom Types**: definibles vía clases Pydantic (ontologías prescritas) o emergentes (learned). `add_episode` acepta `entity_types`, `excluded_entity_types`, `edge_types`, `edge_type_map`.

**Embeddings**: sobre entidades y edges (semantic component del hybrid search). ⚠ sin verificar exactamente sobre qué campos textuales se embeben los episodes.

**Schema concreto**: modelos Pydantic en `graphiti_core/`. ⚠ nombres exactos de clases (`EntityNode`, `EntityEdge`, `EpisodicNode`) citados en docs pero sin verificar.

#### Operaciones de escritura
- Pipeline canónico de `add_episode`: ingest episode → extract entities (LLM) → resolve entity duplicates (LLM + embedding match) → create/update edges con lógica temporal → invalidar edges contradictorios.
- **Saltarse etapas**: `add_episode_bulk` documentado, pero con limitación explícita en docs: *"Bulk ingestion doesn't perform edge invalidation operations"* — se sacrifica lógica temporal para ganar throughput.
- **Idempotencia**: dedup por UUID/nombre al insertar fact triples ("Graphiti will attempt to deduplicate your passed in nodes and edge"). ⚠ sin verificar si dos `add_episode` con cuerpo idéntico generan estados equivalentes; el LLM introduce no-determinismo.
- **LLM en path de escritura**: **obligatorio**. Cada `add_episode` invoca el LLM para extracción y resolución de entidades. Coste y latencia escalan por episodio; `SEMAPHORE_LIMIT=10` controla concurrencia para evitar rate-limits.
- Soporte de `custom_extraction_instructions` para inyectar prompts específicos.

#### Operaciones de lectura
- **Hybrid search**: `await graphiti.search(query, center_node_uuid=None, num_results=10)` (high-level) o `graphiti._search(query, config, group_id)` con `SearchConfig` (selección reranker, filtros).
- **Temporal queries**: soportadas vía propiedades temporales en resultados (`valid_at`, `invalid_at`) y vía `reference_time` en episodios; **no hay un DSL "AS OF timestamp" tipo SQL temporal visible en docs públicas**. ⚠ la sintaxis exacta de "¿qué creía el sistema el martes pasado?" parece resolverse filtrando por timestamps en el cliente o vía Cypher directo.
- **Cypher directo**: posible porque el driver Neo4j es accesible; no es la API recomendada, pero no está bloqueado.
- **Formato respuesta**: lista de nodos/edges/communities con metadata temporal y UUIDs.

#### Import/export
- **No hay formato propio de Graphiti documentado** para dump/restore portable entre backends.
- Vía de export = nativa del backend: `neo4j-admin dump` / Cypher export para Neo4j, equivalente para FalkorDB/Kuzu.
- **Migración entre backends (Neo4j ↔ FalkorDB ↔ Kuzu)**: **no documentada como path soportado**; cada backend es pluggable vía `graph_driver` pero el dato vive en el backend. ⚠ sin verificar export-import canónico cross-backend.

#### Concurrencia y consistencia
- **Concurrencia transaccional**: delegada al backend (Neo4j/FalkorDB/Kuzu) — ACID si Neo4j.
- **Race conditions en entity dedup**: ⚠ sin verificar. El pipeline depende del LLM para emparejar entidades; dos `add_episode` paralelos que mencionan la misma entidad nueva podrían producir duplicados antes de que la resolución alcance consistencia. `SEMAPHORE_LIMIT` mitiga pero no es lock semántico.
- **Multi-tenancy**: `group_id` (también "Graph Namespacing") es ciudadano de primera. Todas las APIs (`add_episode`, `search`, `retrieve_episodes`) lo aceptan; permite múltiples grafos aislados en una instancia.

#### Dependencias de runtime
- **Graph DB obligatoria** (hard requirement): Neo4j 5.26+ / FalkorDB 1.1.2+ / Kuzu 0.11.2+ / Amazon Neptune. **Kuzu es embedded (sin servidor separado) — relevante para uso personal.**
- **LLM provider obligatorio** (OpenAI default; soporte para Anthropic, Gemini, Groq, Azure OpenAI, Ollama local vía API OpenAI-compatible). Coste por `add_episode` no trivial.
- **Embedder provider**: OpenAIEmbedder default; intercambiable.
- **Cross-encoder reranker**: OpenAIRerankerClient default (otro coste LLM) o BGE local.
- **Footprint**: Python + Neo4j (JVM, ~1-2GB RAM mínimo) o FalkorDB (Redis-based, más ligero) o Kuzu (embedded, mínimo). Para uso personal **Kuzu es la opción menos invasiva**.

#### Estado del upstream
- **Cadencia**: ~2-4 releases/mes; 194 releases totales; v0.29.0 el 27/04/2026 con pre-releases y patches previos. Proyecto vivo.
- **Zep Cloud como sponsor**: Graphiti es el core abierto del producto comercial Zep; mantenedores principales (`paulzep`, `sunnysideup`) son del equipo Zep. Roadmap alineado con necesidades comerciales de Zep Cloud.
- **Zep Community Edition deprecada (abril 2025)**: ⚠ impacto directo sin verificar, pero datos observables sugieren **aceleración** de Graphiti (alta cadencia post-2025, integración con Neptune añadida, MCP server con releases propias, soporte de múltiples backends ampliado). Graphiti absorbió la atención que antes se repartía con Zep CE.
- **Paper Rasmussen et al. (arXiv:2501.13956, ene 2025)**: publicado; benchmark Deep Memory Retrieval 94.8% (vs MemGPT 93.4%) y LongMemEval +18.5% accuracy con -90% latencia. ⚠ replicación externa independiente más allá del paper sin verificar.

#### Veredicto de integrabilidad
Graphiti es **integrable como "capa de razonamiento temporal" delegada**, no como storage principal: el SDK Python y el MCP server permiten enviarle episodes y consultarle por hybrid search con metadata temporal, manteniendo Naeth como propietaria del corpus de verdad. Sin embargo, Graphiti *quiere* ser fuente de verdad — su modelo asume que ingiere episodes crudos y que el grafo es el ground truth, así que delegarle solo temporal implica duplicar storage. El requisito de Neo4j/FalkorDB/Kuzu es **fricción real** para uso personal, aunque Kuzu (embedded) la reduce a niveles aceptables; el coste LLM por `add_episode` (entity extraction + resolution + reranking) es la pega más significativa. Es buen ciudadano si se le delega únicamente el subdominio temporal/relacional, aceptando el coste de un backend extra y de invocaciones LLM en cada escritura.

#### Ideas robables
1. **Bi-temporalidad explícita `valid_at`/`invalid_at`** en edges (y nodos) — facts no se borran, se invalidan; permite "time travel" sin recomputación.
2. **Episode como unidad de ingest con provenance** — todo derived fact apunta al episode origen; lineage gratis para auditar/explicar el estado del grafo.
3. **Hybrid search nativo de tres vías** (semantic embeddings + BM25 + graph traversal) con rerankers intercambiables (RRF / MMR / cross-encoder) — patrón de retrieval menos dependiente de cosine pura.
4. **Entity resolution LLM-driven con dedup incremental** (UUID + embedding match + LLM judgment) — sin batch recomputation; permite ontologías emergentes además de prescritas vía Pydantic.
5. **Paper-driven development con benchmark reproducible** (arXiv:2501.13956, DMR + LongMemEval) — el repo está respaldado por evaluación cuantitativa pública; patrón replicable para justificar decisiones técnicas de memoria.

---

## 3. Tabla cruzada de compatibilidad (5×5)

¿El sistema X puede coexistir con el sistema Y sin pisarse? Casos típicos:

| X \ Y | mcp-mem-service | Hindsight | Cognee | Basic Memory | Graphiti |
|---|---|---|---|---|---|
| **mcp-memory-service** | n/a | ✅ puertos distintos (8000/8765 vs 8888/9999); IDs `content_hash` vs `memory_id` no chocan | ✅ puertos distintos (8000 default ambos ⚠ conflicto) → cambiar puerto Cognee | ✅ Basic Memory escribe a filesystem; MM-S a SQLite — no overlap | ✅ Graphiti escribe a Neo4j/Kuzu; MM-S a SQLite-vec — no overlap |
| **Hindsight** | ✅ | n/a | ✅ pero ambos usan pg/pgvector si lo configuras — usar DBs distintas | ✅ no overlap | ✅ no overlap |
| **Cognee** | ⚠ puerto 8000 colisión | ✅ | n/a | ✅ no overlap | ⚠ ambos pueden usar Neo4j; aislar por database name |
| **Basic Memory** | ✅ | ✅ | ✅ | n/a | ✅ |
| **Graphiti** | ✅ | ✅ | ⚠ aislar Neo4j por db | ✅ | n/a |

**Conflictos reales detectados**:
- **Puerto 8000**: mcp-memory-service (REST) y Cognee (MCP HTTP) ambos default. Resolver con env var.
- **Neo4j compartido**: Cognee y Graphiti pueden ambos usar Neo4j. Aislamiento posible vía `database` distintos o instancias distintas; no es bloqueante pero hay que diseñar.
- **Postgres compartido**: Hindsight (pg0 embedded) y cualquier otro que decida usar Postgres externo. Aislar por database/schema.

**No hay conflictos de IDs entre sistemas**: cada uno usa su propio espacio de identificación (`content_hash` en MM-S, `memory_id` en Hindsight, UUIDs en Graphiti, paths de filesystem en Basic Memory). Si Naeth quiere un ID canónico unificado, debe definirlo aparte y mapear.

**No hay conflictos de schema MCP**: cada sistema expone sus propias tools con nombres distintos. Puedes registrar los 5 MCP servers en el mismo cliente Claude Code sin colisión de nombres de tools (con prefijos por server). Lo que SÍ choca es el coste cognitivo del LLM al tener 23+18+15+26+9 = 91 tools visibles.

---

## 4. Hallazgos transversales

### 4.1 Patrones repetidos (candidatos para primitivas de Naeth)

1. **Todos usan content-hash o equivalente como ID natural** (`content_hash`, `memory_id`, UUID). Ningún sistema confía solo en autoincrement. Naeth debería seguir el patrón: ID determinístico desde contenido + timestamps.

2. **Todos exponen una variante de `entity/observation/relation`** (explícita en MM-S y Basic Memory; emergente en Cognee y Graphiti vía LLM extraction; implícita en Hindsight via `entities`/`relations`/`temporal_facts`). **Primitiva candidata UMAS v2**: triplets `(entity, predicate, value/entity)` con metadata temporal opcional.

3. **Hybrid search semantic+BM25 es estándar**. Solo el Anthropic Memory MCP oficial no lo tiene. Stack de retrievers en paralelo (Hindsight TEMPR, Graphiti tri-way, MM-S `retrieve_hybrid`, Basic Memory `SearchRetrievalMode.HYBRID`, Cognee `GRAPH_COMPLETION`) — variaciones pero patrón común.

4. **LLM en el path de escritura es la divisoria**:
   - **LLM-light writers** (sin LLM obligatorio): mcp-memory-service, Basic Memory.
   - **LLM-heavy writers** (LLM obligatorio en cada escritura): Hindsight, Cognee, Graphiti.
   - Trade-off: LLM-heavy da grafo enriquecido sin trabajo del usuario, pero coste y latencia por cada `add` no son triviales.

5. **MCP + REST + SDK + CLI = la tetralogía de superficies estable**. Los 5 sistemas convergen en esto. Naeth debe planificar las cuatro desde día uno, no como añadidos.

6. **Tool annotations FastMCP** (`readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`) están en MM-S y Basic Memory. En Hindsight/Cognee/Graphiti ⚠ no verificado pero la herramienta MCP estándar las soporta. **Naeth debe usarlas sistemáticamente.**

7. **Embeddings 100% local es viable en los 5** (sentence-transformers/ONNX/fastembed/Ollama). Cero excusa para depender de API.

### 4.2 Patrones ausentes en TODOS los sistemas (huecos del mercado)

1. **Webhooks salientes / MCP notifications al escribir**. Solo SSE de MM-S dashboard y file watcher de Basic Memory permiten reaccionar a writes; ninguno tiene un sistema HTTP saliente estandarizado. **Si Naeth quiere ser orquestador**, esto es un hueco que cualquiera de los 5 dejará. Diseñar event bus propio.

2. **Embedding pre-computado externo como input estándar**. Ningún sistema acepta `{"content": "...", "embedding": [...], "model": "..."}` como entrada canónica. Significa que **federar 3 sistemas implica re-embeddings triples** salvo que Naeth maneje un cache externo y use endpoints raw de cada backend.

3. **Cross-system identity / entity resolution**. Si la "persona Eneko" aparece en MM-S, Hindsight y Basic Memory, ninguno sabe que son la misma entidad. **Primitiva candidata para Naeth**: capa de entity resolution sobre los 5 backends (probablemente similar a la del paper Hindsight + dedup con LLM-judge).

4. **Export común reversible (roundtrip lossless)**. Cada sistema tiene su formato. Solo Basic Memory es trivialmente legible (MD en disco). Ninguno garantiza export → import en otro sistema sin pérdida. **SHODH UMAS v2 podría definir este contrato.**

5. **Audit log estilo OTEL GenAI Semantic Conventions**. Solo Ogham-MCP (mencionado en `investigacion.md` pero no en top 5) lo hace. Los 5 top no.

6. **Modelo de "cliente identidad"** (`claude.ai` vs `claude-code` vs `cursor` vs `humano-Obsidian`). MM-S tiene `X-Agent-ID`, Hindsight `user_id`, Cognee NodeSets, Basic Memory `workspaces`, Graphiti `group_id`. **Todos tienen algo, pero ninguno lo expone como dimensión de query primaria.** Hueco real.

### 4.3 Inconsistencias observadas que requieren atención

- **mcp-memory-service**: README dice "24 tools" pero código registra ~18 + aliases legacy. Read carefully.
- **mcp-memory-service**: README dice "SHODH Unified Memory API v1.0.0 compatible" pero la spec no se encuentra ni en docs/, wiki, ni docs/integrations.md. **Posible vapor.**
- **Hindsight**: README principal MIT pero sub-paquete `hindsight-api` aparece como Apache 2.0 en algún view. Auditar antes de derivar.
- **Basic Memory**: año en releases reportado como 2024 en GitHub UI pero v0.21.1 declarada como mayo 2026 en README. Discrepancia de timeline.
- **Graphiti**: `investigacion.md` decía ~24k stars; real ~26.3k. Solo refleja desactualización del ranking, no problema.
- **Cognee**: `investigacion.md` decía ~12k stars; real ~17.4k. Idem.

### 4.4 Riesgos transversales

- **Bus factor**: mcp-memory-service depende esencialmente de `doobidoo` (single maintainer). En arquitectura compuesta, **no apostar el camino crítico a su upstream**.
- **Cadencia de releases altísima** (MM-S cada 3 días, Hindsight semanal, Graphiti 2-4/mes) → mantener integraciones tight implica re-validación constante. Diseñar con buffers (versionado de adapters, pinning estricto).
- **Comercial backers** (Vectorize/Hindsight, Zep/Graphiti, Cognee con $7.5M seed, Basic Machines con Cloud paid tier): el roadmap OSS no es libre. Si Naeth se vuelve crítico para tu día a día, **monitor las pivotadas comerciales**. Ya pasó con Mem0/OpenMemory (sunset) y Zep CE (deprecada).
- **Licencias AGPL** (Basic Memory): impone obligaciones si Naeth se hostea como SaaS. Apache/MIT (MM-S, Hindsight, Cognee, Graphiti) son neutrales. Decisión: si Naeth usa código de Basic Memory en tiempo de ejecución (no solo lee los MD que produce), AGPL aplica.

---

## 5. Preguntas abiertas para el Paso 2

Estas preguntas **no se pueden responder leyendo docs** — requieren spike o decisión de diseño. Son el insumo del Paso 2 (3 arquitecturas en papel).

1. **Latencia compuesta**: si Naeth consulta MM-S + Graphiti + Basic Memory en paralelo para un `recall`, ¿qué p50/p95 obtenemos? ¿Es aceptable para un chat client de claude.ai (típicamente <2s antes de feel laggy)? **Solo medible en spike.**

2. **Tamaño de respuesta MCP combinada**: cada backend devuelve JSON; el límite MCP es 1MB por response. Con 5 backends federados, ¿overflow? ¿Naeth debe truncar antes de devolver al cliente?

3. **Estrategia ante fallo de un backend**: ¿degradación graceful (resultado parcial), ¿reintento, ¿fallback al siguiente? Define la expectativa de fiabilidad.

4. **Single source of truth vs eventual consistency**: si Naeth escribe a 3 backends simultáneamente y uno falla, ¿rollback? ¿saga pattern? ¿accept partial write y reconciliar luego? **Decisión de diseño que pre-condiciona arquitectura.**

5. **¿Quién computa el embedding canónico?** Naeth tendría que hacerlo una vez y reusar, pero ninguno de los 5 acepta embedding precomputado en su API normal. Esto significa **N embeddings duplicados** salvo que Naeth implemente acceso al storage layer directo (e.g., escribir a SQLite-vec de MM-S bypaseando su API). Romper la API → costoso de mantener.

6. **¿Identidad cross-system?** Si "Eneko-decision-on-naeth-arch" se guarda en MM-S y aparece como entity en Graphiti, ¿cómo se sabe que son lo mismo? **Diseñar entity resolution layer.**

7. **¿Cuál es el contrato de "memoria"?** Cada sistema tiene un modelo distinto. ¿Naeth define UMAS v2 estricto y obliga a adaptarse a los backends, o adopta el mínimo común (probablemente "text + tags + timestamp")?

8. **¿Naeth tiene storage propio o solo es router?**
   - Si solo router: no hay duplicación pero pierdes control de roundtrip.
   - Si tiene storage propio (write-through a backends): consistencia compleja, costo de mantenimiento doble.
   - **Decisión crítica de Paso 2.**

9. **¿Cuánto se duplica entre Cognee y Graphiti?** Ambos hacen entity extraction LLM-driven. ¿Usar uno solo, o ambos para distintos casos?

10. **¿Naeth gestiona el LLM provider o lo delega?** Si cada backend tiene su `LLM_API_KEY`, son 5 keys distintas y 5 facturas. ¿Naeth proxea? ¿O documenta que el usuario configure cada uno?

11. **MCP server único de Naeth vs múltiples expuestos**: ¿Naeth expone 1 MCP server con prefijos sobre los 5 (`mem.recall`, `graph.search`, `note.write`) o registra los 5 servers directamente en Claude Code/claude.ai? El primer modelo es más limpio pero requiere proxy MCP; el segundo es trivial pero el LLM ve 91+ tools.

12. **¿Naeth garantiza orden de escrituras (FIFO) entre clientes?** Si claude.ai escribe a las 14:00:00.100 y Claude Code escribe a las 14:00:00.200, ¿el orden se conserva en los 5 backends? Solo Hindsight tiene ordering nativo (worker slots).

---

## 6. Lo que NO está en este documento (intencional)

- Recomendación de arquitectura (Paso 2).
- Benchmarks o replicaciones (Paso 3+).
- Código de pegamento, ni siquiera pseudocódigo (Paso 3+).
- Re-ranking de los 5 sistemas (eso está en `investigacion.md`).
- Análisis de los 10 sistemas restantes del Top 15 (fuera de scope).

---

**Fin del Paso 1.** Próximo paso: 3 arquitecturas en papel (federación lateral / pipeline en cascada / spec con adaptadores), evaluación cualitativa de cada una contra las 12 preguntas abiertas, decisión cualificada de cuál validar primero con spike.
