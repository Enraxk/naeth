<!-- Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
     No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE -->
<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '../components/Icon.svelte'
  import Canvas from './graph/Canvas.svelte'
  import Panel from './graph/Panel.svelte'
  import { getGraph, getKnn } from '../lib/api'
  import { data } from '../lib/data.svelte'
  import { navigate, route } from '../lib/router.svelte'
  import { highlight, highlightNode } from '../lib/ui.svelte'
  import { collapsed } from '../lib/prefs.svelte'
  import { PANEL_LS, PANEL_LS_LEGACY } from '../lib/prefs-graph.svelte'
  import { hidingFolder } from '../lib/tree'
  import { typeMeta, typeColor } from '../lib/colors'
  import { buildGraph, defaultFilters, projectOf, type EdgeLayer } from '../lib/graph'
    import type { GraphResponse, KnnNeighbor } from '../lib/types'

  let graph = $state<GraphResponse | null>(null)
  let error = $state('')
  let filters = $state(defaultFilters())
  let selection = $state<string | null>(null)
  let knn = $state(new Map<string, KnnNeighbor[]>())
  let engine = $state<Canvas | null>(null)

  // Si el panel de ajustes queda abierto o cerrado, recordado entre visitas. No va al catalogo de
  // `prefs-graph` a proposito: aquello es lo que gobierna el DIBUJO, y esto es estado de la vista.
  // Mezclarlos obligaria a validar y restaurar a fabrica algo que no pinta nada.
  let settingsOpen = $state(((): boolean => {
    try {
      return (localStorage.getItem(PANEL_LS) ?? localStorage.getItem(PANEL_LS_LEGACY)) === '1'
    } catch {
      return false
    }
  })())
  $effect(() => {
    try {
      localStorage.setItem(PANEL_LS, settingsOpen ? '1' : '0')
    } catch {
      // En modo privado no se recuerda, y no pasa nada: el panel abre cerrado.
    }
  })

  onMount(async () => {
    try {
      graph = await getGraph()
    } catch {
      error = 'No se ha podido leer el grafo del nodo.'
    }
  })

  // El foco llega por la ruta `#/graph/<id>`, que es a donde lleva el boton del mini grafo, o por
  // el resalte compartido, que es el raton pasando por una fila del arbol.
  const focus = $derived(highlight.id ?? route.id)

  // El exento entra en los filtros para que una nota senalada en el arbol no pueda quedar
  // escondida por "ocultar sueltas". Pedir ver algo y que el grafo se quede callado porque un
  // filtro lo tapaba es la peor respuesta, y ademas no hay forma de adivinar la causa.
  /**
   * Lo que el arbol esconde: toda memoria cuya carpeta esta colapsada.
   *
   * Cerrar una carpeta la retira del grafo. Reutiliza `hidingFolder`, la misma funcion pura
   * que usa la sidebar para saber que fila encender, asi que las dos vistas no pueden discrepar
   * sobre que esta escondido, que es como nacen los bugs que nadie reproduce.
   */
  const hidden = $derived.by(() => {
    if (!collapsed.size) return null
    const s = new Set<string>()
    for (const r of data.tree ?? []) if (hidingFolder(r.path, collapsed)) s.add(r.id)
    return s.size ? s : null
  })

  const model = $derived(
    buildGraph(data.tree ?? [], graph, knn, { ...filters, exempt: highlight.id, hidden }),
  )

  // Lo que cuenta la franja de abajo: lo resaltado si hay algo, y si no lo seleccionado.
  const stripId = $derived(highlight.id ?? selection)
  const selNode = $derived(model.nodes.find((n) => n.id === stripId) ?? null)
  /**
   * La nota resaltada desde el arbol puede NO estar en el grafo: sin vinculos, o filtrada. En vez
   * de dejar la franja en blanco, se dice, que ademas responde a la pregunta que uno se hace en
   * ese momento (por que no la veo).
   */
  /** Cuantas de la carpeta senalada estan de verdad en el grafo. Las que no, no tienen vinculos. */
  const lit = $derived(
    highlight.group ? model.nodes.filter((n) => highlight.group!.includes(n.id)).length : 0,
  )
  const looseRow = $derived(
    !selNode && stripId ? ((data.tree ?? []).find((r) => r.id === stripId) ?? null) : null,
  )

  const LAYERS: { k: EdgeLayer; label: string; dash: string }[] = [
    { k: 'relation', label: 'relaciones', dash: '' },
    { k: 'wikilink', label: 'wikilinks', dash: '2 3' },
    { k: 'semantic', label: 'semánticos', dash: '5 3' },
  ]

  function toggleLayer(k: EdgeLayer) {
    filters = { ...filters, layers: { ...filters.layers, [k]: !filters.layers[k] } }
  }

  /**
   * La capa semantica se pide POR NODO, nunca para todo el corpus: medido, el kNN global tarda
   * 2,7 s y el de una nota 16 ms. Asi que el vecindario semantico se despliega alrededor de lo
   * que miras, que ademas es como se explora un grafo.
   */
  async function select(id: string | null) {
    selection = id
    // El otro extremo del hilo: lo que toca el raton aqui se enciende en el arbol.
    highlightNode(id)
    if (!id || !filters.layers.semantic || knn.has(id)) return
    try {
      const r = await getKnn(id, 6)
      knn = new Map(knn).set(id, r.neighbors)
    } catch { /* sin vecinos semanticos se sigue viendo el resto */ }
  }

  /**
   * Recorrer el arbol con el raton arrastra la camara del grafo.
   *
   * Solo cuando el resalte viene del ARBOL: si siguiera tambien al raton sobre el propio lienzo,
   * cada nodo que rozaras se iria moviendo debajo del cursor.
   */
  $effect(() => {
    const id = highlight.from === 'tree' ? highlight.id : null
    if (!engine) return
    engine.lookAt(id && model.nodes.some((n) => n.id === id) ? id : null, true)
  })

  /** Y si lo senalado es una carpeta entera, la camara va a donde vive esa carpeta. */
  $effect(() => {
    engine?.lookAtGroup(highlight.group)
  })

  // Al llegar por `#/graph/<id>` se enfoca una vez que hay algo que enfocar.
  //
  // ⚠ DEPENDE DE `route.id` Y NO DE `foco`, y la diferencia importa: `foco` incluye ahora el
  // resalte del arbol, asi que con `foco` el primer roce del raton sobre una fila movia la camara
  // y seleccionaba. Pasar el raton por una lista no puede tener consecuencias.
  let focused = false
  $effect(() => {
    const id = route.id
    if (!focused && id && engine && model.nodes.some((n) => n.id === id)) {
      focused = true
      engine.frameOn(id)
      select(id)
    }
  })
