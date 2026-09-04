import { describe, expect, it } from 'vitest'
import type { TreeRow } from './types'
import { buildIndex, resolve, toDisplayMarkdown, extractLinkedIds, unescapeMarkdown } from './wikilinks'

// Contrato de la resolucion de `[[destino]]`.
//
// Por que estos tests y no otros: `resolve()` tiene SEIS caminos, ordenados de estricto a laxo, y
// el orden entre ellos es la decision de diseno. Un cambio que reordene los pasos, o que mueva el
// umbral de prefijo, no rompe nada visible: simplemente empieza a enlazar a la memoria equivocada.
// Es el peor modo de fallo que puede tener un sistema de memoria, porque no avisa.
//
// Los datos imitan las formas MEDIDAS sobre el corpus el 28/07/2026 (ver la cabecera de
// wikilinks.ts): prefijo de titulo, titulo exacto, uuid, prefijo de uuid y slug.

const row = (over: Partial<TreeRow> & { id: string }): TreeRow => ({
  title: null,
  memory_type: 'fact',
  path: null,
  tags: [],
  created_at: null,
  ...over,
})

const NAETH = row({
  id: '3f3c6a37-1111-4aaa-8bbb-000000000001',
  title: 'naeth · preferencia de calidad',
  created_at: '2026-07-01T10:00:00Z',
})
// Los dos CENIT existen a proposito: uno es prefijo del otro. Es el caso real que motivo la regla
// de "gana el titulo mas corto".
const CENIT_CORTO = row({
  id: 'e0e9709e-2222-4aaa-8bbb-000000000002',
  title: 'CENIT · vigilancia de hostnames',
  created_at: '2026-07-10T10:00:00Z',
})
const CENIT_LARGO = row({
  id: 'aabbccdd-3333-4aaa-8bbb-000000000003',
  title: 'CENIT · vigilancia de hostnames: inventario con clases',
  created_at: '2026-07-20T10:00:00Z',
})
const PERSONA = row({
  id: 'bbccddee-4444-4aaa-8bbb-000000000004',
  title: 'Tania Tetyana Perteseva',
  created_at: '2026-06-15T10:00:00Z',
})
// Mismo titulo, dos versiones. Sirve para fijar el desempate por fecha.
const DUP_VIEJO = row({
  id: 'ccddeeff-5555-4aaa-8bbb-000000000005',
  title: 'Nota duplicada',
  created_at: '2026-05-01T10:00:00Z',
})
const DUP_NUEVO = row({
  id: 'ddeeff00-6666-4aaa-8bbb-000000000006',
  title: 'Nota duplicada',
  created_at: '2026-08-01T10:00:00Z',
})
// Titulo sin `·` ni acentos, a proposito: es el unico con el que se puede medir el umbral de
// prefijo caracter a caracter, porque `norm()` hace trim y los separadores desplazan la cuenta.
const LIMITE = row({
  id: 'ff001122-8888-4aaa-8bbb-000000000008',
  title: 'Documentacion del formato',
  created_at: '2026-06-01T10:00:00Z',
})

// --- Fixtures de la resolucion por PATH (anadida el 04/09/2026) ---
// Reproducen los dos casos reales que la motivaron: un path con UNA sola nota y otro compartido.
// Medido sobre el corpus: 488 de 520 memorias comparten path, asi que el caso normal es el
// ambiguo, no el limpio.
const KREPIS = row({
  id: '11223344-9999-4aaa-8bbb-000000000009',
  title: 'Krepis: brief de discovery cerrado',
  path: 'krepis/status',
  created_at: '2026-08-01T10:00:00Z',
})
const DESIGN_VIEJO = row({
  id: '22334455-aaaa-4aaa-8bbb-00000000000a',
  title: 'CENIT · contrato de modulo',
  path: 'cenit/design',
  created_at: '2026-07-07T10:00:00Z',
})
const DESIGN_NUEVO = row({
  id: '33445566-bbbb-4aaa-8bbb-00000000000b',
  title: 'CENIT · diagrama de arquitectura',
  path: 'cenit/design',
  created_at: '2026-08-28T10:00:00Z',
})
// Sin titulo y con path: la unica forma de alcanzarla es por su path o por su uuid.
const SIN_TITULO = row({
  id: '44556677-cccc-4aaa-8bbb-00000000000c',
  path: 'cenit/build',
  created_at: '2026-07-21T10:00:00Z',
})

