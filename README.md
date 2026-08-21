# Scorepad

A phone-first scorepad that already knows the game you're playing. Pick a title off a
ten-game shelf, name the players, pass the phone around. No account, no server, no network
after the page loads.

It has to beat paper: legible at arm's length, nothing to learn, offline, and fast enough
that nobody reaches for a pencil instead.

**Status:** built through phase 8 — every screen, both scoring modes, French, and the PWA.
Deployment is wired but not yet triggered. Start at
[`docs/spec/SPEC.md`](docs/spec/SPEC.md); the order of work is
[`docs/plan/IMPLEMENTATION.md`](docs/plan/IMPLEMENTATION.md).

## What it does

Two scoring modes cover the whole shelf:

- **Sheet** — a fixed set of categories scored once each, at the end. 7 Wonders, Catan,
  Wingspan, Azul, Ticket to Ride, Splendor. Worst case is 7 categories × 7 players.
- **Tally** — an open-ended run of hands accumulating toward a target. Uno to 500 at up to
  ten players, Belote to 501 in two teams, Whist, Black Lady to 100 where low wins.

They are not two data models: **a sheet is a tally with exactly one round.** One scoring
function, one persistence path, one migration story.

A game is a JSON template, never code — see
[`docs/spec/template-grammar.md`](docs/spec/template-grammar.md). Adding a game costs a
file and a fixture test.

Not in scope: play logging, collection management, statistics. BG Stats does those well;
this competes only on live scoring, where it is weak.

## Getting started

```bash
bun install
bun dev                  # vite dev --port 3000
```

```bash
bun run build            # static bundle + 404.html; no server entry
bun run preview
bun run icons            # regenerate the app icon from tokens.css
bun run test             # vitest run — NOT `bun test`, which runs Bun's own runner
bunx vitest              # watch
bun run lint             # biome check .
bun run lint:fix         # biome check --write .
bun run format           # biome format --write .
```

## Deploying

