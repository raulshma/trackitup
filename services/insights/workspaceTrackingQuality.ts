import type { LogEntry, WorkspaceSnapshot } from "../../types/trackitup.ts";

import {
    getReminderScheduleTimestamp,
    isReminderOpen,
} from "./workspaceInsights.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_LOG_DAYS = 14;
const METRIC_GAP_DAYS = 30;

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

function hasSpaceIntersection(
  left: { spaceId?: string; spaceIds?: string[] },
  right: { spaceId?: string; spaceIds?: string[] },
) {
  const leftSpaces = normalizeSpaceIds(left);
  const rightSpaces = normalizeSpaceIds(right);
  if (leftSpaces.length === 0 || rightSpaces.length === 0) return false;
  const rightSet = new Set(rightSpaces);
  return leftSpaces.some((spaceId) => rightSet.has(spaceId));
}

export type WorkspaceTrackingQualityRoute =
  | "action-center"
  | "planner"
  | "logbook"
  | "workspace-tools";

export type WorkspaceTrackingQualityReminderGap = {
  id: string;
  title: string;
  spaceId: string;
  spaceName: string;
  dueAt: string;
  status: string;
  recentLinkedLogCount: number;
  deferredCount: number;
  reasons: string[];
  route: WorkspaceTrackingQualityRoute;
};

export type WorkspaceTrackingQualityMetricGap = {
  id: string;
  name: string;
  spaceId: string;
  spaceName: string;
  lastRecordedAt?: string;
  openReminderCount: number;
  reasons: string[];
  route: WorkspaceTrackingQualityRoute;
};

export type WorkspaceTrackingQualitySparseLog = {
  id: string;
  title: string;
  spaceId: string;
  spaceName: string;
  occurredAt: string;
  kind: string;
  signals: string[];
  route: WorkspaceTrackingQualityRoute;
};

export type WorkspaceTrackingQualitySpaceGap = {
  id: string;
  name: string;
  overdueCount: number;
  openReminderCount: number;
  recentLogCount: number;
  recentProofCount: number;
  recentMetricCount: number;
  latestLogAt?: string;
  reasons: string[];
  route: WorkspaceTrackingQualityRoute;
};

export type WorkspaceTrackingQualitySummary = {
  summary: {
    recentLogCount: number;
    reminderGapCount: number;
    metricGapCount: number;
    sparseLogCount: number;
    spaceGapCount: number;
  };
  reminderGaps: WorkspaceTrackingQualityReminderGap[];
  metricGaps: WorkspaceTrackingQualityMetricGap[];
  sparseLogs: WorkspaceTrackingQualitySparseLog[];
  spaceGaps: WorkspaceTrackingQualitySpaceGap[];
};

function addDays(timestamp: string, days: number) {
  return new Date(new Date(timestamp).getTime() + days * DAY_MS).toISOString();
}

function hasProof(log: LogEntry) {
  return (log.attachmentsCount ?? 0) > 0 || (log.attachments?.length ?? 0) > 0;
}

function hasNumericMetric(log: LogEntry) {
  return (log.metricReadings ?? []).some(
    (reading) => typeof reading.value === "number",
  );
}

function hasMeaningfulNote(log: LogEntry) {
  return log.note.trim().length >= 18;
}

function getSparseLogSignals(log: LogEntry) {
  if (log.kind === "metric-reading") {
    const signals: string[] = [];
    if (!hasNumericMetric(log))
      signals.push("No numeric metric reading was captured.");
    if (!hasMeaningfulNote(log))
      signals.push("The note is too short to explain the reading.");
    return signals;
  }

  const missingNote = !hasMeaningfulNote(log);
  const missingProof = !hasProof(log);
  if (!missingNote || !missingProof) return [];
  return [
    "The note is too short to explain what happened.",
    "No proof attachment was saved with the log.",
  ];
}

