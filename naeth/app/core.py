"""Nucleo de acceso a Postgres (Paso 6). Unica capa que escribe/lee la BD; impone
ADD-only. La API (visor) y, mas adelante, MCP y OAuth son fachadas sobre esto.

ADD-only estricto:
  - add        -> INSERT en memory + encola job(embed). Idempotente por content_hash vigente.
  - supersede  -> INSERT version nueva + INSERT en supersession (la vieja permanece).
  - tombstone  -> INSERT en tombstone (la fila permanece).
  - search     -> busqueda hibrida RRF (semantica + lexica) sobre memory_current.
Nada de UPDATE/DELETE salvo el relleno async del embedding (worker) y is_current (cache).
"""
from __future__ import annotations

import hashlib
import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

DSN = os.environ.get("NAETH_DSN", "postgresql://naeth:naeth@127.0.0.1:5433/naeth")

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        # check=: valida la conexion ANTES de entregarla, y si esta muerta abre otra.
        #
        # Sin esto, la primera peticion que reciba una conexion caida FALLA con
        # "consuming input failed: terminating connection due to administrator command",
        # y solo la segunda funciona. Medido en el failover multi-nodo de CENIT (8.6 P8): al
        # cambiar de nodo lider se cierran las conexiones del rol para que el cambio de
        # read-only surta efecto, y el usuario se comia ese primer error justo despues del
        # relevo -- exactamente en el momento en que el sistema deberia parecer continuo.
        #
        # Vale para cualquier corte, no solo el failover: un reinicio de Postgres, un idle
        # timeout o una red que se corta dejan el mismo tipo de conexion zombi en el pool.
        _pool = ConnectionPool(DSN, min_size=1, max_size=10,
                               check=ConnectionPool.check_connection,
                               kwargs={"row_factory": dict_row})
    return _pool


@contextmanager
def conn():
    with pool().connection() as c:
        yield c


def content_hash(title: str | None, content: str) -> str:
    h = hashlib.sha256()
    h.update((title or "").encode("utf-8"))
    h.update(b"\x00")
    h.update(content.encode("utf-8"))
    return h.hexdigest()


# ============================================================
# Escrituras ADD-only
# ============================================================
#: Tope del digest, en caracteres. El mismo numero que el CHECK de la columna (migracion 006).
#: MEDIDO, no elegido: 24 digests reales sobre notas de 590 a 7.569 caracteres quedaron en 212-296.
#: Ver docs/plan/fase-4-0-tope-y-prioridad.md.
DIGEST_MAX = 300


def _digest(d: str | None) -> str | None:
    """Normaliza el digest y RECHAZA el que pasa del tope, en vez de recortarlo.

    Recortar produciria un resumen cortado a mitad de frase que sigue firmando como resumen entero,
    y nadie se enteraria. Un error le dice a quien escribe que lo reescriba mas corto, que es lo que
    de verdad hay que hacer. Es el mismo criterio instructivo de `_enforce_model` en el MCP.
    """
    if d is None:
        return None
    d = d.strip()
    if not d:
        return None
    if len(d) > DIGEST_MAX:
        raise ValueError(
            f"el digest ocupa {len(d)} caracteres y el tope son {DIGEST_MAX}. Reescribelo mas "
            f"corto: es un resumen de dos o tres afirmaciones, no un extracto.")
    return d


def add(content: str, *, title: str | None = None, memory_type: str = "observation",
        tags: list[str] | None = None, path: str | None = None,
        metadata: dict | None = None, source_client: str = "web",
        author: dict | None = None, digest: str | None = None) -> dict:
    """Alta de memoria (sincrona). Encola el embedding. Idempotente: si ya existe una
    fila vigente con el mismo content_hash, la devuelve sin duplicar.
    `author` (Paso 10) = autoria explicita (product/surface/zone/actor/vendor/model...).
    `digest` (fase 4) = resumen corto escrito a mano; es lo que devuelve `memory_search`.

    ⚠ EL DIGEST NO ENTRA EN EL content_hash, que sigue siendo de (title, content). O sea que
    reenviar el MISMO contenido con digest devuelve la fila existente SIN el digest: la
    idempotencia es de la memoria, no del metadato. Para ponerselo a una fila que ya existe,
    `supersede` (o el backfill), nunca un UPDATE por la puerta de atras."""
    ch = content_hash(title, content)
    with conn() as c:
        existing = c.execute(
            "SELECT * FROM memory_current WHERE content_hash = %s LIMIT 1", (ch,)
        ).fetchone()
        if existing:
            return {"memory": existing, "created": False}

        row = c.execute(
            """INSERT INTO memory (content_hash, title, content, memory_type, tags, path,
                                   metadata, source_client, author, digest)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING *""",
            (ch, title, content, memory_type, tags or [], path,
             psycopg.types.json.Jsonb(metadata or {}), source_client,
             psycopg.types.json.Jsonb(author or {}), _digest(digest)),
        ).fetchone()
        c.execute("INSERT INTO job (kind, memory_id) VALUES ('embed', %s)", (row["id"],))
        return {"memory": row, "created": True}


