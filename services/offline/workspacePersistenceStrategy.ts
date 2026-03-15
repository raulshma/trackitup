import type { PersistenceMode } from "@/stores/useWorkspaceStore";
import type { WorkspaceSnapshot } from "@/types/trackitup";

import { trackItUpSeedIdSets } from "../../constants/TrackItUpSeedIds.ts";

export type PersistenceAvailability = {
  hasWatermelon?: boolean;
  hasLocalStorage: boolean;
  hasFileSystem: boolean;
};

const seededSpaceIds = trackItUpSeedIdSets.spaces;
const seededAssetIds = trackItUpSeedIdSets.assets;
const seededMetricIds = trackItUpSeedIdSets.metricDefinitions;
const seededRoutineIds = trackItUpSeedIdSets.routines;
const seededReminderIds = trackItUpSeedIdSets.reminders;
const seededLogIds = trackItUpSeedIdSets.logs;
const seededExpenseIds = trackItUpSeedIdSets.expenses;
const seededTemplateIds = trackItUpSeedIdSets.templates;

function normalizeSpaceMembership(entity: {
  spaceId?: string;
  spaceIds?: string[];
}) {
  const next = entity.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) {
    return Array.from(new Set(next));
  }
  return entity.spaceId ? [entity.spaceId] : [];
}

function sanitizeSpaceMembership(
  entity: { spaceId?: string; spaceIds?: string[] },
  validSpaceIds: Set<string>,
) {
  const filteredSpaceIds = normalizeSpaceMembership(entity).filter((spaceId) =>
    validSpaceIds.has(spaceId),
  );

  if (filteredSpaceIds.length === 0) {
    return null;
  }

  return {
    spaceId: filteredSpaceIds[0],
    spaceIds: filteredSpaceIds,
  };
}

function shouldStripLegacySeedData(fallback: WorkspaceSnapshot) {
  return (
    fallback.spaces.length === 0 &&
    fallback.assets.length === 0 &&
    fallback.metricDefinitions.length === 0 &&
    fallback.routines.length === 0 &&
    fallback.reminders.length === 0 &&
    fallback.recurringPlans.length === 0 &&
    fallback.recurringOccurrences.length === 0 &&
    fallback.logs.length === 0
  );
}

function containsLegacySeedData(snapshot: WorkspaceSnapshot) {
  return (
    snapshot.spaces.some((space) => seededSpaceIds.has(space.id)) ||
    snapshot.assets.some((asset) => seededAssetIds.has(asset.id)) ||
    snapshot.metricDefinitions.some((metric) =>
      seededMetricIds.has(metric.id),
    ) ||
    snapshot.routines.some((routine) => seededRoutineIds.has(routine.id)) ||
    snapshot.reminders.some((reminder) => seededReminderIds.has(reminder.id)) ||
    snapshot.logs.some((log) => seededLogIds.has(log.id)) ||
    snapshot.expenses.some((expense) => seededExpenseIds.has(expense.id))
  );
}