export function buildWorkspaceTrackingQualitySummary(
  workspace: WorkspaceSnapshot,
): WorkspaceTrackingQualitySummary {
  const now = workspace.generatedAt;
  const recentLogThreshold = addDays(now, -RECENT_LOG_DAYS);
  const metricGapThreshold = addDays(now, -METRIC_GAP_DAYS);
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const openReminders = workspace.reminders.filter(isReminderOpen);
  const recentLogs = workspace.logs.filter(
    (log) => log.occurredAt >= recentLogThreshold,
  );

  const reminderGaps = openReminders
    .map<WorkspaceTrackingQualityReminderGap>((reminder) => {
      const dueAt = getReminderScheduleTimestamp(reminder);
      const recentLinkedLogCount = recentLogs.filter(
        (log) => log.reminderId === reminder.id,
      ).length;
      const deferredCount = (reminder.history ?? []).filter(
        (item) => item.action === "snoozed" || item.action === "skipped",
      ).length;
      const reasons: string[] = [];
      if (dueAt <= now) reasons.push("This reminder is already overdue.");
      if (recentLinkedLogCount === 0) {
        reasons.push(
          "No linked proof log was recorded for it in the last 14 days.",
        );
      }
      if (deferredCount > 0) {
        reasons.push(
          "Its history shows recent snoozes or skips instead of recorded completion.",
        );
      }

      return {
        id: reminder.id,
        title: reminder.title,
        spaceId: primarySpaceId(reminder) ?? "",
        spaceName:
          spacesById.get(primarySpaceId(reminder) ?? "")?.name ??
          "Unknown space",
        dueAt,
        status: reminder.status,
        recentLinkedLogCount,
        deferredCount,
        reasons,
        route: recentLinkedLogCount === 0 ? "logbook" : "planner",
      };
    })
    .filter((item) => item.reasons.length > 0)
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));

  const sparseLogs = [...recentLogs]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .map<WorkspaceTrackingQualitySparseLog | null>((log) => {
      const signals = getSparseLogSignals(log);
      if (signals.length === 0) return null;
      return {
        id: log.id,
        title: log.title,
        spaceId: primarySpaceId(log) ?? "",
        spaceName:
          spacesById.get(primarySpaceId(log) ?? "")?.name ?? "Unknown space",
        occurredAt: log.occurredAt,
        kind: log.kind,
        signals,
        route: "logbook",
      };
    })
    .filter((item): item is WorkspaceTrackingQualitySparseLog => Boolean(item));

  const metricGaps = workspace.metricDefinitions
    .map<WorkspaceTrackingQualityMetricGap>((metric) => {
      const latestMetricLog = [...workspace.logs]
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .find((log) =>
          (log.metricReadings ?? []).some(
            (reading) =>
              reading.metricId === metric.id &&
              typeof reading.value === "number",
          ),
        );
      const openReminderCount = openReminders.filter((reminder) =>
        hasSpaceIntersection(reminder, metric),
      ).length;
      const reasons: string[] = [];
      if (!latestMetricLog) {
        reasons.push(
          "This tracked metric has no recorded numeric reading yet.",
        );
      } else if (latestMetricLog.occurredAt < metricGapThreshold) {
        reasons.push(
          `Its last recorded reading is older than ${METRIC_GAP_DAYS} days.`,
        );
      }
      if (openReminderCount > 0) {
        reasons.push(
          "The same space still has open reminder work in the queue.",
        );
      }

      return {
        id: metric.id,
        name: metric.name,
        spaceId: primarySpaceId(metric) ?? "",
        spaceName:
          spacesById.get(primarySpaceId(metric) ?? "")?.name ?? "Unknown space",
        lastRecordedAt: latestMetricLog?.occurredAt,
        openReminderCount,
        reasons,
        route: "logbook",
      };
    })
    .filter((item) => item.reasons.length > 0)
    .sort((left, right) => {
      if (!left.lastRecordedAt && right.lastRecordedAt) return -1;
      if (left.lastRecordedAt && !right.lastRecordedAt) return 1;
      return (left.lastRecordedAt ?? "").localeCompare(
        right.lastRecordedAt ?? "",
      );
    });

  const spaceGaps = workspace.spaces
    .map<WorkspaceTrackingQualitySpaceGap>((space) => {
      const spaceLogs = workspace.logs.filter((log) =>
        belongsToSpace(log, space.id),
      );
      const recentSpaceLogs = recentLogs.filter((log) =>
        belongsToSpace(log, space.id),
      );
      const openSpaceReminders = openReminders.filter((reminder) =>
        belongsToSpace(reminder, space.id),
      );
      const overdueCount = openSpaceReminders.filter(
        (reminder) => getReminderScheduleTimestamp(reminder) <= now,
      ).length;
      const recentProofCount = recentSpaceLogs.filter(hasProof).length;
      const recentMetricCount = recentSpaceLogs.filter(hasNumericMetric).length;
      const metricCount = workspace.metricDefinitions.filter((metric) =>
        belongsToSpace(metric, space.id),
      ).length;
      const latestLogAt = [...spaceLogs].sort((left, right) =>
        right.occurredAt.localeCompare(left.occurredAt),
      )[0]?.occurredAt;
      const reasons: string[] = [];
      if (overdueCount > 0)
        reasons.push(`${overdueCount} reminder(s) are already overdue here.`);
      if (recentSpaceLogs.length === 0)
        reasons.push("No logs were recorded here in the last 14 days.");
      if (openSpaceReminders.length > 0 && recentProofCount === 0) {
        reasons.push(
          "Open reminder work has no recent proof attachment in this space.",
        );
      }
      if (metricCount > 0 && recentMetricCount === 0) {
        reasons.push("Tracked metrics here have no recent readings.");
      }

      return {
        id: space.id,
        name: space.name,
        overdueCount,
        openReminderCount: openSpaceReminders.length,
        recentLogCount: recentSpaceLogs.length,
        recentProofCount,
        recentMetricCount,
        latestLogAt,
        reasons,
        route:
          overdueCount > 0
            ? "planner"
            : metricCount > 0 && recentMetricCount === 0
              ? "logbook"
              : recentSpaceLogs.length === 0
                ? "workspace-tools"
                : "logbook",
      };
    })
    .filter((item) => item.reasons.length > 0)
    .sort((left, right) => {
      if (right.overdueCount !== left.overdueCount)
        return right.overdueCount - left.overdueCount;
      if (left.recentLogCount !== right.recentLogCount)
        return left.recentLogCount - right.recentLogCount;
      return left.name.localeCompare(right.name);
    });

  return {
    summary: {
      recentLogCount: recentLogs.length,
      reminderGapCount: reminderGaps.length,
      metricGapCount: metricGaps.length,
      sparseLogCount: sparseLogs.length,
      spaceGapCount: spaceGaps.length,
    },
    reminderGaps: reminderGaps.slice(0, 4),
    metricGaps: metricGaps.slice(0, 4),
    sparseLogs: sparseLogs.slice(0, 4),
    spaceGaps: spaceGaps.slice(0, 4),
  };
}
