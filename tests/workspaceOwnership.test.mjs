import assert from "node:assert/strict";
import test from "node:test";

const {
  ANONYMOUS_WORKSPACE_SCOPE_KEY,
  buildEncryptedWorkspaceSnapshotFilename,
  buildEncryptedWorkspaceStorageKey,
  buildWorkspaceDatabaseName,
  buildWorkspaceEncryptionKeyAlias,
  buildWorkspacePrivacyModeFilename,
  buildWorkspacePrivacyModeStorageKey,
  buildWorkspaceSnapshotFilename,
  buildWorkspaceStorageKey,
  getWorkspaceOwnerScopeKey,
  isAnonymousWorkspaceOwnerScopeKey,
  sanitizeWorkspaceOwnerScopeKey,
} = await import("../services/offline/workspaceOwnership.ts");

test("workspace ownership keys distinguish anonymous and signed-in scopes", () => {
  assert.equal(getWorkspaceOwnerScopeKey(null), ANONYMOUS_WORKSPACE_SCOPE_KEY);
  assert.equal(getWorkspaceOwnerScopeKey("user_123"), "user:user_123");
  assert.equal(isAnonymousWorkspaceOwnerScopeKey("anonymous"), true);
  assert.equal(isAnonymousWorkspaceOwnerScopeKey("user:user_123"), false);
});

test("workspace ownership helpers build safe per-scope storage names", () => {
  assert.equal(
    buildWorkspaceStorageKey("user:user_123"),
    "trackitup.workspace.snapshot.v2.user:user_123",
  );
  assert.equal(
    buildEncryptedWorkspaceStorageKey("user:user_123"),
    "trackitup.workspace.encrypted.v1.user:user_123",
  );
  assert.equal(
    buildWorkspaceSnapshotFilename("user:user_123"),
    "workspace-snapshot-v2-user_x3a_user_123.json",
  );
  assert.equal(
    buildEncryptedWorkspaceSnapshotFilename("user:user_123"),
    "workspace-encrypted-v1-user_x3a_user_123.json",
  );
  assert.equal(
    buildWorkspaceDatabaseName("user:user_123"),
    "trackitup-workspace-v2-user_x3a_user_123",
  );
  assert.equal(
    buildWorkspaceEncryptionKeyAlias("user:user_123"),
    "trackitup.workspace.key.v1.user_x3a_user_123",
  );
  assert.equal(
    buildWorkspacePrivacyModeStorageKey("user:user_123"),
    "trackitup.workspace.privacy-mode.v2.user:user_123",
  );
  assert.equal(
    buildWorkspacePrivacyModeFilename("user:user_123"),
    "workspace-privacy-mode-v2-user_x3a_user_123.json",
  );
  assert.equal(
    sanitizeWorkspaceOwnerScopeKey("anonymous/scope"),
    "anonymous_x2f_scope",
  );
});
