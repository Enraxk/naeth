"""Worker de embeddings (Paso 6 §7, Paso 7 §2). Drena la cola `job` (kind=embed),
genera el embedding en CPU y hace UPDATE memory SET embedding (mutacion LOCAL, no
sincronizada). El bus async esconde el coste real (~100 notas/s, Paso 3).

Toma jobs con SELECT ... FOR UPDATE SKIP LOCKED para poder correr varias instancias.
"""
from __future__ import annotations

import time

from app import core
from app.embeddings import EMBED_MODEL, embed_passages, warmup

POLL_INTERVAL_S = 1.0
BATCH = 32


def claim_batch(c, n: int) -> list[dict]:
    return c.execute(
        """UPDATE job SET status='processing', started_at=now(), attempts=attempts+1
           WHERE id IN (
               SELECT id FROM job WHERE status='pending' AND kind='embed'
               ORDER BY id FOR UPDATE SKIP LOCKED LIMIT %s)
           RETURNING id, memory_id""",
        (n,),
    ).fetchall()


def process_once() -> int:
    """Procesa hasta BATCH jobs. Devuelve cuantos proceso."""
    with core.conn() as c:
        jobs = claim_batch(c, BATCH)
        if not jobs:
            return 0
        ids = [j["memory_id"] for j in jobs]
        rows = c.execute(
            "SELECT id, title, content FROM memory WHERE id = ANY(%s)", (ids,)
        ).fetchall()
        by_id = {r["id"]: r for r in rows}

    texts, order = [], []
    for j in jobs:
        m = by_id.get(j["memory_id"])
        if m is None:
            continue
        texts.append((m["title"] or "") + "\n" + (m["content"] or ""))
        order.append(j)

    vecs = embed_passages(texts) if texts else []

    with core.conn() as c:
        for j, vec in zip(order, vecs):
            c.execute("UPDATE memory SET embedding = %s::vector WHERE id = %s",
                      (vec, j["memory_id"]))
            c.execute("UPDATE job SET status='done', finished_at=now() WHERE id = %s",
                      (j["id"],))
        # jobs cuya memoria ya no existe: marcar done para no reintentar en bucle
        missing = [j["id"] for j in jobs if j["memory_id"] not in by_id]
        if missing:
            c.execute("UPDATE job SET status='done', finished_at=now(), "
                      "error='memory ausente' WHERE id = ANY(%s)", (missing,))
    return len(order)


def main():
    print(f"[worker] warmup del modelo {EMBED_MODEL} ...", flush=True)
    dim = warmup()
    print(f"[worker] modelo listo (dim={dim}). Drenando cola job(embed).", flush=True)
    while True:
        try:
            n = process_once()
        except Exception as e:  # noqa: BLE001
            print(f"[worker] error: {e}", flush=True)
            n = 0
        if n == 0:
            time.sleep(POLL_INTERVAL_S)


if __name__ == "__main__":
    main()
