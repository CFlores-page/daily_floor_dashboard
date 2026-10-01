const SHEET_ID = "1x8nGAfiI9bmz5G-35uQXWIoBV91CF8VqlUwc05aX8Rg";
const SHEET_NAME = "TODAY";
const REFRESH_MS = 10000;
const dashboardState = {
  initialized: false,
  metrics: {
    sales: null,
    volume: null,
    average: null
  },
  barsBuilt: false,
  bars: {},
  latestSalesKey: "",
  latestSalesRows: [],
  topCloserKey: "",
  carouselKey: "",
  displayDateKey: ""
};
const numberState = new Map();
let lastSaleTimestamp = null;
let lastSaleTimerInterval = null;
let refreshInProgress = false;

async function getSheet(range) {
  // TEST MODE
  // Return fake sheet-shaped data instead of contacting Google.
  if (typeof TEST_MODE !== "undefined" && TEST_MODE) {
    return getTestSheetRange(range);
  }

  // PRODUCTION MODE
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&range=${encodeURIComponent(range)}&t=${Date.now()}`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to fetch sheet range ${range}: ${res.status}`);
  }

  const txt = await res.text();
  const match = txt.match(/setResponse\(([^;]+)\);/);

  if (!match) {
    throw new Error(`Unexpected response while reading range ${range}`);
  }

  const json = JSON.parse(match[1]);

  const rows = (json.table?.rows || []).map(r =>
    (r.c || []).map(x => x ? (x.f || x.v || "") : "")
  );

  return rows;
}

function getTestSheetRange(range) {
  switch (range) {
    case "E1":
      return [[TEST_DATA.hasSalesToday]];

    case "E2":
      return [[TEST_DATA.maintenance]];

    case "B2:B4":
      return [
        [TEST_DATA.metrics.sales],
        [TEST_DATA.metrics.volume],
        [TEST_DATA.metrics.average]
      ];

    case "A7:A11":
      return [
        ["TOP CLOSER"],
        [TEST_DATA.topCloser.name],
        [TEST_DATA.topCloser.meta],
        [TEST_DATA.topCloser.photo],
        [TEST_DATA.topCloser.campaign]
      ];

    case "A13:E22":
      return TEST_DATA.sales;

    case "H2:I6":
      return [
        ["CAMPAIGN", "VOLUME"],
        ...TEST_DATA.chart
      ];

    case "K2:P8":
      return buildTestCarouselGrid();

    case "L9:P9":
      return buildTestCarouselEnabledRow();

    default:
      console.warn(`No test data configured for range: ${range}`);
      return [];
  }
}

function buildTestCarouselGrid() {
  const slides = TEST_DATA.carousel || [];

  return [
    ["TYPE", ...slides.map(s => s.type || "")],
    ["TITLE", ...slides.map(s => s.title || "")],
    ["SUBTITLE", ...slides.map(s => s.subtitle || "")],
    ["BODY", ...slides.map(s => s.body || "")],
    ["BACKGROUND", ...slides.map(s => s.background || "")],
    ["IMAGE URL", ...slides.map(s => s.imageUrl || "")],
    ["ACCENT / CAMPAIGN", ...slides.map(s => s.accent || "")]
  ];
}

function buildTestCarouselEnabledRow() {
  return [[
    ...(TEST_DATA.carousel || []).map(s => s.enabled !== false)
  ]];
}

