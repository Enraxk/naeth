<script lang="ts">
  import Icon from './Icon.svelte'
  import { navigate } from '../lib/router.svelte'
  import { toggleDrawer } from '../lib/ui.svelte'
  import { loadTree, loadStatus } from '../lib/data.svelte'
  import { qo, setQuery, openSearch, closeSearch, move, choose, PREFIX } from '../lib/search.svelte'
  import { typeMeta, typeColor, projMeta, projColor, ORIGIN_ICON } from '../lib/colors'

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
    <button class="wordmark" title="Ir al inicio" aria-label="Ir al inicio" onclick={() => navigate('inicio')}>NAETH</button>
  </div>

  <div class="search" role="search">
    <span class="ico"><Icon name="search" color="var(--dim)" /></span>
    <input
      bind:this={inputEl}
      value={qo.query}
      type="search"
      placeholder="buscar memoria…  ·  @tipo  #tag  /proyecto  :fuente"
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
            <button class="qitem" class:active={i === qo.active} onmousedown={(e) => e.preventDefault()} onclick={() => choose(i)}>
              {#if h.cmd}
                <span class="ico">
                  {#if h.kind === 'type'}<Icon name={typeMeta(h.value).icon} color={typeColor(h.value)} />
                  {:else if h.kind === 'project'}<Icon name={projMeta(h.value).icon} color={projColor(h.value)} />
                  {:else if h.kind === 'source'}<Icon name={ORIGIN_ICON[h.value] || 'folder'} color="var(--dim)" />
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
  .wordmark { font: 600 15px var(--font-mono); letter-spacing: 1.5px; color: var(--ink); padding: 2px 0; }
  .wordmark:hover { color: var(--accent); }
  .search { flex: 0 0 440px; max-width: 46vw; display: flex; align-items: center; gap: 8px; position: relative; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; }
  .search:focus-within { border-color: var(--accent); }
  .search input { flex: 1 1 auto; min-width: 0; background: none; border: 0; color: var(--ink); font: 13px var(--font-mono); outline: none; }
  .search input::placeholder { color: var(--dim); }
  .ico { display: inline-flex; flex: 0 0 auto; }
  .kbd { font: 10px var(--font-mono); color: var(--dim); border: 1px solid var(--border); border-radius: 3px; padding: 1px 6px; }
  .iconbtn { display: flex; align-items: center; justify-content: center; padding: 6px; border: 1px solid var(--border); border-radius: 6px; color: var(--dim); }
  .iconbtn:hover { color: var(--ink); border-color: var(--accent); }
  .searchpop { position: fixed; top: 56px; left: 50%; transform: translateX(-50%); width: min(560px, calc(100vw - 24px)); max-height: min(62vh, calc(100vh - 96px)); overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; z-index: 50; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 6px; box-shadow: 0 12px 32px rgba(0, 0, 0, .45); }
  .pop-hint { font: 11px var(--font-mono); color: var(--dim); padding: 8px 10px; }
  .qitem { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 8px 10px; border-radius: 6px; color: var(--ink); }
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
    .wordmark { display: none; }
    .kbd { display: none; }
  }
</style>
