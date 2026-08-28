<script lang="ts">
  /**
   * El campo del digest (fase 4), compartido por las dos vistas que escriben.
   *
   * Vive en un componente y no duplicado en las dos por lo mismo que `PathField`: el contador y su
   * umbral tienen que ser LOS MISMOS en el alta y en la edición, y dos copias divergen.
   *
   * ⚠ Cuenta con `[...s].length`, no con `s.length`. `String.length` cuenta unidades UTF-16, así
   * que un emoji fuera del BMP contaría 2 y el aviso mentiría respecto al `CHECK` de Postgres, que
   * cuenta caracteres. `len()` de Python hace lo mismo, así que los tres coinciden.
   */
  import { DIGEST_MAX } from '../lib/types'

  let {
    value = $bindable(''),
    onDirty,
  }: { value?: string; onDirty?: () => void } = $props()

  const n = $derived([...value.trim()].length)
  const pasa = $derived(n > DIGEST_MAX)
</script>

<div class="dg">
  <div class="dg-top">
    <label for="dg-ta">digest</label>
    <span class="dg-n" class:mal={pasa}>{n}/{DIGEST_MAX}</span>
  </div>
  <textarea
    id="dg-ta"
    class="dg-ta"
    class:mal={pasa}
    rows="2"
    bind:value
    oninput={() => onDirty?.()}
    placeholder="Dos o tres frases con lo que AFIRMA la nota, no de qué va. Es lo que ve la búsqueda."
  ></textarea>
  {#if pasa}
    <p class="dg-av">
      Se rechaza por encima de {DIGEST_MAX}. Reescríbelo más corto: recortarlo dejaría un resumen
      cortado a mitad de idea que sigue pareciendo entero.
    </p>
  {/if}
</div>

<style>
  .dg { margin-bottom: 12px; }
  .dg-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; }
  .dg-top label { font: 11px var(--font-mono); color: var(--dim); text-transform: lowercase; }
  .dg-n { font: 11px var(--font-mono); color: var(--dim); transition: color var(--t-fast); }
  .dg-n.mal { color: var(--warn); font-weight: 600; }
  .dg-ta {
    width: 100%; resize: vertical; min-height: 48px;
    font: 13px/1.5 var(--font-sans); color: var(--ink);
    background: var(--bg2); border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 12px; outline: none;
    transition: border-color var(--t-fast);
  }
  .dg-ta:focus { border-color: var(--accent); }
  .dg-ta.mal { border-color: var(--warn); }
  .dg-av { margin: 6px 0 0; font: 11px/1.45 var(--font-sans); color: var(--warn); }
</style>
