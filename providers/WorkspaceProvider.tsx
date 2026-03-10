import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

import { createEmptyWorkspaceSnapshot } from "@/constants/TrackItUpDefaults";
import {
    getOverviewStats,
    getQuickActionCards,
    getSpaceSummaries,
    getTimelineEntries,
} from "@/constants/TrackItUpSelectors";
import { useAppAuth } from "@/providers/AuthProvider";
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
import { getWorkspaceDatabase } from "@/services/offline/watermelon/workspaceDatabase";
import { loadLogReadModelFromWatermelon } from "@/services/offline/watermelon/workspaceQueries";
import {
    clearPersistedWorkspace,
    loadPersistedWorkspace,
    persistWorkspace,
    waitForWorkspacePersistence,
} from "@/services/offline/workspacePersistence";
import {
    enqueueWorkspaceSync,
    markWorkspaceSyncComplete,
    markWorkspaceSyncError,
    pullWorkspaceSync,
    pushWorkspaceSync,
    type SyncActionResult,
} from "@/services/offline/workspaceSync";
import {
    applyReminderTriggerRules,
    getNextReminderDate,
} from "@/services/reminders/reminderRules";
import { applyTemplateImportToWorkspace } from "@/services/templates/templateImport";
import {
    useWorkspaceStoreState,
    type PersistenceMode,
} from "@/stores/useWorkspaceStore";
import type {
    TemplateCatalogItem,
    TemplateImportMethod,
    WorkspaceSnapshot,
} from "@/types/trackitup";

type SaveLogResult = {
  entryId?: string;
  createdCount: number;
  scheduledReminderCount: number;
};

