# Paso 8 · Sincronización multi-master local ↔ VPS

**Proyecto Naeth** — diseño a fondo de la **reconciliación de memoria** entre la
instancia local (Windows, [Paso 7](paso7-local-windows.md)) y la de `finally`
([Paso 9](paso9-despliegue-vps.md)), para que la memoria siga viva y escribible aunque
el server esté caído por un apagón.

**Fecha**: 2026-06-23 (replanteo V1 local-first) · **diseño a fondo 2026-06-24**
**Estado**: diseño en papel. **No** escribo código aquí; es el plan que luego se ejecuta
por fases y con OK. Citar evidencia; nunca imprimir secretos.

---

## TL;DR

- **Multi-master local-first**: local Windows y `finally`, cada uno con su Postgres
  completo. Escritura offline en cualquiera; reconciliación eventual al reconectar.
- **Transporte: sync a nivel de aplicación**, pull bidireccional por cursor, sobre el
  stack FastAPI y los túneles, autenticado con token de servicio. **No** replicación
  lógica nativa de Postgres (ver §2).
- **Casi gratis por el [Paso 6](paso6-esquema.md)**: `id uuid` (sin colisión entre
  nodos) + modelo ADD-only ⇒ sincronizar es **unir filas nuevas**.
- **Se sincroniza**: `memory`, `relation`, `attachment` + **binarios** de adjuntos.
  **No**: la cola `job` ni los `embedding` (cada nodo los regenera con su modelo, §3).
- **Conflictos de rama** (misma nota editada en ambos nodos offline): se **marcan en
  conflicto** y se funden; nada se pierde nunca (§5).

---

## 0. Motivo

Los **apagones** tumban `finally` y obligan a esperar a que vuelva. Naeth debe seguir
**vivo y escribible en local** durante la caída y **reconciliar** cuando el server
vuelva. No es un mirror de lectura: ambos nodos son **fuente de verdad** y se fusionan.

Los apagones son **ocasionales** (no constantes) y ocurren entre **dos nodos fijos**
sobre los que solo se puede actuar desde casa (el local es el equipo de casa, no un
portátil itinerante). La **consistencia eventual** encaja de lleno con cortes
esporádicos: no hace falta tiempo real, basta reconciliar cuando vuelve la conexión.

## 1. Por qué es casi gratis (gracias al Paso 6 y al Paso 7)

- **`id uuid` PK** en `memory`/`relation`/`attachment` ([Paso 6](paso6-esquema.md)) →
  dos nodos crean filas a la vez **sin colisión de IDs**. Prerrequisito del multi-master,
  ya está.
- **Modelo ADD-only** (editar = `INSERT` con `supersedes`; borrar = tombstone) → tablas
  esencialmente **append**. Sincronizar deja de ser "replicar mutaciones in-place" (con
  conflictos) y pasa a ser **"unir conjuntos de filas nuevas"**.
- **Embeddings por-nodo** ([Paso 7](paso7-local-windows.md) §8): cada nodo regenera sus
  embeddings con su modelo (bge-m3 1024-dim en local, e5-small 384-dim en `finally`), así
  que la columna `embedding` **no se sincroniza** y su dimensión puede diferir entre
  nodos sin problema. Esto, además, **descarta de raíz** la replicación lógica nativa
  (§2).

## 2. Modelo y transporte: por qué app-level y no replicación nativa