</script>

<div class="grafo">
  <div class="barra">
    <div class="group">
      {#each LAYERS as c (c.k)}
        <button class="chip" class:on={filters.layers[c.k]} onclick={() => toggleLayer(c.k)}>
          <svg width="14" height="6" aria-hidden="true">
            <line x1="0" y1="3" x2="14" y2="3" stroke="currentColor" stroke-dasharray={c.dash} />
          </svg>
          {c.label}
        </button>
      {/each}
    </div>

    <div class="group">
      <button class="chip" class:on={filters.crossOnly}
              title="Solo los vínculos que cruzan de un proyecto a otro, que son los que el árbol no puede enseñar"
              onclick={() => (filters = { ...filters, crossOnly: !filters.crossOnly })}>
        transversales
      </button>
      <button class="chip" class:on={filters.hideIsolated}
              onclick={() => (filters = { ...filters, hideIsolated: !filters.hideIsolated })}>
        ocultar sueltas
      </button>
      <button class="chip" title="Volver al encuadre completo" onclick={() => engine?.reframe()}>
        <Icon name="refresh" size={12} color="currentColor" />encuadre
      </button>
      <button class="chip" class:on={settingsOpen} title="Ajustes del grafo"
              aria-expanded={settingsOpen} onclick={() => (settingsOpen = !settingsOpen)}>
        <Icon name="sliders-horizontal" size={12} color="currentColor" />ajustes
      </button>
    </div>
  </div>

  <div class="lienzo-wrap">
    {#if error}
      <div class="msg"><Icon name="triangle-alert" size={15} color="var(--warn)" /> {error}</div>
    {:else if !graph || !(data.tree ?? []).length}
      <div class="msg">Cargando el grafo…</div>
    {:else if !model.nodes.length}
      <div class="msg">Ningún vínculo con estos filtros.</div>
    {:else}
      <Canvas bind:this={engine} {model} {focus} {selection} group={highlight.group}
              onSelect={select} onOpen={(id) => navigate('memory', id)} />
    {/if}
    <!-- Dentro del `lienzo-wrap` a proposito: se posiciona contra el lienzo, no contra la vista, y
         asi el cajon del movil se apoya en el borde de abajo del grafo y no tapa la franja. -->
    <Panel bind:open={settingsOpen} />
  </div>

  <!-- LA FRANJA, que antes era un panel flotante sobre la esquina del lienzo y tapaba justo la
       parte del grafo a la que uno acababa de llegar. Aqui no tapa nada: ocupa su propia banda,
       y cuando no hay nada que mirar se gana el sitio contando el grafo entero. -->
  <div class="franja" class:vacia={!selNode && !looseRow && !highlight.group}>
    {#if highlight.group}
      <!-- Al senalar una carpeta el lienzo no escribe los nombres, porque ochenta titulos
           superpuestos no se leen. Quien dice que estas mirando es esta linea. -->
      <Icon name="folder" size={14} color="var(--dim)" />
      <span class="f-tit">{highlight.label ?? 'carpeta'}</span>
      <span class="f-vin">
        {lit} de {highlight.group.length}
        {highlight.group.length === 1 ? 'memoria' : 'memorias'} en el grafo
      </span>
    {:else if selNode}
      <Icon name={typeMeta(selNode.memory_type).icon} size={14} color={typeColor(selNode.memory_type)} />
      <span class="f-tit" title={selNode.title ?? ''}>{selNode.title ?? '(sin título)'}</span>
      <span class="f-meta">{selNode.path ?? ''}</span>
      <span class="f-vin">{selNode.degree} {selNode.degree === 1 ? 'vínculo' : 'vínculos'}</span>
    {:else if looseRow}
      <Icon name={typeMeta(looseRow.memory_type).icon} size={14} color={typeColor(looseRow.memory_type)} />
      <span class="f-tit" title={looseRow.title ?? ''}>{looseRow.title ?? '(sin título)'}</span>
      <span class="f-meta">{looseRow.path ?? ''}</span>
      <span class="f-vin fuera">fuera del grafo con estos filtros</span>
    {:else}
      <span class="f-cuentas">
        <b>{model.nodes.length}</b> memorias · <b>{model.edges.length}</b> vínculos ·
        <b>{model.components}</b> groups{#if filters.hideIsolated && model.isolated}
          · {model.isolated} sueltas fuera{/if}{#if model.hiddenEdges}
          · <b>{model.hiddenEdges}</b> en carpetas cerradas{/if}
      </span>
    {/if}
  </div>
</div>

<style>
  .grafo { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .barra { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 18px; padding: 12px 20px 8px; }
  .group { display: flex; gap: 6px; }

  .chip { display: inline-flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--border); border-radius: 99px; padding: 4px 11px; font: 11px var(--font-mono); color: var(--dim); }
  .chip:hover { color: var(--ink); }
  .chip.on { color: var(--ink); border-color: var(--dim); }

  .lienzo-wrap { position: relative; flex: 1 1 auto; min-height: 0; border-top: 1px solid var(--border); }
  .msg { display: flex; align-items: center; justify-content: center; gap: 8px; height: 100%; color: var(--dim); font: 13px var(--font-sans); }

  .franja { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; min-height: 42px; padding: 6px 20px; border-top: 1px solid var(--border); background: var(--panel); }
  .f-tit { font: 500 13px var(--font-sans); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .f-meta { font: 11px var(--font-mono); color: var(--dim); white-space: nowrap; }
  /* El contador empuja al boton contra el borde: el sitio del boton no cambia con el largo del
     titulo, asi que la mano lo encuentra sin mirar. */
  .f-vin { margin-left: auto; font: 11px var(--font-mono); color: var(--dim); white-space: nowrap; }
  .f-vin.fuera { color: var(--warn); }
  .f-cuentas { font: 11px var(--font-mono); color: var(--dim); }
  .f-cuentas b { color: var(--ink); font-weight: 500; }
  .franja.vacia { background: none; }

  @media (max-width: 600px) {
    .barra { padding: 10px 12px 6px; }
    .franja { padding: 6px 12px; gap: 8px; }
    /* En 375 px no caben las cuatro cosas: el path se va, que es lo que menos se echa de menos
       teniendo el titulo delante. */
    .franja .f-meta { display: none; }
  }
</style>
