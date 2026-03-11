import assert from "node:assert/strict";
import test from "node:test";

const { hasIndexedDb } =
  await import("../services/offline/watermelon/webIndexedDbAvailability.ts");

test("web Watermelon availability check only depends on IndexedDB presence", () => {
  const originalIndexedDb = globalThis.indexedDB;

  try {
    delete globalThis.indexedDB;
    assert.equal(hasIndexedDb(), false);

    globalThis.indexedDB = {};
    assert.equal(hasIndexedDb(), true);
  } finally {
    if (originalIndexedDb === undefined) {
      delete globalThis.indexedDB;
    } else {
      globalThis.indexedDB = originalIndexedDb;
    }
  }
});
