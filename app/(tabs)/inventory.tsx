import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Chip, Surface, useTheme, type MD3Theme } from "react-native-paper";

import { Text } from "@/components/Themed";
import { AiDraftReviewCard } from "@/components/ui/AiDraftReviewCard";
import { AiPromptComposerCard } from "@/components/ui/AiPromptComposerCard";
import { CardActionPill } from "@/components/ui/CardActionPill";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import {
    FeatureSectionSwitcher,
    type FeatureSectionItem,
} from "@/components/ui/FeatureSectionSwitcher";
import { useMaterialCompactTopAppBarHeight } from "@/components/ui/MaterialCompactTopAppBar";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { useTabHeaderScroll } from "@/components/ui/TabHeaderScrollContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    getShadowStyle,
    uiBorder,
    uiElevation,
    uiRadius,
    uiShadow,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { generateOpenRouterText } from "@/services/ai/aiClient";
import { aiInventoryLifecycleCopy } from "@/services/ai/aiConsentCopy";
import {
    buildAiInventoryLifecycleGenerationPrompt,
    buildAiInventoryLifecycleReviewItems,
    formatAiInventoryLifecycleDestinationLabel,
    formatAiInventoryLifecycleSourceLabel,
    parseAiInventoryLifecycleDraft,
    type AiInventoryLifecycleDraft,
    type AiInventoryLifecycleSource,
} from "@/services/ai/aiInventoryLifecycle";
import { buildInventoryLifecyclePrompt } from "@/services/ai/aiPromptBuilders";
import { recordAiTelemetryEvent } from "@/services/ai/aiTelemetry";
import { buildWorkspaceInventoryLifecycleSummary } from "@/services/insights/workspaceInventoryLifecycle";
import { buildWorkspaceVisualHistory } from "@/services/insights/workspaceVisualHistory";

type GeneratedAiInventoryLifecycle = {
  request: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  sources: AiInventoryLifecycleSource[];
  draft: AiInventoryLifecycleDraft;
};

type InventorySection = "overview" | "assist" | "assets";

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount);
}

