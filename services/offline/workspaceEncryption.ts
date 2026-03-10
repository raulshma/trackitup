import type { WorkspaceSnapshot } from "@/types/trackitup";
import { buildWorkspaceEncryptionKeyAlias } from "./workspaceOwnership.ts";
import { normalizeWorkspaceSnapshot } from "./workspacePersistenceStrategy.ts";

const WORKSPACE_ENCRYPTION_ALGORITHM = "aes-256-gcm";
const WORKSPACE_ENCRYPTION_FORMAT_VERSION = 1;
const WORKSPACE_ENCRYPTION_KIND = "workspace-snapshot";
const WORKSPACE_PRODUCT_ID = "trackitup";

type CloneWorkspaceSnapshot = (
  snapshot: WorkspaceSnapshot,
) => WorkspaceSnapshot;

type WorkspaceKeyStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
};

type WorkspaceCryptoBridge = {
  generateKey(): Promise<string>;
  encrypt(
    plaintext: Uint8Array,
    keyMaterial: string,
    additionalData: Uint8Array,
  ): Promise<string>;
  decrypt(
    sealedData: string,
    keyMaterial: string,
    additionalData: Uint8Array,
  ): Promise<Uint8Array>;
};

type WorkspaceEncryptionAdapters = {
  keyStore: WorkspaceKeyStore;
  cryptoBridge: WorkspaceCryptoBridge;
};

export type EncryptedWorkspaceEnvelope = {
  version: number;
  algorithm: typeof WORKSPACE_ENCRYPTION_ALGORITHM;
  scopeKey: string;
  createdAt: string;
  snapshotGeneratedAt: string;
  sealedData: string;
};

export type DecryptWorkspaceSnapshotResult =
  | {
      status: "loaded";
      workspace: WorkspaceSnapshot;
      envelope: EncryptedWorkspaceEnvelope;
    }
  | { status: "unavailable" }
  | { status: "missing-key" }
  | { status: "invalid-envelope" }
  | { status: "invalid-payload" }
  | { status: "decrypt-failed" };

let workspaceEncryptionAdaptersForTests:
  | WorkspaceEncryptionAdapters
  | null
  | undefined;

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function decodeUtf8(value: Uint8Array) {
  return new TextDecoder().decode(value);
}

function buildWorkspaceEncryptionAdditionalData(scopeKey: string) {
  return encodeUtf8(
    JSON.stringify({
      productId: WORKSPACE_PRODUCT_ID,
      formatVersion: WORKSPACE_ENCRYPTION_FORMAT_VERSION,
      kind: WORKSPACE_ENCRYPTION_KIND,
      scopeKey,
    }),
  );
}

async function loadSecureStoreModule() {
  try {
    const secureStore = await import("expo-secure-store");
    if (
      typeof secureStore.isAvailableAsync === "function" &&
      (await secureStore.isAvailableAsync())
    ) {
      return secureStore;
    }
  } catch {
    // Secure storage is unavailable in this environment.
  }

  return null;
}

async function resolveWorkspaceKeyStore(): Promise<WorkspaceKeyStore | null> {
  const secureStore = await loadSecureStoreModule();
  if (!secureStore) return null;

  const keychainAccessible =
    secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY ?? secureStore.WHEN_UNLOCKED;

  return {
    getItem: async (key) => secureStore.getItemAsync(key),
    setItem: async (key, value) =>
      secureStore.setItemAsync(key, value, { keychainAccessible }),
    deleteItem: async (key) => secureStore.deleteItemAsync(key),
  };
}

async function resolveWorkspaceCryptoBridge(): Promise<WorkspaceCryptoBridge | null> {
  try {
    const expoCrypto = await import("expo-crypto");

    return {
      generateKey: async () => {
        const key = await expoCrypto.AESEncryptionKey.generate();
        return key.encoded("base64");
      },
      encrypt: async (plaintext, keyMaterial, additionalData) => {
        const key = await expoCrypto.AESEncryptionKey.import(
          keyMaterial,
          "base64",
        );
        const sealedData = await expoCrypto.aesEncryptAsync(plaintext, key, {
          additionalData,
        });
        const combined = await sealedData.combined("base64");
        return String(combined);
      },
      decrypt: async (sealedData, keyMaterial, additionalData) => {
        const key = await expoCrypto.AESEncryptionKey.import(
          keyMaterial,
          "base64",
        );
        const decrypted = await expoCrypto.aesDecryptAsync(
          expoCrypto.AESSealedData.fromCombined(sealedData),
          key,
          {
            output: "bytes",
            additionalData,
          },
        );

        return decrypted instanceof Uint8Array
          ? decrypted
          : new Uint8Array(decrypted);
      },
    };
  } catch {
    return null;
  }
}

