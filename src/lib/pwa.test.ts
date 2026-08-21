import { readFileSync } from "node:fs";
import { isInstalled, isIosSafari, watchInstallState } from "./installPrompt";

const manifest = JSON.parse(
	readFileSync("public/manifest.webmanifest", "utf8"),
) as {
	name: string;
	short_name: string;
	start_url: string;
	scope: string;
	display: string;
	theme_color: string;
	background_color: string;
	icons: { src: string; sizes: string; type: string; purpose: string }[];
};

const tokens = readFileSync("src/tokens.css", "utf8");

/** Reads a PNG's IHDR, which is the only place its real size is written. */
const pngSize = (file: string) => {
	const bytes = readFileSync(file);
	const signature = bytes.subarray(0, 8).toString("hex");
	return {
		signature,
		width: bytes.readUInt32BE(16),
		height: bytes.readUInt32BE(20),
	};
};

describe("the manifest", () => {
	it("names the product, not the scaffold it grew out of", () => {
		expect(manifest.name).toBe("Scorepad");
		expect(manifest.short_name).toBe("Scorepad");
	});

	it("is installable: a scope, a start url and a standalone display", () => {
		expect(manifest.display).toBe("standalone");
		expect(manifest.start_url).toBeDefined();
		expect(manifest.scope).toBeDefined();
	});

	/**
	 * Task 31 moves the app to `/scorepad/`. Relative URLs resolve against the
	 * manifest's own address, so every one of these is already correct there —
	 * which is why the sub-path costs a config line and not a rewrite.
	 */
	it("addresses everything relatively, so a sub-path needs no rewrite", () => {
		expect(manifest.start_url.startsWith("/")).toBe(false);
		expect(manifest.scope.startsWith("/")).toBe(false);
		for (const icon of manifest.icons) {
			expect(icon.src.startsWith("/")).toBe(false);
			expect(icon.src.startsWith("http")).toBe(false);
		}
	});

	it("takes its colours from tokens.css rather than inventing them", () => {
		expect(tokens).toContain(manifest.background_color);
		expect(tokens).toContain(manifest.theme_color);
	});

	it("ships the sizes an install needs, including a maskable one", () => {
		const sizes = manifest.icons.map((icon) => icon.sizes);
		expect(sizes).toContain("192x192");
		expect(sizes).toContain("512x512");
		expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(
			true,
		);
	});
});

describe("the icons", () => {
	it("are real PNGs at the sizes they claim", () => {
		for (const icon of manifest.icons) {
			const [width] = icon.sizes.split("x").map(Number);
			const png = pngSize(`public/${icon.src}`);
			expect(png.signature).toBe("89504e470d0a1a0a");
			expect(png.width).toBe(width);
			expect(png.height).toBe(width);
		}
	});

	it("include the one iOS asks for by name", () => {
		// The durability mitigation is specifically about Safari's eviction, so
		// this is the icon that matters most, and iOS only reads PNG.
		expect(pngSize("public/apple-touch-icon.png").width).toBe(180);
	});

	it("left none of the scaffold's artwork behind", () => {
		for (const stale of ["logo192.png", "logo512.png", "manifest.json"]) {
			expect(() => readFileSync(`public/${stale}`)).toThrow();
		}
	});
});

describe("the service worker", () => {
	const worker = readFileSync("public/sw.js", "utf8");

	it("addresses its own scope relatively, like the manifest", () => {
		expect(worker).not.toMatch(/["'`]\/(?!\/)/);
	});

	it("versions its cache, and drops every other one on activate", () => {
		expect(worker).toMatch(/const CACHE = "scorepad-v\d+"/);
		expect(worker).toContain("caches.delete");
	});

	it("only ever answers GETs from its own origin", () => {
		expect(worker).toContain('request.method !== "GET"');
		expect(worker).toContain("self.location.origin");
	});
});

describe("knowing whether it is installed", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("reads standalone from the display mode", () => {
		vi.stubGlobal("matchMedia", () => ({ matches: true }));
		expect(isInstalled()).toBe(true);
	});

	it("reads it from navigator.standalone, which is where iOS puts it", () => {
		vi.stubGlobal("matchMedia", () => ({ matches: false }));
		vi.stubGlobal("navigator", { standalone: true });
		expect(isInstalled()).toBe(true);
	});

	it("is not installed when neither says so", () => {
		vi.stubGlobal("matchMedia", () => ({ matches: false }));
		vi.stubGlobal("navigator", { standalone: undefined });
		expect(isInstalled()).toBe(false);
	});
});

describe("spotting iOS Safari, which has no install API", () => {
	afterEach(() => vi.unstubAllGlobals());

	const withAgent = (userAgent: string, maxTouchPoints = 5) =>
		vi.stubGlobal("navigator", { userAgent, maxTouchPoints });

	it("recognises an iPhone", () => {
		withAgent(
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
		);
		expect(isIosSafari()).toBe(true);
	});

	it("recognises an iPad, which calls itself a Mac", () => {
		withAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
			5,
		);
		expect(isIosSafari()).toBe(true);
	});

	it("does not mistake a desktop Mac for one", () => {
		withAgent(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
			0,
		);
		expect(isIosSafari()).toBe(false);
	});

	it("does not offer instructions to Chrome on iOS, which cannot install", () => {
		withAgent(
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1",
		);
		expect(isIosSafari()).toBe(false);
	});

	it("does not mistake Android Chrome for it", () => {
		withAgent(
			"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
		);
		expect(isIosSafari()).toBe(false);
	});
});

describe("the install offer", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("takes the browser's offer and stops it showing its own bar", async () => {
		vi.stubGlobal("matchMedia", () => ({ matches: false }));
		vi.stubGlobal("navigator", { userAgent: "Chrome", maxTouchPoints: 0 });

		const states: string[] = [];
		const stop = watchInstallState((state) => states.push(state.kind));

		const prompt = vi.fn(() => Promise.resolve());
		const event = Object.assign(new Event("beforeinstallprompt"), {
			prompt,
			userChoice: Promise.resolve({ outcome: "accepted" as const }),
		});
		const prevented = vi.spyOn(event, "preventDefault");
		window.dispatchEvent(event);

		expect(prevented).toHaveBeenCalled();
		expect(states).toContain("prompt");
		stop();
	});

	it("offers nothing once the app is already installed", () => {
		vi.stubGlobal("matchMedia", () => ({ matches: true }));
		const states: string[] = [];
		watchInstallState((state) => states.push(state.kind));
		expect(states).toEqual(["none"]);
	});
});

describe("the status bar colour", () => {
	/**
	 * The router dedupes `<meta>` by `name`, so a
	 * `prefers-color-scheme` pair silently collapses to whichever came last —
	 * which left light mode with no theme-color at all. One tag, owned by the
	 * provider, which knows the effective theme rather than only the OS one.
	 */
	it("is a single tag the provider can own", () => {
		const layout = readFileSync("src/routes/root.layout.tsx", "utf8");
		const tags = layout.match(/name: "theme-color"/g) ?? [];
		expect(tags).toHaveLength(1);

		const provider = readFileSync("src/app/provider.tsx", "utf8");
		expect(provider).toContain('meta[name="theme-color"]');
		// Both grounds come from tokens.css, like the manifest's.
		expect(tokens).toContain("#201c16");
		expect(tokens).toContain("#f6f1e7");
	});
});
