import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("workspace persistence falls back to plaintext load when protected encryption is unavailable", () => {
  const persistence = readWorkspaceFile(
    "services/offline/workspacePersistence.ts",
  );

  assert.match(
    persistence,
    /if \(encryptedWorkspace\.status === "unavailable"\) \{[\s\S]*loadPlaintextPersistedWorkspaceIfPresent/s,
  );
  assert.match(
    persistence,
    /if \(encryptedWorkspace\.status === "unavailable"\) \{[\s\S]*localProtectionStatus: "standard"/s,
  );
});

test("workspace persistence falls back to plaintext save when protected encryption is unavailable", () => {
  const persistence = readWorkspaceFile(
    "services/offline/workspacePersistence.ts",
  );

  assert.match(
    persistence,
    /if \(encryptedPersistResult\.status === "unavailable"\) \{\s*await persistPlaintextWorkspace\(snapshot, ownerScopeKey\);\s*return;\s*\}/s,
  );
  assert.match(
    persistence,
    /if \(encryptedPersistResult\.status === "blocked"\) \{\s*await persistPlaintextWorkspace\(snapshot, ownerScopeKey\);\s*return;\s*\}/s,
  );
});

test("workspace persistence falls back to plaintext load when protected encryption is blocked", () => {
  const persistence = readWorkspaceFile(
    "services/offline/workspacePersistence.ts",
  );

  assert.match(
    persistence,
    /if \(encryptedWorkspace\.status === "blocked"\) \{[\s\S]*loadPlaintextPersistedWorkspaceIfPresent/s,
  );
  assert.match(
    persistence,
    /if \(encryptedWorkspace\.status === "blocked"\) \{[\s\S]*localProtectionStatus: "standard"/s,
  );
});

test("encrypted persistence treats adapter unavailability as unavailable, not blocked", () => {
  const encryptedPersistence = readWorkspaceFile(
    "services/offline/workspaceEncryptedPersistence.ts",
  );

  assert.match(
    encryptedPersistence,
    /if \(decryptedWorkspace\.status === "unavailable"\) \{[\s\S]*return \{ status: "unavailable" \};/s,
  );

  const unavailableBranchIndex = encryptedPersistence.indexOf(
    'if (decryptedWorkspace.status === "unavailable")',
  );
  const blockedScopeIndex = encryptedPersistence.indexOf(
    "blockedEncryptedWorkspaceScopes.add(ownerScopeKey);",
  );
  assert.ok(unavailableBranchIndex >= 0);
  assert.ok(blockedScopeIndex > unavailableBranchIndex);
});
