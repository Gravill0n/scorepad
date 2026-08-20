// jsdom has no IndexedDB. This is the only place fake-indexeddb is imported —
// it must never appear under src/, and a test in db.test.ts asserts that.
import "fake-indexeddb/auto";
