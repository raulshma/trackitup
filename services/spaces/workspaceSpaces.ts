import type {
    Space,
    SpaceCategory,
    SpaceStatus,
    WorkspaceSnapshot,
} from "@/types/trackitup";
import {
    getDefaultSpaceThemeColor,
    normalizeSpaceCategoryValue,
} from "../../constants/TrackItUpSpaceCategories.ts";

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
  const category = normalizeSpaceCategoryValue(draft.category);
  if (!name) {
    return {
      status: "invalid",
      message: "Name the space before saving it.",
      workspace,
    };
  }
  if (!category) {
    return {
      status: "invalid",
      message: "Choose or add a category before saving it.",
      workspace,
    };
  }

  const space: Space = {
    id: buildSpaceId(name, workspace),
    name,
    category,
    status: draft.status ?? "planned",
    themeColor: draft.themeColor ?? getDefaultSpaceThemeColor(category),
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
