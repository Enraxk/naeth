"""Servidor MCP de Naeth (Paso 7 §4/§5). Fachada Streamable HTTP sobre el mismo `core`
ADD-only del Paso 6: no duplica lógica. Lo consumen Claude Code (loopback, 8801) y
claude.ai (túnel y OAuth, memory.enraxk.dev).

Esta es la app PRINCIPAL del proceso: el endpoint MCP va en /mcp y, cuando OAuth esta
activo, las rutas OAuth (/.well-known/oauth-authorization-server, /authorize, /token,
/register, /.well-known/oauth-protected-resource/mcp) cuelgan de la RAIZ del host, que es
donde claude.ai las busca. El visor + CRUD se sirven como custom_route del propio servidor
(mismo proceso, Paso 7 §6).

Herramientas: memory_add/search/get/supersede/tombstone, relation_add/list/tombstone,
memory_stats y system_status. Cada una lleva dos textos a propósito: la `description` del
decorador, que es lo que lee el agente, y el docstring, que es para quien la mantiene.

OAuth: conmutable por env var, y `_build_auth` elige el proveedor.
  OAUTH_ENABLED=0            -> sin auth: el proceso del 8801 (loopback, Claude Code)
  OAUTH_PROVIDER=oidc        -> OIDCProxy contra Pocket-ID: PRODUCCIÓN desde el cutover a CENIT
                               del 17/07/2026, en https://memory.enraxk.dev
  OAUTH_PROVIDER=memory      -> InMemoryOAuthProvider con DCR (validación del flujo, fase 3a)
  cualquier otro valor       -> NaethOAuthProvider (app.oauth), el rollback de la fase 3b
  OAUTH_BASE_URL=<url>       -> issuer/base pública
FastMCP aporta nativamente discovery (RFC 8414/9728), PKCE S256 y el 401 con
`WWW-Authenticate: Bearer resource_metadata=...` que claude.ai exige.

⚠ `naeth-local.enraxk.dev`, que esta cabecera citaba hasta el 13/09/2026, está MUERTO desde el
cutover. Si aparece en algún sitio, ese sitio está desactualizado.
"""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any

from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, Response
from starlette.staticfiles import StaticFiles

from app import core

# Directorio del visor que se sirve en "/". Por defecto el v1 (`app/viewer/index.html`, un HTML
# monolitico y autocontenido), y con NAETH_VIEWER_DIR se apunta al build del v2 (Vite + Svelte),
# que el compose monta en /srv/viewer.
#
# Es una env var y no una constante justo para eso: el rollback del v2 al v1 es quitar la variable
# y recrear el contenedor, sin revertir ni una linea de codigo. El v1 se conserva por lo mismo.
VIEWER_DIR = Path(os.environ.get("NAETH_VIEWER_DIR") or (Path(__file__).resolve().parent / "viewer"))

OAUTH_ENABLED = os.environ.get("OAUTH_ENABLED", "").strip().lower() in ("1", "true", "yes")
OAUTH_BASE_URL = os.environ.get("OAUTH_BASE_URL", "http://127.0.0.1:8800").rstrip("/")
# postgres (Fase 3b, con login) | memory (Fase 3a, validacion del plumbing)
OAUTH_PROVIDER = os.environ.get("OAUTH_PROVIDER", "postgres").strip().lower()

# Reintentos del discovery del IdP. Existen por el incidente del 30/07/2026: `_build_auth()`
# corre al IMPORTAR este modulo, asi que un IdP que no contestaba en ese instante mataba el
# proceso entero. Y como la sonda de salud de la que depende `core owner recover` (CENIT) es
# este mismo proceso, el sistema no podia recuperar el mando: circulo cerrado.
OIDC_DISCOVERY_ATTEMPTS = int(os.environ.get("OIDC_DISCOVERY_ATTEMPTS", "20"))
OIDC_DISCOVERY_DELAY = float(os.environ.get("OIDC_DISCOVERY_DELAY", "1.5"))
OIDC_DISCOVERY_DELAY_MAX = float(os.environ.get("OIDC_DISCOVERY_DELAY_MAX", "15"))


def _retry_discovery(build, *, attempts=None, delay=None, delay_max=None, sleep=time.sleep):
    """Construye el proveedor OIDC reintentando mientras el IdP no conteste.

    Espera exponencial con techo. `sleep` es inyectable para poder testear sin esperas.

    LO QUE ESTO **NO** HACE, y es deliberado: si se agotan los intentos, PROPAGA la
    excepcion en vez de arrancar sin autenticacion. Arrancar sin auth expondria /mcp, que
    es peor que no arrancar. Lo que se compra aqui es tolerancia a que el IdP tarde en
    levantar, no permiso para servir sin el.
    """
    attempts = OIDC_DISCOVERY_ATTEMPTS if attempts is None else attempts
    espera = OIDC_DISCOVERY_DELAY if delay is None else delay
    techo = OIDC_DISCOVERY_DELAY_MAX if delay_max is None else delay_max
    for intento in range(1, attempts + 1):
        try:
            return build()
        except Exception as e:      # cualquier fallo de red o HTTP del IdP
            if intento >= attempts:
                raise
            print(f"[naeth] discovery del IdP fallido ({intento}/{attempts}): "
                  f"{type(e).__name__}: {e}. Reintento en {espera:.1f}s", flush=True)
            sleep(espera)
            espera = min(espera * 2, techo)
    raise AssertionError("inalcanzable: el ultimo intento devuelve o propaga")


