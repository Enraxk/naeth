# DNA visual del visor de Naeth

Extracto de las convenciones de diseño del visor v2, sacadas del código vivo
(`src/app.css`, los bloques `<style>` de los componentes y `src/lib/colors.ts`) el 23/08/2026.

**Para qué sirve este fichero.** Para pegárselo a un agente de diseño (Claude Design, una sesión de
craft-ui, quien sea) que tenga que producir algo con el aspecto de Naeth sin tener el repo delante.
Todo lo que aparece aquí existe en el código: los nombres de token, las clases, los tamaños y los
contrastes están verificados contra los ficheros, no reconstruidos de memoria.

**Lo que NO es.** No es un sistema de diseño empaquetado. El visor es una aplicación Svelte 5 con
componentes internos, sin superficie de librería (`package.json` lleva `"private": true` y no
exporta nada). No se puede sincronizar a claude.ai/design, que solo consume componentes React.

---

## 1. La dirección: "Terminal × Notion"

Así se nombra en `src/app.css:3`, y el reparto es literal:

- **Mono para el chrome.** Cabecera, sidebar, breadcrumbs, footer, rail, metadatos, cifras. Todo lo
  que es instrumento del visor va en `var(--font-mono)`, entre 10px y 13px.
- **Sans para el contenido.** El cuerpo de la memoria, los títulos y la prosa van en
  `var(--font-sans)`, a 13-14px con interlineado holgado (1.5 de base, 1.65 en la nota).

El efecto buscado: la aplicación se lee como una terminal (densa, monoespaciada, de superficie
plana) y el contenido dentro de ella se lee como un documento.

---

## 2. Tokens

Viven como custom properties en `:root` y cambian con `[data-theme="light"]`. `@theme` de Tailwind
los reexpone como utilidades, pero ver el punto 3 antes de usarlas.

| Token | Oscuro (por defecto) | Claro | Para qué |
|---|---|---|---|
| `--bg` | `#1e2022` | `#f7f7f5` | fondo base, lienzo del detalle |
| `--bg2` | `#191b1d` | `#efefec` | superficie **hundida**: sidebar, rail, barra del editor |
| `--panel` | `#282a2d` | `#ffffff` | superficie **levantada**: header, footer, tiles, popovers |
| `--border` | `#363a3e` | `#e3e3df` | todos los filetes, siempre 1px |
| `--ink` | `#e6e8eb` | `#1f2329` | texto principal |
| `--dim` | `#8a929e` | `#646d79` | texto secundario, iconos del chrome |
| `--accent` | `#5db0ff` | `#2563eb` | foco, selección, enlaces, barras de datos |
| `--sel` | `color-mix(in srgb, #5db0ff 10%, #191b1d)` | `color-mix(in srgb, #2563eb 10%, #efefec)` | fondo de fila activa y hover de lista |
| `--ok` | `#46c98b` | `#15803d` | estado sano |
| `--warn` | `#e0a64b` | `#b45309` | aviso |
| `--code` | `#e0a64b` | `#92400e` | código inline |
| `--font-mono` | `ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace` | igual | chrome |
| `--font-sans` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | igual | contenido |

**La jerarquía de superficies es de tres niveles y hay que respetarla**: `bg2` hundido, `bg` neutro,
`panel` levantado. No es decorativo, es lo que separa el instrumento del contenido sin usar sombras.

Hay tres decisiones ya tomadas y documentadas en el propio CSS que **no** conviene deshacer:

1. `--code` existe aparte de `--warn` porque sobre el fondo compuesto del tema claro `--warn` daba
   4.49:1, a una centésima del 4.5:1 de WCAG AA. `--code` queda en 6.33:1 (`src/app.css:44-47`).
2. `--dim` en claro es `#646d79` y no `#6b7280` porque el segundo se quedaba en 4.20 sobre
   `--bg2`, que es justo donde más vive (`src/app.css:52-55`).
3. `--sel` se calcula con `color-mix` sobre los **literales** de `--accent` y `--bg2`, no sobre las
   variables. Con variables dentro, Lightning CSS no resuelve el mix en build y se inventa un
   fallback cogiendo un operando suelto, o sea la fila seleccionada a plena saturación con el texto
   encima. El precio es que si cambian `--accent` o `--bg2` hay que tocar los literales también
   (`src/app.css:31-43`).

