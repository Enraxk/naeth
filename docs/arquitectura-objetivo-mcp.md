# Arquitectura objetivo de los MCP personales + plan de migración

> Congelado el 2026-07-07 tras refinar en sesión. Combina la investigación de centralización/hardening
> con las ideas de Eneko: **bypass local por loopback**, **allowlist de IP en el edge**, y **UIs remotas
> (visor + image-studio) accesibles desde el móvil** con login SSO. Objetivo: seguro, robusto, centralizado,
> sin romper claude.ai/Claude Code. Un solo usuario.

## Principio rector
Cada cliente se protege **según cómo puede autenticarse**, pero todos contra **una sola identidad**:
- **Máquina** (claude.ai) → no puede hacer login interactivo → **token OAuth (JWT) + allowlist de IP**.
- **Navegador** (tú, móvil/donde sea) → sí puede → **forward-auth con passkey/2FA** (SSO), desde cualquier IP.
- **Local** (tu PC) → **loopback**, confiado, sin túnel y sin login.

## Las 3 zonas
| Zona | Quién | Cómo llega | Protección |
|---|---|---|---|
| **Local (loopback)** | Claude Code, visor, scripts en tu PC | directo a `127.0.0.1` | ninguna (no sale a internet; se confía en el loopback) |
| **Público · MCP** | claude.ai | edge → túnel → `/mcp` | allowlist IP (solo Anthropic) + OAuth/JWT del IdP. **Sin forward-auth** (rompería el connector) |
| **Público · UIs** | tú, navegador (móvil) | edge → túnel → Caddy | **forward-auth (login SSO)** contra el IdP, desde cualquier IP. Sin allowlist |

## Componentes y roles
- **Cloudflare (edge + 1 túnel `cloudflared`, servicio Windows):** una sola config con varios ingress.
  WAF: en los hostnames/paths MCP, **allowlist del egress de Anthropic `160.79.104.0/21`** (resto 403);
  **Bot Fight Mode / "Block AI bots" DESACTIVADO** en esos hostnames (causa nº1 del "conecta y silencio").
- **Caddy (reverse-proxy local):** forward-auth **selectivo**. Protege visor + `/api` + image-studio con
  login del IdP; **deja pasar directo `/mcp` y las rutas OAuth** (`.well-known/*`, `/authorize`, `/token`,
  `/register`) — nunca forward-auth delante del MCP.
- **Pocket-ID (IdP central, contenedor propio):** **doble función** — emite los JWT que validan los MCP
  **y** es la pantalla de login (passkey primario + TOTP de respaldo) de las UIs. Rate-limit y auditoría de fábrica.
- **Servidores (Resource Servers, atados a loopback):**
  - **Naeth** `:8800` — memoria + visor. FastMCP `RemoteAuthProvider`+`JWTVerifier` (valida JWT de Pocket-ID);
    para claude.ai, `OAuthProxy`/CIMD. Postgres+pgvector.
  - **comfy** `:9100` — imágenes + **image-studio**. Igual patrón. ComfyUI `:8188` detrás (loopback).
- **Base endurecida:** secretos en **SOPS+age** (clave protegida con DPAPI); token store **cifrado (Fernet)**;
  todo como **servicios Windows** (fin del servicio+tarea mezclados); **monitor de salud + backups**
  (Postgres, secretos, y la BD del IdP = la pieza más crítica).

## Esquema de hostnames (ejemplo, ajustable)
Separar por ROL hace las reglas simples (a nivel de host, sin malabares de path):
- `id.enraxk.dev` → Pocket-ID (IdP).
- `naeth.enraxk.dev` → Naeth `/mcp` (máquina: allowlist IP + OAuth).
- `comfy.enraxk.dev` → comfy `/mcp` (máquina: allowlist IP + OAuth).
- `visor.enraxk.dev` → visor de Naeth (navegador: forward-auth SSO, cualquier IP).
- `studio.enraxk.dev` → image-studio (navegador: forward-auth SSO, cualquier IP).
*(Alternativa: MCP y UI por path en el mismo host; funciona pero obliga a reglas por path. Preferido host-level.)*

