import { useCallback } from "react";

import { createEmptyWorkspaceSnapshot } from "@/constants/TrackItUpDefaults";
import {
    isTrustedSyncEndpoint,
    markWorkspaceSyncComplete,
    markWorkspaceSyncError,
    pullWorkspaceSync,
    pushWorkspaceSync,
    type SyncActionResult,
} from "@/services/offline/workspaceSync";
import type { WorkspaceUpdater } from "@/stores/useWorkspaceStore";
import type { WorkspaceSnapshot } from "@/types/trackitup";

type WorkspaceSetter = (updater: WorkspaceUpdater) => void;
type SyncAuth = {
  isSignedIn: boolean;
  userId: string | null;
  getToken: () => Promise<string | null>;
};

type UseWorkspaceSyncActionsArgs = {
  auth: SyncAuth;
  isSyncing: boolean;
  setIsSyncing: (value: boolean) => void;
  syncEndpoint?: string;
  syncAllowedHosts?: string[];
  workspace: WorkspaceSnapshot;
  setWorkspace: WorkspaceSetter;
};

export function useWorkspaceSyncActions({
  auth,
  isSyncing,
  setIsSyncing,
  setWorkspace,
  syncAllowedHosts,
  syncEndpoint,
  workspace,
}: UseWorkspaceSyncActionsArgs) {
  const getCloudSyncAccessBlock = useCallback(() => {
    if (isSyncing) {
      return {
        status: "blocked",
        message: "A sync is already running.",
      } satisfies SyncActionResult;
    }

    if (!auth.isSignedIn || !auth.userId) {
      return {
        status: "blocked",
        message: "Sign in to use cloud backup restore and sync.",
      } satisfies SyncActionResult;
    }

    if (!syncEndpoint) {
      return {
        status: "blocked",
        message:
          "Add EXPO_PUBLIC_TRACKITUP_SYNC_ENDPOINT to enable remote sync.",
      } satisfies SyncActionResult;
    }

    if (
      !isTrustedSyncEndpoint(syncEndpoint, { allowedHosts: syncAllowedHosts })
    ) {
      return {
        status: "blocked",
        message:
          "The sync endpoint must use HTTPS (or localhost for development) and match EXPO_PUBLIC_TRACKITUP_SYNC_ALLOWED_HOSTS.",
      } satisfies SyncActionResult;
    }

    return null;
  }, [auth.isSignedIn, auth.userId, isSyncing, syncAllowedHosts, syncEndpoint]);

  const getCloudSyncToken = useCallback(async () => {
    const token = await auth.getToken();
    if (token) {
      return token;
    }

    return {
      status: "blocked",
      message: "Sign in again to refresh your secure sync session.",
    } satisfies SyncActionResult;
  }, [auth.getToken]);

  const syncWorkspaceNow = useCallback(async () => {
    const accessBlock = getCloudSyncAccessBlock();
    if (accessBlock) return accessBlock;

    if (workspace.syncQueue.length === 0) {
      return {
        status: "blocked",
        message: workspace.lastSyncAt
          ? `No pending changes. Last synced ${new Date(workspace.lastSyncAt).toLocaleString()}.`
          : "No pending local changes need syncing yet.",
      } satisfies SyncActionResult;
    }

    const tokenResult = await getCloudSyncToken();
    if (typeof tokenResult !== "string") {
      return tokenResult;
    }

    setIsSyncing(true);
    try {
      const syncResult = await pushWorkspaceSync({
        endpoint: syncEndpoint!,
        snapshot: workspace,
        userId: auth.userId!,
        getToken: async () => tokenResult,
      });

      setWorkspace((currentWorkspace) =>
        syncResult.status === "success"
          ? markWorkspaceSyncComplete(
              currentWorkspace,
              new Date().toISOString(),
            )
          : markWorkspaceSyncError(currentWorkspace, syncResult.message),
      );
      return syncResult;
    } finally {
      setIsSyncing(false);
    }
  }, [
    auth.getToken,
    auth.userId,
    getCloudSyncToken,
    getCloudSyncAccessBlock,
    setIsSyncing,
    setWorkspace,
    syncEndpoint,
    workspace,
  ]);

  const pullWorkspaceFromCloud = useCallback(async () => {
    const accessBlock = getCloudSyncAccessBlock();
    if (accessBlock) return accessBlock;

    if (workspace.syncQueue.length > 0) {
      return {
        status: "blocked",
        message:
          "Push or clear your queued local changes before pulling a cloud snapshot, or use force restore.",
      } satisfies SyncActionResult;
    }

    const tokenResult = await getCloudSyncToken();
    if (typeof tokenResult !== "string") {
      return tokenResult;
    }

    setIsSyncing(true);
    try {
      const pullResult = await pullWorkspaceSync({
        endpoint: syncEndpoint!,
        fallbackSnapshot: createEmptyWorkspaceSnapshot(),
        userId: auth.userId!,
        getToken: async () => tokenResult,
      });

      if (pullResult.status !== "success" || !pullResult.snapshot) {
        setWorkspace((currentWorkspace) =>
          pullResult.status === "error"
            ? markWorkspaceSyncError(currentWorkspace, pullResult.message)
            : currentWorkspace,
        );
        return pullResult;
      }

      const restoredAt = new Date().toISOString();
      if (
        pullResult.snapshot.generatedAt.localeCompare(workspace.generatedAt) < 0
      ) {
        setWorkspace((currentWorkspace) => ({
          ...currentWorkspace,
          lastSyncAt: restoredAt,
          lastSyncError: undefined,
        }));
        return {
          status: "blocked",
          message:
            "The cloud snapshot is older than your local workspace. Use force restore to replace local data anyway.",
        } satisfies SyncActionResult;
      }

      setWorkspace(markWorkspaceSyncComplete(pullResult.snapshot, restoredAt));
      return {
        status: "success",
        message:
          pullResult.snapshot.generatedAt === workspace.generatedAt
            ? "Cloud backup matches the local workspace snapshot."
            : pullResult.message,
      } satisfies SyncActionResult;
    } finally {
      setIsSyncing(false);
    }
  }, [
    auth.getToken,
    auth.userId,
    getCloudSyncToken,
    getCloudSyncAccessBlock,
    setIsSyncing,
    setWorkspace,
    syncEndpoint,
    workspace.generatedAt,
    workspace.syncQueue.length,
  ]);

  const restoreWorkspaceFromCloud = useCallback(async () => {
    const accessBlock = getCloudSyncAccessBlock();
    if (accessBlock) return accessBlock;

    const tokenResult = await getCloudSyncToken();
    if (typeof tokenResult !== "string") {
      return tokenResult;
    }

    setIsSyncing(true);
    try {
      const pullResult = await pullWorkspaceSync({
        endpoint: syncEndpoint!,
        fallbackSnapshot: createEmptyWorkspaceSnapshot(),
        userId: auth.userId!,
        getToken: async () => tokenResult,
      });

      if (pullResult.status !== "success" || !pullResult.snapshot) {
        setWorkspace((currentWorkspace) =>
          pullResult.status === "error"
            ? markWorkspaceSyncError(currentWorkspace, pullResult.message)
            : currentWorkspace,
        );
        return pullResult;
      }

      const restoredAt = new Date().toISOString();
      setWorkspace(markWorkspaceSyncComplete(pullResult.snapshot, restoredAt));
      return {
        status: "success",
        message: `Force-restored the cloud snapshot from ${new Date(pullResult.snapshot.generatedAt).toLocaleString()}.`,
      } satisfies SyncActionResult;
    } finally {
      setIsSyncing(false);
    }
  }, [
    auth.getToken,
    auth.userId,
    getCloudSyncToken,
    getCloudSyncAccessBlock,
    setIsSyncing,
    setWorkspace,
    syncEndpoint,
  ]);

  return {
    syncWorkspaceNow,
    pullWorkspaceFromCloud,
    restoreWorkspaceFromCloud,
  };
}
