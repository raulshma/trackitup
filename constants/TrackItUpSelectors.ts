import type {
    OverviewStat,
    QuickActionCard,
    SpaceSummary,
    TimelineEntry,
} from "@/constants/TrackItUpData";
import type {
    LogEntry,
    LogKind,
    QuickActionKind,
    Reminder,
    Space,
    SpaceStatus,
    WorkspaceSnapshot,
} from "@/types/trackitup";
import { formatSpaceCategoryLabel } from "./TrackItUpSpaceCategories.ts";

const statusLabels: Record<SpaceStatus, string> = {
  stable: "Stable",
  watch: "Watch",
  planned: "Planned",
  archived: "Archived",
};

const logTypeLabels: Record<LogKind, string> = {
  "metric-reading": "Metric",
  "routine-run": "Routine",
  "asset-update": "Asset",
  reminder: "Reminder",
};

const quickActionDetails: Record<
  QuickActionKind,
  { description: string; target: string; accent: string }
> = {
  "quick-log": {
    description:
      "Capture a note, event, or checklist result from the unified logbook.",
    target: "Across all spaces",
    accent: "#0f766e",
  },
  "metric-entry": {
    description:
      "Record a fresh reading against tracked metrics and safe zones.",
    target: "Metrics ready to log",
    accent: "#0ea5e9",
  },
  "routine-run": {
    description:
      "Run a saved workflow with linked steps, assets, and reminders.",
    target: "Routine-guided entry",
    accent: "#8b5cf6",
  },
};

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

function primarySpaceId(value: { spaceId?: string; spaceIds?: string[] }) {
  return normalizeSpaceIds(value)[0] ?? value.spaceId;
}

function sortByNewest<T extends { occurredAt: string }>(items: T[]) {
  return [...items].sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt),
  );
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isYesterday(date: Date, now: Date) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return isSameDay(date, yesterday);
}

function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatMonthDay(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "2-digit" });
}

function formatRelativeLogTime(timestamp: string, nowTimestamp: string) {
  const now = new Date(nowTimestamp);
  const date = new Date(timestamp);
  const differenceMs = now.getTime() - date.getTime();
  const minutes = Math.max(1, Math.round(differenceMs / (1000 * 60)));

  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (isSameDay(date, now)) return `${hours} hr ago`;
  if (isYesterday(date, now)) return "yesterday";

  return formatMonthDay(date);
}

function formatTimelineTimestamp(timestamp: string, nowTimestamp: string) {
  const now = new Date(nowTimestamp);
  const date = new Date(timestamp);

  if (isSameDay(date, now)) return `Today • ${formatClock(date)}`;
  if (isYesterday(date, now)) return `Yesterday • ${formatClock(date)}`;

  return `${formatMonthDay(date)} • ${formatClock(date)}`;
}

function isReminderOpen(reminder: Reminder) {
  return (
    reminder.status === "due" ||
    reminder.status === "scheduled" ||
    reminder.status === "snoozed"
  );
}

function countDueToday(reminders: Reminder[], nowTimestamp: string) {
  const today = new Date(nowTimestamp);
  return reminders.filter(
    (reminder) =>
      isReminderOpen(reminder) && isSameDay(new Date(reminder.dueAt), today),
  ).length;
}

function countRecurringDueToday(
  workspace: WorkspaceSnapshot,
  nowTimestamp: string,
) {
  const today = new Date(nowTimestamp);
  const activePlanIds = new Set(
    workspace.recurringPlans
      .filter((plan) => plan.status === "active")
      .map((plan) => plan.id),
  );

  return workspace.recurringOccurrences.filter((occurrence) => {
    if (occurrence.status !== "scheduled") return false;
    if (!activePlanIds.has(occurrence.planId)) return false;
    const dueAt = occurrence.snoozedUntil ?? occurrence.dueAt;
    return isSameDay(new Date(dueAt), today);
  }).length;
}

function countLogsThisWeek(logs: LogEntry[], nowTimestamp: string) {
  const now = new Date(nowTimestamp).getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return logs.filter(
    (log) =>
      !log.archivedAt && now - new Date(log.occurredAt).getTime() <= weekMs,
  ).length;
}

