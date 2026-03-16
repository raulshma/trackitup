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

  assert.doesNotMatch(homeScreen, /loadHomeDashboardSectionPreference/);
  assert.doesNotMatch(homeScreen, /persistHomeDashboardSectionPreference/);
  assert.doesNotMatch(homeScreen, /activeSection === "overview"/);
  assert.doesNotMatch(homeScreen, /activeSection === "capture"/);
  assert.doesNotMatch(homeScreen, /activeSection === "spaces"/);
  assert.doesNotMatch(homeScreen, /activeSection === "manage"/);

  assert.doesNotMatch(homeScreen, /label="Action now"/);
  assert.doesNotMatch(
    homeScreen,
    /title="Start with what needs attention first"/,
  );
  assert.doesNotMatch(homeScreen, /title="Quick capture"/);
  assert.doesNotMatch(homeScreen, /label="Next best actions"/);
  assert.doesNotMatch(homeScreen, /label="Attention"/);
  assert.doesNotMatch(homeScreen, /label="Spaces"/);
  assert.doesNotMatch(homeScreen, /Generate a grounded dashboard brief/);

  assert.match(homeScreen, /label="Today's routine"/);
  assert.match(homeScreen, /One queue for today’s recurring work/);
  assert.match(homeScreen, /Tap done to complete now/);
  assert.match(homeScreen, /formatLastCompleted/);
});
