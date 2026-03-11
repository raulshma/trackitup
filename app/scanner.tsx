import { CameraView, type BarcodeType } from "expo-camera";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Surface } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/Themed";
import { ChipRow } from "@/components/ui/ChipRow";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { ScreenHero } from "@/components/ui/ScreenHero";
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
  const insets = useSafeAreaInsets();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
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
  const pageQuickActions = [
    {
      id: "scanner-primary",
      label: hasPermission
        ? lastScan
          ? "Scan again"
          : "Camera ready"
        : "Allow camera",
      hint: hasPermission
        ? lastScan
          ? "Clear the current result and keep moving through labels."
          : "The camera feed is ready for the next barcode or QR code."
        : "Grant access to use live barcode and QR scanning on this device.",
      onPress: () =>
        hasPermission ? setLastScan(null) : handleRequestPermission(),
      accentColor: palette.tint,
      disabled: Boolean(hasPermission && !lastScan),
    },
    {
      id: "scanner-inventory",
      label: "Back to inventory",
      hint: `${workspace.assets.length} tracked asset${workspace.assets.length === 1 ? "" : "s"} can be matched against scanned codes.`,
      onPress: () => router.replace("/(tabs)/inventory"),
      accentColor: palette.secondary,
    },
    {
      id: "scanner-secondary",
      label: scannedTemplate ? "Review template" : "Open workspace tools",
      hint: scannedTemplate
        ? `Open ${scannedTemplate.name ?? "the shared template"} before importing it into your catalog.`
        : "Check permissions, import links, and device readiness from one tool hub.",
      onPress: () =>
        scannedTemplate
          ? router.push({
              pathname: "/template-import",
              params: { url: lastScan?.data ?? "", source: "qr-code" },
            })
          : router.push("/workspace-tools" as never),
    },
  ];

  return (
    <View style={[styles.screen, paletteStyles.screenBackground]}>
      <Stack.Screen options={{ title: "Scanner" }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <ScreenHero
          palette={palette}
          title="Barcode & QR scanner"
          subtitle="Use the live camera feed to identify tagged assets or scan QR-based template links."
          badges={[
            {
              label: "QR + barcode",
              backgroundColor: palette.card,
              textColor: palette.tint,
            },
            {
              label: hasPermission ? "Camera ready" : "Permission needed",
              backgroundColor: palette.accentSoft,
            },
          ]}
        />

        <PageQuickActions
          palette={palette}
          title="Work the next scan faster"
          description="Grant access, jump back to inventory, or move a scanned template straight into review without leaving the scanner flow."
          actions={pageQuickActions}
        />

        <Surface
          style={[styles.cameraCard, paletteStyles.cardSurface]}
          elevation={1}
        >
          {hasPermission ? (
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: supportedBarcodeTypes }}
              onBarcodeScanned={
                lastScan
                  ? undefined
                  : (result) =>
                      setLastScan({
                        type: result.type,
                        data: result.data.trim(),
                      })
              }
            />
          ) : (
            <View style={styles.permissionState}>
              <Text style={styles.permissionTitle}>Camera access required</Text>
              <Text style={[styles.permissionCopy, paletteStyles.mutedText]}>
                Grant permission to scan product barcodes, printed QR labels,
                and shared template links.
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
        </Surface>

        <SectionSurface
          palette={palette}
          label="Scan result"
          title="Latest capture"
        >
          {lastScan ? (
            <>
              <ChipRow style={styles.resultChipRow}>
                <Chip compact style={styles.resultChip}>
                  {lastScan.type.toUpperCase()}
                </Chip>
                {matchedAsset ? (
                  <Chip compact style={styles.resultChip}>
                    Asset match
                  </Chip>
                ) : scannedTemplate ? (
                  <Chip compact style={styles.resultChip}>
                    Template link
                  </Chip>
                ) : looksLikeUrl ? (
                  <Chip compact style={styles.resultChip}>
                    External link
                  </Chip>
                ) : null}
              </ChipRow>
              <Text style={[styles.resultValue, paletteStyles.mutedText]}>
                {lastScan.data}
              </Text>
              {matchedAsset ? (
                <>
                  <Text style={styles.matchTitle}>
                    Matched asset: {matchedAsset.name}
                  </Text>
                  <Text style={[styles.resultValue, paletteStyles.mutedText]}>
                    {matchedAsset.category} •{" "}
                    {matchedAsset.status.toUpperCase()}
                  </Text>
                  <Text style={[styles.resultValue, paletteStyles.mutedText]}>
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
                  <Text style={[styles.resultValue, paletteStyles.mutedText]}>
                    This QR code contains a TrackItUp template import payload
                    and can be added to the local catalog right now.
                  </Text>
                </>
              ) : looksLikeUrl ? (
                <Text style={[styles.resultValue, paletteStyles.mutedText]}>
                  This scan looks like a link, but it does not match the
                  TrackItUp template import format.
                </Text>
              ) : (
                <Text style={[styles.resultValue, paletteStyles.mutedText]}>
                  No asset currently uses this barcode or QR code in the local
                  workspace.
                </Text>
              )}
            </>
          ) : (
            <Text style={[styles.resultValue, paletteStyles.mutedText]}>
              Point the camera at a barcode or QR code to start matching assets.
            </Text>
          )}
        </SectionSurface>
      </ScrollView>

      <Surface
        style={[
          styles.footer,
          {
            backgroundColor: palette.surface1,
            borderColor: palette.border,
            paddingBottom: uiSpace.lg + insets.bottom,
          },
        ]}
        elevation={2}
      >
        <View style={styles.footerActions}>
          <Button
            mode="outlined"
            onPress={() => router.replace("/(tabs)/inventory")}
            style={styles.footerButton}
            contentStyle={styles.footerButtonContent}
          >
            Back to inventory
          </Button>
          {scannedTemplate ? (
            <Button
              mode="contained-tonal"
              onPress={() =>
                router.push({
                  pathname: "/template-import",
                  params: { url: lastScan?.data ?? "", source: "qr-code" },
                })
              }
              style={styles.footerButton}
              contentStyle={styles.footerButtonContent}
            >
              Import template
            </Button>
          ) : null}
          <Button
            mode="contained"
            onPress={() => setLastScan(null)}
            disabled={!lastScan}
            style={styles.footerButton}
            contentStyle={styles.footerButtonContent}
          >
            Scan again
          </Button>
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  content: {
    padding: uiSpace.screen,
    paddingBottom: uiSpace.screenBottom,
  },
  cameraCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    overflow: "hidden",
    marginBottom: uiSpace.xxl,
  },
  camera: {
    width: "100%",
    height: uiSize.scannerPreview,
  },
  permissionState: {
    padding: uiSpace.screen,
    alignItems: "flex-start",
  },
  permissionTitle: { ...uiTypography.titleLg, marginBottom: uiSpace.sm },
  permissionCopy: { ...uiTypography.body, marginBottom: uiSpace.lg },
  resultChipRow: {
    marginBottom: uiSpace.md,
  },
  resultChip: {
    borderRadius: uiRadius.pill,
  },
  resultValue: { ...uiTypography.body, marginBottom: 6 },
  matchTitle: {
    ...uiTypography.titleMd,
    marginTop: 6,
    marginBottom: uiSpace.xs,
  },
  primaryButton: { marginTop: uiSpace.xs },
  footer: {
    borderTopWidth: uiBorder.standard,
    paddingHorizontal: uiSpace.screen,
    paddingTop: uiSpace.lg,
  },
  footerActions: {
    flexDirection: "row",
    gap: uiSpace.md,
  },
  footerButton: { flex: 1 },
  footerButtonContent: { minHeight: 40 },
});
