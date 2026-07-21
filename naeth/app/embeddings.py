"""Embeddings por-nodo (Paso 6 §7, Paso 7 §8).

Modelo y dimension configurables por env var. Fase 1 local: multilingual-e5-small
(384-dim). `finally` usa el mismo; bge-m3 (1024) se evalua en Fase 2. La dimension
debe coincidir con la columna vector(N) creada en el schema (EMBED_DIM).

e5 exige prefijos asimetricos: "passage: " al indexar, "query: " al buscar. Si en el
futuro se usa bge-m3 (sin prefijos), basta poner EMBED_PREFIX=none.
"""
from __future__ import annotations

import os
from functools import lru_cache

EMBED_MODEL = os.environ.get("EMBED_MODEL", "intfloat/multilingual-e5-small")
EMBED_DIM = int(os.environ.get("EMBED_DIM", "384"))
# "e5" -> prefijos passage/query; "none" -> sin prefijo (p.ej. bge-m3)
EMBED_PREFIX = os.environ.get("EMBED_PREFIX", "e5")


@lru_cache(maxsize=1)
def _model():
    from fastembed import TextEmbedding
    return TextEmbedding(model_name=EMBED_MODEL)


def _prefixed(texts: list[str], kind: str) -> list[str]:
    if EMBED_PREFIX == "e5":
        tag = "query: " if kind == "query" else "passage: "
        return [tag + t for t in texts]
    return texts


def embed_passages(texts: list[str]) -> list[list[float]]:
    """Embebe documentos para indexar."""
    vecs = list(_model().embed(_prefixed(texts, "passage")))
    return [v.tolist() for v in vecs]


def embed_query(text: str) -> list[float]:
    """Embebe una consulta de busqueda (consistencia interna por-nodo, Paso 6 §9)."""
    vec = next(iter(_model().embed(_prefixed([text], "query"))))
    return vec.tolist()


def warmup() -> int:
    """Fuerza la descarga/carga del modelo. Devuelve la dimension real medida."""
    v = embed_query("warmup")
    if len(v) != EMBED_DIM:
        raise RuntimeError(
            f"EMBED_DIM={EMBED_DIM} no coincide con la dimension real del modelo "
            f"{EMBED_MODEL} ({len(v)}). Ajusta EMBED_DIM y recrea el schema."
        )
    return len(v)
