
/* Black Friday: NEW SALE broadcast overlay */
(() => {
  "use strict";

  const DURATION = 6400;
  const units = ["ELITE", "PREMIER", "BALFER", "LOYALTY"];

  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });

  const overlay = document.createElement("div");
  overlay.id = "new-sale-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");

  overlay.innerHTML = `
    <div class="ns-band" aria-hidden="true"></div>

    <article class="ns-card">
      <div class="ns-portrait">
        <svg class="ns-silhouette" viewBox="0 0 180 220" aria-hidden="true">
          <circle cx="90" cy="68" r="35" fill="#8a96a5"/>
          <path d="M9 220 V190 Q11 124 90 124 Q169 124 171 190 V220Z" fill="#536173"/>
        </svg>
        <img class="ns-photo" alt="" hidden>
      </div>

      <div class="ns-details">
        <div class="ns-kicker">NETCENTER · BLACK FRIDAY</div>
        <div class="ns-title">NEW SALE</div>
        <div class="ns-rule"></div>
        <div class="ns-unit"></div>
        <div class="ns-name"></div>
        <div class="ns-cert"></div>
        <div class="ns-amount"></div>
      </div>
    </article>`;

  document.body.appendChild(overlay);

  const get = sel => overlay.querySelector(sel);
  const photo = get(".ns-photo");
  const silhouette = get(".ns-silhouette");

  let active = false;
  let token = 0;

  function photoUrl(value) {
    if (!value) return "";

    try {
      const url = new URL(String(value), location.href);
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function play(sale) {
    if (active) return Promise.resolve(false);
    if (!sale) return Promise.resolve(false);

    const amount = Number(
      String(sale.amount == null ? "" : sale.amount)
        .replace(/[$,\s]/g, "")
    );

    const name = String(sale.name || "Unknown closer");
    const unit = String(sale.unit || "").toUpperCase();

    if (
      sale.amount == null ||
      String(sale.amount).trim() === "" ||
      !Number.isFinite(amount)
    ) {
      return Promise.reject(new Error("Invalid sale amount"));
    }

    active = true;
    const generation = ++token;

    overlay.dataset.unit = units.includes(unit)
      ? unit.toLowerCase()
      : "default";

    get(".ns-unit").textContent = unit;
    get(".ns-name").textContent = name;
    get(".ns-cert").textContent = String(sale.cert || "");
    get(".ns-amount").textContent = currency.format(amount);

    photo.onload = photo.onerror = null;
    photo.hidden = true;
    silhouette.removeAttribute("hidden");
    photo.removeAttribute("src");

    const src = photoUrl(sale.photo);

    if (src) {
      photo.alt = name;

      photo.onload = () => {
        if (active && generation === token) {
          photo.hidden = false;
          silhouette.setAttribute("hidden", "");
        }
      };

      photo.onerror = () => {
        if (!active || generation !== token) return;
        photo.hidden = true;
        silhouette.removeAttribute("hidden");
      };

      photo.src = src;
    }

    overlay.hidden = false;
    overlay.classList.remove("ns-playing");

    void overlay.offsetWidth;

    overlay.classList.add("ns-playing");

    return new Promise(resolve => {
      setTimeout(() => {
        overlay.classList.remove("ns-playing");
        overlay.hidden = true;
        active = false;
        resolve(true);
      }, DURATION + 40);
    });
  }

  window.NewSaleOverlay = Object.freeze({
    play,
    isActive: () => active,
    duration: DURATION
  });
})();
