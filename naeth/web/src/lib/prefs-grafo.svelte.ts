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
// EL CATALOGO ES LA FUENTE DE VERDAD. Un mando que no este en `CATALOGO` no existe: no tiene rango,
// no se guarda y el panel no lo pinta. Eso es a proposito, y es lo que permite validar lo guardado
// sin escribir la validacion dos veces.
//
// ⚠ LA VALIDACION AL ARRANCAR NO ES OPCIONAL, y es la parte de este fichero que hay que entender
// antes de tocarlo. El panel que sirve para arreglar el grafo VIVE DENTRO del grafo. Si un valor
// imposible guardado (un `nodoMax` de cero, un `textoDesde` infinito) deja el lienzo en blanco, no
// queda ninguna via para entrar a corregirlo: el propio panel se ha ido con el grafo. Por eso todo
// lo que sale del almacen se comprueba contra su rango y lo que no cuadra cae a fabrica en silencio.
// La otra mitad de esa red es `#/grafo?reset`, en la fase 4.

/**
 * Los grupos, en el orden en que los enseña el panel.
 *
 * Es una lista y no solo un tipo porque la necesitan los dos lados: el panel para pintar una seccion
 * por grupo (tipada, asi que olvidarse de uno no compila) y su test para comprobar que ninguno se
 * queda vacio. Escrita dos veces, añadir un grupo obliga a acordarse en tres sitios, y ya fallo a la
 * primera: `experimental` entro en el catalogo y el test cayo por no estar en su copia de la lista.
 */
export const GRUPOS = ['texto', 'nodos', 'aristas', 'fisica', 'experimental'] as const
export type Grupo = (typeof GRUPOS)[number]

type Comun = { grupo: Grupo; etiqueta: string; nota?: string }
export type MandoNum = Comun & { tipo: 'num'; fabrica: number; min: number; max: number; paso: number }
export type MandoBool = Comun & { tipo: 'bool'; fabrica: boolean }
export type Mando = MandoNum | MandoBool

/**
 * Cada mando con su rango y su valor de fabrica.
 *
 * LOS DE FABRICA NO SON TODOS "COMO ESTABA". Los de texto, nodos y fisica si: son literalmente las
 * constantes que habia en `pintor.ts` y `sim.ts`, para que sin tocar nada el grafo se vea como
 * siempre. Los de arista (flecha y tinte) son cosas NUEVAS, y nacen encendidas porque Eneko las
 * eligio viendolas en `bench/canal-vivo.html` el 06/09: "las flechas en 5 px me gustan porque no se
 * notan mucho pero ayudan", a media arista, y el tinte "en tonos mas apagados que no resalten
 * tanto", que medido es el 30% (contraste 5,5:1 contra el fondo, donde el gris de hoy da 5,2:1).
 */
