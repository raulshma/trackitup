import assert from "node:assert/strict";
import test from "node:test";

const {
  __setWorkspaceBiometricModuleForTests,
  authenticateWorkspaceBiometric,
  getWorkspaceBiometricAvailability,
  getWorkspaceBiometricDescription,
} = await import("../services/offline/workspaceBiometric.ts");

test.afterEach(() => {
  __setWorkspaceBiometricModuleForTests(null);
});

test("workspace biometric availability reports supported enrolled methods", async () => {
  __setWorkspaceBiometricModuleForTests({
    hasHardwareAsync: async () => true,
    isEnrolledAsync: async () => true,
    supportedAuthenticationTypesAsync: async () => [1, 2],
    authenticateAsync: async () => ({ success: true }),
  });

  const availability = await getWorkspaceBiometricAvailability();
  assert.equal(availability.status, "available");
  assert.match(availability.label, /face unlock/i);
  assert.match(availability.label, /fingerprint/i);
});

test("workspace biometric availability and auth failures map to user-facing messages", async () => {
  __setWorkspaceBiometricModuleForTests({
    hasHardwareAsync: async () => true,
    isEnrolledAsync: async () => false,
    supportedAuthenticationTypesAsync: async () => [],
    authenticateAsync: async () => ({
      success: false,
      error: "authentication_failed",
    }),
  });

  const availability = await getWorkspaceBiometricAvailability();
  assert.equal(availability.status, "unavailable");
  assert.equal(availability.reason, "not-enrolled");

  const authResult = await authenticateWorkspaceBiometric();
  assert.equal(authResult.status, "error");
  assert.match(authResult.message, /did not verify/i);

  assert.match(
    getWorkspaceBiometricDescription({
      availability,
      enabled: false,
      privacyMode: "protected",
    }),
    /set up face id|touch id|fingerprint|device credential/i,
  );
});