import {
    getOverviewStats,
    getSpaceSummaries,
} from "../../constants/TrackItUpSelectors.ts";
import type {
    WorkspaceRecommendation,
    WorkspaceSnapshot,
} from "../../types/trackitup.ts";
import {
    getReminderScheduleTimestamp,
    isReminderOpen,
} from "./workspaceInsights.ts";
import { getWorkspaceRecommendations } from "./workspaceRecommendations.ts";
import { buildWorkspaceVisualHistory } from "./workspaceVisualHistory.ts";

export type WorkspaceDashboardPulseRoute =
  | "action-center"
  | "planner"
  | "logbook"
  | "inventory"
  | "visual-history";

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function primarySpaceId(value: { spaceId?: string; spaceIds?: string[] }) {
  return normalizeSpaceIds(value)[0] ?? value.spaceId;
}

export type WorkspaceDashboardPulseAttentionItem = {
  id: string;
  kind: "metric-alert" | "reminder-alert";
  title: string;
  detail: string;
  route: WorkspaceDashboardPulseRoute;
  spaceId?: string;
};

export type WorkspaceDashboardPulseSummary = {
  summary: {
    spaceCount: number;
    assetCount: number;
    logCount: number;
    openReminderCount: number;
    recommendationCount: number;
    visibleWidgetCount: number;
    hiddenWidgetCount: number;
  };
  overviewStats: Array<{ label: string; value: string }>;
  recommendations: Array<{
    id: string;
    title: string;
    explanation: string;
    severity: WorkspaceRecommendation["severity"];
    actionLabel: string;
    route: WorkspaceDashboardPulseRoute;
    spaceId?: string;
  }>;
  attentionItems: WorkspaceDashboardPulseAttentionItem[];
  activeSpaces: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    note: string;
    lastLog: string;
    pendingTasks: number;
    photoCount: number;
    route: "visual-history";
  }>;
};

function mapRecommendationRoute(
  recommendation: WorkspaceRecommendation,
): WorkspaceDashboardPulseRoute {
  if (recommendation.action.kind === "open-inventory") return "inventory";
  if (recommendation.action.kind === "open-logbook") return "logbook";
  return "planner";
}

export function buildWorkspaceDashboardPulse(
  workspace: WorkspaceSnapshot,
): WorkspaceDashboardPulseSummary {
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const metricsById = new Map(
    workspace.metricDefinitions.map((metric) => [metric.id, metric] as const),
  );
  const spacePhotoCounts = new Map(
    buildWorkspaceVisualHistory(workspace).spaceGalleries.map((gallery) => [
      gallery.id,
      gallery.photoCount,
    ]),
  );
  const recommendations = getWorkspaceRecommendations(workspace)
    .slice(0, 4)
    .map((recommendation) => ({
      id: recommendation.id,
      title: recommendation.title,
      explanation: recommendation.explanation,
      severity: recommendation.severity,
      actionLabel: recommendation.action.label,
      route: mapRecommendationRoute(recommendation),
      spaceId: recommendation.spaceId,
    }));

  const metricAlerts = [...workspace.logs]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .flatMap((log) =>
      (log.metricReadings ?? []).flatMap((reading) => {
        if (typeof reading.value !== "number") return [];
        const metric = metricsById.get(reading.metricId);
        if (!metric) return [];
        const belowSafeMin =
          metric.safeMin !== undefined && reading.value < metric.safeMin;
        const aboveSafeMax =
          metric.safeMax !== undefined && reading.value > metric.safeMax;
        if (!belowSafeMin && !aboveSafeMax) return [];
        const logSpaceId = primarySpaceId(log);
        const spaceName =
          spacesById.get(logSpaceId ?? "")?.name ?? "Unknown space";
        return [
          {
            id: `metric-alert:${log.id}:${metric.id}`,
            kind: "metric-alert" as const,
            title: `${metric.name} is outside the safe zone`,
            detail: `${reading.value}${metric.unitLabel ? ` ${metric.unitLabel}` : ""} in ${spaceName}`,
            route: "planner" as const,
            spaceId: logSpaceId,
            priority: 3,
            timestamp: log.occurredAt,
          },
        ];
      }),
    );

  const reminderAlerts = workspace.reminders
    .filter(isReminderOpen)
    .map((reminder) => ({
      id: `reminder-alert:${reminder.id}`,
      kind: "reminder-alert" as const,
      title: reminder.title,
      detail: `${reminder.status} • ${reminder.ruleLabel ?? reminder.triggerCondition ?? "Needs follow-up"}`,
      route: "planner" as const,
      spaceId: primarySpaceId(reminder),
      priority: reminder.status === "due" ? 4 : 2,
      timestamp: getReminderScheduleTimestamp(reminder),
    }));

  const attentionItems = [...reminderAlerts, ...metricAlerts]
    .sort((left, right) => {
      if (right.priority !== left.priority)
        return right.priority - left.priority;
      return left.timestamp.localeCompare(right.timestamp);
    })
    .filter(
      (item, index, list) =>
        list.findIndex((candidate) => candidate.title === item.title) === index,
    )
    .slice(0, 5)
    .map(({ priority: _priority, timestamp: _timestamp, ...item }) => item);

  const activeSpaces = getSpaceSummaries(workspace)
    .map((space) => ({
      id: space.id,
      name: space.name,
      category: space.category,
      status: space.status,
      note: space.note,
      lastLog: space.lastLog,
      pendingTasks: space.pendingTasks,
      photoCount: spacePhotoCounts.get(space.id) ?? 0,
      route: "visual-history" as const,
    }))
    .sort((left, right) => {
      if (right.pendingTasks !== left.pendingTasks) {
        return right.pendingTasks - left.pendingTasks;
      }
      if (right.photoCount !== left.photoCount)
        return right.photoCount - left.photoCount;
      return left.name.localeCompare(right.name);
    })
    .slice(0, 4);

  return {
    summary: {
      spaceCount: workspace.spaces.length,
      assetCount: workspace.assets.length,
      logCount: workspace.logs.length,
      openReminderCount: workspace.reminders.filter(isReminderOpen).length,
      recommendationCount: recommendations.length,
      visibleWidgetCount: workspace.dashboardWidgets.filter(
        (widget) => !widget.hidden,
      ).length,
      hiddenWidgetCount: workspace.dashboardWidgets.filter(
        (widget) => widget.hidden,
      ).length,
    },
    overviewStats: getOverviewStats(workspace),
    recommendations,
    attentionItems,
    activeSpaces,
  };
}
