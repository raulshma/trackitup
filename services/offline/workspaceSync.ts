import type {
    SyncOperationKind,
    SyncQueueEntry,
    WorkspaceSnapshot,
} from "@/types/trackitup";
import { normalizeWorkspaceSnapshot } from "./workspacePersistenceStrategy.ts";

export type SyncActionResult = {
  status: "success" | "blocked" | "error";
  message: string;
};

type EnqueueOptions = {
  kind: SyncOperationKind;
  summary: string;
};

type PushOptions = {
  endpoint: string;
  snapshot: WorkspaceSnapshot;
  userId: string;
  getToken: () => Promise<string | null>;
};

type PullOptions = {
  endpoint: string;
  fallbackSnapshot: WorkspaceSnapshot;
  userId?: string;
  getToken: () => Promise<string | null>;
};

export type PullSyncActionResult = SyncActionResult & {
  snapshot?: WorkspaceSnapshot;
  remoteGeneratedAt?: string;
};

function cloneWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
): WorkspaceSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as WorkspaceSnapshot;
}

function buildWorkspacePullUrl(endpoint: string, userId?: string) {
  const url = new URL(endpoint);
  url.searchParams.set("mode", "pull");
  if (userId) {
    url.searchParams.set("userId", userId);
  }
  return url.toString();
}

export function resolvePulledWorkspaceSnapshot(
  payload: unknown,
  fallbackSnapshot: WorkspaceSnapshot,
): WorkspaceSnapshot | null {
  const candidate =
    payload && typeof payload === "object" && "snapshot" in payload
      ? (payload as { snapshot?: unknown }).snapshot
      : payload;

  return normalizeWorkspaceSnapshot(
    candidate,
    fallbackSnapshot,
    cloneWorkspaceSnapshot,
  );
}

function buildSyncQueueEntry(
  snapshot: WorkspaceSnapshot,
  options: EnqueueOptions,
): SyncQueueEntry {
  const createdAt = new Date().toISOString();

  return {
    id: `sync-${createdAt}-${options.kind}`,
    kind: options.kind,
    summary: options.summary,
    createdAt,
    workspaceGeneratedAt: snapshot.generatedAt,
  };
}

export function enqueueWorkspaceSync(
  snapshot: WorkspaceSnapshot,
  options: EnqueueOptions,
): WorkspaceSnapshot {
  return {
    ...snapshot,
    syncQueue: [
      ...snapshot.syncQueue,
      buildSyncQueueEntry(snapshot, options),
    ].slice(-50),
    lastSyncError: undefined,
  };
}

export function markWorkspaceSyncComplete(
  snapshot: WorkspaceSnapshot,
  syncedAt: string,
): WorkspaceSnapshot {
  return {
    ...snapshot,
    syncQueue: [],
    lastSyncAt: syncedAt,
    lastSyncError: undefined,
  };
}

export function markWorkspaceSyncError(
  snapshot: WorkspaceSnapshot,
  message: string,
): WorkspaceSnapshot {
  return {
    ...snapshot,
    lastSyncError: message,
  };
}

export function buildWorkspaceSyncPayload(
  snapshot: WorkspaceSnapshot,
  userId: string,
) {
  return {
    userId,
    generatedAt: snapshot.generatedAt,
    queuedOperations: snapshot.syncQueue,
    snapshot,
  };
}

export async function pushWorkspaceSync({
  endpoint,
  getToken,
  snapshot,
  userId,
}: PushOptions): Promise<SyncActionResult> {
  const token = await getToken();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(buildWorkspaceSyncPayload(snapshot, userId)),
  });

  if (!response.ok) {
    return {
      status: "error",
      message: `Sync request failed with status ${response.status}.`,
    };
  }

  return {
    status: "success",
    message: `Synced ${snapshot.syncQueue.length} queued workspace change(s).`,
  };
}

export async function pullWorkspaceSync({
  endpoint,
  fallbackSnapshot,
  userId,
  getToken,
}: PullOptions): Promise<PullSyncActionResult> {
  const token = await getToken();
  const response = await fetch(buildWorkspacePullUrl(endpoint, userId), {
    method: "GET",
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 204 || response.status === 404) {
    return {
      status: "blocked",
      message: "No remote workspace snapshot is available yet.",
    };
  }

  if (!response.ok) {
    return {
      status: "error",
      message: `Cloud restore request failed with status ${response.status}.`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      status: "error",
      message: "Cloud restore returned invalid JSON.",
    };
  }

  const snapshot = resolvePulledWorkspaceSnapshot(payload, fallbackSnapshot);
  if (!snapshot) {
    return {
      status: "error",
      message: "Cloud restore did not include a valid workspace snapshot.",
    };
  }

  return {
    status: "success",
    message: `Downloaded cloud workspace snapshot from ${new Date(snapshot.generatedAt).toLocaleString()}.`,
    snapshot,
    remoteGeneratedAt: snapshot.generatedAt,
  };
}
