# Pendientes de Naeth

Lista viva. Se marca lo hecho, no se borra. El razonamiento de cada línea, con su evidencia, está en
[`plan-fases-2026-08-28.md`](plan-fases-2026-08-28.md); aquí solo está el qué y el dónde.

Las líneas marcadas **[Eneko]** son decisiones, no trabajo: bloquean la tarea que llevan al lado.

---

## Fase 1 · El alta de memoria sale a producción · CERRADA el 28/08/2026

Desplegada en los dos nodos como **`2.2026.08.2`** (`ec54d3e` y `9d4fda4`).

- [x] **[Eneko]** Selector de ruta: input libre con sugerencias, ni plano ni agrupado
- [x] **[Eneko]** Vocabulario de `memory_type`: cerrar en 4 y migrar las 2 `reference`
- [x] **[Eneko]** El `.pen` borrado: se commitea el borrado
- [x] Ranking de rutas con 16 tests → [`lib/pathpick.ts`](../../naeth/web/src/lib/pathpick.ts)
- [x] El campo con sugerencias, en las dos vistas que editan metadatos → [`components/PathField.svelte`](../../naeth/web/src/components/PathField.svelte)
- [x] Cerrar la lista de tipos en cuatro, y retirar `learning` y `error` también del mapa de iconos → [`views/Memoria.svelte`](../../naeth/web/src/views/Memoria.svelte), [`lib/colors.ts`](../../naeth/web/src/lib/colors.ts)
- [x] Actualizar la tabla "Alcance" y la estructura → [`web/README.md`](../../naeth/web/README.md)
- [x] Commit, despliegue en los dos nodos y tag
- [x] **Acotar el escaneo de Tailwind a `src/`**, que hacía que el CSS de producción dependiera de dos ficheros sin versionar y que los dos nodos sirvieran cosas distintas → [`src/app.css`](../../naeth/web/src/app.css)
- [x] Migrar las dos memorias de `reference` a `fact` (28/08). `aa342087` → `68a36b57` (`cenit/infra`) y `ded8a830` → `3fa1c3a0` (`cenit/design`). El corpus vigente ya usa **solo** los cuatro tipos de la convención
- [x] **[Eneko]** Crear una memoria de verdad desde el móvil en `naeth-visor.enraxk.dev` (28/08). El alta llegó entera; de paso destapó el defecto del selector de wikilinks, corregido en `2.2026.08.4`

## Fase 2 · La marca y el movimiento entran en el visor · CERRADA el 28/08/2026

Desplegada en los dos nodos como **`2.2026.08.3`** (`01a586f` la marca, `fe38975` el movimiento).

- [x] **[Eneko]** Dónde va la marca: el lockup sustituye al texto de la cabecera, y el símbolo solo por debajo de 460 px
- [x] Los SVG versionados, con `currentColor` y sin un color escrito → [`components/Brand.svelte`](../../naeth/web/src/components/Brand.svelte)
- [x] Favicon inline como data URI, porque un fichero suelto daría 404: la raíz de `dist/` no la sirve nadie → [`web/index.html`](../../naeth/web/index.html)
- [x] El lockup a 24 px (su suelo) en la cabecera, y el símbolo en móvil → [`Header.svelte`](../../naeth/web/src/components/Header.svelte)
- [x] Tokenizar las tres duraciones y añadir `--t-over`, con la curva dentro del token → [`src/app.css`](../../naeth/web/src/app.css)
- [x] Las dos capas flotantes con el mismo gesto, vía `@starting-style` porque se montan con `{#if}` → [`Header.svelte`](../../naeth/web/src/components/Header.svelte), [`PathField.svelte`](../../naeth/web/src/components/PathField.svelte)
- [x] Respetar `prefers-reduced-motion`, con las clases repetidas para ganar al hash de Svelte → [`src/app.css`](../../naeth/web/src/app.css)
- [x] Desplegar en los dos nodos y poner el tag. Los hashes de los assets vuelven a coincidir entre nodos
- [x] La marca en el README de la raíz: **el lockup entero, y el lockup ES el H1**. Dos ficheros por pieza (un SVG cargado por `<img>` no hereda `currentColor`), servidos por `<picture>` según el tema. Verificado en el render real de GitHub → [`README.md`](../../README.md), [`docs/img/`](../img/)
  - ⚠ **Coste aceptado el 28/08, medido y no supuesto**: un heading cuyo único contenido es una imagen se queda **sin `id` y sin ancla**, y **no sale en el Outline** de GitHub, porque ambos se generan del texto. El `alt="Naeth"` sí cubre a los lectores de pantalla. Si algún día molesta, la vuelta atrás es poner el lockup encima y recuperar el `# Naeth` debajo
