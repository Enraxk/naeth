<script lang="ts">
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import { data, revealInTree, collapseAuto, untrackAuto } from '../lib/data.svelte'
  import { collapsed, saveCollapsed, prefs, setSort, setSide } from '../lib/prefs.svelte'
  import { buildTree } from '../lib/tree'
  import { route, navigate } from '../lib/router.svelte'
  import { ui, closeDrawer } from '../lib/ui.svelte'
  import { typeMeta, typeColor, projMeta, projColor, ORIGIN_ICON } from '../lib/colors'
  import { fmtShort } from '../lib/format'

  function openMem(id: string) {
    navigate('memoria', id)
    closeDrawer()
  }

  const projects = $derived(buildTree(data.tree ?? [], prefs.sort))

  const SORT_LABEL = { az: 'A–Z', 'date-desc': 'Nuevas', 'date-asc': 'Antiguas' } as const
  const SORT_NEXT = { az: 'date-desc', 'date-desc': 'date-asc', 'date-asc': 'az' } as const

  function toggle(key: string) {
    untrackAuto(key)
    if (collapsed.has(key)) collapsed.delete(key)
    else collapsed.add(key)
    saveCollapsed()
  }

  // reveal-in-tree al abrir memoria; collapseAuto al volver a Inicio
  $effect(() => {
    if (route.view === 'inicio') { collapseAuto(); return }
    if (route.view === 'memoria' && route.id) {
      const row = (data.tree || []).find((r) => r.id === route.id)
      revealInTree(row?.path ?? null)
      const id = route.id
      tick().then(() => {
        const el = document.querySelector(`#tree [data-id="${id}"]`) as HTMLElement | null
        el?.scrollIntoView({ block: 'nearest' })
      })
    }
  })

  // resizer (pointer = ratón + táctil)
  let dragging = $state(false)
  function onDown(e: PointerEvent) {
    dragging = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  function onMove(e: PointerEvent) {
    if (!dragging) return
    prefs.side = Math.max(200, Math.min(560, e.clientX))
  }
  function onUp() {
    if (!dragging) return
    dragging = false
    setSide(prefs.side)
  }
</script>

<nav class="sidebar" class:open={ui.drawer} aria-label="Árbol de memorias">
  <div class="tools">
    <button class="sortbtn" title="Cambiar orden" onclick={() => setSort(SORT_NEXT[prefs.sort])}>
      <Icon name="arrow-up-down" size={13} /><span>{SORT_LABEL[prefs.sort]}</span>
    </button>
  </div>

  <div id="tree" class="tree" role="tree">
    {#each projects as p (p.proj)}
      {@const pKey = 'p:' + p.proj}
      {@const pc = projColor(p.proj)}
      <div class="group" class:collapsed={collapsed.has(pKey)}>
        <button class="row proj" onclick={() => toggle(pKey)}>
          <span class="chev"><Icon name="chevron-down" size={13} color="var(--dim)" /></span>
          <span class="ico"><Icon name={projMeta(p.proj).icon} size={13} color={pc} /></span>
          <span class="label">{p.proj}</span>
          <span class="rdate">{fmtShort(p.mod)}</span>
        </button>
        <div class="children indent">
          {#each p.origins as o (o.origin)}
            {@const oKey = 'o:' + p.proj + '/' + o.origin}
            <div class="group" class:collapsed={collapsed.has(oKey)}>
              <button class="row origin" onclick={() => toggle(oKey)}>
                <span class="chev"><Icon name="chevron-down" size={13} color="var(--dim)" /></span>
                <span class="ico"><Icon name={ORIGIN_ICON[o.origin] || 'folder'} size={13} color={pc} /></span>
                <span class="label">{o.origin}</span>
                <span class="rdate">{fmtShort(o.mod)}</span>
              </button>
              <div class="children indent">
                {#each o.leaves as m (m.id)}
                  <button
                    class="row leaf"
                    class:sel={route.view === 'memoria' && route.id === m.id}
                    data-id={m.id}
                    onclick={() => openMem(m.id)}
                  >
                    <span class="ico"><Icon name={typeMeta(m.memory_type).icon} size={13} color={typeColor(m.memory_type)} /></span>
                    <span class="label">{m.title || '(sin título)'}</span>
                    <span class="rdate">{fmtShort(m.created_at)}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div
    class="resizer"
    class:drag={dragging}
    role="separator"
    aria-orientation="vertical"
    title="Arrastra para redimensionar"
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
  ></div>
</nav>

<style>
  .sidebar { background: var(--bg2); border-right: 1px solid var(--border); position: relative; display: flex; flex-direction: column; min-height: 0; }
  .tools { display: flex; justify-content: flex-end; padding: 6px 8px 0; flex: 0 0 auto; }
  .sortbtn { display: flex; align-items: center; gap: 6px; font: 10px var(--font-mono); letter-spacing: .5px; color: var(--dim); text-transform: uppercase; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border); }
  .sortbtn:hover { color: var(--ink); border-color: var(--accent); }
  .tree { overflow: auto; padding: 6px; flex: 1 1 auto; }
  .row { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 6px; width: 100%; text-align: left; color: var(--ink); line-height: 1.3; }
  .row:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
  .chev { flex: 0 0 auto; color: var(--dim); transition: transform .12s; display: inline-flex; }
  .group.collapsed > .row .chev { transform: rotate(-90deg); }
  .group.collapsed > .children { display: none; }
  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rdate { display: none; margin-left: auto; flex: 0 0 auto; padding-left: 8px; font: 10px var(--font-mono); color: var(--dim); white-space: nowrap; }
  .row:hover .rdate { display: block; }
  .row.proj .label { font: 600 12px var(--font-mono); }
  .row.origin .label { font: 12px var(--font-mono); color: var(--dim); }
  .row.leaf .label { font: 13px var(--font-sans); flex: 1 1 auto; }
  .row.leaf.sel { background: var(--sel); box-shadow: inset 2px 0 0 var(--accent); }
  .children { display: flex; flex-direction: column; gap: 1px; }
  .indent { margin-left: 16px; border-left: 1px solid var(--border); padding-left: 6px; }
  .ico { flex: 0 0 auto; display: inline-flex; }
  .resizer { position: absolute; top: 0; right: -3px; width: 6px; height: 100%; z-index: 6; cursor: col-resize; }
  .resizer.drag { background: var(--accent); opacity: .45; }

  /* táctil: filas y botón de orden más cómodos */
  @media (pointer: coarse) {
    .row { padding: 9px 8px; }
    .sortbtn { padding: 7px 10px; }
    .rdate { display: block; } /* en táctil no hay hover: mostrar la fecha */
  }

  /* móvil: la sidebar es un cajón deslizante sobre el área de contenido */
  @media (max-width: 860px) {
    .sidebar { position: absolute; left: 0; top: 0; bottom: 0; width: min(82vw, 320px); z-index: 41; transform: translateX(-100%); transition: transform .22s ease; box-shadow: 8px 0 28px rgba(0, 0, 0, .4); }
    .sidebar.open { transform: translateX(0); }
    .resizer { display: none; }
  }
</style>
