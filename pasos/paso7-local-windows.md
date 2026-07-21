# Paso 7 · Naeth local en Windows (banco real + MCP para claude.ai y Claude Code)

**Proyecto Naeth** — diseño a fondo para levantar Naeth v1 **en este equipo Windows**
como primera instancia real (no solo entorno de desarrollo), con su **servidor MCP**
accesible tanto desde Claude Code (local) como desde claude.ai (por túnel), antes de
migrar a `finally` ([Paso 9](paso9-despliegue-vps.md)).

**Fecha**: 2026-06-23 (replanteo V1 local-first) · **incógnitas resueltas 2026-06-24**
**Estado**: diseño en papel, **sin `⚠` pendientes**. **No** escribo código aquí; este
documento es el plan que luego se ejecuta por fases y con OK, como los demás pasos.

> **Reglas de este doc**: plan, no código. Citar evidencia en claims no triviales.
> Nunca imprimir secretos.

---

## TL;DR

- Naeth corre **primero en este equipo Windows** sobre **Docker Desktop**
  (Postgres + pgvector), con la API FastAPI, el worker de embeddings, el **servidor
  MCP** y el **visor web**, todos sobre el **mismo core** del [Paso 6](paso6-esquema.md).
- **Claude Code (este equipo) ↔ MCP**: directo por `localhost`, con **bearer token en
  header** (o sin auth en loopback); sin túnel ni OAuth.
- **claude.ai ↔ MCP**: por el túnel `enraxk` a este equipo. claude.ai exige **OAuth 2.1
  + PKCE** y **no admite bearer estático**; lo implementa **Naeth** vía **Dynamic Client
  Registration (DCR)**, emitiendo el 401 con el header `WWW-Authenticate` que claude.ai
  requiere. El visor web se queda en `localhost`.
- **Embeddings por-nodo**: este equipo arranca con **bge-m3 (1024-dim)** para evaluar
  calidad en español; `finally` queda preparado con **multilingual-e5-small (384-dim)**.
  Cada nodo es internamente consistente; los embeddings no se sincronizan.
- El local nace ya como **nodo multi-master**: Postgres propio completo, listo para
  reconciliar con `finally` ([Paso 8](paso8-sync.md)).

---

## 0. Por qué local primero

El deploy directo a `finally` (viejo Paso 7, hoy [Paso 9](paso9-despliegue-vps.md))
tiene un problema operativo real: **los apagones tumban el server** y hay que esperar a
que vuelva. La V1 se replantea **local-first**: Naeth corre primero en este equipo,
donde se prueba y testea hasta que funcione como se quiere, y solo entonces se migra. El
destino es **multi-master** (este equipo + `finally` como nodos que reconcilian, ver
[Paso 8](paso8-sync.md)).

## 1. Decisiones tomadas (todas cerradas)

| Tema | Decisión |
|---|---|
| Sustrato | Postgres + pgvector (HNSW), del [Paso 5](paso5-sustrato.md) |
| Postgres en Windows | **Docker Desktop**, imagen `pgvector/pgvector` (paridad con `finally`) |
| Interfaz primaria | **Servidor MCP** (Streamable HTTP), fachada sobre el core ([Paso 6](paso6-esquema.md)) |
| Auth claude.ai | **OAuth 2.1 + PKCE nativo en Naeth**, registro vía **DCR** |
| Auth Claude Code | **Bearer token en header** por `localhost` (o sin auth en loopback) |
| Empaquetado | **Un proceso FastAPI** (MCP + OAuth + visor) + **worker** aparte |
| Embeddings | **Por-nodo**: bge-m3 (1024) en local, e5-small (384) en `finally`; configurable |
| claude.ai en local | **Sí**: túnel `enraxk` → `naeth-local.enraxk.dev` → este equipo |
| Modelo de despliegue | **Multi-master**: el local es un nodo con Postgres propio |

## 2. Arquitectura de capas

```text
                Núcleo Naeth   (lógica de memoria sobre Postgres + pgvector)
                     │
       ┌─────────────┼──────────────┐
   Servidor MCP   OAuth 2.1      API + visor web        ← fachadas sobre el mismo core
 (Streamable HTTP) (PKCE, DCR,    (FastAPI)
  claude.ai +       discovery,    gestión/CRUD/grafo
  Claude Code)      tokens)       (solo localhost)
                     │
              worker de embeddings (async, CPU)
```

