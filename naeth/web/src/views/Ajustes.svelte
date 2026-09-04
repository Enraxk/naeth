<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '../components/Icon.svelte'
  import { data } from '../lib/data.svelte'
  import { getAuthors, getHealth } from '../lib/api'
  import { fmtLag } from '../lib/format'
  import { prefs } from '../lib/prefs.svelte'
  import { theme } from '../lib/theme.svelte'
  import type { AuthorCount, Health } from '../lib/types'

  // Esta vista es de SOLO LECTURA a proposito. Escribir desde el visor no pasa por los enforce de
  // autoria ni de digest, que cuelgan solo de las tools MCP, asi que un panel de ajustes con
  // escritura seria justo la puerta que esos dos interruptores existen para cerrar.

  // `data` no tiene ni flag de carga ni de error (solo `null` y `online`), asi que los dos
  // endpoints que estrena esta vista se gestionan en local, con el mismo patron que Memoria.
  let authors = $state<AuthorCount[] | null>(null)
  let health = $state<Health | null>(null)
  let error = $state('')

  // `allSettled` y no `all`: con `all`, un endpoint caido se lleva por delante al otro y la pagina
  // queda mas vacia de lo que hace falta. Medido el 04/09/2026 estrenando la vista, cuando
  // `/healthz` fallaba en dev por el proxy y se llevo tambien el desglose de autoria, que estaba
  // respondiendo perfectamente.
  onMount(async () => {
    const [a, h] = await Promise.allSettled([getAuthors(), getHealth()])
    if (a.status === 'fulfilled') authors = a.value
    if (h.status === 'fulfilled') health = h.value
    const caidos = [
      a.status === 'rejected' && 'el desglose de autoria',
      h.status === 'rejected' && 'la salud del nodo',
    ].filter(Boolean)
    if (caidos.length) error = `No se ha podido leer ${caidos.join(' ni ')}. Lo demas es correcto.`
  })

  const c = $derived(data.status?.counts)
  const q = $derived(data.status?.queue)

  const totalAutoria = $derived((authors ?? []).reduce((a, r) => a + r.n, 0))
  const maxAutoria = $derived(Math.max(1, ...(authors ?? []).map((r) => r.n)))

  /** `claude-code · code · opus-5`, degradando por escalones como hace `fmtAuthor`. */
  const quien = (r: AuthorCount) =>
    [r.product, r.surface, r.model?.replace(/^claude-/, '')].filter(Boolean).join(' · ') ||
    '(sin autoria)'

  // El tema tiene TRES estados y solo dos se ven en el rail: sin la clave en localStorage sigue al
  // sistema, y en cuanto tocas el interruptor queda forzado para siempre. No hay forma de volver a
  // "sigue al sistema" desde la interfaz, asi que aqui al menos se dice cual de los tres es.
  let temaForzado = $state(false)
  onMount(() => {
    try {
      temaForzado = localStorage.getItem('naeth-theme') !== null
    } catch {
      temaForzado = false
    }
  })

  const SORT_LABEL: Record<string, string> = { az: 'alfabetico', recent: 'por fecha' }

  // En desarrollo el proxy de Vite manda `/api` a 127.0.0.1:8800, que es PRODUCCION. Lo que se ve
  // en pantalla son memorias reales aunque la barra diga localhost:5180, y eso no se avisa en
  // ningun otro sitio del visor.
  const enDesarrollo = import.meta.env.DEV
</script>

