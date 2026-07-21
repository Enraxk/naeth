"""Servidor MCP de Naeth (Paso 7 §4/§5). Fachada Streamable HTTP sobre el mismo `core`
ADD-only del Paso 6 — no duplica logica. Lo consumen Claude Code (localhost, Fase 2) y
claude.ai (tunel + OAuth, Fase 4).

Esta es la app PRINCIPAL del proceso: el endpoint MCP va en /mcp y, cuando OAuth esta
activo, las rutas OAuth (/.well-known/oauth-authorization-server, /authorize, /token,
/register, /.well-known/oauth-protected-resource/mcp) cuelgan de la RAIZ del host, que es
donde claude.ai las busca. El visor + CRUD se sirven como custom_route del propio servidor
(mismo proceso, Paso 7 §6).

Herramientas v1 (Paso 7 §4): memory.add/search/get/supersede/tombstone,
relation.add/list, system.status.

OAuth (Fase 3): conmutable por env var.
  OAUTH_ENABLED=1            -> InMemoryOAuthProvider con DCR (validacion del flujo, Fase 3a)
  OAUTH_BASE_URL=<url>       -> issuer/base publica (local: http://127.0.0.1:8800;
                               Fase 4: https://naeth-local.enraxk.dev)
FastMCP aporta nativamente discovery (RFC 8414/9728), PKCE S256 y el 401 con
`WWW-Authenticate: Bearer resource_metadata=...` que claude.ai exige.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, Response

from app import core

VIEWER_DIR = Path(__file__).resolve().parent / "viewer"

OAUTH_ENABLED = os.environ.get("OAUTH_ENABLED", "").strip().lower() in ("1", "true", "yes")
OAUTH_BASE_URL = os.environ.get("OAUTH_BASE_URL", "http://127.0.0.1:8800").rstrip("/")
# postgres (Fase 3b, con login) | memory (Fase 3a, validacion del plumbing)
OAUTH_PROVIDER = os.environ.get("OAUTH_PROVIDER", "postgres").strip().lower()


def _build_auth():
    if not OAUTH_ENABLED:
        return None
    if OAUTH_PROVIDER == "oidc":
        # Fase 4 (CENIT): OIDCProxy contra el IdP central (Pocket-ID). Naeth deja de ser
        # su propio AS: delega el login en Pocket-ID y emite sus PROPIOS JWT (token factory).
        # claude.ai hace DCR contra este proxy, que lo traduce al cliente estatico de Pocket-ID.
        from fastmcp.server.auth import OIDCProxy
        return OIDCProxy(
            config_url=os.environ["OIDC_CONFIG_URL"],          # .well-known de Pocket-ID
            client_id=os.environ["OIDC_CLIENT_ID"],            # cliente cenit-memory
            client_secret=os.environ["OIDC_CLIENT_SECRET"],
            base_url=OAUTH_BASE_URL,                            # https://memory.enraxk.dev
            allowed_client_redirect_uris=[
                "https://claude.ai/api/mcp/auth_callback", "http://localhost:*",
            ],
            require_authorization_consent=False,               # el consent lo hace Pocket-ID
            forward_resource=False,                            # Pocket-ID no soporta RFC 8707
        )
    from fastmcp.server.auth.auth import ClientRegistrationOptions
    reg = ClientRegistrationOptions(enabled=True)  # DCR para claude.ai
    if OAUTH_PROVIDER == "memory":
        # Fase 3a: provider en memoria (tokens efimeros, auto-aprueba). Solo validacion.
        from fastmcp.server.auth.providers.in_memory import InMemoryOAuthProvider
        return InMemoryOAuthProvider(base_url=OAUTH_BASE_URL,
                                     client_registration_options=reg)
    # Fase 3b (legacy, rollback): AS propio persistido en Postgres + login de 1 usuario.
    from app.oauth import NaethOAuthProvider
    return NaethOAuthProvider(base_url=OAUTH_BASE_URL, client_registration_options=reg)


mcp: FastMCP = FastMCP(name="naeth", auth=_build_auth())


def _embed_query(q: str) -> list[float] | None:
    try:
        from app.embeddings import embed_query
        return embed_query(q)
    except Exception:  # noqa: BLE001
        return None  # cae a busqueda lexica si el modelo no esta disponible


# ================================================================ autoria (Paso 10)
# Reemplaza el viejo _source_client() (que consultaba la tabla oauth_client, MUERTA tras
# el cutover a CENIT, y recortaba el client_id a 12 chars). Ahora la autoria se compone de
# ejes separados con procedencia distinta (ver pasos/paso10-autoria.md):
#   - product : de clientInfo.name del handshake MCP -> lo pone la APP cliente, no el LLM (verificable)
#   - surface : del query ?s= del endpoint -> lo fija la config del conector (verificable)
#   - zone    : hay token OAuth (publico) o no (loopback confiado)
#   - actor   : agente (MCP) vs humano (visor)
#   - vendor/model : DECLARADOS por el agente (MCP no los transmite; o los declara o no existen)

# claude.ai anuncia un clientInfo distinto a Claude Code; el mapeo normaliza lo conocido y
# preserva lo demas crudo en client_raw para poder corregir sin perder nada.
AUTHORSHIP_ENFORCE = os.environ.get("AUTHORSHIP_ENFORCE", "warn").strip().lower()  # warn|strict

# Autoria de las escrituras del visor: eres TU, a mano. Sin modelo (un humano no tiene).
_HUMAN_AUTHOR = {"product": "naeth-web", "surface": "visor", "zone": "public",
                 "actor": "human", "vendor": None, "model": None,
                 "model_source": "human", "client_raw": {}}


def _product_from_client_name(name: str | None) -> str:
    """Normaliza el clientInfo.name a un producto. Valores REALES medidos (2026-07-21):
    Claude Code -> 'claude-code' (v2.1.215); claude.ai y la app Claude Desktop ->
    'Anthropic/ClaudeAI' (v1.0.0). Se compara sobre la forma 'aplanada' (sin separadores
    ni mayusculas) porque cada cliente escribe el nombre a su manera."""
    n = (name or "").strip().lower()
    if not n:
        return "unknown"
    flat = n.translate(str.maketrans("", "", "-._/ "))   # "anthropic/claudeai" -> "anthropicclaudeai"
    if "claudecode" in flat or "code" in flat:
        return "claude-code"
    if "claude" in flat:                  # claudeai, claude-ai, claude.ai, "Claude" a secas
        return "claude-ai"
    return n                              # desconocido: se guarda tal cual (client_raw permite reclasificar)


def _client_info() -> tuple[str | None, str | None]:
    """(name, version) del clientInfo del initialize MCP, o (None, None)."""
    try:
        from fastmcp.server.dependencies import get_context
        ci = get_context().session.client_params.clientInfo
        return getattr(ci, "name", None), getattr(ci, "version", None)
    except Exception:  # noqa: BLE001
        return None, None


def _surface_from_request() -> str | None:
    """El query ?s= del endpoint (lo fija la config del conector: ?s=desktop|vscode|web)."""
    try:
        from fastmcp.server.dependencies import get_http_request
        return get_http_request().query_params.get("s") or None
    except Exception:  # noqa: BLE001
        return None


def _access_token():
    try:
        # El SDK devuelve el AccessToken sin la validacion de tipo de FastMCP (que lo
        # rechaza al usar un AS propio / OIDCProxy).
        from mcp.server.auth.middleware.auth_context import get_access_token
        return get_access_token()
    except Exception:  # noqa: BLE001
        return None


def _authorship(agent_model: str | None = None,
                agent_vendor: str | None = None) -> dict[str, Any]:
    name, version = _client_info()
    product = _product_from_client_name(name)
    surface = _surface_from_request()
    tok = _access_token()
    zone = "public" if tok else "loopback"
    model = (agent_model or "").strip() or None
    author = {
        "product": product,
        "surface": surface,
        "zone": zone,
        "actor": "agent",
        "vendor": (agent_vendor or "").strip() or ("anthropic" if model and model.startswith("claude") else None),
        "model": model,
        "model_source": "declared" if model else "undeclared",
        "client_raw": {"name": name, "version": version,
                       "client_id": getattr(tok, "client_id", None) if tok else None},
    }
    return author


def _source_client(author: dict[str, Any]) -> str:
    """Legado (columna source_client, NOT NULL). Legible, derivado del author. Arregla el
    UUID recortado: ya no depende de la tabla oauth_client muerta."""
    p = author.get("product") or "unknown"
    s = author.get("surface")
    return f"mcp:{p}/{s}" if s else f"mcp:{p}"


def _enforce_model(author: dict[str, Any]) -> None:
    """En 'strict' rechaza (instructivo) si el agente no declaro el modelo. En 'warn' pasa."""
    if AUTHORSHIP_ENFORCE == "strict" and author.get("model_source") != "declared":
        raise ValueError(
            "Naeth exige declarar el modelo que escribe. Reintenta pasando agent_model "
            "(p. ej. agent_model='claude-opus-4-8') en la llamada.")


# ================================================================ herramientas MCP
@mcp.tool(name="memory_add",
          description="Save / store / remember a new persistent memory in Naeth "
                      "(append-only). Queues its embedding. Idempotent by content. Use "
                      "when asked to remember or note a fact, decision, observation or "
                      "preference. Pass agent_model with the model you are running as "
                      "(e.g. 'claude-opus-4-8') so Naeth records who wrote it.")
async def memory_add(content: str, title: str | None = None,
               memory_type: str = "observation", tags: list[str] | None = None,
               path: str | None = None, agent_model: str | None = None,
               agent_vendor: str | None = None) -> dict[str, Any]:
    author = _authorship(agent_model, agent_vendor)
    _enforce_model(author)
    r = core.add(content, title=title, memory_type=memory_type, tags=tags,
                 path=path, source_client=_source_client(author), author=author)
    m = r["memory"]
    return {"id": str(m["id"]), "created": r["created"], "title": m["title"],
            "memory_type": m["memory_type"], "author": m.get("author")}


@mcp.tool(name="memory_search",
          description="Retrieve / recall persistent memory from Naeth: look up prior "
                      "context about the user's projects, decisions, configs and "
                      "preferences. ENTRY tool -- call before answering about those "
                      "topics. Hybrid search (semantic + lexical, RRF) over current "
                      "memories; returns the top-k most relevant.")
def memory_search(query: str, k: int = 10) -> list[dict[str, Any]]:
    hits = core.search(query, k=k, q_embedding=_embed_query(query))
    return [{"id": str(h["id"]), "title": h["title"],
             "content": h["content"], "memory_type": h["memory_type"],
             "tags": h["tags"], "score": float(h["score"]) if h.get("score") else None}
            for h in hits]


@mcp.tool(name="memory_get",
          description="Open / read the full detail of a single Naeth memory by id, "
                      "including its version chain (supersession / history).")
def memory_get(memory_id: str) -> dict[str, Any]:
    r = core.get(memory_id)
    if not r:
        return {"error": "no encontrado", "id": memory_id}
    m = r["memory"]
    return {"id": str(m["id"]), "title": m["title"], "content": m["content"],
            "memory_type": m["memory_type"], "tags": m["tags"], "path": m["path"],
            "is_current": m["is_current"], "created_at": str(m["created_at"]),
            "author": m.get("author"),
            "supersession": [{"child": str(s["child_id"]), "parent": str(s["parent_id"])}
                             for s in r["supersession"]]}


@mcp.tool(name="memory_supersede",
          description="Edit / update / correct / revise a Naeth memory: creates a new "
                      "version replacing the previous one (append-only); the old stays "
                      "but is no longer current. Editing without destroying. Pass "
                      "agent_model with the model you are running as (e.g. "
                      "'claude-opus-4-8') so Naeth records who wrote it.")
async def memory_supersede(parent_id: str, content: str, title: str | None = None,
                     memory_type: str = "observation",
                     tags: list[str] | None = None, path: str | None = None,
                     agent_model: str | None = None,
                     agent_vendor: str | None = None) -> dict[str, Any]:
    author = _authorship(agent_model, agent_vendor)
    _enforce_model(author)
    r = core.supersede(parent_id, content, title=title, memory_type=memory_type,
                       tags=tags, path=path, source_client=_source_client(author),
                       author=author)
    m = r["memory"]
    return {"id": str(m["id"]), "supersedes": parent_id, "title": m["title"]}


@mcp.tool(name="memory_tombstone",
          description="Delete / retire / forget a Naeth memory logically (append-only): "
                      "it stops being current but stays in history. No physical deletion.")
async def memory_tombstone(memory_id: str) -> dict[str, Any]:
    return core.tombstone(memory_id, source_client=_source_client(_authorship()))


@mcp.tool(name="relation_add",
          description="Link / connect / relate two Naeth memories with an explicit graph "
                      "edge (predicate: links_to, depends_on, derived_from, "
                      "supersedes...). For cross-cutting links the path tree can't express.")
async def relation_add(source_id: str, target_id: str, predicate: str) -> dict[str, Any]:
    return core.relation_add(source_id, target_id, predicate,
                             source_client=_source_client(_authorship()))


@mcp.tool(name="relation_list",
          description="List the current relations / links / edges of a Naeth memory "
                      "(incoming and outgoing). Follows the supersession chain, so edges "
                      "survive when an endpoint is superseded.")
def relation_list(memory_id: str) -> list[dict[str, Any]]:
    return core.relation_list(memory_id)


@mcp.tool(name="relation_tombstone",
          description="Remove / retract / delete a graph edge (relation) between two Naeth "
                      "memories (append-only: it stops appearing but stays in history). "
                      "Pass the relation id returned by relation_list.")
async def relation_tombstone(relation_id: str) -> dict[str, Any]:
    return core.tombstone(relation_id, target_kind="relation",
                          source_client=_source_client(_authorship()))


@mcp.tool(name="system_status",
          description="Health / status / diagnostics of the Naeth node: memory counts, "
                      "embedding queue, active model and dimension. Check that Naeth is "
                      "alive and healthy.")
def system_status() -> dict[str, Any]:
    return {**core.status(), "authors": core.authors()}


# ================================================================ visor + CRUD (HTTP)
# Mismo proceso (Paso 7 §6). El visor es local; estas rutas no exigen OAuth (solo /mcp).
@mcp.custom_route("/", methods=["GET"])
async def index(request: Request) -> Response:
    return FileResponse(str(VIEWER_DIR / "index.html"))


@mcp.custom_route("/healthz", methods=["GET"])
async def healthz(request: Request) -> Response:
    return JSONResponse({"ok": True, "model": os.environ.get("EMBED_MODEL"),
                         "mcp": "/mcp",
                         "oauth": "enabled" if OAUTH_ENABLED else "disabled",
                         "oauth_provider": OAUTH_PROVIDER if OAUTH_ENABLED else None,
                         "oauth_base_url": OAUTH_BASE_URL if OAUTH_ENABLED else None})


# Login de 1 usuario (Fase 3b). Solo relevante con OAuth Postgres; el authorize() del
# provider redirige aqui. Inofensivo si OAuth esta off (nadie llega).
@mcp.custom_route("/login", methods=["GET"])
async def login_get_route(request: Request) -> Response:
    from app.oauth import login_get
    return await login_get(request)


@mcp.custom_route("/login", methods=["POST"])
async def login_post_route(request: Request) -> Response:
    from app.oauth import login_post
    return await login_post(request)


@mcp.custom_route("/api/status", methods=["GET"])
async def api_status(request: Request) -> Response:
    return JSONResponse(_json(core.status()))


@mcp.custom_route("/api/tree", methods=["GET"])
async def api_tree(request: Request) -> Response:
    return JSONResponse(_json(core.tree()))


@mcp.custom_route("/api/authors", methods=["GET"])
async def api_authors(request: Request) -> Response:
    return JSONResponse(_json(core.authors()))


@mcp.custom_route("/api/memory", methods=["POST"])
async def api_add(request: Request) -> Response:
    b = await request.json()
    if not b.get("content"):
        return JSONResponse({"error": "content requerido"}, status_code=400)
    r = core.add(b["content"], title=b.get("title"),
                 memory_type=b.get("memory_type", "observation"),
                 tags=b.get("tags"), path=b.get("path"), source_client="web",
                 author=_HUMAN_AUTHOR)
    return JSONResponse(_json(r))


@mcp.custom_route("/api/memory/{memory_id}", methods=["GET"])
async def api_get(request: Request) -> Response:
    res = core.get(request.path_params["memory_id"])
    return JSONResponse(_json(res or {"error": "no encontrado"}))


@mcp.custom_route("/api/memory/{memory_id}/supersede", methods=["POST"])
async def api_supersede(request: Request) -> Response:
    # El editor manda TODOS los campos; los no editados se conservan tal cual.
    # (core.supersede NO hereda del padre: sin esto, editar borraria tipo/tags/path.)
    b = await request.json()
    r = core.supersede(
        request.path_params["memory_id"],
        b["content"],
        title=b.get("title"),
        memory_type=b.get("memory_type", "observation"),
        tags=b.get("tags"),
        path=b.get("path"),
        metadata=b.get("metadata"),
        source_client="web",
        author=_HUMAN_AUTHOR,
    )
    return JSONResponse(_json(r))


@mcp.custom_route("/api/memory/{memory_id}", methods=["DELETE"])
async def api_delete(request: Request) -> Response:
    return JSONResponse(_json(core.tombstone(request.path_params["memory_id"],
                                             source_client="web")))


@mcp.custom_route("/api/search", methods=["GET"])
async def api_search(request: Request) -> Response:
    q = request.query_params.get("q", "")
    k = int(request.query_params.get("k", "10"))
    semantic = request.query_params.get("semantic", "true").lower() != "false"
    q_emb = _embed_query(q) if semantic else None
    return JSONResponse({"query": q, "mode": "hybrid" if q_emb else "lexical",
                         "hits": _json(core.search(q, k=k, q_embedding=q_emb))})


# --- Relaciones del grafo (compartido por editor [[ ]] + Fase 0 DnD/menu) ---
@mcp.custom_route("/api/relation", methods=["POST"])
async def api_relation_add(request: Request) -> Response:
    b = await request.json()
    if not b.get("source_id") or not b.get("target_id"):
        return JSONResponse({"error": "source_id y target_id requeridos"}, status_code=400)
    r = core.relation_add(b["source_id"], b["target_id"],
                          b.get("predicate", "links_to"), source_client="web")
    return JSONResponse(_json(r))


@mcp.custom_route("/api/memory/{memory_id}/relations", methods=["GET"])
async def api_relations(request: Request) -> Response:
    return JSONResponse(_json(core.relation_list(request.path_params["memory_id"])))


@mcp.custom_route("/api/relation/{relation_id}", methods=["DELETE"])
async def api_relation_del(request: Request) -> Response:
    return JSONResponse(_json(core.tombstone(request.path_params["relation_id"],
                                             target_kind="relation", source_client="web")))


def _json(obj: Any) -> Any:
    """Serializa UUID/datetime/Decimal de psycopg para JSONResponse."""
    import datetime
    import decimal
    import uuid
    if isinstance(obj, dict):
        return {k: _json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json(v) for v in obj]
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    return obj


# App principal del proceso: MCP en /mcp + OAuth en raiz + visor/CRUD.
app = mcp.http_app(path="/mcp")
