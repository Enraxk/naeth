<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import { data } from '../lib/data.svelte'
  import { navigate } from '../lib/router.svelte'
  import { typeMeta, typeColor } from '../lib/colors'
  import { fmtShort } from '../lib/format'

  function greeting() {
    const h = new Date().getHours()
    return h < 6 ? 'Buenas noches' : h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
  }
  const recent = $derived(
    [...(data.tree || [])]
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 8),
  )
  const lede = $derived.by(() => {
    const c = data.status?.counts
    const projs = new Set((data.tree || []).map((m) => (m.path || '(sin path)').split('/')[0])).size
    return {
      vig: c?.memory_current ?? (data.tree ? data.tree.length : '–'),
      projs: projs || '–',
      ver: c?.memory_total ?? '–',
    }
  })
</script>

<div class="inicio">
  <div class="hero">
    <h1 class="hello">{greeting()}, Eneko</h1>
    <p class="lede"><b>{lede.vig}</b> memorias vigentes · <b>{lede.projs}</b> proyectos · <b>{lede.ver}</b> versiones</p>
  </div>

  <section>
    <div class="sec-title">Actividad reciente</div>
    <div class="recent-list">
      {#if recent.length}
        {#each recent as m (m.id)}
          <button class="recent-item" onclick={() => navigate('memoria', m.id)}>
            <span class="ico"><Icon name={typeMeta(m.memory_type).icon} size={15} color={typeColor(m.memory_type)} /></span>
            <span class="ri-main">
              <span class="ri-title">{m.title || '(sin título)'}</span>
              <span class="ri-path">{m.path || '(sin path)'}</span>
            </span>
            <span class="ri-date">{fmtShort(m.created_at)}</span>
          </button>
        {/each}
      {:else}
        <div class="empty">Aún no hay memorias.</div>
      {/if}
    </div>
  </section>
</div>

<style>
  .inicio { padding: 48px 56px; max-width: 880px; margin: 0 auto; }
  .hero { margin-bottom: 38px; }
  .hello { font: 600 30px var(--font-sans); margin: 0 0 8px; color: var(--ink); }
  .lede { font: 13px var(--font-mono); color: var(--dim); margin: 0; }
  .lede :global(b) { color: var(--ink); font-weight: 600; }
  .sec-title { font: 11px var(--font-mono); letter-spacing: 1px; color: var(--dim); text-transform: uppercase; margin-bottom: 6px; }
  .recent-list { display: flex; flex-direction: column; }
  .recent-item { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 11px 12px; border-radius: 8px; color: var(--ink); }
  .recent-item:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
  .ico { flex: 0 0 auto; display: inline-flex; }
  .ri-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ri-title { font: 14px var(--font-sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ri-path { font: 11px var(--font-mono); color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ri-date { flex: 0 0 auto; font: 11px var(--font-mono); color: var(--dim); }
  .empty { color: var(--dim); font: 13px var(--font-sans); padding: 12px 0; }
  @media (max-width: 600px) {
    .inicio { padding: 26px 18px; }
    .hello { font-size: 24px; }
  }
</style>