**Live at [`https://gravill0n.github.io/scorepad/`](https://gravill0n.github.io/scorepad/)**
once the workflow has run on `main` and the one manual step below is done.

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
lint → types → tests → build → publish to GitHub Pages. **Lint and tests gate the deploy** —
a red suite must not reach the URL people install from, because an installed PWA keeps
serving itself from cache and a bad deploy outlives the fix.

The site is a **project page**, so it lives at
`https://gravill0n.github.io/scorepad/` rather than at a domain root. That path is
written once, as `BASE_PATH` in the workflow, and everything else derives from
`import.meta.env.BASE_URL` — the router's basepath, the document head's asset URLs, the
service worker's scope. The manifest and the worker use relative URLs throughout, so they
are correct at any base without being told which one they are on. A custom domain later is
`base` going back to `/`.

Deep links work because the build copies `index.html` to `404.html`. GitHub Pages has no
rewrite rule: it serves a file if one exists and its own 404 otherwise, so a copy of the
shell at `404.html` *is* the rewrite rule. No hash router, no redirect shim, no dependency.

### One manual step, once

**Set the repository's Pages source to "GitHub Actions"** — Settings → Pages → Build and
deployment → Source. Without it the workflow builds green and publishes nothing, which is a
silent failure: the run is a tick and the site is not there.

## Stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start (React 19), SPA mode / static prerendering — **no server output** |
| Routing | TanStack Router, virtual file routes (`src/routes.ts`) |
| Storage | IndexedDB, the only store |
| Styling | Tailwind 4 over `src/tokens.css` |
| i18n | Paraglide (`en`, `fr`) |
| Test | Vitest |
| Lint/format | Biome — tabs, double quotes |
| Package manager | Bun |

There is no backend and no v1 plan for one. Prisma, PostgreSQL, Nitro server output, the
`db:*` scripts and HeroUI all come out; `lucide-react` stays.

## Project structure

[bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md),
scaled down to two features. Full tree in [`docs/spec/SPEC.md`](docs/spec/SPEC.md).

```
src/
├── app/            routes, providers, router construction
├── components/     shared UI — PlayerToken, Keypad, BottomSheet, ValueCell, RaceBar…
├── features/
│   ├── sessions/     home, game picker, player setup, export/import
│   └── scoresheet/   scoring screens, hand history, results
├── lib/            db.ts, scoring.ts, templates/, i18n.ts
├── types/          Template, Category, Session, Player, Round
└── tokens.css      design tokens, copied verbatim from the design bundle
```

### Architectural rules

These are conventions, held by review rather than by a linter. Biome's
`noRestrictedImports` restricts import *sources* and cannot express a directory-scoped
directional rule, and a second linter to police four bullet points costs more than it saves.

- **Unidirectional flow:** `shared (components, hooks, lib, types, utils) → features → app`.
  The app layer may import features and shared; features may import shared; shared imports
  neither.
- **No cross-feature imports.** `features/sessions` and `features/scoresheet` never import
  each other. Anything both need moves to `lib/`, `types/` or `utils/` — which is why the
  scoring engine and the template registry live in `lib/`.
- **No barrel files.** Import modules and JSON directly (tree-shaking).
- **`lib/scoring.ts` and `lib/templates/validate.ts` import no React, no DB, no `features/`.**
  Pure functions over plain data — that purity is what makes scoring exhaustively testable
  without a browser.

Tests are colocated: `scoring.ts` → `scoring.test.ts`.

**Why these are written down twice.** They have no linter behind them — Biome's
`noRestrictedImports` restricts import *sources* and cannot express a directory-scoped
directional rule. Review is the only enforcement, so the rule has to be somewhere a reviewer
and an agent will both read. The reasoning behind each is in
[`docs/decisions/`](docs/decisions/README.md); ADR-006 is the one that has already been
applied twice, when the session store and then the backup module needed a second caller.

## Design

The design pass is complete and lives in
[`docs/design_handoff_scorepad/`](docs/design_handoff_scorepad/README.md): sixteen
artboards at 390 × 844, plus `tokens.css`, which is used **verbatim**. Every screen in
`docs/spec/SPEC.md` cites the artboard it implements (`1c`–`1k`, `1n`–`1p`, `2a`–`2e`).

Contracts that are correctness, not taste — this is read across a table, not at a desk:

- Body type is **16px**, never 14. Anything interactive is **≥ 44px** tall.
- Any figure that recomputes uses **tabular numerals**.
- Hairlines are the only elevation; shadows exist for bottom sheets and nothing else.
- **Two signal colours only** — accent and alarm. A player colour is neither: it's an index
  1–12, and the token always carries the player's initial, because twelve hues don't
  survive colourblind viewing alone.
- **French is a layout constraint, not a translation pass.** Every string slot is sized for
  the French string. Never tighten a container to fit the English.

## Documentation

| Path | What it is |
|---|---|
| [`docs/spec/SPEC.md`](docs/spec/SPEC.md) | Source of truth — objective, stack, structure, every screen, boundaries, success criteria |
| [`docs/spec/template-grammar.md`](docs/spec/template-grammar.md) | The template schema, the scoring rule, all ten seed games |
| [`docs/spec/data-model.md`](docs/spec/data-model.md) | IndexedDB shape, types, what is derived and never stored |
| [`docs/design_handoff_scorepad/`](docs/design_handoff_scorepad/README.md) | The design: artboards, tokens, and the rationale under each decision |
| [`docs/ideas/scoresheet-first.md`](docs/ideas/scoresheet-first.md) | Where the direction came from |
| [`docs/plan/IMPLEMENTATION.md`](docs/plan/IMPLEMENTATION.md) | The order of work, thirty-three tasks in eight phases, with what each one found |
| [`docs/decisions/`](docs/decisions/README.md) | Eight ADRs — the decisions the spec left to implementation, and what was rejected |
| [`docs/success-criteria.md`](docs/success-criteria.md) | All fourteen criteria, each naming the test that verifies it — and the three a browser still has to |
| [`CLAUDE.md`](CLAUDE.md) | Rules for agents working in this repo |
