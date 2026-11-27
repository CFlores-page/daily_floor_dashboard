/* Replace the Black Friday slide while its current raffle has five sales. */
(() => {
  "use strict";
  const feed = window.BlackFridayFeed;
  if (!feed) return;
  const overlay = document.createElement("section");
  overlay.id = "raffle-ready-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = '<div class="rr-panel"><div class="rr-kicker">NETCENTER · BLACK FRIDAY</div><h2>¡LA SIGUIENTE RIFA ESTÁ LISTA!</h2><p class="rr-subtitle"></p><div class="rr-lineup"></div><p class="rr-note">5 ventas completadas · Participantes listos para el sorteo</p></div>';
  document.body.appendChild(overlay);
  const key = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
  const people = new Map();
  let loaded = false, loading = false, retryAt = 0, currentId = "";
  function imageUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (!/^https?:$/.test(url.protocol)) return "";
      const id = /^(drive\.google\.com|lh3\.googleusercontent\.com)$/.test(url.hostname)
        ? url.searchParams.get("id") || (url.pathname.match(/\/d\/([^/]+)/) || [])[1] : null;
      return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1000` : url.href;
    } catch (_) { return ""; }
  }
  async function loadPeople() {
    if (loading || Date.now() < retryAt) return;
    loading = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams({sheet:"AGENT_INFORMATION",headers:"0",tq:"select C,D,N where C is not null",t:String(Date.now())});
      const response = await fetch(`https://docs.google.com/spreadsheets/d/1YTc-LgBdoQYeR1tihnbApF8HDYcvNs1E-aeTn1-cx5k/gviz/tq?${params}`, {cache:"no-store",signal:controller.signal});
      if (!response.ok) throw Error(`Roster HTTP ${response.status}`);
      const match = (await response.text()).match(/setResponse\(([\s\S]*)\);?\s*$/);
      const data = match && JSON.parse(match[1]);
      if (!data || data.status === "error" || !data.table) throw Error("Roster unavailable");
      const next = new Map(), ambiguous = new Set();
      (data.table.rows || []).forEach(row => {
        const c = row.c || [], full = key(c[0] && c[0].v);
        if (!full || full === "FULL NAME" || ambiguous.has(full)) return;
        const person = {name:String(c[1] && c[1].v || "").trim(),photo:imageUrl(c[2] && c[2].v)};
        if (next.has(full) && JSON.stringify(next.get(full)) !== JSON.stringify(person)) {
          next.delete(full); ambiguous.add(full);
        } else next.set(full,person);
      });
      people.clear(); next.forEach((person,name) => people.set(name,person));
      retryAt = Date.now() + 300000;
    } catch (error) { retryAt = Date.now() + 60000; console.warn("Raffle portraits:",error.message); }
    finally { loaded = true; loading = false; clearTimeout(timeout); }
  }
  function close() {
    overlay.hidden = true;
    currentId = "";
    overlay.querySelectorAll(".rr-photo").forEach(box => { if (window.PortraitFit) window.PortraitFit.clear(box); });
  }
  const visible = id => { const el = document.getElementById(id); return el && !el.hidden; };
  function check() {
    const data = feed.getSnapshot();
    if (!visible("bf-view") || feed.isStale() || !loaded || !data || data.current.length !== 5 ||
        visible("maintenance") || visible("sale-event") || window.ArenaLiveCelebration ||
        (window.NewSaleOverlay && window.NewSaleOverlay.isActive())) {
      if (!overlay.hidden) close();
      return;
    }
    const id = JSON.stringify([data.raffleNumber,data.current,Array.from(people.entries())]);
    if (!overlay.hidden && currentId === id) return;
    close();
    currentId = id;
    overlay.querySelector(".rr-subtitle").textContent = `Rifa #${data.raffleNumber} · $500 MXN`;
    const lineup = overlay.querySelector(".rr-lineup"); lineup.textContent = "";
    data.current.forEach(person => {
      const profile = people.get(key(person.name)) || {};
      const card = document.createElement("article"); card.className = "rr-person";
      const unit = String(person.unit || "").toLowerCase();
      card.dataset.unit = ["elite","premier","balfer","loyalty"].includes(unit) ? unit : "default";
      const photo = document.createElement("div"); photo.className = "rr-photo";
      const name = document.createElement("h3"); name.textContent = profile.name || person.name;
      const cert = document.createElement("p"); cert.textContent = person.cert;
      card.append(photo,name,cert); lineup.append(card);
      if (profile.photo && window.PortraitFit) window.PortraitFit.mount(photo,profile.photo,name.textContent);
      else { const fallback = document.createElement("span"); fallback.className="missing-photo"; fallback.textContent="Foto no disponible"; photo.append(fallback); }
    });
    overlay.hidden = false;

  }
  window.RaffleReadyOverlay = Object.freeze({isActive:()=>!overlay.hidden});
  loadPeople();
  setInterval(loadPeople,60000);
  setInterval(check,500);
  window.addEventListener("blackfriday:updated",check);
  window.addEventListener("dashboard:slidechange",check);
})();