def _build_auth():
    """Construye el proveedor de auth de `/mcp` según `OAUTH_ENABLED` y `OAUTH_PROVIDER`, o `None`.

    Returns:
        `None` sin OAuth (el proceso del 8801, loopback); `OIDCProxy` con `oidc`, que es
        producción; `InMemoryOAuthProvider` con `memory` (fase 3a, solo validación); y
        `NaethOAuthProvider` con cualquier otro valor (fase 3b, el rollback).

    Notes:
        CORRE AL IMPORTAR EL MÓDULO (`mcp = FastMCP(..., auth=_build_auth())`), y eso es lo que
        convirtió un IdP lento en el incidente del 30/07/2026: el proceso moría al importar, y como
        la sonda de salud de la que depende `core owner recover` en CENIT es este mismo proceso,
        el sistema no podía recuperar el mando. De ahí `_retry_discovery` y sus tres variables.

        `oidc` es el único camino vivo desde el cutover del 17/07/2026: Naeth deja de ser su
        propio AS, delega el login en Pocket-ID y emite sus propios JWT; claude.ai hace DCR contra
        el proxy, que lo traduce al cliente estático de Pocket-ID. `forward_resource=False` porque
        Pocket-ID no soporta RFC 8707, y el consent lo hace Pocket-ID.
    """
    if not OAUTH_ENABLED:
        return None
    if OAUTH_PROVIDER == "oidc":
        # Fase 4 (CENIT): OIDCProxy contra el IdP central (Pocket-ID). Naeth deja de ser
        # su propio AS: delega el login en Pocket-ID y emite sus PROPIOS JWT (token factory).
        # claude.ai hace DCR contra este proxy, que lo traduce al cliente estatico de Pocket-ID.
        from fastmcp.server.auth import OIDCProxy
        return _retry_discovery(lambda: OIDCProxy(
            config_url=os.environ["OIDC_CONFIG_URL"],          # .well-known de Pocket-ID
            client_id=os.environ["OIDC_CLIENT_ID"],            # cliente cenit-memory
            client_secret=os.environ["OIDC_CLIENT_SECRET"],
            base_url=OAUTH_BASE_URL,                            # https://memory.enraxk.dev
            allowed_client_redirect_uris=[
                "https://claude.ai/api/mcp/auth_callback", "http://localhost:*",
            ],
            require_authorization_consent=False,               # el consent lo hace Pocket-ID
            forward_resource=False,                            # Pocket-ID no soporta RFC 8707
        ))
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
    """Embebe la consulta con el modelo del nodo, o `None` si el modelo no está disponible.

    Notes:
        ⚠ EL FALLO ES SILENCIOSO A PROPÓSITO: cualquier excepción devuelve `None` y `core.search`
        sigue solo con la rama léxica, para que una búsqueda nunca falle por el modelo. El precio
        es que `memory_search` no le dice al agente si buscó en híbrido o degradado; `/api/search`
        sí devuelve `mode`. Anotado el 10/09/2026 en el discovery de CodeDoc Archive.
    """
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
# Fase 4. Mismo interruptor y mismo ciclo de vida que el de arriba, a proposito.
DIGEST_ENFORCE = os.environ.get("NAETH_DIGEST_ENFORCE", "warn").strip().lower()    # warn|strict

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
    """El AccessToken de la petición MCP en curso, o `None` en loopback o si el SDK no lo expone."""
    try:
        # El SDK devuelve el AccessToken sin la validacion de tipo de FastMCP (que lo
        # rechaza al usar un AS propio / OIDCProxy).
        from mcp.server.auth.middleware.auth_context import get_access_token
        return get_access_token()
    except Exception:  # noqa: BLE001
        return None


