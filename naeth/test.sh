#!/usr/bin/env bash
# test.sh: corre la suite de `app/` contra un Postgres EFÍMERO, levantado y borrado aquí.
#
#   ./test.sh                    la suite entera
#   ./test.sh -k worker          se le pasa lo que sea a pytest
#   ./test.sh tests/test_core.py -x
#
# NO ES LA ÚNICA VÍA, Y NO SUSTITUYE A LA OFICIAL. `docker compose --profile test run --rm
# test` sigue siendo la de referencia y es la que está en el CLAUDE.md. Esta existe porque
# aquella arrastra cuatro trampas documentadas allí, y tres se caen solas si el Postgres no
# es el del compose:
#
#   · Levanta el servicio `db`, que está retirado a propósito, y hay que acordarse de
#     bajarlo con `docker compose rm -sf db`. Aquí no hay `db` que resucitar, y el trap
#     limpia aunque la suite falle o la cortes con Ctrl+C.
#   · El `down` que tumbó Naeth entero el 22/08/2026 no tiene equivalente aquí: este script
#     no conoce el compose de producción.
#   · El compose hace `pip install` en cada run (20-40 s en caliente, minutos en frío). `uv`
#     cachea el entorno entre ejecuciones.
#   · Y exige `CENIT_DB_PASSWORD` y las dos `OIDC_*` aunque el servicio `test` no las use,
#     porque la interpolación se evalúa sobre el fichero entero. Aquí no hace falta ningún
#     secreto.
#
# La cuarta trampa, que dos suites a la vez se tiran la base mutuamente y dan rojo falso,
# no desaparece, pero deja de ser silenciosa: la segunda ejecución encuentra el puerto
# ocupado y aborta diciéndolo, en vez de dar tests en rojo que no lo están.
#
# POR QUÉ HACE FALTA UN SCRIPT, y no basta `pytest` a pelo desde el host:
#
#   1. `tests/conftest.py` conecta a `db:5432`, que es el nombre del servicio en la red de
#      compose. Desde el host no resuelve, y la suite entera muere en el fixture de sesión
#      con `psycopg.OperationalError` (72 errores, ni un fallo de test real).
#   2. Correrla DENTRO del contenedor de `api` tampoco vale: esa imagen es de runtime y no
#      lleva pytest.
#   3. `psycopg[binary]` no publica wheel para CPython 3.14, que es lo que coge `uv` por
#      defecto en el equipo de desarrollo. De ahí el `--python 3.12` de abajo.
#
# POR QUÉ UN POSTGRES APARTE Y NO EL DE PRODUCCIÓN. El conftest hace
# `DROP DATABASE IF EXISTS naeth_test WITH (FORCE)` y `TRUNCATE` de las tablas de dominio.
# Está bien aislado (opera sobre `naeth_test`, nunca sobre `naeth`), pero apuntarlo al
# Postgres que guarda las memorias vivas pone un DROP a una variable de entorno de
# distancia de los datos reales, y ese error no tiene deshacer. Un contenedor propio cuesta
# tres segundos y quita el riesgo entero.
#
# El puerto es 5432 y no se puede elegir: el DSN del conftest lo lleva escrito. Por eso el
# script comprueba antes que está libre en vez de pisar lo que hubiera ahí.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CONTENEDOR="${NAETH_TEST_CONTAINER:-naeth-test-db}"
# La misma imagen que producción, para que un fallo por versión de Postgres o de pgvector
# aparezca aquí y no en el nodo.
IMAGEN="${NAETH_TEST_IMAGE:-pgvector/pgvector:0.8.5-pg17}"
PUERTO=5432
ESPERA_MAX=60

for cmd in docker uv; do
    command -v "$cmd" >/dev/null 2>&1 || { echo "test.sh: falta '$cmd' en el PATH" >&2; exit 1; }
done

if (exec 3<>"/dev/tcp/127.0.0.1/$PUERTO") 2>/dev/null; then
    # Solo cerrar el descriptor. Un `2>/dev/null` pegado aquí NO afecta a este `exec`:
    # `exec` sin comando aplica sus redirecciones AL SHELL ENTERO y de forma permanente,
    # así que se llevaría por delante el stderr del script y los tres mensajes de abajo
    # saldrían por ninguna parte. Pasó, y el script abortaba mudo con código 1.
    exec 3>&-
    echo "test.sh: ya hay algo escuchando en 127.0.0.1:$PUERTO." >&2
    echo "         El conftest lleva ese puerto escrito en el DSN, así que no se puede mover." >&2
    echo "         Para lo que sea que esté ahí (ojo si es un Postgres con datos) y reintenta." >&2
    exit 1
fi

limpiar() {
    docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true
}
trap limpiar EXIT INT TERM

echo "[naeth-test] levantando $IMAGEN como '$CONTENEDOR' en 127.0.0.1:$PUERTO"
docker run --rm -d --name "$CONTENEDOR" \
    -e POSTGRES_USER=naeth -e POSTGRES_PASSWORD=naeth -e POSTGRES_DB=postgres \
    -p "127.0.0.1:$PUERTO:5432" "$IMAGEN" >/dev/null

listo=""
for _ in $(seq 1 "$ESPERA_MAX"); do
    if docker exec "$CONTENEDOR" pg_isready -U naeth -q 2>/dev/null; then listo=1; break; fi
    sleep 1
done
[ -n "$listo" ] || { echo "test.sh: el Postgres no aceptó conexiones en ${ESPERA_MAX}s" >&2; exit 1; }

# EMBED_DIM se queda en el default del conftest (384) a propósito: los tests del core usan
# búsqueda léxica (q_embedding=None), así que no hacen falta ni el modelo ni la dimensión
# real de producción (1024). Se puede subir por env si algún día un test la necesita.
echo "[naeth-test] corriendo pytest"
set +e
(
    cd "$here/app"
    TEST_DB_HOST=localhost \
    SCHEMA_PATH="$here/db/schema.sql" \
    uv run --quiet --python 3.12 \
        --with-requirements requirements-dev.txt \
        --with-requirements requirements.txt \
        python -m pytest "$@"
)
codigo=$?
set -e

exit $codigo
