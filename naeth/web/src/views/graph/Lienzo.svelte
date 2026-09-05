<script lang="ts">
  import { onMount } from 'svelte'
  import { crearSimulador, type Simulador } from '../../lib/sim'
  import { pintorCanvas } from '../../lib/pintor-canvas'
  import { aMundo, radioEnPantalla, type Pintor, type Vista } from '../../lib/pintor'
  import { theme } from '../../lib/theme.svelte'
  import type { GraphModel } from '../../lib/graph'

  // El lienzo del grafo: fisica, pintado e interaccion cosidos, y nada mas.
  //
  // Lo que hace que esto se sienta vivo no es una cosa, son seis, y todas salen de leer como esta
  // hecho el grafo de Obsidian (`docs/discovery/motor-grafo-2026-09-05.md`):
  //   1. La simulacion sigue corriendo y se calma sola, en vez de pintarse ya asentada.
  //   2. Se puede empujar: arrastrar un nodo aparta a sus vecinos.
  //   3. El aumento se INTERPOLA hacia su objetivo, no salta.
  //   4. El paneo lleva inercia y frena solo.
  //   5. El resalte se funde en vez de encenderse de golpe.
  //   6. Los nodos crecen al acercarse.
  //
  // Y una septima que no se ve y es la que permite las otras seis: EL BUCLE SE PARA. Cuando no
  // queda movimiento pendiente, el `requestAnimationFrame` deja de pedirse y la CPU vuelve a cero.
  // Es el `idleFrames` de Obsidian. Sin eso, un grafo abierto en una pestana es un ventilador.

  let {
    model,
    foco = null,
    grupo = null,
    seleccion = null,
    compacto = false,
    posiciones = null,
    onSelect,
    onOpen,
  }: {
    model: GraphModel
    /**
     * Version pequeña, la del panel de una ficha. No cambia el motor: son los mismos simulador,
     * pintor e interaccion. Solo ajusta lo que depende del sitio disponible.
     */
    compacto?: boolean
    /**
     * Posiciones de partida, del mapa global. Con ellas el lienzo arranca QUIETO y enseñando la
     * disposicion que estos nodos tienen en el grafo entero, en vez de inventarse una propia.
     * Sigue vivo: en cuanto se arrastra algo, despierta.
     */
    posiciones?: ReadonlyMap<string, { x: number; y: number }> | null
    /** Resaltado que viene de fuera: la ruta, o el raton sobre el arbol. */
    foco?: string | null
    /** Varias memorias encendidas a la vez: la carpeta que se senala en el arbol. */
    grupo?: string[] | null
    seleccion?: string | null
    onSelect?: (id: string | null) => void
    onOpen?: (id: string) => void
  } = $props()

  let caja = $state<HTMLDivElement | null>(null)
  let sim: Simulador | null = null
  let pintor: Pintor | null = null

  // ESTADO DEL LIENZO, DELIBERADAMENTE FUERA DE SVELTE. Se toca hasta seis veces por frame, y
  // pasarlo por `$state` seria invalidar el grafo de dependencias de Svelte 60 veces por segundo
  // para que al final solo cambie un `<canvas>` que se pinta a mano de todos modos.
  const vista: Vista = { cx: 0, cy: 0, k: 1, w: 0, h: 0 }
  let objetivoK = 1
  let anclaZoom: { wx: number; wy: number; sx: number; sy: number } | null = null
  let panv = { x: 0, y: 0 }
  let atenuacion = 0
  let arrastrando: string | null = null
  /** Encuadra solo mientras se asienta y nadie ha tocado nada. */
  let autoEncuadre = true
  /** Nodo al que la camara va acercandose sola. Ver `mirar`. */
  let siguiendo: string | null = null
  /** Carpeta senalada, a cuyo centro va la camara. Ver `mirarGrupo`. */
  let siguiendoGrupo: Set<string> | null = null

  // Lo unico que SI vive en Svelte, y solo porque lo lee el marcado: el cursor de agarrar. El
  // resto del estado del lienzo se queda fuera a proposito, arriba.
  let listo = $state(false)
  let agarrando = $state(false)

  const reduce =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // --- el bucle ---------------------------------------------------------------------------
  let corriendo = false
  let sucio = true

  /** Pide un frame si no hay ninguno pedido. Todo lo que cambia algo llama a esto. */
  function despertar() {
    sucio = true
    if (!corriendo) {
      corriendo = true
      requestAnimationFrame(frame)
    }
  }

  function frame() {
    corriendo = false
    if (!sim || !pintor) return
    let vivo = false

    if (sim.paso()) vivo = true

    // El aumento se desliza hacia su objetivo. Es el `scale` interpolado hacia `targetScale` de
    // Obsidian, y es la mitad de la sensacion de que el lienzo tiene peso.
    if (Math.abs(vista.k - objetivoK) > 0.0005) {
      vista.k = reduce ? objetivoK : vista.k + (objetivoK - vista.k) * 0.25
      if (anclaZoom) {
        // El punto que habia bajo el puntero se queda bajo el puntero mientras dura el
        // acercamiento. Sin esto, acercarse a una isla la pierde de vista a mitad de camino.
        vista.cx = anclaZoom.wx - (anclaZoom.sx - vista.w / 2) / vista.k
        vista.cy = anclaZoom.wy - (anclaZoom.sy - vista.h / 2) / vista.k
      }
      vivo = true
    } else {
      anclaZoom = null
    }

    // Inercia: el paneo sigue un poco despues de SOLTAR y frena con rozamiento. La condicion de
    // `!pulsa` no es un detalle: mientras la mano esta abajo, `mueve` fija la camara desde el
    // punto donde se pulso, asi que sumarle ademas la inercia hace que las dos se peleen por la
    // misma variable en frames alternos, y eso se ve como tembleque.
    if (!reduce && !pulsa && (Math.abs(panv.x) > 0.05 || Math.abs(panv.y) > 0.05)) {
      vista.cx -= panv.x / vista.k
      vista.cy -= panv.y / vista.k
      panv.x *= 0.9
      panv.y *= 0.9
      vivo = true
    }

    const objAten = foco || seleccion || grupo?.length ? 1 : 0
    if (Math.abs(atenuacion - objAten) > 0.004) {
      atenuacion = reduce ? objAten : atenuacion + (objAten - atenuacion) * 0.18
      vivo = true
    } else {
      atenuacion = objAten
    }

    if (autoEncuadre) {
      encuadraTodo(reduce ? 1 : 0.12)
      if (sim.viva()) vivo = true
    } else if (grupo?.length && siguiendoGrupo) {
      // Al senalar una carpeta la camara va a su centro pero NO cambia el aumento: una carpeta de
      // 83 memorias y una de 2 pediran aumentos muy distintos, y recorrer el arbol con la rueda
      // moviendose sola es mareante. Se llega, y desde ahi decide la mano.
      let cx = 0
      let cy = 0
      let n = 0
      for (const nd of sim.nodos)
        if (siguiendoGrupo.has(nd.id)) {
          cx += nd.x ?? 0
          cy += nd.y ?? 0
          n++
        }
      if (n) {
        const dx = cx / n - vista.cx
        const dy = cy / n - vista.cy
        if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
          vista.cx += dx * (reduce ? 1 : 0.12)
          vista.cy += dy * (reduce ? 1 : 0.12)
          vivo = true
        }
      }
    } else if (siguiendo) {
      // Se persigue la posicion ACTUAL del nodo, no la que tenia al empezar: mientras la
      // simulacion respira, el nodo se mueve, y una camara que va a donde estaba deja el nodo
      // descentrado justo al llegar.
      const nd = sim.nodos.find((n) => n.id === siguiendo)
      if (nd) {
        const dx = (nd.x ?? 0) - vista.cx
        const dy = (nd.y ?? 0) - vista.cy
        if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
          vista.cx += dx * (reduce ? 1 : 0.14)
          vista.cy += dy * (reduce ? 1 : 0.14)
          vivo = true
        }
      }
    }

    amarrar()

    const id = foco ?? seleccion
    pintor.dibujar(sim, vista, {
      foco: id,
      encendidos: encendidos(id),
      atenuacion,
      arrastrando,
      color: true,
      escalaNodo: compacto ? 2.2 : 1,
      topeNombres: compacto ? 1 : undefined,
    })

    sucio = false
    if (vivo) despertar()
  }

  /**
   * Lo que se queda a plena luz, con cache.
   *
   * Se calcula al cambiar y no en cada frame: una carpeta de 83 memorias son 83 consultas de
   * vecindario, y a 60 fps eso es trabajo repetido para un resultado que no ha cambiado. La cache
   * compara por identidad del array, que es lo que Svelte recrea cuando el grupo cambia de verdad.
   *
   * LOS VECINOS ENTRAN EN EL CONJUNTO, y es la decision de fondo: senalar una carpeta enciende lo
   * que hay dentro Y aquello con lo que habla, que es como se ve hacia donde sale de su proyecto.
   * Si solo se encendiera lo de dentro, el grafo no contaria nada que el arbol no cuente ya.
   */
  let cacheGrupo: string[] | null = null
  let cacheId: string | null = null
  let cacheSet: Set<string> | null = null
  function encendidos(id: string | null): Set<string> | null {
    if (!sim) return null
    if (grupo === cacheGrupo && id === cacheId) return cacheSet
    cacheGrupo = grupo
    cacheId = id
    if (grupo?.length) {
      const s = new Set(grupo)
      for (const g of grupo) for (const v of sim.vecinos(g)) s.add(v)
      cacheSet = s
    } else if (id) {
      cacheSet = new Set([id, ...sim.vecinos(id)])
    } else {
      cacheSet = null
    }
    return cacheSet
  }

  // --- encuadre ---------------------------------------------------------------------------

  /**
   * La camara no puede irse mas alla del grafo, mas un margen de una pantalla.
   *
   * Es una red de seguridad, no una restriccion de diseno. Un lienzo infinito significa que
   * cualquier gesto raro (un flick, un trackpad nervioso, una rueda con aceleracion) puede dejar
   * al usuario mirando al vacio sin ninguna pista de hacia donde estaba el grafo. Con esto, el
   * peor caso es quedarse en un borde con el grafo asomando.
   */
  function amarrar() {
    if (!sim || !vista.w) return
    const c = sim.caja()
    const mx = vista.w / vista.k
    const my = vista.h / vista.k
    vista.cx = Math.max(c.x0 - mx, Math.min(c.x1 + mx, vista.cx))
    vista.cy = Math.max(c.y0 - my, Math.min(c.y1 + my, vista.cy))
    if (!Number.isFinite(vista.cx)) vista.cx = (c.x0 + c.x1) / 2
    if (!Number.isFinite(vista.cy)) vista.cy = (c.y0 + c.y1) / 2
  }

  /** Lleva la camara a que quepa todo, de golpe o poco a poco segun `paso`. */
  function encuadraTodo(paso = 1) {
    if (!sim || !vista.w) return
    const c = sim.caja()
    // Mas margen en el compacto: ahi los nombres salen al senalar y necesitan sitio a los lados,
    // que en 276 px es lo primero que se acaba.
    const k = Math.min(
      vista.w / Math.max(c.x1 - c.x0, 1),
      vista.h / Math.max(c.y1 - c.y0, 1),
    ) * (compacto ? 0.72 : 0.9)
    const cx = (c.x0 + c.x1) / 2
    const cy = (c.y0 + c.y1) / 2
    vista.k += (Math.min(k, 4) - vista.k) * paso
    vista.cx += (cx - vista.cx) * paso
    vista.cy += (cy - vista.cy) * paso
    objetivoK = vista.k
  }

  export function reencuadrar() {
    autoEncuadre = true
    siguiendo = null
    siguiendoGrupo = null
    despertar()
  }

  /** Lleva la camara al centro de una carpeta senalada en el arbol. */
  export function mirarGrupo(ids: string[] | null) {
    siguiendoGrupo = ids?.length ? new Set(ids) : null
    if (siguiendoGrupo) {
      autoEncuadre = false
      siguiendo = null
    }
    despertar()
  }

  /**
   * Lleva la camara hasta un nodo SIN cambiar el aumento, y lo sigue mientras dure.
   *
   * Es lo que pasa al recorrer el arbol con el raton: el grafo va detras. A diferencia de
   * `encuadrar`, no acerca, porque cambiar el aumento en cada fila por la que pasas marea; y a
   * diferencia del encuadre automatico, no vuelve al sitio al soltar, porque devolver la camara
   * a su posicion anterior cada vez que sales de una fila es la mitad del mareo restante.
   */
  export function mirar(id: string | null, acercar = false) {
    siguiendo = id
    if (id) {
      autoEncuadre = false
      siguiendoGrupo = null
      // ACERCA, PERO NUNCA ALEJA. Con `max` el aumento solo sube: si ya estabas cerca, recorrer el
      // arbol no te saca de donde estabas, y si estabas viendo el grafo entero te lleva a una
      // distancia desde la que la nota se lee. Alejar tambien haria que pasar el raton por una
      // lista diera bandazos de camara en los dos sentidos.
      if (acercar) objetivoK = Math.max(vista.k, 2.6)
    }
    despertar()
  }

  /** Va a un nodo y se acerca. Lo usa el boton del mini grafo y la ruta `#/grafo/<id>`. */
  export function encuadrar(id: string) {
    const nd = sim?.nodos.find((n) => n.id === id)
    if (!nd) return
    autoEncuadre = false
    siguiendo = null
    anclaZoom = null
    vista.cx = nd.x ?? 0
    vista.cy = nd.y ?? 0
    objetivoK = 3
    despertar()
  }

  // --- apuntar ----------------------------------------------------------------------------

  /**
   * Que nodo hay bajo estos pixeles.
   *
   * El radio de captura es GENEROSO a proposito, y ademas es el de un nodo de grado medio y no el
   * del nodo concreto: apuntar a un punto de tres pixeles con el raton es una prueba de punteria,
   * y la del grafo de Obsidian tampoco la exige. `cerca` devuelve el mas cercano, asi que un radio
   * amplio no roba clics al vecino: solo perdona el temblor de la mano.
   */
  const RADIO_MEDIO = 5.3
  function nodoEn(sx: number, sy: number) {
    if (!sim) return null
    const m = aMundo(sx, sy, vista)
    // El radio se pide en unidades de mundo, pero quien apunta lo hace en pantalla: la conversion
    // va aqui, que es el sitio donde no se puede olvidar.
    return sim.cerca(m.x, m.y, (radioEnPantalla(RADIO_MEDIO, vista.k) + 7) / vista.k)
  }

  const enLienzo = (ev: PointerEvent) => {
    const r = caja!.getBoundingClientRect()
    return { x: ev.clientX - r.left, y: ev.clientY - r.top }
  }

  // --- gestos -----------------------------------------------------------------------------
  //
  // ⚠ EL CLIC ES UNA PULSACION CORTA, no un evento `click`. Y esto tiene historia: el 04/09 el
  // clic sobre un nodo no abria nada porque `setPointerCapture` redirige todo lo que viene despues
  // al elemento que captura, asi que el `click` llegaba con el contenedor como destino. Con un
  // lienzo no hay ni destino que valga, porque no hay elementos. Asi que se mide lo que de verdad
  // distingue un clic de un arrastre: cuanto duro y cuanto se movio. Es lo mismo que hace Quartz
  // con el grafo de Obsidian, con el mismo tope de 500 ms.
  let pulsa: { id: string | null; sx: number; sy: number; t: number; cx: number; cy: number } | null = null
  let ultimo = { x: 0, y: 0, t: 0 }

  function abajo(ev: PointerEvent) {
    if (ev.button !== 0 || !caja) return
    caja.setPointerCapture(ev.pointerId)
    const p = enLienzo(ev)
    // Lo que se pulsa es lo que hay DEBAJO, y solo eso. Probe darle un margen para alcanzar al
    // nodo senalado aunque se hubiera movido, y lo quite: en el uso real apuntas a donde VES el
    // anillo, que es su posicion de ahora, asi que el margen no resolvia ningun caso demostrado y
    // a cambio robaba al fondo los clics de deseleccionar que cayeran cerca de un nodo.
    const nd = nodoEn(p.x, p.y)
    pulsa = { id: nd?.id ?? null, sx: p.x, sy: p.y, t: performance.now(), cx: vista.cx, cy: vista.cy }
    agarrando = !nd
    autoEncuadre = false
    siguiendo = null
    siguiendoGrupo = null
    panv = { x: 0, y: 0 }
    ultimo = { x: ev.clientX, y: ev.clientY, t: performance.now() }
    if (nd) {
      arrastrando = nd.id
      // Sostenida: mientras el nodo esta en la mano la simulacion no se enfria, asi que los
      // vecinos se apartan de verdad en vez de quedarse tiesos.
      sim?.agitar(0.35, true)
      sim?.sujetar(nd.id, nd.x ?? 0, nd.y ?? 0)
    }
    despertar()
  }

  function mueve(ev: PointerEvent) {
    if (!caja || !sim) return
    const p = enLienzo(ev)

    if (arrastrando && pulsa) {
      const m = aMundo(p.x, p.y, vista)
      sim.sujetar(arrastrando, m.x, m.y)
      despertar()
      return
    }

    if (pulsa) {
      // Paneo. Se mueve la camara al reves que la mano, que es lo que hace que la sensacion sea
      // de arrastrar el lienzo y no de mover un mando.
      vista.cx = pulsa.cx - (p.x - pulsa.sx) / vista.k
      vista.cy = pulsa.cy - (p.y - pulsa.sy) / vista.k
      const ahora = performance.now()
      // ⚠ SUELO DE TIEMPO Y TOPE DE VELOCIDAD, y los dos hacen falta. Sin el suelo, dos eventos
      // que llegan en el mismo milisegundo dan una velocidad de 60 px / 1 ms, que con este
      // rozamiento recorre miles de unidades y manda el grafo fuera de la pantalla: pasa con los
      // eventos sinteticos de una prueba, y pasa con un raton de alta frecuencia. Sin el tope, un
      // gesto brusco de verdad hace lo mismo aunque el suelo este puesto.
      const dt = Math.max(ahora - ultimo.t, 10)
      const vel = (d: number) => Math.max(-40, Math.min(40, (d / dt) * 16.7))
      panv = { x: vel(ev.clientX - ultimo.x), y: vel(ev.clientY - ultimo.y) }
      ultimo = { x: ev.clientX, y: ev.clientY, t: ahora }
      despertar()
      return
    }

    // ⚠ EL RESALTE SE QUEDA PEGADO, y no es un descuido: es lo unico que lo hace usable.
    //
    // El grafo esta VIVO, asi que el nodo que senalas se mueve, y con un hover normal se sale de
    // debajo del cursor y el resalte se apaga solo. El ciclo que salia era: senalas, el nodo se
    // va, se apaga, vuelves a senalar. Aqui el resalte solo cambia cuando el raton encuentra OTRO
    // nodo, y se suelta con Escape, con un clic en el fondo o senalando en el arbol.
    const nd = nodoEn(p.x, p.y)
    if (nd && nd.id !== foco) {
      onSelect?.(nd.id)
      despertar()
    }
  }

  function arriba(ev: PointerEvent) {
    if (!pulsa) return
    const p = enLienzo(ev)
    const corto =
      performance.now() - pulsa.t < 500 &&
      Math.abs(p.x - pulsa.sx) < 5 &&
      Math.abs(p.y - pulsa.sy) < 5

    if (arrastrando) {
      sim?.soltar(arrastrando)
      sim?.agitar(0.15)
      arrastrando = null
      panv = { x: 0, y: 0 }
    }
    if (corto) {
      // Un clic en un nodo abre la nota, como en Obsidian. Un clic en el fondo suelta lo que
      // hubiera seleccionado.
      if (pulsa.id) onOpen?.(pulsa.id)
      else onSelect?.(null)
      panv = { x: 0, y: 0 }
    }
    pulsa = null
    agarrando = false
    despertar()
  }

  function rueda(ev: WheelEvent) {
    ev.preventDefault()
    if (!caja) return
    const r = caja.getBoundingClientRect()
    const sx = ev.clientX - r.left
    const sy = ev.clientY - r.top
    const m = aMundo(sx, sy, vista)
    anclaZoom = { wx: m.x, wy: m.y, sx, sy }
    autoEncuadre = false
    siguiendo = null
    siguiendoGrupo = null
    objetivoK = Math.min(Math.max(objetivoK * (ev.deltaY < 0 ? 1.28 : 1 / 1.28), 0.08), 18)
    despertar()
  }

  /**
   * Teclado. Las flechas ya no solo pasean: saltan al vecino.
   *
   * Con un lienzo no hay elementos que tabular, asi que sin esto el grafo seria inalcanzable sin
   * raton. Recorrer vecinos es ademas la forma natural de leer un grafo.
   */
  function tecla(ev: KeyboardEvent) {
    if (!sim) return
    if (ev.key === 'Escape') {
      onSelect?.(null)
      return despertar()
    }
    if (ev.key === '+' || ev.key === '=') {
      objetivoK = Math.min(objetivoK * 1.35, 18)
      autoEncuadre = false
      return despertar()
    }
    if (ev.key === '-' || ev.key === '_') {
      objetivoK = Math.max(objetivoK / 1.35, 0.08)
      autoEncuadre = false
      return despertar()
    }
    if (ev.key === 'Enter' && (foco ?? seleccion)) {
      ev.preventDefault()
      return onOpen?.((foco ?? seleccion)!)
    }

    const dir: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    }
    const d = dir[ev.key]
    if (!d) return
    ev.preventDefault()
    autoEncuadre = false

    const actual = foco ?? seleccion
    if (!actual) {
      vista.cx += (d[0] * vista.w * 0.15) / vista.k
      vista.cy += (d[1] * vista.h * 0.15) / vista.k
      return despertar()
    }

    // Al vecino que mejor cae en esa direccion: se puntua el coseno del angulo, con la distancia
    // desempatando. Saltar "al de la derecha" tiene que llevar a uno que este a la derecha.
    const yo = sim.nodos.find((n) => n.id === actual)
    if (!yo) return
    let mejor: string | null = null
    let puntos = -Infinity
    for (const v of sim.vecinos(actual)) {
      const o = sim.nodos.find((n) => n.id === v)
      if (!o) continue
      const dx = (o.x ?? 0) - (yo.x ?? 0)
      const dy = (o.y ?? 0) - (yo.y ?? 0)
      const dist = Math.hypot(dx, dy) || 1
      const p = (dx * d[0] + dy * d[1]) / dist - dist / 100000
      if (p > puntos) {
        puntos = p
        mejor = v
      }
    }
    if (mejor && puntos > 0) {
      onSelect?.(mejor)
      const nd = sim.nodos.find((n) => n.id === mejor)
      if (nd) {
        vista.cx = nd.x ?? 0
        vista.cy = nd.y ?? 0
      }
    }
    despertar()
  }

  // --- ciclo de vida ------------------------------------------------------------------------

  onMount(() => {
    if (!caja) return
    pintor = pintorCanvas(caja)
    // LA FISICA DEL COMPACTO ES OTRA, y no es un capricho de tamaño.
    //
    // Con la distancia de enlace del grafo grande (34) y quince vecinos alrededor de un centro, el
    // anillo se satura: el perimetro que hace falta para que no choquen es mayor que el que da esa
    // distancia, asi que la colision los amontona y el vecindario sale como un racimo. En el grafo
    // grande no pasa porque un nodo tiene sitio alrededor.
    //
    // Con la distancia larga, las aristas vuelven a ser lineas que salen del centro, que es la
    // forma que tiene el vecindario cuando lo miras en el grafo grande. Y la repulsion sube para
    // que los vecinos se repartan por el anillo en vez de agruparse por un lado.
    sim = crearSimulador(model, compacto ? { distancia: 96, repulsion: -140, ancho: 420 } : {})

    const ro = new ResizeObserver(() => {
      if (!caja) return
      vista.w = caja.clientWidth
      vista.h = caja.clientHeight
      pintor?.medir(vista.w, vista.h)
      despertar()
    })
    ro.observe(caja)

    // Con movimiento reducido no se ensena la simulacion: se adelanta en silencio y se pinta ya
    // asentada. Es la primera excepcion a que el movimiento se gobierne desde `app.css`, y no
    // puede resolverse con tokens porque esto no es una transicion CSS, son objetos moviendose.
    if (posiciones?.size) colocarYEncuadrar(posiciones)
    else if (reduce) for (let i = 0; i < 260 && sim.paso(); i++)

    listo = true
    despertar()
    return () => {
      ro.disconnect()
      sim?.parar()
      pintor?.destruir()
      pintor = null
      sim = null
    }
  })

  // El modelo cambia al tocar un filtro o una capa. `cambiar` conserva la posicion de lo que sigue
  // estando, asi que esto ya no es el recalculo de 265 a 411 ms que medimos el 04/09.
  $effect(() => {
    const m = model
    if (!sim || !listo) return
    sim.cambiar(m)
    despertar()
  })

  // El mapa global puede llegar despues de montar el lienzo, porque se calcula repartido en varios
  // frames. Cuando llega, se recoloca: es preferible un reacomodo visible una vez a enseñar una
  // forma inventada para siempre.
  $effect(() => {
    const p = posiciones
    if (!sim || !listo || !p?.size) return
    colocarYEncuadrar(p)
    despertar()
  })

  /**
   * Coloca desde el mapa y encuadra DE GOLPE.
   *
   * El encuadre de golpe no es un atajo: `colocar` deja la simulacion dormida, y el encuadre
   * automatico avanza un 12% por frame contando con que la simulacion mantenga vivo el bucle.
   * Sin ella, el bucle pinta una vez y se para, asi que la camara se quedaba a un 12% del camino y
   * el vecindario aparecia descuadrado. Aqui no hay nada que interpolar: es la primera imagen.
   */
  function colocarYEncuadrar(p: ReadonlyMap<string, { x: number; y: number }>) {
    sim?.colocar(p)
    autoEncuadre = false
    encuadraTodo(1)
  }

  // Un lienzo no entiende `var(--ink)`: hay que releer los tokens al cambiar de tema.
  $effect(() => {
    theme.value
    pintor?.tema()
    despertar()
  })

  // Un resalte que llega de fuera (del arbol, o de la ruta) tambien tiene que repintar.
  $effect(() => {
    foco
    seleccion
    despertar()
  })
