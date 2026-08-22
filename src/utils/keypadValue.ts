/**
 * A cell being typed is a *string*, not a number: "" is not 0, "-" is a minus
 * waiting for digits, and "05" must not survive as five. Numbers cannot carry
 * that state, and the difference between an empty cell and a zero is the
 * difference between "nobody scored this" and "scored nothing here".
 */
export type KeypadValue = string;

/**
 * Five digits reaches 99999, which is past every score any seed template can
 * produce, and keeps the 40px readout on one line.
 */
export const MAX_DIGITS = 5;

const digitsOf = (value: KeypadValue) => value.replace("-", "");

export const pressDigit = (value: KeypadValue, digit: string): KeypadValue => {
	const negative = value.startsWith("-");
	const digits = digitsOf(value);

	// A leading zero is a placeholder, not a digit: "0" then 5 is 5, not 05.
	const next = digits === "0" ? digit : digits + digit;
	if (next.length > MAX_DIGITS) return value;

	return negative ? `-${next}` : next;
};

/**
 * Works on every shape, including the two that have no digits: an empty cell
 * becomes "-" so a negative can be typed sign-first, and "0" becomes "-0",
 * which reads as zero but keeps the minus the next digit will need.
 */
export const toggleSign = (value: KeypadValue): KeypadValue =>
	value.startsWith("-") ? value.slice(1) : `-${value}`;

/**
 * Removes one character, and empties rather than falling back to zero.
 *
 * Deleting the last digit of "-4" leaves "-", not "": the sign was typed
 * deliberately, it is the same state the ± key produces on an empty cell, and
 * one press should never delete two things.
 */
export const backspace = (value: KeypadValue): KeypadValue =>
	value.slice(0, -1);

/**
 * What gets stored. An empty cell has no number at all — the caller writes
 * nothing rather than writing zero, so Results can still warn about it.
 */
export const toNumber = (value: KeypadValue): number | undefined => {
	if (value === "" || value === "-") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

/** The stored number, back into something the keypad can keep typing on. */
export const fromNumber = (value: number | undefined): KeypadValue =>
	value === undefined ? "" : String(value);
