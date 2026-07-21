# Discovery · Naeth

> Escaneado el 2026-05-29. Actualizado el 2026-06-23. Actualizar solo lo que
> cambie, no reescribir entero.

## Qué es
Naeth **no es un repo de código**: es un **proyecto de investigación y diseño**
documental. Objetivo: diseñar (y eventualmente construir) un sistema de **memoria
persistente personal y portable** para LLMs/agentes que funcione a la vez en
`claude.ai` (Remote MCP via HTTPS) y en Claude Code, local-first, sin atarse a un
vendor. La tesis de fondo es que existe un hueco real: "memoria personal portable
para chat clients" que ningún OSS cubre bien hoy.

La carpeta es un directorio suelto (sin `.git`, sin manifiesto, sin stack). Su
contenido son documentos de investigación en Markdown y sus renders HTML.

## Stack
- No aplica (no hay código). Los entregables son **Markdown** + **HTML estático**.
- Los HTML comparten un "Design DNA: Terminal × Notion": paleta `oklch`, fuentes
  Inter + JetBrains Mono, tema claro. Son renders presentables de los `.md`.

## Comandos
- No hay build/test/lint. Los HTML se abren directamente en navegador.

## Estructura (reorganizada 2026-06-24)

Raíz mínima: `CLAUDE.md`, `docs/`, `pasos/`, `spike/`. **Todos los pasos (0-9) viven en
`pasos/`**, cada `pasoN.md` junto a su render `PasoN.html`:

- `pasos/investigacion.md` (+ `Investigacion15.html`) — Paso 0: ranking Top 15.
- `pasos/paso1-mapeo-interfaces.md` — Paso 1: integrabilidad del Top 5 + 12 preguntas.
- `pasos/paso2-arquitecturas.md`   — Paso 2: 3 arquitecturas en papel; decisión spike B.
- `pasos/paso3-spike.md` + `paso3-resultados.md` — Paso 3: plan y mediciones del spike.
- `pasos/paso4-app-web.md`         — Paso 4: diseño en papel de la app web autohospedada.
- `pasos/paso5-sustrato.md`        — Paso 5: comparativa; decisión Postgres + pgvector.
- `pasos/paso6-esquema.md`         — Paso 6: esquema Postgres (revisado para multi-master).
- `pasos/paso7-local-windows.md`   — Paso 7 (fase actual): Naeth en local Windows + MCP.
- `pasos/paso8-sync.md`            — Paso 8: sync multi-master local↔VPS.
- `pasos/paso9-despliegue-vps.md`  — Paso 9 (el último): runbook de despliegue en `finally`.
- `pasos/PasoN.html`               — render HTML gemelo de cada paso (todos generados).
- `spike/`                         — código del spike (desechable) + `viewer/` + artefactos
  (`resultados.json`, `spike_bus.sqlite`).
- `docs/discovery/`                — este discovery.

## El arco del proyecto (estado a 2026-06-23)

> **Replanteo del 2026-06-23 — V1 local-first.** Naeth corre **primero en este equipo
> Windows** (banco real, no solo dev) y luego se migra a `finally`. Esto parte el viejo
> Paso 7 (deploy VPS) en tres y reordena: el deploy VPS pasa a ser **el último**. El
> orden de ejecución ya **no** coincide con el de redacción (los ítems 1-8 abajo son el
> orden cronológico de los pasos; el nº de "Paso" va dentro de cada uno). Decisiones:
> multi-master (escribir offline y reconciliar, por los apagones), Postgres+pgvector
> vía **Docker Desktop**, el **MCP es parte de la fase local**, y **claude.ai entra ya
> en local** vía el túnel `enraxk` apuntando a este equipo (con Cloudflare Access).

1. **Paso 0 — Investigación** (`investigacion.md`, hecho): ranking riguroso de 15
   sistemas de memoria persistente OSS para LLMs. Ganador como base para Naeth:
   **`doobidoo/mcp-memory-service`** (único con soporte explícito de claude.ai
   Remote MCP + local-first real + features amplias). Mejor cifra académica
   reproducible: **Hindsight (Vectorize)**. Aviso transversal: casi todos los
   benchmarks LongMemEval >85% están mal-reportados o inflados → tratar como
   "claim del proyecto" hasta replicación.
2. **Paso 1 — Mapeo de interfaces** (`paso1-mapeo-interfaces.md`, hecho): análisis
   documental puro (cero install) de los 5 sistemas top como "ciudadanos" en una
   arquitectura compuesta. Top 5: mcp-memory-service, Hindsight, Cognee,
   Basic Memory, Graphiti. Salida: **12 preguntas abiertas** que alimentan el
   Paso 2.
3. **Paso 2 — Arquitecturas en papel** (`paso2-arquitecturas.md`, hecho): 3
   arquitecturas candidatas (A federación lateral / B pipeline en cascada / C spec
   con adaptadores), evaluadas contra las 12 preguntas. **Decisión**: spike de la
   espina dorsal de B (Naeth proxy MCP + Basic Memory como hot tier soberano + 1
   enrichment async), con destino probable un híbrido B+C. No spikear los 5.
