# Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
# No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE
"""Tests de `core.batch`, el núcleo de `memory_batch` (N1, 27/10/2026).

Fijan que un lote se escribe entero o nada, que las claves `#n` y los `{{#n}}` del status los
resuelve el servidor, que reintentar con el mismo `batch_id` no duplica, y que la validación
rechaza antes de escribir lo mismo que el panel edm rechaza al pasar el informe.

Punto ciego: no prueban dos lotes concurrentes de verdad (el `pg_advisory_xact_lock` se ejercita
en serie), ni el sync entre nodos, ni la capa MCP (autoría y enforce son de N2).
"""
from __future__ import annotations

import uuid

import pytest

from app import core

DASH = chr(0x2014)


def _note(ref, title, content, *, action="add", parent=None, path="demo/core", digest=None):
    n = {"ref": ref, "action": action, "title": title, "content": content,
         "digest": digest or f"Afirma lo de {title}.", "path": path,
         "memory_type": "observation", "tags": [path.split("/")[0], "lote"]}
    if parent:
        n["parent"] = parent
    return n


def _status(content, *, parent=None, digest="Estado de demo."):
    s = _note("status", "demo · estado", content, path="demo/status", digest=digest,
              action="supersede" if parent else "add", parent=parent)
    del s["ref"]
    return s


def _count(table):
    with core.conn() as c:
        return c.execute(f"SELECT count(*) AS n FROM {table}").fetchone()["n"]


def _get(memory_id):
    return core.get(memory_id)["memory"]


def test_un_lote_correcto_escribe_notas_status_y_relaciones_y_resuelve_las_claves():
    viejo = core.add("estado anterior", title="demo · estado", path="demo/status")["memory"]
    ajena = core.add("nota que ya existía", title="ajena")["memory"]
    bid = str(uuid.uuid4())
    r = core.batch(bid,
                   [_note("#1", "uno", "contenido uno"), _note("#2", "dos", "contenido dos")],
                   status=_status("escrito: {{#1}} y {{#2}}", parent=str(viejo["id"])),
                   relations=[{"from": "#1", "to": "#2", "predicate": "links_to"},
                              {"from": "#2", "to": str(ajena["id"]), "predicate": "derived_from"}])
    assert r["replayed"] is False
    assert set(r["ids"]) == {"#1", "#2"}
    assert len(r["relations"]) == 2 and r["skipped"] == []
    st = _get(r["status_id"])
    assert st["content"] == f"escrito: {r['ids']['#1']} y {r['ids']['#2']}"
    assert _get(str(viejo["id"]))["is_current"] is False
    assert _get(r["ids"]["#1"])["metadata"]["batch_id"] == bid
    assert _count("memory") == 5 and _count("relation") == 2


def test_un_padre_inexistente_rechaza_el_lote_sin_escribir_nada():
    with pytest.raises(ValueError, match="no existe"):
        core.batch(str(uuid.uuid4()),
                   [_note("#1", "uno", "esto no debe quedar"),
                    _note("#2", "dos", "supersede huérfano", action="supersede",
                          parent="00000000-0000-0000-0000-000000000000")])
    assert _count("memory") == 0


def test_un_padre_que_ya_no_es_vigente_se_rechaza():
    a = core.add("versión uno", title="t")["memory"]
    core.supersede(str(a["id"]), "versión dos", title="t")
    with pytest.raises(ValueError, match="no es vigente"):
        core.batch(str(uuid.uuid4()),
                   [_note("#1", "t", "versión tres", action="supersede", parent=str(a["id"]))])
    assert _count("memory") == 2


