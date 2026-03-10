import {
  getOverviewStats,
  getQuickActionCards,
  getSpaceSummaries,
  getTimelineEntries,
} from "@/constants/TrackItUpSelectors";
import type { FormValueMap } from "@/services/forms/workspaceForm";
import type { PersistenceMode } from "@/stores/useWorkspaceStore";
import type {
  TemplateCatalogItem,
  TemplateImportMethod,
  WorkspaceSnapshot,
} from "@/types/trackitup";

import type { SyncActionResult } from "@/services/offline/workspaceSync";

export type SaveLogResult = {
  entryId?: string;
  createdCount: number;
  scheduledReminderCount: number;
};

export type TemplateImportActionResult = {
  status: "imported" | "existing" | "invalid";
  message: string;
  templateName?: string;
};

export type SaveCustomTemplateResult = {
  status: "saved" | "invalid";
  message: string;
  templateId?: string;
};

export type WorkspaceContextValue = {
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
  saveLogForTemplate: (templateId: string, values: FormValueMap) => SaveLogResult;
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
  ) => TemplateImportActionResult;
  saveCustomTemplate: (template: TemplateCatalogItem) => SaveCustomTemplateResult;
  resetWorkspace: () => void;
  syncWorkspaceNow: () => Promise<SyncActionResult>;
  pullWorkspaceFromCloud: () => Promise<SyncActionResult>;
  restoreWorkspaceFromCloud: () => Promise<SyncActionResult>;
};
