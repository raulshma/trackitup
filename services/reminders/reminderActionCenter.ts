import type {
    Reminder,
    ReminderHistoryAction,
    WorkspaceSnapshot,
} from "../../types/trackitup";
import {
    getReminderScheduleTimestamp,
    isReminderOpen,
} from "../insights/workspaceInsights.ts";

export type ReminderActionCenterActivity = {
  id: string;
  reminderId: string;
  reminderTitle: string;
  action: ReminderHistoryAction;
  at: string;
  note: string;
  spaceId: string;
};

export type ReminderActionCenterSuggestedAction =
  | "complete-now"
  | "log-proof"
  | "snooze"
  | "open-planner";

export type ReminderActionCenterNextStep = {
  reminderId: string;
  reminderTitle: string;
  spaceId: string;
  spaceName: string;
  status: Reminder["status"];
  dueAt: string;
  suggestedAction: ReminderActionCenterSuggestedAction;
  reason: string;
};

export type ReminderActionCenterSpaceGroup = {
  spaceId: string;
  spaceName: string;
  reminderCount: number;
  overdueCount: number;
  dueTodayCount: number;
  nextDueAt?: string;
  reminderTitles: string[];
};

function isSameDay(left: string, right: string) {
  return left.slice(0, 10) === right.slice(0, 10);
}

function buildNextStepReason(
  reminder: Reminder,
  now: string,
  latestHistoryAction?: ReminderHistoryAction,
) {
  const scheduledAt = getReminderScheduleTimestamp(reminder);

  if (latestHistoryAction === "snoozed" || latestHistoryAction === "skipped") {
    return {
      suggestedAction: "open-planner" as const,
      reason:
        "This reminder was recently deferred, so it should be reviewed against the rest of the queue before it slips again.",
    };
  }

  if (scheduledAt <= now) {
    return {
      suggestedAction: "complete-now" as const,
      reason:
        "This reminder is already overdue, so it is the clearest item to finish or resolve first.",
    };
  }

  if (isSameDay(scheduledAt, now)) {
    return {
      suggestedAction: "log-proof" as const,
      reason:
        "This reminder is due today, so recording proof right after doing it will keep the queue moving cleanly.",
    };
  }

  if (reminder.snoozedUntil && reminder.snoozedUntil > now) {
    return {
      suggestedAction: "snooze" as const,
      reason:
        "This reminder is already in a deferred state, so it is worth confirming the snooze still matches the plan.",
    };
  }

  return {
    suggestedAction: "open-planner" as const,
    reason:
      "This reminder is approaching soon and belongs in the planner view so it can be sequenced with the rest of the near-term work.",
  };
}

export function buildReminderActionCenter(workspace: WorkspaceSnapshot) {
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

  const overdue = openReminders.filter(
    (reminder) => getReminderScheduleTimestamp(reminder) <= now,
  );
  const dueToday = openReminders.filter((reminder) => {
    const scheduledAt = getReminderScheduleTimestamp(reminder);
    return scheduledAt > now && isSameDay(scheduledAt, now);
  });
  const upcoming = openReminders.filter((reminder) => {
    const scheduledAt = getReminderScheduleTimestamp(reminder);
    return scheduledAt > now && !isSameDay(scheduledAt, now);
  });

  const recentActivity = workspace.reminders
    .flatMap<ReminderActionCenterActivity>((reminder) =>
      (reminder.history ?? []).map((item) => ({
        id: item.id,
        reminderId: reminder.id,
        reminderTitle: reminder.title,
        action: item.action,
        at: item.at,
        note: item.note,
        spaceId: reminder.spaceId,
      })),
    )
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 8);

  const nextBestSteps = openReminders
    .slice(0, 5)
    .map<ReminderActionCenterNextStep>((reminder) => {
      const latestHistoryAction = reminder.history?.sort((left, right) =>
        right.at.localeCompare(left.at),
      )[0]?.action;
      const nextStep = buildNextStepReason(reminder, now, latestHistoryAction);

      return {
        reminderId: reminder.id,
        reminderTitle: reminder.title,
        spaceId: reminder.spaceId,
        spaceName: spacesById.get(reminder.spaceId)?.name ?? "Unknown space",
        status: reminder.status,
        dueAt: getReminderScheduleTimestamp(reminder),
        suggestedAction: nextStep.suggestedAction,
        reason: nextStep.reason,
      };
    });

  const groupedBySpace = Array.from(
    openReminders.reduce<Map<string, Reminder[]>>((current, reminder) => {
      current.set(reminder.spaceId, [
        ...(current.get(reminder.spaceId) ?? []),
        reminder,
      ]);
      return current;
    }, new Map()),
  )
    .map<ReminderActionCenterSpaceGroup>(([spaceId, reminders]) => {
      const sortedReminders = [...reminders].sort((left, right) =>
        getReminderScheduleTimestamp(left).localeCompare(
          getReminderScheduleTimestamp(right),
        ),
      );

      return {
        spaceId,
        spaceName: spacesById.get(spaceId)?.name ?? "Unknown space",
        reminderCount: reminders.length,
        overdueCount: reminders.filter(
          (reminder) => getReminderScheduleTimestamp(reminder) <= now,
        ).length,
        dueTodayCount: reminders.filter((reminder) => {
          const scheduledAt = getReminderScheduleTimestamp(reminder);
          return scheduledAt > now && isSameDay(scheduledAt, now);
        }).length,
        nextDueAt: sortedReminders[0]
          ? getReminderScheduleTimestamp(sortedReminders[0])
          : undefined,
        reminderTitles: sortedReminders
          .slice(0, 4)
          .map((reminder) => reminder.title),
      };
    })
    .sort((left, right) => {
      if (right.overdueCount !== left.overdueCount) {
        return right.overdueCount - left.overdueCount;
      }

      if (right.dueTodayCount !== left.dueTodayCount) {
        return right.dueTodayCount - left.dueTodayCount;
      }

      if (right.reminderCount !== left.reminderCount) {
        return right.reminderCount - left.reminderCount;
      }

      return (left.nextDueAt ?? "").localeCompare(right.nextDueAt ?? "");
    })
    .slice(0, 4);

  return {
    overdue,
    dueToday,
    upcoming,
    recentActivity,
    nextBestSteps,
    groupedBySpace,
    summary: {
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      upcomingCount: upcoming.length,
      recentActivityCount: recentActivity.length,
      nextBestStepCount: nextBestSteps.length,
      groupedSpaceCount: groupedBySpace.length,
    },
  };
}
