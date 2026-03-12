import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("action center uses grouped page sections", () => {
  const source = readWorkspaceFile("app/action-center.tsx");

  assert.match(source, /FeatureSectionSwitcher/);
  assert.match(source, /activeSection === "queue"/);
  assert.match(source, /activeSection === "assist"/);
  assert.match(source, /activeSection === "review"/);
  assert.match(source, /Animated\.timing\(sectionTransition/);
});

test("workspace tools uses grouped page sections", () => {
  const source = readWorkspaceFile("app/workspace-tools.tsx");

  assert.match(source, /FeatureSectionSwitcher/);
  assert.match(source, /activeSection === "backups"/);
  assert.match(source, /activeSection === "data"/);
  assert.match(source, /activeSection === "device"/);
  assert.match(source, /activeSection === "settings"/);
});

test("account uses grouped page sections", () => {
  const source = readWorkspaceFile("app/account.tsx");

  assert.match(source, /FeatureSectionSwitcher/);
  assert.match(source, /activeSection === "profile"/);
  assert.match(source, /activeSection === "appearance"/);
  assert.match(source, /activeSection === "assistant"/);
  assert.match(source, /activeSection === "privacy"/);
});

test("planner uses grouped page sections", () => {
  const source = readWorkspaceFile("app/(tabs)/planner.tsx");

  assert.match(source, /FeatureSectionSwitcher/);
  assert.match(source, /activeSection === "focus"/);
  assert.match(source, /activeSection === "calendar"/);
  assert.match(source, /activeSection === "schedule"/);
});

test("inventory uses grouped page sections", () => {
  const source = readWorkspaceFile("app/(tabs)/inventory.tsx");

  assert.match(source, /FeatureSectionSwitcher/);
  assert.match(source, /activeSection === "overview"/);
  assert.match(source, /activeSection === "assist"/);
  assert.match(source, /activeSection === "assets"/);
});
