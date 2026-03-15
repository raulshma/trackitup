import { Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip } from "react-native-paper";

import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { ChipRow } from "@/components/ui/ChipRow";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import { uiSpace, uiTypography } from "@/constants/UiTokens";
import { useAppAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { isWatermelonPersistenceAvailable } from "@/services/offline/watermelon/workspaceDatabase";
import { isWorkspaceEncryptionAvailable } from "@/services/offline/workspaceEncryption";
import { getWorkspaceOwnerScopeKey } from "@/services/offline/workspaceOwnership";

type DiagnosticsState = {
  platform: string;
  platformVersion: string;
  ownerScopeKey: string;
  hasLocalStorage: boolean;
  hasDocumentPath: boolean;
  documentUri: string | null;
  hasCachePath: boolean;
  asyncStorageAvailable: boolean;
  secureStoreAvailable: boolean;
  encryptionAvailable: boolean;
  watermelonAvailable: boolean;
  lastCheckedAt: string;
};

function boolLabel(value: boolean) {
  return value ? "Yes" : "No";
}

export default function WorkspaceDiagnosticsScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const auth = useAppAuth();
  const workspace = useWorkspace();
  const ownerScopeKey = useMemo(
    () => getWorkspaceOwnerScopeKey(auth.isSignedIn ? auth.userId : null),
    [auth.isSignedIn, auth.userId],
  );

  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({
    platform: Platform.OS,
    platformVersion: String(Platform.Version ?? "unknown"),
    ownerScopeKey,
    hasLocalStorage: false,
    hasDocumentPath: false,
    documentUri: null,
    hasCachePath: false,
    asyncStorageAvailable: false,
    secureStoreAvailable: false,
    encryptionAvailable: false,
    watermelonAvailable: false,
    lastCheckedAt: "Not checked yet",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshDiagnostics() {
    setIsRefreshing(true);
    try {
      const [asyncStorageAvailable, secureStoreAvailable, encryptionAvailable] =
        await Promise.all([
          (async () => {
            try {
              const asyncStorageModule =
                await import("@react-native-async-storage/async-storage");
              const storage = (asyncStorageModule as { default?: unknown })
                .default as {
                getItem?: unknown;
                setItem?: unknown;
                removeItem?: unknown;
              };
              return Boolean(
                storage &&
                typeof storage.getItem === "function" &&
                typeof storage.setItem === "function" &&
                typeof storage.removeItem === "function",
              );
            } catch {
              return false;
            }
          })(),
          (async () => {
            try {
              const secureStore = await import("expo-secure-store");
              return typeof secureStore.isAvailableAsync === "function"
                ? await secureStore.isAvailableAsync()
                : false;
            } catch {
              return false;
            }
          })(),
          isWorkspaceEncryptionAvailable(),
        ]);

      const maybeLocalStorage = (
        globalThis as typeof globalThis & {
          localStorage?: unknown;
        }
      ).localStorage;

      setDiagnostics({
        platform: Platform.OS,
        platformVersion: String(Platform.Version ?? "unknown"),
        ownerScopeKey,
        hasLocalStorage: Boolean(maybeLocalStorage),
        hasDocumentPath: Boolean(Paths.document?.uri || Paths.document),
        documentUri:
          typeof Paths.document?.uri === "string" ? Paths.document.uri : null,
        hasCachePath: Boolean(Paths.cache?.uri || Paths.cache),
        asyncStorageAvailable,
        secureStoreAvailable,
        encryptionAvailable,
        watermelonAvailable: isWatermelonPersistenceAvailable(),
        lastCheckedAt: new Date().toLocaleString(),
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshDiagnostics();
  }, [ownerScopeKey]);

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
        title="Workspace diagnostics"
        subtitle="Inspect local storage capabilities, protection state, and runtime details for this device scope."
        badges={[
          {
            label: `Storage: ${workspace.persistenceMode}`,
            backgroundColor: palette.card,
            textColor: palette.tint,
          },
          {
            label: `Protection: ${workspace.localProtectionStatus}`,
            backgroundColor: palette.accentSoft,
          },
          {
            label: diagnostics.platform,
            backgroundColor: palette.card,
          },
        ]}
      />

      <SectionSurface
        palette={palette}
        label="Current workspace"
        title="Live persistence state"
      >
        <ChipRow style={styles.chipRow}>
          <Chip compact style={styles.chip}>
            Mode: {workspace.persistenceMode}
          </Chip>
          <Chip compact style={styles.chip}>
            Privacy: {workspace.privacyMode}
          </Chip>
          <Chip compact style={styles.chip}>
            Protection: {workspace.localProtectionStatus}
          </Chip>
        </ChipRow>
        <Text style={[styles.meta, paletteStyles.mutedText]}>
          Scope key: {diagnostics.ownerScopeKey}
        </Text>
        <Text style={[styles.meta, paletteStyles.mutedText]}>
          Last workspace snapshot:{" "}
          {new Date(workspace.workspace.generatedAt).toLocaleString()}
        </Text>
      </SectionSurface>

      <SectionSurface
        palette={palette}
        label="Runtime checks"
        title="Storage capability matrix"
      >
        <View style={styles.list}>
          <Text style={styles.item}>Platform: {diagnostics.platform}</Text>
          <Text style={styles.item}>
            Platform version: {diagnostics.platformVersion}
          </Text>
          <Text style={styles.item}>
            AsyncStorage available:{" "}
            {boolLabel(diagnostics.asyncStorageAvailable)}
          </Text>
          <Text style={styles.item}>
            SecureStore available: {boolLabel(diagnostics.secureStoreAvailable)}
          </Text>
          <Text style={styles.item}>
            Encryption available: {boolLabel(diagnostics.encryptionAvailable)}
          </Text>
          <Text style={styles.item}>
            Watermelon available: {boolLabel(diagnostics.watermelonAvailable)}
          </Text>
          <Text style={styles.item}>
            localStorage present on globalThis:{" "}
            {boolLabel(diagnostics.hasLocalStorage)}
          </Text>
          <Text style={styles.item}>
            File-system document path available:{" "}
            {boolLabel(diagnostics.hasDocumentPath)}
          </Text>
          <Text style={styles.item}>
            File-system cache path available:{" "}
            {boolLabel(diagnostics.hasCachePath)}
          </Text>
          <Text style={[styles.item, paletteStyles.mutedText]}>
            Document URI: {diagnostics.documentUri ?? "Unavailable"}
          </Text>
          <Text style={[styles.item, paletteStyles.mutedText]}>
            Last checked: {diagnostics.lastCheckedAt}
          </Text>
        </View>

        <ActionButtonRow style={styles.actions}>
          <Button
            mode="contained"
            onPress={() => void refreshDiagnostics()}
            loading={isRefreshing}
            disabled={isRefreshing}
          >
            Refresh diagnostics
          </Button>
          <Button mode="outlined" onPress={() => router.back()}>
            Back
          </Button>
        </ActionButtonRow>
      </SectionSurface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  chipRow: { marginTop: uiSpace.md, marginBottom: uiSpace.xs },
  chip: {},
  list: { marginTop: uiSpace.sm, gap: uiSpace.xs },
  item: { ...uiTypography.body },
  meta: { ...uiTypography.label, marginTop: uiSpace.xs },
  actions: { marginTop: uiSpace.lg },
});
