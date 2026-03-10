import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";

import { createEmptyWorkspaceSnapshot } from "@/constants/TrackItUpDefaults";
import {
    getOverviewStats,
    getQuickActionCards,
    getSpaceSummaries,
    getTimelineEntries,
} from "@/constants/TrackItUpSelectors";
import { useAppAuth } from "@/providers/AuthProvider";
import { useWorkspacePrivacyMode } from "@/providers/WorkspacePrivacyModeProvider";
import type { WorkspaceContextValue } from "@/providers/workspace/types";
import { useWorkspaceHydration } from "@/providers/workspace/useWorkspaceHydration";
import { useWorkspaceMutations } from "@/providers/workspace/useWorkspaceMutations";
import { useWorkspaceSyncActions } from "@/providers/workspace/useWorkspaceSyncActions";
import type { BlockedEncryptedWorkspaceReason } from "@/services/offline/workspaceEncryptedPersistence";
import type { WorkspaceLocalProtectionStatus } from "@/services/offline/workspaceLocalProtection";
import { getWorkspaceOwnerScopeKey } from "@/services/offline/workspaceOwnership";
import {
    clearPersistedWorkspace,
    loadPersistedWorkspace,
    persistWorkspace,
} from "@/services/offline/workspacePersistence";
import { useWorkspaceStoreState } from "@/stores/useWorkspaceStore";

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspaceStoreState((state) => state.workspace);
  const isHydrated = useWorkspaceStoreState((state) => state.isHydrated);
  const persistenceMode = useWorkspaceStoreState(
    (state) => state.persistenceMode,
  );
  const setWorkspace = useWorkspaceStoreState((state) => state.setWorkspace);
  const setIsHydrated = useWorkspaceStoreState((state) => state.setIsHydrated);
  const setPersistenceMode = useWorkspaceStoreState(
    (state) => state.setPersistenceMode,
  );
  const auth = useAppAuth();
  const snapshotLogEntries = workspace.logs;
  const snapshotTimelineEntries = useMemo(
    () => getTimelineEntries(workspace),
    [workspace],
  );
  const [logEntries, setLogEntries] = useState(snapshotLogEntries);
  const [timelineEntries, setTimelineEntries] = useState(
    snapshotTimelineEntries,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [localProtectionStatus, setLocalProtectionStatus] =
    useState<WorkspaceLocalProtectionStatus>("standard");
  const [blockedProtectionReason, setBlockedProtectionReason] =
    useState<BlockedEncryptedWorkspaceReason | null>(null);
  const syncEndpoint = process.env.EXPO_PUBLIC_TRACKITUP_SYNC_ENDPOINT;
  const {
    workspacePrivacyMode,
    setWorkspacePrivacyModePreference,
    isLoaded: isPrivacyModeLoaded,
  } = useWorkspacePrivacyMode();
  const defaultWorkspace = useMemo(() => createEmptyWorkspaceSnapshot(), []);
  const ownerScopeKey = useMemo(
    () => getWorkspaceOwnerScopeKey(auth.isSignedIn ? auth.userId : null),
    [auth.isSignedIn, auth.userId],
  );

  useWorkspaceHydration({
    workspace,
    isHydrated,
    privacyMode: workspacePrivacyMode,
    isPrivacyModeLoaded,
    ownerScopeKey,
    persistenceMode,
    defaultWorkspace,
    snapshotLogEntries,
    snapshotTimelineEntries,
    setWorkspace,
    setIsHydrated,
    setPersistenceMode,
    setLocalProtectionStatus,
    setBlockedProtectionReason,
    setLogEntries,
    setTimelineEntries,
  });

  const {
    saveLogForAction,
    saveLogForTemplate,
    moveDashboardWidget,
    cycleWidgetSize,
    toggleWidgetVisibility,
    completeReminder,
    snoozeReminder,
    skipReminder,
    importLogsFromCsv,
    importTemplateFromUrl,
    saveCustomTemplate,
    resetWorkspace,
  } = useWorkspaceMutations(setWorkspace, ownerScopeKey);

  const setWorkspacePrivacyMode = useCallback(
    async (nextMode: typeof workspacePrivacyMode) => {
      if (nextMode === workspacePrivacyMode) {
        return {
          status: "success" as const,
          message: `Local privacy mode is already set to ${nextMode}.`,
        };
      }

      if (localProtectionStatus === "blocked") {
        return {
          status: "error" as const,
          message:
            "Reset the blocked protected workspace before changing local privacy mode for this scope.",
        };
      }

      try {
        setIsHydrated(false);
        await persistWorkspace(workspace, ownerScopeKey, nextMode);
        setWorkspacePrivacyModePreference(nextMode);

        const reloaded = await loadPersistedWorkspace(
          defaultWorkspace,
          ownerScopeKey,
          nextMode,
        );
        setWorkspace(reloaded.workspace);
        setPersistenceMode(reloaded.persistenceMode);
        setLocalProtectionStatus(reloaded.localProtectionStatus);
        setBlockedProtectionReason(reloaded.blockedProtectionReason ?? null);
        setIsHydrated(true);

        return {
          status: "success" as const,
          message:
            nextMode === "protected"
              ? "Protected local privacy mode is now preferred on this device."
              : "Compatibility local privacy mode is now active on this device.",
        };
      } catch {
        setIsHydrated(true);
        return {
          status: "error" as const,
          message: "Could not change the local privacy mode. Please try again.",
        };
      }
    },
    [
      defaultWorkspace,
      localProtectionStatus,
      ownerScopeKey,
      setIsHydrated,
      setPersistenceMode,
      setWorkspace,
      setWorkspacePrivacyModePreference,
      workspace,
      workspacePrivacyMode,
    ],
  );

  const recoverBlockedWorkspace = useCallback(async () => {
    try {
      await clearPersistedWorkspace(ownerScopeKey);
      const recovered = await loadPersistedWorkspace(
        defaultWorkspace,
        ownerScopeKey,
        workspacePrivacyMode,
      );
      setWorkspace(recovered.workspace);
      setPersistenceMode(recovered.persistenceMode);
      setLocalProtectionStatus(recovered.localProtectionStatus);
      setBlockedProtectionReason(recovered.blockedProtectionReason ?? null);
      setIsHydrated(true);

      return {
        status: "success" as const,
        message:
          "Cleared the blocked protected workspace for this device scope and started a fresh local workspace.",
      };
    } catch {
      return {
        status: "error" as const,
        message:
          "Could not reset the blocked protected workspace. Please try again.",
      };
    }
  }, [
    defaultWorkspace,
    ownerScopeKey,
    setBlockedProtectionReason,
    setIsHydrated,
    setLocalProtectionStatus,
    setPersistenceMode,
    setWorkspace,
    workspacePrivacyMode,
  ]);

  const {
    syncWorkspaceNow,
    pullWorkspaceFromCloud,
    restoreWorkspaceFromCloud,
  } = useWorkspaceSyncActions({
    auth,
    isSyncing,
    setIsSyncing,
    syncEndpoint,
    workspace,
    setWorkspace,
  });

  const overviewStats = useMemo(() => getOverviewStats(workspace), [workspace]);
  const quickActionCards = useMemo(
    () => getQuickActionCards(workspace),
    [workspace],
  );
  const spaceSummaries = useMemo(
    () => getSpaceSummaries(workspace),
    [workspace],
  );

  const value = useMemo(
    () => ({
      workspace,
      logEntries,
      isHydrated,
      persistenceMode,
      privacyMode: workspacePrivacyMode,
      localProtectionStatus,
      blockedProtectionReason,
      isSyncing,
      overviewStats,
      quickActionCards,
      spaceSummaries,
      timelineEntries,
      saveLogForAction,
      moveDashboardWidget,
      saveLogForTemplate,
      cycleDashboardWidgetSize: cycleWidgetSize,
      toggleDashboardWidgetVisibility: toggleWidgetVisibility,
      completeReminder,
      snoozeReminder,
      skipReminder,
      importLogsFromCsv,
      importTemplateFromUrl,
      saveCustomTemplate,
      resetWorkspace,
      setWorkspacePrivacyMode,
      recoverBlockedWorkspace,
      pullWorkspaceFromCloud,
      restoreWorkspaceFromCloud,
      syncWorkspaceNow,
    }),
    [
      cycleWidgetSize,
      completeReminder,
      importLogsFromCsv,
      importTemplateFromUrl,
      isHydrated,
      blockedProtectionReason,
      isSyncing,
      logEntries,
      localProtectionStatus,
      moveDashboardWidget,
      overviewStats,
      persistenceMode,
      pullWorkspaceFromCloud,
      quickActionCards,
      recoverBlockedWorkspace,
      resetWorkspace,
      restoreWorkspaceFromCloud,
      saveCustomTemplate,
      saveLogForAction,
      saveLogForTemplate,
      setWorkspacePrivacyMode,
      skipReminder,
      snoozeReminder,
      spaceSummaries,
      syncWorkspaceNow,
      timelineEntries,
      toggleWidgetVisibility,
      workspacePrivacyMode,
      workspace,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }

  return context;
}
