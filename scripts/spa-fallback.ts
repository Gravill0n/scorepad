/**
 * Copies the built `index.html` to `404.html`.
 *
 * **GitHub Pages has no rewrite rule.** It serves a file if one exists at the
 * path and its own 404 page otherwise — so `/scorepad/session/abc` is fine
 * while the router is driving, and a hard reload or a shared link 404s. Pages
 * serves `404.html` for any unmatched path, so a copy of the app shell there
 * *is* the rewrite rule: the SPA boots and reads the URL it was asked for.
 *
 * That is the whole mechanism. No hash router (it would put `#` in every link
 * somebody shares), no redirect shim, no dependency.
 */
import { copyFileSync, existsSync } from "node:fs";

const shell = "dist/client/index.html";
const fallback = "dist/client/404.html";

if (!existsSync(shell)) {
	console.error(`${shell} is missing — did the build run?`);
	process.exit(1);
}

copyFileSync(shell, fallback);
console.log(`${fallback}  ← ${shell}`);
