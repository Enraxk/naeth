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


# ============================================================
# Fase 3 - filtros de `search` (28/08/2026)
#
# Van sobre la rama LEXICA (`q_embedding=None`), igual que el resto de tests del core: no piden
# modelo ni GPU. Los filtros se aplican en las tres consultas por el mismo fragmento, asi que
# probar una rama prueba el fragmento; lo que no cubren es el reparto de las 50 plazas del
# hibrido, que solo se ve con embeddings de verdad.
# ============================================================
def _sembrar_para_filtros():
    """Cuatro notas que se distinguen por metadatos, no por texto: todas casan con 'zumbido'."""
    a = core.add("zumbido alfa", title="fa", path="naeth/core",
                 memory_type="fact", tags=["naeth", "uno"])["memory"]
    b = core.add("zumbido beta", title="fb", path="naeth/viewer",
                 memory_type="decision", tags=["naeth", "dos"])["memory"]
    c = core.add("zumbido gamma", title="fc", path="cenit/build",
                 memory_type="fact", tags=["cenit"])["memory"]
    return a, b, c


def test_sin_filtros_devuelve_todo_lo_que_casa():
    a, b, c = _sembrar_para_filtros()
    out = _ids(core.search("zumbido"))
    assert {str(a["id"]), str(b["id"]), str(c["id"])} <= set(out)


def test_filtro_path_prefix_acota_al_proyecto():
    a, b, c = _sembrar_para_filtros()
    out = _ids(core.search("zumbido", path_prefix="naeth/"))
    assert set(out) == {str(a["id"]), str(b["id"])}


def test_filtro_path_prefix_llega_al_subtema():
    a, _, _ = _sembrar_para_filtros()
    assert _ids(core.search("zumbido", path_prefix="naeth/core")) == [str(a["id"])]


def test_filtro_path_prefix_escapa_el_guion_bajo():
    """En LIKE el `_` es un comodin de un caracter. Sin escapar, `naeth_` casaria con `naeth/`."""
    a, b, c = _sembrar_para_filtros()
    assert core.search("zumbido", path_prefix="naeth_") == []


def test_filtro_memory_type():
    a, b, c = _sembrar_para_filtros()
    out = set(_ids(core.search("zumbido", memory_type="fact")))
    assert out == {str(a["id"]), str(c["id"])}


def test_filtro_tags_exige_todos_no_alguno():
    a, b, c = _sembrar_para_filtros()
    # "naeth" lo llevan dos; "naeth"+"uno" solo una.
    assert len(core.search("zumbido", tags=["naeth"])) == 2
    assert _ids(core.search("zumbido", tags=["naeth", "uno"])) == [str(a["id"])]


def test_filtros_combinados_se_suman():
    a, b, c = _sembrar_para_filtros()
    out = _ids(core.search("zumbido", path_prefix="naeth/", memory_type="fact"))
    assert out == [str(a["id"])]


def test_filtro_since_excluye_lo_anterior():
    from datetime import datetime, timedelta, timezone
    a, b, c = _sembrar_para_filtros()
    manana = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    ayer = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    assert core.search("zumbido", since=manana) == []
    assert len(core.search("zumbido", since=ayer)) == 3


def test_un_filtro_que_no_casa_devuelve_vacio_sin_romper():
    _sembrar_para_filtros()
    assert core.search("zumbido", path_prefix="no-existe/") == []
    assert core.search("zumbido", memory_type="preference") == []
    assert core.search("zumbido", tags=["inexistente"]) == []


def test_los_filtros_no_traen_lo_superado():
    """El filtro acota, pero NO abre el historico: se sigue buscando sobre lo vigente."""
    a = core.add("zumbido viejo", title="fv", path="naeth/core", memory_type="fact")["memory"]
    b = core.supersede(str(a["id"]), "zumbido nuevo", title="fv",
                       path="naeth/core", memory_type="fact")["memory"]
    out = _ids(core.search("zumbido", path_prefix="naeth/"))
    assert str(b["id"]) in out
    assert str(a["id"]) not in out


