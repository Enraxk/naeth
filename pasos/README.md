# Pasos de Naeth · índice comentado

Histórico de diseño y construcción de Naeth, Pasos 0-10. **Este índice vivía en el `CLAUDE.md`
de la raíz**, que se quedó en 15 KB de changelog y se cargaba entero en cada sesión; se movió aquí
el 2026-07-27. El `CLAUDE.md` es ahora la guía operativa de lo que está vivo.

⚠ **Cuidado al leer esto**: hay material **DEROGADO** que describe cómo funcionaban las cosas antes
del cutover a CENIT (17/07/2026). Está marcado en su entrada. No lo apliques sin comprobar antes
contra el estado real.

---

- `investigacion.md` — Paso 0: ranking Top 15 de sistemas de memoria.
- `paso1-mapeo-interfaces.md` — Paso 1: integrabilidad del Top 5 + 12 preguntas abiertas para el
  Paso 2.
- `paso2-arquitecturas.md` — Paso 2: 3 arquitecturas en papel evaluadas contra las 12 preguntas.
  Decisión: spikear la espina dorsal de B (proxy MCP + Basic Memory hot tier + 1 enrichment async),
  destino híbrido B+C.
- `paso3-spike.md` — Paso 3: plan del spike (reconfigurado a LLM-light: sin Graphiti, enrichment =
  mcp-memory-service; bus SQLite in-process).
- `paso3-resultados.md` — Paso 3: mediciones reales. **Hallazgo clave**: el recall NO es el techo
  (sub-segundo hasta 1M notas, semántico CPU ~135 ms); el único techo real es generar embeddings
  (~100/s CPU), que la Arq B esconde en el bus async.
- `paso4-app-web.md` — Paso 4: diseño en papel de Naeth como app web de gestión autohospedada
  (árbol+CRUD+grafo+login). Recomendación de acceso: Tailscale (sin exposición pública).
- `paso5-sustrato.md` — Paso 5: comparativa Postgres+pgvector vs Basic Memory. **Decisión: Postgres
  + pgvector (HNSW)** como sustrato canónico de Naeth v1. Basic Memory descartado como sustrato.
- `paso6-esquema.md` — Paso 6 (**revisado 2026-06-24** para multi-master): esquema Postgres en papel.
  **ADD-only append puro**: `memory` (fila inmutable), y el reemplazo y el borrado como tablas-evento
  `supersession` (versionado, multi-padre) y `tombstone`; `relation`, `attachment`, `job` (cola
  **local**). `embedding vector(N)` **por-nodo**; `is_current` = caché derivada local. Índices
  HNSW+GIN; búsqueda híbrida RRF. §11 = qué se sincroniza.
- `paso7-local-windows.md` — Paso 7: levantar Naeth en este equipo Windows como banco real. Pila en
  Docker Desktop, servidor MCP (Streamable HTTP) + visor sobre el mismo core, y túnel para que
  claude.ai entre. **Auth: OAuth 2.1 + PKCE nativo vía DCR**, emitiendo el 401 con
  `WWW-Authenticate: Bearer resource_metadata` que claude.ai exige.
  ⚠ **DEROGADO 2026-07-21** lo de "embeddings 384-dim en `finally`": el Paso 8 de CENIT sincroniza
  copiando la columna `embedding vector(N)` ⇒ **la dimensión debe ser idéntica en todos los nodos**
  (1024 / e5-large).
- `paso7-resultados-fase1.md` — Fase 1 (2026-06-25): pila base real (`db`+`api`+`worker`). Núcleo
  Paso 6 aplicado, búsqueda híbrida RRF, worker async, ADD-only validado. **HNSW verificado:
  recall@10 0.96, sub-ms**. Modelo migrado a `intfloat/multilingual-e5-large` (1024-dim) tras
  evaluar recall español (R@1 0.80 vs 0.56 de MiniLM).
- `paso7-resultados-fase2.md` — Fase 2 (2026-06-25): **servidor MCP** (FastMCP, Streamable HTTP)
  montado en el mismo proceso FastAPI. Las 8 herramientas probadas con cliente real.
- `paso7-resultados-fase3a.md` — Fase 3a (2026-06-25): validado el flujo **OAuth 2.1 + PKCE + DCR**
  con FastMCP nativo. La app principal pasa a ser el `http_app` de FastMCP (MCP en `/mcp`, OAuth en
  raíz, visor/CRUD como `custom_route`).
- `paso7-resultados-fase3b.md` — Fase 3b (2026-06-25): `NaethOAuthProvider` persistido en Postgres
  (4 tablas locales) + login de 1 usuario. Tokens opacos validados contra Postgres; refresh con
  rotación.
- `paso7-resultados-fase4.md` — Fase 4 (2026-06-25): **claude.ai conectado end-to-end**; Naeth v1 es
  primera instancia real. Las 8 tools se renombraron de `memory.add` a `memory_add` (**claude.ai
  exige `^[a-zA-Z0-9_-]{1,64}$`**, no admite `.`).
  ⚠ **DEROGADO 2026-07-22**: el túnel propio `naeth-local` y su hostname están RETIRADOS tras el
  cutover a CENIT. La exposición la posee el núcleo (`core/exposure/` de CENIT) y el módulo sale por
  `memory.enraxk.dev`. `naeth/cloudflared/config.yml` se borró del repo.
- `paso7-resultados-fase5.md` — Fase 5 (2026-06-25): autonomía a reinicios (cloudflared como servicio
  de Windows, Docker AutoStart, pila `unless-stopped`).
  ⚠ **DEROGADO 2026-07-22**: ya no hay dos copias del `config.yml` ni túnel propio que sincronizar.
  No apliques esa instrucción.
- `paso8-sync.md` — Paso 8: sincronización multi-master local↔VPS. Transporte = sync a nivel de
  aplicación, NO replicación lógica nativa. Casi gratis por el Paso 6 (UUID + ADD-only ⇒ sync = unión
  de filas). Conflictos de rama: marcar y fundir, nada se pierde.
- `paso9-despliegue-vps.md` — Paso 9: runbook de despliegue en `finally` (endurecimiento
  UFW/fail2ban/SSH, backups, compose Postgres+pgvector).
- `paso10-autoria.md` — Paso 10 (**EJECUTADO 2026-07-20, cerrado el 21/07**): autoría explícita de
  cada nota. Sustituye `source_client` por `memory.author jsonb` con ejes separados: `product` (de
  `clientInfo` MCP), `surface` (de `?s=` del endpoint), `zone`, `actor` y `vendor`/`model`
  **declarados** por el agente. Enforcement `AUTHORSHIP_ENFORCE=strict` activo.
  Dos avisos del doc: el `clientInfo` de claude.ai es `Anthropic/ClaudeAI` (no `claude-ai`; rompió el
  mapeo), y **Claude Desktop ≠ Claude Code** (ecosistemas distintos, §11).

---

## Convención de los renders HTML

Los pasos antiguos tienen un render `PasoN.html` gemelo (Design DNA "Terminal × Notion"). **Desde el
Paso 10 se dejó de hacer**: la decisión fue solo `.md`. Si editas un paso que ya tiene gemelo,
mantén ambos; si creas uno nuevo, no hace falta.
