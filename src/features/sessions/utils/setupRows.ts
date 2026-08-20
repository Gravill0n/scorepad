import type { Template } from "@/types/template";
import { nextColorIndex } from "@/utils/playerColor";

/** A row on the setup screen. `id` is local — the session's ids are minted on create. */
export type SetupRow = { id: string; name: string; colorIndex: number };

const newRow = (rows: SetupRow[], name: string): SetupRow => ({
	id: crypto.randomUUID(),
	name,
	// Palette order, so a four-player table lands on the four hues that stay
	// distinct under every kind of colourblindness.
	colorIndex: nextColorIndex(rows.map((row) => row.colorIndex)),
});

/**
 * What the screen opens with: the template's minimum, but never one row — a
 * solo Wingspan is legal and rare, and two rows is the shape of a game night.
 */
export const initialRows = (template: Template): SetupRow[] => {
	const [min, max] = template.players;
	const count = Math.min(max, Math.max(min, 2));

	return Array.from({ length: count }).reduce<SetupRow[]>(
		(rows) => [...rows, newRow(rows, "")],
		[],
	);
};

export const addRow = (rows: SetupRow[], name = ""): SetupRow[] => [
	...rows,
	newRow(rows, name),
];

/**
 * A recent name fills the first empty row before it adds one, so tapping four
 * pills on a screen that opened with two blank rows is a four-player table and
 * not a six-row list with two holes in it.
 */
export const fillFirstEmpty = (rows: SetupRow[], name: string): SetupRow[] => {
	const empty = rows.findIndex((row) => row.name.trim() === "");
	if (empty === -1) return addRow(rows, name);
	return rows.map((row, index) => (index === empty ? { ...row, name } : row));
};

export const renameRow = (
	rows: SetupRow[],
	id: string,
	name: string,
): SetupRow[] => rows.map((row) => (row.id === id ? { ...row, name } : row));

export const recolorRow = (
	rows: SetupRow[],
	id: string,
	colorIndex: number,
): SetupRow[] =>
	rows.map((row) => (row.id === id ? { ...row, colorIndex } : row));

/** The last row stays: an empty screen has nothing to type into. */
export const removeRow = (rows: SetupRow[], id: string): SetupRow[] =>
	rows.length <= 1 ? rows : rows.filter((row) => row.id !== id);

/** Reorder rewrites nothing but the order. Colours ride with their row. */
export const moveRow = (
	rows: SetupRow[],
	from: number,
	to: number,
): SetupRow[] => {
	const moved = rows[from];
	if (!moved || from === to || to < 0 || to >= rows.length) return rows;

	const rest = rows.filter((_, index) => index !== from);
	return [...rest.slice(0, to), moved, ...rest.slice(to)];
};
