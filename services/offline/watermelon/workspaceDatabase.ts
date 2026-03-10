import { Database } from "@nozbe/watermelondb";
import type { DatabaseAdapter } from "@nozbe/watermelondb/adapters/type";

import { workspaceWatermelonModels } from "@/services/offline/watermelon/workspaceModels";
import { workspaceWatermelonSchema } from "@/services/offline/watermelon/workspaceSchema";

const DB_NAME = "trackitup-workspace";

let databasePromise: Promise<Database | null> | null = null;

type WatermelonGlobal = typeof globalThis & {
  nativeWatermelonCreateAdapter?: unknown;
};

function getRuntimeKind() {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return "web" as const;
  }

  if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
    return "react-native" as const;
  }

  return "node" as const;
}

function hasNativeWatermelonBridge() {
  if (getRuntimeKind() !== "react-native") return false;

  try {
    const reactNative =
      require("react-native") as typeof import("react-native");
    const runtimeGlobal = globalThis as WatermelonGlobal;
    return Boolean(
      runtimeGlobal.nativeWatermelonCreateAdapter ||
      reactNative.NativeModules?.WMDatabaseBridge ||
      reactNative.NativeModules?.WMDatabaseJSIBridge,
    );
  } catch {
    return false;
  }
}

function createDatabaseAdapter(): DatabaseAdapter | null {
  const runtimeKind = getRuntimeKind();
  const LokiJSAdapter = require("@nozbe/watermelondb/adapters/lokijs/index.js")
    .default as new (options: {
    dbName?: string;
    schema: typeof workspaceWatermelonSchema;
    useWebWorker?: boolean;
  }) => DatabaseAdapter;
  const SQLiteAdapter = require("@nozbe/watermelondb/adapters/sqlite/index.js")
    .default as new (options: {
    dbName?: string;
    schema: typeof workspaceWatermelonSchema;
  }) => DatabaseAdapter & { initializingPromise?: Promise<void> };

  if (runtimeKind === "web") {
    return new LokiJSAdapter({
      dbName: DB_NAME,
      schema: workspaceWatermelonSchema,
      useWebWorker: false,
    });
  }

  if (runtimeKind === "node") {
    return new SQLiteAdapter({
      dbName: `${DB_NAME}-node`,
      schema: workspaceWatermelonSchema,
    });
  }

  if (!hasNativeWatermelonBridge()) {
    return null;
  }

  return new SQLiteAdapter({
    dbName: DB_NAME,
    schema: workspaceWatermelonSchema,
  });
}

async function initializeAdapter(adapter: DatabaseAdapter) {
  const maybeInitializingAdapter = adapter as DatabaseAdapter & {
    initializingPromise?: Promise<void>;
  };

  if (
    "initializingPromise" in maybeInitializingAdapter &&
    maybeInitializingAdapter.initializingPromise
  ) {
    await maybeInitializingAdapter.initializingPromise;
  }
}

async function createWorkspaceDatabase() {
  const adapter = createDatabaseAdapter();
  if (!adapter) return null;

  await initializeAdapter(adapter);

  return new Database({
    adapter,
    modelClasses: workspaceWatermelonModels,
  });
}

export function isWatermelonPersistenceAvailable() {
  return createDatabaseAdapter() !== null;
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
