import type { PersistenceMode } from "../../stores/useWorkspaceStore.ts";

import type { BlockedEncryptedWorkspaceReason } from "./workspaceEncryptedPersistence.ts";

export type WorkspaceLocalProtectionStatus =
  | "protected"
  | "standard"
  | "blocked";

export function getWorkspaceLocalProtectionLabel(
  status: WorkspaceLocalProtectionStatus,
) {
  switch (status) {
    case "protected":
      return "Protected";
    case "blocked":
      return "Blocked";
    default:
      return "Compatibility";
  }
}

export function getWorkspaceLocalProtectionDescription({
  blockedReason,
  persistenceMode,
  status,
}: {
  status: WorkspaceLocalProtectionStatus;
  persistenceMode: PersistenceMode;
  blockedReason?: BlockedEncryptedWorkspaceReason | null;
}) {
  if (status === "protected") {
    if (persistenceMode === "memory") {
      return "Protected mode is selected for this scope, but secure local persistence is unavailable in this environment, so workspace data stays in memory only on this device.";
    }

    return `This workspace scope uses protected local snapshots on this device. Current storage mode: ${persistenceMode}.`;
  }

  if (status === "blocked") {
    switch (blockedReason) {
      case "missing-key":
        return "TrackItUp found a protected local workspace for this scope, but its encryption key is no longer available on this device. Reset the blocked protected workspace to continue saving locally.";
      case "invalid-envelope":
      case "invalid-payload":
      case "decrypt-failed":
        return "TrackItUp found a protected local workspace for this scope, but it could not verify or decrypt it. Reset the blocked protected workspace to continue saving locally.";
      default:
        return "TrackItUp found a protected local workspace for this scope, but secure local decryption is unavailable in this environment. Reset the blocked protected workspace to continue saving locally.";
    }
  }

  return `This workspace is using compatibility local persistence on this device, so app-level encrypted local storage is not active for the current scope. Current storage mode: ${persistenceMode}.`;
}
