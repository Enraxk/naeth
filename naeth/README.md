# Naeth v1 · Pila base (Paso 7, Fase 1)

Primera instancia real de Naeth en este equipo Windows: `db` (Postgres+pgvector) +
`api` (FastAPI: visor + CRUD, **sin MCP aún**) + `worker` (embeddings CPU). Núcleo del
[Paso 6](../pasos/paso6-esquema.md). MCP/OAuth/túnel llegan en las Fases 2-4.

## Qué hay aquí

```
docker-compose.yml      db + api + worker (todo loopback)
.env.example            copiar a .env
db/schema.sql           DDL del Paso 6 (vector(N) parametrizado por __EMBED_DIM__)
db/init/                init de Postgres: renderiza la dimensión y aplica el schema
app/core.py             acceso único a Postgres (ADD-only)
app/api.py              FastAPI: visor + CRUD (localhost)
app/worker.py           drena cola job(embed) -> UPDATE embedding
app/embeddings.py       modelo por-nodo (e5-small 384 en Fase 1)
app/viewer/index.html   visor (estado de cola, alta, búsqueda híbrida)
bench/hnsw_check.py      verificación HNSW con embeddings reales (recall vs exacto)
```

## Arranque

```sh
# 1. Docker Desktop instalado y CORRIENDO (acepta la licencia la primera vez).
#    Recomendado: Settings -> Resources -> Disk image location -> mover a F:.
# 2. Preparar entorno
cp .env.example .env
mkdir -p /e/naeth/assets        # o crear E:\naeth\assets en el explorador
# 3. Levantar
docker compose up -d --build
# 4. Visor
start http://127.0.0.1:8800
```

El worker descarga el modelo e5-small (~120 MB) en el primer arranque (cacheado en el
volumen `fastembed_cache`). Hasta entonces la búsqueda cae a léxico.

## Verificar HNSW (entregable de la Fase 1)

Cierra el caveat del [Paso 6 §8](../pasos/paso6-esquema.md): mide **recall real** (vs kNN
exacto) y latencia, barriendo `hnsw.ef_search`, con embeddings reales.

```sh
cd naeth
EMBED_MODEL=intfloat/multilingual-e5-small EMBED_DIM=384 \
  uv run --with "psycopg[binary]" --with fastembed python bench/hnsw_check.py --n 2000
# -> hnsw_check.json
```

## Notas

- Todo escucha en `127.0.0.1` (visor 8800, Postgres 5433). Nada público en esta fase.
- `embedding` y `is_current` son **por-nodo** y no se sincronizan ([Paso 8](../pasos/paso8-sync.md)).
- ADD-only: editar = supersede (nueva versión), borrar = tombstone. Nada se pisa.
