<script lang="ts">
  import Icon from '../components/Icon.svelte'
  let { view }: { view: string } = $props()

  const STUB: Record<string, { icon: string; title: string; text: string }> = {
    grafo: { icon: 'share-2', title: 'Grafo del conocimiento', text: 'Relaciones explícitas y vecinos semánticos entre memorias. Llegará en el Paso 5.4.' },
    nueva: { icon: 'square-pen', title: 'Nueva memoria', text: 'Crear y editar memorias con editor Markdown, sobre el CRUD ADD-only ya disponible. Llegará en el Paso 5.3.' },
    ajustes: { icon: 'settings', title: 'Ajustes', text: 'Tema, modelo de embeddings y conexión. El tema, de momento, se cambia en el rail.' },
  }
  const s = $derived(STUB[view] ?? STUB.grafo)
</script>

<div class="stub">
  <span class="si"><Icon name={s.icon} size={40} color="var(--dim)" /></span>
  <h2>{s.title}</h2>
  <p>{s.text}</p>
  <span class="soon">Próximamente</span>
</div>

<style>
  .stub { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; gap: 14px; color: var(--dim); text-align: center; padding: 48px; }
  .si { opacity: .45; display: inline-flex; }
  h2 { font: 600 18px var(--font-sans); color: var(--ink); margin: 0; }
  p { margin: 0; font: 13px/1.6 var(--font-sans); max-width: 380px; }
  .soon { font: 10px var(--font-mono); letter-spacing: 1px; text-transform: uppercase; border: 1px solid var(--border); border-radius: 99px; padding: 3px 10px; }
</style>
