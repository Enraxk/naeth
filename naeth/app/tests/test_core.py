"""Tests del nucleo ADD-only de Naeth (Paso 6).

Fase 1: caracterizacion del comportamiento ya existente (red de seguridad).
Fase 2: los gaps del grafo (relaciones y supersession) -> rojos hasta los fixes 3 y 4.
"""
from __future__ import annotations

from app import core


def _ids(rows):
    return [str(r["id"]) for r in rows]


# ============================================================
# Fase 1 - caracterizacion (deben pasar con el codigo actual)
# ============================================================
def test_add_es_idempotente():
    r1 = core.add("hola mundo", title="t")
    assert r1["created"] is True
    r2 = core.add("hola mundo", title="t")
    assert r2["created"] is False
    assert r1["memory"]["id"] == r2["memory"]["id"]


def test_supersede_cambia_lo_vigente():
    a = core.add("primera version unica", title="t")["memory"]
    b = core.supersede(str(a["id"]), "segunda version unica", title="t")["memory"]
    # la nueva es vigente y recuperable
    assert str(b["id"]) in _ids(core.search("segunda"))
    # la vieja ya no es vigente
    assert str(a["id"]) not in _ids(core.search("primera"))


def test_tombstone_memory_la_retira():
    a = core.add("borrame del todo", title="t")["memory"]
    assert str(a["id"]) in _ids(core.search("borrame"))
    core.tombstone(str(a["id"]))
    assert str(a["id"]) not in _ids(core.search("borrame"))


def test_relation_add_y_list_basico():
    a = core.add("nodo alfa")["memory"]
    b = core.add("nodo beta")["memory"]
    core.relation_add(str(a["id"]), str(b["id"]), "links_to")
    out = core.relation_list(str(a["id"]))
    assert len(out) == 1
    assert out[0]["direction"] == "out"
    assert out[0]["target_id"] == str(b["id"])
    inb = core.relation_list(str(b["id"]))
    assert len(inb) == 1
    assert inb[0]["direction"] == "in"


# ============================================================
# Fase 2 - gaps (rojos hasta los fixes)
# ============================================================
def test_relation_tombstone_retira_la_arista():
    """Gap 2: poder retirar una relacion (core ya lo soporta via target_kind)."""
    a = core.add("a")["memory"]
    b = core.add("b")["memory"]
    rel = core.relation_add(str(a["id"]), str(b["id"]), "links_to")
    core.tombstone(rel["id"], target_kind="relation")
    assert core.relation_list(str(a["id"])) == []


def test_relacion_sigue_la_supersession():
    """Gap 1: si superseo un extremo, la relacion debe verse desde la version vigente."""
    a = core.add("origen")["memory"]
    b = core.add("destino v1")["memory"]
    core.relation_add(str(a["id"]), str(b["id"]), "links_to")
    b2 = core.supersede(str(b["id"]), "destino v2")["memory"]

    out = core.relation_list(str(b2["id"]))
    assert len(out) == 1, "la relacion deberia seguir a la version vigente"
    # normalizada: el extremo apunta a la version vigente, no a la vieja
    assert out[0]["source_id"] == str(a["id"])
    assert out[0]["direction"] == "in"


def test_relaciones_se_deduplican_tras_supersession():
    """Gap 1: relacion vieja (a la version antigua) + re-creada (a la nueva) colapsan a una."""
    a = core.add("origen unico")["memory"]
    b = core.add("destino antiguo")["memory"]
    core.relation_add(str(a["id"]), str(b["id"]), "links_to")  # a -> b (vieja)
    b2 = core.supersede(str(b["id"]), "destino nuevo")["memory"]
    core.relation_add(str(a["id"]), str(b2["id"]), "links_to")  # a -> b2 (re-creada)

    out = core.relation_list(str(a["id"]))
    assert len(out) == 1, "vieja y re-creada deben verse como una sola, normalizadas a vigente"
    assert out[0]["target_id"] == str(b2["id"])


# ============================================================
# Paso 10 - autoria explicita
# ============================================================
_AUTHOR = {"product": "claude-code", "surface": "desktop", "zone": "loopback",
           "actor": "agent", "vendor": "anthropic", "model": "claude-opus-4-8",
           "model_source": "declared", "client_raw": {"name": "claude-code"}}


def test_add_guarda_author_y_columnas_generadas():
    m = core.add("nota con autoria", title="a10", author=_AUTHOR)["memory"]
    assert m["author"]["model"] == "claude-opus-4-8"
    # las columnas GENERATED se derivan del jsonb
    assert m["author_product"] == "claude-code"
    assert m["author_surface"] == "desktop"
    assert m["author_model"] == "claude-opus-4-8"


def test_add_sin_author_default_vacio():
    m = core.add("nota sin autoria", title="a10b")["memory"]
    assert m["author"] == {}
    assert m["author_product"] is None


def test_supersede_conserva_author_de_la_version_nueva():
    a = core.add("v1 autor", title="a10c")["memory"]
    otro = {**_AUTHOR, "surface": "vscode", "model": "claude-sonnet-5"}
    b = core.supersede(str(a["id"]), "v2 autor", title="a10c", author=otro)["memory"]
    assert b["author_surface"] == "vscode"
    assert b["author_model"] == "claude-sonnet-5"


def test_product_from_client_name_valores_reales():
    """Valores REALES medidos de clientInfo.name (2026-07-21). El de claude.ai
    ('Anthropic/ClaudeAI') rompio el mapeo inicial: no lleva guion ni punto."""
    from app.mcp_server import _product_from_client_name as p
    assert p("Anthropic/ClaudeAI") == "claude-ai"      # claude.ai + app Claude Desktop
    assert p("claude-code") == "claude-code"           # Claude Code (terminal / VS Code)
    assert p("Claude Code (naeth)") == "claude-code"   # nombre DCR viejo del historico
    assert p("Claude") == "claude-ai"                  # historico pre-CENIT
    assert p("") == "unknown"
    assert p(None) == "unknown"
    assert p("otro-cliente") == "otro-cliente"         # desconocido: crudo, reclasificable


def test_authors_desglosa_por_autor():
    core.add("por opus", title="d1", author=_AUTHOR)
    core.add("por sonnet", title="d2",
             author={**_AUTHOR, "surface": "vscode", "model": "claude-sonnet-5"})
    ags = core.authors()
    by_model = {a["model"]: a for a in ags}
    assert by_model["claude-opus-4-8"]["surface"] == "desktop"
    assert by_model["claude-sonnet-5"]["surface"] == "vscode"
