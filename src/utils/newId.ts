/**
 * A v4 UUID for a session, a player or a setup row.
 *
 * **`crypto.randomUUID` is not always there.** It is defined only in a *secure
 * context*, so it is missing on `http://<lan-ip>:3000` — which is exactly how a
 * phone-first app gets tested on an actual phone — and it is missing from
 * Safari before 15.4 on any origin, including the HTTPS one this app ships to.
 * Calling it directly threw `crypto.randomUUID is not a function` on the setup
 * screen, which is the first screen that mints an id.
 *
 * `crypto.getRandomValues` is available in both of those cases and is the same
 * CSPRNG, so the fallback is the RFC 4122 layout over sixteen random bytes
 * rather than a weaker `Math.random` id.
 */
export const newId = (): string => {
	if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

	const bytes = crypto.getRandomValues(new Uint8Array(16));
	// Version 4 in the high nibble of byte 6, variant 10 in the top bits of 8.
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");

	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20),
	].join("-");
};
