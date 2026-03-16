import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";

import { WorkspaceLockScreen } from "@/components/WorkspaceLockScreen";
import { createEmptyWorkspaceSnapshot } from "@/constants/TrackItUpDefaults";
import {
  getOverviewStats,
  getQuickActionCards,
  getSpaceSummaries,
  getTimelineEntries,
} from "@/constants/TrackItUpSelectors";
import { useAppAuth } from "@/providers/AuthProvider";
import { useWorkspacePrivacyMode } from "@/providers/WorkspacePrivacyModeProvider";
import type { WorkspaceContextValue } from "@/providers/workspace/types";
import { useWorkspaceHydration } from "@/providers/workspace/useWorkspaceHydration";
import { useWorkspaceMutations } from "@/providers/workspace/useWorkspaceMutations";
import { useWorkspaceSyncActions } from "@/providers/workspace/useWorkspaceSyncActions";
import { getWorkspaceRecommendations } from "@/services/insights/workspaceRecommendations";
import {
  authenticateWorkspaceBiometric,
  getWorkspaceBiometricAvailability,
  type WorkspaceBiometricAvailability,
} from "@/services/offline/workspaceBiometric";
import {
  loadWorkspaceBiometricLockPreference,
  loadWorkspaceBiometricReauthTimeoutPreference,
  persistWorkspaceBiometricLockPreference,
  persistWorkspaceBiometricReauthTimeoutPreference,
} from "@/services/offline/workspaceBiometricPreferencePersistence";
import {
  DEFAULT_WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT,
  getWorkspaceBiometricReauthTimeoutLabel,
  shouldRelockWorkspaceBiometricSession,
  type WorkspaceBiometricReauthTimeout,
} from "@/services/offline/workspaceBiometricSessionPolicy";
import type { BlockedEncryptedWorkspaceReason } from "@/services/offline/workspaceEncryptedPersistence";
import type { WorkspaceLocalProtectionStatus } from "@/services/offline/workspaceLocalProtection";
import { getWorkspaceOwnerScopeKey } from "@/services/offline/workspaceOwnership";
import {
  clearPersistedWorkspace,
  loadPersistedWorkspace,
  persistWorkspace,
} from "@/services/offline/workspacePersistence";
import {
  createWorkspaceRestorePoint,
  deleteWorkspaceRestorePoint,
  exportWorkspaceRestorePointJson,
  listWorkspaceRestorePoints,
  restoreWorkspaceFromRestorePoint as restoreWorkspaceFromRestorePointStorage,
  type CreateWorkspaceRestorePointResult,
  type DeleteWorkspaceRestorePointResult,
  type ExportWorkspaceRestorePointResult,
  type WorkspaceRestorePointReason,
  type WorkspaceRestorePointSummary,
} from "@/services/offline/workspaceRestorePoints";
import { ensureRecurringOccurrencesWindow } from "@/services/recurring/recurringPlans";
import {
  getRecurringNotificationResponseIntent,
  getReminderNotificationResponseIntent,
} from "@/services/reminders/reminderNotificationIntents";
import {
  clearScheduledReminderNotifications,
  getReminderNotificationPermissionState,
  requestReminderNotificationPermissions,
  syncWorkspaceReminderNotifications,
  type ReminderNotificationPermissionState,
  type ReminderNotificationPermissionStatus,
} from "@/services/reminders/reminderNotifications";
import { useWorkspaceStoreState } from "@/stores/useWorkspaceStore";

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
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
  const snapshotLogEntries = useMemo(
    () => workspace.logs.filter((log) => !log.archivedAt),
    [workspace.logs],
  );
  const snapshotTimelineEntries = useMemo(
    () => getTimelineEntries(workspace),
    [workspace],
  );
  const [logEntries, setLogEntries] = useState(snapshotLogEntries);
  const [timelineEntries, setTimelineEntries] = useState(
    snapshotTimelineEntries,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [restorePoints, setRestorePoints] = useState<
    WorkspaceRestorePointSummary[]
  >([]);
  const [localProtectionStatus, setLocalProtectionStatus] =
    useState<WorkspaceLocalProtectionStatus>("standard");
  const [blockedProtectionReason, setBlockedProtectionReason] =
    useState<BlockedEncryptedWorkspaceReason | null>(null);
  const [biometricLockEnabled, setBiometricLockEnabledState] = useState(false);
  const [isBiometricPreferenceLoaded, setIsBiometricPreferenceLoaded] =
    useState(false);
  const [biometricAvailability, setBiometricAvailability] =
    useState<WorkspaceBiometricAvailability>({
      status: "unavailable",
      label: "Checking",
      reason: "unsupported",
    });
  const [biometricReauthTimeout, setBiometricReauthTimeoutState] =
    useState<WorkspaceBiometricReauthTimeout>(
      DEFAULT_WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT,
    );
  const [
    reminderNotificationPermissionStatus,
    setReminderNotificationPermissionStatus,
  ] = useState<ReminderNotificationPermissionStatus>("undetermined");
  const [canAskForReminderNotifications, setCanAskForReminderNotifications] =
    useState(false);
  const [isBiometricSessionUnlocked, setIsBiometricSessionUnlocked] =
    useState(false);
  const [isUnlockingWorkspace, setIsUnlockingWorkspace] = useState(false);
  const [workspaceLockMessage, setWorkspaceLockMessage] = useState(
    "Unlock with biometrics or the device credential fallback to continue.",
  );
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAtRef = useRef<number | null>(null);
  const syncEndpoint = process.env.EXPO_PUBLIC_TRACKITUP_SYNC_ENDPOINT;
  const syncAllowedHosts = useMemo(
    () =>
      (process.env.EXPO_PUBLIC_TRACKITUP_SYNC_ALLOWED_HOSTS ?? "")
        .split(/[\s,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    [],
  );
  const {
    workspacePrivacyMode,
    setWorkspacePrivacyModePreference,
    isLoaded: isPrivacyModeLoaded,
  } = useWorkspacePrivacyMode();
  const defaultWorkspace = useMemo(() => createEmptyWorkspaceSnapshot(), []);
  const applyReminderNotificationPermissionState = useCallback(
    (state: ReminderNotificationPermissionState) => {
      setReminderNotificationPermissionStatus(state.status);
      setCanAskForReminderNotifications(state.canAskAgain);
    },
    [],
  );
  const refreshBiometricAvailability = useCallback(async () => {
    const availability = await getWorkspaceBiometricAvailability();
    setBiometricAvailability(availability);
    return availability;
  }, []);
  const refreshReminderNotificationPermissions = useCallback(async () => {
    const state = await getReminderNotificationPermissionState();
    applyReminderNotificationPermissionState(state);
    return state;
  }, [applyReminderNotificationPermissionState]);
  const ownerScopeKey = useMemo(
    () => getWorkspaceOwnerScopeKey(auth.isSignedIn ? auth.userId : null),
    [auth.isSignedIn, auth.userId],
  );

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const [enabled, availability, reauthTimeout] = await Promise.all([
        loadWorkspaceBiometricLockPreference(),
        getWorkspaceBiometricAvailability(),
        loadWorkspaceBiometricReauthTimeoutPreference(),
      ]);
      if (!isMounted) return;

      setBiometricLockEnabledState(enabled);
      setIsBiometricPreferenceLoaded(true);
      setBiometricAvailability(availability);
      setBiometricReauthTimeoutState(reauthTimeout);
      setIsBiometricSessionUnlocked(!enabled);
      setWorkspaceLockMessage(
        availability.status === "available"
          ? "Unlock with biometrics or the device credential fallback to continue."
          : "Biometric authentication is not currently available on this device.",
      );
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isBiometricPreferenceLoaded) return;
    if (!biometricLockEnabled || workspacePrivacyMode !== "protected") {
      backgroundedAtRef.current = null;
      setIsBiometricSessionUnlocked(true);
      return;
    }

    setWorkspaceLockMessage(
      biometricAvailability.status === "available"
        ? "Unlock with biometrics or the device credential fallback to continue."
        : "Biometric authentication is not currently available on this device.",
    );
  }, [
    biometricAvailability.status,
    biometricLockEnabled,
    isBiometricPreferenceLoaded,
    workspacePrivacyMode,
  ]);

  useEffect(() => {
    if (!isBiometricPreferenceLoaded || !biometricLockEnabled) return;
    if (workspacePrivacyMode !== "protected") return;

    backgroundedAtRef.current = null;
    setIsBiometricSessionUnlocked(false);
  }, [
    isBiometricPreferenceLoaded,
    biometricLockEnabled,
    ownerScopeKey,
    workspacePrivacyMode,
  ]);

  useEffect(() => {
    void refreshReminderNotificationPermissions();
  }, [refreshReminderNotificationPermissions]);

  const refreshRestorePoints = useCallback(async () => {
    return listWorkspaceRestorePoints(ownerScopeKey, defaultWorkspace);
  }, [defaultWorkspace, ownerScopeKey]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const nextRestorePoints = await refreshRestorePoints();
      if (isMounted) {
        setRestorePoints(nextRestorePoints);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshRestorePoints]);

  const appendRestorePointMessage = useCallback(
    (
      baseMessage: string,
      result: CreateWorkspaceRestorePointResult,
      createdSuffix: string,
      unavailableSuffix: string,
    ) => {
      if (result.status === "created") {
        return `${baseMessage} ${createdSuffix}`;
      }
      if (result.status === "unavailable") {
        return `${baseMessage} ${unavailableSuffix}`;
      }
      return baseMessage;
    },
    [],
  );

  const requiresBiometricLock =
    isBiometricPreferenceLoaded &&
    biometricLockEnabled &&
    workspacePrivacyMode === "protected";
  const isWorkspaceLocked =
    requiresBiometricLock && !isBiometricSessionUnlocked;
  const canHydrateWorkspace =
    isPrivacyModeLoaded &&
    (!requiresBiometricLock ||
      (biometricAvailability.status === "available" &&
        isBiometricSessionUnlocked));

  useEffect(() => {
    if (!requiresBiometricLock) {
      appStateRef.current = AppState.currentState;
      backgroundedAtRef.current = null;
      return;
    }

    appStateRef.current = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "active") {
        const inactiveDurationMs =
          backgroundedAtRef.current === null
            ? null
            : Date.now() - backgroundedAtRef.current;
        backgroundedAtRef.current = null;

        if (
          shouldRelockWorkspaceBiometricSession({
            timeout: biometricReauthTimeout,
            inactiveDurationMs,
          })
        ) {
          setIsBiometricSessionUnlocked(false);
          setWorkspaceLockMessage(
            `Protected workspace re-locked after ${getWorkspaceBiometricReauthTimeoutLabel(
              biometricReauthTimeout,
            ).toLowerCase()} away from the app. Unlock to continue.`,
          );
        }
        return;
      }

      if (previousState === "active") {
        backgroundedAtRef.current = Date.now();

        if (biometricReauthTimeout === "immediate") {
          setIsBiometricSessionUnlocked(false);
          setWorkspaceLockMessage(
            "Protected workspace re-locked as soon as TrackItUp left the foreground. Unlock to continue.",
          );
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [biometricReauthTimeout, requiresBiometricLock]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshReminderNotificationPermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshReminderNotificationPermissions]);

  useWorkspaceHydration({
    canHydrate: canHydrateWorkspace,
    workspace,
    isHydrated,
    privacyMode: workspacePrivacyMode,
    isPrivacyModeLoaded,
    ownerScopeKey,
    persistenceMode,
    defaultWorkspace,
    snapshotLogEntries,
    snapshotTimelineEntries,
    setWorkspace,
    setIsHydrated,
    setPersistenceMode,
    setLocalProtectionStatus,
    setBlockedProtectionReason,
    setLogEntries,
    setTimelineEntries,
  });

  useEffect(() => {
    if (!isHydrated) return;

    const now = new Date().toISOString();
    setWorkspace((currentWorkspace) =>
      ensureRecurringOccurrencesWindow(currentWorkspace, { now }),
    );
  }, [isHydrated, setWorkspace]);

  useEffect(() => {
    if (!isHydrated) return;

    if (reminderNotificationPermissionStatus !== "granted") {
      void clearScheduledReminderNotifications();
      return;
    }

    void syncWorkspaceReminderNotifications(workspace);
  }, [
    isHydrated,
    reminderNotificationPermissionStatus,
    workspace.recurringOccurrences,
    workspace.recurringPlans,
    workspace.reminders,
    workspace.spaces,
  ]);

  const {
    saveLogForAction,
    saveLogForTemplate,
    updateLog,
    archiveLog,
    moveDashboardWidget,
    cycleWidgetSize,
    toggleWidgetVisibility,
    completeReminder,
    snoozeReminder,
    skipReminder,
    saveRecurringPlan,
    completeRecurringOccurrence,
    snoozeRecurringOccurrence,
    skipRecurringOccurrence,
    bulkCompleteRecurringOccurrences,
    bulkSnoozeRecurringOccurrences,
    resolveRecurringPromptMatch,
    importLogsFromCsv,
    importTemplateFromUrl,
    saveCustomTemplate,
    createSpace,
    updateSpace,
    archiveSpace,
    resetWorkspace,
  } = useWorkspaceMutations(setWorkspace, ownerScopeKey, workspacePrivacyMode);

  const handledReminderNotificationResponseRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;

    function handleReminderResponse(
      response: Notifications.NotificationResponse,
    ) {
      const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handledReminderNotificationResponseRef.current === key) return;

      const intent = getReminderNotificationResponseIntent(response);
      if (intent) {
        if (intent.kind === "default") {
          handledReminderNotificationResponseRef.current = key;
          router.push({
            pathname: "/action-center",
            params: {
              reminderId: intent.reminderId,
              source: "notification",
            },
          });
          void Notifications.clearLastNotificationResponseAsync();
          return;
        }

        handledReminderNotificationResponseRef.current = key;

        if (intent.kind === "complete") {
          completeReminder(intent.reminderId);
        } else if (intent.kind === "snooze") {
          snoozeReminder(intent.reminderId);
        } else if (intent.kind === "skip") {
          skipReminder(intent.reminderId, "Skipped from notification action");
        }

        void Notifications.clearLastNotificationResponseAsync();
        return;
      }

      const recurringIntent = getRecurringNotificationResponseIntent(response);
      if (!recurringIntent) return;

      if (recurringIntent.kind === "default") {
        handledReminderNotificationResponseRef.current = key;

        const occurrence = workspace.recurringOccurrences.find(
          (item) => item.id === recurringIntent.occurrenceId,
        );
        const plan = workspace.recurringPlans.find(
          (item) =>
            item.id === (recurringIntent.planId ?? occurrence?.planId ?? ""),
        );

        if (occurrence && plan?.proofRequired) {
          const planSpaceIds = normalizeSpaceIds(plan);
          router.push({
            pathname: "/logbook",
            params: {
              actionId: "quick-log",
              spaceId: planSpaceIds[0] ?? plan.spaceId,
              ...(planSpaceIds.length
                ? { spaceIds: planSpaceIds.join(",") }
                : {}),
              recurringOccurrenceId: occurrence.id,
              recurringPlanId: plan.id,
              source: "notification",
            },
          });
        } else {
          router.push({
            pathname: "/action-center",
            params: {
              recurringOccurrenceId: recurringIntent.occurrenceId,
              source: "notification",
            },
          });
        }

        void Notifications.clearLastNotificationResponseAsync();
        return;
      }

      handledReminderNotificationResponseRef.current = key;

      if (recurringIntent.kind === "complete") {
        completeRecurringOccurrence(recurringIntent.occurrenceId);
      } else if (recurringIntent.kind === "snooze") {
        snoozeRecurringOccurrence(recurringIntent.occurrenceId);
      } else if (recurringIntent.kind === "skip") {
        skipRecurringOccurrence(
          recurringIntent.occurrenceId,
          "Skipped from recurring notification action",
        );
      }

      void Notifications.clearLastNotificationResponseAsync();
    }

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      handleReminderResponse(lastResponse);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response: Notifications.NotificationResponse) => {
        handleReminderResponse(response);
      },
    );

    return () => {
      subscription.remove();
    };
  }, [
    completeReminder,
    completeRecurringOccurrence,
    router,
    skipReminder,
    skipRecurringOccurrence,
    snoozeReminder,
    snoozeRecurringOccurrence,
    workspace.recurringOccurrences,
    workspace.recurringPlans,
  ]);

  const setBiometricLockEnabled = useCallback(
    async (enabled: boolean) => {
      const availability = await refreshBiometricAvailability();
      if (enabled) {
        if (availability.status !== "available") {
          return {
            status: "error" as const,
            message:
              "Biometric authentication is not ready on this device. Set up biometrics or a device credential and try again.",
          };
        }

        const authResult = await authenticateWorkspaceBiometric({
          promptMessage: "Confirm biometric lock for TrackItUp",
        });
        if (authResult.status !== "success") {
          return authResult;
        }

        await persistWorkspaceBiometricLockPreference(true);
        setBiometricLockEnabledState(true);
        setIsBiometricSessionUnlocked(true);
        setWorkspaceLockMessage(
          "Biometric lock enabled. Protected workspaces will require local authentication on this device.",
        );
        return {
          status: "success" as const,
          message:
            "Biometric lock is now enabled for protected local workspaces on this device.",
        };
      }

      await persistWorkspaceBiometricLockPreference(false);
      setBiometricLockEnabledState(false);
      setIsBiometricSessionUnlocked(true);
      setWorkspaceLockMessage(
        "Biometric lock disabled for this device. Protected mode still keeps encrypted local snapshots when enabled.",
      );
      return {
        status: "success" as const,
        message: "Biometric lock is now disabled for this device.",
      };
    },
    [refreshBiometricAvailability],
  );

  const setBiometricReauthTimeout = useCallback(
    async (timeout: WorkspaceBiometricReauthTimeout) => {
      await persistWorkspaceBiometricReauthTimeoutPreference(timeout);
      setBiometricReauthTimeoutState(timeout);
      return {
        status: "success" as const,
        message: `Biometric re-auth is now set to ${getWorkspaceBiometricReauthTimeoutLabel(
          timeout,
        ).toLowerCase()}.`,
      };
    },
    [],
  );

  const requestReminderNotifications = useCallback(async () => {
    const state = await requestReminderNotificationPermissions();
    applyReminderNotificationPermissionState(state);

    if (state.status === "granted") {
      if (isHydrated) {
        await syncWorkspaceReminderNotifications(workspace);
      }

      return {
        status: "success" as const,
        message:
          "Reminder notifications are enabled on this device. Upcoming planner work will now schedule local alerts.",
      };
    }

    if (state.status === "unsupported") {
      return {
        status: "error" as const,
        message:
          "Reminder notifications are only available on iOS and Android devices.",
      };
    }

    return {
      status: "error" as const,
      message: state.canAskAgain
        ? "TrackItUp still needs notification permission to deliver reminder alerts."
        : "Notification access is currently denied. Open device settings to enable reminder alerts.",
    };
  }, [applyReminderNotificationPermissionState, isHydrated, workspace]);

  const unlockWorkspace = useCallback(async () => {
    const availability = await refreshBiometricAvailability();
    if (availability.status !== "available") {
      const message =
        "Biometric authentication is not currently available on this device. Disable biometric lock for this device to recover access.";
      setWorkspaceLockMessage(message);
      return {
        status: "error" as const,
        message,
      };
    }

    setIsUnlockingWorkspace(true);
    try {
      const result = await authenticateWorkspaceBiometric();
      setWorkspaceLockMessage(result.message);
      if (result.status === "success") {
        setIsBiometricSessionUnlocked(true);
      }
      return result;
    } finally {
      setIsUnlockingWorkspace(false);
    }
  }, [refreshBiometricAvailability]);

  const disableBiometricLockFromLockScreen = useCallback(async () => {
    const result = await setBiometricLockEnabled(false);
    setWorkspaceLockMessage(result.message);
  }, [setBiometricLockEnabled]);

  const setWorkspacePrivacyMode = useCallback(
    async (nextMode: typeof workspacePrivacyMode) => {
      if (nextMode === workspacePrivacyMode) {
        return {
          status: "success" as const,
          message: `Local privacy mode is already set to ${nextMode}.`,
        };
      }

      if (localProtectionStatus === "blocked") {
        return {
          status: "error" as const,
          message:
            "Reset the blocked protected workspace before changing local privacy mode for this scope.",
        };
      }

      try {
        if (nextMode === "protected" && biometricLockEnabled) {
          const authResult = await authenticateWorkspaceBiometric({
            promptMessage: "Confirm protected mode for TrackItUp",
          });
          if (authResult.status !== "success") {
            return authResult;
          }

          setIsBiometricSessionUnlocked(true);
        }

        const restorePointResult = await createWorkspaceRestorePoint(
          workspace,
          ownerScopeKey,
          workspacePrivacyMode,
          {
            reason: "before-privacy-mode-change",
            label: "Before changing local privacy mode",
            defaultWorkspace,
          },
        );

        setIsHydrated(false);
        await persistWorkspace(workspace, ownerScopeKey, nextMode);
        setWorkspacePrivacyModePreference(nextMode);

        const reloaded = await loadPersistedWorkspace(
          defaultWorkspace,
          ownerScopeKey,
          nextMode,
        );
        setWorkspace(reloaded.workspace);
        setPersistenceMode(reloaded.persistenceMode);
        setLocalProtectionStatus(reloaded.localProtectionStatus);
        setBlockedProtectionReason(reloaded.blockedProtectionReason ?? null);
        setIsHydrated(true);

        if (reloaded.localProtectionStatus === "blocked") {
          return {
            status: "error" as const,
            message: appendRestorePointMessage(
              "Protected local storage for this scope could not be recovered on this device. Reset the blocked protected workspace to continue.",
              restorePointResult,
              "Saved a restore point before the privacy-mode change.",
              "TrackItUp could not save a restore point before the privacy-mode change.",
            ),
          };
        }

        if (nextMode === "protected" && reloaded.persistenceMode === "memory") {
          return {
            status: "success" as const,
            message: appendRestorePointMessage(
              "Protected mode is now selected, but secure local persistence is unavailable here, so this workspace will remain in memory only on this device.",
              restorePointResult,
              "Saved a restore point before the privacy-mode change.",
              "TrackItUp could not save a restore point before the privacy-mode change.",
            ),
          };
        }

        return {
          status: "success" as const,
          message: appendRestorePointMessage(
            nextMode === "protected"
              ? "Protected local privacy mode is now preferred on this device."
              : "Compatibility local privacy mode is now active on this device.",
            restorePointResult,
            "Saved a restore point before the privacy-mode change.",
            "TrackItUp could not save a restore point before the privacy-mode change.",
          ),
        };
      } catch {
        setIsHydrated(true);
        return {
          status: "error" as const,
          message: "Could not change the local privacy mode. Please try again.",
        };
      }
    },
    [
      appendRestorePointMessage,
      biometricLockEnabled,
      defaultWorkspace,
      localProtectionStatus,
      ownerScopeKey,
      setIsHydrated,
      setPersistenceMode,
      setWorkspace,
      setWorkspacePrivacyModePreference,
      workspace,
      workspacePrivacyMode,
    ],
  );

  const recoverBlockedWorkspace = useCallback(async () => {
    try {
      const restorePointResult = await createWorkspaceRestorePoint(
        workspace,
        ownerScopeKey,
        workspacePrivacyMode,
        {
          reason: "before-blocked-recovery",
          label: "Before blocked workspace recovery",
          defaultWorkspace,
          storageModeOverride: "compatibility",
        },
      );
      await clearPersistedWorkspace(ownerScopeKey);
      const recovered = await loadPersistedWorkspace(
        defaultWorkspace,
        ownerScopeKey,
        workspacePrivacyMode,
      );
      setWorkspace(recovered.workspace);
      setPersistenceMode(recovered.persistenceMode);
      setLocalProtectionStatus(recovered.localProtectionStatus);
      setBlockedProtectionReason(recovered.blockedProtectionReason ?? null);
      setIsHydrated(true);
      const nextRestorePoints = await refreshRestorePoints();
      setRestorePoints(nextRestorePoints);

      return {
        status: "success" as const,
        message: appendRestorePointMessage(
          "Cleared the blocked protected workspace for this device scope and started a fresh local workspace.",
          restorePointResult,
          "Saved a compatibility restore point before the reset.",
          "TrackItUp could not save a compatibility restore point before the reset.",
        ),
      };
    } catch {
      return {
        status: "error" as const,
        message:
          "Could not reset the blocked protected workspace. Please try again.",
      };
    }
  }, [
    appendRestorePointMessage,
    defaultWorkspace,
    ownerScopeKey,
    refreshRestorePoints,
    setBlockedProtectionReason,
    setIsHydrated,
    setLocalProtectionStatus,
    setPersistenceMode,
    setWorkspace,
    workspace,
    workspacePrivacyMode,
  ]);

  const {
    syncWorkspaceNow,
    pullWorkspaceFromCloud,
    restoreWorkspaceFromCloud,
  } = useWorkspaceSyncActions({
    auth,
    isSyncing,
    setIsSyncing,
    syncEndpoint,
    syncAllowedHosts,
    workspace,
    setWorkspace,
  });

  const createRestorePointForCurrentWorkspace = useCallback(
    async (options?: {
      reason?: WorkspaceRestorePointReason;
      label?: string;
      allowEmpty?: boolean;
    }): Promise<CreateWorkspaceRestorePointResult> => {
      const result = await createWorkspaceRestorePoint(
        workspace,
        ownerScopeKey,
        workspacePrivacyMode,
        {
          ...options,
          defaultWorkspace,
        },
      );

      if (result.status === "created") {
        const nextRestorePoints = await refreshRestorePoints();
        setRestorePoints(nextRestorePoints);
      }

      return result;
    },
    [
      defaultWorkspace,
      ownerScopeKey,
      refreshRestorePoints,
      workspace,
      workspacePrivacyMode,
    ],
  );

  const restoreWorkspaceFromRestorePoint = useCallback(
    async (restorePointId: string) => {
      const currentWorkspaceBackup = await createWorkspaceRestorePoint(
        workspace,
        ownerScopeKey,
        workspacePrivacyMode,
        {
          reason: "before-restore",
          label: "Before restoring an earlier backup",
          defaultWorkspace,
        },
      );
      const restored = await restoreWorkspaceFromRestorePointStorage(
        restorePointId,
        ownerScopeKey,
        defaultWorkspace,
      );
      if (restored.status !== "restored") {
        return restored;
      }

      setWorkspace(restored.workspace);
      await persistWorkspace(
        restored.workspace,
        ownerScopeKey,
        workspacePrivacyMode,
      );

      const nextRestorePoints = await refreshRestorePoints();
      setRestorePoints(nextRestorePoints);

      return {
        ...restored,
        message:
          currentWorkspaceBackup.status === "created"
            ? `${restored.message} Saved a pre-restore checkpoint of your current workspace first.`
            : currentWorkspaceBackup.status === "unavailable"
              ? `${restored.message} TrackItUp could not save a pre-restore checkpoint on this device first.`
              : restored.message,
      };
    },
    [
      defaultWorkspace,
      ownerScopeKey,
      refreshRestorePoints,
      setWorkspace,
      workspace,
      workspacePrivacyMode,
    ],
  );

  const deleteRestorePointForCurrentWorkspace = useCallback(
    async (
      restorePointId: string,
    ): Promise<DeleteWorkspaceRestorePointResult> => {
      const result = await deleteWorkspaceRestorePoint(
        restorePointId,
        ownerScopeKey,
        defaultWorkspace,
      );

      if (result.status === "deleted") {
        const nextRestorePoints = await refreshRestorePoints();
        setRestorePoints(nextRestorePoints);
      }

      return result;
    },
    [defaultWorkspace, ownerScopeKey, refreshRestorePoints],
  );

  const exportRestorePointJsonForCurrentWorkspace = useCallback(
    async (
      restorePointId: string,
    ): Promise<ExportWorkspaceRestorePointResult> => {
      return exportWorkspaceRestorePointJson(
        restorePointId,
        ownerScopeKey,
        defaultWorkspace,
      );
    },
    [defaultWorkspace, ownerScopeKey],
  );

  const overviewStats = useMemo(() => getOverviewStats(workspace), [workspace]);
  const recommendations = useMemo(
    () => getWorkspaceRecommendations(workspace),
    [workspace],
  );
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
      privacyMode: workspacePrivacyMode,
      biometricLockEnabled,
      biometricAvailability,
      biometricReauthTimeout,
      reminderNotificationPermissionStatus,
      canAskForReminderNotifications,
      isWorkspaceLocked,
      localProtectionStatus,
      blockedProtectionReason,
      isSyncing,
      restorePoints,
      overviewStats,
      recommendations,
      quickActionCards,
      spaceSummaries,
      timelineEntries,
      saveLogForAction,
      moveDashboardWidget,
      saveLogForTemplate,
      updateLog,
      archiveLog,
      cycleDashboardWidgetSize: cycleWidgetSize,
      toggleDashboardWidgetVisibility: toggleWidgetVisibility,
      completeReminder,
      snoozeReminder,
      skipReminder,
      saveRecurringPlan,
      completeRecurringOccurrence,
      snoozeRecurringOccurrence,
      skipRecurringOccurrence,
      bulkCompleteRecurringOccurrences,
      bulkSnoozeRecurringOccurrences,
      resolveRecurringPromptMatch,
      importLogsFromCsv,
      importTemplateFromUrl,
      saveCustomTemplate,
      createSpace,
      updateSpace,
      archiveSpace,
      resetWorkspace,
      createRestorePoint: createRestorePointForCurrentWorkspace,
      restoreWorkspaceFromRestorePoint,
      deleteRestorePoint: deleteRestorePointForCurrentWorkspace,
      exportRestorePointJson: exportRestorePointJsonForCurrentWorkspace,
      setWorkspacePrivacyMode,
      setBiometricLockEnabled,
      setBiometricReauthTimeout,
      requestReminderNotifications,
      unlockWorkspace,
      recoverBlockedWorkspace,
      pullWorkspaceFromCloud,
      restoreWorkspaceFromCloud,
      syncWorkspaceNow,
    }),
    [
      cycleWidgetSize,
      completeReminder,
      completeRecurringOccurrence,
      importLogsFromCsv,
      importTemplateFromUrl,
      isHydrated,
      createSpace,
      updateSpace,
      archiveSpace,
      createRestorePointForCurrentWorkspace,
      deleteRestorePointForCurrentWorkspace,
      blockedProtectionReason,
      biometricAvailability,
      biometricLockEnabled,
      biometricReauthTimeout,
      canAskForReminderNotifications,
      isSyncing,
      isWorkspaceLocked,
      logEntries,
      localProtectionStatus,
      moveDashboardWidget,
      overviewStats,
      restorePoints,
      recommendations,
      exportRestorePointJsonForCurrentWorkspace,
      reminderNotificationPermissionStatus,
      persistenceMode,
      pullWorkspaceFromCloud,
      quickActionCards,
      bulkCompleteRecurringOccurrences,
      bulkSnoozeRecurringOccurrences,
      requestReminderNotifications,
      recoverBlockedWorkspace,
      resetWorkspace,
      restoreWorkspaceFromRestorePoint,
      restoreWorkspaceFromCloud,
      saveCustomTemplate,
      saveRecurringPlan,
      saveLogForAction,
      saveLogForTemplate,
      updateLog,
      archiveLog,
      setBiometricLockEnabled,
      setBiometricReauthTimeout,
      setWorkspacePrivacyMode,
      skipReminder,
      skipRecurringOccurrence,
      snoozeReminder,
      snoozeRecurringOccurrence,
      resolveRecurringPromptMatch,
      spaceSummaries,
      syncWorkspaceNow,
      timelineEntries,
      toggleWidgetVisibility,
      unlockWorkspace,
      workspacePrivacyMode,
      workspace,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {isWorkspaceLocked ? (
        <WorkspaceLockScreen
          availability={biometricAvailability}
          isUnlocking={isUnlockingWorkspace}
          message={workspaceLockMessage}
          reauthTimeoutLabel={getWorkspaceBiometricReauthTimeoutLabel(
            biometricReauthTimeout,
          )}
          onUnlock={() => {
            void unlockWorkspace();
          }}
          onDisableLock={() => {
            void disableBiometricLockFromLockScreen();
          }}
        />
      ) : (
        children
      )}
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