const IX = buildIndex([NAETH, CENIT_CORTO, CENIT_LARGO, PERSONA, DUP_VIEJO, DUP_NUEVO, LIMITE,
  KREPIS, DESIGN_VIEJO, DESIGN_NUEVO, SIN_TITULO])

describe('resolve · los seis caminos, de estricto a laxo', () => {
  it('1 · uuid completo', () => {
    expect(resolve(NAETH.id, IX)).toEqual({ id: NAETH.id, ambiguous: false })
  })

  it('1b · el uuid completo no distingue mayusculas', () => {
    expect(resolve(NAETH.id.toUpperCase(), IX)?.id).toBe(NAETH.id)
  })

  it('2 · prefijo de uuid de 8 hex', () => {
    expect(resolve('3f3c6a37', IX)).toEqual({ id: NAETH.id, ambiguous: false })
  })

  it('3 · titulo exacto', () => {
    expect(resolve('naeth · preferencia de calidad', IX)?.id).toBe(NAETH.id)
  })

  it('3b · titulo exacto duplicado: gana el MAS RECIENTE, y se marca ambiguo', () => {
    // `n` viaja solo cuando hay ambiguedad, para poder decir CUANTOS candidatos habia en vez de
    // un "varios" que el lector no puede comprobar.
    expect(resolve('Nota duplicada', IX)).toEqual({ id: DUP_NUEVO.id, ambiguous: true, n: 2 })
  })

  it('4 · slug exacto (kebab-case, sin acentos)', () => {
    expect(resolve('tania-tetyana-perteseva', IX)?.id).toBe(PERSONA.id)
  })

  it('5 · prefijo de titulo: de varios candidatos gana el titulo MAS CORTO', () => {
    // Lo que menos sobra tras el prefijo es lo que el autor quiso escribir abreviado.
    expect(resolve('CENIT · vigilancia', IX)).toEqual({ id: CENIT_CORTO.id, ambiguous: true, n: 2 })
  })

  it('6 · prefijo de slug, cuando el destino va en kebab y el titulo no', () => {
    expect(resolve('cenit-vigilancia-de', IX)?.id).toBe(CENIT_CORTO.id)
  })
})

describe('resolve · pasada 5, el PATH completo', () => {
  it('un path con UNA sola nota resuelve limpio y sin marcar', () => {
    expect(resolve('krepis/status', IX)).toEqual({ id: KREPIS.id, ambiguous: false })
  })

  it('un path COMPARTIDO gana la mas reciente, y lo dice con el numero', () => {
    // El caso normal del corpus, no la excepcion: 94% de las notas comparten path.
    expect(resolve('cenit/design', IX)).toEqual({ id: DESIGN_NUEVO.id, ambiguous: true, n: 2 })
  })

  it('alcanza una nota SIN TITULO, que por titulo o slug seria inalcanzable', () => {
    expect(resolve('cenit/build', IX)?.id).toBe(SIN_TITULO.id)
  })

  it('no distingue mayusculas ni espacios sobrantes', () => {
    expect(resolve('  Krepis/Status  ', IX)?.id).toBe(KREPIS.id)
  })

  it('un path inexistente devuelve null y NO cae al prefijo', () => {
    // Sin la guarda, `norm('inventado/status')` seguiria hacia las pasadas laxas. Con 8 caracteres
    // o mas, un destino con barra podria arrastrar un titulo cualquiera que empiece igual.
    expect(resolve('inventado/status', IX)).toBeNull()
  })

  it('REGRESION · un destino SIN barra se comporta exactamente como antes', () => {
    // La guarda `raw.includes('/')` es la propiedad de seguridad de toda la pasada: verificado
    // contra el corpus entero el 04/09/2026, 7 destinos ganan, 0 pierden y 0 cambian.
    expect(resolve('naeth · preferencia de calidad', IX)?.id).toBe(NAETH.id)
    expect(resolve('CENIT · vigilancia', IX)?.id).toBe(CENIT_CORTO.id)
    expect(resolve('tania-tetyana-perteseva', IX)?.id).toBe(PERSONA.id)
    expect(resolve('CENIT', IX)).toBeNull()
  })
})