def supersede(parent_id: str, content: str, *, title: str | None = None,
              memory_type: str = "observation", tags: list[str] | None = None,
              path: str | None = None, metadata: dict | None = None,
              source_client: str = "web", author: dict | None = None,
              digest: str | None = None) -> dict:
    """Nueva version que reemplaza a parent_id. La vieja permanece (is_current=false).

    ⚠ EL DIGEST NO SE HEREDA DEL PADRE, y es deliberado (como el resto de campos, que tampoco).
    Aqui hay ademas una razon propia: un digest heredado describe el contenido ANTERIOR, o sea
    que mentiria con la firma de un resumen bueno. Un NULL es honesto y el backfill lo recoge."""
    ch = content_hash(title, content)
    with conn() as c:
        row = c.execute(
            """INSERT INTO memory (content_hash, title, content, memory_type, tags, path,
                                   metadata, source_client, author, digest)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *""",
            (ch, title, content, memory_type, tags or [], path,
             psycopg.types.json.Jsonb(metadata or {}), source_client,
             psycopg.types.json.Jsonb(author or {}), _digest(digest)),
        ).fetchone()
        c.execute(
            "INSERT INTO supersession (child_id, parent_id, source_client) VALUES (%s, %s, %s)",
            (row["id"], parent_id, source_client),
        )
        c.execute("UPDATE memory SET is_current = false WHERE id = %s", (parent_id,))
        c.execute("INSERT INTO job (kind, memory_id) VALUES ('embed', %s)", (row["id"],))
        return {"memory": row, "created": True}


def tombstone(target_id: str, *, target_kind: str = "memory",
              source_client: str = "web") -> dict:
    """Borrado logico: INSERT en tombstone. La fila permanece."""
    with conn() as c:
        c.execute(
            "INSERT INTO tombstone (target_id, target_kind, source_client) VALUES (%s, %s, %s)",
            (target_id, target_kind, source_client),
        )
        if target_kind == "memory":
            c.execute("UPDATE memory SET is_current = false WHERE id = %s", (target_id,))
        return {"ok": True, "target_id": target_id}


