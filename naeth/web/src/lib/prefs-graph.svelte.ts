// Las preferencias del grafo: lo que antes eran constantes del codigo y ahora son mandos de Eneko.
//
// POR QUE EXISTE. Cada valor del grafo (el umbral del texto, el radio de un nodo, la distancia de
// una arista) costo un banco de pruebas para decidirse, y aun asi quedaba clavado en el codigo con
// UN valor para siempre. Este modulo convierte esa discusion en un deslizador: el visor pasa a ser
// el banco, y el valor se elige mirando el grafo de verdad.
//
// SIGUE EL PATRON DE `prefs.svelte.ts`, que ya guarda los colapsados del arbol, el orden y el ancho
// del panel. No lo sustituye: aquello son preferencias de la aplicacion y esto del dibujo del grafo,
// y mezclarlas obligaria a leer y escribir una bola de opciones para cambiar el ancho de una barra.
//
// EL CATALOGO ES LA FUENTE DE VERDAD. Un mando que no este en `CATALOG` no existe: no tiene rango,
// no se guarda y el panel no lo pinta. Eso es a proposito, y es lo que permite validar lo guardado
// sin escribir la validacion dos veces.
//
// ⚠ LA VALIDACION AL ARRANCAR NO ES OPCIONAL, y es la parte de este fichero que hay que entender
// antes de tocarlo. El panel que sirve para arreglar el grafo VIVE DENTRO del grafo. Si un valor
// imposible guardado (un `nodeMax` de cero, un `textFrom` infinito) deja el lienzo en blanco, no
// queda ninguna via para entrar a corregirlo: el propio panel se ha ido con el grafo. Por eso todo
// lo que sale del almacen se comprueba contra su rango y lo que no cuadra cae a fabrica en silencio.
// La otra mitad de esa red es `#/graph?reset`, en la fase 4.

/**
 * Los grupos, en el orden en que los enseña el panel.
 *
 * Es una lista y no solo un tipo porque la necesitan los dos lados: el panel para pintar una seccion
 * por grupo (tipada, asi que olvidarse de uno no compila) y su test para comprobar que ninguno se
 * queda vacio. Escrita dos veces, añadir un grupo obliga a acordarse en tres sitios, y ya fallo a la
 * primera: `experimental` entro en el catalogo y el test cayo por no estar en su copia de la lista.
 */
export const GROUPS = ['text', 'nodes', 'edges', 'physics', 'experimental'] as const
export type Group = (typeof GROUPS)[number]

type Comun = { group: Group; label: string; note?: string }
export type NumControl = Comun & { kind: 'num'; factory: number; min: number; max: number; step: number }
export type BoolControl = Comun & { kind: 'bool'; factory: boolean }
export type Control = NumControl | BoolControl

/**
 * Cada mando con su rango y su valor de fabrica.
 *
 * LOS DE FABRICA NO SON TODOS "COMO ESTABA". Los de texto, nodos y fisica si: son literalmente las
 * constantes que habia en `painter.ts` y `sim.ts`, para que sin tocar nada el grafo se vea como
 * siempre. Los de arista (flecha y tinte) son cosas NUEVAS, y nacen encendidas porque Eneko las
 * eligio viendolas en `bench/canal-vivo.html` el 06/09: "las flechas en 5 px me gustan porque no se
 * notan mucho pero ayudan", a media arista, y el tinte "en tonos mas apagados que no resalten
 * tanto", que medido es el 30% (contraste 5,5:1 contra el fondo, donde el gris de hoy da 5,2:1).
 */
