import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const { AI_TELEMETRY_WORKFLOW_SURFACE_CHIPS } =
  await import("../services/ai/aiTelemetry.ts");

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("account AI summary and tracker reflect the full shipped client-side surface set", () => {
  const accountScreen = readWorkspaceFile("app/account.tsx");
  const tracker = readWorkspaceFile("docs/ai-feature-tracker.md");

  assert.match(accountScreen, /AI_TELEMETRY_WORKFLOW_SURFACE_CHIPS/);
  assert.ok(
    AI_TELEMETRY_WORKFLOW_SURFACE_CHIPS.some(
      (item) => item.surface === "action-center-explainer",
    ),
  );
  assert.ok(
    AI_TELEMETRY_WORKFLOW_SURFACE_CHIPS.some(
      (item) => item.surface === "tracking-quality-brief",
    ),
  );
  assert.ok(
    AI_TELEMETRY_WORKFLOW_SURFACE_CHIPS.some(
      (item) => item.surface === "inventory-lifecycle-brief",
    ),
  );

  assert.match(
    tracker,
    /All proposal-defined client-side workflow surfaces are shipped\./,
  );
  assert.match(tracker, /backend\/server-mode follow-ups only\./);
  assert.match(
    tracker,
    /Updated account AI telemetry chips to cover all shipped AI surfaces/,
  );
});
