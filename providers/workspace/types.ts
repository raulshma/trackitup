import {
  getOverviewStats,
  getQuickActionCards,
  getSpaceSummaries,
  getTimelineEntries,
} from "@/constants/TrackItUpSelectors";
import type { FormValueMap } from "@/services/forms/workspaceForm";
import type { UpdateWorkspaceLogDraft } from "@/services/logs/workspaceLogs";
import type { WorkspaceBiometricAvailability } from "@/services/offline/workspaceBiometric";
import type { WorkspaceBiometricReauthTimeout } from "@/services/offline/workspaceBiometricSessionPolicy";
import type { BlockedEncryptedWorkspaceReason } from "@/services/offline/workspaceEncryptedPersistence";
import type { WorkspaceLocalProtectionStatus } from "@/services/offline/workspaceLocalProtection";
import type { WorkspacePrivacyMode } from "@/services/offline/workspacePrivacyMode";
import type {
  CreateWorkspaceRestorePointResult,
  DeleteWorkspaceRestorePointResult,
  ExportWorkspaceRestorePointResult,
  RestoreWorkspaceFromRestorePointResult,
  WorkspaceRestorePointReason,
  WorkspaceRestorePointSummary,
} from "@/services/offline/workspaceRestorePoints";
import type { RecurringPromptMatchSuggestion } from "@/services/recurring/recurringPlans";
import type { ReminderNotificationPermissionStatus } from "@/services/reminders/reminderNotifications";
import type {
  CreateSpaceDraft,
  UpdateSpaceDraft,
} from "@/services/spaces/workspaceSpaces";
import type { PersistenceMode } from "@/stores/useWorkspaceStore";
import type {
  RecurringPlan,
  TemplateCatalogItem,
  TemplateImportMethod,
  WorkspaceRecommendation,
  WorkspaceSnapshot,
} from "@/types/trackitup";

import type { SyncActionResult } from "@/services/offline/workspaceSync";

export type SaveLogResult = {
  entryId?: string;
  createdCount: number;
  scheduledReminderCount: number;
  recurringPromptMatchCount: number;
  recurringAutoLinkedCount: number;
  recurringPromptMatches?: RecurringPromptMatchSuggestion[];
};

export type UpdateLogResult = {
  status: "updated" | "invalid" | "not-found";
  message: string;
  logId?: string;
};

