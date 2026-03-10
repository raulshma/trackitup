export const WORKSPACE_PRIVACY_MODE_STORAGE_KEY =
  "trackitup.workspace.privacy-mode.v1";
export const WORKSPACE_PRIVACY_MODE_OPTIONS = [
  "protected",
  "compatibility",
] as const;

export type WorkspacePrivacyMode =
  (typeof WORKSPACE_PRIVACY_MODE_OPTIONS)[number];

export const DEFAULT_WORKSPACE_PRIVACY_MODE: WorkspacePrivacyMode =
  "protected";

export function normalizeWorkspacePrivacyMode(
  value: unknown,
): WorkspacePrivacyMode {
  return WORKSPACE_PRIVACY_MODE_OPTIONS.includes(value as WorkspacePrivacyMode)
    ? (value as WorkspacePrivacyMode)
    : DEFAULT_WORKSPACE_PRIVACY_MODE;
}

export function getWorkspacePrivacyModeLabel(mode: WorkspacePrivacyMode) {
  return mode === "protected" ? "Protected" : "Compatibility";
}

export function getWorkspacePrivacyModeDescription(mode: WorkspacePrivacyMode) {
  return mode === "protected"
    ? "Protected mode prefers encrypted local snapshots for each workspace scope and falls back only when secure local encryption is unavailable on this device."
    : "Compatibility mode uses the legacy local persistence path for this device scope and removes encrypted local snapshots for the active workspace scope.";
}