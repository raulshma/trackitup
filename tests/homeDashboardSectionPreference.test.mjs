import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const {
  DEFAULT_HOME_DASHBOARD_SECTION,
  HOME_DASHBOARD_SECTION_STORAGE_KEY,
  normalizeHomeDashboardSection,
} = await import("../services/insights/homeDashboardSectionPreferences.ts");

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("home dashboard section preference normalizes to supported feature groups", () => {
  assert.equal(DEFAULT_HOME_DASHBOARD_SECTION, "overview");
  assert.equal(
    HOME_DASHBOARD_SECTION_STORAGE_KEY,
    "trackitup.home-dashboard.section.v1",
  );
  assert.equal(normalizeHomeDashboardSection("overview"), "overview");
  assert.equal(normalizeHomeDashboardSection("capture"), "capture");
  assert.equal(normalizeHomeDashboardSection("spaces"), "spaces");
  assert.equal(normalizeHomeDashboardSection("manage"), "manage");
  assert.equal(normalizeHomeDashboardSection("everything"), "overview");
  assert.equal(normalizeHomeDashboardSection(null), "overview");
});

test("home dashboard remembers the selected feature group", () => {
  const homeScreen = readWorkspaceFile("app/(tabs)/index.tsx");
  const persistence = readWorkspaceFile(
    "services/insights/homeDashboardSectionPreferencePersistence.ts",
  );

  assert.match(homeScreen, /loadHomeDashboardSectionPreference/);
  assert.match(homeScreen, /persistHomeDashboardSectionPreference/);
  assert.match(homeScreen, /setIsSectionPreferenceLoaded\(true\)/);
  assert.match(homeScreen, /sectionSwitchBadgeRow/);
  assert.match(homeScreen, /sectionSwitchIconWrap/);
  assert.match(homeScreen, /Animated\.timing\(sectionTransition/);
  assert.match(homeScreen, /translateY: sectionTransition\.interpolate/);
  assert.match(homeScreen, /hiddenWidgets\.length/);
  assert.match(homeScreen, /workspace\.templates\.length/);
  assert.match(persistence, /HOME_DASHBOARD_SECTION_STORAGE_KEY/);
  assert.match(persistence, /home-dashboard-section-v1\.json/);
});
