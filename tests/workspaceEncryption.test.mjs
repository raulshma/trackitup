import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import test from "node:test";

const { trackItUpWorkspace } = await import("../constants/TrackItUpData.ts");
const {
  __setWorkspaceEncryptionAdaptersForTests,
  decryptWorkspaceSnapshot,
  encryptWorkspaceSnapshot,
  getWorkspaceEncryptionKey,
  isWorkspaceEncryptionAvailable,
} = await import("../services/offline/workspaceEncryption.ts");
const { buildWorkspaceEncryptionKeyAlias } =
  await import("../services/offline/workspaceOwnership.ts");

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
          const tag = cipher.getAuthTag();

          return Buffer.concat([iv, ciphertext, tag]).toString("base64");
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

function cloneSnapshot(snapshot) {
  return structuredClone(snapshot);
}

test.afterEach(() => {
  __setWorkspaceEncryptionAdaptersForTests(null);
});

test("workspace encryption roundtrips snapshots and namespaces keys by scope", async () => {
  const { adapters, store } = createEncryptionAdapters();
  __setWorkspaceEncryptionAdaptersForTests(adapters);

  const encrypted = await encryptWorkspaceSnapshot(
    trackItUpWorkspace,
    "user:user_123",
  );

  assert.ok(encrypted);
  assert.equal(encrypted.scopeKey, "user:user_123");
  assert.equal(
    store.has(buildWorkspaceEncryptionKeyAlias("user:user_123")),
    true,
  );

  const decrypted = await decryptWorkspaceSnapshot(
    JSON.stringify(encrypted),
    trackItUpWorkspace,
    cloneSnapshot,
    "user:user_123",
  );

  assert.equal(decrypted.status, "loaded");
  assert.equal(decrypted.workspace.generatedAt, trackItUpWorkspace.generatedAt);
  assert.equal(
    decrypted.workspace.logs[0]?.attachments?.[0]?.uri,
    trackItUpWorkspace.logs[0]?.attachments?.[0]?.uri,
  );
});

test("workspace encryption reports missing keys and rejects tampered ciphertext", async () => {
  const { adapters, store } = createEncryptionAdapters();
  __setWorkspaceEncryptionAdaptersForTests(adapters);

  const scopeKey = "user:user_456";
  const encrypted = await encryptWorkspaceSnapshot(
    trackItUpWorkspace,
    scopeKey,
  );
  assert.ok(encrypted);

  store.delete(buildWorkspaceEncryptionKeyAlias(scopeKey));
  const missingKeyResult = await decryptWorkspaceSnapshot(
    JSON.stringify(encrypted),
    trackItUpWorkspace,
    cloneSnapshot,
    scopeKey,
  );
  assert.equal(missingKeyResult.status, "missing-key");

  await getWorkspaceEncryptionKey(scopeKey, { createIfMissing: true });
  const tamperedEnvelope = {
    ...encrypted,
    sealedData: `${encrypted.sealedData.slice(0, -2)}aa`,
  };
  const tamperedResult = await decryptWorkspaceSnapshot(
    JSON.stringify(tamperedEnvelope),
    trackItUpWorkspace,
    cloneSnapshot,
    scopeKey,
  );

  assert.equal(tamperedResult.status, "decrypt-failed");
});

test("workspace encryption availability does not fall back to localStorage-backed keys", async () => {
  const originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  try {
    __setWorkspaceEncryptionAdaptersForTests(undefined);
    assert.equal(await isWorkspaceEncryptionAvailable(), false);
  } finally {
    if (originalLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = originalLocalStorage;
    }
  }
});
