import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppProvider } from "@/app/provider";
import { closeDatabase, getSession } from "@/lib/db";
import { createSession, loadSessions, useSessions } from "@/lib/sessions";
import { templates } from "@/lib/templates/registry";
import type { Template } from "@/types/template";
import { EntrySheet } from "./EntrySheet";

const uno = templates.find((t) => t.id === "uno") as Template;
const blackLady = templates.find((t) => t.id === "black-lady") as Template;

const wipeDatabase = () =>
	new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => resolve();
	});

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	await loadSessions();
});

/**
 * The sheet reads the session from the store, exactly as the route does — a
 * static prop would never see the writes the sheet itself is making, and
 * jumping back to an earlier player is precisely a read of one of them.
 */
const Harness = ({ id, hand = 0 }: { id: string; hand?: number }) => {
	const session = useSessions().find((candidate) => candidate.id === id);
	if (!session) return null;

	return (
		<AppProvider>
			<EntrySheet session={session} roundIndex={hand} onClose={() => {}} />
		</AppProvider>
	);
};

const startUno = async (count: number) => {
	const session = await createSession({
		template: uno,
		players: Array.from({ length: count }, (_, index) => ({
			name: `P${index + 1}`,
			colorIndex: index + 1,
		})),
	});
	render(<Harness id={session.id} />);
	return session;
};

/** Type a value on the keypad, digit by digit, like a thumb would. */
const type = (value: string) => {
	for (const digit of value) {
		fireEvent.click(screen.getByRole("button", { name: digit }));
	}
};

const handOver = () =>
	fireEvent.click(screen.getByRole("button", { name: /^(Next —|Done)/ }));

describe("walking the table", () => {
	it("names whose number is being typed and who is next", async () => {
		await startUno(3);
		expect(await screen.findByRole("heading", { name: "P1" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Next — P2 →" })).toBeDefined();
	});

	it("enters a ten-player hand without the sheet ever closing", async () => {
		const session = await startUno(10);
		await screen.findByRole("heading", { name: "P1" });

		for (let seat = 1; seat <= 10; seat += 1) {
			// One dialog, opened once: a modal per player would be ten dialogs.
			expect(screen.getAllByRole("dialog")).toHaveLength(1);
			expect(screen.getByRole("heading", { name: `P${seat}` })).toBeDefined();
			type(String(seat));
			handOver();
		}

		await waitFor(async () => {
			const stored = await getSession(session.id);
			expect(stored?.rounds[0]).toEqual(
				Object.fromEntries(
					Array.from({ length: 10 }, (_, index) => [
						session.players[index]?.id,
						{ points: index + 1 },
					]),
				),
			);
		});
	});

	it("reads Done rather than a next player on the last hand-over", async () => {
		await startUno(2);
		await screen.findByRole("heading", { name: "P1" });
		handOver();
		expect(await screen.findByRole("heading", { name: "P2" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Done →" })).toBeDefined();
	});
});

describe("the player strip", () => {
	it("jumps to any player, and keeps every value already entered", async () => {
		await startUno(6);
		await screen.findByRole("heading", { name: "P1" });

		for (const value of ["11", "22", "33", "44", "55"]) {
			type(value);
			handOver();
		}
		// Somebody corrects themselves two players later.
		fireEvent.click(await screen.findByRole("button", { name: "P3, 33" }));
		expect(await screen.findByRole("heading", { name: "P3" })).toBeDefined();

		type("9");
		expect(
			await screen.findByRole("button", { name: "P3, 339" }),
		).toBeDefined();

		// Players 4 and 5 are untouched by the jump back.
		expect(await screen.findByRole("button", { name: "P4, 44" })).toBeDefined();
		expect(await screen.findByRole("button", { name: "P5, 55" })).toBeDefined();
		expect(
			await screen.findByRole("button", { name: "P6, not entered" }),
		).toBeDefined();
	});

	it("shows an em-dash for a player nobody has entered, not a zero", async () => {
		await startUno(3);
		// The token's initial rides along in the text; the value is the em-dash,
		// and specifically not a zero.
		const tile = await screen.findByRole("button", { name: "P2, not entered" });
		expect(tile.textContent).toContain("—");
		expect(tile.textContent).not.toContain("0");
	});
});

describe("fixed-total hands", () => {
	const startBlackLady = async () => {
		const session = await createSession({
			template: blackLady,
			players: [
				{ name: "Marie", colorIndex: 1 },
				{ name: "Luc", colorIndex: 2 },
				{ name: "Sofia", colorIndex: 3 },
			],
		});
		render(<Harness id={session.id} />);
		await screen.findByRole("heading", { name: "Marie" });
		return session;
	};

	it("counts what is still to be placed, as an advisory line", async () => {
		await startBlackLady();
		expect(screen.getByText("Hand 1 · 26 to place · 0 placed")).toBeDefined();

		type("20");
		expect(
			await screen.findByText("Hand 1 · 26 to place · 20 placed"),
		).toBeDefined();
	});

	it("renders no such clause for a template without a fixed total", async () => {
		await startUno(3);
		expect(await screen.findByText("Hand 1")).toBeDefined();
		expect(screen.queryByText(/to place/)).toBeNull();
	});

	/**
	 * The counter above and this are asserted apart on purpose, so nobody
	 * re-couples them: shooting the moon is legal play, and the entry surface
	 * does the arithmetic without vetoing the table.
	 */
	it("saves a hand that does not balance — the moon is legal play", async () => {
		const session = await startBlackLady();

		type("26");
		handOver();
		await screen.findByRole("heading", { name: "Luc" });
		type("26");
		handOver();
		await screen.findByRole("heading", { name: "Sofia" });
		type("0");

		// 52 placed against a hand total of 26, and it is on disk anyway.
		expect(
			await screen.findByText("Hand 1 · 26 to place · 52 placed"),
		).toBeDefined();

		await waitFor(async () => {
			const stored = await getSession(session.id);
			const marie = session.players[0]?.id ?? "";
			const sofia = session.players[2]?.id ?? "";
			expect(stored?.rounds[0]?.[marie]).toEqual({ penalty: 26 });
			expect(stored?.rounds[0]?.[sofia]).toEqual({ penalty: 0 });
		});
	});
});

describe("persistence", () => {
	it("writes every keystroke, with no save action anywhere", async () => {
		const session = await startUno(2);
		await screen.findByRole("heading", { name: "P1" });

		type("4");
		await waitFor(async () => {
			const stored = await getSession(session.id);
			expect(stored?.rounds[0]?.[session.players[0]?.id ?? ""]).toEqual({
				points: 4,
			});
		});

		type("2");
		await waitFor(async () => {
			const stored = await getSession(session.id);
			expect(stored?.rounds[0]?.[session.players[0]?.id ?? ""]).toEqual({
				points: 42,
			});
		});

		expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
	});
});
