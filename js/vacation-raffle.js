/* Black Friday / Screen 03: vacation raffle. Reuses BlackFridayFeed. */
(() => {
  "use strict";
  if (document.getElementById("vacation-view")) return;
  const feed = window.BlackFridayFeed;
  const cashView = window.BlackFridayView;
  const arena = document.querySelector(".arena");
  const footer = arena && arena.querySelector(".footer");
  if (!feed || !cashView || !footer) {
    console.error("Vacation raffle: load after the patched black-friday-view.js");
    return;
  }
  const today = Array.from(arena.querySelectorAll(".scoreboard, .competition, .activity"));
  const mode = document.getElementById("mode-label");
  const preview = Boolean(window.ArenaPreview && window.ArenaPreview.enabled);
  const view = document.createElement("section");
  view.id = "vacation-view";
  view.className = "vac-view";
  view.hidden = true;
  view.setAttribute("aria-label", "Rifa de vacaciones Black Friday");
  view.innerHTML = `
    <article class="bf-panel vac-progress">
      <div class="bf-heading"><h2>Gran rifa de vacaciones · Meta del piso</h2><span id="vac-period">23–29 NOV 2026</span></div>
      <div class="vac-track" id="vac-track" role="progressbar" aria-label="Avance hacia la meta" aria-valuemin="0" aria-valuemax="100">
        <div class="vac-track-fill" id="vac-fill"></div>
      </div>
      <div class="vac-progress-bottom">
        <span class="vac-side-stat"><small>Faltan</small><strong id="vac-remaining">—</strong><small>ventas</small></span>
        <div class="vac-count-wrap"><strong id="vac-count" class="bf-gold">— / 100</strong><span>VENTAS DEL PISO</span></div>
        <span></span>
      </div>
    </article>
    <div class="vac-bottom">
      <article class="bf-panel vac-rules">
        <div class="bf-heading"><h2>¿Cómo participar?</h2></div>
        <div class="vac-prize"><span>PREMIO</span><strong class="bf-gold">VACACIONES</strong><b>3 días / 2 noches</b><small>2 adultos</small></div>
        <div class="vac-rule"><b>01</b><div><strong>Meta del piso: <span id="vac-rule-goal">100</span> ventas</strong><p>Todos los equipos suman a la misma meta.</p></div></div>
        <div class="vac-rule"><b>02</b><div><strong>Lunes a domingo</strong><p>Del 23 al 29 de noviembre. Cierre: domingo a medianoche.</p></div></div>
        <div class="vac-rule"><b>03</b><div><strong>2 ventas = 1 boleto</strong><p>Sin importar el precio del paquete. Más ventas, más boletos.</p></div></div>
        <div class="vac-rule"><b>04</b><div><strong>Mínimo 2 ventas</strong><p>Con una sola venta no se genera boleto. No importa la meta individual de tu equipo.</p></div></div>
        <div class="vac-rule"><b>05</b><div><strong>Activación de la rifa</strong><p>Al alcanzar la meta del piso, participan todos los closers que cumplieron el mínimo.</p></div></div>
      </article>
      <article class="bf-panel vac-tickets">
        <div class="bf-heading"><h2>Boletos acumulados</h2><span id="vac-page-label">—</span></div>
        <div class="vac-ticket-summary"><span><strong id="vac-people">—</strong> CLOSERS CON BOLETOS</span><span><strong class="bf-gold" id="vac-ticket-total">—</strong> BOLETOS ACUMULADOS</span></div>
        <div id="vac-ticket-list" class="vac-ticket-list" aria-label="Closers y boletos acumulados"></div>
        <p class="vac-disclaimer">Cifras únicamente de referencia. Los boletos solo serán acreditados si se alcanza la meta de <b id="vac-disclaimer-goal">100</b> ventas antes del cierre del domingo a medianoche, sujetos a validación.</p>
      </article>
    </div>`;
  arena.insertBefore(view, footer);
  const $ = id => document.getElementById(id);
  const text = (id, value) => { $(id).textContent = value; };
  let page = 0;
  let lastSignature = "";
  let shortNames = new Map();
  const nameKey = value => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
  async function refreshShortNames() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams({sheet:"AGENT_INFORMATION", headers:"0",
        tq:"select C,D where C is not null", t:String(Date.now())});
      const response = await fetch(`https://docs.google.com/spreadsheets/d/1YTc-LgBdoQYeR1tihnbApF8HDYcvNs1E-aeTn1-cx5k/gviz/tq?${params}`,
        {cache:"no-store", signal:controller.signal});
      if (!response.ok) throw Error(`Roster HTTP ${response.status}`);
      const match = (await response.text()).match(/setResponse\(([\s\S]*)\);?\s*$/);
      if (!match) throw Error("Unexpected roster response");
      const data = JSON.parse(match[1]);
      if (data.status === "error" || !data.table) throw Error("Roster unavailable");
      const next = new Map(), ambiguous = new Set();
      (data.table.rows || []).forEach(row => {
        const cells = row.c || [];
        const full = nameKey(cells[0] && cells[0].v);
        const short = String(cells[1] && cells[1].v || "").trim();
        if (!full || !short || full === "FULL NAME" || ambiguous.has(full)) return;
        if (next.has(full) && next.get(full) !== short) {
          next.delete(full); ambiguous.add(full);
        } else next.set(full, short);
      });
      shortNames = next;
      lastSignature = "";
      render();
    } catch (error) {
      console.warn("Ticket short names unavailable; keeping last known names.", error.message);
    } finally { clearTimeout(timeout); }
  }

  // Add columns before paging, with a readable upper limit for TV displays.
  function ticketLayout(count) {
    const width = window.innerWidth;
    const maxColumns = width <= 700 ? 1 : width <= 1100 ? 3 : 4;
    const columns = Math.min(maxColumns, count <= 12 ? 2 : count <= 18 ? 3 : 4);
    const capacity = maxColumns * 6;
    const visible = Math.min(count, capacity);
    return {columns, size:capacity, rows:Math.max(1, Math.ceil(visible / columns))};
  }
  const ticketRows = d => (Array.isArray(d.tickets) ? d.tickets : [])
    .filter(r => r && r.name && Number(r.sales) >= 2 && Number(r.tickets) > 0)
    .slice().sort((a,b) => b.tickets-a.tickets || b.sales-a.sales || String(a.name).localeCompare(String(b.name), "es"));
  function period(d) {
    const fmt = new Intl.DateTimeFormat("es-MX", {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
    const a = new Date(String(d.weeklyStart) + "T00:00:00Z");
    const b = new Date(String(d.weeklyEnd) + "T00:00:00Z");
    return Number.isFinite(a.getTime()) && Number.isFinite(b.getTime()) ? `${fmt.format(a)} — ${fmt.format(b)}` : "23–29 NOV 2026";
  }
  function render() {
    if (view.hidden) return;
    const d = feed.getSnapshot();
    const stale = feed.isStale();
    const list = $("vac-ticket-list");
    if (!d) {
      text("vac-page-label", stale ? "Datos no disponibles" : "Conectando…");
      if (lastSignature !== "empty") { list.textContent = "Esperando datos de Google Sheets…"; lastSignature = "empty"; }
      return;
    }
    const goal = d.goal, sales = d.weeklySales, pct = 100*sales/goal;
    const rows = ticketRows(d), layout = ticketLayout(rows.length), size = layout.size;
    const pages = Math.max(1, Math.ceil(rows.length/size));
    list.style.gridTemplateColumns = `repeat(${layout.columns}, minmax(0, 1fr))`;
    list.style.gridTemplateRows = `repeat(${layout.rows}, minmax(0, 1fr))`;
    list.dataset.compact = String(layout.columns >= 3);
    page = Math.min(page, pages-1);
    text("vac-period", period(d));
    text("vac-count", `${sales} / ${goal}`);
    text("vac-remaining", Math.max(0, goal-sales));
    text("vac-rule-goal", goal); text("vac-disclaimer-goal", goal);
    $("vac-fill").style.width = Math.max(0,Math.min(100,pct))+"%";
    $("vac-track").setAttribute("aria-valuenow", Math.max(0,Math.min(100,pct)).toFixed(1));
    $("vac-track").setAttribute("aria-valuetext", `${sales} de ${goal} ventas`);
    text("vac-people", rows.length);
    text("vac-ticket-total", d.totalTickets);
    text("vac-page-label", pages > 1 ? `Página ${page+1} / ${pages}` : "Acumulados de la semana");
    const signature = JSON.stringify([page,size,layout.columns,layout.rows,rows]);
    if (lastSignature === signature) return;
    lastSignature = signature;
    list.textContent = "";
    if (!rows.length) { const empty=document.createElement("p");empty.className="vac-empty";empty.textContent="Aún no hay closers con dos ventas.";list.appendChild(empty);return; }
    rows.slice(page*size,(page+1)*size).forEach(r => {
      const entry=document.createElement("div");entry.className="vac-ticket-row";
      const details=document.createElement("div");details.className="vac-ticket-details";
      const name=document.createElement("strong");name.textContent=shortNames.get(nameKey(r.name)) || r.name;name.title=r.name;
      const count=document.createElement("small");count.textContent=`${r.sales} ventas`;
      details.append(name,count);
      const ticket=document.createElement("div");ticket.className="vac-ticket-badge";
      const amount=document.createElement("strong");amount.textContent=r.tickets;
      const word=document.createElement("small");word.textContent=Number(r.tickets)===1?"BOLETO":"BOLETOS";
      ticket.append(amount,word);entry.append(details,ticket);list.appendChild(entry);
    });
  }
  function hide() { view.hidden = true; }
  function show() {
    cashView.show(false);
    today.forEach(el => {el.hidden=true;});
    arena.classList.add("bf-showing");
    view.hidden=false;
    mode.textContent=preview ? "RIFA VACACIONES · SIMULACIÓN · B: SIGUIENTE" : "RIFA VACACIONES · LIVE SHEETS · B: SIGUIENTE";
    render(); feed.refresh();
  }
  refreshShortNames();
  setInterval(refreshShortNames, 5 * 60 * 1000);
  window.VacationRaffleView=Object.freeze({show,hide,render});
  window.addEventListener("blackfriday:updated", render);
  window.addEventListener("resize", render);
  setInterval(() => {
    if (view.hidden) return;
    const d=feed.getSnapshot(); if (!d) return;
    const pages=Math.max(1,Math.ceil(ticketRows(d).length/ticketLayout(ticketRows(d).length).size));
    if (pages>1) {page=(page+1)%pages;render();}
  },6000);
})();
