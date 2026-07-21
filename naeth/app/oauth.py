"""OAuth 2.1 Authorization Server de Naeth respaldado en Postgres (Paso 7 §5, Fase 3b).

Subclasa `OAuthProvider` de FastMCP: FastMCP aporta discovery (RFC 8414/9728), PKCE S256,
los endpoints /authorize /token /register /revoke y el 401 con `WWW-Authenticate:
resource_metadata`. Aqui ponemos la persistencia (tablas oauth_*) y el **login de 1
usuario** (memoria personal de un solo principal: tu).

Flujo con login:
  /authorize  -> authorize() guarda un pending y redirige a /login?rid=...
  /login (GET)-> formulario usuario+contrasena
  /login (POST)-> valida credenciales; si OK genera el authorization code y redirige al
                  redirect_uri del cliente con ?code=...&state=...

Notas de seguridad (v1 local, 1 usuario): credenciales en env (NAETH_AUTH_USER/PASSWORD),
comparadas con compare_digest; sin sesion persistente (cada authorize pide login); sin
CSRF token (un solo usuario, superficie minima). Se endurece en `finally` si hace falta.

Las queries a Postgres son sincronas (pool de core) y se ejecutan en un threadpool para
no bloquear el event loop. El trafico OAuth de un solo usuario es esporadico.
"""
from __future__ import annotations

import html
import json
import os
import secrets
import time

from anyio import to_thread
from mcp.server.auth.provider import (
    AccessToken, AuthorizationCode, AuthorizationParams, RefreshToken,
    TokenError, construct_redirect_uri)
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken
from psycopg.types.json import Jsonb
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse, Response

from fastmcp.server.auth.auth import OAuthProvider

from app import core

AUTH_CODE_TTL = 5 * 60          # 5 min
ACCESS_TTL = 60 * 60            # 1 h
REFRESH_TTL: int | None = None  # sin expiracion

AUTH_USER = os.environ.get("NAETH_AUTH_USER", "")
AUTH_PASSWORD = os.environ.get("NAETH_AUTH_PASSWORD", "")


# ============================================================ helpers de DB (sync)
def _db(fn, *a):
    with core.conn() as c:
        return fn(c, *a)


