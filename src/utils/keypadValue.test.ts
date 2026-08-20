import {
	backspace,
	fromNumber,
	MAX_DIGITS,
	pressDigit,
	toggleSign,
	toNumber,
} from "./keypadValue";

describe("typing digits", () => {
	it("starts a value from empty", () => {
		expect(pressDigit("", "7")).toBe("7");
	});

	it("appends", () => {
		expect(pressDigit("4", "2")).toBe("42");
	});

	it("replaces a lone zero rather than keeping a leading zero", () => {
		expect(pressDigit("0", "5")).toBe("5");
		expect(pressDigit("-0", "5")).toBe("-5");
	});

	it("keeps a zero that follows a real digit", () => {
		expect(pressDigit("1", "0")).toBe("10");
	});

	it("keeps the minus while digits are added", () => {
		expect(pressDigit("-", "3")).toBe("-3");
		expect(pressDigit("-3", "1")).toBe("-31");
	});

	it("stops at the digit cap rather than breaking the readout", () => {
		const full = "9".repeat(MAX_DIGITS);
		expect(pressDigit(full, "9")).toBe(full);
		expect(pressDigit(`-${full}`, "9")).toBe(`-${full}`);
	});
});

describe("the sign key", () => {
	// Every value shape, because a mis-tap here costs data.
	it.each([
		["", "-"],
		["-", ""],
		["0", "-0"],
		["-0", "0"],
		["7", "-7"],
		["-7", "7"],
		["31", "-31"],
		["-31", "31"],
	])("turns %s into %s", (before, after) => {
		expect(toggleSign(before)).toBe(after);
	});

	it("is its own inverse", () => {
		for (const value of ["", "0", "5", "-5", "123"]) {
			expect(toggleSign(toggleSign(value))).toBe(value);
		}
	});
});

describe("backspace", () => {
	it("removes one digit at a time", () => {
		expect(backspace("312")).toBe("31");
		expect(backspace("31")).toBe("3");
	});

	it("returns to empty, not to zero", () => {
		expect(backspace("3")).toBe("");
		expect(backspace("")).toBe("");
	});

	it("drops a sign left with nothing under it", () => {
		expect(backspace("-4")).toBe("-");
		expect(backspace("-")).toBe("");
	});

	it("leaves a typed zero as a zero until it is deleted", () => {
		expect(backspace("10")).toBe("1");
		expect(backspace("0")).toBe("");
	});
});

describe("what reaches the database", () => {
	it("stores nothing for an empty cell, so Results can still warn", () => {
		expect(toNumber("")).toBeUndefined();
		expect(toNumber("-")).toBeUndefined();
	});

	it("stores a typed zero, which is not the same as an empty cell", () => {
		expect(toNumber("0")).toBe(0);
		expect(toNumber("-0")).toBe(-0);
	});

	it("round-trips a stored value back onto the keypad", () => {
		for (const value of [0, 7, -31, 99999]) {
			expect(toNumber(fromNumber(value))).toBe(value);
		}
		expect(fromNumber(undefined)).toBe("");
	});
});
