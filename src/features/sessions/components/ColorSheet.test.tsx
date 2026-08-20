import { fireEvent, render, screen } from "@testing-library/react";
import { PALETTE_SIZE } from "@/utils/playerColor";
import { ColorSheet } from "./ColorSheet";

const swatches = () =>
	screen.getAllByRole("button").filter((button) => {
		const label = button.getAttribute("aria-label") ?? "";
		return label.startsWith("Colour ");
	});

const renderSheet = (props: Partial<Parameters<typeof ColorSheet>[0]> = {}) => {
	const onPick = vi.fn();
	const onClose = vi.fn();
	render(
		<ColorSheet
			name="Marie"
			colorIndex={3}
			taken={[1, 3]}
			onPick={onPick}
			onClose={onClose}
			{...props}
		/>,
	);
	return { onPick, onClose };
};

describe("the colour sheet", () => {
	it("shows the whole palette, so the comparison is on screen", () => {
		renderSheet();
		expect(swatches()).toHaveLength(PALETTE_SIZE);
	});

	it("dims a taken colour and refuses it, rather than removing it", () => {
		const { onPick } = renderSheet();
		const taken = screen.getByRole("button", {
			name: "Colour 1, already taken",
		});

		fireEvent.click(taken);

		expect(onPick).not.toHaveBeenCalled();
		// Still in the grid, in its own position: nothing reflows under a thumb.
		expect(swatches()).toHaveLength(PALETTE_SIZE);
		expect(swatches().indexOf(taken)).toBe(0);
		expect(taken.className).toContain("opacity-32");
	});

	it("leaves the player's own colour selectable", () => {
		const { onPick } = renderSheet();
		const own = screen.getByRole("button", { name: "Colour 3" });
		expect(own.getAttribute("aria-pressed")).toBe("true");

		fireEvent.click(own);
		expect(onPick).toHaveBeenCalledWith(3);
	});

	it("hands back the index that was tapped", () => {
		const { onPick } = renderSheet();
		fireEvent.click(screen.getByRole("button", { name: "Colour 7" }));
		expect(onPick).toHaveBeenCalledWith(7);
	});

	it("carries the player's initial on every swatch, not colour alone", () => {
		renderSheet();
		// Twelve swatches plus the token in the sheet header.
		expect(screen.getAllByText("M").length).toBe(PALETTE_SIZE + 1);
	});

	it("names the player whose colour is being chosen", () => {
		renderSheet();
		expect(
			screen.getByRole("heading", { name: "Marie's colour" }),
		).toBeDefined();
	});

	it("asks plainly when the row has no name yet", () => {
		renderSheet({ name: "" });
		expect(
			screen.getByRole("heading", { name: "Choose a colour" }),
		).toBeDefined();
	});
});
