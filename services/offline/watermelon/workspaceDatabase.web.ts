import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs/index.js";

import { workspaceWatermelonModels } from "@/services/offline/watermelon/workspaceModels";
import { workspaceWatermelonSchema } from "@/services/offline/watermelon/workspaceSchema";

const DB_NAME = "trackitup-workspace";

let databasePromise: Promise<Database | null> | null = null;

function createWorkspaceDatabase() {
  const adapter = new LokiJSAdapter({
    dbName: DB_NAME,
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
  try {
    createWorkspaceDatabase();
    return true;
  } catch {
    return false;
  }
}

export async function getWorkspaceDatabase() {
  if (!databasePromise) {
    databasePromise = Promise.resolve().then(createWorkspaceDatabase).catch(() => null);
  }

  return databasePromise;
}

export function resetWorkspaceDatabaseCache() {
  databasePromise = null;
}