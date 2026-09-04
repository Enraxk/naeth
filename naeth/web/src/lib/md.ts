// Markdown a HTML para el camino de LECTURA.
//
// POR QUE EXISTE ESTE FICHERO. Hasta el 04/09/2026 la vista Memoria montaba el editor Crepe
// tambien para leer (`<Milkdown readonly>`), asi que abrir una nota descargaba el editor entero:
// 664 kB de su chunk mas 1.467 kB de dependencias (ProseMirror, CodeMirror con decenas de modos
// de lenguaje, KaTeX con sus fuentes) y 79 kB de CSS. Dos megas y pico para pintar texto, en la
// accion mas frecuente del visor.
//
// POR QUE UN WALKER PROPIO Y NO UNA LIBRERIA. El arbol ya trae `mdast-util-from-markdown` y las
// extensiones GFM, porque son las que usa Milkdown por dentro. Anadir `marked` o la familia
// `rehype` seria meter un SEGUNDO parser de markdown en el mismo proyecto, y entonces lo que ves
// al leer y lo que el editor entiende al editar podrian diferir en los bordes. Con el mismo
// parser eso no puede pasar. Ademas el corpus es pequeno en variedad: medido el 04/09/2026 sobre
// las 520 memorias, usa 17 tipos de nodo, de los que 9 son triviales y 4 son marginales (tablas
// en 2 notas, bloques de codigo en 3, tachado en 3, linea horizontal en 1).
//
// LAS TRES DEPENDENCIAS VAN DECLARADAS EN package.json aunque ya estuvieran instaladas: eran
// transitivas de Crepe, y apoyarse en la transitiva de otro es que una actualizacion suya te
// rompa el build sin tocar nada tuyo.
//
// ⚠ EL HTML CRUDO SE ESCAPA, NO SE VUELCA. Medido en el corpus: 21 nodos `html` en 10 notas, y
// NINGUNO es html de verdad. Son marcadores de plantilla escritos en prosa (`<nombre>`, `<id>`,
// `<slug>`, `<DOMINIO>`, `<fichero>`) y nombres de etiqueta citados como ejemplo, entre ellos
// `<script>` y `<style>`. Volcarlos como HTML seria a la vez incorrecto (el autor queria verlos)
// y peligroso. Se escapan y se muestran, que es lo que hacia el editor.

import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfm } from 'micromark-extension-gfm'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import type { Nodes, Parents, RootContent, TableCell, TableRow } from 'mdast'

/** Escape de texto. El `&` va PRIMERO o se escaparia dos veces lo ya escapado. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** En atributo hace falta ademas la comilla, porque el valor va entre comillas dobles. */
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;')

/**
 * Solo se dejan pasar los esquemas que tienen sentido en una memoria. Todo lo demas pierde el
 * `href` y el enlace se queda como texto: es preferible un enlace muerto a uno que ejecuta.
 * `#/m/<id>` es el que produce la resolucion de wikilinks, y por eso el hash entra.
 */
const URL_OK = /^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i
const safeUrl = (u?: string | null): string | null =>
  u && URL_OK.test(u.trim()) ? u.trim() : null

const ALIGN = (a?: string | null) => (a === 'left' || a === 'right' || a === 'center' ? a : null)

function children(node: Parents, ctx: Ctx): string {
  return node.children.map((c) => one(c as Nodes, ctx)).join('')
}

interface Ctx {
  /** Las celdas de la primera fila de una tabla van en `th`, y ademas llevan su alineacion. */
  align: (string | null | undefined)[]
  head: boolean
}

function cell(n: TableCell, i: number, ctx: Ctx): string {
  const tag = ctx.head ? 'th' : 'td'
  const a = ALIGN(ctx.align[i])
  return `<${tag}${a ? ` style="text-align:${a}"` : ''}>${children(n, ctx)}</${tag}>`
}

function row(n: TableRow, ctx: Ctx): string {
  return `<tr>${n.children.map((c, i) => cell(c as TableCell, i, ctx)).join('')}</tr>`
}