def _authorship(agent_model: str | None = None,
                agent_vendor: str | None = None) -> dict[str, Any]:
    """Compone el `author` de una escritura MCP: producto, superficie, zona, actor, vendor y modelo.

    Args:
        agent_model: el modelo que el agente declara (`claude-opus-5`); nadie lo transmite por él.
        agent_vendor: opcional; si falta y el modelo empieza por `claude`, se asume `anthropic`.

    Returns:
        El dict que `memory.author` guarda, con `model_source` `declared` o `undeclared` y el
        `clientInfo` crudo en `client_raw` para poder reclasificar sin perder nada.

    Notes:
        Cada eje tiene una procedencia distinta y por eso van separados (Paso 10): `product`
        sale del `clientInfo` del handshake (lo pone la app, es verificable), `surface` del `?s=`
        del conector (lo fija la config), `zone` de si hay token OAuth (público) o no (loopback),
        y `vendor` y `model` los declara el agente, que es la única fuente que existe para ellos.
    """
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


def _enforce_digest(digest: str | None) -> None:
    """En 'strict' rechaza (instructivo) si no se paso digest. En 'warn' pasa.

    NACE EN 'warn' Y NO EN 'strict', y lo decide el precedente medido de arriba, no el gusto:
    AUTHORSHIP_ENFORCE lleva un mes pidiendo agent_model SIN obligarlo, y se cumple (julio
    119/129, agosto 343/343). Un parametro opcional que la descripcion de la tool pide se cumple.
    Y la asimetria remata: en 'strict' una llamada sin digest PIERDE LA ESCRITURA, que es un dato
    perdido; en 'warn' deja un NULL, que el backfill recoge. Se endurece cuando 4.7 termine.
    """
    if DIGEST_ENFORCE == "strict" and not (digest or "").strip():
        raise ValueError(
            "Naeth exige un digest: dos o tres frases (300 caracteres como maximo) que digan QUE "
            "AFIRMA la nota, no de que va. Es lo que devuelve memory_search.")


# ================================================================ herramientas MCP
@mcp.tool(name="memory_add",
          description="Save / store / remember a new persistent memory in Naeth "
                      "(append-only). Queues its embedding. Idempotent by content. Use "
                      "when asked to remember or note a fact, decision, observation or "
                      "preference. Pass agent_model with the model you are running as "
                      "(e.g. 'claude-opus-4-8') so Naeth records who wrote it. ALWAYS pass "
                      "digest: 2-3 sentences, 300 characters max, saying what the note "
                      "ASSERTS, not what it is about. memory_search returns the digest "
                      "instead of the full text, so a note without one is much harder to "
                      "find and judge later.")
async def memory_add(content: str, title: str | None = None,
               memory_type: str = "observation", tags: list[str] | None = None,
               path: str | None = None, agent_model: str | None = None,
               agent_vendor: str | None = None,
               digest: str | None = None) -> dict[str, Any]:
    """Alta de memoria por MCP: compone la autoría, aplica los dos enforce y delega en `core.add`.

    La `description` del decorador es el contrato con el agente; esto es para quien la mantiene.

    Returns:
        `id`, `created`, `title`, `memory_type`, `author` y `digest` de la fila.

    Raises:
        ValueError: instructivo, si falta `agent_model` o `digest` con los enforce en `strict`.

    Notes:
        ⚠ SI `created` ES `False`, LA FILA YA EXISTÍA Y EL DIGEST ENVIADO NO SE GUARDA: la
        idempotencia de `core.add` es por `content_hash` de título y contenido, y el digest no
        entra en el hash. Para ponérselo a una fila que ya existe, `memory_supersede`.

        El orden de los enforce es modelo y luego digest, los dos antes de tocar la base: una
        llamada rechazada no deja nada escrito.
    """
    author = _authorship(agent_model, agent_vendor)
    _enforce_model(author)
    _enforce_digest(digest)
    r = core.add(content, title=title, memory_type=memory_type, tags=tags,
                 path=path, source_client=_source_client(author), author=author,
                 digest=digest)
    m = r["memory"]
    return {"id": str(m["id"]), "created": r["created"], "title": m["title"],
            "memory_type": m["memory_type"], "author": m.get("author"),
            "digest": m.get("digest")}


