# Visor v2 · diagnóstico previo al cierre (22/08/2026)

Auditoría en **solo lectura** de `naeth/web` y del backend que lo sirve, hecha antes de escribir el
plan de cierre. No se modificó ningún fichero. Continúa y corrige a
[`visor-v2-estado-2026-07-28.md`](visor-v2-estado-2026-07-28.md), que sigue siendo la referencia
para los defectos D1 a D9 (aquí se citan por su código).

**Cómo leer las marcas:** `[vivo]` = comprobado ejecutando algo contra la pila (los tres
contenedores estaban `Up (healthy)`). `[lectura]` = comprobado leyendo el fichero, con ruta y línea.
Lo que no se comprobó se dice con todas las letras en vez de deducirlo.

Reverificado el 22/08 a las 13:39 sin cambios respecto a la primera pasada del 21/08: mismo
`[ahead 2]`, mismo `D .pen`, sin `node_modules`, `dist` del 29/07 y `/assets` en 404.

---

## 0 · El árbol de trabajo

```
## main...origin/main [ahead 2]
 D .pen
```

**El trabajo del 28/07 ya no está suelto.** Está commiteado en `6b856a4` (20/08/2026 20:51), 12
ficheros, +752/-33. No hay stash, no hay nada en staged, no queda nada del visor sin commitear. Lo
único vivo en el árbol es el borrado de `.pen`, que fue una decisión deliberada.

Los dos commits siguen **sin pushear** por decisión del 20/08: el push espera a que el visor esté
terminado. Eso convierte la última sub-fase del cierre en la que también publica el trabajo.

---

## 1 · Lo que está terminado de verdad

| Pieza | Evidencia |
|---|---|
| Wikilinks navegables | `[lectura]` `naeth/web/src/lib/wikilinks.ts`, 192 líneas, seis caminos de resolución; `toDisplayMarkdown` se aplica solo en lectura (`Memoria.svelte:47`) |
| Selector al teclear `[[` | `[lectura]` plugin de ProseMirror en `Milkdown.svelte:86-120`; la lista y el teclado viven en `Memoria.svelte:63-113` |
| Relaciones `links_to` al guardar | `[lectura]` `syncRelations` en `Memoria.svelte:233-248`, con deduplicación por relaciones salientes |
| D1 · tema claro ilegible | `[lectura]` mapeo completo de los tokens de Crepe en `app.css:54-85`, más el parche de especificidad de las viñetas en `:96-97` |
| Fuga de editores Milkdown | `[lectura]` bandera `destruido` y `barrerHuerfanos()` en `Milkdown.svelte:60-65` y `:127-132` |
| Tema oscuro a `#1e2022` | `[lectura]` `app.css:28` |
| Verde de legibilidad | `[lectura]` `#16a34a` a `#15803d` en `colors.ts:14` |
| Backend CRUD, relaciones y autoría | `[vivo]` diez rutas `/api`; `GET /api/authors` devuelve ocho combinaciones; `/api/memory/{id}` trae `author`, `author_product`, `author_surface` y `author_model` |
| Vistas Inicio, Estado y Memoria | `[lectura]` con outline, panel de relaciones, historial de versiones, borrador en localStorage, Ctrl+S, toolbar y selector de emoji |
| Responsive y cajón lateral | `[lectura]` `App.svelte:54-57`, `Sidebar.svelte:147-158` |

Y una que el estado previo daba por pendiente y **ya está hecha**: el color del código inline. Hay
un token `--code` propio, elegido con contraste medido (6,33:1 frente al 4,49:1 que daba `--warn`),
en `app.css:31-34` y `:44`.

---

## 2 · Lo que está a medias, y qué falta exactamente

### 2.1 · El `dist/` no refleja el `src/`

El build en disco es del **29/07 a las 01:07**; el último cambio de `app.css` es del **29/07 a las
01:30**. Prueba directa: el CSS compilado lleva `--bg:#20201f` y el fuente lleva `#1e2022`.

Lo demás del trabajo sí entró en ese build: `naeth-wikilink`, `--code` y
`label-wrapper.label-wrapper` están todos en el bundle. **Falta:** rebuildear. No es opcional, el
build actual sirve un tema que ya no existe.

### 2.2 · Autoría en la cabecera

Backend listo y verificado `[vivo]`. Front a cero: `grep -rn "author" src/` no devuelve **ni una
línea** en todo `naeth/web/src`.

**Falta:** añadir el campo a `MemoryRow` en `types.ts`, leerlo, pintarlo en `d-meta`
(`Memoria.svelte:342-347`, que hoy muestra path · tipo · fecha · id) y decidir la forma corta.

### 2.3 · El azul de selección