- [x] **[Eneko]** Mirar el visor desde el móvil tras el SSO (28/08). El alta funcionó; salió un defecto visual, ya corregido y desplegado como `2.2026.08.4`
- [x] El selector de wikilinks se salía de la pantalla en móvil: 212 px fuera en un viewport de 375. Clamp en CSS, `max-height` en `dvh` por el teclado, y dos líneas de título por debajo de 600 px → [`Nueva.svelte`](../../naeth/web/src/views/Nueva.svelte), [`Memoria.svelte`](../../naeth/web/src/views/Memoria.svelte)
- [ ] **[Eneko]** Qué hacer con **`naeth/stets`** (`5e0b4862`, "Test en móvil"), la memoria de la prueba: su ruta lleva una errata de `status`. Es escritura en Naeth, así que no la toco sin decisión

## Fase 3 · Camino de lectura, la parte aditiva · CERRADA el 28/08/2026

Desplegada en los dos nodos como **`2.2026.08.5`** (`2610fb7` y el arreglo de la degradación).
Suite de pytest de 28 a 48.

- [x] Filtros en `memory_search` (`path_prefix`, `tags`, `memory_type`, `since`), aplicados **dentro** de cada rama y no sobre el resultado → [`core.py`](../../naeth/app/core.py)
- [x] **`is_current` NO entra**, decidido con medición: 40 de los 297 pares de supersession son correctivos, así que abrir el histórico devolvería afirmaciones ya refutadas
- [x] `system_status` deja de contar dos poblaciones en un número: `tombstones` son los de memoria, los de relación van aparte, `relations` descuenta las retiradas y `superseded` se cuenta de su tabla
- [x] `avg_lag_s` acotado a 7 días. **El retardo real es de 1,53 s**, no los 3.433 s de la media histórica que citaba el análisis del 28/08
- [x] `memory_stats`, modo recuento: agrupa por proyecto, path, tipo, tag, autor y mes, con recuentos y el **resto declarado**, nunca listas completas
- [x] `memory_stats`, modo higiene: sin título, sin tags, sin path, huérfanas, cadenas largas, wikilinks rotos y erratas de ruta por distancia de edición ≤ 2 → [`core.py`](../../naeth/app/core.py)
- [x] La higiene **degrada** si falta `fuzzystrmatch`: en el nodo de respaldo no se puede crear porque está en `read_only`, y ese read-only es la protección del failover
- [x] **`fuzzystrmatch` creada en `finally`** (28/08), sin esperar a que lidere y **sin desarmar la protección**: se levantó el `read_only` solo para esa sentencia con `PGOPTIONS`, porque el `CREATE EXTENSION` es DDL aditivo y no un dato que pueda entrar en conflicto en el merge. Verificado después que el `read_only` sigue en `on` y que un `CREATE TABLE` normal sigue fallando. Los dos nodos dan ya la higiene completa y las mismas cifras

### Lo que salió de fuera del plan

- [x] Retirada con tombstone la memoria de prueba `naeth/stets`
- [x] **Borrado FÍSICO de `5e0b4862` en los dos nodos** (28/08). Excepción deliberada al ADD-only, con el precedente de la limpieza del em dash del 28/07: "Esta memoria es de prueba" no es conocimiento y no hay registro que falsear. Los dos nodos quedan en **784 filas y 468 vigentes**, idénticos.
  - Hay que hacerlo en los **dos** nodos porque el sync es no destructivo: borrarlo en uno solo lo habría dejado resucitar en el merge de vuelta del siguiente failover.
  - En `finally` el `job` dio `DELETE 0`, y es lo correcto: `job` es una tabla **local por nodo** y no viaja en el sync.
  - El `read_only` del respaldo se levantó solo para esas sentencias con `PGOPTIONS`. Comprobado después que sigue en `on` y que un `CREATE TABLE` normal sigue fallando

- [ ] Comprobar que una fila **sin embedding** no se cae del corte de 50 de la rama léxica. Es lo único del plan de la fase 3 que quedó sin cubrir: los tests van sobre la rama léxica pura, y ese reparto solo se ve con embeddings de verdad

## Fase 4 · El digest

La única que **rompe contrato**. `memory_search` deja de devolver el contenido íntegro (media de
2.686 caracteres por nota, unos 27.000 en una búsqueda de `k=10`) y pasa a devolver un resumen corto
escrito a mano. La búsqueda da el mapa; `memory_get` sigue trayendo el terreno.

Decidido con Eneko el 28/08: **el backfill completo es requisito de cierre**, pero por grupos y en
orden de importancia medida, no arbitrario. Y el tope no se fijó de entrada: se midió.

### 4.0 · El tope y el orden del backfill · CERRADA el 28/08/2026

Informe con la medición completa en [`fase-4-0-tope-y-prioridad.md`](fase-4-0-tope-y-prioridad.md).

