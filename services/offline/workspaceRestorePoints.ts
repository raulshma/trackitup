import type { WorkspaceSnapshot } from "../../types/trackitup.ts";
import {
    decryptWorkspaceRestorePointSnapshot,
    encryptWorkspaceRestorePointSnapshot,
} from "./workspaceEncryption.ts";
import {
    buildWorkspaceRestoreHistoryFilename,
    buildWorkspaceRestoreHistoryStorageKey,
    SNAPSHOT_DIRECTORY,
} from "./workspaceOwnership.ts";
import { normalizeWorkspaceSnapshot } from "./workspacePersistenceStrategy.ts";
import type { WorkspacePrivacyMode } from "./workspacePrivacyMode.ts";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function cloneWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
  return structuredClone(snapshot);
}

export type WorkspaceRestorePointReason =
  | "manual"
  | "before-csv-import"
  | "before-template-import"
  | "before-template-save"
  | "before-reset"
  | "before-restore"
  | "before-privacy-mode-change"
  | "before-blocked-recovery";

export type WorkspaceRestorePointStats = {
  spaces: number;
  logs: number;
  assets: number;
  reminders: number;
  templates: number;
  expenses: number;
};

export type WorkspaceRestorePointSummary = {
  id: string;
  label: string;
  reason: WorkspaceRestorePointReason;
  createdAt: string;
  snapshotGeneratedAt: string;
  stats: WorkspaceRestorePointStats;
  protectionMode: "compatibility" | "protected";
};

type StoredWorkspaceRestorePoint =
  | (WorkspaceRestorePointSummary & {
      storageKind: "plaintext";
      snapshot: WorkspaceSnapshot;
    })
  | (WorkspaceRestorePointSummary & {
      storageKind: "encrypted";
      rawEncryptedSnapshot: string;
    });

type WorkspaceRestoreHistoryEnvelope = {
  version: 1;
  restorePoints: StoredWorkspaceRestorePoint[];
};

export type CreateWorkspaceRestorePointResult =
  | {
      status: "created";
      message: string;
      restorePoint: WorkspaceRestorePointSummary;
      evictedCount: number;
    }
  | {
      status: "skipped" | "unavailable";
      message: string;
    };

export type RestoreWorkspaceFromRestorePointResult =
  | {
      status: "restored";
      message: string;
      restorePoint: WorkspaceRestorePointSummary;
      workspace: WorkspaceSnapshot;
    }
  | {
      status:
        | "not-found"
        | "unavailable"
        | "missing-key"
        | "invalid-envelope"
        | "invalid-payload"
        | "decrypt-failed";
      message: string;
    };

export type DeleteWorkspaceRestorePointResult =
  | {
      status: "deleted";
      message: string;
      restorePoint: WorkspaceRestorePointSummary;
    }
  | {
      status: "not-found" | "unavailable";
      message: string;
    };

export type ExportWorkspaceRestorePointResult =
  | {
      status: "exported";
      message: string;
      restorePoint: WorkspaceRestorePointSummary;
      uri: string;
    }
  | {
      status:
        | "not-found"
        | "unavailable"
        | "missing-key"
        | "invalid-envelope"
        | "invalid-payload"
        | "decrypt-failed";
      message: string;
    };

const WORKSPACE_RESTORE_HISTORY_VERSION = 1;
const MAX_WORKSPACE_RESTORE_POINTS = 12;

let workspaceRestorePointExportWriterForTests:
  | ((filename: string, content: string) => Promise<string>)
  | null = null;

function getStorage(): StorageLike | null {
  const maybeStorage = (
    globalThis as typeof globalThis & { localStorage?: StorageLike }
  ).localStorage;
  return maybeStorage ?? null;
}

async function getExpoFileSystem() {
  try {
    return await import("expo-file-system");
  } catch {
    return null;
  }
}

function buildWorkspaceRestorePointStats(
  snapshot: WorkspaceSnapshot,
): WorkspaceRestorePointStats {
  return {
    spaces: snapshot.spaces.length,
    logs: snapshot.logs.length,
    assets: snapshot.assets.length,
    reminders: snapshot.reminders.length,
    templates: snapshot.templates.length,
    expenses: snapshot.expenses.length,
  };
}

