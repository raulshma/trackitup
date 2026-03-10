import type { Database } from "@nozbe/watermelondb";

import { ANONYMOUS_WORKSPACE_SCOPE_KEY } from "@/services/offline/workspaceOwnership";

export type WorkspaceDatabaseOptions = {
  useLegacyName?: boolean;
};

export function isWatermelonPersistenceAvailable() {
  return false;
}

export async function getWorkspaceDatabase(
  _ownerScopeKey = ANONYMOUS_WORKSPACE_SCOPE_KEY,
  _options?: WorkspaceDatabaseOptions,
): Promise<Database | null> {
  return null;
}

export function resetWorkspaceDatabaseCache(
  _ownerScopeKey?: string,
  _options?: WorkspaceDatabaseOptions,
) {}