export type ArchiveLogResult = {
  status: "archived" | "invalid" | "not-found";
  message: string;
  logId?: string;
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

export type CreateSpaceResult = {
  status: "created" | "invalid";
  message: string;
  spaceId?: string;
};

export type UpdateSpaceResult = {
  status: "updated" | "invalid" | "not-found";
  message: string;
  spaceId?: string;
};

export type ArchiveSpaceResult = {
  status: "archived" | "invalid" | "not-found";
  message: string;
  spaceId?: string;
};

export type WorkspaceContextValue = {
  workspace: WorkspaceSnapshot;
  logEntries: WorkspaceSnapshot["logs"];
  isHydrated: boolean;
  persistenceMode: PersistenceMode;
  privacyMode: WorkspacePrivacyMode;
  biometricLockEnabled: boolean;
  biometricAvailability: WorkspaceBiometricAvailability;
  biometricReauthTimeout: WorkspaceBiometricReauthTimeout;
  reminderNotificationPermissionStatus: ReminderNotificationPermissionStatus;
  canAskForReminderNotifications: boolean;
  isWorkspaceLocked: boolean;
  localProtectionStatus: WorkspaceLocalProtectionStatus;
  blockedProtectionReason: BlockedEncryptedWorkspaceReason | null;
  isSyncing: boolean;
  restorePoints: WorkspaceRestorePointSummary[];
  overviewStats: ReturnType<typeof getOverviewStats>;
  recommendations: WorkspaceRecommendation[];
  quickActionCards: ReturnType<typeof getQuickActionCards>;
  spaceSummaries: ReturnType<typeof getSpaceSummaries>;
  timelineEntries: ReturnType<typeof getTimelineEntries>;
  saveLogForAction: (actionId: string, values: FormValueMap) => SaveLogResult;
  saveLogForTemplate: (
    templateId: string,
    values: FormValueMap,
  ) => SaveLogResult;
  updateLog: (logId: string, draft: UpdateWorkspaceLogDraft) => UpdateLogResult;
  archiveLog: (logId: string) => ArchiveLogResult;
  moveDashboardWidget: (widgetId: string, direction: "up" | "down") => void;
  cycleDashboardWidgetSize: (widgetId: string) => void;
  toggleDashboardWidgetVisibility: (widgetId: string) => void;
  completeReminder: (reminderId: string) => void;
  snoozeReminder: (reminderId: string) => void;
  skipReminder: (reminderId: string, reason?: string) => void;
  saveRecurringPlan: (
    draft: Omit<RecurringPlan, "createdAt" | "updatedAt">,
  ) => {
    status: "saved" | "invalid";
    message: string;
    planId?: string;
    errors?: Record<string, string>;
  };
  completeRecurringOccurrence: (
    occurrenceId: string,
    options?: { logId?: string },
  ) => void;
  snoozeRecurringOccurrence: (occurrenceId: string) => void;
  skipRecurringOccurrence: (occurrenceId: string, reason?: string) => void;
  bulkCompleteRecurringOccurrences: (occurrenceIds: string[]) => void;
  bulkSnoozeRecurringOccurrences: (occurrenceIds: string[]) => void;
  resolveRecurringPromptMatch: (occurrenceId: string, logId: string) => void;
  importLogsFromCsv: (csv: string) => {
    importedCount: number;
    warnings: string[];
  };
  importTemplateFromUrl: (
    rawUrl: string,
    preferredMethod?: TemplateImportMethod,
  ) => TemplateImportActionResult;
  saveCustomTemplate: (
    template: TemplateCatalogItem,
  ) => SaveCustomTemplateResult;
  createSpace: (draft: CreateSpaceDraft) => CreateSpaceResult;
  updateSpace: (spaceId: string, draft: UpdateSpaceDraft) => UpdateSpaceResult;
  archiveSpace: (spaceId: string) => ArchiveSpaceResult;
  resetWorkspace: () => void;
  createRestorePoint: (options?: {
    reason?: WorkspaceRestorePointReason;
    label?: string;
    allowEmpty?: boolean;
  }) => Promise<CreateWorkspaceRestorePointResult>;
  restoreWorkspaceFromRestorePoint: (
    restorePointId: string,
  ) => Promise<RestoreWorkspaceFromRestorePointResult>;
  deleteRestorePoint: (
    restorePointId: string,
  ) => Promise<DeleteWorkspaceRestorePointResult>;
  exportRestorePointJson: (
    restorePointId: string,
  ) => Promise<ExportWorkspaceRestorePointResult>;
  setWorkspacePrivacyMode: (
    mode: WorkspacePrivacyMode,
  ) => Promise<{ status: string; message: string }>;
  setBiometricLockEnabled: (
    enabled: boolean,
  ) => Promise<{ status: string; message: string }>;
  setBiometricReauthTimeout: (
    timeout: WorkspaceBiometricReauthTimeout,
  ) => Promise<{ status: string; message: string }>;
  requestReminderNotifications: () => Promise<{
    status: string;
    message: string;
  }>;
  unlockWorkspace: () => Promise<{ status: string; message: string }>;
  recoverBlockedWorkspace: () => Promise<{ status: string; message: string }>;
  syncWorkspaceNow: () => Promise<SyncActionResult>;
  pullWorkspaceFromCloud: () => Promise<SyncActionResult>;
  restoreWorkspaceFromCloud: () => Promise<SyncActionResult>;
};
