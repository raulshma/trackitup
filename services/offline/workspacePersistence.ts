import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import type { PersistenceMode } from "@/stores/useWorkspaceStore";
import type { WorkspaceSnapshot } from "@/types/trackitup";

import {
  loadWorkspaceSnapshotFromWatermelon,
  persistWorkspaceSnapshotToWatermelon,
} from "@/services/offline/watermelon/workspaceCodec";
import {
  getWorkspaceDatabase,
  isWatermelonPersistenceAvailable,
} from "@/services/offline/watermelon/workspaceDatabase";
import type { BlockedEncryptedWorkspaceReason } from "@/services/offline/workspaceEncryptedPersistence";
import {
  clearEncryptedWorkspace,
  getEncryptedWorkspaceDefaultPersistenceMode,
  loadEncryptedWorkspace,
  persistEncryptedWorkspace,
} from "@/services/offline/workspaceEncryptedPersistence";
import type { WorkspaceLocalProtectionStatus } from "@/services/offline/workspaceLocalProtection";
import {
  ANONYMOUS_WORKSPACE_SCOPE_KEY,
  buildWorkspaceSnapshotFilename,
  buildWorkspaceStorageKey,
  isAnonymousWorkspaceOwnerScopeKey,
  LEGACY_WORKSPACE_SNAPSHOT_FILENAME,
  LEGACY_WORKSPACE_STORAGE_KEY,
  SNAPSHOT_DIRECTORY,
} from "@/services/offline/workspaceOwnership";
import {
  choosePersistenceMode,
  normalizeWorkspaceSnapshot,
} from "@/services/offline/workspacePersistenceStrategy";
import type { WorkspacePrivacyMode } from "@/services/offline/workspacePrivacyMode";

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

let persistenceQueue = Promise.resolve();
let nativeStoragePromise: Promise<NativeAsyncStorageLike | null> | null = null;

export function cloneWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
): WorkspaceSnapshot {
  if (typeof structuredClone === "function") {
    return structuredClone(snapshot);
  }

  return JSON.parse(JSON.stringify(snapshot)) as WorkspaceSnapshot;
}

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

type LegacyPersistenceOptions = {
  useLegacyName?: boolean;
};

function getSnapshotFile(
  ownerScopeKey: string,
  options?: LegacyPersistenceOptions,
) {
  return new File(
    Paths.document,
    SNAPSHOT_DIRECTORY,
    options?.useLegacyName
      ? LEGACY_WORKSPACE_SNAPSHOT_FILENAME
      : buildWorkspaceSnapshotFilename(ownerScopeKey),
  );
}

function hasDocumentDirectory() {
  try {
    return Boolean(Paths.document?.uri || Paths.document);
  } catch {
    return false;
  }
}

function parsePersistedSnapshot(
  rawValue: string,
  defaultWorkspace: WorkspaceSnapshot,
) {
  try {
    const parsed = JSON.parse(rawValue);
    return normalizeWorkspaceSnapshot(
      parsed,
      defaultWorkspace,
      cloneWorkspaceSnapshot,
    );
  } catch {
    return null;
  }
}

function readFileSnapshot(
  defaultWorkspace: WorkspaceSnapshot,
  ownerScopeKey: string,
  options?: LegacyPersistenceOptions,
) {
  if (!hasDocumentDirectory()) return null;

  try {
    const snapshotFile = getSnapshotFile(ownerScopeKey, options);
    if (!snapshotFile.exists) return null;

    return parsePersistedSnapshot(snapshotFile.textSync(), defaultWorkspace);
  } catch {
    return null;
  }
}

async function readStorageSnapshot(
  storage: StorageLike,
  storageKey: string,
  defaultWorkspace: WorkspaceSnapshot,
) {
  const rawValue = await storage.getItem(storageKey);
  if (!rawValue) return null;

  return parsePersistedSnapshot(rawValue, defaultWorkspace);
}