</script>

<!-- El rol y los eventos van en el contenedor. `role="application"` le dice al lector de pantalla
     que ceda el teclado, que es exactamente lo que pasa en una superficie que se recorre con
     flechas. Y aqui es imprescindible: con un lienzo no hay elementos que tabular, asi que sin
     teclado el grafo seria inalcanzable sin raton. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="caja"
  class:agarrando
  bind:this={caja}
  role="application"
  tabindex={compacto ? -1 : 0}
  aria-label={compacto
    ? `Vecindario de esta memoria: ${model.nodes.length - 1} conexiones`
    : `Grafo de ${model.nodes.length} memorias y ${model.edges.length} vínculos. Flechas para saltar de vecino en vecino, más y menos para acercarse, Enter para abrir, Escape para soltar.`}
  onkeydown={tecla}
  onwheel={rueda}
  onpointerdown={abajo}
  onpointermove={mueve}
  onpointerup={arriba}
  onpointercancel={arriba}
></div>

<!-- LA LISTA ACCESIBLE. Un lienzo no tiene elementos, asi que para un lector de pantalla el grafo
     seria un rectangulo vacio por mucho `aria-label` que lleve. Esto son enlaces de verdad, fuera
     de la vista pero dentro del arbol de accesibilidad: se tabulan, se anuncian con su titulo y su
     proyecto, y llevan a la memoria.

     No es una concesion: el mini grafo tenia esto por ser SVG, y era el unico argumento serio para
     no pasarlo a lienzo. Poniendolo aqui lo ganan las DOS vistas, porque el grafo grande nunca lo
     tuvo. -->
