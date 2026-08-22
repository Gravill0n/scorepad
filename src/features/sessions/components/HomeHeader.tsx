import { Moon, Sun } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { m } from "@/paraglide/messages";

const CONTROL =
	"flex h-[var(--h-tap)] w-[var(--h-tap)] shrink-0 items-center justify-center rounded-ctrl border border-line bg-card text-ink-soft";

/**
 * Home's own header: the wordmark, the language chip and the theme toggle.
 * Not ScreenHeader — that band carries a title and a back control, and this one
 * carries the product's name and the app's only two settings.
 */
export const HomeHeader = () => {
	const { theme, locale, setTheme, setLocale } = useSettings();
	const nextTheme = theme === "dark" ? "light" : "dark";
	const nextLocale = locale === "en" ? "fr" : "en";

	return (
		<header className="flex shrink-0 items-center gap-2 px-4 pb-4">
			{/* Not translated: the product is called Scorepad in both locales, the
			    way a template's `name` is a proper noun. */}
			<h1 className="flex-1 font-[var(--weight-bold)] text-cell tracking-[-0.01em] text-ink">
				Scorepad
			</h1>

			<button
				type="button"
				className={`${CONTROL} font-mono text-meta font-[var(--weight-medium)]`}
				onClick={() => setLocale(nextLocale)}
				aria-label={m.home_switch_language({
					locale: nextLocale.toUpperCase(),
				})}
			>
				{locale.toUpperCase()}
			</button>

			<button
				type="button"
				className={CONTROL}
				onClick={() => setTheme(nextTheme)}
				aria-label={
					nextTheme === "dark"
						? m.home_switch_to_dark()
						: m.home_switch_to_light()
				}
			>
				{theme === "dark" ? (
					<Sun size={20} aria-hidden="true" />
				) : (
					<Moon size={20} aria-hidden="true" />
				)}
			</button>
		</header>
	);
};
