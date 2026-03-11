import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import {
    Button,
    Chip,
    SegmentedButtons,
    Surface,
    TextInput,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { ChipRow } from "@/components/ui/ChipRow";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    uiBorder,
    uiRadius,
    uiSize,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useThemePreference } from "@/providers/ThemePreferenceProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
    getCameraPermissionStatusAsync,
    getLastKnownLocationPreviewAsync,
    getLocationPermissionStatusAsync,
    requestCameraPermissionAsync,
    requestLocationPermissionAsync,
} from "@/services/device/deviceCapabilities";
import {
    exportWorkspaceJsonAsync,
    exportWorkspaceLogsCsvAsync,
    exportWorkspaceSummaryPdfAsync,
} from "@/services/export/workspaceExport";
import type { ThemePreference } from "@/services/theme/themePreferences";

const themeOptionLabels: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  oled: "OLED",
};

function formatPermissionSummary(permission: {
  granted?: boolean;
  canAskAgain?: boolean;
  status?: string;
}) {
  if (permission.granted) return "Granted";
  if (permission.canAskAgain)
    return `Needs permission (${permission.status ?? "prompt"})`;
  return `Blocked (${permission.status ?? "denied"})`;
}

export default function WorkspaceToolsScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const { themePreference, setThemePreference } = useThemePreference();
  const { importLogsFromCsv, workspace } = useWorkspace();
  const [toolMessage, setToolMessage] = useState<string | null>(null);
  const [csvInput, setCsvInput] = useState("");
  const [templateImportUrl, setTemplateImportUrl] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Not checked yet");
  const [locationStatus, setLocationStatus] = useState("Not checked yet");
  const [locationPreview, setLocationPreview] = useState<string | null>(null);

  useEffect(() => {
    void refreshDeviceCapabilities();
  }, []);

  async function refreshDeviceCapabilities() {
    setIsWorking(true);

    try {
      const [cameraPermission, locationPermission, lastLocation] =
        await Promise.all([
          getCameraPermissionStatusAsync(),
          getLocationPermissionStatusAsync(),
          getLastKnownLocationPreviewAsync(),
        ]);

      setCameraStatus(formatPermissionSummary(cameraPermission));
      setLocationStatus(formatPermissionSummary(locationPermission));
      setLocationPreview(
        lastLocation
          ? `${lastLocation.latitude.toFixed(4)}, ${lastLocation.longitude.toFixed(4)} • ±${Math.round(lastLocation.accuracy ?? 0)}m`
          : null,
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function runTool(action: () => Promise<string>) {
    setIsWorking(true);

    try {
      setToolMessage(await action());
    } catch (error) {
      setToolMessage(
        error instanceof Error
          ? error.message
          : "The workspace tool could not be completed.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleRequestCamera() {
    await runTool(async () => {
      const permission = await requestCameraPermissionAsync();
      setCameraStatus(formatPermissionSummary(permission));
      return permission.granted
        ? "Camera permission granted for scans and media capture."
        : "Camera permission was not granted.";
    });
  }

  async function handleRequestLocation() {
    await runTool(async () => {
      const permission = await requestLocationPermissionAsync();
      setLocationStatus(formatPermissionSummary(permission));

      if (!permission.granted) {
        setLocationPreview(null);
        return "Location permission was not granted.";
      }

      const lastLocation = await getLastKnownLocationPreviewAsync();
      setLocationPreview(
        lastLocation
          ? `${lastLocation.latitude.toFixed(4)}, ${lastLocation.longitude.toFixed(4)} • ±${Math.round(lastLocation.accuracy ?? 0)}m`
          : null,
      );

      return lastLocation
        ? "Location permission granted and the last known preview was refreshed."
        : "Location permission granted. No last known location is available yet.";
    });
  }

  function handleImportCsv() {
    const result = importLogsFromCsv(csvInput);
    const warningSummary = result.warnings.length
      ? ` ${result.warnings.slice(0, 2).join(" ")}`
      : "";

    setToolMessage(
      result.importedCount > 0
        ? `Imported ${result.importedCount} log(s) into the local workspace.${warningSummary}`
        : `No logs were imported.${warningSummary || " Check the required CSV columns and try again."}`,
    );

    if (result.importedCount > 0) {
      setCsvInput("");
    }
  }

  async function handleImportCsvFile() {
    await runTool(async () => {
      const picked = await File.pickFileAsync(undefined, "text/csv");
      const selectedFile = Array.isArray(picked) ? picked[0] : picked;
      const csvText = await selectedFile.text();
      const result = importLogsFromCsv(csvText);
      const warningSummary = result.warnings.length
        ? ` ${result.warnings.slice(0, 2).join(" ")}`
        : "";

      if (result.importedCount > 0) {
        setCsvInput("");
      } else {
        setCsvInput(csvText);
      }

      return result.importedCount > 0
        ? `Imported ${result.importedCount} log(s) from ${selectedFile.name}.${warningSummary}`
        : `No logs were imported from ${selectedFile.name}.${warningSummary || " Check the CSV columns and try again."}`;
    });
  }

  const pageQuickActions = [
    {
      id: "workspace-tools-export",
      label: "Export JSON",
      hint: `${workspace.logs.length} log${workspace.logs.length === 1 ? "" : "s"} and ${workspace.assets.length} asset${workspace.assets.length === 1 ? "" : "s"} are ready to travel with the workspace snapshot.`,
      onPress: () =>
        runTool(async () => {
          const uri = await exportWorkspaceJsonAsync(workspace);
          return `JSON export created at ${uri}`;
        }),
      accentColor: palette.tint,
      disabled: isWorking,
    },
    {
      id: "workspace-tools-template",
      label:
        templateImportUrl.trim().length > 0
          ? "Review import link"
          : "Scan template QR",
      hint:
        templateImportUrl.trim().length > 0
          ? "Open the pasted TrackItUp link and review it before importing."
          : `${workspace.templates.length} template${workspace.templates.length === 1 ? "" : "s"} already live in your local catalog.`,
      onPress: () =>
        templateImportUrl.trim().length > 0
          ? router.push({
              pathname: "/template-import",
              params: { url: templateImportUrl.trim(), source: "deep-link" },
            })
          : router.push("/scanner" as never),
      accentColor: palette.secondary,
      disabled: isWorking,
    },
    {
      id: "workspace-tools-refresh",
      label: "Refresh device status",
      hint: `${cameraStatus} camera • ${locationStatus} location`,
      onPress: () => void refreshDeviceCapabilities(),
      disabled: isWorking,
    },
  ];

  return (
    <ScrollView
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={styles.content}
    >
      <ScreenHero
        palette={palette}
        title="TrackItUp workspace tools"
        subtitle="Export, import, and device capability checks for your real workspace data."
        badges={[
          {
            label: "Workspace tools",
            backgroundColor: palette.card,
            textColor: palette.tint,
          },
          {
            label: `${workspace.templates.length} templates`,
            backgroundColor: palette.accentSoft,
          },
        ]}
      />

      <PageQuickActions
        palette={palette}
        title="Jump to the tools you need most"
        description="Export the workspace, move a shared template into review, or refresh device readiness before diving into the longer tool sections below."
        actions={pageQuickActions}
      />

      <SectionSurface
        palette={palette}
        label="Appearance"
        title="Choose your default app theme"
        style={styles.sectionCardSpacing}
      >
        <Text style={[styles.listText, paletteStyles.mutedText]}>
          TrackItUp now defaults to dark mode. Switch between light, dark, and
          OLED whenever you want.
        </Text>
        <SegmentedButtons
          value={themePreference}
          onValueChange={(value: string) =>
            setThemePreference(value as ThemePreference)
          }
          style={styles.themeSelector}
          buttons={(Object.keys(themeOptionLabels) as ThemePreference[]).map(
            (value) => ({
              value,
              label: themeOptionLabels[value],
            }),
          )}
        />
        <ChipRow style={styles.statusChipRow}>
          <Chip compact style={styles.statusChip} icon="theme-light-dark">
            Active: {themeOptionLabels[themePreference]}
          </Chip>
          <Chip compact style={styles.statusChip}>
            Default: Dark
          </Chip>
        </ChipRow>
        <Text style={[styles.helperText, paletteStyles.mutedText]}>
          OLED uses pure-black backgrounds for a darker nighttime look and can
          reduce power usage on compatible displays.
        </Text>
      </SectionSurface>

      <SectionSurface
        palette={palette}
        label="Data portability"
        title="Export or import workspace history"
        style={styles.sectionCardSpacing}
      >
        <Text style={[styles.listText, paletteStyles.mutedText]}>
          Export the live workspace snapshot as JSON, CSV, or PDF. Paste CSV
          rows below or pick a CSV file to bulk import log history into your
          current local workspace.
        </Text>
        <Text style={[styles.helperText, paletteStyles.mutedText]}>
          Current snapshot: {workspace.spaces.length} spaces •{" "}
          {workspace.logs.length} logs • {workspace.assets.length} assets
        </Text>

        <ActionButtonRow style={styles.toolButtonRow}>
          <Button
            mode="contained"
            onPress={() =>
              runTool(async () => {
                const uri = await exportWorkspaceJsonAsync(workspace);
                return `JSON export created at ${uri}`;
              })
            }
            style={styles.toolButton}
            disabled={isWorking}
          >
            Export JSON
          </Button>
          <Button
            mode="contained-tonal"
            onPress={() =>
              runTool(async () => {
                const uri = await exportWorkspaceLogsCsvAsync(workspace);
                return `CSV log export created at ${uri}`;
              })
            }
            style={styles.toolButton}
            disabled={isWorking}
          >
            Export CSV
          </Button>
          <Button
            mode="outlined"
            onPress={() =>
              runTool(async () => {
                const uri = await exportWorkspaceSummaryPdfAsync(workspace);
                return `PDF summary created at ${uri}`;
              })
            }
            style={styles.toolButton}
            disabled={isWorking}
          >
            Export PDF
          </Button>
        </ActionButtonRow>

        <TextInput
          label="Paste CSV log rows"
          mode="outlined"
          multiline
          value={csvInput}
          onChangeText={setCsvInput}
          placeholder={"title,spaceId,kind,occurredAt,note,tags,cost"}
          style={styles.csvInput}
        />
        <Text style={[styles.helperText, paletteStyles.mutedText]}>
          Required columns: `title` plus either `spaceId` or `spaceName`.
          Optional columns: `kind`, `occurredAt`, `note`, `tags`, `cost`,
          `locationLabel`, `attachmentsCount`, `assetIds`.
        </Text>
        <ActionButtonRow style={styles.toolButtonRow}>
          <Button
            mode="contained"
            onPress={handleImportCsv}
            disabled={isWorking || csvInput.trim().length === 0}
            style={styles.toolButton}
          >
            Import pasted CSV
          </Button>
          <Button
            mode="outlined"
            onPress={() => void handleImportCsvFile()}
            disabled={isWorking}
            style={styles.toolButton}
          >
            Pick CSV file
          </Button>
        </ActionButtonRow>
      </SectionSurface>

      <SectionSurface
        palette={palette}
        label="Template import"
        title="Bring in shared TrackItUp templates"
        style={styles.sectionCardSpacing}
      >
        <Text style={[styles.listText, paletteStyles.mutedText]}>
          Paste a shared TrackItUp template link or scan a QR code to import
          community or official templates into the local catalog.
        </Text>
        <Text style={[styles.helperText, paletteStyles.mutedText]}>
          Current catalog: {workspace.templates.length} templates. Paste a full
          TrackItUp import URL or scan a QR code below.
        </Text>
        <TextInput
          label="Paste template import link"
          mode="outlined"
          multiline
          value={templateImportUrl}
          onChangeText={setTemplateImportUrl}
          placeholder="trackitup://template-import?..."
          style={styles.csvInput}
        />
        <ActionButtonRow style={styles.toolButtonRow}>
          <Button
            mode="contained"
            onPress={() =>
              router.push({
                pathname: "/template-import",
                params: { url: templateImportUrl.trim(), source: "deep-link" },
              })
            }
            disabled={isWorking || templateImportUrl.trim().length === 0}
            style={styles.toolButton}
          >
            Import link
          </Button>
          <Button
            mode="outlined"
            onPress={() => router.push("/scanner" as never)}
            disabled={isWorking}
            style={styles.toolButton}
          >
            Scan QR code
          </Button>
        </ActionButtonRow>
      </SectionSurface>

      <SectionSurface
        palette={palette}
        label="Hardware capabilities"
        title="Check camera and location readiness"
        style={styles.sectionCardSpacing}
      >
        <Text style={[styles.listText, paletteStyles.mutedText]}>
          Validate the camera and location foundations used for barcode
          scanning, media capture, and geotagged logs.
        </Text>
        <ChipRow style={styles.statusChipRow}>
          <Chip compact style={styles.statusChip} icon="camera-outline">
            {cameraStatus}
          </Chip>
          <Chip compact style={styles.statusChip} icon="map-marker-outline">
            {locationStatus}
          </Chip>
        </ChipRow>
        <Text style={[styles.helperText, paletteStyles.mutedText]}>
          Camera: {cameraStatus}
        </Text>
        <Text style={[styles.helperText, paletteStyles.mutedText]}>
          Location: {locationStatus}
        </Text>
        <Text style={[styles.helperText, paletteStyles.mutedText]}>
          Last known location:{" "}
          {locationPreview ??
            "Unavailable until permission is granted and the device has a cached fix."}
        </Text>
        <ActionButtonRow style={styles.toolButtonRow}>
          <Button
            mode="contained"
            onPress={handleRequestCamera}
            style={styles.toolButton}
            disabled={isWorking}
          >
            Request camera
          </Button>
          <Button
            mode="contained-tonal"
            onPress={handleRequestLocation}
            style={styles.toolButton}
            disabled={isWorking}
          >
            Request location
          </Button>
          <Button
            mode="outlined"
            onPress={() => void refreshDeviceCapabilities()}
            style={styles.toolButton}
            disabled={isWorking}
          >
            Refresh status
          </Button>
          <Button
            mode="outlined"
            onPress={() => router.push("/scanner" as never)}
            style={styles.toolButton}
            disabled={isWorking}
          >
            Open scanner
          </Button>
        </ActionButtonRow>
      </SectionSurface>

      {toolMessage ? (
        <SectionMessage
          palette={palette}
          label="Last action"
          title="Latest workspace tool result"
          style={styles.sectionCardSpacing}
          message={toolMessage}
        />
      ) : null}

      <Surface
        style={[styles.footnoteCard, paletteStyles.cardSurface]}
        elevation={1}
      >
        <Text style={styles.footnoteTitle}>Workspace note</Text>
        <Text style={[styles.footnoteCopy, paletteStyles.mutedText]}>
          This screen only exposes tools and checks for your current workspace,
          not seeded sample content.
        </Text>
      </Surface>

      <StatusBar style={colorScheme === "light" ? "dark" : "light"} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: uiSpace.screen,
    paddingBottom: uiSpace.screenBottom,
  },
  sectionCardSpacing: {
    marginBottom: uiSpace.xl,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: uiSpace.md,
  },
  coverageItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: uiSpace.lg,
    marginBottom: uiSpace.lg,
  },
  coverageCopy: {
    flex: 1,
  },
  coverageTitle: { ...uiTypography.bodyStrong, marginBottom: uiSpace.xs },
  toolButtonRow: {
    marginTop: uiSpace.lg,
    marginBottom: uiSpace.lg,
  },
  toolButton: {
    flexGrow: 1,
  },
  themeSelector: {
    marginTop: uiSpace.xl,
  },
  csvInput: {
    marginTop: uiSpace.lg,
    marginBottom: uiSpace.md,
    minHeight: 136,
  },
  helperText: {
    ...uiTypography.support,
    marginBottom: uiSpace.sm,
  },
  statusChipRow: {
    marginTop: uiSpace.lg,
    marginBottom: uiSpace.sm,
  },
  statusChip: {
    borderRadius: uiRadius.pill,
  },
  statusPill: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.pill,
    paddingHorizontal: uiSpace.md,
    paddingVertical: 5,
  },
  statusPillLabel: {
    ...uiTypography.microLabel,
    textTransform: "uppercase",
  },
  dot: {
    width: uiSize.statusDot,
    height: uiSize.statusDot,
    borderRadius: uiRadius.pill,
    marginTop: 6,
    marginRight: uiSpace.lg,
  },
  listText: {
    flex: 1,
    ...uiTypography.body,
  },
  footnoteCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    marginTop: uiSpace.xs,
  },
  footnoteTitle: { ...uiTypography.titleMd, marginBottom: 6 },
  footnoteCopy: uiTypography.body,
});
