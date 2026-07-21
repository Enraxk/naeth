# Paso 7 · Resultados de la Fase 3b (OAuth · persistencia + login)

> Banco real en **este equipo Windows** (Docker Desktop). La Fase 3b del
> [Paso 7](paso7-local-windows.md): convertir el OAuth validado en 3a en un **Authorization
> Server real**, con **persistencia Postgres** y **login de 1 usuario**, listo para exponer
> en la Fase 4. Código en `naeth/`. Fecha: 2026-06-25.

## Qué se construyó

Una subclase **`NaethOAuthProvider(OAuthProvider)`** que reemplaza al
`InMemoryOAuthProvider` de la [Fase 3a](paso7-resultados-fase3a.md). FastMCP sigue aportando
el plumbing (discovery, PKCE, endpoints, el 401 con `resource_metadata`); aquí se ponen las
dos piezas que faltaban para producción:

1. **Persistencia Postgres**: 4 tablas **locales** (no se sincronizan, como `job` — son
   estado de autorización de este nodo):
   - `oauth_client` — clientes registrados por DCR (`OAuthClientInformationFull` en `jsonb`).
   - `oauth_pending` — puente `authorize` → `/login` (la petición esperando autenticación).
   - `oauth_code` — códigos de autorización de un solo uso (con su `code_challenge`).
   - `oauth_token` — access y refresh emitidos, con `paired_token` para rotación/revocación.
2. **Login de 1 usuario**: `authorize()` ya **no auto-aprueba**; guarda un pending y redirige
   a `/login`. El formulario valida usuario+contraseña (`NAETH_AUTH_USER`/`NAETH_AUTH_PASSWORD`,
   `compare_digest`) y **solo entonces** emite el code. Nadie obtiene token sin autenticarse
   — el agujero que tenía 3a (auto-aprobar) queda cerrado antes de exponer.

## Tabla de verificación (flujo con login, cliente real headless)

| Paso | Resultado | Veredicto |
|---|---|---|
| DCR `POST /register` | 201, cliente persistido en `oauth_client` | ✅ |
| `GET /authorize` | **302 → `/login?rid=…`** (no al callback: hay gate) | ✅ |
| `GET /login` | formulario HTML usuario+contraseña | ✅ |
| `POST /login` credenciales **inválidas** | **401**, sin code | ✅ |
| `POST /login` credenciales válidas | 303 → `redirect_uri?code=…&state=…` | ✅ |
| `POST /token` (code + `code_verifier`) | 200, access + refresh (`nae_at_`/`nae_rt_`) | ✅ |
| `POST /mcp` con bearer | 200 (autorizado) | ✅ |
| `POST /token` (refresh) | 200, nuevo access (rotación) | ✅ |
| refresh **viejo** tras rotar | **400** (revocado) | ✅ |
| Persistencia en Postgres | 1 cliente, 4 tokens, 2 revocados, 1 code usado, 0 pending | ✅ |

La cuenta cuadra: el par viejo se **revocó** al rotar (2 revocados), el `pending` se **borró**
tras el login (0), el code quedó **usado** (1). Como todo vive en Postgres, **sobrevive al
reinicio** del contenedor (a diferencia del InMemory de 3a).

## Detalles de implementación

- **Tokens opacos** (`nae_at_…` / `nae_rt_…`) validados contra `oauth_token`, no JWT. Para
  un solo usuario validar contra Postgres es más simple que gestionar claves de firma, y el
  `revoke`/rotación es directo. (FastMCP trae `JWTIssuer` si en `finally` se quisiera JWT.)
- **Rotación de refresh**: al refrescar se revoca el par anterior (access+refresh) vía
  `paired_token`; reusar el refresh viejo da 400.
- **Provider conmutable**: `OAUTH_PROVIDER=postgres` (3b, por defecto) | `memory` (3a, para
  re-validar el plumbing rápido). `OAUTH_ENABLED` sigue gobernando on/off; **off por
  defecto** para que Claude Code conecte por `localhost` sin auth (Fase 2).
- **DB async-safe**: las queries (pool síncrono de `core`) se ejecutan en un threadpool
  (`anyio.to_thread`) para no bloquear el event loop. El tráfico OAuth de 1 usuario es
  esporádico.

## Caveats honestos

- **Sin sesión persistente**: cada `authorize` pide login. Es más seguro (siempre
  credenciales) y para claude.ai apenas molesta: re-autoriza con el refresh token, así que
  el login solo ocurre en la conexión inicial o re-conexión.
- **Sin CSRF token ni rate-limit en `/login`**: superficie mínima de 1 usuario; aceptable en
  v1. Se endurece en `finally` ([Paso 9](paso9-despliegue-vps.md)) si hace falta.
- **Contraseña en `.env` en claro**: coherente con el resto de secretos del nodo (van en
  `.env`). El placeholder de `.env.example` está vacío; pon una real antes de exponer.
- **No probado aún con claude.ai real**: 3b valida con un cliente OAuth propio (httpx) y un
  login simulado por POST. El flujo real (DCR desde la nube de claude.ai + redirect de
  navegador + tu login en pantalla) se prueba en la **Fase 4**, con el túnel `enraxk` y
  `OAUTH_BASE_URL=https://naeth-local.enraxk.dev`.

## Veredicto de la Fase 3b

Naeth tiene ahora un **Authorization Server OAuth 2.1 propio, persistido en Postgres y con
login de 1 usuario**: DCR, authorization code + PKCE, refresh con rotación, revocación, y el
discovery + 401 que claude.ai exige (de [3a](paso7-resultados-fase3a.md)). El gate de login
cierra el riesgo de auto-aprobación antes de exponer. **La Fase 3 está completa.** Procede la
**Fase 4**: túnel `cloudflared` a `naeth-local.enraxk.dev`, `OAUTH_BASE_URL` público, y alta
del custom connector en **claude.ai** para verificar el flujo real end-to-end.
