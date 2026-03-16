import assert from "node:assert/strict";
import test from "node:test";

const { trackItUpWorkspace } = await import("../constants/TrackItUpData.ts");
const {
  bulkSnoozeRecurringOccurrences,
  buildRecurringPlanAnalytics,
  completeRecurringOccurrence,
  ensureRecurringOccurrencesWindow,
  findCurrentRecurringOccurrenceForPlan,
  resolveRecurringPromptMatchWithLog,
  summarizeRecurringSmartMatches,
  upsertRecurringPlan,
  validateRecurringPlanDraft,
} = await import("../services/recurring/recurringPlans.ts");
const { buildReminderActionCenter } =
  await import("../services/reminders/reminderActionCenter.ts");

function clone(value) {
  return structuredClone(value);
}

test("recurring engine generates multi-time daily occurrences in a sliding window", () => {
  const base = clone(trackItUpWorkspace);
  const next = upsertRecurringPlan(
    base,
    {
      id: "plan-feed-twice",
      spaceId: "reef",
      title: "Feed fish twice daily",
      scheduleRule: {
        type: "daily",
        times: ["08:00", "18:00"],
      },
      startDate: "2026-03-08T00:00:00.000Z",
      timezone: "America/New_York",
      status: "active",
    },
    "2026-03-09T10:00:00.000Z",
  );

  const projected = ensureRecurringOccurrencesWindow(next, {
    now: "2026-03-09T10:00:00.000Z",
    windowDays: 2,
  });

  const generated = projected.recurringOccurrences.filter(
    (occurrence) => occurrence.planId === "plan-feed-twice",
  );

  assert.ok(generated.length >= 4);
  const marchNinthOccurrences = generated.filter((occurrence) =>
    occurrence.dueAt.startsWith("2026-03-09"),
  );
  assert.equal(marchNinthOccurrences.length, 2);
});