def _resumen(h: dict[str, Any]) -> tuple[str | None, str]:
    """(texto, procedencia) del resumen de un resultado. `written` o `excerpt`.

    El par campo + procedencia esta calcado de `model`/`model_source` del Paso 10, y por lo mismo:
    un valor escrito a mano y uno derivado por la maquina NO son la misma cosa, y quien los lee
    tiene que poder distinguirlos SIN adivinar. Un recorte se corta a mitad de idea pero sigue
    pareciendo un resumen; si viajara como `digest` a secas, mentiria por omision.

    EL RECORTE SE QUEDA, y el plan de la fase decia retirarlo al cerrar el backfill (hecho el
    30/08/2026, 479 de 479). Se conserva porque su razon de ser CAMBIO: nacio como muleta del
    backfill y hoy es la DEGRADACION de una nota que llegue sin digest. Con
    NAETH_DIGEST_ENFORCE=strict eso ya no puede pasar por MCP, pero el visor escribe por /api,
    donde el campo es opcional: sin recorte, una nota guardada ahi con el campo vacio saldria en
    memory_search sin digest Y sin content, o sea invisible. Con recorte sale un extracto marcado
    como `excerpt`, que no engana a nadie. Cambiar un hueco por una nota invisible es peor.
    """
    d = (h.get("digest") or "").strip()
    if d:
        return d, "written"
    txt = (h.get("content") or "").strip()
    if len(txt) <= core.DIGEST_MAX:
        return (txt or None), "excerpt"
    # Se corta en el ultimo espacio para no partir una palabra por la mitad.
    corte = txt[:core.DIGEST_MAX]
    esp = corte.rfind(" ")
    return (corte[:esp] if esp > core.DIGEST_MAX // 2 else corte).rstrip() + "...", "excerpt"


def _hit(h: dict[str, Any]) -> dict[str, Any]:
    """Un resultado de busqueda tal como sale por MCP. SIN `content`, que es el cambio de la fase 4.

    ⚠ Quien recorta es ESTA capa, no `core.search`, que sigue devolviendo la fila entera: la ruta
    /api/search del visor la consume tal cual y se romperia. El coste de contexto que la fase viene
    a bajar esta aqui, en lo que cruza al agente, no en lo que la base devuelve.
    """
    texto, origen = _resumen(h)
    return {"id": str(h["id"]), "title": h["title"],
            "digest": texto, "digest_source": origen,
            "path": h.get("path"), "memory_type": h["memory_type"], "tags": h["tags"],
            "created_at": str(h["created_at"]) if h.get("created_at") else None,
            "score": float(h["score"]) if h.get("score") else None}


@mcp.tool(name="memory_search",
          description="Retrieve / recall persistent memory from Naeth: look up prior "
                      "context about the user's projects, decisions, configs and "
                      "preferences. ENTRY tool -- call before answering about those "
                      "topics. Hybrid search (semantic + lexical, RRF) over current "
                      "memories; returns the top-k most relevant. Optional filters "
                      "narrow the search BEFORE ranking, which is the cheapest way to "
                      "improve recall: path_prefix ('naeth/' or 'naeth/core'), tags "
                      "(must have ALL of them), memory_type (fact|decision|observation|"
                      "preference) and since (ISO date, only memories created after). "
                      "RETURNS A SHORT DIGEST, NOT THE FULL TEXT: this is a map, not the "
                      "ground. When a result looks like the answer, or when the digest "
                      "is not enough to be sure, CALL memory_get WITH ITS id to read the "
                      "whole note before relying on it -- do not answer from the digest "
                      "alone on anything that matters. digest_source tells you what you "
                      "are reading: 'written' is a hand-written summary; 'excerpt' is the "
                      "first ~300 characters of the note, cut off mid-idea, so it is a "
                      "much weaker signal and memory_get is nearly always needed.")
def memory_search(query: str, k: int = 10, path_prefix: str | None = None,
                  tags: list[str] | None = None, memory_type: str | None = None,
                  since: str | None = None) -> list[dict[str, Any]]:
    """La tool de entrada: `core.search` con la consulta embebida, y cada hit recortado a su digest.

    La `description` del decorador es lo que lee el agente y se mantiene ahí; esto es para quien
    mantiene la tool. Embebe la consulta con `_embed_query`, pasa los cuatro filtros a
    `core.search`, y reduce cada fila con `_hit`, que quita `content` y deja `digest` más
    `digest_source`.

    Args:
        query: texto de la consulta; se embebe y se pasa tal cual a la rama léxica.
        k: tope de resultados. Las dos ramas internas siguen recogiendo 50 cada una.
        path_prefix: acota por prefijo de `path`, dentro de cada rama.
        tags: la nota tiene que llevar todos.
        memory_type: uno de los cuatro del vocabulario.
        since: fecha ISO; solo memorias creadas después.

    Returns:
        Lista de hits sin `content`, ordenados por score RRF.

    Notes:
        POR QUÉ DEVUELVE EL DIGEST Y NO EL TEXTO (fase 4, 28/08/2026): con `k=10` y una media
        de 2.686 caracteres por nota, la respuesta pesaba unos 27.000 caracteres; con título y
        digest, unos 3.800. Un 86% menos de contexto en la llamada más frecuente.

        Los filtros van a `core.search` y no se aplican aquí porque filtrar sobre el resultado
        dejaría las 50 plazas de cada rama ocupadas por lo de siempre. Ver `core.search`.

        ⚠ SI EL MODELO NO ESTÁ DISPONIBLE, LA BÚSQUEDA CAE A LÉXICA EN SILENCIO: `_embed_query`
        devuelve `None` ante cualquier excepción. La ruta `/api/search` del visor sí reporta
        `mode`; esta tool no, así que el agente no distingue una búsqueda híbrida de una
        degradada. Si un día importa, el sitio es el dict de `_hit`.

        ⚠ LA RAMA LÉXICA NO TOKENIZA COMO UNO ESPERA: `tsvector` con configuración `simple`,
        sin stemmer ni stopwords, y un identificador con punto es un solo token. Buscar
        `execute` no encuentra `c.execute(sql)`. Medido el 10/09/2026.
    """
    hits = core.search(query, k=k, q_embedding=_embed_query(query),
                       path_prefix=path_prefix, tags=tags,
                       memory_type=memory_type, since=since)
    return [_hit(h) for h in hits]


@mcp.tool(name="memory_get",
          description="Open / read the full detail of a single Naeth memory by id, "
                      "including its version chain (supersession / history).")
def memory_get(memory_id: str) -> dict[str, Any]:
    """El terreno: la nota entera por id, con `is_current` y su cadena de supersesión.

    Returns:
        `content` completo, tipo, tags, path, autoría y la lista de pares `child`/`parent` de
        `supersession` en los que participa; o `{"error": "no encontrado"}` si el id no existe.

    Notes:
        Devuelve versiones no vigentes si se piden por id: `is_current` dice cuál es el caso, y
        la cadena permite llegar a la vigente. Es el único camino al histórico, porque
        `memory_search` busca solo sobre `memory_current`.

        ⚠ LO QUE NO DEVUELVE: `digest` ni `metadata`, aunque existan en la fila. Anotado el
        10/09/2026 en el discovery de CodeDoc Archive; entra en su fase 2.
    """
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
                      "'claude-opus-4-8') so Naeth records who wrote it. ALWAYS pass a "
                      "digest describing the NEW content (2-3 sentences, 300 chars max): "
                      "it is NOT inherited from the parent on purpose, because a digest "
                      "written for the old text would describe the wrong version.")
