import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("visual history wires cross-space trend summary flow", () => {
  const visualHistory = readWorkspaceFile("app/visual-history.tsx");
  const promptBuilders = readWorkspaceFile("services/ai/aiPromptBuilders.ts");
  const consentCopy = readWorkspaceFile("services/ai/aiConsentCopy.ts");
  const telemetry = readWorkspaceFile("services/ai/aiTelemetry.ts");

  assert.match(visualHistory, /surface: "cross-space-trends"/);
  assert.match(visualHistory, /buildCrossSpaceTrendPrompt/);
  assert.match(visualHistory, /Explain cross-space trends and anomalies/);
  assert.match(visualHistory, /acceptLabel="Apply summary"/);
  assert.match(visualHistory, /handleOpenTrendSource/);
  assert.match(promptBuilders, /export function buildCrossSpaceTrendPrompt/);
  assert.match(consentCopy, /export const aiCrossSpaceTrendCopy = \{/);
  assert.match(telemetry, /"cross-space-trends"/);
});
