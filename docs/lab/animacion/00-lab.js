/**
 * @fileoverview Controles comunes del laboratorio de animación: velocidad, reduced-motion y reset.
 *
 * Cada lab lo carga después de `00-medidor.js` y llama a `lab.init()`. Pinta la barra de controles
 * dentro de `.barra` (si existe) y expone `lab.speed` (multiplicador, 0,25 a 4), `lab.reduced`
 * (true si el interruptor está puesto O si el sistema pide reduced-motion de verdad) y
 * `lab.onSpeed(cb)` para que el lab propague la velocidad a su motor (`playbackRate` en WAAPI y
 * Anime.js, `animation-duration` en CSS, el paso en un bucle a mano).
 *
 * El interruptor de reduced-motion es SIMULADO: pone `data-reduced` en `<html>`. No cambia la media
 * query real, así que un lab que quiera probar la vía CSS (`@media (prefers-reduced-motion)`) tiene
 * que activarlo en el sistema o en el panel de rendering de Chromium; el interruptor sirve para la
 * vía JS, que es la que hace falta en Anime.js (condición 3 del 24/08/2026).
 *
 * @module lab
 */

const lab = (() => {
  const listeners = [];
  const state = {
    speed: 1,
    forced: false,
    system: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  /**
   * Pinta la barra de controles y arranca el medidor.
   *
   * Args:
   *   opts: `{ speed: false }` quita el deslizador de velocidad en los labs donde no aplica (CSS
   *     `transition` no tiene playbackRate sin WAAPI); `{ meter: false }` no arranca el medidor.
   *
   * Returns:
   *   Nada.
   */
  function init(opts = {}) {
    const barra = document.querySelector('.barra');
    if (barra) {
      if (opts.speed !== false) {
        const l = document.createElement('label');
        l.innerHTML = 'velocidad <input type="range" min="-2" max="2" step="1" value="0"> <output>1×</output>';
        const input = l.querySelector('input'); const out = l.querySelector('output');
        input.addEventListener('input', () => {
          state.speed = 2 ** Number(input.value);
          out.textContent = state.speed + '×';
          listeners.forEach((cb) => cb(state.speed));
        });
        barra.appendChild(l);
      }
      const r = document.createElement('label');
      r.innerHTML = '<input type="checkbox"> reduced-motion' + (state.system ? ' <span class="mono">(el sistema ya lo pide)</span>' : '');
      const chk = r.querySelector('input');
      chk.addEventListener('change', () => {
        state.forced = chk.checked;
        document.documentElement.toggleAttribute('data-reduced', lab.reduced);
      });
      barra.appendChild(r);
      const b = document.createElement('button');
      b.textContent = 'reset medidor';
      b.addEventListener('click', () => window.Meter && Meter.reset());
      barra.appendChild(b);
    }
    if (state.system) document.documentElement.toggleAttribute('data-reduced', true);
    if (opts.meter !== false && window.Meter) Meter.start();
    const ua = navigator.userAgentData?.brands?.map((b) => `${b.brand} ${b.version}`).join(', ') || navigator.userAgent;
    const foot = document.createElement('div');
    foot.className = 'notas mono';
    foot.style.marginTop = '24px';
    foot.textContent = `navegador: ${ua} · ${window.innerWidth}×${window.innerHeight} · dpr ${devicePixelRatio}`;
    document.body.appendChild(foot);
  }

  return {
    init,
    onSpeed(cb) { listeners.push(cb); },
    get speed() { return state.speed; },
    get reduced() { return state.forced || state.system; },
  };
})();

window.lab = lab;