async function resolveWorkspaceEncryptionAdapters() {
  if (workspaceEncryptionAdaptersForTests !== undefined) {
    return workspaceEncryptionAdaptersForTests;
  }

  const [keyStore, cryptoBridge] = await Promise.all([
    resolveWorkspaceKeyStore(),
    resolveWorkspaceCryptoBridge(),
  ]);
  if (!keyStore || !cryptoBridge) {
    return null;
  }

  return {
    keyStore,
    cryptoBridge,
  } satisfies WorkspaceEncryptionAdapters;
}

export function __setWorkspaceEncryptionAdaptersForTests(
  adapters: WorkspaceEncryptionAdapters | null,
) {
  workspaceEncryptionAdaptersForTests = adapters;
}

export function parseEncryptedWorkspaceEnvelope(
  rawValue: string,
): EncryptedWorkspaceEnvelope | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<EncryptedWorkspaceEnvelope>;
    if (
      parsed.version !== WORKSPACE_ENCRYPTION_FORMAT_VERSION ||
      parsed.algorithm !== WORKSPACE_ENCRYPTION_ALGORITHM ||
      typeof parsed.scopeKey !== "string" ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.snapshotGeneratedAt !== "string" ||
      typeof parsed.sealedData !== "string"
    ) {
      return null;
    }

    return parsed as EncryptedWorkspaceEnvelope;
  } catch {
    return null;
  }
}

export async function isWorkspaceEncryptionAvailable() {
  return Boolean(await resolveWorkspaceEncryptionAdapters());
}

export async function getWorkspaceEncryptionKey(
  scopeKey: string,
  options?: { createIfMissing?: boolean },
) {
  const adapters = await resolveWorkspaceEncryptionAdapters();
  if (!adapters) return null;

  const keyAlias = buildWorkspaceEncryptionKeyAlias(scopeKey);
  const existingKey = await adapters.keyStore.getItem(keyAlias);
  if (existingKey || !options?.createIfMissing) {
    return existingKey;
  }

  const nextKey = await adapters.cryptoBridge.generateKey();
  await adapters.keyStore.setItem(keyAlias, nextKey);
  return nextKey;
}

export async function deleteWorkspaceEncryptionKey(scopeKey: string) {
  const adapters = await resolveWorkspaceEncryptionAdapters();
  if (!adapters) return;

  await adapters.keyStore.deleteItem(
    buildWorkspaceEncryptionKeyAlias(scopeKey),
  );
}

export async function encryptWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  scopeKey: string,
): Promise<EncryptedWorkspaceEnvelope | null> {
  const adapters = await resolveWorkspaceEncryptionAdapters();
  if (!adapters) return null;

  const keyMaterial = await getWorkspaceEncryptionKey(scopeKey, {
    createIfMissing: true,
  });
  if (!keyMaterial) return null;

  const sealedData = await adapters.cryptoBridge.encrypt(
    encodeUtf8(JSON.stringify(snapshot)),
    keyMaterial,
    buildWorkspaceEncryptionAdditionalData(scopeKey),
  );

  return {
    version: WORKSPACE_ENCRYPTION_FORMAT_VERSION,
    algorithm: WORKSPACE_ENCRYPTION_ALGORITHM,
    scopeKey,
    createdAt: new Date().toISOString(),
    snapshotGeneratedAt: snapshot.generatedAt,
    sealedData,
  };
}

export async function decryptWorkspaceSnapshot(
  rawEnvelope: string,
  defaultWorkspace: WorkspaceSnapshot,
  cloneWorkspaceSnapshot: CloneWorkspaceSnapshot,
  scopeKey: string,
): Promise<DecryptWorkspaceSnapshotResult> {
  const envelope = parseEncryptedWorkspaceEnvelope(rawEnvelope);
  if (!envelope || envelope.scopeKey !== scopeKey) {
    return { status: "invalid-envelope" };
  }

  const adapters = await resolveWorkspaceEncryptionAdapters();
  if (!adapters) {
    return { status: "unavailable" };
  }

  const keyMaterial = await getWorkspaceEncryptionKey(scopeKey);
  if (!keyMaterial) {
    return { status: "missing-key" };
  }

  try {
    const decryptedBytes = await adapters.cryptoBridge.decrypt(
      envelope.sealedData,
      keyMaterial,
      buildWorkspaceEncryptionAdditionalData(scopeKey),
    );
    const decryptedPayload = JSON.parse(decodeUtf8(decryptedBytes));
    const workspace = normalizeWorkspaceSnapshot(
      decryptedPayload,
      defaultWorkspace,
      cloneWorkspaceSnapshot,
    );
    if (!workspace) {
      return { status: "invalid-payload" };
    }

    return {
      status: "loaded",
      workspace,
      envelope,
    };
  } catch {
    return { status: "decrypt-failed" };
  }
}