async function loadLegacyPersistedWorkspaceIfPresent(
  defaultWorkspace: WorkspaceSnapshot,
  ownerScopeKey: string,
) {
  const storage = await getStorage();
  if (!storage) {
    return (
      readFileSnapshot(defaultWorkspace, ownerScopeKey) ??
      (isAnonymousWorkspaceOwnerScopeKey(ownerScopeKey)
        ? readFileSnapshot(defaultWorkspace, ANONYMOUS_WORKSPACE_SCOPE_KEY, {
            useLegacyName: true,
          })
        : null)
    );
  }

  try {
    return (
      (await readStorageSnapshot(
        storage,
        buildWorkspaceStorageKey(ownerScopeKey),
        defaultWorkspace,
      )) ??
      (isAnonymousWorkspaceOwnerScopeKey(ownerScopeKey)
        ? await readStorageSnapshot(
            storage,
            LEGACY_WORKSPACE_STORAGE_KEY,
            defaultWorkspace,
          )
        : null)
    );
  } catch {
    return null;
  }
}

async function persistLegacyWorkspace(
  snapshot: WorkspaceSnapshot,
  ownerScopeKey: string,
) {
  const storage = await getStorage();
  if (storage) {
    await storage.setItem(
      buildWorkspaceStorageKey(ownerScopeKey),
      JSON.stringify(snapshot),
    );
    return;
  }

  if (!hasDocumentDirectory()) return;

  try {
    const snapshotDirectory = new Directory(Paths.document, SNAPSHOT_DIRECTORY);
    if (!snapshotDirectory.exists) {
      snapshotDirectory.create({ idempotent: true, intermediates: true });
    }

    const snapshotFile = getSnapshotFile(ownerScopeKey);
    if (!snapshotFile.exists) {
      snapshotFile.create({ intermediates: true, overwrite: true });
    }

    snapshotFile.write(JSON.stringify(snapshot));
  } catch {
    // Keep in-memory state if file persistence is unavailable.
  }
}

async function clearLegacyWorkspace(
  ownerScopeKey: string,
  options?: LegacyPersistenceOptions,
) {
  const storage = await getStorage();
  if (storage) {
    await storage.removeItem(
      options?.useLegacyName
        ? LEGACY_WORKSPACE_STORAGE_KEY
        : buildWorkspaceStorageKey(ownerScopeKey),
    );
  }

  if (!hasDocumentDirectory()) return;

  try {
    const snapshotFile = getSnapshotFile(ownerScopeKey, options);
    if (snapshotFile.exists) {
      snapshotFile.delete();
    }
  } catch {
    // Best-effort cleanup.
  }
}

function enqueuePersistence(work: () => Promise<void>) {
  persistenceQueue = persistenceQueue.catch(() => undefined).then(work);
  return persistenceQueue;
}

async function loadWatermelonWorkspaceIfPresent(
  defaultWorkspace: WorkspaceSnapshot,
  ownerScopeKey: string,
  options?: { useLegacyName?: boolean },
) {
  if (!isWatermelonPersistenceAvailable()) return null;

  try {
    const database = await getWorkspaceDatabase(ownerScopeKey, options);
    if (!database) return null;

    return await loadWorkspaceSnapshotFromWatermelon(
      database,
      defaultWorkspace,
      cloneWorkspaceSnapshot,
    );
  } catch {
    return null;
  }
}

async function clearWatermelonWorkspace(
  ownerScopeKey: string,
  options?: { useLegacyName?: boolean },
) {
  if (!isWatermelonPersistenceAvailable()) return;

  try {
    const database = await getWorkspaceDatabase(ownerScopeKey, options);
    if (database) {
      await database.unsafeResetDatabase();
    }
  } catch {
    // Best-effort cleanup.
  }
}

async function clearPlaintextPersistedWorkspace(ownerScopeKey: string) {
  await clearWatermelonWorkspace(ownerScopeKey);
  if (isAnonymousWorkspaceOwnerScopeKey(ownerScopeKey)) {
    await clearWatermelonWorkspace(ownerScopeKey, { useLegacyName: true });
  }

  await clearLegacyWorkspace(ownerScopeKey);
  if (isAnonymousWorkspaceOwnerScopeKey(ownerScopeKey)) {
    await clearLegacyWorkspace(ownerScopeKey, { useLegacyName: true });
  }
}

function getCompatibilityPersistenceMode(): PersistenceMode {
  return choosePersistenceMode({
    hasWatermelon: isWatermelonPersistenceAvailable(),
    hasLocalStorage: Boolean(getWebStorage()) || hasNativeStorageRuntime(),
    hasFileSystem: hasDocumentDirectory(),
  });
}