export const CATALOG = {
  // ── Texto ──────────────────────────────────────────────────────────────────────────────
  textFrom: {
    kind: 'num', group: 'text', factory: 0.75, min: 0, max: 3, step: 0.05,
    label: 'Los nombres empiezan a salir',
    note: 'Aumento a partir del cual asoma el texto de los vecinos.',
  },
  textFull: {
    kind: 'num', group: 'text', factory: 1.65, min: 0, max: 4, step: 0.05,
    label: 'Los nombres se ven del todo',
    note: 'Por debajo de este aumento el texto va a media luz.',
  },
  labelCap: {
    kind: 'num', group: 'text', factory: 26, min: 0, max: 120, step: 1,
    label: 'Nombres como mucho',
    note: 'Con algo señalado. Mas de esto es un muro de texto.',
  },

  // ── Nodos ──────────────────────────────────────────────────────────────────────────────
  nodeScale: {
    kind: 'num', group: 'nodes', factory: 1, min: 0.3, max: 3, step: 0.05,
    label: 'Tamaño de los nodos',
  },
  nodeExponent: {
    kind: 'num', group: 'nodes', factory: 0.6, min: 0, max: 1, step: 0.05,
    label: 'Cuanto crecen al acercarse',
    note: '0 es tamaño fijo en pantalla, 1 es tamaño fijo en el mundo.',
  },
  nodeMin: {
    kind: 'num', group: 'nodes', factory: 1.6, min: 0.5, max: 10, step: 0.1,
    label: 'Radio minimo en pantalla',
  },
  nodeMax: {
    kind: 'num', group: 'nodes', factory: 40, min: 10, max: 120, step: 1,
    label: 'Radio maximo en pantalla',
  },

  // ── Aristas ────────────────────────────────────────────────────────────────────────────
  arrows: {
    kind: 'bool', group: 'edges', factory: true,
    label: 'Enseñar la direccion',
    note: 'De 501 relaciones, cero son reciprocas: la direccion nunca sobra.',
  },
  arrowPx: {
    kind: 'num', group: 'edges', factory: 5, min: 2, max: 16, step: 1,
    label: 'Tamaño de la punta',
  },
  arrowMid: {
    kind: 'bool', group: 'edges', factory: true,
    label: 'La punta, a media arista',
    note: 'En el extremo compite con el nodo y con lo que se cruce ahi.',
  },
  tinted: {
    kind: 'bool', group: 'edges', factory: true,
    label: 'Color por tipo de relacion',
  },
  tintStrength: {
    kind: 'num', group: 'edges', factory: 0.3, min: 0, max: 1, step: 0.05,
    label: 'Fuerza del color',
    note: 'A 0 es el gris de siempre. A 0,3 pesa lo mismo que el gris pero informa.',
  },

  // ── Fisica ─────────────────────────────────────────────────────────────────────────────
  //
  // Van en continuo porque la fase 0 lo midio (`bench/fuerzas.html`, 06/09): reconfigurar una fuerza
  // viva cuesta entre 0,05 y 0,2 ms, contra los 121-269 ms de reconstruir el simulador.
  distance: {
    kind: 'num', group: 'physics', factory: 34, min: 10, max: 200, step: 1,
    label: 'Largo de una arista',
  },
  repulsion: {
    kind: 'num', group: 'physics', factory: -38, min: -300, max: -5, step: 1,
    label: 'Cuanto se repelen',
    note: 'Negativo. Cuanto mas bajo, mas se separa todo.',
  },
  damping: {
    kind: 'num', group: 'physics', factory: 0.35, min: 0.05, max: 0.9, step: 0.05,
    label: 'Frenado',
    note: 'Alto se para antes; bajo se mueve mas rato.',
  },

  // ── Experimental ───────────────────────────────────────────────────────────────────────
  //
  // Lo que NO existia ni como constante. Van aparte y marcados porque son los que pueden dejar el
  // grafo raro, y por eso la fase 4 trae ademas `#/graph?reset`: un mando que puede estropear la
  // vista necesita una salida que funcione con la vista ya estropeada.
  //
  // TODOS NACEN NEUTROS (0 de curvatura, opacidades a 1, separacion a 0). Encendidos de fabrica
  // serian un rediseño colado por la puerta de atras.
  curvature: {
    kind: 'num', group: 'experimental', factory: 0, min: 0, max: 0.4, step: 0.02,
    label: 'Curvar las aristas',
    note: 'A 0 son rectas. Curvadas se distinguen dos vinculos entre el mismo par.',
  },
  opRelation: {
    kind: 'num', group: 'experimental', factory: 1, min: 0, max: 1, step: 0.05,
    label: 'Peso de las relaciones',
  },
  opWikilink: {
    kind: 'num', group: 'experimental', factory: 1, min: 0, max: 1, step: 0.05,
    label: 'Peso de los wikilinks',
  },
  opSemantic: {
    kind: 'num', group: 'experimental', factory: 1, min: 0, max: 1, step: 0.05,
    label: 'Peso de los vecinos semanticos',
    note: 'Bajar una capa sin apagarla: se queda de fondo en vez de desaparecer.',
  },
  splitProjects: {
    kind: 'num', group: 'experimental', factory: 0, min: 0, max: 1, step: 0.05,
    label: 'Separar por proyecto',
    note: 'Empuja a las memorias de distinto proyecto. El 24% de los vinculos cruzan, asi que subirlo mucho estira el grafo.',
  },
} as const satisfies Record<string, Control>

export type Key = keyof typeof CATALOG

/**
 * Los valores vivos, con el tipo ANCHO.
 *
 * ⚠ Se deriva de `kind` y no de `factory` a proposito. El `as const` del catalogo (que es lo que
 * permite tipar las claves) congela cada fabrica en su literal, asi que `[K]['factory']` daria
 * `tintStrength: 0.3` y `arrows: true`, o sea un mando que solo admite el valor que ya tiene. Lo
 * destapo `svelte-check` con siete errores en cuanto un test intento poner otro numero.
 */
