import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet } from "react-native";
import {
    ActivityIndicator,
    Button,
    Chip,
    SegmentedButtons,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { ChipRow } from "@/components/ui/ChipRow";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import { uiRadius, uiSpace, uiTypography } from "@/constants/UiTokens";
import { useAppAuth } from "@/providers/AuthProvider";
import { useThemePreference } from "@/providers/ThemePreferenceProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
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
    THEME_PREFERENCE_OPTIONS,
    type ThemePreference,
} from "@/services/theme/themePreferences";

const themeOptionLabels: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  oled: "OLED",
};

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const auth = useAppAuth();
  const workspace = useWorkspace();
  const { themePreference, setThemePreference } = useThemePreference();
  const [statusMessage, setStatusMessage] = useState(auth.note);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const isProtectionBlocked = workspace.localProtectionStatus === "blocked";

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

  return (
    <ScrollView
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={styles.content}
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

      <SectionSurface
        palette={palette}
        label="Appearance"
        title="Theme preference"
      >
        <Text style={[styles.copy, paletteStyles.mutedText]}>
          The app defaults to dark mode, and you can switch between light, dark,
          and OLED at any time.
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
            Default: Dark
          </Chip>
        </ChipRow>
        <Text style={[styles.meta, paletteStyles.mutedText]}>
          OLED uses pure-black backgrounds for the darkest nighttime look.
        </Text>
      </SectionSurface>

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
        <Text style={[styles.copy, paletteStyles.mutedText]}>{auth.note}</Text>
        <Text style={[styles.meta, paletteStyles.mutedText]}>
          This device keeps anonymous use and each signed-in account in separate
          local workspace storage.
        </Text>
      </SectionSurface>

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
            runAction(() =>
              workspace.setWorkspacePrivacyMode(value as WorkspacePrivacyMode),
            )
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

      {!auth.clerkPublishableKeyConfigured ? (
        <SectionSurface palette={palette} label="Setup" title="Enable sign-in">
          <Text style={[styles.copy, paletteStyles.mutedText]}>
            Add `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to your Expo environment to
            activate Clerk sign-in. Until then, the app remains fully
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
      ) : !auth.isLoaded ? (
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
      ) : auth.isSignedIn ? (
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
            This signed-in account uses its own local workspace on this device.
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
      ) : (
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
      )}

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
          Configure EXPO_PUBLIC_TRACKITUP_SYNC_ENDPOINT to enable push, pull,
          and force-restore cloud backups when Clerk auth is available.
        </Text>
        <Button
          mode="contained"
          onPress={() => runAction(workspace.syncWorkspaceNow)}
          style={styles.button}
          loading={isSubmitting || workspace.isSyncing}
          disabled={isSubmitting || workspace.isSyncing || isProtectionBlocked}
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

      <SectionMessage
        palette={palette}
        label="Session"
        title="Session feedback"
        message={statusMessage}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  copy: { ...uiTypography.body, marginBottom: 6 },
  meta: { ...uiTypography.label, marginTop: uiSpace.xxs, lineHeight: 18 },
  loader: { marginVertical: uiSpace.lg },
  button: { marginTop: uiSpace.md },
  buttonRow: { marginTop: uiSpace.md },
  inlineButton: { flex: 1 },
  themeSelector: { marginTop: uiSpace.md },
  themeChipRow: {
    marginTop: uiSpace.lg,
    marginBottom: uiSpace.xs,
  },
  themeChip: { borderRadius: uiRadius.pill },
});
