<script lang="ts">
  import Icon from './Icon.svelte'
  import Brand from './Brand.svelte'
  import { navigate } from '../lib/router.svelte'
  import { toggleDrawer } from '../lib/ui.svelte'
  import { loadTree, loadStatus } from '../lib/data.svelte'
  import { qo, setQuery, openSearch, closeSearch, move, choose, PREFIX } from '../lib/search.svelte'
  import { typeMeta, typeColor, projMeta, projColor } from '../lib/colors'

  let inputEl: HTMLInputElement | undefined = $state()

  // foco al abrir la búsqueda desde fuera (p. ej. un breadcrumb)
  $effect(() => {
    if (qo.focusReq > 0) inputEl?.focus()
  })

  // el popover va fixed centrado en viewport; calculamos su top desde el input
  let popTop = $state(56)
  $effect(() => {
    function place() { if (inputEl) popTop = inputEl.getBoundingClientRect().bottom + 6 }
    if (qo.open) place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  })

  function onKey(e: KeyboardEvent) {
    if (!qo.open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter') { e.preventDefault(); if (qo.active >= 0) choose(qo.active) }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); inputEl?.blur() }
  }
  async function refresh() { await loadTree(); loadStatus() }

  $effect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && k === 'p') { e.preventDefault(); inputEl?.focus(); openSearch(); return }
      const tag = (document.activeElement as HTMLElement | null)?.tagName || ''
      if (k === '/' && document.activeElement !== inputEl && !/^(INPUT|TEXTAREA)$/.test(tag)) {
        e.preventDefault(); inputEl?.focus()
      }
    }
    function onDocClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.search')) closeSearch()
    }
    document.addEventListener('keydown', onGlobalKey)
    document.addEventListener('click', onDocClick)
    return () => {
      document.removeEventListener('keydown', onGlobalKey)
      document.removeEventListener('click', onDocClick)
    }
  })
</script>