export const CATALOGO = {
  // ── Texto ──────────────────────────────────────────────────────────────────────────────
  textoDesde: {
    tipo: 'num', grupo: 'texto', fabrica: 0.75, min: 0, max: 3, paso: 0.05,
    etiqueta: 'Los nombres empiezan a salir',
    nota: 'Aumento a partir del cual asoma el texto de los vecinos.',
  },
  textoPleno: {
    tipo: 'num', grupo: 'texto', fabrica: 1.65, min: 0, max: 4, paso: 0.05,
    etiqueta: 'Los nombres se ven del todo',
    nota: 'Por debajo de este aumento el texto va a media luz.',
  },
  topeNombres: {
    tipo: 'num', grupo: 'texto', fabrica: 26, min: 0, max: 120, paso: 1,
    etiqueta: 'Nombres como mucho',
    nota: 'Con algo señalado. Mas de esto es un muro de texto.',
  },

  // ── Nodos ──────────────────────────────────────────────────────────────────────────────
  escalaNodo: {
    tipo: 'num', grupo: 'nodos', fabrica: 1, min: 0.3, max: 3, paso: 0.05,
    etiqueta: 'Tamaño de los nodos',
  },
  nodoExponente: {
    tipo: 'num', grupo: 'nodos', fabrica: 0.6, min: 0, max: 1, paso: 0.05,
    etiqueta: 'Cuanto crecen al acercarse',
    nota: '0 es tamaño fijo en pantalla, 1 es tamaño fijo en el mundo.',
  },
  nodoMin: {
    tipo: 'num', grupo: 'nodos', fabrica: 1.6, min: 0.5, max: 10, paso: 0.1,
    etiqueta: 'Radio minimo en pantalla',
  },
  nodoMax: {
    tipo: 'num', grupo: 'nodos', fabrica: 40, min: 10, max: 120, paso: 1,
    etiqueta: 'Radio maximo en pantalla',
  },

  // ── Aristas ────────────────────────────────────────────────────────────────────────────
  flechas: {
    tipo: 'bool', grupo: 'aristas', fabrica: true,
    etiqueta: 'Enseñar la direccion',
    nota: 'De 501 relaciones, cero son reciprocas: la direccion nunca sobra.',
  },
  puntaPx: {
    tipo: 'num', grupo: 'aristas', fabrica: 5, min: 2, max: 16, paso: 1,
    etiqueta: 'Tamaño de la punta',
  },
  puntaMedio: {
    tipo: 'bool', grupo: 'aristas', fabrica: true,
    etiqueta: 'La punta, a media arista',
    nota: 'En el extremo compite con el nodo y con lo que se cruce ahi.',
  },
  tintado: {
    tipo: 'bool', grupo: 'aristas', fabrica: true,
    etiqueta: 'Color por tipo de relacion',
  },
  tinteFuerza: {
    tipo: 'num', grupo: 'aristas', fabrica: 0.3, min: 0, max: 1, paso: 0.05,
    etiqueta: 'Fuerza del color',
    nota: 'A 0 es el gris de siempre. A 0,3 pesa lo mismo que el gris pero informa.',
  },

  // ── Fisica ─────────────────────────────────────────────────────────────────────────────
  //
  // Van en continuo porque la fase 0 lo midio (`bench/fuerzas.html`, 06/09): reconfigurar una fuerza
  // viva cuesta entre 0,05 y 0,2 ms, contra los 121-269 ms de reconstruir el simulador.
  distancia: {
    tipo: 'num', grupo: 'fisica', fabrica: 34, min: 10, max: 200, paso: 1,
    etiqueta: 'Largo de una arista',
  },
  repulsion: {
    tipo: 'num', grupo: 'fisica', fabrica: -38, min: -300, max: -5, paso: 1,
    etiqueta: 'Cuanto se repelen',
    nota: 'Negativo. Cuanto mas bajo, mas se separa todo.',
  },
  frenado: {
    tipo: 'num', grupo: 'fisica', fabrica: 0.35, min: 0.05, max: 0.9, paso: 0.05,
    etiqueta: 'Frenado',
    nota: 'Alto se para antes; bajo se mueve mas rato.',
  },

  // ── Experimental ───────────────────────────────────────────────────────────────────────
  //
  // Lo que NO existia ni como constante. Van aparte y marcados porque son los que pueden dejar el
  // grafo raro, y por eso la fase 4 trae ademas `#/grafo?reset`: un mando que puede estropear la
  // vista necesita una salida que funcione con la vista ya estropeada.
  //
  // TODOS NACEN NEUTROS (0 de curvatura, opacidades a 1, separacion a 0). Encendidos de fabrica
  // serian un rediseño colado por la puerta de atras.
  curvatura: {
    tipo: 'num', grupo: 'experimental', fabrica: 0, min: 0, max: 0.4, paso: 0.02,
    etiqueta: 'Curvar las aristas',
    nota: 'A 0 son rectas. Curvadas se distinguen dos vinculos entre el mismo par.',
  },
  opRelacion: {
    tipo: 'num', grupo: 'experimental', fabrica: 1, min: 0, max: 1, paso: 0.05,
    etiqueta: 'Peso de las relaciones',
  },
  opWikilink: {
    tipo: 'num', grupo: 'experimental', fabrica: 1, min: 0, max: 1, paso: 0.05,
    etiqueta: 'Peso de los wikilinks',
  },
  opSemantica: {
    tipo: 'num', grupo: 'experimental', fabrica: 1, min: 0, max: 1, paso: 0.05,
    etiqueta: 'Peso de los vecinos semanticos',
    nota: 'Bajar una capa sin apagarla: se queda de fondo en vez de desaparecer.',
  },
  separaProyectos: {
    tipo: 'num', grupo: 'experimental', fabrica: 0, min: 0, max: 1, paso: 0.05,
    etiqueta: 'Separar por proyecto',
    nota: 'Empuja a las memorias de distinto proyecto. El 24% de los vinculos cruzan, asi que subirlo mucho estira el grafo.',
  },
} as const satisfies Record<string, Mando>

export type Clave = keyof typeof CATALOGO

/**
 * Los valores vivos, con el tipo ANCHO.
 *
 * ⚠ Se deriva de `tipo` y no de `fabrica` a proposito. El `as const` del catalogo (que es lo que
 * permite tipar las claves) congela cada fabrica en su literal, asi que `[K]['fabrica']` daria
 * `tinteFuerza: 0.3` y `flechas: true`, o sea un mando que solo admite el valor que ya tiene. Lo
 * destapo `svelte-check` con siete errores en cuanto un test intento poner otro numero.
 */
export type Valores = { [K in Clave]: (typeof CATALOGO)[K]['tipo'] extends 'bool' ? boolean : number }

export const CLAVES = Object.keys(CATALOGO) as Clave[]

/** Los valores de fabrica, recien hechos. */
export function fabrica(): Valores {
  const v = {} as Record<string, unknown>
  for (const k of CLAVES) v[k] = CATALOGO[k].fabrica
  return v as Valores
}

