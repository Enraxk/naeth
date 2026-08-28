# Pendientes de Naeth

Lista viva. Se marca lo hecho, no se borra. El razonamiento de cada línea, con su evidencia, está en
[`plan-fases-2026-08-28.md`](plan-fases-2026-08-28.md); aquí solo está el qué y el dónde.

Las líneas marcadas **[Eneko]** son decisiones, no trabajo: bloquean la tarea que llevan al lado.

---

## Fase 1 · El alta de memoria sale a producción

- [ ] **[Eneko]** Selector de ruta: plano o agrupado. 81 rutas, 26 proyectos, 30 con una sola memoria → [`views/Nueva.svelte`](../../naeth/web/src/views/Nueva.svelte)
- [ ] **[Eneko]** Vocabulario de `memory_type`: cerrar en 4 y migrar las 2 `reference`, o adoptar `reference` como quinto
- [ ] **[Eneko]** El `.pen` borrado: se commitea el borrado o se restaura → `git status`
- [ ] Aplicar la decisión del selector de ruta → [`views/Nueva.svelte`](../../naeth/web/src/views/Nueva.svelte)
- [ ] Alinear la lista de tipos en el visor de lectura: hoy ofrece 6, con `learning` y `error` a cero usos → [`views/Memoria.svelte:15`](../../naeth/web/src/views/Memoria.svelte)
- [ ] Alinear la lista de tipos del alta con la decisión → [`views/Nueva.svelte`](../../naeth/web/src/views/Nueva.svelte)
- [ ] Actualizar la tabla "Alcance", que sigue diciendo que Nueva memoria es un stub → [`web/README.md`](../../naeth/web/README.md)
- [ ] Commit del trabajo sin versionar: `Nueva.svelte`, `wikipick.ts`, `wikipick.test.ts` y el diff de `App.svelte`, `api.ts`, `Milkdown.svelte` y `Memoria.svelte`
- [ ] Desplegar en el PC (`npm run build` + `up.ps1`) y en `finally` (`up.sh --build`), y poner el tag → [`web/README.md`](../../naeth/web/README.md)

## Fase 2 · La marca y el movimiento entran en el visor

- [ ] **[Eneko]** Dónde va la marca: si el lockup sustituye al texto de la cabecera, si el símbolo va al rail, o si solo entra por la pestaña y el README
- [ ] Versionar los tres SVG canónicos (símbolo 24×24, wordmark, lockup 99×24) con `currentColor` y `<title>` → origen en [`docs/handoff/`](../handoff/)
- [ ] Añadir el favicon, que hoy no existe: el `<head>` no declara ninguno → [`web/index.html`](../../naeth/web/index.html)
- [ ] Colocar el lockup en el chrome del visor según la decisión
- [ ] Tokenizar las tres duraciones y añadir `--t-over` → [`src/app.css`](../../naeth/web/src/app.css)
- [ ] Sustituir las tres duraciones escritas a mano → [`Sidebar.svelte:142`](../../naeth/web/src/components/Sidebar.svelte), [`:167`](../../naeth/web/src/components/Sidebar.svelte), [`Estado.svelte:169`](../../naeth/web/src/views/Estado.svelte)
- [ ] Animar el popover de búsqueda, que hoy aparece de golpe, componiendo con su `translateX(-50%)` → [`Header.svelte`](../../naeth/web/src/components/Header.svelte)
- [ ] Respetar `prefers-reduced-motion`, que hoy no aparece en ningún fichero del visor → [`src/app.css`](../../naeth/web/src/app.css)
- [ ] Poner el símbolo en el README de la raíz → [`README.md`](../../README.md)
- [ ] Desplegar en los dos nodos y poner el tag

## Fase 3 · Camino de lectura, la parte aditiva

- [ ] Filtros en `memory_search` (`path_prefix`, `tags`, `memory_type`, `since`, `is_current`), filtrando antes de rankear → [`core.py:232`](../../naeth/app/core.py), [`mcp_server.py:254`](../../naeth/app/mcp_server.py)
- [ ] `memory_stats`, modo recuento: por path, subtema, tipo, tag, autor y mes → [`mcp_server.py`](../../naeth/app/mcp_server.py)
- [ ] `memory_stats`, modo higiene: sin título, sin tags, path fuera de taxonomía, longitud de cadenas, huérfanas y wikilinks que no resuelven
- [ ] Separar en `system_status` los tombstones de memoria (20) de los de relación (4), y descontar las relaciones retiradas → [`core.py:307-311`](../../naeth/app/core.py)
- [ ] Acotar `avg_lag_s` a una ventana reciente: hoy promedia toda la tabla `job` desde junio → [`core.py:313-320`](../../naeth/app/core.py)
- [ ] `ORDER BY` explícito antes del `LIMIT 50` de la rama léxica, que hoy depende de la forma del plan → [`core.py:252-255`](../../naeth/app/core.py)
- [ ] Comprobar que una fila sin embedding no se cae del corte de 50 de la rama léxica
- [ ] Pasar la suite de pytest y desplegar en los dos nodos con tag → `docker compose --profile test run --rm test`, luego `docker compose rm -sf db`

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
