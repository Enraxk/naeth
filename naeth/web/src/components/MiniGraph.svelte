<!-- Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
     No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE -->
<script lang="ts">
  import Canvas from '../views/graph/Canvas.svelte'
  import { navigate } from '../lib/router.svelte'
  import { highlight, highlightNode } from '../lib/ui.svelte'
  import { DASH } from '../lib/painter'
  import { layoutMap, requestMap } from '../lib/layout-map.svelte'
  import { data } from '../lib/data.svelte'
  import type { GraphModel, EdgeLayer } from '../lib/graph'

  // Vecindario a un salto, en el panel de contexto de una memoria.
  //
  // ES EL MISMO LIENZO QUE EL GRAFO GRANDE: el mismo simulador, el mismo pintor y la misma
  // interacción, solo que en 276 px. Es overkill medido y es deliberado, decidido por Eneko el
  // 05/09/2026: *"quiero que se vea y se sienta como el grafo normal, así cada memoria se siente
  // viva"*. Aquí no se viene a ahorrar milisegundos, se viene a que abrir una nota no sea abrir una
  // ficha muerta.
  //
  // Antes esto era un anillo radial en SVG, y aquel diseño tenía una virtud real que NO se ha
  // perdido: cada vecino era un elemento tabulable con su título. Eso vive ahora en la lista
  // accesible del propio lienzo, así que el cambio suma accesibilidad al grafo grande en vez de
  // restársela a este.
  //
  // Cuesta un simulador por ficha abierta, y con 3 a 15 nodos eso es ruido: un tick va en décimas
  // de milisegundo y el bucle se detiene solo en cuanto la simulación se calma, así que una ficha
  // en pantalla no consume nada en reposo.

  let { model, center }: { model: GraphModel; center: string } = $props()

  // El mapa global es lo que hace que este vecindario se vea COMO SE VE en el grafo entero. Se pide
  // aqui y no en la vista: es esta pieza la que lo necesita, y asi la ficha no paga nada si el
  // panel de contexto no llega a mostrarse.
  //
  // ⚠ DEPENDE SOLO DE `data.tree`, y eso es lo que hace que no reviente. `requestMap` muta `layoutMap`,
  // que este mismo componente lee en el marcado, asi que un efecto que leyera `layoutMap` se reinvocaria
  // solo: fueron 15 peticiones a `/api/graph` por abrir una ficha, medidas. Leyendo unicamente el
  // arbol no hay ciclo.
  //
  // Y tiene que ser un efecto y no un `onMount`: al montar solo, el mapa se quedaba viejo hasta que
  // abrieras OTRA ficha, aunque hubieran entrado memorias nuevas mientras leias esta.
  $effect(() => {
    data.tree
    requestMap()
  })

  const LABEL: Record<EdgeLayer, string> = {
    relation: 'relación',
    wikilink: 'wikilink',
    semantic: 'vecino semántico',
  }

  /** Las capas que de verdad aparecen en este vecindario, para no explicar lo que no se ve. */
  const layers = $derived([...new Set(model.edges.map((e) => e.layer))])
</script>

{#if model.nodes.length > 1}
  <div class="mini">
    <Canvas
      {model}
      selection={center}
      focus={highlight.id}
      compact
      positions={layoutMap.ready ? layoutMap.pos : null}
      onSelect={(id) => highlightNode(id ?? center, 'tree')}
      onOpen={(id) => navigate('memory', id)}
    />
  </div>

  {#if layoutMap.computing && !layoutMap.ready}
    <!-- La primera ficha de la sesion espera a que el mapa se calcule, cosa de un segundo. Las
         demas lo encuentran hecho. Se dice, en vez de enseñar una forma provisional que luego
         cambia sola delante de los ojos. -->
    <div class="esperando">calculando la forma del grafo…</div>
  {/if}

  <div class="leyenda">
    {#each layers as l (l)}
      <span class="lg">
        <svg width="16" height="6" aria-hidden="true">
          <line x1="0" y1="3" x2="16" y2="3" stroke="var(--dim)"
                stroke-dasharray={DASH[l].join(' ')} />
        </svg>
        {LABEL[l]}
      </span>
    {/each}
  </div>
{/if}

<style>
  /* Alto fijo: el lienzo se dimensiona con un ResizeObserver sobre su contenedor, así que necesita
     uno que mida algo. Con 200 px cabe un vecindario de doce sin que los nodos se toquen. */
  .mini {
    height: 200px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .esperando { margin-top: 6px; font: 10px var(--font-mono); color: var(--dim); }
  .leyenda { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; }
  .lg { display: inline-flex; align-items: center; gap: 5px; font: 10px var(--font-mono); color: var(--dim); }
</style>
