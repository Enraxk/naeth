<script lang="ts">
  import { onMount } from 'svelte'
  import Header from './components/Header.svelte'
  import Sidebar from './components/Sidebar.svelte'
  import Rail from './components/Rail.svelte'
  import Crumbs from './components/Crumbs.svelte'
  import Footer from './components/Footer.svelte'
  import Inicio from './views/Inicio.svelte'
  import Estado from './views/Estado.svelte'
  import Memoria from './views/Memoria.svelte'
  import Stub from './views/Stub.svelte'
  import { route } from './lib/router.svelte'
  import { prefs } from './lib/prefs.svelte'
  import { startPolling } from './lib/data.svelte'
  import { ui, closeDrawer } from './lib/ui.svelte'

  onMount(() => startPolling())
</script>

<div class="app">
  <Header />
  <div class="body" style="--side-w: {prefs.side}px">
    <Sidebar />
    <section class="center">
      <Crumbs />
      <main class="detail">
        {#if route.view === 'memoria' && route.id}
          <Memoria id={route.id} />
        {:else if route.view === 'inicio'}
          <Inicio />
        {:else if route.view === 'estado'}
          <Estado />
        {:else}
          <Stub view={route.view} />
        {/if}
      </main>
    </section>
    <Rail />
    {#if ui.drawer}
      <button class="backdrop" aria-label="Cerrar menú" onclick={closeDrawer}></button>
    {/if}
  </div>
  <Footer />
</div>

<style>
  .app { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
  .body { flex: 1 1 auto; display: grid; grid-template-columns: var(--side-w) 1fr 48px; min-height: 0; position: relative; }
  .center { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .detail { background: var(--bg); overflow: auto; min-width: 0; flex: 1 1 auto; }
  .backdrop { display: none; }

  /* ===== Responsive: la sidebar pasa a cajón (drawer) ===== */
  @media (max-width: 860px) {
    .body { grid-template-columns: 1fr 48px; }
    .backdrop { display: block; position: absolute; inset: 0; z-index: 40; border: 0; background: rgba(0, 0, 0, .45); }
  }
</style>
