# Paso 7 · Resultados de la Fase 1 (pila base local)

> Banco real en **este equipo Windows** con **Docker Desktop** (Postgres 17 +
> pgvector, FastAPI, worker de embeddings en CPU). Construcción real, no papel: la
> Fase 1 del [Paso 7](paso7-local-windows.md) §10.1. Código en `naeth/`. Fecha: 2026-06-25.

## Qué se levantó

La pila base del [Paso 7](paso7-local-windows.md): `db` (`pgvector/pgvector:pg17`) +
`api` (FastAPI: visor + CRUD, **sin MCP aún**) + `worker` (embeddings async), todo en
loopback sobre Docker Desktop. El **núcleo del [Paso 6](paso6-esquema.md)** aplicado tal
cual: 6 tablas (`memory`, `supersession`, `tombstone`, `relation`, `attachment`, `job`),
la vista `memory_current` y los índices (HNSW parcial sobre `is_current`, GIN sobre
`tsv`/`tags`, etc.). Dimensión del vector **parametrizada** (`vector(384)` renderizado en
el init desde `EMBED_DIM`).

## Tabla de verificación

| Comprobación | Qué valida (Paso 6/7) | Resultado | Veredicto |
|---|---|---|---|
| Schema aplicado | esquema Paso 6 completo | 6 tablas + `memory_current` + índices | ✅ |
| Dimensión parametrizada | `vector(N)` por-nodo (§8 Paso 7) | `vector(384)` desde `EMBED_DIM` | ✅ |
| Alta síncrona + cola | escritura barata, embedding async (§7 Paso 6) | alta < 1 s, encola `job(embed)` | ✅ |
| Worker drena la cola | embeddings CPU por-nodo | lag medio **0.6 s** enqueue→done | ✅ |
| Búsqueda híbrida RRF | semántica + léxica en una query (§9 Paso 6) | top-hits correctos (semántico y léxico) | ✅ |
| ADD-only: supersede | versión nueva, la vieja permanece | 5 versiones, 3 vigentes | ✅ |
| ADD-only: tombstone | borrado lógico sin DELETE físico | tombstone fuera de `memory_current` | ✅ |
| **HNSW con embeddings reales** | cierra el caveat del [Paso 6 §8](paso6-esquema.md) | recall@10 **0.96**, sub-ms | ✅ |

## Verificación HNSW (el entregable clave)

Con los **defaults que el [Paso 6 §8](paso6-esquema.md) manda medir** (`m=16,
ef_construction=64`), corpus de 2000 frases reales en español embebidas con el modelo del
nodo, k=10, ground truth = kNN exacto (fuerza bruta, sin índice):

| ef_search | recall@10 | p50 | p95 |
|---|---|---|---|
| 10 | 0.96 | 0.87 ms | 0.93 ms |
| 40 | 0.96 | 0.90 ms | 1.01 ms |
| 100 | 0.96 | 0.97 ms | 1.07 ms |
| 200 | 0.96 | 1.09 ms | 1.18 ms |

Build del índice: **0.14 s**. **Recall 0.96 a latencia sub-ms**: HNSW con los defaults
de pgvector vale para Naeth; no hace falta subir `ef_search`. El caveat del Paso 6 §8 (el
spike midió latencia con vectores sintéticos, no recall real) queda **cerrado**.

## Un ajuste forzado por la librería

El [Paso 7 §8](paso7-local-windows.md) fijaba **e5-small (384)** para el nodo local, pero
**fastembed 0.5.1 no lo incluye** (solo `intfloat/multilingual-e5-large`, 1024). Se usó el
equivalente multilingüe soportado: **`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`**
(384-dim, ligero, español). **Mismo tamaño de vector** → no toca el schema; es reversible
por env var (`EMBED_MODEL`). bge-m3 / e5 entran en la **Fase 2** (evaluación de calidad del
recall en español), que es donde el plan los sitúa de todos modos.

## Caveats honestos

- **Recall plano (0.96 en todos los `ef_search`)**: el corpus de la verificación es
  **generado por plantillas** (combinaciones sujeto/acción/matiz → baja diversidad,
  muchos near-duplicates), así que el índice acierta casi todo ya con `ef=10`. Para una
  curva recall-vs-`ef_search` representativa hace falta un corpus real variado; es
  refinamiento de medición, no bloquea la Fase 1 (lo que tocaba —confirmar que HNSW da
  recall alto a baja latencia con embeddings reales— está confirmado).
- **Sin MCP/OAuth/túnel todavía**: la Fase 1 solo es la pila base + visor local. Las
  herramientas MCP (Fase 2), OAuth 2.1 (Fase 3) y el túnel `enraxk` + claude.ai (Fase 4)
  vienen después.
- **`pgdata` aún en C:**: arrancó en el volumen Docker por defecto. Mover la *disk image*
  de Docker Desktop a **F:** (Settings → Resources) queda pendiente; con datos mínimos es
  trivial hacerlo más tarde.
- **No es calidad de recall en español**: recall@k aquí mide HNSW vs exacto (¿el índice
  recupera lo que recuperaría la fuerza bruta?), **no** si el modelo entiende bien el
  español. Eso es la Fase 2.

## Veredicto de la Fase 1

La pila base del [Paso 7](paso7-local-windows.md) **corre en real** sobre Docker Desktop:
el núcleo ADD-only del [Paso 6](paso6-esquema.md) (alta síncrona + cola async + supersede
+ tombstone), la búsqueda híbrida RRF y el índice **HNSW verificado con embeddings reales**
(recall 0.96, sub-ms). Procede la **Fase 2**: exponer las herramientas MCP sobre el mismo
core y validarlas desde Claude Code por `localhost`.
