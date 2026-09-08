// Router por location.hash (sobrevive a recargas): #/inicio, #/m/<id>, #/grafo…
export type View = 'inicio' | 'grafo' | 'nueva' | 'estado' | 'ajustes' | 'memoria'
const VIEWS = ['inicio', 'grafo', 'nueva', 'estado', 'ajustes']

function parse(): { view: View; id: string | null } {
  // La QUERY del hash no decide la vista: `#/grafo?reset` es la vista `grafo`. Sin este `split`,
  // `grafo?reset` no esta en VIEWS y cae a `inicio`, que es el mismo modo de fallo que ya obligo a
  // añadir la rama de `grafo/<id>` de aqui abajo, y con el mismo sintoma: la salida de emergencia
  // del panel borraba los ajustes y te dejaba en otra pantalla, o sea que parecia no funcionar.
  const h = location.hash.replace(/^#\/?/, '').split('?')[0]
  if (h.startsWith('m/')) return { view: 'memoria', id: h.slice(2) }
  // `#/grafo/<id>` abre el grafo global ENFOCADO en una memoria, que es a donde lleva el boton
  // del mini grafo de la ficha. Sin esta rama, `grafo/abc` no esta en VIEWS y cae a `inicio`:
  // el boton parecia no hacer nada, que es el peor modo de fallo de un enlace.
  if (h.startsWith('grafo/')) return { view: 'grafo', id: h.slice(6) }
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
  const hash =
    view === 'memoria' && id ? `#/m/${id}` : view === 'grafo' && id ? `#/grafo/${id}` : `#/${view}`
  if (location.hash === hash) update()
  else location.hash = hash
}