4. **Paso 3 — Spike** (`paso3-spike.md` + `paso3-resultados.md`, hecho): valida la
   Arquitectura B **reconfigurada a LLM-light puro**. Por el hardware del VPS (GTX
   1660 4 GB) se descarta inferencia LLM local → **se cae Graphiti**; el enrichment
   async pasa a ser **mcp-memory-service** (LLM-light: hybrid search, dedup, parser
   NL temporal, embeddings locales). Composición = **B cascada**: Basic Memory
   (hot/soberano) + MM-S (enrichment async) + bus SQLite. **Hallazgo clave**: el
   recall NO es el techo (sub-segundo hasta 1M notas, semántico CPU ~135 ms); el
   único techo real es **generar embeddings** (~100/s en CPU), que la Arq B esconde
   en el bus async. El código del spike vive en `spike/`.
5. **Paso 4 — App web** (`paso4-app-web.md`, hecho): diseño en papel de Naeth como
   app web de gestión autohospedada (árbol + CRUD + grafo + login). Recomendación de
   acceso: **Tailscale** (sin exposición pública) — luego en deploy se usa el túnel
   `enraxk` + Cloudflare Access. El visor de composición de `spike/viewer/` es la v0
   de esta web.
6. **Paso 5 — Sustrato** (`paso5-sustrato.md`, hecho): comparativa Postgres+pgvector
   vs Basic Memory como sustrato canónico. **Decisión: Postgres + pgvector (HNSW)**
   para Naeth v1 (reconcilia con el diseño de claude.ai, gana en escala del grafo).
   **Basic Memory queda descartado como sustrato.** Pendiente menor: verificar HNSW
   con un spike corto.
7. **Paso 6 — Esquema** (`paso6-esquema.md`, hecho; **revisado 2026-06-24 para
   multi-master**): esquema Postgres en papel. **ADD-only append puro**: `memory` es fila
   inmutable, y el reemplazo y el borrado salen a **tablas-evento** `supersession`
   (versionado, multi-padre para fundir ramas) y `tombstone` (borrados, unificada
   memory+relation). `relation`, `attachment`, `job` (cola **local**). `embedding
   vector(N)` por-nodo e `is_current` (caché de vigencia) **no se sincronizan**; lo demás
   se sincroniza por unión de filas. Índices HNSW+GIN; búsqueda híbrida RRF; MCP sobre el
   mismo núcleo.
