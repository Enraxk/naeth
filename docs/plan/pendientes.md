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

- [ ] **[Eneko]** El parámetro nace obligatorio en las dos tools de escritura, o nace opcional y se endurece después
- [ ] Columna `digest` con tope duro y su migración → [`db/migrations/`](../../naeth/db/migrations/)
- [ ] Parámetro `digest` en `memory_add` y `memory_supersede`, que son las dos únicas que escriben contenido → [`mcp_server.py:236`](../../naeth/app/mcp_server.py), [`:285`](../../naeth/app/mcp_server.py)
- [ ] `memory_search` deja de devolver `content` y pasa a devolver `path`, `created_at` y `digest` → [`mcp_server.py:254-259`](../../naeth/app/mcp_server.py)
- [ ] Backfill revisado de las 459 vigentes, por tandas y por proyecto, nunca con una pasada de LLM sin revisar
- [ ] Actualizar `NaethPersist` en sus dos copias, la local y la de claude.ai, que divergen a mano
- [ ] Mostrar el digest en el visor → [`views/Memoria.svelte`](../../naeth/web/src/views/Memoria.svelte)
- [ ] Rehacer el informe de estado del 28/08 con las tools nuevas y medir el contexto consumido
- [ ] Desplegar en los dos nodos y poner el tag
