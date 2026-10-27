# Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
# No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE
"""Tests de la tool MCP `memory_batch` (N2, 27/10/2026), la fachada de `core.batch`.

Fijan la autoría (D1: el modelo que redactó el informe más `client_raw.via`), el enforce del
modelo antes de tocar la base, y que `dry_run` valida contra la base sin dejar nada escrito ni
gastar el `batch_id`.

Punto ciego: la tool se llama como función, fuera de una petición MCP, así que `product`,
`surface` y `zone` salen de los valores por defecto (`unknown`, `None`, `loopback`). No prueban
el esquema JSON que FastMCP publica, ni la llamada real desde el panel con `$.mcp.call` (eso es E0).
"""
from __future__ import annotations

import asyncio
import uuid

import pytest

from app import core
from app import mcp_server as ms
from app.tests.test_batch import _count, _get, _note, _status

MODEL = "claude-opus-5-5"


def _call(**kw):
    return asyncio.run(ms.memory_batch(**kw))


def test_escribe_el_lote_con_el_modelo_declarado_y_la_marca_del_panel():
    r = _call(batch_id=str(uuid.uuid4()), notes=[_note("#1", "uno", "contenido uno")],
              status=_status("escrito: {{#1}}"), agent_model=MODEL, via="edm-approve")
    assert r["replayed"] is False and r["dry_run"] is False
    for mid in (r["ids"]["#1"], r["status_id"]):
        author = _get(mid)["author"]
        assert author["model"] == MODEL and author["model_source"] == "declared"
        assert author["vendor"] == "anthropic"
        assert author["client_raw"]["via"] == "edm-approve"


def test_sin_via_la_autoria_es_la_de_cualquier_escritura_mcp():
    r = _call(batch_id=str(uuid.uuid4()), notes=[_note("#1", "uno", "x")], agent_model=MODEL)
    assert "via" not in _get(r["ids"]["#1"])["author"]["client_raw"]


def test_una_via_que_no_es_kebab_case_se_rechaza():
    with pytest.raises(ValueError, match="via"):
        _call(batch_id=str(uuid.uuid4()), notes=[_note("#1", "uno", "x")],
              agent_model=MODEL, via="Panel EDM")
    assert _count("memory") == 0


def test_en_strict_sin_modelo_se_rechaza_antes_de_tocar_la_base(monkeypatch):
    monkeypatch.setattr(ms, "AUTHORSHIP_ENFORCE", "strict")
    with pytest.raises(ValueError, match="agent_model"):
        _call(batch_id=str(uuid.uuid4()), notes=[_note("#1", "uno", "x")])
    assert _count("memory") == 0


def test_dry_run_recorre_el_lote_entero_y_no_deja_nada_escrito():
    viejo = core.add("estado anterior", title="demo · estado", path="demo/status")["memory"]
    antes = (_count("memory"), _count("relation"), _count("job"))
    r = _call(batch_id=str(uuid.uuid4()), dry_run=True, agent_model=MODEL,
              notes=[_note("#1", "uno", "x"), _note("#2", "dos", "y")],
              status=_status("escrito: {{#1}}", parent=str(viejo["id"])),
              relations=[{"from": "#1", "to": "#2", "predicate": "links_to"}])
    assert r["dry_run"] is True and r["replayed"] is False
    assert r["ids"] == {"#1": None, "#2": None} and r["status_id"] is None
    assert r["created"] == {"#1": True, "#2": True}
    assert r["relations"] == [{"index": 0, "id": None}]
    assert (_count("memory"), _count("relation"), _count("job")) == antes
    assert _get(str(viejo["id"]))["is_current"] is True


def test_dry_run_rechaza_lo_mismo_que_la_escritura_real():
    with pytest.raises(ValueError, match="no existe"):
        _call(batch_id=str(uuid.uuid4()), dry_run=True, agent_model=MODEL,
              notes=[_note("#1", "uno", "x", action="supersede",
                           parent="00000000-0000-0000-0000-000000000000")])


def test_un_dry_run_no_gasta_el_batch_id():
    bid = str(uuid.uuid4())
    kw = {"batch_id": bid, "notes": [_note("#1", "uno", "x")], "agent_model": MODEL}
    _call(dry_run=True, **kw)
    r = _call(**kw)
    assert r["replayed"] is False and r["ids"]["#1"] is not None
    assert _count("memory") == 1


def test_un_dry_run_de_un_lote_ya_escrito_dice_que_seria_un_reintento():
    kw = {"batch_id": str(uuid.uuid4()), "notes": [_note("#1", "uno", "x")], "agent_model": MODEL}
    escrito = _call(**kw)
    r = _call(dry_run=True, **kw)
    assert r["replayed"] is True and r["dry_run"] is True
    assert r["ids"] == escrito["ids"]
    assert _count("memory") == 1
