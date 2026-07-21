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
  }
</script>

<script lang="ts">
  // Wrapper de Milkdown Crepe (WYSIWYG), cargado en diferido (su propio chunk).
  import { onMount, onDestroy } from 'svelte'
  import { theme } from '../lib/theme.svelte'

  let {
    value = '',
    readonly = true,
    getRef,
  }: {
    value?: string
    readonly?: boolean
    getRef?: (api: EditorApi) => void
  } = $props()

  let host: HTMLDivElement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let crepe: any = null
  let ready = $state(false)

  onMount(async () => {
    const { Crepe } = await import('@milkdown/crepe')
    const { callCommand } = await import('@milkdown/kit/utils')
    const { editorViewCtx } = await import('@milkdown/kit/core')
    const cm = await import('@milkdown/kit/preset/commonmark')
    const gfm = await import('@milkdown/kit/preset/gfm')
    await import('@milkdown/crepe/theme/common/style.css')
    if (theme.value === 'dark') await import('@milkdown/crepe/theme/nord-dark.css')
    else await import('@milkdown/crepe/theme/nord.css')

    crepe = new Crepe({ root: host, defaultValue: value })
    await crepe.create()
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
    })
  })

  onDestroy(() => {
    try { crepe?.destroy() } catch { /* noop */ }
    crepe = null
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
