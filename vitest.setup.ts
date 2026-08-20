// jsdom has no IndexedDB. This is the only place fake-indexeddb is imported —
// it must never appear under src/, and a test in db.test.ts asserts that.
import "fake-indexeddb/auto";

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
