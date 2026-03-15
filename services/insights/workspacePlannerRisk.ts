import type {
    ReminderHistoryAction,
    WorkspaceSnapshot,
} from "../../types/trackitup.ts";

import {
    getReminderDateKey,
    getReminderScheduleTimestamp,
    isReminderOpen,
} from "./workspaceInsights.ts";

export type WorkspacePlannerRiskRoute = "planner" | "action-center" | "logbook";

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

export type WorkspacePlannerRiskReminder = {
  id: string;
  title: string;
  spaceId: string;
  spaceName: string;
  status: string;
  dueAt: string;
  isSelectedDay: boolean;
  snoozeCount: number;
  skipCount: number;
  latestHistoryAction?: ReminderHistoryAction;
  riskReasons: string[];
  route: WorkspacePlannerRiskRoute;
};

export type WorkspacePlannerRiskSpaceHotspot = {
  id: string;
  name: string;
  overdueCount: number;
  dueTodayCount: number;
  deferredCount: number;
  nextDueAt?: string;
  reminderTitles: string[];
  route: WorkspacePlannerRiskRoute;
};

export type WorkspacePlannerRiskDeferral = {
  id: string;
  reminderId: string;
  reminderTitle: string;
  spaceId: string;
  spaceName: string;
  action: "snoozed" | "skipped";
  at: string;
  note: string;
  route: WorkspacePlannerRiskRoute;
};

export type WorkspacePlannerRiskSummary = {
  activeDateKey: string;
  summary: {
    openReminderCount: number;
    selectedDayCount: number;
    overdueCount: number;
    deferralCount: number;
    hotspotCount: number;
  };
  highestRiskReminders: WorkspacePlannerRiskReminder[];
  spaceHotspots: WorkspacePlannerRiskSpaceHotspot[];
  recentDeferrals: WorkspacePlannerRiskDeferral[];
};

function getLatestHistoryAction(
  history: Array<{ action: ReminderHistoryAction; at: string }> | undefined,
) {
  return [...(history ?? [])].sort((left, right) =>
    right.at.localeCompare(left.at),
  )[0]?.action;
}

