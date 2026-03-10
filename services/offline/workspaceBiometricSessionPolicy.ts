export const WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_OPTIONS = [
  "immediate",
  "1m",
  "5m",
  "15m",
] as const;

export type WorkspaceBiometricReauthTimeout =
  (typeof WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_OPTIONS)[number];

export const DEFAULT_WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT: WorkspaceBiometricReauthTimeout =
  "immediate";

const WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_MS: Record<
  WorkspaceBiometricReauthTimeout,
  number
> = {
  immediate: 0,
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
};

export function normalizeWorkspaceBiometricReauthTimeout(
  value: unknown,
): WorkspaceBiometricReauthTimeout {
  return WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_OPTIONS.includes(
    value as WorkspaceBiometricReauthTimeout,
  )
    ? (value as WorkspaceBiometricReauthTimeout)
    : DEFAULT_WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT;
}

export function getWorkspaceBiometricReauthTimeoutLabel(
  timeout: WorkspaceBiometricReauthTimeout,
) {
  switch (timeout) {
    case "1m":
      return "1 min";
    case "5m":
      return "5 min";
    case "15m":
      return "15 min";
    default:
      return "Immediate";
  }
}

export function getWorkspaceBiometricReauthTimeoutDescription(
  timeout: WorkspaceBiometricReauthTimeout,
) {
  switch (timeout) {
    case "1m":
      return "Require local authentication again after TrackItUp has been away from the foreground for at least 1 minute.";
    case "5m":
      return "Require local authentication again after TrackItUp has been away from the foreground for at least 5 minutes.";
    case "15m":
      return "Require local authentication again after TrackItUp has been away from the foreground for at least 15 minutes.";
    default:
      return "Require local authentication again as soon as TrackItUp leaves the foreground while Protected mode is active.";
  }
}

export function getWorkspaceBiometricReauthTimeoutMs(
  timeout: WorkspaceBiometricReauthTimeout,
) {
  return WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_MS[timeout];
}

export function shouldRelockWorkspaceBiometricSession({
  timeout,
  inactiveDurationMs,
}: {
  timeout: WorkspaceBiometricReauthTimeout;
  inactiveDurationMs: number | null;
}) {
  if (inactiveDurationMs === null || !Number.isFinite(inactiveDurationMs)) {
    return true;
  }

  return inactiveDurationMs >= getWorkspaceBiometricReauthTimeoutMs(timeout);
}