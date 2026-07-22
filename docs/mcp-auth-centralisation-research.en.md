# Research (RESULT): Centralisation and hardening of two self-hosted MCP servers

> Full report received on 2026-07-07 (an answer to the prompt in `investigacion-seguridad-centralizacion.md`).
> This is a commissioned research report, saved verbatim exactly as it was received, not prose written by
> this repository's author. It is kept unedited to preserve its details and sources. The actionable
> distillate is in `arquitectura-objetivo-mcp.md`; the modular-system direction, in `vision-sistema-modular.md`.

---

# Centralisation and hardening of two self-hosted MCP servers: architecture decision and migration plan (2026)

## TL;DR
- For 1 user scaling to N MCP servers on a Windows PC, the correct architecture is a dedicated self-hosted central IdP (Pocket-ID as first choice, Keycloak if you need native enterprise DCR) acting as a JWT-issuing Authorization Server, NEVER in front of `/mcp`, with each MCP turned into a Resource Server via FastMCP `RemoteAuthProvider` + `JWTVerifier`; the viewer and the API are protected with a local reverse proxy doing selective forward-auth that excludes the OAuth endpoints and `/mcp` by path.
- The hard constraint is CONFIRMED, with nuances: putting Cloudflare Access / Managed OAuth in front of `/mcp` breaks the claude.ai web and mobile connector (issue #410, closed as "not planned"), but the MOST common and best documented failure cause is that Anthropic's broker's authenticated post-token callback gets blocked at the Cloudflare edge (Bot Fight Mode / "Block AI training bots" / WAF), not Access itself (issues #327, #49, #80). The fix is not to protect `/mcp` with proxy-auth, but to allowlist Anthropic's egress range and validate the token IN THE APPLICATION.
- Consolidate the two tunnels into a single `cloudflared` running as a Windows service with several ingress rules, move secrets out to SOPS+age (the serious minimum) or Infisical (once N grows), encrypt the token store with `FernetEncryptionWrapper`, and add 2FA via the IdP (TOTP at minimum, passkeys if you pick Pocket-ID/Authentik/Authelia). Below you have the two full scenarios of the SSO vs compatibility conflict.

## Key Findings

### A. The current MCP Authorization spec separates AS and RS (RFC 9728)
The June 2025 revision of the MCP spec removed the default endpoints. According to Descope ("Diving Into the MCP Authorization Specification"): "the specification called for fallback default endpoints at /authorize, /token, and /register. The June 2025 revision removed this mechanism in favor of mandatory RFC 9728 (Protected Resource Metadata)". The MCP server is now a Resource Server implementing RFC 9728, returning `401` with `WWW-Authenticate: Bearer resource_metadata="..."` and publishing `/.well-known/oauth-protected-resource` with the `authorization_servers` field. The AS is a separate piece that publishes RFC 8414 or OIDC Discovery. This is exactly what makes centralising identity possible: several Resource Servers can trust ONE single Authorization Server.
The 2025-11-25 spec adds CIMD (Client ID Metadata Documents) as the recommended alternative and downgrades DCR. According to Den Delimarsky (Anthropic), in "What's New In The 2025-11-25 MCP Authorization Spec": "Dynamic Client Registration is deprecated and retained for backwards compatibility... If you are an implementer, you don't need to support DCR from now on". This is central: it means you are not required to support DCR if you offer CIMD, which opens the door to IdPs without DCR.

### B. FastMCP 2026 DOES support separating AS from RS
FastMCP introduced in v2.11 (PR #1297 and #1346) the pattern you need:
- `TokenVerifier` with two key implementations: `JWTVerifier` (validates JWTs locally against a JWKS endpoint, with automatic key rotation) and `IntrospectionTokenVerifier` (RFC 7662, opaque tokens, network validation with immediate revocation).
- `RemoteAuthProvider`: base class that composes a `TokenVerifier` with the OAuth metadata, publishes `/.well-known/oauth-protected-resource` and makes the MCP act as a pure Resource Server trusting an external issuer. It is configured with `authorization_servers=[...]` and `resource_server_url=...`.
- `OAuthProxy`: bridge that presents a DCR-compliant interface to claude.ai while using pre-registered credentials against an IdP that does NOT support DCR (Authentik, Zitadel, Entra). It validates `redirect_uris`, supports `allowed_client_redirect_uris` with `https://claude.ai/api/mcp/auth_callback`, and since 2.13 has CIMD enabled by default. It defends against confused-deputy attacks with a consent screen and a per-transaction CSRF token.
- `OAuthProvider` (a full AS of your own inside FastMCP, which is what you have today in Naeth and Comfy) is still supported, but the maintainers themselves recommend against using it: "The vast majority of applications should use external identity providers instead" (FastMCP Auth Guide).
FastMCP 2.13 made encrypted persistent storage the default: `FernetEncryptionWrapper` (AES-128-CBC + HMAC-SHA256) wraps the `AsyncKeyValue` store. According to FastMCP's "Storage Backends" documentation: "Mac/Windows: Keys are auto-managed via system keyring, storage defaults to disk. Suitable only for development and local testing. Linux: Keys are ephemeral, storage defaults to memory". For real production both parameters (key and storage) are mandatory, and you have to wrap the store in `FernetEncryptionWrapper` or the tokens end up in the clear.

### C. The hard constraint: Cloudflare Access breaks claude.ai, BUT the usual root cause is the edge
Confirmed with two DIFFERENT mechanisms that are worth not conflating:
1. **Pre-auth failure with Access / Managed OAuth (issue #410, `anthropics/claude-ai-mcp`, closed as "not planned"):** the claude.ai web and mobile connector fails as soon as you hit Connect, with no login screen, while Claude Code (CLI) connects to the SAME URL without trouble. The origin logs NOTHING ("Our MCP origin ... logged NOTHING for the failed connector attempts ... the flow never reached our server") because the failure sits in the pre-authorisation layer between the connector and Cloudflare Access. The reporter attributes the failure to the absence of the `WWW-Authenticate` header on the `401`. No quoted comment from Anthropic staff was found in this issue.
2. **Post-token failure due to a block at the edge (issues #327, #49, #80):** the full OAuth flow (DCR, `/authorize`, `/token`=200) succeeds, but then "silence". In the words of the author of #327: "Anthropic's broker's authenticated POST to /api/mcp was being dropped at the Cloudflare edge by Bot Fight Mode (server-to-server POST with Authorization: Bearer ..., no browser cookies, no browser fingerprint ... The Worker never ran for that request". The verified fix was adding Anthropic's egress IP range (`160.79.104.0/21`) as an IP Access Rule with the Allow action. Issue #80 confirms it: "cloudflare blocked claude web connection to my mcp server and it turned out this was due to my organization having set the Block AI Bots domain rule".
Design implication: you must NOT put any redirect-based proxy-auth (Cloudflare Access, Authelia/Authentik forward-auth) in front of `/mcp` or of the `.well-known`, `/authorize`, `/token`, `/register` routes. `/mcp` is protected ONLY with application-level token validation (which is what FastMCP already does). The viewer and the API can be protected with forward-auth, because they do not take part in the claude.ai OAuth handshake.

### D. Real claude.ai behaviour with a shared AS and SSO
- claude.ai supports three client registration methods (official doc "Authentication for connectors"): `oauth_dcr` (DCR), `oauth_cimd` (Client ID Metadata Documents, the preferred one for new connectors) and `oauth_anthropic_creds` (Anthropic stores your credentials). "DCR causes Claude to register a new client on every fresh connection, which can result in very large numbers of registered clients on your authorization server. CIMD and Anthropic-held credentials avoid the registration call entirely."
- Every remote connector is added by URL and keeps its OWN OAuth session. claude.ai REFUSES to add two connectors with the same server URL (issue #178). With a shared issuer, the user goes through one consent flow per connector: there is no "real SSO" of the one-login-covers-everything kind at the level of individual connectors on a personal plan.
- Real one-login-for-everything SSO (Enterprise Managed Auth) does exist, but it is in beta for Team/Enterprise plans, not for 1 personal user: "you authorize a connector once for your entire organization ... Enterprise-managed auth is available in beta for Team and Enterprise plans".
- With `oauth_anthropic_creds`, the credentials are tied to the AS that issued them: if you migrate AS, you have to notify Anthropic by email before cutting over. CIMD does not have that restriction, because the `client_id` is a self-hosted URL: "a CIMD client_id is a self-hosted URL, so it works against any authorization server that fetches it".
- Token lifecycle note (official doc, via sunpeak.ai): "It refreshes proactively up to 5 minutes before token expiry and reactively when it gets a 401 response. You should return RFC 6749-compliant error codes (like invalid_grant)".

### E. DCR status per self-hosted IdP (critical for the choice)
- **Keycloak:** DOES support DCR (RFC 7591) at `/realms/<realm>/clients-registrations/default`, but anonymous DCR is DISABLED by default. Official doc: "By default, there is not any whitelisted host, so anonymous client registration is de-facto disabled" (it requires a Trusted Hosts Policy; there is a default cap on anonymous clients). Recent versions add CIMD as a preview.
- **Authentik:** does NOT have a native DCR endpoint (open feature request `goauthentik/authentik` #8751); it requires static/pre-registered clients. Confirmed by the project's own issue. (There are secondary blogs suggesting otherwise; they are considered inaccurate and the primary source prevails.)
- **Zitadel:** does NOT support DCR (issue `zitadel/zitadel` #9810 open; discussion #4349 with the maintainer: "Currently we have no plan to implement dynamic client registration, but we would be open for PRs").
- **Pocket-ID:** DCR status UNVERIFIED; the design is "simple, passkey-only, manual client configuration", almost certainly without DCR but not confirmed by a source.
- **Authelia:** it is OpenID Certified (May 2025) as a lightweight OIDC provider, but it is primarily a forward-auth gateway; no DCR support is on record.
Consequence: since claude.ai already supports CIMD and `oauth_anthropic_creds`, even an IdP without DCR is viable if you wrap it with FastMCP `OAuthProxy` (which provides the DCR/CIMD layer facing claude.ai) or publish CIMD. Only Keycloak gives you native anonymous DCR, and even there you have to turn it on.

## Details

### 2. Comparison table of identity options (1 user, scaling to N)
| Option | Approx. idle RAM | 2FA / passkeys | Native DCR | Maintenance | Verdict for this case |
|---|---|---|---|---|---|
| Own AS in FastMCP (`OAuthProvider`), the current setup | minimal (inside the MCP process) | hand-rolled (none today) | yes (you implement it) | high: you reimplement PKCE, JWK rotation and introspection for every MCP | Does not scale to N; the maintainers advise against it |
| Own central AS in 1 MCP + the rest as RS (`RemoteAuthProvider`) | minimal | hand-rolled | yes | medium: 1 AS to maintain, N trivial JWT verifiers | Valid and cheap, but you still maintain login/2FA by hand |
| **Pocket-ID** | very low (Go, no Redis) | native passkeys/WebAuthn (passwordless) | unverified (probably not) | very low | **Best effort/security ratio for 1 user**; the lack of DCR is covered with OAuthProxy/CIMD |
| Authelia | ~20-25 MB idle (official site: "Authelia itself during normal operation uses between 20-25MB of RAM"; image <20 MB) | TOTP, WebAuthn/passkeys, Duo | no | low (1 binary, 1 YAML) | Excellent as forward-auth for the viewer/API; weak as an AS for claude.ai |
| Authentik | ~250-350 MB with PostgreSQL, no Redis since release 2025.10; ~150-200 MB idle (authhost.de "Authentik vs. Authelia 2026") | TOTP, WebAuthn, conditional access, visual flows | no (#8751) | medium-high (several containers) | Powerful but heavy; without DCR it needs OAuthProxy |
| Zitadel | medium | native passkeys | no (#9810) | medium | No DCR; it adds little over Pocket-ID here |
| Keycloak | 1-2 GB (JVM; Red Hat recommends at least 1,250 MB for a base configuration; 2-4 GB in production) | TOTP, WebAuthn, AAGUID policies | yes (anonymous off by default) | high (realms, mappers, JVM, updates with breaking changes) | The only one with native DCR, but oversized for 1 user |
| Ory Hydra | medium | delegates login/consent to your own UI | yes | high (Hydra ships no login UI) | Too much assembly for 1 user |
Identity recommendation: **Pocket-ID as a dedicated central IdP** (one extra container) for its out-of-the-box passkeys, minimal footprint and simplicity, combined with **FastMCP `OAuthProxy` or CIMD** on each MCP to present the interface claude.ai expects. If at some point you need pure native DCR and enterprise features, the alternative is **Keycloak**, accepting its RAM and maintenance cost.

### 1. Recommended architecture (text diagram)
```
                    Internet
                       |
              Cloudflare edge  (allowlist Anthropic's egress range
                       |        160.79.104.0/21; Bot Fight Mode /
                       |        "Block AI bots" DISABLED on MCP hostnames)
                       |
        ONE cloudflared (Windows service) with several ingress rules:
          auth.domain       -> 127.0.0.1:9000  (Pocket-ID, central IdP)
          naeth.domain      -> 127.0.0.1:8800  (Caddy gateway)
          comfy.domain      -> 127.0.0.1:9100  (Caddy gateway)
                       |
             Caddy / local reverse proxy (SELECTIVE forward-auth)
                       |
   +-------------------+-----------------------------+
   |                   |                             |
  /mcp  (NO proxy-auth; JWT validated in the app)    |
  .well-known/*, /authorize, /token, /register (NO proxy-auth)
   |                                                 |
  Viewer / and API /api/*  -> forward-auth against Pocket-ID (protected)
   |
  MCP servers (FastMCP RemoteAuthProvider + JWTVerifier),
  each one a Resource Server validating JWTs issued by Pocket-ID
   |
  Postgres+pgvector (Naeth), ComfyUI (Comfy), encrypted token store (Fernet)
```
Design keys:
- The central IdP (Pocket-ID) is the only piece doing login and 2FA. It issues signed JWTs.
- Each MCP is a Resource Server: it validates the JWT against Pocket-ID's JWKS with `JWTVerifier`. It does not reimplement login.
- For claude.ai, each MCP exposes the OAuth interface via `OAuthProxy` (DCR/CIMD towards the connector), delegating the actual authentication to Pocket-ID.
- `/mcp` and the OAuth routes NEVER go through forward-auth. The viewer and `/api/*` DO.

### 3. How to protect ALL routes without breaking claude.ai (verified pattern)
Selective per-route forward-auth in the LOCAL reverse proxy (Caddy or nginx), NOT at the edge:
- Routes that stay OUTSIDE proxy-auth (protected only by token validation in the FastMCP app): `/mcp`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/.well-known/openid-configuration`, `/authorize`, `/token`, `/register`.
- Routes that DO go through forward-auth against the IdP: `/` (the viewer) and `/api/*` (including POST/DELETE writes).
- In Authelia this is implemented with `access_control` and a `bypass` rule keyed on `resources` (a path regex) for the OAuth/MCP routes, plus `one_factor`/`two_factor` for the viewer and the API. Example from the docs: `resources: ["^/api([/?].*)?$"]` with `policy: bypass`. Careful: a `bypass` rule cannot use subject-based criteria, so the bypass rules have to come first ("if you have two identical rules, and one of them has a subject based reliant criteria, and the other one is a bypass rule then the bypass rule should generally come first").
- In Authentik forward-auth (single-application mode) you use the "Unauthenticated Paths" field (per-path regex): "To allow unauthenticated requests to specific paths or URLs, use the Unauthenticated Paths or Unauthenticated URLs field on the proxy provider. Each new line is interpreted as a regular expression". (Caution: issue #6563 shows matching bugs when several providers share a domain; in single-application mode per subdomain it is reliable.)
- Closing Naeth's current critical hole: the viewer and `/api` were left open through the tunnel; selective forward-auth closes them for good, replacing the 404 patch at the edge, without touching `/mcp`.
Verification that it does not break claude.ai: the claude.ai OAuth handshake only touches `/mcp` and the OAuth routes, all of them excluded from forward-auth. On top of that you have to disable Bot Fight Mode / "Block AI training bots" on the MCP hostnames and allowlist Anthropic's egress range (`160.79.104.0/21`), which is the root cause of most "token=200 then silence" failures. Smoke test with curl before connecting: `/mcp` without a token must return `401` with `WWW-Authenticate`; `.well-known/*` must return `200`; `/register` must return `201`.

### 4. Prioritised hardening checklist
1. **Close the open-routes hole (CRITICAL, now):** selective forward-auth for Naeth's `/` and `/api/*` (see above). It replaces the 404 patch at the edge.
2. **2FA:** enable it on the central IdP. TOTP as a minimum; passkeys/WebAuthn if you pick Pocket-ID (natively passwordless), Authentik or Authelia. For 1 user WebAuthn is worth it, because it removes the password factor entirely and is phishing-resistant by design; TOTP is the acceptable minimum.
3. **Rate limiting and lockout on failed attempts:** the IdP provides this out of the box (Authelia has login regulation with account lockout; Pocket-ID/Keycloak/Authentik ship limits). Avoid reimplementing it in FastMCP. Complement it with fail2ban reading the auth logs (there is a published Authelia filter with `failregex` for failed 1FA/TOTP/Duo attempts).
4. **CSRF:** handled by the IdP on its login; FastMCP `OAuthProxy` already includes confused-deputy protection with a consent screen and a CSRF token in the transaction.
5. **Secrets out of plaintext:** see the secrets section.
6. **Encrypted tokens at rest:** `FernetEncryptionWrapper` over the store (the default in 2.13, but set key+storage explicitly in production).
7. **Auditing/alerting:** centralised structured logs of auth events; alert on logins and on failures ("auth events are a security goldmine").

### Secrets management (getting them out of plaintext)
For 1 Windows PC + Docker, from least to most:
- **The serious minimum: SOPS + age.** Encrypts `.env`, `credentials.env`, `oauth_store.json` and the Postgres credentials at rest; decrypts into memory at startup. Zero infrastructure (a single binary), MPL 2.0 via CNCF. It is the "no-brainer" for this case ("30 minutes of learning gets your plaintext secrets migrated to encrypted storage"). The age key is protected with Windows DPAPI / Credential Manager.
- **Windows DPAPI / Credential Manager:** for the age master key and for secrets consumed directly by a native Windows process (cloudflared).
- **Docker secrets:** to inject into containers without a cleartext `.env`.
- **Infisical (self-hosted, MIT):** if you want a UI, automatic rotation, cross-project references and auditing; a single docker-compose (Postgres+Redis). It is the next step up once N grows.
- **HashiCorp Vault / OpenBao:** overkill for 1 user; Vault is also BSL. Ruled out barring large growth (OpenBao if you need a clean licence).
Recommendation: SOPS+age now; Infisical once you have 4-5 MCPs and want centralised rotation.

### 5 (part). Token security
- **Encryption at rest:** `FernetEncryptionWrapper` over the `AsyncKeyValue` store (Naeth must migrate `oauth_store.json` to an encrypted store; likewise Comfy with its JSON). In Postgres, encrypt the sensitive columns.
- **TTLs and rotation:** short access tokens. Anthropic's M365 connector doc describes "an access token that expires after 1 hour and a refresh token for longer-term access" (issue #65036 of `anthropics/claude-code`: "access_token (~1h lifetime) + refresh_token (typically days to months)"). Rotate refresh tokens for public clients (DCR/CIMD), as required by OAuth 2.1. Watch out for the FastMCP behaviour where the client `TokenStorageAdapter` uses "a 1-year TTL for stored tokens, regardless of the access token's expires_in value" (DeepWiki), and for the server-side bug where the store TTL did not follow the refresh token expiry (issue #2406): set the store TTL >= the refresh token expiry.
- **Signed JWTs vs opaque tokens for the central AS:** for this case, **signed JWTs** (local validation on each RS via JWKS, no network call per request, scales to N without coupling) unless you need immediate revocation, in which case opaque tokens + introspection (`IntrospectionTokenVerifier`). A reasonable compromise: short-lived JWTs (implicit revocation through fast expiry) so you do not have to set up introspection.
- **Revocation:** when you disconnect a connector, Anthropic deletes its tokens, but the ones at the IdP stay valid until they expire ("tokens at your identity provider remain valid until they expire ... call your identity provider's token revocation endpoint separately").

### 6 (part). Robustness and observability
- **Unified autostart:** everything as Windows services (no mixing services and scheduled tasks). `cloudflared` is already a service; convert Comfy (today a scheduled task) and the MCPs into services (NSSM or `sc create`, or Docker containers with `restart: always`). Docker Desktop configured to start at boot.
- **Health monitoring:** uptime checks on each MCP's `/health`, on the IdP (Pocket-ID `/healthz`, Keycloak `/health/ready`, Authentik `/-/health/live/`) and on the tunnel; alert on service down, tunnel down and certificate expiry. Cloudflare Tunnel allows health checks via an HTTPS monitor on a fixed endpoint.
- **Backups:** Naeth's Postgres (nightly dump + quarterly restore test), encrypted secrets (the SOPS repo), and the IdP database (the most critical piece: if it is lost, every MCP loses auth at once). Back up the age key offline.
- **Reconnecting the claude.ai connector after a reboot:** the root of the problem is usually (a) the MCP has not started yet when the broker retries, or (b) the token store does not persist. With autostart as a service + a persistent encrypted store + a startup order (IdP before MCP, tunnel last), the connector should reconnect on its own. If it persists, it may be the claude.ai tool-surfacing bug (issue #476), not yours.
- **Defence in depth and SPOF:** the central IdP is the new single point of failure for authentication; mitigate it with a tested backup and a second offline recovery factor. The single tunnel is another SPOF (see H).

### H. Tunnel consolidation
Recommendation: **consolidate into ONE `cloudflared` (Windows service) with several ingress rules** (one hostname per service, a catch-all `http_status:404` rule at the end). Cloudflared supports multiple hostname-to-service mappings in a single config YAML ("You can publish multiple applications on a single tunnel").
- In favour: a single autostart mechanism (which fixes the service vs scheduled task inconsistency), less management surface, a single configuration/observability point, replicas for HA if needed.
- Against: a failure of the `cloudflared` process takes down every hostname at once (less failure isolation). For 1 PC and 1 user, simplicity and autostart consistency weigh more than isolation; the risk is mitigated with `restart: always`/service plus monitoring. **Verdict: consolidate.**

### Note on open-source "MCP gateways"
There is a growing ecosystem of MCP gateways in 2026 (MCPJungle, IBM ContextForge, Microsoft mcp-gateway, Octelium, docker-mcp-gateway with MCPHub+Caddy, Pomerium, etc.). For your case (1 user, small N) I do NOT recommend adopting a dedicated MCP gateway as a central piece: most of them target Kubernetes/enterprise (multi-tenant, RBAC, federation) and add maintenance without solving your real problem any better, which is centralised identity + route protection. Your combination of FastMCP RemoteAuthProvider + Pocket-ID + Caddy forward-auth covers the same ground with less surface. Re-evaluate a gateway (e.g. ContextForge, Apache 2.0) only if you go past ~5-8 MCPs and want tool discovery/aggregation under a single endpoint.

## Recommendations

### The two scenarios of the SSO vs claude.ai compatibility conflict (with an explicit trade-off)
**Scenario 1 - Prioritise NOT breaking claude.ai (recommended to start with):**
- Each MCP keeps exposing its own OAuth endpoint via FastMCP (`OAuthProxy` delegating to Pocket-ID, or the current `OAuthProvider` refactored into a `RemoteAuthProvider` validating against Pocket-ID). claude.ai sees one AS per connector, with DCR/CIMD that we know works.
- Trade-off: there is no "single login" across connectors in claude.ai (you will consent per connector), but identity, 2FA, rate limiting and secrets ARE centralised in Pocket-ID. It is "backend" SSO (a single identity store) even though the claude.ai front end asks you to consent to each connector. Zero risk of breaking the handshake.
**Scenario 2 - Prioritise real SSO even if it introduces friction in claude.ai:**
- A single central AS (Keycloak with DCR enabled, or Pocket-ID+OAuthProxy) as the shared issuer; all MCPs as Resource Servers validating JWTs from that issuer. One login at the IdP is enough to get tokens for all of them.
- Trade-off/risk: claude.ai uses the first entry in `authorization_servers` and does not fall back to the following ones ("Claude uses the first entry and does not fall back to later entries"); with a common issuer and DCR, each connector may still register its own client, and there is still no "one click connects them all" on the personal plane (that is Enterprise Managed Auth, beta for Team/Enterprise). If the central AS ends up behind anything that intercepts with a redirect, you break claude.ai. Conceptually more elegant, but more failure surface and no real one-login gain in personal claude.ai.
Conclusion: for 1 personal user, Scenario 1 gives 90% of the benefit (centralised identity, 2FA, secrets and tokens) with minimal risk. Keep Scenario 2 (Keycloak DCR) in reserve for when you want a pure enterprise AS or move to a Team/Enterprise plan with Managed Auth.

### 6. Phased migration plan (without breaking claude.ai/Claude Code)
**Phase 0 - Preparation (without touching production):**
- Snapshot/backup of the current Postgres, `oauth_store.json` and `.env`. Document the `client_id` values claude.ai has registered.
- Update FastMCP to 2.13+ (encrypted token store by default) in a test environment.
- Why nothing breaks: nothing live is touched.
**Phase 1 - Immediate hardening of what exists (CRITICAL):**
- Put selective forward-auth (Caddy/Authelia) in front of Naeth's viewer and `/api/*`, excluding `/mcp` and `.well-known/*`, `/authorize`, `/token`, `/register`. Replace the 404 patch.
- Disable Bot Fight Mode / "Block AI bots" on the MCP hostnames and add the allowlist for Anthropic's egress range (`160.79.104.0/21`).
- Encrypt `oauth_store.json` (Fernet) and move secrets out to SOPS+age.
- Why nothing breaks: `/mcp` and the OAuth routes stay untouched; only the viewer/API protection changes. Verify the handshake with curl.
**Phase 2 - Deploy the central IdP (additive):**
- Bring up Pocket-ID as a container (`auth.domain`), configure your user with a passkey + backup TOTP.
- Add the hostname to the consolidated `cloudflared`.
- Why nothing breaks: the MCPs keep their current auth; the IdP is not in use yet.
**Phase 3 - Migrate ONE MCP to Resource Server (start with Comfy, the least critical):**
- Switch Comfy to `RemoteAuthProvider`+`JWTVerifier` pointing at Pocket-ID's JWKS; if claude.ai needs DCR/CIMD, wrap it in `OAuthProxy` with `allowed_client_redirect_uris=["https://claude.ai/api/mcp/auth_callback","http://localhost:*","http://127.0.0.1:*"]` (that last part is necessary because Claude Code uses loopback on an ephemeral port).
- Reconnect the Comfy connector in claude.ai (it will be a re-consent, as expected) and verify in Claude Code.
- Why nothing breaks: Naeth is untouched; if Comfy fails, roll back to its own AS without affecting Naeth.
**Phase 4 - Migrate Naeth the same way:**
- Same pattern. Migrate `oauth_store.json` to the encrypted store. The memory Postgres stays untouched.
- Why nothing breaks: rollback is available; the viewer/API have been protected since Phase 1.
**Phase 5 - Consolidate tunnels and autostart:**
- Merge the two `cloudflared` instances into one with several ingress rules; convert Comfy and the MCPs into Windows services / `restart: always` containers. Startup order: IdP -> MCP -> tunnel.
- Add health monitoring and alerting; automate backups.
- Why nothing breaks: test the new tunnel as a replica before stopping the old one (cloudflared supports replicas for propagation with minimal downtime).
**Phase 6 - Scale to N:**
- Every new MCP is born as a Resource Server against Pocket-ID + `OAuthProxy`, a new ingress in the tunnel, a service with autostart, secrets in SOPS. A repeatable template.

### Thresholds that would change the recommendations
- If you move to a Team/Enterprise plan: turn on Enterprise Managed Auth for real one-click SSO (Scenario 2 with Keycloak/Pocket-ID).
- If N > ~5 MCPs and you want centralised secret rotation: migrate from SOPS to Infisical.
- If N > ~8 MCPs and you want tool aggregation/discovery under one endpoint: evaluate an MCP gateway (ContextForge).
- If you need immediate token revocation: move from JWTs to opaque tokens + introspection.
- If you need pure native DCR without OAuthProxy: swap Pocket-ID for Keycloak (accepting the RAM/maintenance cost).

## BENCHMARK / verification plan
(Not applicable to this report; see the images one.)

## Caveats
- Personal claude.ai does NOT offer "a single login for all connectors": one-click SSO is Enterprise Managed Auth (beta, Team/Enterprise). Any promise of full SSO on the personal plane is incorrect.
- Pocket-ID's DCR status is UNVERIFIED; I assume it does not have it and cover that with `OAuthProxy`/CIMD. Verify it before committing to that piece.
- Issues #410 and #327 were closed as "not planned": there is no official fix from Anthropic; the solutions are on the user's side (allowlisting IPs at the edge, disabling Bot Fight Mode). No quoted comment from Anthropic staff was found in #410.
- Some secondary sources claim Authentik supports DCR; the project's own issue (#8751) says it does not. The primary source prevails; verify on your specific version.
- There is an open bug (issue #476) where claude.ai web completes the handshake but does not expose the connector's tools to the model, while ChatGPT and Claude Code do; it is on the claude.ai side, not on your server. Keep it in mind when diagnosing.
- The IdP RAM figures are approximate and come from 2026 sources (authhost.de, Authelia's official site, Red Hat for Keycloak); confirm them on your own hardware.
- The Cloudflare Access + claude.ai incompatibility has two distinct mechanisms (pre-auth failure at the Access layer vs post-token blocking at the WAF edge). The proposed design avoids both, by not putting redirect-based proxy-auth in front of `/mcp` and by allowlisting Anthropic's egress; if Anthropic fixes the connector for Access in the future, you could reconsider, but as of July 2026 there is no confirmed fix.
