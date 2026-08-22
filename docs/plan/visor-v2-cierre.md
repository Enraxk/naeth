# Plan · cierre del visor v2 de Naeth

> **EJECUTADO el 22/08/2026.** Las ocho sub-fases se completaron y el v2 sustituyo al v1 en los dos
> puertos. Tres desviaciones respecto a lo planeado, todas anotadas donde tocaba:
>
> 1. **F5 no era pulido, era perdida de datos.** El "editor nace modificado" (D7) resulto ser la
>    punta de que el serializador ESCAPA `[`, `]` y `_`: 242 de 411 memorias se habrian corrompido
>    al editarlas y los 263 wikilinks del corpus habrian dejado de resolver. Se arreglo en
>    `unescapeMarkdown()` mas una linea base para el `dirty`, con tests que lo fijan.
> 2. **D8 (busqueda duplicada) no es reproducible** con el codigo actual, que es el mismo del
>    28/07. Se probaron seis caminos y ninguno duplica. Pasa a v2.x documentado, no arreglado.
> 3. **`check_dir=False` no bastaba** para los estaticos: la ruta existia pero devolvia 500 al
>    primer GET donde antes habia un 404. Hubo que montar solo si el directorio existe.
>
> Lo que queda esta en la ultima seccion.

## Contexto

El visor v2 de Naeth (`naeth/web`: Vite + Svelte 5 runes + TS + Tailwind v4) lleva desde el 30 de
junio sin que nadie lo vea fuera de un dev server. Lo que se sirve en producción, incluido
`naeth-visor.enraxk.dev` al que se entra desde el móvil, sigue siendo el **visor v1**: un HTML
monolítico de 1.127 líneas del 30/06.

El diagnóstico completo está en
[`docs/discovery/visor-v2-estado-2026-08-22.md`](../discovery/visor-v2-estado-2026-08-22.md).
Lo esencial: el v2 está funcionalmente terminado en sus tres vistas reales, pero le faltan cuatro
cosas para existir. Una es que **el backend no sirve estáticos en absoluto** (`/assets/*` da 404),
así que no basta con apuntar la raíz al build. Otra es que **el `dist` en disco no refleja el
`src`**: es del 29/07 a las 01:07 y `app.css` cambió a las 01:30, de modo que el build sirve un tema
que ya se retiró. Las otras dos son la autoría en la cabecera y el vocabulario de paths derogado, que
hoy hace que **0 de 411 memorias acierten su icono de subtema**.

**Resultado buscado:** el v2 sustituye al v1 en los dos puertos, sin regresiones, con lo que estaba a
medias cerrado y con una suite automatizada que hoy no existe. Cerrado eso, la versión queda fija en
**v2** y todo lo demás (Grafo, Nueva memoria, Ajustes, Tier 2/3, Fase 0) pasa a ser **v2.x**.

Decisiones ya tomadas por Eneko el 22/08:

- El build llega al contenedor por **bind-mount nuevo**, no copiándolo dentro de `naeth/app/`.
- **Se pule todo y se despliega al final.** Producción no ve ningún defecto conocido.
- **Vitest sí**, hoy, sobre `wikilinks.ts` y `tree.ts`.
- La autoría se muestra como **`claude-code · opus-5`**.

---

## Riesgos y trampas conocidas

Léelas antes de ejecutar. Las cuatro primeras están confirmadas en este repo, no son genéricas.

### 1 · Escribir dentro de `naeth/app/` tumba el módulo

Los servicios `api` y `viewer` corren con `--reload` y con `./app:/srv/app` montado
(`docker-compose.yml:48,80` y `:164,172`). Cualquier fichero creado, modificado o borrado ahí dispara
el hot-reload de uvicorn.

El 27/07 pasó de verdad: un fichero temporal dejó `naeth-viewer-1` colgado en `Waiting for
connections to close`, esperando a una conexión persistente que era **el propio MCP de la sesión de
Claude Code**. Deadlock.

**El síntoma engaña.** Los contenedores aparecen `Up`, los puertos aceptan conexión y `/healthz` del
8800 devuelve 200. Lo que muere es el **8801**, que es por donde entra Claude Code
(`127.0.0.1:8801/mcp?s=code`). Comprobar el 8800 da un falso "está vivo".

- **Regla:** nada de ficheros temporales en `naeth/app/`. Este plan **solo** toca ahí `mcp_server.py`,
  en F6, y con la comprobación de recuperación incluida.