## Decisión sobre el image-studio
NO exponer la UI completa de ComfyUI (editor de nodos, pesada y con superficie propia). En su lugar, una
**web pequeña "prompt → imagen"** (servida por comfy-mcp o un sidecar) que por debajo llama a la generación
ya validada. Detrás del forward-auth. Es un mini-build futuro (Fase 6).

## Defensa en profundidad (para llegar al MCP desde fuera)
0. **Lo local ni aparece** (loopback, no sale a internet).
1. **Allowlist de IP** en el edge (solo Anthropic; el resto ni ve el endpoint).
2. **El túnel solo expone `/mcp` + OAuth** (visor/API/studio por sus propios hosts con forward-auth).
3. **OAuth con IdP central + 2FA/passkey**.
4. **Secretos y tokens cifrados** en reposo.

---

## Plan de migración por fases (sin romper claude.ai/Claude Code)

**Fase 0 · Preparación (sin tocar producción)**
- Backups: Postgres de Naeth, `oauth_store.json`, `.env`/`credentials.env`. Documentar los `client_id` que
  claude.ai tiene registrados. Actualizar FastMCP a 2.13+ en un entorno de pruebas.
- No se rompe nada: no se toca lo vivo.

**Fase 1 · Quick wins sobre lo existente (bajo riesgo, alto valor — se puede HOY)**
- **Bypass local:** apuntar el Claude Code local a `http://127.0.0.1:9100/mcp` (y Naeth `:8800`) en vez del
  túnel. Tu tráfico local sale del camino público.
- **Allowlist de IP** en el edge para los hostnames MCP: permitir solo `160.79.104.0/21`, resto 403; **Bot
  Fight OFF**. (Como lo local ya va por loopback, no hace falta meter tu IP dinámica.)
- **Secretos → SOPS+age** y **token store → Fernet**.
- No se rompe: `/mcp` + OAuth intactos (solo IP-gated a quien los usa: Anthropic). Verificar con curl.

**Fase 2 · Desplegar Pocket-ID (aditivo)**
- Contenedor en `id.enraxk.dev`; tu passkey + TOTP de respaldo. Los MCP siguen con su auth actual.
- No se rompe: el IdP aún no se usa.

**Fase 3 · Migrar comfy a Resource Server (el menos crítico primero)**
- comfy pasa a `RemoteAuthProvider`+`JWTVerifier` contra Pocket-ID; para claude.ai, `OAuthProxy` con
  `allowed_client_redirect_uris=["https://claude.ai/api/mcp/auth_callback","http://127.0.0.1:*"]`.
- Reconectar el connector de comfy en claude.ai (re-consent, esperado). Rollback a su AS propio si falla.
- No se rompe: Naeth intacto.

**Fase 4 · Migrar Naeth igual**
- Mismo patrón + migrar `oauth_store` a store cifrado. Postgres de memoria intacto. Rollback disponible.

**Fase 5 · Consolidar túnel + autoarranque**
- Un solo `cloudflared` (varios ingress) como servicio; comfy y MCP como servicios Windows / `restart:always`.
  Orden de arranque: IdP → MCP → túnel. Monitor de salud + alertas + backups automatizados.
- No se rompe: probar el túnel nuevo como réplica antes de parar el viejo.

**Fase 6 · (Opcional, cuando lo quieras) UIs remotas**
- Caddy forward-auth para `visor.enraxk.dev`; construir y exponer `studio.enraxk.dev`. Sin allowlist de IP,
  con login SSO (passkey desde el móvil). El visor deja de ser solo-local si tú quieres.

**Fase 7 · Escala a N**
- Plantilla repetible: cada MCP nuevo nace como Resource Server contra Pocket-ID + ingress + servicio + SOPS.

## Decisiones abiertas a confirmar
- Esquema de hostnames (host-level vs por path). Preferido: host-level.
- `image-studio`: mini-web propia (recomendado) vs UI de ComfyUI (no).
- Pocket-ID vs Keycloak (si necesitaras DCR nativa). Preferido Pocket-ID por passkeys + footprint; verificar su DCR.
