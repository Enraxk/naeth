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
        _pool = ConnectionPool(DSN, min_size=1, max_size=10, kwargs={"row_factory": dict_row})
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
def add(content: str, *, title: str | None = None, memory_type: str = "observation",
        tags: list[str] | None = None, path: str | None = None,
        metadata: dict | None = None, source_client: str = "web",
        author: dict | None = None) -> dict:
    """Alta de memoria (sincrona). Encola el embedding. Idempotente: si ya existe una
    fila vigente con el mismo content_hash, la devuelve sin duplicar.
    `author` (Paso 10) = autoria explicita (product/surface/zone/actor/vendor/model...)."""
    ch = content_hash(title, content)
    with conn() as c:
        existing = c.execute(
            "SELECT * FROM memory_current WHERE content_hash = %s LIMIT 1", (ch,)
        ).fetchone()
        if existing:
            return {"memory": existing, "created": False}

        row = c.execute(
            """INSERT INTO memory (content_hash, title, content, memory_type, tags, path,
                                   metadata, source_client, author)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING *""",
            (ch, title, content, memory_type, tags or [], path,
             psycopg.types.json.Jsonb(metadata or {}), source_client,
             psycopg.types.json.Jsonb(author or {})),
        ).fetchone()
        c.execute("INSERT INTO job (kind, memory_id) VALUES ('embed', %s)", (row["id"],))
        return {"memory": row, "created": True}


def supersede(parent_id: str, content: str, *, title: str | None = None,
              memory_type: str = "observation", tags: list[str] | None = None,
              path: str | None = None, metadata: dict | None = None,
              source_client: str = "web", author: dict | None = None) -> dict:
    """Nueva version que reemplaza a parent_id. La vieja permanece (is_current=false)."""
    ch = content_hash(title, content)
    with conn() as c:
        row = c.execute(
            """INSERT INTO memory (content_hash, title, content, memory_type, tags, path,
                                   metadata, source_client, author)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *""",
            (ch, title, content, memory_type, tags or [], path,
             psycopg.types.json.Jsonb(metadata or {}), source_client,
             psycopg.types.json.Jsonb(author or {})),
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


def search(query: str, *, k: int = 10, q_embedding: list[float] | None = None) -> list[dict]:
    """Busqueda hibrida RRF (semantica + lexica) sobre lo vigente (Paso 6 §9).
    Si q_embedding es None, hace solo busqueda lexica (util antes de tener el modelo)."""
    with conn() as c:
        if q_embedding is None:
            return c.execute(
                """SELECT *, ts_rank(tsv, plainto_tsquery('simple', %s)) AS score
                   FROM memory_current
                   WHERE tsv @@ plainto_tsquery('simple', %s)
                   ORDER BY score DESC LIMIT %s""",
                (query, query, k),
            ).fetchall()

        return c.execute(
            """WITH sem AS (
                   SELECT id, row_number() OVER (ORDER BY embedding <=> %(q)s::vector) AS r
                   FROM memory_current WHERE embedding IS NOT NULL
                   ORDER BY embedding <=> %(q)s::vector LIMIT 50
               ),
               txt AS (
                   SELECT id, row_number() OVER (
                       ORDER BY ts_rank(tsv, plainto_tsquery('simple', %(kw)s)) DESC) AS r
                   FROM memory_current WHERE tsv @@ plainto_tsquery('simple', %(kw)s) LIMIT 50
               )
               SELECT m.*, (coalesce(1.0/(60+sem.r),0) + coalesce(1.0/(60+txt.r),0)) AS score
               FROM memory_current m
               LEFT JOIN sem ON sem.id = m.id
               LEFT JOIN txt ON txt.id = m.id
               WHERE sem.id IS NOT NULL OR txt.id IS NOT NULL
               ORDER BY score DESC LIMIT %(k)s""",
            {"q": q_embedding, "kw": query, "k": k},
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
        counts = c.execute(
            """SELECT
                 (SELECT count(*) FROM memory)                         AS memory_total,
                 (SELECT count(*) FROM memory_current)                 AS memory_current,
                 (SELECT count(*) FROM memory WHERE embedding IS NULL) AS pendientes_embed,
                 (SELECT count(*) FROM relation)                       AS relations,
                 (SELECT count(*) FROM tombstone)                      AS tombstones""",
        ).fetchone()
        queue = c.execute(
            """SELECT
                 count(*) FILTER (WHERE status='pending')    AS pending,
                 count(*) FILTER (WHERE status='processing') AS processing,
                 count(*) FILTER (WHERE status='done')       AS done,
                 count(*) FILTER (WHERE status='error')      AS error,
                 extract(epoch FROM avg(finished_at - created_at) FILTER (WHERE status='done')) AS avg_lag_s
               FROM job""",
        ).fetchone()
        return {
            "counts": counts,
            "queue": queue,
            "embed_model": os.environ.get("EMBED_MODEL", "intfloat/multilingual-e5-small"),
            "embed_dim": int(os.environ.get("EMBED_DIM", "384")),
        }
