# CLAUDE.md

Scorepad — an offline, phone-first board game scorepad. React 19 + TanStack Start (SPA, no
server output), IndexedDB, Tailwind 4, Paraglide (`en`/`fr`), Biome, Bun.

## Read before you write

[`docs/spec/SPEC.md`](docs/spec/SPEC.md) is the source of truth, with
[`template-grammar.md`](docs/spec/template-grammar.md) and
[`data-model.md`](docs/spec/data-model.md) beside it. The design is settled: sixteen
artboards in [`docs/design_handoff_scorepad/`](docs/design_handoff_scorepad/README.md), and
every screen section in the spec cites the artboard it implements. **Load the relevant
spec section and artboard before touching a screen** — don't infer the layout from
neighbouring code.

If the spec is wrong, say so and change the spec first. It is a living document, not
documentation written after the fact.

The decisions the spec left to implementation are recorded as ADRs in
[`docs/decisions/`](docs/decisions/README.md) — read one before re-deciding what it settled.
[`docs/success-criteria.md`](docs/success-criteria.md) says which of the fourteen criteria
are verified, by which test, and which three still need a browser.

## Commands

```bash
bun install
bun dev              # vite dev --port 3000
bun run build        # static bundle + 404.html, no server entry
bun run test         # vitest run (`bun test` runs Bun's own runner, not vitest)
bun run lint         # biome check .
bun run lint:fix     # biome check --write .
bun run icons        # regenerate the app icon from tokens.css
```

Deploying is a push to `main`: the workflow gates on lint, types, tests and build, then
publishes to GitHub Pages under `/scorepad/`. The sub-path is written once, as `BASE_PATH`
in the workflow — everything else derives from `import.meta.env.BASE_URL`.

Run `bun run lint` and `bun run test` before committing.

## Architecture

`shared (components, hooks, lib, types, utils) → features → app`. The app layer may import
features and shared; features may import shared; **shared imports neither**.

- `features/sessions` and `features/scoresheet` never import each other. Anything both need
  moves to `lib/`, `types/` or `utils/`.
- No barrel files — import modules and JSON directly.
- `lib/scoring.ts` and `lib/templates/validate.ts` import no React, no DB, no `features/`.
  Pure functions over plain data.

Nothing enforces this but review. It is deliberate: Biome can't express a directory-scoped
directional rule and a second linter isn't worth four bullet points. Don't route around it —
injecting a function from the app layer to dodge a move is routing around it. When a second
feature needs something, move it to `lib/`; that has happened twice already
([ADR-006](docs/decisions/006-session-store-in-lib.md)).

## Code style

Biome: tabs, double quotes, organised imports. Named exports only, arrow-function consts,
`@/` path alias. `type` for data shapes, `interface` only when extending. No `any`. Missing
data resolves to a defined zero rather than letting `undefined` propagate.

Tests colocate: `scoring.ts` → `scoring.test.ts`.

## Design rules

Tokens live in `src/tokens.css`, copied verbatim from the design bundle. **A literal hex,
px height, radius or ms duration in a component is a bug** — take it from a token.

- Body type ≥ 16px. Anything interactive ≥ 44px tall. Any recomputing figure gets tabular
  numerals (`.num`).
- Hairlines are the only elevation. Shadows are for bottom sheets and nothing else.
- Two signal colours: accent and alarm. `--color-advisory` is a note, not a signal.
- A player colour is an **index 1–12**, never a hex in the database, and the token always
  carries the player's initial.
- Size every container for the French string. Validation banners and buttons are
  auto-height, never fixed pills.

**Not every token is a Tailwind utility.** Tailwind 4 only picks up the namespaces it
knows, and a class built on the others compiles to *nothing* — silently, with a green
build. Verified against the compiled CSS:

| Tokens | How to use them |
|---|---|
| `--color-*`, `--text-*`, `--tracking-*`, `--font-*`, `--radius-*`, `--shadow-*` | Direct: `bg-paper`, `text-eyebrow`, `rounded-card`, `shadow-sheet` |
| `--h-*`, `--weight-*`, `--dur-*`, `--ease` | Arbitrary value: `h-[var(--h-tap)]`, `font-[var(--weight-semi)]`, `duration-[var(--dur-sheet)]` |
| `--space-*` | Already Tailwind's default 4px scale — `p-4` **is** `--space-4`. Don't "fix" these. |

`font-semi` and `h-primary` look right, lint clean and do nothing. If a style has no
effect, check this table first — and verify a new class against the compiled CSS
(`dist/client/assets/*.css`) rather than trusting it. `contracts.test.tsx` holds the other
half: no literal colour, font size or duration in a component, and every font size from the
nine-step scale.
- Bottom sheets are the only overlay. The one dialog in the app confirms deleting a session.
- Every screen fits 390 × 844 in French at its worst-case player count. Only Home's list
  and Hand history scroll.

## Things that are easy to get wrong

- **`divideBy` is integer division with `Math.floor`.** Never a fractional multiplier — an
  early draft used `0.3333` for 7 Wonders coins and it is wrong at the first case. There's
  a dedicated regression test; keep it passing.
- **Rows never reorder while scoring.** Rank is a number in the margin. Sorting happens
  exactly once, on Results.
- **A tie stays a tie.** Show `tiebreakNote`, resolve nothing, never invent a winner.
- **`handTotal` is advisory.** The balance counter on the entry sheet does the arithmetic;
  it never blocks the save. Shooting the moon is a legal unbalanced hand.
- **Passing `targetScore` never ends a game.** Mark the crossing and stay out of the way.
- **Every cell edit persists immediately.** There is no save action anywhere — which is
  *why* an unbalanced hand can't be refused: there is nothing to refuse.
- **An empty cell is absent from the round, not stored as zero**, and a trailing hand nobody
  entered is dropped. Otherwise a hand opened and cleared leaves a phantom row in the ledger
  and the hand counter one ahead of the table.
- **Ids come from `utils/newId`, never `crypto.randomUUID` directly.** That API exists only
  in a secure context, so it is undefined over `http://<lan-ip>:3000` — which is how this
  app gets tested on an actual phone — and missing from Safari before 15.4 on any origin.
- **The entry surface always names whose number is being typed, and the primary button
  always names who's next.** That's the whole pass-the-phone affordance.

## Ask first

- Adding any dependency.
- Adding a field to the template grammar — each one is a permanent compatibility surface.
- Introducing a network call. v1's entire architecture rests on there being none.
- Changing the IndexedDB schema shape.
- Adding a token, or a third signal colour.
- Departing from an artboard. The artboards are the spec; a deviation is a design change,
  not an implementation detail.

## Never

- Reintroduce sync, rooms, participants, or server-authoritative state.
- Let a template edit retroactively change a finished session's score.
- Silently drop a category a session was created with.
- Auto-resolve a tie, or end a game automatically.
- Use the system keyboard for score entry.
- Use a player colour as a status, or accent/alarm as a player colour.
- Commit secrets, or remove a failing test instead of fixing it.
