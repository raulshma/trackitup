import assert from "node:assert/strict";
import test from "node:test";

const { trackItUpWorkspace } = await import("../constants/TrackItUpData.ts");
const { buildTodaysRoutineQueue } =
  await import("../services/recurring/todaysRoutineQueue.ts");

function clone(value) {
  return structuredClone(value);
}

test("today routine queue includes only scheduled active-plan occurrences due on current day", () => {
  const workspace = clone(trackItUpWorkspace);
  workspace.generatedAt = "2026-03-10T10:00:00.000Z";
  workspace.recurringPlans = [
    {
      id: "plan-weekly-water-change",
      spaceId: "reef",
      title: "Water change",
      scheduleRule: { type: "weekly", daysOfWeek: [2], times: ["09:00"] },
      startDate: "2026-03-01T00:00:00.000Z",
      timezone: "UTC",
      proofRequired: true,
      status: "active",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
    {
      id: "plan-paused",
      spaceId: "reef",
      title: "Paused task",
      scheduleRule: { type: "daily", times: ["08:00"] },
      startDate: "2026-03-01T00:00:00.000Z",
      timezone: "UTC",
      status: "paused",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ];
  workspace.recurringOccurrences = [
    {
      id: "occ-due-today",
      planId: "plan-weekly-water-change",
      spaceId: "reef",
      dueAt: "2026-03-10T09:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
    },
    {
      id: "occ-snoozed-today",
      planId: "plan-weekly-water-change",
      spaceId: "reef",
      dueAt: "2026-03-10T08:00:00.000Z",
      snoozedUntil: "2026-03-10T11:30:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
    },
    {
      id: "occ-completed",
      planId: "plan-weekly-water-change",
      spaceId: "reef",
      dueAt: "2026-03-09T09:00:00.000Z",
      status: "completed",
      completedAt: "2026-03-09T09:04:00.000Z",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T09:04:00.000Z",
    },
    {
      id: "occ-missed-yesterday",
      planId: "plan-weekly-water-change",
      spaceId: "reef",
      dueAt: "2026-03-09T08:00:00.000Z",
      status: "missed",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T23:59:00.000Z",
    },
    {
      id: "occ-paused-plan",
      planId: "plan-paused",
      spaceId: "reef",
      dueAt: "2026-03-10T08:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
    },
  ];

  const queue = buildTodaysRoutineQueue(workspace);

  assert.deepEqual(
    queue.map((item) => item.occurrenceId),
    ["occ-due-today", "occ-snoozed-today"],
  );
  assert.equal(queue[0].proofRequired, true);
  assert.equal(queue[0].title, "Water change");
  assert.equal(queue[0].spaceId, "reef");
  assert.equal(
    queue[0].lastCompletedAt?.toISOString(),
    "2026-03-09T09:04:00.000Z",
  );
  assert.equal(queue[1].dueAt.toISOString(), "2026-03-10T11:30:00.000Z");
});

test("today routine queue can infer last completed from completion history when completedAt is missing", () => {
  const workspace = clone(trackItUpWorkspace);
  workspace.generatedAt = "2026-03-11T10:00:00.000Z";
  workspace.recurringPlans = [
    {
      id: "plan-feed",
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
      id: "occ-feed-yesterday",
      planId: "plan-feed",
      spaceId: "reef",
      dueAt: "2026-03-10T08:00:00.000Z",
      status: "completed",
      history: [
        {
          id: "history-1",
          action: "completed",
          actionSource: "manual",
          at: "2026-03-10T08:05:00.000Z",
        },
      ],
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T08:05:00.000Z",
    },
    {
      id: "occ-feed-today",
      planId: "plan-feed",
      spaceId: "reef",
      dueAt: "2026-03-11T08:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
    },
  ];

  const queue = buildTodaysRoutineQueue(workspace);

  assert.equal(queue.length, 1);
  assert.equal(queue[0].occurrenceId, "occ-feed-today");
  assert.equal(
    queue[0].lastCompletedAt?.toISOString(),
    "2026-03-10T08:05:00.000Z",
  );
});
