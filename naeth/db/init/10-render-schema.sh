#!/bin/sh
# Init de Postgres: renderiza la dimension del vector (por-nodo) en el schema y lo aplica.
# Corre UNA sola vez, cuando el volumen pgdata esta vacio (mecanica estandar de la imagen
# postgres en /docker-entrypoint-initdb.d). EMBED_DIM llega como env var del contenedor db.
set -eu

EMBED_DIM="${EMBED_DIM:-384}"
echo "[naeth-init] renderizando schema con EMBED_DIM=${EMBED_DIM}"

sed "s/__EMBED_DIM__/${EMBED_DIM}/g" /schema/schema.sql > /tmp/schema.rendered.sql

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /tmp/schema.rendered.sql

echo "[naeth-init] schema aplicado."
