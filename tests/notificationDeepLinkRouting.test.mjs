import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("workspace provider deep-links default reminder and recurring notification taps", () => {
  const provider = readWorkspaceFile("providers/WorkspaceProvider.tsx");

  assert.match(provider, /const router = useRouter\(\)/);
  assert.match(provider, /if \(intent\.kind === "default"\)/);
  assert.match(provider, /pathname: "\/action-center"/);
  assert.match(provider, /reminderId: intent\.reminderId/);
  assert.match(provider, /if \(recurringIntent\.kind === "default"\)/);
  assert.match(
    provider,
    /recurringOccurrenceId: recurringIntent\.occurrenceId/,
  );
  assert.match(provider, /pathname: "\/logbook"/);
  assert.match(provider, /recurringOccurrenceId: occurrence\.id/);
  assert.match(provider, /recurringPlanId: plan\.id/);
});

test("action center accepts notification focus params for reminder and recurring targets", () => {
  const actionCenter = readWorkspaceFile("app/action-center.tsx");

  assert.match(actionCenter, /useLocalSearchParams/);
  assert.match(actionCenter, /focusedReminderId/);
  assert.match(actionCenter, /focusedRecurringOccurrenceId/);
  assert.match(actionCenter, /openedFromNotification/);
  assert.match(actionCenter, /Focused reminder from alert/);
  assert.match(actionCenter, /Focused routine from alert/);
  assert.match(actionCenter, /item\.reminderId === focusedReminderId/);
  assert.match(
    actionCenter,
    /item\.occurrenceId === focusedRecurringOccurrenceId/,
  );
  assert.match(
    actionCenter,
    /const scrollViewRef = useRef<ScrollView>\(null\)/,
  );
  assert.match(
    actionCenter,
    /setFocusedTargetY\(event\.nativeEvent\.layout\.y\)/,
  );
  assert.match(actionCenter, /scrollViewRef\.current\?\.scrollTo\(/);
  assert.match(actionCenter, /hasClearedFocusParamsRef/);
  assert.match(actionCenter, /router\.replace\("\/action-center" as never\)/);
});
