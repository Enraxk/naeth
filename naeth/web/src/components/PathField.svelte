<script lang="ts" module>
  let nextId = 0
</script>

<script lang="ts">
  import { rankPaths } from '../lib/pathpick'
  import { data } from '../lib/data.svelte'

  /**
   * Campo de ruta `proyecto/subtema` con sugerencias.
   *
   * SIGUE SIENDO UN INPUT LIBRE. Las sugerencias ordenan, no imponen: escribir una ruta que
   * todavia no existe es el caso normal (81 rutas vivas el 28/08/2026, y treinta de ellas con una
   * sola memoria). Por eso no hay `<select>` ni validacion: se puede teclear cualquier cosa y
   * guardar, exactamente igual que antes de que existiera este componente.
   *
   * Vive en las DOS vistas que editan metadatos, `Memoria.svelte` y `Nueva.svelte`. Se saco a
   * componente por eso: es lo unico del bloque `e-row` que gana logica, y duplicarlo obligaria a
   * arreglar cada fallo futuro dos veces. El resto del `e-row` sigue duplicado, que es deuda
   * anterior y no la toca este cambio.
   *
   * ⚠ El CSS repite los valores de `.e-row label` y `.e-row input` de las dos vistas en vez de
   * heredarlos: Svelte aisla los estilos por componente, asi que las reglas del padre no alcanzan
   * a estos elementos. Si alli cambian, aqui tambien.
   *
   * A diferencia del popover de wikilinks, que se posiciona con `position: fixed` sobre las
   * coordenadas del cursor dentro del editor, este va anclado al campo en flujo normal: no hay
   * nada que medir.
   */

  let {
    value = $bindable(''),
    onDirty,
  }: { value?: string; onDirty?: () => void } = $props()

  /**
   * Ids unicos por instancia. Hoy las dos vistas que usan esto no coexisten (son ramas distintas
   * del router), pero `for`, `aria-controls` y `aria-activedescendant` apuntan por id: con ids
   * fijos, dos instancias a la vez se robarian el foco sin dar la cara.
   */
  const uid = `pf-${nextId++}`

  let open = $state(false)
  let active = $state(0)

  const hits = $derived(rankPaths(value, data.tree ?? []))

  /**
   * Con la ruta ya escrita entera no se ensena nada: un popover de una sola entrada que repite lo
   * que acabas de teclear es ruido, y encima tapa el campo de abajo.
   */
  const exacta = $derived(hits.length === 1 && hits[0].path === value.trim())
  const show = $derived(open && hits.length > 0 && !exacta)

  function choose(i: number) {
    const h = hits[i]
    if (!h) return
    value = h.path
    open = false
    onDirty?.()
  }

  function onInput() {
    open = true
    active = 0
    onDirty?.()
  }

  function onKeydown(e: KeyboardEvent) {
    if (!show) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      active = (active + 1) % hits.length
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      active = (active - 1 + hits.length) % hits.length
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      open = false
    }
    // Tab NO se intercepta a proposito: en un formulario tiene que seguir llevando al campo
    // siguiente. El `onblur` cierra la lista al salir.
  }
</script>

<div class="pf">
  <label for="{uid}-input">ruta</label>
  <input
    id="{uid}-input"
    role="combobox"
    aria-expanded={show}
    aria-controls="{uid}-list"
    aria-activedescendant={show ? `${uid}-opt-${active}` : undefined}
    aria-autocomplete="list"
    autocomplete="off"
    bind:value
    oninput={onInput}
    onfocus={() => (open = true)}
    onblur={() => (open = false)}
    onkeydown={onKeydown}
    placeholder="proyecto/subtema"
  />
  {#if show}
    <ul class="pf-pop" id="{uid}-list" role="listbox" aria-label="Rutas existentes">
      {#each hits as h, i (h.path)}
        <!--
          svelte-ignore a11y_click_events_have_key_events
          El teclado NO va aqui, y es lo correcto en un combobox: lo lleva el input, que mueve
          `active` con las flechas y anuncia cual esta elegida por `aria-activedescendant`. Una
          `option` con su propio manejador seria un segundo punto de foco que el patron no tiene.
          El aviso de Svelte es generico y no distingue este caso.
          (Lo contrario, declarar un rol y no cumplirlo, es lo que costo retirar el `role="tree"`
          del arbol el 22/08.)
        -->
        <li
          id="{uid}-opt-{i}"
          role="option"
          aria-selected={i === active}
          class="pf-item"
          class:on={i === active}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => choose(i)}
        >
          <span class="pf-path">{h.path}</span>
          <span class="pf-count">{h.count}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  /* Mismos valores que `.e-row label` / `.e-row input` de Memoria.svelte y Nueva.svelte. */
  .pf {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 auto;
    min-width: 160px;
    font: 10px var(--font-mono);
    letter-spacing: .5px;
    text-transform: uppercase;
    color: var(--dim);
  }
  .pf input {
    font: 13px var(--font-mono);
    color: var(--ink);
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 10px;
    outline: none;
    text-transform: none;
    letter-spacing: normal;
  }
  .pf input:focus { border-color: var(--accent); }

  /* Mismo aspecto que `.wikipop`, pero anclado al campo en vez de al cursor. */
  .pf-pop {
    position: absolute;
    z-index: 60;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, .35);
    padding: 4px;
    max-height: 260px;
    overflow-y: auto;
  }
  .pf-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 6px 8px;
    border-radius: 6px;
    color: var(--ink);
    cursor: pointer;
  }
  .pf-item:hover, .pf-item.on { background: var(--sel); }
  .pf-path {
    font: 13px var(--font-mono);
    text-transform: none;
    letter-spacing: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1 1 auto;
  }
  .pf-count { font: 10px var(--font-mono); color: var(--dim); flex: 0 0 auto; }
</style>
