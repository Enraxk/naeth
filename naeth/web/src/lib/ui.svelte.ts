// Estado de UI transversal (responsive): el cajón (drawer) de la sidebar en móvil.
export const ui = $state<{ drawer: boolean }>({ drawer: false })
export function toggleDrawer() { ui.drawer = !ui.drawer }
export function closeDrawer() { ui.drawer = false }

/**
 * La memoria de la que se habla ahora mismo, sea cual sea la vista que lo diga.
 *
 * Es lo que cose el árbol y el grafo: pasar el ratón por una fila de la sidebar resalta ese nodo en
 * el grafo, y pasarlo por un nodo del grafo resalta esa fila. Vive aquí y no dentro de ninguna de
 * las dos porque ninguna es dueña del otro: son dos maneras de mirar el mismo corpus, y esto es el
 * hilo que las hace sentirse una sola cosa.
 *
 * NO es la selección. La selección persiste y navega; esto se enciende y se apaga con el ratón, y
 * no cambia la ruta ni carga nada.
 */
export const resalte = $state<{ id: string | null; desde: Origen }>({ id: null, desde: null })

/** De donde viene el resalte. El grafo solo sigue con la camara lo que se senala desde el arbol:
 *  si siguiera lo que senala el raton sobre el propio lienzo, moveria el nodo fuera del cursor. */
export type Origen = 'arbol' | 'grafo' | null

export function resaltar(id: string | null, desde: Exclude<Origen, null> = 'grafo') {
  if (resalte.id === id) return
  resalte.id = id
  resalte.desde = id ? desde : null
}
