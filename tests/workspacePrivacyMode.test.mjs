import assert from "node:assert/strict";
import test from "node:test";

const {
  DEFAULT_WORKSPACE_PRIVACY_MODE,
  getWorkspacePrivacyModeDescription,
  getWorkspacePrivacyModeLabel,
  normalizeWorkspacePrivacyMode,
} = await import("../services/offline/workspacePrivacyMode.ts");

test("workspace privacy mode normalizes unknown values to the protected default", () => {
  assert.equal(DEFAULT_WORKSPACE_PRIVACY_MODE, "protected");
  assert.equal(normalizeWorkspacePrivacyMode("compatibility"), "compatibility");
  assert.equal(normalizeWorkspacePrivacyMode("protected"), "protected");
  assert.equal(normalizeWorkspacePrivacyMode("unexpected"), "protected");
  assert.equal(normalizeWorkspacePrivacyMode(null), "protected");
});

test("workspace privacy mode copy explains the two device persistence modes", () => {
  assert.equal(getWorkspacePrivacyModeLabel("protected"), "Protected");
  assert.equal(getWorkspacePrivacyModeLabel("compatibility"), "Compatibility");
  assert.match(
    getWorkspacePrivacyModeDescription("protected"),
    /encrypted local snapshots/i,
  );
  assert.match(
    getWorkspacePrivacyModeDescription("compatibility"),
    /legacy local persistence/i,
  );
});