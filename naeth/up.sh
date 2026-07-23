#!/usr/bin/env bash
# up.sh — levanta Naeth como módulo `memory` de CENIT en el nodo Linux `finally` (Paso 8.3).
# Equivalente del up.ps1 de Windows: inyecta los secretos del núcleo (CENIT_DB_PASSWORD,
# OIDC_*) desde SOPS al vuelo, sin escribirlos nunca en disco.
#
#   ./up.sh [--build]   levanta (--build reconstruye la imagen)
#   ./up.sh --down      baja
#
# En este nodo solo corren `api` y `worker`:
#   - `db` es la Postgres VIEJA de Naeth (pre-CENIT); los datos viven en modules-db del núcleo.
#   - `viewer` es la superficie del visor, que en staging NO se expone (ver Caddyfile.finally).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cenit="${CENIT_REPO:-/opt/cenit}"
cd "$here"

SERVICES="api worker"

if [ "${1:-}" = "--down" ]; then
    docker compose down
    exit 0
fi

[ -d "$cenit/secrets" ] || { echo "up.sh: no encuentro el repo de CENIT en $cenit (usa CENIT_REPO=...)" >&2; exit 1; }

# shellcheck disable=SC1091
. "$cenit/core/lib/sops-env.sh"
sops_export "$cenit/secrets/cenit-data.enc.env"     # CENIT_DB_PASSWORD
sops_export "$cenit/secrets/naeth-oidc.enc.env"     # OIDC_CLIENT_ID / OIDC_CLIENT_SECRET
unset SOPS_AGE_KEY

# Host público. Es el MISMO en ambos nodos (memory.enraxk.dev): el connector móvil (8.6)
# hace que producción apunte al líder, así que el base_url no cambia al alternar y el módulo
# no necesita reconfigurarse en cada transición. (En 8.3 esto era memory-finally, el andamio
# del staging; desde P3 el VPS sirve el host de producción.)
export OAUTH_BASE_URL="${OAUTH_BASE_URL:-https://memory.enraxk.dev}"
export ASSETS_PATH="${ASSETS_PATH:-/var/lib/cenit/assets}"
mkdir -p "$ASSETS_PATH"

if [ "${1:-}" = "--build" ]; then
    docker compose build $SERVICES
fi
docker compose up -d $SERVICES

unset CENIT_DB_PASSWORD OIDC_CLIENT_ID OIDC_CLIENT_SECRET
echo "Naeth (módulo memory) levantado en este nodo. base_url=$OAUTH_BASE_URL"
