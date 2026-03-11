import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("scanner AI assistant wires shared AI review flow and safe routes", () => {
  const scannerScreen = readWorkspaceFile("app/scanner.tsx");
  const promptBuilders = readWorkspaceFile("services/ai/aiPromptBuilders.ts");
  const consentCopy = readWorkspaceFile("services/ai/aiConsentCopy.ts");
  const telemetry = readWorkspaceFile("services/ai/aiTelemetry.ts");

  assert.match(scannerScreen, /AiPromptComposerCard/);
  assert.match(scannerScreen, /AiDraftReviewCard/);
  assert.match(scannerScreen, /surface: "scanner-assistant"/);
  assert.match(scannerScreen, /label="AI scanner assistant"/);
  assert.match(scannerScreen, /Latest scanner assistant status/);
  assert.match(scannerScreen, /pathname: "\/logbook"/);
  assert.match(scannerScreen, /actionId: quickLogActionId/);
  assert.match(scannerScreen, /formatAiScannerAssistantDestinationLabel/);
  assert.match(promptBuilders, /export function buildScannerAssistantPrompt/);
  assert.match(consentCopy, /export const aiScannerAssistantCopy = \{/);
  assert.match(telemetry, /"scanner-assistant"/);
});
