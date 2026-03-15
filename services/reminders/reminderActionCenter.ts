import type {
    RecurringOccurrence,
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
  spaceIds?: string[];
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
  spaceIds?: string[];
  spaceName: string;
  status: Reminder["status"];
  dueAt: string;
  descriptionSnippet: string;
  isRecurringLike: boolean;
  scheduleHint?: string;
  latestHistoryAction?: ReminderHistoryAction;
  latestHistoryAt?: string;
  recentDeferralCount: number;
  recentCompletionCount: number;
  proofAffinityHint?: string;
  priorityScore: number;
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

export type RecurringActionCenterOccurrence = {
  occurrenceId: string;
  planId: string;
  title: string;
  description?: string;
  status: RecurringOccurrence["status"];
  dueAt: string;
  effectiveDueAt: string;
  spaceId: string;
  spaceIds?: string[];
  spaceName: string;
  proofRequired: boolean;
};

export type RecurringActionCenterActivity = {
  id: string;
  occurrenceId: string;
  planId: string;
  planTitle: string;
  action: "completed" | "skipped" | "snoozed";
  actionSource: "manual" | "bulk" | "auto-match";
  at: string;
  note?: string;
  logId?: string;
  completionLatencyMinutes?: number;
  spaceId: string;
  spaceName: string;
};

function normalizedSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function pickPrimarySpaceId(value: { spaceId?: string; spaceIds?: string[] }) {
  return normalizedSpaceIds(value)[0] ?? value.spaceId ?? "";
}

export type RecurringActionCenterNextStep = {
  occurrenceId: string;
  planId: string;
  title: string;
  dueAt: string;
  spaceId: string;
  spaceName: string;
  suggestedAction: "complete-now" | "log-proof" | "snooze" | "open-planner";
  reason: string;
};

function isSameDay(left: string, right: string) {
  return left.slice(0, 10) === right.slice(0, 10);
}

const RECENT_HISTORY_WINDOW_DAYS = 14;

function compactText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getLatestReminderHistoryEntry(reminder: Reminder) {
  return [...(reminder.history ?? [])].sort((left, right) =>
    right.at.localeCompare(left.at),
  )[0];
}

function getRecentReminderActionCount(options: {
  reminder: Reminder;
  action: ReminderHistoryAction;
  now: string;
  windowDays?: number;
}) {
  const nowTimestamp = Date.parse(options.now);
  if (!Number.isFinite(nowTimestamp)) return 0;

  const windowDays = options.windowDays ?? RECENT_HISTORY_WINDOW_DAYS;
  const windowStart = nowTimestamp - windowDays * 24 * 60 * 60 * 1000;

  return (options.reminder.history ?? []).filter((entry) => {
    if (entry.action !== options.action) return false;
    const atTimestamp = Date.parse(entry.at);
    if (!Number.isFinite(atTimestamp)) return false;
    return atTimestamp >= windowStart && atTimestamp <= nowTimestamp;
  }).length;
}

function buildReminderScheduleHint(reminder: Reminder) {
  if (reminder.ruleLabel) return compactText(reminder.ruleLabel, 60);

  if (reminder.scheduleRule) {
    const { frequency, interval } = reminder.scheduleRule;
    if (interval && interval > 1) {
      return `Every ${interval} ${frequency.replace("ly", "")}${
        interval === 1 ? "" : "s"
      }`;
    }
    if (frequency === "daily") return "Daily cadence";
    if (frequency === "weekly") return "Weekly cadence";
    if (frequency === "monthly") return "Monthly cadence";
    return "Quarterly cadence";
  }

  if (reminder.recurrence) return compactText(reminder.recurrence, 60);
  return undefined;
}

function isRecurringLikeReminder(reminder: Reminder) {
  return Boolean(reminder.recurrence || reminder.scheduleRule);
}

function buildProofAffinityHint(reminder: Reminder) {
  const triggerLogKind = reminder.triggerRules?.find(
    (rule) => rule.logKind,
  )?.logKind;
  if (triggerLogKind === "reminder" || triggerLogKind === "routine-run") {
    return "Reminder history suggests proof logging is often part of completion.";
  }

  const cueText = `${reminder.title} ${reminder.description}`.toLowerCase();
  if (/(proof|photo|log|evidence|document|record)/.test(cueText)) {
    return "Reminder wording suggests logging evidence when action is completed.";
  }

  return undefined;
}

function buildNextStepPriorityScore(options: {
  reminder: Reminder;
  now: string;
  latestHistoryAction?: ReminderHistoryAction;
  recentDeferralCount: number;
  recentCompletionCount: number;
}) {
  const scheduledAt = getReminderScheduleTimestamp(options.reminder);
  let score = 0;

  if (scheduledAt <= options.now) {
    score += 120;
  } else if (isSameDay(scheduledAt, options.now)) {
    score += 80;
  } else {
    score += 30;
  }

  if (options.latestHistoryAction === "snoozed") score += 25;
  if (options.latestHistoryAction === "skipped") score += 20;
  if (options.latestHistoryAction === "completed") score -= 20;

  score += Math.min(3, options.recentDeferralCount) * 10;
  score += Math.min(3, options.recentCompletionCount) * 4;

  if (
    options.reminder.snoozedUntil &&
    options.reminder.snoozedUntil > options.now
  ) {
    score -= 15;
  }

  if (options.reminder.triggerRules?.length) score += 8;
  if (isRecurringLikeReminder(options.reminder)) score += 5;

  return score;
}

function buildNextStepReason(options: {
  reminder: Reminder;
  now: string;
  latestHistoryAction?: ReminderHistoryAction;
  recentDeferralCount: number;
  recentCompletionCount: number;
  scheduleHint?: string;
  descriptionSnippet: string;
  proofAffinityHint?: string;
}): {
  suggestedAction: ReminderActionCenterSuggestedAction;
  reason: string;
} {
  const scheduledAt = getReminderScheduleTimestamp(options.reminder);

  const cadenceCue = options.scheduleHint
    ? ` (${options.scheduleHint.toLowerCase()})`
    : "";

  if (
    options.recentDeferralCount >= 2 ||
    options.latestHistoryAction === "snoozed" ||
    options.latestHistoryAction === "skipped"
  ) {
    return {
      suggestedAction: "open-planner" as const,
      reason:
        "This reminder has a recent deferral pattern, so reviewing it against the full queue first is the safest way to prevent another slip.",
    };
  }

  if (scheduledAt <= options.now) {
    return {
      suggestedAction: "complete-now" as const,
      reason:
        options.recentDeferralCount > 0
          ? "This reminder is overdue and has already been deferred recently, so resolving it now removes the biggest carry-over risk."
          : `This reminder is overdue${cadenceCue}, so it is the clearest item to finish first.`,
    };
  }

  if (isSameDay(scheduledAt, options.now)) {
    return {
      suggestedAction: options.proofAffinityHint ? "log-proof" : "complete-now",
      reason: options.proofAffinityHint
        ? "This reminder is due today and likely needs evidence capture, so completing it with proof in one pass keeps the queue clean."
        : "This reminder is due today, so finishing it now keeps same-day workload from rolling forward.",
    };
  }

  if (
    options.reminder.snoozedUntil &&
    options.reminder.snoozedUntil > options.now
  ) {
    return {
      suggestedAction: "snooze" as const,
      reason:
        "This reminder is already snoozed, so quickly confirming the defer window still fits today's priorities avoids accidental churn.",
    };
  }

  if (
    options.recentCompletionCount >= 2 &&
    options.descriptionSnippet.length > 0
  ) {
    return {
      suggestedAction: "complete-now" as const,
      reason:
        "This reminder has been completed consistently in recent history, so handling it now is likely a low-friction win.",
    };
  }

  return {
    suggestedAction: "open-planner" as const,
    reason: `This reminder is approaching soon${cadenceCue} and belongs in planner sequencing with the rest of the near-term queue.`,
  };
}

export function buildReminderActionCenter(workspace: WorkspaceSnapshot) {
  const now = workspace.generatedAt;
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const recurringPlansById = new Map(
    workspace.recurringPlans.map((plan) => [plan.id, plan] as const),
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
        spaceId: pickPrimarySpaceId(reminder),
        spaceIds: normalizedSpaceIds(reminder),
      })),
    )
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 8);

  const nextBestSteps = openReminders
    .map<ReminderActionCenterNextStep>((reminder) => {
      const latestHistoryEntry = getLatestReminderHistoryEntry(reminder);
      const latestHistoryAction = latestHistoryEntry?.action;
      const latestHistoryAt = latestHistoryEntry?.at;
      const recentDeferralCount =
        getRecentReminderActionCount({
          reminder,
          action: "snoozed",
          now,
        }) +
        getRecentReminderActionCount({
          reminder,
          action: "skipped",
          now,
        });
      const recentCompletionCount = getRecentReminderActionCount({
        reminder,
        action: "completed",
        now,
      });
      const scheduleHint = buildReminderScheduleHint(reminder);
      const descriptionSnippet = compactText(reminder.description, 120);
      const proofAffinityHint = buildProofAffinityHint(reminder);
      const priorityScore = buildNextStepPriorityScore({
        reminder,
        now,
        latestHistoryAction,
        recentDeferralCount,
        recentCompletionCount,
      });
      const nextStep = buildNextStepReason({
        reminder,
        now,
        latestHistoryAction,
        recentDeferralCount,
        recentCompletionCount,
        scheduleHint,
        descriptionSnippet,
        proofAffinityHint,
      });

      return {
        reminderId: reminder.id,
        reminderTitle: reminder.title,
        spaceId: pickPrimarySpaceId(reminder),
        spaceIds: normalizedSpaceIds(reminder),
        spaceName:
          spacesById.get(pickPrimarySpaceId(reminder))?.name ?? "Unknown space",
        status: reminder.status,
        dueAt: getReminderScheduleTimestamp(reminder),
        descriptionSnippet,
        isRecurringLike: isRecurringLikeReminder(reminder),
        scheduleHint,
        latestHistoryAction,
        latestHistoryAt,
        recentDeferralCount,
        recentCompletionCount,
        proofAffinityHint,
        priorityScore,
        suggestedAction: nextStep.suggestedAction,
        reason: nextStep.reason,
      };
    })
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }
      return left.dueAt.localeCompare(right.dueAt);
    })
    .slice(0, 5);

  const groupedBySpace = Array.from(
    openReminders.reduce<Map<string, Reminder[]>>((current, reminder) => {
      const primarySpaceId = pickPrimarySpaceId(reminder);
      current.set(primarySpaceId, [
        ...(current.get(primarySpaceId) ?? []),
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

  const openRecurring = workspace.recurringOccurrences
    .filter((occurrence) => occurrence.status === "scheduled")
    .flatMap<RecurringActionCenterOccurrence>((occurrence) => {
      const plan = recurringPlansById.get(occurrence.planId);
      if (!plan || plan.status !== "active") return [];

      return [
        {
          occurrenceId: occurrence.id,
          planId: plan.id,
          title: plan.title,
          description: plan.description,
          status: occurrence.status,
          dueAt: occurrence.dueAt,
          effectiveDueAt: occurrence.snoozedUntil ?? occurrence.dueAt,
          spaceId: pickPrimarySpaceId(plan),
          spaceIds: normalizedSpaceIds(plan),
          spaceName:
            spacesById.get(pickPrimarySpaceId(plan))?.name ?? "Unknown space",
          proofRequired: Boolean(plan.proofRequired),
        },
      ];
    })
    .sort((left, right) =>
      left.effectiveDueAt.localeCompare(right.effectiveDueAt),
    );

  const recurringOverdue = openRecurring.filter(
    (occurrence) => occurrence.effectiveDueAt <= now,
  );
  const recurringDueToday = openRecurring.filter((occurrence) => {
    return (
      occurrence.effectiveDueAt > now &&
      isSameDay(occurrence.effectiveDueAt, now)
    );
  });
  const recurringUpcoming = openRecurring.filter((occurrence) => {
    return (
      occurrence.effectiveDueAt > now &&
      !isSameDay(occurrence.effectiveDueAt, now)
    );
  });

  const recurringNextBestSteps = openRecurring
    .slice(0, 6)
    .map<RecurringActionCenterNextStep>((occurrence) => {
      if (occurrence.effectiveDueAt <= now) {
        return {
          occurrenceId: occurrence.occurrenceId,
          planId: occurrence.planId,
          title: occurrence.title,
          dueAt: occurrence.effectiveDueAt,
          spaceId: occurrence.spaceId,
          spaceName: occurrence.spaceName,
          suggestedAction: occurrence.proofRequired
            ? "log-proof"
            : "complete-now",
          reason: occurrence.proofRequired
            ? "This routine is overdue and expects proof capture, so log evidence first and resolve it in one flow."
            : "This routine occurrence is overdue and should be resolved before the queue expands.",
        };
      }

      if (isSameDay(occurrence.effectiveDueAt, now)) {
        return {
          occurrenceId: occurrence.occurrenceId,
          planId: occurrence.planId,
          title: occurrence.title,
          dueAt: occurrence.effectiveDueAt,
          spaceId: occurrence.spaceId,
          spaceName: occurrence.spaceName,
          suggestedAction: occurrence.proofRequired
            ? "log-proof"
            : "complete-now",
          reason: occurrence.proofRequired
            ? "This routine is due today and requires proof, so capture evidence while completing it."
            : "This routine is due today and can be completed quickly to keep streak momentum.",
        };
      }

      return {
        occurrenceId: occurrence.occurrenceId,
        planId: occurrence.planId,
        title: occurrence.title,
        dueAt: occurrence.effectiveDueAt,
        spaceId: occurrence.spaceId,
        spaceName: occurrence.spaceName,
        suggestedAction: "open-planner",
        reason:
          "This routine is upcoming and should be reviewed with the rest of the plan so due-time clustering stays manageable.",
      };
    });

  const recurringRecentActivity = workspace.recurringOccurrences
    .flatMap<RecurringActionCenterActivity>((occurrence) => {
      const plan = recurringPlansById.get(occurrence.planId);
      if (!plan) return [];

      const primarySpaceId = pickPrimarySpaceId(occurrence);
      const spaceName =
        spacesById.get(primarySpaceId)?.name ??
        spacesById.get(pickPrimarySpaceId(plan))?.name ??
        "Unknown space";

      return (occurrence.history ?? []).map((historyItem) => ({
        id: historyItem.id,
        occurrenceId: occurrence.id,
        planId: plan.id,
        planTitle: plan.title,
        action: historyItem.action,
        actionSource: historyItem.actionSource,
        at: historyItem.at,
        note: historyItem.note,
        logId: historyItem.logId,
        completionLatencyMinutes: historyItem.completionLatencyMinutes,
        spaceId: primarySpaceId,
        spaceName,
      }));
    })
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 10);

  return {
    overdue,
    dueToday,
    upcoming,
    recurringOverdue,
    recurringDueToday,
    recurringUpcoming,
    recurringNextBestSteps,
    recurringRecentActivity,
    recentActivity,
    nextBestSteps,
    groupedBySpace,
    summary: {
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      upcomingCount: upcoming.length,
      recurringOverdueCount: recurringOverdue.length,
      recurringDueTodayCount: recurringDueToday.length,
      recurringUpcomingCount: recurringUpcoming.length,
      recurringNextBestStepCount: recurringNextBestSteps.length,
      recurringRecentActivityCount: recurringRecentActivity.length,
      recentActivityCount: recentActivity.length,
      nextBestStepCount: nextBestSteps.length,
      groupedSpaceCount: groupedBySpace.length,
    },
  };
}