function stripLegacySeedData(
  snapshot: WorkspaceSnapshot,
  fallback: WorkspaceSnapshot,
): WorkspaceSnapshot {
  const spaces = snapshot.spaces.filter(
    (space) => !seededSpaceIds.has(space.id),
  );
  const validSpaceIds = new Set(spaces.map((space) => space.id));

  const assets = snapshot.assets.flatMap((asset) => {
    if (seededAssetIds.has(asset.id)) return [];
    const membership = sanitizeSpaceMembership(asset, validSpaceIds);
    if (!membership) return [];

    return [
      {
        ...asset,
        ...membership,
      },
    ];
  });
  const validAssetIds = new Set(assets.map((asset) => asset.id));

  const metricDefinitions = snapshot.metricDefinitions.flatMap((metric) => {
    if (seededMetricIds.has(metric.id)) return [];
    const membership = sanitizeSpaceMembership(metric, validSpaceIds);
    if (!membership) return [];
    if (metric.assetId && !validAssetIds.has(metric.assetId)) return [];

    return [
      {
        ...metric,
        ...membership,
      },
    ];
  });
  const validMetricIds = new Set(metricDefinitions.map((metric) => metric.id));

  const routines = snapshot.routines.flatMap((routine) => {
    if (seededRoutineIds.has(routine.id)) return [];
    const membership = sanitizeSpaceMembership(routine, validSpaceIds);
    if (!membership) return [];

    return [
      {
        ...routine,
        ...membership,
        steps: routine.steps.filter(
          (step) =>
            (!step.assetId || validAssetIds.has(step.assetId)) &&
            (!step.metricId || validMetricIds.has(step.metricId)),
        ),
      },
    ];
  });
  const validRoutineIds = new Set(routines.map((routine) => routine.id));

  const reminders = snapshot.reminders.flatMap((reminder) => {
    if (seededReminderIds.has(reminder.id)) return [];
    const membership = sanitizeSpaceMembership(reminder, validSpaceIds);
    if (!membership) return [];

    return [
      {
        ...reminder,
        ...membership,
      },
    ];
  });
  const validReminderIds = new Set(reminders.map((reminder) => reminder.id));

  const recurringPlans = snapshot.recurringPlans.flatMap((plan) => {
    const membership = sanitizeSpaceMembership(plan, validSpaceIds);
    if (!membership) return [];

    return [
      {
        ...plan,
        ...membership,
      },
    ];
  });
  const validRecurringPlanIds = new Set(recurringPlans.map((plan) => plan.id));

  const recurringOccurrences = snapshot.recurringOccurrences.flatMap(
    (occurrence) => {
      if (!validRecurringPlanIds.has(occurrence.planId)) return [];
      const membership = sanitizeSpaceMembership(occurrence, validSpaceIds);
      if (!membership) return [];

      return [
        {
          ...occurrence,
          ...membership,
        },
      ];
    },
  );
  const validRecurringOccurrenceIds = new Set(
    recurringOccurrences.map((occurrence) => occurrence.id),
  );

  const initialLogs = snapshot.logs.flatMap((log) => {
    if (seededLogIds.has(log.id)) return [];
    const membership = sanitizeSpaceMembership(log, validSpaceIds);
    if (!membership) return [];

    const nextAssetIds = log.assetIds?.filter((assetId) =>
      validAssetIds.has(assetId),
    );
    const nextMetricReadings = log.metricReadings?.filter((reading) =>
      validMetricIds.has(reading.metricId),
    );

    return [
      {
        ...log,
        ...membership,
        assetIds: nextAssetIds?.length ? nextAssetIds : undefined,
        routineId:
          log.routineId && validRoutineIds.has(log.routineId)
            ? log.routineId
            : undefined,
        reminderId:
          log.reminderId && validReminderIds.has(log.reminderId)
            ? log.reminderId
            : undefined,
        recurringPlanId:
          log.recurringPlanId && validRecurringPlanIds.has(log.recurringPlanId)
            ? log.recurringPlanId
            : undefined,
        recurringOccurrenceId:
          log.recurringOccurrenceId &&
          validRecurringOccurrenceIds.has(log.recurringOccurrenceId)
            ? log.recurringOccurrenceId
            : undefined,
        metricReadings: nextMetricReadings?.length
          ? nextMetricReadings
          : undefined,
      },
    ];
  });
  const validLogIds = new Set(initialLogs.map((log) => log.id));
  const logs = initialLogs.map((log) => ({
    ...log,
    parentLogId:
      log.parentLogId && validLogIds.has(log.parentLogId)
        ? log.parentLogId
        : undefined,
    childLogIds: log.childLogIds?.filter((logId) => validLogIds.has(logId)),
  }));

  const expenses = snapshot.expenses.flatMap((expense) => {
    if (seededExpenseIds.has(expense.id)) return [];
    const membership = sanitizeSpaceMembership(expense, validSpaceIds);
    if (!membership) return [];
    if (expense.assetId && !validAssetIds.has(expense.assetId)) return [];
    if (expense.logId && !validLogIds.has(expense.logId)) return [];

    return [
      {
        ...expense,
        ...membership,
      },
    ];
  });

  const fallbackQuickActionsById = new Map(
    fallback.quickActions.map((action) => [action.id, action] as const),
  );
  const quickActions = snapshot.quickActions.reduce<
    typeof fallback.quickActions
  >((actions, action) => {
    const candidate =
      (action.spaceId && !validSpaceIds.has(action.spaceId)) ||
      (action.routineId && !validRoutineIds.has(action.routineId))
        ? fallbackQuickActionsById.get(action.id)
        : action;

    if (!candidate || actions.some((item) => item.id === candidate.id)) {
      return actions;
    }

    return [...actions, candidate];
  }, []);

  for (const action of fallback.quickActions) {
    if (!quickActions.some((item) => item.id === action.id)) {
      quickActions.push(action);
    }
  }

  const dashboardWidgets = snapshot.dashboardWidgets.reduce<
    typeof fallback.dashboardWidgets
  >((widgets, widget) => {
    const hasMissingSpace =
      widget.spaceId !== undefined && !validSpaceIds.has(widget.spaceId);
    const hasMissingMetric = (widget.metricIds ?? []).some(
      (metricId) => !validMetricIds.has(metricId),
    );

    if (
      hasMissingSpace ||
      hasMissingMetric ||
      widgets.some((item) => item.id === widget.id)
    ) {
      return widgets;
    }

    return [...widgets, widget];
  }, []);

  for (const widget of fallback.dashboardWidgets) {
    if (!dashboardWidgets.some((item) => item.id === widget.id)) {
      dashboardWidgets.push(widget);
    }
  }

  const templates = snapshot.templates.filter(
    (template) => !seededTemplateIds.has(template.id),
  );

  const hasRemainingWorkspaceData =
    spaces.length > 0 ||
    assets.length > 0 ||
    metricDefinitions.length > 0 ||
    routines.length > 0 ||
    reminders.length > 0 ||
    recurringPlans.length > 0 ||
    recurringOccurrences.length > 0 ||
    logs.length > 0 ||
    expenses.length > 0 ||
    templates.length > 0;

  return {
    ...snapshot,
    generatedAt: hasRemainingWorkspaceData
      ? snapshot.generatedAt
      : fallback.generatedAt,
    spaces,
    assets,
    metricDefinitions,
    routines,
    reminders,
    recurringPlans,
    recurringOccurrences,
    logs,
    quickActions,
    expenses,
    dashboardWidgets,
    templates,
  };
}

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

  const normalizedSnapshot = {
    generatedAt:
      typeof candidate.generatedAt === "string"
        ? candidate.generatedAt
        : safeFallback.generatedAt,
    spaces: Array.isArray(candidate.spaces)
      ? candidate.spaces
      : safeFallback.spaces,
    assets: Array.isArray(candidate.assets)
      ? candidate.assets.map((asset) => ({
          ...asset,
          spaceIds: Array.isArray(asset.spaceIds)
            ? asset.spaceIds
            : asset.spaceId
              ? [asset.spaceId]
              : [],
        }))
      : safeFallback.assets,
    metricDefinitions: Array.isArray(candidate.metricDefinitions)
      ? candidate.metricDefinitions.map((metric) => ({
          ...metric,
          spaceIds: Array.isArray(metric.spaceIds)
            ? metric.spaceIds
            : metric.spaceId
              ? [metric.spaceId]
              : [],
        }))
      : safeFallback.metricDefinitions,
    routines: Array.isArray(candidate.routines)
      ? candidate.routines.map((routine) => ({
          ...routine,
          spaceIds: Array.isArray(routine.spaceIds)
            ? routine.spaceIds
            : routine.spaceId
              ? [routine.spaceId]
              : [],
        }))
      : safeFallback.routines,
    reminders: Array.isArray(candidate.reminders)
      ? candidate.reminders.map((reminder) => ({
          ...reminder,
          spaceIds: Array.isArray(reminder.spaceIds)
            ? reminder.spaceIds
            : reminder.spaceId
              ? [reminder.spaceId]
              : [],
          history: Array.isArray(reminder.history) ? reminder.history : [],
        }))
      : safeFallback.reminders,
    recurringPlans: Array.isArray(candidate.recurringPlans)
      ? candidate.recurringPlans.map((plan) => ({
          ...plan,
          spaceIds: Array.isArray(plan.spaceIds)
            ? plan.spaceIds
            : plan.spaceId
              ? [plan.spaceId]
              : [],
        }))
      : safeFallback.recurringPlans,
    recurringOccurrences: Array.isArray(candidate.recurringOccurrences)
      ? candidate.recurringOccurrences.map((occurrence) => ({
          ...occurrence,
          spaceIds: Array.isArray(occurrence.spaceIds)
            ? occurrence.spaceIds
            : occurrence.spaceId
              ? [occurrence.spaceId]
              : [],
          history: Array.isArray(occurrence.history) ? occurrence.history : [],
        }))
      : safeFallback.recurringOccurrences,
    logs: Array.isArray(candidate.logs)
      ? candidate.logs.map((log) => ({
          ...log,
          spaceIds: Array.isArray(log.spaceIds)
            ? log.spaceIds
            : log.spaceId
              ? [log.spaceId]
              : [],
          attachments: Array.isArray(log.attachments)
            ? log.attachments
            : undefined,
        }))
      : safeFallback.logs,
    quickActions: Array.isArray(candidate.quickActions)
      ? candidate.quickActions
      : safeFallback.quickActions,
    expenses: Array.isArray(candidate.expenses)
      ? candidate.expenses.map((expense) => ({
          ...expense,
          spaceIds: Array.isArray(expense.spaceIds)
            ? expense.spaceIds
            : expense.spaceId
              ? [expense.spaceId]
              : [],
        }))
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

  if (
    shouldStripLegacySeedData(safeFallback) &&
    containsLegacySeedData(normalizedSnapshot)
  ) {
    return stripLegacySeedData(normalizedSnapshot, safeFallback);
  }

  return normalizedSnapshot;
}
