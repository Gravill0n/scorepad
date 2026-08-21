/**
 * Scorepad's service worker.
 *
 * The app has no server and makes no requests of its own — this exists so the
 * bundle is installable and cold-starts offline, which is criterion 9. It is
 * the one file in the project that touches the Fetch API, and it touches it to
 * answer from a cache, never to reach the network on the app's behalf.
 *
 * Every URL here is relative to the worker's own scope, so it is correct at the
 * site root and under a project sub-path without knowing which it is on.
 */
const CACHE = "scorepad-v1";

/** The shell. Hashed assets join the cache as they are first fetched. */
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			// One miss must not fail the whole install, so each is added alone.
			.then((cache) =>
				Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))),
			)
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;
	if (new URL(request.url).origin !== self.location.origin) return;

	// A navigation gets the network first so a deploy is picked up, and the
	// cached shell when there is no network — which is the offline cold start.
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					// Only a 200 becomes the cached shell. On GitHub Pages a deep
					// link is answered by 404.html — the right *body*, with a 404
					// status — and caching that would make every later offline
					// navigation a 404 too. The shell is precached at install, so
					// there is nothing to lose by being strict here.
					if (response.ok) {
						const copy = response.clone();
						caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
					}
					return response;
				})
				.catch(() =>
					caches
						.match("./index.html")
						.then((cached) => cached ?? Response.error()),
				),
		);
		return;
	}

	// Everything else is a hashed asset: the URL changes when the file does, so
	// the cache can never go stale and the network is only for a first sight.
	event.respondWith(
		caches.match(request).then(
			(cached) =>
				cached ??
				fetch(request).then((response) => {
					if (response.ok && response.type === "basic") {
						const copy = response.clone();
						caches.open(CACHE).then((cache) => cache.put(request, copy));
					}
					return response;
				}),
		),
	);
});
