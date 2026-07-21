<script lang="ts">
  import Icon from './Icon.svelte'
  import { route, navigate } from '../lib/router.svelte'
  import { data } from '../lib/data.svelte'
  import { projMeta, ORIGIN_ICON } from '../lib/colors'
  import { openSearch } from '../lib/search.svelte'

  type Crumb = { label: string; icon?: string; go?: () => void }

  const crumbs = $derived.by<Crumb[]>(() => {
    const home: Crumb = { label: 'Inicio', icon: 'house', go: () => navigate('inicio') }
    switch (route.view) {
      case 'inicio': return [{ label: 'Inicio', icon: 'house' }]
      case 'estado': return [home, { label: 'Estado del nodo', icon: 'activity' }]
      case 'grafo': return [home, { label: 'Grafo del conocimiento', icon: 'share-2' }]
      case 'nueva': return [home, { label: 'Nueva memoria', icon: 'square-pen' }]
      case 'ajustes': return [home, { label: 'Ajustes', icon: 'settings' }]
    }
    const row = (data.tree || []).find((r) => r.id === route.id)
    const parts = (row?.path || '').split('/').filter(Boolean)
    const out: Crumb[] = [home]
    if (parts[0]) out.push({ label: parts[0], icon: projMeta(parts[0]).icon, go: () => openSearch('/' + parts[0]) })
    if (parts[1]) out.push({ label: parts[1], icon: ORIGIN_ICON[parts[1]] || 'folder', go: () => openSearch(':' + parts[1]) })
    out.push({ label: row?.title || '(memoria)' })
    return out
  })
</script>

<nav class="crumbs" aria-label="Ruta">
  {#each crumbs as c, i (i)}
    {#if c.go && i < crumbs.length - 1}
      <button class="crumb" onclick={(e) => { e.stopPropagation(); c.go?.() }}>
        {#if c.icon}<Icon name={c.icon} size={13} />{/if}<span>{c.label}</span>
      </button>
    {:else}
      <span class="crumb" class:cur={i === crumbs.length - 1}>
        {#if c.icon}<Icon name={c.icon} size={13} />{/if}<span>{c.label}</span>
      </span>
    {/if}
    {#if i < crumbs.length - 1}<span class="sep"><Icon name="chevron-right" size={13} color="var(--border)" /></span>{/if}
  {/each}
</nav>

<style>
  .crumbs { flex: 0 0 auto; display: flex; align-items: center; gap: 5px; flex-wrap: wrap; min-height: 40px; padding: 8px 16px; border-bottom: 1px solid var(--border); background: var(--bg); font: 12px var(--font-mono); color: var(--dim); }
  .crumb { display: inline-flex; align-items: center; gap: 5px; color: var(--dim); padding: 2px 5px; border-radius: 5px; min-width: 0; max-width: 100%; }
  .crumb > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button.crumb:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 7%, transparent); }
  .crumb.cur { color: var(--ink); flex: 1 1 auto; }
  .sep { display: inline-flex; align-items: center; color: var(--border); }
</style>