- **Arreglo si pasa:** `docker restart naeth-viewer-1 naeth-worker-1` (unos 12 s, sin pérdida).

### 2 · El `.gitignore` raíz tiene `*.json` y necesita excepciones explícitas

La regla existe por las credenciales de cloudflared. Hoy hay excepciones para `!package.json`,
`!package-lock.json`, `!tsconfig*.json`, `!.vscode/extensions.json`, `!.claude/settings.json` y los
diagramas.

Afecta a este plan en F1: **si Vitest necesita cualquier `.json` nuevo, hay que añadirle su
excepción** o se quedará sin versionar y el runner no arrancará en otro clon. Se evita configurando
Vitest dentro de `vite.config.ts`, que no es JSON.

La prueba buena es `git add -An`, no `git check-ignore`: el código de salida de `check-ignore` induce a
error cuando la regla que casa es una negación.

### 3 · El CSS de Crepe se importa en runtime y gana especificidad

`@milkdown/crepe/theme/common/style.css` se carga con `import()` desde `onMount`
(`Milkdown.svelte:78`), o sea **después** de `app.css`. A igual especificidad gana el suyo.

Se resuelve **repitiendo la clase**, no con `!important`. Ya hay precedente funcionando:
`.label-wrapper.label-wrapper` en `app.css:96-97`, con el porqué documentado en `:92-95`. Si en F4 o F5
un estilo de Crepe no se deja sobreescribir, ese es el motivo y esa es la técnica.

### 4 · `node --check` no detecta errores de runtime

Y aquí ni siquiera aplica: el grueso del código son `.svelte` y `.ts`, que ese comando no lee. La
verificación mecánica real es `npm run check` (svelte-check) más `npm run build`, y **ninguna de las
dos ejecuta la aplicación**. Un componente puede compilar limpio y reventar al montarse.

Por eso cada sub-fase de UI lleva verificación en el navegador además de la suite, y por eso F1 existe.

### 5 · Node no está en el PATH

Está en `F:\local\fnm\aliases\default\node.exe` (v24.19.0, npm 11.17.0), vía fnm, con una única
versión instalada. Una sesión nueva no lo ve. `fnm list` solo lo encuentra con `FNM_DIR=F:\local\fnm`.

### 6 · `StaticFiles` mata el proceso al importar si falta el directorio

Verificado en el contenedor: `StaticFiles(directory='/no/existe')` lanza `RuntimeError` al
construirse, y eso corre **a nivel de módulo**. Es el mismo patrón que el incidente del IdP del 30/07,
donde `_build_auth()` al importar mataba el proceso y cerraba el círculo de recuperación de CENIT.

**`check_dir=False` es obligatorio**, no opcional. Sin él, un clon sin build o un bind-mount mal
escrito dejan el módulo entero sin arrancar en vez de servir un 404.

### 7 · El profile `test` resucita el Postgres retirado

`docker compose --profile test run --rm test` levanta el servicio `db`, que es el Postgres viejo de
Naeth, retirado tras el cutover a CENIT. Ya no tiene `restart` policy (se quitó el 02/08 justo por
esto), pero **conviene bajarlo al terminar**: `docker compose --profile test down`.

---

## Sub-fases, en orden de ejecución

Dependencias: **F0 bloquea todo.** F1 bloquea F2 y F3, porque sus tests son los que los protegen. F2,
F3, F4 y F5 son independientes entre sí y pueden reordenarse. F6 bloquea F7, y F7 bloquea F8.

"Suite acumulada" significa siempre: **todo lo verde hasta ahora, otra vez**, más lo nuevo.

---

### F0 · Entorno reproducible y línea base verde

**Qué se construye:** el loop de desarrollo funcionando y la prueba de que el proyecto compila hoy,
24 días después del último toque.

**Ficheros:** ninguno. Solo se genera `naeth/web/node_modules/` y se regenera `dist/`.

**Pasos:**
1. Activar Node. Por ruta absoluta (`F:\local\fnm\aliases\default\npm.cmd`) o con
   `$env:FNM_DIR="F:\local\fnm"; fnm use default`.
2. `npm ci` en `naeth/web`. El lock está sincronizado con el `package.json` (302 paquetes,
   lockfileVersion 3), así que debe ser reproducible.
3. `npm run check` y `npm run build`.

