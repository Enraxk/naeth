# Stack de diseño y animación: qué tengo y qué me falta

Discovery del 24/08/2026. Pregunta que responde: si el workflow **Pencil + Hyperframes + Anime.js
sobre Claude Code** sirve tal cual para diseñar y revisar pantallas como "Nueva memoria", o si le
falta una pieza concreta.

Todo lo comprobado en local está fechado el 24/08/2026 y lleva ruta y línea. Lo que no he
comprobado está en la sección 6, no deducido.

---

## 1. Qué tengo ya

### 1.1 Skills en disco

`C:\Users\eneki\.claude\skills\` contiene exactamente nueve: `NaethPersist`, `craft-ui`,
`discovery-interview`, `excalidraw-diagram`, `inkerlum-prose`, `prompt-refiner`, `repo-onboarding`,
`security-auditor`, `watch`. Las relevantes aquí son dos.

| Herramienta | Ruta | Qué hace de verdad | Qué NO hace | Se pisa con |
|---|---|---|---|---|
| **craft-ui** | `~/.claude/skills/craft-ui/` | Criterio de diseño en dos carriles (interfaz y documento). Obliga a nombrar dirección estética, prohíbe patrones de generación automática, cierra con puerta WCAG 2.2. Trae `references/animation-guide.md` con una jerarquía de decisión de 4 niveles y presupuesto de movimiento (máx. 3 elementos animados por viewport) | No genera nada por sí sola: es criterio, no motor. No sabe de `.pen` ni exporta a ningún formato | Con `design` y `anthropic-skills:canvas-design`, que sí generan. craft-ui es la capa de criterio encima de cualquiera de ellas |
| **excalidraw-diagram** | `~/.claude/skills/excalidraw-diagram/` | Genera `.excalidraw` JSON con metodología de argumento visual. Trae renderer propio (`references/render_excalidraw.py`) y paleta editable | Diagramas, no UI. No hay componentes, ni estados, ni layout responsive | Con el MCP de Excalidraw (`create_view`), que renderiza en el chat en vez de a fichero |

**Dos referencias colgantes en craft-ui**, ambas verificadas:

- `SKILL.md:9` declara `mcp__open-design__*` en `allowed-tools`, y `references/mcp-config.md:48`
  lo lista como servidor **core**. **Open Design no está instalado**: el bloque `mcpServers` global
  de `~/.claude.json` tiene exactamente dos entradas, `naeth` y `pencil`.
- `references/mcp-config.md:17` documenta Pencil como **extensión de VS Code**, y `:27` da una ruta
  bajo `vscode/extensions/highagency.pencildev-VERSION/`. La instalación real es una **app Electron
  independiente**: `C:\Users\eneki\AppData\Local\Programs\Pen\Pen.exe`, con el servidor MCP en
  `resources\app.asar.unpacked\out\mcp-server-windows-x64.exe` y argumentos `--app desktop`.

**Y un número mal citado**, que importa porque es el que sostiene la sospecha sobre Anime.js:
`references/animation-guide.md:306` dice *"Anime.js (17 KB) as a lighter alternative to GSAP"*.
Medido sobre el bundle real que tengo en disco, son **37 KB gzip**, no 17. Detalle en 1.4.

### 1.2 Skills que no están en disco

`design`, `dataviz`, `artifact-design`, `artifact-diagramming`, `artifact-capabilities`,
`code-review` y las de `anthropic-skills:` (incluidas `canvas-design`, `theme-factory`,
`web-artifacts-builder`, `brand-guidelines`) **existen y están activas, pero no como carpeta**.

Búsqueda que sostiene la afirmación negativa: `find ~/AppData/Local -maxdepth 6 -type d -name skills`
devuelve cero resultados, y `~/.claude/plugins/marketplaces/` solo contiene
`claude-plugins-official`, cuyo árbol no incluye ninguna de ellas. En `~/.claude.json`, el bloque
`pluginUsage` registra `"anthropic-skills@inline"`, o sea: van embebidas en el binario `claude.exe`.

Consecuencia práctica: **no puedo editarlas ni auditar su contenido leyendo ficheros.** Solo puedo
invocarlas. Para las que sí quiero tocar (craft-ui) tengo copia en disco.

| Herramienta | Qué hace | Qué NO hace | Se pisa con |
|---|---|---|---|
| **design** (built-in) | Es **Claude Design dentro de Claude Code**. Crea un lienzo multi-artboard en `.dc.html` publicado como Artifact, con editor visual, selección por clic, panel de propiedades y undo | Es exactamente la herramienta que descartaste. Los `.dc.html` dependen de un runtime (`support.js`) y de un design system remoto | Con Pencil, en el mismo hueco: generar pantallas |
| **artifact-design** / **artifact-diagramming** / **artifact-capabilities** (built-in) | Criterio y mecánica para páginas publicadas como Artifact: calibrado de esfuerzo, SVG en dos temas, capacidades de runtime | No son un editor. Producen HTML, no un fichero de diseño editable | Con craft-ui en el criterio, pero craft-ui no cubre Artifacts |
| **dataviz** (built-in) | Método para gráficos: heurística de forma, fórmula de color con validador, specs de marca | Nada de layout de pantalla ni de movimiento | Con nada de lo de aquí |
| **anthropic-skills:theme-factory** | 10 temas preajustados (color y tipografía) aplicables a cualquier artefacto | No decide estructura ni jerarquía | Con la parte de paleta de craft-ui |
| **anthropic-skills:canvas-design** | Arte estático a `.png` y `.pdf` (pósters, piezas gráficas) | No es UI: no hay componentes ni interacción | Con craft-ui carril documento, parcialmente |
| **anthropic-skills:web-artifacts-builder** | Artifacts HTML complejos con React, Tailwind y shadcn/ui | Solo para artifacts de claude.ai, no para el repo | Con craft-ui carril interfaz |

### 1.3 Skills archivadas

`~/.claude/skills-archive/` guarda **nueve skills oficiales de GSAP**: `gsap-core`,
`gsap-timeline`, `gsap-scrolltrigger`, `gsap-plugins`, `gsap-utils`, `gsap-react`,
`gsap-frameworks`, `gsap-performance` y `gsap-skills` (260 KB, el paquete completo). Archivadas, o
sea inactivas.

Esto es dato, no reproche: significa que la profundidad de conocimiento que ya tenías comprada era
sobre **GSAP**, no sobre Anime.js. Y `craft-ui/references/animation-guide.md:271` remite
explícitamente a instalarlas (`/plugin marketplace add greensock/gsap-skills`).

### 1.4 Servidores MCP con capacidad de diseño

El bloque `mcpServers` global de `~/.claude.json` tiene **exactamente dos** entradas: `naeth`
(`http://127.0.0.1:8801/mcp?s=code`) y `pencil` (stdio contra el exe de la app Pen). Ningún proyecto
de `~/.claude.json` declara `mcpServers` propios. El resto de servidores que veo en sesión
(Gamma, Calendar, Gmail, Jira, Drive) cuelgan de la cuenta, no de esta máquina, y ninguno es de
diseño de interfaz.

