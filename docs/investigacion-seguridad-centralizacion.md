# Investigación: centralización y seguridad de los MCP personales (Naeth + comfy-mcp)

> Brief para lanzar con `deep-research`. Generado 2026-07-07 tras una auditoría local conjunta.
> Objetivo: pasar de dos servidores MCP casi gemelos (con OAuth propio duplicado y agujeros de
> exposición) a un sistema **centralizado y endurecido** con una única capa de identidad, sin
> romper claude.ai ni Claude Code.

## Contexto (los dos sistemas)
- **Naeth** (memoria): FastMCP + Postgres+pgvector + Authorization Server OAuth 2.1 PROPIO
  (subclase `OAuthProvider`, persistido en Postgres, login de 1 usuario) + visor web + API REST.
  Docker. Túnel Cloudflare dedicado `naeth-local.enraxk.dev → 127.0.0.1:8800`, cloudflared como
  servicio Windows.
- **comfy-mcp** (imágenes): FastMCP + AS OAuth 2.1 PROPIO (misma estructura, tokens en JSON,
  login de 1 usuario) envolviendo ComfyUI local. uv. Túnel Cloudflare dedicado propio
  `comfy.enraxk.dev → 127.0.0.1:9100`, cloudflared como tarea programada.
- Ambos conectados a claude.ai (connector remoto OAuth 2.1 + PKCE + DCR con login propio) y a
  Claude Code (MCP HTTP). Cada uno reimplementa su PROPIO OAuth y login → dos de todo.

## Hallazgos de la auditoría local (2026-07-07)
1. **CRÍTICO (tapado provisionalmente):** en Naeth solo `/mcp` estaba protegido por OAuth; el
   visor `/` y la API de datos `/api/*` (incluida ESCRITURA `POST/DELETE`) estaban ABIERTOS a
   internet sin auth por el túnel. Verificado en vivo: se podía leer y escribir memoria sin token.
   **Tapón aplicado:** `~/.cloudflared/config.yml` devuelve 404 al edge para `^/api` y `^/$`,
   dejando pasar solo `/mcp` + rutas OAuth. Es un parche de borde, NO la solución de fondo.
   ⚠ El tapón está solo en la copia viva `~/.cloudflared/config.yml`, NO en la copia del repo
   `naeth/cloudflared/config.yml` → sincronizar para no perderlo.
2. Login sin rate-limit, sin bloqueo por intentos, sin CSRF → fuerza bruta posible (ambos).
3. Secretos en CLARO en disco: `.env`, `credentials.env`, `oauth_store.json`, creds Postgres.
4. Un solo factor (contraseña), sin 2FA, sin auditoría ni alerta de accesos.
5. Robustez: autoarranque inconsistente (servicio vs tarea), sin monitorización ni backup de
   secretos; el connector de claude.ai a veces hay que reconectarlo a mano tras reiniciar el PC.

## Restricción dura
Poner Cloudflare Access (u otra auth de proxy con redirect/login propio) DELANTE de `/mcp` ROMPE
claude.ai como cliente MCP remoto (bug conocido de Anthropic). Cualquier solución de "proteger
todas las rutas" NO puede romper el handshake OAuth del MCP.

---

## PROMPT DE INVESTIGACIÓN