/**
 * De donde salen y a donde van los valores guardados.
 *
 * Existe como interfaz y no como llamadas sueltas a `localStorage` por una razon concreta y ya
 * decidida: cuando Naeth tenga varios usuarios (el frente F3), las preferencias tendran que viajar
 * con la persona y no con el navegador. Ese dia se cambia esta pieza y ni el catalogo ni el panel se
 * enteran.
 */
export interface Almacen {
  leer(): unknown
  escribir(v: Valores): void
}

const CLAVE_LS = 'naeth-grafo'

/** El almacen de hoy. Todo va en try/catch: en modo privado `localStorage` LANZA, no devuelve null. */
export const almacenLocal: Almacen = {
  leer() {
    try {
      const s = localStorage.getItem(CLAVE_LS)
      return s ? JSON.parse(s) : null
    } catch {
      return null
    }
  },
  escribir(v) {
    try {
      localStorage.setItem(CLAVE_LS, JSON.stringify(v))
    } catch {
      // Sin sitio o sin permiso. Se pierde al recargar, y es preferible a no dejar usar el panel.
    }
  },
}

let almacen: Almacen = almacenLocal

/**
 * LA SALIDA DE EMERGENCIA: `#/grafo?reset` borra los ajustes ANTES de que se lea nada.
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
    localStorage.removeItem(CLAVE_LS)
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

export const reseteado = reseteoPorURL()

/**
 * Valida UN valor contra su mando. Devuelve el de fabrica si no cuadra.
 *
 * Se valida el tipo y el rango, no solo el tipo: un `nodoMax` de 0 es un numero perfectamente valido
 * y deja todos los nodos invisibles.
 */
export function valida<K extends Clave>(k: K, v: unknown): Valores[K] {
  const m = CATALOGO[k] as Mando
  if (m.tipo === 'bool') {
    return (typeof v === 'boolean' ? v : m.fabrica) as Valores[K]
  }
  if (typeof v !== 'number' || !Number.isFinite(v) || v < m.min || v > m.max) {
    return m.fabrica as Valores[K]
  }
  return v as Valores[K]
}

/** Lo guardado, saneado. Lo que no cuadra cae a fabrica sin avisar y sin romper nada. */
export function sanea(bruto: unknown): Valores {
  const out = fabrica()
  if (!bruto || typeof bruto !== 'object') return out
  const b = bruto as Record<string, unknown>
  for (const k of CLAVES) if (k in b) out[k] = valida(k, b[k]) as never

  // Validacion cruzada, la unica que hay: con el minimo por encima del maximo, `radioEnPantalla`
  // devuelve siempre el maximo y el grafo se ve raro sin que ningun valor suelto este mal.
  //
  // ⚠ HOY ES INALCANZABLE, y conviene saberlo antes de intentar cubrirla con un test: los rangos ya
  // lo impiden, porque `nodoMin` llega como mucho a 10 y `nodoMax` empieza justo en 10. Se queda
  // como red para el dia que alguien amplie uno de los dos rangos, y esa invariante la fija
  // `prefs-grafo.test.ts` para que ese dia se entere alguien.
  if (out.nodoMin > out.nodoMax) {
    out.nodoMin = CATALOGO.nodoMin.fabrica
    out.nodoMax = CATALOGO.nodoMax.fabrica
  }
  return out
}

/** El estado vivo. Lo leen el Lienzo en cada frame y el panel para pintar sus mandos. */
export const grafoPrefs = $state<Valores>(sanea(almacen.leer()))

function guarda() {
  almacen.escribir({ ...grafoPrefs })
}

/** Cambia un mando. Valida siempre: al panel se le puede colar un valor por el camino. */
export function poner<K extends Clave>(k: K, v: Valores[K]) {
  grafoPrefs[k] = valida(k, v) as never
  guarda()
}

/** Vuelve a fabrica, un grupo o entero. Es la salida de emergencia de mano. */
export function restaurar(grupo?: Grupo) {
  const f = fabrica()
  for (const k of CLAVES) {
    if (grupo && CATALOGO[k].grupo !== grupo) continue
    grafoPrefs[k] = f[k] as never
  }
  guarda()
}

/** Borra lo guardado y vuelve a fabrica. La usa `?reset`, y los tests entre casos. */
export function olvidarPrefs() {
  try {
    localStorage.removeItem(CLAVE_LS)
  } catch {
    // Da igual: lo que manda es el estado en memoria, que se restaura justo debajo.
  }
  const f = fabrica()
  for (const k of CLAVES) grafoPrefs[k] = f[k] as never
}

/** Cambia el almacen. Para los tests hoy, y para F3 el dia que las preferencias viajen. */
export function usarAlmacen(a: Almacen) {
  almacen = a
  const v = sanea(a.leer())
  for (const k of CLAVES) grafoPrefs[k] = v[k] as never
}

/** Los mandos de un grupo, en el orden del catalogo. Lo usa el panel. */
export function mandosDe(grupo: Grupo): { clave: Clave; mando: Mando }[] {
  return CLAVES.filter((k) => CATALOGO[k].grupo === grupo).map((k) => ({ clave: k, mando: CATALOGO[k] }))
}
