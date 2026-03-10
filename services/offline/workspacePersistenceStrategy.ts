import type { PersistenceMode } from "@/stores/useWorkspaceStore";
import type { WorkspaceSnapshot } from "@/types/trackitup";

export type PersistenceAvailability = {
  hasWatermelon?: boolean;
  hasLocalStorage: boolean;
  hasFileSystem: boolean;
};

export function choosePersistenceMode({
  hasWatermelon,
  hasFileSystem,
  hasLocalStorage,
}: PersistenceAvailability): PersistenceMode {
  if (hasWatermelon) return "watermelondb";
  if (hasLocalStorage) return "local-storage";
  if (hasFileSystem) return "file-system";
  return "memory";
}

export function hasCoreWorkspaceShape(
  value: unknown,
): value is WorkspaceSnapshot {
  if (!value || typeof value !== "object") return false;

  const candidate = value as WorkspaceSnapshot;

  return (
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.spaces) &&
    Array.isArray(candidate.assets) &&
    Array.isArray(candidate.metricDefinitions) &&
    Array.isArray(candidate.routines) &&
    Array.isArray(candidate.reminders) &&
    Array.isArray(candidate.logs) &&
    Array.isArray(candidate.quickActions)
  );
}

export function normalizeWorkspaceSnapshot(
  value: unknown,
  fallback: WorkspaceSnapshot,
  cloneSnapshot: (snapshot: WorkspaceSnapshot) => WorkspaceSnapshot,
): WorkspaceSnapshot | null {
  if (!hasCoreWorkspaceShape(value)) return null;

  const candidate = value as Partial<WorkspaceSnapshot>;
  const safeFallback = cloneSnapshot(fallback);

  return {
    generatedAt:
      typeof candidate.generatedAt === "string"
        ? candidate.generatedAt
        : safeFallback.generatedAt,
    spaces: Array.isArray(candidate.spaces)
      ? candidate.spaces
      : safeFallback.spaces,
    assets: Array.isArray(candidate.assets)
      ? candidate.assets
      : safeFallback.assets,
    metricDefinitions: Array.isArray(candidate.metricDefinitions)
      ? candidate.metricDefinitions
      : safeFallback.metricDefinitions,
    routines: Array.isArray(candidate.routines)
      ? candidate.routines
      : safeFallback.routines,
    reminders: Array.isArray(candidate.reminders)
      ? candidate.reminders.map((reminder) => ({
          ...reminder,
          history: Array.isArray(reminder.history) ? reminder.history : [],
        }))
      : safeFallback.reminders,
    logs: Array.isArray(candidate.logs)
      ? candidate.logs.map((log) => ({
          ...log,
          attachments: Array.isArray(log.attachments)
            ? log.attachments
            : undefined,
        }))
      : safeFallback.logs,
    quickActions: Array.isArray(candidate.quickActions)
      ? candidate.quickActions
      : safeFallback.quickActions,
    expenses: Array.isArray(candidate.expenses)
      ? candidate.expenses
      : safeFallback.expenses,
    dashboardWidgets: Array.isArray(candidate.dashboardWidgets)
      ? candidate.dashboardWidgets
      : safeFallback.dashboardWidgets,
    templates: Array.isArray(candidate.templates)
      ? candidate.templates
      : safeFallback.templates,
    syncQueue: Array.isArray(candidate.syncQueue)
      ? candidate.syncQueue
      : safeFallback.syncQueue,
    lastSyncAt:
      typeof candidate.lastSyncAt === "string"
        ? candidate.lastSyncAt
        : safeFallback.lastSyncAt,
    lastSyncError:
      typeof candidate.lastSyncError === "string"
        ? candidate.lastSyncError
        : safeFallback.lastSyncError,
  };
}