**Decisión: sync a nivel de aplicación** (pull bidireccional por cursor/checkpoint, en
bloque), el patrón probado de los sistemas offline-first ([RxDB](https://rxdb.info/replication.html),
[ElectricSQL](https://electric-sql.com/blog/2023/09/20/introducing-electricsql-v0.6),
CouchDB/PouchDB multi-leader). La **replicación lógica bidireccional nativa de Postgres**
(`origin=none`, PG16+) queda descartada por tres razones, cualquiera de ellas suficiente:

1. **Exige esquemas compatibles y no replica DDL** ([Mydbops](https://www.mydbops.com/blog/bidirectional-logical-replication-in-postgresql-16),
   [PostgreSQL docs](https://www.postgresql.org/docs/current/logical-replication-conflicts.html)).
   Pero en Naeth **la dimensión del vector difiere por nodo** y los **embeddings no se
   sincronizan** — la replicación nativa replicaría esa columna y chocaría. Inviable.
2. **Sin resolución automática de conflictos**: cuando dos nodos tocan la misma fila,
   Postgres no decide ([Severalnines](https://severalnines.com/blog/postgresql-bi-directional-logical-replication-deep-dive/)).
   Habría que ponerla por fuera igualmente.
3. Está pensada para **alta disponibilidad con conexión continua**, no para nodos que se
   caen por apagones durante horas y reconcilian después.

El app-level encaja: Naeth ya es FastAPI con cola `job`, aplica **su propia semántica
ADD-only/supersede**, transporta solo las columnas que queremos (sin embeddings) y
sobrevive a desconexiones largas.

## 3. Qué se sincroniza y qué no

| Dato | ¿Sync? | Nota |
|---|---|---|
| `memory` (filas) | **Sí** | unión por `id`; ADD-only |
| `memory.author` ([Paso 10](paso10-autoria.md)) | **Sí** | dentro de la fila; describe el acto de escritura, no el nodo; ningún nodo lo recalcula |
| `memory.author_*` (generadas) | **No** | derivadas del `author`, se recalculan en cada nodo |
| `relation` (filas) | **Sí** | unión por `id` |
| `attachment` (filas) | **Sí** | metadatos + `extracted_text` |
| **binarios** de adjuntos | **Sí** | content-addressed por `sha256` (§6) |
| `embedding` | **No** | cada nodo lo regenera (modelo/dim por-nodo) |
| `job` (cola) | **No** | cola local; cada nodo encola sus propios embeddings |
| `valid_to` (de la fila vieja) | **Derivado** | no se transfiere: se recalcula por la cadena `supersedes` (§8) |
| `deleted_at` (tombstone) | **Sí** | estado genuino; mejor modelado append (§8) |

## 4. Transporte: pull por cursor

- **Pull bidireccional**: cuando hay conexión, cada nodo pregunta al otro "dame tus filas
  con `(created_at, id) > cursor`". Cursor (watermark) por nodo origen. Al ser ADD-only,
  el avance es monotónico y robusto ante cortes (se reanuda desde el cursor).
- **Topología**: cada nodo es alcanzable por **su propio túnel** (`naeth-local.enraxk.dev`
  y `naeth.enraxk.dev`). Durante un apagón, `finally` no responde → local sigue
  escribiendo y reintenta; cuando `finally` revive, ambos reconcilian. Un *health-poll*
  detecta cuándo el otro nodo está vivo.
- **Auth entre nodos**: token de servicio dedicado (patrón `X-Enraxk-Token` del
  [Paso 9](paso9-despliegue-vps.md)), distinto del OAuth de claude.ai.
- **Cadencia**: configurable (p. ej. cada N minutos + al detectar reconexión). No hace
  falta tiempo real; la consistencia es eventual.
- **Endpoint de sync**: una ruta más sobre el mismo core (FastAPI), que pagina filas y
  sirve/recibe blobs (§6).

## 5. Conflictos y orden

- **Orden determinista**: `created_at` (timestamptz) con desempate por `id`. **Sin HLC ni
  Lamport** — over-engineering para dos nodos de un usuario; `created_at + id` basta para
  desempatar de forma idéntica en ambos lados.
- **Inserts** (`memory`/`relation` nuevos): **unión**, sin conflicto (UUID únicos).
  `content_hash` da idempotencia: si ambos nodos crean la misma nota, dedup.
- **Tombstones** (`deleted_at`): monotónico — una vez marcado, queda marcado; al
  reconciliar se toma el valor no-nulo (menor timestamp). Mejor aún si se modela como
  fila-evento append (§8), y entonces es unión pura.
- **Ramas de `supersede`** (la misma nota editada offline en ambos nodos → dos versiones
  hijas del mismo padre): política elegida = **marcar en conflicto y fundir**.
  - Detección: un padre con **>1 hija vigente** (ambas vigentes y con el mismo
    `supersedes`). La vista de "vigentes" muestra **ambas, marcadas en conflicto**.
  - Resolución: el usuario **funde** creando una versión nueva que reemplaza a las dos
    ramas. Como todo es ADD-only, **nada se pierde**: ambas ramas siguen en el historial.
  - Esto requiere un ajuste de esquema (supersede de varios padres) — ver §8.

## 6. Binarios de adjuntos (content-addressed)

El sync v1 **incluye los archivos físicos** (PDF/HTML/...), no solo metadatos:

- Cada `attachment` tiene `sha256` ([Paso 6](paso6-esquema.md)). El blob se direcciona
  por ese hash (content-addressed).
- En cada reconciliación, tras unir las filas `attachment`, el nodo pide al otro **los
  blobs cuyo `sha256` le falten** y los transfiere por streaming. Idempotente y
  **deduplicado** (mismo contenido = mismo hash = no se retransfiere).
- Los bytes viven en el disco de cada nodo (en `finally`, el volumen LUKS del
  [Paso 9](paso9-despliegue-vps.md)); el sync los **copia**, no los mueve.
- Robustez: si un blob falla a mitad, se reintenta por su hash en la siguiente ronda; la
  fila `attachment` ya está sincronizada, solo falta su binario (estado "pendiente de
  blob").

## 7. Arranque en frío

- Hoy **no hay datos reales en ningún nodo** (el deploy nunca se ejecutó), así que el
  primer sync parte de cero.
- Cuando haya datos, el **primer sync entre nodos** transfiere todo el histórico
  (filas + blobs) paginado por el cursor; a partir de ahí, incremental.

## 8. Implicaciones para el esquema (Paso 6)

El sync multi-master pide tres ajustes pequeños al esquema del [Paso 6](paso6-esquema.md),
a confirmar al implementar:

1. **`valid_to` es derivable, no se sincroniza**: una fila está "cerrada" si existe otra
   que la `supersede`. Recalcular en cada nodo evita transferir un campo mutable. (Puede
   mantenerse como caché local, recomputado tras cada sync.)
2. **Tombstone append-only**: modelar el borrado como una **fila-evento** (en vez de
   `UPDATE deleted_at` in-place) hace que el sync sea unión pura, sin reconciliar
   mutaciones. Alternativa mínima: mantener `deleted_at` pero tratarlo como monotónico.
3. **`supersedes` de varios padres**: para **fundir ramas** (§5) hace falta que una
   versión pueda reemplazar a **más de una** anterior → `supersedes uuid[]` o una tabla
   `supersession(child, parent)`. Hoy el Paso 6 lo define como `uuid` singular.

## 9. Fases de ejecución (cada una con OK)

1. **Cursor + endpoint de sync** de filas (`memory`/`relation`/`attachment`) entre dos
   instancias locales de prueba; verificar unión idempotente por `id`.
2. **Reconciliación de estado**: tombstones monotónicos y `valid_to` derivado.
3. **Detección y marcado de conflictos de rama**; fusión (con el ajuste de `supersedes`).
4. **Binarios** content-addressed por `sha256` (transferir faltantes, dedup, reintento).
5. **Sync real local ↔ `finally`** sobre los túneles, con token de servicio y health-poll;
   prueba de apagón (escribir offline en local, revivir `finally`, reconciliar).

## 10. Lo que este paso NO hace

- No levanta Naeth (eso es el [Paso 7](paso7-local-windows.md)).
- No despliega `finally` (eso es el [Paso 9](paso9-despliegue-vps.md)).
- No sincroniza embeddings ni la cola `job` (por diseño, §3).
- No usa replicación lógica nativa de Postgres (§2).