# ============================================================
# Fase 3 - la instrumentacion, que contaba dos poblaciones en un numero
# ============================================================
def test_status_separa_los_tombstones_de_memoria_de_los_de_relacion():
    """El bug real: `tombstones` sumaba los dos, asi que restarlo de las filas para saber
    cuantas versiones se superaron daba de menos. Paso el 28/08/2026 en un informe de estado."""
    a = core.add("una para retirar", title="s1")["memory"]
    b = core.add("otra que se queda", title="s2")["memory"]
    core.relation_add(str(a["id"]), str(b["id"]), "links_to")
    rel = core.relation_list(str(a["id"]))[0]
    core.tombstone(str(a["id"]))                                  # tombstone de MEMORIA
    core.tombstone(rel["id"], target_kind="relation")             # tombstone de RELACION
    st = core.status()["counts"]
    assert st["tombstones"] == 1
    assert st["tombstones_relation"] == 1


def test_status_no_cuenta_las_relaciones_retiradas_como_vivas():
    a = core.add("nodo uno", title="s3")["memory"]
    b = core.add("nodo dos", title="s4")["memory"]
    core.relation_add(str(a["id"]), str(b["id"]), "links_to")
    assert core.status()["counts"]["relations"] == 1
    rel = core.relation_list(str(a["id"]))[0]
    core.tombstone(rel["id"], target_kind="relation")
    assert core.status()["counts"]["relations"] == 0


def test_status_cuenta_las_superadas_sin_derivarlas_de_una_resta():
    a = core.add("version primera", title="s5")["memory"]
    core.supersede(str(a["id"]), "version segunda", title="s5")
    st = core.status()["counts"]
    assert st["superseded"] == 1
    assert st["memory_total"] == 2
    assert st["memory_current"] == 1


# ============================================================
# Fase 3 - `stats`: inventario e higiene del propio corpus
# ============================================================
def test_stats_counts_agrupa_y_no_devuelve_filas():
    core.add("uno", title="c1", path="naeth/core", memory_type="fact", tags=["naeth"])
    core.add("dos", title="c2", path="naeth/core", memory_type="fact", tags=["naeth"])
    core.add("tres", title="c3", path="cenit/build", memory_type="decision", tags=["cenit"])
    s = core.stats("counts")
    assert s["totales"]["vigentes"] == 3
    assert s["por_proyecto"]["top"][0] == {"k": "naeth", "n": 2}
    assert {"k": "naeth/core", "n": 2} in s["por_path"]["top"]
    assert {"k": "fact", "n": 2} in s["por_tipo"]["top"]
    assert {"k": "naeth", "n": 2} in s["por_tag"]["top"]


def test_stats_counts_declara_lo_que_deja_fuera():
    """Una lista recortada en silencio se lee como si fuera la lista entera."""
    for i in range(6):
        core.add(f"nota {i}", title=f"t{i}", path=f"p{i}/sub")
    s = core.stats("counts", limit=2)
    assert len(s["por_proyecto"]["top"]) == 2
    assert s["por_proyecto"]["distintos"] == 6
    assert s["por_proyecto"]["resto"] == 4          # las 4 que no caben, contadas


def test_hygiene_encuentra_lo_que_falta():
    core.add("sin titulo ninguno", path="naeth/core", tags=["x"])
    core.add("sin tags", title="h2", path="naeth/core")
    core.add("sin path", title="h3", tags=["x"])
    h = core.stats("hygiene")
    assert h["sin_titulo"]["n"] == 1
    assert h["sin_tags"]["n"] == 1                  # solo la segunda: las otras dos SI llevan tags
    assert h["sin_path"]["n"] == 1
    # Y cada lista trae su muestra, que es lo que hace accionable el recuento.
    assert h["sin_titulo"]["muestra"][0]["path"] == "naeth/core"


def test_hygiene_detecta_los_wikilinks_que_no_resuelven():
    viva = core.add("soy el destino", title="w1")["memory"]
    core.add(f"apunta a la viva [[{viva['id']}]]", title="w2")
    core.add("apunta a nada [[deadbeef-0000-0000-0000-000000000000]]", title="w3")
    h = core.stats("hygiene")
    assert h["wikilinks_rotos"]["n"] == 1
    assert h["wikilinks_rotos"]["muestra"][0]["title"] == "w3"


