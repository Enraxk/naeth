<!-- Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
     No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE -->
<script lang="ts">
  import Icon from '../../components/Icon.svelte'
  import {
    CATALOG, graphPrefs, GROUPS, controlsOf, set, restore,
    type Key, type Group,
  } from '../../lib/prefs-graph.svelte'

  // El panel de ajustes del grafo.
  //
  // POR QUE VIVE AQUI Y NO EN AJUSTES. Un deslizador cuyo efecto no se ve mientras se mueve es
  // tocar a ciegas: habria que ir a Ajustes, cambiar, volver al grafo, mirar y repetir. Decidido
  // con Eneko el 06/09. Ajustes tendra su enlace, pero los mandos viven encima del grafo.
  //
  // Y ES LO QUE JUBILA MEDIA DISCUSION: hasta ahora, elegir el tinte de una arista o el tamaño de
  // un nodo pedia escribir un banco de pruebas. Con esto, el visor ES el banco.

  let { open = $bindable(false) }: { open?: boolean } = $props()

  // Un `Record<Group, ...>`, no una lista: asi añadir un grupo al catalogo y olvidarse de darle
  // titulo aqui NO COMPILA, en vez de quedarse como una seccion que no se pinta y de la que nadie se
  // entera. El orden lo pone `GROUPS`, que es de donde tira el `{#each}`.
  const SECTIONS: Record<Group, { title: string; icon: string }> = {
    text: { title: 'Texto', icon: 'file-text' },
    nodes: { title: 'Nodos', icon: 'circle' },
    edges: { title: 'Aristas', icon: 'share-2' },
    physics: { title: 'Física', icon: 'zap' },
    experimental: { title: 'Experimental', icon: 'flask-conical' },
  }

  /** Cuantos decimales enseñar, deducidos del paso: un paso de 1 no quiere ver "34,00". */
  function fmt(v: number, step: number) {
    const d = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
    return v.toFixed(d).replace('.', ',')
  }

  function onKeyboard(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      open = false
      e.stopPropagation()
    }
  }
</script>

<svelte:window onkeydown={onKeyboard} />