class NaethOAuthProvider(OAuthProvider):
    """Authorization Server propio, persistido en Postgres. Un solo usuario."""

    def __init__(self, base_url: str, client_registration_options=None,
                 revocation_options=None, required_scopes=None):
        super().__init__(base_url=base_url,
                         client_registration_options=client_registration_options,
                         revocation_options=revocation_options,
                         required_scopes=required_scopes)

    # ---------------------------------------------------------------- clientes (DCR)
    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        def q(c):
            r = c.execute("SELECT client_data FROM oauth_client WHERE client_id=%s",
                          (client_id,)).fetchone()
            return r["client_data"] if r else None
        data = await to_thread.run_sync(_db, q)
        return OAuthClientInformationFull.model_validate(data) if data else None

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        data = client_info.model_dump(mode="json")
        def q(c):
            c.execute(
                """INSERT INTO oauth_client (client_id, client_data) VALUES (%s, %s)
                   ON CONFLICT (client_id) DO UPDATE SET client_data = EXCLUDED.client_data""",
                (client_info.client_id, Jsonb(data)))
        await to_thread.run_sync(_db, q)

    # ---------------------------------------------------------------- authorize -> login
    async def authorize(self, client: OAuthClientInformationFull,
                        params: AuthorizationParams) -> str:
        """No emite el code aqui: guarda la peticion y manda al login de 1 usuario."""
        rid = secrets.token_urlsafe(32)
        payload = {"client_id": client.client_id, "params": params.model_dump(mode="json")}
        def q(c):
            c.execute("INSERT INTO oauth_pending (id, client_id, params) VALUES (%s,%s,%s)",
                      (rid, client.client_id, Jsonb(payload["params"])))
        await to_thread.run_sync(_db, q)
        return f"{str(self.base_url).rstrip('/')}/login?rid={rid}"

    # ---------------------------------------------------------------- codigos
    async def load_authorization_code(self, client: OAuthClientInformationFull,
                                      authorization_code: str) -> AuthorizationCode | None:
        def q(c):
            r = c.execute(
                """SELECT code_data FROM oauth_code
                   WHERE code=%s AND client_id=%s AND NOT used AND expires_at > now()""",
                (authorization_code, client.client_id)).fetchone()
            return r["code_data"] if r else None
        data = await to_thread.run_sync(_db, q)
        return AuthorizationCode.model_validate(data) if data else None

    async def exchange_authorization_code(self, client: OAuthClientInformationFull,
                                          authorization_code: AuthorizationCode) -> OAuthToken:
        def consume(c):
            r = c.execute("UPDATE oauth_code SET used=true WHERE code=%s AND NOT used "
                          "RETURNING code", (authorization_code.code,)).fetchone()
            return r is not None
        ok = await to_thread.run_sync(_db, consume)
        if not ok:
            raise TokenError("invalid_grant", "Codigo no encontrado o ya usado.")
        return await self._issue(client.client_id, authorization_code.scopes,
                                 subject=authorization_code.subject)

    # ---------------------------------------------------------------- refresh
    async def load_refresh_token(self, client: OAuthClientInformationFull,
                                 refresh_token: str) -> RefreshToken | None:
        def q(c):
            r = c.execute(
                """SELECT token_data FROM oauth_token
                   WHERE token=%s AND kind='refresh' AND client_id=%s AND NOT revoked""",
                (refresh_token, client.client_id)).fetchone()
            return r["token_data"] if r else None
        data = await to_thread.run_sync(_db, q)
        if not data:
            return None
        rt = RefreshToken.model_validate(data)
        if rt.expires_at is not None and rt.expires_at < time.time():
            return None
        return rt

    async def exchange_refresh_token(self, client: OAuthClientInformationFull,
                                     refresh_token: RefreshToken,
                                     scopes: list[str]) -> OAuthToken:
        if not set(scopes).issubset(set(refresh_token.scopes)):
            raise TokenError("invalid_scope", "Scopes exceden los autorizados.")
        await self._revoke_pair(refresh_token.token)  # rotacion
        return await self._issue(client.client_id, scopes or refresh_token.scopes,
                                 subject=refresh_token.subject)

    # ---------------------------------------------------------------- access / verify
    async def load_access_token(self, token: str) -> AccessToken | None:
        def q(c):
            r = c.execute("SELECT token_data FROM oauth_token "
                          "WHERE token=%s AND kind='access' AND NOT revoked", (token,)).fetchone()
            return r["token_data"] if r else None
        data = await to_thread.run_sync(_db, q)
        if not data:
            return None
        at = AccessToken.model_validate(data)
        if at.expires_at is not None and at.expires_at < time.time():
            return None
        return at

    async def verify_token(self, token: str) -> AccessToken | None:
        return await self.load_access_token(token)

    async def revoke_token(self, token) -> None:
        await self._revoke_pair(token.token)

    # ---------------------------------------------------------------- internos
    async def _issue(self, client_id: str, scopes: list[str],
                     subject: str | None = None) -> OAuthToken:
        access = f"nae_at_{secrets.token_urlsafe(32)}"
        refresh = f"nae_rt_{secrets.token_urlsafe(32)}"
        access_exp = int(time.time() + ACCESS_TTL)
        refresh_exp = int(time.time() + REFRESH_TTL) if REFRESH_TTL else None
        at = AccessToken(token=access, client_id=client_id, scopes=scopes,
                         expires_at=access_exp, subject=subject)
        rt = RefreshToken(token=refresh, client_id=client_id, scopes=scopes,
                          expires_at=refresh_exp, subject=subject)

        def q(c):
            c.execute("""INSERT INTO oauth_token (token, kind, client_id, token_data,
                             paired_token, expires_at)
                         VALUES (%s,'access',%s,%s,%s, to_timestamp(%s))""",
                      (access, client_id, Jsonb(at.model_dump(mode="json")), refresh, access_exp))
            c.execute("""INSERT INTO oauth_token (token, kind, client_id, token_data,
                             paired_token, expires_at)
                         VALUES (%s,'refresh',%s,%s,%s, %s)""",
                      (refresh, client_id, Jsonb(rt.model_dump(mode="json")), access,
                       None if refresh_exp is None else _ts(refresh_exp)))
        await to_thread.run_sync(_db, q)
        return OAuthToken(access_token=access, token_type="Bearer", expires_in=ACCESS_TTL,
                          refresh_token=refresh, scope=" ".join(scopes))

    async def _revoke_pair(self, token: str) -> None:
        def q(c):
            # revoca el token y su par (access<->refresh)
            c.execute("""UPDATE oauth_token SET revoked=true
                         WHERE token=%s OR token=(SELECT paired_token FROM oauth_token WHERE token=%s)""",
                      (token, token))
        await to_thread.run_sync(_db, q)