**Entregable verificable:**
- `npm run check` termina con **0 errores y 0 warnings** (la línea base del 28/07 eran 407 ficheros).
- `npm run build` sale con **exit 0**.
- El CSS del build contiene **`#1e2022`** y ya no `#20201f`. Esto demuestra que el desfase entre
  `dist` y `src` quedó cerrado, que es el fallo silencioso del que nadie tenía registro.

**Cómo se testea:** es la línea base, no hay suite anterior. Deja anotado el número de ficheros y el
tiempo de build: son la referencia para comparar al final.

**Si `npm ci` falla:** es el riesgo número uno del día. Vite 8 y TypeScript 6 son recientes. Plan B:
`npm install` y, si cambia el lock, commitearlo como parte de F0 con el motivo. **No** avanzar a F1
sin verde aquí.

---

### F1 · Vitest y los primeros tests

**Qué se construye:** el runner de tests que hoy no existe, con cobertura de la lógica pura que más
puede romperse en silencio.

**Ficheros:**
- `naeth/web/package.json` (dependencia `vitest` y script `test`)
- `naeth/web/vite.config.ts` (bloque `test`, para no crear un `.json` nuevo: ver trampa 2)
- `naeth/web/src/lib/wikilinks.test.ts` (nuevo)
- `naeth/web/src/lib/tree.test.ts` (nuevo)

**Por qué estos dos y no otros:** son lógica pura sin DOM ni red, así que no hace falta
`@testing-library` ni `jsdom`. Y `wikilinks.ts` decide **qué se enlaza y qué no**: tiene seis caminos
de resolución que nadie ha ejecutado nunca contra casos escritos a propósito. Si falla, falla en
silencio, que es el peor modo de fallo posible en un sistema de memoria.

**Casos mínimos para `wikilinks.ts`,** uno por camino de `resolve()` más los guardas:
1. uuid completo
2. prefijo de uuid (8 hex)
3. título exacto, y con duplicados gana el más reciente
4. slug exacto
5. prefijo de título, y con varios candidatos gana el título **más corto**
6. prefijo de slug
7. `MIN_PREFIX`: un destino de menos de 8 caracteres **no** resuelve por prefijo
8. un uuid con guiones que no está en el árbol devuelve `null` (apunta a una versión superseded)
9. `toDisplayMarkdown` **no toca** un `[[algo]]` dentro de un bloque vallado ni de backticks
10. alias estilo Obsidian `[[destino|texto]]` produce el texto del alias
11. `extractLinkedIds` recoge tanto los `[[ ]]` como los `](#/m/<id>)` ya insertados, sin duplicar

**Casos mínimos para `tree.ts`:** agrupado por `proyecto/subtema`, path ausente cae en `(sin path)`,
path de un solo nivel cae en `·`, y los tres modos de orden (`az`, `date-desc`, `date-asc`).

**Entregable verificable:** `npm test` en verde, con al menos 15 casos. Y una prueba de que la suite
sirve: rompe a propósito el umbral `MIN_PREFIX` de 8 a 2, comprueba que **el test 7 falla**, y
devuélvelo.

**Cómo se testea:** suite acumulada = F0 (`check` + `build`) más `npm test`.

---

### F2 · Autoría en la cabecera de la memoria

**Qué se construye:** que junto a path, tipo, fecha e id salga quién escribió la nota y con qué modelo.

**Ficheros:**
- `naeth/web/src/lib/types.ts` (campo `author` en `MemoryRow`)
- `naeth/web/src/views/Memoria.svelte` (la línea `d-meta`, hoy en `:342-347`)

**Backend: nada que tocar.** `core.get()` hace `SELECT *`, así que `/api/memory/{id}` ya devuelve
`author` (jsonb con `product`, `surface`, `zone`, `actor`, `vendor`, `model`, `model_source`) más las
generadas `author_product`, `author_surface` y `author_model`. Verificado en vivo.

**Forma exacta, para no tener que decidir al vuelo:**

```
si author.actor === 'human'        ->  "Eneko"
si no, y author.model existe       ->  `${author.product} · ${author.model.replace(/^claude-/, '')}`
si no, y author.product existe     ->  author.product
si no hay author                   ->  no se pinta el separador ni nada
```

Resultado esperado sobre el corpus real, que tiene ocho combinaciones:
`claude-code · opus-5` (142 notas), `claude-ai` (134, legado sin modelo), `claude-code` (73, legado),
`claude-ai · opus-5` (33), `claude-code · opus-4-8` (19), `Eneko` (1).