export type Values = { [K in Key]: (typeof CATALOG)[K]['kind'] extends 'bool' ? boolean : number }

export const KEYS = Object.keys(CATALOG) as Key[]

/** Los valores de fabrica, recien hechos. */
export function factory(): Values {
  const v = {} as Record<string, unknown>
  for (const k of KEYS) v[k] = CATALOG[k].factory
  return v as Values
}

/**
 * De donde salen y a donde van los valores guardados.
 *
 * Existe como interfaz y no como llamadas sueltas a `localStorage` por una razon concreta y ya
 * decidida: cuando Naeth tenga varios usuarios (el frente F3), las preferencias tendran que viajar
 * con la persona y no con el navegador. Ese dia se cambia esta pieza y ni el catalogo ni el panel se
 * enteran.
 */
export interface Store {
  read(): unknown
  write(v: Values): void
}

const LS_KEY = 'naeth-graph'

/** Si el panel del grafo estaba abierto. Vive aqui para que `Grafo` y `Ajustes` compartan la clave. */
export const PANEL_LS = 'naeth-graph-panel'
export const PANEL_LS_LEGACY = 'naeth-grafo-panel'

/**
 * La clave y los mandos se llamaron en castellano hasta la 2.2026.09.3 (15/09/2026), y lo guardado
 * en `naeth-graph` es de quien lo ajusto mirando el grafo. Se traduce al leer, una vez, y la clave
 * vieja se deja: no se borra nada del usuario, y si vuelve a una version anterior la encuentra.
 */
const LS_KEY_LEGACY = 'naeth-grafo'
export const LEGACY_KEYS: Record<string, Key> = {
  textoDesde: 'textFrom', textoPleno: 'textFull', topeNombres: 'labelCap', escalaNodo: 'nodeScale',
  nodoExponente: 'nodeExponent', nodoMin: 'nodeMin', nodoMax: 'nodeMax', flechas: 'arrows',
  puntaPx: 'arrowPx', puntaMedio: 'arrowMid', tintado: 'tinted', tinteFuerza: 'tintStrength',
  distancia: 'distance', repulsion: 'repulsion', frenado: 'damping', curvatura: 'curvature',
  opRelacion: 'opRelation', opWikilink: 'opWikilink', opSemantica: 'opSemantic',
  separaProyectos: 'splitProjects',
}

/** Traduce un objeto guardado con las claves viejas. Lo que no sea clave vieja pasa tal cual. */
export function migrateKeys(bruto: unknown): unknown {
  if (!bruto || typeof bruto !== 'object') return bruto
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) out[LEGACY_KEYS[k] ?? k] = v
  return out
}

/** El almacen de hoy. Todo va en try/catch: en modo privado `localStorage` LANZA, no devuelve null. */
export const localStore: Store = {
  read() {
    try {
      const s = localStorage.getItem(LS_KEY)
      if (s) return JSON.parse(s)
      const viejo = localStorage.getItem(LS_KEY_LEGACY)
      if (!viejo) return null
      const migrado = migrateKeys(JSON.parse(viejo))
      localStorage.setItem(LS_KEY, JSON.stringify(migrado))
      return migrado
    } catch {
      return null
    }
  },
  write(v) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(v))
    } catch {
      // Sin sitio o sin permiso. Se pierde al recargar, y es preferible a no dejar usar el panel.
    }
  },
}

let almacen: Store = localStore

/**
 * LA SALIDA DE EMERGENCIA: `#/graph?reset` borra los ajustes ANTES de que se lea nada.
 *
 * Por que existe teniendo ya un boton de restaurar: el boton vive DENTRO del panel, y el panel vive
 * DENTRO del grafo. Si un mando experimental deja el lienzo en blanco o ilegible, el boton se va con
 * el, y la unica salida seria abrir las herramientas del navegador. Esto se escribe en la barra de
 * direcciones, que sigue ahi pase lo que pase.
 *
 * Se ejecuta al IMPORTAR el modulo, antes del `$state` de abajo, que es el unico momento en el que
 * llega a tiempo. Va en try/catch porque en el entorno `node` de los tests no hay `location`.
 */
