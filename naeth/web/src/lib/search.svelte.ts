import { search as apiSearch } from './api'
import type { TreeRow } from './types'
import { data } from './data.svelte'
import { navigate } from './router.svelte'

type Kind = 'type' | 'tag' | 'project' | 'source'
export type Hit =
  | { cmd: false; row: TreeRow }
  | { cmd: true; kind: Kind; value: string; n: number }

const PREFIX: Record<Kind, string> = { type: '@', tag: '#', project: '/', source: ':' }

export const qo = $state<{ query: string; open: boolean; hits: Hit[]; active: number; label: string; focusReq: number }>({
  query: '', open: false, hits: [], active: -1, label: '', focusReq: 0,
})

let seq = 0
let timer: ReturnType<typeof setTimeout>

function parseQuery(raw: string) {
  const m = raw.match(/^([@#/:])(\S*)\s*([\s\S]*)$/)
  if (m) return { kind: ({ '@': 'type', '#': 'tag', '/': 'project', ':': 'source' } as Record<string, Kind>)[m[1]], key: m[2].toLowerCase(), text: m[3].trim() }
  return { kind: null as Kind | null, key: '', text: raw }
}
const rows = () => data.tree ?? []
const originOf = (path: string | null) => (path || '(sin path)').split('/')[1] || '·'

function cmdValues(kind: Kind): [string, number][] {
  const m = new Map<string, number>()
  for (const x of rows()) {
    if (kind === 'type') { const v = x.memory_type || '?'; m.set(v, (m.get(v) || 0) + 1) }
    else if (kind === 'project') { const v = (x.path || '(sin path)').split('/')[0]; m.set(v, (m.get(v) || 0) + 1) }
    else if (kind === 'source') { const v = originOf(x.path); m.set(v, (m.get(v) || 0) + 1) }
    else for (const t of x.tags || []) m.set(t, (m.get(t) || 0) + 1)
  }
  return [...m.entries()]
}
function setHits(hits: Hit[], label = '') {
  qo.hits = hits; qo.label = label; qo.active = hits.length ? 0 : -1; qo.open = true
}

export function showRecents() {
  const r = rows()
  if (!r.length) { qo.open = false; return }
  const rec = [...r].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 8)
  setHits(rec.map((row) => ({ cmd: false, row })), 'Recientes')
}

export async function doSearch(raw: string) {
  raw = (raw || '').trim()
  if (!raw) { showRecents(); return }
  const { kind, key, text } = parseQuery(raw)
  if (kind && !text) {
    const values = cmdValues(kind)
    const exact = key !== '' && values.some(([v]) => v.toLowerCase() === key)
    if (!exact) {
      const opts = values.filter(([v]) => v.toLowerCase().startsWith(key)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      const head = { type: 'Tipos', tag: 'Etiquetas', project: 'Proyectos', source: 'Fuentes' }[kind]
      setHits(opts.map(([value, n]) => ({ cmd: true, kind, value, n })), head)
      return
    }
  }
  const s = ++seq
  let hits: TreeRow[] = []
  if (text) {
    const r = await apiSearch(text, true)
    if (s !== seq) return
    hits = (r.hits || []) as unknown as TreeRow[]
  } else if (kind) {
    hits = rows().map((x) => ({ ...x }))
  } else { qo.open = false; return }
  if (kind === 'type') hits = hits.filter((h) => String(h.memory_type || '').toLowerCase().startsWith(key))
  else if (kind === 'project') hits = hits.filter((h) => String(h.path || '').toLowerCase().startsWith(key))
  else if (kind === 'source') hits = hits.filter((h) => originOf(h.path).toLowerCase().startsWith(key))
  else if (kind === 'tag') hits = hits.filter((h) => (h.tags || []).some((t) => t.toLowerCase().includes(key)))
  setHits(hits.slice(0, 50).map((row) => ({ cmd: false, row })))
}

export function setQuery(q: string) {
  qo.query = q
  clearTimeout(timer)
  timer = setTimeout(() => doSearch(q), 200)
}
export function openSearch(prefill?: string) {
  if (prefill != null) { qo.query = prefill; qo.focusReq++; doSearch(prefill) }
  else if (!qo.query.trim()) showRecents()
  else qo.open = true
}
export function closeSearch() { qo.open = false; qo.active = -1 }
export function move(delta: number) {
  if (!qo.hits.length) return
  qo.active = (qo.active + delta + qo.hits.length) % qo.hits.length
}
export function choose(i: number) {
  const h = qo.hits[i]
  if (!h) return
  if (h.cmd) { qo.query = PREFIX[h.kind] + h.value; doSearch(qo.query); return }
  closeSearch()
  navigate('memoria', h.row.id)
}
export { PREFIX }