export function getOverviewStats(workspace: WorkspaceSnapshot): OverviewStat[] {
  const activeSpaces = workspace.spaces.filter(
    (space) => space.status !== "archived",
  );

  return [
    { label: "Active spaces", value: String(activeSpaces.length) },
    {
      label: "Due today",
      value: String(
        countDueToday(workspace.reminders, workspace.generatedAt) +
          countRecurringDueToday(workspace, workspace.generatedAt),
      ),
    },
    {
      label: "Logs this week",
      value: String(countLogsThisWeek(workspace.logs, workspace.generatedAt)),
    },
  ];
}

export function getQuickActionCards(
  workspace: WorkspaceSnapshot,
): QuickActionCard[] {
  const spacesById = new Map(
    workspace.spaces
      .filter((space) => space.status !== "archived")
      .map((space) => [space.id, space] as const),
  );

  return workspace.quickActions.map((action) => {
    const linkedSpace = action.spaceId
      ? spacesById.get(action.spaceId)
      : undefined;
    const detail = quickActionDetails[action.kind];

    return {
      id: action.id,
      label: action.label,
      description: detail.description,
      target: linkedSpace ? linkedSpace.name : detail.target,
      accent: linkedSpace?.themeColor ?? detail.accent,
    };
  });
}

export function getSpaceSummaries(
  workspace: WorkspaceSnapshot,
): SpaceSummary[] {
  const activeSpaces = workspace.spaces.filter(
    (space) => space.status !== "archived",
  );
  const latestLogsBySpace = new Map(
    activeSpaces.map((space) => {
      const latestLog = sortByNewest(
        workspace.logs.filter(
          (log) => !log.archivedAt && belongsToSpace(log, space.id),
        ),
      )[0];
      return [space.id, latestLog] as const;
    }),
  );

  return activeSpaces.map((space) => {
    const pendingTasks = workspace.reminders.filter(
      (reminder) =>
        belongsToSpace(reminder, space.id) && isReminderOpen(reminder),
    ).length;
    const pendingRecurring = workspace.recurringOccurrences.filter(
      (occurrence) =>
        belongsToSpace(occurrence, space.id) &&
        occurrence.status === "scheduled" &&
        workspace.recurringPlans.some(
          (plan) => plan.id === occurrence.planId && plan.status === "active",
        ),
    ).length;
    const latestLog = latestLogsBySpace.get(space.id);

    return {
      id: space.id,
      name: space.name,
      category: formatSpaceCategoryLabel(space.category),
      status: statusLabels[space.status],
      pendingTasks: pendingTasks + pendingRecurring,
      lastLog: latestLog
        ? `${latestLog.title} • ${formatRelativeLogTime(latestLog.occurredAt, workspace.generatedAt)}`
        : "No logs yet",
      note: space.summary,
      accent: space.themeColor,
    };
  });
}

export function getTimelineEntries(
  workspace: WorkspaceSnapshot,
): TimelineEntry[] {
  return buildTimelineEntriesFromLogs(
    workspace.logs,
    workspace.spaces,
    workspace.generatedAt,
  );
}

export function buildTimelineEntriesFromLogs(
  logs: LogEntry[],
  spaces: Space[],
  generatedAt: string,
): TimelineEntry[] {
  const spacesById = new Map(spaces.map((space) => [space.id, space] as const));

  return sortByNewest(logs.filter((log) => !log.archivedAt)).map((log) => {
    const resolvedSpaceId = primarySpaceId(log);
    const space = resolvedSpaceId ? spacesById.get(resolvedSpaceId) : undefined;

    return {
      id: log.id,
      type: logTypeLabels[log.kind],
      title: log.title,
      detail: log.note,
      occurredAt: log.occurredAt,
      kind: log.kind,
      spaceId: resolvedSpaceId ?? "",
      spaceName: space?.name ?? "Unknown space",
      accent: space?.themeColor ?? "#0f766e",
      timestamp: formatTimelineTimestamp(log.occurredAt, generatedAt),
    };
  });
}