Mismo estilo que el resto de `d-meta`: `font: 12px var(--font-mono)`, `color: var(--dim)`, separado
por `<span class="sep">·</span>`.

**Entregable verificable:** abre tres memorias con autoría distinta y comprueba que cada una muestra
lo que dice `/api/memory/{id}`. Al menos una del legado sin modelo, para ver que degrada al producto
solo y no imprime `undefined`.

**Cómo se testea:** suite acumulada F0+F1, más verificación manual de esta pieza en el navegador.

---

### F3 · Retirar el vocabulario `origen` y usar `subtema`

**Qué se construye:** que el segundo nivel del path se llame lo que es desde la migración del
21/07/2026, y que deje de intentar mapear iconos que ya no existen.

**Ficheros (catorce puntos, mismo patrón en todos):**
- `naeth/web/src/lib/colors.ts:35-38` (`ORIGIN_ICON`)
- `naeth/web/src/lib/tree.ts:4,5,42` (`interface Origin`, `Project.origins`)
- `naeth/web/src/lib/search.svelte.ts:26,33,74` (`originOf`, `kind === 'source'`)
- `naeth/web/src/components/{Sidebar,Crumbs,Header}.svelte` (imports y usos)
- `naeth/web/src/views/Memoria.svelte:328` (placeholder `proyecto/origen`)

**Las dos mitades del cambio:**

1. **Nombres.** `Origin` pasa a `Subtopic`, `origins` a `subtopics`, `originOf()` a `subtopicOf()`.
   El placeholder de la ruta pasa a `proyecto/subtema`. El prefijo de búsqueda `:fuente` pasa a
   `:subtema`, y con él la etiqueta `Fuentes` de la cabecera del desplegable (`search.svelte.ts:58`).
2. **Iconos.** `ORIGIN_ICON` solo mapea `code` y `chat`, y **0 de 411 memorias aciertan**: los 46
   subtemas reales son `method`, `status`, `build`, `tech`, `workflow`, `stack`, `magic`, `infra`,
   `billing`, `commercial`, `foundations`, `design` y otros 34.

   Decisión: **retirar el diccionario** y dejar el icono genérico de carpeta en los tres sitios que lo
   usan. Motivo: mantener un mapa de 46 entradas es inventarse una taxonomía visual que nadie ha
   pedido, y hoy el resultado efectivo ya es la carpeta genérica en el 100 % de los casos. Retirarlo
   no cambia **nada** de lo que se ve y quita 14 puntos de código muerto. Si algún día se quiere
   iconografía por subtema, se diseña entera en v2.x, no se hereda de un esquema derogado.

**Entregable verificable:** `grep -rn "ORIGIN_ICON\|originOf\|Origin\|proyecto/origen\|:fuente" src/`
no devuelve **nada**. El árbol, los breadcrumbs y el buscador siguen funcionando igual que antes, con
el mismo icono que ya salía.

**Cómo se testea:** aquí F1 se gana el sueldo. Los tests de `tree.ts` cubren el agrupado, así que el
renombrado queda protegido: si `buildTree` se rompe al renombrar, **el test falla**. Suite acumulada
F0+F1 completa, más un vistazo al árbol en el navegador.

---

### F4 · Tres arreglos de una línea

**Qué se construye:** el pulido que entra en producción con el resto o no entra nunca.

**Ficheros:** `naeth/web/src/app.css`, `naeth/web/src/components/Sidebar.svelte`.

1. **`--sel` derivado del fondo.** Hoy es un color independiente (`#17222e` en oscuro, `app.css:29`) y
   por eso se lee como un parche azul y no como "esta fila está seleccionada".

   Regla: derivarlo del fondo sobre el que vive, subiendo hacia el acento.
   ```css
   --sel: color-mix(in srgb, var(--accent) 10%, var(--bg2));
   ```
   Vale para los dos temas sin escribir dos valores, porque `--accent` y `--bg2` ya cambian con
   `[data-theme]`. `color-mix` ya se usa en este fichero (`:69`) y en `Sidebar.svelte:129`, así que no
   es sintaxis nueva.

   **Criterio de aceptación:** quien marca la selección es el borde izquierdo
   (`box-shadow: inset 2px 0 0 var(--accent)`, `Sidebar.svelte:139`); el fondo solo la insinúa. Si a
   ojo se sigue leyendo como un bloque de color, baja el porcentaje a 6. Si no se distingue nada,
   súbelo a 14. Comprueba los dos temas.

