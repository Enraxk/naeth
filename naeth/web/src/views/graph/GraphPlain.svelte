<script lang="ts">
  import { projColor } from '../../lib/colors'
  import type { GraphModel, GraphNode, EdgeLayer } from '../../lib/graph'
  import type { Colocacion } from '../../lib/layout'

  // Motor de dibujo SOBRIO: nodos y lineas rectas. Es el primero de los dos prototipos de
  // estetica, y existe para responder una pregunta antes de invertir horas en la otra: si con
  // este ya se lee la topologia real (400 nodos, 24 componentes, sin hubs), la estetica heptapoda
  // es una decision de gusto tomada con la alternativa delante. Si con este NO se lee, el
  // problema es de colocacion y no de estetica, y pulir glifos no lo habria arreglado.
  //
  // NO ANIMA EL LAYOUT. Las posiciones se calculan enteras y se pintan ya asentadas. Eso resuelve
  // dos cosas de una vez: 450 nodos repintandose a 60 fps en SVG no van finos, y una simulacion
  // visible es literalmente lo que retira `prefers-reduced-motion`, que no se puede resolver por
  // tokens porque no es una transicion CSS. El zoom y el arrastre si mueven, pero los mueve el
  // usuario con la mano: eso no es animacion.

  let {
    model,
    colocacion,
    foco = null,
    seleccion = null,
    onSelect,
    onOpen,
  }: {
    model: GraphModel
    colocacion: Colocacion
    foco?: string | null
    seleccion?: string | null
    onSelect?: (id: string | null) => void
    onOpen?: (id: string) => void
  } = $props()

  const nodo = $derived(new Map(model.nodes.map((n) => [n.id, n])))

  // El HOVER resalta, sin hacer clic. Es la interaccion central del grafo de Obsidian, de donde
  // viene Eneko, y es lo que permite recorrer el grafo preguntandole a cada nodo "y tu con quien
  // hablas" sin cambiar de estado ni perder lo que estabas mirando.
  let encima = $state<string | null>(null)

  /** Vecinos del nodo resaltado: lo demas se apaga en vez de esconderse. */
  const vecinos = $derived.by(() => {
    const id = encima ?? seleccion ?? foco
    if (!id) return null
    const s = new Set<string>([id])
    for (const e of model.edges) {
      if (e.source === id) s.add(e.target)
      else if (e.target === id) s.add(e.source)
    }
    return s
  })

  const TRAZO: Record<EdgeLayer, string> = { relation: '', wikilink: '2 3', semantic: '5 3' }

  /** Las cuatro formas del vocabulario cerrado de tipos. Mismas que en el mini grafo. */
  function forma(n: GraphNode | undefined, x: number, y: number, r: number): string {
    switch (n?.memory_type) {
      case 'decision':
        return `M${x - r} ${y - r}h${r * 2}v${r * 2}h${-r * 2}Z`
      case 'observation':
        return `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`
      case 'preference':
        return `M${x} ${y - r}L${x + r} ${y + r * 0.8}L${x - r} ${y + r * 0.8}Z`
      default:
        return `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`
    }
  }

  /** El tamaño dice el grado, con techo: sin el, un nodo de grado 11 dominaria el lienzo. */
  const radio = (n: GraphNode) => 3.5 + Math.min(n.degree, 10) * 0.45

  // --- zoom y arrastre -----------------------------------------------------------------------
  let vb = $state({ x: 0, y: 0, k: 1 })
  let host = $state<SVGSVGElement | null>(null)
  let anchoPx = $state(0)

  let arrastre: { x: number; y: number; vx: number; vy: number } | null = null

  // Al cambiar el grafo (filtros, capas) se vuelve al encuadre completo: mantener el zoom viejo
  // sobre un lienzo de otro tamaño deja mirando a un trozo vacio.
  $effect(() => {
    colocacion.ancho
    colocacion.alto
    vb = { x: 0, y: 0, k: 1 }
  })

  const ancho = $derived(colocacion.ancho / vb.k)
  const alto = $derived(colocacion.alto / vb.k)

  /**
   * Cuantas unidades del lienzo mide un pixel de pantalla.
   *
   * TODO LO QUE SE MIRA SE DIBUJA EN ESTAS UNIDADES, no en las del lienzo. Sin esto, un nodo de
   * radio 4 dentro de un viewBox de 5.000 unidades se pinta a menos de medio pixel: el primer
   * intento de esta vista salio como una nube de polvo gris, con los 454 nodos ahi y ninguno
   * visible. Y al acercarse pasaria lo contrario, bolas enormes. El tamaño de un nodo dice su
   * grado, asi que tiene que leerse igual a cualquier zoom.
   */
  const upx = $derived(anchoPx > 0 ? ancho / anchoPx : 1)

  /**
   * Cuanto crece un nodo al acercarse.
   *
   * Un tamaño constante en pantalla arregla que no se vea nada de lejos, pero deja una sensacion
   * rara: por mucho que te acerques a una nota, sigue igual de pequeña. Acercarse tiene que
   * servir para algo. Con esto el nodo crece con el zoom, con techo para que a fondo no tape a
   * sus vecinos.
   */
  const crecimiento = $derived(Math.min(1 + (vb.k - 1) * 0.35, 3.2))

  function rueda(ev: WheelEvent) {
    ev.preventDefault()
    const r = host?.getBoundingClientRect()
    if (!r) return
    // El zoom se ancla al puntero, que es lo que hace que acercarse a una isla no la pierda.
    const px = vb.x + ((ev.clientX - r.left) / r.width) * ancho
    const py = vb.y + ((ev.clientY - r.top) / r.height) * alto
    const k = Math.min(Math.max(vb.k * (ev.deltaY < 0 ? 1.15 : 1 / 1.15), 0.6), 14)
    const na = colocacion.ancho / k
    const nb = colocacion.alto / k
    vb = {
      k,
      x: px - ((ev.clientX - r.left) / r.width) * na,
      y: py - ((ev.clientY - r.top) / r.height) * nb,
    }
  }

  /**
   * ⚠ EL NODO SE ANOTA AL PULSAR, no se busca al soltar, y esto es un arreglo con historia.
   *
   * `setPointerCapture` redirige TODO lo que venga despues al elemento que captura, asi que el
   * `click` posterior llega con `target` = el contenedor y no el nodo. Resultado: pulsar un nodo
   * no abria nada. Y no se cazo verificando porque la comprobacion disparaba el evento
   * directamente sobre el path, que es justo saltarse la parte que fallaba: pasaba la prueba y
   * no funcionaba el raton.
   */
  let pulsado: string | null = null

  function abajo(ev: PointerEvent) {
    if (ev.button !== 0) return
    pulsado = idDe(ev)
    arrastre = { x: ev.clientX, y: ev.clientY, vx: vb.x, vy: vb.y }
    ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
  }

  function mueve(ev: PointerEvent) {
    if (!arrastre || !host) return
    const r = host.getBoundingClientRect()
    vb = {
      ...vb,
      x: arrastre.vx - ((ev.clientX - arrastre.x) / r.width) * ancho,
      y: arrastre.vy - ((ev.clientY - arrastre.y) / r.height) * alto,
    }
  }

  function arriba(ev: PointerEvent) {
    // Un arrastre corto SOBRE EL FONDO deselecciona. Sobre un nodo no, que de eso se encarga
    // `clic`: si no se distinguiera, seleccionar un nodo lo deseleccionaria acto seguido.
    const corto2 =
      arrastre && Math.abs(ev.clientX - arrastre.x) < 4 && Math.abs(ev.clientY - arrastre.y) < 4
    if (corto2) {
      if (pulsado) onOpen?.(pulsado)
      else onSelect?.(null)
    }
    pulsado = null
    arrastre = null
  }

  /**
   * Que nodos llevan etiqueta.
   *
   * Dos condiciones, y las dos hacen falta. Solo por zoom, acercarse a la componente de 269
   * nodos escupiria 269 titulos superpuestos. Solo por cantidad, con el grafo entero en pantalla
   * saldrian etiquetas de 4 px. Asi que: hay que estar lo bastante cerca Y que quepan pocos.
   * El seleccionado lleva la suya siempre, aunque no cumpla ninguna de las dos: si has pulsado
   * algo, saber que es no deberia depender de a que distancia estas.
   */
  const LIMITE_ETIQUETAS = 45
  /**
   * Opacidad del texto segun la distancia, en vez de aparecer y desaparecer de golpe.
   *
   * Es el "text fade threshold" del grafo de Obsidian, y no es un adorno: un corte brusco al
   * cruzar el umbral hace parpadear medio lienzo con un pellizco de rueda, y el ojo lee ese
   * parpadeo como que ha cambiado algo en los datos.
   */
  const opacidadTexto = $derived(Math.max(0, Math.min(1, (0.75 - upx) / 0.2)))

  const etiquetables = $derived.by(() => {
    const out: { n: GraphNode; x: number; y: number }[] = []
    if (opacidadTexto <= 0) return seleccionado()
    for (const n of model.nodes) {
      const p = colocacion.pos.get(n.id)
      if (!p) continue
      if (p.x < vb.x || p.x > vb.x + ancho || p.y < vb.y || p.y > vb.y + alto) continue
      out.push({ n, x: p.x, y: p.y })
      if (out.length > LIMITE_ETIQUETAS) return seleccionado()
    }
    return out
  })

  function seleccionado() {
    const id = encima ?? seleccion
    if (!id) return []
    const n = nodo.get(id)
    const p = colocacion.pos.get(id)
    return n && p ? [{ n, x: p.x, y: p.y }] : []
  }

  const corto = (t: string | null) => {
    const s = t ?? '(sin título)'
    return s.length > 38 ? s.slice(0, 37) + '…' : s
  }

  // --- delegacion: UN listener en el svg, no tres por nodo -----------------------------------
  //
  // Con 454 nodos, poner `onpointerenter`, `onpointerleave`, `onclick` y `ondblclick` en cada uno
  // son 1.816 escuchas. El navegador propaga igual, asi que basta preguntar en el svg de que
  // nodo viene el evento.
  const idDe = (ev: Event) =>
    (ev.target as Element | null)?.closest?.('[data-id]')?.getAttribute('data-id') ?? null

  function sobre(ev: PointerEvent) {
    const id = idDe(ev)
    if (id === encima) return
    encima = id
    if (id) onSelect?.(id)
  }
  function fuera(ev: PointerEvent) {
    if (!(ev.relatedTarget as Element | null)?.closest?.('[data-id]')) encima = null
  }
  // UN CLIC ABRE LA NOTA, como en el grafo de Obsidian. Antes seleccionaba y habia que buscar un
  // boton en el panel: nadie que venga de alli va a hacer eso, va a pulsar el punto y esperar que
  // pase algo. El panel se alimenta ahora de por donde pasa el raton, asi que la informacion se
  // ve sin comprometerse a nada.

  /** Las aristas y nodos del vecindario resaltado, que son los que se repintan encima. */
  const aristasFoco = $derived(
    vecinos ? model.edges.filter((e) => vecinos.has(e.source) && vecinos.has(e.target)) : [],
  )
  const nodosFoco = $derived(vecinos ? model.nodes.filter((n) => vecinos.has(n.id)) : [])

  /**
   * Teclado, como en el grafo de Obsidian: `+` y `-` acercan y alejan, las flechas mueven, y
   * Escape suelta la seleccion. Ademas de ser lo que espera quien viene de alli, es lo que
   * justifica que este `<svg>` reciba eventos: con `role="application"` y foco propio, es una
   * superficie interactiva y no un dibujo.
   */
  function tecla(ev: KeyboardEvent) {
    const paso = ancho * 0.08
    if (ev.key === 'Escape') return onSelect?.(null)
    if (ev.key === '+' || ev.key === '=') return zoomCentro(1.25)
    if (ev.key === '-' || ev.key === '_') return zoomCentro(1 / 1.25)
    const mov: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    }
    const d = mov[ev.key]
    if (!d) return
    ev.preventDefault()
    vb = { ...vb, x: vb.x + d[0] * paso, y: vb.y + d[1] * paso }
  }

  function zoomCentro(f: number) {
    const k = Math.min(Math.max(vb.k * f, 0.6), 14)
    const cx = vb.x + ancho / 2
    const cy = vb.y + alto / 2
    vb = { k, x: cx - colocacion.ancho / k / 2, y: cy - colocacion.alto / k / 2 }
  }

  export function reencuadrar() {
    vb = { x: 0, y: 0, k: 1 }
  }

  export function encuadrar(id: string) {
    const p = colocacion.pos.get(id)
    if (!p) return
    const k = 3.5
    vb = { k, x: p.x - colocacion.ancho / k / 2, y: p.y - colocacion.alto / k / 2 }
  }
