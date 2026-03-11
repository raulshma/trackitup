import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("home dashboard wires grounded AI pulse brief flow", () => {
  const homeScreen = readWorkspaceFile("app/(tabs)/index.tsx");
  const promptBuilders = readWorkspaceFile("services/ai/aiPromptBuilders.ts");
  const consentCopy = readWorkspaceFile("services/ai/aiConsentCopy.ts");
  const telemetry = readWorkspaceFile("services/ai/aiTelemetry.ts");

  assert.match(homeScreen, /surface: "dashboard-pulse"/);
  assert.match(homeScreen, /buildDashboardPulsePrompt/);
  assert.match(homeScreen, /Generate a grounded dashboard brief/);
  assert.match(homeScreen, /acceptLabel="Apply brief"/);
  assert.match(homeScreen, /openDashboardPulseSource/);
  assert.match(promptBuilders, /export function buildDashboardPulsePrompt/);
  assert.match(consentCopy, /export const aiDashboardPulseCopy = \{/);
  assert.match(telemetry, /"dashboard-pulse"/);
});
