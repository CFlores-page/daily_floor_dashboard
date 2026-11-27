/* Black Friday / Screen 02: read-only live feed and explicit fixture mode. */
(() => {
  "use strict";
  const preview = window.ArenaPreview;
  const arena = document.querySelector(".arena");
  if (!arena) return;
  const isPreview = Boolean(preview && preview.enabled);
  const today = Array.from(arena.querySelectorAll(".scoreboard, .competition, .activity"));
  const footer = arena.querySelector(".footer");
  const view = document.createElement("section");
  view.id = "bf-view";
  view.className = "bf-view";
  view.hidden = true;
  view.setAttribute("aria-label", "Black Friday dashboard");
  view.innerHTML = `
    <div class="bf-left">
      <article class="bf-panel bf-goal">
        <div class="bf-heading"><h2>Meta semanal del piso</h2><span>Meta: <b id="bf-target">—</b> ventas</span></div>
        <div class="bf-goal-values">
          <div><span>Ventas de la semana</span><strong id="bf-total" class="bf-gold">—</strong></div>
          <div><span>Ventas faltantes</span><strong id="bf-remaining">—</strong></div>
        </div>
        <div class="bf-goal-track" role="progressbar" aria-label="Avance en ventas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="bf-goal-fill"></div></div>
        <div class="bf-goal-note"><span id="bf-week-note">—</span><b id="bf-percent">—</b></div>
      </article>
      <div class="bf-kpis">
        <article class="bf-panel bf-kpi"><span>Volumen Black Friday</span><strong id="bf-friday-volume">—</strong><small>USD</small></article>
        <article class="bf-panel bf-kpi"><span>Ventas Black Friday</span><strong id="bf-friday-booked">—</strong><small>VENTAS</small></article>
      </div>
      <article class="bf-panel bf-ranking">
        <div class="bf-heading"><h2>Ranking semanal de ventas · Top 10</h2><span id="bf-friday-note">—</span></div>
        <div class="bf-chart" id="bf-chart" aria-label="Ranking por ventas"></div>
        <div class="bf-chart-legend"><span data-unit="elite">● Elite</span><span data-unit="premier">● Premier</span><span data-unit="balfer">● Balfer</span><span data-unit="loyalty">● Loyalty</span></div>
      </article>
    </div>
    <div class="bf-right">
      <article class="bf-panel bf-raffle">
        <div class="bf-heading"><h2>Rifa actual</h2><span class="bf-prize">$500 MXN</span></div>
        <div class="bf-raffle-caption"><span>Cada 5 ventas = 1 rifa</span><b id="bf-batch-label">Rifa #1</b></div>
        <div class="bf-raffle-progress"><div id="bf-steps" class="bf-steps" aria-hidden="true"></div><strong id="bf-raffle-count">0/5</strong></div>
        <p id="bf-pending" class="bf-pending" role="status"></p>
        <div class="bf-table-wrap"><table class="bf-table"><thead><tr><th>#</th><th>Closer</th><th>Cert#</th><th>Unit</th></tr></thead><tbody id="bf-current-rows"></tbody></table></div>
      </article>
      <article class="bf-panel bf-winners">
        <div class="bf-heading"><h2>Ganadores anteriores</h2><span>Rifas oficiales</span></div>
        <div class="bf-table-wrap"><table class="bf-table"><thead><tr><th>#</th><th>Closer</th><th>Cert#</th><th>Premio</th></tr></thead><tbody id="bf-winner-rows"></tbody></table></div>
      </article>
    </div>`;
  arena.insertBefore(view, footer);
  const $ = id => document.getElementById(id);
  const cash = new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"});
  const fmt = n => cash.format(n);
  const units = ["ELITE", "PREMIER", "BALFER", "LOYALTY"];
  const key = u => units.includes(u) ? u.toLowerCase() : "default";
  const text = (id, value) => { $(id).textContent = value; };
  const FEED_ID = "1YTc-LgBdoQYeR1tihnbApF8HDYcvNs1E-aeTn1-cx5k";
  const FEED_TAB = "BLACK_FRIDAY";
  const label = $("mode-label");
  const todayLabel = label.textContent;
  let snapshot = null, busy = false, stale = false, lastError = "";
  function num(value) {
    const s = String(value == null ? "" : value).trim().replace(/[$,\s]/g, "");
    if (!s || !Number.isFinite(Number(s))) throw Error("Invalid numeric field");
    return Number(s);
  }
  function parseFeed(rows) {
    if (!rows.some(r => r[0] === "BF_FEED_V1")) throw Error("Missing BF_FEED_V1 marker");
    const meta = new Map(rows.filter(r => r[0] === "META").map(r => [r[1],r[4]]));
    const read = k => { if (!meta.has(k)) throw Error("Missing " + k); return num(meta.get(k)); };
    const weeklySales = read("WEEKLY_SALES"), goal = read("WEEKLY_GOAL");
    const fridaySales = read("FRIDAY_SALES"), raffleNumber = read("RAFFLE_NUMBER");
    if (![weeklySales,goal,fridaySales,raffleNumber].every(Number.isInteger) || weeklySales < 0 || goal < 1 || fridaySales < 0 || raffleNumber < 1) throw Error("Invalid sales counts");
    const pick = type => rows.filter(r => r[0] === type && r[1]);
    const current = pick("CURRENT").map(r => ({name:r[1],unit:r[2],cert:r[3]}));
    const ranks = pick("RANK").map(r => ({name:r[1],unit:r[2],sales:num(r[4]),amount:num(r[5])}));
    const winners = pick("WINNER").map(r => ({name:r[1],cert:r[3],prize:r[6]}));
    const tickets = pick("TICKET").map(r => ({name:r[1],sales:num(r[4]),tickets:num(r[6])}));
    return {weeklySales,goal,weeklyVolume:read("WEEKLY_VOLUME"),fridaySales,fridayVolume:read("FRIDAY_VOLUME"),raffleNumber,current,ranks,winners,tickets,totalTickets:tickets.reduce((n,r)=>n+r.tickets,0),fridayStart:meta.get("FRIDAY_START"),fridayEnd:meta.get("FRIDAY_END"),weeklyStart:meta.get("WEEKLY_START"),weeklyEnd:meta.get("WEEKLY_END")};
  }
  async function fetchRows(tab, range) {
    const url = `https://docs.google.com/spreadsheets/d/${FEED_ID}/gviz/tq?sheet=${encodeURIComponent(tab)}&range=${range}&headers=0&t=${Date.now()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),15000);
    try {
      const res = await fetch(url,{cache:"no-store",signal:controller.signal});
      if (!res.ok) throw Error("BF feed HTTP " + res.status);
      const match = (await res.text()).match(/setResponse\(([\s\S]*)\);?\s*$/);
      if (!match) throw Error("Unexpected BF response");
      const data = JSON.parse(match[1]);
      if (data.status === "error" || !data.table) throw Error("BF feed unavailable");
      return (data.table.rows || []).map(row => (row.c || []).map(cell => cell && cell.v != null ? cell.v : ""));
    } finally { clearTimeout(timeout); }
  }
  const nameKey = value => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
  let shortNames = new Map();
  async function refreshNames() {
    try {
      const rows = await fetchRows("AGENT_INFORMATION", "C2:D1000");
      const next = new Map(), ambiguous = new Set();
      rows.forEach(row => {
        const full = nameKey(row[0]), short = String(row[1] || "").trim();
        if (!full || !short || ambiguous.has(full)) return;
        if (next.has(full) && next.get(full) !== short) {
          next.delete(full); ambiguous.add(full);
        } else next.set(full, short);
      });
      shortNames = next;
      if (!view.hidden) render();
    } catch (error) { console.warn("BF short names:", error.message); }
  }
  async function fetchFeed() {
    const [feedRows, weeklyRows] = await Promise.all([
      fetchRows(FEED_TAB, "A1:G1000"), fetchRows("BF 2026", "N5:S1000")
    ]);
    const data = parseFeed(feedRows), ranks = new Map();
    // N:S is the sheet's prepared whole-week sales table: date, unit, team,
    // certificate, closer, volume. Count its sales, not the Friday-only RANK feed.
    weeklyRows.forEach(row => {
      const name = String(row[4] || "").trim();
      if (!name || !String(row[3] || "").trim()) return;
      const key = nameKey(name);
      const item = ranks.get(key) || {name,unit:String(row[1] || "").trim().toUpperCase(),sales:0,amount:0};
      item.sales++;
      item.amount += num(row[5]);
      ranks.set(key,item);
    });
    data.ranks = Array.from(ranks.values()).sort((a,b) =>
      b.sales-a.sales || a.name.localeCompare(b.name,"es"));
    return data;
  }
  function previewData() {
    const rows = preview.snapshot().sales.slice().reverse().map(r => ({name:r[3],unit:r[1],cert:r[2],amount:num(r[4])}));
    const map = new Map();
    rows.forEach(r=>{const item=map.get(r.name)||{name:r.name,unit:r.unit,sales:0,amount:0};item.sales++;item.amount+=r.amount;map.set(r.name,item);});
    const ranks=Array.from(map.values()).sort((a,b)=>b.sales-a.sales || a.name.localeCompare(b.name));
    const tickets=ranks.filter(r=>r.sales>=2).map(r=>({name:r.name,sales:r.sales,tickets:Math.floor(r.sales/2)}));
    const volume=rows.reduce((n,r)=>n+r.amount,0);
    return {weeklySales:rows.length,goal:100,weeklyVolume:volume,fridaySales:rows.length,fridayVolume:volume,raffleNumber:1,current:rows.slice(0,5),ranks,winners:[],tickets,totalTickets:tickets.reduce((n,r)=>n+r.tickets,0),fridayStart:"2026-11-27",fridayEnd:"2026-11-27",weeklyStart:"2026-11-23",weeklyEnd:"2026-11-29"};
  }
  function displayName(name) {
    return shortNames.get(nameKey(name)) || String(name || "");
  }
  function renderRows(id,entries,count,winner) {
    const body=$(id); body.textContent="";
    for(let i=0;i<count;i++) {
      const item=entries[i], row=document.createElement("tr");
      const cells=[String(i+1),item?displayName(item.name):"—",item?item.cert:"—",item?(winner?(item.prize===""||item.prize==null?"—":item.prize):item.unit):"—"];
      cells.forEach((value,j)=>{const cell=document.createElement("td");cell.textContent=value;cell.title=String(value);if(j===3&&item&&!winner)cell.dataset.unit=key(item.unit);row.appendChild(cell);});
      body.appendChild(row);
    }
  }
  function renderChart(ranks) {
    const top=ranks.slice(0,10).reverse(), max=Math.max(1,...top.map(r=>r.sales));
    const chart=$("bf-chart");chart.textContent="";
    top.forEach((r,i)=>{
      const col=document.createElement("div");col.className="bf-chart-column";col.dataset.unit=key(r.unit);
      const graph=document.createElement("div");graph.className="bf-chart-plot";
      const bar=document.createElement("div");bar.className="bf-chart-bar";bar.style.height=(r.sales/max*82)+"%";
      const value=document.createElement("span");value.className="bf-chart-value";value.textContent=r.sales;value.title=fmt(r.amount)+" USD";
      const name=document.createElement("span");name.className="bf-chart-name";name.textContent=`${top.length-i}. ${displayName(r.name)}`;name.title=r.name;
      bar.appendChild(value);graph.appendChild(bar);col.append(graph,name);chart.appendChild(col);
    });
  }
  function render() {
    if (!snapshot) {
      text("bf-pending",lastError?"Datos no disponibles · " + lastError:"Conectando con Google Sheets…");
      return;
    }
    const d=snapshot, pct=d.weeklySales/d.goal*100, clamped=Math.min(100,pct);
    text("bf-target",d.goal);text("bf-total",`${d.weeklySales} / ${d.goal}`);text("bf-remaining",Math.max(0,d.goal-d.weeklySales));
    text("bf-percent",pct.toFixed(1)+"% de la meta");
    text("bf-week-note",`${d.totalTickets} BOLETOS · ${fmt(d.weeklyVolume)} USD`);
    $("bf-goal-fill").style.width=clamped+"%";$("bf-goal-fill").parentElement.setAttribute("aria-valuenow",clamped.toFixed(1));
    text("bf-friday-volume",fmt(d.fridayVolume));text("bf-friday-booked",d.fridaySales);
    text("bf-friday-note",d.weeklyStart===d.weeklyEnd?d.weeklyStart:`${d.weeklyStart} — ${d.weeklyEnd}`);
    text("bf-batch-label",`Rifa #${d.raffleNumber}`);text("bf-raffle-count",`${d.current.length}/5`);
    text("bf-pending",(stale?"Datos demorados · ":"")+(d.current.length===5?"Lista para sorteo":`${5-d.current.length} venta(s) para el sorteo`));
    const steps=$("bf-steps");steps.textContent="";
    for(let i=0;i<5;i++){const dot=document.createElement("span");dot.textContent=i+1;if(i<d.current.length)dot.className="filled";steps.appendChild(dot);}
    renderRows("bf-current-rows",d.current,5,false);renderRows("bf-winner-rows",d.winners.slice(-10).reverse(),10,true);renderChart(d.ranks);
  }
  async function refresh() {
    if (busy || window.ArenaLiveCelebration) return;
    busy = true;
    try {
      const incoming = isPreview ? previewData() : await fetchFeed();
      if (window.ArenaLiveCelebration) return;
      snapshot = incoming;
      stale = false;
      lastError = "";
    }
    catch(e){stale=true;lastError=e.message||"Error de conexión";console.warn("Black Friday feed:",e);}
    
    finally {
      busy = false;
      if (!view.hidden) render();
      window.dispatchEvent(new Event("blackfriday:updated"));
    }

  }
  // Shared read-only state for the upcoming vacation-raffle screen.
  window.BlackFridayFeed=Object.freeze({getSnapshot:()=>snapshot?JSON.parse(JSON.stringify(snapshot)):null,isStale:()=>stale,refresh});
  // November 27, 2026 at midnight in Mexico City (UTC-6).
  function isUnlocked() {
    return Date.now() >= Date.parse("2026-11-27T00:00:00-06:00");
  }
  function show(on) {
    if (on && !isUnlocked()) return false;
    if (window.VacationRaffleView) window.VacationRaffleView.hide();
    arena.classList.toggle("bf-showing", on);
    today.forEach(el => { el.hidden = on; });
    view.hidden = !on;
    label.textContent = on
      ? (isPreview ? "BLACK FRIDAY · SIMULACIÓN · B: SIGUIENTE" : "BLACK FRIDAY · LIVE SHEETS · B: SIGUIENTE")
      : todayLabel;
    if (on) { render(); refresh(); }
    return true;
  }
  window.BlackFridayView = Object.freeze({show, isUnlocked});
  refreshNames();
  setInterval(refreshNames, 5 * 60 * 1000);
  refresh();
  setInterval(refresh, 10000);
})();
