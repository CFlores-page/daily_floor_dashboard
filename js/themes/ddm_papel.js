/* DDM V13 — HEADER PAPEL PICADO + CEMPASÚCHIL
   Replace the existing js/themes/ddm_papel.js with this file.
   Purely decorative: never touches dashboard.js or sales data.
*/
(() => {
  'use strict';

  const PAPEL = './assets/themes/dia_de_muertos/papel_picado/';
  const PETALS = './assets/themes/dia_de_muertos/cempasuchil/';
  const FILES = [1, 4, 3, 6, 5, 2, 7, 8];
  const depth = ['mid', 'near', 'far', 'mid', 'near', 'far', 'near', 'mid'];

  function init() {
    const header = document.querySelector('.dashboard > .header');
    if (!header) return;

    // Remove the old chart strand if Live Server injected it earlier.
    document.querySelectorAll('.chart-panel .ddm-papel--chart').forEach(el => el.remove());
    if (header.querySelector('.ddm-papel--header.ddm-papel--v13')) return;
    header.querySelectorAll('.ddm-papel--header').forEach(el => el.remove());

    const scene = document.createElement('div');
    scene.className = 'ddm-papel ddm-papel--header ddm-papel--v13';
    scene.setAttribute('aria-hidden', 'true');

    const NS = 'http://www.w3.org/2000/svg';
    const rope = document.createElementNS(NS, 'svg');
    rope.classList.add('ddm-papel__rope');
    rope.setAttribute('viewBox', '0 0 1000 36');
    rope.setAttribute('preserveAspectRatio', 'none');
    const curve = document.createElementNS(NS, 'path');
    curve.setAttribute('d', 'M0 2 Q500 39 1000 2');
    rope.appendChild(curve);
    scene.appendChild(rope);

    const row = document.createElement('div');
    row.className = 'ddm-papel__flags';
    FILES.forEach((n, i) => {
      const flag = document.createElement('span');
      flag.className = `ddm-papel__flag ddm-papel__flag--${depth[i]}`;
      flag.style.setProperty('--sag', `${(2 + 17 * Math.sin(Math.PI * i / (FILES.length - 1))).toFixed(1)}px`);
      flag.style.setProperty('--wind-duration', `${(5.8 + ((i * 3) % 5) * 0.65).toFixed(2)}s`);
      flag.style.setProperty('--wind-delay', `${(-i * 0.72).toFixed(2)}s`);
      const img = document.createElement('img');
      img.src = `${PAPEL}papel_${String(n).padStart(2, '0')}.webp`;
      img.alt = '';
      img.decoding = 'async';
      flag.appendChild(img);
      row.appendChild(flag);
    });
    scene.appendChild(row);
    header.appendChild(scene);

    // A sparse foreground layer: only 7 small, drifting cempasúchil petals.
    const layer = document.createElement('div');
    layer.className = 'ddm-header-petals';
    layer.setAttribute('aria-hidden', 'true');
    const settings = [
      [8,  -17, 13, 23, -10, 1],
      [28,  22, 18, 28,  -3, 4],
      [42, -16, 12, 20, -13, 2],
      [57,  23, 16, 26,  -8, 5],
      [73, -26, 13, 24, -16, 3],
      [84,  12, 19, 31, -21, 6],
      [95, -15, 14, 25,  -4, 1]
    ];
    settings.forEach(([x, dx, size, duration, delay, file], i) => {
      const petal = document.createElement('img');
      petal.className = 'ddm-header-petal';
      petal.src = `${PETALS}petal_${String(file).padStart(2, '0')}.webp`;
      petal.alt = '';
      petal.decoding = 'async';
      petal.style.setProperty('--x', `${x}%`);
      petal.style.setProperty('--dx', `${dx}px`);
      petal.style.setProperty('--size', `${size}px`);
      petal.style.setProperty('--duration', `${duration}s`);
      petal.style.setProperty('--delay', `${delay}s`);
      petal.style.setProperty('--petal-alpha', i % 3 === 0 ? '.44' : '.29');
      petal.addEventListener('error', () => petal.remove(), {once: true});
      layer.appendChild(petal);
    });
    header.appendChild(layer);

    // Measure real DOM positions so the rope starts AFTER the date and ends
    // BEFORE the logo, regardless of text length, screen size or zoom.
    const date = header.querySelector('.banner-date');
    const logo = header.querySelector('.banner-logo');
    let pending = false;
    function measure() {
      pending = false;
      if (!date || !logo) return;
      const H = header.getBoundingClientRect();
      const D = date.getBoundingClientRect();
      const L = logo.getBoundingClientRect();
      const inset = Math.max(13, Math.min(26, H.width * .013));
      const x1 = Math.max(0, D.right - H.left + inset);
      const x2 = Math.min(H.width, L.left - H.left - inset);
      const available = Math.max(0, x2 - x1);
      scene.style.setProperty('--ddm-header-left', `${x1.toFixed(1)}px`);
      scene.style.setProperty('--ddm-header-width', `${available.toFixed(1)}px`);
      scene.style.setProperty('--ddm-header-height', `${H.height.toFixed(1)}px`);
      scene.classList.toggle('ddm-papel--compact', available < 460);
      scene.hidden = available < 190;
      layer.style.setProperty('--ddm-petal-travel', `${Math.ceil(H.height + 55)}px`);
    }
    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(measure);
    }
    schedule();
    window.addEventListener('resize', schedule, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(schedule);
      ro.observe(header);
      if (date) ro.observe(date);
      if (logo) ro.observe(logo);
    }
    if (date && typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(schedule);
      mo.observe(date, {childList:true, characterData:true, subtree:true});
    }
    if (document.fonts?.ready) document.fonts.ready.then(schedule);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