async def memory_supersede(parent_id: str, content: str, title: str | None = None,
                     memory_type: str = "observation",
                     tags: list[str] | None = None, path: str | None = None,
                     agent_model: str | None = None,
                     agent_vendor: str | None = None,
                     digest: str | None = None) -> dict[str, Any]:
    """Versión nueva de una memoria por MCP: mismos enforce que `memory_add`, y delega en `core.supersede`.

    Returns:
        `id` de la versión nueva, `supersedes` con el id del padre, `title` y `digest`.

    Raises:
        ValueError: instructivo, si falta `agent_model` o `digest` con los enforce en `strict`.

    Notes:
        ⚠ NADA SE HEREDA DEL PADRE: ni título, ni tipo, ni tags, ni path, ni digest. Lo que no
        viaje en la llamada queda en su valor por defecto (`memory_type` vuelve a `observation`).
        Es deliberado en `core.supersede`, y para el digest tiene razón propia: uno heredado
        describiría el texto anterior. Quien edite tiene que reenviar todos los campos.
    """
    author = _authorship(agent_model, agent_vendor)
    _enforce_model(author)
    _enforce_digest(digest)
    r = core.supersede(parent_id, content, title=title, memory_type=memory_type,
                       tags=tags, path=path, source_client=_source_client(author),
                       author=author, digest=digest)
    m = r["memory"]
    return {"id": str(m["id"]), "supersedes": parent_id, "title": m["title"],
            "digest": m.get("digest")}


@mcp.tool(name="memory_tombstone",
          description="Delete / retire / forget a Naeth memory logically (append-only): "
                      "it stops being current but stays in history. No physical deletion.")
async def memory_tombstone(memory_id: str) -> dict[str, Any]:
    """Retira una memoria: INSERT en `tombstone`, la fila se queda. Firma con la autoría de la llamada."""
    return core.tombstone(memory_id, source_client=_source_client(_authorship()))


@mcp.tool(name="relation_add",
          description="Link / connect / relate two Naeth memories with an explicit graph "
                      "edge (predicate: links_to, depends_on, derived_from, "
                      "supersedes...). For cross-cutting links the path tree can't express.")
async def relation_add(source_id: str, target_id: str, predicate: str) -> dict[str, Any]:
    """Crea una arista explícita entre dos memorias, con el predicado tal cual llega.

    Notes:
        ⚠ EL PREDICADO ES TEXTO LIBRE: ni aquí ni en la base hay CHECK. La convención dice cuatro
        (`links_to`, `depends_on`, `derived_from`, `supersedes`) y el corpus tiene cinco en uso:
        `tested_by` entró por esta puerta. Medido el 10/09/2026.
    """
    return core.relation_add(source_id, target_id, predicate,
                             source_client=_source_client(_authorship()))


@mcp.tool(name="relation_list",
          description="List the current relations / links / edges of a Naeth memory "
                      "(incoming and outgoing). Follows the supersession chain, so edges "
                      "survive when an endpoint is superseded.")
