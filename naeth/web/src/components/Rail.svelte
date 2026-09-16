<!-- Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
     No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE -->
<script lang="ts">
  import Icon from './Icon.svelte'
  import { route, navigate, type View } from '../lib/router.svelte'
  import { closeDrawer } from '../lib/ui.svelte'
  import { theme, toggleTheme } from '../lib/theme.svelte'

  function go(view: Exclude<View, 'memory'>) {
    navigate(view)
    closeDrawer()
  }

  const top = [
    { view: 'home', icon: 'house', label: 'Inicio' },
    { view: 'graph', icon: 'share-2', label: 'Grafo del conocimiento' },
    { view: 'new', icon: 'square-pen', label: 'Nueva memoria' },
    { view: 'status', icon: 'activity', label: 'Estado del nodo' },
  ] as const
</script>

<nav class="railbar" aria-label="Navegación entre vistas">
  {#each top as r}
    <button class="rail-item" class:on={route.view === r.view} title={r.label} aria-label={r.label} onclick={() => go(r.view)}>
      <Icon name={r.icon} size={20} />
    </button>
  {/each}
  <span class="grow"></span>
  <button class="rail-item" title={theme.value === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} aria-label="Cambiar tema" onclick={toggleTheme}>
    <Icon name={theme.value === 'dark' ? 'sun' : 'moon'} size={20} />
  </button>
  <button class="rail-item" class:on={route.view === 'settings'} title="Ajustes" aria-label="Ajustes" onclick={() => go('settings')}>
    <Icon name="settings" size={20} />
  </button>
</nav>

<style>
  .railbar { background: var(--bg2); border-left: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 0; }
  .grow { flex: 1 1 auto; }
  .rail-item { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; color: var(--dim); position: relative; }
  .rail-item:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
  .rail-item.on { color: var(--accent); }
</style>
