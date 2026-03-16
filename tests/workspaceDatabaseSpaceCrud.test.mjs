import assert from "node:assert/strict";
import test from "node:test";

const { createEmptyWorkspaceSnapshot } =
  await import("../constants/TrackItUpDefaults.ts");
const { archiveWorkspaceSpace, createWorkspaceSpace, updateWorkspaceSpace } =
  await import("../services/spaces/workspaceSpaces.ts");

test("space database create and update keep archive-safe behavior", () => {
  const snapshot = createEmptyWorkspaceSnapshot("2026-03-16T10:00:00.000Z");

  const created = createWorkspaceSpace(snapshot, {
    name: "Garden Bench",
    category: "gardening",
    summary: "Seasonal planters and watering.",
    status: "planned",
  });

  assert.equal(created.status, "created");
  assert.equal(created.workspace.spaces.length, 1);

  const spaceId = created.space?.id;
  assert.ok(spaceId);

  const updated = updateWorkspaceSpace(created.workspace, spaceId, {
    name: "Garden Bench North",
    category: "gardening",
    summary: "Drip line and fertilizer cycle.",
    status: "watch",
  });

  assert.equal(updated.status, "updated");
  assert.equal(updated.space?.name, "Garden Bench North");
  assert.equal(updated.space?.status, "watch");
});

test("space database archive performs soft archive instead of deletion", () => {
  const snapshot = createEmptyWorkspaceSnapshot("2026-03-16T10:00:00.000Z");

  const created = createWorkspaceSpace(snapshot, {
    name: "Reef Quarantine",
    category: "aquarium",
    status: "planned",
  });

  const archived = archiveWorkspaceSpace(
    created.workspace,
    created.space?.id ?? "",
  );

  assert.equal(archived.status, "archived");
  assert.equal(archived.workspace.spaces.length, 1);
  assert.equal(archived.workspace.spaces[0]?.status, "archived");
});
