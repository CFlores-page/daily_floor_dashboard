/* Black Friday: single 10-second screen rotation controller. */
(() => {
  "use strict";
  if (window.DashboardRotation) return;
  const cash = window.BlackFridayView;
  const vacation = window.VacationRaffleView;
  if (!cash || !vacation) {
    console.error("Dashboard rotation: load after both promotion views");
    return;
  }
  const HOLD_MS = 10000;
  let current = "today";
  let deadline = performance.now() + HOLD_MS;
  let wasBusy = false;
  let automatic = true;
  const allowed = () => cash.isUnlocked()
    ? ["today", "black-friday", "vacation"]
    : ["today", "vacation"];
  const visible = id => {
    const el = document.getElementById(id);
    return !!el && !el.hidden;
  };
  const blocked = () => Boolean(
    window.ArenaLiveCelebration ||
    (window.NewSaleOverlay && window.NewSaleOverlay.isActive()) ||
    visible("sale-event") || visible("maintenance")
  );
  function show(requested, animate = true) {
    const target = allowed().includes(requested) ? requested : "today";
    if (target === "vacation") vacation.show();
    else cash.show(target === "black-friday");
    current = target;
    deadline = performance.now() + HOLD_MS;
    window.dispatchEvent(new Event("dashboard:slidechange"));
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const selector = target === "today" ? ".scoreboard, .competition, .activity"
        : target === "vacation" ? "#vacation-view" : "#bf-view";
      document.querySelectorAll(selector).forEach(el => {
        if (typeof el.animate === "function") el.animate([
          { opacity: 0.15, transform: "translateX(18px)" },
          { opacity: 1, transform: "translateX(0)" }
        ], { duration: 280, easing: "ease-out" });
      });
    }
  }
  const mobileNav = document.createElement("nav");
  mobileNav.className = "mobile-slide-nav";
  mobileNav.setAttribute("aria-label", "Cambiar pantalla");
  mobileNav.innerHTML = '<button type="button" aria-label="Pantalla anterior">‹ Anterior</button><span aria-live="polite"></span><button type="button" aria-label="Pantalla siguiente">Siguiente ›</button>';
  document.body.appendChild(mobileNav);
  const navButtons = mobileNav.querySelectorAll("button");
  function updateNav() {
    const names = {today:"Ventas", "black-friday":"Black Friday", vacation:"Vacaciones"};
    mobileNav.querySelector("span").textContent = `${names[current]} · ${automatic ? "Auto" : "Manual"}`;
    navButtons.forEach(button => { button.disabled = blocked(); });
  }
  function manualStep(direction) {
    if (blocked()) return;
    automatic = false;
    const order = allowed();
    show(order[(order.indexOf(current) + direction + order.length) % order.length]);
    updateNav();
  }
  navButtons[0].addEventListener("click", () => manualStep(-1));
  navButtons[1].addEventListener("click", () => manualStep(1));
  window.addEventListener("dashboard:slidechange",updateNav);
  function next() {
    if (blocked()) return;
    const order = allowed();
    show(order[(order.indexOf(current) + 1) % order.length]);
  }
  document.addEventListener("keydown", e => {
    if (e.code !== "Space" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName))) return;
    e.preventDefault();
    manualStep(1);
  });
  const requested = new URLSearchParams(location.search).get("slide") || "today";
  show(requested, false);
  setInterval(() => {
    updateNav();
    if (!automatic) return;
    if (blocked()) { wasBusy = true; return; }
    if (wasBusy) {
      wasBusy = false;
      deadline = performance.now() + HOLD_MS;
      return;
    }
    if (!allowed().includes(current)) { show("today"); return; }
    if (performance.now() >= deadline) next();
  }, 200);
  window.DashboardRotation = Object.freeze({
    current: () => current,
    isAutomatic: () => automatic,
    allowed: () => allowed().slice()
  });
})();