def relation_list(memory_id: str) -> list[dict[str, Any]]:
    """Relaciones vigentes de una memoria en las dos direcciones, resueltas por `core.relation_list` a lo largo de su cadena."""
    return core.relation_list(memory_id)


@mcp.tool(name="relation_tombstone",
          description="Remove / retract / delete a graph edge (relation) between two Naeth "
                      "memories (append-only: it stops appearing but stays in history). "
                      "Pass the relation id returned by relation_list.")
async def relation_tombstone(relation_id: str) -> dict[str, Any]:
    """Retira una arista: el mismo `core.tombstone` que las memorias, con `target_kind='relation'`."""
    return core.tombstone(relation_id, target_kind="relation",
                          source_client=_source_client(_authorship()))


@mcp.tool(name="memory_stats",
          description="Introspect the Naeth corpus itself: how it is distributed, or what is "
                      "wrong with it. Use for INVENTORY questions that search cannot answer "
                      "('how many notes per project', 'which ones have no title', 'which "
                      "wikilinks are broken'). mode='counts' groups by project, path, type, tag, "
                      "author and month; mode='hygiene' lists notes with no title, no tags, no "
                      "path, no relations, broken wikilinks, long version chains and paths that "
                      "look like a typo of an existing subtopic. Returns COUNTS plus a capped "
                      "sample, never the full rows: use memory_search with filters for detail.")
def memory_stats(mode: str = "counts", limit: int = 15) -> dict[str, Any]:
    """Inventario del corpus: valida `mode` y delega en `core.stats`, que devuelve recuentos y no filas.

    Args:
        mode: `counts` (cómo está repartido) o `hygiene` (qué está mal); otro valor devuelve un
            dict de error en vez de levantar, para que el agente lea el motivo.
        limit: tope de cada muestra o agrupado.
    """
    if mode not in ("counts", "hygiene"):
        return {"error": "mode debe ser 'counts' o 'hygiene'", "recibido": mode}
    return core.stats(mode=mode, limit=limit)


@mcp.tool(name="system_status",
          description="Health / status / diagnostics of the Naeth node: memory counts, "
                      "embedding queue, active model and dimension. Check that Naeth is "
                      "alive and healthy.")
def system_status() -> dict[str, Any]:
    """Salud del nodo (`core.status`: conteos, cola de embeddings, modelo) más el desglose de autoría."""
    return {**core.status(), "authors": core.authors()}


# ================================================================ visor + CRUD (HTTP)
# Mismo proceso (Paso 7 §6). El visor es local; estas rutas no exigen OAuth (solo /mcp).
@mcp.custom_route("/", methods=["GET"])
async def index(request: Request) -> Response:
    """Sirve el `index.html` del visor que apunte `VIEWER_DIR`: el v2 de Vite o, sin la variable, el v1."""
    return FileResponse(str(VIEWER_DIR / "index.html"))


@mcp.custom_route("/healthz", methods=["GET"])
async def healthz(request: Request) -> Response:
    """Sonda de vida del proceso: 200 con el modelo y el estado de OAuth, sin tocar la base.

    Notes:
        Dice que el proceso responde, no que la base o el modelo funcionen: para eso está
        `system_status`. Es lo que un healthcheck externo consulta para decidir si el proceso
        vive, y por eso un fallo al importar el módulo (ver `_build_auth`) lo deja sin respuesta.
    """
    return JSONResponse({"ok": True, "model": os.environ.get("EMBED_MODEL"),
                         "mcp": "/mcp",
                         "oauth": "enabled" if OAUTH_ENABLED else "disabled",
                         "oauth_provider": OAUTH_PROVIDER if OAUTH_ENABLED else None,
                         "oauth_base_url": OAUTH_BASE_URL if OAUTH_ENABLED else None})


# Login de 1 usuario (Fase 3b). Solo relevante con OAuth Postgres; el authorize() del
# provider redirige aqui. Inofensivo si OAuth esta off (nadie llega).
@mcp.custom_route("/login", methods=["GET"])
async def login_get_route(request: Request) -> Response:
    """Formulario de login del proveedor propio (`app.oauth`). Montado siempre; con `oidc` nadie llega."""
    from app.oauth import login_get
    return await login_get(request)


@mcp.custom_route("/login", methods=["POST"])
async def login_post_route(request: Request) -> Response:
    """Envío del login del proveedor propio (`app.oauth`). Con `oidc` responde 400 siempre: no hay pendings."""
    from app.oauth import login_post
    return await login_post(request)


@mcp.custom_route("/api/status", methods=["GET"])
async def api_status(request: Request) -> Response:
    """`core.status` para el visor: conteos, cola de embeddings y modelo activo."""
    return JSONResponse(_json(core.status()))


@mcp.custom_route("/api/tree", methods=["GET"])
async def api_tree(request: Request) -> Response:
    """Las memorias vigentes como filas de árbol (`core.tree`): id, título, tipo, path, tags y fecha, sin contenido."""
    return JSONResponse(_json(core.tree()))


