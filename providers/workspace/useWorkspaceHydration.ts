import {
  useEffect,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { AppState } from "react-native";

import { getTimelineEntries } from "@/constants/TrackItUpSelectors";
import { getWorkspaceDatabase } from "@/services/offline/watermelon/workspaceDatabase";
import { loadLogReadModelFromWatermelon } from "@/services/offline/watermelon/workspaceQueries";
import type { BlockedEncryptedWorkspaceReason } from "@/services/offline/workspaceEncryptedPersistence";
import type { WorkspaceLocalProtectionStatus } from "@/services/offline/workspaceLocalProtection";
import {
  cloneWorkspaceSnapshot,
  loadPersistedWorkspace,
  persistWorkspace,
  waitForWorkspacePersistence,
} from "@/services/offline/workspacePersistence";
import type { WorkspacePrivacyMode } from "@/services/offline/workspacePrivacyMode";
import type {
  PersistenceMode,
  WorkspaceUpdater,
} from "@/stores/useWorkspaceStore";
import type { WorkspaceSnapshot } from "@/types/trackitup";

type TimelineEntries = ReturnType<typeof getTimelineEntries>;
type WorkspaceSetter = (updater: WorkspaceUpdater) => void;

type UseWorkspaceHydrationArgs = {
  ownerScopeKey: string;
  workspace: WorkspaceSnapshot;
  isHydrated: boolean;
  canHydrate: boolean;
  privacyMode: WorkspacePrivacyMode;
  isPrivacyModeLoaded: boolean;
  persistenceMode: PersistenceMode;
  defaultWorkspace: WorkspaceSnapshot;
  snapshotLogEntries: WorkspaceSnapshot["logs"];
  snapshotTimelineEntries: TimelineEntries;
  setWorkspace: WorkspaceSetter;
  setIsHydrated: (isHydrated: boolean) => void;
  setPersistenceMode: (mode: PersistenceMode) => void;
  setLocalProtectionStatus: (status: WorkspaceLocalProtectionStatus) => void;
  setBlockedProtectionReason: (
    reason: BlockedEncryptedWorkspaceReason | null,
  ) => void;
  setLogEntries: Dispatch<SetStateAction<WorkspaceSnapshot["logs"]>>;
  setTimelineEntries: Dispatch<SetStateAction<TimelineEntries>>;
};

export function useWorkspaceHydration({
  canHydrate,
  defaultWorkspace,
  isPrivacyModeLoaded,
  isHydrated,
  ownerScopeKey,
  privacyMode,
  persistenceMode,
  setBlockedProtectionReason,
  setIsHydrated,
  setLogEntries,
  setLocalProtectionStatus,
  setPersistenceMode,
  setTimelineEntries,
  setWorkspace,
  snapshotLogEntries,
  snapshotTimelineEntries,
  workspace,
}: UseWorkspaceHydrationArgs) {
  const latestWorkspaceRef = useRef(workspace);

  useEffect(() => {
    latestWorkspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    let isMounted = true;

    setIsHydrated(false);
    setPersistenceMode("memory");
    setLocalProtectionStatus("standard");
    setBlockedProtectionReason(null);
    setWorkspace(cloneWorkspaceSnapshot(defaultWorkspace));

    if (!isPrivacyModeLoaded || !canHydrate) {
      return () => {
        isMounted = false;
      };
    }

    void (async () => {
      const loaded = await loadPersistedWorkspace(
        defaultWorkspace,
        ownerScopeKey,
        privacyMode,
      );
      if (!isMounted) return;

      setWorkspace(loaded.workspace);
      setPersistenceMode(loaded.persistenceMode);
      setLocalProtectionStatus(loaded.localProtectionStatus);
      setBlockedProtectionReason(loaded.blockedProtectionReason ?? null);
      setIsHydrated(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [
    canHydrate,
    defaultWorkspace,
    isPrivacyModeLoaded,
    ownerScopeKey,
    privacyMode,
    setBlockedProtectionReason,
    setIsHydrated,
    setLocalProtectionStatus,
    setPersistenceMode,
    setWorkspace,
  ]);

  useLayoutEffect(() => {
    if (!isHydrated || !canHydrate) return;
    void persistWorkspace(workspace, ownerScopeKey, privacyMode);
  }, [canHydrate, isHydrated, ownerScopeKey, privacyMode, workspace]);

  useEffect(() => {
    if (!isHydrated || !canHydrate) return;

    let flushInFlight = false;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "background" && nextState !== "inactive") {
        return;
      }

      if (flushInFlight) return;
      flushInFlight = true;

      void (async () => {
        try {
          await persistWorkspace(
            latestWorkspaceRef.current,
            ownerScopeKey,
            privacyMode,
          );
          await waitForWorkspacePersistence();
        } finally {
          flushInFlight = false;
        }
      })();
    });

    return () => {
      subscription.remove();
    };
  }, [canHydrate, isHydrated, ownerScopeKey, privacyMode]);

  useEffect(() => {
    setLogEntries(snapshotLogEntries);
    setTimelineEntries(snapshotTimelineEntries);

    if (!isHydrated || persistenceMode !== "watermelondb") return;

    let cancelled = false;

    void (async () => {
      await waitForWorkspacePersistence();
      if (cancelled) return;

      try {
        const database = await getWorkspaceDatabase(ownerScopeKey);
        if (!database) return;

        const queriedLogReadModel = await loadLogReadModelFromWatermelon(
          database,
          workspace.generatedAt,
        );

        if (!cancelled) {
          setLogEntries(queriedLogReadModel.logEntries);
          setTimelineEntries(queriedLogReadModel.timelineEntries);
        }
      } catch {
        // Keep snapshot-derived entries if the Watermelon query path fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isHydrated,
    persistenceMode,
    setLogEntries,
    setTimelineEntries,
    snapshotLogEntries,
    snapshotTimelineEntries,
    ownerScopeKey,
    workspace.generatedAt,
  ]);
}
