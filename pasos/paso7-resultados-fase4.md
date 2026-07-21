# Paso 7 · Resultados de la Fase 4 (túnel + claude.ai · end-to-end)

> Banco real en **este equipo Windows** (Docker Desktop + cloudflared). La Fase 4 del
> [Paso 7](paso7-local-windows.md) §10.4, **la última**: exponer Naeth por el túnel
> `enraxk` y conectar **claude.ai** como custom connector remoto, con el OAuth real.
> **Con esto el Paso 7 queda completo.** Fecha: 2026-06-25.

## Qué se montó

- **cloudflared** instalado en este equipo (2026.5.2) y autorizado sobre la zona
  `enraxk.dev` (`cloudflared tunnel login` → `cert.pem`).
- **Túnel propio `naeth-local`** (id `7d283520-…`), **separado del túnel `enraxk`** que ya
  tenía la cuenta (no lo toca). `config.yml` con una sola regla de ingress:
  `naeth-local.enraxk.dev` → `http://127.0.0.1:8800`, catch-all `404`.
- **Ruta DNS** `naeth-local.enraxk.dev` → el túnel (CNAME gestionado por Cloudflare).
- **OAuth en modo público**: `OAUTH_ENABLED=1`, `OAUTH_BASE_URL=https://naeth-local.enraxk.dev`,
  `OAUTH_PROVIDER=postgres` (el AS de la [Fase 3b](paso7-resultados-fase3b.md), con login).
- Solo el endpoint del proceso (visor + MCP + OAuth) va por el túnel; nada más se expone.

## Verificación por el HTTPS público (vía túnel)

| Comprobación (`https://naeth-local.enraxk.dev`) | Resultado | Veredicto |
|---|---|---|
| `healthz` | OAuth enabled, base URL pública | ✅ |
| AS metadata (RFC 8414) | issuer y endpoints en `https://naeth-local.enraxk.dev` | ✅ |
| Protected resource metadata (RFC 9728) | `resource=…/mcp`, AS correcto | ✅ |
| `/mcp` sin token → 401 | `WWW-Authenticate … resource_metadata="https://…/mcp"` | ✅ |

El discovery y el 401 que claude.ai exige funcionan **con el esquema HTTPS público**, no el
loopback: la `base_url` parametrizada hizo que toda la metadata se anunciara con el hostname
del túnel.

## Conexión real de claude.ai (end-to-end)

claude.ai → Settings → Connectors → custom connector con URL
`https://naeth-local.enraxk.dev/mcp`. El flujo completo corrió **contra la instancia real**:

| Etapa | Evidencia | Veredicto |
|---|---|---|
| Discovery + DCR | cliente **"Claude"** registrado en `oauth_client` (16:33) | ✅ |
| Authorize → login | apareció la **pantalla de login de Naeth** en claude.ai | ✅ |
| Login de 1 usuario | usuario `eneko` + contraseña → autorizado | ✅ |
| Tokens emitidos | access + refresh activos en `oauth_token` (Postgres) | ✅ |
| Herramientas | claude.ai lista las **8 tools** (`memory.*`, `relation.*`, `system.status`) | ✅ |
| Connector | **Conectado** en claude.ai | ✅ |

El cliente y los tokens de claude.ai quedaron **persistidos en Postgres** (sobreviven
reinicios): el AS de la Fase 3b funciona con un cliente OAuth real (la nube de Anthropic),
no solo con el cliente de prueba.

## Un tropiezo y su causa (honesto)

El primer intento de login dio **"Credenciales inválidas"**: se había cambiado
`NAETH_AUTH_PASSWORD` en `.env` pero el contenedor `api` seguía con la anterior (las env se
leen al arrancar). Recrear `api` (`docker compose up -d --force-recreate api`) y reintentar
el login lo resolvió. Aprendizaje operativo: tras tocar `.env`, recrear el servicio.

## Caveats honestos

- **Persistencia de procesos**: el túnel (`cloudflared run`) y la pila Docker corren en
  segundo plano de la sesión. Para que **sobrevivan a un reinicio del equipo** hay que
  instalarlos como servicios (`cloudflared service install`; Docker Desktop con autostart).
  Es el **endurecimiento mínimo** de la [Fase 5](paso7-local-windows.md) (§10.5), aún pendiente.
- **Login sencillo**: 1 usuario, contraseña en `.env`, sin CSRF/rate-limit (ver
  [Fase 3b](paso7-resultados-fase3b.md)). Suficiente para uso personal; se endurece en
  `finally` ([Paso 9](paso9-despliegue-vps.md)) si hace falta.
- **`pgdata` aún en C:**: mover la *disk image* de Docker a F: sigue pendiente (operativo,
  trivial con datos pequeños).
- **Un solo nodo todavía**: esto es el nodo local. El multi-master (sync con `finally`) es
  el [Paso 8](paso8-sync.md); el despliegue en `finally`, el [Paso 9](paso9-despliegue-vps.md).

## Veredicto de la Fase 4 — y del Paso 7

**claude.ai habla con la memoria de Naeth alojada en este equipo**, por un túnel propio,
autenticado con el **OAuth 2.1 + PKCE + DCR + login** que Naeth implementa de forma nativa.
Con esto, **el Paso 7 está completo**: la pila base ([Fase 1](paso7-resultados-fase1.md)), el
MCP ([Fase 2](paso7-resultados-fase2.md)), el OAuth ([3a](paso7-resultados-fase3a.md) +
[3b](paso7-resultados-fase3b.md)) y la conexión de claude.ai (Fase 4) funcionan de punta a
punta sobre el núcleo del [Paso 6](paso6-esquema.md). Naeth v1 corre como **primera instancia
real**. Lo siguiente: endurecimiento mínimo (Fase 5), y luego el [Paso 8](paso8-sync.md)
(sync multi-master) y el [Paso 9](paso9-despliegue-vps.md) (`finally` como segundo nodo).