2. **D5 · título completo en las hojas del árbol.** `.label` recorta con ellipsis
   (`Sidebar.svelte:133`) y no hay forma de leer el texto entero sin abrir la memoria. Añadir
   `title={m.title || '(sin título)'}` al botón de la hoja (`:91-100`). Este repo tiene títulos muy
   largos, así que es el arreglo con mejor relación valor/esfuerzo del lote.

3. **D4 · retirar el `role="tree"` mentiroso.** `Sidebar.svelte:68` declara `role="tree"` y no hay ni
   un `treeitem`, ni `aria-expanded`, ni `aria-selected`, ni navegación con flechas. Un lector de
   pantalla anuncia un árbol y luego no encuentra ítems.

   Se **retira el atributo**. Queda una lista de botones, que es lo que de verdad es. Implementarlo en
   condiciones cuesta como una vista entera y va a v2.x. El `aria-label="Árbol de memorias"` del
   `<nav>` (`:61`) se queda: describe, no promete una semántica que no se cumple.

**Entregable verificable:** los dos temas con la fila seleccionada legible, un tooltip con el título
completo al pasar por encima de una hoja, y `grep -n 'role="tree"' src/` sin resultados.

**Cómo se testea:** suite acumulada F0+F1. Verificación visual en los dos temas, y en móvil a 375 px
para confirmar que el `title` no estorba en táctil.

---

### F5 · D7 y D8, los dos "sin verificar" del informe del 28/07

**Qué se construye:** el diagnóstico que ninguna de las dos auditorías anteriores pudo hacer, porque
requiere ejecutar la aplicación.

**Ficheros:** por determinar. Depende de lo que se encuentre.

**D7 · el editor nace "modificado".** Al abrir el editor sin tocar nada, el pie ya muestra
`● modificado`. Hipótesis en pie: Milkdown normaliza el markdown al cargar, y como `isDirtyNow`
compara `mdRef.getMarkdown()` contra `m.content` (`Memoria.svelte:186-193`), la comparación da
distinto siempre.

Cómo confirmarlo: abre una memoria, entra en edición sin escribir, y en la consola compara
`getMarkdown()` con el `content` original carácter a carácter. Si la hipótesis es correcta, el
diagnóstico dirá **qué** normaliza (espacios finales, marcadores de lista, escapes).

Arreglo propuesto si se confirma: capturar el markdown **una vez** al entrar en edición, después de
que Milkdown haya montado, y usar esa captura como línea base en vez de `m.content`. Así el `dirty`
mide lo que el usuario cambió, no lo que el editor normalizó.

Por qué importa: si el aviso salta siempre, deja de significar nada, y el visor pasa a ser el sitio
donde se edita de verdad. Un aviso que siempre está encendido es peor que no tenerlo.

**D8 · la búsqueda se pide por duplicado.** Al teclear se registran dos
`GET /api/search?q=…&semantic=true` idénticos. La lectura de `search.svelte.ts` y `Header.svelte` no
lo explica: hay debounce de 200 ms (`:82`) y guard por secuencia (`:63,67`).

Cómo diagnosticarlo: con el panel de red abierto, teclear una consulta y mirar si las dos peticiones
salen del mismo `doSearch` o de dos. Sospechoso principal: `<input type="search">`
(`Header.svelte:66`), cuyo botón nativo de limpiar emite eventos `input` extra en algunos navegadores.

**Entregable verificable:** para D7, entrar en edición sin tocar nada deja el pie **sin**
`● modificado`, y escribir una letra lo enciende. Para D8, una consulta produce **una** petición en el
panel de red.

**Si D8 no se reproduce o no se aisla en media hora, se documenta y se deja para v2.x.** No corrompe
resultados, solo cuesta el doble. D7 sí se cierra hoy: afecta a la confianza en el editor.

**Cómo se testea:** suite acumulada F0+F1 completa, más la verificación en el navegador de las dos
conductas.

---

### F6 · El backend sirve el build

**Qué se construye:** las rutas que hoy no existen para que un build de Vite pueda cargar, y la
capacidad de decir desde fuera qué directorio se sirve.