- [x] **Tope de 300 caracteres**, medido redactando 24 digests reales sobre una muestra estratificada
  de 590 a 7.569 caracteres de nota, no eligiendo entre opciones
- [x] **El digest satura**: la nota crece 13x y el digest 1,6x. El outlier de 36.266 es una
  transcripción cruda de ASR, de otra naturaleza; el techo real de una nota es ~8.500
- [x] ⚠ **Detectado un sesgo de anclaje en la propia medición** y descartado el p90 fácil (324):
  14 de 24 caían en 296-325 con 2, 3 o 4 frases, ajustando la frase al espacio. La prueba que sí
  resiste es comprimir los 5 peores: bajan a 257-283 **sin perder una sola afirmación**
- [x] La asimetría que decide el número: subir un `CHECK` después es gratis, bajarlo obliga a reeditar
- [x] **Tres grupos: G1 96 · G2 209 · G3 165**, por citas entrantes, versiones acumuladas y `*/status`
- [x] **La recencia se cayó al medirla**: 428 de 470 son de los últimos 60 días, así que no separa
  nada. Con ella dentro, G2 se llevaba 368 de 470
- [x] **La frecuencia de consulta no es medible**: ninguna de las 15 tablas del esquema registra
  accesos. No se sustituye por un proxy inventado
- [x] Top-30 verificado a ojo, que es lo que la fase 3 enseñó a no saltarse: ni una nota irreconocible
- [x] Los 24 digests calibrados quedan en [`digests-g1.tsv`](digests-g1.tsv), como primera tanda de G1

### 4.1 · La columna y la migración · CERRADA el 28/08/2026

- [x] Columna `digest text` con `CHECK (digest IS NULL OR length(digest) <= 300)`, nullable a
  propósito → [`db/migrations/`](../../naeth/db/migrations/), [`db/schema.sql`](../../naeth/db/schema.sql)
- [x] ⚠ **En `finally` PRIMERO, en el PC después.** `handoff.py:235` saca las columnas del ORIGEN y
  `sync.py:198` crea el staging en el DESTINO con `LIKE`: origen con la columna y destino sin ella
  rompe el `COPY IN` de la tabla `memory` ENTERA. Al revés es benigno
- [x] En `finally`, con `PGOPTIONS` para el `read_only`. Verificado después: sigue en `on` y un
  `CREATE TABLE` normal allí sigue fallando
- [x] **El sync no se rompió**: `core handoff --from local --to finally` pasó sus 9 tablas con
  `memory` 790 -> 790. Era el riesgo número uno de la fase y queda cerrado con evidencia
- [ ] **[Eneko]** Recomendado y no incluido: `"digest": "COALESCE({t}.{c}, EXCLUDED.{c})"` en
  `MONOTONIC_MERGE_RULES` (`CENIT/core/reconciler/src/cenit_core/sync.py:119`). Una línea que haría
  converger el digest solo. Es otro repo

### 4.2 · Escritura: el digest en las dos tools · CERRADA el 28/08/2026

- [x] `digest` en `core.add` y `core.supersede` → [`core.py:63`](../../naeth/app/core.py), [`:91`](../../naeth/app/core.py)
- [x] Y en las dos tools que escriben contenido → [`mcp_server.py:235`](../../naeth/app/mcp_server.py), [`:292`](../../naeth/app/mcp_server.py)
- [x] Y en las dos rutas del visor que escriben → [`mcp_server.py:407`](../../naeth/app/mcp_server.py), [`:425`](../../naeth/app/mcp_server.py)
- [x] `NAETH_DIGEST_ENFORCE=warn|strict`, calcado de `_enforce_model` ([`:220`](../../naeth/app/mcp_server.py)).
  **Nace en `warn`**, decidido por el precedente medido: `AUTHORSHIP_ENFORCE` lleva un mes pidiendo
  `agent_model` sin obligarlo y se cumple (julio 119/129, **agosto 343/343**). Y la asimetría:
  `strict` pierde la escritura entera, `warn` deja un NULL rellenable
- [x] ⚠ **El digest NO se hereda del padre al superseder**: describiría la versión anterior, o sea
  mentiría con la firma de un resumen bueno. Mejor NULL
- [x] El tope **rechaza en vez de recortar** (`core._digest`): un resumen cortado a mitad de frase
  sigue firmando como resumen entero y nadie se entera. El error dice cuánto ocupaba y cuál es el tope
- [x] ⚠ **La idempotencia de `add` no adopta el digest de una segunda llamada**: el `content_hash` es
  de (title, content) y el digest no entra. Es coherente pero silencioso, y va en un test con su porqué
- [x] Siete tests nuevos → [`test_core.py`](../../naeth/app/tests/test_core.py)

