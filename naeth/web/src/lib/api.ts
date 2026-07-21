import type { Status, TreeRow, MemoryDetail, MemoryRow, Relation } from './types'

// fetch sin caché (visor en vivo) + JSON tipado.
const j = async <T>(url: string): Promise<T> =>
  (await fetch(url, { cache: 'no-store' })).json()

export const getStatus = () => j<Status>('/api/status')
export const getTree = () => j<TreeRow[]>('/api/tree')
export const getMemory = (id: string) => j<MemoryDetail>('/api/memory/' + id)
export const search = (q: string, semantic = true) =>
  j<{ hits: MemoryRow[] }>(
    `/api/search?q=${encodeURIComponent(q)}&semantic=${semantic}`,
  )

// Editar = nueva versión (ADD-only). Se mandan TODOS los campos para no perder metadatos.
export interface SupersedeBody {
  content: string
  title?: string | null
  memory_type?: string
  tags?: string[]
  path?: string | null
  metadata?: Record<string, unknown>
}
export const supersede = (id: string, body: SupersedeBody) =>
  fetch('/api/memory/' + id + '/supersede', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json() as Promise<{ memory: MemoryRow; created: boolean }>)

// --- Relaciones del grafo (editor [[ ]] + Fase 0) ---
export const getRelations = (id: string) => j<Relation[]>('/api/memory/' + id + '/relations')
export const addRelation = (source_id: string, target_id: string, predicate = 'links_to') =>
  fetch('/api/relation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source_id, target_id, predicate }),
  }).then((r) => r.json())
export const delRelation = (id: string) =>
  fetch('/api/relation/' + id, { method: 'DELETE' }).then((r) => r.json())
