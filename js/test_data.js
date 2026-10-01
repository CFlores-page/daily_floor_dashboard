const TEST_MODE = true;

const TEST_DATA = {
  maintenance: false,
  hasSalesToday: true,

  metrics: {
    sales: 4,
    volume: 2137,
    average: 534.25
  },

  topCloser: {
    name: "BRAYAN ROMERO",
    meta: "1 sale | $599.00",
    photo: "",
    campaign: "ELITE"
  },

  sales: [
    ["10/1/2026 11:45:08", "ELITE", "TOG4-0000-0-JV", "ROMERO VAZQUEZ BRAYAN JONATHAN", "$599.00"],
    ["10/1/2026 11:30:44", "LOYALTY", "SOMLY-0000-0-CG", "MACIAS GOMEZ CARLOS IVAN", "$499.00"],
    ["10/1/2026 10:26:00", "ELITE", "SOMA-0000-0-AM", "MENDOZA CASTELAN ANGEL", "$499.00"],
    ["10/1/2026 09:52:57", "BALFER", "AMX2-0000-0-ZA", "AVILA ACEVES MARIO ALEJANDRO EBETZAID", "$540.00"]
  ],

  chart: [
    ["ELITE", 1098],
    ["PREMIER", 0],
    ["BALFER", 540],
    ["LOYALTY", 499]
  ],

  carousel: [
    {
      type: "Announcement",
      title: "ANNOUNCEMENTS",
      body: "Dashboard running in test mode.",
      subtitle: "Local development",
      background: "",
      imageUrl: "",
      accent: "",
      enabled: true
    }
  ]
};