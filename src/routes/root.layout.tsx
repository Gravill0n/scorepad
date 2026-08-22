import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AppProvider } from "@/app/provider";
import { THEME_COLOR } from "@/utils/themeColor";
import appCss from "../styles.css?url";

/** Task 31 puts the app under a project sub-path; every asset URL follows it. */
const base = import.meta.env.BASE_URL;

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Scorepad",
			},
			{
				name: "description",
				content: "An offline board game scorepad. No account, no server.",
			},
			// Standalone, so the installed app has no browser chrome. The first
			// name is the modern one; iOS still reads only its own.
			{ name: "mobile-web-app-capable", content: "yes" },
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{ name: "apple-mobile-web-app-title", content: "Scorepad" },
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "default",
			},
			// The status bar's colour, light to start with. A `media` pair would
			// be the usual way to follow the OS, but the router dedupes meta by
			// `name` and only the last one survives — so the provider owns this
			// tag instead, which is more correct anyway: it knows the *effective*
			// theme, including a choice the OS does not know about.
			{ name: "theme-color", content: THEME_COLOR.light },
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{ rel: "manifest", href: `${base}manifest.webmanifest` },
			{ rel: "icon", type: "image/png", href: `${base}favicon-32.png` },
			{ rel: "apple-touch-icon", href: `${base}apple-touch-icon.png` },
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="bg-paper text-ink">
				<AppProvider>{children}</AppProvider>
				<Scripts />
			</body>
		</html>
	);
}