```
ROL Y OBJETIVO
Eres un arquitecto de seguridad e infraestructura especializado en self-hosting personal y en
el Model Context Protocol (MCP). Investiga a fondo, con información ACTUAL de 2026 y fuentes
citadas, cómo CENTRALIZAR y ENDURECER dos servidores MCP personales casi idénticos que hoy
tengo por separado, para lograr un sistema MÁS SEGURO y ROBUSTO con una única capa de identidad.
El entregable es una DECISIÓN de arquitectura accionable + un plan de migración por fases que
NO rompa las conexiones existentes con claude.ai y Claude Code.

MI CONTEXTO REAL (punto de partida, no lo cuestiones)
- Un solo usuario (yo), self-hosted, en UN PC Windows 11 (Docker Desktop + procesos locales),
  64 GB RAM. Preferencia por coste cero / open-source y por hacerlo "en condiciones".
- Dos sistemas casi gemelos, ambos servidores MCP en Python (FastMCP, Streamable HTTP):
  * NAETH (memoria personal): FastMCP + Postgres+pgvector + Authorization Server OAuth 2.1
    PROPIO (subclase OAuthProvider de FastMCP, persistido en Postgres, login de 1 usuario
    user/pass) + visor web + API REST de datos. Corre en Docker. Expuesto por túnel Cloudflare
    dedicado (naeth-local.enraxk.dev → 127.0.0.1:8800), cloudflared como servicio Windows.
  * COMFY-MCP (generación de imágenes): FastMCP + Authorization Server OAuth 2.1 PROPIO
    (misma estructura que Naeth pero tokens/clientes en un JSON, login de 1 usuario) que envuelve
    un ComfyUI local. Corre con uv. Expuesto por túnel Cloudflare dedicado propio
    (comfy.enraxk.dev → 127.0.0.1:9100), cloudflared como tarea programada.
- Ambos se conectan a claude.ai (custom connector remoto, flujo OAuth 2.1 + PKCE + DCR con MI
  pantalla de login) y a Claude Code (MCP HTTP).
- CADA sistema reimplementa su PROPIO OAuth y su PROPIO login. Dos logins, dos contraseñas, dos
  almacenes de tokens, dos túneles, dos mecanismos de autoarranque distintos.

HALLAZGOS DE SEGURIDAD YA DETECTADOS (base de la investigación)
1. CRÍTICO (ya tapado provisionalmente en el edge): en Naeth, solo /mcp estaba protegido por
   OAuth; el visor (/) y la API de datos (/api/*, incluida ESCRITURA POST/DELETE) estaban
   ABIERTOS a internet SIN autenticación por el túnel. Verificado: se podía leer y escribir
   memoria sin token. Tapón actual = 404 al edge para /api y / (parche, no solución de fondo).
2. Login sin rate-limit, sin bloqueo por intentos, sin CSRF → fuerza bruta posible (ambos).
3. Secretos en CLARO en disco: .env, credentials.env, oauth_store.json, credenciales de Postgres.
4. Un solo factor (contraseña), sin 2FA, sin auditoría ni alerta de accesos.
5. Robustez: autoarranque inconsistente (servicio vs tarea), sin monitorización ni backup de
   secretos, y el connector de claude.ai a veces hay que reconectarlo a mano tras reiniciar el PC.

RESTRICCIÓN DURA (verifícala y respétala en toda recomendación)
- Poner Cloudflare Access (u otra auth de proxy que intercepte con redirect/login propio)
  DELANTE del endpoint /mcp ROMPE claude.ai como cliente MCP remoto (bug conocido de Anthropic,
  el flujo OAuth/DCR del connector deja de funcionar). Cualquier solución de "proteger todas las
  rutas" NO puede romper el handshake OAuth del MCP para claude.ai/Claude Code. Investiga cómo
  proteger el visor/API SIN romper el MCP (p.ej. auth scoping por ruta, forward-auth selectivo).

PREGUNTAS DE INVESTIGACIÓN (responde a TODAS, con datos 2026 y fuentes)

A. IDENTIDAD CENTRALIZADA / SSO para varios MCP self-hosted:
   - ¿Cómo tener UN solo proveedor de identidad (Authorization Server) que todos mis MCP
     confíen, para loguearme UNA vez y que valga para todos los connectors?
   - Compara: (a) mantener un AS propio en FastMCP como emisor central y que los demás MCP sean
     "resource servers" que validan tokens contra él (RemoteAuthProvider / introspección /
     validación JWT en FastMCP — ¿existe y cómo?); (b) un IdP self-hosted dedicado
     (Keycloak, Authentik, Zitadel, Authelia, Ory Hydra, Pocket-ID, Kanidm...) al que apunten
     todos. ¿Cuál es PROPORCIONADO para 1 usuario y N servicios? Trade-offs (peso, mantenimiento,
     features 2FA/passkeys, DCR para claude.ai).
   - ¿claude.ai hace SSO real entre varios connectors que comparten emisor (un login) o cada
     connector repite login? ¿Cómo se comporta con DCR + emisor común?

B. PROTEGER TODAS LAS RUTAS sin romper el MCP:
   - Patrón gateway / reverse-proxy con auth delante de TODO (visor, API, y MCP) que sea
     compatible con el flujo OAuth remoto de claude.ai. ¿Caddy + plugin auth? ¿Authelia/Authentik
     forward-auth con exclusiones para /mcp y las rutas .well-known/authorize/token? ¿Auth a
     nivel de app en cada endpoint? Compara y di cuál no rompe claude.ai.

C. HARDENING DEL LOGIN (1 usuario, proporcionado):
   - Rate-limiting, bloqueo por intentos, CSRF, y 2FA. ¿TOTP vs passkeys/WebAuthn para un login
     propio? ¿Merece la pena WebAuthn con 1 usuario? Gestión de sesión. Qué añade cada IdP del
     bloque A "de fábrica" vs implementarlo a mano en FastMCP.

D. GESTIÓN DE SECRETOS (sacar de texto plano):
   - Opciones proporcionadas para 1 PC Windows + Docker: cifrado en reposo, Windows Credential
     Manager/DPAPI, sops+age, Infisical, HashiCorp Vault (¿overkill?), Docker secrets, .env
     cifrado. Recomienda lo mínimo serio.

E. SEGURIDAD DE TOKENS:
   - Almacén de tokens en reposo (cifrar oauth_store.json / Postgres), TTLs, rotación de refresh,
     revocación. ¿JWT firmados vs tokens opacos para un AS central? Pros/cons para este caso.

F. ROBUSTEZ Y OBSERVABILIDAD:
   - Autoarranque unificado (todo como servicios vs tareas; resiliencia a reinicio), monitorización
     de salud + alertas (servicio caído, túnel caído, caducidad de cert), backups (BD de memoria +
     secretos), y el problema de "reconectar el connector de claude.ai tras reboot". Defensa en
     profundidad y puntos únicos de fallo.

G. ARQUITECTURA RECOMENDADA + MIGRACIÓN:
   - Dado 2 (pronto N) MCP personales en un PC tras túneles Cloudflare, ¿cuál es la arquitectura
     CENTRALIZADA y SEGURA correcta y proporcionada? Dibuja el objetivo (IdP central + gateway +
     hardening + secretos + observabilidad) y da una MIGRACIÓN POR FASES desde el estado actual
     (dos AS propios + rutas que estaban abiertas) SIN romper claude.ai/Claude Code en el camino.

H. CONSOLIDACIÓN DE TÚNELES:
   - ¿Unificar los dos túneles Cloudflare en uno (un servicio/config sirviendo ambos hostnames)
     ayuda o perjudica a seguridad/robustez? Trade-offs (superficie, aislamiento de fallos).

CONSTRAINTS Y PRIORIDADES
- 1 usuario: seguridad PROPORCIONADA, no enterprise por deporte. Evita sobre-ingeniería, pero
  cierra de verdad los agujeros (bloque de hallazgos).
- Debe seguir funcionando con claude.ai (connector remoto OAuth) y Claude Code. La compat con el
  flujo MCP es requisito, no opcional.
- Prioriza self-hosted / open-source / coste cero. Windows + Docker como sustrato.
- Preferencia por REUTILIZAR lo que ya funciona (el AS propio de Naeth podría ser el emisor
  central) frente a reescribir, salvo que un IdP dedicado gane claramente.

FORMATO DEL ENTREGABLE
1. RECOMENDACIÓN de arquitectura (diagrama textual): IdP central + gateway + secretos +
   observabilidad, con la elección concreta de componentes y POR QUÉ para 1 usuario.
2. Tabla comparativa de las opciones de identidad (AS propio central vs Keycloak/Authentik/
   Zitadel/Authelia/Ory/Pocket-ID/Kanidm) con peso, 2FA/passkeys, DCR, mantenimiento.
3. Cómo proteger TODAS las rutas sin romper claude.ai (patrón concreto verificado).
4. Checklist de hardening priorizado (rate-limit, 2FA, secretos, tokens, auditoría) con el "cómo".
5. Plan de robustez/observabilidad (autoarranque, monitor, backup, alertas).
6. MIGRACIÓN POR FASES desde mi estado actual, marcando en cada fase cómo no rompo las conexiones.
7. Consolidación de túneles: recomendación con razones.

RIGOR
- Info de 2026 (el ecosistema MCP/IdP cambia rápido); marca lo no verificado como "⚠ sin
  verificar" y CITA fuentes (docs FastMCP, spec MCP de auth, docs de cada IdP, Cloudflare, issues
  de anthropics sobre MCP+Access). VERIFICA la incompatibilidad Cloudflare Access + claude.ai MCP
  (es la restricción que más condiciona el diseño). No sobre-dimensiones para 1 usuario: cada
  recomendación debe justificar su coste de mantenimiento.
```
