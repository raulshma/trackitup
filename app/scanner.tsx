import { CameraView, type BarcodeType } from "expo-camera";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { Button } from "react-native-paper";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
    getCameraPermissionStatusAsync,
    requestCameraPermissionAsync,
} from "@/services/device/deviceCapabilities";
import { findAssetByScannedCode } from "@/services/insights/workspaceInsights";
import { parseTemplateImportUrl } from "@/services/templates/templateImport";

const supportedBarcodeTypes: BarcodeType[] = [
  "qr",
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code128",
  "code39",
  "code93",
  "pdf417",
  "aztec",
  "datamatrix",
  "codabar",
  "itf14",
];

export default function ScannerScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [lastScan, setLastScan] = useState<{
    type: string;
    data: string;
  } | null>(null);

  useEffect(() => {
    void refreshPermission();
  }, []);

  async function refreshPermission() {
    const permission = await getCameraPermissionStatusAsync();
    setHasPermission(permission.granted);
  }

  async function handleRequestPermission() {
    const permission = await requestCameraPermissionAsync();
    setHasPermission(permission.granted);
  }

  const matchedAsset = useMemo(
    () =>
      lastScan ? findAssetByScannedCode(workspace, lastScan.data) : undefined,
    [lastScan, workspace],
  );
  const scannedTemplate = useMemo(
    () => (lastScan ? parseTemplateImportUrl(lastScan.data, "qr-code") : null),
    [lastScan],
  );
  const looksLikeUrl = Boolean(
    lastScan?.data.match(/^(https?:\/\/|trackitup:\/\/)/i),
  );

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <Stack.Screen options={{ title: "Scanner" }} />

      <View style={styles.header}>
        <Text style={styles.title}>Barcode & QR scanner</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Use the live camera feed to identify tagged assets or scan QR-based
          template links.
        </Text>
      </View>

      <View
        style={[
          styles.cameraCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        {hasPermission ? (
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: supportedBarcodeTypes }}
            onBarcodeScanned={
              lastScan
                ? undefined
                : (result) =>
                    setLastScan({ type: result.type, data: result.data.trim() })
            }
          />
        ) : (
          <View style={styles.permissionState}>
            <Text style={styles.permissionTitle}>Camera access required</Text>
            <Text style={[styles.permissionCopy, { color: palette.muted }]}>
              Grant permission to scan product barcodes, printed QR labels, and
              shared template links.
            </Text>
            <Button
              mode="contained"
              onPress={handleRequestPermission}
              style={styles.primaryButton}
            >
              Allow camera access
            </Button>
          </View>
        )}
      </View>

      <View
        style={[
          styles.resultCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>Scan result</Text>
        {lastScan ? (
          <>
            <Text style={[styles.resultMeta, { color: palette.tint }]}>
              {lastScan.type.toUpperCase()}
            </Text>
            <Text style={[styles.resultValue, { color: palette.muted }]}>
              {lastScan.data}
            </Text>
            {matchedAsset ? (
              <>
                <Text style={styles.matchTitle}>
                  Matched asset: {matchedAsset.name}
                </Text>
                <Text style={[styles.resultValue, { color: palette.muted }]}>
                  {matchedAsset.category} • {matchedAsset.status.toUpperCase()}
                </Text>
                <Text style={[styles.resultValue, { color: palette.muted }]}>
                  {matchedAsset.note}
                </Text>
              </>
            ) : scannedTemplate ? (
              <>
                <Text style={styles.matchTitle}>
                  Template import detected:{" "}
                  {scannedTemplate.name ??
                    scannedTemplate.templateId ??
                    "shared template"}
                </Text>
                <Text style={[styles.resultValue, { color: palette.muted }]}>
                  This QR code contains a TrackItUp template import payload and
                  can be added to the local catalog right now.
                </Text>
              </>
            ) : looksLikeUrl ? (
              <Text style={[styles.resultValue, { color: palette.muted }]}>
                This scan looks like a link, but it does not match the TrackItUp
                template import format.
              </Text>
            ) : (
              <Text style={[styles.resultValue, { color: palette.muted }]}>
                No asset currently uses this barcode or QR code in the local
                workspace.
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.resultValue, { color: palette.muted }]}>
            Point the camera at a barcode or QR code to start matching assets.
          </Text>
        )}

        <View style={styles.buttonRow}>
          {scannedTemplate ? (
            <Button
              mode="contained-tonal"
              onPress={() =>
                router.push({
                  pathname: "/template-import",
                  params: { url: lastScan?.data ?? "", source: "qr-code" },
                })
              }
              style={styles.inlineButton}
            >
              Import template
            </Button>
          ) : null}
          <Button
            mode="contained"
            onPress={() => setLastScan(null)}
            disabled={!lastScan}
            style={styles.inlineButton}
          >
            Scan again
          </Button>
          <Button
            mode="outlined"
            onPress={() => router.replace("/(tabs)/inventory")}
            style={styles.inlineButton}
          >
            Back to inventory
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20 },
  header: { marginBottom: 18 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  cameraCard: {
    borderWidth: 1,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 16,
  },
  camera: {
    width: "100%",
    height: 320,
  },
  permissionState: {
    padding: 20,
    alignItems: "flex-start",
  },
  permissionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  permissionCopy: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  resultCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  resultMeta: { fontSize: 12, fontWeight: "800", marginBottom: 8 },
  resultValue: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  matchTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 4,
  },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  inlineButton: { flex: 1 },
  primaryButton: { marginTop: 4 },
});
