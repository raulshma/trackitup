import type {
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

function isSameDay(left: string, right: string) {
  return left.slice(0, 10) === right.slice(0, 10);
}

export function buildReminderActionCenter(workspace: WorkspaceSnapshot) {
  const now = workspace.generatedAt;
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

  return {
    overdue,
    dueToday,
    upcoming,
    recentActivity,
    summary: {
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      upcomingCount: upcoming.length,
      recentActivityCount: recentActivity.length,
    },
  };
}
