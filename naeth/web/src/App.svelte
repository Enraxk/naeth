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
  import Nueva from './views/Nueva.svelte'
  import Ajustes from './views/Ajustes.svelte'
  import Grafo from './views/Grafo.svelte'
  import Stub from './views/Stub.svelte'
  import { route } from './lib/router.svelte'
  import { prefs } from './lib/prefs.svelte'
  import { startPolling } from './lib/data.svelte'
  import { ui, closeDrawer, resalte } from './lib/ui.svelte'

  onMount(() => startPolling())
</script>

<div class="app" class:senalando={resalte.id !== null}>
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
        {:else if route.view === 'nueva'}
          <Nueva />
        {:else if route.view === 'ajustes'}
          <Ajustes />
        {:else if route.view === 'grafo'}
          <Grafo />
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

  /* MIENTRAS SE SENALA UNA MEMORIA, EL RESTO DE NAETH BAJA LA VOZ.
     Se apaga el cromo (cabecera, ruta, rail y pie), no el contenido: en el grafo lo que hay
     debajo ya se atenua por dentro, y en las demas vistas el contenido es lo que estas leyendo.
     Lo que se gana es que senalar algo se sienta como senalarlo en la aplicacion entera y no
     solo en un panel, que era el encargo: que Naeth se sienta una sola cosa viva.
     El fundido se conserva con `prefers-reduced-motion`, igual que en el resto: esa preferencia
     retira desplazamiento, no cambios de intensidad. */
  .app > :global(header),
  .app > :global(footer),
  .app :global(.railbar),
  .app :global(.crumbs) { transition: opacity var(--t-fast); }
  .app.senalando > :global(header),
  .app.senalando > :global(footer),
  .app.senalando :global(.railbar),
  .app.senalando :global(.crumbs) { opacity: .42; }
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