test("recurring engine marks stale scheduled occurrences as missed after grace", () => {
  const workspace = clone(trackItUpWorkspace);
  workspace.generatedAt = "2026-03-09T19:30:00.000Z";
  workspace.recurringPlans = [
    {
      id: "plan-short-grace",
      spaceId: "reef",
      title: "Quick maintenance",
      scheduleRule: { type: "daily", times: ["08:00"] },
      startDate: "2026-03-01T00:00:00.000Z",
      timezone: "UTC",
      gracePeriodMinutes: 30,
      status: "active",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ];
  workspace.recurringOccurrences = [
    {
      id: "occ-short-grace",
      planId: "plan-short-grace",
      spaceId: "reef",
      dueAt: "2026-03-09T08:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
    },
  ];

  const projected = ensureRecurringOccurrencesWindow(workspace, {
    now: "2026-03-09T19:30:00.000Z",
  });

  assert.equal(projected.recurringOccurrences[0].status, "missed");
});

test("updating recurring plan schedule clears future scheduled occurrences only", () => {
  const workspace = clone(trackItUpWorkspace);
  workspace.generatedAt = "2026-03-10T10:00:00.000Z";
  workspace.recurringPlans = [
    {
      id: "plan-editable",
      spaceId: "reef",
      title: "Feed fish",
      scheduleRule: { type: "daily", times: ["08:00"] },
      startDate: "2026-03-01T00:00:00.000Z",
      timezone: "UTC",
      status: "active",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ];
  workspace.recurringOccurrences = [
    {
      id: "occ-past-completed",
      planId: "plan-editable",
      spaceId: "reef",
      dueAt: "2026-03-09T08:00:00.000Z",
      status: "completed",
      completedAt: "2026-03-09T08:05:00.000Z",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T08:05:00.000Z",
    },
    {
      id: "occ-past-scheduled",
      planId: "plan-editable",
      spaceId: "reef",
      dueAt: "2026-03-10T08:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
    },
    {
      id: "occ-future-scheduled",
      planId: "plan-editable",
      spaceId: "reef",
      dueAt: "2026-03-11T08:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
    },
  ];

  const updated = upsertRecurringPlan(
    workspace,
    {
      ...workspace.recurringPlans[0],
      scheduleRule: { type: "daily", times: ["09:00"] },
    },
    "2026-03-10T10:00:00.000Z",
  );

  assert.equal(
    updated.recurringOccurrences.some(
      (item) => item.id === "occ-future-scheduled",
    ),
    false,
  );
  assert.equal(
    updated.recurringOccurrences.some(
      (item) => item.id === "occ-past-completed",
    ),
    true,
  );
  assert.equal(
    updated.recurringOccurrences.some(
      (item) => item.id === "occ-past-scheduled",
    ),
    true,
  );
});

test("recurring smart matching links matching logs to pending occurrences", () => {
  const workspace = clone(trackItUpWorkspace);
  workspace.generatedAt = "2026-03-09T14:10:00.000Z";
  workspace.recurringPlans = [
    {
      id: "plan-water-change",
      spaceId: "reef",
      title: "Water change",
      category: "maintenance",
      tags: ["water-change", "reef"],
      scheduleRule: { type: "every-n-days", interval: 3, times: ["09:00"] },
      startDate: "2026-03-01T00:00:00.000Z",
      timezone: "UTC",
      gracePeriodMinutes: 360,
      smartMatchMode: "auto",
      status: "active",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ];
  workspace.recurringOccurrences = [
    {
      id: "occ-water-change-due",
      planId: "plan-water-change",
      spaceId: "reef",
      dueAt: "2026-03-09T09:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
    },
  ];

  const logs = [
    {
      id: "log-water-change",
      spaceId: "reef",
      kind: "asset-update",
      title: "Water change completed",
      note: "20% water change with matching salinity.",
      occurredAt: "2026-03-09T10:00:00.000Z",
      tags: ["water-change", "reef"],
    },
  ];

  const result = summarizeRecurringSmartMatches(
    {
      ...workspace,
      logs,
    },
    logs,
    "2026-03-09T14:10:00.000Z",
  );

  assert.equal(result.autoMatchCount, 1);
  assert.equal(result.promptMatches.length, 0);
  assert.equal(result.workspace.recurringOccurrences[0].status, "completed");
  assert.equal(
    result.workspace.logs[0].recurringOccurrenceId,
    "occ-water-change-due",
  );
});

test("recurring analytics calculates completion rates and streaks", () => {
  const workspace = clone(trackItUpWorkspace);
  workspace.generatedAt = "2026-03-10T00:00:00.000Z";
  workspace.recurringPlans = [
    {
      id: "plan-analytics",
      spaceId: "reef",
      title: "Feed fish",
      scheduleRule: { type: "daily", times: ["08:00"] },
      startDate: "2026-03-01T00:00:00.000Z",
      timezone: "UTC",
      status: "active",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ];
  workspace.recurringOccurrences = [
    {
      id: "occ-a",
      planId: "plan-analytics",
      spaceId: "reef",
      dueAt: "2026-03-07T08:00:00.000Z",
      status: "completed",
      completedAt: "2026-03-07T08:05:00.000Z",
      createdAt: "2026-03-07T00:00:00.000Z",
      updatedAt: "2026-03-07T08:05:00.000Z",
    },
    {
      id: "occ-b",
      planId: "plan-analytics",
      spaceId: "reef",
      dueAt: "2026-03-08T08:00:00.000Z",
      status: "completed",
      completedAt: "2026-03-08T08:01:00.000Z",
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-08T08:01:00.000Z",
    },
    {
      id: "occ-c",
      planId: "plan-analytics",
      spaceId: "reef",
      dueAt: "2026-03-09T08:00:00.000Z",
      status: "missed",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T23:59:00.000Z",
    },
    {
      id: "occ-d",
      planId: "plan-analytics",
      spaceId: "reef",
      dueAt: "2026-03-10T08:00:00.000Z",
      status: "completed",
      completedAt: "2026-03-10T08:02:00.000Z",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T08:02:00.000Z",
    },
  ];

  const analytics = buildRecurringPlanAnalytics(
    workspace,
    "plan-analytics",
    "2026-03-10T12:00:00.000Z",
  );

  assert.ok(
    analytics.completionRate7d > 0.7 && analytics.completionRate7d < 0.8,
  );
  assert.equal(analytics.bestStreak, 2);
  assert.equal(analytics.currentStreak, 1);
  assert.equal(analytics.missedCount, 1);
});

test("action center includes recurring queues and summary counts", () => {
  const center = buildReminderActionCenter(trackItUpWorkspace);

  assert.ok(center.summary.recurringOverdueCount >= 0);
  assert.ok(center.summary.recurringDueTodayCount >= 0);
  assert.ok(Array.isArray(center.recurringNextBestSteps));
});

test("bulk snooze updates selected scheduled recurring occurrences", () => {
  const workspace = clone(trackItUpWorkspace);
  const scheduled = workspace.recurringOccurrences
    .filter((item) => item.status === "scheduled")
    .slice(0, 2)
    .map((item) => item.id);
  const [targetA, targetB] = scheduled;
  assert.ok(targetA);
  assert.ok(targetB);

  const result = bulkSnoozeRecurringOccurrences(
    workspace,
    [targetA, targetB],
    "2026-03-10T12:00:00.000Z",
    "2026-03-10T10:00:00.000Z",
  );

  const updatedA = result.recurringOccurrences.find(
    (item) => item.id === targetA,
  );
  const updatedB = result.recurringOccurrences.find(
    (item) => item.id === targetB,
  );
  assert.equal(updatedA?.snoozedUntil, "2026-03-10T12:00:00.000Z");
  assert.equal(updatedB?.snoozedUntil, "2026-03-10T12:00:00.000Z");
});

test("manual recurring prompt resolution links log and completes occurrence", () => {
  const workspace = clone(trackItUpWorkspace);
  workspace.generatedAt = "2026-03-10T10:00:00.000Z";
  workspace.recurringPlans = [
    {
      id: "plan-manual-link",
      spaceId: "reef",
      title: "Water change",
      scheduleRule: { type: "daily", times: ["09:00"] },
      startDate: "2026-03-01T00:00:00.000Z",
      timezone: "UTC",
      status: "active",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ];
  workspace.recurringOccurrences = [
    {
      id: "occ-manual-link",
      planId: "plan-manual-link",
      spaceId: "reef",
      dueAt: "2026-03-10T09:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
    },
  ];
  workspace.logs = [
    {
      id: "log-manual-link",
      spaceId: "reef",
      kind: "asset-update",
      title: "Water change done",
      note: "Manual log entry",
      occurredAt: "2026-03-10T09:10:00.000Z",
      tags: ["water-change"],
    },
  ];

  const resolved = resolveRecurringPromptMatchWithLog(
    workspace,
    "occ-manual-link",
    "log-manual-link",
    "2026-03-10T10:00:00.000Z",
  );

  assert.equal(resolved.recurringOccurrences[0].status, "completed");
  assert.equal(resolved.recurringOccurrences[0].logId, "log-manual-link");
  assert.equal(resolved.logs[0].recurringPlanId, "plan-manual-link");
  assert.equal(resolved.logs[0].recurringOccurrenceId, "occ-manual-link");
});

test("monthly recurring draft requires day-of-month or nth-weekday rule", () => {
  const missingMonthlyPatternErrors = validateRecurringPlanDraft({
    id: "plan-monthly-invalid",
    spaceId: "reef",
    title: "Monthly maintenance",
    scheduleRule: {
      type: "monthly",
      times: ["09:00"],
    },
    startDate: "2026-03-01T00:00:00.000Z",
    timezone: "UTC",
    status: "active",
  });

  assert.match(
    missingMonthlyPatternErrors.schedule ?? "",
    /day-of-month or an nth weekday/i,
  );

  const validMonthlyPatternErrors = validateRecurringPlanDraft({
    id: "plan-monthly-valid",
    spaceId: "reef",
    title: "Monthly maintenance",
    scheduleRule: {
      type: "monthly",
      dayOfMonth: 12,
      times: ["09:00"],
    },
    startDate: "2026-03-01T00:00:00.000Z",
    timezone: "UTC",
    status: "active",
  });

  assert.equal(validMonthlyPatternErrors.schedule, undefined);
});

test("findCurrentRecurringOccurrenceForPlan picks due/overdue scheduled occurrence first", () => {
  const workspace = clone(trackItUpWorkspace);
  workspace.generatedAt = "2026-03-10T10:00:00.000Z";
  workspace.recurringOccurrences = [
    {
      id: "occ-plan-a-future",
      planId: "plan-a",
      spaceId: "reef",
      dueAt: "2026-03-10T12:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
    },
    {
      id: "occ-plan-a-overdue",
      planId: "plan-a",
      spaceId: "reef",
      dueAt: "2026-03-10T09:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
    },
    {
      id: "occ-plan-a-completed",
      planId: "plan-a",
      spaceId: "reef",
      dueAt: "2026-03-10T08:00:00.000Z",
      status: "completed",
      completedAt: "2026-03-10T08:03:00.000Z",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T08:03:00.000Z",
    },
  ];

  const current = findCurrentRecurringOccurrenceForPlan(workspace, "plan-a");
  assert.equal(current?.id, "occ-plan-a-overdue");
});

test("findCurrentRecurringOccurrenceForPlan falls back to soonest upcoming when nothing is due", () => {
  const workspace = clone(trackItUpWorkspace);
  workspace.generatedAt = "2026-03-10T06:00:00.000Z";
  workspace.recurringOccurrences = [
    {
      id: "occ-plan-b-later",
      planId: "plan-b",
      spaceId: "reef",
      dueAt: "2026-03-10T12:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
    },
    {
      id: "occ-plan-b-next",
      planId: "plan-b",
      spaceId: "reef",
      dueAt: "2026-03-10T08:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
    },
  ];

  const current = findCurrentRecurringOccurrenceForPlan(workspace, "plan-b");
  assert.equal(current?.id, "occ-plan-b-next");
});

test("completing a recurring occurrence appends a completion history entry", () => {
  const workspace = clone(trackItUpWorkspace);
  workspace.generatedAt = "2026-03-10T10:00:00.000Z";
  workspace.recurringPlans = [
    {
      id: "plan-history-check",
      spaceId: "reef",
      title: "Add aquatic fertilizer",
      scheduleRule: { type: "weekly", daysOfWeek: [2], times: ["09:00"] },
      startDate: "2026-03-03T09:00:00.000Z",
      timezone: "UTC",
      status: "active",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ];
  workspace.recurringOccurrences = [
    {
      id: "occ-history-check",
      planId: "plan-history-check",
      spaceId: "reef",
      dueAt: "2026-03-10T09:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
    },
  ];

  const completed = completeRecurringOccurrence(
    workspace,
    "occ-history-check",
    {
      actionAt: "2026-03-10T10:05:00.000Z",
      actionSource: "manual",
      note: "Completed from planner",
    },
  );

  const updated = completed.recurringOccurrences.find(
    (item) => item.id === "occ-history-check",
  );

  assert.equal(updated?.status, "completed");
  assert.equal(updated?.completedAt, "2026-03-10T10:05:00.000Z");
  assert.ok(updated?.history?.length);
  assert.equal(updated?.history?.[0]?.action, "completed");
  assert.equal(updated?.history?.[0]?.actionSource, "manual");
  assert.equal(updated?.history?.[0]?.at, "2026-03-10T10:05:00.000Z");
});
