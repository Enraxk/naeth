<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { createSimulator, litFrom, type Simulator } from '../../lib/sim'
  import { canvasPainter } from '../../lib/painter-canvas'
  import { toWorld, screenRadius, type Painter, type Viewport } from '../../lib/painter'
  import { theme } from '../../lib/theme.svelte'
  import { graphPrefs } from '../../lib/prefs-graph.svelte'
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
    focus = null,
    group = null,
    selection = null,
    compact = false,
    positions = null,
    onSelect,
    onOpen,
  }: {
    model: GraphModel
    /**
     * Version pequeña, la del panel de una ficha. No cambia el motor: son los mismos simulador,
     * pintor e interaccion. Solo ajusta lo que depende del sitio disponible.
     */
    compact?: boolean
    /**
     * Posiciones de partida, del mapa global. Con ellas el lienzo arranca QUIETO y enseñando la
     * disposicion que estos nodos tienen en el grafo entero, en vez de inventarse una propia.
     * Sigue vivo: en cuanto se arrastra algo, despierta.
     */
    positions?: ReadonlyMap<string, { x: number; y: number }> | null
    /** Resaltado que viene de fuera: la ruta, o el raton sobre el arbol. */
    focus?: string | null
    /** Varias memorias encendidas a la vez: la carpeta que se senala en el arbol. */
    group?: string[] | null
    selection?: string | null
    onSelect?: (id: string | null) => void
    onOpen?: (id: string) => void
  } = $props()

  let bounds = $state<HTMLDivElement | null>(null)
  let sim: Simulator | null = null
  let painter: Painter | null = null

  // ── EL MINI HEREDA EN PROPORCION, no tiene sus propios numeros ────────────────────────────
  //
  // Antes el compacto llevaba `{distance: 96, repulsion: -140}` escritos a fuego. Ahora esos dos
  // numeros son FACTORES sobre lo que ajuste Eneko en el panel, para que al mover la fisica del
  // grafo grande el mini se mueva con el y las dos vistas sigan pareciendose, que es exactamente lo
  // que se pidio el 05/09: "el mini grafo quiero que se vea y se sienta como el grafo normal".
  //
  // Los factores son los de esos valores: 96/34 y 140/38. Con los ajustes de fabrica, el mini queda
  // EXACTAMENTE como estaba, que es lo que hace que esto sea un refactor y no un rediseño.
  //
  // (Por que el compacto necesita otra fisica, en la nota larga de mas abajo: con la distancia corta
  // del grafo grande, un vecindario de quince nodos satura su anillo y sale como un racimo.)
  const F_DISTANCE = 96 / 34
  const F_REPULSION = 140 / 38
  const F_NODE = 2.2
  const F_NAMES = 6 / 26

  const physicsFromPrefs = () => ({
    distance: graphPrefs.distance * (compact ? F_DISTANCE : 1),
    repulsion: graphPrefs.repulsion * (compact ? F_REPULSION : 1),
    damping: graphPrefs.damping,
    // En el compacto NO se agrupa por proyecto: un vecindario de tres nodos no tiene proyectos que
    // separar, y la fuerza solo conseguiria deformarlo.
    groupByProject: compact ? 0 : graphPrefs.splitProjects,
  })

  // ESTADO DEL LIENZO, DELIBERADAMENTE FUERA DE SVELTE. Se toca hasta seis veces por frame, y
  // pasarlo por `$state` seria invalidar el grafo de dependencias de Svelte 60 veces por segundo
  // para que al final solo cambie un `<canvas>` que se pinta a mano de todos modos.
  const view: Viewport = { cx: 0, cy: 0, k: 1, w: 0, h: 0 }
  let targetK = 1
  let zoomAnchor: { wx: number; wy: number; sx: number; sy: number } | null = null
  let panv = { x: 0, y: 0 }
  let dimming = 0
  let dragging: string | null = null
  /** Encuadra solo mientras se asienta y nadie ha tocado nada. */
  let autoFrame = true
  /** Nodo al que la camara va acercandose sola. Ver `mirar`. */
  let following: string | null = null
  /** Carpeta senalada, a cuyo centro va la camara. Ver `mirarGrupo`. */
  let followingGroup: Set<string> | null = null
  /**
   * Queda un encuadre por hacer porque cuando tocaba no habia medidas del contenedor.
   *
   * ⚠ ESTO ERA UN BUG Y COSTABA CARO. Al colocar desde el mapa la simulacion queda dormida, asi que
   * si el encuadre se pierde no hay frames despues para recuperarlo: el vecindario se queda fuera
   * de la vista y el lienzo aparece EN BLANCO. Y pasaba de forma intermitente, que es lo peor:
   * dependia de si el mapa ya estaba calculado al montar (lienzo vacio) o llegaba despues (bien).
   * De ahi el sintoma que reporto Eneko, que refrescando se arreglaba.
   */
  let framePending = false

  // Lo unico que SI vive en Svelte, y solo porque lo lee el marcado: el cursor de agarrar. El
  // resto del estado del lienzo se queda fuera a proposito, arriba.
  let ready = $state(false)
  let grabbing = $state(false)

  const reduce =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  // --- el bucle ---------------------------------------------------------------------------
  let running = false

  /** Pide un frame si no hay ninguno pedido. Todo lo que cambia algo llama a esto. */
  function wake() {
    if (!running) {
      running = true
      requestAnimationFrame(frame)
    }
  }

  function frame() {
    running = false
    if (!sim || !painter) return
    let live = false

    if (sim.step()) live = true

    // El aumento se desliza hacia su objetivo. Es el `scale` interpolado hacia `targetScale` de
    // Obsidian, y es la mitad de la sensacion de que el lienzo tiene peso.
    if (Math.abs(view.k - targetK) > 0.0005) {
      view.k = reduce ? targetK : view.k + (targetK - view.k) * 0.25
      if (zoomAnchor) {
        // El punto que habia bajo el puntero se queda bajo el puntero mientras dura el
        // acercamiento. Sin esto, acercarse a una isla la pierde de vista a mitad de camino.
        view.cx = zoomAnchor.wx - (zoomAnchor.sx - view.w / 2) / view.k
        view.cy = zoomAnchor.wy - (zoomAnchor.sy - view.h / 2) / view.k
      }
      live = true
    } else {
      zoomAnchor = null
    }

    // Inercia: el paneo sigue un poco despues de SOLTAR y frena con rozamiento. La condicion de
    // `!pulsa` no es un detalle: mientras la mano esta abajo, `mueve` fija la camara desde el
    // punto donde se pulso, asi que sumarle ademas la inercia hace que las dos se peleen por la
    // misma variable en frames alternos, y eso se ve como tembleque.
    if (!reduce && !press && (Math.abs(panv.x) > 0.05 || Math.abs(panv.y) > 0.05)) {
      view.cx -= panv.x / view.k
      view.cy -= panv.y / view.k
      panv.x *= 0.9
      panv.y *= 0.9
      live = true
    }

    // EL FOCO EFECTIVO, filtrado por lo que hay en ESTE grafo. El resalte es global, asi que puede
    // apuntar a una memoria que no esta aqui: pasa en el mini de una ficha cada vez que el raton
    // toca en el arbol una nota que no es vecina suya. En ese caso NO se cae a null, se cae a la
    // seleccion, que en el mini es la nota que estas leyendo: senalar algo de fuera no puede dejar
    // este grafo sin nada senalado.
    const focusId =
      focus && sim.has(focus) ? focus : selection && sim.has(selection) ? selection : null
    const enc = lit(focusId)

    const targetDim = enc || group?.length ? 1 : 0
    if (Math.abs(dimming - targetDim) > 0.004) {
      dimming = reduce ? targetDim : dimming + (targetDim - dimming) * 0.18
      live = true
    } else {
      dimming = targetDim
    }

    if (autoFrame) {
      frameAll(reduce ? 1 : 0.12)
      if (sim.alive()) live = true
    } else if (group?.length && followingGroup) {
      // Al senalar una carpeta la camara va a su centro pero NO cambia el aumento: una carpeta de
      // 83 memorias y una de 2 pediran aumentos muy distintos, y recorrer el arbol con la rueda
      // moviendose sola es mareante. Se llega, y desde ahi decide la mano.
      let cx = 0
      let cy = 0
      let n = 0
      for (const nd of sim.nodes)
        if (followingGroup.has(nd.id)) {
          cx += nd.x ?? 0
          cy += nd.y ?? 0
          n++
        }
      if (n) {
        const dx = cx / n - view.cx
        const dy = cy / n - view.cy
        if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
          view.cx += dx * (reduce ? 1 : 0.12)
          view.cy += dy * (reduce ? 1 : 0.12)
          live = true
        }
      }
    } else if (following) {
      // Se persigue la posicion ACTUAL del nodo, no la que tenia al empezar: mientras la
      // simulacion respira, el nodo se mueve, y una camara que va a donde estaba deja el nodo
      // descentrado justo al llegar.
      const nd = sim.nodes.find((n) => n.id === following)
      if (nd) {
        const dx = (nd.x ?? 0) - view.cx
        const dy = (nd.y ?? 0) - view.cy
        if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
          view.cx += dx * (reduce ? 1 : 0.14)
          view.cy += dy * (reduce ? 1 : 0.14)
          live = true
        }
      }
    }

    anchor()

    painter.draw(sim, view, {
      focus: focusId,
      lit: enc,
      dimming,
      dragging,
      color: true,
      nodeScale: graphPrefs.nodeScale * (compact ? F_NODE : 1),
      textFrom: graphPrefs.textFrom,
      textFull: graphPrefs.textFull,
      nodoExp: graphPrefs.nodeExponent,
      nodeMin: graphPrefs.nodeMin,
      nodeMax: graphPrefs.nodeMax,
      arrows: graphPrefs.arrows,
      arrowPx: graphPrefs.arrowPx,
      arrowMid: graphPrefs.arrowMid,
      tinted: graphPrefs.tinted,
      tintStrength: graphPrefs.tintStrength,
      curvature: graphPrefs.curvature,
      pesoCapa: {
        relation: graphPrefs.opRelation,
        wikilink: graphPrefs.opWikilink,
        semantic: graphPrefs.opSemantic,
      },
      // El mini juega con las MISMAS tres reglas que el grande, solo que con menos sitio: en 300 px
      // un vecindario de quince nombres no cabe. Con seis, un vecindario pequeño los enseña ya y
      // uno grande solo enseña el del centro hasta que te acercas; y al acercarte el culling deja
      // menos nodos a la vista, asi que el conjunto encendido baja y los nombres van saliendo. Es
      // la misma mecanica del grafo grande, con el tope ajustado al hueco. Los seis de antes son
      // ahora la misma proporcion (6/26) sobre el tope que ajuste Eneko, para que bajarlo en el
      // grafo grande no acabe subiendolo en el mini.
      labelCap: compact
        ? Math.max(1, Math.round(graphPrefs.labelCap * F_NAMES))
        : graphPrefs.labelCap,
    })

    if (live) wake()
  }

  /**
   * Lo que se queda a plena luz, con cache.
   *
   * El calculo vive en `lib/sim.ts` para poder probarlo; aqui solo esta la cache, porque se pide en
   * cada frame y una carpeta de 83 memorias son 83 consultas de vecindario para un resultado que no
   * ha cambiado.
   *
   * ⚠ EL MODELO ENTRA EN LA CLAVE. Sin el, tras cambiar un filtro con el mismo nodo senalado se
   * devolvia el conjunto anterior, con vecinos que ya no existian y sin los que hubieran aparecido.
   */
  let cacheGrupo: string[] | null = null
  let cacheId: string | null = null
  let cacheModel: GraphModel | null = null
  let cacheSet: Set<string> | null = null
  function lit(id: string | null): Set<string> | null {
    if (!sim) return null
    if (group === cacheGrupo && id === cacheId && model === cacheModel) return cacheSet
    cacheGrupo = group
    cacheId = id
    cacheModel = model
    cacheSet = litFrom(sim, id, group)
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
  function anchor() {
    if (!sim || !view.w) return
    const c = sim.bounds()
    const mx = view.w / view.k
    const my = view.h / view.k
    view.cx = Math.max(c.x0 - mx, Math.min(c.x1 + mx, view.cx))
    view.cy = Math.max(c.y0 - my, Math.min(c.y1 + my, view.cy))
    if (!Number.isFinite(view.cx)) view.cx = (c.x0 + c.x1) / 2
    if (!Number.isFinite(view.cy)) view.cy = (c.y0 + c.y1) / 2
  }

  /** Lleva la camara a que quepa todo, de golpe o poco a poco segun `step`. */
  function frameAll(step = 1) {
    if (!sim || !view.w) return
    const c = sim.bounds()
    // Mas margen en el compacto: ahi los nombres salen al senalar y necesitan sitio a los lados,
    // que en 276 px es lo primero que se acaba.
    const k = Math.min(
      view.w / Math.max(c.x1 - c.x0, 1),
      view.h / Math.max(c.y1 - c.y0, 1),
    ) * (compact ? 0.72 : 0.9)
    const cx = (c.x0 + c.x1) / 2
    const cy = (c.y0 + c.y1) / 2
    view.k += (Math.min(k, 4) - view.k) * step
    view.cx += (cx - view.cx) * step
    view.cy += (cy - view.cy) * step
    targetK = view.k
  }

  export function reframe() {
    autoFrame = true
    following = null
    followingGroup = null
    wake()
  }

  /** Lleva la camara al centro de una carpeta senalada en el arbol. */
  export function lookAtGroup(ids: string[] | null) {
    followingGroup = ids?.length ? new Set(ids) : null
    if (followingGroup) {
      autoFrame = false
      following = null
    }
    wake()
  }

  /**
   * Lleva la camara hasta un nodo SIN cambiar el aumento, y lo sigue mientras dure.
   *
   * Es lo que pasa al recorrer el arbol con el raton: el grafo va detras. A diferencia de
   * `encuadrar`, no acerca, porque cambiar el aumento en cada fila por la que pasas marea; y a
   * diferencia del encuadre automatico, no vuelve al sitio al soltar, porque devolver la camara
   * a su posicion anterior cada vez que sales de una fila es la mitad del mareo restante.
   */
  export function lookAt(id: string | null, acercar = false) {
    following = id
    if (id) {
      autoFrame = false
      followingGroup = null
      // ACERCA, PERO NUNCA ALEJA. Con `max` el aumento solo sube: si ya estabas cerca, recorrer el
      // arbol no te saca de donde estabas, y si estabas viendo el grafo entero te lleva a una
      // distancia desde la que la nota se lee. Alejar tambien haria que pasar el raton por una
      // lista diera bandazos de camara en los dos sentidos.
      if (acercar) targetK = Math.max(view.k, 2.6)
    }
    wake()
  }

  /** Va a un nodo y se acerca. Lo usa el boton del mini grafo y la ruta `#/graph/<id>`. */
  export function frameOn(id: string) {
    const nd = sim?.nodes.find((n) => n.id === id)
    if (!nd) return
    autoFrame = false
    following = null
    zoomAnchor = null
    view.cx = nd.x ?? 0
    view.cy = nd.y ?? 0
    targetK = 3
    wake()
  }

  // --- apuntar ----------------------------------------------------------------------------

  /**
   * Que nodo hay bajo estos pixeles.
   *
   * El radio de captura es GENEROSO a proposito, y ademas es el de un nodo de grado medio y no el
   * del nodo concreto: apuntar a un punto de tres pixeles con el raton es una prueba de punteria,
   * y la del grafo de Obsidian tampoco la exige. `nearest` devuelve el mas cercano, asi que un radio
   * amplio no roba clics al vecino: solo perdona el temblor de la mano.
   */
  const MEAN_RADIUS = 5.3
  function nodeAt(sx: number, sy: number) {
    if (!sim) return null
    const m = toWorld(sx, sy, view)
    // El radio se pide en unidades de mundo, pero quien apunta lo hace en pantalla: la conversion
    // va aqui, que es el sitio donde no se puede olvidar.
    return sim.nearest(m.x, m.y, (screenRadius(MEAN_RADIUS, view.k) + 7) / view.k)
  }

  const onCanvas = (ev: PointerEvent) => {
    const r = bounds!.getBoundingClientRect()
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
  let press: { id: string | null; sx: number; sy: number; t: number; cx: number; cy: number } | null = null
  let last = { x: 0, y: 0, t: 0 }
  /**
   * El ultimo nodo que este lienzo ha senalado, para no repetir el aviso en cada pixel de raton.
   *
   * ⚠ NO SE COMPARA CONTRA `foco`, y ese era el bug. `foco` incluye el id de la ruta, asi que
   * llegando por `#/graph/<id>` ese nodo concreto ya venia como foco y la comparacion lo daba por
   * senalado sin haberlo estado: era el unico nodo de la vista cuya fila no se encendia nunca en el
   * arbol. Con una cuenta propia, el lienzo sabe lo que ha dicho EL, que es lo que quiere saber.
   */
  let lastPointed: string | null = null

  function downward(ev: PointerEvent) {
    if (ev.button !== 0 || !bounds) return
    bounds.setPointerCapture(ev.pointerId)
    const p = onCanvas(ev)
    // Lo que se pulsa es lo que hay DEBAJO, y solo eso. Probe darle un margen para alcanzar al
    // nodo senalado aunque se hubiera movido, y lo quite: en el uso real apuntas a donde VES el
    // anillo, que es su posicion de ahora, asi que el margen no resolvia ningun caso demostrado y
    // a cambio robaba al fondo los clics de deseleccionar que cayeran cerca de un nodo.
    const nd = nodeAt(p.x, p.y)
    press = { id: nd?.id ?? null, sx: p.x, sy: p.y, t: performance.now(), cx: view.cx, cy: view.cy }
    grabbing = !nd
    autoFrame = false
    following = null
    followingGroup = null
    panv = { x: 0, y: 0 }
    last = { x: ev.clientX, y: ev.clientY, t: performance.now() }
    if (nd) {
      dragging = nd.id
      // Sostenida: mientras el nodo esta en la mano la simulacion no se enfria, asi que los
      // vecinos se apartan de verdad en vez de quedarse tiesos.
      sim?.reheat(0.35, true)
      sim?.pin(nd.id, nd.x ?? 0, nd.y ?? 0)
    }
    wake()
  }

  function move(ev: PointerEvent) {
    if (!bounds || !sim) return
    const p = onCanvas(ev)

    if (dragging && press) {
      const m = toWorld(p.x, p.y, view)
      sim.pin(dragging, m.x, m.y)
      wake()
      return
    }

    if (press) {
      // Paneo. Se mueve la camara al reves que la mano, que es lo que hace que la sensacion sea
      // de arrastrar el lienzo y no de mover un mando.
      view.cx = press.cx - (p.x - press.sx) / view.k
      view.cy = press.cy - (p.y - press.sy) / view.k
      const ahora = performance.now()
      // ⚠ SUELO DE TIEMPO Y TOPE DE VELOCIDAD, y los dos hacen falta. Sin el suelo, dos eventos
      // que llegan en el mismo milisegundo dan una velocidad de 60 px / 1 ms, que con este
      // rozamiento recorre miles de unidades y manda el grafo fuera de la pantalla: pasa con los
      // eventos sinteticos de una prueba, y pasa con un raton de alta frecuencia. Sin el tope, un
      // gesto brusco de verdad hace lo mismo aunque el suelo este puesto.
      const dt = Math.max(ahora - last.t, 10)
      const vel = (d: number) => Math.max(-40, Math.min(40, (d / dt) * 16.7))
      panv = { x: vel(ev.clientX - last.x), y: vel(ev.clientY - last.y) }
      last = { x: ev.clientX, y: ev.clientY, t: ahora }
      wake()
      return
    }

    // ⚠ EL RESALTE SE QUEDA PEGADO, y no es un descuido: es lo unico que lo hace usable.
    //
    // El grafo esta VIVO, asi que el nodo que senalas se mueve, y con un hover normal se sale de
    // debajo del cursor y el resalte se apaga solo. El ciclo que salia era: senalas, el nodo se
    // va, se apaga, vuelves a senalar. Aqui el resalte solo cambia cuando el raton encuentra OTRO
    // nodo, y se suelta con Escape, con un clic en el fondo o senalando en el arbol.
    const nd = nodeAt(p.x, p.y)
    if (nd && nd.id !== lastPointed) {
      lastPointed = nd.id
      onSelect?.(nd.id)
      wake()
    }
  }

  function upward(ev: PointerEvent) {
    if (!press) return
    const p = onCanvas(ev)
    const short =
      performance.now() - press.t < 500 &&
      Math.abs(p.x - press.sx) < 5 &&
      Math.abs(p.y - press.sy) < 5

    if (dragging) {
      sim?.release(dragging)
      sim?.reheat(0.15)
      dragging = null
      panv = { x: 0, y: 0 }
    }
    if (short) {
      // Un clic en un nodo abre la nota, como en Obsidian. Un clic en el fondo suelta lo que
      // hubiera seleccionado.
      if (press.id) onOpen?.(press.id)
      else {
        lastPointed = null
        onSelect?.(null)
      }
      panv = { x: 0, y: 0 }
    }
    press = null
    grabbing = false
    wake()
  }

  function wheel(ev: WheelEvent) {
    ev.preventDefault()
    if (!bounds) return
    const r = bounds.getBoundingClientRect()
    const sx = ev.clientX - r.left
    const sy = ev.clientY - r.top
    const m = toWorld(sx, sy, view)
    zoomAnchor = { wx: m.x, wy: m.y, sx, sy }
    autoFrame = false
    following = null
    followingGroup = null
    targetK = Math.min(Math.max(targetK * (ev.deltaY < 0 ? 1.28 : 1 / 1.28), 0.08), 18)
    wake()
  }

  /**
   * Teclado. Las flechas ya no solo pasean: saltan al vecino.
   *
   * Con un lienzo no hay elementos que tabular, asi que sin esto el grafo seria inalcanzable sin
   * raton. Recorrer vecinos es ademas la forma natural de leer un grafo.
   */
  function key(ev: KeyboardEvent) {
    if (!sim) return
    if (ev.key === 'Escape') {
      lastPointed = null
      onSelect?.(null)
      return wake()
    }
    if (ev.key === '+' || ev.key === '=') {
      targetK = Math.min(targetK * 1.35, 18)
      autoFrame = false
      return wake()
    }
    if (ev.key === '-' || ev.key === '_') {
      targetK = Math.max(targetK / 1.35, 0.08)
      autoFrame = false
      return wake()
    }
    if (ev.key === 'Enter' && (focus ?? selection)) {
      ev.preventDefault()
      return onOpen?.((focus ?? selection)!)
    }

    const dir: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    }
    const d = dir[ev.key]
    if (!d) return
    ev.preventDefault()
    autoFrame = false

    const actual = focus ?? selection
    if (!actual) {
      view.cx += (d[0] * view.w * 0.15) / view.k
      view.cy += (d[1] * view.h * 0.15) / view.k
      return wake()
    }

    // Al vecino que mejor cae en esa direccion: se puntua el coseno del angulo, con la distancia
    // desempatando. Saltar "al de la derecha" tiene que llevar a uno que este a la derecha.
    const yo = sim.nodes.find((n) => n.id === actual)
    if (!yo) return
    let best: string | null = null
    let points = -Infinity
    for (const v of sim.neighbors(actual)) {
      const o = sim.nodes.find((n) => n.id === v)
      if (!o) continue
      const dx = (o.x ?? 0) - (yo.x ?? 0)
      const dy = (o.y ?? 0) - (yo.y ?? 0)
      const dist = Math.hypot(dx, dy) || 1
      const p = (dx * d[0] + dy * d[1]) / dist - dist / 100000
      if (p > points) {
        points = p
        best = v
      }
    }
    if (best && points > 0) {
      lastPointed = best
      onSelect?.(best)
      const nd = sim.nodes.find((n) => n.id === best)
      if (nd) {
        view.cx = nd.x ?? 0
        view.cy = nd.y ?? 0
      }
    }
    wake()
  }

  // --- ciclo de vida ------------------------------------------------------------------------

  onMount(() => {
    if (!bounds) return
    painter = canvasPainter(bounds)
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
    sim = createSimulator(model, {
      ...physicsFromPrefs(),
      ...(compact ? { width: 420 } : {}),
    })

    const ro = new ResizeObserver(() => {
      if (!bounds) return
      view.w = bounds.clientWidth
      view.h = bounds.clientHeight
      painter?.resize(view.w, view.h)
      if (framePending && view.w) {
        framePending = false
        frameAll(1)
      }
      wake()
    })
    ro.observe(bounds)

    // Con movimiento reducido no se ensena la simulacion: se adelanta en silencio y se pinta ya
    // asentada. Es la primera excepcion a que el movimiento se gobierne desde `app.css`, y no
    // puede resolverse con tokens porque esto no es una transicion CSS, son objetos moviendose.
    if (positions?.size) placeAndFrame(positions)
    else if (reduce) for (let i = 0; i < 260 && sim.step(); i++)

    ready = true
    wake()
    return () => {
      ro.disconnect()
      sim?.stop()
      painter?.destroy()
      painter = null
      sim = null
    }
  })

  // El modelo cambia al tocar un filtro o una capa. `update` conserva la posicion de lo que sigue
  // estando, asi que esto ya no es el recalculo de 265 a 411 ms que medimos el 04/09.
  $effect(() => {
    const m = model
    if (!sim || !ready) return
    sim.update(m)
    // Si el lienzo vive de un mapa (la ficha de una memoria), cambiar de nota cambia el modelo
    // ENTERO, no un filtro: hay que volver a colocar desde el mapa y reencuadrar, porque los nodos
    // nuevos entran donde los deje el empaquetado y la camara sigue mirando al vecindario anterior.
    //
    // ⚠ `posiciones` SE LEE CON `untrack`. Sin eso este efecto tambien depende de ella, asi que al
    // llegar el mapa se ejecutaba `sim.update` sin que el modelo hubiera cambiado, y el efecto de
    // abajo repetia el trabajo. Es la misma familia de reentrada que ya costo quince peticiones a
    // `/api/graph`: un efecto que reacciona a algo que no es lo suyo.
    const p = untrack(() => positions)
    if (p?.size) placeAndFrame(p)
    wake()
  })

  // El mapa global puede llegar despues de montar el lienzo, porque se calcula repartido en varios
  // frames. Cuando llega, se recoloca: es preferible un reacomodo visible una vez a enseñar una
  // forma inventada para siempre.
  $effect(() => {
    const p = positions
    if (!sim || !ready || !p?.size) return
    placeAndFrame(p)
    wake()
  })

  /**
   * Coloca desde el mapa y encuadra DE GOLPE.
   *
   * El encuadre de golpe no es un atajo: `place` deja la simulacion dormida, y el encuadre
   * automatico avanza un 12% por frame contando con que la simulacion mantenga vivo el bucle.
   * Sin ella, el bucle pinta una vez y se para, asi que la camara se quedaba a un 12% del camino y
   * el vecindario aparecia descuadrado. Aqui no hay nada que interpolar: es la primera imagen.
   */
  function placeAndFrame(p: ReadonlyMap<string, { x: number; y: number }>) {
    sim?.place(p)
    autoFrame = false
    if (!view.w) {
      // Todavia no se ha medido el contenedor: el encuadre se apunta y lo hace el ResizeObserver.
      framePending = true
      return
    }
    frameAll(1)
  }

  // Un lienzo no entiende `var(--ink)`: hay que releer los tokens al cambiar de tema.
  $effect(() => {
    theme.value
    painter?.theme()
    wake()
  })

  /**
   * Los ajustes del panel, aplicados en vivo.
   *
   * DOS COSAS, Y LA SEGUNDA ES LA QUE NO SE VE VENIR:
   *
   * 1. La fisica se reconfigura SIN reconstruir el simulador. Medido el 06/09 en
   *    `bench/fuerzas.html`: cuesta entre 0,05 y 0,2 ms contra los 121-269 ms de crearlo otra vez,
   *    asi que el deslizador puede moverse en continuo. El alpha va bajo (0,12) porque un tick ya
   *    cuesta entre 3 y 17 ms con este corpus, y reavivar del todo en cada pixel del deslizador iria
   *    a tirones.
   *
   * 2. `despertar()` no es opcional NI para los ajustes de apariencia. El grafo se duerme cuando
   *    esta quieto (esa es media razon de que no queme CPU), y dormido no vuelve a pintar. Sin esta
   *    llamada, mover el tinte o el tamaño de los nodos no cambiaria nada en pantalla hasta rozar el
   *    raton por encima, y el mando pareceria roto.
   */
  $effect(() => {
    // ⚠ UNA COPIA, NO DOCE LECTURAS SUELTAS. La primera version enumeraba cada mando con `void
    // grafoPrefs.loQueSea` para declarar la dependencia, y eso es frágil por dos motivos: se olvida
    // un mando al añadirlo y nadie se entera (el mando queda mudo hasta que algo mas despierte el
    // bucle), y una sentencia `void` sin uso es justo lo que un empaquetador puede decidir que no
    // hace nada. Extender el objeto lee TODAS las claves de una vez y no hay nada que olvidar.
    const all = { ...graphPrefs }
    // ⚠ AQUI NO SE MIRA `ready`, Y ESO ES EL ARREGLO. La primera version copiaba la guarda
    // `if (!sim || !ready)` de los efectos de al lado sin preguntarse si aplicaba, y no aplica:
    // `ready` existe para que el MARCADO sepa cuando puede enseñar el cursor de agarrar, no para
    // decir si se puede pintar. Con ella, el efecto salia por el return y el grafo no se enteraba
    // de ningun ajuste hasta que un clic despertaba el bucle por la via de la interaccion, que es
    // exactamente el sintoma que reporto Eneko el 08/09. Si hay simulador, hay con que ajustar y
    // con que pintar; no hace falta nada mas.
    if (!sim) return
    sim.tune(
      {
        distance: all.distance * (compact ? F_DISTANCE : 1),
        repulsion: all.repulsion * (compact ? F_REPULSION : 1),
        damping: all.damping,
        groupByProject: compact ? 0 : all.splitProjects,
      },
      0.12,
    )
    wake()
  })

  // Un resalte que llega de fuera (del arbol, o de la ruta) tambien tiene que repintar.
  $effect(() => {
    focus
    selection
    wake()
  })
</script>

<!-- El rol y los eventos van en el contenedor. `role="application"` le dice al lector de pantalla
     que ceda el teclado, que es exactamente lo que pasa en una superficie que se recorre con
     flechas. Y aqui es imprescindible: con un lienzo no hay elementos que tabular, asi que sin
     teclado el grafo seria inalcanzable sin raton. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="bounds"
  class:grabbing
  bind:this={bounds}
  role="application"
  tabindex={compact ? -1 : 0}
  aria-label={compact
    ? `Vecindario de esta memoria: ${model.nodes.length - 1} conexiones`
    : `Grafo de ${model.nodes.length} memorias y ${model.edges.length} vínculos. Flechas para saltar de vecino en vecino, más y menos para acercarse, Enter para abrir, Escape para soltar.`}
  onkeydown={key}
  onwheel={wheel}
  onpointerdown={downward}
  onpointermove={move}
  onpointerup={upward}
  onpointercancel={upward}
></div>

<!-- LA LISTA ACCESIBLE. Un lienzo no tiene elementos, asi que para un lector de pantalla el grafo
     seria un rectangulo vacio por mucho `aria-label` que lleve. Esto son enlaces de verdad, fuera
     de la vista pero dentro del arbol de accesibilidad: se anuncian con su titulo y su proyecto, y
     llevan a la memoria.

     ⚠ VA DENTRO DE UN DESPLEGABLE CERRADO, y eso es la mitad del asunto. La primera version los
     ponia sueltos, y con 455 memorias eso metia 455 PARADAS DE TABULACION en una vista que antes
     tenia una: quien navega con teclado necesitaba 456 pulsaciones para atravesarla. Ganaba el
     lector de pantalla y perdia el teclado, que no es una mejora de accesibilidad sino un cambio de
     victima. Cerrado son otra vez una parada, y los enlaces entran en el recorrido solo si se abre.

     No es una concesion: el mini grafo tenia esto por ser SVG, y era el unico argumento serio para
     no pasarlo a lienzo. Poniendolo aqui lo ganan las DOS vistas, porque el grafo grande nunca lo
     tuvo. -->
<details class="solo-lectores">
  <summary>
    {compact
      ? `Listado del vecindario: ${model.nodes.length} memorias`
      : `Listado del grafo: ${model.nodes.length} memorias`}
  </summary>
  <ul>
    {#each model.nodes as n (n.id)}
      <li>
        <a href="#/m/{n.id}"
           onfocus={() => onSelect?.(n.id)}
           onblur={() => onSelect?.(null)}
        >{n.title ?? '(sin título)'} · {n.path ?? ''} · {n.degree} vínculos</a>
      </li>
    {/each}
  </ul>
</details>

<style>
  .bounds {
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
    outline: none;
    /* El fondo del grafo, un punto por debajo del de la aplicacion: el lienzo se lee como una
       superficie propia en la que se entra, y no como un hueco del panel. */
    background: var(--bg2);
  }
  .bounds:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .bounds.grabbing { cursor: grabbing; }

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
  /* Al tabular hasta el resumen o hasta un enlace SI se ve: si no, el foco desaparece de pantalla
     y quien navega con teclado y vista se pierde. */
  .solo-lectores summary:focus-visible,
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
