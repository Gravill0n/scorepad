import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { templates } from "@/lib/templates/registry";
import { EmptyHome } from "./EmptyHome";

/** Link needs a router above it, so the screen is mounted inside a real one. */
const renderScreen = (element: ReactNode) => {
	const root = createRootRoute();
	const home = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => <>{element}</>,
	});
	const picker = createRoute({
		getParentRoute: () => root,
		path: "/new",
		component: () => <p>picker</p>,
	});

	return render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([home, picker]),
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);
};

describe("EmptyHome", () => {
	it("says nothing has been scored yet", async () => {
		renderScreen(<EmptyHome />);
		expect(await screen.findByText("Nothing scored yet")).toBeDefined();
	});

	it("offers New game as a link to the picker", async () => {
		renderScreen(<EmptyHome />);
		const link = await screen.findByRole("link", { name: /New game/ });
		expect(link.getAttribute("href")).toBe("/new");
	});

	it("offers Import a backup, because a fresh device is when you need it", async () => {
		renderScreen(<EmptyHome />);
		expect(
			await screen.findByRole("button", { name: /Import a backup/ }),
		).toBeDefined();
	});

	it("makes the offline promise", async () => {
		renderScreen(<EmptyHome />);
		expect(
			await screen.findByText("No account · No server · Works offline"),
		).toBeDefined();
	});

	it("counts the built-in games from the registry, not from the copy", async () => {
		renderScreen(<EmptyHome />);
		// The artboard says "Ten games"; there are eleven, counter included.
		expect(
			await screen.findByText(
				new RegExp(`${templates.length} games are built in`),
			),
		).toBeDefined();
	});

	it("shows no dialog and no onboarding carousel", async () => {
		const { container } = renderScreen(<EmptyHome />);
		await screen.findByText("Nothing scored yet");

		expect(screen.queryByRole("dialog")).toBeNull();
		expect(container.querySelectorAll("dialog")).toHaveLength(0);
	});

	it("gives every interactive element an accessible name", async () => {
		renderScreen(<EmptyHome />);
		await screen.findByText("Nothing scored yet");

		for (const element of [
			...screen.getAllByRole("link"),
			...screen.getAllByRole("button"),
		]) {
			expect(element.textContent?.trim()).toBeTruthy();
		}
	});

	it("takes its heights from tokens rather than literals", async () => {
		renderScreen(<EmptyHome />);
		const link = await screen.findByRole("link", { name: /New game/ });
		const button = screen.getByRole("button", { name: /Import a backup/ });

		expect(link.className).toContain("var(--h-primary)");
		expect(button.className).toContain("var(--h-cell)");
		expect(link.className).toContain("btn-primary");
	});
});