El **núcleo** es el del [Paso 6](paso6-esquema.md): tablas `memory` (ADD-only con
supersedes/tombstone), `relation`, `attachment`, `job`; búsqueda híbrida RRF
(HNSW + GIN). El MCP, el OAuth y la API/visor son **fachadas** que no duplican lógica:
todas leen/escriben el mismo Postgres por el mismo módulo de acceso. **Un solo proceso
FastAPI** sirve las tres fachadas en v1 (separar en procesos queda como optimización
futura si la concurrencia lo pide); el **worker** corre aparte consumiendo la cola `job`.

## 3. Topología de red local

```text
   Claude Code (este equipo) ──localhost──▶ 127.0.0.1:PUERTO_MCP   (bearer en header)

   navegador (este equipo) ────localhost──▶ 127.0.0.1:PUERTO_WEB   (visor; sin túnel)

   claude.ai (nube) ──HTTPS──▶ Cloudflare edge ──túnel enraxk──▶ 127.0.0.1:PUERTO_MCP
                                                                    (OAuth 2.1 lo hace Naeth)
```

- **Claude Code ↔ MCP**: directo por `localhost`. Claude Code admite
  `claude mcp add --transport http --header "Authorization: Bearer <token>" <url>`, o
  conectar sin auth cuando el servidor escucha solo en loopback. En v1 usaremos
  **bearer token en header** (un secreto local en `.env`), que es lo más simple y no
  requiere el flujo OAuth. Evidencia: [Claude Code MCP docs](https://code.claude.com/docs/en/mcp).
- **claude.ai ↔ MCP**: claude.ai es cloud y **no alcanza `localhost`** → necesita
  endpoint **HTTPS público** → túnel `enraxk` a este equipo. La auth la hace **Naeth**
  (OAuth 2.1); claude.ai **no admite header bearer estático**, solo OAuth ([issue
  #112](https://github.com/anthropics/claude-ai-mcp/issues/112)).
- **Visor web**: solo `localhost`. No se expone por el túnel en esta fase.
- **Hostname**: `naeth-local.enraxk.dev` (no pisa el `naeth.enraxk.dev` reservado al VPS).

## 4. El servidor MCP

- **Transport**: **Streamable HTTP** (el actual para Remote MCP; SSE es el legado).
- **Herramientas MCP v1** (cerradas, sobre el core del [Paso 6](paso6-esquema.md)):
  - `memory.add` — alta de memoria (síncrona) + encola embedding (`job`).
  - `memory.search` — búsqueda híbrida RRF (semántica + léxica).
  - `memory.get` — recupera una memoria y su cadena de versiones.
  - `memory.supersede` — nueva versión (ADD-only) que reemplaza a otra.
  - `memory.tombstone` — marca de borrado lógico.
  - `relation.add` / `relation.list` — grafo.
  - `system.status` — salud (cola de embeddings, conteos, modelo activo).
- Las mismas herramientas las consumen claude.ai y Claude Code; el visor web es gestión,
  no la vía primaria. (Ampliaciones posibles —`attachment.*`, búsqueda por grafo— se
  añaden post-v1 sin romper la fachada.)

## 5. OAuth 2.1 + PKCE en Naeth (lo crítico para claude.ai)

claude.ai exige **OAuth 2.1 con PKCE** para un custom connector remoto; el spec MCP no
admite OAuth 2.0 plano ni bearer estático. claude.ai gestiona el redirect de navegador,
los tokens y el refresh; **Naeth** actúa como servidor de autorización + de recurso. Lo
que Naeth debe implementar, con los requisitos ya confirmados:

1. **Discovery documents** (RFC 9728 / spec MCP):
   - `/.well-known/oauth-protected-resource` (metadata del recurso protegido).
   - `/.well-known/oauth-authorization-server` (metadata del authorization server).
2. **401 con el header correcto** — **este es el punto que rompía con Cloudflare Access**:
   el endpoint MCP, sin token válido, debe responder `401` con
   **`WWW-Authenticate: Bearer resource_metadata="<url>"`**. claude.ai web/móvil lo
   **exige** y abandona antes del discovery si falta; Claude Code lo tolera. Hacerlo
   nativo en Naeth garantiza que claude.ai funcione. Evidencia:
   [anthropics/claude-ai-mcp #410](https://github.com/anthropics/claude-ai-mcp/issues/410)
   (cerrado como *not planned*: Cloudflare Access Managed OAuth no emite el header, por
   eso Naeth lo hace por su cuenta).
3. **Authorization Code Flow + PKCE** (`code_challenge`/`code_verifier`), emisión de
   access token + refresh token y endpoint de refresh.
4. **Registro de cliente: Dynamic Client Registration (DCR)**. claude.ai registra su
   cliente dinámicamente (el reporter del #410 confirmó `DCR → 201`), lo que **evita
   hardcodear Client ID/Secret y las redirect URIs** — la `redirect_uri` la aporta
   claude.ai en el registro. (Pre-registrar Client ID/Secret en "Advanced settings" del
   connector es la alternativa; DCR es más limpio para una sola cuenta.)
5. **Identidad**: memoria personal de un solo usuario → el OAuth emite tokens para un
   único principal (tú). Sin multi-tenant. Esta capa se reusa en `finally` y en el sync
   ([Paso 8](paso8-sync.md)).

Evidencia general: [support.claude.com — custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp),
[claude.com — remote MCP](https://claude.com/docs/connectors/custom/remote-mcp),
[sunpeak — OAuth de connectors](https://sunpeak.ai/blogs/claude-connector-oauth-authentication/).

## 6. Empaquetado (Docker Desktop)

`docker-compose` con servicios en **red interna**, exponiendo solo a loopback:

- `db` — `pgvector/pgvector`. **Volumen Docker nombrado** `pgdata` (gestionado por el
  backend WSL2, **no** un bind-mount a ruta NTFS: Postgres rinde mal sobre el sistema de
  archivos montado de Windows). Sin puerto al host salvo, opcionalmente, `127.0.0.1`
  para inspección.
- `api` — FastAPI/uvicorn que sirve **a la vez**: endpoint MCP (Streamable HTTP),
  endpoints OAuth (discovery + authorize + token + refresh) y el visor web. Bind a
  `127.0.0.1:PUERTO`.
- `worker` — generador de embeddings (CPU) que consume la cola `job`.

**Discos de este equipo** (decidido 2026-06-24): C: SSD NVMe (sistema), E: HDD 1.8 TB,
F: SSD SATA (573 GB libres).

- **`pgdata` → F:** (SSD). Se mueve la *disk image* de Docker Desktop a F: (Settings →
  Resources → Disk image location); el volumen sigue siendo gestionado/ext4, **no**
  bind-mount NTFS. No se carga el disco del sistema (C:).
- **Binarios de adjuntos → E:** (HDD, ~1.38 TB libres): `E:\naeth\assets`, montado como
  bind-mount en `api`/`worker`. NTFS vale para servir blobs (la penalización afecta a DBs
  con muchos `fsync`, no a archivos). Es el `storage_path` del [Paso 6](paso6-esquema.md).

**Dimensión del vector parametrizada**: la columna de embedding es `vector(N)` con `N`
por variable de entorno (1024 en local con bge-m3, 384 en `finally` con e5-small). El
índice HNSW es por-dimensión, así que cada nodo construye el suyo; ver §8.

## 7. Túnel `enraxk` a este equipo

- `cloudflared` en Windows publica `naeth-local.enraxk.dev` → `127.0.0.1:PUERTO_MCP`.
- **Solo el endpoint MCP** va por el túnel. El visor y la inspección de DB se quedan en
  `localhost`.
- **Sin Cloudflare Access delante del MCP**: la auth la hace Naeth (OAuth 2.1). Poner
  Access además es justo lo que rompe claude.ai (§5.2). Si en el futuro se quisiera doble
  capa, la vía compatible sería el **MCP Server Portal** de Cloudflare (Managed OAuth),
  no Access clásico; en v1 no se usa.
- Diferencia con el [Paso 9](paso9-despliegue-vps.md): allí el endurecimiento de red
  (UFW, fail2ban, LUKS) es del server `finally`; **en local no aplica** — la única
  superficie pública es el endpoint MCP del túnel, protegido por el OAuth de Naeth.

## 8. Embeddings por-nodo y preparación multi-master

- **Modelo por-nodo, no global.** Como cada nodo **regenera sus embeddings localmente**
  y la cola `job` **no se sincroniza** ([Paso 8](paso8-sync.md)), local y `finally`
  pueden usar modelos distintos sin conflicto, siempre que **cada nodo sea internamente
  consistente** (mismo modelo para indexar notas y para embeber la query):
  - **Este equipo (local)**: **bge-m3** (1024-dim), para evaluar la calidad del recall
    en español aprovechando que el equipo da para ello. *Nota: bge-m3 en CPU rinde por
    debajo de las ~100 notas/s que midió el spike con un 384-dim ([Paso 3](paso3-resultados.md)); el bus async lo absorbe.*
  - **`finally` (VPS)**: **multilingual-e5-small** (384-dim), preparado para sus
    recursos; mantiene el techo ~100/s del spike.
  - El modelo y la dimensión son **configurables por env var**; si bge-m3 no compensa en
    local, e5-small es el fallback inmediato (ya preparado).
- **El sync transfiere solo filas** `memory`/`relation`/`attachment` (texto + metadatos,
  ADD-only, `id uuid`); **nunca embeddings**. Por eso la divergencia de modelo/dimensión
  entre nodos es inofensiva. Detalle del mecanismo: [Paso 8](paso8-sync.md).
- **Implicación para el esquema** ([Paso 6](paso6-esquema.md)): la dimensión del vector
  debe ser un parámetro de despliegue (no un literal en el DDL), y conviene registrar en
  `system.status` qué modelo/dimensión usa cada nodo.

## 9. Stack técnico

- **Lenguaje/web**: Python 3.12 + FastAPI/uvicorn (coherente con el [Paso 9](paso9-despliegue-vps.md)).
- **MCP**: SDK MCP de Python (o FastMCP) sobre FastAPI, transport Streamable HTTP.
- **OAuth**: Authlib (servidor OAuth 2.1) o implementación mínima del subset que claude.ai
  exige (discovery + authorize + token + refresh + PKCE + DCR + 401 con `WWW-Authenticate`).
- **DB**: imagen `pgvector/pgvector`; acceso con `psycopg`/SQLAlchemy.
- **Embeddings**: fastembed/ONNX en CPU (bge-m3 local; e5-small en `finally`).

## 10. Fases de ejecución (cada una con OK)

1. **Pila base**: compose con `db` + `api` (sin MCP aún) + `worker`; migraciones del
   esquema del [Paso 6](paso6-esquema.md) con dimensión parametrizada; visor en
   `localhost`. **Verificar HNSW aquí** (pendiente menor del [Paso 5](paso5-sustrato.md);
   arrancar con los parámetros por defecto de pgvector `m=16, ef_construction=64` y medir).
2. **MCP local**: exponer las herramientas MCP (§4); validar con **Claude Code** por
   `localhost` (bearer en header). Aquí se prueba la lógica de memoria de punta a punta y
   se **evalúa la calidad de bge-m3** en español.
3. **OAuth 2.1**: discovery + authorize + token + refresh + PKCE + DCR + 401 con
   `WWW-Authenticate`.
4. **Túnel + claude.ai**: `cloudflared` a `naeth-local.enraxk.dev`; alta del custom
   connector en claude.ai; verificar el flujo OAuth completo.
5. **Endurecimiento mínimo local** y verificación; luego, cuando funcione como se quiere,
   pasar al [Paso 8](paso8-sync.md) (sync) y al [Paso 9](paso9-despliegue-vps.md) (VPS).

## 11. Lo que este paso NO hace

- No despliega en `finally` (eso es el [Paso 9](paso9-despliegue-vps.md)).
- No diseña el mecanismo de sync multi-master (eso es el [Paso 8](paso8-sync.md)); solo
  deja el local preparado como nodo (Postgres propio, UUID, append-only, dimensión
  parametrizada).
- No construye el roadmap completo del visor (árbol/CRUD/editor/grafo); v1 = el visor de
  composición re-plataformado a Postgres.
- No escribe código: es el plan previo a hacerlo.
