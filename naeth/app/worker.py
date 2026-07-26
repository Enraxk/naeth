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
#: Cuando este nodo es el MIRROR del multi-nodo (rol Postgres en read-only), no hay nada que
#: hacer: el lider es quien escribe. Se duerme mucho mas para no despertar a la BD cada segundo.
MIRROR_POLL_INTERVAL_S = 60.0
BATCH = 32

#: Un job en 'processing' mas viejo que esto se considera HUERFANO y se vuelve a reclamar.
#: Holgado a proposito: un lote de 32 con e5-large tarda segundos, no minutos.
LEASE_MINUTES = 15
#: Tope de reintentos. Sin el, un job que falla SIEMPRE (una memoria corrupta, un texto que
#: revienta al modelo) se reclamaria cada 15 min para siempre.
MAX_ATTEMPTS = 5


def reap_dead_jobs(c) -> int:
    """Marca 'error' los jobs que agotaron los intentos. Devuelve cuantos.

    Sin esto, un job que ya no se puede reclamar (attempts >= MAX) se quedaria en 'processing'
    eternamente: invisible para la cola y sin nadie que lo mire. Marcarlo 'error' lo saca del
    limbo y lo deja CONTABLE -- `system_status` los cuenta, asi que un problema recurrente se ve
    en vez de desaparecer.

    MIRA ANTES DE ESCRIBIR (multi-nodo, CENIT 8.6): en el nodo que no lidera el rol es
    read-only, y un UPDATE incondicional en cada ciclo llenaba el log con un
    "cannot execute UPDATE in a read-only transaction" POR SEGUNDO. El SELECT previo es
    barato y hace que el caso normal -- no hay nada que segar -- no escriba nada.
    """
    hay = c.execute(
        """SELECT 1 FROM job
           WHERE kind='embed' AND status='processing' AND attempts >= %s
             AND started_at < now() - make_interval(mins => %s) LIMIT 1""",
        (MAX_ATTEMPTS, LEASE_MINUTES),
    ).fetchone()
    if not hay:
        return 0
    r = c.execute(
        """UPDATE job SET status='error', finished_at=now(),
                  error='abandonado tras ' || attempts || ' intentos'
           WHERE kind='embed' AND status='processing'
             AND attempts >= %s
             AND started_at < now() - make_interval(mins => %s)
           RETURNING id""",
        (MAX_ATTEMPTS, LEASE_MINUTES),
    ).fetchall()
    return len(r)


def claim_batch(c, n: int) -> list[dict]:
    """Reclama hasta `n` jobs: los pendientes y los HUERFANOS.

    ── POR QUE EL LEASE (fallo real, 2026-07-26) ──────────────────────────────────────────
    Esto solo reclamaba `status='pending'`. Si el worker moria a mitad -- reinicio del PC, de
    Docker, un apagon -- el job se quedaba en 'processing' PARA SIEMPRE y su memoria nunca
    recibia embedding.

    El sintoma es de los peores que puede tener un sistema de memoria: la nota esta, se lee, se
    encuentra por texto... y NO aparece en la busqueda semantica. En silencio, sin un error en
    ningun log. Se detectaron dos asi, del 8 y el 11 de julio, descubiertas 18 dias despues y de
    pura casualidad.

    Ahora un job en 'processing' mas viejo que el lease se vuelve a reclamar. `attempts` sigue
    subiendo en cada intento, y al llegar al tope `reap_dead_jobs` lo marca 'error' en vez de
    dejarlo dando vueltas.
    ───────────────────────────────────────────────────────────────────────────────────────
    """
    return c.execute(
        """UPDATE job SET status='processing', started_at=now(), attempts=attempts+1
           WHERE id IN (
               SELECT id FROM job
               WHERE kind='embed'
                 AND attempts < %s
                 AND (status='pending'
                      OR (status='processing'
                          AND started_at < now() - make_interval(mins => %s)))
               ORDER BY id FOR UPDATE SKIP LOCKED LIMIT %s)
           RETURNING id, memory_id""",
        (MAX_ATTEMPTS, LEASE_MINUTES, n),
    ).fetchall()


def is_mirror(c) -> bool:
    """True si esta BD esta en read-only, es decir: este nodo NO lidera (CENIT 8.6).

    Se pregunta en vez de intentarlo y fallar. Postgres rechaza CUALQUIER UPDATE en una
    transaccion read-only -- incluso uno cuyo WHERE no case con ninguna fila -- asi que sin esta
    comprobacion el worker del nodo de respaldo escupe un error por segundo, para siempre.
    """
    return c.execute("SELECT current_setting('transaction_read_only') = 'on' AS ro").fetchone()["ro"]


def process_once() -> int:
    """Procesa hasta BATCH jobs. Devuelve cuantos proceso, o -1 si este nodo es mirror."""
    with core.conn() as c:
        if is_mirror(c):
            return -1
        muertos = reap_dead_jobs(c)
        if muertos:
            print(f"[worker] {muertos} job(s) abandonados tras {MAX_ATTEMPTS} intentos", flush=True)
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
    era_mirror = None
    while True:
        try:
            n = process_once()
        except Exception as e:  # noqa: BLE001
            print(f"[worker] error: {e}", flush=True)
            n = 0

        if n == -1:
            # Nodo MIRROR: el lider es quien escribe. Se avisa SOLO al cambiar de estado, no en
            # cada vuelta -- un mensaje por segundo no es informacion, es ruido que tapa lo demas.
            if era_mirror is not True:
                print("[worker] este nodo es MIRROR (BD read-only): en espera", flush=True)
                era_mirror = True
            time.sleep(MIRROR_POLL_INTERVAL_S)
            continue

        if era_mirror:
            print("[worker] este nodo YA LIDERA: vuelvo a drenar la cola", flush=True)
        era_mirror = False
        if n == 0:
            time.sleep(POLL_INTERVAL_S)


if __name__ == "__main__":
    main()
