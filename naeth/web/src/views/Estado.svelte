<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import { data } from '../lib/data.svelte'
  import { typeMeta, typeColor, projMeta, projColor } from '../lib/colors'
  import { fmtLag } from '../lib/format'
  import type { TreeRow } from '../lib/types'

  const aggBy = (rows: TreeRow[], fn: (r: TreeRow) => string): [string, number][] => {
    const m = new Map<string, number>()
    for (const r of rows) { const k = fn(r); m.set(k, (m.get(k) || 0) + 1) }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }

  const notes = $derived(data.tree ?? [])
  const c = $derived(data.status?.counts)
  const q = $derived(data.status?.queue)
  const tot = $derived(c?.memory_total ?? 0)
  const pend = $derived(c?.pendientes_embed ?? 0)
  const emb = $derived(tot - pend)
  const pct = $derived(tot > 0 ? Math.round((emb / tot) * 100) : 0)
  const projs = $derived(new Set(notes.map((m) => (m.path || '(sin path)').split('/')[0])).size)

  const byType = $derived(aggBy(notes, (m) => m.memory_type || '?'))
  const byProject = $derived(aggBy(notes, (m) => (m.path || '(sin path)').split('/')[0]).slice(0, 8))

  // actividad: 14 buckets diarios (columnas en accent)
  const DAYS = 14
  const activity = $derived.by(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const buckets: { d: Date; key: string; n: number }[] = []
    const idx = new Map<string, number>()
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      idx.set(key, buckets.length); buckets.push({ d, key, n: 0 })
    }
    for (const r of notes) {
      if (!r.created_at) continue
      const k = String(r.created_at).slice(0, 10)
      if (idx.has(k)) buckets[idx.get(k)!].n++
    }
    return buckets
  })
  const actTotal = $derived(activity.reduce((a, b) => a + b.n, 0))
  const actMax = $derived(Math.max(1, ...activity.map((b) => b.n)))

  const maxType = $derived(Math.max(1, ...byType.map((e) => e[1])))
  const maxProj = $derived(Math.max(1, ...byProject.map((e) => e[1])))
</script>