`--sel` es `#17222e` en oscuro y `#e7f0fb` en claro (`app.css:29` y `:42`). Sigue siendo un azul
frío sobre un fondo templado, y el commit del 20/08 no lo tocó. **Falta:** decidir el valor.

### 2.4 · D3 · el vocabulario de paths derogado

Medido `[vivo]` contra `/api/tree`: **46 subtemas distintos y 0 de 411 memorias aciertan
`ORIGIN_ICON`**, que solo mapea `code` y `chat` (`colors.ts:35-38`). Todas caen al icono genérico de
carpeta.

Los catorce puntos de código afectados:

```
src/lib/colors.ts:35          ORIGIN_ICON (la definición)
src/lib/tree.ts:4,5,42        interface Origin, Project.origins, const origins
src/lib/search.svelte.ts:26   originOf()
src/lib/search.svelte.ts:33   kind === 'source'
src/lib/search.svelte.ts:74   filtro por source
src/components/Sidebar.svelte:9,85
src/components/Crumbs.svelte:5,23
src/components/Header.svelte:7,86
src/components/Header.svelte:67   placeholder "…  :fuente"
src/views/Memoria.svelte:328      placeholder "proyecto/origen"
```

### 2.5 · D7 · el editor nace "modificado"

No verificable leyendo. `isDirtyNow` compara `mdRef.getMarkdown()` contra `m.content`
(`Memoria.svelte:186-193`), así que si Milkdown normaliza el markdown al cargar, el `dirty` sigue
saltando solo. **Sigue sin diagnosticar**, exactamente igual que el 28/07.

### 2.6 · D8 · la búsqueda se pide por duplicado

Se leyeron `search.svelte.ts` y `Header.svelte` enteros y no aparece la doble llamada: hay debounce
de 200 ms (`search.svelte.ts:82`) y guard por secuencia (`:63,67`). Necesita el navegador para
aislarlo. **Sin diagnosticar.**

---

## 3 · Lo que sigue siendo stub o no existe

Cada afirmación negativa va con la búsqueda que la sostiene.

- **Grafo, Nueva memoria y Ajustes no existen como componente.** `test -f
  src/views/{Grafo,Nueva,Ajustes}.svelte` falla en los tres. Solo hay tres entradas en el
  diccionario de `Stub.svelte:6-8`.

- **No hay ninguna ruta que sirva `/assets/*`.** `[vivo]` `GET /assets/index-DlQoetz4.js` devuelve
  **404 en 8800 y en 8801**. `grep -rn "StaticFiles\|mount(" app/` no devuelve nada, y
  `custom_route("/")` sirve **solo** `index.html` (`mcp_server.py:334-336`). Un build de Vite pide
  `/assets/index-*.js` y `/assets/index-*.css`, así que hoy el v2 no podría cargar aunque se
  apuntara la raíz a su `index.html`.

- **No hay ni un test automatizado en el front.** `package.json` no declara runner ni script
  `test`, y `find` no encuentra ningún `*.test.*` ni `*.spec.*` bajo `naeth/web`. La única
  verificación mecánica hoy es `npm run check` y `npm run build`.

- **D4 · el `role="tree"` sigue incumplido.** `grep -n "treeitem\|aria-expanded\|aria-selected\|
  tabindex" src/components/Sidebar.svelte` no devuelve **nada**, con `role="tree"` declarado en la
  línea 68.

- **D5 · los títulos largos siguen sin texto completo.** Los tres únicos `title=` o `aria-label` del
  Sidebar son el `<nav>` (`:61`), el botón de orden (`:63`) y el resizer (`:115`). Las hojas del
  árbol no tienen ninguno, y `.label` recorta con ellipsis en `:133`.

- **D6 · las dos memorias sin título siguen ahí.** `[vivo]` las mismas dos, `14134724` y
  `f94961e3`, ambas en `cenit/build`, del 21/07 a las 21:11 y 21:13.

- **D9 · el chunk grande sigue igual.** `esm-CrW4Ud1t.js` pesa 664.037 bytes. El `dist` entero son
  4,1 MB en 192 ficheros: Crepe arrastra KaTeX con sus fuentes y decenas de modos de CodeMirror.

- **Fase 0, Tier 2 y Tier 3: ni una línea.** No existe `docs/plan/`.

---

## 4 · Dónde el estado registrado ya no es cierto

1. **"El trabajo quedó sin commitear."** Falso desde el 20/08: está en `6b856a4`, pendiente solo de
   push.
2. **"El pulido del código inline está pendiente."** Hecho, con token `--code` propio y contraste
   medido.
3. **"`mcp_server.py`, líneas 299-301."** Hoy son la 334-336.
4. **"Basta con ajustar el `custom_route` /".** Se queda corto, y es el punto que más infla la
   estimación: **hay que añadir servido de estáticos**, que hoy no existe en absoluto.
