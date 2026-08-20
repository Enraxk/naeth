# Visor v2 · estado real verificado en vivo (28/07/2026)

Auditoría del visor v2 (`naeth/web/`) ejecutada **contra la pila viva** desde el navegador
integrado, no por lectura de código. Cada afirmación de aquí se comprobó ejecutando algo; lo que
no se pudo confirmar va marcado `⚠ sin verificar`.

Contexto: no se modificó ningún fichero de `naeth/web/src/` ni de `naeth/app/`. Lo único que se
escribió en la memoria fue una nota de prueba, ya retirada (ver §6).

## 0 · Esto NO es lo que hay publicado

**El visor v2 no está desplegado en ninguna parte.** Lo que se sirve en producción (incluido
`naeth-visor.enraxk.dev`, al que se entra desde el móvil) es el **visor v1** vanilla.

Verificado: `GET /` en los dos puertos de la pila (`:8800` del módulo y `:8801` del visor)
devuelve **exactamente el mismo fichero**, 62.816 bytes con CSS y JS inline y **cero referencias a
`/assets/index-*`**, que es lo que produciría el build de Vite. El motivo está en
`naeth/app/mcp_server.py:299-301`: la ruta `/` sirve `VIEWER_DIR/index.html`, o sea
`naeth/app/viewer/index.html`. El "ajustar el `custom_route "/"`" que anota
`naeth/web/README.md:19` como paso de producción **nunca se hizo**.

Consecuencia para leer este documento: **ningún defecto de los que siguen afecta hoy a lo que se
ve desde el móvil**. Son defectos del v2, que vive solo en el dev server. Y al revés: cuando el v2
sustituya al v1, D1 (tema claro ilegible) pasaría a producción con él.

## 1 · Cómo levantar el loop de desarrollo

```
npm --prefix naeth/web run dev -- --port 5180 --strictPort
```

Hay una configuración `naeth-visor` en `.claude/launch.json` que hace exactamente eso.

**Por qué 5180 y no el 5173 de siempre**: el 5173 lo ocupa el dev server de Yog-IN. Sin
`--strictPort`, Vite se va solo al 5174 y la config apunta a un puerto que no es. El puerto fijo
es lo que hace el loop repetible.

El dev server proxya `/api` → `127.0.0.1:8800` (`vite.config.ts:17-21`), o sea **contra la memoria
de producción**. En dev no hay SSO por delante: la protección vive en el borde (Caddy +
oauth2-proxy), no en la app.

## 2 · Alcance real

| Vista | Estado |
|---|---|
| Inicio | Implementada |
| Estado | Implementada |
| Memoria (lectura + edición) | Implementada |
| Grafo | Stub, "Paso 5.4" (`src/views/Stub.svelte:6`) |
| Nueva memoria | Stub, "Paso 5.3" (`src/views/Stub.svelte:7`) |
| Ajustes | Stub (`src/views/Stub.svelte:8`) |

Backend: el CRUD completo y las relaciones **ya están expuestos por HTTP**
(`naeth/app/mcp_server.py:342-411`), incluidos `POST /api/relation`,
`GET /api/memory/{id}/relations` y `DELETE /api/relation/{id}`.

## 3 · Tres cosas que la memoria de Naeth dice mal

La nota `3f3c6a37` (01/07/2026) quedó desfasada:

1. Dice que lo siguiente es "responsive total antes de la Fase 0". **El responsive ya está**:
   breakpoint de 860 px con la sidebar convertida en cajón (`App.svelte:54`,
   `Sidebar.svelte:154-158`, `src/lib/ui.svelte.ts`), y afinado táctil por `pointer: coarse`
   (`Sidebar.svelte:147-151`).
2. Dice que relacionar arrastrando "pide un endpoint HTTP nuevo, hoy solo en core/MCP".
   **Ya existe** (`mcp_server.py:396-411`) y `src/lib/api.ts:31-40` lo consume.
3. No menciona el **editor Milkdown** (`@milkdown/crepe`) ni la edición por supersede, que están
   integrados y funcionando.

## 4 · Defectos encontrados, por gravedad

### D1 · ALTO · El tema claro deja el contenido ilegible

En tema claro, el cuerpo de la memoria desaparece: queda texto casi blanco sobre fondo casi
blanco. Medido en vivo sobre los nodos que pinta Milkdown:

- color `rgb(248, 249, 255)` sobre fondo `rgb(247, 247, 245)` → **contraste 1.02:1**
  (WCAG 2.2 exige 4.5:1 para texto normal).
