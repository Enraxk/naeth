<script lang="ts">
  import Icon from './Icon.svelte'
  import { route, navigate } from '../lib/router.svelte'
  import { closeDrawer } from '../lib/ui.svelte'
  import { theme, toggleTheme } from '../lib/theme.svelte'

  function go(view: 'inicio' | 'grafo' | 'nueva' | 'estado' | 'ajustes') {
    navigate(view)
    closeDrawer()
  }

  const top = [
    { view: 'inicio', icon: 'house', label: 'Inicio' },
    { view: 'grafo', icon: 'share-2', label: 'Grafo del conocimiento' },
    { view: 'nueva', icon: 'square-pen', label: 'Nueva memoria' },
    { view: 'estado', icon: 'activity', label: 'Estado del nodo' },
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
  <button class="rail-item" class:on={route.view === 'ajustes'} title="Ajustes" aria-label="Ajustes" onclick={() => go('ajustes')}>
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
