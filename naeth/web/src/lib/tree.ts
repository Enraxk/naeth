import type { TreeRow } from './types'
import type { SortMode } from './prefs.svelte'

export interface Origin { origin: string; leaves: TreeRow[]; mod: string; d: string }
export interface Project { proj: string; origins: Origin[]; mod: string; d: string }

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
    const origin = parts[1] || '·'
    if (!pm.has(proj)) pm.set(proj, new Map())
    const om = pm.get(proj)!
    if (!om.has(origin)) om.set(origin, [])
    om.get(origin)!.push(m)
  }
  const projects: Project[] = []
  for (const [proj, om] of pm) {
    const origins: Origin[] = []
    let all: TreeRow[] = []
    for (const [origin, leaves] of om) {
      sortLeaves(leaves, sort)
      all = all.concat(leaves)
      origins.push({ origin, leaves, mod: maxDate(leaves), d: groupDate(leaves, sort) })
    }
    origins.sort((a, b) => orderCmp(a.origin, b.origin, a.d, b.d, sort))
    projects.push({ proj, origins, mod: maxDate(all), d: groupDate(all, sort) })
  }
  projects.sort((a, b) => orderCmp(a.proj, b.proj, a.d, b.d, sort))
  return projects
}
