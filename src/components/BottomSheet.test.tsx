import { fireEvent, render, screen } from "@testing-library/react";
import { BottomSheet } from "./BottomSheet";

const renderSheet = () => {
	const onClose = vi.fn();
	const { container } = render(
		<BottomSheet title="Marie's colour" onClose={onClose}>
			<p>swatches</p>
		</BottomSheet>,
	);
	const dialog = screen.getByRole("dialog");
	const panel = container.querySelector("[class*='rounded-t-card']");
	if (!panel) throw new Error("no sheet panel");

	/** jsdom runs no animations, so the exit has to be reported by hand. */
	const settle = () => fireEvent.animationEnd(panel);
	return { onClose, dialog, settle };
};

describe("the bottom sheet", () => {
	it("opens as a modal, so everything behind it is inert", () => {
		const { dialog } = renderSheet();
		expect((dialog as HTMLDialogElement).open).toBe(true);
		expect(screen.getByText("swatches")).toBeDefined();
	});

	it("closes on the × once the exit animation has run", () => {
		const { onClose, settle } = renderSheet();
		fireEvent.click(screen.getByRole("button", { name: "Close" }));

		// Not before: unmounting on the tap would swallow --dur-sheet.
		expect(onClose).not.toHaveBeenCalled();
		settle();
		expect(onClose).toHaveBeenCalled();
	});

	it("closes on a tap outside the panel", () => {
		const { onClose, dialog, settle } = renderSheet();
		fireEvent.click(dialog);
		settle();
		expect(onClose).toHaveBeenCalled();
	});

	it("keeps a tap inside the panel from dismissing it", () => {
		const { onClose, settle } = renderSheet();
		fireEvent.click(screen.getByText("swatches"));
		settle();
		expect(onClose).not.toHaveBeenCalled();
	});

	it("closes on Esc, which the browser gives us for free", () => {
		const { onClose, dialog, settle } = renderSheet();
		fireEvent(dialog, new Event("cancel", { cancelable: true }));
		settle();
		expect(onClose).toHaveBeenCalled();
	});

	it("takes its motion from the tokens rather than a literal duration", () => {
		const { dialog } = renderSheet();
		const panel = dialog.querySelector<HTMLElement>(
			"[class*='rounded-t-card']",
		);
		expect(panel?.style.animation).toContain("var(--dur-sheet)");
		expect(panel?.style.animation).toContain("var(--ease)");
	});
});