{#if open}
  <!-- `aria-label` y no un titulo visible: el titulo lo lleva la cabecera de dentro. -->
  <aside class="panel" aria-label="Ajustes del grafo">
    <header class="cab">
      <span class="tit">Ajustes del grafo</span>
      <button class="x" onclick={() => (open = false)} title="Cerrar (Escape)" aria-label="Cerrar ajustes">
        <Icon name="x" size={14} color="currentColor" />
      </button>
    </header>

    <div class="cuerpo">
      {#each GROUPS as g (g)}
        {@const s = SECTIONS[g]}
        <section>
          <div class="sec-cab">
            <Icon name={s.icon} size={12} color="var(--dim)" />
            <span>{s.title}</span>
            <button class="mini" onclick={() => restore(g)} title="Devolver esta sección a sus valores de fábrica">
              restaurar
            </button>
          </div>

          {#if g === 'experimental'}
            <!-- Aviso honesto, no un descargo: estos son los que pueden dejar el grafo raro, y por
                 eso el pie del panel enseña la salida que funciona incluso entonces. -->
            <p class="aviso">
              Estos cambian cómo se lee el grafo entero. Si lo dejas ilegible, la salida está abajo.
            </p>
          {/if}
          {#each controlsOf(g) as { key, mando } (key)}
            {@const id = 'aj-' + key}
            {#if mando.kind === 'bool'}
              <div class="mando bool">
                <input type="checkbox" {id}
                       bind:checked={
                         () => graphPrefs[key] as boolean,
                         (v) => set(key as Key, v as never)
                       } />
                <label for={id}>{mando.label}</label>
              </div>
            {:else}
              <div class="mando">
                <label for={id}>
                  {mando.label}
                  <!-- El numero SIEMPRE a la vista: un deslizador sin valor no se puede comunicar
                       ("subelo un poco" no es un ajuste) ni comparar con lo que se midio. -->
                  <output for={id}>{fmt(graphPrefs[key] as number, mando.step)}</output>
                </label>
                <!-- ⚠ `bind:` CON GETTER Y SETTER, no `value=` mas `oninput`.
                     Con el atributo controlado, cada cambio vuelve a renderizar el input a mitad del
                     arrastre y el navegador se pelea con la mano por la posicion del pulgar: el
                     sintoma es que mover el deslizador no hace nada hasta soltarlo o hasta hacer
                     clic en otra parte, que es justo lo que reporto Eneko el 08/09. Con `bind:` el
                     valor lo lleva el propio input y el setter solo lo propaga. -->
                <input type="range" {id}
                       min={mando.min} max={mando.max} step={mando.step}
                       bind:value={
                         () => graphPrefs[key] as number,
                         (v) => set(key as Key, v as never)
                       } />
              </div>
            {/if}
            {#if mando.note}<p class="note">{mando.note}</p>{/if}
          {/each}
        </section>
      {/each}
    </div>

    <footer>
      <button class="todo" onclick={() => restore()}>
        <Icon name="refresh" size={12} color="currentColor" />
        Restaurar todo
      </button>
      <!-- LA SALIDA DE EMERGENCIA, escrita donde se pueda copiar. El boton de arriba no sirve si el
           grafo queda ilegible, porque el boton vive dentro del grafo; la barra de direcciones sigue
           ahi pase lo que pase. -->
      <span class="pista">
        Se guarda en este navegador. Si algo queda ilegible: <code>#/graph?reset</code>
      </span>
    </footer>
  </aside>
{/if}

<style>
  .panel {
    position: absolute;
    top: 8px;
    right: 8px;
    bottom: 8px;
    width: 288px;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    z-index: 5;
    overflow: hidden;
  }

  .cab {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 12px;
    border-bottom: 1px solid var(--border);
    flex: 0 0 auto;
  }
  .tit { font-size: 12px; font-weight: 600; }
  .x {
    background: none;
    border: 0;
    color: var(--dim);
    cursor: pointer;
    padding: 2px;
    display: flex;
    border-radius: 5px;
  }
  .x:hover { color: var(--ink); background: var(--bg2); }

  .cuerpo { overflow-y: auto; padding: 4px 12px 12px; flex: 1 1 auto; }

  .sec-cab {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 14px 0 8px;
    font-size: 10.5px;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--dim);
  }
  .mini {
    margin-left: auto;
    background: none;
    border: 0;
    color: var(--dim);
    font: inherit;
    font-size: 10px;
    letter-spacing: 0;
    text-transform: none;
    cursor: pointer;
    padding: 1px 4px;
    border-radius: 4px;
  }
  .mini:hover { color: var(--ink); background: var(--bg2); }

  .mando { margin-bottom: 9px; }
  .mando label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
    margin-bottom: 3px;
  }
  output { font-variant-numeric: tabular-nums; color: var(--dim); font-size: 11px; }
  .mando.bool {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 9px;
  }
  .mando.bool label { display: block; margin: 0; font-size: 12px; }

  input[type='range'] { width: 100%; accent-color: var(--accent); }
  input[type='checkbox'] { accent-color: var(--accent); }

  .note {
    margin: -5px 0 10px;
    font-size: 10.5px;
    line-height: 1.4;
    color: var(--dim);
  }

  footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    flex: 0 0 auto;
  }
  .todo {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--ink);
    font: inherit;
    font-size: 11px;
    padding: 4px 9px;
    cursor: pointer;
  }
  .todo:hover { border-color: var(--dim); }
  .pista { font-size: 10.5px; color: var(--dim); line-height: 1.35; }
  .pista code { font-family: var(--mono, ui-monospace, monospace); font-size: 10px; }

  .aviso {
    margin: 0 0 10px;
    font-size: 10.5px;
    line-height: 1.4;
    color: var(--dim);
    border-left: 2px solid var(--warn);
    padding-left: 7px;
  }

  /* EN EL MOVIL, CAJON DESDE ABAJO A MEDIA ALTURA, y no un panel lateral ni una pantalla completa.
     Elegido por Eneko el 08/09 con el motivo escrito: a pantalla completa se pierde el efecto en
     vivo, que es justo el motivo de haber metido los mandos dentro del grafo. Asi la mitad de
     arriba sigue enseñando el grafo mientras se toca. */
  @media (max-width: 600px) {
    .panel {
      top: auto;
      left: 8px;
      right: 8px;
      bottom: 0;
      width: auto;
      /* La mitad DEL LIENZO, no de la ventana. Con `52vh` el cajon se comia el 75% del grafo
         (medido a 375 px: dejaba 142 px de 564), porque el lienzo no ocupa la ventana entera: por
         encima estan la cabecera y la barra de filtros, y por debajo la franja. */
      height: 50%;
      border-radius: 12px 12px 0 0;
      border-bottom: 0;
    }
  }

  /* Con movimiento reducido no hay nada que reducir aqui: el panel no anima. Se deja dicho para que
     nadie añada una transicion de apertura sin mirar `app.css`. */
</style>
