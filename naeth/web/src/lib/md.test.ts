import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './md'

// Contrato del renderer de LECTURA.
//
// Por que estos tests y no otros: la salida de `renderMarkdown` se pinta con `{@html}`, asi que
// aqui no se prueba "que se vea bonito", se prueba QUE NO PUEDA EJECUTAR NADA. El resto de casos
// son los tipos de nodo MEDIDOS sobre las 520 memorias el 04/09/2026, en su orden de frecuencia
// real, mas los marginales que aparecen en dos o tres notas y que por raros son justo los que
// nadie volveria a mirar.

describe('renderMarkdown · seguridad, que es el motivo de que esto tenga tests', () => {
  it('el HTML crudo se escapa y se ve, no se ejecuta', () => {
    // Caso REAL del corpus: hay 21 nodos html en 10 notas y ninguno es html de verdad. Son
    // marcadores en prosa, y entre ellos se citan `<script>` y `<style>`.
    expect(renderMarkdown('un <script>alert(1)</script> citado')).toContain('&lt;script&gt;')
    expect(renderMarkdown('un <script>alert(1)</script> citado')).not.toContain('<script>')
  })

  it('los marcadores de plantilla del corpus se leen tal cual', () => {
    const out = renderMarkdown('la ruta es <fichero> y el usuario <nombre>')
    expect(out).toContain('&lt;fichero&gt;')
    expect(out).toContain('&lt;nombre&gt;')
  })

  it('un enlace con esquema no permitido pierde el href y queda como texto', () => {
    const out = renderMarkdown('[pulsa](javascript:alert(1))')
    expect(out).not.toContain('href')
    expect(out).toContain('pulsa')
  })

  it('una imagen con esquema no permitido cae a su texto alternativo', () => {
    expect(renderMarkdown('![roto](javascript:alert(1))')).toBe('<p>roto</p>')
  })

  it('las comillas de un title no pueden cerrar el atributo', () => {
    // El title llega del markdown con una comilla dentro: si no se escapara, cerraria el
    // atributo y todo lo que viniera detras se leeria como HTML.
    const out = renderMarkdown('[x](https://a.b "co\\"millas")')
    expect(out).toContain('title="co&quot;millas"')
  })

  it('el ampersand se escapa una sola vez', () => {
    expect(renderMarkdown('uno & dos')).toBe('<p>uno &amp; dos</p>')
  })
})

describe('renderMarkdown · lo que el corpus usa de verdad', () => {
  it('parrafo, negrita, cursiva y codigo en linea', () => {
    expect(renderMarkdown('**a** y *b* y `c`')).toBe(
      '<p><strong>a</strong> y <em>b</em> y <code>c</code></p>',
    )
  })

  it('la cita, que es el nodo mas frecuente del corpus (1.679 en 177 notas)', () => {
    // Son los `>>` con los que Eneko marca las secciones de una memoria: markdown los lee como
    // cita anidada, y asi es como se han visto siempre.
    expect(renderMarkdown('>> SECCION')).toBe(
      '<blockquote><blockquote><p>SECCION</p></blockquote></blockquote>',
    )
  })

  it('listas con y sin orden', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li><p>a</p></li><li><p>b</p></li></ul>')
    expect(renderMarkdown('1. a')).toBe('<ol><li><p>a</p></li></ol>')
  })

  it('una lista numerada que no empieza en 1 conserva su arranque', () => {
    expect(renderMarkdown('3. c')).toContain('<ol start="3">')
  })

  it('la casilla de una tarea se pinta pero NO se puede pulsar', () => {
    // En una vista de lectura, una casilla pulsable prometeria un guardado que no existe.
    const out = renderMarkdown('- [x] hecho')
    expect(out).toContain('<input type="checkbox" disabled checked>')
  })

  it('el tachado de GFM', () => {
    expect(renderMarkdown('~~no~~')).toBe('<p><del>no</del></p>')
  })
})

describe('renderMarkdown · enlaces, que es por donde se navega el corpus', () => {
  it('un wikilink ya resuelto navega DENTRO, sin abrir pestana', () => {
    const out = renderMarkdown('[nota](#/m/abc-123)')
    expect(out).toContain('href="#/m/abc-123"')
    expect(out).not.toContain('target=')
  })

  it('un enlace externo sale en otra pestana y sin filtrar el referente', () => {
    const out = renderMarkdown('[web](https://enraxk.dev)')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('el title de un destino ambiguo llega hasta el HTML', () => {
    // Es lo que produce `toDisplayMarkdown` cuando un wikilink resolvio a varias notas: si se
    // perdiera aqui, el aviso y su subrayado punteado desaparecerian sin que nadie lo notara.
    const out = renderMarkdown('[cenit/design](#/m/abc "5 destinos posibles")')
    expect(out).toContain('title="5 destinos posibles"')
  })
})

describe('renderMarkdown · los marginales, que son los que nadie volveria a mirar', () => {
  it('bloque de codigo con lenguaje (3 notas en todo el corpus)', () => {
    expect(renderMarkdown('```sql\nSELECT 1\n```')).toBe(
      '<pre><code class="language-sql">SELECT 1</code></pre>',
    )
  })

  it('tabla con alineacion (2 notas en todo el corpus)', () => {
    const out = renderMarkdown('| a | b |\n|:--|--:|\n| 1 | 2 |')
    expect(out).toContain('<thead>')
    expect(out).toContain('<th style="text-align:left">a</th>')
    expect(out).toContain('<td style="text-align:right">2</td>')
  })

  it('linea horizontal (1 nota en todo el corpus)', () => {
    expect(renderMarkdown('---')).toBe('<hr>')
  })

  it('el vacio no revienta', () => {
    expect(renderMarkdown('')).toBe('')
  })
})