function createRestorePointId(createdAt: string) {
  return `restore-point-${createdAt.replace(/[^0-9]/g, "")}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getWorkspaceRestorePointDefaultLabel(
  reason: WorkspaceRestorePointReason,
) {
  switch (reason) {
    case "manual":
      return "Manual restore point";
    case "before-csv-import":
      return "Before CSV import";
    case "before-template-import":
      return "Before template import";
    case "before-template-save":
      return "Before saving custom template";
    case "before-reset":
      return "Before workspace reset";
    case "before-restore":
      return "Before restoring an earlier backup";
    case "before-privacy-mode-change":
      return "Before changing local privacy mode";
    case "before-blocked-recovery":
      return "Before blocked workspace recovery";
    default:
      return "Workspace restore point";
  }
}

function formatRestorePointTimestampToken(timestamp: string) {
  return timestamp.replace(/[:.]/g, "-");
}

function sanitizeRestorePointFilenameSegment(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "restore-point";
}

function buildWorkspaceRestorePointExportFilename(
  restorePoint: WorkspaceRestorePointSummary,
) {
  return `trackitup-${sanitizeRestorePointFilenameSegment(restorePoint.label)}-${formatRestorePointTimestampToken(restorePoint.createdAt)}.json`;
}

function isWorkspaceMeaningfullyEmpty(snapshot: WorkspaceSnapshot) {
  return (
    snapshot.spaces.length === 0 &&
    snapshot.assets.length === 0 &&
    snapshot.metricDefinitions.length === 0 &&
    snapshot.routines.length === 0 &&
    snapshot.reminders.length === 0 &&
    snapshot.logs.length === 0 &&
    snapshot.expenses.length === 0 &&
    snapshot.templates.length === 0
  );
}

function isRestorePointSummary(
  value: unknown,
): value is WorkspaceRestorePointSummary {
  if (!value || typeof value !== "object") return false;

  const candidate = value as WorkspaceRestorePointSummary;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.reason === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.snapshotGeneratedAt === "string" &&
    Boolean(candidate.stats) &&
    typeof candidate.stats.spaces === "number" &&
    typeof candidate.stats.logs === "number" &&
    typeof candidate.stats.assets === "number" &&
    typeof candidate.stats.reminders === "number" &&
    typeof candidate.stats.templates === "number" &&
    typeof candidate.stats.expenses === "number" &&
    (candidate.protectionMode === "compatibility" ||
      candidate.protectionMode === "protected")
  );
}

function isStoredWorkspaceRestorePoint(
  value: unknown,
  defaultWorkspace: WorkspaceSnapshot,
): value is StoredWorkspaceRestorePoint {
  if (!isRestorePointSummary(value)) return false;

  const candidate = value as StoredWorkspaceRestorePoint;
  if (candidate.storageKind === "encrypted") {
    return typeof candidate.rawEncryptedSnapshot === "string";
  }

  if (candidate.storageKind === "plaintext") {
    return Boolean(
      normalizeWorkspaceSnapshot(
        candidate.snapshot,
        defaultWorkspace,
        cloneWorkspaceSnapshot,
      ),
    );
  }

  return false;
}

function parseWorkspaceRestoreHistory(
  rawValue: string,
  defaultWorkspace: WorkspaceSnapshot,
) {
  try {
    const parsed = JSON.parse(
      rawValue,
    ) as Partial<WorkspaceRestoreHistoryEnvelope>;
    if (
      parsed.version !== WORKSPACE_RESTORE_HISTORY_VERSION ||
      !Array.isArray(parsed.restorePoints)
    ) {
      return [];
    }

    return parsed.restorePoints.filter((restorePoint) =>
      isStoredWorkspaceRestorePoint(restorePoint, defaultWorkspace),
    );
  } catch {
    return [];
  }
}

async function readWorkspaceRestoreHistory(
  ownerScopeKey: string,
  defaultWorkspace: WorkspaceSnapshot,
) {
  const storage = getStorage();
  if (storage) {
    const rawValue = storage.getItem(
      buildWorkspaceRestoreHistoryStorageKey(ownerScopeKey),
    );
    return rawValue
      ? parseWorkspaceRestoreHistory(rawValue, defaultWorkspace)
      : [];
  }

  const expoFileSystem = await getExpoFileSystem();
  if (!expoFileSystem) return [];

  try {
    const { File, Paths } = expoFileSystem;
    if (!Paths.document) return [];
    const file = new File(
      Paths.document,
      SNAPSHOT_DIRECTORY,
      buildWorkspaceRestoreHistoryFilename(ownerScopeKey),
    );
    if (!file.exists) return [];
    return parseWorkspaceRestoreHistory(file.textSync(), defaultWorkspace);
  } catch {
    return [];
  }
}

async function writeWorkspaceRestoreHistory(
  ownerScopeKey: string,
  restorePoints: StoredWorkspaceRestorePoint[],
) {
  const rawValue = JSON.stringify({
    version: WORKSPACE_RESTORE_HISTORY_VERSION,
    restorePoints,
  } satisfies WorkspaceRestoreHistoryEnvelope);

  const storage = getStorage();
  if (storage) {
    storage.setItem(
      buildWorkspaceRestoreHistoryStorageKey(ownerScopeKey),
      rawValue,
    );
    return true;
  }

  const expoFileSystem = await getExpoFileSystem();
  if (!expoFileSystem) return false;

  try {
    const { Directory, File, Paths } = expoFileSystem;
    if (!Paths.document) return false;
    const snapshotDirectory = new Directory(Paths.document, SNAPSHOT_DIRECTORY);
    if (!snapshotDirectory.exists) {
      snapshotDirectory.create({ idempotent: true, intermediates: true });
    }

    const file = new File(
      Paths.document,
      SNAPSHOT_DIRECTORY,
      buildWorkspaceRestoreHistoryFilename(ownerScopeKey),
    );
    if (!file.exists) {
      file.create({ intermediates: true, overwrite: true });
    }
    file.write(rawValue);
    return true;
  } catch {
    return false;
  }
}

function summarizeRestorePoint(
  restorePoint: StoredWorkspaceRestorePoint,
): WorkspaceRestorePointSummary {
  return {
    id: restorePoint.id,
    label: restorePoint.label,
    reason: restorePoint.reason,
    createdAt: restorePoint.createdAt,
    snapshotGeneratedAt: restorePoint.snapshotGeneratedAt,
    stats: restorePoint.stats,
    protectionMode: restorePoint.protectionMode,
  };
}

async function loadStoredWorkspaceRestorePoint(
  restorePointId: string,
  ownerScopeKey: string,
  defaultWorkspace: WorkspaceSnapshot,
) {
  return (
    await readWorkspaceRestoreHistory(ownerScopeKey, defaultWorkspace)
  ).find((candidate) => candidate.id === restorePointId);
}

async function loadWorkspaceRestorePointSnapshot(
  restorePointId: string,
  ownerScopeKey: string,
  defaultWorkspace: WorkspaceSnapshot,
): Promise<
  | {
      status: "loaded";
      restorePoint: StoredWorkspaceRestorePoint;
      workspace: WorkspaceSnapshot;
    }
  | {
      status:
        | "not-found"
        | "unavailable"
        | "missing-key"
        | "invalid-envelope"
        | "invalid-payload"
        | "decrypt-failed";
      message: string;
    }
> {
  const restorePoint = await loadStoredWorkspaceRestorePoint(
    restorePointId,
    ownerScopeKey,
    defaultWorkspace,
  );

  if (!restorePoint) {
    return {
      status: "not-found",
      message: "That restore point is no longer available on this device.",
    };
  }

  if (restorePoint.storageKind === "plaintext") {
    const workspace = normalizeWorkspaceSnapshot(
      restorePoint.snapshot,
      defaultWorkspace,
      cloneWorkspaceSnapshot,
    );
    if (!workspace) {
      return {
        status: "invalid-payload",
        message:
          "The selected restore point is incomplete and could not be restored.",
      };
    }

    return {
      status: "loaded",
      restorePoint,
      workspace,
    };
  }

  const decrypted = await decryptWorkspaceRestorePointSnapshot(
    restorePoint.rawEncryptedSnapshot,
    defaultWorkspace,
    cloneWorkspaceSnapshot,
    ownerScopeKey,
  );
  if (decrypted.status !== "loaded") {
    return {
      status: decrypted.status,
      message:
        decrypted.status === "missing-key"
          ? "The encryption key for that protected restore point is unavailable on this device."
          : "The selected protected restore point could not be decrypted.",
    };
  }

  return {
    status: "loaded",
    restorePoint,
    workspace: decrypted.workspace,
  };
}

export async function listWorkspaceRestorePoints(
  ownerScopeKey: string,
  defaultWorkspace: WorkspaceSnapshot,
) {
  const restorePoints = await readWorkspaceRestoreHistory(
    ownerScopeKey,
    defaultWorkspace,
  );
  return restorePoints.map(summarizeRestorePoint);
}

export async function createWorkspaceRestorePoint(
  snapshot: WorkspaceSnapshot,
  ownerScopeKey: string,
  privacyMode: WorkspacePrivacyMode,
  options?: {
    reason?: WorkspaceRestorePointReason;
    label?: string;
    allowEmpty?: boolean;
    defaultWorkspace?: WorkspaceSnapshot;
    storageModeOverride?: WorkspacePrivacyMode;
  },
): Promise<CreateWorkspaceRestorePointResult> {
  if (!options?.allowEmpty && isWorkspaceMeaningfullyEmpty(snapshot)) {
    return {
      status: "skipped",
      message:
        "Skipped creating a restore point because the workspace is still empty.",
    };
  }

  const createdAt = new Date().toISOString();
  const reason = options?.reason ?? "manual";
  const storageMode = options?.storageModeOverride ?? privacyMode;
  const restorePointBase = {
    id: createRestorePointId(createdAt),
    label: options?.label ?? getWorkspaceRestorePointDefaultLabel(reason),
    reason,
    createdAt,
    snapshotGeneratedAt: snapshot.generatedAt,
    stats: buildWorkspaceRestorePointStats(snapshot),
    protectionMode: storageMode === "protected" ? "protected" : "compatibility",
  } satisfies WorkspaceRestorePointSummary;

  const defaultWorkspace = options?.defaultWorkspace ?? snapshot;
  const existing = await readWorkspaceRestoreHistory(
    ownerScopeKey,
    defaultWorkspace,
  );
  let nextRestorePoint: StoredWorkspaceRestorePoint;

  if (storageMode === "protected") {
    const encryptedSnapshot = await encryptWorkspaceRestorePointSnapshot(
      snapshot,
      ownerScopeKey,
    );
    if (!encryptedSnapshot) {
      return {
        status: "unavailable",
        message:
          "Protected restore points are unavailable on this device right now.",
      };
    }

    nextRestorePoint = {
      ...restorePointBase,
      storageKind: "encrypted",
      rawEncryptedSnapshot: JSON.stringify(encryptedSnapshot),
    };
  } else {
    nextRestorePoint = {
      ...restorePointBase,
      storageKind: "plaintext",
      snapshot: cloneWorkspaceSnapshot(snapshot),
    };
  }

  const nextRestorePoints = [nextRestorePoint, ...existing].slice(
    0,
    MAX_WORKSPACE_RESTORE_POINTS,
  );
  const didWrite = await writeWorkspaceRestoreHistory(
    ownerScopeKey,
    nextRestorePoints,
  );
  if (!didWrite) {
    return {
      status: "unavailable",
      message: "The restore point could not be saved on this device.",
    };
  }

  const evictedCount = Math.max(
    0,
    existing.length + 1 - nextRestorePoints.length,
  );
  return {
    status: "created",
    message:
      evictedCount > 0
        ? `Saved a restore point and trimmed ${evictedCount} older backup${evictedCount === 1 ? "" : "s"}.`
        : "Saved a restore point for this workspace.",
    restorePoint: summarizeRestorePoint(nextRestorePoint),
    evictedCount,
  };
}

export async function restoreWorkspaceFromRestorePoint(
  restorePointId: string,
  ownerScopeKey: string,
  defaultWorkspace: WorkspaceSnapshot,
): Promise<RestoreWorkspaceFromRestorePointResult> {
  const loaded = await loadWorkspaceRestorePointSnapshot(
    restorePointId,
    ownerScopeKey,
    defaultWorkspace,
  );
  if (loaded.status !== "loaded") {
    return loaded;
  }

  return {
    status: "restored",
    message: `Restored ${loaded.restorePoint.label.toLowerCase()}.`,
    restorePoint: summarizeRestorePoint(loaded.restorePoint),
    workspace: loaded.workspace,
  };
}

export async function deleteWorkspaceRestorePoint(
  restorePointId: string,
  ownerScopeKey: string,
  defaultWorkspace: WorkspaceSnapshot,
): Promise<DeleteWorkspaceRestorePointResult> {
  const restorePoints = await readWorkspaceRestoreHistory(
    ownerScopeKey,
    defaultWorkspace,
  );
  const restorePoint = restorePoints.find(
    (candidate) => candidate.id === restorePointId,
  );
  if (!restorePoint) {
    return {
      status: "not-found",
      message: "That restore point is no longer available on this device.",
    };
  }

  const didWrite = await writeWorkspaceRestoreHistory(
    ownerScopeKey,
    restorePoints.filter((candidate) => candidate.id !== restorePointId),
  );
  if (!didWrite) {
    return {
      status: "unavailable",
      message: "The restore point could not be deleted on this device.",
    };
  }

  return {
    status: "deleted",
    message: `Deleted ${restorePoint.label.toLowerCase()} from the local backup vault.`,
    restorePoint: summarizeRestorePoint(restorePoint),
  };
}

export async function exportWorkspaceRestorePointJson(
  restorePointId: string,
  ownerScopeKey: string,
  defaultWorkspace: WorkspaceSnapshot,
): Promise<ExportWorkspaceRestorePointResult> {
  const loaded = await loadWorkspaceRestorePointSnapshot(
    restorePointId,
    ownerScopeKey,
    defaultWorkspace,
  );
  if (loaded.status !== "loaded") {
    return loaded;
  }

  const filename = buildWorkspaceRestorePointExportFilename(
    summarizeRestorePoint(loaded.restorePoint),
  );
  const content = JSON.stringify(loaded.workspace, null, 2);

  if (workspaceRestorePointExportWriterForTests) {
    const uri = await workspaceRestorePointExportWriterForTests(
      filename,
      content,
    );
    return {
      status: "exported",
      message: `Exported ${loaded.restorePoint.label.toLowerCase()} to ${uri}.`,
      restorePoint: summarizeRestorePoint(loaded.restorePoint),
      uri,
    };
  }

  const expoFileSystem = await getExpoFileSystem();
  if (!expoFileSystem?.Paths?.cache) {
    return {
      status: "unavailable",
      message: "Restore-point export is unavailable on this device.",
    };
  }

  try {
    const { File, Paths } = expoFileSystem;
    const file = new File(Paths.cache, filename);
    file.create({ intermediates: true, overwrite: true });
    file.write(content);

    return {
      status: "exported",
      message: `Exported ${loaded.restorePoint.label.toLowerCase()} to ${file.uri}.`,
      restorePoint: summarizeRestorePoint(loaded.restorePoint),
      uri: file.uri,
    };
  } catch {
    return {
      status: "unavailable",
      message: "Restore-point export is unavailable on this device.",
    };
  }
}

export function __setWorkspaceRestorePointExportWriterForTests(
  writer: ((filename: string, content: string) => Promise<string>) | null,
) {
  workspaceRestorePointExportWriterForTests = writer;
}