describe('resolve · los guardas, que son lo que impide enlazar a cualquier cosa', () => {
  it('un destino de menos de 8 caracteres NO resuelve por prefijo', () => {
    // Sin el umbral MIN_PREFIX, "CENIT" arrastraria las dos notas CENIT y cualquier otra futura.
    expect(resolve('CENIT', IX)).toBeNull()
  })

  it('el umbral esta exactamente en 8: con 7 no, con 8 si', () => {
    // MIN_PREFIX no es un numero redondo elegido al azar, es la frontera entre "abreviatura del
    // autor" y "cualquier cosa que empiece igual". Estos dos casos la fijan por los dos lados.
    expect(resolve('documen', IX)).toBeNull()
    expect(resolve('document', IX)?.id).toBe(LIMITE.id)
  })

  it('un uuid con guiones que no esta en el arbol devuelve null, no un parecido', () => {
    // Apunta a una version superseded. Marcarlo como enlace seria prometer una navegacion muerta.
    expect(resolve('99999999-9999-4999-8999-999999999999', IX)).toBeNull()
  })

  it('un destino vacio o en blanco devuelve null', () => {
    expect(resolve('', IX)).toBeNull()
    expect(resolve('   ', IX)).toBeNull()
  })

  it('un titulo que no existe ni por prefijo devuelve null', () => {
    expect(resolve('esto no existe en ninguna parte', IX)).toBeNull()
  })
})

describe('toDisplayMarkdown · solo el camino de LECTURA', () => {
  it('convierte un wikilink resuelto en enlace al router por hash', () => {
    expect(toDisplayMarkdown('ver [[naeth · preferencia de calidad]] aqui', IX)).toBe(
      `ver [naeth · preferencia de calidad](#/m/${NAETH.id}) aqui`,
    )
  })

  it('deja LITERAL lo que no resuelve: un wikilink muerto no debe parecer pulsable', () => {
    const src = 'ver [[planes-orden-ejecucion]] aqui'
    expect(toDisplayMarkdown(src, IX)).toBe(src)
  })

  it('admite el alias de estilo Obsidian [[destino|texto]]', () => {
    expect(toDisplayMarkdown('[[naeth · preferencia de calidad|la preferencia]]', IX)).toBe(
      `[la preferencia](#/m/${NAETH.id})`,
    )
  })

  it('NO toca un wikilink dentro de un bloque de codigo vallado', () => {
    const src = '```\n[[naeth · preferencia de calidad]]\n```'
    expect(toDisplayMarkdown(src, IX)).toBe(src)
  })

  it('NO toca un wikilink dentro de codigo en linea', () => {
    const src = 'la sintaxis es `[[naeth · preferencia de calidad]]` y punto'
    expect(toDisplayMarkdown(src, IX)).toBe(src)
  })

  it('convierte fuera del codigo aunque haya codigo en el mismo texto', () => {
    const out = toDisplayMarkdown('`[[NAETH · preferencia de calidad]]` y [[naeth · preferencia de calidad]]', IX)
    expect(out).toContain('`[[NAETH · preferencia de calidad]]`')
    expect(out).toContain(`](#/m/${NAETH.id})`)
  })

  it('una entrada vacia sale igual', () => {
    expect(toDisplayMarkdown('', IX)).toBe('')
  })
})

describe('toDisplayMarkdown · el aviso de destino ambiguo', () => {
  it('un destino univoco no lleva aviso', () => {
    expect(toDisplayMarkdown('ver [[krepis/status]]', IX)).toBe(`ver [krepis/status](#/m/${KREPIS.id})`)
  })

  it('un destino ambiguo enlaza igual, pero dice cuantos candidatos habia', () => {
    expect(toDisplayMarkdown('ver [[cenit/design]]', IX)).toBe(
      `ver [cenit/design](#/m/${DESIGN_NUEVO.id} "2 destinos posibles: se abre el mas reciente")`,
    )
  })

  it('el alias se respeta tambien cuando hay aviso', () => {
    expect(toDisplayMarkdown('ver [[cenit/design|el diagrama]]', IX)).toBe(
      `ver [el diagrama](#/m/${DESIGN_NUEVO.id} "2 destinos posibles: se abre el mas reciente")`,
    )
  })

  it('un path dentro de un bloque de codigo se queda literal', () => {
    expect(toDisplayMarkdown('`[[krepis/status]]`', IX)).toBe('`[[krepis/status]]`')
  })
})