function one(n: Nodes, ctx: Ctx): string {
  switch (n.type) {
    case 'text':
      return esc(n.value)
    case 'paragraph':
      return `<p>${children(n, ctx)}</p>`
    case 'strong':
      return `<strong>${children(n, ctx)}</strong>`
    case 'emphasis':
      return `<em>${children(n, ctx)}</em>`
    case 'delete':
      return `<del>${children(n, ctx)}</del>`
    case 'inlineCode':
      return `<code>${esc(n.value)}</code>`
    case 'code': {
      // La clase `language-x` va aunque aqui no se resalte nada: es la convencion que espera
      // cualquier resaltador que se quiera anadir despues, y no cuesta nada dejarla puesta.
      const lang = n.lang ? ` class="language-${escAttr(n.lang)}"` : ''
      return `<pre><code${lang}>${esc(n.value)}</code></pre>`
    }
    case 'blockquote':
      // 1.679 apariciones en 177 notas, y casi todas son los `>>` con los que Eneko marca las
      // secciones de una memoria. Es el nodo que mas se ve en el corpus, no un adorno.
      return `<blockquote>${children(n, ctx)}</blockquote>`
    case 'list': {
      const tag = n.ordered ? 'ol' : 'ul'
      const start = n.ordered && n.start != null && n.start !== 1 ? ` start="${n.start}"` : ''
      return `<${tag}${start}>${children(n, ctx)}</${tag}>`
    }
    case 'listItem': {
      // Lista de tareas de GFM: se pinta la casilla, siempre deshabilitada. Esta vista es de
      // lectura, y una casilla que se puede pulsar promete un guardado que no existe.
      const box =
        typeof n.checked === 'boolean'
          ? `<input type="checkbox" disabled${n.checked ? ' checked' : ''}> `
          : ''
      return `<li>${box}${children(n, ctx)}</li>`
    }
    case 'heading':
      // El corpus no tiene ni uno (medido: 0 en 520 memorias), pero una nota futura puede
      // traerlos y el indice del panel los busca en el DOM.
      return `<h${n.depth}>${children(n, ctx)}</h${n.depth}>`
    case 'link': {
      const href = safeUrl(n.url)
      const title = n.title ? ` title="${escAttr(n.title)}"` : ''
      if (!href) return children(n, ctx)
      // `rel` y `target` solo en enlaces que salen fuera: un `#/m/<id>` es navegacion interna y
      // abrirlo en otra pestana romperia el gesto de seguir un wikilink.
      const fuera = /^https?:/i.test(href)
      const extra = fuera ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${escAttr(href)}"${title}${extra}>${children(n, ctx)}</a>`
    }
    case 'image': {
      const src = safeUrl(n.url)
      if (!src) return esc(n.alt ?? '')
      const title = n.title ? ` title="${escAttr(n.title)}"` : ''
      return `<img src="${escAttr(src)}" alt="${escAttr(n.alt ?? '')}"${title} loading="lazy">`
    }
    case 'table': {
      const align = n.align ?? []
      const [cabecera, ...resto] = n.children
      const head = cabecera ? `<thead>${row(cabecera, { align, head: true })}</thead>` : ''
      const body = resto.length
        ? `<tbody>${resto.map((r) => row(r, { align, head: false })).join('')}</tbody>`
        : ''
      return `<table>${head}${body}</table>`
    }
    case 'thematicBreak':
      return '<hr>'
    case 'break':
      return '<br>'
    case 'html':
      // Ver el aviso de la cabecera: se escapa a proposito. No es una limitacion, es la decision.
      return esc(n.value)
    default:
      // Nodo que este parser conoce y este walker no. Se pinta su contenido si lo tiene, y si no
      // se ignora: perder el formato es aceptable, perder el TEXTO no.
      return 'children' in n ? children(n as Parents, ctx) : ''
  }
}

/**
 * Markdown a HTML seguro para pintar con `{@html}`.
 *
 * Todo el texto va escapado y las URL pasan por lista blanca, asi que la salida no puede
 * ejecutar nada aunque la nota lo intente.
 */
export function renderMarkdown(src: string): string {
  if (!src) return ''
  const tree = fromMarkdown(src, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  })
  const ctx: Ctx = { align: [], head: false }
  return tree.children.map((c: RootContent) => one(c as Nodes, ctx)).join('')
}
