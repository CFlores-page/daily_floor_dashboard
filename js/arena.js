/* Sales Arena. Existing TODAY sheet contract; no build step, Chromium 85 compatible. */
(() => {
  "use strict";
  const SHEET_ID = "1x8nGAfiI9bmz5G-35uQXWIoBV91CF8VqlUwc05aX8Rg";
  const UNITS = ["ELITE", "PREMIER", "BALFER", "LOYALTY"];
  const $ = (id) => document.getElementById(id);
  const money = (n) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);
  const numeric = (v) =>
    Number(String(v == null ? "" : v).replace(/[^\d.-]/g, "")) || 0;
  const truth = (v) => /^(true|verdadero|1|yes|on)$/i.test(String(v).trim());
  const unitKey = (v) =>
    UNITS.includes(String(v).toUpperCase())
      ? String(v).toLowerCase()
      : "default";
  const state = {
    initialized: false,
    busy: false,
    failed: false,
    sales: [],
    seen: new Set(),
    queue: [],
    showing: false,
    latest: null,
    lastSuccess: 0,
    closerKey: "",
    snapshot: null,
    announcementIndex: 0,
    maintenance: false,
    timers: [],
    animations: new Map(),
  };
  function text(id, value) {
    $(id).textContent = value == null ? "" : String(value);
  }
  function later(fn, ms) {
    const id = setTimeout(() => {
      state.timers = state.timers.filter((t) => t !== id);
      fn();
    }, ms);
    state.timers.push(id);
    return id;
  }
  // GViz datetimes are wall-clock components, not browser-local dates.
  // The source workbook is configured for America/Mexico_City (UTC-6).
  function parseDate(value) {
    const raw = String(value || "").trim();
    const gviz = raw.match(
      /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2})(?:,(\d{1,2}))?)?\)$/,
    );
    const display = raw.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i,
    );
    if (!gviz && !display) return null;
    let year, month, day, hour, minute, second;
    if (gviz) {
      [, year, month, day, hour = "0", minute = "0", second = "0"] = gviz;
      month = Number(month) + 1;
    } else {
      [, month, day, year, hour, minute, second = "0"] = display;
      if (display[7]) {
        if (+hour < 1 || +hour > 12) return null;
        hour = (+hour % 12) + (display[7].toUpperCase() === "PM" ? 12 : 0);
      }
    }
    [year, month, day, hour, minute, second] = [
      year,
      month,
      day,
      hour,
      minute,
      second,
    ].map(Number);
    if (
      year < 1900 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    )
      return null;
    const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (wall.getUTCMonth() !== month - 1 || wall.getUTCDate() !== day)
      return null;
    return new Date(wall.getTime() + 6 * 3600000);
  }
  function dayKey(d) {
    return new Date(d.getTime() - 6 * 3600000).toISOString().slice(0, 10);
  }
  function timeLabel(d) {
    return d
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Mexico_City",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(d)
      : "—";
  }
  function dateLabel(d) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Mexico_City",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(d);
  }
  function driveImage(value) {
    const s = String(value || "").trim();
    const m = s.match(/\/d\/([^/]+)/);
    return m
      ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w1000`
      : s;
  }
  function safeImage(value) {
    if (!String(value || "").trim()) return "";
    try {
      const u = new URL(driveImage(value), location.href);
      return /^https?:$/.test(u.protocol) ? u.href : "";
    } catch (e) {
      return "";
    }
  }
  function animateValue(id, target, format) {
    const el = $(id),
      previous = Number(el.dataset.value || 0);
    el.dataset.value = target;
    const old = state.animations.get(id);
    if (old) cancelAnimationFrame(old);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = format(target);
      return;
    }
    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / 850, 1);
      el.textContent = format(
        previous + (target - previous) * (1 - Math.pow(1 - p, 3)),
      );
      if (p < 1) state.animations.set(id, requestAnimationFrame(frame));
      else state.animations.delete(id);
    }
    state.animations.set(id, requestAnimationFrame(frame));
  }
  async function sheet(range) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=TODAY&range=${encodeURIComponent(range)}&t=${Date.now()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw Error(`Sheet ${res.status}`);
      const body = await res.text();
      const match = body.match(/setResponse\(([\s\S]*)\);?\s*$/);
      if (!match) throw Error("Unexpected sheet response");
      const data = JSON.parse(match[1]);
      if (data.status === "error" || !data.table)
        throw Error("Sheet unavailable");
      return (data.table.rows || []).map((row) =>
        (row.c || []).map((cell, column) => {
          if (!cell) return "";
          const type =
            data.table.cols &&
            data.table.cols[column] &&
            data.table.cols[column].type;
          if ((type === "datetime" || type === "date") && cell.v != null)
            return cell.v;
          return cell.f != null ? cell.f : cell.v != null ? cell.v : "";
        }),
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  async function fetchSnapshot() {
    const ranges = [
      "E1",
      "E2",
      "B2:B4",
      "A7:A11",
      "A13:E22",
      "H2:I6",
      "K2:P8",
      "L9:P9",
    ];
    const r = await Promise.all(ranges.map(sheet));
    const field = (name, c) => {
      const row = r[6].find(
        (row) => String(row[0]).trim().toUpperCase() === name,
      );
      return row ? row[c] || "" : "";
    };
    const slides = [];
    for (let c = 1; c <= (r[7][0] || []).length; c++) {
      if (truth(r[7][0][c - 1]))
        slides.push({
          title: field("TITLE", c),
          body: field("BODY", c),
          subtitle: field("SUBTITLE", c),
          background: field("BACKGROUND", c),
          imageUrl: field("IMAGE URL", c),
          unit: field("ACCENT / CAMPAIGN", c),
        });
    }
    return {
      hasSales: truth(r[0][0] && r[0][0][0]),
      maintenance: truth(r[1][0] && r[1][0][0]),
      metrics: r[2].map((row) => numeric(row[0])),
      closer: {
        name: r[3][1] && r[3][1][0],
        meta: r[3][2] && r[3][2][0],
        photo: r[3][3] && r[3][3][0],
        unit: r[3][4] && r[3][4][0],
      },
      sales: r[4].filter((row) => row.some((v) => String(v).trim())),
      chart: r[5].filter((row) =>
        UNITS.includes(String(row[0]).trim().toUpperCase()),
      ),
      slides,
    };
  }
  const laneElements = {};
  UNITS.forEach((unit) => {
    const lane = document.createElement("article");
    lane.className = "lane";
    lane.dataset.unit = unitKey(unit);
    const rank = document.createElement("span");
    rank.className = "rank";
    const content = document.createElement("div");
    content.className = "lane-content";
    const top = document.createElement("div");
    top.className = "lane-top";
    const title = document.createElement("div");
    title.className = "lane-title";
    const name = document.createElement("h3");
    name.textContent = unit;
    const leading = document.createElement("span");
    leading.className = "leader-label";
    leading.textContent = "Leading today";
    leading.hidden = true;
    title.append(name, leading);
    const amount = document.createElement("strong");
    amount.className = "lane-amount";
    top.append(title, amount);
    const track = document.createElement("div");
    track.className = "track";
    const fill = document.createElement("div");
    fill.className = "fill";
    track.append(fill);
    content.append(top, track);
    lane.append(rank, content);
    $("lanes").append(lane);
    laneElements[unit] = { lane, rank, amount, fill, leading };
  });
  function updateStandings(rows, hasSales) {
    const amounts = {};
    rows.forEach(
      (r) =>
        (amounts[String(r[0]).trim().toUpperCase()] = Math.max(
          0,
          numeric(r[1]),
        )),
    );
    const sorted = UNITS.map((unit, index) => ({
      unit,
      value: amounts[unit] || 0,
      index,
    })).sort((a, b) => b.value - a.value || a.index - b.index);
    const max = Math.max(...sorted.map((x) => x.value), 1);
    sorted.forEach((entry, i) => {
      const el = laneElements[entry.unit];
      el.rank.textContent = String(i + 1).padStart(2, "0");
      el.amount.textContent = money(entry.value);
      el.lane.style.transform = `translateY(${i * 100}%) translateY(${i * 9}px)`;
      el.lane.setAttribute(
        "aria-label",
        `${i + 1}. ${entry.unit}: ${money(entry.value)}`,
      );
      el.fill.style.transform = `scaleX(${entry.value / max})`;
      el.leading.hidden = !(i === 0 && entry.value > 0 && hasSales);
    });
  }
  function updateCloser(closer, hasSales) {
    const key = JSON.stringify(closer);
    if (key === state.closerKey) return;
    state.closerKey = key;
    const hero = $("spotlight");
    hero.dataset.unit = unitKey(closer.unit);
    text("hero-unit", closer.unit || "");
    text("closer-unit", closer.unit || "");
    $("closer-unit").hidden = !closer.unit;
    text("closer-name", closer.name || "No sales yet");
    text("closer-meta", closer.meta || "");
    const portrait = $("portrait");
    portrait.textContent = "";
    const url = safeImage(closer.photo);
    if (url) {
      const img = document.createElement("img");
      img.alt = closer.name ? `Top closer: ${closer.name}` : "Top closer";
      img.onerror = () => {
        portrait.textContent = "";
        const note = document.createElement("span");
        note.className = "missing-photo";
        note.textContent = "Photo unavailable";
        portrait.append(note);
      };
      img.src = url;
      portrait.append(img);
    } else {
      const note = document.createElement("span");
      note.className = "missing-photo";
      note.textContent = closer.name
        ? "Photo unavailable"
        : "Awaiting first sale";
      portrait.append(note);
    }
    $("closer-name").classList.toggle(
      "long-name",
      String(closer.name || "").length > 28,
    );
    requestAnimationFrame(() => {
      portrait.style.bottom =
        hero.querySelector(".hero-footer").offsetHeight + "px";
    });
    hero.classList.remove("reveal");
    void hero.offsetWidth;
    if (state.initialized) hero.classList.add("reveal");
  }
  function saleFromRow(row) {
    return {
      key: JSON.stringify([row[0], row[1], row[2]]),
      date: parseDate(row[0]),
      unit: String(row[1] || ""),
      name: String(row[3] || "Unknown closer"),
      amount: numeric(row[4]),
    };
  }
  function renderTimeline() {
    const timeline = $("timeline");
    timeline.textContent = "";
    if (!state.sales.length) {
      const p = document.createElement("p");
      p.className = "empty-timeline";
      p.textContent = "The next sale starts here.";
      timeline.append(p);
      return;
    }
    state.sales.slice(0, 5).forEach((sale, i) => {
      const card = document.createElement("article");
      card.className =
        "transaction" + (i === 0 && state.initialized ? " new-entry" : "");
      card.dataset.unit = unitKey(sale.unit);
      const top = document.createElement("div");
      top.className = "transaction-top";
      const unit = document.createElement("span");
      unit.className = "unit-name";
      unit.textContent = sale.unit;
      const date = document.createElement("span");
      date.textContent =
        (sale.date && dayKey(sale.date) !== dayKey(new Date())
          ? `${new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", month: "numeric", day: "numeric" }).format(sale.date)} · `
          : "") + timeLabel(sale.date);
      top.append(unit, date);
      const name = document.createElement("h3");
      name.textContent = sale.name;
      name.title = sale.name;
      const amount = document.createElement("strong");
      amount.textContent = money(sale.amount);
      card.append(top, name, amount);
      timeline.append(card);
    });
  }
  function cancelActivity() {
    state.timers.forEach(clearTimeout);
    state.timers = [];
    state.queue = [];
    state.showing = false;
    $("sale-event").hidden = true;
    $("announcement").hidden = true;
    $("timeline-view").hidden = false;
  }
  function showNextSale() {
    if (state.showing || state.maintenance || !state.queue.length) return;
    const sale = state.queue.shift();
    state.showing = true;
    $("announcement").hidden = true;
    $("timeline-view").hidden = true;
    const event = $("sale-event");
    event.dataset.unit = unitKey(sale.unit);
    text("event-unit", sale.unit);
    text("event-person", sale.name);
    text("event-amount", money(sale.amount));
    const entry = (state.snapshot.chart || []).find(
      (r) => String(r[0]).toUpperCase() === sale.unit.toUpperCase(),
    );
    text("event-total", entry ? `Unit volume ${money(numeric(entry[1]))}` : "");
    event.hidden = false;
    event.style.animation = "none";
    void event.offsetWidth;
    event.style.animation = "";
    const progress = event.querySelector(".event-progress");
    progress.style.animation = "none";
    void progress.offsetWidth;
    progress.style.animation = "";
    const lane = laneElements[sale.unit.toUpperCase()];
    if (lane) {
      lane.lane.classList.remove("sale-pulse");
      void lane.lane.offsetWidth;
      lane.lane.classList.add("sale-pulse");
    }
    later(() => {
      event.hidden = true;
      state.showing = false;
      if (state.queue.length) {
        showNextSale();
      } else {
        $("timeline-view").hidden = false;
        renderTimeline();
      }
    }, 5000);
  }
  function apply(snapshot) {
    const previous = state.snapshot;
    state.snapshot = snapshot;
    state.maintenance = snapshot.maintenance;
    $("maintenance").hidden = !snapshot.maintenance;
    if (snapshot.maintenance) {
      cancelActivity();
    }
    const rows = snapshot.sales
      .map(saleFromRow)
      .sort(
        (a, b) =>
          (b.date ? b.date.getTime() : -Infinity) -
          (a.date ? a.date.getTime() : -Infinity),
      );
    const latest = rows[0] && rows[0].date;
    const period = snapshot.hasSales
      ? "Today"
      : latest
        ? dateLabel(latest)
        : "No sales";
    text("date", dateLabel(new Date()));
    text(
      "day-note",
      snapshot.hasSales
        ? ""
        : latest
          ? `No new sales today · Showing ${dateLabel(latest)}`
          : "No sales available",
    );
    text("standings-period", period);
    text("closer-period", snapshot.hasSales ? "today" : "· last recorded");
    const looksStale =
      previous &&
      previous.hasSales &&
      snapshot.hasSales &&
      latest &&
      dayKey(latest) === dayKey(new Date()) &&
      snapshot.metrics[0] < previous.metrics[0];
    if (looksStale) {
      snapshot.metrics = previous.metrics;
      snapshot.chart = previous.chart;
      snapshot.closer = previous.closer;
    }
    ["sales", "volume", "average"].forEach((id, i) => {
      if (!previous || previous.metrics[i] !== snapshot.metrics[i])
        animateValue(
          id,
          snapshot.metrics[i] || 0,
          id === "sales" ? (v) => Math.round(v).toLocaleString("en-US") : money,
        );
    });
    updateStandings(snapshot.chart, snapshot.hasSales);
    updateCloser(snapshot.closer, snapshot.hasSales);
    // Elapsed time is anchored to the newest actual transaction, even across midnight.
    state.latest = latest || null;
    updateTimer();
    const newSales = rows.filter((s) => !state.seen.has(s.key));
    if (state.initialized && !snapshot.maintenance && snapshot.hasSales) {
      state.queue.push(
        ...newSales
          .filter((s) => s.date && dayKey(s.date) === dayKey(new Date()))
          .reverse(),
      );
    }
    rows.forEach((s) => state.seen.add(s.key));
    if (state.seen.size > 1000) state.seen = new Set(rows.map((s) => s.key));
    const changed = JSON.stringify(state.sales) !== JSON.stringify(rows);
    state.sales = rows;
    if (changed && !state.showing) renderTimeline();
    state.lastSuccess = Date.now();
    state.failed = false;
    state.initialized = true;
    updateStatus();
    if (!$("announcement").hidden && state.queue.length) {
      clearTimeout(state.announcementTimer);
      $("announcement").hidden = true;
      state.showing = false;
    }
    showNextSale();
  }
  function updateStatus() {
    const age = Date.now() - state.lastSuccess;
    const stale = state.failed || (state.lastSuccess && age > 30000);
    $("status").classList.toggle("stale", !!stale);
    text(
      "status",
      !state.lastSuccess
        ? "Connecting"
        : stale
          ? "Feed delayed · retrying"
          : window.ArenaPreview.enabled
            ? "Preview · sample data"
            : `Updated ${timeLabel(new Date(state.lastSuccess))}`,
    );
  }
  function updateTimer() {
    const caption = $("timer-caption");
    const timer = $("elapsed");
    caption.textContent = "Since last sale";
    timer.removeAttribute("title");
    if (!state.latest) {
      text("elapsed", "--:--");
      document.querySelector(".timer").className = "score timer";
      return;
    }
    const elapsedMs = Date.now() - state.latest.getTime();
    if (elapsedMs < 0) {
      text("elapsed", "--:--");
      caption.textContent = "Sale time is ahead";
      timer.title =
        "The latest sale timestamp is ahead of this device's clock. Check the sale timestamp and device clock; source timezone: Mexico City (UTC-6).";
      document.querySelector(".timer").className = "score timer cold";
      return;
    }
    const seconds = Math.floor(elapsedMs / 1000);
    const h = Math.floor(seconds / 3600),
      m = Math.floor((seconds % 3600) / 60),
      s = seconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    text(
      "elapsed",
      h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`,
    );
    document.querySelector(".timer").className =
      "score timer " +
      (seconds > 5400 ? "cold" : seconds <= 1800 ? "active" : "");
  }
  async function refresh() {
    if (state.busy) return;
    state.busy = true;
    try {
      apply(
        window.ArenaPreview.enabled
          ? window.ArenaPreview.snapshot()
          : await fetchSnapshot(),
      );
    } catch (e) {
      state.failed = true;
      text(
        "status",
        state.lastSuccess
          ? "Feed delayed · retrying"
          : "Unable to connect · retrying",
      );
      $("status").classList.add("stale");
      console.error("Arena refresh:", e.message);
    } finally {
      state.busy = false;
    }
  }
  function showAnnouncement() {
    const slides = state.snapshot && state.snapshot.slides;
    if (
      !slides ||
      !slides.length ||
      state.showing ||
      state.queue.length ||
      state.maintenance
    )
      return;
    const slide = slides[state.announcementIndex++ % slides.length];
    if (!slide.title && !slide.body) return;
    state.showing = true;
    $("timeline-view").hidden = true;
    const box = $("announcement");
    box.dataset.unit = unitKey(slide.unit);
    text("announcement-title", slide.title);
    text("announcement-body", slide.body);
    text("announcement-subtitle", slide.subtitle);
    const foreground = $("announcement-image");
    const imageUrl = safeImage(slide.imageUrl);
    foreground.hidden = !imageUrl;
    if (imageUrl) foreground.src = imageUrl;
    else foreground.removeAttribute("src");
    foreground.onerror = () => {
      foreground.hidden = true;
    };
    const url = safeImage(slide.background);
    box.style.backgroundImage = url
      ? `linear-gradient(90deg,rgba(7,17,31,.9),rgba(7,17,31,.75)),url("${url.replace(/["\\]/g, "")}")`
      : "";
    box.hidden = false;
    state.announcementTimer = later(() => {
      box.hidden = true;
      state.showing = false;
      $("timeline-view").hidden = false;
      showNextSale();
    }, 8000);
  }
  if (window.ArenaPreview.enabled) {
    text(
      "mode-label",
      "STAGING PREVIEW · sample data · Space: next sale · R: reset",
    );
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        apply(window.ArenaPreview.next());
      }
      if (e.code === "KeyR") {
        location.reload();
      }
    });
  }
  const logo = document.querySelector(".brand img");
  logo.onerror = () => {
    const fallback = document.createElement("strong");
    fallback.className = "brand-fallback";
    fallback.textContent = "netCenter";
    logo.replaceWith(fallback);
  };
  refresh();
  setInterval(refresh, 10000);
  setInterval(() => {
    updateTimer();
    if (state.lastSuccess) updateStatus();
  }, 1000);
  setInterval(showAnnouncement, 60000);
})();