---

## 3. El idioma de estilo: CSS scoped, no utilidades

Esto es lo que más fácil se equivoca al ver "Tailwind v4" en el stack.

**El markup del visor no usa ni una sola utilidad Tailwind.** Las clases son semánticas y propias
(`est-tile`, `rail-item`, `bar-track`, `crumb`, `wikipop`), y su estilo vive en un bloque `<style>`
scoped dentro de cada componente: lo tienen los 11 componentes y vistas que pintan algo, todos menos
`Icon.svelte`. El color se aplica siempre con `var(--token)` a pelo.

Las utilidades sí existen: el bloque `@theme` de `src/app.css:6-20` genera `bg-bg`, `text-ink`,
`bg-panel`, `border-border`, `text-ok` y compañía. Pero el único sitio del repo donde aparecen
escritas es el comentario que las anuncia, en `src/app.css:5`. En código real: cero usos.

Para un agente que produzca pantallas nuevas eso significa: **escribe CSS con `var(--token)`**, no
utilidades. Si de verdad prefieres utilidades, están disponibles y funcionan, pero divergen de todo
lo demás del visor.

---

## 4. Tipografía

Se declara casi siempre con el shorthand `font:`, no con `font-size` suelto. La escala real, por
frecuencia de uso:

| Declaración | Dónde |
|---|---|
| `font: 11px var(--font-mono)` | footer, etiquetas, metadatos densos (el más usado) |
| `font: 12px var(--font-mono)` | breadcrumbs, filas de sidebar |
| `font: 10px var(--font-mono)` | cifras de gráfico, texto auxiliar |
| `font: 13px var(--font-sans)` | contenido corriente |
| `font: 13px var(--font-mono)` | rutas, identificadores |
| `font: 14px/1.5 var(--font-sans)` | base del `body` |
| `font: 14px/1.65 var(--font-sans)` | cuerpo de la memoria |
| `font: 600 <18-30>px var(--font-sans)` | títulos de prosa |
| `font: 600 <12-26>px var(--font-mono)` | cifras destacadas de las tiles de estado |

**Solo hay un peso además del normal: `600`.** No hay 500 ni 700 en ninguna parte. Y ojo al reparto:
el título de una memoria va en sans, pero el número grande de una tile va en **mono**, porque sigue
siendo instrumento y no prosa.

---

## 5. Forma

- **Radios.** `6px` es el radio por defecto (15 usos), `8px` para superficies mayores como popovers
  y barra del editor (8), `10px` para tiles y gráficos (3), `4px` para cosas pequeñas y el foco (4),
  `99px` para píldoras y barras de progreso (4), `50%` para puntos de estado (2).
- **Bordes.** Siempre `1px solid var(--border)`. No hay bordes de 2px salvo el
  `inset 2px 0 0 var(--accent)` que marca la fila seleccionada en la sidebar.
- **Sombras.** Solo cinco en toda la aplicación, y todas en cosas que flotan: los tres popovers
  (`Header.svelte:125`, `Memoria.svelte:531` y `:552`), el cajón móvil (`Sidebar.svelte:167`) y el
  popover de `Nueva.svelte:377`. Sumando el backdrop del cajón, esos seis son **los únicos `rgba()`
  del producto**: no hay transparencias, ni blur, ni cristal esmerilado en ninguna otra parte. La
  profundidad se comunica con la escala de superficies del punto 2, no con sombra.
- **Foco.** Global y no negociable: `:focus-visible { outline: 2px solid var(--accent);
  outline-offset: 2px; border-radius: 4px; }` (`src/app.css`).
- **Transiciones.** Cortas y contadas: `.12s`, `.22s`, `.4s`, siempre `ease`. Tres en toda la
  aplicación. No hay cultura de animación aquí.
- **Espaciado.** No hay escala formal declarada. Los valores reales que se repiten: padding
  `6-10px 16px` en las barras del chrome, `15-16px 16-18px` en tiles, `40-48px 48-56px` en el
  contenido de las vistas; `gap` entre 4px y 16px. Si añades algo, cíñete a esos rangos en vez de
  inventar una escala nueva.

---

## 6. Estados de interacción

Hay dos gramáticas de hover y no se mezclan.