<header>
  <div class="h-left">
    <button class="hamb" title="Menú" aria-label="Abrir menú" onclick={toggleDrawer}><Icon name="menu" size={18} /></button>
    <!--
      El lockup sustituye al texto `NAETH` desde el 28/08/2026. Se pintan las dos variantes y manda
      el CSS: por debajo de 460 px, donde antes no quedaba marca ninguna, se queda el simbolo solo.
      Son dos paths, asi que tenerlas las dos en el DOM no cuesta nada y evita meter `matchMedia`
      para una decision que es puramente de ancho.
      El boton conserva su `aria-label`, y los SVG entran decorativos: para un lector de pantalla
      esto no ha cambiado.
    -->
    <button class="wordmark" title="Ir al inicio" aria-label="Ir al inicio" onclick={() => navigate('inicio')}>
      <span class="bd"><Brand variant="lockup" height={24} /></span>
      <span class="bm"><Brand variant="symbol" height={20} /></span>
    </button>
  </div>

  <div class="search" role="search">
    <span class="ico"><Icon name="search" color="var(--dim)" /></span>
    <input
      bind:this={inputEl}
      value={qo.query}
      type="search"
      placeholder="buscar memoria…  ·  @tipo  #tag  /proyecto  :subtema"
      aria-label="Buscar memoria"
      autocomplete="off"
      oninput={(e) => setQuery(e.currentTarget.value)}
      onfocus={() => openSearch()}
      onkeydown={onKey}
    />
    <span class="kbd" aria-hidden="true">/</span>

    {#if qo.open}
      <div class="searchpop" style="top: {popTop}px">
        {#if qo.label}<div class="pop-hint">{qo.label}</div>{/if}
        {#if qo.hits.length}
          {#each qo.hits as h, i (i)}
            <button class="qitem" class:active={i === qo.active} style="--i:{i}" onmousedown={(e) => e.preventDefault()} onclick={() => choose(i)}>
              {#if h.cmd}
                <span class="ico">
                  {#if h.kind === 'type'}<Icon name={typeMeta(h.value).icon} color={typeColor(h.value)} />
                  {:else if h.kind === 'project'}<Icon name={projMeta(h.value).icon} color={projColor(h.value)} />
                  {:else if h.kind === 'subtopic'}<Icon name="folder" color="var(--dim)" />
                  {:else}<Icon name="hash" color="var(--dim)" />{/if}
                </span>
                <span class="qt">{PREFIX[h.kind]}{h.value}</span>
                <span class="qp">{h.n}</span>
              {:else}
                <span class="ico"><Icon name={typeMeta(h.row.memory_type).icon} color={typeColor(h.row.memory_type)} /></span>
                <span class="qt">{h.row.title || '(sin título)'}</span>
                <span class="qp">{h.row.path || ''}</span>
              {/if}
            </button>
          {/each}
        {:else}
          <div class="pop-hint">Sin resultados.</div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="h-right">
    <button class="iconbtn" title="Refrescar" aria-label="Refrescar" onclick={refresh}><Icon name="refresh" /></button>
  </div>
</header>

<style>
  header { display: flex; align-items: center; gap: 16px; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--border); flex: 0 0 auto; }
  .h-left, .h-right { flex: 1 1 0; display: flex; align-items: center; min-width: 0; }
  .h-right { justify-content: flex-end; gap: 8px; }
  .h-left { gap: 14px; }
  /* El color ya no es del texto sino del dibujo: los SVG llevan `fill="currentColor"`, asi que
     heredan esto y el hover sin una linea mas. */
  .wordmark { display: flex; align-items: center; color: var(--ink); padding: 2px 0; }
  .wordmark:hover { color: var(--accent); }
  .bd { display: block; }
  .bm { display: none; }
  .search { flex: 0 0 440px; max-width: 46vw; display: flex; align-items: center; gap: 8px; position: relative; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; }
  .search:focus-within { border-color: var(--accent); }
  .search input { flex: 1 1 auto; min-width: 0; background: none; border: 0; color: var(--ink); font: 13px var(--font-mono); outline: none; }
  .search input::placeholder { color: var(--dim); }
  .ico { display: inline-flex; flex: 0 0 auto; }
  .kbd { font: 10px var(--font-mono); color: var(--dim); border: 1px solid var(--border); border-radius: 3px; padding: 1px 6px; }
  .iconbtn { display: flex; align-items: center; justify-content: center; padding: 6px; border: 1px solid var(--border); border-radius: 6px; color: var(--dim); }
  .iconbtn:hover { color: var(--ink); border-color: var(--accent); }
  .searchpop { position: fixed; top: 56px; left: 50%; transform: translateX(-50%); width: min(560px, calc(100vw - 24px)); max-height: min(62vh, calc(100vh - 96px)); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; z-index: 50; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 6px; box-shadow: 0 12px 32px rgba(0, 0, 0, .45); opacity: 1; transition: opacity var(--t-mid), transform var(--t-over); }

  /* Capa flotante anclada: al abrir sube 10px y escala de .985 a 1, con rebasamiento. Se lo puede
     permitir porque es lo unico que no estaba y ahora tapa lo que estabas leyendo: interrumpe de
     todas formas, asi que mas vale que se anuncie bien.
     La subida se COMPONE con el translateX(-50%) que ya centra el popover, no lo sustituye.

     ⚠ DESVIACION CONSCIENTE del handoff, que pide cerrar con `--t-mid`: aqui NO hay salida
     animada. El popover se monta con `{#if qo.open}`, asi que al cerrarse el nodo desaparece del
     DOM y ninguna transicion de CSS puede correr sobre el. Animar la salida obligaria a tenerlo
     montado siempre, y eso es mas estructura de la que vale el gesto. Cumple lo que el handoff
     pedia de fondo (al cerrar NO rebasa) por otra via. */
  @starting-style {
    .searchpop { opacity: 0; transform: translateX(-50%) translateY(10px) scale(.985); }
  }
  .pop-hint { font: 11px var(--font-mono); color: var(--dim); padding: 8px 10px; }
  /* Las filas entran escalonadas 45ms. El tope de seis no es estetico: a partir de ahi la ultima
     llega tarde y el escalonado deja de ser una entrada para ser una espera. */
  .qitem { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 8px 10px; border-radius: 6px; color: var(--ink); opacity: 1; transform: none; transition: opacity var(--t-mid), transform var(--t-over); transition-delay: calc(min(var(--i, 0), 5) * 45ms); }
  @starting-style {
    .qitem { opacity: 0; transform: translateY(6px); }
  }
  .qitem:hover, .qitem.active { background: var(--sel); }
  .qt { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 13px var(--font-sans); }
  .qp { flex: 0 0 auto; font: 11px var(--font-mono); color: var(--dim); max-width: 46%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .hamb { display: none; align-items: center; justify-content: center; padding: 6px; border: 1px solid var(--border); border-radius: 6px; color: var(--dim); }
  .hamb:hover { color: var(--ink); border-color: var(--accent); }

  /* táctil: controles del header más grandes */
  @media (pointer: coarse) {
    .iconbtn, .hamb { padding: 9px; }
    .search { padding: 9px 10px; }
  }

  /* móvil: aparece la hamburguesa, se oculta la pill y el buscador se expande */
  @media (max-width: 860px) {
    header { gap: 10px; padding: 9px 12px; }
    .hamb { display: flex; }
    .h-left { flex: 0 0 auto; gap: 8px; }
    .search { flex: 1 1 auto; max-width: none; }
  }
  @media (max-width: 460px) {
    /* Aqui el lockup no cabe junto al buscador, pero antes se ocultaba la marca ENTERA y el visor
       se quedaba sin ninguna justo en el movil, que es desde donde mas se entra por el tunel.
       Se queda el simbolo, que aguanta de sobra a este tamano (su suelo son 16 px). */
    .bd { display: none; }
    .bm { display: block; }
    .kbd { display: none; }
  }
</style>
