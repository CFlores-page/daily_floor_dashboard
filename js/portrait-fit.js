/* Fit transparent employee cutouts by visible pixels, not the image canvas.
   Chromium 85 compatible. No face recognition and no external image service. */
(() => {
  "use strict";
  const cache = new Map();
  const active = new WeakMap();
  // Optional exceptions keyed by Google Drive file ID or full image URL.
  // Example: "file-id": { zoom: 1.05, x: 0, y: 0 }
  // x/y are fractions of the portrait box; positive values move right/down.
  const overrides = {};
  function photoId(url) {
    try {
      const parsed = new URL(url, location.href);
      if (
        !/^(drive\.google\.com|lh3\.googleusercontent\.com)$/.test(
          parsed.hostname,
        )
      )
        return null;
      const match = parsed.pathname.match(/\/d\/([^/=]+)/);
      return parsed.searchParams.get("id") || (match && match[1]);
    } catch (e) {
      return null;
    }
  }
  function inspect(url) {
    const id = photoId(url);
    const analysisUrl = id
      ? `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1600`
      : url;
    if (cache.has(analysisUrl)) return cache.get(analysisUrl);
    const result = new Promise((resolve) => {
      const probe = new Image();
      probe.crossOrigin = "anonymous";
      let finished = false;
      const finish = (value) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        probe.onload = probe.onerror = null;
        resolve(value);
      };
      const timeout = setTimeout(() => finish(null), 7000);
      probe.onerror = () => finish(null);
      probe.onload = () => {
        try {
          const ratio = Math.min(
            1,
            384 / Math.max(probe.naturalWidth, probe.naturalHeight),
          );
          const width = Math.max(1, Math.round(probe.naturalWidth * ratio));
          const height = Math.max(1, Math.round(probe.naturalHeight * ratio));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(probe, 0, 0, width, height);
          const pixels = ctx.getImageData(0, 0, width, height).data;
          let left = width,
            top = height,
            right = -1,
            bottom = -1;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              if (pixels[(y * width + x) * 4 + 3] <= 16) continue;
              left = Math.min(left, x);
              top = Math.min(top, y);
              right = Math.max(right, x);
              bottom = Math.max(bottom, y);
            }
          }
          if (right < left || bottom < top) {
            finish(null);
            return;
          }
          // Expand by one sample pixel so fine hair and antialiasing are retained.
          left = Math.max(0, left - 1);
          top = Math.max(0, top - 1);
          right = Math.min(width, right + 2);
          bottom = Math.min(height, bottom + 2);
          finish({
            x: left / width,
            y: top / height,
            width: (right - left) / width,
            height: (bottom - top) / height,
            mode:
              left === 0 && top === 0 && right === width && bottom === height
                ? "full-image"
                : "auto",
          });
        } catch (e) {
          // Cross-origin access or an unsupported canvas must never hide the photo.
          finish(null);
        }
      };
      probe.src = analysisUrl;
    });
    if (cache.size >= 50) cache.delete(cache.keys().next().value);
    cache.set(analysisUrl, result);
    return result;
  }
  function mount(container, url, alt) {
    const old = active.get(container);
    if (old) old.dispose();
    container.textContent = "";
    const img = document.createElement("img");
    img.alt = alt;
    img.className = "fitted-portrait";
    const entry = {
      img,
      bounds: null,
      disposed: false,
      frame: 0,
      dispose: null,
    };
    let observer = null;
    function current() {
      return !entry.disposed && active.get(container) === entry;
    }
    function fit() {
      if (
        !current() ||
        !img.naturalWidth ||
        !container.clientWidth ||
        !container.clientHeight
      )
        return;
      const bounds = entry.bounds || {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        mode: "contain",
      };
      const naturalWidth = img.naturalWidth,
        naturalHeight = img.naturalHeight;
      const width = container.clientWidth,
        height = container.clientHeight;
      const options = overrides[photoId(url) || url] || {};
      const number = (value, fallback) =>
        Number.isFinite(Number(value)) ? Number(value) : fallback;
      const zoom = Math.max(0.5, Math.min(2, number(options.zoom, 1)));
      const x = Math.max(-0.5, Math.min(0.5, number(options.x, 0)));
      const y = Math.max(-0.5, Math.min(0.5, number(options.y, 0)));
      const scale =
        Math.min(
          Math.max(1, width - 32) / (bounds.width * naturalWidth),
          Math.max(1, height - 14) / (bounds.height * naturalHeight),
        ) * zoom;
      img.style.width = `${naturalWidth * scale}px`;
      img.style.height = `${naturalHeight * scale}px`;
      img.style.left = `${(width - bounds.width * naturalWidth * scale) / 2 - bounds.x * naturalWidth * scale + x * width}px`;
      img.style.top = `${height - bounds.height * naturalHeight * scale - bounds.y * naturalHeight * scale + y * height}px`;
      container.dataset.fit = bounds.mode;
    }
    function refresh() {
      if (!current()) return;
      cancelAnimationFrame(entry.frame);
      entry.frame = requestAnimationFrame(fit);
    }
    entry.dispose = () => {
      entry.disposed = true;
      cancelAnimationFrame(entry.frame);
      if (observer) observer.disconnect();
      window.removeEventListener("resize", refresh);
      img.onload = img.onerror = null;
    };
    active.set(container, entry);
    img.onload = refresh;
    img.onerror = () => {
      if (!current()) return;
      entry.dispose();
      container.dataset.fit = "unavailable";
      container.textContent = "";
      const note = document.createElement("span");
      note.className = "missing-photo";
      note.textContent = "Photo unavailable";
      container.append(note);
    };
    container.dataset.fit = "loading";
    container.append(img);
    if (window.ResizeObserver) {
      observer = new ResizeObserver(refresh);
      observer.observe(container);
    }
    window.addEventListener("resize", refresh);
    img.src = url;
    inspect(url).then((bounds) => {
      if (!current()) return;
      entry.bounds = bounds;
      refresh();
    });
    return refresh;
  }
  function clear(container) {
    const entry = active.get(container);
    if (entry) entry.dispose();
    active.delete(container);
    delete container.dataset.fit;
    container.textContent = "";
  }
  window.PortraitFit = { mount, clear, overrides };
})();