**Ficheros:** `naeth/app/mcp_server.py`, **el único de `naeth/app/` que toca este plan**. Ver trampa 1
antes de escribir.

**Los dos cambios:**

1. **`VIEWER_DIR` configurable.** Hoy es una constante (`:34`):
   ```python
   VIEWER_DIR = Path(__file__).resolve().parent / "viewer"
   ```
   Pasa a leerse de `NAETH_VIEWER_DIR`, **con ese mismo valor por defecto**. Así un clon sin nada
   configurado sigue sirviendo el v1 exactamente igual que hoy, y el rollback es cambiar una variable
   de entorno en vez de revertir código.

2. **Montar los estáticos.** Al final del fichero, después de `app = mcp.http_app(path="/mcp")`
   (`:471`). Verificado en vivo: `app` es una `StarletteWithLifespan`, subclase de Starlette, y
   **tiene `.mount()`**.
   ```python
   app.mount("/assets", StaticFiles(directory=VIEWER_DIR / "assets", check_dir=False), name="assets")
   ```
   **`check_dir=False` no es opcional**, ver trampa 6.

**Lo que NO hace falta y conviene no añadir:** un fallback de SPA que devuelva `index.html` para
cualquier ruta desconocida. El router del visor es **por hash** (`#/m/<id>`,
`router.svelte.ts:1-9`), así que las únicas rutas reales que pide el navegador son `/` y `/assets/*`.
Un catch-all solo serviría para tapar 404 legítimos de la API.

**Entregable verificable:** con `NAETH_VIEWER_DIR` sin definir, todo sigue **exactamente igual** que
hoy: la raíz sirve el v1 y `/assets/x.js` devuelve 404. Ese es justo el punto: F6 no cambia nada
visible, solo hace posible F7.

**Cómo se testea:**
- **Suite de Python:** `docker compose --profile test run --rm test`, y luego
  `docker compose --profile test down` (trampa 7). `test_oidc_retry.py:17` **importa
  `app.mcp_server`**, así que si el cambio rompe el import, esa suite lo detecta. Es la red de
  seguridad natural de esta sub-fase.
- **Recuperación:** editar este fichero dispara el reload de los dos servicios. Comprueba **el 8801**,
  no solo el 8800: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8801/healthz` debe dar
  200. Si se queda colgado, `docker restart naeth-viewer-1 naeth-worker-1`.
- Suite acumulada del front F0+F1 sin cambios (aquí no se toca `web/`).

---

### F7 · Despliegue: el v2 sustituye al v1

**Qué se construye:** que los dos puertos sirvan el build de Vite en vez del HTML monolítico.

**Ficheros:** `naeth/docker-compose.yml` (servicios `api` y `viewer`).

**El cambio, idéntico en los dos servicios:**
```yaml
environment:
  NAETH_VIEWER_DIR: /srv/viewer
volumes:
  - ./web/dist:/srv/viewer:ro
```
El compose vive en `naeth/`, así que `./web/dist` es `naeth/web/dist`. Solo lectura: el proceso no
tiene por qué escribir ahí nunca.

**Antes de recrear:** `npm run build` una última vez, para que el `dist` incluya F2 a F5.

**Pasos:**
1. `npm run build` en `naeth/web`.
2. `docker compose up -d api viewer` (recrea los dos por el cambio de volumen).
3. Esperar a `healthy` en ambos.

**Entregable verificable.** No vale con que "se vea bien", hay que demostrar que lo servido es el
build:
- `curl -s http://127.0.0.1:8800/ | grep -c 'assets/index-'` devuelve **1** o más. Hoy devuelve **0**.
  Es la prueba exacta que usó la auditoría del 28/07 para demostrar lo contrario.
- Lo mismo en `http://127.0.0.1:8801/`.
- `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8800/assets/<el-js-del-index>` devuelve
  **200**. Hoy devuelve 404 en los dos puertos.
- El HTML servido lleva `<div id="app">` y **no** los 63 KB de CSS y JS inline del v1.
- La aplicación carga en el navegador contra `:8801` directamente (sin dev server): árbol, apertura de
  una memoria, wikilinks navegables y cambio de tema.

**Verificación por el túnel:** entra a `naeth-visor.enraxk.dev` desde el móvil. El bloque de Caddy es
un `reverse_proxy` limpio a `host.docker.internal:8801` tras forward-auth
(`CENIT/core/generated/Caddyfile.modules:14-29`), sin filtro de rutas, así que **los `/assets/*` pasan
solos y no hay que tocar nada de CENIT**. Si esto falla, el problema es del backend, no del enrutado.

