# Investigación (RESULTADO) — Centralización y hardening de dos servidores MCP self-hosted

> Informe completo recibido el 2026-07-07 (respuesta al prompt de `investigacion-seguridad-centralizacion.md`).
> Guardado verbatim para conservar detalles y fuentes. El destilado accionable está en
> `arquitectura-objetivo-mcp.md`; la dirección de sistema modular, en `vision-sistema-modular.md`.

---

# Centralización y hardening de dos servidores MCP self-hosted: decisión de arquitectura y plan de migración (2026)

## TL;DR
- Para 1 usuario que escala a N servidores MCP en un PC Windows, la arquitectura correcta es un IdP central self-hosted dedicado (Pocket-ID como primera opción, Keycloak si necesitas DCR nativo enterprise) que actúa como Authorization Server emisor de JWT, NUNCA delante del `/mcp`, con cada MCP convertido en Resource Server vía FastMCP `RemoteAuthProvider` + `JWTVerifier`; el visor y la API se protegen con un reverse proxy local que hace forward-auth selectivo excluyendo por ruta los endpoints OAuth y `/mcp`.
- La restricción dura está CONFIRMADA con matices: poner Cloudflare Access / Managed OAuth delante de `/mcp` rompe el connector web y móvil de claude.ai (issue #410, cerrada "not planned"), pero la causa de fallo MÁS común y mejor documentada es que el callback autenticado post-token del broker de Anthropic lo bloquea el edge de Cloudflare (Bot Fight Mode / "Block AI training bots" / WAF), no Access en sí (issues #327, #49, #80). La solución no es proteger `/mcp` con proxy-auth, sino hacer allowlist del rango de egress de Anthropic y validar el token EN LA APLICACIÓN.
- Consolida los dos túneles en un solo `cloudflared` como servicio Windows con varios ingress, saca los secretos a SOPS+age (mínimo serio) o Infisical (cuando N crezca), cifra el token store con `FernetEncryptionWrapper`, y añade 2FA vía el IdP (TOTP como mínimo, passkeys si eliges Pocket-ID/Authentik/Authelia). Abajo tienes los dos escenarios completos del conflicto SSO vs compatibilidad.

## Key Findings

### A. La spec de MCP Authorization vigente separa AS y RS (RFC 9728)
La revisión de junio de 2025 de la spec de MCP eliminó los endpoints por defecto. Según Descope ("Diving Into the MCP Authorization Specification"): "the specification called for fallback default endpoints at /authorize, /token, and /register. The June 2025 revision removed this mechanism in favor of mandatory RFC 9728 (Protected Resource Metadata)". Ahora el MCP server es un Resource Server que implementa RFC 9728, devolviendo `401` con `WWW-Authenticate: Bearer resource_metadata="..."` y publicando `/.well-known/oauth-protected-resource` con el campo `authorization_servers`. El AS es una pieza separada que publica RFC 8414 o OIDC Discovery. Esto es exactamente lo que habilita centralizar identidad: varios Resource Servers pueden confiar en UN mismo Authorization Server.
La spec 2025-11-25 añade CIMD (Client ID Metadata Documents) como alternativa recomendada y degrada DCR. Según Den Delimarsky (Anthropic), en "What's New In The 2025-11-25 MCP Authorization Spec": "Dynamic Client Registration is deprecated and retained for backwards compatibility... If you are an implementer, you don't need to support DCR from now on". Esto es central: significa que no estás obligado a soportar DCR si ofreces CIMD, lo que abre la puerta a IdPs sin DCR.

### B. FastMCP 2026 SÍ soporta separar AS de RS
FastMCP introdujo en la v2.11 (PR #1297 y #1346) el patrón que necesitas:
- `TokenVerifier` con dos implementaciones clave: `JWTVerifier` (valida JWT localmente contra un JWKS endpoint, con rotación de claves automática) e `IntrospectionTokenVerifier` (RFC 7662, tokens opacos, validación por red con revocación inmediata).
- `RemoteAuthProvider`: clase base que compone un `TokenVerifier` con los metadatos OAuth, publica `/.well-known/oauth-protected-resource` y hace que el MCP actúe como puro Resource Server que confía en un emisor externo. Se configura con `authorization_servers=[...]` y `resource_server_url=...`.
- `OAuthProxy`: puente que presenta interfaz DCR-compliant a claude.ai mientras usa credenciales pre-registradas contra un IdP que NO soporta DCR (Authentik, Zitadel, Entra). Valida `redirect_uris`, soporta `allowed_client_redirect_uris` con `https://claude.ai/api/mcp/auth_callback`, y desde 2.13 tiene CIMD habilitado por defecto. Defiende contra confused-deputy con pantalla de consentimiento y token CSRF por transacción.
- El `OAuthProvider` (AS propio completo dentro de FastMCP, que es lo que tienes hoy en Naeth y Comfy) sigue soportado, pero los propios maintainers recomiendan no usarlo: "The vast majority of applications should use external identity providers instead" (FastMCP Auth Guide).
FastMCP 2.13 hizo el almacenamiento persistente cifrado por defecto: `FernetEncryptionWrapper` (AES-128-CBC + HMAC-SHA256) envuelve el `AsyncKeyValue` store. Según la doc "Storage Backends" de FastMCP: "Mac/Windows: Keys are auto-managed via system keyring, storage defaults to disk. Suitable only for development and local testing. Linux: Keys are ephemeral, storage defaults to memory". Para producción real ambos parámetros (clave y storage) son obligatorios y hay que envolver el store en `FernetEncryptionWrapper` o los tokens quedan en claro.

### C. La restricción dura: Cloudflare Access rompe claude.ai, PERO la causa raíz habitual es el edge
Confirmado con dos mecanismos DISTINTOS que conviene no mezclar:
1. **Fallo pre-auth con Access / Managed OAuth (issue #410, `anthropics/claude-ai-mcp`, cerrada "not planned"):** el connector web y móvil de claude.ai falla nada más pulsar Connect, sin pantalla de login, mientras Claude Code (CLI) conecta al MISMO URL sin problema. El origen no registra NADA ("Our MCP origin ... logged NOTHING for the failed connector attempts ... the flow never reached our server") porque el fallo está en la capa de pre-autorización entre el connector y Cloudflare Access. El reporter atribuye el fallo a la ausencia del header `WWW-Authenticate` en el `401`. No se encontró comentario citado de staff de Anthropic en esta issue.
2. **Fallo post-token por bloqueo en el edge (issues #327, #49, #80):** el flujo OAuth completo (DCR, `/authorize`, `/token`=200) tiene éxito, pero luego "silencio". En palabras del autor de #327: "Anthropic's broker's authenticated POST to /api/mcp was being dropped at the Cloudflare edge by Bot Fight Mode (server-to-server POST with Authorization: Bearer ..., no browser cookies, no browser fingerprint ... The Worker never ran for that request". La solución verificada fue añadir el rango de IPs de egress de Anthropic (`160.79.104.0/21`) como IP Access Rule con acción Allow. La issue #80 lo confirma: "cloudflare blocked claude web connection to my mcp server and it turned out this was due to my organization having set the Block AI Bots domain rule".
Implicación de diseño: NO se debe poner ningún proxy-auth con redirect (Cloudflare Access, forward-auth de Authelia/Authentik) delante de `/mcp` ni de las rutas `.well-known`, `/authorize`, `/token`, `/register`. El `/mcp` se protege SOLO con validación de token a nivel de aplicación (que es lo que ya hace FastMCP). El visor y la API sí se pueden proteger con forward-auth porque no participan en el handshake OAuth de claude.ai.

### D. Comportamiento real de claude.ai con AS compartido y SSO
- claude.ai soporta tres métodos de registro de cliente (doc oficial "Authentication for connectors"): `oauth_dcr` (DCR), `oauth_cimd` (Client ID Metadata Documents, el preferido para nuevos connectors) y `oauth_anthropic_creds` (Anthropic guarda tus credenciales). "DCR causes Claude to register a new client on every fresh connection, which can result in very large numbers of registered clients on your authorization server. CIMD and Anthropic-held credentials avoid the registration call entirely."
- Cada connector remoto se añade por URL y mantiene su PROPIA sesión OAuth. claude.ai RECHAZA añadir dos connectors con el mismo URL de servidor (issue #178). Con emisor compartido, el usuario hace un flujo de consentimiento por connector: no hay "SSO real" tipo un-solo-login-vale-para-todos en el plano de connectors individuales de un plan personal.
- El SSO real de un-login-para-todos (Enterprise Managed Auth) existe pero es beta para planes Team/Enterprise, no para 1 usuario personal: "you authorize a connector once for your entire organization ... Enterprise-managed auth is available in beta for Team and Enterprise plans".
- Con `oauth_anthropic_creds`, las credenciales están ligadas al AS que las emitió: si migras de AS, hay que avisar a Anthropic por correo antes de cortar. CIMD no tiene esa restricción porque el `client_id` es una URL self-hosted: "a CIMD client_id is a self-hosted URL, so it works against any authorization server that fetches it".
- Nota de token lifecycle (doc oficial, vía sunpeak.ai): "It refreshes proactively up to 5 minutes before token expiry and reactively when it gets a 401 response. You should return RFC 6749-compliant error codes (like invalid_grant)".

### E. Estado de DCR por IdP self-hosted (crítico para elegir)
- **Keycloak:** SÍ soporta DCR (RFC 7591) en `/realms/<realm>/clients-registrations/default`, pero la DCR anónima está DESHABILITADA por defecto. Doc oficial: "By default, there is not any whitelisted host, so anonymous client registration is de-facto disabled" (requiere Trusted Hosts Policy; límite por defecto de clientes anónimos). Versiones recientes añaden CIMD como preview.
- **Authentik:** NO tiene endpoint DCR nativo (feature request abierta `goauthentik/authentik` #8751); requiere clientes estáticos/pre-registrados. Confirmado por la propia issue del proyecto. (Hay blogs secundarios que sugieren lo contrario; se consideran inexactos y prevalece la fuente primaria.)
- **Zitadel:** NO soporta DCR (issue `zitadel/zitadel` #9810 abierta; discusión #4349 con el maintainer: "Currently we have no plan to implement dynamic client registration, but we would be open for PRs").
- **Pocket-ID:** estado DCR SIN VERIFICAR; diseño "simple, passkey-only, config manual de clientes", casi seguro sin DCR pero no confirmado por fuente.
- **Authelia:** es OpenID Certified (mayo 2025) como proveedor OIDC ligero, pero es principalmente un forward-auth gateway; no consta soporte DCR.
Consecuencia: como claude.ai ya soporta CIMD y `oauth_anthropic_creds`, incluso un IdP sin DCR es viable si lo envuelves con FastMCP `OAuthProxy` (que aporta la capa DCR/CIMD hacia claude.ai) o publicas CIMD. Solo Keycloak da DCR anónima nativa, y aun así hay que activarla.

## Details

### 2. Tabla comparativa de opciones de identidad (1 usuario, escala a N)
| Opción | RAM idle aprox. | 2FA / passkeys | DCR nativo | Mantenimiento | Veredicto para este caso |
|---|---|---|---|---|---|
| AS propio en FastMCP (`OAuthProvider`), lo actual | mínima (dentro del proceso MCP) | implementado a mano (hoy no hay) | sí (lo implementas tú) | alto: reimplementas PKCE, rotación JWK, introspección por cada MCP | No escala a N; los maintainers desaconsejan |
| AS propio central en 1 MCP + resto como RS (`RemoteAuthProvider`) | mínima | a mano | sí | medio: 1 AS que mantener, N verificadores JWT triviales | Válido y barato, pero sigues manteniendo login/2FA a mano |
| **Pocket-ID** | muy baja (Go, sin Redis) | passkeys/WebAuthn nativo (passwordless) | sin verificar (probable no) | muy bajo | **Mejor relación esfuerzo/seguridad para 1 usuario**; la falta de DCR se cubre con OAuthProxy/CIMD |
| Authelia | ~20-25 MB idle (sitio oficial: "Authelia itself during normal operation uses between 20-25MB of RAM"; imagen <20 MB) | TOTP, WebAuthn/passkeys, Duo | no | bajo (1 binario, 1 YAML) | Excelente como forward-auth del visor/API; flojo como AS para claude.ai |
| Authentik | ~250-350 MB con PostgreSQL, sin Redis desde release 2025.10; ~150-200 MB idle (authhost.de "Authentik vs. Authelia 2026") | TOTP, WebAuthn, acceso condicional, flows visuales | no (#8751) | medio-alto (varios contenedores) | Potente pero pesado; sin DCR necesita OAuthProxy |
| Zitadel | media | passkeys nativo | no (#9810) | medio | Sin DCR; poco aporta frente a Pocket-ID aquí |
| Keycloak | 1-2 GB (JVM; Red Hat recomienda al menos 1.250 MB para configuración base; 2-4 GB en producción) | TOTP, WebAuthn, políticas AAGUID | sí (anónima off por defecto) | alto (realms, mappers, JVM, updates con breaking changes) | Único con DCR nativa, pero sobredimensionado para 1 usuario |
| Ory Hydra | media | delega login/consent a tu UI | sí | alto (Hydra no trae UI de login) | Demasiado montaje para 1 usuario |
Recomendación de identidad: **Pocket-ID como IdP central dedicado** (contenedor extra) por passkeys de fábrica, footprint mínimo y simplicidad, combinado con **FastMCP `OAuthProxy` o CIMD** en cada MCP para presentar la interfaz que claude.ai espera. Si en algún momento necesitas DCR nativa pura y features enterprise, la alternativa es **Keycloak**, asumiendo su coste de RAM y mantenimiento.

### 1. Arquitectura recomendada (diagrama textual)
```
                    Internet
                       |
              Cloudflare edge  (allowlist del rango egress de Anthropic
                       |        160.79.104.0/21; Bot Fight Mode /
                       |        "Block AI bots" DESACTIVADO en hostnames MCP)
                       |
        UN cloudflared (servicio Windows) con varios ingress:
          auth.dominio      -> 127.0.0.1:9000  (Pocket-ID, IdP central)
          naeth.dominio     -> 127.0.0.1:8800  (gateway Caddy)
          comfy.dominio     -> 127.0.0.1:9100  (gateway Caddy)
                       |
             Caddy / reverse proxy local (forward-auth SELECTIVO)
                       |
   +-------------------+-----------------------------+
   |                   |                             |
  /mcp  (SIN proxy-auth; validación JWT en la app)   |
  .well-known/*, /authorize, /token, /register (SIN proxy-auth)
   |                                                 |
  Visor / y API /api/*  -> forward-auth contra Pocket-ID (protegido)
   |
  Servidores MCP (FastMCP RemoteAuthProvider + JWTVerifier),
  cada uno Resource Server que valida JWT emitidos por Pocket-ID
   |
  Postgres+pgvector (Naeth), ComfyUI (Comfy), token store cifrado (Fernet)
```
Claves del diseño:
- El IdP central (Pocket-ID) es el único que hace login y 2FA. Emite JWT firmados.
- Cada MCP es Resource Server: valida el JWT contra el JWKS de Pocket-ID con `JWTVerifier`. No reimplementa login.
- Para claude.ai, cada MCP expone la interfaz OAuth vía `OAuthProxy` (DCR/CIMD hacia el connector) delegando la autenticación real en Pocket-ID.
- `/mcp` y las rutas OAuth NUNCA pasan por forward-auth. El visor y `/api/*` SÍ.

### 3. Cómo proteger TODAS las rutas sin romper claude.ai (patrón verificado)
Patrón forward-auth selectivo por ruta en el reverse proxy LOCAL (Caddy o nginx), NO en el edge:
- Rutas que quedan FUERA del proxy-auth (protegidas solo por validación de token en la app FastMCP): `/mcp`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/.well-known/openid-configuration`, `/authorize`, `/token`, `/register`.
- Rutas que SÍ pasan por forward-auth contra el IdP: `/` (visor) y `/api/*` (incluidas escrituras POST/DELETE).
- En Authelia se implementa con `access_control` y regla `bypass` por `resources` (regex de ruta) para las rutas OAuth/MCP, y `one_factor`/`two_factor` para visor y API. Ejemplo de la doc: `resources: ["^/api([/?].*)?$"]` con `policy: bypass`. Ojo: una regla `bypass` no puede usar criterios de subject; hay que poner primero las bypass ("if you have two identical rules, and one of them has a subject based reliant criteria, and the other one is a bypass rule then the bypass rule should generally come first").
- En Authentik forward-auth (modo single-application) se usa el campo "Unauthenticated Paths" (regex por ruta): "To allow unauthenticated requests to specific paths or URLs, use the Unauthenticated Paths or Unauthenticated URLs field on the proxy provider. Each new line is interpreted as a regular expression". (Precaución: issue #6563 muestra bugs de matching cuando varios providers comparten dominio; en single-application mode por subdominio es fiable.)
- Cierre del agujero crítico actual de Naeth: el visor y `/api` quedaban abiertos por el túnel; el forward-auth selectivo los cierra de forma definitiva sustituyendo el parche del 404 en el edge, sin tocar `/mcp`.
Verificación de que no rompe claude.ai: el handshake OAuth de claude.ai solo toca `/mcp` y las rutas OAuth, todas excluidas del forward-auth. Además hay que desactivar Bot Fight Mode / "Block AI training bots" en los hostnames MCP y hacer allowlist del rango de egress de Anthropic (`160.79.104.0/21`), que es la causa raíz de la mayoría de fallos "token=200 luego silencio". Smoke test con curl antes de conectar: `/mcp` sin token debe dar `401` con `WWW-Authenticate`; `.well-known/*` debe dar `200`; `/register` debe dar `201`.

### 4. Checklist de hardening priorizado
1. **Cerrar el agujero de rutas abiertas (CRÍTICO, ya):** forward-auth selectivo para `/` y `/api/*` de Naeth (arriba). Sustituye el parche 404 en el edge.
2. **2FA:** habilitar en el IdP central. TOTP como mínimo; passkeys/WebAuthn si eliges Pocket-ID (passwordless nativo), Authentik o Authelia. Para 1 usuario WebAuthn merece la pena porque elimina el factor contraseña por completo y es phishing-resistant por diseño; TOTP es el mínimo aceptable.
3. **Rate-limit y bloqueo por intentos:** lo aporta el IdP de fábrica (Authelia tiene login regulation con bloqueo de cuenta; Pocket-ID/Keycloak/Authentik traen límites). Evita reimplementarlo en FastMCP. Complementar con fail2ban leyendo los logs de auth (hay filtro de Authelia publicado con `failregex` para intentos 1FA/TOTP/Duo fallidos).
4. **CSRF:** lo maneja el IdP en su login; FastMCP `OAuthProxy` ya incluye protección de confused-deputy con pantalla de consentimiento y token CSRF en la transacción.
5. **Secretos fuera de texto plano:** ver sección de secretos.
6. **Tokens en reposo cifrados:** `FernetEncryptionWrapper` sobre el store (por defecto en 2.13, pero fija clave+storage explícitos en producción).
7. **Auditoría/alertas:** logs estructurados de eventos de auth centralizados; alertar de logins y de fallos ("auth events are a security goldmine").

### Gestión de secretos (sacar de texto plano)
Para 1 PC Windows + Docker, de menos a más:
- **Mínimo serio: SOPS + age.** Cifra `.env`, `credentials.env`, `oauth_store.json` y credenciales de Postgres en reposo; descifra en memoria al arrancar. Cero infraestructura (un binario), MPL 2.0 vía CNCF. Es el "no-brainer" para este caso ("30 minutes of learning gets your plaintext secrets migrated to encrypted storage"). La clave age se protege con Windows DPAPI / Credential Manager.
- **Windows DPAPI / Credential Manager:** para la clave maestra de age y para secretos que consume directamente un proceso Windows nativo (cloudflared).
- **Docker secrets:** para inyectar en los contenedores sin `.env` en claro.
- **Infisical (self-hosted, MIT):** si quieres UI, rotación automática, referencias entre proyectos y auditoría; un docker-compose (Postgres+Redis). Es el siguiente escalón cuando N crece.
- **HashiCorp Vault / OpenBao:** overkill para 1 usuario; Vault además es BSL. Descartado salvo crecimiento grande (OpenBao si necesitas licencia limpia).
Recomendación: SOPS+age ahora; Infisical cuando tengas 4-5 MCP y quieras rotación centralizada.

### 5 (parte). Seguridad de tokens
- **Cifrado en reposo:** `FernetEncryptionWrapper` sobre el `AsyncKeyValue` store (Naeth debe migrar `oauth_store.json` a store cifrado; Comfy igual con su JSON). En Postgres, cifrar columnas sensibles.
- **TTLs y rotación:** access tokens cortos. La doc del connector M365 de Anthropic describe "an access token that expires after 1 hour and a refresh token for longer-term access" (issue #65036 de `anthropics/claude-code`: "access_token (~1h lifetime) + refresh_token (typically days to months)"). Rota refresh tokens para clientes públicos (DCR/CIMD) por requisito de OAuth 2.1. Cuidado con el comportamiento de FastMCP donde el `TokenStorageAdapter` cliente usa "a 1-year TTL for stored tokens, regardless of the access token's expires_in value" (DeepWiki), y con el bug de servidor donde el TTL del store no seguía la expiración del refresh token (issue #2406): fija el TTL del store >= expiración del refresh.
- **JWT firmados vs tokens opacos para el AS central:** para este caso, **JWT firmados** (validación local en cada RS vía JWKS, sin llamada de red por request, escala a N sin acoplar) salvo que necesites revocación inmediata, en cuyo caso tokens opacos + introspección (`IntrospectionTokenVerifier`). Compromiso razonable: JWT de vida corta (revocación implícita por expiración rápida) para no montar introspección.
- **Revocación:** al desconectar un connector, Anthropic borra sus tokens pero los del IdP siguen válidos hasta expirar ("tokens at your identity provider remain valid until they expire ... call your identity provider's token revocation endpoint separately").

### 6 (parte). Robustez y observabilidad
- **Autoarranque unificado:** todo como servicios Windows (no mezcla servicio+tarea programada). `cloudflared` ya es servicio; convierte Comfy (hoy tarea programada) y los MCP a servicios (NSSM o `sc create`, o contenedores Docker con `restart: always`). Docker Desktop configurado para arrancar al inicio.
- **Monitorización de salud:** uptime checks sobre `/health` de cada MCP, del IdP (Pocket-ID `/healthz`, Keycloak `/health/ready`, Authentik `/-/health/live/`) y del túnel; alertar de servicio caído, túnel caído y caducidad de certificado. Cloudflare Tunnel permite health checks vía HTTPS monitor sobre un endpoint fijo.
- **Backups:** Postgres de Naeth (dump nightly + prueba de restore trimestral), secretos cifrados (repo SOPS), y la BD del IdP (la pieza más crítica: si se pierde, todos los MCP pierden auth de golpe). Backup de la clave age offline.
- **Reconexión del connector de claude.ai tras reboot:** el origen del problema suele ser (a) el MCP no ha arrancado aún cuando el broker reintenta, o (b) el token store no persiste. Con autoarranque como servicio + store persistente cifrado + orden de arranque (IdP antes que MCP, túnel al final), el connector debería reconectar solo. Si persiste, puede ser el bug de surfacing de tools de claude.ai (issue #476), no tuyo.
- **Defensa en profundidad y SPOF:** el IdP central es el nuevo punto único de fallo de autenticación; mitígalo con backup probado y un segundo factor de recuperación offline. El túnel único es otro SPOF (ver H).

### H. Consolidación de túneles
Recomendación: **consolidar en UN `cloudflared` (servicio Windows) con varios ingress rules** (un hostname por servicio, regla catch-all `http_status:404` al final). Cloudflared soporta múltiples hostnames-a-servicios en un solo config YAML ("You can publish multiple applications on a single tunnel").
- A favor: un solo mecanismo de autoarranque (resuelve la inconsistencia servicio vs tarea), menos superficie de gestión, un solo punto de configuración/observabilidad, replicas para HA si hace falta.
- En contra: un fallo del proceso `cloudflared` tira todos los hostnames a la vez (menor aislamiento de fallos). Para 1 PC y 1 usuario, la simplicidad y consistencia de autoarranque pesan más que el aislamiento; el riesgo se mitiga con `restart: always`/servicio y monitorización. **Veredicto: consolidar.**

### Nota sobre "MCP gateways" open-source
Existe un ecosistema creciente de MCP gateways en 2026 (MCPJungle, IBM ContextForge, Microsoft mcp-gateway, Octelium, docker-mcp-gateway con MCPHub+Caddy, Pomerium, etc.). Para tu caso (1 usuario, N pequeño) NO recomiendo adoptar un gateway MCP dedicado como pieza central: la mayoría están orientados a Kubernetes/enterprise (multi-tenant, RBAC, federación) y añaden mantenimiento sin resolver mejor tu problema real, que es identidad centralizada + protección de rutas. Tu combinación FastMCP RemoteAuthProvider + Pocket-ID + Caddy forward-auth cubre lo mismo con menos superficie. Reevalúa un gateway (p.ej. ContextForge, Apache 2.0) solo si superas ~5-8 MCP y quieres discovery/agregación de tools bajo un único endpoint.

## Recommendations

### Los dos escenarios del conflicto SSO vs compatibilidad claude.ai (con trade-off explícito)
**Escenario 1 - Prioriza NO romper claude.ai (recomendado para empezar):**
- Cada MCP sigue exponiendo su propio endpoint OAuth vía FastMCP (`OAuthProxy` delegando en Pocket-ID, o el `OAuthProvider` actual refactorizado a `RemoteAuthProvider` que valida contra Pocket-ID). claude.ai ve un AS por connector, con DCR/CIMD que sabemos que funciona.
- Trade-off: no hay "un solo login" entre connectors en claude.ai (harás consentimiento por connector), pero la identidad, el 2FA, el rate-limit y los secretos SÍ están centralizados en Pocket-ID. Es SSO "de backend" (un solo almacén de identidad) aunque el front de claude.ai pida consentir cada connector. Riesgo cero de romper el handshake.
**Escenario 2 - Prioriza SSO real aunque introduzca fricción en claude.ai:**
- Un único AS central (Keycloak con DCR habilitada, o Pocket-ID+OAuthProxy) como emisor compartido; todos los MCP como Resource Servers que validan JWT de ese emisor. Un solo login en el IdP vale para obtener tokens de todos.
- Trade-off/riesgo: claude.ai usa la primera entrada de `authorization_servers` y no cae a las siguientes ("Claude uses the first entry and does not fall back to later entries"); con emisor común y DCR, cada connector puede seguir registrando su cliente, y sigue sin haber "un clic conecta todos" en el plano personal (eso es Enterprise Managed Auth, beta Team/Enterprise). Si el AS central queda detrás de algo que intercepte con redirect, rompes claude.ai. Más elegante conceptualmente, pero más superficie de fallo y sin ganancia real de un-solo-login en claude.ai personal.
Conclusión: para 1 usuario personal, el Escenario 1 da el 90% del beneficio (identidad, 2FA, secretos y tokens centralizados) con el mínimo riesgo. Reserva el Escenario 2 (Keycloak DCR) para cuando quieras un AS enterprise puro o pases a plan Team/Enterprise con Managed Auth.

### 6. Plan de migración por fases (sin romper claude.ai/Claude Code)
**Fase 0 - Preparación (sin tocar producción):**
- Snapshot/backup de Postgres, `oauth_store.json` y `.env` actuales. Documenta los `client_id` que claude.ai tiene registrados.
- Actualiza FastMCP a 2.13+ (token store cifrado por defecto) en un entorno de pruebas.
- Cómo no se rompe: no se toca nada en vivo.
**Fase 1 - Hardening inmediato de lo existente (CRÍTICO):**
- Mete forward-auth selectivo (Caddy/Authelia) delante del visor y `/api/*` de Naeth, excluyendo `/mcp` y `.well-known/*`, `/authorize`, `/token`, `/register`. Sustituye el parche 404.
- Desactiva Bot Fight Mode / "Block AI bots" en los hostnames MCP y añade allowlist del rango de egress de Anthropic (`160.79.104.0/21`).
- Cifra `oauth_store.json` (Fernet) y saca secretos a SOPS+age.
- Cómo no se rompe: `/mcp` y las rutas OAuth quedan intactas; solo cambia la protección de visor/API. Verifica el handshake con curl.
**Fase 2 - Desplegar el IdP central (aditivo):**
- Levanta Pocket-ID como contenedor (`auth.dominio`), configura tu usuario con passkey + TOTP de respaldo.
- Añade el hostname al `cloudflared` consolidado.
- Cómo no se rompe: los MCP siguen con su auth actual; el IdP aún no se usa.
**Fase 3 - Migrar UN MCP a Resource Server (empieza por Comfy, el menos crítico):**
- Cambia Comfy a `RemoteAuthProvider`+`JWTVerifier` apuntando al JWKS de Pocket-ID; si claude.ai necesita DCR/CIMD, envuélvelo en `OAuthProxy` con `allowed_client_redirect_uris=["https://claude.ai/api/mcp/auth_callback","http://localhost:*","http://127.0.0.1:*"]` (esto último es necesario porque Claude Code usa loopback en puerto efímero).
- Reconecta el connector de Comfy en claude.ai (será un re-consent, esperado) y verifica en Claude Code.
- Cómo no se rompe: Naeth intacto; si Comfy falla, rollback a su AS propio sin afectar a Naeth.
**Fase 4 - Migrar Naeth igual:**
- Mismo patrón. Migra `oauth_store.json` al store cifrado. Postgres de memoria intacto.
- Cómo no se rompe: rollback disponible; el visor/API ya estaban protegidos desde Fase 1.
**Fase 5 - Consolidar túneles y autoarranque:**
- Unifica los dos `cloudflared` en uno solo con varios ingress; convierte Comfy y MCP a servicios Windows / contenedores `restart: always`. Orden de arranque: IdP -> MCP -> túnel.
- Añade monitorización de salud y alertas; automatiza backups.
- Cómo no se rompe: prueba el nuevo túnel como replica antes de parar el viejo (cloudflared soporta replicas para propagación con downtime mínimo).
**Fase 6 - Escala a N:**
- Cada nuevo MCP nace como Resource Server contra Pocket-ID + `OAuthProxy`, ingress nuevo en el túnel, servicio con autoarranque, secretos en SOPS. Plantilla repetible.

### Umbrales que cambiarían las recomendaciones
- Si pasas a plan Team/Enterprise: activa Enterprise Managed Auth para SSO real de un clic (Escenario 2 con Keycloak/Pocket-ID).
- Si N > ~5 MCP y quieres rotación de secretos centralizada: migra de SOPS a Infisical.
- Si N > ~8 MCP y quieres agregación/discovery de tools bajo un endpoint: evalúa un MCP gateway (ContextForge).
- Si necesitas revocación inmediata de tokens: pasa de JWT a tokens opacos + introspección.
- Si necesitas DCR nativa pura sin OAuthProxy: cambia Pocket-ID por Keycloak (asumiendo RAM/mantenimiento).

## Plan de BENCHMARK / verificación
(No aplica a este informe; ver el de imágenes.)

## Caveats
- claude.ai personal NO ofrece "un solo login para todos los connectors": el SSO de un clic es Enterprise Managed Auth (beta, Team/Enterprise). Cualquier promesa de SSO total en plano personal es incorrecta.
- El estado de DCR de Pocket-ID está SIN VERIFICAR; asumo que no lo tiene y lo cubro con `OAuthProxy`/CIMD. Verifícalo antes de comprometerte con esa pieza.
- Las issues #410 y #327 se cerraron como "not planned": no hay fix oficial de Anthropic; las soluciones son del lado del usuario (allowlist de IPs del edge, desactivar Bot Fight Mode). No se encontró comentario citado de staff de Anthropic en #410.
- Hay fuentes secundarias que afirman que Authentik soporta DCR; la issue del propio proyecto (#8751) dice que no. Prevalece la fuente primaria; verifica en tu versión concreta.
- Existe un bug abierto (issue #476) en el que claude.ai web completa el handshake pero no expone las tools del connector al modelo, mientras ChatGPT y Claude Code sí; es del lado de claude.ai, no de tu servidor. Tenerlo presente al diagnosticar.
- Los números de RAM de los IdP son aproximados y de fuentes de 2026 (authhost.de, sitio oficial de Authelia, Red Hat para Keycloak); confírmalos en tu hardware.
- La incompatibilidad Cloudflare Access + claude.ai tiene dos mecanismos distintos (fallo pre-auth en la capa Access vs. bloqueo post-token en el edge WAF). El diseño propuesto evita ambos al no poner proxy-auth con redirect delante de `/mcp` y al hacer allowlist del egress de Anthropic; si en el futuro Anthropic corrige el connector para Access, podrías reconsiderar, pero a julio de 2026 no hay fix confirmado.
