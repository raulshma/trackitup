import { useEffect, type Dispatch, type SetStateAction } from "react";

import { getTimelineEntries } from "@/constants/TrackItUpSelectors";
import {
  getWorkspaceDatabase,
} from "@/services/offline/watermelon/workspaceDatabase";
import { loadLogReadModelFromWatermelon } from "@/services/offline/watermelon/workspaceQueries";
import {
  loadPersistedWorkspace,
  persistWorkspace,
  waitForWorkspacePersistence,
} from "@/services/offline/workspacePersistence";
import type {
  PersistenceMode,
  WorkspaceUpdater,
} from "@/stores/useWorkspaceStore";
import type { WorkspaceSnapshot } from "@/types/trackitup";

type TimelineEntries = ReturnType<typeof getTimelineEntries>;
type WorkspaceSetter = (updater: WorkspaceUpdater) => void;

type UseWorkspaceHydrationArgs = {
  workspace: WorkspaceSnapshot;
  isHydrated: boolean;
  persistenceMode: PersistenceMode;
  defaultWorkspace: WorkspaceSnapshot;
  snapshotLogEntries: WorkspaceSnapshot["logs"];
  snapshotTimelineEntries: TimelineEntries;
  setWorkspace: WorkspaceSetter;
  setIsHydrated: (isHydrated: boolean) => void;
  setPersistenceMode: (mode: PersistenceMode) => void;
  setLogEntries: Dispatch<SetStateAction<WorkspaceSnapshot["logs"]>>;
  setTimelineEntries: Dispatch<SetStateAction<TimelineEntries>>;
};

export function useWorkspaceHydration({
  defaultWorkspace,
  isHydrated,
  persistenceMode,
  setIsHydrated,
  setLogEntries,
  setPersistenceMode,
  setTimelineEntries,
  setWorkspace,
  snapshotLogEntries,
  snapshotTimelineEntries,
  workspace,
}: UseWorkspaceHydrationArgs) {
  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const loaded = await loadPersistedWorkspace(defaultWorkspace);
      if (!isMounted) return;

      setWorkspace(loaded.workspace);
      setPersistenceMode(loaded.persistenceMode);
      setIsHydrated(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [defaultWorkspace, setIsHydrated, setPersistenceMode, setWorkspace]);

  useEffect(() => {
    if (!isHydrated) return;
    void persistWorkspace(workspace);
  }, [isHydrated, workspace]);

  useEffect(() => {
    setLogEntries(snapshotLogEntries);
    setTimelineEntries(snapshotTimelineEntries);

    if (!isHydrated || persistenceMode !== "watermelondb") return;

    let cancelled = false;

    void (async () => {
      await waitForWorkspacePersistence();
      if (cancelled) return;

      try {
        const database = await getWorkspaceDatabase();
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
    workspace.generatedAt,
  ]);
}