export function buildWorkspacePlannerRiskSummary(
  workspace: WorkspaceSnapshot,
  activeDateKey: string,
): WorkspacePlannerRiskSummary {
  const now = workspace.generatedAt;
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const openReminders = [...workspace.reminders]
    .filter(isReminderOpen)
    .sort((left, right) =>
      getReminderScheduleTimestamp(left).localeCompare(
        getReminderScheduleTimestamp(right),
      ),
    );

  const highestRiskReminders = openReminders
    .map((reminder) => {
      const history = reminder.history ?? [];
      const snoozeCount = history.filter(
        (item) => item.action === "snoozed",
      ).length;
      const skipCount = history.filter(
        (item) => item.action === "skipped",
      ).length;
      const latestHistoryAction = getLatestHistoryAction(history);
      const dueAt = getReminderScheduleTimestamp(reminder);
      const isSelectedDay = getReminderDateKey(reminder) === activeDateKey;
      const riskReasons: string[] = [];
      let riskScore = 0;

      if (dueAt <= now) {
        riskReasons.push("Already overdue in the live planner queue.");
        riskScore += 3;
      }
      if (isSelectedDay) {
        riskReasons.push("Falls on the currently selected planner day.");
        riskScore += 2;
      }
      if (
        latestHistoryAction === "snoozed" ||
        latestHistoryAction === "skipped"
      ) {
        riskReasons.push("It was recently deferred instead of being cleared.");
        riskScore += 2;
      }
      if (snoozeCount + skipCount >= 2) {
        riskReasons.push("Its history shows repeated snoozes or skips.");
        riskScore += 2;
      }
      if (reminder.status === "snoozed") {
        riskReasons.push("It is currently in a snoozed state.");
        riskScore += 1;
      }

      return {
        id: reminder.id,
        title: reminder.title,
        spaceId: primarySpaceId(reminder) ?? "",
        spaceName:
          spacesById.get(primarySpaceId(reminder) ?? "")?.name ??
          "Unknown space",
        status: reminder.status,
        dueAt,
        isSelectedDay,
        snoozeCount,
        skipCount,
        latestHistoryAction,
        riskReasons,
        riskScore,
        route:
          dueAt <= now ||
          latestHistoryAction === "snoozed" ||
          latestHistoryAction === "skipped"
            ? ("action-center" as const)
            : isSelectedDay
              ? ("logbook" as const)
              : ("planner" as const),
      };
    })
    .filter((item) => item.riskReasons.length > 0)
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore)
        return right.riskScore - left.riskScore;
      return left.dueAt.localeCompare(right.dueAt);
    })
    .slice(0, 5)
    .map(({ riskScore: _riskScore, ...item }) => item);

  const recentDeferrals = openReminders
    .flatMap<WorkspacePlannerRiskDeferral>((reminder) =>
      (reminder.history ?? [])
        .filter(
          (item): item is typeof item & { action: "snoozed" | "skipped" } =>
            item.action === "snoozed" || item.action === "skipped",
        )
        .map((item) => ({
          id: item.id,
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          spaceId: primarySpaceId(reminder) ?? "",
          spaceName:
            spacesById.get(primarySpaceId(reminder) ?? "")?.name ??
            "Unknown space",
          action: item.action,
          at: item.at,
          note: item.note,
          route: "action-center" as const,
        })),
    )
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 5);

  const spaceHotspots = Array.from(
    openReminders.reduce<Map<string, typeof openReminders>>(
      (current, reminder) => {
        const reminderSpaceId = primarySpaceId(reminder) ?? "";
        current.set(reminderSpaceId, [
          ...(current.get(reminderSpaceId) ?? []),
          reminder,
        ]);
        return current;
      },
      new Map(),
    ),
  )
    .map<WorkspacePlannerRiskSpaceHotspot>(([spaceId, reminders]) => {
      const overdueCount = reminders.filter(
        (reminder) => getReminderScheduleTimestamp(reminder) <= now,
      ).length;
      const dueTodayCount = reminders.filter((reminder) => {
        const dueAt = getReminderScheduleTimestamp(reminder);
        return dueAt > now && getReminderDateKey(reminder) === now.slice(0, 10);
      }).length;
      const deferredCount = reminders.reduce((count, reminder) => {
        return (
          count +
          (reminder.history ?? []).filter(
            (item) => item.action === "snoozed" || item.action === "skipped",
          ).length
        );
      }, 0);
      const sortedReminders = [...reminders].sort((left, right) =>
        getReminderScheduleTimestamp(left).localeCompare(
          getReminderScheduleTimestamp(right),
        ),
      );
      return {
        id: spaceId,
        name: spacesById.get(spaceId)?.name ?? "Unknown space",
        overdueCount,
        dueTodayCount,
        deferredCount,
        nextDueAt: sortedReminders[0]
          ? getReminderScheduleTimestamp(sortedReminders[0])
          : undefined,
        reminderTitles: sortedReminders
          .slice(0, 4)
          .map((reminder) => reminder.title),
        route:
          overdueCount > 0 || deferredCount > 0
            ? ("action-center" as const)
            : ("planner" as const),
      };
    })
    .sort((left, right) => {
      if (right.overdueCount !== left.overdueCount) {
        return right.overdueCount - left.overdueCount;
      }
      if (right.deferredCount !== left.deferredCount) {
        return right.deferredCount - left.deferredCount;
      }
      if (right.dueTodayCount !== left.dueTodayCount) {
        return right.dueTodayCount - left.dueTodayCount;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 4);

  return {
    activeDateKey,
    summary: {
      openReminderCount: openReminders.length,
      selectedDayCount: openReminders.filter(
        (reminder) => getReminderDateKey(reminder) === activeDateKey,
      ).length,
      overdueCount: openReminders.filter(
        (reminder) => getReminderScheduleTimestamp(reminder) <= now,
      ).length,
      deferralCount: recentDeferrals.length,
      hotspotCount: spaceHotspots.length,
    },
    highestRiskReminders,
    spaceHotspots,
    recentDeferrals,
  };
}