**Fila** (árbol, rail, lista, outline, breadcrumb, botón de barra): un lavado de tinta sobre el
fondo, `color-mix(in srgb, var(--ink) 6%, transparent)`. Hay tres intensidades en uso, 6% (cinco
veces), 7% (una) y 8% (tres). El borde no cambia nunca.

**Control con borde** (`.btn`, `.iconbtn`, `.edit-btn`, `.hamb`, `.sortbtn`): la etiqueta pasa de
`--dim` a `--ink` y el borde de `--border` a `--accent`. **El fondo no cambia.** Los cinco lo hacen
igual, sin excepción.

El resto de estados:

| Estado | Qué hace |
|---|---|
| Fila seleccionada | `background: var(--sel)` más `box-shadow: inset 2px 0 0 var(--accent)` |
| Input enfocado | `border-color: var(--accent)` |
| Navegación activa en el rail | el glifo se vuelve `--accent`, sin fondo |
| Wordmark en hover | pasa a `--accent` |
| Deshabilitado | `opacity: .6`, y nada más |

**No hay estado de pulsación.** Cero `transform: scale()` en toda la aplicación, cero bajadas de
opacidad al pulsar. Un control responde al hover y al foco, y ya.

---

## 7. Layout

El armazón está en `src/App.svelte`: columna vertical `Header / body / Footer`, y el `body` es un
grid de tres columnas `var(--side-w) 1fr 48px`, o sea sidebar redimensionable, centro y rail fijo de
48px. Los items del rail son cuadrados de 40x40 con radio 8px.

Anchos de lectura tope: 760px la nota, 1080px la nota en edición, 880px el inicio, 1400px el estado.

Breakpoints usados, todos `max-width`: `1000px`, `860px` (la sidebar pasa a cajón con backdrop),
`600px`, `460px`. Más `(pointer: coarse)` en dos sitios para el táctil.

---

## 8. El color como significado

Fuera de los tokens, **el color solo se usa para codificar significado, y solo en iconos**
(`src/lib/colors.ts`). Nunca hay fondos de colores ni texto teñido para decorar.

Dos mapas, cada entrada con su icono lucide y un par `[oscuro, claro]`:

- **Tipo de memoria** (hoja del árbol): `fact` teal, `observation` ámbar, `decision` violeta,
  `preference` rosa, `learning` verde, `error` rojo.
- **Proyecto** (carpeta): 14 proyectos con icono y color propios, `folder` gris de fallback.

Los pares existen porque el mismo color no pasa contraste en los dos temas: el verde `#16a34a` se
quedaba en 2.86:1 sobre la sidebar, bajo el 3:1 que piden los elementos gráficos, y por eso en claro
es `#15803d`. Si añades una categoría, mide los dos temas.

Los iconos son paths de lucide inline en `src/lib/icons.ts`, sin dependencia de runtime.

---

## 9. Iconografía y símbolos

**Un solo sistema: lucide, como paths SVG inline, sin nada que cargar.** El mapa vive en
`src/lib/icons.ts` y lo pinta un `Icon.svelte` de cinco líneas con `size = 14` por defecto. Ni CDN,
ni fuente de iconos, ni sprite.

Tamaños realmente en uso, medidos sobre el markup: **13** (chrome, filas del árbol, breadcrumbs) y
**15** (barra del editor) son los dos habituales con 21 y 22 usos; luego **20** (rail, 3 usos), y uno
solo de **12** (salud en el footer), **18** (hamburguesa) y **40** (estado vacío). El color es
`currentColor`, `var(--dim)` o un token de significado.

El mapa es deliberadamente corto. Cuando `ORIGIN_ICON` quedó obsoleto, sus dos iconos huérfanos se
borraron en vez de conservarse, y el mapa de proyectos se dejó en 14 en lugar de crecer a los 46
subtemas vivos, porque eso "sería inventar una taxonomía visual que nadie ha pedido"
(`src/lib/icons.ts`). Añade un icono cuando algo lo necesite, sacado de lucide con stroke 2.

**No hay logo.** No existe marca, favicon ni asset de identidad en ninguna parte. Donde iría una
marca se escribe la palabra: `.wordmark { font: 600 15px var(--font-mono); letter-spacing: 1.5px; }`.
`NAETH` es el único literal en mayúsculas del producto. No dibujes un logo.

Los símbolos Unicode se usan como símbolos, no como iconos, y son estos y solo estos:

| Símbolo | Usos | Para qué |
|---|---|---|
| `·` | 97 | separador universal |
| `…` | 11 | trabajo en curso, siempre el carácter único |
| `⚠` | 3 | aviso en prosa |
| `●` | 2 | estado sin guardar |
| `×` | 2 | quitar un chip |
| `→` `←` | 1 y 1 | dirección de una relación |

**Cero emoji en el código del visor**, verificado. La única aparición de emoji en el producto es el
selector del editor, que los inserta en *contenido del usuario*: el producto nunca los usa por su
cuenta.

---

## 10. Cómo habla el producto

El idioma de la interfaz es español. Los valores de esquema no se traducen (`fact`, `observation`,
`decision`, `preference`, `links_to`), y los identificadores, rutas y nombres de herramienta siguen
en inglés.

**La ausencia se declara, no se deja en blanco.** Un valor que falta se escribe entre paréntesis:
`(sin path)` con 14 usos, `(sin título)` con 7, `(memoria)` con 2. Una colección vacía se dice con
una frase normal.

**Los puntos suspensivos marcan trabajo en curso**, siempre con el carácter `…` y nunca con tres
puntos: `Guardando…`, `cargando…`, `añadir tag…`, `buscar memoria…`.

**Cero exclamaciones en el copy.** Un error dice qué ha pasado y, si puede, qué comprobar. Sin
disculpas, sin "algo ha ido mal", sin "¡Vaya!".

**Cero em dash en todo el código del visor**, verificado. La puntuación es coma, dos puntos,
paréntesis o punto.

---

## 11. La segunda superficie: los documentos

Naeth tiene **dos** superficies visuales, y este documento describe sobre todo la primera. La otra
son los informes de diseño en `pasos/`, 17 HTML que suman 646 KB.

Es una paleta deliberadamente distinta y **no se mezclan**: papel blanco, acento verde
`oklch(48% 0.16 145)`, escala en oklch con nombres propios (`--bg-elev`, `--ink-soft`, `--rule`,
`--acc`), tipografía fluida con `clamp()` y, esto sí, webfonts de verdad: `--sans: "Inter",
system-ui, sans-serif` y `--mono: "JetBrains Mono", ui-monospace, monospace`, cargadas desde el CDN
de Google Fonts. Los cuatro pesos (400, 500, 600, 700) se usan de verdad.

Los 17 documentos repiten ese mismo bloque de tokens copiado y pegado, uno a uno. Si algún día se
factoriza, el sitio es una hoja compartida bajo un scope propio, no `:root`, para que las dos
superficies puedan convivir en una misma página.

---

## 12. Snippet idiomático

La tile de estado, copiada de `src/views/Estado.svelte:139-143` porque condensa todo el idioma
(clase semántica, `<style>` scoped, tokens, mono para la cifra, etiqueta en versalitas):

```svelte
<div class="est-tile">
  <span class="v">411</span>
  <span class="k">Memorias vigentes</span>
</div>

<style>
  .est-tile {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 15px 16px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .est-tile .v { font: 600 26px var(--font-mono); color: var(--ink); line-height: 1; }
  .est-tile .k {
    font: 10px var(--font-mono);
    letter-spacing: .5px;
    text-transform: uppercase;
    color: var(--dim);
  }
</style>
```

Las variantes de estado se hacen con una clase extra sobre la cifra, no con un color suelto:
`.v.ok { color: var(--ok); }` y `.v.warn { color: var(--warn); }`.

Sin Svelte, el mismo idioma en CSS plano funciona igual: lo único que hace falta es que los tokens
de `:root` estén cargados y que `[data-theme]` cambie en el elemento raíz.

---

## 13. La puerta de calidad

El visor tiene contrastes **medidos**, no estimados, y las cifras están escritas en los comentarios
del CSS. Cualquier color nuevo pasa por lo mismo:

- Texto: 4.5:1 mínimo, y hay que comprobarlo sobre las **tres** superficies (`bg`, `bg2`, `panel`),
  no solo sobre el fondo base. Ese fue el error de `--dim`.
- Elementos gráficos (iconos, barras, puntos): 3:1 mínimo. Ese fue el error del verde de `learning`.
- En los dos temas. Un color que pasa en oscuro suele fallar en claro.