@mcp.custom_route("/api/authors", methods=["GET"])
async def api_authors(request: Request) -> Response:
    """Desglose de autoría de lo vigente (`core.authors`), para el visor y para `system_status`."""
    return JSONResponse(_json(core.authors()))


@mcp.custom_route("/api/memory", methods=["POST"])
async def api_add(request: Request) -> Response:
    """Alta desde el visor: 400 sin `content`; firma como humano (`_HUMAN_AUTHOR`) y no aplica ningún enforce.

    Notes:
        Escribir desde el visor firma como humano aunque escriba un agente, porque el visor no
        tiene forma de saber quién teclea. Y el digest es opcional por aquí: una nota que entre
        sin él sale en `memory_search` con un `excerpt`, ver `_resumen`.
    """
    b = await request.json()
    if not b.get("content"):
        return JSONResponse({"error": "content requerido"}, status_code=400)
    r = core.add(b["content"], title=b.get("title"),
                 memory_type=b.get("memory_type", "observation"),
                 tags=b.get("tags"), path=b.get("path"), source_client="web",
                 author=_HUMAN_AUTHOR, digest=b.get("digest"))
    return JSONResponse(_json(r))


@mcp.custom_route("/api/memory/{memory_id}", methods=["GET"])
async def api_get(request: Request) -> Response:
    """La fila entera de `core.get` para el visor, con `metadata` y `digest` incluidos, y su cadena."""
    res = core.get(request.path_params["memory_id"])
    return JSONResponse(_json(res or {"error": "no encontrado"}))


@mcp.custom_route("/api/memory/{memory_id}/supersede", methods=["POST"])
async def api_supersede(request: Request) -> Response:
    """Versión nueva desde el editor del visor, firmada como humano.

    Notes:
        EL EDITOR MANDA TODOS LOS CAMPOS, también los que no tocó: `core.supersede` no hereda
        nada del padre, así que si un campo no viajara aquí, editar el texto borraría el tipo,
        los tags, el path, la `metadata` o el digest. El digest se manda siempre por eso mismo.
    """
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
        # El editor lo manda SIEMPRE, incluso sin tocarlo: `core.supersede` no hereda del padre,
        # asi que si no viajara aqui, editar una memoria desde el visor le borraria el digest.
        digest=b.get("digest"),
        source_client="web",
        author=_HUMAN_AUTHOR,
    )
    return JSONResponse(_json(r))


@mcp.custom_route("/api/memory/{memory_id}", methods=["DELETE"])
async def api_delete(request: Request) -> Response:
    """Retirada desde el visor: `core.tombstone`, la fila se queda."""
    return JSONResponse(_json(core.tombstone(request.path_params["memory_id"],
                                             source_client="web")))


@mcp.custom_route("/api/search", methods=["GET"])
async def api_search(request: Request) -> Response:
    """Búsqueda para el visor: `q`, `k` y `semantic=false` para forzar léxica; devuelve las filas enteras.

    Notes:
        Al contrario que `memory_search`, aquí sí viaja `mode` (`hybrid` o `lexical`), y los hits
        son las filas completas de `core.search`, con `content`: el visor las consume tal cual.

        ⚠ LO QUE NO PASA: ninguno de los cuatro filtros de `core.search` (`path_prefix`, `tags`,
        `memory_type`, `since`). El visor no puede acotar una búsqueda. Anotado el 10/09/2026;
        entra en la fase 2 de CodeDoc Archive.
    """
    q = request.query_params.get("q", "")
    k = int(request.query_params.get("k", "10"))
    semantic = request.query_params.get("semantic", "true").lower() != "false"
    q_emb = _embed_query(q) if semantic else None
    return JSONResponse({"query": q, "mode": "hybrid" if q_emb else "lexical",
                         "hits": _json(core.search(q, k=k, q_embedding=q_emb))})


# --- Relaciones del grafo (compartido por editor [[ ]] + Fase 0 DnD/menu) ---
@mcp.custom_route("/api/relation", methods=["POST"])
async def api_relation_add(request: Request) -> Response:
    """Arista desde el visor (editor de wikilinks y arrastrar en el grafo): 400 sin los dos extremos; predicado `links_to` por defecto."""
    b = await request.json()
    if not b.get("source_id") or not b.get("target_id"):
        return JSONResponse({"error": "source_id y target_id requeridos"}, status_code=400)
    r = core.relation_add(b["source_id"], b["target_id"],
                          b.get("predicate", "links_to"), source_client="web")
    return JSONResponse(_json(r))


@mcp.custom_route("/api/memory/{memory_id}/relations", methods=["GET"])
async def api_relations(request: Request) -> Response:
    """Relaciones vigentes de una memoria para la ficha del visor, resueltas por `core.relation_list`."""
    return JSONResponse(_json(core.relation_list(request.path_params["memory_id"])))