type WorkspaceContextValue = {
  workspace: WorkspaceSnapshot;
  logEntries: WorkspaceSnapshot["logs"];
  isHydrated: boolean;
  persistenceMode: PersistenceMode;
  isSyncing: boolean;
  overviewStats: ReturnType<typeof getOverviewStats>;
  quickActionCards: ReturnType<typeof getQuickActionCards>;
  spaceSummaries: ReturnType<typeof getSpaceSummaries>;
  timelineEntries: ReturnType<typeof getTimelineEntries>;
  saveLogForAction: (actionId: string, values: FormValueMap) => SaveLogResult;
  saveLogForTemplate: (
    templateId: string,
    values: FormValueMap,
  ) => SaveLogResult;
  moveDashboardWidget: (widgetId: string, direction: "up" | "down") => void;
  cycleDashboardWidgetSize: (widgetId: string) => void;
  toggleDashboardWidgetVisibility: (widgetId: string) => void;
  completeReminder: (reminderId: string) => void;
  snoozeReminder: (reminderId: string) => void;
  skipReminder: (reminderId: string, reason?: string) => void;
  importLogsFromCsv: (csv: string) => {
    importedCount: number;
    warnings: string[];
  };
  importTemplateFromUrl: (
    rawUrl: string,
    preferredMethod?: TemplateImportMethod,
  ) => {
    status: "imported" | "existing" | "invalid";
    message: string;
    templateName?: string;
  };
  saveCustomTemplate: (template: TemplateCatalogItem) => {
    status: "saved" | "invalid";
    message: string;
    templateId?: string;
  };
  resetWorkspace: () => void;
  syncWorkspaceNow: () => Promise<SyncActionResult>;
  pullWorkspaceFromCloud: () => Promise<SyncActionResult>;
  restoreWorkspaceFromCloud: () => Promise<SyncActionResult>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

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

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspaceStoreState((state) => state.workspace);
  const isHydrated = useWorkspaceStoreState((state) => state.isHydrated);
  const persistenceMode = useWorkspaceStoreState(
    (state) => state.persistenceMode,
  );
  const setWorkspace = useWorkspaceStoreState((state) => state.setWorkspace);
  const setIsHydrated = useWorkspaceStoreState((state) => state.setIsHydrated);
  const setPersistenceMode = useWorkspaceStoreState(
    (state) => state.setPersistenceMode,
  );
  const auth = useAppAuth();
  const snapshotLogEntries = workspace.logs;
  const snapshotTimelineEntries = useMemo(
    () => getTimelineEntries(workspace),
    [workspace],
  );
  const [logEntries, setLogEntries] = useState(snapshotLogEntries);
  const [timelineEntries, setTimelineEntries] = useState(
    snapshotTimelineEntries,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const syncEndpoint = process.env.EXPO_PUBLIC_TRACKITUP_SYNC_ENDPOINT;

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const loaded = await loadPersistedWorkspace(
        createEmptyWorkspaceSnapshot(),
      );
      if (!isMounted) return;

      setWorkspace(loaded.workspace);
      setPersistenceMode(loaded.persistenceMode);
      setIsHydrated(true);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    void persistWorkspace(workspace);
  }, [isHydrated, workspace]);

  useEffect(() => {
    setLogEntries(snapshotLogEntries);
    setTimelineEntries(snapshotTimelineEntries);

    if (!isHydrated || persistenceMode !== "watermelondb") return;

    let cancelled = false;

    void (async () => {
      await waitForWorkspacePersistence();
      if (cancelled) return;

      try {
        const database = await getWorkspaceDatabase();
        if (!database) return;

        const queriedLogReadModel = await loadLogReadModelFromWatermelon(
          database,
          workspace.generatedAt,
        );

        if (!cancelled) {
          setLogEntries(queriedLogReadModel.logEntries);
          setTimelineEntries(queriedLogReadModel.timelineEntries);
        }
      } catch {
        // Keep snapshot-derived entries if the Watermelon query path fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isHydrated,
    persistenceMode,
    snapshotLogEntries,
    snapshotTimelineEntries,
    workspace.generatedAt,
  ]);

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
    [],
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
    [],
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
    [],
  );

  const cycleWidgetSize = useCallback((widgetId: string) => {
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
  }, []);

  const toggleWidgetVisibility = useCallback((widgetId: string) => {
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
  }, []);

  const snoozeReminder = useCallback((reminderId: string) => {
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
  }, []);

  const completeReminder = useCallback((reminderId: string) => {
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
  }, []);

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
    [],
  );

  const importLogsFromCsv = useCallback((csv: string) => {
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
  }, []);

  const importTemplateFromUrl = useCallback(
    (rawUrl: string, preferredMethod?: TemplateImportMethod) => {
      let result: ReturnType<WorkspaceContextValue["importTemplateFromUrl"]> = {
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
    [],
  );

  const saveCustomTemplate = useCallback((template: TemplateCatalogItem) => {
    let result: ReturnType<WorkspaceContextValue["saveCustomTemplate"]> = {
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
  }, []);

  const resetWorkspace = useCallback(() => {
    setWorkspace(createEmptyWorkspaceSnapshot());
    void clearPersistedWorkspace();
  }, []);

  const getCloudSyncAccessBlock = useCallback(() => {
    if (isSyncing) {
      return {
        status: "blocked",
        message: "A sync is already running.",
      } satisfies SyncActionResult;
    }

    if (!auth.isSignedIn || !auth.userId) {
      return {
        status: "blocked",
        message: "Sign in to use cloud backup restore and sync.",
      } satisfies SyncActionResult;
    }

    if (!syncEndpoint) {
      return {
        status: "blocked",
        message:
          "Add EXPO_PUBLIC_TRACKITUP_SYNC_ENDPOINT to enable remote sync.",
      } satisfies SyncActionResult;
    }

    return null;
  }, [auth.isSignedIn, auth.userId, isSyncing, syncEndpoint]);

  const syncWorkspaceNow = useCallback(async () => {
    const accessBlock = getCloudSyncAccessBlock();
    if (accessBlock) return accessBlock;

    if (workspace.syncQueue.length === 0) {
      return {
        status: "blocked",
        message: workspace.lastSyncAt
          ? `No pending changes. Last synced ${new Date(workspace.lastSyncAt).toLocaleString()}.`
          : "No pending local changes need syncing yet.",
      } satisfies SyncActionResult;
    }

    setIsSyncing(true);
    const syncResult = await pushWorkspaceSync({
      endpoint: syncEndpoint!,
      snapshot: workspace,
      userId: auth.userId!,
      getToken: auth.getToken,
    });

    setWorkspace((currentWorkspace) =>
      syncResult.status === "success"
        ? markWorkspaceSyncComplete(currentWorkspace, new Date().toISOString())
        : markWorkspaceSyncError(currentWorkspace, syncResult.message),
    );
    setIsSyncing(false);
    return syncResult;
  }, [auth.getToken, auth.userId, getCloudSyncAccessBlock, workspace]);

  const pullWorkspaceFromCloud = useCallback(async () => {
    const accessBlock = getCloudSyncAccessBlock();
    if (accessBlock) return accessBlock;

    if (workspace.syncQueue.length > 0) {
      return {
        status: "blocked",
        message:
          "Push or clear your queued local changes before pulling a cloud snapshot, or use force restore.",
      } satisfies SyncActionResult;
    }

    setIsSyncing(true);
    const pullResult = await pullWorkspaceSync({
      endpoint: syncEndpoint!,
      fallbackSnapshot: createEmptyWorkspaceSnapshot(),
      userId: auth.userId!,
      getToken: auth.getToken,
    });

    if (pullResult.status !== "success" || !pullResult.snapshot) {
      setWorkspace((currentWorkspace) =>
        pullResult.status === "error"
          ? markWorkspaceSyncError(currentWorkspace, pullResult.message)
          : currentWorkspace,
      );
      setIsSyncing(false);
      return pullResult;
    }

    const restoredAt = new Date().toISOString();
    if (
      pullResult.snapshot.generatedAt.localeCompare(workspace.generatedAt) < 0
    ) {
      setWorkspace((currentWorkspace) => ({
        ...currentWorkspace,
        lastSyncAt: restoredAt,
        lastSyncError: undefined,
      }));
      setIsSyncing(false);
      return {
        status: "blocked",
        message:
          "The cloud snapshot is older than your local workspace. Use force restore to replace local data anyway.",
      } satisfies SyncActionResult;
    }

    setWorkspace(markWorkspaceSyncComplete(pullResult.snapshot, restoredAt));
    setIsSyncing(false);
    return {
      status: "success",
      message:
        pullResult.snapshot.generatedAt === workspace.generatedAt
          ? "Cloud backup matches the local workspace snapshot."
          : pullResult.message,
    } satisfies SyncActionResult;
  }, [
    auth.getToken,
    auth.userId,
    getCloudSyncAccessBlock,
    syncEndpoint,
    workspace.generatedAt,
    workspace.syncQueue.length,
  ]);

  const restoreWorkspaceFromCloud = useCallback(async () => {
    const accessBlock = getCloudSyncAccessBlock();
    if (accessBlock) return accessBlock;

    setIsSyncing(true);
    const pullResult = await pullWorkspaceSync({
      endpoint: syncEndpoint!,
      fallbackSnapshot: createEmptyWorkspaceSnapshot(),
      userId: auth.userId!,
      getToken: auth.getToken,
    });

    if (pullResult.status !== "success" || !pullResult.snapshot) {
      setWorkspace((currentWorkspace) =>
        pullResult.status === "error"
          ? markWorkspaceSyncError(currentWorkspace, pullResult.message)
          : currentWorkspace,
      );
      setIsSyncing(false);
      return pullResult;
    }

    const restoredAt = new Date().toISOString();
    setWorkspace(markWorkspaceSyncComplete(pullResult.snapshot, restoredAt));
    setIsSyncing(false);
    return {
      status: "success",
      message: `Force-restored the cloud snapshot from ${new Date(pullResult.snapshot.generatedAt).toLocaleString()}.`,
    } satisfies SyncActionResult;
  }, [auth.getToken, auth.userId, getCloudSyncAccessBlock, syncEndpoint]);

  const overviewStats = useMemo(() => getOverviewStats(workspace), [workspace]);
  const quickActionCards = useMemo(
    () => getQuickActionCards(workspace),
    [workspace],
  );
  const spaceSummaries = useMemo(
    () => getSpaceSummaries(workspace),
    [workspace],
  );

  const value = useMemo(
    () => ({
      workspace,
      logEntries,
      isHydrated,
      persistenceMode,
      isSyncing,
      overviewStats,
      quickActionCards,
      spaceSummaries,
      timelineEntries,
      saveLogForAction,
      moveDashboardWidget,
      saveLogForTemplate,
      cycleDashboardWidgetSize: cycleWidgetSize,
      toggleDashboardWidgetVisibility: toggleWidgetVisibility,
      completeReminder,
      snoozeReminder,
      skipReminder,
      importLogsFromCsv,
      importTemplateFromUrl,
      saveCustomTemplate,
      resetWorkspace,
      pullWorkspaceFromCloud,
      restoreWorkspaceFromCloud,
      syncWorkspaceNow,
    }),
    [
      cycleWidgetSize,
      completeReminder,
      importLogsFromCsv,
      importTemplateFromUrl,
      isHydrated,
      isSyncing,
      logEntries,
      moveDashboardWidget,
      overviewStats,
      persistenceMode,
      pullWorkspaceFromCloud,
      quickActionCards,
      resetWorkspace,
      restoreWorkspaceFromCloud,
      saveCustomTemplate,
      saveLogForAction,
      saveLogForTemplate,
      skipReminder,
      snoozeReminder,
      spaceSummaries,
      syncWorkspaceNow,
      timelineEntries,
      toggleWidgetVisibility,
      workspace,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }

  return context;
}
