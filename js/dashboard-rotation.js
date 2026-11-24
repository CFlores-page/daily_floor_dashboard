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
  function next() {
    if (blocked()) return;
    const order = allowed();
    show(order[(order.indexOf(current) + 1) % order.length]);
  }
  document.addEventListener("keydown", e => {
    if (e.code !== "KeyB" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
    e.preventDefault();
    next();
  });
  const requested = new URLSearchParams(location.search).get("slide") || "today";
  show(requested, false);
  setInterval(() => {
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
    allowed: () => allowed().slice()
  });
})();