# ============================================================
# Relaciones (grafo explicito)
# ============================================================
def relation_add(source_id: str, target_id: str, predicate: str,
                 *, metadata: dict | None = None, source_client: str = "web") -> dict:
    with conn() as c:
        row = c.execute(
            """INSERT INTO relation (source_id, target_id, predicate, metadata, source_client)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (source_id, target_id, predicate,
             psycopg.types.json.Jsonb(metadata or {}), source_client),
        ).fetchone()
        return {"id": str(row["id"]), "source_id": source_id, "target_id": target_id,
                "predicate": predicate}


def _chain_ids(c, memory_id: str) -> list:
    """Todos los ids de la cadena de supersession del nodo (ancestros + descendientes).
    La 'identidad logica' de un nodo es su cadena, no una sola fila."""
    # Una sola referencia recursiva a `chain` (Postgres prohibe dos ramas que la citen):
    # para cada nodo de la cadena, se salta al OTRO extremo de cualquier supersession en
    # la que aparezca, cubriendo ancestros y descendientes.
    rows = c.execute(
        """WITH RECURSIVE chain(id) AS (
               SELECT %(m)s::uuid
               UNION
               SELECT CASE WHEN s.parent_id = ch.id THEN s.child_id ELSE s.parent_id END
               FROM supersession s JOIN chain ch ON ch.id IN (s.parent_id, s.child_id)
           )
           SELECT id FROM chain""",
        {"m": memory_id},
    ).fetchall()
    return [r["id"] for r in rows]


def _current_of(c, memory_id) -> str:
    """Version vigente de la cadena de un id: se sigue 'child' hasta la hoja que no esta
    supersedida ni tombstoneada. Si no la hay, devuelve el propio id."""
    row = c.execute(
        """WITH RECURSIVE fwd(id) AS (
               SELECT %(m)s::uuid
               UNION
               SELECT s.child_id FROM supersession s JOIN fwd f ON s.parent_id = f.id
           )
           SELECT f.id FROM fwd f
           WHERE NOT EXISTS (SELECT 1 FROM supersession s WHERE s.parent_id = f.id)
             AND NOT EXISTS (SELECT 1 FROM tombstone t
                             WHERE t.target_id = f.id AND t.target_kind = 'memory')
           LIMIT 1""",
        {"m": memory_id},
    ).fetchone()
    return str(row["id"]) if row else str(memory_id)


def relation_list(memory_id: str) -> list[dict]:
    """Relaciones vigentes de una memoria, resolviendo la cadena de supersession:
    incluye relaciones creadas sobre CUALQUIER version del nodo (o de sus extremos),
    normaliza cada extremo a su version vigente y deduplica. Excluye tombstoneadas.
    Asi una relacion 'sigue' al nodo aunque el extremo se haya superseded."""
    with conn() as c:
        chain = _chain_ids(c, memory_id)
        if not chain:
            return []
        rows = c.execute(
            """SELECT r.id, r.source_id, r.target_id, r.predicate, r.created_at
               FROM relation r
               WHERE (r.source_id = ANY(%(ids)s) OR r.target_id = ANY(%(ids)s))
                 AND NOT EXISTS (SELECT 1 FROM tombstone t
                                 WHERE t.target_id = r.id AND t.target_kind = 'relation')
               ORDER BY r.created_at""",
            {"ids": chain},
        ).fetchall()

        node_current = _current_of(c, memory_id)
        seen: set = set()
        out: list[dict] = []
        for x in rows:
            src = _current_of(c, x["source_id"])
            tgt = _current_of(c, x["target_id"])
            key = (src, tgt, x["predicate"])
            if key in seen:
                continue
            seen.add(key)
            out.append({"id": str(x["id"]), "source_id": src, "target_id": tgt,
                        "predicate": x["predicate"],
                        "direction": "out" if src == node_current else "in"})
        return out


# ============================================================
# Lecturas
# ============================================================
def get(memory_id: str) -> dict | None:
    with conn() as c:
        m = c.execute("SELECT * FROM memory WHERE id = %s", (memory_id,)).fetchone()
        if not m:
            return None
        chain = c.execute(
            "SELECT * FROM supersession WHERE child_id = %s OR parent_id = %s ORDER BY created_at",
            (memory_id, memory_id),
        ).fetchall()
        return {"memory": m, "supersession": chain}


def _like_escape(s: str) -> str:
    """Neutraliza los comodines de LIKE en un valor que viene de fuera.

    Sin esto, un `path_prefix` de `naeth_` casaria tambien con `naethX`, porque en LIKE el guion
    bajo es "un caracter cualquiera". Y el corpus tiene rutas con guion bajo, asi que no es
    hipotetico.
    """
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _filtros(path_prefix: str | None, tags: list[str] | None,
             memory_type: str | None, since: str | None) -> tuple[str, dict]:
    """Fragmento de WHERE comun a las TRES consultas de `search`, con sus parametros.

    Se devuelve para pegarlo con AND detras de un WHERE que ya existe, o vacio si no hay filtros,
    de modo que una llamada sin filtros produce exactamente el SQL de antes.
    """
    frag: list[str] = []
    params: dict = {}
    if path_prefix:
        # El patron se construye aqui y viaja como PARAMETRO, asi que el SQL no lleva ningun `%`
        # literal que psycopg pudiera confundir con un placeholder.
        frag.append(r"path LIKE %(f_path)s ESCAPE '\'")
        params["f_path"] = _like_escape(path_prefix) + "%"
    if tags:
        # `@>` es "los tiene TODOS", no "alguno": filtrar por dos tags acota, no amplia.
        frag.append("tags @> %(f_tags)s")
        params["f_tags"] = list(tags)
    if memory_type:
        frag.append("memory_type = %(f_type)s")
        params["f_type"] = memory_type
    if since:
        frag.append("created_at >= %(f_since)s")
        params["f_since"] = since
    return (" AND " + " AND ".join(frag)) if frag else "", params


def search(query: str, *, k: int = 10, q_embedding: list[float] | None = None,
           path_prefix: str | None = None, tags: list[str] | None = None,
           memory_type: str | None = None, since: str | None = None) -> list[dict]:
    """Busqueda hibrida RRF (semantica + lexica) sobre lo vigente (Paso 6 §9).
    Si q_embedding es None, hace solo busqueda lexica (util antes de tener el modelo).

    LOS FILTROS SE APLICAN DENTRO DE CADA RAMA, no sobre el resultado, y esa es toda la diferencia
    entre mejorar el recall y solo recortar la salida: filtrando despues, las 50 plazas de `sem` y
    de `txt` ya se las ha llevado lo de siempre, y lo que queda es el mismo ruido con menos filas.
    Filtrando dentro, esas 50 plazas se reparten entre lo que de verdad compite.

    NO hay filtro de `is_current`: la busqueda va sobre la vista `memory_current` a proposito.
    Medido el 28/08/2026, 40 de los 297 pares de supersession son CORRECTIVOS (el hijo desmiente
    algo del padre), asi que abrir la busqueda al historico devolveria afirmaciones ya refutadas
    sin su correccion al lado. El historico se alcanza por `get`, que marca `is_current` y trae la
    cadena.
    """
    where, fp = _filtros(path_prefix, tags, memory_type, since)
    with conn() as c:
        if q_embedding is None:
            return c.execute(
                f"""SELECT *, ts_rank(tsv, plainto_tsquery('simple', %(kw)s)) AS score
                    FROM memory_current
                    WHERE tsv @@ plainto_tsquery('simple', %(kw)s){where}
                    ORDER BY score DESC LIMIT %(k)s""",
                {"kw": query, "k": k, **fp},
            ).fetchall()

        return c.execute(
            f"""WITH sem AS (
                    SELECT id, row_number() OVER (ORDER BY embedding <=> %(q)s::vector) AS r
                    FROM memory_current WHERE embedding IS NOT NULL{where}
                    ORDER BY embedding <=> %(q)s::vector LIMIT 50
                ),
                txt AS (
                    SELECT id, row_number() OVER (
                        ORDER BY ts_rank(tsv, plainto_tsquery('simple', %(kw)s)) DESC) AS r
                    FROM memory_current WHERE tsv @@ plainto_tsquery('simple', %(kw)s){where}
                    -- El ORDER BY de aqui NO es redundante con el de la ventana: sin el, el
                    -- LIMIT 50 se lleva cincuenta filas CUALESQUIERA de las que casan, y que
                    -- salgan las mejores depende de la forma del plan y no del SQL. Hoy salia
                    -- bien por casualidad (Limit -> WindowAgg -> Sort, verificado con EXPLAIN);
                    -- con los filtros de arriba el plan cambia.
                    ORDER BY ts_rank(tsv, plainto_tsquery('simple', %(kw)s)) DESC
                    LIMIT 50
                )
                SELECT m.*, (coalesce(1.0/(60+sem.r),0) + coalesce(1.0/(60+txt.r),0)) AS score
                FROM memory_current m
                LEFT JOIN sem ON sem.id = m.id
                LEFT JOIN txt ON txt.id = m.id
                WHERE sem.id IS NOT NULL OR txt.id IS NOT NULL
                ORDER BY score DESC LIMIT %(k)s""",
            {"q": q_embedding, "kw": query, "k": k, **fp},
        ).fetchall()


def tree() -> list[dict]:
    """Memorias vigentes para el arbol del visor (Paso 4 P5.2): solo los campos que el
    arbol necesita (id, title, memory_type, path), ordenadas por path y titulo. El
    agrupado proyecto/origen lo hace el cliente partiendo `path` por '/'."""
    with conn() as c:
        rows = c.execute(
            """SELECT id, title, memory_type, path, tags, created_at
               FROM memory_current
               ORDER BY coalesce(path, '~') ASC, lower(coalesce(title, '')) ASC""",
        ).fetchall()
        return [{"id": str(r["id"]), "title": r["title"], "memory_type": r["memory_type"],
                 "path": r["path"], "tags": r["tags"],
                 "created_at": r["created_at"].isoformat() if r["created_at"] else None}
                for r in rows]


# ============================================================
# Grafo (Paso 5.4)
# ============================================================
#
# Estas tres funciones existen porque `relation_list` es POR NODO y no escala al grafo entero:
# resuelve cada extremo con `_current_of`, que es un CTE recursivo, asi que para las ~480 aristas
# del corpus serian ~960 consultas recursivas. Aqui la resolucion se hace UNA vez para todos.

_GRAFO_SQL = """
WITH RECURSIVE fwd(root, node) AS (
        SELECT m.id, m.id FROM memory m
        UNION
        SELECT f.root, s.child_id FROM fwd f JOIN supersession s ON s.parent_id = f.node
    ),
    hoja AS (
        SELECT DISTINCT ON (f.root) f.root, f.node AS cur
        FROM fwd f JOIN memory_current mc ON mc.id = f.node
        ORDER BY f.root, mc.created_at DESC, mc.id
    ),
    viva AS (
        SELECT r.source_id, r.target_id, r.predicate FROM relation r
        WHERE NOT EXISTS (SELECT 1 FROM tombstone t
                          WHERE t.target_id = r.id AND t.target_kind = 'relation')
    )
SELECT s.cur AS source_id, t.cur AS target_id, v.predicate, count(*) AS n
FROM viva v
JOIN hoja s ON s.root = v.source_id
JOIN hoja t ON t.root = v.target_id
WHERE s.cur <> t.cur
GROUP BY 1, 2, 3
"""


def graph_edges() -> list[dict]:
    """Todas las aristas del grafo, con sus extremos ya resueltos a la version vigente.

    EL RECURSIVO VA HACIA ADELANTE, no hacia atras. `_current_of` responde "dado UN id, sube
    hasta la hoja"; aqui hace falta lo contrario, "para todos los ids a la vez, propaga hacia
    los hijos", y por eso `fwd` arranca de `memory` COMPLETA (las 905 filas) y no de
    `memory_current`: el punto es alcanzar la vigente desde la version vieja que tiene la
    relacion colgada. Medido con EXPLAIN ANALYZE el 04/09/2026: 5,1 ms.

    ⚠ EL JOIN CONTRA `hoja` ES UN JOIN Y NO UN LEFT JOIN, y esa letra cambia el resultado. Con
    LEFT JOIN mas `coalesce(hoja.cur, m.id)`, una relacion cuyo extremo esta TOMBSTONEADO (o
    cuya cadena no llega a ninguna vigente) resuelve a si misma y el grafo acaba pintando nodos
    que ya no existen. Medido el 04/09/2026 sobre las 22 memorias retiradas: la version con
    coalesce daba 489 aristas y la correcta 479, o sea DIEZ nodos fantasma.

    ⚠ EL `s.cur <> t.cur` TAMPOCO ES COSMETICO: al colapsar la cadena, una relacion creada entre
    dos versiones de la MISMA nota se convierte en un bucle sobre si misma.

    `n` dice cuantas filas de `relation` colapsaron sobre esa arista. Se devuelve el conteo y no
    un `id` porque despues de colapsar no hay UN id que sea la respuesta correcta.

    POR QUE ESTO VALE LA PENA, con numero: `memory_stats` reporta 190 huerfanas contando contra
    `relation` por id exacto, y las reales son 120. Las 70 de diferencia son notas cuyas
    relaciones cuelgan de una version anterior. Sin este CTE el grafo perderia esos 70 nodos y
    nada avisaria.
    """
    with conn() as c:
        rows = c.execute(_GRAFO_SQL).fetchall()
        return [{"source_id": str(r["source_id"]), "target_id": str(r["target_id"]),
                 "predicate": r["predicate"], "n": r["n"]} for r in rows]


def graph_links() -> dict[str, list[str]]:
    """Destinos EN BRUTO de los `[[wikilinks]]` de cada memoria vigente, sin resolver.

    Sin resolver a proposito, y es la decision de diseño de todo el endpoint. La resolucion vive
    en `web/src/lib/wikilinks.ts` y tiene seis pasadas medidas sobre el corpus (uuid, prefijo de
    uuid, titulo, slug, prefijo de titulo, prefijo de slug, y desde el 04/09 tambien path), con
    sus tests. Reimplementarla aqui seria mantener dos copias que se van a separar, y hay prueba
    de que pasa: `_stats_hygiene` tiene una version reducida que solo mira las formas por id, y
    por eso reporta 41 wikilinks rotos donde el resolutor completo cuenta 80.

    El backend hace lo unico que solo el puede hacer, que es sacar las cadenas de dentro de los
    corchetes sin mandarle al navegador el texto de las 520 memorias.

    `split_part(d[1], '|', 1)` se queda con el destino y descarta el alias de estilo Obsidian
    `[[destino|texto]]`, que es lo que hace tambien el regex del front.
    """
    with conn() as c:
        rows = c.execute(
            r"""SELECT m.id, array_agg(DISTINCT split_part(d[1], '|', 1)) AS destinos
               FROM memory_current m,
                    LATERAL regexp_matches(m.content, '\[\[([^\]]+)\]\]', 'g') d
               GROUP BY m.id""",
        ).fetchall()
        return {str(r["id"]): r["destinos"] for r in rows}


def graph_knn(memory_id: str, k: int = 8) -> list[dict]:
    """Los `k` vecinos semanticos mas cercanos de una memoria, por coseno sobre el embedding.

    VA POR NODO Y NO GLOBAL, y lo decide el reloj: medido el 04/09/2026, los vecinos de UNA nota
    salen en 16 ms con el indice HNSW, y el kNN de TODO el corpus con k=5 tarda 2,7 segundos.
    Meter lo segundo en `/api/graph` seria esperar casi tres segundos para pintar la primera
    arista, y pagarlo entero aunque la capa semantica este apagada.

    ⚠ EL `sim` QUE DEVUELVE NO SE PUEDE LEER COMO UN PORCENTAJE DE PARECIDO. La similitud de
    este corpus esta comprimida: medido sobre pares AL AZAR, la mediana ya es 0,874 (min 0,784,
    p95 0,907, p99 0,922), y los vecinos reales rondan 0,93 a 0,94. O sea que el rango util vive
    entre 0,90 y 0,97, y un control de umbral de 0 a 1 tendria el 87% del recorrido muerto. El
    control de la vista es top-k, que es relativo; si algun dia se ofrece umbral, va etiquetado
    por percentil del corpus y nunca en coseno crudo.
    """
    with conn() as c:
        return c.execute(
            """SELECT b.id, 1 - (a.embedding <=> b.embedding) AS sim
               FROM memory_current a, memory_current b
               WHERE a.id = %(id)s AND b.id <> a.id
                 AND a.embedding IS NOT NULL AND b.embedding IS NOT NULL
               ORDER BY a.embedding <=> b.embedding
               LIMIT %(k)s""",
            {"id": memory_id, "k": k},
        ).fetchall()


def _top(c, sql: str, limit: int, params: dict | None = None) -> dict:
    """Ejecuta un agrupado `(clave, n)` y devuelve el top N MAS lo que se queda fuera.

    El `resto` no es decoracion: una lista recortada en silencio se lee como si fuera la lista
    entera, y entonces el inventario miente por omision justo en la cola, que es donde viven las
    rarezas que uno busca.
    """
    filas = c.execute(sql, params or {}).fetchall()
    top = [{"k": r["k"], "n": r["n"]} for r in filas[:limit]]
    return {"top": top, "distintos": len(filas),
            "resto": sum(r["n"] for r in filas[limit:]) if len(filas) > limit else 0}


def stats(mode: str = "counts", limit: int = 15) -> dict:
    """Introspeccion del corpus: `counts` (como esta repartido) o `hygiene` (que esta mal).

    ⚠ DEVUELVE RECUENTOS, NO FILAS, y esa es la razon de ser de la tool. Nacio porque responder
    una pregunta agregada costaba cuatro busquedas y unas 40.000 palabras de contexto, asi que una
    tool de inventario que escupiera listas largas empeoraria justo lo que viene a arreglar. Para
    el detalle estan los filtros de `search`.
    """
    with conn() as c:
        if mode == "hygiene":
            return _stats_hygiene(c, limit)

        counts = status()["counts"]
        return {
            "mode": "counts",
            "totales": {
                "vigentes": counts["memory_current"],
                "filas": counts["memory_total"],
                "superadas": counts["superseded"],
                "retiradas": counts["tombstones"],
                "relaciones": counts["relations"],
            },
            "por_proyecto": _top(c, """SELECT split_part(path,'/',1) AS k, count(*) AS n
                                       FROM memory_current WHERE path IS NOT NULL
                                       GROUP BY 1 ORDER BY 2 DESC, 1""", limit),
            "por_path": _top(c, """SELECT path AS k, count(*) AS n FROM memory_current
                                   WHERE path IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1""", limit),
            "por_tipo": _top(c, """SELECT memory_type AS k, count(*) AS n FROM memory_current
                                   GROUP BY 1 ORDER BY 2 DESC, 1""", limit),
            "por_tag": _top(c, """SELECT unnest(tags) AS k, count(*) AS n FROM memory_current
                                  GROUP BY 1 ORDER BY 2 DESC, 1""", limit),
            "por_autor": _top(c, """SELECT coalesce(author_product,'(sin autor)')
                                           || coalesce(' · ' || author_model, '') AS k,
                                           count(*) AS n
                                    FROM memory_current GROUP BY 1 ORDER BY 2 DESC, 1""", limit),
            "por_mes": _top(c, """SELECT to_char(created_at,'YYYY-MM') AS k, count(*) AS n
                                  FROM memory_current GROUP BY 1 ORDER BY 1 DESC""", limit),
        }


def _stats_hygiene(c, limit: int) -> dict:
    """Lo que esta mal Y es indiscutible que esta mal. Cada lista va con muestra acotada."""
    def ids(sql: str, params: dict | None = None) -> dict:
        filas = c.execute(sql, params or {}).fetchall()
        return {"n": len(filas),
                "muestra": [{"id": str(r["id"]), "title": r.get("title"),
                             "path": r.get("path")} for r in filas[:limit]]}

    # Wikilinks que NO resuelven. Se miran las dos formas que apuntan por id (uuid entero y
    # prefijo de 8); la de titulo y la de slug se quedan fuera A PROPOSITO: parte de los slugs
    # apuntan a la memoria NATIVA de Claude Code, que no vive aqui, y marcarlos como rotos seria
    # inventarse un problema. Es el mismo criterio que ya aplica `wikilinks.ts` en el visor.
    rotos = c.execute(
        r"""WITH l AS (
                SELECT m.id, m.title, m.path,
                       split_part((regexp_matches(m.content,'\[\[([^\]]+)\]\]','g'))[1],'|',1) AS dest
                FROM memory_current m
            )
            SELECT id, title, path, dest FROM l
            WHERE (dest ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   AND NOT EXISTS (SELECT 1 FROM memory_current x WHERE x.id::text = l.dest))
               OR (dest ~ '^[0-9a-f]{8}$'
                   AND NOT EXISTS (SELECT 1 FROM memory_current x WHERE x.id::text LIKE l.dest || '%'))"""
    ).fetchall()

    # Rutas que parecen una ERRATA de un subtema ya establecido del mismo proyecto. El umbral 2 no
    # es arbitrario: medido el 28/08/2026 sobre el corpus entero, con 2 salia exactamente el unico
    # error real (`naeth/stets` por `status`) y ningun falso positivo; con 3 ya entraba uno.
    # Lo que NO sirve es marcar por volumen: "subtema con una sola memoria" senalaba 32 rutas, de
    # las que 20 eran `*/status`, que es la convencion funcionando.
    #
    # ⚠ ESTA SECCION DEGRADA EN VEZ DE REVENTAR, y no es celo: `levenshtein` viene de
    # `fuzzystrmatch`, que el schema crea SOLO en una base nueva. En el nodo de respaldo no se
    # puede crear mientras esta en read-only (que es su estado normal), asi que sin esto
    # `memory_stats hygiene` funcionaria aqui y devolveria un error alli. Se comprueba ANTES de
    # lanzar la consulta, y no con un try: una consulta que falla aborta la transaccion y se lleva
    # por delante todo lo que venga detras.
    tiene_levenshtein = c.execute(
        "SELECT count(*) > 0 AS ok FROM pg_proc WHERE proname = 'levenshtein'"
    ).fetchone()["ok"]

    erratas = [] if not tiene_levenshtein else c.execute(
        """WITH sub AS (
               SELECT split_part(path,'/',1) AS proj, split_part(path,'/',2) AS sub, count(*) AS n
               FROM memory_current WHERE path IS NOT NULL GROUP BY 1,2
           )
           SELECT r.proj || '/' || r.sub AS ruta, e.sub AS parecido_a,
                  levenshtein(r.sub, e.sub) AS distancia
           FROM sub r JOIN sub e ON e.proj = r.proj AND e.sub <> r.sub AND e.n >= 2
           WHERE r.n = 1 AND levenshtein(r.sub, e.sub) <= 2
           ORDER BY 3, 1"""
    ).fetchall()

    cadenas = c.execute(
        """WITH RECURSIVE h AS (
               SELECT id AS head, id AS node, 1 AS n FROM memory_current
               UNION ALL
               SELECT h.head, s.parent_id, h.n + 1 FROM h JOIN supersession s ON s.child_id = h.node
           ), largo AS (SELECT head, max(n) AS versiones FROM h GROUP BY 1)
           SELECT l.head AS id, m.title, m.path, l.versiones
           FROM largo l JOIN memory_current m ON m.id = l.head
           WHERE l.versiones >= 5 ORDER BY l.versiones DESC LIMIT %(lim)s""",
        {"lim": limit},
    ).fetchall()

    # AVANCE DEL BACKFILL DEL DIGEST (fase 4). No va como los demas apartados, y es a proposito:
    # los otros listan ids porque son pocos y hay que ir a arreglarlos uno a uno. Aqui hoy faltan
    # casi todas, asi que una muestra de quince no diria nada. Lo que hace falta es CUANTO QUEDA Y
    # DONDE, que es lo unico que responde cuando cierra la fase.
    dg = c.execute(
        """SELECT count(*) FILTER (WHERE digest IS NULL) AS faltan,
                  count(digest) AS hechos, count(*) AS total
           FROM memory_current"""
    ).fetchone()
    dg_proj = _top(c, """SELECT split_part(coalesce(path, '(sin path)'), '/', 1) AS k,
                                count(*) AS n
                         FROM memory_current WHERE digest IS NULL
                         GROUP BY 1 ORDER BY 2 DESC""", limit)

    return {
        "mode": "hygiene",
        "sin_titulo": ids("""SELECT id, title, path FROM memory_current
                             WHERE title IS NULL OR btrim(title) = ''"""),
        "sin_tags": ids("""SELECT id, title, path FROM memory_current
                           WHERE tags IS NULL OR cardinality(tags) = 0"""),
        "sin_path": ids("""SELECT id, title, path FROM memory_current
                           WHERE path IS NULL OR btrim(path) = ''"""),
        "huerfanas": ids("""SELECT id, title, path FROM memory_current m
                            WHERE NOT EXISTS (SELECT 1 FROM relation r
                                              WHERE r.source_id = m.id OR r.target_id = m.id)"""),
        "wikilinks_rotos": {
            "n": len(rotos),
            "muestra": [{"id": str(r["id"]), "title": r["title"], "destino": r["dest"]}
                        for r in rotos[:limit]],
        },
        "rutas_sospechosas": [{"ruta": r["ruta"], "parecido_a": r["parecido_a"],
                               "distancia": r["distancia"]} for r in erratas]
        if tiene_levenshtein else
        {"no_disponible": "falta la extension fuzzystrmatch en este nodo; el resto de la "
                          "higiene no depende de ella"},
        "cadenas_largas": [{"id": str(r["id"]), "title": r["title"], "path": r["path"],
                            "versiones": r["versiones"]} for r in cadenas],
        "sin_digest": {
            "faltan": dg["faltan"], "hechos": dg["hechos"], "de": dg["total"],
            "pct_hecho": round(100.0 * dg["hechos"] / dg["total"]) if dg["total"] else 0,
            "por_proyecto": dg_proj,
        },
    }


def authors() -> list[dict]:
    """Desglose de autoria de lo vigente (Paso 10): quien y con que modelo. Agrupa por
    (product, surface, actor, model). Las notas sin author (legado sin backfill) caen en
    NULLs. Util para el visor y system_status."""
    with conn() as c:
        rows = c.execute(
            """SELECT
                 author_product AS product,
                 author_surface AS surface,
                 author->>'actor' AS actor,
                 author_model   AS model,
                 author->>'model_source' AS model_source,
                 count(*)       AS n
               FROM memory_current
               GROUP BY 1, 2, 3, 4, 5
               ORDER BY n DESC""",
        ).fetchall()
        return [dict(r) for r in rows]


def status() -> dict:
    """Salud: conteos, estado de la cola de embeddings, modelo/dimension activos."""
    with conn() as c:
        # Tres de estas cifras estaban mal hasta el 28/08/2026, y no por redondeo: contaban dos
        # poblaciones distintas en un solo numero, asi que cualquiera que DERIVARA algo de aqui lo
        # sacaba mal sin manera de notarlo. Paso de verdad, al montar un informe de estado.
        #   - `tombstones` sumaba los de memoria y los de relacion. Ahora `tombstones` son los de
        #     MEMORIA y los de relacion van aparte: restar el total de las filas para saber cuantas
        #     versiones se superaron daba de menos.
        #   - `relations` contaba la tabla entera, retiradas incluidas.
        #   - `superseded` no existia y habia que derivarlo restando, que es justo lo que fallaba.
        #     Se cuenta directo de su tabla, que es la unica forma que no depende de suposiciones.
        counts = c.execute(
            """SELECT
                 (SELECT count(*) FROM memory)                         AS memory_total,
                 (SELECT count(*) FROM memory_current)                 AS memory_current,
                 (SELECT count(*) FROM memory WHERE embedding IS NULL) AS pendientes_embed,
                 (SELECT count(*) FROM supersession)                   AS superseded,
                 (SELECT count(*) FROM relation r
                    WHERE NOT EXISTS (SELECT 1 FROM tombstone t
                                      WHERE t.target_id = r.id AND t.target_kind = 'relation'))
                                                                       AS relations,
                 (SELECT count(*) FROM tombstone WHERE target_kind = 'memory')   AS tombstones,
                 (SELECT count(*) FROM tombstone WHERE target_kind = 'relation') AS tombstones_relation""",
        ).fetchone()
        # `avg_lag_s` promediaba TODA la tabla `job` desde el primer dia, asi que no respondia
        # "cuanto tarda un embedding hoy" sino "cuanto ha tardado de media en la vida del nodo", y
        # se movia sola sin que cambiara nada. Se acota a los ultimos 7 dias; si en esa ventana no
        # hay ninguno terminado, devuelve NULL en vez de una media de hace meses.
        queue = c.execute(
            """SELECT
                 count(*) FILTER (WHERE status='pending')    AS pending,
                 count(*) FILTER (WHERE status='processing') AS processing,
                 count(*) FILTER (WHERE status='done')       AS done,
                 count(*) FILTER (WHERE status='error')      AS error,
                 extract(epoch FROM avg(finished_at - created_at) FILTER (
                   WHERE status='done' AND finished_at > now() - interval '7 days')) AS avg_lag_s
               FROM job""",
        ).fetchone()
        return {
            "counts": counts,
            "queue": queue,
            "embed_model": os.environ.get("EMBED_MODEL", "intfloat/multilingual-e5-small"),
            "embed_dim": int(os.environ.get("EMBED_DIM", "384")),
        }
