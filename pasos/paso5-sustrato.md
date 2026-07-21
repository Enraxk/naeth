# Paso 5 · Comparativa y decisión de sustrato

**Proyecto Naeth** — elegir el almacén canónico de Naeth v1 antes de construir la
app web. Dos candidatos en conflicto (ver `paso4-app-web.md` y la divergencia con el
diseño de claude.ai):

- **A · Postgres + pgvector + tsvector** (build propio, diseño de claude.ai).
- **B · Basic Memory** (Markdown soberano + SQLite + sqlite-vec, validado en el Paso 3).

**Fecha**: 2026-05-30
**Criterio rey (lo pediste tú)**: que escale a futuro, lo mejor posible, **la visión
del grafo de nodos y la interfaz**. Todo lo demás se pondera por debajo de eso.
**Reglas**: citar evidencia (incluido el propio spike); marcar `⚠ sin verificar`.

---

## 1. El eje decisivo: búsqueda semántica a escala

La visión del grafo se sostiene sobre **aristas semánticas**: "muéstrame lo que se
*parece* a esta memoria" = kNN sobre embeddings. Es la operación que más se ejecuta
en un grafo de vecindad y la que más crece con el corpus. Aquí los dos sustratos NO
juegan en la misma liga:

| | Postgres + pgvector | Basic Memory (sqlite-vec) |
|---|---|---|
| Índice vectorial | **HNSW** (ANN, sublineal) | fuerza bruta (lineal O(N)) |
| kNN a 100k (p50/p95) | **2,03 / 2,37 ms** (medido) | 47 / 59 ms (medido, Paso 3) |
| kNN a 500k (p50/p95) | **2,85 / 3,42 ms** (medido) | 208 / 222 ms (medido, Paso 3) |
| kNN a 1M (p50/p95) | **3,28 / 3,79 ms** (medido) | ~400 ms (extrapolado, Paso 3) |
| Crece de 100k a 1M | **~1,6×** (10× datos) | **~10×** (lineal) |

Ambos medidos. sqlite-vec es **lineal**: degrada con el tamaño. pgvector con índice
**HNSW** es ANN sublineal: a 1M es **~100× más rápido** y casi no sube. **Para "escalar
el grafo a la perfección", pgvector gana de forma decisiva**, porque el coste de las
aristas semánticas no se dispara al crecer.

> **Verificado (2026-05-30) en el server `finally`** (Ryzen 5 5600X, CPU-only, contenedor
> `pgvector/pgvector:pg16` desechable). Nota de despliegue: construir el índice HNSW de
> 1M tardó **5,7 min con tuning** (`maintenance_work_mem=2GB`,
> `max_parallel_maintenance_workers=4`); a config por defecto serían ~40 min. El insert
> (COPY) es lineal (~138 s para 1M). En uso ADD-only incremental, HNSW indexa por
> inserción: el rebuild completo solo hace falta en una importación masiva.

---

## 2. Aristas explícitas y recorrido del grafo

- **Postgres**: las relaciones son una tabla (`source_id`, `target_id`, `tipo`). La
  vecindad a N saltos se resuelve con `WITH RECURSIVE` + índice en `source_id`. No es
  una BD de grafos (sin algoritmos nativos de pathfinding/comunidades), pero la **vista
  de vecindad poco profunda** que pide el grafo heptápodo (foco + 1-2 saltos) es justo
  lo que un CTE recursivo hace rápido. Y combinas en **una sola query**: aristas +
  filtro estructural (carpeta/tag/fecha, SQL) + kNN (vector) + texto (`tsvector`).
- **Basic Memory**: las relaciones salen de los wikilinks y se consultan con
  `build_context` (profundidad/forma limitadas a lo que su API expone). Para un grafo a
  medida acabarías leyendo su SQLite directo, **acoplándote a un esquema que cambia
  cada release** (single-maintainer, Paso 1) y a su licencia AGPL.

**Para una UI de grafo a medida, Postgres da control total de exactamente las queries
que la interfaz necesita**; Basic Memory te encierra en su modelo o te obliga a hackear
su DB.

---

## 3. La interfaz a medida

Tu interfaz (árbol, CRUD, editor enriquecido, grafo global+vecindad con toggle,
búsqueda, adjuntos) necesita queries específicas: vecindades, kNN con umbral,
agregados para la vista global (clusters, conteos), listados paginados, filtros
combinados.

- **Postgres**: las escribes tú, encajan como un guante, y el motor las sirve a escala.
- **Basic Memory**: dependes de que su API exponga lo que la UI pide; lo que no, lo
  improvisas contra su esquema.

