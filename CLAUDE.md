# Naeth

Proyecto de **investigación y diseño** (no de código) para un sistema de memoria
persistente personal, portable y local-first para LLMs/agentes, que funcione en
claude.ai (Remote MCP) y Claude Code sin atarse a un vendor.

## Dónde vive el contexto
- `docs/discovery/naeth.md` — qué es, arco del proyecto, convenciones, quirks.
  **Léelo antes de re-escanear.**
- `pasos/investigacion.md` — Paso 0: ranking Top 15 de sistemas de memoria.
- `pasos/paso1-mapeo-interfaces.md` — Paso 1: integrabilidad del Top 5 + 12 preguntas
  abiertas para el Paso 2.
- `pasos/paso2-arquitecturas.md` — Paso 2: 3 arquitecturas en papel evaluadas contra las
  12 preguntas. Decisión: spikear la espina dorsal de B (proxy MCP + Basic Memory
  hot tier + 1 enrichment async), destino híbrido B+C.
- `pasos/paso3-spike.md` — Paso 3: plan del spike (reconfigurado a LLM-light: sin Graphiti,
  enrichment = mcp-memory-service; bus SQLite in-process).
- `pasos/paso3-resultados.md` — Paso 3: mediciones reales. **Hallazgo clave**: el recall NO
  es el techo (sub-segundo hasta 1M notas, semántico CPU ~135 ms); el único techo real
  es generar embeddings (~100/s CPU), que la Arq B esconde en el bus async.
- `pasos/paso4-app-web.md` — Paso 4: diseño en papel de Naeth como app web de gestión
  autohospedada (árbol+CRUD+grafo+login). Recomendación de acceso: Tailscale (sin
  exposición pública). Pendiente: respuestas a §10 antes de construir (Paso 5).
- `pasos/paso5-sustrato.md` — Paso 5: comparativa Postgres+pgvector vs Basic Memory.
  **Decisión: Postgres + pgvector (HNSW)** como sustrato canónico de Naeth v1
  (reconcilia con el diseño de claude.ai; gana en escala del grafo). Pendiente:
  verificar HNSW con spike corto. Basic Memory queda descartado como sustrato.
- `pasos/paso6-esquema.md` — Paso 6 (**revisado 2026-06-24** para multi-master): esquema
  Postgres en papel. **ADD-only append puro**: `memory` (fila inmutable), y el reemplazo
  y el borrado como **tablas-evento** `supersession` (versionado, multi-padre para fundir
  ramas) y `tombstone` (borrados, unificada memory+relation); `relation`, `attachment`,
  `job` (cola **local**). `embedding vector(N)` **por-nodo** (no se sincroniza);
  `is_current` = caché derivada local (no se sincroniza). Índices HNSW+GIN; búsqueda
  híbrida RRF; MCP sobre el mismo núcleo. §11 = qué se sincroniza (todo por unión de filas).
