import type { LogEntry, WorkspaceSnapshot } from "@/types/trackitup";

export type UpdateWorkspaceLogDraft = {
  title?: string;
  note?: string;
  occurredAt?: string;
  tags?: string[];
  cost?: number;
  locationLabel?: string;
};

export type UpdateWorkspaceLogResult = {
  status: "updated" | "invalid" | "not-found";
  message: string;
  log?: LogEntry;
  workspace: WorkspaceSnapshot;
};

export type ArchiveWorkspaceLogResult = {
  status: "archived" | "invalid" | "not-found";
  message: string;
  log?: LogEntry;
  workspace: WorkspaceSnapshot;
};

function normalizeTags(tags: string[] | undefined) {
  if (!tags) return undefined;

  const nextTags = tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);

  return nextTags.length > 0 ? Array.from(new Set(nextTags)) : [];
}

function isValidTimestamp(value: string | undefined) {
  if (!value) return true;
  return !Number.isNaN(Date.parse(value));
}

export function updateWorkspaceLog(
  workspace: WorkspaceSnapshot,
  logId: string,
  draft: UpdateWorkspaceLogDraft,
  updatedAt = new Date().toISOString(),
): UpdateWorkspaceLogResult {
  const currentLog = workspace.logs.find((log) => log.id === logId);
  if (!currentLog) {
    return {
      status: "not-found",
      message: "We could not find that log entry in this workspace.",
      workspace,
    };
  }

  if (currentLog.archivedAt) {
    return {
      status: "invalid",
      message: "Archived log entries cannot be edited.",
      workspace,
    };
  }

  const nextTitle =
    draft.title === undefined ? currentLog.title : draft.title.trim();
  if (!nextTitle) {
    return {
      status: "invalid",
      message: "Add a title before saving log changes.",
      workspace,
    };
  }

  const nextNote =
    draft.note === undefined ? currentLog.note : draft.note.trim();
  if (!nextNote) {
    return {
      status: "invalid",
      message: "Add a note before saving log changes.",
      workspace,
    };
  }

  if (!isValidTimestamp(draft.occurredAt)) {
    return {
      status: "invalid",
      message: "Use a valid date and time before saving log changes.",
      workspace,
    };
  }

  const nextLog: LogEntry = {
    ...currentLog,
    title: nextTitle,
    note: nextNote,
    occurredAt: draft.occurredAt ?? currentLog.occurredAt,
    ...(draft.tags !== undefined ? { tags: normalizeTags(draft.tags) } : {}),
    ...(draft.cost !== undefined ? { cost: draft.cost } : {}),
    ...(draft.locationLabel !== undefined
      ? { locationLabel: draft.locationLabel.trim() || undefined }
      : {}),
  };

  return {
    status: "updated",
    message: "Saved changes to this log entry.",
    log: nextLog,
    workspace: {
      ...workspace,
      generatedAt: updatedAt,
      logs: workspace.logs.map((log) => (log.id === logId ? nextLog : log)),
    },
  };
}

export function archiveWorkspaceLog(
  workspace: WorkspaceSnapshot,
  logId: string,
  archivedAt = new Date().toISOString(),
): ArchiveWorkspaceLogResult {
  const currentLog = workspace.logs.find((log) => log.id === logId);
  if (!currentLog) {
    return {
      status: "not-found",
      message: "We could not find that log entry in this workspace.",
      workspace,
    };
  }

  if (currentLog.archivedAt) {
    return {
      status: "invalid",
      message: "This log entry is already archived.",
      workspace,
    };
  }

  const nextLog: LogEntry = {
    ...currentLog,
    archivedAt,
  };

  return {
    status: "archived",
    message: "Log entry archived.",
    log: nextLog,
    workspace: {
      ...workspace,
      generatedAt: archivedAt,
      logs: workspace.logs.map((log) => (log.id === logId ? nextLog : log)),
    },
  };
}