<div class="estado">
  <div class="est-conn">
    <span class="est-dot" class:bad={!data.online}></span>
    <span class="est-state">{data.online ? 'Conectado' : 'Sin conexión'}</span>
    <span class="est-sub">nodo local · {data.status?.embed_model ?? 'modelo ?'} · {data.status?.embed_dim ?? '?'} dimensiones</span>
  </div>

  <section class="est-sec">
    <div class="est-grid">
      <div class="est-tile"><span class="v">{c?.memory_current ?? '–'}</span><span class="k">Vigentes</span></div>
      <div class="est-tile"><span class="v">{tot || '–'}</span><span class="k">Versiones</span></div>
      <div class="est-tile"><span class="v">{c?.relations ?? '–'}</span><span class="k">Relaciones</span></div>
      <div class="est-tile"><span class="v">{projs || '–'}</span><span class="k">Proyectos</span></div>
    </div>
  </section>

  <section class="est-sec">
    <div class="charts">
      <div class="chart">
        <h3><Icon name="eye" size={13} color="var(--dim)" /><span>Memorias por tipo</span></h3>
        {#each byType as [k, n] (k)}
          <div class="bar-row">
            <span class="bar-label"><Icon name={typeMeta(k).icon} size={13} color={typeColor(k)} /><span>{k}</span></span>
            <span class="bar-track"><span class="bar-fill" style="width:{Math.round((n / maxType) * 100)}%;background:{typeColor(k)}"></span></span>
            <span class="bar-val">{n}</span>
          </div>
        {/each}
      </div>
      <div class="chart">
        <h3><Icon name="folder" size={13} color="var(--dim)" /><span>Memorias por proyecto</span></h3>
        {#each byProject as [k, n] (k)}
          <div class="bar-row">
            <span class="bar-label"><Icon name={projMeta(k).icon} size={13} color={projColor(k)} /><span>{k}</span></span>
            <span class="bar-track"><span class="bar-fill" style="width:{Math.round((n / maxProj) * 100)}%;background:{projColor(k)}"></span></span>
            <span class="bar-val">{n}</span>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="est-sec">
    <div class="chart">
      <h3>
        <Icon name="activity" size={13} color="var(--dim)" /><span>Memorias por día · últimos {DAYS} días</span>
        <span class="chart-sub">{actTotal} en el periodo</span>
      </h3>
      <div class="spark">
        {#each activity as b, i (b.key)}
          <div class="day" class:empty={!b.n} title="{b.d.getDate()}/{b.d.getMonth() + 1}: {b.n} memoria(s)">
            <span class="n">{b.n || ''}</span>
            <span class="barwrap"><span class="bar" style="height:{b.n ? Math.max(Math.round((b.n / actMax) * 100), 6) : 0}%"></span></span>
            <span class="x">{i === activity.length - 1 ? 'hoy' : b.d.getDate()}</span>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section class="est-sec">
    <div class="est-sec-head"><Icon name="activity" size={13} color="var(--dim)" /><span>Salud del nodo</span></div>
    <div class="est-emb">
      <div class="est-bar"><i style="width:{pct}%"></i></div>
      <div class="est-emb-meta">
        <span class="v" class:ok={pct === 100}>Embeddings {tot ? pct + ' %' : '–'}</span>
        <span class="k">{emb}/{tot} embebidas · {pend} sin embeber</span>
      </div>
    </div>
    <div class="est-grid" style="margin-top:12px">
      <div class="est-tile"><span class="v" class:warn={(q?.pending ?? 0) > 0}>{q?.pending ?? '–'}</span><span class="k">Cola pendiente</span></div>
      <div class="est-tile"><span class="v">{q?.processing ?? '–'}</span><span class="k">Procesando</span></div>
      <div class="est-tile"><span class="v ok">{q?.done ?? '–'}</span><span class="k">Completadas</span></div>
      <div class="est-tile"><span class="v" class:warn={(q?.error ?? 0) > 0}>{q?.error ?? '–'}</span><span class="k">Errores</span></div>
      <div class="est-tile"><span class="v">{fmtLag(q?.avg_lag_s)}</span><span class="k">Desfase medio</span></div>
    </div>
  </section>
</div>

<style>
  .estado { padding: 40px 48px; max-width: 1400px; margin: 0 auto; }
  .est-conn { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 30px; }
  .est-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; background: var(--ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 22%, transparent); }
  .est-dot.bad { background: var(--warn); box-shadow: 0 0 0 3px color-mix(in srgb, var(--warn) 22%, transparent); }
  .est-state { font: 600 22px var(--font-sans); color: var(--ink); }
  .est-sub { flex-basis: 100%; font: 12px var(--font-mono); color: var(--dim); }
  .est-sec { margin-bottom: 26px; }
  .est-sec-head { display: flex; align-items: center; gap: 7px; font: 11px var(--font-mono); letter-spacing: 1px; text-transform: uppercase; color: var(--dim); margin-bottom: 12px; }
  .est-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
  .est-tile { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 15px 16px; display: flex; flex-direction: column; gap: 7px; }
  .est-tile .v { font: 600 26px var(--font-mono); color: var(--ink); line-height: 1; }
  .est-tile .v.ok { color: var(--ok); }
  .est-tile .v.warn { color: var(--warn); }
  .est-tile .k { font: 10px var(--font-mono); letter-spacing: .5px; text-transform: uppercase; color: var(--dim); }

  .charts { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
  .chart { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 16px 18px; }
  .chart h3 { font: 11px var(--font-mono); letter-spacing: 1px; text-transform: uppercase; color: var(--dim); margin: 0 0 14px; display: flex; align-items: center; gap: 7px; }
  .chart-sub { margin-left: auto; letter-spacing: 0; text-transform: none; }
  .bar-row { display: grid; grid-template-columns: minmax(80px, 140px) 1fr 34px; align-items: center; gap: 10px; margin-bottom: 9px; }
  .bar-row:last-child { margin-bottom: 0; }
  .bar-label { display: flex; align-items: center; gap: 7px; font: 12px var(--font-sans); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { height: 8px; border-radius: 99px; background: var(--bg2); overflow: hidden; }
  .bar-fill { display: block; height: 100%; border-radius: 99px; min-width: 3px; }
  .bar-val { font: 11px var(--font-mono); color: var(--dim); text-align: right; }

  .spark { display: flex; align-items: stretch; gap: 6px; height: 130px; }
  .day { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: 0; }
  .day .n { font: 10px var(--font-mono); color: var(--ink); min-height: 13px; line-height: 1; }
  .barwrap { flex: 1 1 auto; width: 100%; display: flex; align-items: flex-end; justify-content: center; border-bottom: 1px solid var(--border); }
  .bar { width: 100%; max-width: 30px; background: var(--accent); border-radius: 4px 4px 0 0; min-height: 2px; opacity: .85; }
  .day:hover .bar { opacity: 1; }
  .day.empty .bar { background: var(--border); }
  .day .x { font: 10px var(--font-mono); color: var(--dim); line-height: 1; }

  .est-emb { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }
  .est-bar { height: 8px; border-radius: 99px; background: var(--bg2); border: 1px solid var(--border); overflow: hidden; }
  .est-bar > i { display: block; height: 100%; background: var(--ok); transition: width .4s ease; }
  .est-emb-meta { display: flex; align-items: baseline; gap: 10px; }
  .est-emb-meta .v { font: 600 18px var(--font-mono); color: var(--ink); }
  .est-emb-meta .v.ok { color: var(--ok); }
  .est-emb-meta .k { font: 12px var(--font-mono); color: var(--dim); }
  @media (max-width: 600px) {
    .estado { padding: 24px 16px; }
    .est-grid { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
    .est-tile .v { font-size: 22px; }
  }
</style>
