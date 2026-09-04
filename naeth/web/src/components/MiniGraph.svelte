<script lang="ts">
  import { navigate } from '../lib/router.svelte'
  import { projColor } from '../lib/colors'
  import type { GraphModel, GraphNode, EdgeLayer } from '../lib/graph'

  // Vecindario a un salto, en el panel de contexto de una memoria.
  //
  // LAYOUT RADIAL Y NO SIMULACION DE FUERZAS, y es una decision, no una simplificacion:
  //  - Con grado mediano 2 y maximo 11 (medido sobre el corpus el 04/09/2026) no hay nada que
  //    una simulacion pueda desenredar que un anillo no resuelva ya.
  //  - Es DETERMINISTA: el mismo vecindario se dibuja siempre igual, asi que volver a una nota
  //    no reordena lo que acabas de mirar.
  //  - Y no mueve nada, asi que no entra en el conflicto con `prefers-reduced-motion`. Una
  //    simulacion son objetos desplazandose por pantalla, que es justo lo que esa politica
  //    retira, y no se puede resolver por tokens porque no es una transicion CSS. Eso lo tendra
  //    que resolver el grafo global; aqui no se paga.
  //
  // La codificacion es la decidida el 04/09: FORMA = tipo de memoria (cuatro valores) y
  // COLOR = proyecto. Es lo unico que escala a 26 proyectos, porque 26 formas de anillo no se
  // distinguirian, y mantiene el color atado a un significado.

  let { model, centro }: { model: GraphModel; centro: string } = $props()

  const W = 276
  const H = 186
  const CX = W / 2
  const CY = H / 2

  const nodo = $derived(new Map(model.nodes.map((n) => [n.id, n])))
  const vecinos = $derived(
    model.edges
      .map((e) => ({
        otro: e.source === centro ? e.target : e.source,
        layer: e.layer,
        predicate: e.predicate,
        confirmed: e.confirmed,
      }))
      .filter((v) => nodo.has(v.otro)),
  )

  /** Dos anillos a partir de siete: en uno solo, ocho nodos se tocan a este ancho. */
  const anillos = $derived.by(() => {
    const n = vecinos.length
    if (n <= 6) return [{ desde: 0, hasta: n, r: 62 }]
    const dentro = Math.ceil(n / 2)
    return [
      { desde: 0, hasta: dentro, r: 42 },
      { desde: dentro, hasta: n, r: 74 },
    ]
  })

  const posiciones = $derived.by(() => {
    const out = new Map<number, { x: number; y: number }>()
    for (const a of anillos) {
      const cuantos = a.hasta - a.desde
      for (let i = a.desde; i < a.hasta; i++) {
        // Se arranca arriba (-90 grados) para que el dibujo no dependa del orden de llegada.
        const ang = (-Math.PI / 2) + ((i - a.desde) / cuantos) * Math.PI * 2
        out.set(i, { x: CX + Math.cos(ang) * a.r, y: CY + Math.sin(ang) * a.r })
      }
    }
    return out
  })

  /** Sólida la relación, punteada el wikilink, discontinua el vecino semántico. */
  const TRAZO: Record<EdgeLayer, string> = {
    relation: '',
    wikilink: '2 3',
    semantic: '5 3',
  }

  const ETIQUETA: Record<EdgeLayer, string> = {
    relation: 'relación',
    wikilink: 'wikilink',
    semantic: 'vecino semántico',
  }

  /** Las cuatro formas del vocabulario cerrado de tipos, a un tamaño donde se distinguen. */
  function forma(n: GraphNode | undefined, x: number, y: number, r: number): string {
    switch (n?.memory_type) {
      case 'decision':
        return `M${x - r} ${y - r}h${r * 2}v${r * 2}h${-r * 2}Z`
      case 'observation':
        return `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`
      case 'preference':
        return `M${x} ${y - r}L${x + r} ${y + r * 0.8}L${x - r} ${y + r * 0.8}Z`
      default:
        // `fact` y cualquier tipo retirado que siga vivo en una nota vieja: circulo.
        return `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`
    }
  }

  const tituloDe = (n: GraphNode | undefined) => n?.title ?? '(sin título)'
</script>

{#if vecinos.length}
  <svg class="mini" viewBox="0 0 {W} {H}" role="img"
       aria-label="Vecindario de esta memoria: {vecinos.length} conexiones directas">
    {#each vecinos as v, i (v.otro + v.layer)}
      {@const p = posiciones.get(i)}
      {#if p}
        <line
          x1={CX} y1={CY} x2={p.x} y2={p.y}
          stroke="var(--dim)"
          stroke-width={v.confirmed ? 1.6 : 1}
          stroke-dasharray={TRAZO[v.layer]}
        />
      {/if}
    {/each}

    {#each vecinos as v, i (v.otro + v.layer)}
      {@const p = posiciones.get(i)}
      {@const n = nodo.get(v.otro)}
      {#if p}
        <g class="nd" role="button" tabindex="0"
           onclick={() => navigate('memoria', v.otro)}
           onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('memoria', v.otro) } }}>
          <title>{tituloDe(n)} · {n?.path ?? ''} · {ETIQUETA[v.layer]}{v.confirmed ? ' (también wikilink)' : ''}</title>
          <path d={forma(n, p.x, p.y, 6)} fill={projColor(n?.path?.split('/')[0] ?? '')} />
        </g>
      {/if}
    {/each}

    <g>
      <title>Esta memoria</title>
      <path d={forma(nodo.get(centro), CX, CY, 9)}
            fill={projColor(nodo.get(centro)?.path?.split('/')[0] ?? '')}
            stroke="var(--bg)" stroke-width="2.5" />
    </g>
  </svg>

  <div class="leyenda">
    {#each [...new Set(vecinos.map((v) => v.layer))] as l (l)}
      <span class="lg">
        <svg width="16" height="6" aria-hidden="true">
          <line x1="0" y1="3" x2="16" y2="3" stroke="var(--dim)" stroke-dasharray={TRAZO[l]} />
        </svg>
        {ETIQUETA[l]}
      </span>
    {/each}
  </div>
{/if}

<style>
  .mini { width: 100%; height: auto; display: block; }
  /* Sin transicion: el panel entero se remonta al cambiar de memoria, asi que animar la entrada
     seria animar cada navegacion. */
  .nd { cursor: pointer; }
  .nd:hover path { stroke: var(--ink); stroke-width: 1.5; }
  .nd:focus-visible { outline: none; }
  .nd:focus-visible path { stroke: var(--accent); stroke-width: 2; }
  .leyenda { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; }
  .lg { display: inline-flex; align-items: center; gap: 5px; font: 10px var(--font-mono); color: var(--dim); }
</style>
