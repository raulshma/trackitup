import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("inventory tab wires grounded AI inventory lifecycle brief flow", () => {
  const inventoryScreen = readWorkspaceFile("app/(tabs)/inventory.tsx");
  const promptBuilders = readWorkspaceFile("services/ai/aiPromptBuilders.ts");
  const consentCopy = readWorkspaceFile("services/ai/aiConsentCopy.ts");
  const telemetry = readWorkspaceFile("services/ai/aiTelemetry.ts");

  assert.match(inventoryScreen, /surface: "inventory-lifecycle-brief"/);
  assert.match(inventoryScreen, /buildInventoryLifecyclePrompt/);
  assert.match(inventoryScreen, /openInventoryLifecycleSource/);
  assert.match(inventoryScreen, /Generate a grounded inventory brief/);
  assert.match(inventoryScreen, /Latest inventory brief status/);
  assert.match(inventoryScreen, /acceptLabel="Apply brief"/);
  assert.match(promptBuilders, /export function buildInventoryLifecyclePrompt/);
  assert.match(consentCopy, /export const aiInventoryLifecycleCopy = \{/);
  assert.match(telemetry, /"inventory-lifecycle-brief"/);
});