async function persistPlaintextWorkspace(
  snapshot: WorkspaceSnapshot,
  ownerScopeKey: string,
) {
  if (isWatermelonPersistenceAvailable()) {
    try {
      const database = await getWorkspaceDatabase(ownerScopeKey);
      if (database) {
        await persistWorkspaceSnapshotToWatermelon(database, snapshot);
        await clearLegacyWorkspace(ownerScopeKey);
        if (isAnonymousWorkspaceOwnerScopeKey(ownerScopeKey)) {
          await clearLegacyWorkspace(ownerScopeKey, { useLegacyName: true });
        }

        return {
          persistenceMode: "watermelondb" as const,
        };
      }
    } catch {
      // Fall through to legacy persistence.
    }
  }

  await persistLegacyWorkspace(snapshot, ownerScopeKey);
  return {
    persistenceMode: choosePersistenceMode({
      hasWatermelon: false,
      hasLocalStorage: Boolean(getWebStorage()) || hasNativeStorageRuntime(),
      hasFileSystem: hasDocumentDirectory(),
    }),
  };
}

async function loadPlaintextPersistedWorkspaceIfPresent(
  defaultWorkspace: WorkspaceSnapshot,
  ownerScopeKey: string,
): Promise<{
  workspace: WorkspaceSnapshot;
  persistenceMode: PersistenceMode;
} | null> {
  const scopedWatermelonWorkspace = await loadWatermelonWorkspaceIfPresent(
    defaultWorkspace,
    ownerScopeKey,
  );
  if (scopedWatermelonWorkspace) {
    return {
      workspace: scopedWatermelonWorkspace,
      persistenceMode: "watermelondb",
    };
  }

  if (isAnonymousWorkspaceOwnerScopeKey(ownerScopeKey)) {
    const legacyWatermelonWorkspace = await loadWatermelonWorkspaceIfPresent(
      defaultWorkspace,
      ownerScopeKey,
      { useLegacyName: true },
    );
    if (legacyWatermelonWorkspace) {
      return {
        workspace: legacyWatermelonWorkspace,
        persistenceMode: "watermelondb",
      };
    }
  }

  const legacyWorkspace = await loadLegacyPersistedWorkspaceIfPresent(
    defaultWorkspace,
    ownerScopeKey,
  );
  if (!legacyWorkspace) return null;

  return {
    workspace: legacyWorkspace,
    persistenceMode: choosePersistenceMode({
      hasWatermelon: false,
      hasLocalStorage: Boolean(getWebStorage()) || hasNativeStorageRuntime(),
      hasFileSystem: hasDocumentDirectory(),
    }),
  };
}

export function waitForWorkspacePersistence() {
  return persistenceQueue.catch(() => undefined);
}

