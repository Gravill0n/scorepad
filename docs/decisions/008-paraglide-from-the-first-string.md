# ADR-008: Paraglide from the first string

## Status
Accepted

## Date
2026-08-19

## Context
The app ships in English and French, and `SPEC.md` calls French **a layout constraint, not a
translation pass** — every container is sized for the French string.

## Decision
Write `m.some_message()` from the first screen. French copy lands alongside English in each
screen's own task; the layout audit is a later task, the message calls are not.

## Alternatives considered

### Build in English, retrofit i18n at the end
- Pros: faster first screens.
- Cons: a whole-tree diff at the worst moment, and every container sized for English —
  which is the specific failure the spec names.
- Rejected.

## Consequences
- The scaffold's `url` locale strategy was wrong for this app: locale lives in `meta`, not in
  a path, and one of the six routes is a session id. The strategy is
  `["globalVariable", "preferredLanguage", "baseLocale"]`.
- **`babel-plugin-react-compiler` caches every `m.*()` call for the life of a component
  instance** — the call takes no reactive input, so a re-render reuses the first string it
  computed. The locale is applied at the moment of the tap and the tree is keyed on it, which
  drops the cache. Re-passing the locale per call is *not* the fix and would be the
  whole-tree diff this decision exists to avoid.
- Plurals are message **variants**, so `Intl.PluralRules` decides per locale and neither
  language carries a hand-written rule. French agrees nouns English leaves alone, so it has
  more variants; a message may carry variants in one locale and stay a plain string in the
  other.