def test_hygiene_marca_una_errata_de_ruta_pero_no_un_subtema_nuevo():
    """`stets` es una errata de `status`; `ecosystem` no se parece a nada y es un subtema nuevo.
    Distinguirlos por VOLUMEN no funciona: los dos tienen una sola memoria."""
    core.add("a", title="r1", path="naeth/status")
    core.add("b", title="r2", path="naeth/status")   # `status` queda establecido (n>=2)
    core.add("c", title="r3", path="naeth/stets")    # errata, distancia 2
    core.add("d", title="r4", path="naeth/ecosystem")  # subtema nuevo, no se parece a nada
    rutas = [r["ruta"] for r in core.stats("hygiene")["rutas_sospechosas"]]
    assert rutas == ["naeth/stets"]


def test_hygiene_no_marca_las_huerfanas_que_si_tienen_relacion():
    a = core.add("con relacion", title="o1")["memory"]
    b = core.add("con relacion tambien", title="o2")["memory"]
    core.add("sola del todo", title="o3")
    core.relation_add(str(a["id"]), str(b["id"]), "links_to")
    h = core.stats("hygiene")
    assert h["huerfanas"]["n"] == 1
    assert h["huerfanas"]["muestra"][0]["title"] == "o3"


def test_hygiene_degrada_si_falta_fuzzystrmatch_en_vez_de_reventar():
    """El nodo de respaldo esta en read-only, asi que alli la extension NO se puede crear. Sin
    esta degradacion, `hygiene` funcionaria en el PC y devolveria un error en el VPS, que es el
    modo de fallo mas caro de este sistema."""
    core.add("a", title="d1", path="naeth/status")
    core.add("b", title="d2", path="naeth/status")
    core.add("c", title="d3", path="naeth/stets")
    with core.conn() as c:
        c.execute("DROP EXTENSION IF EXISTS fuzzystrmatch")
    h = core.stats("hygiene")
    assert "no_disponible" in h["rutas_sospechosas"]     # avisa, no revienta
    assert h["sin_titulo"]["n"] == 0                      # y el resto sigue respondiendo
    assert h["huerfanas"]["n"] == 3
    with core.conn() as c:
        c.execute("CREATE EXTENSION IF NOT EXISTS fuzzystrmatch")
    assert [r["ruta"] for r in core.stats("hygiene")["rutas_sospechosas"]] == ["naeth/stets"]


# ============================================================
# Fase 4 - el digest (2026-08-28)
# ============================================================
def test_add_guarda_el_digest():
    m = core.add("contenido con digest", title="t", digest="Dice esto y aquello.")["memory"]
    assert m["digest"] == "Dice esto y aquello."


def test_add_sin_digest_lo_deja_a_null():
    """Nace nullable a proposito: el backfill de las vigentes va por tandas y tarda, asi que una
    columna obligatoria habria bloqueado el despliegue hasta terminarlo."""
    m = core.add("contenido sin digest", title="t")["memory"]
    assert m["digest"] is None


def test_el_digest_se_normaliza_y_el_vacio_es_null():
    """Un digest de solo espacios no es un digest corto: es la ausencia de digest. Guardarlo como
    cadena vacia lo haria indistinguible de uno escrito para el recuento del modo higiene."""
    assert core.add("uno", title="t", digest="   ")["memory"]["digest"] is None
    assert core.add("dos", title="t", digest="  ceñido  ")["memory"]["digest"] == "ceñido"


def test_el_digest_que_pasa_del_tope_se_rechaza_en_vez_de_recortarse():
    """RECHAZAR y no recortar: un resumen cortado a mitad de frase sigue firmando como resumen
    entero y nadie se entera. El error le dice a quien escribe que lo reescriba, que es lo que hay
    que hacer de verdad."""
    largo = "x" * (core.DIGEST_MAX + 1)
    try:
        core.add("contenido", title="t", digest=largo)
    except ValueError as e:
        assert str(core.DIGEST_MAX) in str(e)          # el mensaje dice cual es el tope
        assert str(len(largo)) in str(e)               # y cuanto ocupaba lo que se mando
    else:
        raise AssertionError("un digest por encima del tope tenia que fallar")
    # y el de justo el tope si entra: el limite es inclusivo
    m = core.add("contenido", title="t", digest="y" * core.DIGEST_MAX)["memory"]
    assert len(m["digest"]) == core.DIGEST_MAX


