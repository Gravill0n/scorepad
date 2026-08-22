import { render, screen } from "@testing-library/react";
import { AppProvider } from "@/app/provider";
import { BackupCard } from "./BackupCard";

const renderCard = (lastExportedAt: string | null, count = 5) =>
	render(
		<AppProvider>
			<BackupCard
				sessionCount={count}
				lastExportedAt={lastExportedAt}
				onExported={() => undefined}
			/>
		</AppProvider>,
	);

const daysAgo = (days: number) =>
	new Date(Date.now() - days * 86_400_000).toISOString();

beforeEach(() => {
	vi.stubGlobal("matchMedia", () => ({
		matches: false,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("BackupCard", () => {
	it("reads NEVER when nothing has been exported", async () => {
		renderCard(null);
		expect(await screen.findByText("Never")).toBeDefined();
	});

	it("counts the games that live on this phone only", async () => {
		renderCard(null, 5);
		expect(
			await screen.findByText(/5 games live on this phone only/),
		).toBeDefined();
	});

	it("stamps a recent export in accent", async () => {
		renderCard(daysAgo(4));
		const stamp = await screen.findByText(/4 days ago/);
		expect(stamp.className).toContain("text-accent");
	});

	it("turns advisory past a fortnight", async () => {
		renderCard(daysAgo(15));
		const stamp = await screen.findByText(/15 days ago/);
		expect(stamp.className).toContain("text-advisory");
	});

	it("treats a never-exported phone as overdue, not as fine", async () => {
		renderCard(null);
		const stamp = await screen.findByText("Never");
		expect(stamp.className).toContain("text-advisory");
	});

	it("offers export and import side by side", async () => {
		renderCard(null);
		expect(await screen.findByRole("button", { name: /Export/ })).toBeDefined();
		expect(screen.getByRole("button", { name: /^Import$/ })).toBeDefined();
	});
});