<ul class="solo-lectores">
  {#each model.nodes as n (n.id)}
    <li>
      <a href="#/m/{n.id}"
         onfocus={() => onSelect?.(n.id)}
         onblur={() => onSelect?.(null)}
      >{n.title ?? '(sin título)'} · {n.path ?? ''} · {n.degree} vínculos</a>
    </li>
  {/each}
</ul>

<style>
  .caja {
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
    outline: none;
    /* El fondo del grafo, un punto por debajo del de la aplicacion: el lienzo se lee como una
       superficie propia en la que se entra, y no como un hueco del panel. */
    background: var(--bg2);
  }
  .caja:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .caja.agarrando { cursor: grabbing; }

  /* Fuera de la vista, dentro del arbol de accesibilidad. No se usa `display:none` ni
     `visibility:hidden` porque eso lo retira tambien para el lector, que es justo lo contrario de
     lo que se quiere. */
  .solo-lectores {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  /* Al tabular hasta un enlace SI se ve: si no, el foco desaparece de pantalla y quien navega con
     teclado y vista se pierde. */
  .solo-lectores a:focus-visible {
    position: fixed;
    left: 12px;
    bottom: 12px;
    z-index: 20;
    width: auto;
    height: auto;
    clip-path: none;
    padding: 6px 10px;
    background: var(--panel);
    border: 1px solid var(--accent);
    border-radius: 6px;
    color: var(--ink);
    font: 12px var(--font-sans);
  }
</style>
