import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import test from "node:test";

const { trackItUpWorkspace } = await import("../constants/TrackItUpData.ts");
const { __setWorkspaceEncryptionAdaptersForTests } =
  await import("../services/offline/workspaceEncryption.ts");
const {
  buildWorkspaceEncryptionKeyAlias,
  buildWorkspaceRestoreHistoryStorageKey,
  buildWorkspaceRestorePointEncryptionKeyAlias,
} = await import("../services/offline/workspaceOwnership.ts");
const {
  __setWorkspaceRestorePointExportWriterForTests,
  createWorkspaceRestorePoint,
  deleteWorkspaceRestorePoint,
  exportWorkspaceRestorePointJson,
  listWorkspaceRestorePoints,
  restoreWorkspaceFromRestorePoint,
} = await import("../services/offline/workspaceRestorePoints.ts");

function createEncryptionAdapters() {
  const store = new Map();

  return {
    store,
    adapters: {
      keyStore: {
        getItem: async (key) => store.get(key) ?? null,
        setItem: async (key, value) => {
          store.set(key, value);
        },
        deleteItem: async (key) => {
          store.delete(key);
        },
      },
      cryptoBridge: {
        generateKey: async () => randomBytes(32).toString("base64"),
        encrypt: async (plaintext, keyMaterial, additionalData) => {
          const iv = randomBytes(12);
          const cipher = createCipheriv(
            "aes-256-gcm",
            Buffer.from(keyMaterial, "base64"),
            iv,
          );
          cipher.setAAD(Buffer.from(additionalData));
          const ciphertext = Buffer.concat([
            cipher.update(Buffer.from(plaintext)),
            cipher.final(),
          ]);
          return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString(
            "base64",
          );
        },
        decrypt: async (sealedData, keyMaterial, additionalData) => {
          const combined = Buffer.from(sealedData, "base64");
          const iv = combined.subarray(0, 12);
          const ciphertext = combined.subarray(12, combined.length - 16);
          const tag = combined.subarray(combined.length - 16);
          const decipher = createDecipheriv(
            "aes-256-gcm",
            Buffer.from(keyMaterial, "base64"),
            iv,
          );
          decipher.setAAD(Buffer.from(additionalData));
          decipher.setAuthTag(tag);
          return new Uint8Array(
            Buffer.concat([decipher.update(ciphertext), decipher.final()]),
          );
        },
      },
    },
  };
}

function createLocalStorage() {
  const store = new Map();
  return {
    store,
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
      removeItem: (key) => {
        store.delete(key);
      },
    },
  };
}

test.afterEach(() => {
  __setWorkspaceEncryptionAdaptersForTests(null);
  __setWorkspaceRestorePointExportWriterForTests(null);
  delete globalThis.localStorage;
});

test("workspace restore points save, list, restore, and prune local history", async () => {
  const { storage, store } = createLocalStorage();
  globalThis.localStorage = storage;
  const scopeKey = "device:restore-history";

  for (let index = 0; index < 13; index += 1) {
    const snapshot = {
      ...structuredClone(trackItUpWorkspace),
      generatedAt: `2026-03-11T10:${String(index).padStart(2, "0")}:00.000Z`,
    };
    const result = await createWorkspaceRestorePoint(
      snapshot,
      scopeKey,
      "standard",
      {
        allowEmpty: true,
        defaultWorkspace: trackItUpWorkspace,
        label: `Checkpoint ${index + 1}`,
        reason: "manual",
      },
    );
    assert.equal(result.status, "created");
  }

  const listed = await listWorkspaceRestorePoints(scopeKey, trackItUpWorkspace);
  assert.equal(listed.length, 12);
  assert.equal(listed[0]?.label, "Checkpoint 13");
  assert.equal(listed.at(-1)?.label, "Checkpoint 2");

  const restored = await restoreWorkspaceFromRestorePoint(
    listed[0].id,
    scopeKey,
    trackItUpWorkspace,
  );
  assert.equal(restored.status, "restored");
  assert.equal(restored.workspace.generatedAt, "2026-03-11T10:12:00.000Z");
  assert.equal(
    store.has(buildWorkspaceRestoreHistoryStorageKey(scopeKey)),
    true,
  );
});

test("protected restore points use a dedicated encryption key alias", async () => {
  const { storage } = createLocalStorage();
  globalThis.localStorage = storage;
  const { adapters, store } = createEncryptionAdapters();
  __setWorkspaceEncryptionAdaptersForTests(adapters);
  const scopeKey = "device:protected-restore";

  const created = await createWorkspaceRestorePoint(
    trackItUpWorkspace,
    scopeKey,
    "protected",
    {
      allowEmpty: true,
      defaultWorkspace: trackItUpWorkspace,
      reason: "manual",
    },
  );
  assert.equal(created.status, "created");
  assert.equal(store.has(buildWorkspaceEncryptionKeyAlias(scopeKey)), false);
  assert.equal(
    store.has(buildWorkspaceRestorePointEncryptionKeyAlias(scopeKey)),
    true,
  );

  store.delete(buildWorkspaceEncryptionKeyAlias(scopeKey));
  const listed = await listWorkspaceRestorePoints(scopeKey, trackItUpWorkspace);
  const restored = await restoreWorkspaceFromRestorePoint(
    listed[0].id,
    scopeKey,
    trackItUpWorkspace,
  );
  assert.equal(restored.status, "restored");
  assert.equal(restored.workspace.logs.length, trackItUpWorkspace.logs.length);
});

test("restore points can be exported, deleted, and forced to compatibility storage", async () => {
  const { storage } = createLocalStorage();
  globalThis.localStorage = storage;
  const { adapters, store } = createEncryptionAdapters();
  __setWorkspaceEncryptionAdaptersForTests(adapters);
  const scopeKey = "device:restore-export";
  const exportedFiles = new Map();

  __setWorkspaceRestorePointExportWriterForTests(async (filename, content) => {
    exportedFiles.set(filename, content);
    return `file:///tmp/${filename}`;
  });

  const created = await createWorkspaceRestorePoint(
    trackItUpWorkspace,
    scopeKey,
    "protected",
    {
      allowEmpty: true,
      defaultWorkspace: trackItUpWorkspace,
      reason: "before-blocked-recovery",
      storageModeOverride: "compatibility",
    },
  );
  assert.equal(created.status, "created");
  assert.equal(created.restorePoint.protectionMode, "compatibility");
  assert.equal(
    store.has(buildWorkspaceRestorePointEncryptionKeyAlias(scopeKey)),
    false,
  );

  const listed = await listWorkspaceRestorePoints(scopeKey, trackItUpWorkspace);
  const exported = await exportWorkspaceRestorePointJson(
    listed[0].id,
    scopeKey,
    trackItUpWorkspace,
  );
  assert.equal(exported.status, "exported");
  assert.match(exported.uri, /^file:\/\/\/tmp\//);
  assert.equal(exportedFiles.size, 1);
  assert.match([...exportedFiles.values()][0], /"generatedAt"/);

  const deleted = await deleteWorkspaceRestorePoint(
    listed[0].id,
    scopeKey,
    trackItUpWorkspace,
  );
  assert.equal(deleted.status, "deleted");
  const remaining = await listWorkspaceRestorePoints(
    scopeKey,
    trackItUpWorkspace,
  );
  assert.equal(remaining.length, 0);
});
