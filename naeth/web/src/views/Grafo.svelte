<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '../components/Icon.svelte'
  import Lienzo from './graph/Lienzo.svelte'
  import { getGraph, getKnn } from '../lib/api'
  import { data } from '../lib/data.svelte'
  import { navigate, route } from '../lib/router.svelte'
  import { projColor, typeMeta, typeColor } from '../lib/colors'
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

  // El foco llega por la ruta `#/grafo/<id>`, que es a donde lleva el boton del mini grafo.
  const foco = $derived(route.id)

  const model = $derived(buildGraph(data.tree ?? [], grafo, knn, filtros))

  const nodoSel = $derived(model.nodes.find((n) => n.id === seleccion) ?? null)

  /** Proyectos presentes, de mas a menos, para los chips del filtro. */
  const proyectos = $derived.by(() => {
    const c = new Map<string, number>()
    for (const r of data.tree ?? []) {
      const p = proyectoDe(r.path)
      c.set(p, (c.get(p) ?? 0) + 1)
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1])
  })

  const CAPAS: { k: EdgeLayer; label: string; trazo: string }[] = [
    { k: 'relation', label: 'relaciones', trazo: '' },
    { k: 'wikilink', label: 'wikilinks', trazo: '2 3' },
    { k: 'semantic', label: 'semánticos', trazo: '5 3' },
  ]

  function toggleCapa(k: EdgeLayer) {
    filtros = { ...filtros, layers: { ...filtros.layers, [k]: !filtros.layers[k] } }
  }

  function toggleProyecto(p: string) {
    const actual = filtros.projects
    const s = new Set(actual ?? proyectos.map((x) => x[0]))
    if (s.has(p)) s.delete(p)
    else s.add(p)
    // Todos marcados equivale a "sin filtro": asi el estado no se queda en un conjunto que hay
    // que mantener al dia cada vez que nazca un proyecto nuevo.
    filtros = { ...filtros, projects: s.size === proyectos.length ? null : s }
  }

  const activo = (p: string) => !filtros.projects || filtros.projects.has(p)

  /**
   * La capa semantica se pide POR NODO, nunca para todo el corpus: medido, el kNN global tarda
   * 2,7 s y el de una nota 16 ms. Asi que el vecindario semantico se despliega alrededor de lo
   * que miras, que ademas es como se explora un grafo.
   */
  async function seleccionar(id: string | null) {
    seleccion = id
    if (!id || !filtros.layers.semantic || knn.has(id)) return
    try {
      const r = await getKnn(id, 6)
      knn = new Map(knn).set(id, r.neighbors)
    } catch { /* sin vecinos semanticos se sigue viendo el resto */ }
  }

  // Al llegar con foco, se enfoca una vez que hay algo que enfocar.
  let enfocado = false
  $effect(() => {
    if (!enfocado && foco && motor && model.nodes.some((n) => n.id === foco)) {
      enfocado = true
      motor.encuadrar(foco)
      seleccionar(foco)
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

    <div class="cuentas">
      <b>{model.nodes.length}</b> memorias · <b>{model.edges.length}</b> vínculos ·
      <b>{model.componentes}</b> grupos{#if filtros.ocultarAislados && model.aislados}
        · {model.aislados} sueltas fuera{/if}
    </div>
  </div>

  <div class="proyectos">
    {#each proyectos as [p, n] (p)}
      <button class="pj" class:off={!activo(p)} onclick={() => toggleProyecto(p)}>
        <span class="pt" style="background:{projColor(p)}"></span>{p}<span class="pn">{n}</span>
      </button>
    {/each}
  </div>

  <div class="lienzo-wrap">
    {#if error}
      <div class="msg"><Icon name="triangle-alert" size={15} color="var(--warn)" /> {error}</div>
    {:else if !grafo || !(data.tree ?? []).length}
      <div class="msg">Cargando el grafo…</div>
    {:else if !model.nodes.length}
      <div class="msg">Ningún vínculo con estos filtros.</div>
    {:else}
      <Lienzo bind:this={motor} {model} {foco} {seleccion}
              onSelect={seleccionar} onOpen={(id) => navigate('memoria', id)} />
    {/if}

    {#if nodoSel}
      <aside class="panel">
        <div class="p-tipo">
          <Icon name={typeMeta(nodoSel.memory_type).icon} size={13} color={typeColor(nodoSel.memory_type)} />
          <span>{nodoSel.memory_type}</span>
          <button class="p-x" aria-label="Cerrar" onclick={() => (seleccion = null)}>
            <Icon name="x" size={13} color="var(--dim)" />
          </button>
        </div>
        <h3>{nodoSel.title ?? '(sin título)'}</h3>
        <div class="p-meta">{nodoSel.path ?? ''} · {nodoSel.degree} vínculos</div>
        <button class="p-abrir" onclick={() => navigate('memoria', nodoSel.id)}>Abrir la memoria</button>
        <div class="p-tip">o un clic sobre el nodo</div>
      </aside>
    {/if}
  </div>
</div>

<style>
  .grafo { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .barra { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 18px; padding: 12px 20px 8px; }
  .grupo { display: flex; gap: 6px; }
  .cuentas { margin-left: auto; font: 11px var(--font-mono); color: var(--dim); }
  .cuentas b { color: var(--ink); font-weight: 500; }

  .chip { display: inline-flex; align-items: center; gap: 6px; background: none; border: 1px solid var(--border); border-radius: 99px; padding: 4px 11px; font: 11px var(--font-mono); color: var(--dim); }
  .chip:hover { color: var(--ink); }
  .chip.on { color: var(--ink); border-color: var(--dim); }

  .proyectos { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 20px 10px; }
  .pj { display: inline-flex; align-items: center; gap: 5px; background: none; border: 0; padding: 2px 6px; border-radius: 5px; font: 10px var(--font-mono); color: var(--ink); }
  .pj:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
  .pj.off { color: var(--dim); opacity: .45; }
  .pt { width: 8px; height: 8px; border-radius: 2px; }
  .pj.off .pt { opacity: .35; }
  .pn { color: var(--dim); }

  .lienzo-wrap { position: relative; flex: 1 1 auto; min-height: 0; border-top: 1px solid var(--border); }
  .msg { display: flex; align-items: center; justify-content: center; gap: 8px; height: 100%; color: var(--dim); font: 13px var(--font-sans); }

  .panel { position: absolute; right: 16px; top: 16px; width: 260px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
  .p-tipo { display: flex; align-items: center; gap: 6px; font: 10px var(--font-mono); text-transform: uppercase; letter-spacing: .5px; color: var(--dim); }
  .p-x { margin-left: auto; background: none; border: 0; padding: 0; display: inline-flex; }
  .panel h3 { margin: 8px 0 6px; font: 500 14px/1.4 var(--font-sans); color: var(--ink); }
  .p-meta { font: 11px var(--font-mono); color: var(--dim); }
  .p-abrir { margin-top: 10px; width: 100%; background: none; border: 1px solid var(--border); border-radius: 6px; padding: 6px; font: 12px var(--font-sans); color: var(--ink); }
  .p-abrir:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
  .p-tip { margin-top: 6px; text-align: center; font: 10px var(--font-mono); color: var(--dim); }

  @media (max-width: 600px) {
    .barra { padding: 10px 12px 6px; }
    /* Los 26 proyectos se apilan en ocho filas y se comian 301 px de los 812 de un movil,
       dejando el lienzo en 387. Medido el 04/09/2026 a 375 px. Con dos filas y scroll siguen
       estando todos y el grafo recupera su sitio, que es lo que se ha venido a mirar. */
    .proyectos { padding: 0 12px 8px; max-height: 66px; overflow-y: auto; }
    .panel { right: 8px; left: 8px; width: auto; }
  }
</style>
