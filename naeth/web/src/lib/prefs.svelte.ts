import { SvelteSet } from 'svelte/reactivity'

export type SortMode = 'az' | 'date-desc' | 'date-asc'

function arr(k: string): string[] {
  try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] }
}

// colapsos del árbol (reactivo): clave "p:<proj>" y "o:<proj>/<origin>"
export const collapsed = new SvelteSet<string>(arr('naeth-collapsed'))
export function saveCollapsed() {
  try { localStorage.setItem('naeth-collapsed', JSON.stringify([...collapsed])) } catch {}
}

export const prefs = $state<{ sort: SortMode; side: number }>({
  sort: (localStorage.getItem('naeth-sort') as SortMode) || 'az',
  side: parseInt(localStorage.getItem('naeth-side') || '', 10) || 288,
})
export function setSort(s: SortMode) {
  prefs.sort = s
  localStorage.setItem('naeth-sort', s)
}
export function setSide(w: number) {
  prefs.side = w
  localStorage.setItem('naeth-side', String(w))
}