function updateMaintenanceOverlay(value) {
  const overlay = document.getElementById("maintenance-overlay");
  const dashboard = document.querySelector(".dashboard");
  if (!overlay) return;
  const maintenanceMode = boolFromCell(value);
  overlay.classList.toggle("active", maintenanceMode);
  if (dashboard) {
    dashboard.style.pointerEvents = maintenanceMode ? "none" : "";
  }
  document.body.classList.toggle("maintenance-mode", maintenanceMode);
}
function driveImage(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.includes("thumbnail?id=")) return raw;
  const match = raw.match(/\/d\/([^/]+)/);
  if (!match) return raw;
  return `https\://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
}
function dateKey(date) {
  if (!date) return "";
  // Force date comparison to Mexico central time, fixed UTC-6.
  const mexicoTime = new Date(date.getTime() - (6 * 60 * 60 * 1000));
  return mexicoTime.toISOString().slice(0, 10);
}
function todayLabel(hasSalesToday) {
  const d = new Date();
  if (!hasSalesToday) {
    d.setDate(d.getDate() - 1);
  }
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(d);
  if (hasSalesToday) return formattedDate;
  return `
    ${formattedDate}
    <div class="banner-subnote">
      No new sales today
    </div>
  `;
}
function setText(selector, value, fallback = "") {
  const el = document.querySelector(selector);
  if (el) el.textContent = value || fallback;
}
function parseMoney(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}
function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parseMoney(value));
}
function normalizeCampaign(name) {
  const raw = String(name || "").trim().toUpperCase();
  if (raw === "ELITE") return "ELITE";
  if (raw === "PREMIER") return "PREMIER";
  if (raw === "BALFER") return "BALFER";
  if (raw === "LOYALTY") return "LOYALTY";
  return raw;
}
function campaignClass(name) {
  const raw = String(name || "").trim().toUpperCase();
  if (raw === "DEFAULT" || raw === "") return "default";
  if (raw === "ELITE") return "elite";
  if (raw === "PREMIER") return "premier";
  if (raw === "BALFER") return "balfer";
  if (raw === "LOYALTY") return "loyalty";
  return "default";
}
function boolFromCell(value) {
  if (typeof value === "boolean") return value;
  const v = String(value || "").trim().toUpperCase();
  return v === "TRUE" || v === "VERDADERO" || v === "1" || v === "YES" || v === "ON";
}
function animateNumber(selector, targetValue, options = {}) {
  const el = document.querySelector(selector);
  if (!el) return;
  const {
    money = false,
    duration = 1200
  } = options;
  const target = money ? parseMoney(targetValue) : Number(targetValue) || 0;
  const start = numberState.has(selector) ? numberState.get(selector) : 0;
  const startTime = performance.now();
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * eased;
    el.textContent = money
      ? formatMoney(current)
      : Math.round(current).toLocaleString("en-US");
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      numberState.set(selector, target);
      setTimeout(() => el.classList.remove("pop"), 250);
    }
  }
  requestAnimationFrame(frame);
}
function updateMetrics(metrics) {
  const sales = Number(metrics?.[0]?.[0]) || 0;
  const volume = parseMoney(metrics?.[1]?.[0]);
  const average = parseMoney(metrics?.[2]?.[0]);
  if (!dashboardState.initialized || sales !== dashboardState.metrics.sales) {
    animateNumber(".sales-today .metric-value", sales, {
      money: false,
      duration: 900
    });
  }
  if (!dashboardState.initialized || volume !== dashboardState.metrics.volume) {
    animateNumber(".volume-today .metric-value", volume, {
      money: true,
      duration: 1300
    });
  }
  if (!dashboardState.initialized || average !== dashboardState.metrics.average) {
    animateNumber(".average-today .metric-value", average, {
      money: true,
      duration: 1300
    });
  }
  dashboardState.metrics.sales = sales;
  dashboardState.metrics.volume = volume;
  dashboardState.metrics.average = average;
}
function cleanChartRows(rows) {
  return rows
    .filter(r => r.some(cell => String(cell).trim() !== ""))
    .filter(r => String(r[0] || "").trim().toUpperCase() !== "CAMPAIGN")
    .map(r => ({
      name: normalizeCampaign(r[0]),
      value: parseMoney(r[1] || 0),
      className: campaignClass(r[0])
    }));
}
function buildCampaignBars(rows) {
  const shell = document.getElementById("campaign-bars");
  if (!shell) return;
  const cleaned = cleanChartRows(rows);
  shell.innerHTML = cleaned.map((row, index) => `
    <div class="bar-wrap" data-campaign="${row.className}">
      <div class="bar-value" id="bar-value-${index}">$0.00</div>
      <div class="bar ${row.className}" id="bar-${index}" style="height: 0%;"></div>
      <div class="bar-label">${row.name}</div>
    </div>
  `).join("");
  dashboardState.barsBuilt = true;
}
function updateCampaignBars(rows) {
  const cleaned = cleanChartRows(rows);
  if (!dashboardState.barsBuilt) {
    buildCampaignBars(rows);
  }
  const max = Math.max(...cleaned.map(r => r.value), 0);
  const safeMax = max > 0 ? max : 1;
  cleaned.forEach((row, index) => {
    const key = row.className;
    const newHeight = Math.max(12, Math.round((row.value / safeMax) * 100));
    const oldState = dashboardState.bars[key] || {};
    const valueChanged = oldState.value !== row.value;
    const heightChanged = oldState.height !== newHeight;
    const bar = document.getElementById(`bar-${index}`);
    if (!dashboardState.initialized || valueChanged || heightChanged) {
      setTimeout(() => {
        if (bar) {
          bar.style.height = `${newHeight}%`;
        }
        if (valueChanged || !dashboardState.initialized) {
          animateNumber(`#bar-value-${index}`, row.value, {
            money: true,
            duration: 1300
          });
        } else {
          const valueEl = document.getElementById(`bar-value-${index}`);
          if (valueEl) valueEl.textContent = formatMoney(row.value);
        }
      }, 120 * index);
    }
    dashboardState.bars[key] = {
      value: row.value,
      height: newHeight
    };
  });
}
function applyTopCloserTheme(rawCampaign) {
  const card = document.querySelector(".top-closer");
  if (!card) return;
  card.classList.remove("elite", "premier", "balfer", "loyalty", "default");
  card.classList.add(campaignClass(rawCampaign));
}
async function updateTopCloser(topCloserData) {
  const name = topCloserData?.[1]?.[0] || "No sales yet";
  const meta = topCloserData?.[2]?.[0] || "No sales yet";
  const rawPhotoUrl = topCloserData?.[3]?.[0] || "";
  const campaign = topCloserData?.[4]?.[0] || "";
  const key = JSON.stringify({ name, meta, rawPhotoUrl, campaign });
  if (dashboardState.initialized && key === dashboardState.topCloserKey) return;
  const card = document.querySelector(".top-closer");
  const applyCloserContent = () => {
    setText(".closer-name", name);
    setText(".closer-meta", meta);
    applyTopCloserTheme(campaign);
    const photoWrap = document.querySelector(".closer-photo");
    const img = String(rawPhotoUrl || "").trim();
    if (photoWrap) {
      if (img) {
        photoWrap.innerHTML = `
          <img
            src="${img}"
            alt="Top closer photo"
            onerror="this.parentNode.textContent='No Photo';"
            style="width:135%;height:135%;object-fit:cover;object-position:center 48%;transform:translateY(3%);display:block;border-radius:0;">
        `;
      } else {
        photoWrap.textContent = "No Photo";
      }
    }
  };
  if (!dashboardState.initialized || !card) {
    applyCloserContent();
    dashboardState.topCloserKey = key;
    return;
  }
  card.classList.remove("slide-in-right", "slide-out-right");
  void card.offsetWidth;
  card.classList.add("slide-out-right");
  await wait(550);
  applyCloserContent();
  card.classList.remove("slide-out-right");
  void card.offsetWidth;
  card.classList.add("slide-in-right");
  await wait(650);
  card.classList.remove("slide-in-right");
  dashboardState.topCloserKey = key;
}
function rowHtml(r) {
  const date = r[0] || "";
  const campaign = normalizeCampaign(r[1] || "");
  const cert = r[2] || "";
  const closer = r[3] || "";
  const amount = r[4] || "";
  const cClass = campaignClass(campaign);
  return `
    <tr>
      <td>${date}</td>
      <td class="unit-cell"><span class="unit-pill ${cClass}">${campaign}</span></td>
      <td>${cert}</td>
      <td>${closer}</td>
      <td class="amount">${amount}</td>
    </tr>
  `;
}
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function saleKey(r) {
  const date = String(r[0] || "").trim();
  const cert = String(r[2] || "").trim();
  const amount = String(r[4] || "").trim();
  return `${date}|${cert}|${amount}`;
}
function renderSalesRows(items, highlightKeys = new Set()) {
  return items.map(item => {
    const html = rowHtml(item.raw);
    if (highlightKeys.has(item.key)) {
      return html.replace("<tr>", `<tr class="new-sale-row">`);
    }
    return html;
  }).join("");
}
async function playNewSalesQueue(newItems, finalRows) {
  const tbody = document.querySelector(".latest-panel tbody");
  if (!tbody) return;
  const currentRows = [...dashboardState.latestSalesRows];
  const queue = [...newItems].reverse();
  for (const sale of queue) {
    currentRows.unshift(sale);
    const visibleRows = currentRows.slice(0, 10);
    tbody.innerHTML = renderSalesRows(visibleRows, new Set([sale.key]));
    await wait(900);
  }
  tbody.innerHTML = renderSalesRows(finalRows);
}
async function updateLatestSales(rows) {
  const tbody = document.querySelector(".latest-panel tbody");
  if (!tbody) return;
  const cleanedRows = rows
    .filter(r => r.some(cell => String(cell).trim() !== ""))
    .map(r => ({
      raw: r,
      key: saleKey(r)
    }));
  const newKey = JSON.stringify(cleanedRows.map(r => r.key));
  if (!dashboardState.initialized) {
    tbody.innerHTML = renderSalesRows(cleanedRows);
    dashboardState.latestSalesKey = newKey;
    dashboardState.latestSalesRows = cleanedRows;
    return;
  }
  if (newKey === dashboardState.latestSalesKey) return;
  const previousKeys = new Set(
    (dashboardState.latestSalesRows || []).map(item => item.key)
  );
  const newItems = cleanedRows.filter(item => !previousKeys.has(item.key));
  if (newItems.length > 0) {
    await playNewSalesQueue(newItems, cleanedRows);
  } else {
    tbody.innerHTML = renderSalesRows(cleanedRows);
  }
  dashboardState.latestSalesKey = newKey;
  dashboardState.latestSalesRows = cleanedRows;
}
function parseSaleDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, month, day, year, hour, minute, second] = match;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) + 6,
    Number(minute),
    Number(second)
  ));
}
function formatElapsedTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  if (minutes > 0) {
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${seconds}s`;
}
function updateLastSaleVisualState(diffMs) {
  const card = document.querySelector(".last-sale");
  if (!card) return;
  card.classList.remove("active", "slowing", "cold");
  const minutes = diffMs / 60000;
  if (minutes <= 30) {
    card.classList.add("active");
  } else if (minutes <= 90) {
    card.classList.add("slowing");
  } else {
    card.classList.add("cold");
  }
}
function renderLastSaleTimer() {
  const el = document.getElementById("lastSaleTimer");
  const card = document.querySelector(".last-sale");
  if (!el) return;
  if (!lastSaleTimestamp) {
    el.textContent = "--:--";
    if (card) card.classList.remove("active", "slowing", "cold");
    return;
  }
  const saleIsToday =
    dateKey(lastSaleTimestamp) === dateKey(new Date());
  if (!saleIsToday) {
    el.textContent = "--:--";
    if (card) card.classList.remove("active", "slowing", "cold");
    return;
  }
  const diffMs = Date.now() - lastSaleTimestamp.getTime();
  el.textContent = formatElapsedTime(diffMs);
  updateLastSaleVisualState(diffMs);
}
function setLastSaleTimestampFromRows(rows, hasSalesToday) {
  const cleanedRows = rows.filter(r => r.some(cell => String(cell).trim() !== ""));
  const latestSaleDate = parseSaleDate(cleanedRows?.[0]?.[0]);
  if (!hasSalesToday || !latestSaleDate) {
    lastSaleTimestamp = null;
    renderLastSaleTimer();
    return;
  }
  const latestSaleIsToday =
    dateKey(latestSaleDate) === dateKey(new Date());
  if (!latestSaleIsToday) {
    lastSaleTimestamp = null;
    renderLastSaleTimer();
    return;
  }
  const previousTime = lastSaleTimestamp?.getTime();
  const newTime = latestSaleDate.getTime();
  lastSaleTimestamp = latestSaleDate;
  if (previousTime !== newTime) {
    renderLastSaleTimer();
    const timer = document.getElementById("lastSaleTimer");
    if (timer) {
      timer.classList.remove("pop");
      void timer.offsetWidth;
      timer.classList.add("pop");
      setTimeout(() => timer.classList.remove("pop"), 350);
    }
  }
  if (!lastSaleTimerInterval) {
    lastSaleTimerInterval = setInterval(renderLastSaleTimer, 1000);
  }
}
function buildCarouselSlides(grid, enabledRow) {
  if (!grid || !grid.length) return [];
  const slides = [];
  const colCount = grid[0]?.length || 0;
  for (let c = 1; c < colCount; c++) {
    const getRowValue = (label) => {
      const row = grid.find(r => String(r[0] || "").trim().toUpperCase() === label);
      return row?.[c] || "";
    };
    const slide = {
      type: getRowValue("TYPE"),
      title: getRowValue("TITLE"),
      subtitle: getRowValue("SUBTITLE"),
      body: getRowValue("BODY"),
      background: getRowValue("BACKGROUND"),
      imageUrl: getRowValue("IMAGE URL"),
      accent: getRowValue("ACCENT / CAMPAIGN"),
      enabled: enabledRow?.[0]?.[c - 1] || false
    };
    if (boolFromCell(slide.enabled)) {
      slides.push(slide);
    }
  }
  return slides;
}
function renderCarouselSlide(slide) {
  const stage = document.getElementById("carousel-stage");
  if (!stage) return;
  const accentClass = campaignClass(slide.accent || "");
  const bg = driveImage(slide.background);
  const fg = driveImage(slide.imageUrl);
  const backgroundStyle = bg
    ? `background-image:
         linear-gradient(180deg, rgba(8,14,24,0.10), rgba(8,14,24,0.55)),
         url('${bg}');`
    : `background:
         linear-gradient(145deg, rgba(18,30,48,0.94), rgba(34,49,74,0.92));`;
  const title = slide.title ? `<div class="carousel-title">${slide.title}</div>` : `<div class="carousel-title"></div>`;
  const body = slide.body ? `<div class="carousel-body">${slide.body}</div>` : `<div class="carousel-body"></div>`;
  const subtitle = slide.subtitle ? `<div class="carousel-subtitle">${slide.subtitle}</div>` : `<div class="carousel-subtitle"></div>`;
  const fgBlock = fg
    ? `<div class="carousel-foreground">
         <img src="${fg}" alt="" onerror="this.style.display='none';">
       </div>`
    : "";
  stage.innerHTML = `
    <div class="carousel-card ${accentClass}" style="${backgroundStyle}">
      <div class="carousel-overlay"></div>
      ${fgBlock}
      <div class="carousel-content">
        ${title}
        ${body}
        ${subtitle}
      </div>
    </div>
  `;
}
let carouselSlides = [];
let carouselIndex = 0;
let carouselTimer = null;
function renderCarouselDots() {
  const dots = document.getElementById("carousel-dots");
  if (!dots) return;
  dots.innerHTML = carouselSlides
    .map((_, i) => `<div class="carousel-dot ${i === carouselIndex ? "active" : ""}"></div>`)
    .join("");
}
function startCarousel(slides) {
  carouselSlides = slides || [];
  carouselIndex = 0;
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
  if (!carouselSlides.length) {
    renderCarouselSlide({
      type: "Spotlight",
      title: "No active slides",
      subtitle: "",
      body: "Someone should tell Cristian",
      background: "",
      imageUrl: "",
      accent: "",
      enabled: true
    });
    renderCarouselDots();
    return;
  }
  renderCarouselSlide(carouselSlides[0]);
  renderCarouselDots();
  if (carouselSlides.length > 1) {
    carouselTimer = setInterval(() => {
      carouselIndex = (carouselIndex + 1) % carouselSlides.length;
      renderCarouselSlide(carouselSlides[carouselIndex]);
      renderCarouselDots();
    }, 8000);
  }
}
function updateCarousel(carouselGrid, carouselEnabled) {
  const slides = buildCarouselSlides(carouselGrid, carouselEnabled);
  const key = JSON.stringify(slides);
  if (dashboardState.initialized && key === dashboardState.carouselKey) return;
  startCarousel(slides);
  dashboardState.carouselKey = key;
}
async function refreshDashboardData() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  try {
    const [truthCell, maintenanceCell, metrics, topCloserData, sales, chart, carouselGrid, carouselEnabled] = await Promise.all([
      getSheet("E1"),
      getSheet("E2"),
      getSheet("B2:B4"),
      getSheet("A7:A11"),
      getSheet("A13:E22"),
      getSheet("H2:I6"),
      getSheet("K2:P8"),
      getSheet("L9:P9")
    ]);
    updateMaintenanceOverlay(maintenanceCell?.[0]?.[0]);
    const hasSalesToday = boolFromCell(truthCell?.[0]?.[0]);
    const latestSaleDate = parseSaleDate(
      sales.filter(r => r.some(cell => String(cell).trim() !== ""))?.[0]?.[0]
    );
    const todayKey = dateKey(new Date());
    const latestSaleKey = dateKey(latestSaleDate);
    const latestSaleIsToday =
      latestSaleDate &&
      latestSaleKey === todayKey;
    const incomingSalesCount = Number(metrics?.[0]?.[0]) || 0;
    const previousSalesCount = dashboardState.metrics.sales ?? 0;
    const currentlyDisplayingToday =
      dashboardState.displayDateKey === todayKey;
    const looksLikeFallback =
      dashboardState.initialized &&
      currentlyDisplayingToday &&
      latestSaleIsToday &&
      incomingSalesCount < previousSalesCount;
    document.querySelector(".banner-date").innerHTML = todayLabel(hasSalesToday);
    if (!looksLikeFallback) {
      updateMetrics(metrics);
      updateCampaignBars(chart);
      await updateTopCloser(topCloserData);
      dashboardState.displayDateKey = latestSaleIsToday ? todayKey : "fallback";
    } else {
      console.warn("Skipped stale fallback metrics/top closer/chart update.");
    }
    setLastSaleTimestampFromRows(sales, hasSalesToday);
    await updateLatestSales(sales);
    updateCarousel(carouselGrid, carouselEnabled);
    dashboardState.initialized = true;
  } catch (error) {
    console.error("Dashboard refresh error:", error);
    setText(".banner-date", "Connection error");
    setText(".closer-name", "Unable to load");
    setText(".closer-meta", "Check sheet sharing and URL access");
  } finally {
    refreshInProgress = false;
  }
}
refreshDashboardData();
setInterval(refreshDashboardData, REFRESH_MS);
