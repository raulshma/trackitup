import {
    getOverviewStats,
    getQuickActionCards,
    getSpaceSummaries,
    getTimelineEntries,
} from "@/constants/TrackItUpSelectors";
import type { FormValueMap } from "@/services/forms/workspaceForm";
import type { WorkspaceBiometricAvailability } from "@/services/offline/workspaceBiometric";
import type { WorkspaceBiometricReauthTimeout } from "@/services/offline/workspaceBiometricSessionPolicy";
import type { BlockedEncryptedWorkspaceReason } from "@/services/offline/workspaceEncryptedPersistence";
import type { WorkspaceLocalProtectionStatus } from "@/services/offline/workspaceLocalProtection";
import type { WorkspacePrivacyMode } from "@/services/offline/workspacePrivacyMode";
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
  privacyMode: WorkspacePrivacyMode;
  biometricLockEnabled: boolean;
  biometricAvailability: WorkspaceBiometricAvailability;
  biometricReauthTimeout: WorkspaceBiometricReauthTimeout;
  isWorkspaceLocked: boolean;
  localProtectionStatus: WorkspaceLocalProtectionStatus;
  blockedProtectionReason: BlockedEncryptedWorkspaceReason | null;
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
  ) => TemplateImportActionResult;
  saveCustomTemplate: (
    template: TemplateCatalogItem,
  ) => SaveCustomTemplateResult;
  resetWorkspace: () => void;
  setWorkspacePrivacyMode: (
    mode: WorkspacePrivacyMode,
  ) => Promise<{ status: string; message: string }>;
  setBiometricLockEnabled: (
    enabled: boolean,
  ) => Promise<{ status: string; message: string }>;
  setBiometricReauthTimeout: (
    timeout: WorkspaceBiometricReauthTimeout,
  ) => Promise<{ status: string; message: string }>;
  unlockWorkspace: () => Promise<{ status: string; message: string }>;
  recoverBlockedWorkspace: () => Promise<{ status: string; message: string }>;
  syncWorkspaceNow: () => Promise<SyncActionResult>;
  pullWorkspaceFromCloud: () => Promise<SyncActionResult>;
  restoreWorkspaceFromCloud: () => Promise<SyncActionResult>;
};
