import assert from "node:assert/strict";
import test from "node:test";

const {
  getWorkspaceLocalProtectionDescription,
  getWorkspaceLocalProtectionLabel,
} = await import("../services/offline/workspaceLocalProtection.ts");

test("workspace local protection labels match expected privacy states", () => {
  assert.equal(getWorkspaceLocalProtectionLabel("protected"), "Protected");
  assert.equal(getWorkspaceLocalProtectionLabel("standard"), "Compatibility");
  assert.equal(getWorkspaceLocalProtectionLabel("blocked"), "Blocked");
});

test("workspace local protection descriptions explain blocked recovery", () => {
  assert.match(
    getWorkspaceLocalProtectionDescription({
      status: "protected",
      persistenceMode: "local-storage",
    }),
    /protected local snapshots/i,
  );
  assert.match(
    getWorkspaceLocalProtectionDescription({
      status: "protected",
      persistenceMode: "memory",
    }),
    /memory only on this device/i,
  );
  assert.match(
    getWorkspaceLocalProtectionDescription({
      status: "standard",
      persistenceMode: "watermelondb",
    }),
    /compatibility local persistence/i,
  );
  assert.match(
    getWorkspaceLocalProtectionDescription({
      status: "blocked",
      persistenceMode: "memory",
      blockedReason: "missing-key",
    }),
    /encryption key is no longer available/i,
  );
});
