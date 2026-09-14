# Brief de discovery: la vista CDA diseñada en Pencil, con animaciones propias

**Fecha**: lunes 14/09/2026, 20:50. **Estado**: brief escrito, discovery sin empezar.
**Para quién**: la sesión que arranque la discovery, con Pen.exe abierto y el navegador. Se escribe
como los prompts de Eneko (contexto, tarea, restricciones, qué investigar, entregable, criterio),
para que la investigación no empiece abierta.
**Cuándo**: después del visor de la sub-fase 2b (renombrar `pintor`, `sim`, `Lienzo` antes de
diseñar encima evita hacerlo dos veces), y antes de la sub-fase 7. No depende de las sub-fases 4 a
6: el diseño se hace con bloques de `naeth/app` de mentira.

## Contexto

Eneko dijo el 14/09 a las 20:29: "las vistas de CDA las quiero hacer de una manera especial
(Pencil) más animaciones custom (hay que investigar cómo hacer esto)". Hasta entonces la sub-fase 7
del plan (`docs/plan/biblioteca-codigo-fase2-2026-09-10.md:290`) era "otra vista del visor": la
biblioteca `#/cda`, la ficha de un bloque y los bloques en el grafo. Ahora tiene diseño propio, y el
diseño va antes del código.

Lo que ya hay, y no se reabre:

- **La discovery de diseño y animación del 24/08**, `docs/discovery/stack-diseno-animacion.md`.
  Pencil sirve para pantallas estáticas: exporta PNG, JPEG, WEBP, PDF y HTML con Tailwind o con CSS
  (`export_html`), tiene 8 guías y 26 arquetipos de estilo, y **no tiene línea de tiempo ni
  estados** (`:83`, `:188-191`); su MCP exige tener `Pen.exe` abierto (`:88-92`). **Anime.js entra en
  Naeth como banco de prácticas**, decidido por Eneko pensando en NewCo (`:419-436`), con cuatro
  condiciones no negociables (`:438-453`): CSS sigue siendo el lenguaje de movimiento; la llamada va
  dentro de `$effect` en Svelte 5; guarda de `prefers-reduced-motion`; importar por subruta y medir
  el tamaño. Hyperframes quedó "en su propio carril" para vídeo (`:462-465`) y el 14/09 se probó:
  renderiza, pero la vía de vídeo elegida es Remotion (`docs/discovery/cda-videos-2026-09-14.md`, §7).
- **El visor**: Vite + Svelte 5.56 + TypeScript + Tailwind v4.3 (`naeth/web/package.json`). Vistas
  en `naeth/web/src/views/` (`Inicio`, `Grafo`, `Nueva`, `Estado`, `Ajustes`, `Memoria`, `Stub`, y
  `graph/Lienzo.svelte` con `graph/Panel.svelte`); router por hash en `src/lib/router.svelte.ts`
  (`#/m/<id>`, `#/grafo/<id>`); el grafo tiene motor propio sobre canvas y d3-force (`src/lib/sim.ts`,
  `src/lib/pintor.ts`, `src/lib/pintor-canvas.ts`) y un mapa de posiciones compartido con el mini
  grafo de la ficha (`src/lib/mapa.svelte.ts`). Preferencias en `localStorage` (`prefs.svelte.ts`,
  `prefs-grafo.svelte.ts`). Tema claro y oscuro (`theme.svelte.ts`). Suite propia: `npm test && npm
  run check && npm run build`; ni `check` ni `build` ejecutan la aplicación, así que lo visual se
  verifica en el navegador (`naeth/web/README.md`). **Anime.js no está instalado**
  (`grep animejs naeth/web/package.json` → nada, 14/09).
- **La skill `craft-ui`** (`~/.claude/skills/craft-ui`, con `references/` y `templates/`), actualizada
  el 24/08 para quitarle la parte muerta (`stack-diseno-animacion.md:477-498`).
- **Los datos que la vista tendrá**, según el modelo del plan (§1): por bloque, `symbol`, `kind`,
  `signature`, `lineno` y `endlineno`, `doc` con `Notes:`, `source`, `commit`, `content_hash`,
  `is_current`; anotaciones (`important`, `summary`, `note`, `link`, `script`); aristas
  `code_edge` (`calls`, `imports`) entre bloques; y la relación bloque a nota de prosa por
  `code_annotation.memory_id`. Hoy son 131 símbolos Python; con Yogin y GridWatch, cientos.
