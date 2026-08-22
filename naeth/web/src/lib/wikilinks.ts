// Wikilinks `[[destino]]` -> enlaces navegables.
//
// Las memorias se enlazan con `[[ ]]` desde antes de que el visor supiera leerlos, así que aquí
// mandan los datos, no una sintaxis idealizada. MEDIDO sobre el corpus entero el 28/07/2026
// (112 wikilinks en 284 memorias vigentes), los destinos se escriben de estas formas:
//
//   prefijo de título  28   [[CENIT · vigilancia de hostnames]]  -> el título real sigue con
//                            ": inventario con clases, visor móvil…". La forma MÁS común: se
//                            escribe el título de memoria, abreviado.
//   título exacto      27   [[naeth · preferencia de calidad]]
//   uuid completo      12   [[e0e9709e-e076-4dec-89e0-8743e28a7da7]]
//   prefijo de uuid     7   [[3f3c6a37]]
//   slug kebab-case    ·    [[tania-tetyana-perteseva]], [[planes-orden-ejecucion]]
//
// De ahí el orden de resolución: de lo más estricto a lo más laxo, y con prefijo aceptado tanto
// sobre el título como sobre su slug.
//
// Lo que NO se resuelve, a propósito:
//   - uuids que no están en el árbol (el árbol solo trae vigentes): apuntan a versiones
//     superseded. Marcarlos como enlace sería prometer una navegación que no lleva a nada.
//   - slugs de la memoria NATIVA de Claude Code (`[[planes-orden-ejecucion]]`), que viven en
//     ~/.claude y no en Naeth. No existen aquí y no deben inventarse.
//
// También se admite el alias de estilo Obsidian `[[destino|texto]]`.
//
// IMPORTANTE: esto es SOLO para el camino de LECTURA. El markdown que se guarda no se toca nunca
// (ver Memoria.svelte): si esta transformación llegara a un supersede, corrompería el contenido.

import type { TreeRow } from './types'

export interface WikiIndex {
  byTitle: Map<string, TreeRow[]>
  byId: Map<string, TreeRow>
  byShort: Map<string, TreeRow[]>
  bySlug: Map<string, TreeRow[]>
  /** [clave normalizada, slug, fila] por orden, para las pasadas por prefijo. */
  entries: { key: string; slug: string; row: TreeRow }[]
}

