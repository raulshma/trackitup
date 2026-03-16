import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("home dashboard focuses on routine queue with direct done and proof handoff", () => {
  const homeScreen = readWorkspaceFile("app/(tabs)/index.tsx");
  const queueHelper = readWorkspaceFile(
    "services/recurring/todaysRoutineQueue.ts",
  );

  assert.match(homeScreen, /buildTodaysRoutineQueue/);
  assert.match(homeScreen, /label="Today's routine"/);
  assert.match(homeScreen, /One queue for today’s recurring work/);
  assert.match(homeScreen, /handleRoutineDone/);
  assert.match(homeScreen, /completeRecurringOccurrence\(item\.occurrenceId\)/);
  assert.match(homeScreen, /recurringOccurrenceId: item\.occurrenceId/);
  assert.match(homeScreen, /recurringPlanId: item\.planId/);
  assert.match(homeScreen, /formatLastCompleted\(item\.lastCompletedAt\)/);

  assert.match(queueHelper, /export function buildTodaysRoutineQueue/);
  assert.match(queueHelper, /lastCompletedAt/);
});
