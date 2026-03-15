import type {
    WorkspaceRecommendation,
    WorkspaceSnapshot,
} from "../../types/trackitup";
import {
    getReminderScheduleTimestamp,
    isReminderOpen,
} from "./workspaceInsights.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const severityRank = { high: 0, medium: 1, low: 2 } as const;

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function primarySpaceId(value: { spaceId?: string; spaceIds?: string[] }) {
  return normalizeSpaceIds(value)[0] ?? value.spaceId;
}

function belongsToSpace(
  value: { spaceId?: string; spaceIds?: string[] },
  spaceId: string,
) {
  return normalizeSpaceIds(value).includes(spaceId);
}

function addDays(timestamp: string, days: number) {
  return new Date(new Date(timestamp).getTime() + days * DAY_MS).toISOString();
}

function buildReminderRecommendations(workspace: WorkspaceSnapshot) {
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const now = workspace.generatedAt;

  return workspace.reminders
    .filter(isReminderOpen)
    .sort((left, right) =>
      getReminderScheduleTimestamp(left).localeCompare(
        getReminderScheduleTimestamp(right),
      ),
    )
    .flatMap<WorkspaceRecommendation>((reminder) => {
      const dueAt = getReminderScheduleTimestamp(reminder);
      if (dueAt > addDays(now, 1)) return [];
      const reminderSpaceId = primarySpaceId(reminder);
      const spaceName =
        spacesById.get(reminderSpaceId ?? "")?.name ?? "Unknown space";
      const overdue = dueAt <= now;

      return [
        {
          id: `recommendation-reminder-${reminder.id}`,
          type: "overdue-reminder",
          severity: overdue ? "high" : "medium",
          title: overdue
            ? `Complete ${reminder.title}`
            : `Prepare for ${reminder.title}`,
          explanation: overdue
            ? `${spaceName} still has this reminder open from ${new Date(dueAt).toLocaleString()}.`
            : `${spaceName} has this reminder coming up at ${new Date(dueAt).toLocaleString()}.`,
          createdAt: dueAt,
          reminderId: reminder.id,
          spaceId: reminderSpaceId,
          action: {
            kind: "open-planner",
            label: overdue ? "Review in action center" : "Open planner",
          },
        },
      ];
    })
    .slice(0, 3);
}

function buildMetricRecommendations(workspace: WorkspaceSnapshot) {
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const metricsById = new Map(
    workspace.metricDefinitions.map((metric) => [metric.id, metric] as const),
  );
  const latestByMetric = new Map<string, WorkspaceRecommendation>();

  [...workspace.logs]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .forEach((log) => {
      (log.metricReadings ?? []).forEach((reading) => {
        if (
          latestByMetric.has(reading.metricId) ||
          typeof reading.value !== "number"
        ) {
          return;
        }

        const metric = metricsById.get(reading.metricId);
        if (!metric) return;
        const belowSafeMin =
          metric.safeMin !== undefined && reading.value < metric.safeMin;
        const aboveSafeMax =
          metric.safeMax !== undefined && reading.value > metric.safeMax;
        if (!belowSafeMin && !aboveSafeMax) return;

        const logSpaceId = primarySpaceId(log);
        const spaceName =
          spacesById.get(logSpaceId ?? "")?.name ?? "Unknown space";
        latestByMetric.set(reading.metricId, {
          id: `recommendation-metric-${reading.metricId}`,
          type: "metric-alert",
          severity: "high",
          title: `${metric.name} is outside the safe zone`,
          explanation: `${spaceName} logged ${reading.value}${metric.unitLabel ? ` ${metric.unitLabel}` : ""} on ${new Date(log.occurredAt).toLocaleDateString()}. Record a fresh reading or investigate the cause.`,
          createdAt: log.occurredAt,
          spaceId: logSpaceId,
          metricId: metric.id,
          action: {
            kind: "open-logbook",
            label: "Log a fresh reading",
            actionId: "quick-metric",
          },
        });
      });
    });

  return Array.from(latestByMetric.values()).slice(0, 2);
}

function buildStaleSpaceRecommendations(workspace: WorkspaceSnapshot) {
  const staleThreshold = addDays(workspace.generatedAt, -10);

  return workspace.spaces.flatMap<WorkspaceRecommendation>((space) => {
    const latestLog = workspace.logs
      .filter((log) => belongsToSpace(log, space.id))
      .sort((left, right) =>
        right.occurredAt.localeCompare(left.occurredAt),
      )[0];
    if (!latestLog || latestLog.occurredAt >= staleThreshold) return [];

    return [
      {
        id: `recommendation-space-${space.id}`,
        type: "stale-space",
        severity: "low",
        title: `Check in on ${space.name}`,
        explanation: `No new logs have been recorded for this space since ${new Date(latestLog.occurredAt).toLocaleDateString()}.`,
        createdAt: latestLog.occurredAt,
        spaceId: space.id,
        action: {
          kind: "open-logbook",
          label: "Add a quick log",
          actionId: "quick-log",
        },
      },
    ];
  });
}

function buildWarrantyRecommendations(workspace: WorkspaceSnapshot) {
  const upcomingThreshold = addDays(workspace.generatedAt, 30);

  return workspace.assets.flatMap<WorkspaceRecommendation>((asset) => {
    if (
      !asset.warrantyExpiresAt ||
      asset.warrantyExpiresAt > upcomingThreshold
    ) {
      return [];
    }

    return [
      {
        id: `recommendation-warranty-${asset.id}`,
        type: "warranty-expiring",
        severity:
          asset.warrantyExpiresAt <= workspace.generatedAt ? "high" : "medium",
        title: `Review ${asset.name} warranty coverage`,
        explanation: `This asset has warranty coverage ending on ${new Date(asset.warrantyExpiresAt).toLocaleDateString()}.`,
        createdAt: asset.warrantyExpiresAt,
        assetId: asset.id,
        spaceId: primarySpaceId(asset),
        action: { kind: "open-inventory", label: "Open inventory" },
      },
    ];
  });
}

export function getWorkspaceRecommendations(
  workspace: WorkspaceSnapshot,
  maxItems = 6,
): WorkspaceRecommendation[] {
  return [
    ...buildReminderRecommendations(workspace),
    ...buildMetricRecommendations(workspace),
    ...buildWarrantyRecommendations(workspace),
    ...buildStaleSpaceRecommendations(workspace),
  ]
    .sort((left, right) => {
      const severityDelta =
        severityRank[left.severity] - severityRank[right.severity];
      if (severityDelta !== 0) return severityDelta;
      return right.createdAt.localeCompare(left.createdAt);
    })
    .slice(0, maxItems);
}
