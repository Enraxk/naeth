"""Tests del worker de embeddings.

El foco está en lo que falló de verdad: los jobs que se quedan colgados. El caso feliz (hay un
job pendiente, se procesa) nunca ha dado problemas; el que costó 18 días descubrir es el otro.

No hace falta el modelo: se prueba la RECLAMACIÓN de jobs, no el cálculo del vector.
"""
from __future__ import annotations

import psycopg
import pytest

from app import core
from app.worker import (
    LEASE_MINUTES,
    MAX_ATTEMPTS,
    claim_batch,
    reap_dead_jobs,
)


def _mem_con_job(estado: str, *, edad_min: int = 0, attempts: int = 0) -> str:
    """Crea una memoria y le fuerza un job en el estado dado. Devuelve el id del job."""
    # `core.add` devuelve {"memory": {...}, "created": bool}, no la fila suelta.
    m = core.add("contenido de prueba", title="prueba", memory_type="observation")["memory"]
    with core.conn() as c:
        # `core.add` ya encola un job 'pending'; se ajusta al estado que pide el test.
        row = c.execute(
            """UPDATE job SET status=%s, attempts=%s,
                      started_at = now() - make_interval(mins => %s)
               WHERE memory_id=%s RETURNING id""",
            (estado, attempts, edad_min, m["id"]),
        ).fetchone()
    return row["id"]


# ── Lo que ya funcionaba ─────────────────────────────────────────────────────────────────

def test_un_job_pendiente_se_reclama():
    _mem_con_job("pending")
    with core.conn() as c:
        assert len(claim_batch(c, 10)) == 1


def test_un_job_recien_cogido_NO_se_roba():
    """El lease no debe pisarle el trabajo a un worker que está procesando ahora mismo."""
    _mem_con_job("processing", edad_min=1)
    with core.conn() as c:
        assert claim_batch(c, 10) == []


# ── El fallo real: jobs huérfanos (2026-07-26) ───────────────────────────────────────────

def test_un_job_huerfano_se_vuelve_a_reclamar():
    """EL caso que costó dos memorias invisibles durante 18 días.

    El worker moría a mitad (reinicio del PC, de Docker, un apagón), el job se quedaba en
    'processing' PARA SIEMPRE y su memoria nunca recibía embedding: presente, legible, buscable
    por texto y AUSENTE de la búsqueda semántica. Sin un solo error en los logs."""
    _mem_con_job("processing", edad_min=LEASE_MINUTES + 1)
    with core.conn() as c:
        reclamados = claim_batch(c, 10)
    assert len(reclamados) == 1, "el job huerfano deberia volver a la cola"


def test_el_intento_se_cuenta_al_reclamar():
    """`attempts` tiene que subir, o el tope de reintentos no serviría de nada."""
    job_id = _mem_con_job("processing", edad_min=LEASE_MINUTES + 1, attempts=2)
    with core.conn() as c:
        claim_batch(c, 10)
        n = c.execute("SELECT attempts FROM job WHERE id=%s", (job_id,)).fetchone()["attempts"]
    assert n == 3


def test_un_job_que_agoto_los_intentos_no_se_reclama_mas():
    """Un job que falla SIEMPRE (texto que revienta al modelo, memoria corrupta) no puede
    volver cada 15 min eternamente: sería un bucle infinito silencioso."""
    _mem_con_job("processing", edad_min=LEASE_MINUTES + 1, attempts=MAX_ATTEMPTS)
    with core.conn() as c:
        assert claim_batch(c, 10) == []


def test_los_agotados_se_marcan_error_y_dejan_de_estar_en_limbo():
    """Marcarlos 'error' los hace CONTABLES: `system_status` los ve, así que un problema
    recurrente sale a la luz en vez de quedarse escondido en 'processing'."""
    job_id = _mem_con_job("processing", edad_min=LEASE_MINUTES + 1, attempts=MAX_ATTEMPTS)
    with core.conn() as c:
        assert reap_dead_jobs(c) == 1
        row = c.execute("SELECT status, error FROM job WHERE id=%s", (job_id,)).fetchone()
    assert row["status"] == "error"
    assert "intentos" in (row["error"] or "")


def test_reap_no_toca_los_que_aun_tienen_intentos():
    _mem_con_job("processing", edad_min=LEASE_MINUTES + 1, attempts=1)
    with core.conn() as c:
        assert reap_dead_jobs(c) == 0


def test_reap_no_toca_un_job_vivo():
    """Un job recién cogido con muchos intentos previos sigue siendo un job EN CURSO."""
    _mem_con_job("processing", edad_min=0, attempts=MAX_ATTEMPTS)
    with core.conn() as c:
        assert reap_dead_jobs(c) == 0


def test_el_lease_no_afecta_a_los_done():
    """Un job terminado hace meses no debe resucitar por ser viejo."""
    _mem_con_job("done", edad_min=60 * 24 * 30)
    with core.conn() as c:
        assert claim_batch(c, 10) == []
        assert reap_dead_jobs(c) == 0
