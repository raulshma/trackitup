import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite/index.js";
import type { DatabaseAdapter } from "@nozbe/watermelondb/adapters/type";
import { NativeModules } from "react-native";

import { workspaceWatermelonModels } from "@/services/offline/watermelon/workspaceModels";
import { workspaceWatermelonSchema } from "@/services/offline/watermelon/workspaceSchema";
import {
    ANONYMOUS_WORKSPACE_SCOPE_KEY,
    buildWorkspaceDatabaseName,
    LEGACY_WORKSPACE_DATABASE_NAME,
} from "@/services/offline/workspaceOwnership";

type WorkspaceDatabaseOptions = {
  useLegacyName?: boolean;
};

const databasePromises = new Map<string, Promise<Database | null>>();

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

function resolveDatabaseName(
  ownerScopeKey = ANONYMOUS_WORKSPACE_SCOPE_KEY,
  options?: WorkspaceDatabaseOptions,
) {
  return options?.useLegacyName
    ? LEGACY_WORKSPACE_DATABASE_NAME
    : buildWorkspaceDatabaseName(ownerScopeKey);
}

async function createWorkspaceDatabase(dbName: string) {
  if (!hasNativeWatermelonBridge()) return null;

  const adapter = new SQLiteAdapter({
    dbName,
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

export async function getWorkspaceDatabase(
  ownerScopeKey = ANONYMOUS_WORKSPACE_SCOPE_KEY,
  options?: WorkspaceDatabaseOptions,
) {
  const dbName = resolveDatabaseName(ownerScopeKey, options);
  if (!databasePromises.has(dbName)) {
    databasePromises.set(
      dbName,
      createWorkspaceDatabase(dbName).catch(() => null),
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