def _ts(epoch: int) -> str:
    import datetime
    return datetime.datetime.fromtimestamp(epoch, datetime.timezone.utc).isoformat()


# ============================================================ login de 1 usuario (HTTP)
def _valid_credentials(user: str, password: str) -> bool:
    if not AUTH_USER or not AUTH_PASSWORD:
        return False
    return (secrets.compare_digest(user, AUTH_USER)
            and secrets.compare_digest(password, AUTH_PASSWORD))


def _login_html(rid: str, error: str = "") -> str:
    err = f'<p class="err">{html.escape(error)}</p>' if error else ""
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Naeth · acceso</title>
<style>body{{background:#0d0f12;color:#e6e8eb;font:15px system-ui;display:grid;place-items:center;
height:100vh;margin:0}}form{{background:#15181d;border:1px solid #262b33;border-radius:10px;
padding:28px;width:320px}}h1{{font:600 16px ui-monospace,monospace;letter-spacing:1px;margin:0 0 4px}}
.sub{{color:#8a929e;font-size:13px;margin-bottom:18px}}label{{display:block;font:11px ui-monospace;
color:#8a929e;margin:12px 0 4px;text-transform:uppercase;letter-spacing:.5px}}
input{{width:100%;background:#0d0f12;border:1px solid #262b33;color:#e6e8eb;border-radius:6px;
padding:9px 11px;font:14px ui-monospace;box-sizing:border-box}}button{{width:100%;margin-top:18px;
background:#5db0ff;color:#03121f;border:0;border-radius:6px;padding:10px;font:600 14px system-ui;
cursor:pointer}}.err{{color:#e0664b;font-size:13px;margin:10px 0 0}}</style></head>
<body><form method="post" action="/login">
<h1>NAETH</h1><div class="sub">Autoriza el acceso a tu memoria</div>{err}
<input type="hidden" name="rid" value="{html.escape(rid)}">
<label>Usuario</label><input name="user" autofocus autocomplete="username">
<label>Contrasena</label><input name="password" type="password" autocomplete="current-password">
<button type="submit">Autorizar</button></form></body></html>"""


async def login_get(request: Request) -> Response:
    rid = request.query_params.get("rid", "")
    if not rid:
        return HTMLResponse("<p>Falta rid</p>", status_code=400)
    return HTMLResponse(_login_html(rid))


async def login_post(request: Request) -> Response:
    form = await request.form()
    rid = str(form.get("rid", ""))
    user = str(form.get("user", ""))
    password = str(form.get("password", ""))

    def load_pending(c):
        r = c.execute("SELECT client_id, params FROM oauth_pending WHERE id=%s", (rid,)).fetchone()
        return r
    pending = await to_thread.run_sync(_db, load_pending)
    if not pending:
        return HTMLResponse("<p>Peticion de autorizacion no encontrada o expirada.</p>",
                            status_code=400)

    if not _valid_credentials(user, password):
        return HTMLResponse(_login_html(rid, "Credenciales invalidas."), status_code=401)

    params = AuthorizationParams.model_validate(pending["params"])
    code = f"nae_ac_{secrets.token_urlsafe(32)}"
    ac = AuthorizationCode(
        code=code, client_id=pending["client_id"], redirect_uri=params.redirect_uri,
        redirect_uri_provided_explicitly=params.redirect_uri_provided_explicitly,
        scopes=params.scopes or [], expires_at=time.time() + AUTH_CODE_TTL,
        code_challenge=params.code_challenge, resource=params.resource,
        subject=AUTH_USER)

    def store(c):
        c.execute("""INSERT INTO oauth_code (code, client_id, code_data, expires_at)
                     VALUES (%s,%s,%s, to_timestamp(%s))""",
                  (code, pending["client_id"], Jsonb(ac.model_dump(mode="json")),
                   ac.expires_at))
        c.execute("DELETE FROM oauth_pending WHERE id=%s", (rid,))
    await to_thread.run_sync(_db, store)

    target = construct_redirect_uri(str(params.redirect_uri), code=code, state=params.state)
    return RedirectResponse(target, status_code=303)