### 4.3 · Lectura: `memory_search` deja de devolver el contenido · CERRADA el 28/08/2026

- [x] Devuelve `digest`, `path` y `created_at`; deja de devolver `content` → [`mcp_server.py:258-267`](../../naeth/app/mcp_server.py)
- [x] ⚠ **`core.search` NO cambia**: `/api/search` del visor consume la fila entera y se rompería
- [x] Mientras queden NULL, recorte del contenido **marcado como recorte**, para que el ahorro empiece
  el día del despliegue y el agente sepa que le falta algo
- [x] ⚠ **El riesgo mayor de la fase**: si el agente no pide `memory_get` cuando el digest no le basta,
  la memoria queda peor que antes. La descripción de la tool ya lo dice de forma explícita
- [x] `digest_source` (`written` / `excerpt`), calcado de `model_source` del Paso 10 y por lo mismo:
  un valor escrito a mano y uno derivado por la máquina no son lo mismo, y quien lee tiene que poder
  distinguirlos sin adivinar
- [x] La composición del resultado se extrajo a `_hit()`, para que "ya no devuelve content" sea un
  test y no una inspección
- [x] Cinco tests más, y la suite acumulada pasa de 48 a **60 en verde**
- [x] **Verificado en producción** con una búsqueda real: sin `content`, con `digest_source: excerpt`,
  y el recorte cortando en el espacio. **De 6.753 caracteres a unos 780** en esos tres resultados;
  en proyección `k=10`, de **26.858 a unos 3.000: un 89% menos**, ya antes del backfill
- [ ] ⚠ **La descripción nueva no llega a las sesiones MCP ya abiertas**: el cliente cachea el schema
  del handshake, así que el aviso de "llama a `memory_get`" solo entra en sesiones nuevas. No es un
  fallo, pero conviene saberlo al medir si el aviso funciona
- [ ] ⚠ **`finally` sigue con el código viejo**: los dos nodos tienen la columna, pero el módulo solo
  se recargó aquí. Si el respaldo liderara ahora, `memory_search` allí devolvería el contenido entero.
  No es una rotura (es el comportamiento anterior), y lo cierra el despliegue de 4.6

### 4.4 · El visor no pierde el digest

- [ ] Campo editable con contador, en las dos vistas que escriben → [`Nueva.svelte`](../../naeth/web/src/views/Nueva.svelte), [`Memoria.svelte`](../../naeth/web/src/views/Memoria.svelte), [`types.ts`](../../naeth/web/src/lib/types.ts), [`api.ts`](../../naeth/web/src/lib/api.ts)
- [ ] ⚠ **No es cosmético, es integridad**: `Memoria.svelte` manda todos los campos al superseder
  porque el core no hereda. Sin el digest ahí, editar desde el visor lo borra

### 4.5 · `memory_stats` mide el avance

- [ ] "Vigentes sin digest", por proyecto y por grupo. Es el marcador de 4.7 → [`core.py:354`](../../naeth/app/core.py)

### 4.6 · Suite, despliegue y tag

- [ ] `docker compose --profile test run --rm test`, y después `docker compose rm -sf db`, **nunca `down`**
- [ ] `npm test && npm run check && npm run build` en `naeth/web/`
- [ ] Despliegue en los dos nodos y tag `2.2026.08.6`

### 4.7 · El backfill por grupos (8-12 sesiones)

- [ ] **G1, 96 notas.** Las 24 de [`digests-g1.tsv`](digests-g1.tsv) ya están escritas
- [ ] ⚠ Revisar `1112a864` antes de escribirlo: su digest salió de una lectura **parcial**
- [ ] **G2, 209 notas**
- [ ] **G3, 165 notas**
- [ ] ⚠ **Cada tanda son DOS ejecuciones, una por nodo** (`sync.py:119-127`: el merge solo reconcilia
  `is_current` y `embedding`, en el resto manda la fila local). Verificar recuentos iguales al cerrar
- [ ] ⚠ **`UPDATE` directo, no `supersede`**: por supersession serían 470 versiones nuevas para
  arreglar metadato. Misma excepción al ADD-only que el em dash del 28/07 y el borrado del 28/08.
  Backup previo en `_digest_backup`, como `_path_backup` y `_emdash_backup`
- [ ] ⚠ **Nunca una pasada de LLM sin revisar**: varias notas llevan dentro su propia versión refutada
- [ ] Al terminar: `NAETH_DIGEST_ENFORCE=strict` y retirar el recorte de 4.3

### 4.8 · `NaethPersist` en sus dos copias

- [ ] El digest entra en la estructura del informe, para redactarlo **en la revisión** y no después →
  `~/.claude/skills/NaethPersist/SKILL.md` y `userpreferences-naeth-claudeai.md` (divergen a mano)
