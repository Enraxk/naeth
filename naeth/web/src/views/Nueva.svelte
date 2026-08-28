<script lang="ts">
  import { onMount } from 'svelte'
  import Icon from '../components/Icon.svelte'
  import Milkdown, { type EditorApi, type WikiState } from '../components/Milkdown.svelte'
  import PathField from '../components/PathField.svelte'
  import { addMemory, addRelation } from '../lib/api'
  import { navigate } from '../lib/router.svelte'
  import { rankWikiCandidates } from '../lib/wikipick'
  import { buildIndex, extractLinkedIds } from '../lib/wikilinks'
  import { data } from '../lib/data.svelte'
  import { typeMeta, typeColor } from '../lib/colors'

  /**
   * Alta de memoria.
   *
   * Es el editor de `Memoria.svelte` sin la mitad de lectura, contra `POST /api/memory` en vez de
   * contra el supersede. Lo que cambia de verdad respecto a editar:
   *
   *  - No hay nota de la que partir, asi que el `dirty` se mide contra el vacio y no contra un
   *    contenido previo.
   *  - El borrador va bajo una clave FIJA y no por id, porque solo se escribe una nota a la vez.
   *  - El alta es IDEMPOTENTE por `content_hash`: guardar dos veces el mismo texto no duplica,
   *    devuelve la fila que ya habia. Eso hay que contarlo, no tragarselo.
   *
   * ⚠ El aspecto de esta vista es PROVISIONAL. Los estilos de abajo son los del editor de
   * `Memoria.svelte`, con los mismos valores, para que no desentone mientras tanto. El diseno
   * definitivo (arranque en vacio, selector de ruta sobre las 80 rutas, acuse de guardado) esta
   * encargado aparte; cuando llegue, se sustituye lo visual sin tocar la logica de este fichero.
   */

  // El vocabulario canonico (ver CLAUDE.md), y desde el 28/08/2026 el unico: ese dia se cerro en
  // estos cuatro, el editor de `Memoria.svelte` dejo de ofrecer `learning` y `error` (cero uso) y
  // las dos notas que quedaban en `reference` se migraron a `fact`. El corpus ya no usa ningun otro.
  const TYPES = ['fact', 'observation', 'decision', 'preference']

  // El mismo por defecto que aplica el backend cuando no se manda `memory_type`, para que crear
  // desde el visor y crear desde el MCP no diverjan sin querer.
  const TYPE_DEFAULT = 'observation'

  const DRAFT_KEY = 'naeth-draft-nueva'

  let dTitle = $state('')
  let dType = $state(TYPE_DEFAULT)
  let dPath = $state('')
  let dTags = $state<string[]>([])
  let tagInput = $state('')

  let saving = $state(false)
  let dirty = $state(false)
  let error = $state('')
  let yaExistia = $state('')

  let mdRef = $state<EditorApi | null>(null)
  let mdValue = $state('')
  let mdKey = $state(0)
  let draftAvail = $state(false)

  // ---- borrador -----------------------------------------------------------------------------
  type Draft = { title: string; memory_type: string; tags: string[]; path: string; content: string }
  function readDraft(): Draft | null {
    try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : null } catch { return null }
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY) } catch { /* noop */ } }

  /**
   * Markdown que produce el editor recien montado y VACIO.
   *
   * Milkdown normaliza al cargar (por ejemplo, deja un salto de linea), asi que comparar contra la
   * cadena vacia daria "modificado" desde el primer instante. Es el mismo fallo que tenia la vista
   * de edicion hasta el 22/08, y se cierra igual: la referencia es lo que el propio editor
   * devuelve, no lo que uno cree que deberia devolver.
   */
  let baseMd = $state('')
  let baseReady = $state(false)

  function captureBase() {
    if (baseReady || !mdRef) return
    baseMd = mdRef.getMarkdown()
    baseReady = true
    dirty = isDirtyNow(baseMd)
  }

  function isDirtyNow(content: string) {
    return content !== baseMd
      || dTitle !== ''
      || dType !== TYPE_DEFAULT
      || dPath !== ''
      || dTags.length > 0
  }

  function saveDraft() {
    if (!mdRef) return
    const content = mdRef.getMarkdown()
    if (isDirtyNow(content)) {
      const d: Draft = { title: dTitle, memory_type: dType, tags: dTags, path: dPath, content }
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* noop */ }
      dirty = true
    } else {
      clearDraft(); dirty = false
    }
  }

  function retomarDraft() {
    const d = readDraft(); if (!d) return
    dTitle = d.title ?? ''
    dType = d.memory_type ?? TYPE_DEFAULT
    dTags = d.tags ?? []
    dPath = d.path ?? ''
    mdValue = d.content ?? ''
    mdKey++                       // remonta el editor con el texto del borrador
    baseMd = ''; baseReady = true // lo montado ES el borrador, asi que hay cambios por definicion
    dirty = true
    draftAvail = false
  }
  function descartarDraft() { clearDraft(); draftAvail = false }

  // Al entrar: si quedó algo a medias de otra sesión, se ofrece en vez de pisarlo en silencio.
  onMount(() => { draftAvail = !!readDraft() })

  // Autosave, al mismo ritmo que la vista de edición. Aquí no hay modo lectura: se entra ya
  // escribiendo, así que corre mientras la vista viva.
  $effect(() => {
    const iv = setInterval(saveDraft, 1500)
    return () => clearInterval(iv)
  })

  // ---- selector de wikilinks ------------------------------------------------------------------
  // Mismo ranking que la vista de edicion, del modulo con tests: ver lib/wikipick.ts.
  let wiki = $state<WikiState | null>(null)
  let wikiActive = $state(0)
  let wikiDismissed = $state<number | null>(null)

  const wikiHits = $derived.by(() =>
    wiki ? rankWikiCandidates(wiki.query, data.tree ?? []) : [],
  )
  const wikiOpen = $derived(!!wiki && wikiHits.length > 0 && wiki.from !== wikiDismissed)

  function onWikiState(s: WikiState | null) {
    wiki = s
    if (!s) { wikiActive = 0; return }
    if (s.from !== wikiDismissed) wikiDismissed = null
    wikiActive = 0
  }
  function chooseWiki(i: number) {
    const hit = wikiHits[i]
    if (!hit || !wiki) return
    mdRef?.wikiInsert(wiki.from, wiki.to, hit.title ?? '(sin título)', hit.id)
    dirty = true
    wiki = null
  }
  function onWikiKey(key: string): boolean {
    if (!wikiOpen) return false
    if (key === 'ArrowDown') { wikiActive = (wikiActive + 1) % wikiHits.length; return true }
    if (key === 'ArrowUp') { wikiActive = (wikiActive - 1 + wikiHits.length) % wikiHits.length; return true }
    if (key === 'Enter' || key === 'Tab') { chooseWiki(wikiActive); return true }
    if (key === 'Escape') { wikiDismissed = wiki?.from ?? null; return true }
    return false
  }

  // ---- guardar --------------------------------------------------------------------------------
  const puedeGuardar = $derived(!!mdRef && dirty && !saving)

  /**
   * Materializa como relaciones `links_to` los enlaces del texto. En una nota recien creada no hay
   * relaciones previas que consultar, asi que basta con crearlas: no hay nada que deduplicar.
   */
  async function syncRelations(sourceId: string, content: string) {
    const targets = extractLinkedIds(content, buildIndex(data.tree ?? []))
      .filter((t) => t !== sourceId)
    for (const t of targets) {
      try { await addRelation(sourceId, t, 'links_to') } catch { /* una relación no tumba el alta */ }
    }
  }

  async function doSave() {
    if (!mdRef || saving) return
    const content = mdRef.getMarkdown().trim()
    if (!content) { error = 'Una memoria sin contenido no se guarda.'; return }

    saving = true; error = ''; yaExistia = ''
    try {
      const r = await addMemory({
        content,
        title: dTitle.trim() || null,
        memory_type: dType,
        tags: dTags,
        path: dPath.trim() || null,
      })
      const nuevo = r.memory?.id
      if (!nuevo) { error = 'El servidor no devolvió la memoria creada.'; saving = false; return }

      clearDraft()
      dirty = false
      saving = false

      if (r.created === false) {
        // Idempotencia por content_hash: ya existía una memoria con este mismo texto. No es un
        // error, pero tampoco es un alta, y callarlo dejaría creer que se guardó algo nuevo.
        yaExistia = nuevo
        return
      }
      await syncRelations(nuevo, content)
      navigate('memoria', nuevo)
    } catch {
      error = 'No se pudo guardar. ¿Sigue viva la pila?'
      saving = false
    }
  }

  function limpiar() {
    dTitle = ''; dType = TYPE_DEFAULT; dPath = ''; dTags = []; tagInput = ''
    mdValue = ''; mdKey++
    baseReady = false; dirty = false; error = ''; yaExistia = ''
    clearDraft()
  }

  function onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); doSave() }
  }

  // ---- tags -----------------------------------------------------------------------------------
  function addTag() {
    const v = tagInput.trim().replace(/,+$/, '')
    if (v && !dTags.includes(v)) { dTags = [...dTags, v]; dirty = true }
    tagInput = ''
  }
  function removeTag(t: string) { dTags = dTags.filter((x) => x !== t); dirty = true }
  function tagKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
    else if (e.key === 'Backspace' && !tagInput && dTags.length) { removeTag(dTags[dTags.length - 1]) }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="nueva">
  <div class="note-inner">

    {#if draftAvail}
      <div class="draft-banner">
        <Icon name="square-pen" size={13} />
        <span>Tienes una memoria a medio escribir.</span>
        <button class="lnk" onclick={retomarDraft}>Retomar</button>
        <button class="lnk dim" onclick={descartarDraft}>Descartar</button>
      </div>
    {/if}

    {#if yaExistia}
      <div class="aviso">
        <Icon name="eye" size={13} />
        <span>Ya existía una memoria con este mismo texto. No se ha duplicado.</span>
        <button class="lnk" onclick={() => navigate('memoria', yaExistia)}>Abrir la que hay</button>
      </div>
    {/if}

    {#if error}
      <div class="aviso err"><span>{error}</span></div>
    {/if}

    <input class="e-title" bind:value={dTitle} oninput={() => (dirty = true)} placeholder="Título" />

    <div class="e-row">
      <label>tipo
        <select bind:value={dType} onchange={() => (dirty = true)}>
          {#each TYPES as t}<option value={t}>{t}</option>{/each}
        </select>
      </label>
      <PathField bind:value={dPath} onDirty={() => (dirty = true)} />
    </div>

    <div class="e-tags">
      {#each dTags as t (t)}
        <span class="chip">{t}<button onclick={() => removeTag(t)} aria-label="quitar">×</button></span>
      {/each}
      <input class="tag-in" bind:value={tagInput} onkeydown={tagKey} onblur={addTag} placeholder="añadir tag…" />
    </div>

    <div class="mdbar">
      <button class="tb" title="Negrita" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.bold()}><Icon name="bold" size={15} /></button>
      <button class="tb" title="Itálica" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.italic()}><Icon name="italic" size={15} /></button>
      <button class="tb" title="Tachado" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.strike()}><Icon name="strikethrough" size={15} /></button>
      <button class="tb" title="Código" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.code()}><Icon name="code" size={15} /></button>
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
      <button class="tb" title="Línea" onmousedown={(e) => e.preventDefault()} onclick={() => mdRef?.hr()}><Icon name="minus" size={15} /></button>
    </div>

    {#key mdKey}
      <div class="d-body">
        <Milkdown
          value={mdValue}
          readonly={false}
          getRef={(r) => { mdRef = r; captureBase() }}
          onWiki={onWikiState}
          {onWikiKey}
        />
      </div>
    {/key}

    {#if wikiOpen && wiki}
      <div class="wikipop" style="--wx: {wiki.left}px; top: {wiki.bottom + 6}px">
        <div class="wp-head">Enlazar memoria</div>
        {#each wikiHits as h, i (h.id)}
          <button
            class="wp-item"
            class:on={i === wikiActive}
            onmousedown={(e) => e.preventDefault()}
            onclick={() => chooseWiki(i)}
          >
            <span class="wp-ico"><Icon name={typeMeta(h.memory_type).icon} size={13} color={typeColor(h.memory_type)} /></span>
            <span class="wp-title">{h.title}</span>
            <span class="wp-path">{h.path ?? ''}</span>
          </button>
        {/each}
      </div>
    {/if}

    <div class="e-actions">
      <button class="btn-primary" onclick={doSave} disabled={!puedeGuardar}>{saving ? 'Guardando…' : 'Guardar'}</button>
      <button class="btn" onclick={limpiar}>Descartar</button>
      {#if dirty}<span class="modif">● sin guardar</span>{/if}
      <span class="hint">Ctrl+S guarda · crea una memoria nueva</span>
    </div>
  </div>
</div>

<style>
  /* Provisional: mismos valores que el editor de Memoria.svelte, a la espera del diseño. */
  .nueva { padding: 28px 48px; }
  .note-inner { max-width: 1080px; margin: 0 auto; }

  .draft-banner, .aviso {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    font: 12px var(--font-mono); color: var(--dim);
    background: var(--bg2); border: 1px solid var(--border); border-radius: 6px;
    padding: 8px 10px; margin-bottom: 14px;
  }
  .aviso.err { color: var(--warn); border-color: var(--warn); }
  .lnk { font: 12px var(--font-mono); color: var(--accent); padding: 2px 4px; border-radius: 4px; }
  .lnk.dim { color: var(--dim); }

  .e-title { width: 100%; font: 600 24px var(--font-sans); color: var(--ink); background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; outline: none; }
  .e-title:focus { border-color: var(--accent); }
  .e-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .e-row label { display: flex; flex-direction: column; gap: 4px; font: 10px var(--font-mono); letter-spacing: .5px; text-transform: uppercase; color: var(--dim); }
  /* El campo de ruta se fue a PathField.svelte con su propio estilo, asi que aqui solo queda el
     desplegable de tipo. Los valores estan repetidos alli: si cambian, cambian en los dos. */
  .e-row select { font: 13px var(--font-mono); color: var(--ink); background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; outline: none; }
  .e-row select:focus { border-color: var(--accent); }
  .e-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 16px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; font: 11px var(--font-mono); color: var(--ink); background: var(--bg2); border: 1px solid var(--border); border-radius: 4px; padding: 2px 4px 2px 8px; }
  .chip button { color: var(--dim); font: 13px var(--font-mono); padding: 0 4px; border-radius: 3px; }
  .chip button:hover { color: var(--warn); }
  .tag-in { flex: 1 1 120px; min-width: 100px; font: 12px var(--font-mono); color: var(--ink); background: none; border: 1px dashed var(--border); border-radius: 4px; padding: 4px 8px; outline: none; }
  .tag-in:focus { border-color: var(--accent); border-style: solid; }

  .mdbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 6px; margin-bottom: 10px; background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; }
  .tb { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; padding: 0 7px; border-radius: 6px; color: var(--dim); font: 600 12px var(--font-mono); }
  .tb:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
  .tb-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }

  .d-body { font: 14px/1.65 var(--font-sans); color: var(--ink); margin-top: 4px; }

  /* El popover se ancla a la x del cursor (`--wx`), pero NO puede empezar donde le dé la gana: sin
     tope se salía por la derecha y en móvil los títulos quedaban cortados. Medido el 28/08/2026 en
     un viewport de 375 px: arrancaba en 249, medía 338 y terminaba en 587, o sea 212 px fuera.
     El `clamp` lo empuja hacia dentro sin JS ni medir nada: si no cabe alineado con el cursor, se
     pega al margen y se ve entero, que es lo que importa. Cuando la pantalla es tan estrecha que el
     máximo cae por debajo del mínimo, `clamp` devuelve el mínimo, así que degrada a los 8 px.
     El `max-height` va en `dvh` y no en `vh` a propósito: con el teclado abierto en móvil, `vh`
     sigue midiendo la pantalla entera y la lista se metía debajo del teclado. */
  .wikipop {
    position: fixed; z-index: 60; width: min(460px, 90vw);
    left: clamp(8px, var(--wx, 8px), 100vw - min(460px, 90vw) - 8px);
    max-height: min(46dvh, 320px); overflow-y: auto; overscroll-behavior: contain;
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, .35); padding: 4px;
  }
  .wp-head { font: 10px var(--font-mono); letter-spacing: .5px; text-transform: uppercase; color: var(--dim); padding: 5px 8px 4px; }
  .wp-item { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 6px 8px; border-radius: 6px; color: var(--ink); min-width: 0; }
  .wp-item:hover, .wp-item.on { background: var(--sel); }
  .wp-ico { flex: 0 0 auto; display: inline-flex; }
  .wp-title { font: 13px var(--font-sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto; }
  .wp-path { font: 10px var(--font-mono); color: var(--dim); flex: 0 0 auto; }

  .e-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border); }
  .btn-primary { font: 13px var(--font-mono); color: #fff; background: var(--accent); border-radius: 6px; padding: 7px 16px; }
  .btn-primary:disabled { opacity: .6; }
  .btn { font: 13px var(--font-mono); color: var(--dim); border: 1px solid var(--border); border-radius: 6px; padding: 7px 14px; }
  .btn:hover { color: var(--ink); border-color: var(--accent); }
  .modif { font: 11px var(--font-mono); color: var(--warn); }
  .hint { font: 11px var(--font-mono); color: var(--dim); margin-left: auto; }

  @media (max-width: 600px) {
    .nueva { padding: 22px 18px; }
    .e-title { font-size: 20px; }
    .note-inner { max-width: none; }

    /* Dos líneas para el título del candidato, y aquí sí importa cuál es el corpus: muchísimas
       memorias empiezan por "Naeth · " o "CENIT · ", así que a una línea y 336 px de ancho varios
       candidatos se ven EXACTAMENTE IGUAL y la lista deja de servir para elegir. Con dos, se
       distinguen. En escritorio sobra: ahí caben enteros. */
    .wp-item { align-items: flex-start; }
    .wp-title {
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.35;
    }
    .wp-ico, .wp-path { margin-top: 2px; }
  }
</style>
