import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import type { PersistenceMode } from "@/stores/useWorkspaceStore";
import type { WorkspaceSnapshot } from "@/types/trackitup";

import {
  decryptWorkspaceSnapshot,
  deleteWorkspaceEncryptionKey,
  encryptWorkspaceSnapshot,
  isWorkspaceEncryptionAvailable,
} from "@/services/offline/workspaceEncryption";
import {
  buildEncryptedWorkspaceSnapshotFilename,
  buildEncryptedWorkspaceStorageKey,
  SNAPSHOT_DIRECTORY,
} from "@/services/offline/workspaceOwnership";
import { choosePersistenceMode } from "@/services/offline/workspacePersistenceStrategy";

type StorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type WebStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type NativeAsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type CloneWorkspaceSnapshot = (
  snapshot: WorkspaceSnapshot,
) => WorkspaceSnapshot;

export type BlockedEncryptedWorkspaceReason =
  | "missing-key"
  | "invalid-envelope"
  | "invalid-payload"
  | "decrypt-failed"
  | "unavailable";

export type LoadEncryptedWorkspaceResult =
  | {
      status: "loaded";
      workspace: WorkspaceSnapshot;
      persistenceMode: PersistenceMode;
    }
  | { status: "missing" }
  | { status: "unavailable" }
  | {
      status: "blocked";
      reason: BlockedEncryptedWorkspaceReason;
      persistenceMode: "memory";
    };

type PersistEncryptedWorkspaceResult =
  | {
      status: "saved";
      persistenceMode: PersistenceMode;
    }
  | { status: "unavailable" }
  | { status: "blocked" };

const blockedEncryptedWorkspaceScopes = new Set<string>();
let nativeStoragePromise: Promise<NativeAsyncStorageLike | null> | null = null;

function hasNativeStorageRuntime() {
  return Platform.OS !== "web";
}

function getWebStorage(): WebStorageLike | null {
  if (hasNativeStorageRuntime()) {
    return null;
  }

  const maybeStorage = (
    globalThis as typeof globalThis & { localStorage?: WebStorageLike }
  ).localStorage;
  return maybeStorage ?? null;
}

async function resolveNativeStorage(): Promise<NativeAsyncStorageLike | null> {
  if (!hasNativeStorageRuntime()) return null;
  if (!nativeStoragePromise) {
    nativeStoragePromise = (async () => {
      try {
        const asyncStorageModule =
          await import("@react-native-async-storage/async-storage");
        const candidate = (asyncStorageModule as { default?: unknown })
          .default as NativeAsyncStorageLike | undefined;

        if (
          candidate &&
          typeof candidate.getItem === "function" &&
          typeof candidate.setItem === "function" &&
          typeof candidate.removeItem === "function"
        ) {
          return candidate;
        }
      } catch {
        return null;
      }

      return null;
    })();
  }

  return nativeStoragePromise;
}

async function getStorage(): Promise<StorageLike | null> {
  const nativeStorage = await resolveNativeStorage();
  if (nativeStorage) {
    return nativeStorage;
  }

  const webStorage = getWebStorage();
  if (!webStorage) return null;

  return {
    getItem: async (key) => webStorage.getItem(key),
    setItem: async (key, value) => {
      webStorage.setItem(key, value);
    },
    removeItem: async (key) => {
      webStorage.removeItem(key);
    },
  };
}

function hasDocumentDirectory() {
  try {
    return Boolean(Paths.document?.uri || Paths.document);
  } catch {
    return false;
  }
}

function getEncryptedSnapshotFile(scopeKey: string) {
  return new File(
    Paths.document,
    SNAPSHOT_DIRECTORY,
    buildEncryptedWorkspaceSnapshotFilename(scopeKey),
  );
}

function getEncryptedPersistenceMode(): PersistenceMode {
  return choosePersistenceMode({
    hasWatermelon: false,
    hasLocalStorage: Boolean(getWebStorage()) || hasNativeStorageRuntime(),
    hasFileSystem: hasDocumentDirectory(),
  });
}

async function readEncryptedWorkspaceEnvelope(scopeKey: string) {
  const storage = await getStorage();
  if (storage) {
    return storage.getItem(buildEncryptedWorkspaceStorageKey(scopeKey));
  }

  if (!hasDocumentDirectory()) return null;

  try {
    const snapshotFile = getEncryptedSnapshotFile(scopeKey);
    if (!snapshotFile.exists) return null;
    return snapshotFile.textSync();
  } catch {
    return null;
  }
}