Además, tú ya tienes **patrón propio de MCP** (FastAPI + `X-Enraxk-Token`). Postgres lo
**reusa** (consistencia con tus otros servicios `enraxk.dev`); Basic Memory trae su
propio FastMCP, ajeno a tu patrón.

---

## 4. Lo que Basic Memory tenía a favor, revisado

- **Soberanía como ficheros Markdown legibles**: era su gran ventaja. Pero **descartas
  Obsidian al 100% (q5)**, así que el beneficio de "un humano edita los `.md`" se
  desvanece: la interfaz humana pasa a ser tu app web. Y la soberanía no se pierde con
  Postgres: puedes **exportar a Markdown** cuando quieras y un `pg_dump` es portable.
- **Menos código que escribir al principio**: cierto, Basic Memory te da CRUD ya hecho.
  Es su ventaja real y honesta. Pero a cambio heredas su modelo, su licencia y su ritmo.
- **Ya validado en el spike**: sí, pero el spike validó **principios** (recall barato,
  el coste es el embedding, la cola async lo esconde) que son **agnósticos del sustrato**
  y valen igual para Postgres. No se tira nada.

---

## 5. Adjuntos (q6) en cada sustrato

- **Postgres**: binario en disco (volumen cifrado) + fila con metadatos + texto extraído
  (PDF/HTML) + su embedding. El adjunto es un nodo más del grafo, con su kNN. Limpio.
- **Basic Memory**: binario en disco + `.md` sidecar con texto extraído. También limpio,
  pero el sidecar vive bajo el modelo de Basic Memory.

Empate funcional; en Postgres el adjunto entra en el mismo motor de queries que todo lo
demás.

---

## 6. Veredicto ponderado

Peso alto = el criterio rey (grafo + UI a escala).

| Criterio | Peso | Postgres+pgvector | Basic Memory |
|---|---|---|---|
| **Escala del grafo (kNN semántico)** | ★★★ | **gana** (HNSW sublineal) | lineal, degrada |
| **UI a medida (control de queries)** | ★★★ | **gana** | encerrado en su modelo |
| Aristas + recorrido | ★★ | CTE recursivo, una query | build_context limitado |
| Reuso de tu patrón MCP | ★★ | **sí** | no |
| ADD-only nativo | ★★ | **sí** | no nativo |
| Simplicidad ("lo más simple") | ★★ | un almacén, un servicio | dos backends + bus |
| Soberanía legible | ★ | export a MD / pg_dump | `.md` nativo (ventaja) |
| Código a escribir al inicio | ★ | más (lo construyes) | menos (ya hecho) |
| Validado en spike | ★ | principios sí | directo |

**Recomendación: Postgres + pgvector (con índice HNSW).** Es el sustrato que cumple tu
prioridad número uno (escalar el grafo y la interfaz a la perfección), reusa tu patrón,
soporta ADD-only nativo, y **reconcilia con tu diseño canónico de claude.ai**. Basic
Memory era una buena composición para "memoria personal con Markdown soberano + Obsidian",
pero al quitar Obsidian y poner por delante "grafo escalable + UI propia", su punto
fuerte se cae y su punto débil (kNN lineal, modelo ajeno) pasa al frente.

---

## 7. Qué cambia si se elige Postgres

- **El Paso 4 (app web) se mantiene casi entero**: la estética heptápoda, el grafo
  global+vecindad, los embeddings, los adjuntos, Cloudflare Tunnel, LUKS, Milkdown,
  todo sigue. Lo que cambia es el **modelo de datos detrás**: nodos = filas, no ficheros;
  el "árbol de carpetas" pasa a ser una jerarquía lógica (campo `path`/colecciones) en
  vez de carpetas de `.md` en disco. Lo reescribo en el Paso 4.
- **El visor del spike** (`spike/viewer`) seguía sobre Basic Memory: pasa a ser un
  prototipo desechable; el bueno se hace sobre Postgres.
- **El spike de recall** se da por bueno en principios; conviene la verificación de
  pgvector HNSW del §1 antes de construir en serio.

---

## 8. Lo que NO decide este documento

- El esquema concreto de Postgres (tablas, índices) ni el código: es el Paso 6 (build).
- ~~La verificación empírica de pgvector HNSW~~ **hecha** (§1): HNSW sublineal confirmado.
- El modelo exacto de ADD-only (versiones append-only vs soft-delete): se concreta al
  diseñar el esquema.

---

**Fin del Paso 5. Decisión cerrada con evidencia: Postgres + pgvector (HNSW).** El
spike de verificación (§1) confirmó kNN sublineal a 1M en CPU. Siguiente: actualizar el
Paso 4 al sustrato Postgres y planificar el despliegue en `finally` (LUKS para `pgdata`,
backups, hostname en el túnel `enraxk`, endurecimiento del server).
