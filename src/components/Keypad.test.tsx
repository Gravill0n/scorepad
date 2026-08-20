import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Keypad } from "./Keypad";

/** The keypad is controlled, so the test holds the value the way a screen does. */
const Harness = ({ initial = "" }: { initial?: string }) => {
	const [value, setValue] = useState(initial);
	return (
		<>
			<span data-testid="value">{value}</span>
			<Keypad value={value} onChange={setValue} />
		</>
	);
};

const tap = (name: string) =>
	fireEvent.click(screen.getByRole("button", { name }));
const shown = () => screen.getByTestId("value").textContent;

describe("the keypad", () => {
	it("offers ten digits, a sign and a backspace, and no text input", () => {
		const { container } = render(<Harness />);
		expect(screen.getAllByRole("button")).toHaveLength(12);
		// The system keyboard must never be reachable from a score cell.
		expect(container.querySelector("input")).toBeNull();
	});

	it("types a number", () => {
		render(<Harness />);
		tap("3");
		tap("1");
		expect(shown()).toBe("31");
	});

	it("types a negative sign-first, the way 7 Wonders military is called out", () => {
		render(<Harness />);
		tap("Positive or negative");
		tap("6");
		expect(shown()).toBe("-6");
	});

	it("flips the sign of a number already typed", () => {
		render(<Harness initial="12" />);
		tap("Positive or negative");
		expect(shown()).toBe("-12");
		tap("Positive or negative");
		expect(shown()).toBe("12");
	});

	it("deletes one digit at a time and ends empty, not at zero", () => {
		render(<Harness initial="45" />);
		tap("Delete one digit");
		expect(shown()).toBe("4");
		tap("Delete one digit");
		expect(shown()).toBe("");
	});

	it("keeps every key at the thumb floor", () => {
		render(<Harness />);
		for (const key of screen.getAllByRole("button")) {
			expect(key.className).toContain("h-[var(--h-key)]");
		}
	});
});
