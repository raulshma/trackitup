import { useCallback } from "react";

import { createEmptyWorkspaceSnapshot } from "@/constants/TrackItUpDefaults";
import {
    cycleDashboardWidgetSize,
    moveDashboardWidgets,
    toggleDashboardWidgetVisibility,
} from "@/services/dashboard/dashboardWidgets";
import {
    buildLogEntriesFromActionDraft,
    type FormValueMap,
} from "@/services/forms/workspaceForm";
import { parseWorkspaceLogCsv } from "@/services/import/workspaceCsvImport";
import { clearPersistedWorkspace } from "@/services/offline/workspacePersistence";
import { enqueueWorkspaceSync } from "@/services/offline/workspaceSync";
import {
    applyReminderTriggerRules,
    getNextReminderDate,
} from "@/services/reminders/reminderRules";
import {
    createWorkspaceSpace,
    type CreateSpaceDraft,
} from "@/services/spaces/workspaceSpaces";
import { applyTemplateImportToWorkspace } from "@/services/templates/templateImport";
import type { WorkspaceUpdater } from "@/stores/useWorkspaceStore";
import type {
    TemplateCatalogItem,
    TemplateImportMethod,
    WorkspaceSnapshot,
} from "@/types/trackitup";

import type {
    CreateSpaceResult,
    SaveCustomTemplateResult,
    SaveLogResult,
    TemplateImportActionResult,
} from "./types";

type WorkspaceSetter = (updater: WorkspaceUpdater) => void;

function buildReminderActivityLog(
  reminder: WorkspaceSnapshot["reminders"][number],
  title: string,
  note: string,
  occurredAt: string,
) {
  return {
    id: `log-${reminder.id}-${Date.now()}`,
    spaceId: reminder.spaceId,
    kind: "reminder" as const,
    title,
    note,
    occurredAt,
    reminderId: reminder.id,
    tags: ["planner", reminder.status],
  };
}

function appendReminderHistory(
  reminder: WorkspaceSnapshot["reminders"][number],
  action: "completed" | "snoozed" | "skipped",
  note: string,
  at: string,
) {
  return [
    {
      id: `${reminder.id}-${action}-${Date.now()}`,
      action,
      at,
      note,
    },
    ...(reminder.history ?? []),
  ];
}

function countTriggeredReminderSchedules(
  currentReminders: WorkspaceSnapshot["reminders"],
  nextReminders: WorkspaceSnapshot["reminders"],
) {
  return nextReminders.reduce((count, reminder, index) => {
    const previousReminder = currentReminders[index];
    if (!previousReminder) return count;

    const wasScheduled =
      reminder.dueAt !== previousReminder.dueAt ||
      reminder.status !== previousReminder.status ||
      reminder.snoozedUntil !== previousReminder.snoozedUntil;

    return wasScheduled ? count + 1 : count;
  }, 0);
}

function applyLogsAndTriggeredReminders(
  currentWorkspace: WorkspaceSnapshot,
  newLogs: WorkspaceSnapshot["logs"],
) {
  const newestTimestamp = newLogs.reduce(
    (latest, log) =>
      log.occurredAt.localeCompare(latest) > 0 ? log.occurredAt : latest,
    currentWorkspace.generatedAt,
  );
  const nextReminders = applyReminderTriggerRules(
    currentWorkspace.reminders,
    newLogs,
    newestTimestamp,
  );
  const triggeredReminderCount = countTriggeredReminderSchedules(
    currentWorkspace.reminders,
    nextReminders,
  );
  const reminderLogs = nextReminders.flatMap((reminder, index) => {
    const previousReminder = currentWorkspace.reminders[index];
    if (!previousReminder || reminder === previousReminder) return [];

    const note =
      reminder.history?.[0]?.note ?? "Scheduled from a linked log event.";
    return [
      buildReminderActivityLog(
        reminder,
        `${reminder.title} scheduled from activity`,
        note,
        newestTimestamp,
      ),
    ];
  });

  return {
    workspace: {
      ...currentWorkspace,
      generatedAt: newestTimestamp,
      reminders: nextReminders,
      logs: [...newLogs, ...reminderLogs, ...currentWorkspace.logs],
    },
    triggeredReminderCount,
  };
}