| Herramienta | Ruta | Qué hace de verdad | Qué NO hace |
|---|---|---|---|
| **Pencil** (`mcp__pencil__*`) | `~\AppData\Local\Programs\Pen\Pen.exe` + `resources\app.asar.unpacked\out\mcp-server-windows-x64.exe` | 7 tools. `execute` (snippets JS contra el documento `.pen`), `get_app_state`, `get_guidelines` (8 guías y 26 arquetipos de estilo), `get_screenshot`, `export_nodes` (PNG/JPEG/WEBP/PDF a 2x), `export_html` (HTML+Tailwind o HTML+CSS), y **`browser`**: carga una URL real en el navegador integrado, la importa al lienzo como capas editables, o devuelve su DOM y estilos computados | **No tiene línea de tiempo ni modelo de movimiento.** Lo único con tiempo es el uniform `@time` de un fragment shader WebGL, que es efecto de píxel, no transición de DOM. Los `script` son generativos: devuelven un array de nodos estáticos y `Math.random()` es determinista. No hay estados, ni hover, ni prototipado interactivo |
| **Claude Browser** (`mcp__Claude_Browser__*`) | Built-in | Panel de navegador propio: `preview_start` levanta el dev server desde `.claude/launch.json`, `read_page` da el árbol de accesibilidad, `read_console_messages`, `read_network_requests`, `resize_window` con emulación móvil y `colorScheme` | No edita diseño. Es verificación, no autoría |
| **Excalidraw render** (`create_view`) | Built-in | Renderiza elementos Excalidraw en el chat con animación de trazo | No guarda fichero. Complementa, no sustituye, a la skill `excalidraw-diagram` |
| **Naeth** (`mcp__naeth__*`) | `http://127.0.0.1:8801/mcp?s=code` | Memoria persistente | Nada de diseño |

**Sobre la conectividad de Pencil.** A las 11:08 el MCP devolvía
`failed to connect to running Pencil app: desktop after 3 retries`. A las 11:17, con la app abierta
y `F:\src\Investigation\src\pencil\investigación_pencil.pen` cargado, respondió correctamente. O
sea: **el MCP de Pencil exige tener `Pen.exe` abierto**. No es un fallo, es una dependencia
operativa, y conviene saberla antes de guionizar nada desatendido.

### 1.5 El handoff de Claude Design, medido

