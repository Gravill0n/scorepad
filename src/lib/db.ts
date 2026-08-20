import { type Session, sessionSchema } from "@/types/session";

const DB_NAME = "bgc";

/** IndexedDB's own version. Governs *structure*: which object stores exist. */
const DB_VERSION = 1;

/**
 * `meta.schemaVersion`. Governs *data*: reshaping records that already exist.
 * Deliberately separate from DB_VERSION — one creates stores, the other
 * rewrites their contents, and they will not move in step.
 *
 * v1 ships version 1 and no migrations. The mechanism exists so that the first
 * real migration is not a data-loss event.
 */
export const SCHEMA_VERSION = 1;

export const RECENT_NAMES_CAP = 20;

type MetaValues = {
	schemaVersion: number;
	recentNames: string[];
	lastExportedAt: string | null;
	locale: "en" | "fr";
	theme: "light" | "dark";
};

export type MetaKey = keyof MetaValues;

type MetaRecord<K extends MetaKey> = { key: K; value: MetaValues[K] };

export type Migration = {
	/** The schema version this migration produces. */
	version: number;
	migrate: (db: IDBDatabase) => Promise<void>;
};

/** Empty in v1, and ordered by `version` when it is not. */
export const migrations: Migration[] = [];

const fromRequest = <T>(request: IDBRequest<T>): Promise<T> =>
	new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("IndexedDB request failed"));
	});

/**
 * Resolves when the transaction *commits*, not when the request succeeds. A
 * request can succeed inside a transaction that later aborts; resolving on the
 * request would report a score as saved that was never written, and every cell
 * edit in this app persists immediately with no save action to retry.
 */
const committed = (transaction: IDBTransaction): Promise<void> =>
	new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction failed"));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
	});

const readMeta = async <K extends MetaKey>(
	db: IDBDatabase,
	key: K,
): Promise<MetaValues[K] | undefined> => {
	const store = db.transaction("meta", "readonly").objectStore("meta");
	const record: MetaRecord<K> | undefined = await fromRequest(store.get(key));
	return record?.value;
};

const writeMeta = async <K extends MetaKey>(
	db: IDBDatabase,
	key: K,
	value: MetaValues[K],
): Promise<void> => {
	const transaction = db.transaction("meta", "readwrite");
	transaction.objectStore("meta").put({ key, value });
	await committed(transaction);
};

/**
 * Runs every migration above `storedVersion` and up to `targetVersion`, in
 * ascending order, then records the version reached. Records nothing when
 * nothing ran, so an untouched database stays untouched.
 */
export const runMigrations = async (
	db: IDBDatabase,
	storedVersion: number,
	targetVersion: number,
	list: Migration[] = migrations,
): Promise<number> => {
	const pending = list
		.filter(
			(migration) =>
				migration.version > storedVersion && migration.version <= targetVersion,
		)
		.sort((a, b) => a.version - b.version);

	for (const migration of pending) {
		await migration.migrate(db);
	}

	if (pending.length > 0) {
		await writeMeta(db, "schemaVersion", targetVersion);
	}

	return targetVersion;
};

const open = (): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = request.result;
			if (!db.objectStoreNames.contains("sessions")) {
				db.createObjectStore("sessions", { keyPath: "id" });
			}
			if (!db.objectStoreNames.contains("meta")) {
				db.createObjectStore("meta", { keyPath: "key" });
			}

			// Stamp the version at *creation*, not on every open. Without this a
			// database created by a future v3 app would hold no version, and the
			// next open would read "absent", assume v1, and re-run migrations
			// over data that was already current. schemaVersion is bookkeeping,
			// not a setting: `locale` and `theme` are the keys whose absence has
			// to stay meaningful, and neither is written here.
			if (event.oldVersion === 0) {
				request.transaction
					?.objectStore("meta")
					.put({ key: "schemaVersion", value: SCHEMA_VERSION });
			}
		};

		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error(`could not open "${DB_NAME}"`));
		request.onblocked = () =>
			reject(new Error(`opening "${DB_NAME}" is blocked by another tab`));
	});

let connection: Promise<IDBDatabase> | undefined;

/**
 * Opens once and reuses the connection. A failed open rejects and clears the
 * cache so the next call can retry — it never resolves to an empty store,
 * which would read as "you have no games" rather than "something is wrong".
 */
export const openDatabase = (): Promise<IDBDatabase> => {
	connection ??= open()
		.then(async (db) => {
			// Absent means a database predating this bookkeeping, so v1.
			const stored = await readMeta(db, "schemaVersion");
			await runMigrations(db, stored ?? 1, SCHEMA_VERSION);
			return db;
		})
		.catch((error: unknown) => {
			connection = undefined;
			throw error;
		});

	return connection;
};

export const closeDatabase = (): void => {
	const pending = connection;
	connection = undefined;
	void pending?.then((db) => db.close()).catch(() => undefined);
};

/**
 * Storage is not a trusted source. Records outlive the app version that wrote
 * them, survive devtools edits, and arrive from imported backups. A record that
 * does not match the schema is left in storage untouched and reported — never
 * deleted, and never returned as if it were a session.
 *
 * Unknown keys are dropped by the schema. Ordered migrations, not silent
 * passthrough, are how this app changes a record's shape.
 */
const validate = (record: unknown): Session | undefined => {
	const result = sessionSchema.safeParse(record);
	if (result.success) return result.data;

	const id = (record as { id?: unknown })?.id;
	console.error(
		`Ignoring session "${String(id)}": it does not match the schema.`,
		result.error.issues,
	);
	return undefined;
};

export const getSession = async (id: string): Promise<Session | undefined> => {
	const db = await openDatabase();
	const store = db.transaction("sessions", "readonly").objectStore("sessions");
	const record = await fromRequest<unknown>(store.get(id));
	return record === undefined ? undefined : validate(record);
};

export const getAllSessions = async (): Promise<Session[]> => {
	const db = await openDatabase();
	const store = db.transaction("sessions", "readonly").objectStore("sessions");
	const records = await fromRequest<unknown[]>(store.getAll());
	return records
		.map(validate)
		.filter((session): session is Session => session !== undefined);
};

export const putSession = async (session: Session): Promise<void> => {
	const db = await openDatabase();
	const transaction = db.transaction("sessions", "readwrite");
	transaction.objectStore("sessions").put(session);
	await committed(transaction);
};

export const deleteSession = async (id: string): Promise<void> => {
	const db = await openDatabase();
	const transaction = db.transaction("sessions", "readwrite");
	transaction.objectStore("sessions").delete(id);
	await committed(transaction);
};

export const getMeta = async <K extends MetaKey>(
	key: K,
): Promise<MetaValues[K] | undefined> => readMeta(await openDatabase(), key);

export const putMeta = async <K extends MetaKey>(
	key: K,
	value: MetaValues[K],
): Promise<void> => writeMeta(await openDatabase(), key, value);

/** The cap lives here because this is the only path that writes the list. */
export const putRecentNames = (names: string[]): Promise<void> =>
	putMeta("recentNames", names.slice(0, RECENT_NAMES_CAP));
