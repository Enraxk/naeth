# Paso 7 · Resultados de la Fase 2 (MCP local)

> Banco real en **este equipo Windows** (Docker Desktop). La Fase 2 del
> [Paso 7](paso7-local-windows.md) §10.2: exponer el **servidor MCP** sobre el mismo core
> y validarlo desde **Claude Code** por `localhost`. Código en `naeth/`. Fecha: 2026-06-25.

## Qué se construyó

Un **servidor MCP** (Streamable HTTP) montado en el **mismo proceso FastAPI** que el visor
(como manda el [Paso 7 §6](paso7-local-windows.md)), como fachada sobre el núcleo ADD-only
del [Paso 6](paso6-esquema.md) — **sin duplicar lógica**: cada herramienta llama al mismo
`core.py` que usa el visor. Stack: **FastMCP** (el [Paso 7 §9](paso7-local-windows.md) lo
admite junto al SDK oficial), transport Streamable HTTP, endpoint en `/mcp/`.

## Las 8 herramientas v1 (Paso 7 §4, cerradas)

| Herramienta | Qué hace | Núcleo |
|---|---|---|
| `memory.add` | alta ADD-only + encola embedding | `core.add` |
| `memory.search` | búsqueda híbrida RRF (semántica + léxica) | `core.search` |
| `memory.get` | memoria + su cadena de versiones | `core.get` |
| `memory.supersede` | nueva versión que reemplaza (la vieja permanece) | `core.supersede` |
| `memory.tombstone` | borrado lógico (sin DELETE físico) | `core.tombstone` |
| `relation.add` | arista explícita del grafo | `core.relation_add` |
| `relation.list` | relaciones vigentes (entrantes/salientes) | `core.relation_list` |
| `system.status` | salud: conteos, cola, modelo/dimensión | `core.status` |

## Tabla de verificación

| Comprobación | Resultado | Veredicto |
|---|---|---|
| Endpoint MCP Streamable HTTP | montado en `/mcp/`, mismo proceso FastAPI | ✅ |
| `list_tools` (cliente FastMCP real) | 8 tools, exactamente las del §4 | ✅ |
| `system.status` vía MCP | devuelve estado del nodo | ✅ |
| `memory.add` vía MCP | crea memoria (`created=true`), encola embedding | ✅ |
| `memory.search` vía MCP | top-hit = la recién creada (ya embebida) | ✅ |
| Bearer opcional | `none` en loopback; exigible si `BEARER_TOKEN` | ✅ |
| **Claude Code conecta** (`claude mcp list`) | `naeth-local … (HTTP) - ✓ Connected` | ✅ |

## Auth en esta fase

El [Paso 7 §3](paso7-local-windows.md) permite dos vías para Claude Code: **bearer en
header** o **sin auth en loopback**. Se implementó un **bearer opcional**: si `BEARER_TOKEN`
está puesto en `.env`, el endpoint `/mcp` exige `Authorization: Bearer <token>`; si está
vacío, se admite sin auth (válido **solo** en loopback). En esta fase quedó en `none`
(Claude Code habla por `127.0.0.1`). **OAuth 2.1 + PKCE + DCR** para claude.ai es la
**Fase 3**.

## Caveats honestos

- **Tools disponibles tras reiniciar la sesión**: el servidor quedó registrado en la
  config de Claude Code (`naeth-local`, scope local del proyecto) y la **conexión está
  verificada**, pero Claude Code carga los MCP al arranque: para **invocar** las tools en
  una sesión hay que reiniciarla.
- **Sin claude.ai todavía**: la Fase 2 es solo MCP por `localhost`. claude.ai exige OAuth
  2.1 y túnel HTTPS (Fases 3-4); con bearer estático no entra.
- **Aún no se evaluó la calidad del recall en español** (objetivo declarado de la Fase 2
  en el plan junto al MCP): la pila usa `paraphrase-multilingual-MiniLM-L12-v2` (sustituto
  de e5-small, ver [Fase 1](paso7-resultados-fase1.md)); la evaluación cualitativa con uso
  real queda como trabajo continuo, no bloquea avanzar a OAuth.

## Veredicto de la Fase 2

El **servidor MCP de Naeth corre sobre el mismo núcleo** del [Paso 6](paso6-esquema.md),
expone las 8 herramientas del [Paso 7 §4](paso7-local-windows.md) y **Claude Code conecta
por `localhost`**. La lógica de memoria (ADD-only, búsqueda híbrida, grafo) es accesible a
un agente de punta a punta. Procede la **Fase 3**: OAuth 2.1 + PKCE + DCR nativo en Naeth
(discovery, 401 con `WWW-Authenticate`, authorize, token, refresh) para que claude.ai
pueda entrar en la Fase 4.
