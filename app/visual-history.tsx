import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Chip,
  Surface,
  useTheme,
  type MD3Theme,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { AiDraftReviewCard } from "@/components/ui/AiDraftReviewCard";
import { AiPromptComposerCard } from "@/components/ui/AiPromptComposerCard";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";
import { CardActionPill } from "@/components/ui/CardActionPill";
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { WorkspacePageSkeleton } from "@/components/ui/LoadingSkeleton";
import { MotionView } from "@/components/ui/Motion";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import {
  PhotoLightbox,
  type LightboxItem,
} from "@/components/ui/PhotoLightbox";
import { ReorderGestureCard } from "@/components/ui/ReorderGestureCard";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { SwipeActionCard } from "@/components/ui/SwipeActionCard";
import { useColorScheme } from "@/components/useColorScheme";
import Colors, { withAlpha } from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
  getShadowStyle,
  uiBorder,
  uiMotion,
  uiRadius,
  uiShadow,
  uiSpace,
  uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { generateOpenRouterText } from "@/services/ai/aiClient";
import {
  aiCrossSpaceTrendCopy,
  aiVisualRecapCopy,
} from "@/services/ai/aiConsentCopy";
import {
  buildAiCrossSpaceTrendGenerationPrompt,
  buildAiCrossSpaceTrendReviewItems,
  formatAiCrossSpaceTrendDestinationLabel,
  formatAiCrossSpaceTrendSourceLabel,
  parseAiCrossSpaceTrendDraft,
  type AiCrossSpaceTrendDraft,
  type AiCrossSpaceTrendSource,
} from "@/services/ai/aiCrossSpaceTrends";
import {
  buildCrossSpaceTrendPrompt,
  buildVisualRecapPrompt,
} from "@/services/ai/aiPromptBuilders";
import { recordAiTelemetryEvent } from "@/services/ai/aiTelemetry";
import {
  buildAiVisualRecapGenerationPrompt,
  buildAiVisualRecapReviewItems,
  parseAiVisualRecapDraft,
  type AiVisualRecapDraft,
} from "@/services/ai/aiVisualRecap";
import {
  triggerSelectionFeedback,
  triggerSuccessFeedback,
} from "@/services/device/haptics";
import {
  buildVisualRecapShareMessage,
  buildVisualRecapTitle,
} from "@/services/export/workspaceVisualRecapContent";
import { exportVisualRecapPdfAsync } from "@/services/export/workspaceVisualRecapExport";
import {
  loadVisualRecapCoverSelections,
  persistVisualRecapCoverSelections,
} from "@/services/insights/visualRecapPreferencePersistence";
import { buildWorkspaceTrendSummary } from "@/services/insights/workspaceTrendSummary";
import {
  applyVisualRecapCoverSelections,
  buildWorkspaceVisualHistory,
  getVisualRecapCoverSelectionKey,
  type VisualHistoryPhotoItem,
  type VisualRecapCoverSelections,
} from "@/services/insights/workspaceVisualHistory";

type VisualHistoryParams = {
  assetId?: string | string[];
  spaceId?: string | string[];
};

type GeneratedAiVisualRecap = {
  request: string;
  scopeLabel: string;
  monthKey: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  draft: AiVisualRecapDraft;
};

type GeneratedAiCrossSpaceTrend = {
  request: string;
  monthKey: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  sources: AiCrossSpaceTrendSource[];
  draft: AiCrossSpaceTrendDraft;
};

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

function formatDateTime(timestamp: string) {
  return dateTimeFormatter.format(new Date(timestamp));
}

function formatMonth(monthKey: string) {
  return monthFormatter.format(new Date(`${monthKey}-01T00:00:00`));
}

function buildLightboxItems(photos: VisualHistoryPhotoItem[]): LightboxItem[] {
  return photos.map((photo) => ({
    id: photo.id,
    uri: photo.uri,
    title: photo.logTitle,
    subtitle: `${photo.spaceName} • ${formatDateTime(photo.capturedAt)}`,
    badge: photo.proofLabel,
  }));
}

