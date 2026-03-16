import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("workspace database route is registered and launched from workspace tools", () => {
  const rootLayout = readWorkspaceFile("app/_layout.tsx");
  const workspaceTools = readWorkspaceFile("app/workspace-tools.tsx");

  assert.match(rootLayout, /name="workspace-database"/);
  assert.match(
    workspaceTools,
    /router\.push\("\/workspace-database" as never\)/,
  );
});

test("workspace database screen renders a virtualized spaces table", () => {
  const screen = readWorkspaceFile("app/workspace-database.tsx");

  assert.match(screen, /title="Workspace database viewer"/);
  assert.match(screen, /Entity: Spaces/);
  assert.match(screen, /<FlatList/);
  assert.match(screen, /initialNumToRender=\{8\}/);
  assert.match(screen, /maxToRenderPerBatch=\{8\}/);
  assert.match(screen, /windowSize=\{9\}/);
  assert.match(screen, /useWindowDimensions/);
  assert.match(screen, /isCompactLayout = width < 1024/);
  assert.match(
    screen,
    /Compact layout enabled for easier reading on smaller screens\./,
  );
  assert.doesNotMatch(screen, /<ScrollView[\s\S]*horizontal/);
});

test("workspace database screen uses create update and archive mutations only", () => {
  const screen = readWorkspaceFile("app/workspace-database.tsx");

  assert.match(
    screen,
    /const \{ workspace, createSpace, updateSpace, archiveSpace \} = useWorkspace\(\)/,
  );
  assert.match(screen, /mode="contained"[\s\S]*Insert row/);
  assert.match(screen, /Archive this space row\?/);
  assert.doesNotMatch(screen, /deleteSpace\(/);
  assert.doesNotMatch(screen, /hard delete/i);
});