- `pasos/paso7-local-windows.md` — Paso 7 (**fase actual**, diseño a fondo hecho): levantar
  Naeth en este equipo Windows como banco real. Pila en Docker Desktop (Postgres+pgvector
  + FastAPI + worker), **servidor MCP** (Streamable HTTP) + visor web sobre el mismo
  core, y túnel `enraxk` a este equipo para que **claude.ai** entre. **Auth: OAuth 2.1 +
  PKCE nativo en Naeth vía DCR**, emitiendo el 401 con `WWW-Authenticate: Bearer
  resource_metadata` que claude.ai exige (no Cloudflare Access delante del MCP; eso rompe
  claude.ai web, bug anthropics/claude-ai-mcp #410, cerrado not-planned). Claude Code
  habla por `localhost` con bearer en header; el visor se queda en `localhost`.
  **Embeddings por-nodo** (no se sincronizan): bge-m3 1024-dim en local, e5-small 384-dim
  en `finally`; dimensión `vector(N)` parametrizada. Replanteo 2026-06-23, ⚠ resueltos
  2026-06-24. **Fase 1 EJECUTADA 2026-06-25** (ver abajo): código en `naeth/`.
- `pasos/paso7-resultados-fase1.md` — Paso 7 **Fase 1 (ejecutada 2026-06-25)**: pila base
  real (`db`+`api`+`worker`) en Docker Desktop. Núcleo Paso 6 aplicado (6 tablas + vista +
  índices), búsqueda híbrida RRF, worker async (lag 0.6 s), ADD-only validado. **HNSW
  verificado con embeddings reales: recall@10 0.96, sub-ms** (cierra el caveat del Paso 6
  §8). Ajuste: fastembed 0.5.1 no trae e5-small ⇒ se usa
  `paraphrase-multilingual-MiniLM-L12-v2` (384-dim, reversible por env var). Pendiente:
  Fases 2-4 (MCP, OAuth, túnel) y mover `pgdata` a F:. **Modelo migrado 2026-06-25 a
  `intfloat/multilingual-e5-large` (1024-dim, `EMBED_PREFIX=e5`)** tras evaluar recall
  español (`bench/recall_es.py`: R@1 0.80 vs 0.56 de MiniLM, R@5 1.00; e5-large es el mejor
  multilingüe en fastembed, bge-m3 no está). Migración: `ALTER` columna a `vector(1024)` +
  drop/recreate vista `memory_current` e índice HNSW + re-embeber; `fastembed_cache` ahora
  compartido api+worker.
- `pasos/paso7-resultados-fase2.md` — Paso 7 **Fase 2 (ejecutada 2026-06-25)**: **servidor
  MCP** (FastMCP, Streamable HTTP) montado en el mismo proceso FastAPI sobre el core. Las 8
  herramientas del §4 (`memory.add/search/get/supersede/tombstone`, `relation.add/list`,
  `system.status`) probadas con cliente real. Bearer opcional (vacío = sin auth en
  loopback). **Claude Code conecta por localhost** (`naeth-local`, registrado scope local;
  tools invocables tras reiniciar sesión). Pendiente: Fase 3 (OAuth 2.1) y Fase 4 (túnel +
  claude.ai).
- `pasos/paso7-resultados-fase3a.md` — Paso 7 **Fase 3a (ejecutada 2026-06-25)**: validado
  el **flujo OAuth 2.1 + PKCE + DCR** con **FastMCP nativo** (decisión: NO Authlib a mano;
  FastMCP da gratis discovery RFC 8414/9728, PKCE S256 y el **401 con `WWW-Authenticate:
  resource_metadata`** que claude.ai exige). **Reestructura**: la app principal pasa a ser
  el `http_app` de FastMCP (MCP en `/mcp`, OAuth en raíz, visor/CRUD como `custom_route`) —
  antes el discovery habría caído bajo `/mcp/.well-known`. Flujo completo OK con cliente
  real (DCR→authorize+PKCE→token→refresh; verifier erróneo→400). OAuth **conmutable** por
  `OAUTH_ENABLED`/`OAUTH_BASE_URL`, **off por defecto** (Claude Code sigue por localhost).
  Usa `InMemoryOAuthProvider` (tokens efímeros, sin login). Pendiente **Fase 3b**:
  persistencia Postgres + login de 1 usuario; luego Fase 4 (túnel + claude.ai).
- `pasos/paso7-resultados-fase3b.md` — Paso 7 **Fase 3b (ejecutada 2026-06-25): Fase 3
  COMPLETA**. `NaethOAuthProvider(OAuthProvider)` persistido en **Postgres** (4 tablas
  locales `oauth_client/pending/code/token`, no se sincronizan) + **login de 1 usuario**
  (`authorize` ya no auto-aprueba: redirige a `/login`, valida `NAETH_AUTH_USER/PASSWORD`,
  y solo entonces emite el code). Tokens opacos `nae_at_`/`nae_rt_` validados contra
  Postgres; refresh con rotación (par viejo revocado). Validado con cliente real: login
  inválido→401, válido→code, token, refresh, refresh viejo→400; persistencia confirmada.
  `OAUTH_PROVIDER=postgres|memory`, sigue **off por defecto**. Pendiente: **Fase 4** (túnel
  `enraxk` + `OAUTH_BASE_URL` público + connector en claude.ai end-to-end).
- `pasos/paso7-resultados-fase4.md` — Paso 7 **Fase 4 (ejecutada 2026-06-25): PASO 7
  COMPLETO**. cloudflared en este equipo + **túnel propio `naeth-local`** (id `7d283520-…`,
  **separado del `enraxk` existente**) → `naeth-local.enraxk.dev` → `127.0.0.1:8800`; config
  en `naeth/cloudflared/config.yml`. OAuth en público (`OAUTH_BASE_URL=https://naeth-local.enraxk.dev`).
  **claude.ai conectado end-to-end**: cliente "Claude" registrado por DCR, login de 1
  usuario superado, tokens persistidos en Postgres, las 8 tools visibles. La pila (F1) +
  MCP (F2) + OAuth (F3) + claude.ai (F4) funcionan de punta a punta: **Naeth v1 es primera
  instancia real**. Pendiente operativo: **Fase 5** (endurecimiento: cloudflared+Docker como
  servicios para sobrevivir reinicios; mover `pgdata` a F:); luego Paso 8 (sync) y Paso 9.
  **Ajustes post-test 2026-06-25** (tras conectar y testear claude.ai): (1) las 8 tools se
  renombraron de `memory.add`→`memory_add` etc. (**claude.ai exige `^[a-zA-Z0-9_-]{1,64}$`**,
  no admite `.`); (2) `source_client` ahora **deriva del cliente OAuth** de la petición
  (`mcp:Claude` para claude.ai), no hardcodeado: helper `_source_client()` en `mcp_server.py`
  usa `mcp.server.auth.middleware.auth_context.get_access_token` (NO el de FastMCP, que
  rechaza por tipo el `AccessToken` del SDK al usar AS propio) y mapea `client_id`→`client_name`;
  por eso las **4 tools de escritura son `async def`** (el contextvar de auth no se propaga al
  threadpool de las tools sync).
- `pasos/paso7-resultados-fase5.md` — Paso 7 **Fase 5 (ejecutada 2026-06-25): PASO 7 CERRADO
  (también operativo)**. **Autonomía a reinicios**: cloudflared como **servicio de Windows**
  (`Cloudflared`, Automatic, arranca al boot) con `ImagePath` reparado a `tunnel --config
  <local> run naeth-local` (config local versionado, NO dashboard; el `service install` por
  defecto deja el binPath sin args y no enruta). Docker Desktop `AutoStart=true` + entrada
  Run; pila `unless-stopped`. Verificado: servicio Running + túnel sirve el HTTPS público.
  **Dos copias del `config.yml`**: repo (`naeth/cloudflared/`) y `~/.cloudflared/` (la del
  servicio); sincronizar ambas + `Restart-Service Cloudflared` si cambia el ingress.
  Pendiente menor: verificación real de reinicio y mover `pgdata` a F:. Sigue: Paso 8
  (sync) y Paso 9 (`finally`).
- `pasos/paso8-sync.md` — Paso 8 (diseño a fondo hecho): **sincronización multi-master**
  local↔VPS. **Transporte = sync a nivel de aplicación** (pull por cursor), NO replicación
  lógica nativa de Postgres (la dimensión del vector difiere por nodo y los embeddings no
  se sincronizan ⇒ inviable; además PG no resuelve conflictos). Casi gratis por el Paso 6
  (UUID + ADD-only ⇒ sync = unión de filas). **Sincroniza** memory/relation/attachment +
  **binarios** (content-addressed por sha256); **no** job ni embeddings. **Conflictos de
  rama**: marcar en conflicto y fundir (nada se pierde). Implicaciones al Paso 6:
  `valid_to` derivable, tombstone append, `supersedes` múltiple. Motivo: apagones. Medio
  plazo (tras el Paso 7).
- `pasos/paso9-despliegue-vps.md` — Paso 9 (**el último**, antes `paso7-despliegue.md`):
  runbook de despliegue en `finally` (endurecimiento UFW/fail2ban/SSH, LUKS para
  pgdata+assets, backups restic, compose Postgres+pgvector, hostname en el túnel
  `enraxk` + Cloudflare Access). Tras este paso el VPS es **un nodo más**, no la única
  instancia. Ejecutar por fases, con OK.
- `pasos/paso10-autoria.md` — Paso 10 (**EJECUTADO 2026-07-20**): autoría explícita de cada
  nota. Sustituye el `source_client` de texto libre por `memory.author jsonb` con ejes
  separados: `product` (de `clientInfo` MCP, verificable), `surface` (de `?s=` del endpoint,
  verificable), `zone` (loopback/público), `actor` (humano/agente) y `vendor`/`model`
  **declarados** por el agente (MCP no los transmite). **Contexto clave**: Naeth ya es módulo
  de CENIT (cutover 17/07) con `OIDCProxy`, así que **todos los clientes comparten el mismo
  `client_id`** (el del módulo) → la identidad NO sale del `client_id` sino de `clientInfo` +
  endpoint por superficie. Arregla el bug del `source_client` recortado (`mcp:8e732828-a34`)
  que consultaba la tabla `oauth_client` muerta tras el cutover. Migraciones `003-authorship`
  (esquema + recrea vista `memory_current`) y `004-authorship-backfill` (321 notas del
  histórico resueltas por `path`+`source_client`; modelo `unknown_legacy`, irrecuperable).
  Enforcement `AUTHORSHIP_ENFORCE=strict` (en `naeth/.env`, **activo desde 21/07**). Suite
  12/12. Diagrama: `E:\Documentos\Eneko\Proyectos\Diagramas\naeth-autoria.png`. **CERRADO
  21/07**: conectores `?s=code` (Claude Code, `~/.claude.json`) y `?s=web` (claude.ai + app
  Claude Desktop, comparten conector); verificado end-to-end que el `?s=` atraviesa
  Cloudflare+Caddy y que **ambos clientes declaran el modelo solos**. Ojo con dos cosas: el
  `clientInfo` de claude.ai es `Anthropic/ClaudeAI` (no `claude-ai`; rompió el mapeo, ya
  arreglado y con test), y **Claude Desktop ≠ Claude Code** (ecosistemas distintos, §11 del
  doc). Sin HTML gemelo (decisión: solo `.md`).
- `naeth/` — **código de Naeth v1** (Fase 1 del Paso 7, en marcha desde 2026-06-25).
  `docker-compose.yml` (`db` pgvector + `api` FastAPI + `worker`), `db/schema.sql` (núcleo
  Paso 6, `vector(N)` parametrizado vía `__EMBED_DIM__` en `db/init/`), `app/` (`core.py`
  acceso ADD-only, `api.py` visor+CRUD, `worker.py` embeddings, `embeddings.py`,
  `viewer/index.html`), `bench/hnsw_check.py` (verificación HNSW), `app/tests/` (**1ª suite,
  27/06/2026**: pytest contra BD efímera `naeth_test`, `docker compose --profile test run --rm
  test`). Modelo por env var (`.env`); visor en `127.0.0.1:8800`, Postgres en
  `127.0.0.1:5433`. **No** es desechable. **Fix del grafo (27/06)**:
  `relation_list` sigue la cadena de `supersession` (normaliza extremos a la versión vigente y
  deduplica en lectura) y se añadió la tool `relation_tombstone`; sin migración ni cambio de
  esquema (ver la memoria de Naeth homónima).
- **Todos los pasos (0-9) viven en `pasos/`** (reorganizado 2026-06-24; antes estaban en
  la raíz). Cada `pasoN.md` tiene su render `PasoN.html` gemelo (Design DNA
  "Terminal × Notion"), **todos generados**. Raíz = `CLAUDE.md`, `docs/`, `pasos/`,
  `naeth/`.

## Infra
- Banco de pruebas y **primera instancia real**: este equipo Windows con **Docker
  Desktop** + cloudflared (antes era "Windows sin Docker"). Aquí corre Naeth v1
  completa (Postgres+pgvector + API + worker + MCP) antes de migrar.
- Deploy final: home server LAN `finally` (Ubuntu, GTX 1660 4 GB, Ryzen 5 5500, 64 GB
  RAM), no un VPS público; acceso por túnel `enraxk` + Cloudflare Access. Naeth es
  **LLM-light sin LLM** por la restricción de 4 GB de VRAM.
- Modelo de despliegue v1: **multi-master**, local Windows y `finally` como nodos que
  reconcilian. Motivado por **apagones ocasionales** (no constantes) que tumban el server;
  solo se actúa desde casa (ambos nodos fijos).
- **Discos del equipo local** (decidido 2026-06-24): C: SSD NVMe (sistema, 448 GB libres),
  E: HDD 1.8 TB (~1.38 TB libres), F: SSD SATA (573 GB libres). **Almacenamiento de Naeth:
  `pgdata` en F:** (mover la *disk image* de Docker Desktop a F: en Settings → Resources)
  y **binarios de adjuntos en E:** (`E:\naeth\assets`, bind-mount; NTFS vale para blobs).
  C: (sistema) se deja libre.

## Reglas de trabajo
- Prefiere respetar la disciplina de fases: cada paso declara lo que NO hace
  (no re-rankear, no recomendar arquitectura, no escribir código antes de tiempo).
- Prefiere citar evidencia (archivo, issue, sección de paper) en claims no
  triviales, y marcar `⚠ sin verificar` lo no confirmado.
- Cada documento `.md` tiene un render HTML gemelo; mantén ambos si editas.