8. **Paso 7 — Naeth local (Windows)** (`paso7-local-windows.md`, **fase actual, diseño
   a fondo hecho; por ejecutar**): levantar la pila v1 en este equipo — Postgres+pgvector
   + API FastAPI + worker en **Docker Desktop**, más **servidor MCP** (Streamable HTTP) y
   **visor web** como fachadas sobre el mismo core. El visor se queda en `localhost`; el
   **MCP se expone por el túnel `enraxk`** a este equipo para que **claude.ai** lo
   consuma. **Auth = OAuth 2.1 + PKCE nativo en Naeth** (decisión 2026-06-23): NO
   Cloudflare Access delante del MCP, porque Access Managed OAuth rompe el connector web
   de claude.ai (le falta el header `WWW-Authenticate: Bearer resource_metadata`, bug
   anthropics/claude-ai-mcp #410); Claude Code tolera su ausencia y habla por `localhost`
   sin túnel (bearer en header). Hostname: `naeth-local.enraxk.dev`. **Registro OAuth vía
   DCR**; **embeddings por-nodo** (no se sincronizan): bge-m3 1024-dim en local para
   evaluar español, e5-small 384-dim en `finally`, con `vector(N)` parametrizado. Todos
   los `⚠` del paso quedaron resueltos el 2026-06-24; lista 5 fases de ejecución.
9. **Paso 8 — Sync multi-master** (`paso8-sync.md`, **diseño a fondo hecho 2026-06-24**;
   medio plazo): reconciliación local↔VPS, cada nodo con su Postgres completo y escritura
   offline. **Transporte = sync a nivel de aplicación** (pull por cursor), NO replicación
   lógica nativa de Postgres (la dimensión del vector difiere por nodo + embeddings no se
   sincronizan ⇒ inviable; y PG no resuelve conflictos). Casi gratis por el Paso 6: `id
   uuid` + ADD-only ⇒ sincronizar = **unir filas nuevas**. **Sincroniza**
   memory/relation/attachment + **binarios** (content-addressed sha256); **no** `job` ni
   embeddings (cada nodo los regenera). **Conflictos de rama**: marcar en conflicto y
   fundir (nada se pierde). Orden por `created_at`+`id` (sin HLC). **Implicaciones al Paso
   6**: `valid_to` derivable, tombstone append, `supersedes` múltiple. 5 fases de ejecución.
10. **Paso 9 — Despliegue VPS** (`paso9-despliegue-vps.md`, **el último**, antes
   `paso7-despliegue.md`): runbook para poner Naeth en `finally`. Endurecimiento base
   (UFW/fail2ban/SSH), LUKS para pgdata+assets, backups restic, compose
   Postgres+pgvector, hostname en el túnel + Access. Tras este paso `finally` deja de
   ser la única instancia: es **un nodo más** que reconcilia con el local. Sigue sin
   ejecutar.

## Contexto de infraestructura
- **Banco de pruebas y primera instancia real**: Windows (este equipo). Desde el
  replanteo del 2026-06-23 se adopta **Docker Desktop** (para Postgres+pgvector) +
  cloudflared; antes era "Windows sin Docker". El spike viejo usaba Python 3.11 + uv
  (uv instala 3.12 que Basic Memory exigía); ya no es el camino tras descartar Basic
  Memory como sustrato.
- **Discos del equipo local** (decidido 2026-06-24): `C:` SSD NVMe (sistema, 448 GB
  libres), `E:` HDD 1.8 TB (~1.38 TB libres), `F:` SSD SATA (573 GB libres).
  Almacenamiento de Naeth: **`pgdata` en `F:`** (se mueve la *disk image* de Docker
  Desktop a F: en Settings → Resources; el volumen sigue siendo gestionado/ext4, no
  bind-mount NTFS) y **binarios de adjuntos en `E:`** (`E:\naeth\assets`, bind-mount;
  NTFS vale para servir blobs). `C:` (sistema) se deja libre.
- **Apagones ocasionales** (no constantes), entre dos nodos fijos sobre los que solo se
  actúa desde casa → consistencia eventual, sin tiempo real (motivo del sync, Paso 8).
- **Deploy real**: home server LAN llamado `finally` (Ubuntu) — GTX 1660 4 GB, Ryzen
  5 5500, 64 GB RAM. No es un VPS público: se accede por el túnel Cloudflare `enraxk`
  + Access, sin puertos abiertos. La 4 GB de VRAM es la razón de que Naeth sea
  **LLM-light sin dependencia de LLM**.

## Convenciones detectadas
- Idioma: español. Documentos largos y rigurosos, con TL;DR + tabla maestra +
  fichas por sistema + preguntas abiertas al final.
- **Disciplina de fases estricta**: cada paso declara reglas autoimpuestas y lo
  que NO hace (no re-rankear en Paso 1, no recomendar arquitectura, no escribir
  código). Respetar esa separación al continuar.
- Citar evidencia (archivo, issue, sección de paper) en claims no triviales.
- Marcar `⚠ sin verificar` cuando algo no se confirma desde docs/código.
- Cada `.md` tiene un `.html` render gemelo con el mismo contenido.

## Deploy
- No hay. Documentos locales.

## Quirks y deuda conocida
- Naming HTML ya estabilizado a `PasoN.html` (capitalizado) para los pasos, frente a
  `pasoN-*.md` en kebab-case; `Investigacion15.html` es el único legado fuera de patrón.
- Los HTML guardan acentos como mojibake en algunos visores por encoding; el
  `charset=utf-8` está declarado, revisar si se edita el HTML a mano.
- Hubo ficheros ajenos al proyecto en la raíz (HTML de Path of Exile 2); el
  usuario los borró el 2026-05-29. La raíz debe contener solo material de Naeth.

## Preguntas abiertas
Las 12 preguntas del Paso 1 (`paso1-mapeo-interfaces.md` §5) fueron absorbidas por
los Pasos 2-6 (arquitectura, sustrato y esquema ya deciden latencia compuesta,
embedding canónico, single source of truth, storage propio vs router, etc.).
Las del onboarding original también se resolvieron de facto: el trabajo avanzó
fase a fase. **Pasos 7 y 8 con diseño a fondo cerrado y renders HTML generados
(2026-06-24)**; toda la cadena 0-9 está en papel. Quedan vivas:
- La carpeta **se queda sin git** (decisión del usuario, 2026-06-23).
- **Construir es el siguiente trabajo real** (ya no hay más diseño en papel pendiente):
  ejecutar el **Paso 7** (Naeth local Windows, 5 fases, empezando por la pila base en
  Docker), luego el **Paso 8** (sync) y el **Paso 9** (deploy en `finally`).
- Las **implicaciones del Paso 8 ya están aplicadas al Paso 6** (rev. 2026-06-24):
  `valid_to`/`deleted_at`/`supersedes` salieron de la fila a tablas-evento
  (`supersession` multi-padre, `tombstone`); `is_current` es caché local. El esquema nace
  listo para el sync. (Confirmar el DDL exacto al construir.)
- Decisiones técnicas a confirmar en ejecución (no incógnitas de diseño): verificar HNSW
  (fase 1 del Paso 7) y la calidad real de bge-m3 en español (fase 2).
