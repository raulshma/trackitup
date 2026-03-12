import { CameraView, type BarcodeType } from "expo-camera";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Surface } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/Themed";
import { AiDraftReviewCard } from "@/components/ui/AiDraftReviewCard";
import { AiPromptComposerCard } from "@/components/ui/AiPromptComposerCard";
import { ChipRow } from "@/components/ui/ChipRow";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { defaultQuickActions } from "@/constants/TrackItUpDefaults";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    uiBorder,
    uiRadius,
    uiSize,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { generateOpenRouterText } from "@/services/ai/aiClient";
import { aiScannerAssistantCopy } from "@/services/ai/aiConsentCopy";
import { buildScannerAssistantPrompt } from "@/services/ai/aiPromptBuilders";
import {
    buildAiScannerAssistantGenerationPrompt,
    buildAiScannerAssistantReviewItems,
    formatAiScannerAssistantDestinationLabel,
    parseAiScannerAssistantDraft,
    type AiScannerAssistantDraft,
} from "@/services/ai/aiScannerAssistant";
import { recordAiTelemetryEvent } from "@/services/ai/aiTelemetry";
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

type GeneratedAiScannerDraft = {
  request: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  draft: AiScannerAssistantDraft;
};

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
  const [aiRequest, setAiRequest] = useState("");
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [generatedAiDraft, setGeneratedAiDraft] =
    useState<GeneratedAiScannerDraft | null>(null);
  const [appliedAiDraft, setAppliedAiDraft] =
    useState<GeneratedAiScannerDraft | null>(null);

  useEffect(() => {
    void refreshPermission();
  }, []);

  useEffect(() => {
    setAiRequest("");
    setAiStatusMessage(null);
    setGeneratedAiDraft(null);
    setAppliedAiDraft(null);
  }, [lastScan?.data, lastScan?.type]);

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
  const matchedSpace = useMemo(
    () =>
      matchedAsset
        ? workspace.spaces.find((space) => space.id === matchedAsset.spaceId)
        : undefined,
    [matchedAsset, workspace.spaces],
  );
  const quickLogActionId = useMemo(
    () =>
      workspace.quickActions.find((action) => action.kind === "quick-log")
        ?.id ??
      defaultQuickActions.find((action) => action.kind === "quick-log")?.id ??
      "quick-log",
    [workspace.quickActions],
  );
  const scanKindLabel = lastScan
    ? matchedAsset
      ? "Asset match"
      : scannedTemplate
        ? "Template link"
        : looksLikeUrl
          ? "External link"
          : "Unmatched code"
    : "Waiting for scan";

  function handleOpenQuickLog() {
    router.push({
      pathname: "/logbook",
      params: {
        actionId: quickLogActionId,
        ...(matchedAsset ? { spaceId: matchedAsset.spaceId } : {}),
      },
    });
  }

  function handleOpenSuggestedDestination(
    destination: AiScannerAssistantDraft["suggestedDestination"],
  ) {
    if (destination === "inventory") {
      router.push("/(tabs)/inventory" as never);
      return;
    }

    if (destination === "logbook") {
      handleOpenQuickLog();
      return;
    }

    if (destination === "template-import" && scannedTemplate && lastScan) {
      router.push({
        pathname: "/template-import",
        params: { url: lastScan.data, source: "qr-code" },
      });
      return;
    }

    router.push("/workspace-tools" as never);
  }

  async function handleGenerateAiDraft() {
    if (!lastScan) {
      setAiStatusMessage(
        "Scan a barcode or QR code before requesting AI help.",
      );
      return;
    }

    const trimmedRequest = aiRequest.trim();
    if (!trimmedRequest) {
      setAiStatusMessage(
        "Describe the kind of next-step help you want before generating a scanner suggestion.",
      );
      return;
    }

    const promptDraft = buildScannerAssistantPrompt({
      workspace,
      userRequest: trimmedRequest,
      scan: lastScan,
      matchedAsset,
      scannedTemplate,
    });
    setIsGeneratingAiDraft(true);
    void recordAiTelemetryEvent({
      surface: "scanner-assistant",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: promptDraft.system,
      prompt: buildAiScannerAssistantGenerationPrompt(promptDraft.prompt),
      temperature: 0.25,
      maxOutputTokens: 800,
    });
    setIsGeneratingAiDraft(false);

    if (result.status !== "success") {
      setGeneratedAiDraft(null);
      setAiStatusMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "scanner-assistant",
        action: "generate-failed",
      });
      return;
    }

    const parsedDraft = parseAiScannerAssistantDraft(result.text);
    if (!parsedDraft) {
      setGeneratedAiDraft(null);
      setAiStatusMessage(
        "TrackItUp received an AI response but could not turn it into a reviewable scanner suggestion. Try asking for a simpler next step.",
      );
      void recordAiTelemetryEvent({
        surface: "scanner-assistant",
        action: "generate-failed",
      });
      return;
    }

    setGeneratedAiDraft({
      request: trimmedRequest,
      consentLabel: promptDraft.consentLabel,
      modelId: result.modelId,
      usage: result.usage,
      draft: parsedDraft,
    });
    setAiStatusMessage(
      "Generated an AI scanner suggestion. Review it carefully before applying it to this screen.",
    );
    void recordAiTelemetryEvent({
      surface: "scanner-assistant",
      action: "generate-succeeded",
    });
  }

  function handleApplyAiDraft() {
    if (!generatedAiDraft) return;
    setAppliedAiDraft(generatedAiDraft);
    setGeneratedAiDraft(null);
    setAiStatusMessage(
      "Applied the AI scanner suggestion. Review the destination and any draft log outline before taking the next step.",
    );
    void recordAiTelemetryEvent({
      surface: "scanner-assistant",
      action: "draft-applied",
    });
  }

  function handleDismissAiDraft() {
    setGeneratedAiDraft(null);
    setAiStatusMessage(
      "Dismissed the AI scanner draft. Your current scan result is unchanged.",
    );
  }

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
          subtitle="Use the live camera feed to identify tagged assets, review template links, and get a grounded AI next-step suggestion after each scan."
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
          description="Grant access, jump back to inventory, open a scanned template, or turn the current scan into a review-only AI next-step suggestion without leaving the scanner flow."
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
                <Chip compact style={styles.resultChip}>
                  {scanKindLabel}
                </Chip>
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

        {lastScan ? (
          <AiPromptComposerCard
            palette={palette}
            label="AI scanner assistant"
            title="Suggest the best next step from this scan"
            value={aiRequest}
            onChangeText={setAiRequest}
            onSubmit={() => void handleGenerateAiDraft()}
            isBusy={isGeneratingAiDraft}
            contextChips={[
              scanKindLabel,
              matchedAsset
                ? matchedAsset.name
                : (scannedTemplate?.name ??
                  scannedTemplate?.templateId ??
                  "No named match"),
              matchedSpace ? `Space: ${matchedSpace.name}` : "No space linked",
            ]}
            placeholder="Example: suggest the safest next step and draft a short log outline if I should capture this scan in the logbook."
            helperText={aiScannerAssistantCopy.getHelperText(scanKindLabel)}
            consentLabel={aiScannerAssistantCopy.consentLabel}
            footerNote={aiScannerAssistantCopy.promptFooterNote}
            submitLabel="Generate next step"
          />
        ) : null}

        {aiStatusMessage ? (
          <SectionMessage
            palette={palette}
            label="AI scanner assistant"
            title="Latest scanner assistant status"
            message={aiStatusMessage}
          />
        ) : null}

        {generatedAiDraft ? (
          <AiDraftReviewCard
            palette={palette}
            title="Review the AI scanner suggestion"
            draftKindLabel={scanKindLabel}
            summary={`Prompt: ${generatedAiDraft.request}`}
            consentLabel={generatedAiDraft.consentLabel}
            footerNote={aiScannerAssistantCopy.reviewFooterNote}
            statusLabel="Draft ready"
            modelLabel={generatedAiDraft.modelId}
            usage={generatedAiDraft.usage}
            contextChips={[
              formatAiScannerAssistantDestinationLabel(
                generatedAiDraft.draft.suggestedDestination,
              ),
              matchedAsset ? matchedAsset.name : "No asset matched",
            ]}
            items={buildAiScannerAssistantReviewItems(generatedAiDraft.draft)}
            acceptLabel="Apply suggestion"
            editLabel="Dismiss draft"
            regenerateLabel="Generate again"
            onAccept={handleApplyAiDraft}
            onEdit={handleDismissAiDraft}
            onRegenerate={() => void handleGenerateAiDraft()}
            isBusy={isGeneratingAiDraft}
          />
        ) : null}

        {appliedAiDraft ? (
          <SectionSurface
            palette={palette}
            label="AI scanner assistant"
            title={appliedAiDraft.draft.headline}
          >
            <ChipRow style={styles.resultChipRow}>
              <Chip compact style={styles.resultChip}>
                {formatAiScannerAssistantDestinationLabel(
                  appliedAiDraft.draft.suggestedDestination,
                )}
              </Chip>
              {matchedAsset ? (
                <Chip compact style={styles.resultChip}>
                  {matchedAsset.name}
                </Chip>
              ) : scannedTemplate ? (
                <Chip compact style={styles.resultChip}>
                  {scannedTemplate.name ??
                    scannedTemplate.templateId ??
                    "Template"}
                </Chip>
              ) : null}
            </ChipRow>
            {appliedAiDraft.draft.summary ? (
              <Text style={styles.resultValue}>
                {appliedAiDraft.draft.summary}
              </Text>
            ) : null}
            {appliedAiDraft.draft.reasons.length > 0 ? (
              <View style={styles.aiList}>
                {appliedAiDraft.draft.reasons.map((reason) => (
                  <Text
                    key={reason}
                    style={[styles.resultValue, paletteStyles.mutedText]}
                  >
                    • {reason}
                  </Text>
                ))}
              </View>
            ) : null}
            {appliedAiDraft.draft.suggestedEntry ? (
              <Surface
                style={[styles.aiCard, paletteStyles.cardSurface]}
                elevation={0}
              >
                <Text style={styles.matchTitle}>
                  Suggested quick-log outline
                </Text>
                {appliedAiDraft.draft.suggestedEntry.title ? (
                  <Text style={styles.resultValue}>
                    Title: {appliedAiDraft.draft.suggestedEntry.title}
                  </Text>
                ) : null}
                {appliedAiDraft.draft.suggestedEntry.note ? (
                  <Text style={[styles.resultValue, paletteStyles.mutedText]}>
                    Note: {appliedAiDraft.draft.suggestedEntry.note}
                  </Text>
                ) : null}
                {(appliedAiDraft.draft.suggestedEntry.tags?.length ?? 0) > 0 ? (
                  <Text style={[styles.resultValue, paletteStyles.mutedText]}>
                    Tags: {appliedAiDraft.draft.suggestedEntry.tags?.join(", ")}
                  </Text>
                ) : null}
              </Surface>
            ) : null}
            {appliedAiDraft.draft.caution ? (
              <Text style={[styles.resultValue, paletteStyles.mutedText]}>
                Caution: {appliedAiDraft.draft.caution}
              </Text>
            ) : null}
            <View style={styles.aiActionRow}>
              <Button
                mode="contained"
                onPress={() =>
                  handleOpenSuggestedDestination(
                    appliedAiDraft.draft.suggestedDestination,
                  )
                }
                style={styles.footerButton}
                contentStyle={styles.footerButtonContent}
              >
                {formatAiScannerAssistantDestinationLabel(
                  appliedAiDraft.draft.suggestedDestination,
                )}
              </Button>
              <Button
                mode="outlined"
                onPress={handleOpenQuickLog}
                style={styles.footerButton}
                contentStyle={styles.footerButtonContent}
              >
                Start quick log
              </Button>
            </View>
          </SectionSurface>
        ) : null}
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
  aiList: { marginBottom: uiSpace.sm },
  aiCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.lg,
    padding: uiSpace.md,
    marginBottom: uiSpace.md,
  },
  aiActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: uiSpace.md,
    marginTop: uiSpace.sm,
  },
  footer: {
    borderTopWidth: uiBorder.standard,
    paddingHorizontal: uiSpace.screen,
    paddingTop: uiSpace.lg,
  },
  footerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: uiSpace.md,
  },
  footerButton: { alignSelf: "flex-start" },
  footerButtonContent: { minHeight: 40 },
});
