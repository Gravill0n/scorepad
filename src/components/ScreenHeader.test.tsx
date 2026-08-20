import { render, screen } from "@testing-library/react";
import { Eyebrow } from "./Eyebrow";
import { ScreenHeader } from "./ScreenHeader";

describe("ScreenHeader", () => {
	it("renders the title as the screen's heading", () => {
		render(<ScreenHeader title="Choose a game" />);
		expect(
			screen.getByRole("heading", { name: "Choose a game" }),
		).toBeDefined();
	});

	it("is a banner landmark, so the band is navigable", () => {
		render(<ScreenHeader title="Scorepad" />);
		expect(screen.getByRole("banner")).toBeDefined();
	});

	it("renders a subtitle when a screen has one", () => {
		render(<ScreenHeader title="Belote 12 Apr" subtitle="Belote · 2 teams" />);
		expect(screen.getByText("Belote · 2 teams")).toBeDefined();
	});

	it("renders no subtitle element when a screen has none", () => {
		const { container } = render(<ScreenHeader title="Scorepad" />);
		expect(container.querySelectorAll("p")).toHaveLength(0);
	});

	it("places leading and trailing controls in the band", () => {
		render(
			<ScreenHeader
				title="Players"
				leading={<button type="button">Back</button>}
				trailing={<span>2 / 4</span>}
			/>,
		);
		expect(screen.getByRole("button", { name: "Back" })).toBeDefined();
		expect(screen.getByText("2 / 4")).toBeDefined();
	});

	it("takes its band height from a token rather than a literal", () => {
		const { container } = render(<ScreenHeader title="Scorepad" />);
		const className = container.querySelector("header")?.className ?? "";
		expect(className).toContain("var(--h-primary)");
		expect(className).not.toMatch(/\b(h|min-h)-\[\d/);
	});
});

describe("Eyebrow", () => {
	it("renders its label", () => {
		render(<Eyebrow>In progress</Eyebrow>);
		expect(screen.getByText("In progress")).toBeDefined();
	});

	it("uppercases in CSS rather than in the copy, so French accents survive", () => {
		const { container } = render(<Eyebrow>Terminées · 4</Eyebrow>);
		const element = container.firstElementChild;
		expect(element?.textContent).toBe("Terminées · 4");
		expect(element?.className).toContain("uppercase");
	});

	it("uses the eyebrow type tokens", () => {
		const { container } = render(<Eyebrow>Backup</Eyebrow>);
		const className = container.firstElementChild?.className ?? "";
		expect(className).toContain("text-eyebrow");
		expect(className).toContain("tracking-eyebrow");
		expect(className).toContain("font-mono");
	});
});
