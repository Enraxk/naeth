<script lang="ts">
  import { renderMarkdown } from '../lib/md'

  // Cuerpo de una memoria en modo LECTURA, sin editor.
  //
  // Sustituye al `<Milkdown readonly>` que se montaba para leer y que arrastraba 2,13 MB de JS
  // (ver la cabecera de lib/md.ts). Aqui no hay ProseMirror, ni plugins, ni ciclo de vida: es una
  // funcion pura y una cadena de HTML.
  //
  // `{@html}` es seguro AQUI y solo aqui porque `renderMarkdown` escapa todo el texto y filtra las
  // URL por lista blanca. Si algun dia se cambia ese renderer por otro, esta linea deja de estar
  // justificada y hay que revisarla.
  let { value = '' }: { value?: string } = $props()
  const html = $derived(renderMarkdown(value))
</script>

<div class="mdv">{@html html}</div>

<style>
  /* Los estilos van con `:global` porque el HTML lo inyecta `{@html}` y Svelte no le pone el
     atributo de scope: sin `:global` no le aplicaria ninguna regla.

     EL CRITERIO DE ESTE BLOQUE es replicar lo que ya se veia con el editor en readonly, no
     rediseñar la lectura. A3 cambia cuanto pesa abrir una nota, y si de paso cambiara como se ve
     seria imposible saber cual de las dos cosas rompio algo. El rediseño, si se quiere, va aparte
     y con la comparacion delante. */
  .mdv { font: 14px/1.65 var(--font-sans); color: var(--ink); }

  .mdv :global(p) { margin: 0 0 14px; }
  .mdv :global(:is(h1, h2, h3, h4, h5, h6)) {
    font-family: var(--font-sans); color: var(--ink); line-height: 1.3;
    margin: 22px 0 10px; font-weight: 600;
  }
  .mdv :global(h1) { font-size: 22px; }
  .mdv :global(h2) { font-size: 19px; }
  .mdv :global(h3) { font-size: 16px; }
  .mdv :global(:is(h4, h5, h6)) { font-size: 14px; }

  .mdv :global(strong) { font-weight: 600; }
  .mdv :global(del) { color: var(--dim); }

  /* Ambar y sin fondo, que es como lo pinta Crepe con --crepe-color-inline-code. */
  .mdv :global(code) { font: .92em var(--font-mono); color: var(--code); }
  .mdv :global(pre) {
    margin: 0 0 14px; padding: 12px 14px; border-radius: 8px;
    background: var(--bg2); border: 1px solid var(--border); overflow-x: auto;
  }
  /* Dentro de un bloque el codigo NO va en ambar: ahi el color lo lleva el fondo, y el ambar
     sobre --bg2 pierde contraste sin aportar nada que la caja no diga ya. */
  .mdv :global(pre code) { color: var(--ink); font-size: 12.5px; line-height: 1.55; }

  /* El borde de la cita es agrupacion visual, no un glifo que haya que leer, asi que --border es
     la variable correcta aqui y no contradice la regla de no usarla para texto ni iconos.
     Es ademas el nodo mas frecuente del corpus: los `>>` de seccion son citas anidadas. */
  .mdv :global(blockquote) {
    margin: 0 0 14px; padding-left: 16px; border-left: 2px solid var(--border);
  }
  .mdv :global(blockquote > :last-child) { margin-bottom: 0; }

  .mdv :global(:is(ul, ol)) { margin: 0 0 14px; padding-left: 24px; }
  .mdv :global(li) { margin: 0 0 4px; }
  .mdv :global(li > p) { margin: 0 0 4px; }
  .mdv :global(li > :last-child) { margin-bottom: 0; }
  .mdv :global(li input[type='checkbox']) { margin-right: 6px; }

  .mdv :global(a) { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }

  .mdv :global(hr) { border: 0; border-top: 1px solid var(--border); margin: 22px 0; }
  .mdv :global(img) { max-width: 100%; height: auto; border-radius: 8px; }

  /* La tabla scrollea DENTRO de su caja: una tabla ancha no puede empujar el ancho de la nota,
     porque el cuerpo vive en una rejilla junto al panel de contexto. */
  .mdv :global(table) {
    display: block; width: max-content; max-width: 100%; overflow-x: auto;
    border-collapse: collapse; margin: 0 0 14px; font-size: 13px;
  }
  .mdv :global(:is(th, td)) {
    border: 1px solid var(--border); padding: 7px 11px; text-align: left; vertical-align: top;
  }
  .mdv :global(th) { background: var(--bg2); font-weight: 600; }
</style>