export default function InventoryScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const theme = useTheme<MD3Theme>();
  const headerHeight = useMaterialCompactTopAppBarHeight();
  const headerScroll = useTabHeaderScroll("inventory");
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const raisedCardShadow = useMemo(
    () => getShadowStyle(palette.shadow, uiShadow.raisedCard),
    [palette.shadow],
  );
  const router = useRouter();
  const sectionTransition = useState(() => new Animated.Value(1))[0];
  const { workspace } = useWorkspace();
  const [inventoryLifecycleRequest, setInventoryLifecycleRequest] =
    useState("");
  const [inventoryLifecycleStatusMessage, setInventoryLifecycleStatusMessage] =
    useState<string | null>(null);
  const [isGeneratingInventoryLifecycle, setIsGeneratingInventoryLifecycle] =
    useState(false);
  const [generatedInventoryLifecycle, setGeneratedInventoryLifecycle] =
    useState<GeneratedAiInventoryLifecycle | null>(null);
  const [appliedInventoryLifecycle, setAppliedInventoryLifecycle] =
    useState<GeneratedAiInventoryLifecycle | null>(null);
  const [activeSection, setActiveSection] =
    useState<InventorySection>("overview");
  const visualHistory = useMemo(
    () => buildWorkspaceVisualHistory(workspace),
    [workspace],
  );
  const inventoryLifecycle = useMemo(
    () => buildWorkspaceInventoryLifecycleSummary(workspace),
    [workspace],
  );
  const assetPhotoMap = useMemo(
    () =>
      new Map(
        visualHistory.assetGalleries.map((gallery) => [gallery.id, gallery]),
      ),
    [visualHistory.assetGalleries],
  );

  const assetCards = useMemo(() => {
    const spacesById = new Map(
      workspace.spaces.map((space) => [space.id, space] as const),
    );

    return workspace.assets.map((asset) => {
      const expenseTotal = workspace.expenses
        .filter((expense) => expense.assetId === asset.id)
        .reduce(
          (total, expense) => total + expense.amount,
          asset.purchasePrice ?? 0,
        );
      const relatedLogCount = workspace.logs.filter((log) =>
        log.assetIds?.includes(asset.id),
      ).length;

      return {
        ...asset,
        expenseTotal,
        photoCount: assetPhotoMap.get(asset.id)?.photoCount ?? 0,
        relatedLogCount,
        spaceName: spacesById.get(asset.spaceId)?.name ?? "Unknown space",
      };
    });
  }, [
    assetPhotoMap,
    workspace.assets,
    workspace.expenses,
    workspace.logs,
    workspace.spaces,
  ]);

  const totalOwnership = workspace.expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const inventoryHighlights = [
    `${assetCards.length} tracked assets`,
    `${workspace.expenses.length} expense entries`,
    `${visualHistory.photoCount} progress photos`,
  ];
  const preferredQuickLogAction =
    workspace.quickActions.find((action) => action.kind === "quick-log") ??
    workspace.quickActions[0];
  const inventoryLifecycleContextChips = [
    `${inventoryLifecycle.summary.warrantyRiskCount} warranty risk${inventoryLifecycle.summary.warrantyRiskCount === 1 ? "" : "s"}`,
    `${inventoryLifecycle.summary.documentationGapCount} documentation gap${inventoryLifecycle.summary.documentationGapCount === 1 ? "" : "s"}`,
    `${inventoryLifecycle.attentionAssets.length} attention asset${inventoryLifecycle.attentionAssets.length === 1 ? "" : "s"}`,
  ];
  const pageQuickActions = [
    {
      id: "inventory-scan",
      label: "Scan item",
      hint: `${workspace.assets.length} tracked asset${workspace.assets.length === 1 ? "" : "s"} can be matched with barcode or QR context.`,
      onPress: () => router.push("/scanner" as never),
      accentColor: palette.tint,
    },
    {
      id: "inventory-gallery",
      label: "Open gallery",
      hint: `${visualHistory.photoCount} progress photo${visualHistory.photoCount === 1 ? "" : "s"} are ready for lifecycle review.`,
      onPress: () => router.push("/visual-history" as never),
      accentColor: palette.secondary,
    },
    {
      id: "inventory-log",
      label: preferredQuickLogAction?.label ?? "Record asset update",
      hint: "Capture a fresh note, maintenance event, or ownership update from the logbook.",
      onPress: () =>
        router.push({
          pathname: "/logbook",
          params: preferredQuickLogAction
            ? { actionId: preferredQuickLogAction.id }
            : {},
        }),
    },
  ];
  const inventorySections = useMemo<FeatureSectionItem<InventorySection>[]>(
    () => [
      {
        id: "overview",
        label: "Overview",
        icon: {
          ios: "shippingbox.fill",
          android: "inventory_2",
          web: "inventory_2",
        },
        hint: "Ownership totals, scan shortcuts, and lifecycle highlights",
        meta: formatCurrency(totalOwnership),
        badges: [
          `${assetCards.length} asset${assetCards.length === 1 ? "" : "s"}`,
          `${visualHistory.photoCount} photo${visualHistory.photoCount === 1 ? "" : "s"}`,
        ],
        accentColor: palette.tint,
      },
      {
        id: "assist",
        label: "Assist",
        icon: {
          ios: "brain.head.profile",
          android: "psychology",
          web: "psychology",
        },
        hint: "AI lifecycle briefing and grounded next-step guidance",
        meta: `${inventoryLifecycle.attentionAssets.length} attention asset${inventoryLifecycle.attentionAssets.length === 1 ? "" : "s"}`,
        badges: [
          `${inventoryLifecycle.summary.warrantyRiskCount} warranty risk${inventoryLifecycle.summary.warrantyRiskCount === 1 ? "" : "s"}`,
          `${inventoryLifecycle.summary.documentationGapCount} doc gap${inventoryLifecycle.summary.documentationGapCount === 1 ? "" : "s"}`,
        ],
        accentColor: palette.secondary,
      },
      {
        id: "assets",
        label: "Assets",
        icon: {
          ios: "list.bullet.rectangle.portrait.fill",
          android: "view_list",
          web: "view_list",
        },
        hint: "Tracked asset cards, ownership notes, and photo timelines",
        meta: `${workspace.expenses.length} expense entr${workspace.expenses.length === 1 ? "y" : "ies"}`,
        badges: [
          preferredQuickLogAction ? preferredQuickLogAction.label : "Quick log",
          assetCards.length > 0 ? "Ready to review" : "No assets yet",
        ],
        accentColor: palette.tint,
      },
    ],
    [
      assetCards.length,
      inventoryLifecycle.attentionAssets.length,
      inventoryLifecycle.summary.documentationGapCount,
      inventoryLifecycle.summary.warrantyRiskCount,
      palette.secondary,
      palette.tint,
      preferredQuickLogAction,
      totalOwnership,
      visualHistory.photoCount,
      workspace.expenses.length,
    ],
  );

  useEffect(() => {
    sectionTransition.setValue(0);
    Animated.timing(sectionTransition, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [activeSection, sectionTransition]);

  const sectionContentAnimatedStyle = useMemo(
    () => ({
      opacity: sectionTransition,
      transform: [
        {
          translateY: sectionTransition.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0],
          }),
        },
      ],
    }),
    [sectionTransition],
  );

  function openInventoryLifecycleDestination(
    destination?: "inventory" | "logbook" | "visual-history",
    source?: AiInventoryLifecycleSource,
  ) {
    if (destination === "logbook") {
      router.push({
        pathname: "/logbook",
        params: {
          ...(preferredQuickLogAction
            ? { actionId: preferredQuickLogAction.id }
            : {}),
          ...(source?.spaceId ? { spaceId: source.spaceId } : {}),
        },
      });
      return;
    }
    if (destination === "visual-history") {
      router.push(
        (source?.assetId
          ? `/visual-history?assetId=${source.assetId}`
          : source?.spaceId
            ? `/visual-history?spaceId=${source.spaceId}`
            : "/visual-history") as never,
      );
      return;
    }
    router.push("/inventory" as never);
  }

  function openInventoryLifecycleSource(source: AiInventoryLifecycleSource) {
    openInventoryLifecycleDestination(source.route, source);
  }

  async function handleGenerateInventoryLifecycle() {
    const trimmedRequest = inventoryLifecycleRequest.trim();
    if (!trimmedRequest) {
      setInventoryLifecycleStatusMessage(
        "Describe the inventory lifecycle question you want answered before generating a brief.",
      );
      return;
    }

    const promptDraft = buildInventoryLifecyclePrompt({
      workspace,
      userRequest: trimmedRequest,
    });
    setIsGeneratingInventoryLifecycle(true);
    void recordAiTelemetryEvent({
      surface: "inventory-lifecycle-brief",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: promptDraft.system,
      prompt: buildAiInventoryLifecycleGenerationPrompt(promptDraft.prompt),
      temperature: 0.25,
      maxOutputTokens: 900,
    });
    setIsGeneratingInventoryLifecycle(false);

    if (result.status !== "success") {
      setGeneratedInventoryLifecycle(null);
      setInventoryLifecycleStatusMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "inventory-lifecycle-brief",
        action: "generate-failed",
      });
      return;
    }

    const parsed = parseAiInventoryLifecycleDraft(result.text, {
      allowedSourceIds: promptDraft.context.retrievedSources.map(
        (source) => source.id,
      ),
    });
    if (!parsed) {
      setGeneratedInventoryLifecycle(null);
      setInventoryLifecycleStatusMessage(
        "The AI response could not be grounded in the provided inventory sources. Try a narrower inventory question.",
      );
      void recordAiTelemetryEvent({
        surface: "inventory-lifecycle-brief",
        action: "generate-failed",
      });
      return;
    }

    setGeneratedInventoryLifecycle({
      request: trimmedRequest,
      consentLabel: promptDraft.consentLabel,
      modelId: result.modelId,
      usage: result.usage,
      sources: promptDraft.context.retrievedSources,
      draft: parsed,
    });
    setInventoryLifecycleStatusMessage(
      "Review the AI inventory lifecycle brief before applying it to this screen.",
    );
    void recordAiTelemetryEvent({
      surface: "inventory-lifecycle-brief",
      action: "generate-succeeded",
    });
  }

  function handleApplyInventoryLifecycle() {
    if (!generatedInventoryLifecycle) return;
    setAppliedInventoryLifecycle(generatedInventoryLifecycle);
    setGeneratedInventoryLifecycle(null);
    setInventoryLifecycleStatusMessage(
      "Applied the inventory lifecycle brief. Review the cited assets before acting on it.",
    );
    void recordAiTelemetryEvent({
      surface: "inventory-lifecycle-brief",
      action: "draft-applied",
    });
  }

  function handleDismissInventoryLifecycle() {
    setGeneratedInventoryLifecycle(null);
    setInventoryLifecycleStatusMessage(
      "Dismissed the AI inventory lifecycle draft. Inventory records remain unchanged.",
    );
  }

  return (
    <Animated.ScrollView
      {...headerScroll}
      scrollIndicatorInsets={{ top: headerHeight }}
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: uiSpace.screen + headerHeight },
      ]}
    >
      <Surface
        style={[styles.header, paletteStyles.heroSurface]}
        elevation={uiElevation.hero}
      >
        <View style={styles.headerBadgeRow}>
          <Chip
            compact
            style={[styles.headerBadge, paletteStyles.cardChipSurface]}
            textStyle={[styles.headerBadgeLabel, paletteStyles.tintText]}
          >
            Inventory
          </Chip>
          <Chip
            compact
            style={[styles.headerBadge, paletteStyles.accentChipSurface]}
            textStyle={styles.headerBadgeLabel}
          >
            {formatCurrency(totalOwnership)} total
          </Chip>
        </View>
        <Text style={styles.title}>Inventory & lifecycle</Text>
        <Text style={[styles.subtitle, paletteStyles.mutedText]}>
          Keep hardware, supplies, and maintenance context in one place with
          clearer ownership costs, scan access, and lifecycle visibility.
        </Text>
        <View style={styles.highlightRow}>
          {inventoryHighlights.map((item) => (
            <Chip
              key={item}
              style={[styles.highlightPill, paletteStyles.cardChipSurface]}
              textStyle={styles.highlightLabel}
            >
              {item}
            </Chip>
          ))}
        </View>
      </Surface>

      <PageQuickActions
        palette={palette}
        title="Handle inventory work quickly"
        description="Open the scan flow, review visual proof, or capture a fresh asset update without leaving the inventory context behind."
        actions={pageQuickActions}
      />

      <FeatureSectionSwitcher
        palette={palette}
        label="Feature groups"
        title="Focus on one inventory layer at a time"
        description="Switch between inventory overview, AI assistance, and asset records so the page stays easier to scan and manage."
        items={inventorySections}
        activeId={activeSection}
        onChange={setActiveSection}
      />

      <Animated.View style={sectionContentAnimatedStyle}>
        {activeSection === "overview" ? (
          <>
            <Surface
              style={[styles.summaryCard, paletteStyles.cardSurface]}
              elevation={uiElevation.card}
            >
              <Text style={styles.summaryTitle}>Tracked ownership cost</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(totalOwnership)}
              </Text>
              <Text style={[styles.summaryCopy, paletteStyles.mutedText]}>
                {workspace.expenses.length} expense entries linked to assets and
                recurring care logs.
              </Text>
              <View style={styles.summaryActionRow}>
                <CardActionPill
                  label="Scan barcode / QR"
                  onPress={() => router.push("/scanner" as never)}
                />
                <CardActionPill
                  label="Open photo gallery"
                  onPress={() => router.push("/visual-history" as never)}
                />
              </View>
            </Surface>
          </>
        ) : null}

        {activeSection === "assist" ? (
          <>
            <AiPromptComposerCard
              palette={palette}
              label="AI inventory lifecycle"
              title="Generate a grounded inventory brief"
              value={inventoryLifecycleRequest}
              onChangeText={setInventoryLifecycleRequest}
              onSubmit={() => void handleGenerateInventoryLifecycle()}
              isBusy={isGeneratingInventoryLifecycle}
              contextChips={inventoryLifecycleContextChips}
              placeholder="Example: Which tracked assets need documentation or warranty review next, and which screen should I open?"
              helperText={aiInventoryLifecycleCopy.helperText}
              consentLabel={aiInventoryLifecycleCopy.consentLabel}
              footerNote={aiInventoryLifecycleCopy.promptFooterNote}
              submitLabel="Generate inventory brief"
            />

            {inventoryLifecycleStatusMessage ? (
              <SectionMessage
                palette={palette}
                label="AI inventory lifecycle"
                title="Latest inventory brief status"
                message={inventoryLifecycleStatusMessage}
              />
            ) : null}

            {generatedInventoryLifecycle ? (
              <AiDraftReviewCard
                palette={palette}
                title="Review the AI inventory brief"
                draftKindLabel="Inventory lifecycle"
                summary={`Prompt: ${generatedInventoryLifecycle.request}`}
                consentLabel={generatedInventoryLifecycle.consentLabel}
                footerNote={aiInventoryLifecycleCopy.reviewFooterNote}
                statusLabel="Draft ready"
                modelLabel={generatedInventoryLifecycle.modelId}
                usage={generatedInventoryLifecycle.usage}
                contextChips={[
                  `${generatedInventoryLifecycle.draft.citedSourceIds.length} cited source${generatedInventoryLifecycle.draft.citedSourceIds.length === 1 ? "" : "s"}`,
                ]}
                items={buildAiInventoryLifecycleReviewItems(
                  generatedInventoryLifecycle.draft,
                  generatedInventoryLifecycle.sources,
                )}
                acceptLabel="Apply brief"
                editLabel="Dismiss draft"
                regenerateLabel="Generate again"
                onAccept={handleApplyInventoryLifecycle}
                onEdit={handleDismissInventoryLifecycle}
                onRegenerate={() => void handleGenerateInventoryLifecycle()}
                isBusy={isGeneratingInventoryLifecycle}
              />
            ) : null}

            {appliedInventoryLifecycle ? (
              <Surface
                style={[styles.summaryCard, paletteStyles.cardSurface]}
                elevation={uiElevation.card}
              >
                <View style={styles.briefTitleRow}>
                  <Text style={styles.summaryTitle}>
                    {appliedInventoryLifecycle.draft.headline}
                  </Text>
                  {appliedInventoryLifecycle.draft.suggestedDestination ? (
                    <Chip
                      compact
                      style={[
                        styles.highlightPill,
                        paletteStyles.cardChipSurface,
                      ]}
                    >
                      {formatAiInventoryLifecycleDestinationLabel(
                        appliedInventoryLifecycle.draft.suggestedDestination,
                      )}
                    </Chip>
                  ) : null}
                </View>
                {appliedInventoryLifecycle.draft.summary ? (
                  <Text style={[styles.summaryCopy, paletteStyles.mutedText]}>
                    {appliedInventoryLifecycle.draft.summary}
                  </Text>
                ) : null}
                {appliedInventoryLifecycle.draft.priorities.map((priority) => (
                  <View key={priority} style={styles.priorityRow}>
                    <View
                      style={[
                        styles.priorityDot,
                        { backgroundColor: palette.tint },
                      ]}
                    />
                    <Text style={[styles.copy, styles.priorityCopy]}>
                      {priority}
                    </Text>
                  </View>
                ))}
                {appliedInventoryLifecycle.draft.caution ? (
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    Caution: {appliedInventoryLifecycle.draft.caution}
                  </Text>
                ) : null}
                <View style={styles.appliedSourceList}>
                  {appliedInventoryLifecycle.draft.citedSourceIds
                    .map((sourceId) =>
                      appliedInventoryLifecycle.sources.find(
                        (source) => source.id === sourceId,
                      ),
                    )
                    .filter((source): source is AiInventoryLifecycleSource =>
                      Boolean(source),
                    )
                    .map((source) => (
                      <Surface
                        key={source.id}
                        style={[
                          styles.sourceCard,
                          paletteStyles.raisedCardSurface,
                          raisedCardShadow,
                        ]}
                        elevation={uiElevation.raisedCard}
                      >
                        <Text style={styles.cardTitle}>
                          {formatAiInventoryLifecycleSourceLabel(source)}
                        </Text>
                        <Text style={[styles.copy, paletteStyles.mutedText]}>
                          {source.snippet}
                        </Text>
                        <View style={styles.summaryActionRow}>
                          <CardActionPill
                            label={formatAiInventoryLifecycleDestinationLabel(
                              source.route,
                            )}
                            onPress={() => openInventoryLifecycleSource(source)}
                          />
                        </View>
                      </Surface>
                    ))}
                </View>
                <View style={styles.summaryActionRow}>
                  <CardActionPill
                    label="Clear brief"
                    onPress={() => setAppliedInventoryLifecycle(null)}
                  />
                  <CardActionPill
                    label={formatAiInventoryLifecycleDestinationLabel(
                      appliedInventoryLifecycle.draft.suggestedDestination ??
                        "inventory",
                    )}
                    onPress={() =>
                      openInventoryLifecycleDestination(
                        appliedInventoryLifecycle.draft.suggestedDestination,
                      )
                    }
                  />
                </View>
              </Surface>
            ) : null}
          </>
        ) : null}

        {activeSection === "assets" ? (
          <>
            {assetCards.length === 0 ? (
              <EmptyStateCard
                palette={palette}
                icon={{
                  ios: "shippingbox",
                  android: "inventory_2",
                  web: "inventory_2",
                }}
                title="No tracked assets yet"
                message="Asset records will appear here once real workspace data is synced, imported, or captured on this device."
                actionLabel="Open scanner"
                onAction={() => router.push("/scanner" as never)}
              />
            ) : (
              assetCards.map((asset) => (
                <View
                  key={asset.id}
                  style={[
                    styles.card,
                    paletteStyles.raisedCardSurface,
                    raisedCardShadow,
                    { borderLeftColor: palette.tint },
                  ]}
                >
                  <Text style={styles.cardTitle}>{asset.name}</Text>
                  <Text style={[styles.meta, { color: palette.tint }]}>
                    {asset.spaceName} • {asset.category} •{" "}
                    {asset.status.toUpperCase()}
                  </Text>
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    {asset.note}
                  </Text>
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    Purchase: {asset.purchaseDate ?? "n/a"} •{" "}
                    {formatCurrency(asset.purchasePrice ?? 0)}
                  </Text>
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    Warranty: {asset.warrantyExpiresAt ?? "n/a"}
                    {asset.warrantyNote ? ` • ${asset.warrantyNote}` : ""}
                  </Text>
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    Linked logs: {asset.relatedLogCount} • Ownership cost:{" "}
                    {formatCurrency(asset.expenseTotal)}
                  </Text>
                  <View style={styles.summaryActionRow}>
                    <CardActionPill
                      label={
                        asset.photoCount
                          ? `Photo timeline (${asset.photoCount})`
                          : "Photo timeline"
                      }
                      onPress={() =>
                        router.push(
                          `/visual-history?assetId=${asset.id}` as never,
                        )
                      }
                    />
                  </View>
                  {asset.barcodeValue || asset.qrCodeValue ? (
                    <Text style={[styles.copy, paletteStyles.mutedText]}>
                      Codes: {asset.barcodeValue ?? asset.qrCodeValue}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </>
        ) : null}
      </Animated.View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: uiSpace.screen,
    paddingBottom: uiSpace.screenBottomTabs,
    gap: uiSpace.xxl,
  },
  header: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.hero,
    padding: uiSpace.hero,
  },
  headerBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
    marginBottom: uiSpace.xl,
  },
  headerBadge: {
    borderRadius: uiRadius.pill,
  },
  headerBadgeLabel: uiTypography.chip,
  title: { ...uiTypography.heroTitle, marginBottom: uiSpace.sm },
  subtitle: uiTypography.subtitle,
  highlightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
    marginTop: uiSpace.surface,
  },
  highlightPill: {
    borderRadius: uiRadius.md,
  },
  highlightLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  summaryCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
  },
  summaryTitle: { ...uiTypography.titleMd, marginBottom: 6 },
  summaryValue: { ...uiTypography.valueLg, marginBottom: 6 },
  summaryCopy: uiTypography.body,
  summaryActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: uiSpace.md,
    marginTop: uiSpace.xl,
  },
  briefTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: uiSpace.md,
    marginBottom: uiSpace.sm,
  },
  priorityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: uiSpace.sm,
    marginTop: uiSpace.sm,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: uiRadius.pill,
    marginTop: 7,
  },
  priorityCopy: {
    flex: 1,
    marginBottom: 0,
  },
  appliedSourceList: {
    gap: uiSpace.md,
    marginTop: uiSpace.lg,
  },
  sourceCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    gap: uiSpace.xs,
  },
  card: {
    borderWidth: uiBorder.standard,
    borderLeftWidth: 5,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    marginBottom: uiSpace.lg,
    gap: uiSpace.xs,
    elevation: uiElevation.raisedCard,
  },
  cardTitle: { ...uiTypography.titleSection, marginBottom: 6 },
  meta: { ...uiTypography.chip, marginBottom: uiSpace.sm },
  copy: { ...uiTypography.body, marginBottom: 0, lineHeight: 20 },
});