export async function loadPersistedWorkspace(
  defaultWorkspace: WorkspaceSnapshot,
  ownerScopeKey = ANONYMOUS_WORKSPACE_SCOPE_KEY,
  privacyMode: WorkspacePrivacyMode = "protected",
): Promise<{
  workspace: WorkspaceSnapshot;
  persistenceMode: PersistenceMode;
  localProtectionStatus: WorkspaceLocalProtectionStatus;
  blockedProtectionReason?: BlockedEncryptedWorkspaceReason;
}> {
  if (privacyMode === "compatibility") {
    const plaintextWorkspace = await loadPlaintextPersistedWorkspaceIfPresent(
      defaultWorkspace,
      ownerScopeKey,
    );
    if (plaintextWorkspace) {
      return {
        ...plaintextWorkspace,
        localProtectionStatus: "standard",
      };
    }

    const encryptedWorkspace = await loadEncryptedWorkspace(
      defaultWorkspace,
      ownerScopeKey,
      cloneWorkspaceSnapshot,
    );
    if (encryptedWorkspace.status === "loaded") {
      const plaintextPersistResult = await persistPlaintextWorkspace(
        encryptedWorkspace.workspace,
        ownerScopeKey,
      );
      await clearEncryptedWorkspace(ownerScopeKey);
      return {
        workspace: encryptedWorkspace.workspace,
        persistenceMode: plaintextPersistResult.persistenceMode,
        localProtectionStatus: "standard",
      };
    }

    return {
      workspace: cloneWorkspaceSnapshot(defaultWorkspace),
      persistenceMode: getCompatibilityPersistenceMode(),
      localProtectionStatus: "standard",
    };
  }

  const encryptedWorkspace = await loadEncryptedWorkspace(
    defaultWorkspace,
    ownerScopeKey,
    cloneWorkspaceSnapshot,
  );
  if (encryptedWorkspace.status === "unavailable") {
    const plaintextWorkspace = await loadPlaintextPersistedWorkspaceIfPresent(
      defaultWorkspace,
      ownerScopeKey,
    );
    if (plaintextWorkspace) {
      return {
        ...plaintextWorkspace,
        localProtectionStatus: "standard",
      };
    }

    return {
      workspace: cloneWorkspaceSnapshot(defaultWorkspace),
      persistenceMode: getCompatibilityPersistenceMode(),
      localProtectionStatus: "standard",
    };
  }

  if (encryptedWorkspace.status === "loaded") {
    await clearPlaintextPersistedWorkspace(ownerScopeKey);
    return {
      workspace: encryptedWorkspace.workspace,
      persistenceMode: encryptedWorkspace.persistenceMode,
      localProtectionStatus: "protected",
    };
  }

  if (encryptedWorkspace.status === "blocked") {
    const plaintextWorkspace = await loadPlaintextPersistedWorkspaceIfPresent(
      defaultWorkspace,
      ownerScopeKey,
    );
    if (plaintextWorkspace) {
      return {
        ...plaintextWorkspace,
        localProtectionStatus: "standard",
      };
    }

    return {
      workspace: cloneWorkspaceSnapshot(defaultWorkspace),
      persistenceMode: "memory",
      localProtectionStatus: "blocked",
      blockedProtectionReason: encryptedWorkspace.reason,
    };
  }

  const plaintextWorkspace = await loadPlaintextPersistedWorkspaceIfPresent(
    defaultWorkspace,
    ownerScopeKey,
  );
  if (plaintextWorkspace) {
    const encryptedPersistResult = await persistEncryptedWorkspace(
      plaintextWorkspace.workspace,
      ownerScopeKey,
    );
    if (encryptedPersistResult.status === "saved") {
      await clearPlaintextPersistedWorkspace(ownerScopeKey);
      return {
        workspace: plaintextWorkspace.workspace,
        persistenceMode: encryptedPersistResult.persistenceMode,
        localProtectionStatus: "protected",
      };
    }

    if (encryptedPersistResult.status === "blocked") {
      return {
        ...plaintextWorkspace,
        localProtectionStatus: "standard",
      };
    }

    if (encryptedPersistResult.status === "unavailable") {
      return {
        workspace: plaintextWorkspace.workspace,
        persistenceMode: plaintextWorkspace.persistenceMode,
        localProtectionStatus: "standard",
      };
    }

    return {
      ...plaintextWorkspace,
      localProtectionStatus: "standard",
    };
  }

  return {
    workspace: cloneWorkspaceSnapshot(defaultWorkspace),
    persistenceMode:
      encryptedWorkspace.status === "missing"
        ? getEncryptedWorkspaceDefaultPersistenceMode()
        : "memory",
    localProtectionStatus: "protected",
  };
}

export async function persistWorkspace(
  snapshot: WorkspaceSnapshot,
  ownerScopeKey = ANONYMOUS_WORKSPACE_SCOPE_KEY,
  privacyMode: WorkspacePrivacyMode = "protected",
) {
  await enqueuePersistence(async () => {
    if (privacyMode === "compatibility") {
      await persistPlaintextWorkspace(snapshot, ownerScopeKey);
      await clearEncryptedWorkspace(ownerScopeKey);
      return;
    }

    const encryptedPersistResult = await persistEncryptedWorkspace(
      snapshot,
      ownerScopeKey,
    );
    if (encryptedPersistResult.status === "saved") {
      await clearPlaintextPersistedWorkspace(ownerScopeKey);
      return;
    }

    if (encryptedPersistResult.status === "blocked") {
      await persistPlaintextWorkspace(snapshot, ownerScopeKey);
      return;
    }

    if (encryptedPersistResult.status === "unavailable") {
      await persistPlaintextWorkspace(snapshot, ownerScopeKey);
      return;
    }
  });
}

export async function clearPersistedWorkspace(
  ownerScopeKey = ANONYMOUS_WORKSPACE_SCOPE_KEY,
) {
  await enqueuePersistence(async () => {
    await clearEncryptedWorkspace(ownerScopeKey);
    await clearPlaintextPersistedWorkspace(ownerScopeKey);
  });
}
