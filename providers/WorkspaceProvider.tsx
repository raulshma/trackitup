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
import { AppState, type AppStateStatus } from "react-native";

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
import { useWorkspaceStoreState } from "@/stores/useWorkspaceStore";

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

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
  const [isBiometricSessionUnlocked, setIsBiometricSessionUnlocked] =
    useState(false);
  const [isUnlockingWorkspace, setIsUnlockingWorkspace] = useState(false);
  const [workspaceLockMessage, setWorkspaceLockMessage] = useState(
    "Unlock with biometrics or the device credential fallback to continue.",
  );
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAtRef = useRef<number | null>(null);
  const syncEndpoint = process.env.EXPO_PUBLIC_TRACKITUP_SYNC_ENDPOINT;
  const {
    workspacePrivacyMode,
    setWorkspacePrivacyModePreference,
    isLoaded: isPrivacyModeLoaded,
  } = useWorkspacePrivacyMode();
  const defaultWorkspace = useMemo(() => createEmptyWorkspaceSnapshot(), []);
  const refreshBiometricAvailability = useCallback(async () => {
    const availability = await getWorkspaceBiometricAvailability();
    setBiometricAvailability(availability);
    return availability;
  }, []);
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

  const {
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
    resetWorkspace,
  } = useWorkspaceMutations(setWorkspace, ownerScopeKey);

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
            message:
              "Protected local storage for this scope could not be recovered on this device. Reset the blocked protected workspace to continue.",
          };
        }

        if (nextMode === "protected" && reloaded.persistenceMode === "memory") {
          return {
            status: "success" as const,
            message:
              "Protected mode is now selected, but secure local persistence is unavailable here, so this workspace will remain in memory only on this device.",
          };
        }

        return {
          status: "success" as const,
          message:
            nextMode === "protected"
              ? "Protected local privacy mode is now preferred on this device."
              : "Compatibility local privacy mode is now active on this device.",
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

      return {
        status: "success" as const,
        message:
          "Cleared the blocked protected workspace for this device scope and started a fresh local workspace.",
      };
    } catch {
      return {
        status: "error" as const,
        message:
          "Could not reset the blocked protected workspace. Please try again.",
      };
    }
  }, [
    defaultWorkspace,
    ownerScopeKey,
    setBlockedProtectionReason,
    setIsHydrated,
    setLocalProtectionStatus,
    setPersistenceMode,
    setWorkspace,
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
    workspace,
    setWorkspace,
  });

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
      privacyMode: workspacePrivacyMode,
      biometricLockEnabled,
      biometricAvailability,
      biometricReauthTimeout,
      isWorkspaceLocked,
      localProtectionStatus,
      blockedProtectionReason,
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
      setWorkspacePrivacyMode,
      setBiometricLockEnabled,
      setBiometricReauthTimeout,
      unlockWorkspace,
      recoverBlockedWorkspace,
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
      blockedProtectionReason,
      biometricAvailability,
      biometricLockEnabled,
      biometricReauthTimeout,
      isSyncing,
      isWorkspaceLocked,
      logEntries,
      localProtectionStatus,
      moveDashboardWidget,
      overviewStats,
      persistenceMode,
      pullWorkspaceFromCloud,
      quickActionCards,
      recoverBlockedWorkspace,
      resetWorkspace,
      restoreWorkspaceFromCloud,
      saveCustomTemplate,
      saveLogForAction,
      saveLogForTemplate,
      setBiometricLockEnabled,
      setBiometricReauthTimeout,
      setWorkspacePrivacyMode,
      skipReminder,
      snoozeReminder,
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