export default function VisualHistoryScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const theme = useTheme<MD3Theme>();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const recapCardShadow = useMemo(
    () => getShadowStyle(theme.colors.shadow, uiShadow.raisedCard),
    [theme.colors.shadow],
  );
  const router = useRouter();
  const params = useLocalSearchParams<VisualHistoryParams>();
  const { isHydrated, workspace } = useWorkspace();
  const [recapCoverSelections, setRecapCoverSelections] =
    useState<VisualRecapCoverSelections>({});

  const assetId = pickParam(params.assetId);
  const spaceId = pickParam(params.spaceId);
  const asset = workspace.assets.find((item) => item.id === assetId);
  const space = workspace.spaces.find((item) => item.id === spaceId);
  const historyScope = useMemo(
    () => ({ assetId, spaceId }),
    [assetId, spaceId],
  );
  const baseHistory = useMemo(
    () => buildWorkspaceVisualHistory(workspace, historyScope),
    [historyScope, workspace],
  );
  const history = useMemo(
    () =>
      applyVisualRecapCoverSelections(
        baseHistory,
        historyScope,
        recapCoverSelections,
      ),
    [baseHistory, historyScope, recapCoverSelections],
  );
  const scopeLabel = asset ? asset.name : space ? space.name : "Workspace";
  const lightboxItems = useMemo<LightboxItem[]>(
    () => buildLightboxItems(history.photos),
    [history.photos],
  );
  const [lightboxState, setLightboxState] = useState<{
    items: LightboxItem[];
    initialIndex: number;
  } | null>(null);
  const [aiRequest, setAiRequest] = useState("");
  const [selectedAiMonthKey, setSelectedAiMonthKey] = useState<string | null>(
    null,
  );
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);
  const [isGeneratingAiRecap, setIsGeneratingAiRecap] = useState(false);
  const [generatedAiRecap, setGeneratedAiRecap] =
    useState<GeneratedAiVisualRecap | null>(null);
  const [appliedAiRecap, setAppliedAiRecap] =
    useState<GeneratedAiVisualRecap | null>(null);
  const [trendRequest, setTrendRequest] = useState("");
  const [trendStatusMessage, setTrendStatusMessage] = useState<string | null>(
    null,
  );
  const [isGeneratingAiTrend, setIsGeneratingAiTrend] = useState(false);
  const [generatedAiTrend, setGeneratedAiTrend] =
    useState<GeneratedAiCrossSpaceTrend | null>(null);
  const [appliedAiTrend, setAppliedAiTrend] =
    useState<GeneratedAiCrossSpaceTrend | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [busyRecapKey, setBusyRecapKey] = useState<string | null>(null);

  const title = asset
    ? `${asset.name} photo timeline`
    : space
      ? `${space.name} visual history`
      : "Workspace visual history";
  const subtitle = asset
    ? "Track progress for one asset, compare early vs latest photos, and jump back to the linked logs."
    : space
      ? "Review progress photos, proof-of-completion shots, and monthly recaps for this space."
      : "Browse progress photos across your workspace and open the logs that captured each moment.";
  const latestPhoto = history.photos[0];
  const logbookActionPath = asset
    ? (`/logbook?actionId=quick-log&spaceId=${asset.spaceId}` as never)
    : space
      ? (`/logbook?actionId=quick-log&spaceId=${space.id}` as never)
      : ("/logbook?actionId=quick-log" as never);
  const pageQuickActions = useMemo(
    () => [
      {
        id: "visual-history-log",
        label: latestPhoto ? "Open latest log" : "Record proof",
        hint: latestPhoto
          ? `Jump back to ${latestPhoto.logTitle} and the photo context behind it.`
          : `Start the next proof capture for ${scopeLabel.toLowerCase()}.`,
        onPress: () =>
          router.push(
            latestPhoto
              ? (`/logbook?entryId=${latestPhoto.logId}` as never)
              : logbookActionPath,
          ),
        accentColor: palette.tint,
      },
      {
        id: "visual-history-record",
        label: "Add new proof",
        hint: `Capture another photo so ${scopeLabel.toLowerCase()} keeps a stronger visual trail.`,
        onPress: () => router.push(logbookActionPath),
        accentColor: palette.secondary,
      },
      {
        id: "visual-history-scope",
        label: asset || space ? "Open workspace gallery" : "Open inventory",
        hint:
          asset || space
            ? "Step back out to the wider workspace photo timeline."
            : `${workspace.assets.length} tracked asset${workspace.assets.length === 1 ? "" : "s"} connect into this gallery.`,
        onPress: () =>
          router.push(
            asset || space
              ? ("/visual-history" as never)
              : ("/inventory" as never),
          ),
      },
    ],
    [
      asset,
      latestPhoto,
      logbookActionPath,
      palette.secondary,
      palette.tint,
      router,
      scopeLabel,
      space,
      workspace.assets.length,
    ],
  );

  useEffect(() => {
    let isCancelled = false;

    void loadVisualRecapCoverSelections().then((selections) => {
      if (!isCancelled) {
        setRecapCoverSelections(selections);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (history.monthlyRecaps.length === 0) {
      setSelectedAiMonthKey(null);
      return;
    }

    setSelectedAiMonthKey((currentMonthKey) =>
      currentMonthKey &&
      history.monthlyRecaps.some((recap) => recap.monthKey === currentMonthKey)
        ? currentMonthKey
        : (history.monthlyRecaps[0]?.monthKey ?? null),
    );
  }, [history.monthlyRecaps]);

  useEffect(() => {
    setGeneratedAiRecap(null);
    setAppliedAiRecap(null);
    setAiStatusMessage(null);
  }, [scopeLabel, selectedAiMonthKey]);

  useEffect(() => {
    setGeneratedAiTrend(null);
    setAppliedAiTrend(null);
    setTrendStatusMessage(null);
  }, [scopeLabel, selectedAiMonthKey]);

  const selectedAiRecap = selectedAiMonthKey
    ? history.monthlyRecaps.find(
        (recap) => recap.monthKey === selectedAiMonthKey,
      )
    : history.monthlyRecaps[0];
  const selectedAiMonthLabel = selectedAiRecap
    ? formatMonth(selectedAiRecap.monthKey)
    : null;
  const isWorkspaceScope = !asset && !space;
  const selectedTrendSummary = useMemo(
    () =>
      isWorkspaceScope && selectedAiMonthKey
        ? buildWorkspaceTrendSummary(workspace, selectedAiMonthKey)
        : null,
    [isWorkspaceScope, selectedAiMonthKey, workspace],
  );

  const lightboxIndexById = useMemo(
    () =>
      new Map(lightboxItems.map((item, index) => [item.id, index] as const)),
    [lightboxItems],
  );

  const openLightbox = useCallback(
    (items: LightboxItem[], initialIndex: number) => {
      setLightboxState({ items, initialIndex });
    },
    [],
  );

  const openLightboxForPhotoId = useCallback(
    (photoId: string) => {
      openLightbox(lightboxItems, lightboxIndexById.get(photoId) ?? 0);
    },
    [lightboxIndexById, lightboxItems, openLightbox],
  );

  const renderTimelinePhoto = useCallback(
    ({ item: photo }: { item: (typeof history.photos)[number] }) => {
      return (
        <SwipeActionCard
          rightActions={[
            {
              label: "Open log",
              accentColor: palette.tint,
              onPress: () =>
                router.push(`/logbook?entryId=${photo.logId}` as never),
            },
            ...(!assetId && photo.assetIds.length === 1
              ? [
                  {
                    label: "Asset",
                    accentColor: palette.secondary,
                    onPress: () =>
                      router.push(
                        `/visual-history?assetId=${photo.assetIds[0]}` as never,
                      ),
                  },
                ]
              : []),
          ]}
        >
          <Surface
            style={[
              styles.photoCard,
              {
                backgroundColor: theme.colors.elevation.level1,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
            elevation={1}
          >
            <Pressable onPress={() => openLightboxForPhotoId(photo.id)}>
              <Image
                source={{ uri: photo.uri }}
                style={[
                  styles.photoImage,
                  { backgroundColor: palette.surface3 },
                ]}
              />
            </Pressable>
            <View style={styles.photoCopy}>
              <ChipRow style={styles.photoChipRow}>
                <Chip
                  compact
                  style={[
                    styles.infoChip,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                  textStyle={[
                    styles.infoChipText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {photo.spaceName}
                </Chip>
                <Chip
                  compact
                  style={[
                    styles.infoChip,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                  textStyle={[
                    styles.infoChipText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {formatDateTime(photo.capturedAt)}
                </Chip>
                {photo.proofLabel ? (
                  <Chip
                    compact
                    style={[
                      styles.infoChip,
                      {
                        backgroundColor: theme.colors.secondaryContainer,
                      },
                    ]}
                    textStyle={[
                      styles.infoChipText,
                      { color: theme.colors.onSecondaryContainer },
                    ]}
                  >
                    {photo.proofLabel}
                  </Chip>
                ) : null}
              </ChipRow>
              <Text style={styles.photoTitle}>{photo.logTitle}</Text>
              <Text style={[styles.copy, paletteStyles.mutedText]}>
                {photo.logNote}
              </Text>
              {photo.assetNames.length > 0 ? (
                <Text style={[styles.meta, paletteStyles.mutedText]}>
                  Assets: {photo.assetNames.join(" • ")}
                </Text>
              ) : null}
              <ActionButtonRow
                separated
                separatorColor={theme.colors.outlineVariant}
              >
                <CardActionPill
                  label="Open log"
                  onPress={() =>
                    router.push(`/logbook?entryId=${photo.logId}` as never)
                  }
                />
                {!assetId && photo.assetIds.length === 1 ? (
                  <CardActionPill
                    label="Asset gallery"
                    onPress={() =>
                      router.push(
                        `/visual-history?assetId=${photo.assetIds[0]}` as never,
                      )
                    }
                  />
                ) : null}
              </ActionButtonRow>
            </View>
          </Surface>
        </SwipeActionCard>
      );
    },
    [
      assetId,
      lightboxItems,
      openLightboxForPhotoId,
      palette.surface3,
      palette.secondary,
      palette.tint,
      paletteStyles.mutedText,
      router,
      theme.colors.elevation.level1,
      theme.colors.onSecondaryContainer,
      theme.colors.onSurfaceVariant,
      theme.colors.outlineVariant,
      theme.colors.secondaryContainer,
      theme.colors.surfaceVariant,
    ],
  );

  async function handleGenerateAiRecap() {
    if (!selectedAiRecap || !selectedAiMonthKey) {
      setAiStatusMessage(
        "A monthly recap is required before TrackItUp can draft an AI narration.",
      );
      return;
    }

    const trimmedRequest = aiRequest.trim();
    if (!trimmedRequest) {
      setAiStatusMessage(
        "Describe the kind of recap or narration you want before generating it.",
      );
      return;
    }

    const recapPrompt = buildVisualRecapPrompt({
      workspace,
      scopeLabel,
      scope: historyScope,
      monthKey: selectedAiMonthKey,
      request: trimmedRequest,
    });
    if (!recapPrompt) {
      setAiStatusMessage(
        "TrackItUp could not find enough visual recap data for that request yet.",
      );
      return;
    }

    setIsGeneratingAiRecap(true);
    void recordAiTelemetryEvent({
      surface: "visual-recap",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: recapPrompt.system,
      prompt: buildAiVisualRecapGenerationPrompt(recapPrompt.prompt),
      temperature: 0.4,
      maxOutputTokens: 900,
    });
    setIsGeneratingAiRecap(false);

    if (result.status !== "success") {
      setGeneratedAiRecap(null);
      setAiStatusMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "visual-recap",
        action: "generate-failed",
      });
      return;
    }

    const parsedDraft = parseAiVisualRecapDraft(result.text);
    if (!parsedDraft) {
      setGeneratedAiRecap(null);
      setAiStatusMessage(
        "TrackItUp received an AI response but could not turn it into a grounded recap draft. Try asking for a shorter, more specific recap.",
      );
      void recordAiTelemetryEvent({
        surface: "visual-recap",
        action: "generate-failed",
      });
      return;
    }

    setGeneratedAiRecap({
      request: trimmedRequest,
      scopeLabel,
      monthKey: selectedAiMonthKey,
      consentLabel: recapPrompt.consentLabel,
      modelId: result.modelId,
      usage: result.usage,
      draft: parsedDraft,
    });
    setAiStatusMessage(
      "Generated an AI visual recap draft. Review it carefully before showing it in this gallery.",
    );
    void recordAiTelemetryEvent({
      surface: "visual-recap",
      action: "generate-succeeded",
    });
  }

  function handleApplyAiRecap() {
    if (!generatedAiRecap) return;

    setAppliedAiRecap(generatedAiRecap);
    setGeneratedAiRecap(null);
    setAiStatusMessage(
      "Applied the AI narrator recap to this visual history view. Review it before sharing it elsewhere.",
    );
    void recordAiTelemetryEvent({
      surface: "visual-recap",
      action: "draft-applied",
    });
  }

  function handleDismissAiRecapDraft() {
    setGeneratedAiRecap(null);
    setAiStatusMessage(
      "Dismissed the AI recap draft. The current gallery and recaps are unchanged.",
    );
  }

  function handleOpenTrendDestination(
    destination?: AiCrossSpaceTrendDraft["suggestedDestination"],
    sourceSpaceId?: string,
  ) {
    if (!destination || destination === "visual-history") {
      router.push(
        sourceSpaceId
          ? (`/visual-history?spaceId=${sourceSpaceId}` as never)
          : ("/visual-history" as never),
      );
      return;
    }

    if (destination === "planner") {
      router.push("/planner" as never);
      return;
    }

    if (destination === "inventory") {
      router.push("/inventory" as never);
      return;
    }

    router.push("/workspace-tools" as never);
  }

  function handleOpenTrendSource(source: AiCrossSpaceTrendSource) {
    handleOpenTrendDestination(source.route, source.spaceId);
  }

  async function handleGenerateAiTrend() {
    if (!isWorkspaceScope || !selectedAiMonthKey || !selectedTrendSummary) {
      setTrendStatusMessage(
        "Workspace scope and a selected month are required before TrackItUp can explain cross-space trends.",
      );
      return;
    }

    const trimmedRequest = trendRequest.trim();
    if (!trimmedRequest) {
      setTrendStatusMessage(
        "Describe the cross-space trend or anomaly question you want answered before generating it.",
      );
      return;
    }

    const trendPrompt = buildCrossSpaceTrendPrompt({
      workspace,
      monthKey: selectedAiMonthKey,
      userRequest: trimmedRequest,
    });
    setIsGeneratingAiTrend(true);
    void recordAiTelemetryEvent({
      surface: "cross-space-trends",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: trendPrompt.system,
      prompt: buildAiCrossSpaceTrendGenerationPrompt(trendPrompt.prompt),
      temperature: 0.25,
      maxOutputTokens: 950,
    });
    setIsGeneratingAiTrend(false);

    if (result.status !== "success") {
      setGeneratedAiTrend(null);
      setTrendStatusMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "cross-space-trends",
        action: "generate-failed",
      });
      return;
    }

    const parsedDraft = parseAiCrossSpaceTrendDraft(result.text, {
      allowedSourceIds: trendPrompt.context.retrievedSources.map(
        (source) => source.id,
      ),
    });
    if (!parsedDraft) {
      setGeneratedAiTrend(null);
      setTrendStatusMessage(
        "TrackItUp received an AI response but could not turn it into a grounded trend summary. Try asking for a narrower month-over-month explanation.",
      );
      void recordAiTelemetryEvent({
        surface: "cross-space-trends",
        action: "generate-failed",
      });
      return;
    }

    setGeneratedAiTrend({
      request: trimmedRequest,
      monthKey: selectedAiMonthKey,
      consentLabel: trendPrompt.consentLabel,
      modelId: result.modelId,
      usage: result.usage,
      sources: trendPrompt.context.retrievedSources,
      draft: parsedDraft,
    });
    setTrendStatusMessage(
      `Generated a grounded trend summary for ${formatMonth(selectedAiMonthKey)}. Review the cited sources before applying it.`,
    );
    void recordAiTelemetryEvent({
      surface: "cross-space-trends",
      action: "generate-succeeded",
    });
  }

  function handleApplyAiTrend() {
    if (!generatedAiTrend) return;
    setAppliedAiTrend(generatedAiTrend);
    setGeneratedAiTrend(null);
    setTrendStatusMessage(
      "Applied the cross-space trend summary. Review the cited spaces and anomalies before acting on it.",
    );
    void recordAiTelemetryEvent({
      surface: "cross-space-trends",
      action: "draft-applied",
    });
  }

  function handleDismissAiTrendDraft() {
    setGeneratedAiTrend(null);
    setTrendStatusMessage(
      "Dismissed the AI trend draft. The current gallery and recaps are unchanged.",
    );
  }

  function handlePinRecapCover(monthKey: string, photoId: string) {
    const selectionKey = getVisualRecapCoverSelectionKey(
      historyScope,
      monthKey,
    );

    setRecapCoverSelections((currentSelections) => {
      const previousSelection = currentSelections[selectionKey];
      const nextSelections = {
        ...currentSelections,
        [selectionKey]: {
          coverPhotoId: photoId,
          orderedPhotoIds: previousSelection?.orderedPhotoIds,
        },
      };
      void persistVisualRecapCoverSelections(nextSelections);
      return nextSelections;
    });

    triggerSuccessFeedback();
    setExportMessage(`${formatMonth(monthKey)} cover photo updated.`);
  }

  function handleMoveRecapHighlight(
    monthKey: string,
    photoId: string,
    direction: "left" | "right",
  ) {
    const recap = history.monthlyRecaps.find(
      (item) => item.monthKey === monthKey,
    );
    if (!recap) return;

    const selectionKey = getVisualRecapCoverSelectionKey(
      historyScope,
      monthKey,
    );
    const currentOrder = recap.items.map((item) => item.id);
    const currentIndex = currentOrder.indexOf(photoId);
    const targetIndex =
      direction === "left" ? currentIndex - 1 : currentIndex + 1;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= currentOrder.length
    ) {
      return;
    }

    const nextOrder = [...currentOrder];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, moved);

    setRecapCoverSelections((currentSelections) => {
      const previousSelection = currentSelections[selectionKey];
      const nextSelections = {
        ...currentSelections,
        [selectionKey]: {
          coverPhotoId: previousSelection?.coverPhotoId ?? nextOrder[0],
          orderedPhotoIds: nextOrder,
        },
      };
      void persistVisualRecapCoverSelections(nextSelections);
      return nextSelections;
    });

    triggerSelectionFeedback();
  }

  async function handleExportRecap(monthKey: string, mode: "export" | "share") {
    const recap = history.monthlyRecaps.find(
      (item) => item.monthKey === monthKey,
    );
    if (!recap) return;

    setBusyRecapKey(monthKey);
    try {
      const uri = await exportVisualRecapPdfAsync(scopeLabel, recap);
      const title = buildVisualRecapTitle(scopeLabel, recap);

      if (mode === "share" && Platform.OS !== "web") {
        await Share.share({
          title,
          message: buildVisualRecapShareMessage(scopeLabel, recap),
          url: uri,
        });
        setExportMessage(`Shared ${title}.`);
        return;
      }

      setExportMessage(`${title} exported to ${uri}`);
    } catch (error) {
      setExportMessage(
        error instanceof Error
          ? error.message
          : "The recap could not be exported right now.",
      );
    } finally {
      setBusyRecapKey(null);
    }
  }

  if (!isHydrated) {
    return (
      <View style={[styles.screen, paletteStyles.screenBackground]}>
        <Stack.Screen options={{ title: "Visual history" }} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          <ScreenHero
            palette={palette}
            title={title}
            subtitle="TrackItUp is hydrating your photo timeline and rebuilding the visual trail for this scope."
            badges={[
              {
                label: "Visual history",
                backgroundColor: theme.colors.primaryContainer,
                textColor: theme.colors.onPrimaryContainer,
              },
              {
                label: "Loading",
                backgroundColor: theme.colors.surface,
                textColor: theme.colors.onSurface,
              },
            ]}
          />
          <WorkspacePageSkeleton palette={palette} sectionCount={4} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, paletteStyles.screenBackground]}>
      <Stack.Screen options={{ title: "Visual history" }} />

      <FlatList
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        data={history.photos}
        keyExtractor={(photo) => photo.id}
        renderItem={renderTimelinePhoto}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        scrollEventThrottle={Platform.OS === "web" ? 64 : 32}
        removeClippedSubviews={Platform.OS === "android"}
        ListHeaderComponent={
          <>
            <ScreenHero
              palette={palette}
              title={title}
              subtitle={subtitle}
              badges={[
                {
                  label: `${history.photoCount} photo(s)`,
                  backgroundColor: theme.colors.primaryContainer,
                  textColor: theme.colors.onPrimaryContainer,
                },
                {
                  label: `${history.proofCount} proof shot(s)`,
                  backgroundColor: theme.colors.tertiaryContainer,
                  textColor: theme.colors.onTertiaryContainer,
                },
                {
                  label: `${history.monthlyRecaps.length} month recap(s)`,
                  backgroundColor: theme.colors.surface,
                  textColor: theme.colors.onSurface,
                },
              ]}
            />

            <PageQuickActions
              palette={palette}
              title="Act on the visual trail"
              description="Jump into the linked log, capture the next proof photo, or change gallery scope without losing the context of the current history view."
              actions={pageQuickActions}
            />

            {exportMessage ? (
              <SectionMessage
                palette={palette}
                label="Recap export"
                title="Latest visual recap action"
                message={exportMessage}
                style={styles.messageCard}
              />
            ) : null}

            {history.monthlyRecaps.length > 0 ? (
              <SectionSurface
                palette={palette}
                label="AI narrator target"
                title="Choose the recap month"
              >
                <Text style={[styles.copy, paletteStyles.mutedText]}>
                  Pick the monthly recap you want narrated, then describe the
                  tone or audience for the AI summary.
                </Text>
                <Text style={[styles.filterLabel, paletteStyles.mutedText]}>
                  Filter by month
                </Text>
                <ChipRow
                  style={[
                    styles.aiMonthChipRow,
                    {
                      backgroundColor: theme.colors.elevation.level1,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  {history.monthlyRecaps.map((recap) => (
                    <Chip
                      key={recap.monthKey}
                      compact
                      selected={selectedAiMonthKey === recap.monthKey}
                      showSelectedCheck={false}
                      style={[
                        styles.infoChip,
                        styles.filterChip,
                        selectedAiMonthKey === recap.monthKey
                          ? {
                              backgroundColor: theme.colors.primaryContainer,
                              borderColor: theme.colors.primary,
                            }
                          : {
                              backgroundColor: theme.colors.surface,
                              borderColor: theme.colors.outlineVariant,
                            },
                      ]}
                      textStyle={{
                        color:
                          selectedAiMonthKey === recap.monthKey
                            ? theme.colors.onPrimaryContainer
                            : theme.colors.onSurfaceVariant,
                      }}
                      onPress={() => setSelectedAiMonthKey(recap.monthKey)}
                    >
                      {formatMonth(recap.monthKey)}
                    </Chip>
                  ))}
                </ChipRow>
                <Text style={[styles.meta, paletteStyles.mutedText]}>
                  {selectedAiRecap
                    ? `${selectedAiRecap.photoCount} photo(s) and ${selectedAiRecap.proofCount} proof shot(s) will anchor the narration.`
                    : "No recap is selected."}
                </Text>
              </SectionSurface>
            ) : null}

            {selectedAiRecap ? (
              <AiPromptComposerCard
                palette={palette}
                label="AI visual narrator"
                title="Draft a grounded visual recap"
                value={aiRequest}
                onChangeText={setAiRequest}
                onSubmit={() => void handleGenerateAiRecap()}
                isBusy={isGeneratingAiRecap}
                contextChips={[
                  scopeLabel,
                  selectedAiMonthLabel ?? "No month selected",
                ]}
                placeholder="Example: Write a concise family update for this month that highlights progress and proof-of-completion moments."
                helperText={aiVisualRecapCopy.getHelperText(
                  scopeLabel,
                  selectedAiMonthLabel ?? "the selected month",
                )}
                consentLabel={aiVisualRecapCopy.consentLabel}
                footerNote={aiVisualRecapCopy.promptFooterNote}
                submitLabel="Generate recap"
              />
            ) : null}

            {aiStatusMessage ? (
              <SectionMessage
                palette={palette}
                label="AI recap"
                title="Latest narrator status"
                message={aiStatusMessage}
                style={styles.messageCard}
              />
            ) : null}

            {generatedAiRecap ? (
              <AiDraftReviewCard
                palette={palette}
                title="Review the AI visual recap"
                draftKindLabel={`${generatedAiRecap.scopeLabel} • ${formatMonth(generatedAiRecap.monthKey)}`}
                summary={`Prompt: ${generatedAiRecap.request}`}
                consentLabel={generatedAiRecap.consentLabel}
                footerNote={aiVisualRecapCopy.reviewFooterNote}
                statusLabel="Draft ready"
                modelLabel={generatedAiRecap.modelId}
                usage={generatedAiRecap.usage}
                contextChips={[
                  generatedAiRecap.scopeLabel,
                  formatMonth(generatedAiRecap.monthKey),
                ]}
                items={buildAiVisualRecapReviewItems(generatedAiRecap.draft)}
                acceptLabel="Show in gallery"
                editLabel="Dismiss draft"
                regenerateLabel="Generate again"
                onAccept={handleApplyAiRecap}
                onEdit={handleDismissAiRecapDraft}
                onRegenerate={() => void handleGenerateAiRecap()}
                isBusy={isGeneratingAiRecap}
              />
            ) : null}

            {appliedAiRecap ? (
              <SectionSurface
                palette={palette}
                label="AI narrator"
                title={appliedAiRecap.draft.headline}
              >
                <ChipRow style={styles.aiMonthChipRow}>
                  <Chip compact style={styles.infoChip}>
                    {formatMonth(appliedAiRecap.monthKey)}
                  </Chip>
                  <Chip compact style={styles.infoChip}>
                    {appliedAiRecap.scopeLabel}
                  </Chip>
                </ChipRow>
                {appliedAiRecap.draft.summary ? (
                  <Text
                    style={[styles.copy, { color: theme.colors.onSurface }]}
                  >
                    {appliedAiRecap.draft.summary}
                  </Text>
                ) : null}
                {appliedAiRecap.draft.highlights.length > 0 ? (
                  <View style={styles.aiHighlightList}>
                    {appliedAiRecap.draft.highlights.map((highlight) => (
                      <Text
                        key={`${appliedAiRecap.monthKey}-${highlight}`}
                        style={[styles.meta, { color: theme.colors.onSurface }]}
                      >
                        • {highlight}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {appliedAiRecap.draft.nextFocus ? (
                  <Text style={[styles.meta, paletteStyles.mutedText]}>
                    Next focus: {appliedAiRecap.draft.nextFocus}
                  </Text>
                ) : null}
                <ActionButtonRow
                  separated
                  separatorColor={theme.colors.outlineVariant}
                  style={styles.recapActionRow}
                >
                  <CardActionPill
                    label="Clear recap"
                    onPress={() => setAppliedAiRecap(null)}
                  />
                  <CardActionPill
                    label="Refresh recap"
                    onPress={() => void handleGenerateAiRecap()}
                    disabled={isGeneratingAiRecap}
                  />
                </ActionButtonRow>
              </SectionSurface>
            ) : null}

            {isWorkspaceScope && selectedTrendSummary ? (
              <AiPromptComposerCard
                palette={palette}
                label="AI trend analyst"
                title="Explain cross-space trends and anomalies"
                value={trendRequest}
                onChangeText={setTrendRequest}
                onSubmit={() => void handleGenerateAiTrend()}
                isBusy={isGeneratingAiTrend}
                contextChips={[
                  selectedAiMonthLabel ?? "No month selected",
                  `${selectedTrendSummary.anomalies.length} anomaly${selectedTrendSummary.anomalies.length === 1 ? "" : "ies"}`,
                  `${selectedTrendSummary.totals.activeSpaceCount} active space${selectedTrendSummary.totals.activeSpaceCount === 1 ? "" : "s"}`,
                ]}
                placeholder="Example: Summarize the strongest month-over-month changes across spaces and explain which anomalies need follow-up first."
                helperText={aiCrossSpaceTrendCopy.helperText}
                consentLabel={aiCrossSpaceTrendCopy.consentLabel}
                footerNote={aiCrossSpaceTrendCopy.promptFooterNote}
                submitLabel="Generate trend summary"
              />
            ) : null}

            {trendStatusMessage ? (
              <SectionMessage
                palette={palette}
                label="AI trends"
                title="Latest trend summary status"
                message={trendStatusMessage}
                style={styles.messageCard}
              />
            ) : null}

            {generatedAiTrend ? (
              <AiDraftReviewCard
                palette={palette}
                title="Review the AI trend summary"
                draftKindLabel={`Workspace • ${formatMonth(generatedAiTrend.monthKey)}`}
                summary={`Prompt: ${generatedAiTrend.request}`}
                consentLabel={generatedAiTrend.consentLabel}
                footerNote={aiCrossSpaceTrendCopy.reviewFooterNote}
                statusLabel="Draft ready"
                modelLabel={generatedAiTrend.modelId}
                usage={generatedAiTrend.usage}
                contextChips={[
                  formatMonth(generatedAiTrend.monthKey),
                  `${generatedAiTrend.draft.citedSourceIds.length} cited source${generatedAiTrend.draft.citedSourceIds.length === 1 ? "" : "s"}`,
                ]}
                items={buildAiCrossSpaceTrendReviewItems(
                  generatedAiTrend.draft,
                  generatedAiTrend.sources,
                )}
                acceptLabel="Apply summary"
                editLabel="Dismiss draft"
                regenerateLabel="Generate again"
                onAccept={handleApplyAiTrend}
                onEdit={handleDismissAiTrendDraft}
                onRegenerate={() => void handleGenerateAiTrend()}
                isBusy={isGeneratingAiTrend}
              />
            ) : null}

            {appliedAiTrend ? (
              <SectionSurface
                palette={palette}
                label="AI trends"
                title={appliedAiTrend.draft.headline}
              >
                <ChipRow style={styles.aiMonthChipRow}>
                  <Chip compact style={styles.infoChip}>
                    {formatMonth(appliedAiTrend.monthKey)}
                  </Chip>
                  {appliedAiTrend.draft.suggestedDestination ? (
                    <Chip compact style={styles.infoChip}>
                      {formatAiCrossSpaceTrendDestinationLabel(
                        appliedAiTrend.draft.suggestedDestination,
                      )}
                    </Chip>
                  ) : null}
                </ChipRow>
                {appliedAiTrend.draft.summary ? (
                  <Text
                    style={[styles.copy, { color: theme.colors.onSurface }]}
                  >
                    {appliedAiTrend.draft.summary}
                  </Text>
                ) : null}
                {appliedAiTrend.draft.keySignals.length > 0 ? (
                  <View style={styles.aiHighlightList}>
                    {appliedAiTrend.draft.keySignals.map((signal) => (
                      <Text
                        key={signal}
                        style={[styles.meta, { color: theme.colors.onSurface }]}
                      >
                        • {signal}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {appliedAiTrend.draft.caution ? (
                  <Text style={[styles.meta, paletteStyles.mutedText]}>
                    Caution: {appliedAiTrend.draft.caution}
                  </Text>
                ) : null}
                {appliedAiTrend.sources
                  .filter((source) =>
                    appliedAiTrend.draft.citedSourceIds.includes(source.id),
                  )
                  .map((source) => (
                    <Surface
                      key={source.id}
                      style={[
                        styles.galleryRow,
                        styles.trendSourceCard,
                        {
                          backgroundColor: theme.colors.elevation.level1,
                          borderColor: theme.colors.outlineVariant,
                        },
                      ]}
                      elevation={1}
                    >
                      <View style={styles.galleryCopy}>
                        <Text style={styles.galleryTitle}>
                          {formatAiCrossSpaceTrendSourceLabel(source)}
                        </Text>
                        <Text style={[styles.meta, paletteStyles.mutedText]}>
                          {source.snippet}
                        </Text>
                      </View>
                      <CardActionPill
                        label={formatAiCrossSpaceTrendDestinationLabel(
                          source.route,
                        )}
                        onPress={() => handleOpenTrendSource(source)}
                      />
                    </Surface>
                  ))}
                <ActionButtonRow
                  separated
                  separatorColor={theme.colors.outlineVariant}
                  style={styles.recapActionRow}
                >
                  <CardActionPill
                    label="Clear summary"
                    onPress={() => setAppliedAiTrend(null)}
                  />
                  <CardActionPill
                    label={formatAiCrossSpaceTrendDestinationLabel(
                      appliedAiTrend.draft.suggestedDestination ??
                        "visual-history",
                    )}
                    onPress={() =>
                      handleOpenTrendDestination(
                        appliedAiTrend.draft.suggestedDestination,
                      )
                    }
                  />
                </ActionButtonRow>
              </SectionSurface>
            ) : null}

            {history.photos.length === 0 ? (
              <SectionSurface
                palette={palette}
                label="Gallery"
                title="Photo timeline"
              >
                <EmptyStateCard
                  palette={palette}
                  icon={{
                    ios: "photo.stack",
                    android: "photo_library",
                    web: "photo_library",
                  }}
                  title="No photos yet"
                  message="Photos added to logs will appear here automatically. Use quick logs, routine runs, or reminder completions to build a visual timeline."
                  actionLabel="Open logbook"
                  onAction={() => router.push("/logbook")}
                />
              </SectionSurface>
            ) : (
              <>
                {history.beforeAfter ? (
                  <SectionSurface
                    palette={palette}
                    label="Comparison"
                    title="Before and after"
                  >
                    <BeforeAfterSlider
                      palette={palette}
                      beforeUri={history.beforeAfter.before.uri}
                      afterUri={history.beforeAfter.after.uri}
                      beforeLabel="Before"
                      afterLabel="Latest"
                    />
                    <View style={styles.comparisonMetaRow}>
                      {[
                        history.beforeAfter.before,
                        history.beforeAfter.after,
                      ].map((item, index) => (
                        <MotionView
                          key={item.id}
                          delay={uiMotion.stagger * (index + 1)}
                          style={styles.comparisonCardMotionWrap}
                        >
                          <Pressable
                            style={({ pressed }) => [
                              styles.comparisonCard,
                              {
                                backgroundColor: theme.colors.elevation.level1,
                                borderColor: theme.colors.outlineVariant,
                                opacity: pressed ? 0.94 : 1,
                              },
                            ]}
                            onPress={() =>
                              openLightbox(
                                lightboxItems,
                                lightboxItems.findIndex(
                                  (candidate) => candidate.id === item.id,
                                ),
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.comparisonLabel,
                                { color: item.spaceColor },
                              ]}
                            >
                              {index === 0 ? "Before" : "Latest"}
                            </Text>
                            <Text style={styles.photoTitle}>
                              {item.logTitle}
                            </Text>
                            <Text
                              style={[styles.meta, paletteStyles.mutedText]}
                            >
                              {formatDateTime(item.capturedAt)}
                            </Text>
                          </Pressable>
                        </MotionView>
                      ))}
                    </View>
                  </SectionSurface>
                ) : null}

                {!assetId && history.assetGalleries.length > 0 ? (
                  <SectionSurface
                    palette={palette}
                    label="Assets"
                    title="Progress galleries"
                  >
                    {history.assetGalleries.map((gallery, index) => (
                      <MotionView
                        key={gallery.id}
                        delay={uiMotion.stagger * (index + 1)}
                      >
                        <SwipeActionCard
                          rightActions={[
                            {
                              label: "Open",
                              accentColor: palette.tint,
                              onPress: () =>
                                router.push(
                                  `/visual-history?assetId=${gallery.id}` as never,
                                ),
                            },
                          ]}
                        >
                          <Surface
                            style={[
                              styles.galleryRow,
                              {
                                backgroundColor: theme.colors.elevation.level1,
                                borderColor: theme.colors.outlineVariant,
                              },
                            ]}
                            elevation={1}
                          >
                            <Image
                              source={{ uri: gallery.latestUri }}
                              style={[
                                styles.galleryThumb,
                                { backgroundColor: palette.surface3 },
                              ]}
                            />
                            <View style={styles.galleryCopy}>
                              <Text style={styles.galleryTitle}>
                                {gallery.label}
                              </Text>
                              <Text
                                style={[styles.meta, paletteStyles.mutedText]}
                              >
                                {gallery.photoCount} photo(s) •{" "}
                                {gallery.proofCount} proof shot(s)
                              </Text>
                            </View>
                            <CardActionPill
                              label="Open"
                              onPress={() =>
                                router.push(
                                  `/visual-history?assetId=${gallery.id}` as never,
                                )
                              }
                            />
                          </Surface>
                        </SwipeActionCard>
                      </MotionView>
                    ))}
                  </SectionSurface>
                ) : null}

                <SectionSurface
                  palette={palette}
                  label="Highlight reels"
                  title="Monthly recaps"
                >
                  {history.monthlyRecaps.map((recap, index) => {
                    const isPinnedCover =
                      recapCoverSelections[
                        getVisualRecapCoverSelectionKey(
                          historyScope,
                          recap.monthKey,
                        )
                      ]?.coverPhotoId === recap.coverPhotoId;

                    return (
                      <MotionView
                        key={recap.monthKey}
                        delay={uiMotion.stagger * (index + 1)}
                      >
                        <Surface
                          style={[
                            styles.recapCard,
                            {
                              backgroundColor: theme.colors.elevation.level1,
                              borderColor: theme.colors.outlineVariant,
                            },
                            recapCardShadow,
                          ]}
                          elevation={2}
                        >
                          <View style={styles.recapHeaderRow}>
                            <View style={styles.recapHeaderCopy}>
                              <Text style={styles.recapTitle}>
                                {formatMonth(recap.monthKey)}
                              </Text>
                              <Text
                                style={[
                                  styles.recapIntro,
                                  paletteStyles.mutedText,
                                ]}
                              >
                                Featured moments captured this month. Tap the
                                cover to open the full reel.
                              </Text>
                            </View>
                            {isPinnedCover ? (
                              <Chip
                                compact
                                style={[
                                  styles.infoChip,
                                  {
                                    backgroundColor:
                                      theme.colors.secondaryContainer,
                                  },
                                ]}
                                textStyle={[
                                  styles.infoChipText,
                                  { color: theme.colors.onSecondaryContainer },
                                ]}
                              >
                                Favorite cover pinned
                              </Chip>
                            ) : null}
                          </View>
                          <ChipRow style={styles.recapChipRow}>
                            <Chip
                              compact
                              style={[
                                styles.infoChip,
                                {
                                  backgroundColor: theme.colors.surfaceVariant,
                                },
                              ]}
                              textStyle={[
                                styles.infoChipText,
                                { color: theme.colors.onSurfaceVariant },
                              ]}
                            >
                              {recap.photoCount} photo(s)
                            </Chip>
                            <Chip
                              compact
                              style={[
                                styles.infoChip,
                                {
                                  backgroundColor: theme.colors.surfaceVariant,
                                },
                              ]}
                              textStyle={[
                                styles.infoChipText,
                                { color: theme.colors.onSurfaceVariant },
                              ]}
                            >
                              {recap.proofCount} proof shot(s)
                            </Chip>
                          </ChipRow>
                          {recap.coverUri ? (
                            <Pressable
                              style={styles.recapCoverFrame}
                              onPress={() =>
                                openLightbox(buildLightboxItems(recap.items), 0)
                              }
                            >
                              <Image
                                source={{ uri: recap.coverUri }}
                                style={[
                                  styles.recapCoverImage,
                                  { backgroundColor: palette.surface3 },
                                ]}
                              />
                              <View
                                style={[
                                  styles.recapCoverOverlay,
                                  {
                                    backgroundColor: withAlpha(
                                      palette.inverseSurface,
                                      0.2,
                                    ),
                                  },
                                ]}
                              >
                                <View style={styles.recapCoverTopRow}>
                                  <Chip
                                    compact
                                    style={[
                                      styles.recapOverlayChip,
                                      {
                                        backgroundColor: withAlpha(
                                          palette.inverseSurface,
                                          0.66,
                                        ),
                                      },
                                    ]}
                                  >
                                    Cover photo
                                  </Chip>
                                  {recap.proofCount > 0 ? (
                                    <Chip
                                      compact
                                      style={[
                                        styles.recapOverlayChip,
                                        {
                                          backgroundColor: withAlpha(
                                            palette.inverseSurface,
                                            0.66,
                                          ),
                                        },
                                      ]}
                                    >
                                      {recap.proofCount} proof shot(s)
                                    </Chip>
                                  ) : null}
                                </View>
                                <View style={styles.recapCoverBottomRow}>
                                  <View style={styles.recapCoverCopy}>
                                    <Text
                                      style={[
                                        styles.recapCoverTitle,
                                        { color: palette.inverseOnSurface },
                                      ]}
                                    >
                                      {recap.items[0]?.logTitle ??
                                        "Monthly highlight"}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.recapCoverHint,
                                        {
                                          color: withAlpha(
                                            palette.inverseOnSurface,
                                            0.88,
                                          ),
                                        },
                                      ]}
                                    >
                                      Tap to open reel • {recap.items.length}{" "}
                                      captured moment(s)
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </Pressable>
                          ) : null}
                          <View style={styles.highlightStrip}>
                            {recap.items.map((item, highlightIndex) => (
                              <ReorderGestureCard
                                key={item.id}
                                axis="horizontal"
                                onMoveBackward={
                                  highlightIndex > 0
                                    ? () =>
                                        handleMoveRecapHighlight(
                                          recap.monthKey,
                                          item.id,
                                          "left",
                                        )
                                    : undefined
                                }
                                onMoveForward={
                                  highlightIndex < recap.items.length - 1
                                    ? () =>
                                        handleMoveRecapHighlight(
                                          recap.monthKey,
                                          item.id,
                                          "right",
                                        )
                                    : undefined
                                }
                              >
                                <View
                                  style={[
                                    styles.highlightCard,
                                    {
                                      backgroundColor:
                                        recap.coverPhotoId === item.id
                                          ? theme.colors.primaryContainer
                                          : theme.colors.elevation.level1,
                                      borderColor:
                                        recap.coverPhotoId === item.id
                                          ? theme.colors.primary
                                          : theme.colors.outlineVariant,
                                    },
                                  ]}
                                >
                                  <Pressable
                                    onPress={() =>
                                      openLightbox(
                                        buildLightboxItems(recap.items),
                                        highlightIndex,
                                      )
                                    }
                                  >
                                    <Image
                                      source={{ uri: item.uri }}
                                      style={[
                                        styles.highlightImage,
                                        { backgroundColor: palette.surface3 },
                                      ]}
                                    />
                                  </Pressable>
                                  <View style={styles.highlightCopy}>
                                    <Text
                                      numberOfLines={1}
                                      style={styles.highlightTitle}
                                    >
                                      {item.logTitle}
                                    </Text>
                                    <Text
                                      numberOfLines={1}
                                      style={[
                                        styles.highlightMeta,
                                        paletteStyles.mutedText,
                                      ]}
                                    >
                                      {formatDateTime(item.capturedAt)}
                                    </Text>
                                  </View>
                                  <Text
                                    style={[
                                      styles.reorderHint,
                                      paletteStyles.mutedText,
                                    ]}
                                  >
                                    Drag sideways to reorder
                                  </Text>
                                  <Button
                                    compact
                                    mode={
                                      recap.coverPhotoId === item.id
                                        ? "contained-tonal"
                                        : "text"
                                    }
                                    buttonColor={
                                      recap.coverPhotoId === item.id
                                        ? theme.colors.secondaryContainer
                                        : undefined
                                    }
                                    textColor={
                                      recap.coverPhotoId === item.id
                                        ? theme.colors.onSecondaryContainer
                                        : theme.colors.primary
                                    }
                                    contentStyle={styles.highlightButtonContent}
                                    onPress={() =>
                                      handlePinRecapCover(
                                        recap.monthKey,
                                        item.id,
                                      )
                                    }
                                  >
                                    {recap.coverPhotoId === item.id
                                      ? "Pinned cover"
                                      : "Pin cover"}
                                  </Button>
                                </View>
                              </ReorderGestureCard>
                            ))}
                          </View>
                          <ActionButtonRow
                            separated
                            separatorColor={theme.colors.outlineVariant}
                            style={styles.recapActionRow}
                          >
                            <Button
                              mode="contained"
                              buttonColor={theme.colors.primary}
                              textColor={theme.colors.onPrimary}
                              onPress={() =>
                                void handleExportRecap(recap.monthKey, "share")
                              }
                              loading={busyRecapKey === recap.monthKey}
                              disabled={busyRecapKey !== null}
                            >
                              {Platform.OS === "web"
                                ? "Export recap"
                                : "Share recap"}
                            </Button>
                            <Button
                              mode="outlined"
                              textColor={theme.colors.primary}
                              onPress={() =>
                                void handleExportRecap(recap.monthKey, "export")
                              }
                              disabled={busyRecapKey !== null}
                            >
                              Export PDF
                            </Button>
                          </ActionButtonRow>
                        </Surface>
                      </MotionView>
                    );
                  })}
                </SectionSurface>

                <SectionSurface
                  palette={palette}
                  label="Timeline"
                  title="Progress gallery"
                >
                  <Text style={[styles.meta, paletteStyles.mutedText]}>
                    Showing {history.photos.length} captured moment(s). Scroll
                    to browse the virtualized timeline.
                  </Text>
                </SectionSurface>
              </>
            )}
          </>
        }
      />

      <PhotoLightbox
        visible={Boolean(lightboxState)}
        palette={palette}
        items={lightboxState?.items ?? []}
        initialIndex={lightboxState?.initialIndex ?? 0}
        onRequestClose={() => setLightboxState(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  messageCard: { marginBottom: uiSpace.xl },
  copy: uiTypography.body,
  meta: uiTypography.bodySmall,
  filterLabel: {
    ...uiTypography.label,
    marginTop: uiSpace.md,
    marginBottom: uiSpace.xs,
  },
  aiMonthChipRow: {
    marginTop: uiSpace.xs,
    padding: uiSpace.xs,
    borderWidth: uiBorder.hairline,
    borderRadius: uiRadius.xl,
  },
  aiHighlightList: { marginTop: uiSpace.md, gap: uiSpace.xs },
  comparisonMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
    marginTop: uiSpace.lg,
  },
  comparisonCard: {
    flex: 1,
    minWidth: 150,
    gap: uiSpace.xs,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    borderWidth: uiBorder.standard,
  },
  comparisonCardMotionWrap: {
    flex: 1,
    minWidth: 150,
  },
  comparisonLabel: { ...uiTypography.label, marginBottom: 4 },
  galleryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: uiSpace.lg,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    marginBottom: uiSpace.lg,
  },
  galleryThumb: {
    width: 64,
    height: 64,
    borderRadius: uiRadius.lg,
  },
  galleryCopy: { flex: 1, gap: uiSpace.xxs },
  galleryTitle: { ...uiTypography.titleMd, marginBottom: 2 },
  recapCard: {
    marginBottom: uiSpace.xl,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.hero,
    padding: uiSpace.surface,
  },
  recapHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: uiSpace.md,
  },
  recapHeaderCopy: { flex: 1, gap: uiSpace.xs },
  recapTitle: { ...uiTypography.titleMd, marginBottom: uiSpace.sm },
  recapIntro: uiTypography.bodySmall,
  recapChipRow: { marginBottom: uiSpace.md },
  recapCoverFrame: {
    borderRadius: uiRadius.xl,
    overflow: "hidden",
    marginBottom: uiSpace.md,
  },
  recapCoverImage: {
    width: "100%",
    height: 188,
  },
  recapCoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: uiSpace.md,
  },
  recapCoverTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
    justifyContent: "space-between",
  },
  recapOverlayChip: {
    borderRadius: uiRadius.pill,
  },
  recapCoverBottomRow: {
    marginTop: uiSpace.hero,
  },
  recapCoverCopy: {
    gap: uiSpace.xxs,
    paddingTop: uiSpace.xl,
  },
  recapCoverTitle: {
    ...uiTypography.titleLg,
  },
  recapCoverHint: {
    ...uiTypography.bodySmall,
  },
  recapActionRow: {
    marginTop: uiSpace.lg,
  },
  trendSourceCard: {
    marginTop: uiSpace.md,
    marginBottom: 0,
  },
  infoChip: { borderRadius: uiRadius.md },
  filterChip: { borderWidth: uiBorder.hairline },
  infoChipText: uiTypography.chip,
  highlightStrip: { flexDirection: "row", flexWrap: "wrap", gap: uiSpace.sm },
  highlightCard: {
    width: 112,
    gap: uiSpace.xs,
    padding: uiSpace.sm,
    borderRadius: uiRadius.lg,
    borderWidth: uiBorder.standard,
  },
  highlightCopy: { gap: 2 },
  highlightTitle: uiTypography.label,
  highlightMeta: uiTypography.bodySmall,
  reorderHint: {
    ...uiTypography.bodySmall,
    marginTop: 2,
  },
  highlightButtonContent: {
    minHeight: 30,
  },
  highlightImage: {
    width: 96,
    height: 96,
    borderRadius: uiRadius.lg,
  },
  photoCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    marginBottom: uiSpace.xl,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: 220,
  },
  photoCopy: { padding: uiSpace.surface, gap: uiSpace.xs },
  photoChipRow: { marginBottom: uiSpace.md },
  photoTitle: { ...uiTypography.titleSection, marginBottom: uiSpace.xs },
});
