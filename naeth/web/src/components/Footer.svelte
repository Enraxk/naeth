<script lang="ts">
  import Icon from './Icon.svelte'
  import { data } from '../lib/data.svelte'

  // Vistazo: lo permanente (vigentes + conexión). El desglose completo vive en la vista Estado.
  const c = $derived(data.status?.counts)
  const q = $derived(data.status?.queue)
  const pend = $derived(c?.pendientes_embed ?? 0)
  const queued = $derived((q?.pending ?? 0) + (q?.processing ?? 0))
</script>

<footer>
  <div class="sb mono">
    {#if c}
      <span><b>{c.memory_current}</b> vigentes</span>
      {#if pend > 0}<span class="sep">·</span><span><b class="warn">{pend}</b> sin embeber</span>{/if}
      {#if queued > 0}<span class="sep">·</span><span>cola <b class="warn">{queued}</b></span>{/if}
    {:else}
      <span>cargando…</span>
    {/if}
  </div>
  <span class="health" class:bad={!data.online}>
    <Icon name={data.online ? 'check' : 'triangle-alert'} size={12} />
    <span>{data.online ? 'conectado' : 'sin conexión'}</span>
  </span>
</footer>

<style>
  footer { flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 6px 16px; background: var(--panel); border-top: 1px solid var(--border); font: 11px var(--font-mono); color: var(--dim); }
  .sb { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
  .sb :global(b) { color: var(--ink); font-weight: 600; }
  .sb :global(.warn) { color: var(--warn); }
  .sep { color: var(--border); }
  .health { display: flex; align-items: center; gap: 6px; color: var(--ok); flex: 0 0 auto; }
  .health.bad { color: var(--warn); }
</style>
