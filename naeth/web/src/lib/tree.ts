import type { TreeRow } from './types'
import type { SortMode } from './prefs.svelte'

// El segundo nivel del path es el SUBTEMA (`naeth/viewer`, `cenit/build`). Se llamaba "origen" y
// valia `code` o `chat`, pero ese esquema se derogo el 21/07/2026: quien escribio cada nota lo
// registra el campo `author`, no la ruta.
export interface Subtopic { subtopic: string; leaves: TreeRow[]; mod: string; d: string }
export interface Project { proj: string; subtopics: Subtopic[]; mod: string; d: string }

const maxDate = (arr: TreeRow[]) =>
  arr.reduce((mx, x) => { const d = String(x.created_at || ''); return d > mx ? d : mx }, '')

const groupDate = (arr: TreeRow[], sort: SortMode) =>
  arr.map((x) => String(x.created_at || '')).reduce(
    (acc, d) => (sort === 'date-asc' ? (acc === '' || d < acc ? d : acc) : d > acc ? d : acc), '')

const cmpDate = (a: string, b: string) => String(a || '').localeCompare(String(b || ''))

function orderCmp(nameA: string, nameB: string, dA: string, dB: string, sort: SortMode) {
  if (sort === 'az') return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
  return (sort === 'date-asc' ? 1 : -1) * cmpDate(dA, dB)
}

function sortLeaves(arr: TreeRow[], sort: SortMode) {
  arr.sort((a, b) =>
    sort === 'az'
      ? String(a.title || '').localeCompare(String(b.title || ''), 'es', { sensitivity: 'base' })
      : (sort === 'date-asc' ? 1 : -1) * cmpDate(String(a.created_at || ''), String(b.created_at || '')))
  return arr
}

export function buildTree(rows: TreeRow[], sort: SortMode): Project[] {
  const pm = new Map<string, Map<string, TreeRow[]>>()
  for (const m of rows) {
    const parts = (m.path || '(sin path)').split('/')
    const proj = parts[0] || '(sin path)'
    const subtopic = parts[1] || '·'
    if (!pm.has(proj)) pm.set(proj, new Map())
    const sm = pm.get(proj)!
    if (!sm.has(subtopic)) sm.set(subtopic, [])
    sm.get(subtopic)!.push(m)
  }
  const projects: Project[] = []
  for (const [proj, sm] of pm) {
    const subtopics: Subtopic[] = []
    let all: TreeRow[] = []
    for (const [subtopic, leaves] of sm) {
      sortLeaves(leaves, sort)
      all = all.concat(leaves)
      subtopics.push({ subtopic, leaves, mod: maxDate(leaves), d: groupDate(leaves, sort) })
    }
    subtopics.sort((a, b) => orderCmp(a.subtopic, b.subtopic, a.d, b.d, sort))
    projects.push({ proj, subtopics, mod: maxDate(all), d: groupDate(all, sort) })
  }
  projects.sort((a, b) => orderCmp(a.proj, b.proj, a.d, b.d, sort))
  return projects
}
