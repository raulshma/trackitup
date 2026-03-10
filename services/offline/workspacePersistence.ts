import { Directory, File, Paths } from "expo-file-system";

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
import {
    choosePersistenceMode,
    normalizeWorkspaceSnapshot,
} from "@/services/offline/workspacePersistenceStrategy";

const STORAGE_KEY = "trackitup.workspace.snapshot.v1";
const SNAPSHOT_DIRECTORY = "trackitup";
const SNAPSHOT_FILENAME = "workspace-snapshot-v1.json";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

let persistenceQueue = Promise.resolve();

export function cloneWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
): WorkspaceSnapshot {
  if (typeof structuredClone === "function") {
    return structuredClone(snapshot);
  }

  return JSON.parse(JSON.stringify(snapshot)) as WorkspaceSnapshot;
}

function getStorage(): StorageLike | null {
  const maybeStorage = (
    globalThis as typeof globalThis & { localStorage?: StorageLike }
  ).localStorage;
  return maybeStorage ?? null;
}

function getSnapshotFile() {
  return new File(Paths.document, SNAPSHOT_DIRECTORY, SNAPSHOT_FILENAME);
}

function hasDocumentDirectory() {
  try {
    return Boolean(Paths.document?.uri || Paths.document);
  } catch {
    return false;
  }
}

function readFileSnapshot(defaultWorkspace: WorkspaceSnapshot) {
  if (!hasDocumentDirectory()) return null;

  try {
    const snapshotFile = getSnapshotFile();
    if (!snapshotFile.exists) return null;

    const parsed = JSON.parse(snapshotFile.textSync());
    return normalizeWorkspaceSnapshot(
      parsed,
      defaultWorkspace,
      cloneWorkspaceSnapshot,
    );
  } catch {
    return null;
  }
}

function loadLegacyPersistedWorkspace(defaultWorkspace: WorkspaceSnapshot): {
  workspace: WorkspaceSnapshot;
  persistenceMode: PersistenceMode;
} {
  const storage = getStorage();
  const persistenceMode = choosePersistenceMode({
    hasWatermelon: false,
    hasLocalStorage: Boolean(storage),
    hasFileSystem: hasDocumentDirectory(),
  });

  if (!storage) {
    const fileWorkspace = readFileSnapshot(defaultWorkspace);
    if (fileWorkspace) {
      return {
        workspace: fileWorkspace,
        persistenceMode,
      };
    }

    return {
      workspace: cloneWorkspaceSnapshot(defaultWorkspace),
      persistenceMode,
    };
  }

  try {
    const rawValue = storage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return {
        workspace: cloneWorkspaceSnapshot(defaultWorkspace),
        persistenceMode: "local-storage",
      };
    }

    const parsed = JSON.parse(rawValue);
    const normalized = normalizeWorkspaceSnapshot(
      parsed,
      defaultWorkspace,
      cloneWorkspaceSnapshot,
    );
    if (normalized) {
      return {
        workspace: normalized,
        persistenceMode,
      };
    }
  } catch {
    // Fall through to default snapshot.
  }

  return {
    workspace: cloneWorkspaceSnapshot(defaultWorkspace),
    persistenceMode,
  };
}

function persistLegacyWorkspace(snapshot: WorkspaceSnapshot) {
  const storage = getStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return;
  }

  if (!hasDocumentDirectory()) return;

  try {
    const snapshotDirectory = new Directory(Paths.document, SNAPSHOT_DIRECTORY);
    if (!snapshotDirectory.exists) {
      snapshotDirectory.create({ idempotent: true, intermediates: true });
    }

    const snapshotFile = getSnapshotFile();
    if (!snapshotFile.exists) {
      snapshotFile.create({ intermediates: true, overwrite: true });
    }

    snapshotFile.write(JSON.stringify(snapshot));
  } catch {
    // Keep in-memory state if file persistence is unavailable.
  }
}

function clearLegacyWorkspace() {
  const storage = getStorage();
  storage?.removeItem(STORAGE_KEY);

  if (!hasDocumentDirectory()) return;

  try {
    const snapshotFile = getSnapshotFile();
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

export function waitForWorkspacePersistence() {
  return persistenceQueue.catch(() => undefined);
}

export async function loadPersistedWorkspace(
  defaultWorkspace: WorkspaceSnapshot,
): Promise<{
  workspace: WorkspaceSnapshot;
  persistenceMode: PersistenceMode;
}> {
  if (isWatermelonPersistenceAvailable()) {
    try {
      const database = await getWorkspaceDatabase();
      if (database) {
        const watermelonWorkspace = await loadWorkspaceSnapshotFromWatermelon(
          database,
          defaultWorkspace,
          cloneWorkspaceSnapshot,
        );
        if (watermelonWorkspace) {
          clearLegacyWorkspace();
          return {
            workspace: watermelonWorkspace,
            persistenceMode: choosePersistenceMode({
              hasWatermelon: true,
              hasLocalStorage: Boolean(getStorage()),
              hasFileSystem: hasDocumentDirectory(),
            }),
          };
        }

        const legacyWorkspace = loadLegacyPersistedWorkspace(defaultWorkspace);
        await persistWorkspaceSnapshotToWatermelon(
          database,
          legacyWorkspace.workspace,
        );
        clearLegacyWorkspace();

        return {
          workspace: legacyWorkspace.workspace,
          persistenceMode: "watermelondb",
        };
      }
    } catch {
      // Fall back to legacy persistence below.
    }
  }

  return loadLegacyPersistedWorkspace(defaultWorkspace);
}

export async function persistWorkspace(snapshot: WorkspaceSnapshot) {
  await enqueuePersistence(async () => {
    if (isWatermelonPersistenceAvailable()) {
      try {
        const database = await getWorkspaceDatabase();
        if (database) {
          await persistWorkspaceSnapshotToWatermelon(database, snapshot);
          clearLegacyWorkspace();
          return;
        }
      } catch {
        // Fall through to legacy persistence.
      }
    }

    persistLegacyWorkspace(snapshot);
  });
}

export async function clearPersistedWorkspace() {
  await enqueuePersistence(async () => {
    if (isWatermelonPersistenceAvailable()) {
      try {
        const database = await getWorkspaceDatabase();
        if (database) {
          await database.unsafeResetDatabase();
        }
      } catch {
        // Best-effort cleanup.
      }
    }

    clearLegacyWorkspace();
  });
}