5. **Nadie registra que el `dist` está desfasado** respecto al `src`. Es un fallo silencioso: el
   build existe, parece reciente y sirve un tema retirado.
6. **Node no está en el PATH, pero sí en la máquina.** `F:\local\fnm\aliases\default\node.exe` es
   **v24.19.0** con npm **11.17.0**, vía fnm, con una única versión instalada. `fnm list` solo la ve
   con `FNM_DIR=F:\local\fnm`. El `package-lock.json` está sincronizado con el `package.json` (302
   paquetes, lockfileVersion 3), así que `npm ci` es reproducible.

**Lo que no se pudo verificar:** que `npm run build` y `npm run check` pasen hoy. Sin `node_modules`
no hay forma, y instalar habría dejado de ser una pasada de solo lectura.

---

## 5 · Dónde cae la línea de "visor terminado"

**Definición propuesta: el v2 sustituye al v1 en producción, sin regresiones, y con lo que hoy está
a medias cerrado.** No incluye completar las tres vistas stub.

El motivo de fondo: el visor v2 lleva desde el 30 de junio sin que nadie lo vea fuera de un dev
server. Lo que le falta para existir no es una vista más, es el despliegue. Y las tres stub degradan
limpias, con icono, explicación y badge, así que un visor sin ellas es un producto entero con tres
puertas cerradas y avisadas, no un producto roto.

### Dentro

| Pieza | Por qué |
|---|---|
| Node reproducible y suite mínima (Vitest sobre `wikilinks.ts` y `tree.ts`) | El método de trabajo exige suite acumulada y hoy no hay ninguna. `wikilinks.ts` tiene seis caminos de resolución que nadie ha probado nunca y decide qué se enlaza: si falla, falla en silencio |
| Autoría en la cabecera | Pedido explícitamente, el dato ya está servido y es la sub-fase más barata con valor visible |
| D3 · vocabulario `origen` a `subtema` | 0 de 411 aciertan. Se ve en cada fila del árbol, en los breadcrumbs y en el buscador |
| `--sel` templado y D5 (`title` completo) | Dos arreglos de una línea cada uno, que entran en producción con el resto o no entran nunca |
| Retirar el `role="tree"` mentiroso | Una línea. Anunciar un árbol que no tiene ítems es peor que no anunciarlo |
| D7 y D8: diagnosticar, y arreglar si son reales | Son los dos `⚠ sin verificar` del informe anterior. Un "modificado" que salta siempre inutiliza el aviso de cambios sin guardar, justo cuando el visor pasa a ser el sitio donde se edita de verdad |
| Servir estáticos, desplegar y pushear | Es el trabajo que hace que el visor exista |

### Fuera

| Pieza | Por qué |
|---|---|
| Grafo (Paso 5.4) | Es un proyecto propio, con decisiones de producto sin tomar. Meterlo dentro convierte "terminar" en una fecha indefinida |
| Nueva memoria (Paso 5.3) | Barata, pero no bloquea: las memorias se crean por MCP a diario. Y añade superficie de escritura justo en el estreno del v2 en producción |
| Ajustes | El tema ya se cambia en el rail; lo demás vive hoy en variables de entorno |
| D4 completo (treeitem, roving tabindex) | Implementarlo bien cuesta como una vista entera. Dentro va solo la retirada del `role` |
| D6 · las dos memorias sin título | Es dato, no código. Dos minutos cuando se quiera, pero no pertenece al plan |
| D9 · el chunk de 664 kB | Preexistente. Se mide **después** de desplegar, con el túnel de por medio, y se decide con el número delante en vez de a ojo |
| Tier 2, Tier 3 y Fase 0 | Backlog declarado. Nada empezado |

**Un aviso sobre el orden:** el despliegue va al final, pero es lo que convierte todo lo anterior en
real. Si en algún momento hay que cortar el plan por la mitad, la última sub-fase es la que **no** se
puede saltar; las de pulido, sí.

---

## 6 · Trampas confirmadas que el plan tiene que respetar

1. **Escribir cualquier fichero dentro de `naeth/app/` dispara el auto-reload de uvicorn.** Los dos
   servicios corren con `--reload` y con `./app:/srv/app` montado
   (`docker-compose.yml:48,80` para `api` y `:164,172` para `viewer`). Ya pasó el 27/07: un fichero
   temporal dejó `naeth-viewer-1` colgado en "Waiting for connections to close" esperando a la
   conexión MCP de la propia sesión de Claude Code. **El 8801 es por donde entra Claude Code**, y el
   síntoma engaña porque el 8800 sigue respondiendo 200. Arreglo conocido:
   `docker restart naeth-viewer-1 naeth-worker-1`.

