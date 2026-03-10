export const ONBOARDING_COMPLETION_STORAGE_KEY =
  "trackitup.onboarding.completed.v1";

export const DEFAULT_ONBOARDING_COMPLETED = false;

export function normalizeOnboardingCompleted(value: unknown): boolean {
  return value === true || value === "true" || value === "completed";
}