**Rollback, si algo va mal:** quitar `NAETH_VIEWER_DIR` del compose y `docker compose up -d api
viewer`. Vuelve el v1 sin revertir una sola línea de código, porque el default de F6 apunta ahí. El v1
(`naeth/app/viewer/index.html`) **se conserva**: es el rollback más barato que hay y no molesta a nadie.

**Nota sobre el VPS `finally`:** seguirá sirviendo el v1, porque el `dist` no está en git y ese nodo no
lo tiene. Es correcto y deliberado hoy. Alinear el nodo de respaldo es trabajo de v2.x, y arrastra la
deuda ya conocida de que el reconciler no gobierna ese nodo.

---

### F8 · Cierre: commit y push

**Qué se construye:** que el trabajo salga del disco.

**Pasos:**
1. Commit de lo de hoy. Deja `.pen` fuera: su borrado es una decisión aparte y no pertenece a este
   commit.
2. `git push`. Se van **tres** commits: los dos del 20/08 que llevan esperando (`6b856a4` con los
   wikilinks y `b0e96bf`) más el de hoy. Era la condición que fijaste el 20/08: el push espera a que el
   visor esté terminado.
3. Mover
   [`docs/discovery/visor-v2-estado-2026-08-22.md`](../discovery/visor-v2-estado-2026-08-22.md)
   al commit también, y escribir este plan en `docs/plan/visor-v2-cierre.md` (crear el directorio).

**Entregable verificable:** `git status` limpio salvo `D .pen`, y `git log origin/main..HEAD` vacío.

---

## Verificación de extremo a extremo

Al terminar, esta secuencia completa tiene que pasar de una tirada:

```
1. npm run check                 -> 0 errores, 0 warnings
2. npm test                      -> verde, >=15 casos
3. npm run build                 -> exit 0
4. docker compose --profile test run --rm test   -> pytest verde
   docker compose --profile test down
5. curl -s http://127.0.0.1:8800/ | grep -c 'assets/index-'   -> >=1
6. curl -s http://127.0.0.1:8801/ | grep -c 'assets/index-'   -> >=1
7. curl -o /dev/null -w "%{http_code}" http://127.0.0.1:8801/healthz  -> 200
8. Navegador contra :8801 -> abrir una memoria, seguir un wikilink,
   ver la autoría en la cabecera, cambiar de tema, editar y comprobar
   que el pie NO dice "modificado" hasta escribir algo.
9. Móvil contra naeth-visor.enraxk.dev -> carga el v2 tras SSO.
```

---

## Si el día se queda corto

El orden elegido pule antes de desplegar, así que el riesgo es quedarse sin desplegar. Punto de corte
recomendado si a las 21:00 no se ha llegado a F6: **saltar F5 entero** (D7 y D8 quedan documentados y
pasan a v2.1) e ir directo a F6, F7 y F8. Desplegar el v2 con dos defectos menores conocidos vale más
que un v2 impecable que sigue en el disco, que es exactamente lo que lleva pasando desde el 30 de
junio.

Lo que **no** se puede saltar: F0 (sin verde no hay nada), F6 y F7 (son el cierre).

---

## Lo que queda para v2.x

Al cerrar hoy, la versión queda fija en **v2** y esto es la cola, sin prioridad asignada:

- **Nueva memoria** (`POST /api/memory` ya existe y el editor está resuelto: es sobre todo ensamblaje).
- **Grafo del conocimiento**, que es la pieza grande y la única con decisiones de producto sin tomar.
- **Ajustes.**
- **D4 completo**: `treeitem`, `aria-expanded`, `aria-selected` y roving tabindex.
- **D9**: el chunk de 664 kB. Medirlo **con el túnel de por medio**, ya en producción, y decidir con el
  número delante.
- **Alinear el nodo `finally`** para que sirva el v2.
- **Tier 2** (callouts, Mermaid, buscar y reemplazar, folding), **Tier 3** (adjuntos) y **Fase 0**
  (arrastrar y soltar, menú contextual "Relacionar").
- **D6**: las dos memorias sin título de `cenit/build` (`14134724` y `f94961e3`). Es dato, no código.
- **La nomenclatura de versiones**, en su propia conversación.
