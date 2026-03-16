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

export type UpdateSpaceDraft = {
  name?: string;
  category?: SpaceCategory;
  summary?: string;
  status?: SpaceStatus;
  themeColor?: string;
  parentSpaceId?: string;
  templateName?: string;
};

export type UpdateWorkspaceSpaceResult = {
  status: "updated" | "invalid" | "not-found";
  message: string;
  space?: Space;
  workspace: WorkspaceSnapshot;
};

export type ArchiveWorkspaceSpaceResult = {
  status: "archived" | "invalid" | "not-found";
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

export function updateWorkspaceSpace(
  workspace: WorkspaceSnapshot,
  spaceId: string,
  draft: UpdateSpaceDraft,
  updatedAt = new Date().toISOString(),
): UpdateWorkspaceSpaceResult {
  const currentSpace = workspace.spaces.find((space) => space.id === spaceId);
  if (!currentSpace) {
    return {
      status: "not-found",
      message: "We could not find that space in this workspace.",
      workspace,
    };
  }

  const nextName =
    draft.name === undefined ? currentSpace.name : draft.name.trim();
  if (!nextName) {
    return {
      status: "invalid",
      message: "Name the space before saving it.",
      workspace,
    };
  }

  const nextCategory =
    draft.category === undefined
      ? currentSpace.category
      : normalizeSpaceCategoryValue(draft.category);
  if (!nextCategory) {
    return {
      status: "invalid",
      message: "Choose or add a category before saving it.",
      workspace,
    };
  }

  const nextThemeColor = draft.themeColor?.trim() || currentSpace.themeColor;
  const nextSummary =
    draft.summary === undefined
      ? currentSpace.summary
      : draft.summary.trim() || buildDefaultSummary(nextName);

  const nextSpace: Space = {
    ...currentSpace,
    name: nextName,
    category: nextCategory,
    summary: nextSummary,
    status: draft.status ?? currentSpace.status,
    themeColor: nextThemeColor,
    parentSpaceId:
      draft.parentSpaceId === undefined
        ? currentSpace.parentSpaceId
        : draft.parentSpaceId,
    templateName:
      draft.templateName === undefined
        ? currentSpace.templateName
        : draft.templateName,
  };

  return {
    status: "updated",
    message: `Saved changes to ${nextSpace.name}.`,
    space: nextSpace,
    workspace: {
      ...workspace,
      generatedAt: updatedAt,
      spaces: workspace.spaces.map((space) =>
        space.id === spaceId ? nextSpace : space,
      ),
    },
  };
}

export function archiveWorkspaceSpace(
  workspace: WorkspaceSnapshot,
  spaceId: string,
  archivedAt = new Date().toISOString(),
): ArchiveWorkspaceSpaceResult {
  const currentSpace = workspace.spaces.find((space) => space.id === spaceId);
  if (!currentSpace) {
    return {
      status: "not-found",
      message: "We could not find that space in this workspace.",
      workspace,
    };
  }

  if (currentSpace.status === "archived") {
    return {
      status: "invalid",
      message: `${currentSpace.name} is already archived.`,
      workspace,
    };
  }

  const nextSpace: Space = {
    ...currentSpace,
    status: "archived",
  };

  return {
    status: "archived",
    message: `${currentSpace.name} was archived.`,
    space: nextSpace,
    workspace: {
      ...workspace,
      generatedAt: archivedAt,
      spaces: workspace.spaces.map((space) =>
        space.id === spaceId ? nextSpace : space,
      ),
    },
  };
}
