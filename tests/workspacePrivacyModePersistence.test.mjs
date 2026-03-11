import assert from "node:assert/strict";
import test from "node:test";

const {
  ANONYMOUS_WORKSPACE_SCOPE_KEY,
  buildWorkspacePrivacyModeStorageKey,
} = await import("../services/offline/workspaceOwnership.ts");
const {
  DEFAULT_WORKSPACE_PRIVACY_MODE,
  WORKSPACE_PRIVACY_MODE_STORAGE_KEY,
} = await import("../services/offline/workspacePrivacyMode.ts");
const {
  loadWorkspacePrivacyMode,
  persistWorkspacePrivacyMode,
} = await import("../services/offline/workspacePrivacyModePersistence.ts");

function createLocalStorage() {
  const values = new Map();
  return {
    values,
    storage: {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, String(value));
      },
    },
  };
}

test.afterEach(() => {
  delete globalThis.localStorage;
});

test("workspace privacy mode persists separately for each owner scope", async () => {
  const { storage, values } = createLocalStorage();
  globalThis.localStorage = storage;

  await persistWorkspacePrivacyMode("compatibility", ANONYMOUS_WORKSPACE_SCOPE_KEY);
  await persistWorkspacePrivacyMode("protected", "user:user_123");

  assert.equal(
    await loadWorkspacePrivacyMode(ANONYMOUS_WORKSPACE_SCOPE_KEY),
    "compatibility",
  );
  assert.equal(await loadWorkspacePrivacyMode("user:user_123"), "protected");
  assert.equal(
    await loadWorkspacePrivacyMode("user:user_999"),
    DEFAULT_WORKSPACE_PRIVACY_MODE,
  );
  assert.equal(
    values.get(buildWorkspacePrivacyModeStorageKey(ANONYMOUS_WORKSPACE_SCOPE_KEY)),
    "compatibility",
  );
  assert.equal(
    values.get(buildWorkspacePrivacyModeStorageKey("user:user_123")),
    "protected",
  );
});

test("workspace privacy mode falls back to the legacy global preference when scoped storage is absent", async () => {
  const { storage } = createLocalStorage();
  globalThis.localStorage = storage;
  globalThis.localStorage.setItem(
    WORKSPACE_PRIVACY_MODE_STORAGE_KEY,
    "compatibility",
  );

  assert.equal(
    await loadWorkspacePrivacyMode(ANONYMOUS_WORKSPACE_SCOPE_KEY),
    "compatibility",
  );
  assert.equal(await loadWorkspacePrivacyMode("user:user_123"), "compatibility");

  await persistWorkspacePrivacyMode("protected", "user:user_123");

  assert.equal(await loadWorkspacePrivacyMode("user:user_123"), "protected");
  assert.equal(
    await loadWorkspacePrivacyMode(ANONYMOUS_WORKSPACE_SCOPE_KEY),
    "compatibility",
  );
});