- **Los vídeos** comparten materia con la vista: el guion (`script`), el resaltado por líneas, el
  código en pantalla. Se decidió el 14/09 que el vídeo tiene que "sentirse bien" y costar 0; el
  render es Remotion con Code Hike.

## Tarea

Investigar cómo diseñar la vista CDA en Pencil y llevarla al visor con animaciones propias, y
devolver varias vías con medidas, no una. Antes de escribir, mirar qué hay en el repo y en la skill
`craft-ui`, y hacer una pantalla real, no un mockup en el aire.

## Restricciones

- Solo lectura sobre el repo salvo el entregable y, si se hace la prueba, un componente detrás de
  una ruta oculta que se borra o se deja marcado como prueba. Nada se despliega.
- Cada afirmación sobre el repo o la máquina lleva ruta y línea o el comando. Las negativas llevan
  la búsqueda.
- Cada herramienta que se proponga (Anime.js, Motion, Svelte `transition:`, Shiki, Code Hike en
  el navegador, lo que salga) va con fuente primaria, versión y licencia comprobadas en 2026, estado
  del proyecto, y tamaño en disco medido si entra en el bundle.
- Las cuatro condiciones de Anime.js del 24/08 son restricciones, no opciones: cualquier animación
  propuesta se contrasta contra ellas y se dice cuál rompe.
- Lo que no se sepa por qué se decidió, se declara sin registro.
- Nada de em dash.

## Qué investigar

1. **Pencil → Svelte 5 + Tailwind v4, el camino.** Diseñar en Pencil la ficha de un bloque real
   (`memory_search`, `naeth/app/mcp_server.py:384-443`, que es el ejemplo canónico 5.3 de la guía y
   el bloque del vídeo del 14/09) y medir tres caminos: (a) `export_html` con Tailwind y transcribir
   a un `.svelte`, contando minutos y líneas tocadas; (b) exportar PNG y escribir el componente a
   mano mirando la imagen; (c) usar el HTML exportado tal cual dentro de un `{@html}` como prueba de
   fidelidad, aunque no sea la vía. Qué se pierde en cada uno: tema oscuro, tokens de color del
   visor (`src/lib/colors.ts`), tipografía monoespaciada del código, iconos (`src/lib/icons.ts`).
2. **Qué animaciones son "propias" en CDA**, una lista corta con el porqué de cada una: entrar a
   un bloque desde la biblioteca; desplegar y plegar el `Notes:`; seguir una arista `calls` hasta el
   otro bloque (¿el código del destino aparece al lado, o se navega?); el resaltado de líneas al
   pasar por una anotación; el mini grafo de vecinos, que ya existe para notas. Para cada una, qué
   basta: CSS puro, `transition:` y `animate:` de Svelte 5, o Anime.js. Si Anime.js no hace falta en
   ninguna, decirlo: "banco de prácticas" no obliga a meterlo donde sobra.
3. **La sincronía entre vista y vídeo.** Si el mismo diseño de Pencil sirve de plantilla del vídeo
   (Remotion con Code Hike): qué tokens se comparten (tema, fuente, color del resaltado, tamaño de
   línea) y cómo se expresan una sola vez (variables CSS en el visor y en la composición). Y si
   `Code Hike` o `@shikijs/magic-move` pueden pintar también el código en la vista, para que el
   resaltado por tokens sea el mismo en pantalla y en el MP4 (aviso del 14/09: magic move anima por
   CSS, que en Remotion parpadea; en el visor no).
4. **El código en pantalla.** Cómo se resalta la sintaxis en la vista hoy (`src/lib/md.ts` pinta
   Markdown de las notas; ¿resalta bloques de código? ¿con qué?), y qué pide CDA: Python, JS y TS
   con números de línea absolutos (`lineno`), resaltado de un rango, y enlaces desde el `Notes:` a
   la línea. Shiki (MIT) frente a lo que haya; tamaño del bundle si entra con gramáticas.