def test_supersede_guarda_su_digest_y_NO_lo_hereda_del_padre():
    """No heredarlo es la decision, no un olvido: un digest escrito para el texto viejo describiria
    la version anterior, o sea que mentiria con la firma de un resumen bueno. NULL es honesto."""
    a = core.add("version A del texto", title="t", digest="Resume la version A.")["memory"]
    b = core.supersede(str(a["id"]), "version B del texto", title="t",
                       digest="Resume la version B.")["memory"]
    assert b["digest"] == "Resume la version B."
    c = core.supersede(str(b["id"]), "version C del texto", title="t")["memory"]
    assert c["digest"] is None                          # no arrastra el de B


def test_la_idempotencia_de_add_no_adopta_el_digest_de_la_segunda_llamada():
    """El content_hash es de (title, content) y el digest NO entra. Reenviar el mismo contenido con
    digest devuelve la fila que ya habia, sin el. Es coherente (la identidad de la memoria es su
    contenido), pero es silencioso: para ponerselo a una fila existente, supersede o backfill."""
    r1 = core.add("mismo texto exacto", title="t")
    r2 = core.add("mismo texto exacto", title="t", digest="Un digest que llega tarde.")
    assert r2["created"] is False
    assert r2["memory"]["id"] == r1["memory"]["id"]
    assert r2["memory"]["digest"] is None


def test_el_digest_no_cambia_lo_que_devuelve_la_busqueda():
    """La busqueda sigue trayendo la fila entera: quien recorta es la tool MCP, no `core.search`.
    Si `core.search` dejara de traer `content`, la ruta /api/search del visor se romperia."""
    a = core.add("higado de bacalao azul", title="t", digest="Sobre el bacalao.")["memory"]
    hit = [h for h in core.search("bacalao") if h["id"] == a["id"]][0]
    assert hit["content"] == "higado de bacalao azul"
    assert hit["digest"] == "Sobre el bacalao."


# ============================================================
# Fase 4 - lo que `memory_search` deja de devolver (2026-08-28)
# ============================================================
def test_el_resultado_de_busqueda_ya_NO_lleva_el_contenido():
    """El cambio que rompe contrato. Una busqueda de k=10 volcaba unos 27.000 caracteres (media de
    2.686 por nota) para que el agente decidiera cuales de las diez le servian."""
    from app.mcp_server import _hit
    a = core.add("texto entero de la nota", title="t", path="naeth/core",
                 digest="Dice una cosa concreta.")["memory"]
    h = _hit(dict(a) | {"score": 0.5})
    assert "content" not in h
    assert h["digest"] == "Dice una cosa concreta."
    assert h["digest_source"] == "written"
    assert h["path"] == "naeth/core"          # el path entra: situa la nota sin abrirla
    assert h["created_at"]


def test_sin_digest_cae_a_un_recorte_MARCADO_como_recorte():
    """`digest_source` esta calcado de `model_source` del Paso 10 y por lo mismo: un valor escrito a
    mano y uno derivado por la maquina no son la misma cosa, y quien lee tiene que distinguirlos sin
    adivinar. Un recorte se corta a mitad de idea pero sigue pareciendo un resumen."""
    from app.mcp_server import _resumen
    largo = "palabra " * 200                                  # 1.600 caracteres
    texto, origen = _resumen({"digest": None, "content": largo})
    assert origen == "excerpt"
    assert len(texto) <= core.DIGEST_MAX + 3                  # el tope, mas los puntos suspensivos
    assert texto.endswith("...")
    assert not texto[:-3].endswith("palabr")                  # no parte una palabra por la mitad


def test_un_digest_de_solo_espacios_no_cuenta_como_escrito():
    from app.mcp_server import _resumen
    assert _resumen({"digest": "   ", "content": "el contenido"}) == ("el contenido", "excerpt")


def test_un_contenido_mas_corto_que_el_tope_viaja_entero_y_sin_puntos():
    from app.mcp_server import _resumen
    texto, origen = _resumen({"digest": None, "content": "una nota muy breve"})
    assert (texto, origen) == ("una nota muy breve", "excerpt")


def test_una_palabra_larguisima_sin_espacios_se_corta_igual():
    """El corte busca el ultimo espacio, y si no hay ninguno util corta en seco. Sin este caso, un
    volcado sin espacios (un base64, un hash largo) devolveria la nota entera."""
    from app.mcp_server import _resumen
    texto, _ = _resumen({"digest": None, "content": "z" * 1000})
    assert len(texto) == core.DIGEST_MAX + 3
