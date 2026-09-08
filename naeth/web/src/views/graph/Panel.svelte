<script lang="ts">
  import Icon from '../../components/Icon.svelte'
  import {
    CATALOGO, grafoPrefs, mandosDe, poner, restaurar,
    type Clave, type Grupo,
  } from '../../lib/prefs-grafo.svelte'

  // El panel de ajustes del grafo.
  //
  // POR QUE VIVE AQUI Y NO EN AJUSTES. Un deslizador cuyo efecto no se ve mientras se mueve es
  // tocar a ciegas: habria que ir a Ajustes, cambiar, volver al grafo, mirar y repetir. Decidido
  // con Eneko el 06/09. Ajustes tendra su enlace, pero los mandos viven encima del grafo.
  //
  // Y ES LO QUE JUBILA MEDIA DISCUSION: hasta ahora, elegir el tinte de una arista o el tamaño de
  // un nodo pedia escribir un banco de pruebas. Con esto, el visor ES el banco.

  let { abierto = $bindable(false) }: { abierto?: boolean } = $props()

  const SECCIONES: { g: Grupo; titulo: string; icono: string }[] = [
    { g: 'texto', titulo: 'Texto', icono: 'file-text' },
    { g: 'nodos', titulo: 'Nodos', icono: 'circle' },
    { g: 'aristas', titulo: 'Aristas', icono: 'share-2' },
    { g: 'fisica', titulo: 'Física', icono: 'zap' },
  ]

  /** Cuantos decimales enseñar, deducidos del paso: un paso de 1 no quiere ver "34,00". */
  function fmt(v: number, paso: number) {
    const d = paso >= 1 ? 0 : paso >= 0.1 ? 1 : 2
    return v.toFixed(d).replace('.', ',')
  }

  function alTeclado(e: KeyboardEvent) {
    if (e.key === 'Escape' && abierto) {
      abierto = false
      e.stopPropagation()
    }
  }
</script>

<svelte:window onkeydown={alTeclado} />

{#if abierto}
  <!-- `aria-label` y no un titulo visible: el titulo lo lleva la cabecera de dentro. -->
  <aside class="panel" aria-label="Ajustes del grafo">
    <header class="cab">
      <span class="tit">Ajustes del grafo</span>
      <button class="x" onclick={() => (abierto = false)} title="Cerrar (Escape)" aria-label="Cerrar ajustes">
        <Icon name="x" size={14} color="currentColor" />
      </button>
    </header>

    <div class="cuerpo">
      {#each SECCIONES as s (s.g)}
        <section>
          <div class="sec-cab">
            <Icon name={s.icono} size={12} color="var(--dim)" />
            <span>{s.titulo}</span>
            <button class="mini" onclick={() => restaurar(s.g)} title="Devolver esta sección a sus valores de fábrica">
              restaurar
            </button>
          </div>

          {#each mandosDe(s.g) as { clave, mando } (clave)}
            {@const id = 'aj-' + clave}
            {#if mando.tipo === 'bool'}
              <div class="mando bool">
                <input type="checkbox" {id}
                       checked={grafoPrefs[clave] as boolean}
                       onchange={(e) => poner(clave as Clave, e.currentTarget.checked as never)} />
                <label for={id}>{mando.etiqueta}</label>
              </div>
            {:else}
              <div class="mando">
                <label for={id}>
                  {mando.etiqueta}
                  <!-- El numero SIEMPRE a la vista: un deslizador sin valor no se puede comunicar
                       ("subelo un poco" no es un ajuste) ni comparar con lo que se midio. -->
                  <output for={id}>{fmt(grafoPrefs[clave] as number, mando.paso)}</output>
                </label>
                <input type="range" {id}
                       min={mando.min} max={mando.max} step={mando.paso}
                       value={grafoPrefs[clave] as number}
                       oninput={(e) => poner(clave as Clave, e.currentTarget.valueAsNumber as never)} />
              </div>
            {/if}
            {#if mando.nota}<p class="nota">{mando.nota}</p>{/if}
          {/each}
        </section>
      {/each}
    </div>

    <footer>
      <button class="todo" onclick={() => restaurar()}>
        <Icon name="refresh" size={12} color="currentColor" />
        Restaurar todo
      </button>
      <span class="pista">Se guarda solo, en este navegador.</span>
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

  .nota {
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
  .pista { font-size: 10.5px; color: var(--dim); }

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
