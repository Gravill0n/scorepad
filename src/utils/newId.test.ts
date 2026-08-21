import { newId } from "./newId";

const UUID_V4 =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
	it("mints a v4 UUID", () => {
		expect(newId()).toMatch(UUID_V4);
	});

	/**
	 * `crypto.randomUUID` exists only in a **secure context**, so it is undefined
	 * on `http://<lan-ip>:3000` — which is exactly how a phone-first app gets
	 * tested on an actual phone. It is also missing from Safari before 15.4 on
	 * any origin. `crypto.getRandomValues` is available in both cases.
	 */
	it("still mints one where crypto.randomUUID does not exist", () => {
		const real = crypto.randomUUID;
		// @ts-expect-error — reproducing a non-secure context, where it is absent.
		crypto.randomUUID = undefined;
		try {
			expect(newId()).toMatch(UUID_V4);
		} finally {
			crypto.randomUUID = real;
		}
	});

	it("does not repeat itself", () => {
		const ids = new Set(Array.from({ length: 500 }, () => newId()));
		expect(ids.size).toBe(500);
	});

	it("does not repeat itself without randomUUID either", () => {
		const real = crypto.randomUUID;
		// @ts-expect-error — as above.
		crypto.randomUUID = undefined;
		try {
			const ids = new Set(Array.from({ length: 500 }, () => newId()));
			expect(ids.size).toBe(500);
		} finally {
			crypto.randomUUID = real;
		}
	});
});
