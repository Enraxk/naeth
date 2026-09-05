<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '../components/Icon.svelte'
  import Lienzo from './graph/Lienzo.svelte'
  import { getGraph, getKnn } from '../lib/api'
  import { data } from '../lib/data.svelte'
  import { navigate, route } from '../lib/router.svelte'
  import { resalte, resaltar } from '../lib/ui.svelte'
  import { collapsed } from '../lib/prefs.svelte'
  import { carpetaQueEsconde } from '../lib/tree'
  import { typeMeta, typeColor } from '../lib/colors'
  import { buildGraph, filtrosPorDefecto, proyectoDe, type EdgeLayer } from '../lib/graph'
    import type { GraphResponse, KnnNeighbor } from '../lib/types'

  let grafo = $state<GraphResponse | null>(null)
  let error = $state('')
  let filtros = $state(filtrosPorDefecto())
  let seleccion = $state<string | null>(null)
  let knn = $state(new Map<string, KnnNeighbor[]>())
  let motor = $state<Lienzo | null>(null)

  onMount(async () => {
    try {
      grafo = await getGraph()
    } catch {
      error = 'No se ha podido leer el grafo del nodo.'
    }
  })

  // El foco llega por la ruta `#/grafo/<id>`, que es a donde lleva el boton del mini grafo, o por
  // el resalte compartido, que es el raton pasando por una fila del arbol.
  const foco = $derived(resalte.id ?? route.id)

  // El exento entra en los filtros para que una nota senalada en el arbol no pueda quedar
  // escondida por "ocultar sueltas". Pedir ver algo y que el grafo se quede callado porque un
  // filtro lo tapaba es la peor respuesta, y ademas no hay forma de adivinar la causa.
  /**
   * Lo que el arbol esconde: toda memoria cuya carpeta esta colapsada.
   *
   * Cerrar una carpeta la retira del grafo. Reutiliza `carpetaQueEsconde`, la misma funcion pura
   * que usa la sidebar para saber que fila encender, asi que las dos vistas no pueden discrepar
   * sobre que esta escondido, que es como nacen los bugs que nadie reproduce.
   */
  const ocultos = $derived.by(() => {
    if (!collapsed.size) return null
    const s = new Set<string>()
    for (const r of data.tree ?? []) if (carpetaQueEsconde(r.path, collapsed)) s.add(r.id)
    return s.size ? s : null
  })

  const model = $derived(
    buildGraph(data.tree ?? [], grafo, knn, { ...filtros, exento: resalte.id, ocultos }),
  )

  // Lo que cuenta la franja de abajo: lo resaltado si hay algo, y si no lo seleccionado.
  const idFranja = $derived(resalte.id ?? seleccion)
  const nodoSel = $derived(model.nodes.find((n) => n.id === idFranja) ?? null)
  /**
   * La nota resaltada desde el arbol puede NO estar en el grafo: sin vinculos, o filtrada. En vez
   * de dejar la franja en blanco, se dice, que ademas responde a la pregunta que uno se hace en
   * ese momento (por que no la veo).
   */
  /** Cuantas de la carpeta senalada estan de verdad en el grafo. Las que no, no tienen vinculos. */
  const encendidas = $derived(
    resalte.grupo ? model.nodes.filter((n) => resalte.grupo!.includes(n.id)).length : 0,
  )
  const filaSuelta = $derived(
    !nodoSel && idFranja ? ((data.tree ?? []).find((r) => r.id === idFranja) ?? null) : null,
  )

  const CAPAS: { k: EdgeLayer; label: string; trazo: string }[] = [
    { k: 'relation', label: 'relaciones', trazo: '' },
    { k: 'wikilink', label: 'wikilinks', trazo: '2 3' },
    { k: 'semantic', label: 'semánticos', trazo: '5 3' },
  ]

  function toggleCapa(k: EdgeLayer) {
    filtros = { ...filtros, layers: { ...filtros.layers, [k]: !filtros.layers[k] } }
  }

  /**
   * La capa semantica se pide POR NODO, nunca para todo el corpus: medido, el kNN global tarda
   * 2,7 s y el de una nota 16 ms. Asi que el vecindario semantico se despliega alrededor de lo
   * que miras, que ademas es como se explora un grafo.
   */
  async function seleccionar(id: string | null) {
    seleccion = id
    // El otro extremo del hilo: lo que toca el raton aqui se enciende en el arbol.
    resaltar(id)
    if (!id || !filtros.layers.semantic || knn.has(id)) return
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
    const id = resalte.desde === 'arbol' ? resalte.id : null
    if (!motor) return
    motor.mirar(id && model.nodes.some((n) => n.id === id) ? id : null, true)
  })

  /** Y si lo senalado es una carpeta entera, la camara va a donde vive esa carpeta. */
  $effect(() => {
    motor?.mirarGrupo(resalte.grupo)
  })

  // Al llegar por `#/grafo/<id>` se enfoca una vez que hay algo que enfocar.
  //
  // ⚠ DEPENDE DE `route.id` Y NO DE `foco`, y la diferencia importa: `foco` incluye ahora el
  // resalte del arbol, asi que con `foco` el primer roce del raton sobre una fila movia la camara
  // y seleccionaba. Pasar el raton por una lista no puede tener consecuencias.
  let enfocado = false
  $effect(() => {
    const id = route.id
    if (!enfocado && id && motor && model.nodes.some((n) => n.id === id)) {
      enfocado = true
      motor.encuadrar(id)
      seleccionar(id)
    }
  })