2. **El `.gitignore` raíz tiene `*.json` y necesita excepciones explícitas.** Hoy están
   `!package.json`, `!package-lock.json`, `!tsconfig*.json`, `!.vscode/extensions.json`,
   `!.claude/settings.json` y los diagramas. Cualquier `.json` nuevo que deba versionarse necesita
   la suya, y la prueba buena es `git add -An`, no `git check-ignore`.

3. **El CSS de Crepe se importa en runtime y gana especificidad.** Se inserta después de `app.css`,
   así que a igual especificidad gana el suyo. Se resuelve repitiendo la clase
   (`.label-wrapper.label-wrapper`), no con `!important`. Ya está documentado en `app.css:92-95`.

4. **`node --check` no detecta errores de runtime.** Y aquí ni siquiera aplica al grueso del código,
   que son `.svelte` y `.ts`. La verificación mecánica real es `npm run check` más `npm run build`,
   y ninguna de las dos ejecuta la aplicación.

5. **Node se invoca por ruta absoluta o activando fnm.** `F:\local\fnm\aliases\default\node.exe`.
   Una sesión nueva no lo tiene en el PATH.

---

## 7 · Cómo se comprobó

`git status` y `git show --stat` para el árbol; lectura íntegra de los 27 ficheros de
`naeth/web/src` y de las rutas HTTP de `naeth/app/mcp_server.py`; `curl` contra `127.0.0.1:8800` y
`:8801` para el estado servido, los códigos de respuesta y la forma de los datos; `/api/tree`
volcado a Python para contar subtemas, memorias sin título y notas por proyecto; `docker ps` para la
pila; y PowerShell para localizar Node fuera del PATH.

No se ejecutó `npm install`, `npm run build` ni `npm run check`: habrían escrito en disco.

---

## 8 · Qué pasó al ejecutarlo (mismo día, por la tarde)

El plan de cierre ([`../plan/visor-v2-cierre.md`](../plan/visor-v2-cierre.md)) se ejecutó entero el
22/08/2026 y **el v2 sustituyó al v1 en los dos puertos**. Tres cosas de este diagnóstico salieron
distintas al tocarlas, y son las que valen para la próxima vez:

### D7 no era cosmético: era pérdida de datos

Aquí quedó como "el editor nace modificado, sin diagnosticar". Al reproducirlo salió la causa y era
mucho peor: el serializador de Milkdown **escapa `[`, `]` y `_`**. Medido en notas reales,
`wal_level` salía como `wal\_level` y `[[Método · algo]]` como `\[\[Método · algo\]\]`. Como
`doSave` guarda lo que devuelve `getMarkdown()`, **242 de las 411 memorias vigentes (59 %) se
habrían corrompido al editarlas** y los 263 wikilinks del corpus habrían dejado de resolver
(verificado: la regex pasa de 1 coincidencia a 0).

Además dejaba un borrador espurio en localStorage, así que al volver a la nota salía el banner de
"tienes un borrador sin guardar" de cambios que nadie hizo.

**Lección:** un defecto marcado como cosmético que nadie ha reproducido no es un defecto cosmético,
es un defecto sin diagnosticar. La diferencia costó cuatro semanas de no saberlo.

### D8 no es reproducible

Se probaron seis caminos (tecleo letra a letra, de golpe, escribir y borrar, elegir un comando del
desplegable, breadcrumb, evento `search` nativo del input, Ctrl+P y dos `input` seguidos) contando
las peticiones tanto por `fetch` instrumentado como por el panel de red. **Ninguno duplica.**
`search.svelte.ts` y `Header.svelte` no se han tocado desde el 28/07, así que es el mismo código
que se auditó entonces. Pasa a v2.x documentado, no arreglado: no se puede arreglar lo que no se
manifiesta.

### Servir estáticos tenía una trampa más

`check_dir=False` evita que el proceso muera al importar, pero **no** evita el fallo al servir: la
ruta quedaba montada y devolvía **500** donde antes había un 404 limpio. Hay que montar solo si el
directorio existe.

### Lo que este documento acertó

El resto se confirmó al tocarlo: el `dist` desfasado (el build llevaba `#20201f`), los 0 de 411
subtemas que aciertan el icono, la ausencia total de rutas para `/assets`, y la trampa del
auto-reload, que **volvió a pasar** al editar `mcp_server.py`: 8800 respondiendo 200, 8801 muerto y
`docker ps` diciendo `Up (healthy)` en los tres. El `docker restart naeth-viewer-1 naeth-worker-1`
lo resolvió en 22 segundos.

Y una trampa nueva, aprendida a base de sufrirla: **`docker compose --profile test down` no baja
solo el profile, baja toda la pila.** Dejó Naeth caído hasta levantarlo con `up.ps1`. Para bajar
solo el Postgres de test: `docker compose rm -sf db`.