- El contenedor `.d-body` sí tiene el color correcto del tema (14.71:1): **el problema son los
  hijos**, no el contenedor.

Causa: el CSS de `@milkdown/crepe` trae su propio color de texto y no sigue los tokens del visor
(`src/app.css`). En tema oscuro el color de Crepe coincide por casualidad con el del visor y el
fallo no se ve; en claro rompe. Es el defecto más grave: hace la mitad de los temas inservible
para lo único que hace el visor, que es leer memorias.

### D2 · MEDIO · Los `[[wikilinks]]` no son navegables

En la vista de lectura, `[[CENIT · vigilancia de hostnames]]` se renderiza como **texto literal**.
El único `<a>` del cuerpo es un widget interno de Milkdown, vacío. Las relaciones explícitas sí
aparecen en el panel lateral ("Relaciones · 2"), pero desde el texto no se salta a ninguna parte.

Peso real: los wikilinks se usan en casi todas las memorias, así que es la mejora con mejor
relación valor/esfuerzo del inventario.

### D3 · MEDIO · El visor conserva el vocabulario de paths derogado

`ORIGIN_ICON` (`src/lib/colors.ts:33-36`) solo mapea `code` y `chat`, que eran los valores del
esquema **viejo** `proyecto/origen`, retirado el 21/07/2026. Desde la migración el segundo nivel
del path es el **subtema** (`client`, `infra`, `security`, `status`…), así que hoy **ningún
subtema acierta el mapa y todos caen al icono genérico de carpeta**.

La deuda es también de nombres: `tree.ts:4-5` define `Origin` / `origins`, y `search.svelte.ts:26`
tiene `originOf()`, todos hablando de "origen" donde el dato ya significa "subtema". El buscador
mantiene además un prefijo `:fuente` que filtra por ese nivel con la semántica antigua.

### D4 · MEDIO-BAJO · El árbol anuncia `role="tree"` pero no lo cumple

`Sidebar.svelte:68` declara `role="tree"`, pero sus hijos son `<div>` y `<button>`: no hay ni un
`treeitem`, ni `aria-expanded` en los nodos que colapsan, ni `aria-selected` en la hoja activa, ni
navegación con flechas. Un lector de pantalla anuncia un árbol y luego no encuentra ítems.

Las dos salidas honestas son completarlo (treeitem + aria-expanded/selected + roving tabindex) o
retirar el `role` y dejarlo como lista de botones. Lo que no se sostiene es el estado actual.

### D5 · BAJO · El título largo no se puede leer entero

`.label` recorta con `text-overflow: ellipsis` (`Sidebar.svelte:133`) y no hay `title` ni
`aria-label` con el texto completo. Con títulos tan largos como los de este repo, la única forma de
saber qué pone es abrir la memoria.

### D6 · BAJO · Dos memorias sin título en `cenit/build`

El árbol muestra dos entradas "(sin título)" del 21/07/2026 (23:11 y 23:13). El visor degrada
bien (`Sidebar.svelte:98`); el problema es del dato. Merece mirarlas y ponerles título o
retirarlas.

### D7 · BAJO · ⚠ sin verificar: el editor nace "modificado"

Al abrir el editor sin tocar nada, el pie ya muestra el indicador `· modificado`. La hipótesis es
que Milkdown normaliza el markdown al cargar y eso dispara el `dirty`. No se aisló la causa. Si se
confirma, el aviso de cambios sin guardar pierde valor porque salta siempre.

### D8 · INFO · ⚠ sin verificar: la búsqueda se pide por duplicado

Al teclear, el panel de red registra **dos** `GET /api/search?q=…&semantic=true` idénticos. Hay un
debounce de 200 ms y un guard por secuencia (`search.svelte.ts:63,67`), así que no corrompe el
resultado, pero se paga el doble de coste. No se diagnosticó el origen.

### D9 · INFO · Línea base del build

`npm run build` avisa de chunks > 500 kB: el mayor es `esm-*.js` con **664 kB** (Milkdown + KaTeX,
que arrastra decenas de fuentes y modos de CodeMirror). Es preexistente y no urgente en local,
pero es el candidato obvio a `import()` dinámico el día que el visor se sirva por el túnel.

## 5 · Lo que se verificó que funciona

- **Estado del nodo**: cuadra exactamente con `system_status` del MCP (284 vigentes, 410
  versiones, 257 relaciones, 413 jobs completados, 0 errores). El gráfico de 14 días suma 90, que
  es justo el total que muestra, y cada barra lleva su tooltip.