5. **Qué hay en la máquina y en la skill que sirva**: Pen.exe 1.2.8 y su MCP (tools `execute`,
   `get_app_state`, `get_style`, `read_skill`, `browser`), los arquetipos de estilo de Pencil que
   encajen con un lector de código, las plantillas de `craft-ui`, y lo que la discovery del 24/08
   dejó apuntado como no comprobado (`stack-diseno-animacion.md:502-537`).

## Entregable

`docs/discovery/cda-vista-diseno-<fecha>.md`, con estas secciones en este orden:

1. Qué existe ya (repo, skill, decisiones del 24/08) que sirve, con ruta.
2. La pantalla de prueba: el `.pen` de la ficha de `memory_search` (en `docs/design/` o donde diga
   Eneko), la exportación, y el componente de prueba integrado detrás de una ruta oculta, con
   captura en tema claro y oscuro.
3. Las vías de Pencil a Svelte, con minutos y líneas medidas, y lo que cada una pierde.
4. La lista de animaciones propias, cada una con la herramienta mínima que la resuelve, medida
   contra las cuatro condiciones del 24/08, y una implementada de verdad en la prueba.
5. Lo que la vista y el vídeo comparten, y cómo se escribe una sola vez.
6. El resaltado de código: herramienta, tamaño, y si sirve para los dos.
7. Recomendación, con qué la invalidaría, y las horas hasta la vista completa sobre datos reales
   (sub-fase 7), con la base de la estimación.
8. Decisiones que tiene que tomar Eneko antes de la sub-fase 7.

## Criterio de éxito

Que con el documento se pueda decidir la sub-fase 7 sin más preguntas, y que exista una pantalla
real en el visor, aunque sea detrás de una ruta oculta, que Eneko haya visto y sobre la que haya
dicho si "se siente bien". Los números medidos van antes que la prosa; lo comprobado lleva fecha.

## Respuestas de Eneko (14/09/2026, 20:52, dos rondas de AskUser)

Las cinco preguntas que este brief traía quedaron cerradas la misma noche, "ahora que es barato":

1. **Se diseña primero la ficha de un bloque**, con `memory_search`. La biblioteca (lista con
   búsqueda) va después y hereda el estilo.
2. **Un solo lenguaje visual para la vista y los vídeos**: los mismos tokens (tema, tipografía del
   código, color del resaltado) en el visor y en la plantilla de Remotion, escritos una sola vez.
   Un vídeo tiene que parecer un trozo de Naeth. Esto ata la sub-fase 6b a esta discovery: la
   plantilla del vídeo sale del mismo `.pen`.
3. **Anime.js entra: al menos una animación real de CDA se hace con Anime.js** aunque Svelte
   pudiera, cumpliendo las cuatro condiciones del 24/08. Es el banco de prácticas para NewCo,
   decidido entonces y confirmado ahora. Las demás animaciones, con la herramienta mínima.
4. **Los `.pen` viven en el repo, en `docs/design/`**, versionados con el código.
5. **Referencia visual: ninguna, a propósito.** Textual: "algo completamente distinto o en la
   línea, quiero ser totalmente creativo y probar cosas / estéticas nuevas". Consecuencia para quien
   diseñe: no partir del visor actual ni de un arquetipo por defecto; presentar dos o tres
   propuestas opuestas entre sí (por ejemplo editorial, terminal, lámina de estudio, o lo que los
   26 arquetipos de Pencil sugieran) con la ficha real montada en cada una, y que Eneko elija
   viendo. La vista CDA puede romper con el resto del visor; si gusta, es el resto del visor el que
   se acerca después.

## Lo que este brief deja fuera, a propósito

El extractor, las tablas y las tools (sub-fases 4 a 6): la vista se diseña con datos de mentira y
se conecta después. La vista `#/cda` sobre datos reales (sub-fase 7): sale de esta discovery. Los
vídeos (sub-fase 6b): comparten diseño, no se construyen aquí. El móvil: "el grafo funciona fatal
en el móvil" (08/09) sigue sin diagnosticar y la vista nueva no debería heredar el problema, pero
eso es otra investigación.
