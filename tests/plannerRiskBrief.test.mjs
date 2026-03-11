import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("planner tab wires grounded AI risk brief flow", () => {
  const plannerScreen = readWorkspaceFile("app/(tabs)/planner.tsx");
  const promptBuilders = readWorkspaceFile("services/ai/aiPromptBuilders.ts");
  const consentCopy = readWorkspaceFile("services/ai/aiConsentCopy.ts");
  const telemetry = readWorkspaceFile("services/ai/aiTelemetry.ts");

  assert.match(plannerScreen, /surface: "planner-risk-brief"/);
  assert.match(plannerScreen, /buildPlannerRiskPrompt/);
  assert.match(plannerScreen, /Explain what looks risky or safely deferrable/);
  assert.match(plannerScreen, /acceptLabel="Apply brief"/);
  assert.match(plannerScreen, /openPlannerRiskSource/);
  assert.match(promptBuilders, /export function buildPlannerRiskPrompt/);
  assert.match(consentCopy, /export const aiPlannerRiskCopy = \{/);
  assert.match(telemetry, /"planner-risk-brief"/);
});
