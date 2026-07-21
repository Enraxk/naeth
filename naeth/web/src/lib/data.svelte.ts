import { getTree, getStatus } from './api'
import type { TreeRow, Status } from './types'
import { collapsed } from './prefs.svelte'

export const data = $state<{ tree: TreeRow[] | null; status: Status | null; online: boolean }>({
  tree: null,
  status: null,
  online: false,
})

let dataSig: string | null = null
let refreshing = false
const autoExpanded = new Set<string>() // ramas abiertas por el "reveal" (no persisten)

export async function loadTree() {
  let d: TreeRow[] | undefined
  try { d = await getTree() } catch { return }       // no pisar datos buenos si falla
  if (Array.isArray(d)) data.tree = d
}

async function refreshData() {
  if (refreshing) return
  refreshing = true
  try { await loadTree() } finally { refreshing = false }
}

export async function loadStatus() {
  let s: Status
  try { s = await getStatus() } catch { data.online = false; return }
  data.online = true
  if (data.tree === null) loadTree()                 // auto-cura: el árbol nunca cargó
  data.status = s
  const c = s.counts
  const sig = `${c.memory_total}/${c.memory_current}/${c.relations}/${c.tombstones}`
  if (dataSig !== null && sig !== dataSig) refreshData()  // datos nuevos -> recargar árbol
  dataSig = sig
}

export function startPolling() {
  loadTree()
  loadStatus()
  setInterval(loadStatus, 4000)
}

// reveal-in-tree: abre la rama de una memoria (solo en pantalla, no persiste)
export function revealInTree(path: string | null) {
  const parts = (path || '(sin path)').split('/')
  const proj = parts[0] || '(sin path)'
  const origin = parts[1] || '·'
  for (const key of ['p:' + proj, 'o:' + proj + '/' + origin]) {
    if (collapsed.delete(key)) autoExpanded.add(key)
  }
}
// al ir a Inicio: cierra lo que abrió el reveal (respeta lo abierto a mano)
export function collapseAuto() {
  if (!autoExpanded.size) return
  for (const k of autoExpanded) collapsed.add(k)
  autoExpanded.clear()
}
export function untrackAuto(key: string) {
  autoExpanded.delete(key) // el usuario toma control del grupo al togglear a mano
}
