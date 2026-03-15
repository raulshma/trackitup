import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, View } from "react-native";
import {
    ActivityIndicator,
    Button,
    Chip,
    Dialog,
    IconButton,
    Portal,
    SegmentedButtons,
    TextInput,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import { AccentColorPicker } from "@/components/ui/AccentColorPicker";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { ChipRow } from "@/components/ui/ChipRow";
import {
    FeatureSectionSwitcher,
    type FeatureSectionItem,
} from "@/components/ui/FeatureSectionSwitcher";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import { uiRadius, uiSpace, uiTypography } from "@/constants/UiTokens";
import { useAiPreferences } from "@/providers/AiPreferencesProvider";
import { useAppAuth } from "@/providers/AuthProvider";
import { useThemePreference } from "@/providers/ThemePreferenceProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { aiAccountSettingsCopy } from "@/services/ai/aiConsentCopy";
import {
    AI_TELEMETRY_WORKFLOW_SURFACE_CHIPS,
    createEmptyAiTelemetrySummary,
    formatAiTelemetryLastEventLabel,
    loadAiTelemetrySummary,
    recordAiTelemetryEvent,
} from "@/services/ai/aiTelemetry";
import { getWorkspaceBiometricDescription } from "@/services/offline/workspaceBiometric";
import {
    getWorkspaceBiometricReauthTimeoutDescription,
    getWorkspaceBiometricReauthTimeoutLabel,
    WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_OPTIONS,
    type WorkspaceBiometricReauthTimeout,
} from "@/services/offline/workspaceBiometricSessionPolicy";
import {
    getWorkspaceLocalProtectionDescription,
    getWorkspaceLocalProtectionLabel,
} from "@/services/offline/workspaceLocalProtection";
import {
    getWorkspacePrivacyModeDescription,
    getWorkspacePrivacyModeLabel,
    WORKSPACE_PRIVACY_MODE_OPTIONS,
    type WorkspacePrivacyMode,
} from "@/services/offline/workspacePrivacyMode";
import {
    DEFAULT_THEME_ACCENT_COLOR,
    getThemeAccentLabel,
    normalizeThemeAccentColor,
    THEME_PREFERENCE_OPTIONS,
    type ThemePreference,
} from "@/services/theme/themePreferences";

const themeOptionLabels: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  oled: "OLED",
  "monotone-light": "Monotone Light",
  "monotone-dark": "Monotone Dark",
};