Ya que motiva el descarte, conviene dejarlo medido en vez de opinado.
`F:\src\Naeth\naeth\web\design_handoff_lenguaje_movimiento\` contiene **cuatro ficheros**:
`README.md`, `lenguaje-de-movimiento.png`, `spec/Lenguaje de movimiento.dc.html` y
`spec/support.js`.

El `README.md` dice que el `.dc.html` "es la especificación, no una ilustración de ella" y pide
abrirlo en un navegador. Pero ese fichero referencia, en sus líneas de cabecera, siete hojas de
estilo y un bundle JS bajo `_ds/naeth-design-system-245c975a-2e3e-4da2-b3ad-3ec8dd9acc7a/`
(`tokens/colors.css`, `semantic-color.css`, `typography.css`, `shape.css`, `spacing.css`,
`base.css`, y `_ds_bundle.js`). **Ese directorio no existe en el handoff**: `find . -type d -name "_ds*"`
sobre la carpeta devuelve cero resultados.

Es decir, la pieza que el propio documento declara como la especificación **no se puede abrir
completa**: pinta sin sus tokens de diseño. Eso no es lentitud, es un entregable roto, y es
material para el juicio sobre Claude Design.

Aparte: el `.dc.html` no es HTML plano. Usa elementos `<x-dc>` y `<script type="text/x-dc">`, y
necesita `support.js` (69 KB, 10 ocurrencias de `x-dc`/`customElements`) como runtime.

---

## 2. Mis entornos frontend

Recorrido de `F:\src` el 24/08/2026, leyendo cada `package.json` fuera de `node_modules`.

| Repo | Ruta | Stack | ¿Admite Anime.js? | ¿Por qué? |
|---|---|---|---|---|
| **Naeth (visor)** | `Naeth/naeth/web` | Vite 8 + Svelte 5.56 + TS 6 + Tailwind v4 | **Sí, técnicamente. No lo necesita** | SPA pura (`grep -c "sveltejs/kit"` sobre su `package.json` da 0): no hay SSR que pueda romper. Vite hace tree-shaking del ESM. Pero el trabajo pendiente es CSS puro, ver sección 3 |
| **yo_soy_sanas** | `yo_soy_sanas` | Next.js 15.4.10 App Router + React 19.1 + Tailwind v4 + Radix | **Sí, y ya lo usa en producción** | `animejs@4.3.6` declarado en `package.json` y presente en `node_modules`. Ocho ficheros lo importan. Patrón: `'use client'` + `useEffect` + guarda de `prefers-reduced-motion` en [`lib/animations.ts:14`](../../../yo_soy_sanas/lib/animations.ts) |
| **FPlibre** | `FPlibre` | Next.js 15.1.0 App Router + React 19 + Tailwind v3 | **Sí, en las mismas condiciones** | Mismo App Router. Cero dependencias de animación hoy, así que entraría limpio |
| **GridWatch Portal** | `GridWatch/gridwatchplatform/GridWatchPortal/ClientApp` | Vite 6 + React 19 + TS + Tailwind v4 + Radix, servido por ASP.NET Core | **Sí, pero duplicaría** | SPA sin SSR (`find GridWatch -name "*.cshtml"` da cero: el `.csproj` sirve el bundle, no renderiza Razor). Ya trae `framer-motion@12.34.3` y `tw-animate-css` |
| **Yogin Website** | `Yogin-workspace/Yogin-Website` | Vite 8 + React 19 + Tailwind v4 + Radix | **Sí, pero sería el tercero** | Ya trae `gsap@3.15.0` + `@gsap/react@2.1.2`, `framer-motion@12.38.0` y `tailwindcss-animate`. Meter Anime.js aquí es empeorar, no mejorar |
| **Yogin audit dashboard** | `Yogin-workspace/_audit-admin-dashboard` | Idéntico al Website (`name` y `version` coinciden: `react-client` 2.5.0) | Igual que el anterior | Trae `framer-motion@12.38.0`. No he verificado si es copia congelada de auditoría o entorno vivo |
| **_practicas-daw** ×4 | `_practicas-daw/{tienda_comestibles, tiendacomestibles, tiendadecomestibles, yourownplanet}` | Laravel + Vite 6 + Tailwind v3 + Alpine.js 3 | **Sí, sin fricción** | Vanilla + Alpine, el terreno natural de Anime.js. Pero es material de clase |

**Sin frontend:** `Yogin-API` (Express 5), `CENIT` (Python y YAML; `find CENIT -maxdepth 4` con
filtros `.html`/`.tsx`/`.svelte`/`package.json` da cero), `Whisper` (Python), `GTFU`,
`UCraftEngine` (PDFs), `Diagramas`, `promting`, `_artefactos`, `windows-setup`, `Cursos`,
`Investigation`. `FreeCAD` es instalación de terceros.

**Nada de Electron, React Native, Capacitor ni Tauri** en ningún repo. Búsqueda:
`grep -rl '"electron"\|react-native\|@capacitor\|@tauri-apps' --include=package.json` sobre
`F:\src`, cero resultados.

**Hyperframes no aparece en ningún repo.** El único acierto de `grep -ril hyperframe` es
`FreeCAD/bin/Lib/site-packages/hyperframe-6.1.0.dist-info/`, que es la librería HTTP/2 de Python,
otra cosa.

### 2.1 La sospecha sobre Anime.js, resuelta

**Era infundada en su forma general, y hay una versión acotada que sí se sostiene.**

Anime.js v4 **guarda el entorno en el módulo raíz**, así que importarlo en servidor no lanza nada.
Verificado leyendo el dist instalado en `yo_soy_sanas/node_modules/animejs/dist/modules/`:

| Fichero y línea | Código |
|---|---|
| `core/consts.js:11` | `const isBrowser = typeof window !== 'undefined';` |
| `core/consts.js:16` | `const win = isBrowser ? window : null;` |
| `core/consts.js:19` | `const doc = isBrowser ? document : null;` |
| `core/globals.js:70` | `if (isBrowser) { ... }` (el efecto secundario va dentro) |
| `core/targets.js:50` | `if (!isBrowser) return ...` |
| `engine/engine.js:140` | `if (isBrowser) { ... }` |

No hay ni un solo acceso desnudo a `document` a nivel de módulo. Los resultados de búsqueda web que
afirman que Anime.js v4 "accede a `document` durante la inicialización del módulo" describen el
comportamiento de **v3**, no de v4; el issue que citan
([#472](https://github.com/juliangarnier/anime/issues/472)) es de la rama vieja.

**La versión acotada que sí se sostiene:** `engine/engine.js:27-28` hace

```js
const engineTickMethod = /*#__PURE__*/ (() => isBrowser ? requestAnimationFrame : setImmediate)();
```

`setImmediate` es un global de Node. En Node existe. En **Vercel Edge Runtime o Cloudflare
Workers no existe**, y evaluar un identificador no declarado lanza `ReferenceError`. Esto solo
afecta a los dos repos Next.js (`yo_soy_sanas`, `FPlibre`) y solo si una ruta que arrastre el
import corre en Edge. **No lo he ejecutado**, ver sección 6.

---

## 3. Veredicto sobre el trío Pencil + Hyperframes + Anime.js

Separo evidencia de juicio. Primero lo que es cada pieza.

### 3.1 Pencil

**Evidencia.** App Electron de `highagency`, canal de actualización `highagency/pen-desktop-releases`.
Lanzada en enero de 2026 según reseñas de practicantes, con adopción rápida. Ficheros `.pen`
cifrados, solo accesibles por sus tools, versionables en Git.

Superficie real, leída de los esquemas de sus 7 tools: `execute`, `get_app_state`, `get_guidelines`,
`get_screenshot`, `export_nodes`, `export_html`, `browser`. Las guías disponibles son ocho: `Code`,
`Design System`, `Landing Page`, `Mobile App`, `Slides`, `Table`, `Tailwind`, `Web App`. Los estilos,
veintiséis arquetipos.

Su guía `Code` dice, textualmente, *"Identify the frontend framework and language used in the
project (e.g., React, Vue, Angular, Svelte, etc.)"*, pero el flujo detallado del paso 2 se titula
**"React Component Creation"** y ordena *"Create `.tsx` file in `src/components/`"*. O sea: la guía
es agnóstica en el encabezado y **React en el procedimiento**.

En toda la guía `Code` no aparece la palabra animación, transición, ni duración una sola vez. La
documentación oficial tampoco: consultada `docs.pencil.dev/getting-started/ai-integration`, no
aborda animación, movimiento, transiciones ni prototipado interactivo.

**Juicio.** Pencil **sirve, y es la pieza más sólida del trío**, pero para pantallas estáticas.
Dos cosas lo salvan frente a Claude Design:

1. `export_html` produce HTML+Tailwind real que puedo leer, no un `.dc.html` con runtime propio y
   dependencias remotas que no vienen en la caja.
2. `browser` cierra el bucle de revisión contra **código vivo**: carga `localhost`, devuelve captura
   o DOM con estilos computados, e importa una página real al lienzo como capas editables. Eso es
   exactamente lo que echaste en falta de Claude Design.

Y lo que no hace, dicho sin rodeos: **no tiene línea de tiempo.** Ya que ese es el trabajo que
tienes delante, es un no pequeño en el sitio equivocado.

### 3.2 Hyperframes

**Evidencia.** `heygen-com/hyperframes`, Apache-2.0, creado el **10/03/2026**, 42.386 estrellas,
4.060 forks, 227 issues abiertos, último push el **24/08/2026** (datos de `gh api repos/...`, o sea
la API, no una reseña). Topics: `ai`, `animation`, `ffmpeg`, `framework`, `gsap`, `html`, `mcp`,
`puppeteer`, `rendering`, `typescript`, `video`.

Qué resuelve, del README: *"Write HTML. Render video. Built for agents."* Convierte composiciones
HTML/CSS con animación en **MP4 determinista**. Cadena de herramientas: Node 22 o superior, FFmpeg
para codificar, Chrome headless via Puppeteer para capturar fotogramas. Se usa por CLI
(`npx hyperframes init | preview | render`) o por un paquete de skills
(`npx skills add heygen-com/hyperframes`): 1 skill router, 9 flujos de creación y 10 de dominio.
Soporta GSAP, CSS, Lottie, Three.js, Anime.js y WAAPI por adaptadores.

**Juicio.** **Hyperframes no es una pieza de este workflow.** Resuelve un problema que no tienes:
sacar vídeo. Nada de lo que hace ayuda a diseñar ni a revisar una pantalla de "Nueva memoria".
La confusión es entendible, porque su topic dice `animation` y acepta Anime.js, pero la animación
ahí es **entrada de un render**, no comportamiento de una interfaz.

Sobre integración con Pencil: **ninguna**. La búsqueda en su README no encuentra mención a Pencil.
Sí menciona Claude Code y una guía de Claude Design.

Dicho lo cual, no es basura ni sobra del todo: el día que quieras un vídeo del visor para enseñar
GridWatch o Yogin a un cliente, esta es la herramienta. Pero eso es otro proyecto.

### 3.3 Anime.js

**Evidencia.** Versión actual **4.5.0**, licencia **MIT**, cero dependencias de producción
(`registry.npmjs.org/animejs/latest` y Bundlephobia). Repo `juliangarnier/anime`: 72.371 estrellas,
push el 21/08/2026, activo. `"type": "module"` con mapa `exports` dual (`import` a ESM, `require` a
CJS) y subrutas por módulo (`animejs/waapi`, `animejs/timer`, `animejs/svg`, `animejs/text`...).

**Tamaño, medido en disco, no citado.** Sobre `yo_soy_sanas/node_modules/animejs/dist/bundles/`,
con `gzip -9`:

| Bundle | Crudo | Gzip |
|---|---|---|
| `anime.esm.min.js` | 109.367 B | **37.186 B** |
| `anime.umd.min.js` | 108.796 B | **36.938 B** |

Bundlephobia da 116.758 B minificado y 40.279 B gzip para 4.5.0, coherente con lo medido para 4.3.6.

**La cifra de "17 KB" que circula por todas partes no tiene evidencia detrás para la librería
entera.** Aparece en `craft-ui/references/animation-guide.md:306` y en comparativas de practicantes.
Es plausible como coste de un import tree-shaken de dos o tres funciones, y probablemente de ahí
salió, pero se cita como si fuera el peso de la librería y no lo es: la librería completa pesa el
doble. Quien la use debe importar por subruta y medir su propio bundle.

**Juicio.** Anime.js es una librería buena, viva y con licencia limpia, y **no encaja en ninguno de
mis entornos por motivos que no son técnicos**:

- En **Naeth** entraría sin problema, pero el trabajo que hay no lo pide (ver 3.4).
- En **Yogin Website** ya conviven GSAP y framer-motion. Sería la tercera.
- En **GridWatch** ya está framer-motion. Sería la segunda.
- En **yo_soy_sanas** ya está y funciona: ahí no hay decisión que tomar.
- En **FPlibre** entraría limpia, pero FPlibre no tiene ningún requisito de animación hoy.

O sea: la pregunta "¿encaja Anime.js?" tiene respuesta afirmativa y **es irrelevante**, porque en
ningún entorno resuelve un problema abierto.

### 3.4 El veredicto

**El trío no sirve tal cual, y el motivo no es que las piezas sean malas: es que dos de las tres
resuelven problemas que no tengo, y la que sí sirve tiene el agujero justo donde está el trabajo.**

Desglose:

| Pieza | ¿Sirve? | Motivo |
|---|---|---|
| Pencil | **Sí, con reserva** | Es la mejor herramienta que tengo para componer y revisar pantallas estáticas, y su tool `browser` cierra el bucle contra código vivo. Pero no tiene línea de tiempo, y el encargo actual es un lenguaje de movimiento |
| Hyperframes | **No** | Es un renderizador de HTML a MP4. Ni diseña ni revisa interfaz. Cero integración con Pencil |
| Anime.js | **No hace falta** | Ni el visor lo pide ni los demás repos tienen el hueco. Y donde ya está (`yo_soy_sanas`), la decisión está tomada |

**La prueba de que el trío no aplica al encargo concreto** está en el propio handoff y verificada
contra el código. El `README.md` del handoff dice que el visor tiene "tres animaciones y ninguna
librería" y que el cambio "es CSS y cabe en unas quince líneas". Comprobado:

| Ruta y línea | Qué es | Duración |
|---|---|---|
| [`Sidebar.svelte:142`](../../naeth/web/src/components/Sidebar.svelte) | `transition: transform .12s` en el chevron del árbol | 120 ms |
| [`Sidebar.svelte:167`](../../naeth/web/src/components/Sidebar.svelte) | `transition: transform .22s ease` en el cajón móvil | 220 ms |
| [`Estado.svelte:169`](../../naeth/web/src/views/Estado.svelte) | `transition: width .4s ease` en la barra de embebidas | 400 ms |

Y cero ocurrencias de `prefers-reduced-motion` y cero de `--t-fast`/`--t-mid`/`--t-slow`/`--t-over`
en todo `naeth/web/src/`. O sea: el handoff no está aplicado, y aplicarlo son variables CSS.

**Discrepancia encontrada en el handoff:** el `README.md` atribuye duraciones también a
`Header.svelte`, pero `grep -n "transition\|animation"` sobre
`naeth/web/src/components/Header.svelte` no devuelve nada. Ese fichero no tiene animación hoy.

Meter una librería de 37 KB para escribir cuatro tokens CSS sería el error clásico que el propio
`craft-ui/references/animation-guide.md` prohíbe en su nivel 1: *"If the animation can be done with
CSS alone, do not use a library."*

---

## 4. Huecos y qué los tapa

Cuatro huecos reales, en orden de cuánto duelen.

### Hueco 1: no hay dónde especificar ni revisar movimiento

**El problema.** Un lenguaje de movimiento no se juzga leído: hay que verlo disparar, compararlo
lado a lado y alternar `reduced-motion` en vivo. Pencil no puede: no tiene tiempo. Un `.png` no
puede. Una tabla de duraciones en Markdown tampoco.

Claude Design **sí lo hizo** (el `.dc.html` trae comparador de tres duraciones, interruptor de
`reduced-motion` y A/B de rebasamiento sobre el desplegable real, con props declaradas en una
sección "Inspección"). Y lo entregó roto, sin el `_ds/`.

**Qué lo tapa, por orden de preferencia:**

1. **Un banco de pruebas HTML propio en el repo, servido por Vite y revisado con el navegador
   integrado.** Un fichero único, sin runtime ajeno, que importe el `app.css` real del visor y
   dispare los gestos con botones. Se abre con `mcp__pencil__browser` (`load-page` sobre
   `localhost` y luego `return-screenshot`) o con `mcp__Claude_Browser__` (`preview_start` con
   `.claude/launch.json`, luego `read_page` y `resize_window` para móvil y `colorScheme`).
   Coste: cero dependencias, y usa los tokens de verdad en vez de una copia.
2. **Publicarlo como Artifact** con la skill `artifact-design`, si además quieres enseñárselo a
   alguien. Coste: el fichero tiene que ser autocontenido.
3. **La skill `design`**, que es Claude Design dentro de Claude Code. La descarto por lo mismo que
   descartaste Claude Design, y porque el handoff que produjo llegó incompleto.

### Hueco 2: Pencil tira a React, y el visor es Svelte

**El problema.** Su guía `Code` ordena crear `.tsx` en `src/components/`. Naeth es Svelte 5 con
runas.

**Qué lo tapa.** El encabezado de la propia guía dice *"use the frontend frameworks that are already
used in the project"*, así que la corrección es una instrucción explícita en el prompt, no una
herramienta nueva. Si se repite, un `CLAUDE.md` en `naeth/web/` que fije Svelte 5 y Tailwind v4 lo
convierte en automático. Sin coste.

### Hueco 3: craft-ui apunta a un servidor que no existe

**El problema.** `SKILL.md:9` y `references/mcp-config.md:48` dan Open Design por core. No está
instalado. Y `mcp-config.md:17` describe una instalación de Pencil por VS Code que no es la mía.

**Qué lo tapa.** Editar `references/mcp-config.md`: quitar Open Design o degradarlo a opcional, y
corregir la ruta de Pencil a la app de escritorio. Es un fichero mío, en disco, de mi propiedad.
Coste: media hora. **No lo he tocado**, por la restricción de solo lectura de este encargo.

De paso, corregir el "17 KB" de `animation-guide.md:306` por el número medido.

### Hueco 4: no hay renderizado a vídeo

**El problema.** Ninguno, hoy.

**Qué lo tapa.** Hyperframes, el día que aparezca. Requiere Node 22, FFmpeg y Chrome headless.
Apuntado, no instalado.

---

## 5. Recomendación

> **Parcialmente superada por decisión de Eneko el 24/08/2026.** Se queda escrita tal cual, porque
> el valor de un discovery es que se vea qué se recomendó y qué se decidió. Lo decidido está en la
> sección 5 bis.

**Una: quédate con Pencil como único MCP de diseño, empareja su tool `browser` con un banco de
pruebas HTML dentro del repo, y no instales ni Hyperframes ni Anime.js.**

Concretamente, para el visor de Naeth:

1. El lenguaje de movimiento se aplica **en CSS**, con los cuatro tokens del handoff en `app.css`
   y `prefers-reduced-motion`. Sin librería.
2. El banco de pruebas es un HTML en el repo servido por el Vite que ya tienes, que importa el
   `app.css` real. Es la pieza que sustituye al `.dc.html` roto, y a diferencia de él no puede
   desincronizarse de los tokens: los usa.
3. Pencil entra para lo que sí sabe hacer: componer la pantalla estática de "Nueva memoria",
   exportarla con `export_html` para leerla, y revisar el resultado vivo con
   `browser`+`return-screenshot` contra `localhost`.
4. Si algún día un gesto del visor no cabe en CSS, la primera parada **no es Anime.js**: es
   `svelte/transition` y `svelte/motion`, que ya vienen con el framework y cuestan 0 KB extra.

**La razón.** Las tres piezas que hacen falta ya están pagadas: el criterio (craft-ui), el editor
de pantalla (Pencil) y el verificador contra código vivo (`browser` y el panel de navegador). Lo
único que falta es un fichero HTML que yo mismo escribo, y que además queda versionado junto al
código que describe. Añadir Anime.js mete 37 KB gzip y una cuarta librería de animación a un
ecosistema que ya tiene GSAP y framer-motion repartidos, para resolver algo que son cuatro
variables CSS. Añadir Hyperframes mete Node 22, FFmpeg y Puppeteer para producir un formato que
nadie ha pedido.

**Qué la tumbaría.** Cuatro cosas, en orden de probabilidad:

1. **Que el banco de pruebas HTML resulte tan costoso de mantener como el `.dc.html`.** Si en dos
   iteraciones veo que se desincroniza o que cuesta más que el cambio que verifica, la
   recomendación cae y hay que volver a una herramienta de prototipado con línea de tiempo.
2. **Que el visor pida movimiento que CSS no da.** Cronología encadenada, animación dirigida por
   scroll, morphing de SVG, o gesto de arrastre. En cuanto aparezca uno de esos, la respuesta
   sigue sin ser Anime.js: es **GSAP**, porque ya tienes las nueve skills oficiales en
   `skills-archive` y ya corre en Yogin. Desarchivarlas cuesta un `mv`.
3. **Que `mcp__pencil__browser` no dé la talla revisando.** Si al usarlo en serio contra
   `localhost` resulta que las capturas no bastan para juzgar, entonces el hueco 1 no está tapado
   y hay que reconsiderar Claude Design pese a la lentitud, o buscar otra cosa.
4. **Que necesites vídeo.** Entonces Hyperframes deja de ser una pieza sobrante y pasa a ser la
   respuesta, pero en su propio carril, no en este.

**Sobre OpenDesign.** No lo he investigado a fondo porque pediste no hacerlo salvo que la
investigación dijera lo contrario, y no lo dice: no hay ningún hueco que OpenDesign tape y Pencil
no. El dato que sí importa es que **craft-ui ya lo da por instalado y no lo está**, así que la
decisión que hay que tomar sobre OpenDesign no es si adoptarlo, sino borrarlo de la skill.

---

## 5 bis. Decisiones tomadas el 24/08/2026

Tras leer el informe, Eneko decide. Lo que sigue son sus decisiones, no mis conclusiones.

### Anime.js entra en Naeth

**Decisión:** adoptarlo en Naeth, como banco de prácticas.
**Razón dada:** quiere usarlo, sin más, y sobre todo lo quiere para **NewCo**, la empresa nueva
salida de la reunión con Ed. Da por hecho que habrá que rehacer entero el front de GridWatch, así
que aprender la librería en el proyecto propio y de bajo riesgo es preparación para el de verdad.

**Naeth es aquí el campo de pruebas, no el destino.** Eso cambia el criterio de éxito: lo que se
haga en el visor vale si enseña algo transferible, no si el visor lo necesitaba.

**Mi recomendación decía que no y queda superada.** El argumento que la sostenía sigue siendo
cierto (el visor no lo necesita hoy) pero no es el único criterio válido: aprender una librería en
el proyecto propio, de bajo riesgo, antes de necesitarla en el proyecto de cliente, es una razón
legítima y además barata. El coste real de equivocarse aquí es 37 KB en una SPA interna.

**Lo que hay que cuidar, y no es negociable si la decisión se mantiene:**

1. **El lenguaje de movimiento del handoff sigue siendo CSS.** Los cuatro tokens
   (`--t-fast`, `--t-mid`, `--t-slow`, `--t-over`) y `prefers-reduced-motion` van en `app.css`,
   no en JavaScript. Anime.js es para lo que se construya **encima**, no para reimplementar tres
   transiciones que ya funcionan. Si acaban conviviendo dos fuentes de duración, el lenguaje de
   movimiento deja de existir el día que diverjan.
2. **Patrón correcto en Svelte 5:** llamada dentro de `$effect`, devolviendo la limpieza desde el
   propio efecto. Nunca a nivel de módulo. A diferencia de `svelte/transition`, aquí el ciclo de
   vida no lo limpia nadie por ti.
3. **Guarda de `prefers-reduced-motion` antes de disparar**, igual que en
   `yo_soy_sanas/lib/animations.ts:14`. Ese fichero ya es un precedente bueno: copiarlo sale más
   barato que reinventarlo.
4. **Importar por subruta y medir.** Los 37 KB son la librería entera. Con
   `import { animate } from 'animejs'` el coste real depende del tree-shaking de Vite y **nadie lo
   ha medido todavía**.

**Nota sobre NewCo.** Es la empresa nueva salida de la reunión con Ed, no un componente del visor.
Lo confundí con una vista de Naeth en la primera versión de esta sección. **No sé qué stack va a
usar NewCo**, y eso importa: si acaba siendo React (que es lo que hay hoy en GridWatch, con
`framer-motion@12` ya dentro), la práctica con Anime.js transfiere pero compite con lo instalado;
si arranca en limpio, Anime.js entra sin deuda. Decidir el stack de NewCo antes de invertir mucho
en una librería concreta ahorra tener que repetir el aprendizaje.

### Hyperframes entra, pero en su propio carril

**Decisión:** testearlo para animación y vídeo de producto, y decidir entonces si se queda él o
partes de Claude Design.

**Esto no contradice el veredicto, lo precisa.** La sección 3.2 decía que Hyperframes no es una
pieza de **este** workflow, el de diseñar y revisar pantallas. Sigue siendo cierto. Lo que hay es
un segundo problema, el vídeo de producto, que en el encargo original no estaba nombrado y para el
que Hyperframes sí es la herramienta candidata. Con GridWatch y Yogin de por medio, tener con qué
enseñar un producto en movimiento no es un capricho.

**Para cuando se pruebe:** Node 22 o superior, FFmpeg y Chrome headless. Punto de entrada
`npx hyperframes init`, `preview`, `render`, o el paquete de skills
`npx skills add heygen-com/hyperframes`. Nada de esto está instalado hoy.

### craft-ui actualizada

**Decisión:** quitarle la parte muerta. Hecho el 24/08/2026 sobre
`C:\Users\eneki\.claude\skills\craft-ui\`. Detalle en la sección 5 ter.

---

## 5 ter. Qué se cambió en craft-ui

Cuatro ficheros tocados. `references/design-log.md` **no se tocó**: lo modificó otra sesión el
23/08 y no es parte de esto.

| Fichero | Cambio |
|---|---|
| `SKILL.md` | Fuera `mcp__open-design__*` de `allowed-tools`. La sección "Open Design (optional, not the engine)" sustituida por "Real tooling on this machine", que dice qué hay instalado de verdad, que Pencil exige la app abierta, y qué hacen `export_html` y `browser`. Quitadas las ramas condicionales de Open Design en las fases 1, 2, 3 y 4 y en "Design DNA persistence". Tabla de disponibilidad MCP rehecha. "Companion skills" corregida: gsap-skills ya está en disco, archivada |
| `references/mcp-config.md` | Reescrito. Antes documentaba "2 core + 2 optional"; ahora documenta el único que existe. Ruta de Pencil corregida de extensión de VS Code a app de escritorio, con el `args` real (`--app desktop`). Añadidos el requisito de app abierta, la tabla de las 7 tools y los tres límites (sin línea de tiempo, scripts generativos, guía `Code` sesgada a React). Tabla explícita de qué se quitó y por qué |
| `references/animation-guide.md` | Nuevo bloque que separa cifras **medidas** de cifras **de fabricante**, y marca como tales las de Motion y GSAP. Nuevo "Level 0: the framework you already have". Sección propia de Anime.js con los 37 KB medidos, las guardas SSR con fichero y línea, el aviso de `setImmediate` en Edge y los patrones de Next y Svelte 5. Sección nueva sobre dónde se especifica un lenguaje de movimiento. Corregido el "17 KB". Puntero a gsap-skills corregido: están en `skills-archive`, no hay que reinstalarlas |
| `templates/DESIGN.template.md` | Quitada la instrucción de "set it as the active design system in Open Design" |

**Lo que sigue sin verificar en craft-ui:** los 4,6 KB de Motion y los 23 KB de GSAP están ahora
marcados como cifra de fabricante, pero no los he medido. Y `references/component-catalog.md`
menciona ReactBits y Magic UI, que no he comprobado si siguen vivos.

---

## 6. Qué no he podido comprobar

1. **El `ReferenceError` de `setImmediate` en Edge Runtime.** He leído el código
   (`engine/engine.js:27`) y el razonamiento se sostiene, pero **no he ejecutado nada** en Vercel
   Edge ni en Cloudflare Workers. Es riesgo identificado por lectura, no fallo reproducido. Y ni
   `yo_soy_sanas` ni `FPlibre` declaran hoy `runtime = 'edge'` en ninguna ruta que yo haya
   comprobado, porque no lo he buscado.

2. **Cuánto pesa Anime.js tree-shaken de verdad.** Los 37 KB gzip son el bundle completo, medido.
   Lo que costaría un `import { animate, stagger } from 'animejs'` pasado por Vite o Turbopack no
   lo he medido: haría falta construir, y este encargo era de solo lectura.

3. **El contenido de las skills built-in.** `design`, `dataviz`, `artifact-*` y las de
   `anthropic-skills:` van embebidas en `claude.exe`. Lo que digo de ellas sale de la descripción
   que expone el sistema, no de haber leído su `SKILL.md`, porque no existe como fichero.

4. **Las guías de Pencil que no cargué.** Consulté el listado completo (8 guías, 26 estilos) y leí
   entera la guía `Code`. `Design System`, `Web App`, `Tailwind`, `Mobile App`, `Slides`, `Table` y
   `Landing Page` no las he abierto. Es posible que alguna mencione movimiento; lo que sí está
   verificado es que ni `Code` ni la documentación oficial de integración lo hacen.

5. **Si `_audit-admin-dashboard` es un entorno vivo.** Su `package.json` es idéntico al de
   `Yogin-Website` (mismo `name`, misma `version` 2.5.0). El prefijo `_audit` sugiere copia
   congelada, pero eso es leer el nombre del directorio, no comprobarlo. Lo he contado como
   entorno separado por prudencia.

6. **Si Pencil puede animar por algún camino que no vi.** He inspeccionado los esquemas de sus 7
   tools y el bloque de scripts y shaders que devuelve `get_app_state`. La app tiene interfaz
   propia que no he abierto. Podría haber capacidades no expuestas por MCP.

7. **Hyperframes en ejecución.** Todo lo que digo sale de la API de GitHub y de su `README.md`.
   No lo he instalado ni renderizado nada, según la restricción.

8. **Si Claude Design entrega siempre incompleto o fue este caso.** He verificado que **este**
   handoff no trae el `_ds/` que su `.dc.html` referencia. Un caso no es un patrón.

---

## Fuentes

**Oficiales (documentación, repositorio o registro):**

- [registry.npmjs.org/animejs/latest](https://registry.npmjs.org/animejs/latest): versión 4.5.0, licencia MIT, `type: module`, mapa `exports` dual, `unpackedSize` 2.126.307 B, 215 ficheros.
- [github.com/juliangarnier/anime](https://github.com/juliangarnier/anime): via `gh api`, 72.371 estrellas, MIT, último push 21/08/2026.
- [animejs.com/documentation/getting-started/installation/](https://animejs.com/documentation/getting-started/installation/): formatos ESM, CommonJS y UMD.
- [github.com/heygen-com/hyperframes](https://github.com/heygen-com/hyperframes): via `gh api`, Apache-2.0, creado 10/03/2026, 42.386 estrellas, 4.060 forks, push 24/08/2026.
- [README de Hyperframes](https://raw.githubusercontent.com/heygen-com/hyperframes/main/README.md): Node 22+, FFmpeg, Puppeteer; CLI y paquete de skills; adaptadores para GSAP, CSS, Lottie, Three.js, Anime.js y WAAPI.
- [docs.pencil.dev/getting-started/ai-integration](https://docs.pencil.dev/getting-started/ai-integration): integración MCP; no aborda animación ni prototipado interactivo.
- [motion.dev/docs/react-lazy-motion](https://motion.dev/docs/react-lazy-motion): tamaños de Motion.
- [github.com/sveltejs/svelte/discussions/17360](https://github.com/sveltejs/svelte/discussions/17360): discusión oficial sobre librerías de animación en Svelte.

**Medición propia (comandos en esta sesión, 24/08/2026):**

- `gzip -9` sobre `yo_soy_sanas/node_modules/animejs/dist/bundles/`: ESM min 109.367 B crudo, 37.186 B gzip.
- Lectura de guardas de entorno en `animejs/dist/modules/core/consts.js`, `globals.js`, `targets.js` y `engine/engine.js`.
- Esquemas de las 7 tools de `mcp__pencil__*` y salida de `get_guidelines()` y `get_app_state()`.

**Benchmark de terceros:**

- [bundlephobia.com/package/animejs](https://bundlephobia.com/package/animejs): 4.5.0, 116.758 B minificado, 40.279 B gzip, 0 dependencias.

**Opinión de practicante (marcada como tal, no como evidencia):**

- [gsapvault.com/blog/gsap-vs-animejs-vs-motion](https://gsapvault.com/blog/gsap-vs-animejs-vs-motion): comparativa; **sesgo declarado**, es un sitio dedicado a GSAP. De ahí sale la cifra de "17 KB" para Anime.js que esta investigación contradice con medición directa.
- [blog.logrocket.com/best-react-animation-libraries](https://blog.logrocket.com/best-react-animation-libraries/): panorámica 2026.
- [designwithai.substack.com/p/exploring-pencildev-walkthrough-and-impressions](https://designwithai.substack.com/p/exploring-pencildev-walkthrough-and-impressions): reseña de Pencil.
- [jeradbitner.com/2026/04/designing-with-pencil-and-claude-code/](https://jeradbitner.com/2026/04/designing-with-pencil-and-claude-code/): flujo Pencil + Claude Code.

**Práctica extendida sin evidencia detrás, señalada:** la cifra de "17 KB" para Anime.js circula por
comparativas y está copiada en `craft-ui/references/animation-guide.md:306`. Ninguna fuente la
acompaña de una medición. Medido aquí: 37 KB gzip la librería entera.