export function useWorkspaceMutations(
  setWorkspace: WorkspaceSetter,
  ownerScopeKey: string,
) {
  const saveLogForAction = useCallback(
    (actionId: string, values: FormValueMap) => {
      let result: SaveLogResult = {
        createdCount: 0,
        scheduledReminderCount: 0,
      };

      setWorkspace((currentWorkspace) => {
        const action = currentWorkspace.quickActions.find(
          (item) => item.id === actionId,
        );
        if (!action) return currentWorkspace;

        const nextLogs = buildLogEntriesFromActionDraft(
          currentWorkspace,
          action,
          values,
        );
        if (nextLogs.length === 0) return currentWorkspace;

        const nextState = applyLogsAndTriggeredReminders(
          currentWorkspace,
          nextLogs,
        );
        result = {
          entryId: nextLogs[0]?.id,
          createdCount: nextLogs.length,
          scheduledReminderCount: nextState.triggeredReminderCount,
        };

        return enqueueWorkspaceSync(nextState.workspace, {
          kind: "log-created",
          summary:
            nextLogs.length > 1
              ? `Saved ${action.label} with ${nextLogs.length} generated logs`
              : `Saved ${action.label}`,
        });
      });

      return result;
    },
    [setWorkspace],
  );

  const saveLogForTemplate = useCallback(
    (templateId: string, values: FormValueMap) => {
      let result: SaveLogResult = {
        createdCount: 0,
        scheduledReminderCount: 0,
      };

      setWorkspace((currentWorkspace) => {
        const template = currentWorkspace.templates.find(
          (item) => item.id === templateId,
        );
        if (!template?.formTemplate?.quickActionKind) {
          return currentWorkspace;
        }

        const templateAction = {
          id: template.id,
          label: template.name,
          kind: template.formTemplate.quickActionKind,
        } as const;
        const nextLogs = buildLogEntriesFromActionDraft(
          currentWorkspace,
          templateAction,
          values,
          template.formTemplate,
        );
        if (nextLogs.length === 0) return currentWorkspace;

        const nextState = applyLogsAndTriggeredReminders(
          currentWorkspace,
          nextLogs,
        );
        result = {
          entryId: nextLogs[0]?.id,
          createdCount: nextLogs.length,
          scheduledReminderCount: nextState.triggeredReminderCount,
        };

        return enqueueWorkspaceSync(nextState.workspace, {
          kind: "log-created",
          summary: `Saved ${template.name}`,
        });
      });

      return result;
    },
    [setWorkspace],
  );

  const moveDashboardWidget = useCallback(
    (widgetId: string, direction: "up" | "down") => {
      setWorkspace((currentWorkspace) => {
        const nextWidgets = moveDashboardWidgets(
          currentWorkspace.dashboardWidgets,
          widgetId,
          direction,
        );
        if (nextWidgets === currentWorkspace.dashboardWidgets) {
          return currentWorkspace;
        }

        return enqueueWorkspaceSync(
          { ...currentWorkspace, dashboardWidgets: nextWidgets },
          {
            kind: "dashboard-reordered",
            summary: `Moved widget ${widgetId} ${direction}`,
          },
        );
      });
    },
    [setWorkspace],
  );

  const cycleWidgetSize = useCallback(
    (widgetId: string) => {
      setWorkspace((currentWorkspace) => {
        const nextWidgets = cycleDashboardWidgetSize(
          currentWorkspace.dashboardWidgets,
          widgetId,
        );
        if (nextWidgets === currentWorkspace.dashboardWidgets) {
          return currentWorkspace;
        }

        return enqueueWorkspaceSync(
          { ...currentWorkspace, dashboardWidgets: nextWidgets },
          {
            kind: "dashboard-customized",
            summary: `Resized widget ${widgetId}`,
          },
        );
      });
    },
    [setWorkspace],
  );

  const toggleWidgetVisibility = useCallback(
    (widgetId: string) => {
      setWorkspace((currentWorkspace) => {
        const nextWidgets = toggleDashboardWidgetVisibility(
          currentWorkspace.dashboardWidgets,
          widgetId,
        );
        if (nextWidgets === currentWorkspace.dashboardWidgets) {
          return currentWorkspace;
        }

        return enqueueWorkspaceSync(
          { ...currentWorkspace, dashboardWidgets: nextWidgets },
          {
            kind: "dashboard-customized",
            summary: `Toggled widget ${widgetId}`,
          },
        );
      });
    },
    [setWorkspace],
  );

  const snoozeReminder = useCallback(
    (reminderId: string) => {
      const actionAt = new Date().toISOString();

      setWorkspace((currentWorkspace) => {
        const reminder = currentWorkspace.reminders.find(
          (item) => item.id === reminderId,
        );
        if (!reminder) return currentWorkspace;

        const snoozedUntil = new Date(actionAt);
        snoozedUntil.setHours(snoozedUntil.getHours() + 16);
        const note = `Snoozed until ${snoozedUntil.toLocaleString()}.`;

        return enqueueWorkspaceSync(
          {
            ...currentWorkspace,
            generatedAt: actionAt,
            reminders: currentWorkspace.reminders.map((item) =>
              item.id === reminderId
                ? {
                    ...item,
                    status: "snoozed",
                    snoozedUntil: snoozedUntil.toISOString(),
                    history: appendReminderHistory(
                      item,
                      "snoozed",
                      note,
                      actionAt,
                    ),
                  }
                : item,
            ),
            logs: [
              buildReminderActivityLog(
                reminder,
                `${reminder.title} snoozed`,
                note,
                actionAt,
              ),
              ...currentWorkspace.logs,
            ],
          },
          {
            kind: "reminder-updated",
            summary: `${reminder.title} snoozed`,
          },
        );
      });
    },
    [setWorkspace],
  );

  const completeReminder = useCallback(
    (reminderId: string) => {
      const actionAt = new Date().toISOString();

      setWorkspace((currentWorkspace) => {
        const reminder = currentWorkspace.reminders.find(
          (item) => item.id === reminderId,
        );
        if (!reminder) return currentWorkspace;

        const nextDueAt = reminder.recurrence
          ? getNextReminderDate(reminder)
          : undefined;
        const note = nextDueAt
          ? `Completed and rolled forward to ${new Date(nextDueAt).toLocaleString()}.`
          : "Completed and archived in reminder history.";

        return enqueueWorkspaceSync(
          {
            ...currentWorkspace,
            generatedAt: actionAt,
            reminders: currentWorkspace.reminders.map((item) =>
              item.id === reminderId
                ? {
                    ...item,
                    status: nextDueAt ? "scheduled" : "completed",
                    dueAt: nextDueAt ?? item.dueAt,
                    snoozedUntil: undefined,
                    history: appendReminderHistory(
                      item,
                      "completed",
                      note,
                      actionAt,
                    ),
                  }
                : item,
            ),
            logs: [
              buildReminderActivityLog(
                reminder,
                `${reminder.title} completed`,
                note,
                actionAt,
              ),
              ...currentWorkspace.logs,
            ],
          },
          {
            kind: "reminder-updated",
            summary: `${reminder.title} completed`,
          },
        );
      });
    },
    [setWorkspace],
  );

  const skipReminder = useCallback(
    (reminderId: string, reason = "Skipped from planner board") => {
      const actionAt = new Date().toISOString();

      setWorkspace((currentWorkspace) => {
        const reminder = currentWorkspace.reminders.find(
          (item) => item.id === reminderId,
        );
        if (!reminder) return currentWorkspace;

        const nextDueAt = reminder.recurrence
          ? getNextReminderDate(reminder)
          : undefined;
        const note = nextDueAt
          ? `${reason} Next occurrence scheduled for ${new Date(nextDueAt).toLocaleString()}.`
          : reason;

        return enqueueWorkspaceSync(
          {
            ...currentWorkspace,
            generatedAt: actionAt,
            reminders: currentWorkspace.reminders.map((item) =>
              item.id === reminderId
                ? {
                    ...item,
                    status: nextDueAt ? "scheduled" : "skipped",
                    dueAt: nextDueAt ?? item.dueAt,
                    skipReason: reason,
                    snoozedUntil: undefined,
                    history: appendReminderHistory(
                      item,
                      "skipped",
                      note,
                      actionAt,
                    ),
                  }
                : item,
            ),
            logs: [
              buildReminderActivityLog(
                reminder,
                `${reminder.title} skipped`,
                note,
                actionAt,
              ),
              ...currentWorkspace.logs,
            ],
          },
          {
            kind: "reminder-updated",
            summary: `${reminder.title} skipped`,
          },
        );
      });
    },
    [setWorkspace],
  );

  const importLogsFromCsv = useCallback(
    (csv: string) => {
      let result = { importedCount: 0, warnings: [] as string[] };

      setWorkspace((currentWorkspace) => {
        const parsed = parseWorkspaceLogCsv(csv, currentWorkspace);
        result = {
          importedCount: parsed.logs.length,
          warnings: parsed.warnings,
        };

        if (parsed.logs.length === 0) {
          return currentWorkspace;
        }

        const importedLogs = [...parsed.logs].sort((left, right) =>
          right.occurredAt.localeCompare(left.occurredAt),
        );
        const nextState = applyLogsAndTriggeredReminders(
          currentWorkspace,
          importedLogs,
        );

        return enqueueWorkspaceSync(nextState.workspace, {
          kind: "logs-imported",
          summary: `Imported ${parsed.logs.length} log(s) from CSV`,
        });
      });

      return result;
    },
    [setWorkspace],
  );

  const importTemplateFromUrl = useCallback(
    (rawUrl: string, preferredMethod?: TemplateImportMethod) => {
      let result: TemplateImportActionResult = {
        status: "invalid",
        message: "No template import data was provided.",
      };

      setWorkspace((currentWorkspace) => {
        const importResult = applyTemplateImportToWorkspace(
          currentWorkspace,
          rawUrl,
          preferredMethod,
        );

        result = {
          status: importResult.status,
          message: importResult.message,
          templateName: importResult.template?.name,
        };

        if (importResult.status !== "imported") {
          return currentWorkspace;
        }

        return enqueueWorkspaceSync(importResult.workspace, {
          kind: "template-imported",
          summary: `Imported template ${importResult.template?.name ?? "catalog item"}`,
        });
      });

      return result;
    },
    [setWorkspace],
  );

  const saveCustomTemplate = useCallback(
    (template: TemplateCatalogItem) => {
      let result: SaveCustomTemplateResult = {
        status: "invalid",
        message: "Template data is incomplete.",
      };

      setWorkspace((currentWorkspace) => {
        if (!template.formTemplate?.quickActionKind) {
          return currentWorkspace;
        }

        const nextTemplate = currentWorkspace.templates.some(
          (item) => item.id === template.id,
        )
          ? { ...template, id: `${template.id}-${Date.now()}` }
          : template;
        result = {
          status: "saved",
          message: `Saved ${nextTemplate.name} to the local template catalog.`,
          templateId: nextTemplate.id,
        };

        return enqueueWorkspaceSync(
          {
            ...currentWorkspace,
            generatedAt:
              (
                nextTemplate.createdAt ?? currentWorkspace.generatedAt
              ).localeCompare(currentWorkspace.generatedAt) > 0
                ? (nextTemplate.createdAt ?? currentWorkspace.generatedAt)
                : currentWorkspace.generatedAt,
            templates: [nextTemplate, ...currentWorkspace.templates],
          },
          {
            kind: "template-saved",
            summary: `Saved template ${nextTemplate.name}`,
          },
        );
      });

      return result;
    },
    [setWorkspace],
  );

  const createSpace = useCallback(
    (draft: CreateSpaceDraft) => {
      let result: CreateSpaceResult = {
        status: "invalid",
        message: "Name the space before saving it.",
      };

      setWorkspace((currentWorkspace) => {
        const nextState = createWorkspaceSpace(currentWorkspace, draft);
        result = {
          status: nextState.status,
          message: nextState.message,
          spaceId: nextState.space?.id,
        };

        if (nextState.status !== "created" || !nextState.space) {
          return currentWorkspace;
        }

        return enqueueWorkspaceSync(nextState.workspace, {
          kind: "space-created",
          summary: `Created space ${nextState.space.name}`,
        });
      });

      return result;
    },
    [setWorkspace],
  );

  const resetWorkspace = useCallback(() => {
    setWorkspace(createEmptyWorkspaceSnapshot());
    void clearPersistedWorkspace(ownerScopeKey);
  }, [ownerScopeKey, setWorkspace]);

  const recoverBlockedWorkspace = useCallback(async () => {
    await clearPersistedWorkspace(ownerScopeKey);
    setWorkspace(createEmptyWorkspaceSnapshot());
    return {
      status: "success" as const,
      message:
        "Cleared the blocked protected workspace for this device scope and started a fresh local workspace.",
    };
  }, [ownerScopeKey, setWorkspace]);

  return {
    saveLogForAction,
    saveLogForTemplate,
    moveDashboardWidget,
    cycleWidgetSize,
    toggleWidgetVisibility,
    completeReminder,
    snoozeReminder,
    skipReminder,
    importLogsFromCsv,
    importTemplateFromUrl,
    saveCustomTemplate,
    createSpace,
    resetWorkspace,
    recoverBlockedWorkspace,
  };
}
