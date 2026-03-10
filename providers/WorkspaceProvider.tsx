import {
    createContext,
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
import type { WorkspaceContextValue } from "@/providers/workspace/types";
import { useWorkspaceHydration } from "@/providers/workspace/useWorkspaceHydration";
import { useWorkspaceMutations } from "@/providers/workspace/useWorkspaceMutations";
import { useWorkspaceSyncActions } from "@/providers/workspace/useWorkspaceSyncActions";
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
  const syncEndpoint = process.env.EXPO_PUBLIC_TRACKITUP_SYNC_ENDPOINT;
  const defaultWorkspace = useMemo(() => createEmptyWorkspaceSnapshot(), []);

  useWorkspaceHydration({
    workspace,
    isHydrated,
    persistenceMode,
    defaultWorkspace,
    snapshotLogEntries,
    snapshotTimelineEntries,
    setWorkspace,
    setIsHydrated,
    setPersistenceMode,
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
  } = useWorkspaceMutations(setWorkspace);

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
      isSyncing,
      logEntries,
      moveDashboardWidget,
      overviewStats,
      persistenceMode,
      pullWorkspaceFromCloud,
      quickActionCards,
      resetWorkspace,
      restoreWorkspaceFromCloud,
      saveCustomTemplate,
      saveLogForAction,
      saveLogForTemplate,
      skipReminder,
      snoozeReminder,
      spaceSummaries,
      syncWorkspaceNow,
      timelineEntries,
      toggleWidgetVisibility,
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
