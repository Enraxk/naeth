"""Reintentos del discovery del IdP (`mcp_server._retry_discovery`).

Existen por el incidente del 30/07/2026: `_build_auth()` corre al importar el modulo, asi
que un IdP que no contestaba en ese instante mataba el proceso. Y como la sonda de salud de
la que depende `core owner recover` (CENIT) es este mismo proceso, el sistema no podia
recuperar el mando. Estos tests fijan las dos mitades del contrato:

  1. aguanta que el IdP tarde en levantar, y
  2. NO se degrada a "sin auth" cuando se agotan los intentos.

Sin red, sin IdP y sin esperas reales: `build` y `sleep` se inyectan.
"""
from __future__ import annotations

import pytest

from app import mcp_server as ms


class _Sentinela:
    """Lo que devolveria OIDCProxy. Solo hace falta que sea identificable."""


def test_devuelve_a_la_primera_sin_esperar():
    calls, waits = [], []

    def build():
        calls.append(1)
        return _Sentinela

    out = ms._retry_discovery(build, attempts=5, delay=1, sleep=waits.append)

    assert out is _Sentinela
    assert len(calls) == 1
    assert waits == []          # si contesta a la primera no se duerme nada


def test_sobrevive_a_un_idp_que_tarda_en_levantar():
    """El caso real: el IdP local aun arrancando cuando la API ya esta importando."""
    calls, waits = [], []

    def build():
        calls.append(1)
        if len(calls) < 3:
            raise ConnectionError("IdP aun no escucha")
        return _Sentinela

    out = ms._retry_discovery(build, attempts=10, delay=1, delay_max=4, sleep=waits.append)

    assert out is _Sentinela
    assert len(calls) == 3
    assert waits == [1, 2]      # exponencial


def test_la_espera_tiene_techo():
    waits = []

    def build():
        if len(waits) < 6:
            raise ConnectionError("sigue sin contestar")
        return _Sentinela

    ms._retry_discovery(build, attempts=20, delay=1, delay_max=4, sleep=waits.append)

    assert waits == [1, 2, 4, 4, 4, 4]   # dobla hasta el techo y ahi se queda


def test_al_agotar_intentos_PROPAGA_y_no_arranca_sin_auth():
    """La mitad de seguridad del contrato.

    Arrancar sin autenticacion expondria /mcp, asi que agotar los intentos tiene que
    ROMPER el arranque, no devolver None. Si alguien "arregla" esto devolviendo None, el
    servidor arrancaria con `auth=None` y publicaria las 9 tools sin login.
    """
    calls = []

    def build():
        calls.append(1)
        raise ConnectionError("el IdP no esta")

    with pytest.raises(ConnectionError):
        ms._retry_discovery(build, attempts=3, delay=0, sleep=lambda _s: None)

    assert len(calls) == 3     # agota los intentos, no se rinde antes


def test_no_reintenta_si_solo_hay_un_intento():
    calls, waits = [], []

    def build():
        calls.append(1)
        raise TimeoutError("nope")

    with pytest.raises(TimeoutError):
        ms._retry_discovery(build, attempts=1, delay=1, sleep=waits.append)

    assert len(calls) == 1
    assert waits == []          # no duerme despues del ultimo intento
