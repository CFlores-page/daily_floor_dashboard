# Sales Arena staging preview

Branch: `staging/sales-arena`. This preview does not change `main`.

Open this folder in VS Code and run Live Server on `index.html`.

- `index.html`: live Google Sheet data, same TODAY tab and cell ranges as the original dashboard.
- `index.html?preview=1`: explicit sample-data mode. Press **Space** to simulate the next sale and an overtake. Press **R** to reset. Preview data never writes to the Sheet. Preview portraits are intentionally unavailable; live mode uses the Sheet's employee photo.

## Behavior

- Four units ranked by dollar volume, with stable tie ordering and true zero-length bars.
- Existing unit colors retained: Elite blue, Premier peach, Balfer green, Loyalty lavender. No invented unit logos.
- Five recent transactions form a horizontal timeline, newest on the left. Full Sheet names are kept; long timeline names truncate and expose their full text on hover.
- New transaction identities (timestamp, unit, certificate) trigger a five-second celebration. Initial loading, repeated polling, and amount/name corrections do not celebrate. Multiple arrivals queue oldest first. The timeline returns when the queue finishes.
- Top Closer uses the existing Sheet name, photo, meta and unit. Photo presentation is controlled by CSS.
- Enabled announcements appear in the bottom strip for eight seconds each minute when it is idle. Title, body, subtitle, background, optional foreground image and campaign accent come from the existing Sheet. New sales interrupt announcements. The TYPE field remains informational, as in the original dashboard.
- Maintenance mode supersedes all content; network failures retain the previous results and mark the feed delayed. Polling is every ten seconds with request timeouts.
- Date and time labels use Mexico City time. When the sheet indicates no sales today, previous results are explicitly labeled.

## Files

- `index.html`: layout and asset entry point.
- `css/arena.css`: all arena styling, unit tokens, responsive rules, reduced-motion support.
- `js/arena.js`: Sheet adapter, rendering, standings, events, timeline and announcements.
- `js/arena-preview.js`: isolated opt-in fixture data.

Original dashboard files and seasonal assets remain in the repository but are not loaded by this staging entry point. No build tooling is required.

## Validation

Chromium desktop checks cover 1920×1080, 1366×768 and mobile width; live-adapter fixtures cover queueing, correction deduplication, maintenance, announcements and feed errors. The CSS uses explicit positioning rather than `inset`, and effects primarily animate transform/opacity. Actual Samsung Tizen 6.5 / Chromium 85 verification remains required; modern Chromium is not a TV emulator.

The elapsed timer uses canonical GViz datetime components in the workbook's verified Mexico City timezone (UTC-6), with formatted timestamps supported as a fallback. It continues across midnight and refreshes immediately after loading. Future timestamps show “Sale time is ahead” rather than a fabricated zero; check the source timestamp and device clock if this appears.

### Temporary source clock correction

The source sales timestamps are currently reported one hour ahead. `SOURCE_CLOCK_AHEAD_MINUTES = 60` in `js/arena.js` subtracts that hour once, when live timestamps are parsed. The corrected instant drives both the timeline and elapsed timer, including date boundaries and event detection. Sample preview timestamps already use real time and bypass this correction. After the upstream clock is repaired, set the constant to `0` to prevent a double correction. No Sheet values are modified.
