"""Verificacion de HNSW con embeddings REALES (Paso 7 Fase 1; cierra el caveat del
Paso 6 §8: el spike midio latencia con vectores sinteticos, no recall real).

Mide dos cosas que el spike no pudo:
  1. RECALL@k del indice HNSW vs kNN exacto (fuerza bruta), barriendo hnsw.ef_search.
  2. Latencia p50/p95 de la query HNSW a cada ef_search.

Usa el modelo de embeddings de ESTE nodo (e5-small 384 en Fase 1) sobre un corpus de
frases reales en espanol, para que el recall sea representativo. Escribe en una tabla
desechable `bench_items` (no toca `memory`).

Se ejecuta en el HOST contra el Postgres del compose (127.0.0.1:5433):
    cd naeth
    EMBED_MODEL=intfloat/multilingual-e5-small EMBED_DIM=384 \
        uv run --with psycopg[binary] --with fastembed python bench/hnsw_check.py --n 2000
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.embeddings import EMBED_DIM, EMBED_MODEL, embed_passages, embed_query  # noqa: E402


SUJETOS = ["el sistema de memoria", "la base de datos", "el worker de embeddings",
           "Naeth", "el indice HNSW", "el grafo de relaciones", "la cola async",
           "el visor web", "el servidor MCP", "la busqueda hibrida", "Postgres",
           "pgvector", "el tunel enraxk", "la sincronizacion multi-master"]
ACCIONES = ["mejora el recall semantico", "reduce la latencia de consulta",
            "persiste las memorias de forma inmutable", "regenera los embeddings por nodo",
            "resuelve conflictos de rama fundiendo versiones", "indexa solo lo vigente",
            "evita destruir contexto al editar", "escala a un millon de notas",
            "funciona sin LLM en escritura", "exporta a Markdown sin lock-in",
            "se reconcilia tras un apagon", "ordena los resultados por relevancia"]
MATICES = ["en espanol", "en CPU", "de forma local-first", "sin tocar el disco del sistema",
           "con append puro", "bajo demanda", "de manera observable", "con baja latencia",
           "respetando ADD-only", "para un solo usuario"]


def corpus(n: int) -> list[str]:
    out, i = [], 0
    while len(out) < n:
        s = SUJETOS[i % len(SUJETOS)]
        a = ACCIONES[(i * 7) % len(ACCIONES)]
        m = MATICES[(i * 13) % len(MATICES)]
        out.append(f"{s.capitalize()} {a} {m}.")
        i += 1
    return out


def pct(xs, p):
    xs = sorted(xs); k = (len(xs) - 1) * p / 100.0; f = int(k); c = min(f + 1, len(xs) - 1)
    return xs[f] if f == c else xs[f] + (xs[c] - xs[f]) * (k - f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", default=os.environ.get(
        "NAETH_DSN", "postgresql://naeth:naeth@127.0.0.1:5433/naeth"))
    ap.add_argument("--n", type=int, default=2000, help="tamano del corpus")
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--queries", type=int, default=40)
    ap.add_argument("--ef", default="10,40,100,200")
    ap.add_argument("--out", default="hnsw_check.json")
    args = ap.parse_args()

    efs = [int(x) for x in args.ef.split(",")]
    print(f"[hnsw] modelo={EMBED_MODEL} dim={EMBED_DIM} n={args.n} k={args.k}", flush=True)

    texts = corpus(args.n)
    print("[hnsw] embebiendo corpus (modelo real)…", flush=True)
    vecs = embed_passages(texts)
    if len(vecs[0]) != EMBED_DIM:
        sys.exit(f"dim real {len(vecs[0])} != EMBED_DIM {EMBED_DIM}")

    qtexts = texts[:: max(1, args.n // args.queries)][: args.queries]
    qvecs = [embed_query(t) for t in qtexts]

    def vstr(v): return "[" + ",".join(f"{x:.6f}" for x in v) + "]"

    with psycopg.connect(args.dsn, autocommit=True) as conn:
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        conn.execute("DROP TABLE IF EXISTS bench_items")
        conn.execute(f"CREATE TABLE bench_items (id bigserial PRIMARY KEY, embedding vector({EMBED_DIM}))")
        print("[hnsw] cargando via COPY…", flush=True)
        with conn.cursor().copy("COPY bench_items (embedding) FROM STDIN") as cp:
            for v in vecs:
                cp.write_row([vstr(v)])

        # ground truth: kNN EXACTO (fuerza bruta, sin indice)
        conn.execute("SET enable_indexscan = off")
        conn.execute("SET enable_bitmapscan = off")
        truth = []
        for q in qvecs:
            rows = conn.execute(
                "SELECT id FROM bench_items ORDER BY embedding <=> %s::vector LIMIT %s",
                (vstr(q), args.k)).fetchall()
            truth.append({r[0] for r in rows})
        conn.execute("RESET enable_indexscan"); conn.execute("RESET enable_bitmapscan")

        # indice HNSW con los defaults que el Paso 6 §8 manda medir (m=16, ef_construction=64)
        print("[hnsw] construyendo HNSW (m=16, ef_construction=64)…", flush=True)
        t0 = time.perf_counter()
        conn.execute("CREATE INDEX ON bench_items USING hnsw (embedding vector_cosine_ops)")
        conn.execute("ANALYZE bench_items")
        build_s = time.perf_counter() - t0

        results = []
        for ef in efs:
            conn.execute(f"SET hnsw.ef_search = {ef}")
            # warm-up
            conn.execute("SELECT id FROM bench_items ORDER BY embedding <=> %s::vector LIMIT %s",
                         (vstr(qvecs[0]), args.k)).fetchall()
            recalls, lat = [], []
            for q, gt in zip(qvecs, truth):
                t = time.perf_counter()
                rows = conn.execute(
                    "SELECT id FROM bench_items ORDER BY embedding <=> %s::vector LIMIT %s",
                    (vstr(q), args.k)).fetchall()
                lat.append((time.perf_counter() - t) * 1000)
                got = {r[0] for r in rows}
                recalls.append(len(got & gt) / len(gt))
            r_avg = sum(recalls) / len(recalls)
            row = {"ef_search": ef, "recall_at_k": round(r_avg, 4),
                   "p50_ms": round(pct(lat, 50), 3), "p95_ms": round(pct(lat, 95), 3)}
            results.append(row)
            print(f"[hnsw] ef={ef:>4}  recall@{args.k}={r_avg:.3f}  "
                  f"p50={row['p50_ms']:.2f}ms  p95={row['p95_ms']:.2f}ms", flush=True)

        conn.execute("DROP TABLE bench_items")

    out = {"model": EMBED_MODEL, "dim": EMBED_DIM, "n": args.n, "k": args.k,
           "queries": len(qvecs), "hnsw": {"m": 16, "ef_construction": 64},
           "build_s": round(build_s, 2), "results": results}
    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[hnsw] -> {args.out}", flush=True)


if __name__ == "__main__":
    main()