function reseteoPorURL(): boolean {
  try {
    if (typeof location === 'undefined') return false
    const h = location.hash || ''
    if (!/[?&]reset\b/.test(h)) return false
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem(LS_KEY_LEGACY) // si no, la migracion la resucitaria al recargar
    // Se limpia de la barra para que recargar no vuelva a resetear sin querer.
    //
    // ⚠ CON `replaceState` Y NO ASIGNANDO `location.hash`. Asignar el hash dispara una navegacion, y
    // esto corre al IMPORTAR el modulo, o sea antes de que la aplicacion monte: el router procesaba
    // ese cambio a destiempo y el lienzo se quedaba sin medir, con el canvas en su tamaño por
    // defecto de 300x150 y sin pintar nada. O sea que la salida de emergencia dejaba el grafo tan
    // roto como lo habia encontrado, solo que por otro motivo. `replaceState` cambia la barra en
    // silencio, sin navegar.
    const limpio = h.replace(/[?&]reset\b/, '').replace(/[?&]$/, '')
    history.replaceState(null, '', location.pathname + location.search + limpio)
    return true
  } catch {
    return false
  }
}

export const wasReset = reseteoPorURL()

/**
 * Valida UN valor contra su mando. Devuelve el de fabrica si no cuadra.
 *
 * Se valida el tipo y el rango, no solo el tipo: un `nodeMax` de 0 es un numero perfectamente valido
 * y deja todos los nodos invisibles.
 */
export function validate<K extends Key>(k: K, v: unknown): Values[K] {
  const m = CATALOG[k] as Control
  if (m.kind === 'bool') {
    return (typeof v === 'boolean' ? v : m.factory) as Values[K]
  }
  if (typeof v !== 'number' || !Number.isFinite(v) || v < m.min || v > m.max) {
    return m.factory as Values[K]
  }
  return v as Values[K]
}

/** Lo guardado, saneado. Lo que no cuadra cae a fabrica sin avisar y sin romper nada. */
export function sanitize(bruto: unknown): Values {
  const out = factory()
  if (!bruto || typeof bruto !== 'object') return out
  const b = bruto as Record<string, unknown>
  for (const k of KEYS) if (k in b) out[k] = validate(k, b[k]) as never

  // Validacion cruzada, la unica que hay: con el minimo por encima del maximo, `screenRadius`
  // devuelve siempre el maximo y el grafo se ve raro sin que ningun valor suelto este mal.
  //
  // ⚠ HOY ES INALCANZABLE, y conviene saberlo antes de intentar cubrirla con un test: los rangos ya
  // lo impiden, porque `nodeMin` llega como mucho a 10 y `nodeMax` empieza justo en 10. Se queda
  // como red para el dia que alguien amplie uno de los dos rangos, y esa invariante la fija
  // `prefs-graph.test.ts` para que ese dia se entere alguien.
  if (out.nodeMin > out.nodeMax) {
    out.nodeMin = CATALOG.nodeMin.factory
    out.nodeMax = CATALOG.nodeMax.factory
  }
  return out
}

/** El estado vivo. Lo leen el Lienzo en cada frame y el panel para pintar sus mandos. */
export const graphPrefs = $state<Values>(sanitize(almacen.read()))

function guarda() {
  almacen.write({ ...graphPrefs })
}

/** Cambia un mando. Valida siempre: al panel se le puede colar un valor por el camino. */
export function set<K extends Key>(k: K, v: Values[K]) {
  graphPrefs[k] = validate(k, v) as never
  guarda()
}

/** Vuelve a fabrica, un grupo o entero. Es la salida de emergencia de mano. */
export function restore(group?: Group) {
  const f = factory()
  for (const k of KEYS) {
    if (group && CATALOG[k].group !== group) continue
    graphPrefs[k] = f[k] as never
  }
  guarda()
}

/** Borra lo guardado y vuelve a fabrica. La usa `?reset`, y los tests entre casos. */
export function forgetPrefs() {
  try {
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem(LS_KEY_LEGACY) // si no, la migracion la resucitaria al recargar
  } catch {
    // Da igual: lo que manda es el estado en memoria, que se restaura justo debajo.
  }
  const f = factory()
  for (const k of KEYS) graphPrefs[k] = f[k] as never
}

/** Cambia el almacen. Para los tests hoy, y para F3 el dia que las preferencias viajen. */
export function useStore(a: Store) {
  almacen = a
  const v = sanitize(a.read())
  for (const k of KEYS) graphPrefs[k] = v[k] as never
}

/**
 * Que mandos estan fuera de fabrica ahora mismo.
 *
 * Lo usa Ajustes para resumir el grafo en una linea. Es mas util que enseñar los quince valores:
 * lo que se quiere saber de un vistazo es si esto esta tocado o no, y cuanto.
 */
export function changed(): Key[] {
  const f = factory()
  return KEYS.filter((k) => graphPrefs[k] !== f[k])
}

/** Los mandos de un grupo, en el orden del catalogo. Lo usa el panel. */
export function controlsOf(group: Group): { clave: Key; mando: Control }[] {
  return KEYS.filter((k) => CATALOG[k].group === group).map((k) => ({ clave: k, mando: CATALOG[k] }))
}
