import type { WorkspaceSnapshot } from "@/types/trackitup";
import { formatSpaceCategoryLabel } from "../../constants/TrackItUpSpaceCategories.ts";

import {
    getReminderScheduleTimestamp,
    isReminderOpen,
} from "./workspaceInsights.ts";

export type WorkspaceTrendDestination =
  | "visual-history"
  | "planner"
  | "inventory";

export type WorkspaceTrendMetricAlert = {
  id: string;
  metricId: string;
  metricName: string;
  value: number;
  unitLabel?: string;
  safeMin?: number;
  safeMax?: number;
  occurredAt: string;
};

export type WorkspaceTrendSpaceSummary = {
  id: string;
  name: string;
  category: string;
  status: string;
  currentPhotoCount: number;
  previousPhotoCount: number;
  currentProofCount: number;
  previousProofCount: number;
  photoDelta: number;
  proofDelta: number;
  latestLogTitle?: string;
  latestLogAt?: string;
  overdueReminderCount: number;
  dueSoonReminderCount: number;
  metricAlerts: WorkspaceTrendMetricAlert[];
};

export type WorkspaceTrendAnomaly = {
  id: string;
  kind: "metric-alert" | "activity-drop" | "activity-spike" | "overdue-load";
  title: string;
  explanation: string;
  spaceId: string;
  route: WorkspaceTrendDestination;
};

export type WorkspaceTrendSummary = {
  monthKey: string;
  previousMonthKey: string;
  totals: {
    currentPhotoCount: number;
    previousPhotoCount: number;
    currentProofCount: number;
    previousProofCount: number;
    spaceCount: number;
    activeSpaceCount: number;
  };
  spaces: WorkspaceTrendSpaceSummary[];
  anomalies: WorkspaceTrendAnomaly[];
};