async function writeEncryptedWorkspaceEnvelope(
  scopeKey: string,
  rawEnvelope: string,
) {
  const storage = await getStorage();
  if (storage) {
    await storage.setItem(
      buildEncryptedWorkspaceStorageKey(scopeKey),
      rawEnvelope,
    );
    return true;
  }

  if (!hasDocumentDirectory()) return false;

  try {
    const snapshotDirectory = new Directory(Paths.document, SNAPSHOT_DIRECTORY);
    if (!snapshotDirectory.exists) {
      snapshotDirectory.create({ idempotent: true, intermediates: true });
    }

    const snapshotFile = getEncryptedSnapshotFile(scopeKey);
    if (!snapshotFile.exists) {
      snapshotFile.create({ intermediates: true, overwrite: true });
    }

    snapshotFile.write(rawEnvelope);
    return true;
  } catch {
    return false;
  }
}

async function deleteEncryptedWorkspaceEnvelope(scopeKey: string) {
  const storage = await getStorage();
  if (storage) {
    await storage.removeItem(buildEncryptedWorkspaceStorageKey(scopeKey));
  }

  if (!hasDocumentDirectory()) return;

  try {
    const snapshotFile = getEncryptedSnapshotFile(scopeKey);
    if (snapshotFile.exists) {
      snapshotFile.delete();
    }
  } catch {
    // Best-effort cleanup.
  }
}

export async function loadEncryptedWorkspace(
  defaultWorkspace: WorkspaceSnapshot,
  ownerScopeKey: string,
  cloneWorkspaceSnapshot: CloneWorkspaceSnapshot,
): Promise<LoadEncryptedWorkspaceResult> {
  const rawEnvelope = await readEncryptedWorkspaceEnvelope(ownerScopeKey);
  if (!rawEnvelope) {
    return (await isWorkspaceEncryptionAvailable())
      ? { status: "missing" }
      : { status: "unavailable" };
  }

  const decryptedWorkspace = await decryptWorkspaceSnapshot(
    rawEnvelope,
    defaultWorkspace,
    cloneWorkspaceSnapshot,
    ownerScopeKey,
  );

  if (decryptedWorkspace.status === "unavailable") {
    blockedEncryptedWorkspaceScopes.delete(ownerScopeKey);
    return { status: "unavailable" };
  }

  if (decryptedWorkspace.status === "loaded") {
    blockedEncryptedWorkspaceScopes.delete(ownerScopeKey);

    return {
      status: "loaded",
      workspace: decryptedWorkspace.workspace,
      persistenceMode: getEncryptedPersistenceMode(),
    };
  }

  blockedEncryptedWorkspaceScopes.add(ownerScopeKey);

  return {
    status: "blocked",
    reason: decryptedWorkspace.status,
    persistenceMode: "memory",
  };
}

export async function persistEncryptedWorkspace(
  snapshot: WorkspaceSnapshot,
  ownerScopeKey: string,
): Promise<PersistEncryptedWorkspaceResult> {
  if (blockedEncryptedWorkspaceScopes.has(ownerScopeKey)) {
    return { status: "blocked" };
  }

  const encryptedEnvelope = await encryptWorkspaceSnapshot(
    snapshot,
    ownerScopeKey,
  );
  if (!encryptedEnvelope) {
    return { status: "unavailable" };
  }

  if (
    !(await writeEncryptedWorkspaceEnvelope(
      ownerScopeKey,
      JSON.stringify(encryptedEnvelope),
    ))
  ) {
    return { status: "unavailable" };
  }

  blockedEncryptedWorkspaceScopes.delete(ownerScopeKey);

  return {
    status: "saved",
    persistenceMode: getEncryptedPersistenceMode(),
  };
}

export async function clearEncryptedWorkspace(ownerScopeKey: string) {
  blockedEncryptedWorkspaceScopes.delete(ownerScopeKey);
  await deleteEncryptedWorkspaceEnvelope(ownerScopeKey);
  await deleteWorkspaceEncryptionKey(ownerScopeKey);
}

export function getEncryptedWorkspaceDefaultPersistenceMode() {
  return getEncryptedPersistenceMode();
}
