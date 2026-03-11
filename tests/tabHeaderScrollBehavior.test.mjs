import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("tab header uses clamped scroll deltas so upward scroll reveals it before returning to top", () => {
  const appBarSource = readWorkspaceFile("components/ui/MaterialCompactTopAppBar.tsx");

  assert.match(
    appBarSource,
    /Animated\.diffClamp\(scrollY, 0, HEADER_COLLAPSE_DISTANCE\)/,
  );
  assert.match(appBarSource, /opacity: clampedScrollY\.interpolate\(/);
  assert.match(appBarSource, /translateY: clampedScrollY\.interpolate\(/);
});