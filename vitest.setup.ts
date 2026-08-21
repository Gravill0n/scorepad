// jsdom has no IndexedDB. This is the only place fake-indexeddb is imported —
// it must never appear under src/, and a test in db.test.ts asserts that.
import "fake-indexeddb/auto";
import { configure } from "@testing-library/react";

/**
 * Almost every screen in this app waits on a real IndexedDB read before it
 * renders anything — the store is loaded once at boot and the provider reads
 * `meta` for theme and locale. Testing Library's default one second for
 * `waitFor` and `findBy*` is comfortable on an idle machine and marginal when
 * forty-seven files are contending for it, which showed up as tests that pass
 * alone and fail intermittently in a full run.
 *
 * The longer budget costs nothing on a passing assertion — it resolves as soon
 * as the condition holds. It only lengthens the wait for one that was going to
 * fail anyway.
 */
configure({ asyncUtilTimeout: 5000 });

// jsdom renders <dialog> markup but implements neither showModal nor close.
// The app uses the native modal deliberately (decision 3: backdrop, focus trap,
// Esc and inertness for free), so the gap is shimmed rather than designed
// around. Note that this shim provides no focus trap — that guarantee belongs
// to the browser and is verified in a real one, not here.
if (
	typeof HTMLDialogElement !== "undefined" &&
	!HTMLDialogElement.prototype.showModal
) {
	HTMLDialogElement.prototype.showModal = function showModal() {
		this.open = true;
	};
	HTMLDialogElement.prototype.close = function close() {
		this.open = false;
		this.dispatchEvent(new Event("close"));
	};
}
