import { readFileSync } from "node:fs";

/** Prose is not code: a comment naming the sub-path is not a second literal. */
const code = (file: string) =>
	readFileSync(file, "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "");

const viteConfig = readFileSync("vite.config.ts", "utf8");
const router = code("src/app/router.tsx");
const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
	scripts: Record<string, string>;
};

/**
 * The deploy contract. Every one of these fails *silently* in production if it
 * regresses — a wrong basepath breaks every link, a root-scoped worker never
 * controls the page and only shows up offline, and a missing 404.html only
 * shows up when somebody shares a link.
 */
describe("the project sub-path", () => {
	it("is written once, and comes from the environment", () => {
		expect(viteConfig).toContain('process.env.BASE_PATH ?? "/"');
		expect(viteConfig).toMatch(/^\tbase,$/m);
	});

	it("defaults to the domain root, so bun dev and the tests are untouched", () => {
		expect(viteConfig).toContain('?? "/"');
	});

	it("reaches the router by derivation, never by a second literal", () => {
		expect(router).toContain("import.meta.env.BASE_URL");
		expect(router).not.toContain("scorepad/");
	});

	it("is nowhere in the build config as a hardcoded string", () => {
		// The workflow supplies it from the repository name; the app only ever
		// sees it through BASE_URL, so renaming the repo needs no code change.
		expect(code("vite.config.ts")).not.toContain("scorepad");
		expect(readFileSync(".github/workflows/deploy.yml", "utf8")).toContain(
			"github.event.repository.name",
		);
	});
});

describe("SPA deep links", () => {
	/**
	 * GitHub Pages has no rewrite rule: it serves a file if one exists and its
	 * own 404 otherwise. A copy of the shell at 404.html *is* the rewrite rule.
	 */
	it("are handled by copying the shell to 404.html at build time", () => {
		expect(packageJson.scripts.build).toContain("scripts/spa-fallback.ts");
		const fallback = readFileSync("scripts/spa-fallback.ts", "utf8");
		expect(fallback).toContain("dist/client/404.html");
		expect(fallback).toContain("dist/client/index.html");
	});

	it("do not fall back to a hash router, which would be in every shared link", () => {
		expect(router).not.toContain("createHashHistory");
	});
});

describe("the service worker under a sub-path", () => {
	const worker = readFileSync("public/sw.js", "utf8");
	const install = readFileSync("src/lib/installPrompt.ts", "utf8");

	it("registers with a scope derived from the base, not the domain root", () => {
		// A root-scoped worker never controls a page under /scorepad/, and the
		// failure is silent until somebody goes offline.
		expect(install).toContain("import.meta.env.BASE_URL");
		expect(install).toContain("{ scope: base }");
		expect(install).not.toContain('register("/sw.js"');
	});

	it("caches only a 200 as the shell", () => {
		// Pages answers a deep link with 404.html — the right body, with a 404
		// status. Caching that would make every later offline navigation a 404.
		expect(worker).toContain("if (response.ok)");
	});
});

describe("the workflow", () => {
	it("gates the deploy on lint, types, tests and the build", () => {
		expect(workflow).toContain("bun run lint");
		expect(workflow).toContain("bunx tsc --noEmit");
		expect(workflow).toContain("bun run test");
		expect(workflow).toContain("bun run build");
		// The gate itself: deploy cannot start unless quality finished green.
		expect(workflow).toMatch(/needs: quality/);
	});

	it("deploys only from main, though it checks every pull request", () => {
		expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
		expect(workflow).toContain("pull_request");
	});

	it("uses the official Pages actions and no gh-pages package", () => {
		expect(workflow).toContain("actions/upload-pages-artifact@v3");
		expect(workflow).toContain("actions/deploy-pages@v4");
		expect(workflow).not.toContain("gh-pages");
	});

	it("asks for exactly the permissions a Pages deploy needs", () => {
		expect(workflow).toContain("pages: write");
		expect(workflow).toContain("id-token: write");
	});

	it("installs from the lockfile, so CI builds what was committed", () => {
		expect(workflow).toContain("bun install --frozen-lockfile");
	});

	/**
	 * Paraglide compiles `messages/*.json` into `src/paraglide/` and gitignores
	 * the result, so a fresh checkout does not have it and only the vite plugin
	 * puts it there. `tsc` ahead of the build therefore fails with TS2307 on
	 * every screen in the app — which is what happened the first time this
	 * workflow ran. Nothing local catches it: the directory is already on disk
	 * here, so the order only matters on a clean clone.
	 */
	it("builds before it typechecks, because the build generates the messages", () => {
		const build = workflow.indexOf("bun run build");
		const types = workflow.indexOf("bunx tsc --noEmit");

		expect(build).toBeGreaterThan(-1);
		expect(types).toBeGreaterThan(build);
	});

	it("never cancels a deploy mid-flight", () => {
		// A half-uploaded artifact is a broken site.
		expect(workflow).toContain(
			`cancel-in-progress: \${{ github.ref != 'refs/heads/main' }}`,
		);
	});
});
