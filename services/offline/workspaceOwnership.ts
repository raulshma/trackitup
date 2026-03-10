export const ANONYMOUS_WORKSPACE_SCOPE_KEY = "anonymous";
export const LEGACY_WORKSPACE_STORAGE_KEY = "trackitup.workspace.snapshot.v1";
export const LEGACY_WORKSPACE_SNAPSHOT_FILENAME = "workspace-snapshot-v1.json";
export const LEGACY_WORKSPACE_DATABASE_NAME = "trackitup-workspace";
export const SNAPSHOT_DIRECTORY = "trackitup";

const USER_SCOPE_PREFIX = "user";
const WORKSPACE_ENCRYPTED_SNAPSHOT_FILENAME_PREFIX = "workspace-encrypted-v1";
const WORKSPACE_ENCRYPTED_STORAGE_KEY_PREFIX =
  "trackitup.workspace.encrypted.v1";
const WORKSPACE_ENCRYPTION_KEY_ALIAS_PREFIX = "trackitup.workspace.key.v1";
const WORKSPACE_STORAGE_KEY_PREFIX = "trackitup.workspace.snapshot.v2";
const WORKSPACE_SNAPSHOT_FILENAME_PREFIX = "workspace-snapshot-v2";
const WORKSPACE_DATABASE_NAME_PREFIX = "trackitup-workspace-v2";

export function getWorkspaceOwnerScopeKey(userId?: string | null) {
  return userId
    ? `${USER_SCOPE_PREFIX}:${userId}`
    : ANONYMOUS_WORKSPACE_SCOPE_KEY;
}

export function isAnonymousWorkspaceOwnerScopeKey(scopeKey: string) {
  return scopeKey === ANONYMOUS_WORKSPACE_SCOPE_KEY;
}

export function sanitizeWorkspaceOwnerScopeKey(scopeKey: string) {
  const sanitized = Array.from(scopeKey)
    .map((character) =>
      /[A-Za-z0-9_-]/.test(character)
        ? character
        : `_x${character.codePointAt(0)?.toString(16) ?? "0"}_`,
    )
    .join("");

  return sanitized || ANONYMOUS_WORKSPACE_SCOPE_KEY;
}

export function buildWorkspaceStorageKey(scopeKey: string) {
  return `${WORKSPACE_STORAGE_KEY_PREFIX}.${scopeKey}`;
}

export function buildEncryptedWorkspaceStorageKey(scopeKey: string) {
  return `${WORKSPACE_ENCRYPTED_STORAGE_KEY_PREFIX}.${scopeKey}`;
}

export function buildWorkspaceSnapshotFilename(scopeKey: string) {
  return `${WORKSPACE_SNAPSHOT_FILENAME_PREFIX}-${sanitizeWorkspaceOwnerScopeKey(scopeKey)}.json`;
}

export function buildEncryptedWorkspaceSnapshotFilename(scopeKey: string) {
  return `${WORKSPACE_ENCRYPTED_SNAPSHOT_FILENAME_PREFIX}-${sanitizeWorkspaceOwnerScopeKey(scopeKey)}.json`;
}

export function buildWorkspaceEncryptionKeyAlias(scopeKey: string) {
  return `${WORKSPACE_ENCRYPTION_KEY_ALIAS_PREFIX}.${sanitizeWorkspaceOwnerScopeKey(scopeKey)}`;
}

export function buildWorkspaceDatabaseName(scopeKey: string) {
  return `${WORKSPACE_DATABASE_NAME_PREFIX}-${sanitizeWorkspaceOwnerScopeKey(scopeKey)}`;
}