# --- Grafo (Paso 5.4) ---
# Dos rutas y no una: el kNN global del corpus entero tarda 2,7 s medidos, asi que meterlo en
# /api/graph seria pagarlo entero incluso con la capa semantica apagada. Ver core.graph_knn.
@mcp.custom_route("/api/graph", methods=["GET"])
async def api_graph(request: Request) -> Response:
    """El grafo para el visor: un conteo de nodos, las aristas resueltas y los wikilinks en bruto.

    Returns:
        `nodes` (cuántas vigentes hay, no cuáles), `edges` de `core.graph_edges` y `links` de
        `core.graph_links`.

    Notes:
        `nodes` ES UN CONTEO Y NO LA LISTA: el visor ya tiene el árbol entero cargado y
        autorrefrescado, y repetir aquí las filas duplicaría unos 150 kB y crearía dos fuentes
        de verdad para el título de un nodo. El número sirve para que la vista detecte que su
        árbol está desfasado y lo recargue. Consecuencia para CodeDoc Archive: los bloques de
        código entran al grafo por el árbol, no por aquí.

        El kNN semántico va en `/api/graph/knn` y no aquí porque el global tarda 2,7 segundos
        medidos (`core.graph_knn`), y se pagaría entero aunque la capa esté apagada.
    """
    # `nodes` es un CONTEO y no la lista: el visor ya tiene el arbol completo cargado y
    # autorrefrescado, asi que repetir aqui las 520 filas duplicaria unos 150 kB y crearia dos
    # fuentes de verdad para el titulo de un nodo. El numero sirve para que la vista detecte que
    # su arbol esta desfasado respecto al grafo y lo recargue.
    with core.conn() as c:
        n = c.execute("SELECT count(*) AS n FROM memory_current").fetchone()["n"]
    return JSONResponse(_json({"nodes": n,
                               "edges": core.graph_edges(),
                               "links": core.graph_links()}))


@mcp.custom_route("/api/graph/knn", methods=["GET"])
async def api_graph_knn(request: Request) -> Response:
    """Los `k` vecinos semánticos de una memoria (`core.graph_knn`), con `k` entre 1 y 20; 400 sin `id`.

    Notes:
        El tope de 20 no es paranoia: sin él, un `k=500` convierte una consulta de 16 ms en
        segundos, y la vista solo ofrece de 0 a 8 porque por encima el vecindario no se lee.
    """
    mid = request.query_params.get("id", "")
    if not mid:
        return JSONResponse({"error": "id requerido"}, status_code=400)
    # El tope no es paranoia: sin el, un `k=500` convierte una consulta de 16 ms en segundos, y
    # la vista solo ofrece de 0 a 8 porque por encima el vecindario deja de leerse.
    k = max(1, min(int(request.query_params.get("k", "8")), 20))
    return JSONResponse(_json({"id": mid, "neighbors": core.graph_knn(mid, k)}))


@mcp.custom_route("/api/relation/{relation_id}", methods=["DELETE"])
async def api_relation_del(request: Request) -> Response:
    """Retirada de una arista desde el visor: `core.tombstone` con `target_kind='relation'`."""
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

# Estaticos del visor v2. El v1 era un HTML unico con todo inline, asi que la ruta "/" bastaba;
# un build de Vite pide ademas /assets/index-<hash>.js y .css, y hasta hoy eso devolvia 404 en los
# dos puertos. De ahi que "ajustar el custom_route" no bastara para desplegarlo.
#
# Se monta SOLO si el directorio existe, y las dos mitades de esa condicion importan:
#
#   - Sin el `if`, StaticFiles valida el directorio al CONSTRUIRSE (a nivel de modulo) y un clon sin
#     build tumbaria el import entero. Es el patron del incidente del 30/07/2026 con el discovery
#     del IdP: fallar al importar deja el proceso muerto y cierra el circulo de recuperacion de
#     CENIT. Por eso ademas `check_dir=False`, como segunda red.
#   - Y con `check_dir=False` PERO sin el `if`, la ruta existe pero revienta al primer GET: medido,
#     devolvia 500 donde antes habia un 404 limpio. Un 500 es una alarma falsa en produccion.
#
# Asi, sin build no hay ruta y /assets/* cae en el 404 de siempre; con build, se sirve.
#
# No hace falta un catch-all que devuelva index.html: el router del visor es por HASH (#/m/<id>),
# asi que las unicas rutas que pide el navegador son "/" y /assets/*. Un catch-all solo taparia
# los 404 legitimos de la API.
_ASSETS_DIR = VIEWER_DIR / "assets"
if _ASSETS_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=_ASSETS_DIR, check_dir=False), name="assets")
