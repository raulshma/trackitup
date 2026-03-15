import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("action center wires grounded workspace q&a flow", () => {
  const actionCenter = readWorkspaceFile("app/action-center.tsx");
  const promptBuilders = readWorkspaceFile("services/ai/aiPromptBuilders.ts");
  const consentCopy = readWorkspaceFile("services/ai/aiConsentCopy.ts");
  const telemetry = readWorkspaceFile("services/ai/aiTelemetry.ts");

  assert.match(actionCenter, /surface: "workspace-q-and-a"/);
  assert.match(actionCenter, /buildWorkspaceQaPrompt/);
  assert.match(actionCenter, /handleOpenWorkspaceQaSource/);
  assert.match(actionCenter, /Ask a grounded question about this workspace/);
  assert.match(promptBuilders, /export function buildWorkspaceQaPrompt/);
  assert.match(consentCopy, /export const aiWorkspaceQaCopy = \{/);
  assert.match(telemetry, /"workspace-q-and-a"/);
});

test("action center wires grounded tracking-quality brief flow", () => {
  const actionCenter = readWorkspaceFile("app/action-center.tsx");
  const promptBuilders = readWorkspaceFile("services/ai/aiPromptBuilders.ts");
  const consentCopy = readWorkspaceFile("services/ai/aiConsentCopy.ts");
  const telemetry = readWorkspaceFile("services/ai/aiTelemetry.ts");

  assert.match(actionCenter, /surface: "tracking-quality-brief"/);
  assert.match(actionCenter, /buildTrackingQualityPrompt/);
  assert.match(actionCenter, /handleOpenTrackingQualitySource/);
  assert.match(
    actionCenter,
    /Explain what to record next to improve tracking quality/,
  );
  assert.match(promptBuilders, /export function buildTrackingQualityPrompt/);
  assert.match(consentCopy, /export const aiTrackingQualityCopy = \{/);
  assert.match(telemetry, /"tracking-quality-brief"/);
});

test("action center accepts voice transcript seed params for dictation handoff", () => {
  const actionCenter = readWorkspaceFile("app/action-center.tsx");

  assert.match(actionCenter, /dictatedRequest\?: string/);
  assert.match(actionCenter, /autoGenerate\?: string/);
  assert.match(actionCenter, /setAiRequest\(dictatedRequest\)/);
  assert.match(actionCenter, /void handleGenerateAiDraft\(dictatedRequest\)/);
});