<div class="ajustes">
  <div class="aj-conn">
    <span class="aj-dot" class:bad={!data.online}></span>
    <span class="aj-state">{data.online ? 'Conectado' : 'Sin conexion'}</span>
    <span class="aj-sub">Solo lectura. Nada de esta pagina se puede cambiar desde aqui.</span>
  </div>

  {#if enDesarrollo}
    <div class="aviso">
      <Icon name="triangle-alert" size={14} color="var(--warn)" />
      <span>Servidor de desarrollo. El proxy manda <code>/api</code> al nodo real, asi que estas
        memorias son las de produccion.</span>
    </div>
  {/if}

  {#if error}
    <div class="aviso err"><Icon name="triangle-alert" size={14} color="var(--warn)" /><span>{error}</span></div>
  {/if}

  <section class="aj-sec">
    <div class="aj-head"><Icon name="server" size={13} color="var(--dim)" /><span>Nodo y conexion</span></div>
    <dl class="aj-list">
      <div><dt>Modelo de embeddings</dt><dd>{data.status?.embed_model ?? '-'}</dd></div>
      <div><dt>Dimension del vector</dt><dd>{data.status?.embed_dim ?? '-'}</dd></div>
      <div><dt>Endpoint MCP</dt><dd>{health?.mcp ?? '-'}</dd></div>
      <div>
        <dt>OAuth en este proceso</dt>
        <dd>
          {health?.oauth ?? '-'}
          {#if health?.oauth_provider}<span class="dd-sub">{health.oauth_provider}</span>{/if}
        </dd>
      </div>
      {#if health?.oauth_base_url}
        <div><dt>URL publica</dt><dd>{health.oauth_base_url}</dd></div>
      {/if}
    </dl>
  </section>

  <section class="aj-sec">
    <div class="aj-head"><Icon name="database" size={13} color="var(--dim)" /><span>Corpus</span></div>
    <div class="aj-grid">
      <div class="aj-tile"><span class="v">{c?.memory_current ?? '-'}</span><span class="k">Vigentes</span></div>
      <div class="aj-tile"><span class="v">{c?.memory_total ?? '-'}</span><span class="k">Versiones</span></div>
      <div class="aj-tile"><span class="v">{c?.superseded ?? '-'}</span><span class="k">Superadas</span></div>
      <div class="aj-tile"><span class="v">{c?.relations ?? '-'}</span><span class="k">Relaciones</span></div>
      <div class="aj-tile"><span class="v">{c?.tombstones ?? '-'}</span><span class="k">Retiradas</span></div>
      <div class="aj-tile"><span class="v">{c?.tombstones_relation ?? '-'}</span><span class="k">Aristas retiradas</span></div>
    </div>
    <div class="aj-grid" style="margin-top:12px">
      <div class="aj-tile"><span class="v" class:warn={(c?.pendientes_embed ?? 0) > 0}>{c?.pendientes_embed ?? '-'}</span><span class="k">Sin embeber</span></div>
      <div class="aj-tile"><span class="v" class:warn={(q?.error ?? 0) > 0}>{q?.error ?? '-'}</span><span class="k">Errores de cola</span></div>
      <div class="aj-tile"><span class="v">{fmtLag(q?.avg_lag_s)}</span><span class="k">Desfase medio</span></div>
    </div>
  </section>

  <section class="aj-sec">
    <div class="aj-head">
      <Icon name="users" size={13} color="var(--dim)" /><span>Quien ha escrito el corpus</span>
      <!-- "vigentes" y no "versiones": la suma de /api/authors da 520, que es `memory_current`,
           no las 895 filas. Comprobado el 04/09/2026 sumando las ocho filas contra el status. -->
      {#if totalAutoria}<span class="aj-head-sub">{totalAutoria} vigentes</span>{/if}
    </div>
    {#if authors === null && !error}
      <div class="empty">Cargando...</div>
    {:else if authors?.length}
      <div class="card">
        {#each authors as r, i (i)}
          <div class="bar-row">
            <span class="bar-label" title={r.model_source ?? ''}>
              <Icon
                name={r.actor === 'human' ? 'heart' : 'zap'}
                size={13}
                color={r.actor === 'human' ? 'var(--accent)' : 'var(--dim)'}
              />
              <span>{quien(r)}</span>
            </span>
            <span class="bar-track"><span class="bar-fill" style="width:{Math.round((r.n / maxAutoria) * 100)}%"></span></span>
            <span class="bar-val">{r.n}</span>
          </div>
        {/each}
      </div>
      <p class="nota">
        Las filas sin modelo son anteriores al backfill de autoria y su <code>model_source</code>
        es <code>unknown_legacy</code>: ahi no consta con que se escribieron, no es que se
        escribieran sin modelo.
      </p>
    {:else if !error}
      <div class="empty">Sin datos de autoria.</div>
    {/if}
  </section>

  <section class="aj-sec">
    <div class="aj-head"><Icon name="settings" size={13} color="var(--dim)" /><span>Preferencias de este navegador</span></div>
    <dl class="aj-list">
      <div>
        <dt>Tema</dt>
        <dd>{theme.value === 'dark' ? 'oscuro' : 'claro'}
          <span class="dd-sub">{temaForzado ? 'elegido a mano' : 'sigue al sistema'} · se cambia en el rail</span>
        </dd>
      </div>
      <div>
        <dt>Orden del arbol</dt>
        <dd>{SORT_LABEL[prefs.sort] ?? prefs.sort}<span class="dd-sub">se cambia en la cabecera del arbol</span></dd>
      </div>
      <div>
        <dt>Ancho de la barra lateral</dt>
        <dd>{prefs.side} px<span class="dd-sub">se cambia arrastrando su borde</span></dd>
      </div>
    </dl>
    <p class="nota">
      Viven en el <code>localStorage</code> de este navegador con el prefijo <code>naeth-</code>, no
      en el servidor: otro dispositivo tiene las suyas.
    </p>
  </section>
</div>

<style>
  .ajustes { padding: 40px 48px; max-width: 900px; margin: 0 auto; }
  .aj-conn { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
  .aj-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; background: var(--ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 22%, transparent); }
  .aj-dot.bad { background: var(--warn); box-shadow: 0 0 0 3px color-mix(in srgb, var(--warn) 22%, transparent); }
  .aj-state { font: 600 22px var(--font-sans); color: var(--ink); }
  .aj-sub { flex-basis: 100%; font: 12px var(--font-mono); color: var(--dim); }

  .aviso { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 20px; padding: 11px 14px; border-radius: 8px; background: var(--panel); border: 1px solid var(--warn); font: 12px/1.5 var(--font-sans); color: var(--ink); }
  .aviso.err { margin-top: 0; }

  .aj-sec { margin-bottom: 26px; }
  .aj-head { display: flex; align-items: center; gap: 7px; font: 11px var(--font-mono); letter-spacing: 1px; text-transform: uppercase; color: var(--dim); margin-bottom: 12px; }
  .aj-head-sub { margin-left: auto; letter-spacing: 0; text-transform: none; }

  .aj-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
  .aj-tile { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 15px 16px; display: flex; flex-direction: column; gap: 7px; }
  .aj-tile .v { font: 600 26px var(--font-mono); color: var(--ink); line-height: 1; }
  .aj-tile .v.warn { color: var(--warn); }
  .aj-tile .k { font: 10px var(--font-mono); letter-spacing: .5px; text-transform: uppercase; color: var(--dim); }

  .aj-list { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 6px 18px; margin: 0; }
  .aj-list > div { display: grid; grid-template-columns: minmax(140px, 240px) 1fr; gap: 14px; align-items: baseline; padding: 11px 0; border-bottom: 1px solid var(--border); }
  .aj-list > div:last-child { border-bottom: 0; }
  .aj-list dt { font: 12px var(--font-sans); color: var(--dim); }
  .aj-list dd { margin: 0; font: 12px var(--font-mono); color: var(--ink); word-break: break-word; }
  .dd-sub { display: block; margin-top: 3px; font: 11px var(--font-sans); color: var(--dim); }

  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 16px 18px; }
  .bar-row { display: grid; grid-template-columns: minmax(120px, 260px) 1fr 40px; align-items: center; gap: 10px; margin-bottom: 9px; }
  .bar-row:last-child { margin-bottom: 0; }
  .bar-label { display: flex; align-items: center; gap: 7px; font: 12px var(--font-sans); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { height: 8px; border-radius: 99px; background: var(--bg2); overflow: hidden; }
  .bar-fill { display: block; height: 100%; border-radius: 99px; min-width: 3px; background: var(--accent); }
  .bar-val { font: 11px var(--font-mono); color: var(--dim); text-align: right; }

  .nota { margin: 10px 2px 0; font: 11px/1.6 var(--font-sans); color: var(--dim); }
  .nota code, .aviso code { font: 11px var(--font-mono); }
  .empty { color: var(--dim); font: 13px var(--font-sans); }

  @media (max-width: 600px) {
    .ajustes { padding: 24px 16px; }
    .aj-grid { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
    .aj-tile .v { font-size: 22px; }
    .aj-list > div { grid-template-columns: 1fr; gap: 4px; }
  }
</style>
