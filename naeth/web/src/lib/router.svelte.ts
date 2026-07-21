// Router por location.hash (sobrevive a recargas): #/inicio, #/m/<id>, #/grafo…
export type View = 'inicio' | 'grafo' | 'nueva' | 'estado' | 'ajustes' | 'memoria'
const VIEWS = ['inicio', 'grafo', 'nueva', 'estado', 'ajustes']

function parse(): { view: View; id: string | null } {
  const h = location.hash.replace(/^#\/?/, '')
  if (h.startsWith('m/')) return { view: 'memoria', id: h.slice(2) }
  return { view: (VIEWS.includes(h) ? h : 'inicio') as View, id: null }
}

export const route = $state(parse())

function update() {
  const r = parse()
  route.view = r.view
  route.id = r.id
}
addEventListener('hashchange', update)

export function navigate(view: View, id?: string) {
  const hash = view === 'memoria' && id ? `#/m/${id}` : `#/${view}`
  if (location.hash === hash) update()
  else location.hash = hash
}
