import assert from "node:assert/strict";
import test from "node:test";

const {
  DEFAULT_WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT,
  getWorkspaceBiometricReauthTimeoutDescription,
  getWorkspaceBiometricReauthTimeoutLabel,
  normalizeWorkspaceBiometricReauthTimeout,
  shouldRelockWorkspaceBiometricSession,
} = await import("../services/offline/workspaceBiometricSessionPolicy.ts");

test("workspace biometric re-auth timeout helpers normalize and label options", () => {
  assert.equal(DEFAULT_WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT, "immediate");
  assert.equal(normalizeWorkspaceBiometricReauthTimeout("1m"), "1m");
  assert.equal(normalizeWorkspaceBiometricReauthTimeout("5m"), "5m");
  assert.equal(normalizeWorkspaceBiometricReauthTimeout("15m"), "15m");
  assert.equal(normalizeWorkspaceBiometricReauthTimeout("30m"), "immediate");
  assert.equal(getWorkspaceBiometricReauthTimeoutLabel("immediate"), "Immediate");
  assert.equal(getWorkspaceBiometricReauthTimeoutLabel("5m"), "5 min");
  assert.match(
    getWorkspaceBiometricReauthTimeoutDescription("15m"),
    /15 minutes/i,
  );
});

test("workspace biometric session re-lock policy triggers at the configured threshold", () => {
  assert.equal(
    shouldRelockWorkspaceBiometricSession({
      timeout: "immediate",
      inactiveDurationMs: 0,
    }),
    true,
  );
  assert.equal(
    shouldRelockWorkspaceBiometricSession({
      timeout: "1m",
      inactiveDurationMs: 30_000,
    }),
    false,
  );
  assert.equal(
    shouldRelockWorkspaceBiometricSession({
      timeout: "1m",
      inactiveDurationMs: 60_000,
    }),
    true,
  );
  assert.equal(
    shouldRelockWorkspaceBiometricSession({
      timeout: "5m",
      inactiveDurationMs: null,
    }),
    true,
  );
});