</script>

<!-- El ROL y los eventos van en el contenedor, no en el `<svg>`: un svg no es un elemento
     interactivo para las reglas de accesibilidad, por mucho `role` que se le ponga, y lo que
     de verdad se maneja aqui es una superficie de exploracion que contiene un dibujo. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- Las dos reglas de arriba se silencian a proposito y solo aqui. `role="application"` SI es un
     rol interactivo segun ARIA: le dice al lector de pantalla que ceda el teclado a la propia
     aplicacion, que es exactamente lo que pasa con un lienzo que se recorre con flechas. La regla
     de svelte-check no lo contempla y avisa igual. La alternativa era degradar a `role="group"` y
     quedarse sin teclado, que es peor accesibilidad de verdad a cambio de un aviso menos. -->
<div
  class="caja"
  role="application"
  tabindex="0"
  aria-label="Grafo de {model.nodes.length} memorias y {model.edges.length} vínculos. Flechas para moverse, más y menos para el zoom, Escape para soltar la selección."
  onkeydown={tecla}
  onwheel={rueda}
  onpointerdown={abajo}
  onpointermove={mueve}
  onpointerup={arriba}
  onpointercancel={() => (arrastre = null)}
  onpointerover={sobre}
  onpointerout={fuera}
>
  <svg
    bind:this={host}
    bind:clientWidth={anchoPx}
    class="lienzo"
    class:resaltando={!!vecinos}
    viewBox="{vb.x} {vb.y} {ancho} {alto}"
    aria-hidden="true"
  >
    <!-- LAS DOS CAPAS BASE SE ATENUAN DE GOLPE, con una sola propiedad en el grupo. Antes cada
         nodo y cada arista calculaban su propia opacidad, o sea 1.104 actualizaciones reactivas
         por cada pixel que se movia el raton, y se notaba muchisimo. Ahora son dos. -->
    <g class="aristas" opacity={vecinos ? 0.1 : 0.5}>
      {#each model.edges as e (e.source + e.target)}
        {@const a = colocacion.pos.get(e.source)}
        {@const b = colocacion.pos.get(e.target)}
        {#if a && b}
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="var(--dim)"
                stroke-width={(e.confirmed ? 1.4 : 0.9) * upx}
                stroke-dasharray={TRAZO[e.layer]} />
        {/if}
      {/each}
    </g>

    <g class="nodos" opacity={vecinos ? 0.16 : 1}>
      {#each model.nodes as n (n.id)}
        {@const p = colocacion.pos.get(n.id)}
        {#if p}
          <path class="nd" class:centro={n.id === (encima ?? seleccion)}
                data-id={n.id} d={forma(n, p.x, p.y, radio(n) * upx * crecimiento)}
                fill={projColor(n.project)} />
        {/if}
      {/each}
    </g>

    <!-- Encima, SOLO el vecindario resaltado. Son unas pocas decenas de elementos que nacen y
         mueren con el hover, en vez de mil cambiando de opacidad. -->
    {#if vecinos}
      <g class="foco">
        {#each aristasFoco as e (e.source + e.target)}
          {@const a = colocacion.pos.get(e.source)}
          {@const b = colocacion.pos.get(e.target)}
          {#if a && b}
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="var(--ink)"
                  stroke-width={(e.confirmed ? 1.6 : 1.1) * upx}
                  stroke-dasharray={TRAZO[e.layer]} />
          {/if}
        {/each}
        {#each nodosFoco as n (n.id)}
          {@const p = colocacion.pos.get(n.id)}
          {#if p}
            <path class="nd" data-id={n.id} d={forma(n, p.x, p.y, radio(n) * upx * crecimiento)}
                  fill={projColor(n.project)} />
          {/if}
        {/each}
      </g>
    {/if}

    <g class="etiquetas">
      {#each etiquetables as e (e.n.id)}
        <text
          x={e.x} y={e.y + (radio(e.n) * crecimiento + 11) * upx}
          font-size={11 * upx}
          text-anchor="middle"
          fill="var(--ink)"
          stroke="var(--bg)"
          stroke-width={3 * upx}
          paint-order="stroke"
          opacity={e.n.id === (encima ?? seleccion) ? 1 : opacidadTexto}
        >{corto(e.n.title)}</text>
      {/each}
    </g>

  </svg>
</div>

<style>
  .caja { width: 100%; height: 100%; touch-action: none; cursor: grab; outline: none; }
  .caja:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .caja:active { cursor: grabbing; }
  .lienzo { width: 100%; height: 100%; display: block; }
  .nd { cursor: pointer; }
  /* La etiqueta no debe capturar el puntero: pasa por encima de nodos y estorbaria al pulsarlos. */
  .etiquetas { pointer-events: none; font-family: var(--font-sans); }
  /* Las aristas nunca reciben puntero: son mil lineas finas que se cruzan y solo estorbarian al
     apuntar a un nodo. */
  .aristas, .foco line { pointer-events: none; }

  /* LO QUE MIRAS RECUPERA SU COLOR. La paleta esta desaturada a proposito para que 26 proyectos
     a la vez no griten, pero eso deja el grafo entero en tono menor. Al pasar el raton, el
     vecindario vuelve a saturarse: lo apagado se enciende donde miras, y el resto sigue de
     fondo. Cuesta una propiedad sobre las pocas decenas de elementos de esta capa, no sobre los
     mil de las de abajo.

     El fundido SE QUEDA con `prefers-reduced-motion`, siguiendo la politica de app.css: lo que
     esa preferencia retira es el DESPLAZAMIENTO, no un cambio de color, y sin el la saturacion
     aparece de golpe y da un respingo. */
  .foco { filter: saturate(2.1); transition: filter var(--t-fast); }
  /* `non-scaling-stroke` para que el realce del hover no engorde al alejarse. */
  .nd:hover, .nd.centro { stroke: var(--accent); stroke-width: 2.5; vector-effect: non-scaling-stroke; }
</style>
