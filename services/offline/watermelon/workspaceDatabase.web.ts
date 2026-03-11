import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs/index.js";

import { workspaceWatermelonModels } from "@/services/offline/watermelon/workspaceModels";
import { workspaceWatermelonSchema } from "@/services/offline/watermelon/workspaceSchema";
import {
    ANONYMOUS_WORKSPACE_SCOPE_KEY,
    buildWorkspaceDatabaseName,
    LEGACY_WORKSPACE_DATABASE_NAME,
} from "@/services/offline/workspaceOwnership";
import { hasIndexedDb } from "./webIndexedDbAvailability";

type WorkspaceDatabaseOptions = {
  useLegacyName?: boolean;
};

const databasePromises = new Map<string, Promise<Database | null>>();

function resolveDatabaseName(
  ownerScopeKey = ANONYMOUS_WORKSPACE_SCOPE_KEY,
  options?: WorkspaceDatabaseOptions,
) {
  return options?.useLegacyName
    ? LEGACY_WORKSPACE_DATABASE_NAME
    : buildWorkspaceDatabaseName(ownerScopeKey);
}

function createWorkspaceDatabase(dbName: string) {
  const adapter = new LokiJSAdapter({
    dbName,
    schema: workspaceWatermelonSchema,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
  });

  return new Database({
    adapter,
    modelClasses: workspaceWatermelonModels,
  });
}

export function isWatermelonPersistenceAvailable() {
  return hasIndexedDb();
}

export async function getWorkspaceDatabase(
  ownerScopeKey = ANONYMOUS_WORKSPACE_SCOPE_KEY,
  options?: WorkspaceDatabaseOptions,
) {
  const dbName = resolveDatabaseName(ownerScopeKey, options);
  if (!databasePromises.has(dbName)) {
    databasePromises.set(
      dbName,
      Promise.resolve()
        .then(() => createWorkspaceDatabase(dbName))
        .catch(() => null),
    );
  }

  return databasePromises.get(dbName)!;
}

export function resetWorkspaceDatabaseCache(
  ownerScopeKey?: string,
  options?: WorkspaceDatabaseOptions,
) {
  if (!ownerScopeKey) {
    databasePromises.clear();
    return;
  }

  databasePromises.delete(resolveDatabaseName(ownerScopeKey, options));
}
