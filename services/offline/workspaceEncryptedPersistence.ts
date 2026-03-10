import { Directory, File, Paths } from "expo-file-system";

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
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
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

function getStorage(): StorageLike | null {
  const maybeStorage = (
    globalThis as typeof globalThis & { localStorage?: StorageLike }
  ).localStorage;
  return maybeStorage ?? null;
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
    hasLocalStorage: Boolean(getStorage()),
    hasFileSystem: hasDocumentDirectory(),
  });
}

function readEncryptedWorkspaceEnvelope(scopeKey: string) {
  const storage = getStorage();
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

function writeEncryptedWorkspaceEnvelope(
  scopeKey: string,
  rawEnvelope: string,
) {
  const storage = getStorage();
  if (storage) {
    storage.setItem(buildEncryptedWorkspaceStorageKey(scopeKey), rawEnvelope);
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

function deleteEncryptedWorkspaceEnvelope(scopeKey: string) {
  const storage = getStorage();
  storage?.removeItem(buildEncryptedWorkspaceStorageKey(scopeKey));

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
  const rawEnvelope = readEncryptedWorkspaceEnvelope(ownerScopeKey);
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
    !writeEncryptedWorkspaceEnvelope(
      ownerScopeKey,
      JSON.stringify(encryptedEnvelope),
    )
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
  deleteEncryptedWorkspaceEnvelope(ownerScopeKey);
  await deleteWorkspaceEncryptionKey(ownerScopeKey);
}

export function getEncryptedWorkspaceDefaultPersistenceMode() {
  return getEncryptedPersistenceMode();
}
