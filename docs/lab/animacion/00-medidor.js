/**
 * @fileoverview Medidor de fotogramas para las páginas del laboratorio de animación.
 *
 * Mide lo que importa a 144 Hz: cuántos fotogramas se pierden, no cuántos fps de media hay. Un
 * contador de fps clásico a 144 puede marcar 140 y esconder un tirón de 40 ms cada dos segundos,
 * que es justo lo que se nota en una transición. Aquí se cuentan los fotogramas cuyo intervalo
 * pasa de 1,5 veces el periodo del monitor (a 144 Hz, 10,4 ms) y se guarda el peor.
 *
 * El periodo se estima solo, con la mediana de los intervalos del primer segundo: no hay API que
 * diga el refresco del monitor. Si Chromium trae Long Animation Frames (Chromium 123+), también se
 * cuentan los fotogramas largos del hilo principal (más de 50 ms), que es la medida oficial.
 *
 * Uso: `<script src="../00-medidor.js"></script>` y luego `Meter.start()`. Para medir solo una
 * animación, `Meter.begin('sacar')` antes y `Meter.end()` después: imprime el tramo en el panel y lo
 * devuelve como objeto. Regla del 18/09/2026 (anexo M de la discovery de CDA): se mide, no se supone.
 *
 * @module medidor
 */

/* global PerformanceObserver */

const Meter = (() => {
  const state = {
    period: null,        // ms por fotograma, estimado
    samples: [],         // intervalos del primer segundo, para la mediana
    last: 0,
    frames: 0,
    dropped: 0,          // fotogramas perdidos en la ventana de 5 s
    worst: 0,            // peor intervalo en la ventana
    window: [],          // {t, dt} de los últimos 5 s
    longFrames: 0,       // Long Animation Frames vistos
    longWorst: 0,
    segment: null,       // tramo en curso de begin/end
    el: null,
    running: false,
  };

  /**
   * Crea el panel fijo en la esquina superior derecha y arranca el bucle de medida.
   *
   * Idempotente: llamarlo dos veces no crea dos paneles ni dos bucles.
   *
   * Returns:
   *   Nada.
   */
  function start() {
    if (state.running) return;
    state.running = true;
    state.el = document.createElement('div');
    state.el.id = 'meter';
    state.el.setAttribute('aria-live', 'off');
    document.body.appendChild(state.el);
    if (typeof PerformanceObserver !== 'undefined' &&
        PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')) {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          state.longFrames += 1;
          if (e.duration > state.longWorst) state.longWorst = e.duration;
          if (state.segment) {
            state.segment.longFrames += 1;
            if (e.duration > state.segment.longWorst) state.segment.longWorst = e.duration;
          }
        }
      });
      po.observe({ type: 'long-animation-frame', buffered: false });
    } else {
      state.longFrames = null;
    }
    requestAnimationFrame(tick);
  }

  function tick(t) {
    if (state.last) {
      const dt = t - state.last;
      state.frames += 1;
      if (state.period === null) {
        state.samples.push(dt);
        if (t > 1000 && state.samples.length > 30) {
          const s = [...state.samples].sort((a, b) => a - b);
          state.period = s[Math.floor(s.length / 2)];
        }
      } else {
        const lost = Math.max(0, Math.round(dt / state.period) - 1);
        const isDrop = dt > state.period * 1.5;
        state.window.push({ t, dt, lost: isDrop ? lost : 0 });
        while (state.window.length && state.window[0].t < t - 5000) state.window.shift();
        state.dropped = state.window.reduce((n, f) => n + f.lost, 0);
        state.worst = state.window.reduce((m, f) => Math.max(m, f.dt), 0);
        if (state.segment) {
          state.segment.frames += 1;
          if (isDrop) state.segment.dropped += lost;
          if (dt > state.segment.worst) state.segment.worst = dt;
        }
      }
    }
    state.last = t;
    if (state.frames % 12 === 0) paint();
    requestAnimationFrame(tick);
  }

  function paint() {
    if (!state.el) return;
    const hz = state.period ? (1000 / state.period).toFixed(0) : '…';
    const fps = state.window.length
      ? (state.window.length / ((state.window.at(-1).t - state.window[0].t) / 1000 || 1)).toFixed(0)
      : '…';
    const loaf = state.longFrames === null
      ? 'LoAF: n/d'
      : `LoAF: ${state.longFrames}${state.longWorst ? ' · peor ' + state.longWorst.toFixed(0) + ' ms' : ''}`;
    const seg = state.segment
      ? `\n▶ ${state.segment.name}: ${state.segment.frames} fot · ${state.segment.dropped} perdidos · peor ${state.segment.worst.toFixed(1)} ms`
      : (state.lastSegment ? `\n■ ${state.lastSegment}` : '');
    state.el.textContent =
      `${hz} Hz · ${fps} fps\nperdidos 5 s: ${state.dropped} · peor ${state.worst.toFixed(1)} ms\n${loaf}${seg}`;
    state.el.classList.toggle('bad', state.dropped > 0 || (state.segment && state.segment.dropped > 0));
  }

  /**
   * Abre un tramo de medida con nombre; se cierra con `end()`.
   *
   * Returns:
   *   Nada.
   */
  function begin(name) {
    state.segment = { name, frames: 0, dropped: 0, worst: 0, longFrames: 0, longWorst: 0, t0: performance.now() };
  }

  /**
   * Cierra el tramo abierto con `begin()` y devuelve su resumen.
   *
   * Returns:
   *   Objeto con `name`, `ms` (duración real), `frames`, `dropped`, `worst` (ms), `longFrames`,
   *   `longWorst`, o `null` si no había tramo abierto.
   */
  function end() {
    const s = state.segment;
    if (!s) return null;
    s.ms = performance.now() - s.t0;
    state.segment = null;
    state.lastSegment =
      `${s.name}: ${s.ms.toFixed(0)} ms · ${s.frames} fot · ${s.dropped} perdidos · peor ${s.worst.toFixed(1)} ms` +
      (s.longFrames ? ` · LoAF ${s.longFrames}` : '');
    paint();
    return s;
  }

  /** Pone a cero la ventana de 5 s y los LoAF acumulados; no toca el periodo estimado. */
  function reset() {
    state.window = [];
    state.dropped = 0;
    state.worst = 0;
    if (state.longFrames !== null) { state.longFrames = 0; state.longWorst = 0; }
    state.lastSegment = null;
    paint();
  }

  return { start, begin, end, reset, get period() { return state.period; } };
})();

window.Meter = Meter;
