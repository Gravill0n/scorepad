# Success criteria — walkthrough

The fourteen criteria in [`spec/SPEC.md`](spec/SPEC.md), each marked with how it was
verified. **Ten pass automatically, one passes by inspection, and three cannot be verified
without a browser on the deployed origin.** Those three are not failures — they are
unverified, and saying so is the point of this table.

Last walked: 2026-08-22, at the end of phase 8. `bun run test` — 675 tests, 47 files.

| # | Criterion | Verdict | Verified by |
|---|---|---|---|
| 1 | Build emits a static bundle, no server entry | ✅ pass | `bun run build` drops `dist/server`; the deploy workflow re-asserts `test ! -e dist/server` before publishing, so the host enforces it too. Pinned by `lib/deploy.test.ts` |
| 2 | All seed templates validate and score a hand-checked fixture | ✅ pass | `lib/templates/templates.test.ts` — iterates **all eleven** registered templates, including a multi-round Belote fixture and a `win: "lowest"` Black Lady one. A template without a fixture fails the suite |
| 3 | `divideBy: 3` equals `Math.floor(n/3)` for 0–10000 | ✅ pass | `lib/scoring.test.ts` — the dedicated regression test, never deleted |
| 4 | Offline from first paint after install: create, score, finish, reload, **zero network requests** | ⚠️ **unverified** | The *logic* half passes: `routes/sheetGame.flow.test.tsx` and `routes/tallyGame.flow.test.tsx` walk whole games with `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` and `sendBeacon` all stubbed, and none is ever called. The **devtools half — offline from first paint, on a real origin, network panel recording — needs a browser** |
| 5 | Export → wipe → import → restored byte-identical | ✅ pass | `lib/backup.test.ts` |
| 6 | A 24-cell Wingspan sheet without losing focus, reordering, or a save action | ✅ pass | `routes/sheetGame.flow.test.tsx` — all 24 cells through the real route tree, then a reload |
| 7 | 15-hand Belote accumulates and persists; force-quit after hand 12 loses nothing | ✅ pass | `features/scoresheet/components/HandHistory.test.tsx` — the database is closed and the store dropped mid-evening, which is what a force-quit does |
| 8 | `navigator.storage.persist()` is called and its result observable | ✅ pass | `features/sessions/api/startSession.test.ts` — called on create, the boolean logged, and deliberately **not awaited into the navigation**: a slow permission prompt must not stand between somebody and the first hand |
| 9 | Installable: valid manifest, service worker, offline cold start | ⚠️ **partly unverified** | `lib/pwa.test.ts` checks the manifest parses with a scope, a start URL and `display: standalone`; that each icon is a real PNG at the size it claims, read from its own IHDR; and that the worker versions its cache and answers only same-origin GETs. **A real install and an offline cold start need a browser** |
| 10 | Every screen fits 390 × 844 in French at its worst-case count, frame unscrolled | ❌ **not verified** | `routes/french.test.tsx` renders all seven worst-case screens in French, and `routes/contracts.test.tsx` asserts everything about them that does not need a box measured. **The fit itself needs a layout engine.** jsdom has none and no browser is configured. This is the criterion five earlier checkpoints deferred to task 32, which could not do it either |
| 11 | 4.5:1 in both themes for body text and every player token; accent primary carries ink in dark | ✅ pass | `tokens.contrast.test.ts` — computed, not eyeballed: the palette is read out of `tokens.css` and `oklch()` converted through Oklab to linear sRGB. 24 token/ink pairs. The conversion is pinned by its own fixed points (black on white at exactly 21:1) |
| 12 | A 10-player Uno hand end to end from one sheet; jumping back preserves players 4–9 | ✅ pass | `features/scoresheet/components/EntrySheet.test.tsx` — exactly one `<dialog>` asserted at every hand-over |
| 13 | Nothing interactive under 44px; no body type under 16px | ✅ / 🔍 | **The 44px half passes automatically**: `routes/contracts.test.tsx` resolves every interactive element's height utility back to its pixel value in `tokens.css`, through ancestors, and checks it against `--h-tap`. **The 16px half is a slot judgment** — the scale sanctions 13px for notes and captions in `--text-meta`'s own comment — so what is asserted is that the nine-step scale is *closed*: every size in the app is a token and nothing is arbitrary. Which slot counts as "body" is human review |
| 14 | Theme and locale persist across a reload; an untouched install follows the OS | ✅ pass | `app/provider.test.tsx` |

## What is owed to a browser

Four things, and they are all the same errand — one session on the deployed URL:

1. **Criterion 10** — every screen at 390 × 844 in French, worst-case player count, frame
   unscrolled. Seven screens.
2. **Criterion 4** — devtools offline from first paint, network panel recording, through a
   whole game.
3. **Criterion 9** — install from the URL, then cold-start offline.
4. **A hard reload on `/scorepad/session/<id>`** rendering the session rather than a 404 —
   the `404.html` mechanism, which is only exercised by a real static host.

Plus the one thing that was never automatable: **a human comparing the screens to the
sixteen artboards.** `SPEC.md` chose that over screenshot diffing deliberately.

## What is owed to the designer

Departures and gaps accumulated across the build, all recorded in
[`plan/IMPLEMENTATION.md`](plan/IMPLEMENTATION.md) beside the task that made them. The
substantive ones:

- **`1n` / `1o` gain a fourth footer action** and the paired row becomes three-up
  ([ADR-007](decisions/007-play-again-on-results.md)) — and the icons on `Reopen` and
  `Export` come off to make room for French.
- **The install card is not drawn anywhere.** `SPEC.md` requires the Add-to-Home-Screen
  prompt as a durability mitigation and the artboards predate it; it borrows the backup
  card's shape rather than inventing a second one.
- **The entry sheet's keypad is 60px keys at 8px gaps**, not `2c`'s 52 / 7 — one shared
  `Keypad` component rather than two pixel sets.
- **Density tier type sizes snap to the token scale.** `tokens.css` ships no density tokens,
  so the standings' 52 / 38 / 26 totals become `--text-total` / `--text-category` /
  `--text-cell`. Three distinct steps, and the spec's "never below 26" holds exactly.
- **Hand history's footer** reads `{n} hands · Tap a cell to fix` rather than `2d`'s
  `HANDS 7–14 · SCROLL UP FOR EARLIER`; the live range needs scroll measurement.
- `1f` should lose the literal "ten" from its filter placeholder, and `1g` the
  `Add a custom game` button — both cut from v1.
- `tokens.css`'s header comment still cites "HeroUI overrides". HeroUI is gone, and the file
  is copied byte-identically into `src/`, so the stale line is deliberate.
