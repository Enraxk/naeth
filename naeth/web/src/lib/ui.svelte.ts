// Estado de UI transversal (responsive): el cajón (drawer) de la sidebar en móvil.
export const ui = $state<{ drawer: boolean }>({ drawer: false })
export function toggleDrawer() { ui.drawer = !ui.drawer }
export function closeDrawer() { ui.drawer = false }

/** De dónde viene el resalte. El grafo solo persigue con la cámara lo que se señala desde el
 *  árbol: si persiguiera lo que señala el ratón sobre el propio lienzo, movería el nodo fuera
 *  del cursor. */
export type Origen = 'arbol' | 'grafo' | null

/**
 * De qué se está hablando ahora mismo, lo diga la vista que lo diga.
 *
 * Es el hilo que cose el árbol y el grafo. Ninguno de los dos es dueño del otro: son dos maneras de
 * mirar el mismo corpus, y esto es lo que las hace sentirse una sola cosa. Pasar el ratón por una
 * fila resalta ese nodo en el grafo y lleva la cámara hasta él; pasarlo por una carpeta enciende
 * todo lo que hay dentro; pasarlo por un nodo del grafo enciende su fila en el árbol.
 *
 * NO es la selección. La selección persiste y navega; esto se enciende y se apaga con el ratón, no
 * cambia la ruta y no carga nada.
 *
 * ⚠ EL ÁRBOL ENCIENDE, NO RECORTA, y es una decisión de producto tomada el 05/09/2026 con un
 * número delante: 114 de las 479 aristas (el 24%) cruzan de un proyecto a otro, y el árbol no puede
 * enseñarlas porque agrupa justo por proyecto. Si señalar una carpeta escondiera el resto del
 * grafo, dejarías de ver hacia dónde sale esa carpeta, que es lo único que el grafo aporta sobre el
 * árbol. Así que lo señalado se enciende con sus vecinos y lo demás se queda de fondo, apagado.
 */
export const resalte = $state<{
  id: string | null
  desde: Origen
  /** Ids encendidos a la vez, al señalar una carpeta del árbol. */
  grupo: string[] | null
  /** Cómo se llama esa carpeta. Lo dice la franja, porque en el lienzo no cabe. */
  etiqueta: string | null
  /** El puntero está sobre la sidebar. Gobierna el apagado del resto de la aplicación. */
  enArbol: boolean
}>({ id: null, desde: null, grupo: null, etiqueta: null, enArbol: false })

export function resaltar(id: string | null, desde: Exclude<Origen, null> = 'grafo') {
  if (resalte.id === id && !resalte.grupo) return
  resalte.id = id
  resalte.desde = id ? desde : null
  // Señalar una nota apaga el grupo: son dos maneras de decir "esto", y a la vez no significan
  // nada. Fijarse en una nota concreta gana sobre estar mirando su carpeta.
  if (id) {
    resalte.grupo = null
    resalte.etiqueta = null
  }
}

/** Enciende un puñado de memorias a la vez: lo que hay dentro de la carpeta que se señala. */
export function resaltarGrupo(ids: string[] | null, etiqueta: string | null = null) {
  resalte.grupo = ids && ids.length ? ids : null
  resalte.etiqueta = resalte.grupo ? etiqueta : null
  if (resalte.grupo) {
    resalte.id = null
    resalte.desde = 'arbol'
  }
}

export function entrarArbol(dentro: boolean) {
  if (resalte.enArbol === dentro) return
  resalte.enArbol = dentro
  if (!dentro) {
    resalte.grupo = null
    resalte.etiqueta = null
    if (resalte.desde === 'arbol') {
      resalte.id = null
      resalte.desde = null
    }
  }
}
