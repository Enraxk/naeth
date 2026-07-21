# Top 15 sistemas de memoria persistente para LLMs y agentes AI (mayo 2026)
## Investigación rigurosa para el proyecto Naeth

## TL;DR
- **Ganador para Naeth: `doobidoo/mcp-memory-service`** — es el único proyecto del Top que combina los tres factores críticos del usuario: (1) compatibilidad explícita con `claude.ai` (Remote MCP via HTTPS) y con Claude Code (hooks + Code Execution API desde v8.19.0+), (2) local-first real con SQLite-vec por defecto y embeddings ONNX/sentence-transformers sin API keys, y (3) cobertura amplia de features (24 herramientas MCP, knowledge graph, consolidación autónoma, temporal queries, OAuth 2.1). Licencia Apache-2.0/MIT, releases semanales y soporte de 13+ clientes MCP.
- **Si lo que importa es la mejor cifra de benchmark publicada con código reproducible, Hindsight (Vectorize) gana**: paper "Hindsight is 20/20: Building Agent Memory that Retains, Recalls, and Reflects" (arXiv:2512.12818, dic. 2025), 91.4% en LongMemEval con Gemini-3 Pro y 83.6% con OSS-20B local, MIT, MCP server integrado, embedded Postgres y soporte Ollama — pero el 91.4% headline requiere LLM frontera (Gemini-3 Pro), no es del sistema de memoria aislado.
- **La mayoría de los "líderes" comerciales no son OSS self-hostable real**: Mem0 sunset OpenMemory (ahora recomienda su self-hosted server), Zep Community Edition fue deprecada en abril 2025 (sólo Graphiti queda OSS, requiere Neo4j/FalkorDB/Kuzu), Supermemory bloquea self-host detrás de contrato enterprise, y Cipher (campfirein) pasó a Elastic License 2.0 (source-available, no OSI) y fue renombrado a ByteRover CLI. El espacio "personal portable para Claude.ai" sigue siendo un hueco real que justifica Naeth.

## Key Findings

### Tabla resumen ranqueada

| # | Sistema | Repo | Licencia | Self-host OSS | Claude.ai (remote MCP) | Claude Code | Storage | Embeddings | LongMemEval | Stars | Score (40) |
|---|---------|------|----------|---------------|------------------------|-------------|---------|------------|-------------|-------|------------|
| 1 | **mcp-memory-service** | doobidoo/mcp-memory-service | Apache-2.0 | Sí | **Sí (explícito en README)** | Sí (hooks + Code Execution) | SQLite-vec / Chroma / Cloudflare hybrid | Local (sentence-transformers, ONNX) | 86.0% R@5 (session-mode, self-reported) | ~6k | 36 |
| 2 | **Hindsight** | vectorize-io/hindsight | MIT | Sí (Docker + embedded PG) | Parcial (HTTP MCP, no probado en claude.ai chat) | Sí (MCP + Skills + hooks) | PostgreSQL embebido (pg0) | API o Ollama local | **91.4% (Gemini-3) / 83.6% (OSS-20B)** | ~13.9k | 35 |
| 3 | **ogham-mcp** | ogham-mcp/ogham-mcp | MIT | Sí | Parcial (stdio/SSE; no probado en claude.ai web) | Sí (hooks instalados auto) | Postgres + pgvector (Supabase/Neon) | API o Ollama | **97.2% R@10** (retrieval only) | ~30 | 31 |
| 4 | **Cognee** | topoteretes/cognee | Apache-2.0 | Sí (1-click Docker) | Parcial (vía MCP server) | Sí (plugin oficial con hooks) | Neo4j/FalkorDB/Kuzu + Redis/Qdrant/Weaviate | API o Ollama | No publicado (KG-centric) | ~12k | 30 |
| 5 | **Letta (ex-MemGPT)** | letta-ai/letta | Apache-2.0 | Sí (Docker recomendado) | Parcial (no MCP server nativo; REST) | Parcial (vía Letta Code) | PostgreSQL | API (configurable) | 83.2% (self-reported, GPT-4) | ~17k | 27 |
| 6 | **Graphiti** | getzep/graphiti | Apache-2.0 | Sí (requiere Neo4j/FalkorDB/Kuzu) | Parcial (MCP server propio) | Sí (MCP server) | Neo4j / FalkorDB / KuzuDB | API | **71.2% (paper, GPT-4o)** | ~24k | 27 |
| 7 | **Mem0 self-hosted** | mem0ai/mem0 | Apache-2.0 | Sí (Docker compose: API+PG+Neo4j) | No directo (OpenMemory sunset; necesita MCP wrapper) | Parcial (tensakulabs/mem0-mcp third-party) | PostgreSQL+pgvector + Neo4j | OpenAI/Ollama | 49.0% (paper, GPT-4o) | ~38k | 25 |
| 8 | **Basic Memory** | basicmachines-co/basic-memory | AGPL-3.0 (verificar) | Sí | Sí (via MCP) | Sí (MCP nativo, 14+ tools) | Markdown files + SQLite index | Local (semantic search) | No publicado | ~4.2k | 30 |
| 9 | **Anthropic Memory MCP** | modelcontextprotocol/servers/memory | MIT | Sí | Sí | Sí | JSON/JSONL file local | Ninguno (sin búsqueda semántica) | No publicado | parte de modelcontextprotocol/servers (~70k) | 22 |
| 10 | **ai-memory-mcp** | alphaonedev/ai-memory-mcp | Apache-2.0 | Sí | Parcial (HTTP API) | Sí (MCP + 26 CLI cmds) | SQLite + FTS5 | Local (FTS5, no vector default) | 97.8% R@5 (self-reported, no replicado) | ~2 | 23 |
| 11 | **MARM-Systems** | Lyellr88/MARM-Systems | Licencia a verificar | Sí | Parcial (HTTP + OAuth) | Sí (HTTP MCP) | SQLite WAL | Local (sentence-transformers all-MiniLM-L6-v2) | No publicado | ~1.5k | 22 |
| 12 | **Memvid** | memvid/memvid | MIT (Rust core) | Sí (single .mv2 file) | Parcial (vía MCP plugin) | Sí (memvid/claude-brain) | Archivo único .mv2 portable | Local ONNX (BGE/Nomic) | LoCoMo bench publicado (memvidbench) | ~10k | 26 |
| 13 | **Memori (MemoriLabs)** | MemoriLabs/Memori | Licencia a verificar | Parcial (SDK sí, "Advanced Augmentation" requiere MEMORI_API_KEY) | Parcial (memori-mcp requiere API key) | Parcial | SQL (PostgreSQL/MySQL/MongoDB/SQLite) | API (LLM-dependent) | LoCoMo 81.95% (self-reported) | ~13–14k | 19 |
| 14 | **MemPalace** | MemPalace/mempalace | MIT | Sí | Parcial (MCP) | Parcial (MCP) | ChromaDB + SQLite | Local (all-MiniLM-L6-v2 default) | 96.6% R@5 raw (controvertido — ver Caveats) | ~19–42k (audit señala compras) | 18 |
| 15 | **EverOS (EverMemOS)** | EverMind-AI/EverOS | Apache-2.0 | Sí | Parcial | Sí (evermem-claude-code plugin) | Configurable | API (GPT-4.1-mini en benchmarks) | **83.0% LongMemEval-S, 93.05% LoCoMo** (arXiv:2601.02163 preprint, no peer-reviewed) | ~3.6k | 24 |

