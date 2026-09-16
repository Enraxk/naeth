// Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
// No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE
// Router por location.hash (sobrevive a recargas): #/home, #/m/<id>, #/graph…
export type View = 'home' | 'graph' | 'new' | 'status' | 'settings' | 'memory'
const VIEWS = ['home', 'graph', 'new', 'status', 'settings']

// Las rutas se llamaron en castellano hasta la 2.2026.09.3 (15/09/2026), y estan en marcadores, en
// enlaces dentro de las notas y en la memoria de quien las usa. Se aceptan y se REDIRIGEN a la
// nueva, conservando el id y la query (`#/grafo?reset` sigue borrando los ajustes del grafo).
const LEGACY: Record<string, View> = {
  inicio: 'home',
  grafo: 'graph',
  nueva: 'new',
  estado: 'status',
  ajustes: 'settings',
}

/** Traduce un hash viejo a su equivalente nuevo, o devuelve null si ya es nuevo o no es viejo. */
export function legacyHash(hash: string): string | null {
  const m = hash.match(/^#\/?([a-z]+)(\/[^?]*)?(\?.*)?$/)
  if (!m) return null
  const view = LEGACY[m[1]]
  if (!view) return null
  return `#/${view}${m[2] ?? ''}${m[3] ?? ''}`
}

function parse(): { view: View; id: string | null } {
  const redirected = legacyHash(location.hash)
  if (redirected) {
    // `replace` y no asignar a `hash`: el viejo no se queda en el historial, y el `hashchange`
    // que dispara vuelve a entrar aqui ya con el nuevo.
    location.replace(redirected)
  }
  // La QUERY del hash no decide la vista: `#/graph?reset` es la vista `graph`. Sin este `split`,
  // `graph?reset` no esta en VIEWS y cae a `home`, que es el mismo modo de fallo que ya obligo a
  // añadir la rama de `graph/<id>` de aqui abajo, y con el mismo sintoma: la salida de emergencia
  // del panel borraba los ajustes y te dejaba en otra pantalla, o sea que parecia no funcionar.
  const h = (redirected ?? location.hash).replace(/^#\/?/, '').split('?')[0]
  if (h.startsWith('m/')) return { view: 'memory', id: h.slice(2) }
  // `#/graph/<id>` abre el grafo global ENFOCADO en una memoria, que es a donde lleva el boton
  // del mini grafo de la ficha. Sin esta rama, `graph/abc` no esta en VIEWS y cae a `home`:
  // el boton parecia no hacer nada, que es el peor modo de fallo de un enlace.
  if (h.startsWith('graph/')) return { view: 'graph', id: h.slice(6) }
  return { view: (VIEWS.includes(h) ? h : 'home') as View, id: null }
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
    view === 'memory' && id ? `#/m/${id}` : view === 'graph' && id ? `#/graph/${id}` : `#/${view}`
  if (location.hash === hash) update()
  else location.hash = hash
}
