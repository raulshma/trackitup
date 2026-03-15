import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("workspace tools route uses a dedicated non-modal path", () => {
  const rootLayout = readWorkspaceFile("app/_layout.tsx");
  const tabsLayout = readWorkspaceFile("app/(tabs)/_layout.tsx");
  const templateImport = readWorkspaceFile("app/template-import.tsx");
  const modalRoute = readWorkspaceFile("app/modal.tsx");

  assert.match(rootLayout, /name="workspace-tools"/);
  assert.doesNotMatch(rootLayout, /name="modal"[\s\S]*presentation:\s*"modal"/);
  assert.match(tabsLayout, /router\.push\("\/workspace-tools"\)/);
  assert.match(
    templateImport,
    /router\.replace\("\/workspace-tools" as never\)/,
  );
  assert.match(modalRoute, /<Redirect href="\/workspace-tools" \/>/);
});

test("home route keeps the floating action button available", () => {
  const fabSource = readWorkspaceFile("components/ui/RecordEventFab.tsx");

  assert.match(fabSource, /visibleFabPathnames = new Set\(\["\/"/);
  assert.doesNotMatch(
    fabSource,
    /if \(pathname === "\/" && workspace\.spaces\.length === 0\) \{[\s\S]*?return null;[\s\S]*?\}/,
  );
  assert.match(fabSource, /pathname: "\/space-create"/);
});

test("openrouter model picker uses a dedicated router modal and virtualized list", () => {
  const rootLayout = readWorkspaceFile("app/_layout.tsx");
  const accountScreen = readWorkspaceFile("app/account.tsx");
  const modelPicker = readWorkspaceFile("app/openrouter-model-picker.tsx");

  assert.match(
    rootLayout,
    /name="openrouter-model-picker"[\s\S]*presentation:\s*"modal"/,
  );
  assert.match(accountScreen, /router\.push\("\/openrouter-model-picker"\)/);
  assert.match(modelPicker, /<FlatList/);
  assert.doesNotMatch(modelPicker, /<Dialog/);
});

test("live dictation route uses dedicated modal and FAB menu launcher", () => {
  const rootLayout = readWorkspaceFile("app/_layout.tsx");
  const liveDictationRoute = readWorkspaceFile("app/live-dictation-action.tsx");
  const fabSource = readWorkspaceFile("components/ui/RecordEventFab.tsx");

  assert.match(
    rootLayout,
    /name="live-dictation-action"[\s\S]*presentation:\s*"modal"/,
  );
  assert.match(fabSource, /actions\.map\(\(action\) =>/);
  assert.match(fabSource, /setIsOpen\(\(current\) => !current\)/);
  assert.match(fabSource, /router\.push\("\/live-dictation-action"\)/);
  assert.match(
    fabSource,
    /label:\s*"Set up voice control"[\s\S]*onPress:\s*handleLiveDictation/,
  );
  assert.match(fabSource, /label:\s*"Create space"/);
  assert.match(liveDictationRoute, /Send \+ generate plan/);
  assert.match(liveDictationRoute, /dictatedRequest/);
  assert.match(liveDictationRoute, /<ScrollView/);
  assert.match(
    liveDictationRoute,
    /contentContainerStyle=\{styles\.screenContent\}/,
  );
  assert.match(liveDictationRoute, /Stop listening/);
});
