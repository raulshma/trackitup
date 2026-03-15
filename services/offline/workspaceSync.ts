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

type TrustedSyncEndpointOptions = {
  allowedHosts?: readonly string[];
};

export type PullSyncActionResult = SyncActionResult & {
  snapshot?: WorkspaceSnapshot;
  remoteGeneratedAt?: string;
};

const SYNC_PROTOCOL_VERSION = "1";
const SYNC_TIMEOUT_MS = 10_000;
const SYNC_MAX_ATTEMPTS = 2;
const RETRYABLE_SYNC_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const MISSING_TOKEN_MESSAGE =
  "Sign in again to refresh your secure sync session.";

function cloneWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
): WorkspaceSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as WorkspaceSnapshot;
}

function buildWorkspacePullUrl(endpoint: string) {
  const url = new URL(endpoint);
  url.searchParams.set("mode", "pull");
  url.searchParams.set("version", SYNC_PROTOCOL_VERSION);
  return url.toString();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function readProtocolVersion(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const candidate = (payload as { protocolVersion?: unknown }).protocolVersion;
  return typeof candidate === "string" || typeof candidate === "number"
    ? String(candidate)
    : null;
}

function normalizeTrustedHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

function isTrustedHostAllowed(
  hostname: string,
  allowedHosts: readonly string[],
) {
  const normalizedHostname = normalizeTrustedHost(hostname);
  if (!normalizedHostname) return false;

  return allowedHosts.some((allowedHost) => {
    const normalizedAllowedHost = normalizeTrustedHost(allowedHost);
    if (!normalizedAllowedHost) return false;

    if (normalizedAllowedHost.startsWith("*.")) {
      const suffix = normalizedAllowedHost.slice(1);
      return (
        normalizedHostname.endsWith(suffix) &&
        normalizedHostname.length > suffix.length
      );
    }

    return normalizedHostname === normalizedAllowedHost;
  });
}

function hasCompatibleProtocolVersion(response: Response, payload?: unknown) {
  const responseVersion =
    response.headers.get("x-trackitup-sync-version") ??
    readProtocolVersion(payload);

  return responseVersion === SYNC_PROTOCOL_VERSION;
}

function hasJsonContentType(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/json");
}

function buildSyncHeaders(
  token: string | null,
  headers: Record<string, string>,
) {
  return {
    ...headers,
    "x-trackitup-sync-version": SYNC_PROTOCOL_VERSION,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchWithTimeoutAndRetry(
  input: string,
  init: RequestInit,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < SYNC_MAX_ATTEMPTS; attempt += 1) {
    const controller =
      typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
      : null;

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller?.signal,
      });

      if (
        response.ok ||
        !RETRYABLE_SYNC_STATUS_CODES.has(response.status) ||
        attempt === SYNC_MAX_ATTEMPTS - 1
      ) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === SYNC_MAX_ATTEMPTS - 1) {
        throw error;
      }

      if (!isAbortError(error) && error instanceof Error === false) {
        throw error;
      }
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    await delay(300 * (attempt + 1));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Workspace sync failed before receiving a response.");
}

export function isTrustedSyncEndpoint(
  endpoint: string,
  options?: TrustedSyncEndpointOptions,
) {
  try {
    const url = new URL(endpoint);

    if (url.username || url.password) {
      return false;
    }

    const isLocalHttp =
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);

    if (isLocalHttp) {
      return true;
    }

    const isLocalHttps =
      url.protocol === "https:" &&
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);

    if (isLocalHttps) {
      return true;
    }

    if (url.protocol !== "https:") {
      return false;
    }

    const allowedHosts = (options?.allowedHosts ?? []).filter(
      (value) => value.trim().length > 0,
    );
    if (allowedHosts.length === 0) {
      return false;
    }

    return isTrustedHostAllowed(url.hostname, allowedHosts);
  } catch {
    return false;
  }
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
    protocolVersion: SYNC_PROTOCOL_VERSION,
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
  try {
    const token = await getToken();
    if (!token) {
      return {
        status: "blocked",
        message: MISSING_TOKEN_MESSAGE,
      };
    }

    const response = await fetchWithTimeoutAndRetry(endpoint, {
      method: "POST",
      headers: buildSyncHeaders(token, {
        "content-type": "application/json",
      }),
      body: JSON.stringify(buildWorkspaceSyncPayload(snapshot, userId)),
    });

    if (!response.ok) {
      return {
        status: "error",
        message: `Sync request failed with status ${response.status}.`,
      };
    }

    if (!hasCompatibleProtocolVersion(response)) {
      return {
        status: "error",
        message:
          "Sync request completed with an incompatible server protocol version.",
      };
    }

    return {
      status: "success",
      message: `Synced ${snapshot.syncQueue.length} queued workspace change(s).`,
    };
  } catch (error) {
    return {
      status: "error",
      message: isAbortError(error)
        ? "Sync request timed out before the server responded."
        : "Sync request could not reach the server.",
    };
  }
}

export async function pullWorkspaceSync({
  endpoint,
  fallbackSnapshot,
  userId,
  getToken,
}: PullOptions): Promise<PullSyncActionResult> {
  let response: Response;
  try {
    const token = await getToken();
    if (!token) {
      return {
        status: "blocked",
        message: MISSING_TOKEN_MESSAGE,
      };
    }

    response = await fetchWithTimeoutAndRetry(buildWorkspacePullUrl(endpoint), {
      method: "GET",
      headers: buildSyncHeaders(token, {
        accept: "application/json",
        ...(userId ? { "x-trackitup-user-id": userId } : {}),
      }),
    });
  } catch (error) {
    return {
      status: "error",
      message: isAbortError(error)
        ? "Cloud restore timed out before the server responded."
        : "Cloud restore could not reach the server.",
    };
  }

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

  if (!hasJsonContentType(response)) {
    return {
      status: "error",
      message: "Cloud restore returned an unexpected response format.",
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

  if (!hasCompatibleProtocolVersion(response, payload)) {
    return {
      status: "error",
      message:
        "Cloud restore returned a snapshot for an incompatible sync protocol version.",
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
