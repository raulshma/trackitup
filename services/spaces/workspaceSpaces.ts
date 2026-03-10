import type {
  Space,
  SpaceCategory,
  SpaceStatus,
  WorkspaceSnapshot,
} from "@/types/trackitup";

export type CreateSpaceDraft = {
  name: string;
  category: SpaceCategory;
  summary?: string;
  status?: SpaceStatus;
  themeColor?: string;
  parentSpaceId?: string;
  templateName?: string;
};

export type CreateWorkspaceSpaceResult = {
  status: "created" | "invalid";
  message: string;
  space?: Space;
  workspace: WorkspaceSnapshot;
};

const defaultSpaceColors: Record<SpaceCategory, string> = {
  aquarium: "#0f766e",
  gardening: "#65a30d",
  "vehicle-maintenance": "#2563eb",
};

function buildSpaceId(name: string, workspace: WorkspaceSnapshot) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const baseId = normalized || `space-${workspace.spaces.length + 1}`;

  let nextId = baseId;
  let suffix = 2;
  while (workspace.spaces.some((space) => space.id === nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return nextId;
}

function buildDefaultSummary(name: string) {
  return `Track activity, maintenance, and notes for ${name}.`;
}

export function createWorkspaceSpace(
  workspace: WorkspaceSnapshot,
  draft: CreateSpaceDraft,
  createdAt = new Date().toISOString(),
): CreateWorkspaceSpaceResult {
  const name = draft.name.trim();
  if (!name) {
    return {
      status: "invalid",
      message: "Name the space before saving it.",
      workspace,
    };
  }

  const space: Space = {
    id: buildSpaceId(name, workspace),
    name,
    category: draft.category,
    status: draft.status ?? "planned",
    themeColor: draft.themeColor ?? defaultSpaceColors[draft.category],
    summary: draft.summary?.trim() || buildDefaultSummary(name),
    createdAt,
    parentSpaceId: draft.parentSpaceId,
    templateName: draft.templateName,
  };

  return {
    status: "created",
    message: `Created ${space.name}. You can start recording in it now.`,
    space,
    workspace: {
      ...workspace,
      generatedAt: createdAt,
      spaces: [space, ...workspace.spaces],
    },
  };
}