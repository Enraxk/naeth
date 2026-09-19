<!-- Naeth (c) 2026 Eneko Lapuente Bascuñana. Naeth License 1.0: noncommercial use only, with attribution.
     No AI training; text and data mining rights reserved. https://github.com/Enraxk/naeth/blob/main/LICENSE
     Banco de svelte/transition, svelte/animate y svelte/motion. Ver motion.ts para la pregunta. -->
<script lang="ts">
  import { fly, fade } from 'svelte/transition'
  import { flip } from 'svelte/animate'
  import { Spring, Tween } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import type { TransitionConfig } from 'svelte/transition'

  // 1 · transition: bidireccional. Pulsar dos veces rápido tiene que invertir desde donde está.
  let visible = $state(false)

  // 2 · animate:flip: la pila se reordena y cada lomo va de su sitio viejo al nuevo por transform.
  let libros = $state(['Yogin Website', 'Yogin API', 'GridWatch', 'Naeth', 'CENIT'])
  function saca(nombre: string) {
    libros = [...libros.filter((l) => l !== nombre), nombre]
  }
  function baraja() {
    libros = [...libros].sort(() => Math.random() - 0.5)
  }

  // 3 · Spring y Tween: valores que se persiguen. El muelle sigue al ratón; el Tween cuenta.
  const muelle = new Spring({ x: 40, y: 40 }, { stiffness: 0.15, damping: 0.5 })
  const contador = new Tween(0, { duration: 840, easing: cubicOut })
  function sigue(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    muelle.target = { x: e.clientX - r.left - 20, y: e.clientY - r.top - 20 }
  }

  // 4 · transición propia: `css` (el navegador genera keyframes y va por WAAPI) frente a `tick`
  // (Svelte llama a la función en cada fotograma por rAF). Mismo gesto, dos vías.
  function girar(node: Element, { duration = 840, via = 'css' as 'css' | 'tick' } = {}): TransitionConfig {
    const el = node as HTMLElement
    if (via === 'css') {
      return { duration, easing: cubicOut, css: (t, u) => `transform: rotateY(${u * 90}deg) translateX(${u * 60}px); opacity: ${t}` }
    }
    return { duration, easing: cubicOut, tick: (t, u) => { el.style.transform = `rotateY(${u * 90}deg) translateX(${u * 60}px)`; el.style.opacity = String(t) } }
  }
  let via = $state<'css' | 'tick'>('css')
  let cara = $state(false)

  // Medidor mínimo: fotogramas perdidos en los últimos 5 s (el de docs/lab no se puede importar
  // desde aquí: Vite no sirve ficheros fuera de naeth/web).
  let perdidos = $state(0)
  let hz = $state(0)
  $effect(() => {
    let last = 0
    let period = 0
    const muestras: number[] = []
    const ventana: { t: number; lost: number }[] = []
    let id = 0
    const tick = (t: number) => {
      if (last) {
        const dt = t - last
        if (!period) {
          muestras.push(dt)
          if (t > 1000 && muestras.length > 30) {
            period = [...muestras].sort((a, b) => a - b)[Math.floor(muestras.length / 2)]
            hz = Math.round(1000 / period)
          }
        } else {
          ventana.push({ t, lost: dt > period * 1.5 ? Math.round(dt / period) - 1 : 0 })
          while (ventana.length && ventana[0].t < t - 5000) ventana.shift()
          perdidos = ventana.reduce((n, f) => n + f.lost, 0)
        }
      }
      last = t
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  })

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
</script>

<h1>svelte/transition · svelte/animate · svelte/motion <small>Svelte 5.56, sin librería</small></h1>
<p class="dim">Pregunta del 24/08/2026: ¿basta con lo que trae Svelte antes de ir a Anime.js? Cada bloque aísla una cosa. Medidor: <b class="mono">{hz || '…'} Hz · perdidos 5 s: {perdidos}</b>. <code>prefers-reduced-motion</code> del sistema: <b>{reduced}</b> (Svelte no lo mira solo: lo tiene que mirar el componente).</p>

<section>
  <h2>1 · <code>transition:fly</code> en un <code>{'{#if}'}</code>, interrumpible</h2>
  <p class="dim">Pulsa dos veces seguidas. La transición es bidireccional: al invertir a mitad toma el estado actual (Svelte lo hace con la posición <code>t</code> de la transición viva). Es una <code>css</code>: el navegador la ejecuta como keyframes (WAAPI).</p>
  <button onclick={() => (visible = !visible)}>mostrar / ocultar</button>
  <div class="escena" style="height:120px">
    {#if visible}
      <div class="tarjeta" transition:fly={{ x: 120, duration: 840, easing: cubicOut }}>Tarjeta con <code>fly</code>: x 120, 840 ms, cubicOut.</div>
    {/if}
  </div>
</section>

<section>
  <h2>2 · <code>animate:flip</code>: la pila se recoloca</h2>
  <p class="dim">Pulsa un lomo: se va al final y los demás bajan a ocupar su sitio. <code>flip</code> mide la posición antes y después y anima con <code>transform</code> (First, Last, Invert, Play), no con <code>top</code>: cumple la regla de los 144 Hz. Es lo mismo que <code>createLayout</code> de Anime.js promete para la pila (lab animejs/14), aquí a 0 KB.</p>
  <button onclick={baraja}>barajar</button>
  <div class="escena pila">
    {#each libros as libro (libro)}
      <button class="lomo" class:naeth={libro === 'Naeth'} animate:flip={{ duration: 560, easing: cubicOut }} onclick={() => saca(libro)}>{libro}</button>
    {/each}
  </div>
</section>

<section>
  <h2>3 · <code>Spring</code> sigue al ratón, <code>Tween</code> cuenta</h2>
  <p class="dim">Mueve el ratón por la escena: el punto lo persigue con un muelle (<code>stiffness</code> 0,15, <code>damping</code> 0,5, los parámetros son adimensionales en Svelte, no los de Anime.js). El número va con <code>Tween</code> de 840 ms. Los dos son valores en JS: se escriben en el DOM cada fotograma por rAF, así que van por el hilo principal.</p>
  <button onclick={() => (contador.target = contador.target ? 0 : 182)}>contar hasta 182</button>
  <div class="escena" style="height:200px" onmousemove={sigue} role="presentation">
    <div class="punto" style="transform: translate({muelle.current.x}px, {muelle.current.y}px)"></div>
    <div class="cifra mono">{Math.round(contador.current)} páginas</div>
  </div>
</section>

<section>
  <h2>4 · transición propia: <code>css</code> frente a <code>tick</code></h2>
  <p class="dim">El mismo giro de 90° con salida a la derecha. Con <code>css</code>, Svelte muestrea la función y crea una animación de keyframes que corre fuera del hilo principal; con <code>tick</code> llama a tu función en cada fotograma. Ocupa el hilo (botón) y compara.</p>
  <label><input type="radio" bind:group={via} value="css" /> css</label>
  <label><input type="radio" bind:group={via} value="tick" /> tick</label>
  <button onclick={() => (cara = !cara)}>girar</button>
  <button onclick={() => { const fin = performance.now() + 3000; const b = () => { const t = performance.now() + 40; while (performance.now() < t) {} if (performance.now() < fin) setTimeout(b, 10) }; b() }}>ocupar el hilo 3 s</button>
  <div class="escena" style="height:160px; perspective: 1200px">
    {#if cara}
      <div class="tapa" transition:girar={{ via }}>Naeth</div>
    {/if}
  </div>
</section>

<style>
  h1 { font-size: 18px; margin: 0 0 4px; } h1 small { color: #8a929e; font-weight: 400; margin-left: 8px; }
  h2 { font-size: 14px; color: #8a929e; text-transform: uppercase; letter-spacing: .04em; margin: 28px 0 6px; }
  .dim { color: #8a929e; max-width: 90ch; margin: 4px 0 10px; }
  .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
  code { color: #5db0ff; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 12.5px; }
  button { background: #2a2d31; color: #e6e8eb; border: 1px solid #3a3e44; border-radius: 6px; padding: 5px 12px; font: inherit; cursor: pointer; margin-right: 6px; }
  label { color: #8a929e; margin-right: 10px; }
  .escena { position: relative; background: #1c1d1f; border-radius: 10px; overflow: hidden; margin-top: 10px; }
  .tarjeta { position: absolute; left: 24px; top: 30px; padding: 12px 14px; border-radius: 10px; background: #2a2d31; }
  .pila { display: flex; flex-direction: column-reverse; gap: 4px; padding: 16px; width: 260px; }
  .lomo { text-align: left; height: 28px; border-radius: 3px; background: #2b3340; border: none; margin: 0; padding-left: 10px; }
  .lomo.naeth { background: #1c2e45; }
  .punto { position: absolute; left: 0; top: 0; width: 40px; height: 40px; border-radius: 50%; background: #5db0ff; pointer-events: none; }
  .cifra { position: absolute; right: 20px; bottom: 14px; font-size: 28px; color: #e6e8eb; }
  .tapa { position: absolute; left: 40px; top: 20px; width: 90px; height: 120px; border-radius: 3px 8px 8px 3px; background: #2b3340; display: grid; place-items: center; transform-origin: 0 50%; }
</style>
