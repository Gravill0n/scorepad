import { m } from "@/paraglide/messages";

/** "12 Apr" reads day-first in both locales, and so does "4 days ago". */
const INTL_LOCALES = { en: "en-GB", fr: "fr-FR" } as const;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["year", 31_536_000],
	["month", 2_592_000],
	["day", 86_400],
	["hour", 3_600],
	["minute", 60],
];

/**
 * The mono stamp on every Home row and on the backup card: `20 MIN AGO`,
 * `4 DAYS AGO`, `NEVER`. Uppercasing is a CSS transform, so the French keeps
 * its accents.
 *
 * Intl does the wording, which is why `il y a 20 min` comes free rather than
 * being a table of hand-written abbreviations that drift.
 */
export const relativeTime = (
	iso: string | null | undefined,
	now: Date = new Date(),
	locale: "en" | "fr" = "en",
): string => {
	if (!iso) return m.relative_never();

	const then = Date.parse(iso);
	if (Number.isNaN(then)) return m.relative_never();

	const elapsed = Math.round((then - now.getTime()) / 1000);
	if (Math.abs(elapsed) < 60) return m.relative_just_now();

	const format = new Intl.RelativeTimeFormat(INTL_LOCALES[locale], {
		numeric: "always",
		style: "short",
	});

	for (const [unit, seconds] of UNITS) {
		if (Math.abs(elapsed) >= seconds) {
			return format.format(Math.round(elapsed / seconds), unit);
		}
	}

	return m.relative_just_now();
};
