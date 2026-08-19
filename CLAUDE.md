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

## Commands

```bash
bun install
bun dev              # vite dev --port 3000
bun run build        # static bundle, no server entry
bun test             # vitest run
bun run lint         # biome check .
bun run lint:fix     # biome check --write .
```

Run `bun run lint` and `bun test` before committing.

## Architecture

`shared (components, hooks, lib, types, utils) → features → app`. The app layer may import
features and shared; features may import shared; **shared imports neither**.

- `features/sessions` and `features/scoresheet` never import each other. Anything both need
  moves to `lib/`, `types/` or `utils/`.
- No barrel files — import modules and JSON directly.
- `lib/scoring.ts` and `lib/templates/validate.ts` import no React, no DB, no `features/`.
  Pure functions over plain data.

Nothing enforces this but review. It is deliberate: Biome can't express a directory-scoped
directional rule and a second linter isn't worth four bullet points. Don't route around it.

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
- **Every cell edit persists immediately.** There is no save action anywhere.
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
