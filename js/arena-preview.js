/* Local preview only: index.html?preview=1. Never used by the live feed. */
window.ArenaPreview = (() => {
  const enabled = new URLSearchParams(location.search).get("preview") === "1";
  let step = 0;
  const anchor = Date.now();
  function stamp(offset) {
    const d = new Date(anchor - 6 * 3600000 - offset * 60000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  }
  function snapshot() {
    const rows = [
      [stamp(1), "LOYALTY", "PREVIEW-005", "Carlos Macias", "$599.00"],
      [stamp(12), "PREMIER", "PREVIEW-004", "Sergio Garcia", "$998.00"],
      [stamp(25), "PREMIER", "PREVIEW-003", "Erick Ramos", "$499.00"],
      [stamp(32), "LOYALTY", "PREVIEW-002", "Carlos Macias", "$499.00"],
      [stamp(40), "BALFER", "PREVIEW-001", "Paulina Macedo", "$540.00"],
    ];
    const values = { ELITE: 0, PREMIER: 1497, BALFER: 540, LOYALTY: 1098 };
    if (step >= 1) {
      rows.unshift([
        stamp(0),
        "LOYALTY",
        "PREVIEW-006",
        "Carlos Macias",
        "$699.00",
      ]);
      values.LOYALTY += 699;
    }
    if (step >= 2) {
      rows.unshift([
        stamp(0),
        "PREMIER",
        "PREVIEW-007",
        "Sergio Garcia",
        "$599.00",
      ]);
      values.PREMIER += 599;
    }
    const volume = Object.values(values).reduce((a, b) => a + b, 0);
    return {
      hasSales: true,
      maintenance: false,
      metrics: [rows.length, volume, volume / rows.length],
      closer: {
        name: step >= 2 ? "Sergio Garcia" : "Carlos Macias",
        meta:
          step >= 2
            ? "2 sales | $1,597.00"
            : step >= 1
              ? "3 sales | $1,797.00"
              : "2 sales | $1,098.00",
        unit: step >= 2 ? "PREMIER" : "LOYALTY",
        photo: "",
      },
      chart: Object.entries(values),
      sales: rows,
      slides: [],
    };
  }
  return {
    enabled,
    snapshot,
    next() {
      step = (step + 1) % 3;
      return snapshot();
    },
  };
})();
