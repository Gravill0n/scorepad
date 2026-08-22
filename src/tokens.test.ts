import { readFileSync } from "node:fs";

// Paths are relative to the vitest root. Deliberately not
// `new URL(..., import.meta.url)`: vite rewrites that pattern into an asset
// URL, and node:fs then rejects it for not being file://.
const read = (path: string) => readFileSync(path, "utf8");

it("src/tokens.css is byte-identical to the design bundle", () => {
	expect(read("src/tokens.css")).toBe(
		read("docs/design_handoff_scorepad/tokens.css"),
	);
});
