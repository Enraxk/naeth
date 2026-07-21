# Paso 7 · Resultados de la Fase 3a (OAuth 2.1 · validación del flujo)

> Banco real en **este equipo Windows** (Docker Desktop). La Fase 3 del
> [Paso 7](paso7-local-windows.md) §10.3 se abordó **por pasos**: **3a = validar el
> plumbing OAuth** que claude.ai exige, con FastMCP nativo y un cliente OAuth real, en
> local. Código en `naeth/`. Fecha: 2026-06-25.

## Decisión de enfoque

El [Paso 7 §5/§9](paso7-local-windows.md) dejaba abierto **Authlib a mano** vs **FastMCP
nativo**. Una investigación del código de FastMCP 2.13 (provider `OAuthProvider` +
`InMemoryOAuthProvider`, middleware de auth, `http.py`) confirmó que **FastMCP aporta
nativamente lo frágil**: discovery RFC 8414/9728 con el path-scoping correcto a `/mcp`,
PKCE S256, los endpoints `/authorize` `/token` `/register` `/revoke`, y —lo crítico— el
**401 con `WWW-Authenticate: Bearer resource_metadata=...`**. Reimplementar eso a mano es
justo donde se rompe el discovery de claude.ai. **Decisión: OAuth con FastMCP nativo.**

La Fase 3 se parte en:
- **3a (esta)**: `InMemoryOAuthProvider` con DCR + `base_url`, para **validar que el flujo
  completo funciona** con un cliente OAuth real. Tokens efímeros, sin login (auto-aprueba).
- **3b (siguiente)**: subclase de `OAuthProvider` con **persistencia Postgres** + **login
  de 1 usuario**, antes de exponer por el túnel (Fase 4).

## Cambio de arquitectura (necesario)

La investigación destapó un fallo latente de la Fase 2: el MCP se montó bajo `/mcp` dentro
de FastAPI, lo que dejaría el discovery OAuth en `/mcp/.well-known/...` y **claude.ai no lo
encontraría** (lo busca en la raíz del host). Se reestructuró: la **app principal del
proceso es el `http_app` de FastMCP** (endpoint MCP en `/mcp`, rutas OAuth en la **raíz**),
y el **visor + CRUD** se sirven como `custom_route` del propio servidor MCP. Un solo
proceso ([Paso 7 §6](paso7-local-windows.md)), discovery en la raíz. Verificado: visor,
`/api/*` y MCP siguen operativos tras el cambio.

## Verificación del discovery y el 401

| Comprobación | Resultado | Veredicto |
|---|---|---|
| `/.well-known/oauth-authorization-server` (RFC 8414, raíz) | issuer, authorize/token/register, **S256**, grants code+refresh | ✅ |
| `/.well-known/oauth-protected-resource/mcp` (RFC 9728) | `resource=…/mcp`, `authorization_servers=[issuer]` | ✅ |
| `POST /mcp` sin token → **401** | `WWW-Authenticate: Bearer … resource_metadata="…/.well-known/oauth-protected-resource/mcp"` | ✅ |

Ese header es **el punto que claude.ai exige** y que rompía con Cloudflare Access (issue
#410 del [Paso 7 §5](paso7-local-windows.md)). FastMCP lo emite nativamente.

## Verificación del flujo completo (cliente OAuth real, headless)

`InMemoryOAuthProvider` auto-aprueba el `authorize`, así que el flujo corre sin pantalla
(302 directo con `code`):

| Paso | Resultado | Veredicto |
|---|---|---|
| DCR `POST /register` (RFC 7591) | 201, cliente público (PKCE, sin secret) | ✅ |
| `GET /authorize` + `code_challenge` S256 | 302 con `code`, `state` preservado | ✅ |
| `POST /token` (authorization_code + `code_verifier`) | 200, access + refresh, `Bearer` | ✅ |
| **PKCE con `code_verifier` erróneo** | **400** (rechazado: PKCE se valida de verdad) | ✅ |
| `POST /mcp` con bearer válido | 200 (autorizado) | ✅ |
| `POST /mcp` sin token | 401 | ✅ |
| `POST /token` (refresh_token) | 200, nuevo access token | ✅ |

## Conmutador y compatibilidad

OAuth es **conmutable por env var** (`OAUTH_ENABLED`, `OAUTH_BASE_URL`). En local queda
**off por defecto**, para que **Claude Code** siga conectando por `localhost` sin auth
(Fase 2). Se enciende para validar (3a) y se encenderá de forma estable en 3b/4. La
`base_url` local es `http://127.0.0.1:8800`; en la Fase 4 será `https://naeth-local.enraxk.dev`.

## Caveats honestos

- **`InMemoryOAuthProvider` es "for testing"**: tokens y clientes en memoria (se pierden al
  reiniciar el contenedor) y **sin login** (auto-aprueba el `authorize`). Sirve para validar
  el plumbing, **no** para exponer: cualquiera que alcanzara `/authorize` obtendría token.
  Por eso 3b añade persistencia Postgres + login de 1 usuario **antes** del túnel.
- **No probado aún con claude.ai real**: 3a valida con un cliente OAuth propio (httpx). El
  flujo real de claude.ai (DCR desde su nube + redirect de navegador) se prueba en la
  **Fase 4**, con el túnel `enraxk` y el alta del custom connector.
- **Tokens opacos, no JWT**: `InMemoryOAuthProvider` emite strings opacos. En 3b se decide
  si Naeth emite JWT firmados (FastMCP trae `JWTIssuer`) o mantiene tokens opacos validados
  contra Postgres.

## Veredicto de la Fase 3a

El **flujo OAuth 2.1 + PKCE + DCR que claude.ai exige funciona** sobre FastMCP nativo:
discovery en la raíz, el 401 con `WWW-Authenticate: resource_metadata`, authorization code
con PKCE validado, y refresh. El riesgo técnico de la Fase 3 (que el plumbing del connector
remoto encajara) queda **despejado**. Procede la **Fase 3b**: respaldar el `OAuthProvider`
con Postgres y un login de 1 usuario, para poder exponerlo en la **Fase 4**.
