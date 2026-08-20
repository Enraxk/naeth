<script module lang="ts">
  // API que el wrapper expone hacia el toolbar (todo corre dentro del chunk lazy).
  export interface EditorApi {
    getMarkdown: () => string
    bold: () => void
    italic: () => void
    strike: () => void
    code: () => void
    heading: (level: number) => void
    bullet: () => void
    ordered: () => void
    quote: () => void
    hr: () => void
    codeblock: () => void
    table: () => void
    insert: (text: string) => void
    /** Sustituye el `[[consulta` en curso por un enlace real a la memoria elegida. */
    wikiInsert: (from: number, to: number, title: string, id: string) => void
  }

  /** Lo que hay escrito tras `[[` y dónde ponerle el menú (coords de viewport). */
  export interface WikiState {
    query: string
    from: number
    to: number
    left: number
    bottom: number
  }
</script>

<script lang="ts">
  // Wrapper de Milkdown Crepe (WYSIWYG), cargado en diferido (su propio chunk).
  import { onMount, onDestroy } from 'svelte'

  let {
    value = '',
    readonly = true,
    getRef,
    onWiki,
    onWikiKey,
  }: {
    value?: string
    readonly?: boolean
    getRef?: (api: EditorApi) => void
    /** Se llama con el estado del `[[` en curso, o null cuando deja de haberlo. */
    onWiki?: (s: WikiState | null) => void
    /** Devuelve true si el menú consumió la tecla (flechas, Enter, Esc). */
    onWikiKey?: (key: string) => boolean
  } = $props()

  let host: HTMLDivElement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let crepe: any = null
  let ready = $state(false)
  // El montaje es asíncrono y el componente puede morir a mitad (cambiar de memoria, o el
  // remontaje que dispara la llegada del árbol). Sin esta bandera, `onDestroy` corría ANTES de
  // que `crepe` estuviera asignado: no destruía nada, Svelte se llevaba el `.md-host`, y el
  // `create()` terminaba después contra un host ya fuera del documento, dejando su `.milkdown`
  // colgando del `<body>`. Eso era el texto fantasma de notas viejas al final de la página.
  let destruido = false

  /** Red de seguridad: un editor vivo SIEMPRE cuelga de `.md-host`, nunca del body. */
  function barrerHuerfanos() {
    for (const el of document.querySelectorAll('body > .milkdown')) el.remove()
  }

  onMount(async () => {
    const { Crepe } = await import('@milkdown/crepe')
    // `$prose` se renombra: Svelte reserva el prefijo `$` y no admite importarlo tal cual.
    const { callCommand, $prose: proseePlugin } = await import('@milkdown/kit/utils')
    const { editorViewCtx } = await import('@milkdown/kit/core')
    const { Plugin, PluginKey } = await import('@milkdown/kit/prose/state')
    const cm = await import('@milkdown/kit/preset/commonmark')
    const gfm = await import('@milkdown/kit/preset/gfm')
    // Solo la estructura. Los COLORES los pone `.milkdown` en app.css, atado a los tokens del
    // visor: los temas de Crepe traen los suyos y, al cargarse con import() condicional, se
    // quedaban pegados al documento; cambiar de tema no los retiraba.
    await import('@milkdown/crepe/theme/common/style.css')
    if (destruido) return   // murió mientras cargaban los chunks: no llegar a crear nada

    // --- `[[` -> selector de memoria -------------------------------------------------------
    // El plugin NO pinta el menú: solo detecta que hay un `[[consulta` abierto ante el cursor y
    // publica dónde está. El menú lo dibuja Svelte (Memoria.svelte), que así reutiliza el mismo
    // patrón de teclado del quick-open en vez de inventar una segunda interacción.
    type WikiPS = { query: string; from: number; to: number } | null
    const wikiKey = new PluginKey<WikiPS>('naeth-wikilink')
    const wikiProse = proseePlugin(
      () =>
        new Plugin<WikiPS>({
          key: wikiKey,
          state: {
            init: (): WikiPS => null,
            apply(_tr, _prev, _old, next): WikiPS {
              const sel = next.selection
              if (!sel.empty || !sel.$from.parent.isTextblock) return null
              const before = sel.$from.parent.textBetween(0, sel.$from.parentOffset, undefined, '￼')
              // Sin `]` ni salto de línea dentro: un `[[` de hace tres párrafos no cuenta.
              const m = /\[\[([^[\]\n]*)$/.exec(before)
              return m ? { query: m[1], from: sel.from - m[0].length, to: sel.from } : null
            },
          },
          props: {
            handleKeyDown(view, event) {
              if (!wikiKey.getState(view.state)) return false
              return onWikiKey?.(event.key) ?? false
            },
          },
          view: () => ({
            update(view) {
              // En lectura el editor sigue teniendo selección: sin este guard, seleccionar a mano
              // un `[[` de una nota abriría el selector fuera del modo edición.
              const st = view.editable ? wikiKey.getState(view.state) : null
              if (!st) return onWiki?.(null)
              const c = view.coordsAtPos(st.to)
              onWiki?.({ query: st.query, from: st.from, to: st.to, left: c.left, bottom: c.bottom })
            },
            destroy: () => onWiki?.(null),
          }),
        }),
    )

    crepe = new Crepe({ root: host, defaultValue: value })
    crepe.editor.use(wikiProse)
    await crepe.create()
    // Aquí está la carrera: si murió durante el create(), lo recién creado no tiene contenedor
    // al que volver. Se destruye a mano y se barre lo que Crepe haya soltado en el body.
    if (destruido) {
      try { crepe.destroy() } catch { /* noop */ }
      crepe = null
      barrerHuerfanos()
      return
    }
    crepe.setReadonly(readonly)
    ready = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = (key: any, payload?: any) => crepe?.editor.action(callCommand(key, payload))
    getRef?.({
      getMarkdown: () => (crepe ? crepe.getMarkdown() : value),
      bold: () => run(cm.toggleStrongCommand.key),
      italic: () => run(cm.toggleEmphasisCommand.key),
      strike: () => run(gfm.toggleStrikethroughCommand.key),
      code: () => run(cm.toggleInlineCodeCommand.key),
      heading: (level: number) => run(cm.wrapInHeadingCommand.key, level),
      bullet: () => run(cm.wrapInBulletListCommand.key),
      ordered: () => run(cm.wrapInOrderedListCommand.key),
      quote: () => run(cm.wrapInBlockquoteCommand.key),
      hr: () => run(cm.insertHrCommand.key),
      codeblock: () => run(cm.createCodeBlockCommand.key),
      table: () => run(gfm.insertTableCommand.key),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insert: (text: string) => crepe?.editor.action((ctx: any) => {
        const view = ctx.get(editorViewCtx)
        view.dispatch(view.state.tr.insertText(text))
        view.focus()
      }),
      // Se inserta un nodo de texto CON LA MARCA link, no el texto "[x](y)": el documento es un
      // árbol, no markdown, así que escribir la sintaxis a mano dejaría corchetes escapados al
      // serializar. Con la marca, el serializador produce el enlace correcto.
      wikiInsert: (from: number, to: number, title: string, id: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        crepe?.editor.action((ctx: any) => {
          const view = ctx.get(editorViewCtx)
          const { schema, tr } = view.state
          const mark = schema.marks.link.create({ href: `#/m/${id}` })
          view.dispatch(tr.replaceWith(from, to, schema.text(title, [mark])).scrollIntoView())
          view.focus()
        }),
    })
  })

  onDestroy(() => {
    destruido = true                                    // primero: corta el montaje en curso
    try { crepe?.destroy() } catch { /* noop */ }
    crepe = null
    barrerHuerfanos()
  })

  $effect(() => {
    if (crepe && ready) crepe.setReadonly(readonly)
  })
</script>

<div bind:this={host} class="md-host" class:editing={!readonly}></div>

<style>
  .md-host { width: 100%; }
  .md-host.editing { min-height: 260px; }
  .md-host :global(.milkdown) { width: 100%; max-width: none; background: transparent; }
  .md-host :global(.milkdown .ProseMirror) { max-width: none; padding: 0; outline: none; }
  .md-host :global(.milkdown .editor) { max-width: none; padding: 0; }
</style>