</script>

<div class="grafo">
  <div class="barra">
    <div class="grupo">
      {#each CAPAS as c (c.k)}
        <button class="chip" class:on={filtros.layers[c.k]} onclick={() => toggleCapa(c.k)}>
          <svg width="14" height="6" aria-hidden="true">
            <line x1="0" y1="3" x2="14" y2="3" stroke="currentColor" stroke-dasharray={c.trazo} />
          </svg>
          {c.label}
        </button>
      {/each}
    </div>

    <div class="grupo">
      <button class="chip" class:on={filtros.soloTransversales}
              title="Solo los vínculos que cruzan de un proyecto a otro, que son los que el árbol no puede enseñar"
              onclick={() => (filtros = { ...filtros, soloTransversales: !filtros.soloTransversales })}>
        transversales
      </button>
      <button class="chip" class:on={filtros.ocultarAislados}
              onclick={() => (filtros = { ...filtros, ocultarAislados: !filtros.ocultarAislados })}>
        ocultar sueltas
      </button>
      <button class="chip" title="Volver al encuadre completo" onclick={() => motor?.reencuadrar()}>
        <Icon name="refresh" size={12} color="currentColor" />encuadre
      </button>
    </div>
  </div>

  <div class="lienzo-wrap">
    {#if error}
      <div class="msg"><Icon name="triangle-alert" size={15} color="var(--warn)" /> {error}</div>
    {:else if !grafo || !(data.tree ?? []).length}
      <div class="msg">Cargando el grafo…</div>
    {:else if !model.nodes.length}
      <div class="msg">Ningún vínculo con estos filtros.</div>
    {:else}
      <Lienzo bind:this={motor} {model} {foco} {seleccion} grupo={resalte.grupo}
              onSelect={seleccionar} onOpen={(id) => navigate('memoria', id)} />
    {/if}
  </div>

  <!-- LA FRANJA, que antes era un panel flotante sobre la esquina del lienzo y tapaba justo la
       parte del grafo a la que uno acababa de llegar. Aqui no tapa nada: ocupa su propia banda,
       y cuando no hay nada que mirar se gana el sitio contando el grafo entero. -->
  <div class="franja" class:vacia={!nodoSel && !filaSuelta && !resalte.grupo}>
    {#if resalte.grupo}
      <!-- Al senalar una carpeta el lienzo no escribe los nombres, porque ochenta titulos
           superpuestos no se leen. Quien dice que estas mirando es esta linea. -->
      <Icon name="folder" size={14} color="var(--dim)" />
      <span class="f-tit">{resalte.etiqueta ?? 'carpeta'}</span>
      <span class="f-vin">
        {encendidas} de {resalte.grupo.length}
        {resalte.grupo.length === 1 ? 'memoria' : 'memorias'} en el grafo
      </span>
    {:else if nodoSel}
      <Icon name={typeMeta(nodoSel.memory_type).icon} size={14} color={typeColor(nodoSel.memory_type)} />
      <span class="f-tit" title={nodoSel.title ?? ''}>{nodoSel.title ?? '(sin título)'}</span>
      <span class="f-meta">{nodoSel.path ?? ''}</span>
      <span class="f-vin">{nodoSel.degree} {nodoSel.degree === 1 ? 'vínculo' : 'vínculos'}</span>
    {:else if filaSuelta}
      <Icon name={typeMeta(filaSuelta.memory_type).icon} size={14} color={typeColor(filaSuelta.memory_type)} />
      <span class="f-tit" title={filaSuelta.title ?? ''}>{filaSuelta.title ?? '(sin título)'}</span>
      <span class="f-meta">{filaSuelta.path ?? ''}</span>
      <span class="f-vin fuera">fuera del grafo con estos filtros</span>
    {:else}
      <span class="f-cuentas">
        <b>{model.nodes.length}</b> memorias · <b>{model.edges.length}</b> vínculos ·
        <b>{model.componentes}</b> grupos{#if filtros.ocultarAislados && model.aislados}
          · {model.aislados} sueltas fuera{/if}{#if model.ocultas}
          · <b>{model.ocultas}</b> en carpetas cerradas{/if}
      </span>
    {/if}
  </div>
</div>

<style>
  .grafo { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .barra { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 18px; padding: 12px 20px 8px; }
  .grupo { display: flex; gap: 6px; }

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
