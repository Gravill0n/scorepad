import { templates } from "@/lib/templates/registry";
import type { Template } from "@/types/template";
import {
	addRow,
	fillFirstEmpty,
	initialRows,
	moveRow,
	recolorRow,
	removeRow,
	renameRow,
	type SetupRow,
} from "./setupRows";

const find = (id: string): Template => {
	const template = templates.find((candidate) => candidate.id === id);
	if (!template) throw new Error(`no template "${id}"`);
	return template;
};

const names = (rows: SetupRow[]) => rows.map((row) => row.name);
const colors = (rows: SetupRow[]) => rows.map((row) => row.colorIndex);

describe("the rows a setup screen opens with", () => {
	it("never opens with one row, even when a game allows solo play", () => {
		expect(initialRows(find("wingspan"))).toHaveLength(2);
	});

	it("opens with the exact count a team game demands", () => {
		expect(initialRows(find("belote"))).toHaveLength(2);
	});

	it("hands colours out in palette order", () => {
		expect(colors(initialRows(find("uno")))).toEqual([1, 2]);
	});
});

describe("editing the rows", () => {
	const two = (): SetupRow[] => [
		{ id: "a", name: "", colorIndex: 1 },
		{ id: "b", name: "", colorIndex: 2 },
	];

	it("gives an added row the next free colour", () => {
		expect(colors(addRow(two()))).toEqual([1, 2, 3]);
	});

	it("reuses a colour freed by a removed row", () => {
		const left = removeRow(two(), "a");
		expect(colors(addRow(left))).toEqual([2, 1]);
	});

	it("fills the first empty row from a recent name before adding one", () => {
		const rows = fillFirstEmpty(fillFirstEmpty(two(), "Marie"), "Luc");
		expect(names(rows)).toEqual(["Marie", "Luc"]);
	});

	it("adds a row once every row is named, so four pills seat four players", () => {
		const rows = ["Marie", "Luc", "Sofia", "Tom"].reduce(fillFirstEmpty, two());
		expect(names(rows)).toEqual(["Marie", "Luc", "Sofia", "Tom"]);
		expect(colors(rows)).toEqual([1, 2, 3, 4]);
	});

	it("keeps the last row rather than emptying the screen", () => {
		const one: SetupRow[] = [{ id: "a", name: "Marie", colorIndex: 1 }];
		expect(removeRow(one, "a")).toEqual(one);
	});

	it("renames and recolours only the row asked for", () => {
		const rows = recolorRow(renameRow(two(), "a", "Marie"), "a", 7);
		expect(rows[0]).toEqual({ id: "a", name: "Marie", colorIndex: 7 });
		expect(rows[1]).toEqual({ id: "b", name: "", colorIndex: 2 });
	});
});

describe("reordering", () => {
	const three: SetupRow[] = [
		{ id: "a", name: "Marie", colorIndex: 1 },
		{ id: "b", name: "Luc", colorIndex: 2 },
		{ id: "c", name: "Sofia", colorIndex: 3 },
	];

	it("moves a row down without touching anything else", () => {
		const rows = moveRow(three, 0, 2);
		expect(names(rows)).toEqual(["Luc", "Sofia", "Marie"]);
		// The colour rides with the row: reorder rewrites order and nothing else.
		expect(colors(rows)).toEqual([2, 3, 1]);
	});

	it("moves a row up", () => {
		expect(names(moveRow(three, 2, 0))).toEqual(["Sofia", "Marie", "Luc"]);
	});

	it("leaves the list alone when the move goes nowhere", () => {
		expect(moveRow(three, 1, 1)).toBe(three);
		expect(moveRow(three, 1, 9)).toBe(three);
	});
});

/**
 * Reported from a real phone: `/new/players` threw
 * `crypto.randomUUID is not a function`. It exists only in a **secure
 * context**, so it is absent over `http://<lan-ip>:3000` — the way a
 * phone-first app is actually tested — and absent from Safari before 15.4 on
 * any origin. Every id in the app now goes through `utils/newId`.
 */
describe("without crypto.randomUUID, as on a phone over the LAN", () => {
	const withoutRandomUUID = <T>(run: () => T): T => {
		const real = crypto.randomUUID;
		// @ts-expect-error — reproducing a non-secure context.
		crypto.randomUUID = undefined;
		try {
			return run();
		} finally {
			crypto.randomUUID = real;
		}
	};

	it("still opens the setup screen with its rows", () => {
		const rows = withoutRandomUUID(() => initialRows(find("wingspan")));
		expect(rows).toHaveLength(2);
		expect(rows.every((row) => row.id !== "")).toBe(true);
	});

	it("still adds a row, with an id of its own", () => {
		const rows = withoutRandomUUID(() => addRow(initialRows(find("counter"))));
		expect(rows).toHaveLength(3);
		expect(new Set(rows.map((row) => row.id)).size).toBe(3);
	});
});
