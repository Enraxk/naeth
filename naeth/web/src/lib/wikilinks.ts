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
//   path completo       9   [[krepis/status]], [[cenit/design]]  (añadido el 04/09/2026)
//
// La forma `path` se midió aparte, el 04/09/2026: recupera 7 destinos que hasta entonces se
// quedaban en texto muerto, y verificado destino a destino contra el corpus entero no cambia
// ni pierde ninguno de los que ya resolvían (7 ganan, 0 pierden, 0 cambian).
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
  /** Por `path` completo (`proyecto/subtema`). Ver la pasada 5 de `resolve`. */
  byPath: Map<string, TreeRow[]>
  /** [clave normalizada, slug, fila] por orden, para las pasadas por prefijo. */
  entries: { key: string; slug: string; row: TreeRow }[]
}

export interface Resolved {
  id: string
  /** Había más de un candidato: se eligió el más reciente. */
  ambiguous: boolean
  /** Cuántos candidatos había. Solo se rellena cuando `ambiguous`, y sirve para decirlo con un
   *  número en vez de con un "varios" que no se puede comprobar. */
  n?: number
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

/**
 * Empaqueta un destino elegido entre `total` candidatos.
 *
 * `n` SOLO viaja cuando de verdad hubo mas de uno. No es tacaneria: el objeto que devuelve
 * `resolve` es contrato probado con `toEqual`, y meter un campo constante en el caso normal
 * obligaria a tocar todos los tests del camino feliz sin que ninguno pruebe nada nuevo.
 */
const many = (id: string, total: number): Resolved =>
  total > 1 ? { id, ambiguous: true, n: total } : { id, ambiguous: false }

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
  const byPath = new Map<string, TreeRow[]>()
  const entries: WikiIndex['entries'] = []
  for (const r of rows) {
    if (r.title) {
      const k = norm(r.title)
      const s = slugify(r.title)
      push(byTitle, k, r)
      push(bySlug, s, r)
      entries.push({ key: k, slug: s, row: r })
    }
    // El path se indexa aunque la fila no tenga titulo: una nota sin titular sigue viviendo en
    // su path, y es justo la que mas falta hace poder alcanzar por algun sitio.
    if (r.path) push(byPath, norm(r.path), r)
    byId.set(r.id.toLowerCase(), r)
    push(byShort, r.id.replace(/-/g, '').slice(0, 8).toLowerCase(), r)
  }
  return { byTitle, byId, byShort, bySlug, byPath, entries }
}

/** De varios candidatos gana el título MÁS CORTO: es el que menos sobra tras el prefijo. */
const bestByPrefix = (cands: TreeRow[]): Resolved => {
  const sorted = [...cands].sort(
    (a, b) => (a.title?.length ?? 0) - (b.title?.length ?? 0) || newest(a, b),
  )
  return many(sorted[0].id, cands.length)
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
      return many(sorted[0].id, cands.length)
    }
    // Un uuid con forma válida que no está en el árbol apunta a una versión ya superseded:
    // no se inventa un destino por parecido de texto.
    if (raw.includes('-')) return null
  }

  // 3) título exacto. Con duplicados gana el más reciente.
  const byT = ix.byTitle.get(key)
  if (byT?.length) return many([...byT].sort(newest)[0].id, byT.length)

  // 4) slug exacto
  const byS = ix.bySlug.get(slug)
  if (byS?.length) return many([...byS].sort(newest)[0].id, byS.length)

  // 5) PATH completo, `proyecto/subtema`. Es una convención que Eneko ya usaba y que este
  // resolutor no contemplaba, así que `[[krepis/status]]` y `[[cenit/design]]` no resolvían nunca.
  //
  // La guarda de la barra es lo que hace el cambio seguro: sin `/` no se entra aquí y el camino es
  // exactamente el de antes, así que ningún destino que hoy resuelve puede cambiar de respuesta.
  // Con `/` hoy se llegaba a la pasada de prefijo, donde `slugify('cenit/design')` da
  // `cenit-design` y no casa con ningún título, o sea que se devolvía `null`: esta pasada solo
  // puede ganar destinos, nunca perderlos.
  //
  // ⚠ UN PATH NO IDENTIFICA UNA NOTA, y por eso el desempate importa. Medido el 04/09/2026 sobre
  // las 520 vigentes: 81 paths distintos, y **488 de 520 (94%) viven en un path compartido**, con
  // mediana de 3 notas por path. `[[krepis/status]]` da 1, pero `[[cenit/design]]` da 5.
  // Gana la MÁS RECIENTE porque un enlace por path dice "el estado actual de este tema", no "esta
  // nota concreta": para una nota concreta se escribe su título. Y sale `ambiguous`, que el camino
  // de lectura convierte en un aviso, para que la elección no sea silenciosa.
  // El caso que mejor funciona es el que motivó todo esto: de los 23 paths que acaban en
  // `/status`, 18 son unívocos.
  if (raw.includes('/')) {
    const byP = ix.byPath.get(key)
    if (byP?.length) return many([...byP].sort(newest)[0].id, byP.length)
  }

  // 6) y 7) prefijo de título o de slug, la forma más común en el corpus, y por eso se acepta
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
      const label = escapeLabel((alias ?? target).trim())
      // Un destino ambiguo se abre igual, pero LO DICE. `ambiguous` existia desde el principio y
      // no lo miraba nadie; se estrena al añadir la resolucion por path, que es la via que mas
      // ambiguedad puede generar (94% de las notas comparten path con otra).
      // Medido el 04/09/2026 antes de decidir el aviso: solo 2 de 316 wikilinks resueltos son
      // ambiguos, o sea el 1%. Con esa frecuencia el aviso informa y no estorba; si algun dia
      // sube, hay que replantearlo en vez de acostumbrarse a ignorarlo.
      return hit.ambiguous
        ? `[${label}](#/m/${hit.id} "${hit.n} destinos posibles: se abre el mas reciente")`
        : `[${label}](#/m/${hit.id})`
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
