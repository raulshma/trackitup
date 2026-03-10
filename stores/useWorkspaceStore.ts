import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { createEmptyWorkspaceSnapshot } from "@/constants/TrackItUpDefaults";
import type { WorkspaceSnapshot } from "@/types/trackitup";

export type PersistenceMode =
  | "watermelondb"
  | "local-storage"
  | "file-system"
  | "memory";

export type WorkspaceUpdater =
  | WorkspaceSnapshot
  | ((current: WorkspaceSnapshot) => WorkspaceSnapshot);

type WorkspaceStoreState = {
  workspace: WorkspaceSnapshot;
  isHydrated: boolean;
  persistenceMode: PersistenceMode;
  setWorkspace: (updater: WorkspaceUpdater) => void;
  setIsHydrated: (isHydrated: boolean) => void;
  setPersistenceMode: (mode: PersistenceMode) => void;
};

function cloneWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
): WorkspaceSnapshot {
  if (typeof structuredClone === "function") {
    return structuredClone(snapshot);
  }

  return JSON.parse(JSON.stringify(snapshot)) as WorkspaceSnapshot;
}

export const useWorkspaceStoreState = create<WorkspaceStoreState>()(
  immer((set) => ({
    workspace: cloneWorkspaceSnapshot(createEmptyWorkspaceSnapshot()),
    isHydrated: false,
    persistenceMode: "memory",
    setWorkspace: (updater) =>
      set((state) => {
        state.workspace =
          typeof updater === "function"
            ? (updater as (current: WorkspaceSnapshot) => WorkspaceSnapshot)(
                state.workspace,
              )
            : updater;
      }),
    setIsHydrated: (isHydrated) =>
      set((state) => {
        state.isHydrated = isHydrated;
      }),
    setPersistenceMode: (mode) =>
      set((state) => {
        state.persistenceMode = mode;
      }),
  })),
);
