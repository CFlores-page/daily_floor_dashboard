/* DÍA DE MUERTOS / V6 — STAGING DECORATIVE LAYER ONLY.
   Add AFTER js/themes/ddm_papel.js in index.html (with defer).
   This script reads no sales data and does not modify dashboard.js.
*/
(() => {
  'use strict';
  const ART_ROOT = './assets/themes/dia_de_muertos/cempasuchil/';

  function init() {
    const panel = document.querySelector('.chart-panel');
    if (!panel || panel.querySelector('.ddm-lights')) return;

    // The panteón painting already contains candles; add light flicker, not
    // more candle illustrations stacked on the painting.
    const lights = document.createElement('div');
    lights.className = 'ddm-lights';
    lights.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 4; i++) {
      const lamp = document.createElement('span');
      lamp.className = 'ddm-lamp';
      lights.appendChild(lamp);
    }
    panel.appendChild(lights);

    // Fully predictable scatter across reloads and screens. A handful of
    // petals appear close to the viewer; most float behind the live bars.
    let seed = 20261027;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    function makeLayer(kind, count) {
      const layer = document.createElement('div');
      layer.className = `ddm-petal-layer ddm-petal-layer--${kind}`;
      layer.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < count; i++) {
        const img = document.createElement('img');
        img.className = 'ddm-petal';
        img.alt = '';
        img.decoding = 'async';
        const number = 1 + Math.floor(random() * 6);
        img.src = `${ART_ROOT}petal_${String(number).padStart(2, '0')}.webp`;
        const x = 3 + random() * 93;
        const dx = -90 + random() * 180;
        const size = kind === 'front' ? 21 + random() * 14 : 12 + random() * 13;
        const seconds = kind === 'front' ? 17 + random() * 9 : 24 + random() * 15;
        img.style.setProperty('--petal-x', `${x.toFixed(2)}%`);
        img.style.setProperty('--petal-mid-x', `${(dx * .43).toFixed(1)}px`);
        img.style.setProperty('--petal-end-x', `${dx.toFixed(1)}px`);
        img.style.setProperty('--petal-size', `${size.toFixed(1)}px`);
        img.style.setProperty('--petal-duration', `${seconds.toFixed(2)}s`);
        img.style.setProperty('--petal-delay', `${(-random() * seconds).toFixed(2)}s`);
        img.style.setProperty('--petal-opacity', kind === 'front' ? '.72' : '.42');
        img.addEventListener('error', () => img.remove(), { once: true });
        layer.appendChild(img);
      }
      panel.appendChild(layer);
    }

    makeLayer('back', 13);
    makeLayer('front', 4);

    // Keep falling distance synced to chart height if Live Server viewport
    // changes. Uses one observer instead of per-frame JavaScript animation.
    const measure = () => {
      const travel = Math.max(panel.clientHeight + 110, 250);
      panel.style.setProperty('--ddm-half-travel', `${Math.round(travel * .5)}px`);
      panel.style.setProperty('--ddm-full-travel', `${travel}px`);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(panel);
    } else {
      window.addEventListener('resize', measure, { passive: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