describe('extractLinkedIds · lo que se materializa como relacion al guardar', () => {
  it('recoge los wikilinks resueltos', () => {
    expect(extractLinkedIds('[[naeth · preferencia de calidad]]', IX)).toEqual([NAETH.id])
  })

  it('recoge tambien los enlaces que ya inserto el autocompletado', () => {
    expect(extractLinkedIds(`[lo que sea](#/m/${NAETH.id})`, IX)).toEqual([NAETH.id])
  })

  it('no duplica cuando el mismo destino aparece en las dos formas', () => {
    const src = `[[naeth · preferencia de calidad]] y [otra vez](#/m/${NAETH.id})`
    expect(extractLinkedIds(src, IX)).toEqual([NAETH.id])
  })

  it('ignora lo que hay dentro de codigo, igual que la lectura', () => {
    expect(extractLinkedIds('`[[naeth · preferencia de calidad]]`', IX)).toEqual([])
  })

  it('devuelve vacio cuando no hay nada que enlazar', () => {
    expect(extractLinkedIds('texto sin enlaces', IX)).toEqual([])
    expect(extractLinkedIds('', IX)).toEqual([])
  })
})

describe('unescapeMarkdown · lo que impide que guardar corrompa la nota', () => {
  // Los dos casos MEDIDOS el 22/08/2026 en notas reales, con el editor devolviendo texto escapado.
  it('devuelve un wikilink escapado a su forma viva', () => {
    const escapado = String.raw`Es el fallo de la familia de \[\[Metodo · algo\]\] y punto`
    const limpio = 'Es el fallo de la familia de [[Metodo · algo]] y punto'
    expect(unescapeMarkdown(escapado)).toBe(limpio)
  })

  it('el wikilink recuperado VUELVE a resolver, que es de lo que se trata', () => {
    const escapado = String.raw`ver \[\[naeth · preferencia de calidad\]\]`
    expect(extractLinkedIds(escapado, IX)).toEqual([])                       // escapado: muerto
    expect(extractLinkedIds(unescapeMarkdown(escapado), IX)).toEqual([NAETH.id])  // recuperado
  })

  it('devuelve un guion bajo escapado a su forma original', () => {
    expect(unescapeMarkdown(String.raw`aislados con wal\_level=logical`))
      .toBe('aislados con wal_level=logical')
  })

  it('NO toca el escape de otros caracteres: un asterisco literal sigue protegido', () => {
    // Solo se deshacen [ ] y _. Lo demas que el autor quiso literal se queda como esta.
    expect(unescapeMarkdown(String.raw`un \*asterisco\* y una \#almohadilla`))
      .toBe(String.raw`un \*asterisco\* y una \#almohadilla`)
  })

  it('un texto sin escapes sale exactamente igual', () => {
    const src = 'texto normal con [[wikilink]] y wal_level sin tocar'
    expect(unescapeMarkdown(src)).toBe(src)
  })

  it('degrada con entrada vacia', () => {
    expect(unescapeMarkdown('')).toBe('')
  })
})

describe('buildIndex · degrada con datos reales, que no siempre estan completos', () => {
  it('una fila sin titulo se indexa por id y no rompe el resto', () => {
    // En el corpus hay dos memorias vigentes sin titulo (cenit/build, 21/07/2026).
    const sinTitulo = row({ id: 'eeff0011-7777-4aaa-8bbb-000000000007' })
    const ix = buildIndex([sinTitulo, NAETH])
    expect(resolve(sinTitulo.id, ix)?.id).toBe(sinTitulo.id)
    expect(resolve('naeth · preferencia de calidad', ix)?.id).toBe(NAETH.id)
  })

  it('un arbol vacio no resuelve nada, pero tampoco lanza', () => {
    const ix = buildIndex([])
    expect(resolve('lo que sea que se escriba', ix)).toBeNull()
  })
})
