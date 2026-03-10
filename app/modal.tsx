import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet } from "react-native";
import { Button, TextInput } from "react-native-paper";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import {
    requirementCoverage,
    roadmapSections,
} from "@/constants/TrackItUpData";
import { getFoundationSections } from "@/constants/TrackItUpFoundations";
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

const statusColors = {
  implemented: "#16a34a",
  partial: "#d97706",
  blocked: "#dc2626",
} as const;

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

export default function ModalScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const router = useRouter();
  const foundationSections = getFoundationSections();
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

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>TrackItUp workspace tools</Text>
      <Text style={[styles.subtitle, { color: palette.muted }]}>
        Export, import, and device capability checks now live alongside the
        requirement coverage view so this screen can act as a real progress and
        validation hub.
      </Text>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>DATA PORTABILITY</Text>
        <Text style={[styles.listText, { color: palette.muted }]}>
          Export the live workspace snapshot as JSON, CSV, or PDF. Paste CSV
          rows below or pick a CSV file to bulk import log history into your
          current local workspace.
        </Text>
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Current snapshot: {workspace.spaces.length} spaces •{" "}
          {workspace.logs.length} logs • {workspace.assets.length} assets
        </Text>

        <View style={styles.toolButtonRow}>
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
        </View>

        <TextInput
          label="Paste CSV log rows"
          mode="outlined"
          multiline
          value={csvInput}
          onChangeText={setCsvInput}
          placeholder={
            'title,spaceName,kind,occurredAt,note,tags,cost\n"Water change","100G Reef Tank","asset-update","2026-03-09T08:00:00Z","20% change","water;maintenance","12.5"'
          }
          style={styles.csvInput}
        />
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Required columns: `title` plus either `spaceId` or `spaceName`.
          Optional columns: `kind`, `occurredAt`, `note`, `tags`, `cost`,
          `locationLabel`, `attachmentsCount`, `assetIds`.
        </Text>
        <View style={styles.toolButtonRow}>
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
        </View>
      </View>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>TEMPLATE IMPORT</Text>
        <Text style={[styles.listText, { color: palette.muted }]}>
          Paste a shared TrackItUp template link or scan a QR code to import
          community or official templates into the local catalog.
        </Text>
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Current catalog: {workspace.templates.length} templates. Example:
          `trackitup://template-import?name=Foraging%20Log%20Pro&category=Outdoor&origin=community&fields=text,rich-text,tags,media,location,formula`
        </Text>
        <TextInput
          label="Paste template import link"
          mode="outlined"
          multiline
          value={templateImportUrl}
          onChangeText={setTemplateImportUrl}
          placeholder="trackitup://template-import?templateId=template-foraging-community"
          style={styles.csvInput}
        />
        <View style={styles.toolButtonRow}>
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
        </View>
      </View>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>HARDWARE CAPABILITIES</Text>
        <Text style={[styles.listText, { color: palette.muted }]}>
          Validate the camera and location foundations used for barcode
          scanning, media capture, and geotagged logs.
        </Text>
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Camera: {cameraStatus}
        </Text>
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Location: {locationStatus}
        </Text>
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Last known location:{" "}
          {locationPreview ??
            "Unavailable until permission is granted and the device has a cached fix."}
        </Text>
        <View style={styles.toolButtonRow}>
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
        </View>
      </View>

      {toolMessage ? (
        <View
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={styles.sectionTitle}>LAST ACTION</Text>
          <Text style={[styles.listText, { color: palette.muted }]}>
            {toolMessage}
          </Text>
        </View>
      ) : null}

      {requirementCoverage.map((section) => (
        <View
          key={section.title}
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
          {section.items.map((item) => (
            <View key={item.label} style={styles.coverageItem}>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: `${statusColors[item.status]}22`,
                    borderColor: `${statusColors[item.status]}55`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillLabel,
                    { color: statusColors[item.status] },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
              <View style={styles.coverageCopy}>
                <Text style={styles.coverageTitle}>{item.label}</Text>
                <Text style={[styles.listText, { color: palette.muted }]}>
                  {item.note}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}

      {foundationSections.map((section) => (
        <View
          key={section.title}
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
          {section.items.map((item) => (
            <View key={item.label} style={styles.coverageItem}>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: `${statusColors[item.status]}22`,
                    borderColor: `${statusColors[item.status]}55`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillLabel,
                    { color: statusColors[item.status] },
                  ]}
                >
                  {item.status}
                </Text>
              </View>
              <View style={styles.coverageCopy}>
                <Text style={styles.coverageTitle}>{item.label}</Text>
                <Text style={[styles.listText, { color: palette.muted }]}>
                  {item.note}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}

      {Object.entries(roadmapSections).map(([section, items]) => (
        <View
          key={section}
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={styles.sectionTitle}>{section.toUpperCase()}</Text>
          {items.map((item) => (
            <View key={item} style={styles.listItem}>
              <View style={[styles.dot, { backgroundColor: palette.tint }]} />
              <Text style={[styles.listText, { color: palette.muted }]}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      ))}

      <View
        style={[
          styles.footnoteCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.footnoteTitle}>Product intent</Text>
        <Text style={[styles.footnoteCopy, { color: palette.muted }]}>
          TrackItUp is being shaped as an offline-friendly workspace where users
          can define custom schemas, log events quickly, visualize trends, and
          grow into sync and reporting when needed.
        </Text>
      </View>

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  coverageItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  coverageCopy: {
    flex: 1,
  },
  coverageTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  toolButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  toolButton: {
    flexGrow: 1,
  },
  csvInput: {
    marginTop: 12,
    marginBottom: 10,
    minHeight: 136,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
    marginRight: 12,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  footnoteCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginTop: 4,
  },
  footnoteTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  footnoteCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
});
