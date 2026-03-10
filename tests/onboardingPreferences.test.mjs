import assert from "node:assert/strict";
import test from "node:test";

const {
  DEFAULT_ONBOARDING_COMPLETED,
  normalizeOnboardingCompleted,
} = await import("../services/onboarding/onboardingPreferences.ts");

test("onboarding completion defaults to incomplete until a stored completed flag is present", () => {
  assert.equal(DEFAULT_ONBOARDING_COMPLETED, false);
  assert.equal(normalizeOnboardingCompleted(true), true);
  assert.equal(normalizeOnboardingCompleted("true"), true);
  assert.equal(normalizeOnboardingCompleted("completed"), true);
  assert.equal(normalizeOnboardingCompleted(false), false);
  assert.equal(normalizeOnboardingCompleted("false"), false);
  assert.equal(normalizeOnboardingCompleted(null), false);
});