export interface Resolved {
  id: string
  /** Había más de un candidato: se eligió el más reciente. */
  ambiguous: boolean
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Slug kebab-case, sin acentos: la forma en que se escriben algunos destinos. */
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const newest = (a: TreeRow, b: TreeRow) =>
  String(b.created_at || '').localeCompare(String(a.created_at || ''))

/** Un destino "parece id" si es hex/guiones y suficientemente largo para no chocar con un título. */
const looksLikeId = (s: string) => /^[0-9a-f]{6,}$/i.test(s.replace(/-/g, ''))

/** Umbral para aceptar prefijos: por debajo, un destino corto casaría con media base. */
const MIN_PREFIX = 8

const push = (m: Map<string, TreeRow[]>, k: string, r: TreeRow) => {
  const arr = m.get(k)
  if (arr) arr.push(r)
  else m.set(k, [r])
}

export function buildIndex(rows: TreeRow[]): WikiIndex {
  const byTitle = new Map<string, TreeRow[]>()
  const byId = new Map<string, TreeRow>()
  const byShort = new Map<string, TreeRow[]>()
  const bySlug = new Map<string, TreeRow[]>()
  const entries: WikiIndex['entries'] = []
  for (const r of rows) {
    if (r.title) {
      const k = norm(r.title)
      const s = slugify(r.title)
      push(byTitle, k, r)
      push(bySlug, s, r)
      entries.push({ key: k, slug: s, row: r })
    }
    byId.set(r.id.toLowerCase(), r)
    push(byShort, r.id.replace(/-/g, '').slice(0, 8).toLowerCase(), r)
  }
  return { byTitle, byId, byShort, bySlug, entries }
}

/** De varios candidatos gana el título MÁS CORTO: es el que menos sobra tras el prefijo. */
const bestByPrefix = (cands: TreeRow[]): Resolved => {
  const sorted = [...cands].sort(
    (a, b) => (a.title?.length ?? 0) - (b.title?.length ?? 0) || newest(a, b),
  )
  return { id: sorted[0].id, ambiguous: cands.length > 1 }
}

export function resolve(target: string, ix: WikiIndex): Resolved | null {
  const raw = target.trim()
  if (!raw) return null
  const key = norm(raw)
  const slug = slugify(raw)

  // 1) uuid completo
  const asId = ix.byId.get(raw.toLowerCase())
  if (asId) return { id: asId.id, ambiguous: false }

  // 2) prefijo de uuid (solo si de verdad parece un id, para no secuestrar títulos como "cafe")
  if (looksLikeId(raw)) {
    const cands = ix.byShort.get(raw.replace(/-/g, '').slice(0, 8).toLowerCase())
    if (cands?.length) {
      const sorted = [...cands].sort(newest)
      return { id: sorted[0].id, ambiguous: cands.length > 1 }
    }
    // Un uuid con forma válida que no está en el árbol apunta a una versión ya superseded:
    // no se inventa un destino por parecido de texto.
    if (raw.includes('-')) return null
  }

  // 3) título exacto. Con duplicados gana el más reciente.
  const byT = ix.byTitle.get(key)
  if (byT?.length) return { id: [...byT].sort(newest)[0].id, ambiguous: byT.length > 1 }

  // 4) slug exacto
  const byS = ix.bySlug.get(slug)
  if (byS?.length) return { id: [...byS].sort(newest)[0].id, ambiguous: byS.length > 1 }

  // 5) y 6) prefijo de título o de slug, la forma más común en el corpus, y por eso se acepta
  // pese a ser laxa. El umbral evita que un destino de tres letras arrastre cualquier cosa.
  if (key.length >= MIN_PREFIX) {
    const porTitulo = ix.entries.filter((e) => e.key.startsWith(key)).map((e) => e.row)
    if (porTitulo.length) return bestByPrefix(porTitulo)
    const porSlug = ix.entries.filter((e) => e.slug.startsWith(slug)).map((e) => e.row)
    if (porSlug.length) return bestByPrefix(porSlug)
  }

  return null
}

/** El texto de un enlace markdown no puede llevar corchetes sin escapar. */
const escapeLabel = (s: string) => s.replace(/([[\]])/g, '\\$1')

const WIKI = /\[\[([^\][|]+)(?:\|([^\][]+))?\]\]/g

/**
 * Recorre `src` aplicando `fn` solo FUERA de código (vallado ``` y en línea con backticks).
 * Un `[[algo]]` dentro de un bloque de código es texto que el autor quiso literal.
 */
function outsideCode(src: string, fn: (chunk: string) => string): string {
  // Trocea alternando: no-código / código. Los grupos capturados se devuelven intactos.
  const parts = src.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  return parts.map((p, i) => (i % 2 === 1 ? p : fn(p))).join('')
}

/**
 * Markdown listo para LECTURA: los `[[ ]]` resueltos pasan a `[texto](#/m/<id>)`, que el router
 * por hash ya sabe abrir. Los que no resuelven se dejan literales a propósito: un wikilink muerto
 * no debe parecer pulsable.
 */
export function toDisplayMarkdown(src: string, ix: WikiIndex): string {
  if (!src) return src
  return outsideCode(src, (chunk) =>
    chunk.replace(WIKI, (whole, target: string, alias?: string) => {
      const hit = resolve(target, ix)
      if (!hit) return whole
      return `[${escapeLabel((alias ?? target).trim())}](#/m/${hit.id})`
    }),
  )
}

/**
 * Deshace el escape que mete el serializador de Milkdown en `[`, `]` y `_`.
 *
 * MEDIDO el 22/08/2026 sobre notas reales del corpus: al serializar, mdast-util-to-markdown aplica
 * sus patrones `unsafe` y devuelve `wal\_level` donde el autor escribió `wal_level`, y
 * `\[\[Método · algo\]\]` donde había un wikilink. Como `doSave` guarda **exactamente** lo que
 * devuelve `getMarkdown()`, eso no es cosmético: **242 de las 411 memorias vigentes (59 %) se
 * corrompían al editarlas desde el visor**, y los 263 wikilinks del corpus dejaban de resolver,
 * porque `WIKI` busca `[[` literal y `\[\[` no casa (verificado: 1 coincidencia pasa a 0).
 *
 * Por qué aquí y no en el serializador: configurarlo por dentro exigía sobreescribir el handler de
 * `text` en el contexto de Milkdown (sus patrones `unsafe` se concatenan y no se pueden retirar), y
 * al intentarlo el editor dejaba de montar con `contextNotFound`. Esto es una función pura, se
 * prueba sola y no puede tumbar el editor.
 *
 * Solo estos tres caracteres. El resto del escape se respeta, así que un `*` o un `#` que el autor
 * quiso literales siguen protegidos.
 */
export const unescapeMarkdown = (src: string): string =>
  src ? src.replace(/\\([[\]_])/g, '$1') : src

/**
 * Ids a los que apunta el markdown, para materializarlos como relaciones al guardar.
 * Cuenta tanto los `[[ ]]` como los enlaces `](#/m/<id>)` que ya insertó el autocompletado.
 */
export function extractLinkedIds(src: string, ix: WikiIndex): string[] {
  const out = new Set<string>()
  if (!src) return []
  outsideCode(src, (chunk) => {
    for (const m of chunk.matchAll(WIKI)) {
      const hit = resolve(m[1], ix)
      if (hit) out.add(hit.id)
    }
    for (const m of chunk.matchAll(/\]\(#\/m\/([0-9a-f-]{8,})\)/gi)) {
      const hit = resolve(m[1], ix)
      if (hit) out.add(hit.id)
    }
    return chunk
  })
  return [...out]
}
