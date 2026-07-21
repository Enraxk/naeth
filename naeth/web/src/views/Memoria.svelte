<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import Milkdown, { type EditorApi } from '../components/Milkdown.svelte'
  import { getMemory, supersede, getRelations } from '../lib/api'
  import type { MemoryDetail, Relation } from '../lib/types'
  import { navigate } from '../lib/router.svelte'
  import { data } from '../lib/data.svelte'
  import { typeMeta, typeColor } from '../lib/colors'
  import { fmtDate } from '../lib/format'

  let { id }: { id: string } = $props()

  const ALL_TYPES = ['fact', 'observation', 'decision', 'preference', 'learning', 'error']

  let detail = $state<MemoryDetail | null>(null)
  let notFound = $state(false)
  let chain = $state<{ id: string; created_at: string | null; cur: boolean }[]>([])
  let relations = $state<Relation[]>([])
  const titleOf = (rid: string) => (data.tree ?? []).find((r) => r.id === rid)?.title ?? '(memoria)'
  const otherId = (r: Relation) => (r.direction === 'out' ? r.target_id : r.source_id)

  // edición
  let editing = $state(false)
  let saving = $state(false)
  let dirty = $state(false)
  let dTitle = $state('')
  let dType = $state('observation')
  let dTags = $state<string[]>([])
  let dPath = $state('')
  let tagInput = $state('')
  let draftAvail = $state(false)

  // Milkdown
  let mdRef = $state<EditorApi | null>(null)
  let mdValue = $state('')
  let mdKey = $state(0)
  let emojiOpen = $state(false)
  const EMOJIS = ['😀','😄','😅','😂','🙂','😉','😍','🤔','😎','😴','😢','😡','👍','👎','👏','🙌','🙏','💪','👀','🧠','🔥','✨','⭐','💡','✅','❌','⚠️','❓','❗','📌','📎','📝','📁','📅','🔗','🔒','🚀','🎯','🐛','⚙️','💾','🌍','❤️','🎉','☕','📈','🧩','🌙']

  const typeOptions = $derived(ALL_TYPES.includes(dType) ? ALL_TYPES : [dType, ...ALL_TYPES])

  // índice (outline) a partir de los encabezados del contenido
  const outline = $derived.by(() => {
    const src = detail?.memory.content ?? ''
    const out: { level: number; text: string }[] = []
    for (const line of src.split('\n')) {
      const mm = line.match(/^(#{1,6})\s+(.+?)\s*#*$/)
      if (mm) out.push({ level: mm[1].length, text: mm[2].trim() })
    }
    return out
  })
  const hasContext = $derived(!editing && (outline.length > 0 || relations.length > 0 || chain.length > 1))
  function gotoHeading(i: number) {
    const hs = document.querySelectorAll('.d-body :is(h1,h2,h3,h4,h5,h6)')
    ;(hs[i] as HTMLElement | undefined)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  // ---- carga + historial -------------------------------------------------
  const cache = new Map<string, MemoryDetail>()
  async function getMem(mid: string) {
    if (cache.has(mid)) return cache.get(mid)!
    const r = await getMemory(mid)
    cache.set(mid, r)
    return r
  }
  async function walkChain(start: string) {
    const seen = new Set<string>([start])
    const before: string[] = []
    const after: string[] = []
    async function back(x: string) {
      const r = await getMem(x); if (!r?.memory) return
      const link = (r.supersession || []).find((s) => s.child_id === x)
      if (link && !seen.has(link.parent_id)) { seen.add(link.parent_id); await back(link.parent_id) }
      before.push(x)
    }
    async function fwd(x: string) {
      const r = await getMem(x); if (!r?.memory) return
      const link = (r.supersession || []).find((s) => s.parent_id === x)
      if (link && !seen.has(link.child_id)) { seen.add(link.child_id); after.push(link.child_id); await fwd(link.child_id) }
    }
    await back(start); await fwd(start)
    return [...before, ...after]
  }

  $effect(() => {
    const mid = id
    editing = false; saving = false; dirty = false; notFound = false
    getMem(mid).then(async (r) => {
      if (mid !== id) return
      if (!r?.memory) { detail = null; notFound = true; return }
      mdValue = r.memory.content
      detail = r                 // swap en sitio (sin blanquear); Milkdown remonta por id
      draftAvail = !!readDraft(mid)
      document.querySelector('.detail')?.scrollTo({ top: 0 })
      getRelations(mid).then((rs) => { if (mid === id) relations = rs })
      const ids = await walkChain(mid)
      if (mid !== id) return
      if (ids.length > 1) {
        const rows = await Promise.all(ids.map(getMem))
        chain = ids.map((cid, idx) => ({ id: cid, created_at: rows[idx]?.memory?.created_at ?? null, cur: cid === mid }))
      } else { chain = [] }
    })
  })

  // ---- borrador (localStorage por id) -----------------------------------
  type Draft = { title: string; memory_type: string; tags: string[]; path: string; content: string }
  const draftKey = (mid: string) => `naeth-draft-${mid}`
  function readDraft(mid: string): Draft | null {
    try { const s = localStorage.getItem(draftKey(mid)); return s ? JSON.parse(s) : null } catch { return null }
  }
  function clearDraft(mid: string) { try { localStorage.removeItem(draftKey(mid)) } catch { /* noop */ } }

  function isDirtyNow(content: string) {
    const m = detail!.memory
    return content !== m.content
      || dTitle !== (m.title ?? '')
      || dType !== m.memory_type
      || dPath !== (m.path ?? '')
      || dTags.join('') !== (m.tags ?? []).join('')
  }
  function saveDraft() {
    if (!editing || !mdRef || !detail) return
    const content = mdRef.getMarkdown()
    if (isDirtyNow(content)) {
      const d: Draft = { title: dTitle, memory_type: dType, tags: dTags, path: dPath, content }
      try { localStorage.setItem(draftKey(id), JSON.stringify(d)) } catch { /* noop */ }
      dirty = true
    } else {
      clearDraft(id); dirty = false
    }
  }

  // ---- acciones ----------------------------------------------------------
  function startEdit() {
    const m = detail!.memory
    dTitle = m.title ?? ''; dType = m.memory_type; dTags = [...(m.tags ?? [])]; dPath = m.path ?? ''
    editing = true; dirty = false
  }
  function retomarDraft() {
    const d = readDraft(id); if (!d) return
    dTitle = d.title ?? ''; dType = d.memory_type ?? detail!.memory.memory_type
    dTags = d.tags ?? []; dPath = d.path ?? ''
    mdValue = d.content ?? detail!.memory.content
    mdKey++           // remonta Milkdown con el contenido del borrador
    editing = true; dirty = true
  }
  function descartarDraft() { clearDraft(id); draftAvail = false }
  function cancel() { editing = false; draftAvail = !!readDraft(id) }

  async function doSave() {
    if (!detail || saving) return
    saving = true
    const content = mdRef ? mdRef.getMarkdown() : detail.memory.content
    try {
      const r = await supersede(id, {
        content,
        title: dTitle || null,
        memory_type: dType,
        tags: dTags,
        path: dPath || null,
        metadata: detail.memory.metadata ?? {},
      })
      clearDraft(id)
      editing = false; saving = false; dirty = false
      const newId = r.memory?.id
      if (newId) navigate('memoria', newId)
    } catch {
      saving = false
    }
  }

  // tags
  function addTag() {
    const v = tagInput.trim().replace(/,+$/, '')
    if (v && !dTags.includes(v)) { dTags = [...dTags, v]; dirty = true }
    tagInput = ''
  }
  function tagKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
    else if (e.key === 'Backspace' && tagInput === '' && dTags.length) { dTags = dTags.slice(0, -1); dirty = true }
  }
  function removeTag(t: string) { dTags = dTags.filter((x) => x !== t); dirty = true }

  // autosave del borrador + Ctrl+S, solo mientras editas
  $effect(() => {
    if (!editing) return
    const iv = setInterval(saveDraft, 1500)
    return () => clearInterval(iv)
  })
  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); doSave() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })
</script>

{#if notFound}
  <div class="empty">No encontrada.</div>
{:else if detail}
  {@const m = detail.memory}
  <div class="memoria" class:editing class:has-context={hasContext}>
    <div class="note"><div class="note-inner">
    {#if draftAvail && !editing}
      <div class="draft-banner">
        <Icon name="square-pen" size={13} />
        <span>Tienes un borrador sin guardar de esta nota.</span>
        <button class="lnk" onclick={retomarDraft}>Retomar</button>
        <button class="lnk dim" onclick={descartarDraft}>Descartar</button>
      </div>
    {/if}

    {#if editing}
      <input class="e-title" bind:value={dTitle} oninput={() => (dirty = true)} placeholder="Título" />
      <div class="e-row">
        <label>tipo
          <select bind:value={dType} onchange={() => (dirty = true)}>
            {#each typeOptions as t}<option value={t}>{t}</option>{/each}
          </select>
        </label>
        <label class="grow">ruta
          <input bind:value={dPath} oninput={() => (dirty = true)} placeholder="proyecto/origen" />
        </label>
      </div>
      <div class="e-tags">
        {#each dTags as t (t)}
          <span class="chip">{t}<button onclick={() => removeTag(t)} aria-label="quitar">×</button></span>
        {/each}
        <input class="tag-in" bind:value={tagInput} onkeydown={tagKey} onblur={addTag} placeholder="añadir tag…" />
      </div>
    {:else}
      <div class="d-head">
        <h1 class="d-title">{m.title || '(sin título)'}</h1>
        <button class="edit-btn" onclick={startEdit}><Icon name="square-pen" size={14} /><span>editar</span></button>
      </div>
      <div class="d-meta">
        <span>{m.path || '(sin path)'}</span><span class="sep">·</span>
        <span class="d-type"><Icon name={typeMeta(m.memory_type).icon} size={13} color={typeColor(m.memory_type)} /><span>{m.memory_type}</span></span>
        <span class="sep">·</span><span>{fmtDate(m.created_at)}</span>
        <span class="sep">·</span><span title={m.id}>id {String(m.id).slice(0, 8)}</span>
      </div>
      {#if m.tags?.length}
        <div class="d-tags">{#each m.tags as t}<span class="tag">{t}</span>{/each}</div>
      {/if}
    {/if}

    {#if editing}
      <div class="mdbar">
        <button class="tb" title="Negrita" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.bold()}><Icon name="bold" size={15} /></button>
        <button class="tb" title="Itálica" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.italic()}><Icon name="italic" size={15} /></button>
        <button class="tb" title="Tachado" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.strike()}><Icon name="strikethrough" size={15} /></button>
        <button class="tb" title="Código en línea" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.code()}><Icon name="code" size={15} /></button>
        <span class="tb-sep"></span>
        <button class="tb" title="Título 1" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.heading(1)}>H1</button>
        <button class="tb" title="Título 2" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.heading(2)}>H2</button>
        <button class="tb" title="Título 3" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.heading(3)}>H3</button>
        <span class="tb-sep"></span>
        <button class="tb" title="Lista" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.bullet()}><Icon name="list" size={15} /></button>
        <button class="tb" title="Lista numerada" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.ordered()}><Icon name="list-ordered" size={15} /></button>
        <button class="tb" title="Cita" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.quote()}><Icon name="quote" size={15} /></button>
        <span class="tb-sep"></span>
        <button class="tb" title="Bloque de código" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.codeblock()}><Icon name="square-code" size={15} /></button>
        <button class="tb" title="Tabla" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.table()}><Icon name="table" size={15} /></button>
        <button class="tb" title="Separador" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.hr()}><Icon name="minus" size={15} /></button>
        <span class="tb-sep"></span>
        <div class="tb-emoji">
          <button class="tb" title="Emoji" onmousedown={(e) => e.preventDefault()} onclick={() => (emojiOpen = !emojiOpen)}><Icon name="smile" size={15} /></button>
          {#if emojiOpen}
            <div class="emoji-pop">
              {#each EMOJIS as e (e)}
                <button class="emj" onmousedown={(ev) => ev.preventDefault()} onclick={() => { mdRef?.insert(e); emojiOpen = false }}>{e}</button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
    {#key `${m.id}-${editing}-${mdKey}`}
      <div class="d-body"><Milkdown value={mdValue} readonly={!editing} getRef={(r) => (mdRef = r)} /></div>
    {/key}

    {#if editing}
      <div class="e-actions">
        <button class="btn-primary" onclick={doSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        <button class="btn" onclick={cancel}>Cancelar</button>
        {#if dirty}<span class="modif">● modificado</span>{/if}
        <span class="hint">Ctrl+S guarda · crea una versión nueva</span>
      </div>
    {/if}
    </div></div>

    {#if hasContext}
      <aside class="context">
        {#if outline.length}
          <div class="ctx-sec">
            <div class="ctx-head">Índice</div>
            <div class="outline">
              {#each outline as h, i (i)}
                <button class="ol" style="padding-left:{(h.level - 1) * 12 + 6}px" onclick={() => gotoHeading(i)}>{h.text}</button>
              {/each}
            </div>
          </div>
        {/if}
        {#if relations.length}
          <div class="ctx-sec">
            <div class="ctx-head">Relaciones · {relations.length}</div>
            <div class="rels-list">
              {#each relations as r (r.id)}
                <button class="rel" title={r.predicate} onclick={() => navigate('memoria', otherId(r))}>
                  <span class="rel-dir" title={r.direction === 'out' ? 'esta nota enlaza a' : 'le enlaza'}>{r.direction === 'out' ? '→' : '←'}</span>
                  <span class="rel-title">{titleOf(otherId(r))}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
        {#if chain.length > 1}
          <div class="ctx-sec">
            <div class="ctx-head">Historial</div>
            <div class="timeline">
              {#each [...chain].reverse() as v, idx (v.id)}
                {@const ver = 'v' + (chain.length - idx)}
                <button class="ver" class:cur={v.cur} onclick={() => navigate('memoria', v.id)}>
                  <span class="vg"><span class="dot"></span><span>{ver}{v.cur ? ' · actual' : ''}</span></span>
                  <span class="vdate">{fmtDate(v.created_at)}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </aside>
    {/if}
  </div>
{:else}
  <div class="empty">Cargando…</div>
{/if}

<style>
  .memoria { display: grid; grid-template-columns: 1fr; gap: 40px; padding: 28px 48px; align-items: start; }
  .memoria.has-context { grid-template-columns: minmax(0, 1fr) 300px; }
  .note { min-width: 0; }
  .note-inner { max-width: 760px; margin: 0 auto; }
  .memoria.editing .note-inner { max-width: 1080px; }
  .context { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 26px; min-width: 0; }
  .ctx-head { font: 11px var(--font-mono); letter-spacing: 1px; text-transform: uppercase; color: var(--dim); margin-bottom: 10px; }
  .outline { display: flex; flex-direction: column; gap: 1px; }
  .ol { text-align: left; font: 12px var(--font-sans); color: var(--dim); padding: 4px 6px; border-radius: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
  .ol:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent); }
  .vdate { font: 11px var(--font-mono); color: var(--dim); flex: 0 0 auto; }
  .d-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .d-title { font: 600 24px var(--font-sans); margin: 0 0 14px; color: var(--ink); }
  .edit-btn { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; font: 12px var(--font-mono); color: var(--dim); border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; }
  .edit-btn:hover { color: var(--ink); border-color: var(--accent); }
  .d-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font: 12px var(--font-mono); color: var(--dim); margin-bottom: 12px; }
  .d-meta .sep { color: var(--border); }
  .d-type { display: inline-flex; align-items: center; gap: 5px; }
  .d-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
  .tag { font: 11px var(--font-mono); color: var(--dim); border: 1px solid var(--border); border-radius: 4px; padding: 2px 8px; }
  .d-body { font: 14px/1.65 var(--font-sans); color: var(--ink); margin-top: 4px; }

  /* toolbar de formato (Markdown-native) */
  .mdbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 6px 6px; margin-bottom: 10px; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; }
  .tb { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; padding: 0 7px; border-radius: 6px; color: var(--dim); font: 600 12px var(--font-mono); }
  .tb:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
  .tb-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }
  .tb-emoji { position: relative; display: inline-flex; }
  .emoji-pop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 20; width: 268px; max-height: 210px; overflow: auto; display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 12px 32px rgba(0, 0, 0, .4); }
  .emj { font-size: 18px; line-height: 1; padding: 5px; border-radius: 6px; }
  .emj:hover { background: var(--sel); }

  /* edición */
  .e-title { width: 100%; font: 600 24px var(--font-sans); color: var(--ink); background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; outline: none; }
  .e-title:focus { border-color: var(--accent); }
  .e-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .e-row label { display: flex; flex-direction: column; gap: 4px; font: 10px var(--font-mono); letter-spacing: .5px; text-transform: uppercase; color: var(--dim); }
  .e-row .grow { flex: 1 1 auto; min-width: 160px; }
  .e-row select, .e-row input { font: 13px var(--font-mono); color: var(--ink); background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; outline: none; }
  .e-row select:focus, .e-row input:focus { border-color: var(--accent); }
  .e-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 16px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; font: 11px var(--font-mono); color: var(--ink); background: var(--bg2); border: 1px solid var(--border); border-radius: 4px; padding: 2px 4px 2px 8px; }
  .chip button { color: var(--dim); font: 13px var(--font-mono); padding: 0 4px; border-radius: 3px; }
  .chip button:hover { color: var(--warn); }
  .tag-in { flex: 1 1 120px; min-width: 100px; font: 12px var(--font-mono); color: var(--ink); background: none; border: 1px dashed var(--border); border-radius: 4px; padding: 4px 8px; outline: none; }
  .tag-in:focus { border-color: var(--accent); border-style: solid; }
  .e-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border); }
  .btn-primary { font: 13px var(--font-mono); color: #fff; background: var(--accent); border-radius: 6px; padding: 7px 16px; }
  .btn-primary:disabled { opacity: .6; }
  .btn { font: 13px var(--font-mono); color: var(--dim); border: 1px solid var(--border); border-radius: 6px; padding: 7px 14px; }
  .btn:hover { color: var(--ink); border-color: var(--accent); }
  .modif { font: 11px var(--font-mono); color: var(--warn); }
  .hint { font: 11px var(--font-mono); color: var(--dim); margin-left: auto; }

  .draft-banner { display: flex; align-items: center; gap: 10px; font: 12px var(--font-mono); color: var(--ink); background: color-mix(in srgb, var(--warn) 12%, transparent); border: 1px solid color-mix(in srgb, var(--warn) 40%, var(--border)); border-radius: 8px; padding: 8px 12px; margin-bottom: 16px; }
  .draft-banner .lnk { font: 12px var(--font-mono); color: var(--accent); padding: 2px 6px; border-radius: 4px; }
  .draft-banner .lnk.dim { color: var(--dim); margin-left: auto; }
  .draft-banner .lnk:hover { text-decoration: underline; }

  .timeline { border-left: 1px solid var(--border); padding-left: 8px; display: flex; flex-direction: column; gap: 8px; }
  .ver { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 5px 8px; border-radius: 6px; width: 100%; text-align: left; font: 12px var(--font-mono); color: var(--dim); }
  .ver:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
  .ver.cur { background: var(--sel); color: var(--ink); }
  .vg { display: flex; align-items: center; gap: 10px; }
  .dot { flex: 0 0 auto; width: 9px; height: 9px; border-radius: 50%; border: 2px solid var(--dim); }
  .ver.cur .dot { background: var(--accent); border-color: var(--accent); }
  .empty { color: var(--dim); font: 13px var(--font-sans); padding: 28px 40px; }

  .rels-list { display: flex; flex-direction: column; gap: 2px; }
  .rel { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 7px 8px; border-radius: 6px; color: var(--ink); }
  .rel:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
  .rel-dir { flex: 0 0 auto; font: 14px var(--font-mono); color: var(--accent); width: 16px; text-align: center; }
  .rel-title { font: 13px var(--font-sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  @media (max-width: 1000px) {
    .memoria.has-context { grid-template-columns: 1fr; }
    .context { position: static; }
  }
  @media (max-width: 600px) {
    .memoria { padding: 22px 18px; }
    .d-title, .e-title { font-size: 20px; }
    .note-inner, .memoria.editing .note-inner { max-width: none; }
  }
</style>