type AccountSection = "profile" | "appearance" | "assistant" | "privacy";

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const aiPreferences = useAiPreferences();
  const auth = useAppAuth();
  const workspace = useWorkspace();
  const {
    themePreference,
    themeAccentColor,
    setThemePreference,
    setThemeAccentColor,
  } = useThemePreference();
  const [statusMessage, setStatusMessage] = useState(auth.note);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openRouterApiKeyInput, setOpenRouterApiKeyInput] = useState("");
  const [aiTelemetrySummary, setAiTelemetrySummary] = useState(
    createEmptyAiTelemetrySummary(),
  );
  const [activeSection, setActiveSection] = useState<AccountSection>("profile");
  const [pendingPrivacyModeChange, setPendingPrivacyModeChange] =
    useState<WorkspacePrivacyMode | null>(null);

  const lastLocalSnapshot = new Date(
    workspace.workspace.generatedAt,
  ).toLocaleString();
  const authStateLabel = !auth.clerkPublishableKeyConfigured
    ? "Local only"
    : !auth.isLoaded
      ? "Loading auth"
      : auth.isSignedIn
        ? "Signed in"
        : "Sign-in optional";
  const syncStateLabel = workspace.isSyncing
    ? "Syncing"
    : workspace.workspace.syncQueue.length > 0
      ? `${workspace.workspace.syncQueue.length} queued`
      : "Up to date";
  const localProtectionLabel = getWorkspaceLocalProtectionLabel(
    workspace.localProtectionStatus,
  );
  const localProtectionDescription = getWorkspaceLocalProtectionDescription({
    status: workspace.localProtectionStatus,
    persistenceMode: workspace.persistenceMode,
    blockedReason: workspace.blockedProtectionReason,
  });
  const privacyModeDescription = getWorkspacePrivacyModeDescription(
    workspace.privacyMode,
  );
  const biometricDescription = getWorkspaceBiometricDescription({
    availability: workspace.biometricAvailability,
    enabled: workspace.biometricLockEnabled,
    privacyMode: workspace.privacyMode,
  });
  const biometricReauthDescription =
    getWorkspaceBiometricReauthTimeoutDescription(
      workspace.biometricReauthTimeout,
    );
  const isProtectionBlocked = workspace.localProtectionStatus === "blocked";
  const reminderNotificationLabel =
    workspace.reminderNotificationPermissionStatus === "granted"
      ? "Enabled"
      : workspace.reminderNotificationPermissionStatus === "denied"
        ? "Blocked"
        : workspace.reminderNotificationPermissionStatus === "unsupported"
          ? "Unsupported"
          : "Not enabled";
  const aiKeyStatusLabel = aiPreferences.hasOpenRouterApiKey
    ? "Key saved"
    : "No key saved";
  const aiStorageStatusLabel = !aiPreferences.isLoaded
    ? "Checking storage"
    : aiPreferences.isSecureStorageAvailable
      ? "Secure storage ready"
      : "Secure storage unavailable";
  const aiPromptHistoryValue = aiPreferences.promptHistoryEnabled
    ? "save"
    : "dont-save";
  const isDefaultAccent =
    normalizeThemeAccentColor(themeAccentColor) === DEFAULT_THEME_ACCENT_COLOR;

  useEffect(() => {
    let isMounted = true;

    void loadAiTelemetrySummary().then((summary) => {
      if (isMounted) {
        setAiTelemetrySummary(summary);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const pageQuickActions = [
    {
      id: "account-sync",
      label: workspace.isSyncing ? "Syncing now" : "Sync now",
      hint: `${syncStateLabel} • last local snapshot ${lastLocalSnapshot}`,
      onPress: () => runAction(workspace.syncWorkspaceNow),
      accentColor: palette.tint,
      disabled: isSubmitting || workspace.isSyncing || isProtectionBlocked,
    },
    {
      id: "account-alerts",
      label: "Open action center",
      hint: `${reminderNotificationLabel} reminder alerts across ${workspace.workspace.reminders.length} tracked reminder${workspace.workspace.reminders.length === 1 ? "" : "s"}.`,
      onPress: () => router.push("/action-center" as never),
      accentColor: palette.secondary,
    },
    {
      id: "account-home",
      label: "Open workspace",
      hint: `${workspace.workspace.quickActions.length} recording shortcut${workspace.workspace.quickActions.length === 1 ? "" : "s"} are ready from the main workspace.`,
      onPress: () => router.replace("/(tabs)"),
    },
  ];
  const accountSections = useMemo<FeatureSectionItem<AccountSection>[]>(
    () => [
      {
        id: "profile" as const,
        label: "Profile",
        icon: {
          ios: "person.crop.circle",
          android: "account_circle",
          web: "account_circle",
        },
        hint: "Authentication, identity, and cloud sync state",
        meta: authStateLabel,
        badges: [
          syncStateLabel,
          auth.clerkPublishableKeyConfigured ? "Clerk ready" : "Local only",
        ],
        accentColor: palette.tint,
      },
      {
        id: "appearance" as const,
        label: "Appearance",
        icon: {
          ios: "paintbrush.pointed.fill",
          android: "palette",
          web: "palette",
        },
        hint: "Theme preference and dashboard-friendly display choices",
        meta: `${themeOptionLabels[themePreference]} • ${getThemeAccentLabel(themeAccentColor)}`,
        badges: [
          getThemeAccentLabel(themeAccentColor),
          Platform.OS === "web" ? "Web preview" : Platform.OS,
        ],
        accentColor: palette.secondary,
      },
      {
        id: "assistant" as const,
        label: "AI & alerts",
        icon: {
          ios: "brain.head.profile",
          android: "psychology",
          web: "psychology",
        },
        hint: "AI preferences, model controls, and reminder notifications",
        meta: aiKeyStatusLabel,
        badges: [aiStorageStatusLabel, reminderNotificationLabel],
        accentColor: palette.tertiary,
      },
      {
        id: "privacy" as const,
        label: "Privacy",
        icon: {
          ios: "lock.shield.fill",
          android: "shield_lock",
          web: "shield_lock",
        },
        hint: "Protection mode, biometric gate, and re-auth policy",
        meta: localProtectionLabel,
        badges: [
          getWorkspacePrivacyModeLabel(workspace.privacyMode),
          workspace.biometricLockEnabled ? "Biometric on" : "Biometric off",
        ],
        accentColor: palette.tint,
      },
    ],
    [
      aiKeyStatusLabel,
      aiStorageStatusLabel,
      auth.clerkPublishableKeyConfigured,
      authStateLabel,
      localProtectionLabel,
      palette.secondary,
      palette.tertiary,
      palette.tint,
      reminderNotificationLabel,
      syncStateLabel,
      themeAccentColor,
      themePreference,
      workspace.biometricLockEnabled,
      workspace.privacyMode,
    ],
  );

  async function runAction(
    action: () => Promise<{ status: string; message: string }>,
    options?: { returnToWorkspaceOnSuccess?: boolean },
  ) {
    setIsSubmitting(true);
    const result = await action();
    setStatusMessage(result.message);
    setIsSubmitting(false);

    if (result.status === "success" && options?.returnToWorkspaceOnSuccess) {
      router.replace("/(tabs)");
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    await auth.signOut();
    setStatusMessage(
      "Signed out. This device switched back to its separate anonymous local workspace.",
    );
    setIsSubmitting(false);
  }

  function requestPrivacyModeChange(nextMode: WorkspacePrivacyMode) {
    if (
      nextMode === workspace.privacyMode ||
      isSubmitting ||
      isProtectionBlocked
    ) {
      return;
    }

    setPendingPrivacyModeChange(nextMode);
  }

  async function confirmPrivacyModeChange() {
    if (!pendingPrivacyModeChange) return;

    const nextMode = pendingPrivacyModeChange;
    setPendingPrivacyModeChange(null);
    await runAction(() => workspace.setWorkspacePrivacyMode(nextMode));
  }

  async function handleReminderNotifications() {
    if (
      workspace.reminderNotificationPermissionStatus === "denied" &&
      !workspace.canAskForReminderNotifications
    ) {
      setIsSubmitting(true);
      await Linking.openSettings();
      setStatusMessage(
        "Opened device settings so you can re-enable notification access for TrackItUp.",
      );
      setIsSubmitting(false);
      return;
    }

    await runAction(() => workspace.requestReminderNotifications());
  }

  async function handleSaveOpenRouterKey() {
    setIsSubmitting(true);
    const result = await aiPreferences.saveOpenRouterApiKey(
      openRouterApiKeyInput,
    );
    setStatusMessage(result.message);
    if (result.status === "success") {
      setOpenRouterApiKeyInput("");
      setAiTelemetrySummary(
        await recordAiTelemetryEvent({
          surface: "account-settings",
          action: "key-saved",
        }),
      );
    }
    setIsSubmitting(false);
  }

  async function handleClearOpenRouterKey() {
    setIsSubmitting(true);
    const result = await aiPreferences.clearOpenRouterApiKey();
    setStatusMessage(result.message);
    setOpenRouterApiKeyInput("");
    if (result.status === "success") {
      setAiTelemetrySummary(
        await recordAiTelemetryEvent({
          surface: "account-settings",
          action: "key-cleared",
        }),
      );
    }
    setIsSubmitting(false);
  }

  async function handleAiPromptHistoryChange(value: string) {
    const enabled = value === "save";
    aiPreferences.setPromptHistoryEnabled(enabled);
    setStatusMessage(
      enabled
        ? "AI prompt history will be saved on this device until you turn it off."
        : "AI prompt history will not be saved on this device.",
    );
    setAiTelemetrySummary(
      await recordAiTelemetryEvent({
        surface: "account-settings",
        action: enabled ? "prompt-history-enabled" : "prompt-history-disabled",
      }),
    );
  }

  return (
    <ScrollView
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={styles.content}
      scrollEventThrottle={Platform.OS === "web" ? 64 : 32}
      removeClippedSubviews={Platform.OS === "android"}
      nestedScrollEnabled={Platform.OS === "android"}
    >
      <ScreenHero
        palette={palette}
        title="Account & sync"
        subtitle="Local tracking stays available without login. Anonymous use and each signed-in account keep separate on-device workspaces."
        badges={[
          {
            label: "Account & sync",
            backgroundColor: palette.card,
            textColor: palette.tint,
          },
          {
            label: authStateLabel,
            backgroundColor: palette.accentSoft,
          },
          {
            label: syncStateLabel,
            backgroundColor: palette.card,
          },
        ]}
      />

      <PageQuickActions
        palette={palette}
        title="Stay on top of device and account state"
        description="Jump to sync, alerts, and the main workspace without scrolling through every account, privacy, or authentication setting first."
        actions={pageQuickActions}
      />

      <FeatureSectionSwitcher
        palette={palette}
        label="Feature groups"
        title="Focus on one account layer at a time"
        description="Switch between profile, appearance, AI and alerts, and privacy so the settings page stays easier to navigate."
        items={accountSections}
        activeId={activeSection}
        onChange={setActiveSection}
      />

      <View>
        {activeSection === "appearance" ? (
          <SectionSurface
            palette={palette}
            label="Appearance"
            title="Theme preference"
          >
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              The app defaults to dark mode, and you can switch between light,
              dark, OLED, and monotone light or dark at any time while dialing
              in an accent that feels more like your workspace.
            </Text>
            <SegmentedButtons
              value={themePreference}
              onValueChange={(value: string) =>
                setThemePreference(value as ThemePreference)
              }
              style={styles.themeSelector}
              buttons={THEME_PREFERENCE_OPTIONS.map((value) => ({
                value,
                label: themeOptionLabels[value],
              }))}
            />
            <ChipRow style={styles.themeChipRow}>
              <Chip compact style={styles.themeChip} icon="theme-light-dark">
                Active: {themeOptionLabels[themePreference]}
              </Chip>
              <Chip compact style={styles.themeChip}>
                Accent: {getThemeAccentLabel(themeAccentColor)}
              </Chip>
            </ChipRow>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              OLED uses pure-black backgrounds for the darkest nighttime look.
              Monotone light and dark keep the palette grayscale for focus.
            </Text>
            <View style={styles.accentResetRow}>
              <Text style={[styles.accentResetLabel, paletteStyles.mutedText]}>
                Reset accent to default
              </Text>
              <IconButton
                icon="backup-restore"
                size={20}
                onPress={() => setThemeAccentColor(DEFAULT_THEME_ACCENT_COLOR)}
                disabled={isDefaultAccent}
                accessibilityLabel="Reset accent color"
                iconColor={palette.tint}
                style={[
                  styles.accentResetButton,
                  { backgroundColor: palette.surface2 },
                ]}
              />
            </View>
            <AccentColorPicker
              palette={palette}
              value={themeAccentColor}
              onChange={setThemeAccentColor}
            />
          </SectionSurface>
        ) : null}

        {activeSection === "profile" ? (
          <SectionSurface
            palette={palette}
            label="Authentication"
            title="Current auth status"
          >
            <ChipRow style={styles.themeChipRow}>
              <Chip compact style={styles.themeChip}>
                {auth.clerkPublishableKeyConfigured
                  ? "Clerk configured"
                  : "Clerk key missing"}
              </Chip>
              <Chip compact style={styles.themeChip}>
                {authStateLabel}
              </Chip>
            </ChipRow>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              {auth.note}
            </Text>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              This device keeps anonymous use and each signed-in account in
              separate local workspace storage.
            </Text>
          </SectionSurface>
        ) : null}

        {activeSection === "assistant" ? (
          <SectionSurface
            palette={palette}
            label="AI"
            title={aiAccountSettingsCopy.title}
          >
            <ChipRow style={styles.themeChipRow}>
              <Chip compact style={styles.themeChip} icon="brain">
                OpenRouter BYOK
              </Chip>
              <Chip compact style={styles.themeChip}>
                {aiKeyStatusLabel}
              </Chip>
              <Chip compact style={styles.themeChip}>
                {aiStorageStatusLabel}
              </Chip>
            </ChipRow>
            {!aiPreferences.isLoaded ? (
              <ActivityIndicator style={styles.loader} />
            ) : null}
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              {aiAccountSettingsCopy.intro}
            </Text>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              {aiAccountSettingsCopy.privacySummary}
            </Text>
            <SegmentedButtons
              value={aiPromptHistoryValue}
              onValueChange={(value: string) =>
                void handleAiPromptHistoryChange(value)
              }
              style={styles.themeSelector}
              buttons={[
                {
                  value: "dont-save",
                  label: "Don't save prompts",
                  disabled: isSubmitting,
                },
                {
                  value: "save",
                  label: "Save prompts",
                  disabled: isSubmitting,
                },
              ]}
            />
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              {aiAccountSettingsCopy.promptHistoryDefault}
            </Text>
            <TextInput
              label={
                aiPreferences.hasOpenRouterApiKey
                  ? "Replace OpenRouter API key"
                  : "OpenRouter API key"
              }
              value={openRouterApiKeyInput}
              onChangeText={setOpenRouterApiKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              secureTextEntry
              placeholder="sk-or-v1-..."
              style={styles.aiKeyInput}
              disabled={isSubmitting || !aiPreferences.isLoaded}
            />
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              {aiAccountSettingsCopy.keyReplacementNote}
            </Text>
            {!aiPreferences.isSecureStorageAvailable &&
            aiPreferences.isLoaded ? (
              <Text style={[styles.meta, paletteStyles.mutedText]}>
                {aiAccountSettingsCopy.secureStorageUnavailable}
              </Text>
            ) : null}
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              {aiAccountSettingsCopy.modelSelectionSummary}
            </Text>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              Current model: {aiPreferences.openRouterTextModel}
            </Text>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              {aiAccountSettingsCopy.modelSelectionDefault}
            </Text>
            <Button
              mode="outlined"
              onPress={() => router.push("/openrouter-model-picker")}
              disabled={!aiPreferences.isLoaded || isSubmitting}
              style={styles.button}
            >
              Choose model
            </Button>
            <ChipRow style={styles.themeChipRow}>
              <Chip compact style={styles.themeChip} icon="chart-line">
                {aiTelemetrySummary.generationRequests} requests
              </Chip>
              <Chip
                compact
                style={styles.themeChip}
                icon="check-decagram-outline"
              >
                {aiTelemetrySummary.draftApplies} applied
              </Chip>
              <Chip compact style={styles.themeChip} icon="history">
                {formatAiTelemetryLastEventLabel(
                  aiTelemetrySummary.lastEventAt,
                )}
              </Chip>
            </ChipRow>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              {aiAccountSettingsCopy.telemetrySummary}
            </Text>
            <ChipRow style={styles.themeChipRow}>
              {AI_TELEMETRY_WORKFLOW_SURFACE_CHIPS.map((item) => (
                <Chip key={item.surface} compact style={styles.themeChip}>
                  {item.label}{" "}
                  {
                    aiTelemetrySummary.surfaces[item.surface]
                      .generationSuccesses
                  }
                </Chip>
              ))}
            </ChipRow>
            <ActionButtonRow style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={() => void handleSaveOpenRouterKey()}
                disabled={
                  isSubmitting ||
                  !aiPreferences.isLoaded ||
                  !aiPreferences.isSecureStorageAvailable ||
                  openRouterApiKeyInput.trim().length === 0
                }
                loading={isSubmitting}
                style={styles.inlineButton}
              >
                {aiPreferences.hasOpenRouterApiKey ? "Replace key" : "Save key"}
              </Button>
              <Button
                mode="outlined"
                onPress={() => void handleClearOpenRouterKey()}
                disabled={
                  isSubmitting ||
                  !aiPreferences.hasOpenRouterApiKey ||
                  !aiPreferences.isSecureStorageAvailable
                }
                style={styles.inlineButton}
              >
                Remove key
              </Button>
            </ActionButtonRow>
          </SectionSurface>
        ) : null}

        {activeSection === "assistant" ? (
          <SectionSurface
            palette={palette}
            label="Notifications"
            title="Reminder alerts"
          >
            <ChipRow style={styles.themeChipRow}>
              <Chip compact style={styles.themeChip} icon="bell-ring-outline">
                {reminderNotificationLabel}
              </Chip>
              <Chip compact style={styles.themeChip}>
                {Platform.OS === "web" ? "Web preview" : Platform.OS}
              </Chip>
            </ChipRow>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              TrackItUp can schedule local alerts for upcoming reminders so due
              work reaches you even when the planner is closed.
            </Text>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              Notification taps open the action center, where you can complete,
              snooze, or skip the matching reminder.
            </Text>
            <ActionButtonRow style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={handleReminderNotifications}
                loading={isSubmitting}
                disabled={isSubmitting}
                style={styles.inlineButton}
              >
                {workspace.reminderNotificationPermissionStatus === "granted"
                  ? "Refresh alerts"
                  : workspace.reminderNotificationPermissionStatus ===
                        "denied" && !workspace.canAskForReminderNotifications
                    ? "Open device settings"
                    : "Enable notifications"}
              </Button>
              <Button
                mode="outlined"
                onPress={() => router.push("/action-center")}
                disabled={isSubmitting}
                style={styles.inlineButton}
              >
                Open action center
              </Button>
            </ActionButtonRow>
          </SectionSurface>
        ) : null}

        {activeSection === "privacy" ? (
          <SectionSurface
            palette={palette}
            label="Privacy"
            title="Local protection"
          >
            <ChipRow style={styles.themeChipRow}>
              <Chip compact style={styles.themeChip} icon="shield-check">
                Mode: {getWorkspacePrivacyModeLabel(workspace.privacyMode)}
              </Chip>
              <Chip compact style={styles.themeChip} icon="shield-lock">
                {localProtectionLabel}
              </Chip>
              <Chip compact style={styles.themeChip}>
                Storage: {workspace.persistenceMode}
              </Chip>
            </ChipRow>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              {privacyModeDescription}
            </Text>
            <SegmentedButtons
              value={workspace.privacyMode}
              onValueChange={(value: string) =>
                requestPrivacyModeChange(value as WorkspacePrivacyMode)
              }
              style={styles.themeSelector}
              buttons={WORKSPACE_PRIVACY_MODE_OPTIONS.map((value) => ({
                value,
                label: getWorkspacePrivacyModeLabel(value),
                disabled: isSubmitting || isProtectionBlocked,
              }))}
            />
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              {localProtectionDescription}
            </Text>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              Protected mode keeps anonymous use and each signed-in account in
              separate local scopes when secure local storage is supported.
            </Text>
            <Button
              mode="outlined"
              onPress={() => router.push("/workspace-diagnostics")}
              style={styles.button}
            >
              Open diagnostics
            </Button>
            {isProtectionBlocked ? (
              <Text style={[styles.meta, paletteStyles.mutedText]}>
                Privacy mode changes stay disabled until the blocked protected
                workspace is reset for this scope.
              </Text>
            ) : null}
            {isProtectionBlocked ? (
              <Button
                mode="contained"
                onPress={() => runAction(workspace.recoverBlockedWorkspace)}
                style={styles.button}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                Reset blocked protected workspace
              </Button>
            ) : null}
          </SectionSurface>
        ) : null}

        {activeSection === "privacy" ? (
          <SectionSurface
            palette={palette}
            label="Biometric lock"
            title="Protected workspace gate"
          >
            <ChipRow style={styles.themeChipRow}>
              <Chip compact style={styles.themeChip} icon="fingerprint">
                {workspace.biometricLockEnabled ? "Enabled" : "Disabled"}
              </Chip>
              <Chip compact style={styles.themeChip}>
                {workspace.biometricAvailability.label}
              </Chip>
              <Chip compact style={styles.themeChip}>
                Re-auth:{" "}
                {getWorkspaceBiometricReauthTimeoutLabel(
                  workspace.biometricReauthTimeout,
                )}
              </Chip>
            </ChipRow>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              {biometricDescription}
            </Text>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              When enabled, protected local workspaces stay locked until
              biometric or device-credential verification succeeds on this
              device.
            </Text>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              {biometricReauthDescription}
            </Text>
            <SegmentedButtons
              value={workspace.biometricReauthTimeout}
              onValueChange={(value: string) =>
                runAction(() =>
                  workspace.setBiometricReauthTimeout(
                    value as WorkspaceBiometricReauthTimeout,
                  ),
                )
              }
              style={styles.themeSelector}
              buttons={WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_OPTIONS.map(
                (value) => ({
                  value,
                  label: getWorkspaceBiometricReauthTimeoutLabel(value),
                  disabled: isSubmitting,
                }),
              )}
            />
            <Button
              mode={workspace.biometricLockEnabled ? "outlined" : "contained"}
              onPress={() =>
                runAction(() =>
                  workspace.setBiometricLockEnabled(
                    !workspace.biometricLockEnabled,
                  ),
                )
              }
              style={styles.button}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {workspace.biometricLockEnabled
                ? "Disable biometric lock"
                : "Enable biometric lock"}
            </Button>
          </SectionSurface>
        ) : null}

        {activeSection === "profile" && !auth.clerkPublishableKeyConfigured ? (
          <SectionSurface
            palette={palette}
            label="Setup"
            title="Enable sign-in"
          >
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Add `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to your Expo environment
              to activate Clerk sign-in. Until then, the app remains fully
              local-first.
            </Text>
            <Button
              mode="contained"
              onPress={() => router.replace("/(tabs)")}
              style={styles.button}
            >
              Continue without login
            </Button>
          </SectionSurface>
        ) : activeSection === "profile" && !auth.isLoaded ? (
          <SectionSurface
            palette={palette}
            label="Loading"
            title="Loading authentication"
          >
            <ActivityIndicator style={styles.loader} />
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Clerk is initializing securely on this device.
            </Text>
          </SectionSurface>
        ) : activeSection === "profile" && auth.isSignedIn ? (
          <SectionSurface palette={palette} label="Identity" title="Signed in">
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Name: {auth.displayName ?? "Unnamed user"}
            </Text>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Email: {auth.primaryEmailAddress ?? "No primary email returned"}
            </Text>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              User ID: {auth.userId ?? "Unavailable"}
            </Text>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              This signed-in account uses its own local workspace on this
              device.
            </Text>
            <ActionButtonRow style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={() => router.replace("/(tabs)")}
                style={styles.inlineButton}
              >
                Return to workspace
              </Button>
              <Button
                mode="outlined"
                onPress={handleSignOut}
                style={styles.inlineButton}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                Sign out
              </Button>
            </ActionButtonRow>
          </SectionSurface>
        ) : activeSection === "profile" ? (
          <SectionSurface
            palette={palette}
            label="Identity"
            title="Optional sign-in"
          >
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Use Clerk to connect this device to future premium sync, backups,
              and multi-device access. You can still continue locally without
              signing in.
            </Text>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              Signing in switches this device to that account&apos;s separate
              local workspace. Anonymous data is not merged automatically.
            </Text>
            <Button
              mode="contained"
              onPress={() =>
                runAction(auth.signInWithGoogle, {
                  returnToWorkspaceOnSuccess: true,
                })
              }
              style={styles.button}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Sign in with Google
            </Button>
            {Platform.OS === "ios" ? (
              <Button
                mode="outlined"
                onPress={() =>
                  runAction(auth.signInWithApple, {
                    returnToWorkspaceOnSuccess: true,
                  })
                }
                style={styles.button}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                Sign in with Apple
              </Button>
            ) : null}
            <Button
              mode="text"
              onPress={() => router.replace("/(tabs)")}
              style={styles.button}
            >
              Continue without login
            </Button>
          </SectionSurface>
        ) : null}

        {activeSection === "profile" ? (
          <SectionSurface
            palette={palette}
            label="Cloud sync"
            title="Premium sync status"
          >
            <ChipRow style={styles.themeChipRow}>
              <Chip compact style={styles.themeChip}>
                {syncStateLabel}
              </Chip>
              <Chip compact style={styles.themeChip}>
                Snapshot: {lastLocalSnapshot}
              </Chip>
            </ChipRow>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Pending queued changes: {workspace.workspace.syncQueue.length}
            </Text>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Local snapshot: {lastLocalSnapshot}
            </Text>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Last sync:{" "}
              {workspace.workspace.lastSyncAt
                ? new Date(workspace.workspace.lastSyncAt).toLocaleString()
                : "No successful sync yet"}
            </Text>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Last error: {workspace.workspace.lastSyncError ?? "None"}
            </Text>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Configure EXPO_PUBLIC_TRACKITUP_SYNC_ENDPOINT and
              EXPO_PUBLIC_TRACKITUP_SYNC_ALLOWED_HOSTS to enable push, pull, and
              force-restore cloud backups when Clerk auth is available.
            </Text>
            <Button
              mode="contained"
              onPress={() => runAction(workspace.syncWorkspaceNow)}
              style={styles.button}
              loading={isSubmitting || workspace.isSyncing}
              disabled={
                isSubmitting || workspace.isSyncing || isProtectionBlocked
              }
            >
              Sync now
            </Button>
            <ActionButtonRow style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={() => runAction(workspace.pullWorkspaceFromCloud)}
                style={styles.inlineButton}
                loading={isSubmitting || workspace.isSyncing}
                disabled={
                  isSubmitting || workspace.isSyncing || isProtectionBlocked
                }
              >
                Pull latest backup
              </Button>
              <Button
                mode="text"
                onPress={() => runAction(workspace.restoreWorkspaceFromCloud)}
                style={styles.inlineButton}
                loading={isSubmitting || workspace.isSyncing}
                disabled={
                  isSubmitting || workspace.isSyncing || isProtectionBlocked
                }
              >
                Force restore
              </Button>
            </ActionButtonRow>
            {isProtectionBlocked ? (
              <Text style={[styles.meta, paletteStyles.mutedText]}>
                Cloud sync actions stay disabled until the blocked protected
                workspace is reset for this scope.
              </Text>
            ) : null}
          </SectionSurface>
        ) : null}
      </View>

      <SectionMessage
        palette={palette}
        label="Session"
        title="Session feedback"
        message={statusMessage}
      />

      <Portal>
        <Dialog
          visible={pendingPrivacyModeChange !== null}
          onDismiss={() => setPendingPrivacyModeChange(null)}
        >
          <Dialog.Title>
            Switch to{" "}
            {pendingPrivacyModeChange
              ? getWorkspacePrivacyModeLabel(pendingPrivacyModeChange)
              : "selected"}
            ?
          </Dialog.Title>
          <Dialog.Content>
            <Text>
              {pendingPrivacyModeChange === "compatibility"
                ? "Compatibility mode rewrites this scope back to the legacy local persistence path on this device and removes encrypted local snapshots for the current scope."
                : "Protected mode prefers encrypted local snapshots for this scope and migrates readable compatibility data into protected storage on this device when available."}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingPrivacyModeChange(null)}>
              Cancel
            </Button>
            <Button onPress={() => void confirmPrivacyModeChange()}>
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  copy: { ...uiTypography.body, marginBottom: 6 },
  meta: { ...uiTypography.label, marginTop: uiSpace.xxs, lineHeight: 18 },
  loader: { marginVertical: uiSpace.lg },
  button: { marginTop: uiSpace.md, alignSelf: "flex-end" },
  buttonRow: { marginTop: uiSpace.md },
  inlineButton: { alignSelf: "flex-start" },
  aiKeyInput: { marginTop: uiSpace.md },
  themeSelector: { marginTop: uiSpace.md },
  themeChipRow: {
    marginTop: uiSpace.lg,
    marginBottom: uiSpace.xs,
  },
  themeChip: { borderRadius: uiRadius.pill },
  accentResetRow: {
    marginTop: uiSpace.sm,
    marginBottom: uiSpace.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accentResetLabel: {
    ...uiTypography.bodySmall,
  },
  accentResetButton: {
    borderRadius: uiRadius.pill,
  },
});
