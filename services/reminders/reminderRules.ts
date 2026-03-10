import type {
    LogEntry,
    Reminder,
    ReminderHistoryEntry,
    ReminderTriggerRule,
} from "@/types/trackitup";

function parseTime(time?: string) {
  const [hours, minutes] = (time ?? "09:00").split(":");
  return {
    hours: Number.parseInt(hours ?? "9", 10) || 9,
    minutes: Number.parseInt(minutes ?? "0", 10) || 0,
  };
}

function applyTime(target: Date, time?: string, fallback?: string) {
  const source = time ?? fallback?.slice(11, 16);
  const { hours, minutes } = parseTime(source);
  target.setHours(hours, minutes, 0, 0);
  return target;
}

function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  weekOfMonth: number,
) {
  if (weekOfMonth === -1) {
    const lastDay = new Date(year, month + 1, 0);
    const offset = (lastDay.getDay() - weekday + 7) % 7;
    return new Date(year, month, lastDay.getDate() - offset);
  }

  const firstDay = new Date(year, month, 1);
  const offset = (weekday - firstDay.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (weekOfMonth - 1) * 7);
}

function getFallbackNextReminderDate(
  reminder: Reminder,
  referenceTimestamp: string,
) {
  const nextDate = new Date(referenceTimestamp);
  const recurrenceLabel =
    `${reminder.recurrence ?? ""} ${reminder.ruleLabel ?? ""}`.toLowerCase();

  if (recurrenceLabel.includes("quarter")) {
    nextDate.setMonth(nextDate.getMonth() + 3);
  } else if (
    recurrenceLabel.includes("month") ||
    recurrenceLabel.includes("2nd")
  ) {
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else if (recurrenceLabel.includes("week")) {
    nextDate.setDate(nextDate.getDate() + 7);
  } else {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  return nextDate.toISOString();
}

export function getReminderReferenceTimestamp(reminder: Reminder) {
  return reminder.snoozedUntil ?? reminder.dueAt;
}

export function getNextReminderDate(
  reminder: Reminder,
  referenceTimestamp = getReminderReferenceTimestamp(reminder),
) {
  if (!reminder.recurrence && !reminder.scheduleRule) return undefined;

  if (!reminder.scheduleRule) {
    return getFallbackNextReminderDate(reminder, referenceTimestamp);
  }

  const base = new Date(referenceTimestamp);
  const {
    frequency,
    interval = 1,
    weekday,
    weekOfMonth,
    dayOfMonth,
    time,
  } = reminder.scheduleRule;

  if (frequency === "daily") {
    return applyTime(
      new Date(base.setDate(base.getDate() + interval)),
      time,
    ).toISOString();
  }

  if (frequency === "weekly") {
    if (weekday !== undefined) {
      const nextDate = new Date(referenceTimestamp);
      nextDate.setDate(nextDate.getDate() + Math.max(interval - 1, 0) * 7 + 1);
      const diff = (weekday - nextDate.getDay() + 7) % 7;
      nextDate.setDate(nextDate.getDate() + diff);
      return applyTime(nextDate, time, referenceTimestamp).toISOString();
    }

    const nextDate = new Date(referenceTimestamp);
    nextDate.setDate(nextDate.getDate() + 7 * interval);
    return applyTime(nextDate, time, referenceTimestamp).toISOString();
  }

  const nextDate = new Date(referenceTimestamp);
  const monthStep = frequency === "quarterly" ? 3 * interval : interval;
  nextDate.setMonth(nextDate.getMonth() + monthStep, 1);

  if (weekday !== undefined && weekOfMonth !== undefined) {
    const scheduledDate = getNthWeekdayOfMonth(
      nextDate.getFullYear(),
      nextDate.getMonth(),
      weekday,
      weekOfMonth,
    );
    return applyTime(scheduledDate, time, referenceTimestamp).toISOString();
  }

  nextDate.setDate(dayOfMonth ?? new Date(referenceTimestamp).getDate());
  return applyTime(nextDate, time, referenceTimestamp).toISOString();
}

function matchesTriggerRule(rule: ReminderTriggerRule, log: LogEntry) {
  if (rule.logKind && rule.logKind !== log.kind) return false;
  if (
    rule.titleIncludes &&
    !log.title.toLowerCase().includes(rule.titleIncludes.toLowerCase())
  ) {
    return false;
  }
  if (
    rule.tagIncludes &&
    !(log.tags ?? []).some(
      (tag) => tag.toLowerCase() === rule.tagIncludes?.toLowerCase(),
    )
  ) {
    return false;
  }
  return true;
}

export function applyReminderTriggerRules(
  reminders: Reminder[],
  logs: LogEntry[],
  scheduledAt: string,
): Reminder[] {
  const now = new Date(scheduledAt).getTime();

  return reminders.map((reminder) => {
    if (!reminder.triggerRules?.length) return reminder;

    const match = logs.find((log) =>
      reminder.triggerRules?.some((rule) => matchesTriggerRule(rule, log)),
    );
    if (!match) return reminder;

    const matchedRule = reminder.triggerRules.find((rule) =>
      matchesTriggerRule(rule, match),
    );
    const dueAt = new Date(match.occurredAt);
    dueAt.setHours(dueAt.getHours() + (matchedRule?.delayHours ?? 0));

    const note = `Condition met from '${match.title}' and scheduled automatically.`;
    const status: Reminder["status"] =
      dueAt.getTime() <= now ? "due" : "scheduled";
    const historyEntry: ReminderHistoryEntry = {
      id: `${reminder.id}-history-${Date.now()}`,
      action: "scheduled",
      at: scheduledAt,
      note,
    };

    return {
      ...reminder,
      dueAt: dueAt.toISOString(),
      snoozedUntil: undefined,
      skipReason: undefined,
      status,
      history: [historyEntry, ...(reminder.history ?? [])].slice(0, 12),
    };
  });
}