- **Búsqueda**: funciona y es rápida. Medido contra `:8800` fuera del navegador: **0,46 s en
  semántica y 0,14 s en léxica**, 10 hits cada una. (Un `javascript_tool` llegó a expirar a los
  30 s: era el panel del navegador atascado, no la API. Conviene no confundirlos.)
- **Historial de versiones**: se muestra correctamente (v3 · actual / v2 / v1 con fechas), lo que
  confirma que la corrección de `child_id`/`parent_id` respecto al visor v1 está operativa.
- **Responsive a 375 px**: sin scroll horizontal, sidebar fuera de pantalla por `translateX(-100%)`,
  cajón que abre con backdrop (z-index 40 bajo la sidebar en 41) y rejilla `327px + 48px`.
- **Reveal-in-tree**: al abrir una memoria, el árbol despliega su rama y la selecciona.
- **Stubs**: las tres rutas degradan limpias, con icono, explicación y badge "Próximamente".
- **Consola**: sin un solo error ni warning en todo el recorrido.

## 6 · Camino de escritura, verificado end-to-end

Sobre una memoria de prueba creada para esto:

1. Creada por MCP en `naeth/viewer` (id `279868b7`).
2. Abierta en el visor → **editar** → texto añadido → **Guardar**.
3. Resultado: contenido persistido, `id` nuevo (`7e3fcc86`) e historial mostrando **v2 · actual**
   junto a v1. O sea, el supersede desde la UI funciona.
4. Retirada con `memory_tombstone`. El árbol dejó de mostrarla y el contador volvió a 284.

Nota honesta: el esquema es ADD-only, así que el tombstone **retira pero no borra**; la cadena de
versiones de la prueba queda en el historial. Es el precio de verificar la escritura de verdad, y
por eso se hizo sobre una nota propia y desechable en lugar de sobre una real.

## 7 · Recomendación de siguiente pieza

**Arreglar D1 antes que nada.** Es pequeño (alinear los tokens de Crepe con `src/app.css`), no
depende de decisiones de producto y hoy inutiliza un tema entero.

Después, **D2 (wikilinks navegables)**: es la mejora que más se va a notar en el uso diario y
además es el escalón natural hacia el Grafo (Paso 5.4), porque obliga a resolver título → id, que
es justo lo que el grafo necesita.

**Nueva memoria** (Paso 5.3) sigue siendo la pieza más barata de las tres stub: `POST /api/memory`
existe y el editor ya está resuelto en `Memoria.svelte`; es sobre todo ensamblaje.

## 7-bis · Pendientes que Eneko anotó durante la sesión (no ejecutados)

- **Autoría en la cabecera de la memoria.** Que junto a `path · tipo · fecha · id` salga **quién la
  escribió y con qué modelo**. El dato ya existe y no hay que capturarlo: el Paso 10 guarda
  `author` con `product` / `surface` / `actor` / `model`, y hay un `GET /api/authors`
  (`mcp_server.py:337`). Es sobre todo pintarlo y decidir la forma corta (¿"claude-code · opus-5"?).
- **El tema oscuro es demasiado oscuro.** Referencia pedida: el modo oscuro de Claude Desktop.
  Hoy `--bg: #0d0f12` y `--bg2: #0b0d10` (`app.css:24`), que son casi negro; subir el fondo unos
  cuantos puntos afecta a todo el visor, no solo al editor.
- **Revisar el dorado del código inline.** No es una decisión de diseño heredada: al mapear el tema
  de Crepe se ató `--crepe-color-inline-code` al token `--warn`, que en oscuro es `#e0a64b`. Antes,
  con `nord-dark`, era un rosa salmón (`#ffb4ab`). Ninguno de los dos se eligió a propósito para
  este uso, así que toca decidirlo de verdad. Restricción medida: sobre el fondo claro compuesto,
  el color debe quedar por encima de 4.5:1 (`--warn` daba 4.49).

## 8 · Cómo se probó

Navegador integrado contra `localhost:5180`, con `read_page` (árbol de accesibilidad),
`javascript_tool` para medir estilos computados y contraste, `read_network_requests` para el
tráfico, `resize_window` para los breakpoints y capturas para lo visual. Las latencias se midieron
**fuera** del navegador, contra `127.0.0.1:8800`, para no confundir la lentitud del panel con la
del backend, cosa que estuvo a punto de pasar.

Línea base de la suite, en verde antes y después: `npm run check` (407 ficheros, 0 errores,
0 warnings) y `npm run build` (exit 0).
