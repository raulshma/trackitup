import { Database } from "@nozbe/watermelondb";
import type { DatabaseAdapter } from "@nozbe/watermelondb/adapters/type";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite/index.js";
import { NativeModules } from "react-native";

import { workspaceWatermelonModels } from "@/services/offline/watermelon/workspaceModels";
import { workspaceWatermelonSchema } from "@/services/offline/watermelon/workspaceSchema";

const DB_NAME = "trackitup-workspace";

let databasePromise: Promise<Database | null> | null = null;

type WatermelonGlobal = typeof globalThis & {
  nativeWatermelonCreateAdapter?: unknown;
};

type InitializingAdapter = DatabaseAdapter & {
  initializingPromise?: Promise<void>;
};

function hasNativeWatermelonBridge() {
  const runtimeGlobal = globalThis as WatermelonGlobal;

  return Boolean(
    runtimeGlobal.nativeWatermelonCreateAdapter ||
      NativeModules?.WMDatabaseBridge ||
      NativeModules?.WMDatabaseJSIBridge,
  );
}

async function createWorkspaceDatabase() {
  if (!hasNativeWatermelonBridge()) return null;

  const adapter = new SQLiteAdapter({
    dbName: DB_NAME,
    schema: workspaceWatermelonSchema,
  }) as InitializingAdapter;

  if (adapter.initializingPromise) {
    await adapter.initializingPromise;
  }

  return new Database({
    adapter,
    modelClasses: workspaceWatermelonModels,
  });
}

export function isWatermelonPersistenceAvailable() {
  return hasNativeWatermelonBridge();
}

export async function getWorkspaceDatabase() {
  if (!databasePromise) {
    databasePromise = createWorkspaceDatabase().catch(() => null);
  }

  return databasePromise;
}

export function resetWorkspaceDatabaseCache() {
  databasePromise = null;
}