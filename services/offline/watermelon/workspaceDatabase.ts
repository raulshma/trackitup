import type { Database } from "@nozbe/watermelondb";

export function isWatermelonPersistenceAvailable() {
  return false;
}

export async function getWorkspaceDatabase(): Promise<Database | null> {
  return null;
}

export function resetWorkspaceDatabaseCache() {}
