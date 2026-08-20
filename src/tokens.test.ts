import { readFileSync } from "node:fs";

const read = (relative: string) =>
	readFileSync(new URL(relative, import.meta.url), "utf8");

it("src/tokens.css is byte-identical to the design bundle", () => {
	expect(read("./tokens.css")).toBe(
		read("../docs/design_handoff_scorepad/tokens.css"),
	);
});
