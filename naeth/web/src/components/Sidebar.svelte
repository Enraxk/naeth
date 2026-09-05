<script lang="ts">
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'
  import { data, revealInTree, collapseAuto, untrackAuto } from '../lib/data.svelte'
  import { collapsed, saveCollapsed, prefs, setSort, setSide } from '../lib/prefs.svelte'
  import { buildTree } from '../lib/tree'
  import { route, navigate } from '../lib/router.svelte'
  import { ui, closeDrawer, resalte, resaltar, resaltarGrupo, entrarArbol } from '../lib/ui.svelte'
  import { typeMeta, typeColor, projMeta, projColor } from '../lib/colors'
  import { fmtShort } from '../lib/format'

  function openMem(id: string) {
    navigate('memoria', id)
    closeDrawer()
  }

  const projects = $derived(buildTree(data.tree ?? [], prefs.sort))

  const SORT_LABEL = { az: 'A-Z', 'date-desc': 'Nuevas', 'date-asc': 'Antiguas' } as const
  const SORT_NEXT = { az: 'date-desc', 'date-desc': 'date-asc', 'date-asc': 'az' } as const

  /** Todo lo que cuelga de una carpeta, que es lo que se enciende en el grafo al senalarla. */
  const idsDe = (leaves: { id: string }[]) => leaves.map((m) => m.id)
  const idsProy = (p: { subtopics: { leaves: { id: string }[] }[] }) =>
    p.subtopics.flatMap((s) => idsDe(s.leaves))

  /**
   * Lo que se senala en el GRAFO se busca aqui: se abre su rama y se lleva a la vista.
   *
   * Sin esto la fila se encendia igual, pero si estaba dentro de una carpeta cerrada o fuera del
   * scroll no habia forma de verla, asi que la mitad del hilo entre las dos vistas solo funcionaba
   * en una direccion.
   */
  $effect(() => {
    const id = resalte.desde === 'grafo' ? resalte.id : null
    if (!id) return
    const row = (data.tree || []).find((r) => r.id === id)
    revealInTree(row?.path ?? null)
    tick().then(() => {
      const el = document.querySelector(`#tree [data-id="${id}"]`) as HTMLElement | null
      el?.scrollIntoView({ block: 'nearest' })
    })
  })

  function toggle(key: string) {
    untrackAuto(key)
    if (collapsed.has(key)) collapsed.delete(key)
    else collapsed.add(key)
    saveCollapsed()
  }

  // reveal-in-tree al abrir memoria; collapseAuto al volver a Inicio
  $effect(() => {
    if (route.view === 'inicio') { collapseAuto(); return }
    if (route.view === 'memoria' && route.id) {
      const row = (data.tree || []).find((r) => r.id === route.id)
      revealInTree(row?.path ?? null)
      const id = route.id
      tick().then(() => {
        const el = document.querySelector(`#tree [data-id="${id}"]`) as HTMLElement | null
        el?.scrollIntoView({ block: 'nearest' })
      })
    }
  })

  // resizer (pointer = ratón + táctil)
  let dragging = $state(false)
  function onDown(e: PointerEvent) {
    dragging = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  function onMove(e: PointerEvent) {
    if (!dragging) return
    prefs.side = Math.max(200, Math.min(560, e.clientX))
  }
  function onUp() {
    if (!dragging) return
    dragging = false
    setSide(prefs.side)
  }
</script>

<!-- El apagado del resto de la aplicacion se enciende AL ENTRAR EN EL ARBOL y no fila por fila.
     Por fila daba un parpadeo en cada salto, y el ojo lee ese parpadeo como que algo ha cambiado
     en los datos. Al entrar y salir de la zona, la aplicacion baja la voz una vez y la recupera
     una vez. -->
<nav
  class="sidebar"
  class:open={ui.drawer}
  aria-label="Árbol de memorias"
  onpointerenter={() => entrarArbol(true)}
  onpointerleave={() => entrarArbol(false)}
>
  <div class="tools">
    <button class="sortbtn" title="Cambiar orden" onclick={() => setSort(SORT_NEXT[prefs.sort])}>
      <Icon name="arrow-up-down" size={13} /><span>{SORT_LABEL[prefs.sort]}</span>
    </button>
  </div>

  <!-- Sin `role="tree"`, retirado el 22/08/2026. Lo declaraba, pero sus hijos son <div> y <button>:
       ni un `treeitem`, ni `aria-expanded` en los nodos que colapsan, ni `aria-selected` en la hoja
       activa, ni navegacion con flechas. Un lector de pantalla anunciaba un arbol y luego no
       encontraba ningun item, que es peor que no anunciar nada. Lo que es de verdad hoy es una
       lista de botones, y asi queda hasta que el rol se implemente entero. El aria-label del <nav>
       se queda: describe el contenido sin prometer una semantica que no se cumple. -->
  <div id="tree" class="tree"
       class:senalando={route.view === 'grafo' && (resalte.id !== null || !!resalte.grupo)}>
    {#each projects as p (p.proj)}
      {@const pKey = 'p:' + p.proj}
      {@const pc = projColor(p.proj)}
      <div class="group" class:collapsed={collapsed.has(pKey)}>
        <button class="row proj" onclick={() => toggle(pKey)}
                onpointerenter={() => resaltarGrupo(idsProy(p), p.proj)}>
          <span class="chev"><Icon name="chevron-down" size={13} color="var(--dim)" /></span>
          <span class="ico"><Icon name={projMeta(p.proj).icon} size={13} color={pc} /></span>
          <span class="label">{p.proj}</span>
          <span class="rdate">{fmtShort(p.mod)}</span>
        </button>
        <div class="children indent">
          {#each p.subtopics as s (s.subtopic)}
            <!-- La clave sigue siendo "o:": es lo que hay guardado en localStorage bajo
                 `naeth-collapsed`. Cambiarla olvidaría los colapsos que Eneko ya tiene abiertos. -->
            {@const sKey = 'o:' + p.proj + '/' + s.subtopic}
            <div class="group" class:collapsed={collapsed.has(sKey)}>
              <button class="row subtopic" onclick={() => toggle(sKey)}
                      onpointerenter={() => resaltarGrupo(idsDe(s.leaves), p.proj + '/' + s.subtopic)}>
                <span class="chev"><Icon name="chevron-down" size={13} color="var(--dim)" /></span>
                <span class="ico"><Icon name="folder" size={13} color={pc} /></span>
                <span class="label">{s.subtopic}</span>
                <span class="rdate">{fmtShort(s.mod)}</span>
              </button>
              <div class="children indent">
                {#each s.leaves as m (m.id)}
                  <!-- `title` con el titulo entero: `.label` recorta con ellipsis y en este corpus
                       los titulos son largos, asi que sin esto no habia forma de leerlo sin abrir
                       la memoria. -->
                  <button
                    class="row leaf"
                    class:sel={route.view === 'memoria' && route.id === m.id}
                    class:eco={resalte.id === m.id}
                    class:enGrupo={!!resalte.grupo?.includes(m.id)}
                    data-id={m.id}
                    title={m.title || '(sin título)'}
                    onclick={() => openMem(m.id)}
                    onpointerenter={() => resaltar(m.id, 'arbol')}
                  >
                    <span class="ico"><Icon name={typeMeta(m.memory_type).icon} size={13} color={typeColor(m.memory_type)} /></span>
                    <span class="label">{m.title || '(sin título)'}</span>
                    <span class="rdate">{fmtShort(m.created_at)}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div
    class="resizer"
    class:drag={dragging}
    role="separator"
    aria-orientation="vertical"
    title="Arrastra para redimensionar"
    onpointerdown={onDown}
    onpointermove={onMove}
    onpointerup={onUp}
  ></div>
</nav>

<style>
  .sidebar { background: var(--bg2); border-right: 1px solid var(--border); position: relative; display: flex; flex-direction: column; min-height: 0; }
  .tools { display: flex; justify-content: flex-end; padding: 6px 8px 0; flex: 0 0 auto; }
  .sortbtn { display: flex; align-items: center; gap: 6px; font: 10px var(--font-mono); letter-spacing: .5px; color: var(--dim); text-transform: uppercase; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border); }
  .sortbtn:hover { color: var(--ink); border-color: var(--accent); }
  .tree { overflow: auto; padding: 6px; flex: 1 1 auto; }
  .row { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 6px; width: 100%; text-align: left; color: var(--ink); line-height: 1.3; }
  .row:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
  /* Cambia de forma: el chevron gira sin ocupar mas ni recolocar nada a su alrededor. */
  .chev { flex: 0 0 auto; color: var(--dim); transition: transform var(--t-fast); display: inline-flex; }
  .group.collapsed > .row .chev { transform: rotate(-90deg); }
  .group.collapsed > .children { display: none; }
  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rdate { display: none; margin-left: auto; flex: 0 0 auto; padding-left: 8px; font: 10px var(--font-mono); color: var(--dim); white-space: nowrap; }
  .row:hover .rdate { display: block; }
  .row.proj .label { font: 600 12px var(--font-mono); }
  .row.subtopic .label { font: 12px var(--font-mono); color: var(--dim); }
  .row.leaf .label { font: 13px var(--font-sans); flex: 1 1 auto; }
  .row.leaf.sel { background: var(--sel); box-shadow: inset 2px 0 0 var(--accent); }
  /* EL ECO DEL GRAFO. Cuando el raton pasa por un nodo del grafo, su fila se enciende aqui. Es
     mas tenue que `.sel` a proposito: aquello dice "estas aqui" y esto dice solo "es esta". */
  .row.leaf.eco { box-shadow: inset 2px 0 0 var(--accent); }
  .row.leaf.eco .label { color: var(--accent); }
  /* MIENTRAS SE SENALA ALGO, EL RESTO DEL ARBOL SE APAGA. No se esconde ni se mueve: baja de
     intensidad, que es lo que hace que el ojo vaya solo a lo senalado sin perder el mapa de
     donde estaba. El fundido se queda con `prefers-reduced-motion` siguiendo la politica de
     app.css: lo que esa preferencia retira es el desplazamiento, no un cambio de intensidad. */
  .tree.senalando .row:not(.eco):not(.enGrupo) { opacity: .38; }
  .tree .row { transition: opacity var(--t-fast); }
  .children { display: flex; flex-direction: column; gap: 1px; }
  .indent { margin-left: 16px; border-left: 1px solid var(--border); padding-left: 6px; }
  .ico { flex: 0 0 auto; display: inline-flex; }
  .resizer { position: absolute; top: 0; right: -3px; width: 6px; height: 100%; z-index: 6; cursor: col-resize; }
  .resizer.drag { background: var(--accent); opacity: .45; }

  /* táctil: filas y botón de orden más cómodos */
  @media (pointer: coarse) {
    .row { padding: 9px 8px; }
    .sortbtn { padding: 7px 10px; }
    .rdate { display: block; } /* en táctil no hay hover: mostrar la fecha */
  }

  /* móvil: la sidebar es un cajón deslizante sobre el área de contenido */
  @media (max-width: 860px) {
    /* Entra o sale: el cajon pasa a estar y cambia lo que tienes disponible. `--t-mid` y no
       `--t-over` porque viene de un borde de la pantalla (ver el porque en app.css). */
    .sidebar { position: absolute; left: 0; top: 0; bottom: 0; width: min(82vw, 320px); z-index: 41; transform: translateX(-100%); transition: transform var(--t-mid); box-shadow: 8px 0 28px rgba(0, 0, 0, .4); }
    .sidebar.open { transform: translateX(0); }
    .resizer { display: none; }
  }
</style>
