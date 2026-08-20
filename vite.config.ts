import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * The TanStack Start plugin configures the client/ssr/react-server build
 * environments. Under vitest that resolves React through the `react-server`
 * condition, where `useSyncExternalStore` is null and every hook call fails
 * with "Invalid hook call". Unit tests do not build routes, so the plugin is
 * simply absent from them — every other plugin stays, so the test config is
 * otherwise the build config.
 */
const underTest = process.env.VITEST === "true";

const config = defineConfig({
	plugins: [
		devtools(),
		paraglideVitePlugin({
			project: "./project.inlang",
			outdir: "./src/paraglide",
			// No locale in the URL: this app has six routes and one of them is
			// a session id. `globalVariable` is what app/provider.tsx sets from
			// meta.locale once it loads; until then `preferredLanguage` follows
			// navigator.language, which is the spec's untouched default.
			strategy: ["globalVariable", "preferredLanguage", "baseLocale"],
		}),
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tailwindcss(),
		...(underTest
			? []
			: [
					tanstackStart({
						spa: {
							enabled: true,
							prerender: { outputPath: "/index" },
						},
						router: {
							virtualRouteConfig: "./src/routes.ts",
							// The app layer, per CLAUDE.md's import graph.
							entry: "./app/router.tsx",
						},
					}),
				]),
		viteReact({
			babel: {
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
	],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
	},
});

export default config;
