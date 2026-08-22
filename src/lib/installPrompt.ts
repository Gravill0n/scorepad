/**
 * Add-to-Home-Screen, which is `data-model.md`'s third durability mitigation —
 * the only reliable way to survive Safari's ~7-day eviction of unused sites.
 *
 * Two platforms, two mechanisms. Chromium fires `beforeinstallprompt` when it
 * decides the app qualifies, and hands over an object to call later. **iOS
 * fires nothing and has no API at all**, so there the only honest thing is to
 * say where the button is — and iOS is precisely the platform the eviction
 * clock belongs to, so leaving it out would drop the mitigation where it
 * matters most.
 */
export type InstallState =
	/** Already installed, or the browser has nothing to offer. */
	| { kind: "none" }
	/** Chromium has an offer waiting; calling `prompt` shows the sheet. */
	| { kind: "prompt"; prompt: () => Promise<void> }
	/** iOS Safari: no API, so the app tells the person where to tap. */
	| { kind: "instructions" };

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Standalone means it is already on the home screen, on either platform. */
export const isInstalled = (): boolean =>
	window.matchMedia?.("(display-mode: standalone)").matches === true ||
	// iOS Safari predates the media query and reports it here instead.
	(navigator as { standalone?: boolean }).standalone === true;

export const isIosSafari = (): boolean => {
	const agent = navigator.userAgent;
	// iPadOS 13+ calls itself a Mac; a Mac that reports touch points is an iPad.
	const iOS =
		/iPad|iPhone|iPod/.test(agent) ||
		(/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
	// Every iOS browser is Safari underneath, but only Safari itself installs.
	return iOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(agent);
};

/**
 * Subscribes to the browser's offer. Returns an unsubscribe, and calls back
 * with the current state — `none` until something changes it.
 */
export const watchInstallState = (
	onChange: (state: InstallState) => void,
): (() => void) => {
	if (isInstalled()) {
		onChange({ kind: "none" });
		return () => undefined;
	}

	const onBeforeInstallPrompt = (event: Event) => {
		// Without this Chromium shows its own mini-infobar as well as ours.
		event.preventDefault();
		const offer = event as BeforeInstallPromptEvent;
		onChange({
			kind: "prompt",
			prompt: async () => {
				await offer.prompt();
				await offer.userChoice;
				onChange({ kind: "none" });
			},
		});
	};

	const onInstalled = () => onChange({ kind: "none" });

	window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
	window.addEventListener("appinstalled", onInstalled);

	if (isIosSafari()) onChange({ kind: "instructions" });

	return () => {
		window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
		window.removeEventListener("appinstalled", onInstalled);
	};
};

/**
 * Registers the worker that makes the app installable and lets it cold-start
 * offline. Resolves to false where service workers are unavailable — a
 * non-secure origin, or a browser without them — rather than throwing, because
 * nothing about the app needs it to have worked.
 */
export const registerServiceWorker = async (): Promise<boolean> => {
	if (!("serviceWorker" in navigator)) return false;

	const base = import.meta.env.BASE_URL;
	try {
		await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
		return true;
	} catch {
		return false;
	}
};