def test_reintentar_con_el_mismo_batch_id_devuelve_lo_mismo_sin_duplicar():
    viejo = core.add("estado anterior", title="demo · estado", path="demo/status")["memory"]
    bid = str(uuid.uuid4())
    args = ([_note("#1", "uno", "contenido uno")],)
    kw = {"status": _status("escrito: {{#1}}", parent=str(viejo["id"])),
          "relations": [{"from": "#1", "to": str(viejo["id"]), "predicate": "links_to"}]}
    r1 = core.batch(bid, *args, **kw)
    antes = (_count("memory"), _count("relation"))
    r2 = core.batch(bid, *args, **kw)
    assert r2["replayed"] is True
    assert r2["ids"] == r1["ids"] and r2["status_id"] == r1["status_id"]
    assert [x["id"] for x in r2["relations"]] == [x["id"] for x in r1["relations"]]
    assert (_count("memory"), _count("relation")) == antes


def test_el_mismo_batch_id_con_otro_contenido_se_rechaza():
    bid = str(uuid.uuid4())
    core.batch(bid, [_note("#1", "uno", "contenido uno")])
    with pytest.raises(ValueError, match="otro contenido"):
        core.batch(bid, [_note("#1", "uno", "contenido distinto")])


def test_lo_no_aprobado_salta_sus_relaciones_y_queda_marcado_en_el_status():
    bid = str(uuid.uuid4())
    r = core.batch(bid, [_note("#1", "uno", "aprobada"), _note("#3", "tres", "aprobada también")],
                   omitted=["#2"],
                   status=_status("escrito: {{#1}}, {{#2}} y {{#3}}"),
                   relations=[{"from": "#1", "to": "#2", "predicate": "links_to"},
                              {"from": "#1", "to": "#3", "predicate": "links_to"}])
    assert len(r["relations"]) == 1
    assert r["skipped"] == [{"index": 0, "reason": "apunta a #2, que no se aprobó"}]
    assert "(no aprobado)" in _get(r["status_id"])["content"]


def test_una_clave_que_no_esta_ni_en_el_lote_ni_en_lo_omitido_se_rechaza():
    with pytest.raises(ValueError, match="#5"):
        core.batch(str(uuid.uuid4()), [_note("#1", "uno", "x")],
                   relations=[{"from": "#1", "to": "#5", "predicate": "links_to"}])
    assert _count("memory") == 0


def test_un_extremo_uuid_que_no_existe_se_rechaza_antes_de_escribir():
    with pytest.raises(ValueError, match="no existe"):
        core.batch(str(uuid.uuid4()), [_note("#1", "uno", "x")],
                   relations=[{"from": "#1", "to": str(uuid.uuid4()), "predicate": "links_to"}])
    assert _count("memory") == 0


def test_la_validacion_devuelve_todos_los_errores_de_una_vez():
    malas = [_note("#1", f"uno {DASH} dos", "x", path="Demo_Mal"),
             {**_note("#2", "dos", "y"), "memory_type": "opinion"}]
    with pytest.raises(ValueError) as e:
        core.batch(str(uuid.uuid4()), malas)
    msg = str(e.value)
    assert "em dash" in msg and "path" in msg and "memory_type" in msg
    assert _count("memory") == 0


def test_un_digest_del_status_que_pasa_del_tope_al_sustituir_se_rechaza_antes():
    # 270 caracteres más un {{#1}} de 6 cabe al escribirlo, pero al cambiarlo por un UUID de 36
    # pasa de 300. Tiene que saltar en la validación, no a mitad de la transacción.
    digest = "a" * 270 + " {{#1}}"
    with pytest.raises(ValueError, match="al sustituir"):
        core.batch(str(uuid.uuid4()), [_note("#1", "uno", "x")],
                   status=_status("escrito: {{#1}}", digest=digest))
    assert _count("memory") == 0


def test_el_status_tiene_que_ir_en_su_campo_y_con_su_path():
    with pytest.raises(ValueError, match="status"):
        core.batch(str(uuid.uuid4()), [_note("#1", "estado", "x", path="demo/status")])
    with pytest.raises(ValueError, match="status"):
        core.batch(str(uuid.uuid4()), [_note("#1", "uno", "x")],
                   status=_status("y") | {"path": "demo/core"})