> **Score compuesto (40 max)**: 6 criterios × peso variable. Performance (8) + Encaje Claude (10) + Local-first (8) + Madurez (6) + Features (5) + Cross-client (3). Justificación detallada en cada ficha.

### Hallazgos transversales

1. **El benchmark LongMemEval está siendo manipulado o mal-reportado por casi todos los proyectos.** Casi nadie publica el modo (R@5 vs R@10 vs end-to-end QA), el LLM lector, ni la configuración (oráculo de sesiones vs corpus completo). El paper original (Wu et al., ICLR 2025, arXiv:2410.10813) define el benchmark como QA end-to-end; las cifras altas (>90%) tienden a ser de retrieval-only sobre haystacks pequeños. **Tratar toda cifra > 85% como "claim del proyecto" hasta replicación independiente.**
2. **Solo dos proyectos del Top 15 declaran soporte explícito de `claude.ai` Remote MCP via HTTPS**: `doobidoo/mcp-memory-service` (que lo lista textualmente en su README junto a "ChatGPT Developer Mode") y `Anthropic Memory MCP` oficial (porque Claude.ai lo soporta nativamente). El resto soporta sólo Claude Code/Desktop vía stdio o HTTP local.
3. **El "vendor lock-in" del espacio comercial es mayor de lo que parece**: OpenMemory (mem0) fue sunset en favor del self-hosted server; Zep Community Edition fue deprecada en abril 2025 ("The Zep team deprecated the open source Zep Community Edition in April, 2025" — Zep blog "Announcing a New Direction for Zep's Open Source Strategy"); Supermemory requiere enterprise agreement para self-host; Cipher (Byterover) cambió a Elastic License 2.0 y fue renombrado a ByteRover CLI. **El hueco de "memoria personal portable para chat clients" sigue abierto.**
4. **MemPalace amerita inclusión con asterisco grande.** Los 19-42k stars son cuestionados como compras (gist roman-rr/lhl/agentic-memory), el 96.6% R@5 es esencialmente el score de ChromaDB con `all-MiniLM-L6-v2` sin que el código de "wings/rooms/halls" intervenga (verificado independientemente en Issue #39 por reproducción en M2 Ultra), y el 100% "hybrid" requiere llamadas pagas a Claude Haiku. **No usar como base técnica; sí como caso de estudio de cómo NO comunicar benchmarks.**
5. **El verdadero estado del arte académico en mayo 2026 es Hindsight (Vectorize) + EverMemOS (EverMind)**, ambos con preprints reproducibles. Hindsight tiene la mejor combinación de benchmark + licencia (MIT) + integración Claude Code + soporte local (Ollama + embedded Postgres).

## Details — fichas por sistema

### 1) mcp-memory-service (doobidoo) — **Recomendado como base para Naeth**

- **Repo / web**: https://github.com/doobidoo/mcp-memory-service
- **Licencia**: Apache-2.0 (verificar en LICENSE — README dice "MIT License" en una sección y Apache-2.0 en otra; auditar antes de derivar).
- **Self-host OSS**: Sí, completo.
- **Parte de pago**: No. Cloudflare backend es opcional como modo "hybrid" para producción.
- **Claude.ai (remote MCP HTTPS)**: **Sí, explícito en README** — listado como cliente soportado junto a Claude Code, Cursor, Windsurf, Codex CLI, Goose, Aider, GitHub Copilot CLI, OpenCode, ChatGPT Developer Mode.
- **Claude Code**: Sí, hooks de Claude Code soportados (`python install.py --claude-code` + `scripts/install_claude_hooks.py`); Code Execution API path desde v8.19.0+.
- **Otros clientes MCP**: 13+: Claude Desktop, VS Code, Cursor, Windsurf, JetBrains, Zed, Cody, Continue, Replit, Sourcegraph, Qodo, Raycast, Kilo Code, Amp.
- **Storage backend**: SQLite-vec (default, single-file), ChromaDB, Cloudflare (Vectorize+D1+R2), modo Hybrid (SQLite local + Cloudflare sync), Milvus (update_memory nativo añadido en PR #966).
- **Embeddings**: Local, sentence-transformers + ONNX runtime (imagen `:quality-cpu` sin PyTorch en runtime). Sin API keys obligatorias.
- **Diferenciador clave**: Es el único proyecto que mantiene compatibilidad explícita y testeada con la matriz completa de clientes MCP del ecosistema (incluido `claude.ai` Remote MCP), con backends conmutables, OAuth 2.1, dashboard web (puerto 8888), 24 herramientas MCP con annotations (read-only / destructive / additive), y consolidación autónoma como característica del proyecto.
- **LongMemEval R@5**: 86.0% en modo `memory_store_session` (v10.35.0+), self-reported. Modo turn-level por defecto da menos por diseño (granularidad fina vs session-level del benchmark).
- **Otros benchmarks**: No publicados de forma independiente. El proyecto publicó análisis transparente de la diferencia con MemPalace ("MemPalace stores each conversation as a single unit; mcp-memory-service defaults to turn-level storage").
- **Stars GitHub**: ~6k (mayo 2026, estimación basada en actividad y métricas de PRs).
- **Último release**: v8.69.0 (2026-01-04) → cadena de patches hasta v8.70.0 (2026-01-05). Muy activo.
- **Estado comunidad**: Releases semanales, contribuciones múltiples (PR #966 Milvus, Bryan Thompson/@triepod-ai tool annotations), Wiki extensa de 13 secciones, roadmap explícito.
- **Pros**:
  1. La única opción que matchea la matriz `claude.ai web` + `Claude Code` + local-first sin compromisos.
  2. Backends conmutables (puedes empezar con SQLite-vec y escalar a Cloudflare/Chroma sin migrar datos).
  3. Cumplimiento de la spec SHODH Unified Memory API v1.0.0 (interoperabilidad export/import documentada).
- **Cons**:
  1. La cifra LongMemEval depende del modo (turn vs session); falta benchmark independiente.
  2. Documentación dispersa entre README, Wiki y CHANGELOG; auditoría licencia recomendada antes de forkear.
  3. Knowledge graph es funcional pero menos sofisticado que Graphiti (sin valid_at/invalid_at intervals).
- **Puntuación compuesta: 36/40**. Performance 6/8 (sin replicación independiente de su 86%), Encaje Claude 10/10, Local-first 8/8, Madurez 5/6, Features 4/5 (KG simple), Cross-client 3/3.

### 2) Hindsight (Vectorize)

- **Repo**: https://github.com/vectorize-io/hindsight (benchmarks en `vectorize-io/hindsight-benchmarks`)
- **Licencia**: MIT (Copyright 2025 Vectorize AI, Inc., confirmado en LICENSE).
- **Self-host OSS**: Sí. Docker `ghcr.io/vectorize-io/hindsight:latest` con PostgreSQL embebido (pg0). Helm chart disponible. Soporte Oracle Database añadido recientemente.
- **Parte de pago**: Hindsight Cloud (hosted) es comercial; el OSS no tiene feature gating.
- **Claude.ai (remote MCP HTTPS)**: No documentado explícitamente; el MCP server existe pero los snippets oficiales muestran Claude Code y Claude Desktop, no `claude.ai`. **Marcar como "no verificado para chat web".**
- **Claude Code**: Sí. MCP server en `/mcp` enabled por defecto; HTTP transport documentado: `claude mcp add --transport http hindsight http://localhost:8888/mcp --header "Authorization: Bearer ..."`. Plus hooks integration y un Agent Skill instalable según el roadmap del maintainer.
- **Otros clientes MCP**: Cursor, Pydantic AI, OpenClaw, Claude Desktop. SDKs en Python y Node.js.
- **Storage backend**: PostgreSQL embebido (modo local) o externo. Sin pgvector explícito (usa sus propios índices temporal/entity-graph).
- **Embeddings / LLM**: Configurable via `HINDSIGHT_API_LLM_PROVIDER`. Soporta OpenAI, Anthropic, Gemini, Groq, **y Ollama** (modo 100% local desde marzo 2026).
- **Diferenciador clave**: Stack de cuatro estrategias de recuperación en paralelo (semantic + BM25 + graph traversal + temporal reasoning) con cross-encoder reranker. Único OSS que ha superado 90% en LongMemEval con código reproducible.
- **LongMemEval (paper "Hindsight is 20/20: Building Agent Memory that Retains, Recalls, and Reflects", arXiv:2512.12818, dic. 2025)**:
  - **91.4%** overall con Gemini-3 Pro
  - **89.0%** con OSS-120B (GPT-OSS)
  - **83.6%** con OSS-20B
  - **temporal-reasoning**: 91.0% (vs Zep 62.4%, Supermemory 82.0%)
  - **multi-session**: 87.2%
  - Reproducción validada por Virginia Tech's Sanghani Center for AI and Data Analytics y por Andrew Neeser (Applied Machine Learning Scientist en The Washington Post, citado en la nota de prensa Vectorize/PRNewswire del 16 de diciembre de 2025: *"Agent memory is one of the most critical unsolved problems in AI right now. Every team building production agents is struggling with these same challenges."*).
- **Otros benchmarks**: LoCoMo 89.61% (OSS-120B), 85.67% (OSS-20B); ambos > 75.78% del best prior open system.
- **Stars GitHub**: ~13.9k (mayo 2026).
- **Último release**: v0.6.2 (14 mayo 2026); release cadence semanal.
- **Pros**:
  1. Benchmark state-of-the-art reproducible (paper + repo de benchmarks separado).
  2. Stack de retrieval que no depende de un LLM monstruoso para funcionar (83.6% con 20B local).
  3. Embedded Postgres → cero setup de DB para uso personal.
- **Cons**:
  1. El 91.4% headline requiere Gemini-3 Pro (no es del sistema de memoria aislado).
  2. Sin compatibilidad explícita documentada con `claude.ai` Remote MCP.
  3. El stack es más pesado (4 retrievers + reranker) que un MCP server simple — sobreingeniería para chat personal.
- **Puntuación compuesta: 35/40**. Performance 8/8, Encaje Claude 7/10 (no claude.ai web), Local-first 8/8, Madurez 5/6, Features 5/5, Cross-client 2/3.

### 3) ogham-mcp

- **Repo**: https://github.com/ogham-mcp/ogham-mcp
- **Licencia**: MIT.
- **Self-host OSS**: Sí.
- **Parte de pago**: No.
- **Claude.ai (remote MCP HTTPS)**: No probado explícitamente; soporta SSE pero el target principal es Claude Code/Cursor/Kiro.
- **Claude Code**: Sí, con `ogham hooks install` (auto-detección de cliente: Claude Code, Cursor, Kiro), masking automático de secretos (API keys, JWTs, tokens), filtrado inteligente (skip de `ls/pwd/git add`).
- **Otros clientes MCP**: Cursor, Kiro, OpenCode, VS Code.
- **Storage backend**: PostgreSQL + pgvector (Supabase, Neon, o self-hosted Postgres 15+). Embeddings dim configurable (default 512).
- **Embeddings**: API (OpenAI default) o Ollama local.
- **Diferenciador clave**: **97.2% Recall@10 en LongMemEval con UNA sola query Postgres**, sin reranking neural, sin grafo separado. Convex Combination Fusion (pgvector cosine + tsvector BM25). Plus features cognitivas server-side: novelty detection, content signal scoring, automatic condensing de memorias antiguas.
- **LongMemEval**:
  - Retrieval R@10: **97.2%**
  - End-to-end QA con gpt-5.4-mini reader + rubric judge: 91.8% (459/500)
  - AMB harness (Vectorize's stricter substring judge): 85.8% (429/500) con GPT-5-mini + Gemini 2.5 Flash Lite judge
- **Otros benchmarks**: BEAM 100K (ICLR 2026): nugget score 0.554 (vs 0.358 baseline Llama-4-Maverick+LIGHT), R@10 0.737.
- **Stars GitHub**: ~30 (proyecto nuevo, marzo 2026); fork potential alto.
- **Último release**: 0.6.1 (PyPI), commits a 16 marzo 2026.
- **Pros**:
  1. Arquitectura simple y potente: una query SQL contra Postgres + tsvector resuelve el 97.2% R@10. Sin grafo separado, sin LLM en el search loop.
  2. Hooks de Claude Code auto-configurados con filtrado inteligente y masking de secretos.
  3. Append-only audit log alineado con OTEL GenAI Semantic Conventions (GDPR art. 15 friendly).
- **Cons**:
  1. Requiere Postgres + pgvector — no "single-file" como SQLite-vec.
  2. Proyecto muy joven, ~30 stars; sin replicación independiente aún.
  3. Sin soporte explícito para `claude.ai` web.
- **Puntuación compuesta: 31/40**.

### 4) Cognee (topoteretes)

- **Repo**: https://github.com/topoteretes/cognee
- **Licencia**: Apache-2.0.
- **Self-host OSS**: Sí (Free tier explícito: "Build and run memory workflows with tasks and pipelines, Auto-generate knowledge structures, Integrated evaluations, 28+ data sources, Community support — View on GitHub").
- **Parte de pago**: Cognee Cloud (Cogwit) hosted; tier Developer y Enterprise.
- **Claude.ai (remote MCP HTTPS)**: Parcial (vía MCP server independiente).
- **Claude Code**: **Sí, plugin oficial `cognee-integrations/integrations/claude-code`** con hooks SessionStart / PostToolUse / UserPromptSubmit / PreCompact / SessionEnd. El plugin hace OAuth handshake antes del primer comando.
- **Otros clientes MCP**: OpenClaw (`cognee-openclaw`), LangGraph, cualquier MCP-runtime.
- **Storage backend**: Poly-store. Grafos: Neo4j, FalkorDB, KuzuDB, NetworkX. Vectores: Redis, Qdrant, Weaviate, LanceDB. Relacional: SQLite o Postgres.
- **Embeddings**: API u Ollama local. Guía oficial para 100% local con Ollama documentada.
- **Diferenciador clave**: ECL (Extract, Cognify, Load) pipeline auto-genera ontologías y knowledge graph; el sistema mejora con feedback loops y soporta multimodal (texto, imágenes, audio transcriptions). Adoptado por Bayer y Univ. of Wyoming.
- **LongMemEval**: No publicado oficialmente por Cognee. Otras fuentes lo posicionan como "knowledge graph + vector" más que "benchmark-leader".
- **Stars GitHub**: ~12k.
- **Último release**: activo; graduated del GitHub Secure Open Source Program.
- **Pros**:
  1. Plugin de Claude Code production-grade con hook lifecycle completo.
  2. 30+ data source connectors (Notion, GDrive, GitHub, etc.) — bueno si Naeth quiere ingestar más allá del chat.
  3. Graduación del GitHub Secure OSS Program (firma de seguridad real).
- **Cons**:
  1. Poly-store implica más infra para self-host comparado con SQLite-vec o memvid.
  2. Sin cifras LongMemEval publicadas — difícil de comparar.
  3. Plugin de Claude Code requiere `LLM_API_KEY` por defecto (Ollama es opcional).
- **Puntuación compuesta: 30/40**.

### 5) Letta (ex-MemGPT)

- **Repo**: https://github.com/letta-ai/letta
- **Licencia**: Apache-2.0.
- **Self-host OSS**: Sí, Docker recomendado.
- **Parte de pago**: Letta Cloud (Pro $20+/mo, Letta Code).
- **Claude.ai (remote MCP HTTPS)**: No nativo. Letta es un *runtime* de agentes (REST API), no un MCP server. Habría que envolver.
- **Claude Code**: Parcial (Letta Code es el coding agent propio; tiene "claude-subconscious" repo en su org y comparte un repositorio de skills con Claude Code y Codex CLI).
- **Otros clientes MCP**: Cualquiera vía REST + SDKs (Python/TypeScript) + Agent File (.af) format.
- **Storage backend**: PostgreSQL.
- **Embeddings**: API configurable (OpenAI default, soporta local providers).
- **Diferenciador clave**: Memory hierarchy OS-inspired (Core / Recall / Archival) basada en el paper MemGPT. Agentes son entidades persistentes con tools, no sólo memoria. Agent File (.af) format para serializar agentes completos.
- **LongMemEval**: 83.2% self-reported (paper original MemGPT no probado en LongMemEval por incompatibilidad de ingestion; cifras Letta posteriores).
- **Stars GitHub**: ~17k.
- **Último release**: Muy activo (Letta Code, Letta Evals, Letta Filesystem en 2025).
- **Pros**:
  1. Arquitectura de memoria más madura conceptualmente del Top (MemGPT paper).
  2. Whitebox, model-agnostic, agente entero versionable.
  3. Ecosistema de tools enterprise-grade (Composio, LangChain, CrewAI).
- **Cons**:
  1. Lock-in arquitectural fuerte: adoptarlo es adoptar todo el runtime, no sólo memoria.
  2. Sin MCP server nativo — desencaje con la matriz `claude.ai` + Claude Code que pide el usuario.
  3. Sin cifras LongMemEval replicadas independientemente.
- **Puntuación compuesta: 27/40**.

### 6) Graphiti (getzep)

- **Repo**: https://github.com/getzep/graphiti
- **Licencia**: Apache-2.0.
- **Self-host OSS**: Sí, pero requiere Neo4j / FalkorDB / KuzuDB externo. **Zep Community Edition fue deprecada en abril 2025** (Zep blog "Announcing a New Direction for Zep's Open Source Strategy"); ahora Graphiti es el único OSS de Zep.
- **Parte de pago**: Zep Cloud ($25/mo Flex hasta enterprise).
- **Claude.ai (remote MCP HTTPS)**: Parcial vía MCP server propio.
- **Claude Code**: Sí, MCP server documentado.
- **Otros clientes MCP**: Cursor, Claude Desktop, "any AI assistant".
- **Storage backend**: Neo4j (default), FalkorDB, KuzuDB.
- **Embeddings**: API (OpenAI default, configurable).
- **Diferenciador clave**: Temporal knowledge graph con `valid_at` / `invalid_at` timestamps en cada nodo y arista. Único proyecto que responde correctamente "qué creía el agente el martes pasado". Hybrid search: semantic + BM25 + graph traversal.
- **LongMemEval (paper Rasmussen et al., arXiv:2501.13956)**: **71.2% overall (GPT-4o)**, 63.8% en temporal sub-task, latencia 2.6s (vs 29s baseline full-context).
- **Otros benchmarks**: DMR (MemGPT) baseline.
- **Stars GitHub**: ~24k. Descargas semanales en PyPI: **77,845 downloads/week** (pypistats.org, datos marzo 2026; el frecuentemente citado "25,000 weekly PyPI downloads" es un hito anterior cuando Graphiti tenía ~14k stars, según el blog "Graphiti Knowledge Graphs FalkorDB Support" de Zep).
- **Pros**:
  1. Razonamiento temporal real, no simulado — único en este aspecto.
  2. Paper publicado con resultados reproducibles (arXiv:2501.13956).
  3. Sin paywall del feature de grafo (a diferencia de Mem0 Pro $249/mo).
- **Cons**:
  1. **Requiere base de datos de grafos** (Neo4j/FalkorDB/Kuzu) — no es "drop a binary".
  2. La memoria es Apache-2.0 pero la suite gestionada (Zep Cloud) absorbe el desarrollo. Comm. Edition deprecada.
  3. Setup pesado para un usuario individual con Claude.ai + Claude Code.
- **Puntuación compuesta: 27/40**.

### 7) Mem0 self-hosted (mem0ai/mem0)

- **Repo**: https://github.com/mem0ai/mem0
- **Licencia**: Apache-2.0 (OSS); SaaS comercial.
- **Self-host OSS**: Sí, full-stack vía docker-compose (FastAPI + PostgreSQL+pgvector + Neo4j).
- **Parte de pago**: Mem0 Cloud ($19/mo 50K memorias, $249/mo Pro con grafo).
- **Claude.ai (remote MCP HTTPS)**: No directo. **OpenMemory MCP (la solución para Claude Desktop/Cursor/Windsurf via MCP) fue sunset en 2025/2026** ("OpenMemory is being sunset. For local self-hosted memory with a dashboard, please use the Mem0 self-hosted server instead.").
- **Claude Code**: Parcial via terceros (`tensakulabs/mem0-mcp` mantiene un MCP server para self-hosted Mem0 con Qdrant + Neo4j + Ollama).
- **Otros clientes MCP**: Vía wrappers. Mem0 nativo es API/SDK, no MCP.
- **Storage backend**: PostgreSQL+pgvector + Neo4j (default), o Qdrant alternativo.
- **Embeddings**: OpenAI default (text-embedding-3-small), reemplazable por Ollama.
- **Diferenciador clave**: Mayor ecosistema y comunidad (~38k stars, 5500+ forks). Vector-first con grafo opcional. SDK más maduro multi-lenguaje (Python + JS).
- **LongMemEval**: **49.0% (paper, GPT-4o)** — el peor del Top en temporal reasoning según comparativas (atlan, vectorize).
- **Otros benchmarks**: LoCoMo ~62% self-reported.
- **Stars GitHub**: ~38k (el más alto del Top).
- **Pros**:
  1. Comunidad masiva, integraciones con LangChain/CrewAI/AutoGen/Strands oficiales.
  2. Self-host completo, sin gating de features en OSS.
  3. SDKs multi-lenguaje sólidos.
- **Cons**:
  1. **Sunset de OpenMemory** = el camino "memoria local via MCP" está roto oficialmente.
  2. 49% LongMemEval es flojo comparado con Zep/Hindsight/EverOS.
  3. Grafo en cloud detrás de paywall de $249/mo (en self-host es gratis pero "differs from the managed Pro tier").
- **Puntuación compuesta: 25/40**.

### 8) Basic Memory (basicmachines-co)

- **Repo**: https://github.com/basicmachines-co/basic-memory
- **Licencia**: AGPL-3.0 (verificar — referenciado como OSS y "no lock-in", licencia exacta consultar LICENSE).
- **Self-host OSS**: Sí.
- **Parte de pago**: Basic Memory Cloud (hosted, $14.25–19/mo).
- **Claude.ai (remote MCP HTTPS)**: Sí vía MCP.
- **Claude Code**: Sí, MCP nativo con 14+ tools.
- **Otros clientes MCP**: Claude Desktop, Codex, Cursor, ChatGPT (Custom GPTs), VS Code, "anything that speaks MCP".
- **Storage backend**: **Archivos Markdown locales + índice SQLite**. Compatible con Obsidian directamente.
- **Embeddings**: Local, semantic search sobre Markdown.
- **Diferenciador clave**: Los datos son **archivos Markdown legibles por humanos** en disco, no DB opaca. Knowledge graph emerge de wikilinks `[[...]]` y observations semánticas. FastMCP 3.0 + tool annotations (readOnly/destructive/idempotent/openWorld) → agente descubre capabilities progresivamente.
- **LongMemEval**: No publicado.
- **Otros benchmarks**: No publicados.
- **Stars GitHub**: ~4.2k.
- **Pros**:
  1. **Soberanía de datos extrema**: tus memorias son archivos `.md` editables con cualquier editor (Obsidian, VS Code, vim).
  2. Tool annotations bien diseñadas — agentes no rompen cosas.
  3. Bi-direccional: humano y LLM escriben al mismo archivo.
- **Cons**:
  1. Sin benchmarks publicados.
  2. AGPL puede ser problemático si Naeth se monetiza como SaaS.
  3. Búsqueda semántica sobre Markdown es menos potente que vector DB dedicado.
- **Puntuación compuesta: 30/40**.

### 9) Anthropic Memory MCP server (modelcontextprotocol/servers/memory)

- **Repo**: https://github.com/modelcontextprotocol/servers/tree/main/src/memory
- **Licencia**: MIT.
- **Self-host OSS**: Sí (es código de referencia).
- **Parte de pago**: No.
- **Claude.ai (remote MCP HTTPS)**: Sí (es el server de referencia oficial).
- **Claude Code**: Sí.
- **Otros clientes MCP**: Universal — es la referencia.
- **Storage backend**: Archivo JSONL local (`memory.jsonl`).
- **Embeddings**: **Ninguno** — sin búsqueda semántica, solo grafo de entidades/relaciones/observaciones.
- **Diferenciador clave**: La implementación oficial mínima. Knowledge graph (Entity / Relation / Observation), simple, auditeable, perfecto para personalización de chat con prompts custom (ej. en Claude.ai Projects).
- **LongMemEval**: No publicado (no aplicable — sin embeddings).
- **Stars GitHub**: parte de modelcontextprotocol/servers (~70k).
- **Pros**:
  1. Referencia oficial; siempre compatible con la última spec MCP.
  2. JSONL file legible/inspeccionable; cero magia.
  3. Cero dependencias pesadas.
- **Cons**:
  1. **Sin búsqueda semántica** → escala mal pasados unos cientos de memorias.
  2. Sin temporal queries, sin decay, sin consolidación.
  3. Es una *demo*, no un sistema de producción.
- **Puntuación compuesta: 22/40**. Útil como baseline/referencia para Naeth, no como destino final.

### 10) ai-memory-mcp (alphaonedev)

- **Repo**: https://github.com/alphaonedev/ai-memory-mcp
- **Licencia**: Apache-2.0 (Copyright 2026 AlphaOne LLC).
- **Self-host OSS**: Sí.
- **Parte de pago**: No.
- **Claude.ai (remote MCP HTTPS)**: Parcial (HTTP API + serve HTTPS via reverse proxy).
- **Claude Code**: Sí, MCP nativo.
- **Otros clientes MCP**: Claude, ChatGPT, Grok, Cursor, Windsurf, Llama, Goose; PPA Ubuntu + COPR Fedora + Homebrew + irm Windows.
- **Storage backend**: SQLite con FTS5 (sin vectores por defecto).
- **Embeddings**: No por defecto (FTS5 keyword search). Vector opcional.
- **Diferenciador clave**: Escrito en **Rust**, zero token cost hasta recall explícito (no carga toda la memoria en cada turno como Anthropic Memory Tool nativo), 6-factor scoring, formato TOON (Token-Oriented Object Notation, 79% más compacto que JSON), 3 tiers (short/mid/long-term) con auto-promoción.
- **LongMemEval**: Claim de 97.8% R@5 self-reported, **no replicado independientemente**. Tratar como marketing.
- **Stars GitHub**: ~2 (proyecto muy nuevo).
- **Pros**:
  1. Rust → binarios sin dependencias, instalación trivial.
  2. Distribución multi-plataforma (PPA/COPR/PowerShell).
  3. Diseño consciente del coste de tokens.
- **Cons**:
  1. Muy nuevo, ~2 stars; sin comunidad real aún.
  2. 97.8% R@5 sin replicación → poco creíble en absoluto.
  3. FTS5 default sin vectores limita recall semántico.
- **Puntuación compuesta: 23/40**.

### 11) MARM-Systems (Lyellr88)

- **Repo**: https://github.com/Lyellr88/MARM-Systems
- **Licencia**: No explícita en los hits (revisar LICENSE en repo).
- **Self-host OSS**: Sí.
- **Parte de pago**: No (gratis tier para developers explícito).
- **Claude.ai (remote MCP HTTPS)**: Parcial — HTTP MCP con OAuth local.
- **Claude Code**: Sí, MCP HTTP.
- **Otros clientes MCP**: Claude Code, Qwen CLI, Gemini CLI, Grok CLI, cualquier MCP-compatible.
- **Storage backend**: SQLite WAL + connection pooling custom.
- **Embeddings**: Local, sentence-transformers `all-MiniLM-L6-v2`.
- **Diferenciador clave**: 19 MCP tools, response size compliance MCP 1MB, event-driven automation, IP-based rate limiting + usage analytics, Docker containerized con health monitoring, **WebSocket support** además de HTTP/STDIO.
- **LongMemEval**: No publicado.
- **Stars GitHub**: ~1.5k.
- **Pros**:
  1. Triple transport (STDIO + HTTP + WebSocket).
  2. Suite de tests diagnósticos profesionales (security, performance, integration, MCP size limits, WebSocket).
  3. Auto-classification de tipo de contenido (decisión, código, configuración, etc.).
- **Cons**:
  1. Sin benchmarks publicados.
  2. Maintenance pausada Q4 2025 (anunciado), retoma Q1-Q2 2026.
  3. Licencia no clara en snippets — auditar.
- **Puntuación compuesta: 22/40**.

### 12) Memvid (memvid/memvid)

- **Repo**: https://github.com/memvid/memvid
- **Licencia**: MIT (core Rust).
- **Self-host OSS**: Sí.
- **Parte de pago**: No.
- **Claude.ai (remote MCP HTTPS)**: Parcial vía MCP plugin.
- **Claude Code**: Sí, `memvid/claude-brain`: "Give Claude Code photographic memory in ONE portable file. No database, no SQLite, no ChromaDB - just a single .mv2 file you can git commit, scp, or share. Native Rust core with sub-ms operations".
- **Otros clientes MCP**: Vía SDK Python/Node.
- **Storage backend**: **Single-file `.mv2`** (originalmente texto-en-video MP4, ahora formato propio Rust).
- **Embeddings**: Local ONNX (BGE-small/base, Nomic v1.5, Whisper para audio). Descarga directa de HuggingFace.
- **Diferenciador clave**: La memoria es **un único fichero `.mv2`** que puedes `git commit`, `scp`, compartir. Portabilidad extrema. Soporte multi-modal (texto + audio vía Whisper).
- **LongMemEval**: No reportado directamente; tiene `memvidbench` para LoCoMo.
- **Otros benchmarks**: LoCoMo via `memvidbench` (10 × ~26K-token conversations, LLM-as-Judge).
- **Stars GitHub**: ~10k.
- **Pros**:
  1. **Portabilidad sin igual** — el archivo .mv2 es la memoria.
  2. Rust core con operaciones sub-ms, 10-100x faster que la versión Python original.
  3. ONNX embeddings 100% locales sin API keys.
- **Cons**:
  1. Modelo "single-file" no escala bien a equipos / multi-user.
  2. Sin temporal reasoning ni KG estructurado.
  3. Cambió de paradigma (Python texto-en-video → Rust .mv2) — algunas guías obsoletas en circulación.
- **Puntuación compuesta: 26/40**.

### 13) Memori (MemoriLabs)

- **Repo**: https://github.com/MemoriLabs/Memori (+ `MemoriLabs/memori-mcp`)
- **Licencia**: No explícita en snippets — auditar.
- **Self-host OSS**: **Parcial.** El SDK Memori es OSS, **pero "Memori Advanced Augmentation" requiere `MEMORI_API_KEY`** (free tier disponible con quotas, pero es key obligatoria). BYODB documentado.
- **Parte de pago**: Memori Cloud (managed) + VPC/on-prem enterprise.
- **Claude.ai (remote MCP HTTPS)**: Parcial via `memori-mcp` (requiere `X-Memori-API-Key`).
- **Claude Code**: Parcial via `memori-mcp`.
- **Otros clientes MCP**: OpenClaw plugin oficial.
- **Storage backend**: SQL-native: PostgreSQL, MySQL, MongoDB, SQLite, BYODB.
- **Embeddings**: API (LLM-dependent: OpenAI, Anthropic, Google).
- **Diferenciador clave**: "SQL-native" memory; estructura en tablas SQL relacionales (no vector primero); claim de eficiencia de tokens 20× mejor que full-context.
- **LongMemEval**: No publicado directamente; LoCoMo 81.95% self-reported (paper own).
- **Otros benchmarks**: LoCoMo 81.95% con ~1,294 tokens/query (4.97% del coste full-context).
- **Stars GitHub**: ~13–14k (anunciado milestone abril 2026).
- **Pros**:
  1. SQL-native facilita auditoría y debugging.
  2. BYODB → tus datos en tu DB.
  3. LoCoMo 81.95% con uso muy bajo de tokens — eficiencia real.
- **Cons**:
  1. **Requiere `MEMORI_API_KEY` para Advanced Augmentation** — viola el criterio "cero API keys obligatorias" del usuario. Para Naeth, esto descalifica como base.
  2. Sin LongMemEval publicado, sólo LoCoMo.
  3. Cifras LoCoMo no replicadas independientemente.
- **Puntuación compuesta: 19/40**.

### 14) MemPalace (con asterisco grande)

- **Repo**: https://github.com/MemPalace/mempalace (originalmente milla-jovovich/mempalace)
- **Licencia**: MIT.
- **Self-host OSS**: Sí.
- **Parte de pago**: No.
- **Claude.ai (remote MCP HTTPS)**: Parcial (MCP).
- **Claude Code**: Parcial (MCP).
- **Otros clientes MCP**: Cursor, ChatGPT (Developer Mode).
- **Storage backend**: ChromaDB + SQLite.
- **Embeddings**: Local, `all-MiniLM-L6-v2` (ChromaDB default).
- **Diferenciador clave**: Estructura "palace" inspirada en el mnemonic Method of Loci (wings/rooms/halls/drawers). **Pero el código de la estructura NO interviene en la métrica headline**.
- **LongMemEval**:
  - **Claim**: 96.6% raw, 100% hybrid (con Claude Haiku reranking pagado).
  - **Realidad** (Issues #27, #29, #39, #214, audits de lhl/agentic-memory y roman-rr): El modo `raw` "builds a fresh chromadb.EphemeralClient() per question and never touches the palace, wings, or rooms code paths". El 96.6% es **el score de all-MiniLM-L6-v2 sobre ChromaDB**, no de MemPalace. AAAK compression degrada a 84.2% (-12.4pp). El 100% requiere Haiku pagado.
  - **Replicación independiente en M2 Ultra** (Issue #39): "raw 96.6% reproduces exactly... however 96.6% is effectively a benchmark of all-MiniLM-L6-v2 embeddings on this dataset rather than of the palace architecture itself".
- **Otros controversias**:
  - Repository nominalmente atribuido a Milla Jovovich + Ben Sigman; cuenta original ("aya-thekeeper") deleted post-launch.
  - Kotaku ("Resident Evil Star's AI-Coded Tool Accused Of Being Snake Oil", kotaku.com/resident-evil-jovovich-mempalace-ai-github-2000685786, publicado tras el anuncio del 6 de abril) reportó: *"a cryptocoin called MemPalace, for which Jovovich and Sigman have a 50-percent creator reward split, was pumped and subsequently dumped within 24 hours of MemPalace's announcement"*. Sigman es identificado como owner/CEO de la marketplace de "Bitcoin lending" Libre.
  - Audit roman-rr alega "42,000 purchased stars" (no demostrado pero star growth fue anómalo).
- **Stars GitHub**: ~19–42k (rango por discrepancia entre fuentes; tratar con escepticismo).
- **Pros**:
  1. Caso de estudio educativo sobre cómo NO publicar benchmarks.
  2. El modo raw confirma que ChromaDB + all-MiniLM-L6-v2 es una baseline más fuerte de lo esperado.
- **Cons**:
  1. **Marketing inflado**: el headline atribuye al "Palace" un score que es de ChromaDB stock.
  2. Drama no-técnico (cuenta deleted, crypto token MemPalace pump-and-dump documentado por Kotaku, celebrity angle) → señal de baja confianza.
  3. AAAK "lossless compression" es lossy para retrieval (-12.4pp).
- **Puntuación compuesta: 18/40**. **No usar como base para Naeth.**

### 15) EverOS / EverMemOS (EverMind-AI)

- **Repo**: https://github.com/EverMind-AI/EverOS (umbrella; contiene `methods/EverCore`, `methods/HyperMem`, benchmarks). Plus `EverMind-AI/EverMemOS` con evaluation code.
- **Licencia**: Apache-2.0.
- **Self-host OSS**: Sí.
- **Parte de pago**: EverMind hosted.
- **Claude.ai (remote MCP HTTPS)**: Parcial.
- **Claude Code**: Sí (`evermem-claude-code` plugin oficial con auto-migrate de SDK).
- **Otros clientes MCP**: Vía evermem SDK.
- **Storage backend**: Configurable.
- **Embeddings**: API (GPT-4.1-mini en benchmarks); reemplazable.
- **Diferenciador clave**: Self-organizing memory OS con HyperMem (Memory Sparse Attention research) y EverCore.
- **LongMemEval**: **83.00% LongMemEval-S** (paper "EverMemOS: A Self-Organizing Memory Operating System for Structured Long-Horizon Reasoning", Hu et al., arXiv:2601.02163, 5 ene. 2026, preprint sin venue acceptance verificable).
- **Otros benchmarks**: **LoCoMo 93.05%, HaluMem 90.04%** (mismos preprints). HyperMem reporta LoCoMo 92.73% en arXiv:2604.08256 separado.
- **Stars GitHub**: ~3.6k.
- **Pros**:
  1. Mejor combinación de scores LoCoMo + LongMemEval con OSS Apache-2.0.
  2. Plugin Claude Code oficial.
  3. Multi-benchmark presence (HaluMem, EvoAgentBench, EverMemBench).
- **Cons**:
  1. **Todos los benchmarks usan GPT-4.1-mini en el paper** (verbatim en el PDF: *"All methods are based on GPT-4.1-mini"*) — no es el score del sistema aislado.
  2. arXiv preprint, **sin venue acceptance verificable** — claims marketing-grade.
  3. Ecosistema fragmentado (EverOS / EverMemOS / EverCore / HyperMem / EverMe-CLI) — confuso para adoptar.
- **Puntuación compuesta: 24/40**.

## Recommendations — plan de acción para Naeth

### Fase 0 (esta semana): validar tesis del gap
1. **Forkear `doobidoo/mcp-memory-service`** y verificar end-to-end:
   - `claude.ai` (web chat) conecta vía Remote MCP HTTPS sin issues.
   - Claude Code hooks consolidan memorias entre sesiones.
   - SQLite-vec backend funciona sin Cloudflare credentials.
2. **Auditar la licencia exacta** (README muestra Apache-2.0 y MIT en distintos lugares — clarificar antes de derivar).
3. Probar el **plugin de Claude Code de Cognee** como contra-ejemplo: ver qué hooks de session lifecycle son realmente útiles para el caso de chat-client del usuario.

### Fase 1 (primer mes): MVP de Naeth
1. **Base**: fork de `mcp-memory-service`. Mantener compatibilidad con la spec SHODH Unified Memory API v1.0.0 para portabilidad futura.
2. **Diferenciadores de Naeth a añadir** (basados en gaps observados):
   - **Personal-first prompt template**: equivalente al "User Identification → Memory Retrieval → Memory" del Anthropic Memory MCP, pero optimizado para Claude.ai Projects custom instructions.
   - **Cross-client identity**: una sola "yo" entre Claude.ai web, Claude Code, Cursor — implementar entity resolution por defecto.
   - **Audit log estilo Ogham** alineado con OTEL GenAI Semantic Conventions (importable a Naeth desde `ogham-mcp`).
3. **Embeddings 100% locales** desde día 1 (ONNX, sin caída a API). Replicar el patrón de `:quality-cpu` Docker image de doobidoo.

### Fase 2 (3-6 meses): publicación
1. **Benchmark independiente y honesto**: replicar LongMemEval R@5 / R@10 / end-to-end QA con configuración estándar (LongMemEval-S 500 questions, gpt-4o-mini reader, recall_any@5). **No publicar cifras > 90% sin replicación cruzada por un tercero.**
2. **Paper/blog técnico**: el gap real que documentar es "memoria personal portable para chat clients", no "mejor accuracy en benchmark X". La narrativa MemPalace/EverMind/Memori muestra que el espacio está saturado de claims inflados — el ángulo sano es soberanía + UX.
3. **Spec abierta**: extender SHODH UMAS v1.0.0 con campos para `client_id` (claude.ai vs claude-code vs cursor) y `user_intent` (project-scoped vs global). Proponer a doobidoo, basicmachines-co, ogham-mcp como reviewers.

### Umbrales que cambian la recomendación
- **Si Hindsight publica soporte oficial `claude.ai` Remote MCP HTTPS → moverlo a #1** (su benchmark + MIT + embedded Postgres lo justifica).
- **Si Mem0 lanza un nuevo OpenMemory MCP oficial post-sunset → re-evaluar** (su comunidad de 38k es difícil de ignorar).
- **Si EverMemOS arXiv pasa a peer-review en ICLR/NeurIPS → considerar arquitectura HyperMem como referencia** para v2 de Naeth.
- **Si MemPalace publica un benchmark con la palace architecture realmente activa y código reproducible → revisar** (hasta entonces, no usar).

## Caveats

- **Benchmarks**: Casi ninguna cifra > 85% en este espacio está replicada independientemente. El paper LongMemEval original (Wu et al., ICLR 2025, arXiv:2410.10813) define el benchmark como QA end-to-end (retrieval + LLM + judge), pero proyectos reportan a menudo retrieval-only R@5/R@10 sin clarificarlo. Hindsight (replicado por Virginia Tech's Sanghani Center for AI and Data Analytics y Andrew Neeser de The Washington Post) y Graphiti (paper arXiv:2501.13956) son las excepciones más sólidas. El caso MemPalace es el ejemplo paradigmático de manipulación.
- **Licencias**: Verificar manualmente `mcp-memory-service` (Apache vs MIT inconsistencia README), `Basic Memory` (probable AGPL → fricción para SaaS derivativo), `MARM-Systems` (no explícita en snippets), `Memori` (no explícita), antes de derivar código.
- **Estado del ecosistema**: La capa de "memoria persistente" para LLMs está en transición agresiva. OpenMemory (mem0) sunset, Zep Community Edition deprecada (abril 2025, confirmado verbatim por la documentación de integración de n8n: *"The Zep team deprecated the open source Zep Community Edition in April, 2025"*), Cipher cambió a Elastic License 2.0 y fue renombrado a ByteRover CLI en abril 2026, MemPalace en controversia. Cualquier ranking debe re-validarse cada 2-3 meses.
- **Sistemas descartados explícitamente**:
  - **Supermemory** (supermemoryai/supermemory): el self-host requiere "enterprise agreement" según `supermemory.ai/docs/deployment/self-hosting`; sólo el `supermemory-mcp` repo es de uso libre pero apunta a su API. **Descartado por criterio "cero soluciones de pago / open source self-hostable"**.
  - **Cipher / ByteRover CLI** (campfirein/byterover-cli, ex-Cipher): cambió a **Elastic License 2.0** en 2026 (source-available, no OSI-approved OSS). Buena tecnología (Qdrant/Milvus/in-memory + 4.6k stars + Claude Code plugin nativo `campfirein/brv-claude-plugin` + benchmarks self-reported LoCoMo 96.1% / LongMemEval-S 92.8%), pero **viola criterio "prioridad absoluta open source"**. Mencionable como referencia pero no rankeable.
  - **Mastra** (mastra-ai/mastra): Apache-2.0 pero es framework TS de agentes con memoria como sub-feature, no sistema de memoria. **Fuera de scope**.
  - **LangMem** (langchain-ai/langmem): MIT, pero **acoplado a LangGraph Store** y sin MCP server nativo. Desencaja con la matriz Claude.ai / Claude Code que pide el usuario.
  - **OMEGA Memory** (omega-memory/omega-memory): Apache-2.0 según Smithery, pero el repo principal aparece principalmente en marketplace hosted (Smithery); el GitHub repo accesible es de uso, no del core. Sin benchmarks publicados. **Honorable mention**, no rankeable hasta verificar self-host completo.
  - **Cloudflare Agent Memory**: enterprise-only, sin self-host. **Excluido por criterio explícito del usuario**.
  - **MemoryPlugin**: comercial puro. **Excluido**.
  - **Microsoft Kernel Memory / Semantic Kernel Memory**: Azure-céntrico. **Excluido por criterio explícito**.
- **Riesgo "vendor memory built-in"**: Anthropic ha lanzado la Memory Tool nativa en Claude.ai/Claude Code. Esto es complementario (vendor lock-in) pero el usuario lo descartó correctamente. **Naeth debe interoperar con la memoria nativa, no competir** (ej. import/export y sync bidireccional con el `memory.jsonl` del Anthropic Memory MCP).
- **"Estrellas GitHub"**: Las cifras de stars no son fiables como métrica de calidad post-MemPalace. Priorizar: frecuencia de commits, número de contributors únicos, releases en últimos 90 días, issues respondidos con turnaround < 7 días.