function shiftMonth(monthKey: string, delta: number) {
  const date = new Date(`${monthKey}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

function addDays(timestamp: string, days: number) {
  return new Date(
    new Date(timestamp).getTime() + days * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function formatNumber(value: number, unitLabel?: string) {
  return `${value}${unitLabel ? ` ${unitLabel}` : ""}`;
}

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function belongsToSpace(
  value: { spaceId?: string; spaceIds?: string[] },
  spaceId: string,
) {
  return normalizeSpaceIds(value).includes(spaceId);
}

export function buildWorkspaceTrendSummary(
  workspace: WorkspaceSnapshot,
  monthKey: string,
): WorkspaceTrendSummary {
  const previousMonthKey = shiftMonth(monthKey, -1);
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const metricsById = new Map(
    workspace.metricDefinitions.map((metric) => [metric.id, metric] as const),
  );
  const dueSoonThreshold = addDays(workspace.generatedAt, 7);

  const summaries = workspace.spaces.map<WorkspaceTrendSpaceSummary>(
    (space) => {
      const logs = workspace.logs.filter((log) =>
        belongsToSpace(log, space.id),
      );
      const currentLogs = logs.filter((log) =>
        log.occurredAt.startsWith(monthKey),
      );
      const previousLogs = logs.filter((log) =>
        log.occurredAt.startsWith(previousMonthKey),
      );
      const countPhotos = (items: typeof logs) =>
        items.reduce(
          (total, log) =>
            total +
            (log.attachments ?? []).filter(
              (attachment) => attachment.mediaType === "photo",
            ).length,
          0,
        );
      const countProofs = (items: typeof logs) =>
        items.reduce((total, log) => {
          const proofCount = (log.attachments ?? []).filter(
            (attachment) => attachment.mediaType === "photo",
          ).length;
          const isProof = Boolean(
            log.routineId ||
            log.reminderId ||
            log.kind === "routine-run" ||
            log.kind === "reminder",
          );
          return total + (isProof ? proofCount : 0);
        }, 0);
      const latestLog = [...logs].sort((left, right) =>
        right.occurredAt.localeCompare(left.occurredAt),
      )[0];
      const overdueReminderCount = workspace.reminders.filter(
        (reminder) =>
          belongsToSpace(reminder, space.id) &&
          isReminderOpen(reminder) &&
          getReminderScheduleTimestamp(reminder) <= workspace.generatedAt,
      ).length;
      const dueSoonReminderCount = workspace.reminders.filter(
        (reminder) =>
          belongsToSpace(reminder, space.id) &&
          isReminderOpen(reminder) &&
          getReminderScheduleTimestamp(reminder) > workspace.generatedAt &&
          getReminderScheduleTimestamp(reminder) <= dueSoonThreshold,
      ).length;
      const metricAlerts = currentLogs
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .flatMap<WorkspaceTrendMetricAlert>((log) =>
          (log.metricReadings ?? []).flatMap((reading) => {
            if (typeof reading.value !== "number") return [];
            const metric = metricsById.get(reading.metricId);
            if (!metric) return [];
            const belowSafeMin =
              metric.safeMin !== undefined && reading.value < metric.safeMin;
            const aboveSafeMax =
              metric.safeMax !== undefined && reading.value > metric.safeMax;
            if (!belowSafeMin && !aboveSafeMax) return [];
            return [
              {
                id: `metric-alert:${space.id}:${metric.id}:${log.id}`,
                metricId: metric.id,
                metricName: metric.name,
                value: reading.value,
                unitLabel: metric.unitLabel,
                safeMin: metric.safeMin,
                safeMax: metric.safeMax,
                occurredAt: log.occurredAt,
              },
            ];
          }),
        )
        .filter(
          (alert, index, alerts) =>
            alerts.findIndex((item) => item.metricId === alert.metricId) ===
            index,
        )
        .slice(0, 3);

      const currentPhotoCount = countPhotos(currentLogs);
      const previousPhotoCount = countPhotos(previousLogs);
      const currentProofCount = countProofs(currentLogs);
      const previousProofCount = countProofs(previousLogs);

      return {
        id: space.id,
        name: space.name,
        category: formatSpaceCategoryLabel(space.category),
        status: space.status,
        currentPhotoCount,
        previousPhotoCount,
        currentProofCount,
        previousProofCount,
        photoDelta: currentPhotoCount - previousPhotoCount,
        proofDelta: currentProofCount - previousProofCount,
        latestLogTitle: latestLog?.title,
        latestLogAt: latestLog?.occurredAt,
        overdueReminderCount,
        dueSoonReminderCount,
        metricAlerts,
      };
    },
  );

  const anomalies = summaries
    .flatMap<WorkspaceTrendAnomaly>((summary) => {
      const items: WorkspaceTrendAnomaly[] = [];
      summary.metricAlerts.forEach((alert) => {
        items.push({
          id: alert.id,
          kind: "metric-alert",
          title: `${summary.name}: ${alert.metricName} is outside the safe zone`,
          explanation: `${formatNumber(alert.value, alert.unitLabel)} was logged in ${monthKey}, outside ${alert.safeMin ?? "-∞"}${alert.safeMax !== undefined ? ` to ${alert.safeMax}` : "+∞"}.`,
          spaceId: summary.id,
          route: "planner",
        });
      });
      if (
        summary.photoDelta <= -2 ||
        (summary.previousPhotoCount >= 2 && summary.currentPhotoCount === 0)
      ) {
        items.push({
          id: `activity-drop:${summary.id}:${monthKey}`,
          kind: "activity-drop",
          title: `${summary.name} activity dropped this month`,
          explanation: `${summary.currentPhotoCount} photo(s) were captured in ${monthKey} versus ${summary.previousPhotoCount} in ${previousMonthKey}.`,
          spaceId: summary.id,
          route: "visual-history",
        });
      }
      if (summary.photoDelta >= 3 || summary.proofDelta >= 2) {
        items.push({
          id: `activity-spike:${summary.id}:${monthKey}`,
          kind: "activity-spike",
          title: `${summary.name} activity spiked this month`,
          explanation: `${summary.currentPhotoCount} photo(s) and ${summary.currentProofCount} proof shot(s) were captured in ${monthKey}.`,
          spaceId: summary.id,
          route: "visual-history",
        });
      }
      if (summary.overdueReminderCount > 0) {
        items.push({
          id: `overdue-load:${summary.id}:${monthKey}`,
          kind: "overdue-load",
          title: `${summary.name} still has overdue follow-up`,
          explanation: `${summary.overdueReminderCount} overdue reminder(s) are still open${summary.dueSoonReminderCount > 0 ? `, with ${summary.dueSoonReminderCount} more due soon` : ""}.`,
          spaceId: summary.id,
          route: "planner",
        });
      }
      return items;
    })
    .sort((left, right) => left.title.localeCompare(right.title))
    .slice(0, 8);

  return {
    monthKey,
    previousMonthKey,
    totals: {
      currentPhotoCount: summaries.reduce(
        (total, item) => total + item.currentPhotoCount,
        0,
      ),
      previousPhotoCount: summaries.reduce(
        (total, item) => total + item.previousPhotoCount,
        0,
      ),
      currentProofCount: summaries.reduce(
        (total, item) => total + item.currentProofCount,
        0,
      ),
      previousProofCount: summaries.reduce(
        (total, item) => total + item.previousProofCount,
        0,
      ),
      spaceCount: workspace.spaces.length,
      activeSpaceCount: summaries.filter(
        (item) =>
          item.currentPhotoCount > 0 ||
          item.previousPhotoCount > 0 ||
          item.overdueReminderCount > 0 ||
          item.metricAlerts.length > 0,
      ).length,
    },
    spaces: summaries
      .sort((left, right) => {
        const activityDelta =
          Math.abs(right.photoDelta) +
          Math.abs(right.proofDelta) -
          (Math.abs(left.photoDelta) + Math.abs(left.proofDelta));
        if (activityDelta !== 0) return activityDelta;
        const alertDelta = right.metricAlerts.length - left.metricAlerts.length;
        if (alertDelta !== 0) return alertDelta;
        return left.name.localeCompare(right.name);
      })
      .slice(0, 6),
    anomalies,
  };
}

export function getWorkspaceTrendSpacePath(spaceId: string) {
  return `/visual-history?spaceId=${spaceId}` as const;
}
