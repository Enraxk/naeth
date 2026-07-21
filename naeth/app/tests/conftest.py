"""Fixtures de test para Naeth.

Estrategia (Fase 0): BD efimera `naeth_test` en el mismo Postgres del contenedor `db`.
- Sesion: se crea la BD desde cero y se aplica `db/schema.sql` (renderizando __EMBED_DIM__,
  igual que el init real). Se apunta `core` a esa BD reseteando su pool.
- Cada test: TRUNCATE de las tablas de dominio para aislarse. Los tests pueden truncar
  directo (saltandose la capa ADD-only) porque son los unicos que necesitan borrar.

Los tests del core NO necesitan el modelo de embeddings: usan busqueda lexica
(q_embedding=None), asi que corren sin GPU ni descargas.
"""
from __future__ import annotations

import os
import pathlib

import psycopg
import pytest

DB_HOST = os.environ.get("TEST_DB_HOST", "db")
ADMIN_DSN = f"postgresql://naeth:naeth@{DB_HOST}:5432/postgres"
TEST_DSN = f"postgresql://naeth:naeth@{DB_HOST}:5432/naeth_test"
SCHEMA_PATH = os.environ.get("SCHEMA_PATH", "/srv/db/schema.sql")
EMBED_DIM = int(os.environ.get("EMBED_DIM", "384"))

_DOMAIN_TABLES = "memory, supersession, tombstone, relation, attachment, job"


@pytest.fixture(scope="session", autouse=True)
def _setup_db():
    # (re)crear la BD de test desde cero
    with psycopg.connect(ADMIN_DSN, autocommit=True) as c:
        c.execute("DROP DATABASE IF EXISTS naeth_test WITH (FORCE)")
        c.execute("CREATE DATABASE naeth_test")

    # aplicar el schema renderizado (mismo sed que db/init/10-render-schema.sh)
    sql = pathlib.Path(SCHEMA_PATH).read_text(encoding="utf-8").replace(
        "__EMBED_DIM__", str(EMBED_DIM)
    )
    # quitar comentarios "--" antes de partir por ";" (algunos comentarios llevan ";"
    # dentro y romperian el split por statement). No hay "--" en literales del schema.
    sql = "\n".join(line.split("--", 1)[0] for line in sql.splitlines())
    with psycopg.connect(TEST_DSN, autocommit=True) as c:
        for stmt in sql.split(";"):
            if stmt.strip():
                c.execute(stmt)

    # apuntar el core a la BD de test. `core.DSN` se fija al importar el modulo, asi que
    # no basta el env (pytest ya importo core): se sobreescribe la global y se resetea el pool.
    os.environ["NAETH_DSN"] = TEST_DSN
    import app.core as core

    core.DSN = TEST_DSN
    core._pool = None
    yield


@pytest.fixture(autouse=True)
def _clean_tables():
    with psycopg.connect(TEST_DSN, autocommit=True) as c:
        c.execute(f"TRUNCATE {_DOMAIN_TABLES} RESTART IDENTITY CASCADE")
    yield
