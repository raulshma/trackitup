import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import {
    Button,
    Chip,
    SegmentedButtons,
    Surface,
    useTheme,
    type MD3Theme,
} from "react-native-paper";

import { MiniMetricChart, type ChartMode } from "@/components/MiniMetricChart";
import { Text } from "@/components/Themed";
import { AiDraftReviewCard } from "@/components/ui/AiDraftReviewCard";
import { AiPromptComposerCard } from "@/components/ui/AiPromptComposerCard";
import { CardActionPill } from "@/components/ui/CardActionPill";
import { CollapsibleSectionCard } from "@/components/ui/CollapsibleSectionCard";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { useMaterialCompactTopAppBarHeight } from "@/components/ui/MaterialCompactTopAppBar";
import { MotionPressable, MotionView } from "@/components/ui/Motion";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { ReorderGestureCard } from "@/components/ui/ReorderGestureCard";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useTabHeaderScroll } from "@/components/ui/TabHeaderScrollContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors, { getChartSeriesColor } from "@/constants/Colors";
import { uiMotion, uiRadius, uiSpace } from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { generateOpenRouterText } from "@/services/ai/aiClient";
import { aiDashboardPulseCopy } from "@/services/ai/aiConsentCopy";
import {
    buildAiDashboardPulseGenerationPrompt,
    buildAiDashboardPulseReviewItems,
    formatAiDashboardPulseDestinationLabel,
    formatAiDashboardPulseSourceLabel,
    parseAiDashboardPulseDraft,
    type AiDashboardPulseDraft,
    type AiDashboardPulseSource,
} from "@/services/ai/aiDashboardPulse";
import { buildDashboardPulsePrompt } from "@/services/ai/aiPromptBuilders";
import { recordAiTelemetryEvent } from "@/services/ai/aiTelemetry";
import { triggerSelectionFeedback } from "@/services/device/haptics";
import {
    loadHomeDashboardSectionPreference,
    persistHomeDashboardSectionPreference,
} from "@/services/insights/homeDashboardSectionPreferencePersistence";
import { type HomeDashboardSection } from "@/services/insights/homeDashboardSectionPreferences";
import { buildWorkspaceDashboardPulse } from "@/services/insights/workspaceDashboardPulse";
import {
    buildMetricChartPoints,
    getReminderScheduleTimestamp,
} from "@/services/insights/workspaceInsights";
import { buildWorkspaceVisualHistory } from "@/services/insights/workspaceVisualHistory";
import type { WorkspaceRecommendation } from "@/types/trackitup";

type GeneratedAiDashboardPulse = {
  request: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  sources: AiDashboardPulseSource[];
  draft: AiDashboardPulseDraft;
};

type HomeSectionIconName = React.ComponentProps<typeof SymbolView>["name"];

export default function TabOneScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const theme = useTheme<MD3Theme>();
  const router = useRouter();
  const headerHeight = useMaterialCompactTopAppBarHeight();
  const headerScroll = useTabHeaderScroll("index");
  const sectionTransition = useState(() => new Animated.Value(1))[0];
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [activeSection, setActiveSection] =
    useState<HomeDashboardSection>("overview");
  const [isSectionPreferenceLoaded, setIsSectionPreferenceLoaded] =
    useState(false);
  const [dashboardPulseRequest, setDashboardPulseRequest] = useState("");
  const [dashboardPulseStatusMessage, setDashboardPulseStatusMessage] =
    useState<string | null>(null);
  const [isGeneratingDashboardPulse, setIsGeneratingDashboardPulse] =
    useState(false);
  const [generatedDashboardPulse, setGeneratedDashboardPulse] =
    useState<GeneratedAiDashboardPulse | null>(null);
  const [appliedDashboardPulse, setAppliedDashboardPulse] =
    useState<GeneratedAiDashboardPulse | null>(null);
  const {
    cycleDashboardWidgetSize,
    moveDashboardWidget,
    overviewStats,
    recommendations,
    quickActionCards,
    spaceSummaries,
    toggleDashboardWidgetVisibility,
    workspace,
  } = useWorkspace();

  const spacesById = useMemo(
    () => new Map(workspace.spaces.map((space) => [space.id, space] as const)),
    [workspace.spaces],
  );
  const spacePhotoMap = useMemo(
    () =>
      new Map(
        buildWorkspaceVisualHistory(workspace).spaceGalleries.map((gallery) => [
          gallery.id,
          gallery,
        ]),
      ),
    [workspace],
  );
  const metricDefinitionsById = useMemo(
    () =>
      new Map(
        workspace.metricDefinitions.map(
          (metric) => [metric.id, metric] as const,
        ),
      ),
    [workspace.metricDefinitions],
  );
  const dashboardPulse = useMemo(
    () => buildWorkspaceDashboardPulse(workspace),
    [workspace],
  );
  const attentionItems = useMemo(
    () =>
      dashboardPulse.attentionItems.map(
        (item) => `${item.title} • ${item.detail}`,
      ),
    [dashboardPulse.attentionItems],
  );

  const upcomingReminders = useMemo(
    () =>
      [...workspace.reminders]
        .filter(
          (reminder) =>
            reminder.status === "due" ||
            reminder.status === "scheduled" ||
            reminder.status === "snoozed",
        )
        .sort((left, right) =>
          getReminderScheduleTimestamp(left).localeCompare(
            getReminderScheduleTimestamp(right),
          ),
        )
        .slice(0, 3),
    [workspace.reminders],
  );

  const visibleWidgets = useMemo(
    () => workspace.dashboardWidgets.filter((widget) => !widget.hidden),
    [workspace.dashboardWidgets],
  );
  const hiddenWidgets = useMemo(
    () => workspace.dashboardWidgets.filter((widget) => widget.hidden),
    [workspace.dashboardWidgets],
  );
  const totalSpacePhotos = useMemo(
    () =>
      [...spacePhotoMap.values()].reduce(
        (total, gallery) => total + gallery.photoCount,
        0,
      ),
    [spacePhotoMap],
  );
  const workspacePulse = [
    `${workspace.spaces.length} spaces`,
    `${workspace.assets.length} assets`,
    `${workspace.logs.length} logs`,
  ];
  const attentionSummary =
    recommendations.length > 0
      ? `${recommendations.length} recommendation${recommendations.length === 1 ? "" : "s"} ready`
      : "Everything looks steady";
  const homeSectionOptions = useMemo(
    () => [
      {
        id: "overview" as const,
        label: "Overview",
        icon: {
          ios: "rectangle.grid.2x2.fill",
          android: "dashboard",
          web: "dashboard",
        } satisfies HomeSectionIconName,
        hint: "AI pulse, recommendations, and attention items",
        meta: `${recommendations.length} priority${recommendations.length === 1 ? "" : "ies"}`,
        badges: [
          `${attentionItems.length} attention`,
          recommendations.length > 0 ? "Needs review" : "Steady",
        ],
      },
      {
        id: "capture" as const,
        label: "Capture",
        icon: {
          ios: "plus.bubble.fill",
          android: "add_circle",
          web: "add_circle",
        } satisfies HomeSectionIconName,
        hint: "Recording shortcuts and fast event entry",
        meta: `${quickActionCards.length} quick log${quickActionCards.length === 1 ? "" : "s"}`,
        badges: [
          `${quickActionCards.length} shortcut${quickActionCards.length === 1 ? "" : "s"}`,
          `${workspace.logs.length} logs`,
        ],
      },
      {
        id: "spaces" as const,
        label: "Spaces",
        icon: {
          ios: "square.grid.2x2",
          android: "grid_view",
          web: "grid_view",
        } satisfies HomeSectionIconName,
        hint: "Tracked spaces, galleries, and active context",
        meta: `${spaceSummaries.length} active space${spaceSummaries.length === 1 ? "" : "s"}`,
        badges: [
          `${spaceSummaries.length} live`,
          `${totalSpacePhotos} photo${totalSpacePhotos === 1 ? "" : "s"}`,
        ],
      },
      {
        id: "manage" as const,
        label: "Manage",
        icon: {
          ios: "slider.horizontal.3",
          android: "tune",
          web: "tune",
        } satisfies HomeSectionIconName,
        hint: "Widgets, templates, and workspace guidance",
        meta: `${visibleWidgets.length} visible widget${visibleWidgets.length === 1 ? "" : "s"}`,
        badges: [
          `${hiddenWidgets.length} hidden`,
          `${workspace.templates.length} template${workspace.templates.length === 1 ? "" : "s"}`,
        ],
      },
    ],
    [
      attentionItems.length,
      hiddenWidgets.length,
      quickActionCards.length,
      recommendations.length,
      spaceSummaries.length,
      totalSpacePhotos,
      visibleWidgets.length,
      workspace.logs.length,
      workspace.templates.length,
    ],
  );
  const activeSectionOption =
    homeSectionOptions.find((section) => section.id === activeSection) ??
    homeSectionOptions[0];
  const workspaceGuidance = useMemo(() => {
    const items: string[] = [];

    if (workspace.spaces.length === 0) {
      items.push("Add or sync a space to start tracking real activity.");
    }
    if (workspace.logs.length === 0) {
      items.push(
        "Use Quick log to capture your first real entry on this device.",
      );
    }
    if (workspace.reminders.length === 0) {
      items.push("Create routines or reminders to populate the planner.");
    }
    if (workspace.templates.length === 0) {
      items.push("Import or build a template when you want reusable forms.");
    }

    if (items.length > 0) return items;

    return [
      `${workspace.logs.length} real logs are available in your unified timeline.`,
      `${workspace.reminders.length} reminders are currently scheduled across your spaces.`,
      `${workspace.assets.length} assets are linked to tracked spaces in this workspace.`,
    ];
  }, [
    workspace.assets.length,
    workspace.logs.length,
    workspace.reminders.length,
    workspace.spaces.length,
    workspace.templates.length,
  ]);

  const baseCardSurfaceStyle = {
    backgroundColor: theme.colors.elevation.level1,
    borderColor: theme.colors.outlineVariant,
    shadowColor: theme.colors.shadow,
  };

  const nestedCardSurfaceStyle = {
    backgroundColor: theme.colors.elevation.level2,
    borderColor: theme.colors.outlineVariant,
    shadowColor: theme.colors.shadow,
  };

  const widgetButtonColor = theme.colors.elevation.level2;
  const widgetButtonTextColor = theme.colors.onSurface;
  const homeQuickActions = useMemo(
    () =>
      quickActionCards.map((action) => ({
        id: action.id,
        label: action.label,
        hint: `${action.description} ${action.target}`,
        accentColor: action.accent,
        onPress: () =>
          router.push({
            pathname: "/logbook",
            params: { actionId: action.id },
          }),
      })),
    [quickActionCards, router],
  );

  useEffect(() => {
    let isMounted = true;

    void loadHomeDashboardSectionPreference().then((section) => {
      if (!isMounted) return;
      setActiveSection(section);
      setIsSectionPreferenceLoaded(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSectionPreferenceLoaded) return;
    void persistHomeDashboardSectionPreference(activeSection);
  }, [activeSection, isSectionPreferenceLoaded]);

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

  function getSeverityBadgeColors(
    severity: WorkspaceRecommendation["severity"],
  ) {
    if (severity === "high") {
      return {
        backgroundColor: theme.colors.errorContainer,
        color: theme.colors.onErrorContainer,
      };
    }

    if (severity === "medium") {
      return {
        backgroundColor: theme.colors.tertiaryContainer,
        color: theme.colors.onTertiaryContainer,
      };
    }

    return {
      backgroundColor: theme.colors.secondaryContainer,
      color: theme.colors.onSecondaryContainer,
    };
  }

  function openRecommendation(recommendation: WorkspaceRecommendation) {
    if (recommendation.action.kind === "open-inventory") {
      router.push("/inventory");
      return;
    }

    if (recommendation.action.kind === "open-logbook") {
      router.push({
        pathname: "/logbook",
        params: {
          ...(recommendation.action.actionId
            ? { actionId: recommendation.action.actionId }
            : {}),
          ...(recommendation.spaceId
            ? { spaceId: recommendation.spaceId }
            : {}),
        },
      });
      return;
    }

    router.push("/action-center");
  }

  function moveWidgetWithFeedback(widgetId: string, direction: "up" | "down") {
    moveDashboardWidget(widgetId, direction);
    triggerSelectionFeedback();
  }

  function openDashboardPulseDestination(
    destination?: AiDashboardPulseDraft["suggestedDestination"],
    sourceSpaceId?: string,
  ) {
    if (!destination || destination === "action-center") {
      router.push("/action-center");
      return;
    }

    if (destination === "planner") {
      router.push("/planner");
      return;
    }

    if (destination === "logbook") {
      router.push(
        sourceSpaceId
          ? { pathname: "/logbook", params: { spaceId: sourceSpaceId } }
          : "/logbook",
      );
      return;
    }

    if (destination === "inventory") {
      router.push("/inventory");
      return;
    }

    router.push(
      sourceSpaceId
        ? { pathname: "/visual-history", params: { spaceId: sourceSpaceId } }
        : "/visual-history",
    );
  }

  function openDashboardPulseSource(source: AiDashboardPulseSource) {
    openDashboardPulseDestination(source.route, source.spaceId);
  }

  async function handleGenerateDashboardPulse() {
    const trimmedRequest = dashboardPulseRequest.trim();
    if (!trimmedRequest) {
      setDashboardPulseStatusMessage(
        "Describe the dashboard question you want answered before generating a pulse brief.",
      );
      return;
    }

    const pulsePrompt = buildDashboardPulsePrompt({
      workspace,
      userRequest: trimmedRequest,
    });
    setIsGeneratingDashboardPulse(true);
    void recordAiTelemetryEvent({
      surface: "dashboard-pulse",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: pulsePrompt.system,
      prompt: buildAiDashboardPulseGenerationPrompt(pulsePrompt.prompt),
      temperature: 0.25,
      maxOutputTokens: 900,
    });
    setIsGeneratingDashboardPulse(false);

    if (result.status !== "success") {
      setGeneratedDashboardPulse(null);
      setDashboardPulseStatusMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "dashboard-pulse",
        action: "generate-failed",
      });
      return;
    }

    const parsedDraft = parseAiDashboardPulseDraft(result.text, {
      allowedSourceIds: pulsePrompt.context.retrievedSources.map(
        (source) => source.id,
      ),
    });
    if (!parsedDraft) {
      setGeneratedDashboardPulse(null);
      setDashboardPulseStatusMessage(
        "TrackItUp received an AI response but could not turn it into a grounded dashboard pulse brief. Try asking a narrower question about priorities or follow-up.",
      );
      void recordAiTelemetryEvent({
        surface: "dashboard-pulse",
        action: "generate-failed",
      });
      return;
    }

    setGeneratedDashboardPulse({
      request: trimmedRequest,
      consentLabel: pulsePrompt.consentLabel,
      modelId: result.modelId,
      usage: result.usage,
      sources: pulsePrompt.context.retrievedSources,
      draft: parsedDraft,
    });
    setDashboardPulseStatusMessage(
      "Generated a grounded dashboard pulse brief. Review the cited sources before applying it.",
    );
    void recordAiTelemetryEvent({
      surface: "dashboard-pulse",
      action: "generate-succeeded",
    });
  }

  function handleApplyDashboardPulse() {
    if (!generatedDashboardPulse) return;
    setAppliedDashboardPulse(generatedDashboardPulse);
    setGeneratedDashboardPulse(null);
    setDashboardPulseStatusMessage(
      "Applied the dashboard pulse brief. Review the cited sources before acting on it.",
    );
    void recordAiTelemetryEvent({
      surface: "dashboard-pulse",
      action: "draft-applied",
    });
  }

  function handleDismissDashboardPulse() {
    setGeneratedDashboardPulse(null);
    setDashboardPulseStatusMessage(
      "Dismissed the AI dashboard pulse draft. The dashboard remains unchanged.",
    );
  }

  function renderWidgetBody(
    widget: (typeof workspace.dashboardWidgets)[number],
  ) {
    const itemLimit =
      widget.size === "small" ? 2 : widget.size === "medium" ? 3 : 5;

    if (widget.type === "attention") {
      return attentionItems.slice(0, itemLimit).map((item) => (
        <View key={item} style={styles.widgetListItem}>
          <View style={[styles.focusDot, { backgroundColor: palette.tint }]} />
          <Text style={[styles.focusText, { color: palette.muted }]}>
            {item}
          </Text>
        </View>
      ));
    }

    if (widget.type === "quick-actions") {
      return quickActionCards.slice(0, itemLimit).map((action) => (
        <Pressable
          key={action.id}
          onPress={() =>
            router.push({
              pathname: "/logbook",
              params: { actionId: action.id },
            })
          }
          style={({ pressed }) => [
            styles.widgetShortcut,
            nestedCardSurfaceStyle,
            {
              borderColor: `${action.accent}22`,
              opacity: pressed ? 0.94 : 1,
            },
          ]}
        >
          <Text style={styles.widgetShortcutLabel}>{action.label}</Text>
          <Text style={[styles.widgetShortcutMeta, { color: palette.muted }]}>
            {action.target}
          </Text>
        </Pressable>
      ));
    }

    if (widget.type === "recommendations") {
      return recommendations.slice(0, itemLimit).map((recommendation) => (
        <Pressable
          key={recommendation.id}
          onPress={() => openRecommendation(recommendation)}
          style={({ pressed }) => [
            styles.widgetShortcut,
            styles.recommendationCard,
            nestedCardSurfaceStyle,
            { opacity: pressed ? 0.94 : 1 },
          ]}
        >
          {(() => {
            const badgeColors = getSeverityBadgeColors(recommendation.severity);

            return (
              <View style={styles.widgetRecommendationHeader}>
                <Text style={styles.widgetShortcutLabel}>
                  {recommendation.title}
                </Text>
                <View
                  style={[
                    styles.severityBadge,
                    { backgroundColor: badgeColors.backgroundColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.severityBadgeLabel,
                      { color: badgeColors.color },
                    ]}
                  >
                    {recommendation.severity}
                  </Text>
                </View>
              </View>
            );
          })()}
          <Text style={[styles.widgetShortcutMeta, { color: palette.muted }]}>
            {recommendation.explanation}
          </Text>
          <Text style={[styles.actionCta, { color: palette.tint }]}>
            {recommendation.action.label}
          </Text>
        </Pressable>
      ));
    }

    if (widget.type === "reminders") {
      return upcomingReminders.slice(0, itemLimit).map((reminder) => {
        const space = spacesById.get(reminder.spaceId);

        return (
          <View key={reminder.id} style={styles.widgetListItem}>
            <View
              style={[
                styles.focusDot,
                { backgroundColor: space?.themeColor ?? palette.tint },
              ]}
            />
            <View style={styles.widgetListCopy}>
              <Text style={styles.widgetListTitle}>{reminder.title}</Text>
              <Text
                style={[styles.widgetShortcutMeta, { color: palette.muted }]}
              >
                {space?.name ?? "Unknown space"} •{" "}
                {new Date(
                  getReminderScheduleTimestamp(reminder),
                ).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
        );
      });
    }

    if (widget.type === "chart" && widget.metricIds?.length) {
      const metrics = widget.metricIds.flatMap((metricId, index) => {
        const metric = metricDefinitionsById.get(metricId);
        if (!metric) return [];

        return [
          {
            id: metric.id,
            label: metric.name,
            unitLabel: metric.unitLabel,
            color: getChartSeriesColor(palette, index),
          },
        ];
      });
      const points = buildMetricChartPoints(
        workspace,
        metrics.map((metric) => metric.id),
      );

      return (
        <>
          <SegmentedButtons
            value={chartMode}
            onValueChange={(value: string) => setChartMode(value as ChartMode)}
            density="small"
            style={styles.chartModeRow}
            buttons={(["line", "bar", "scatter"] as ChartMode[]).map(
              (mode) => ({
                value: mode,
                label: mode,
              }),
            )}
          />
          <MiniMetricChart
            points={points}
            metrics={metrics}
            mode={chartMode}
            mutedColor={palette.muted}
            borderColor={palette.border}
          />
        </>
      );
    }

    return null;
  }

  return (
    <Animated.ScrollView
      {...headerScroll}
      scrollIndicatorInsets={{ top: headerHeight }}
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: 20 + headerHeight },
      ]}
    >
      <ScreenHero
        palette={palette}
        eyebrow="Streamlined workspace command center"
        title="Run the workspace from one calmer dashboard."
        subtitle="See what matters, record the next update, and keep every space moving without digging through noisy panels."
        badges={[
          {
            label: "TrackItUp",
            backgroundColor: theme.colors.primaryContainer,
            textColor: theme.colors.onPrimaryContainer,
          },
          {
            label: attentionSummary,
            backgroundColor: theme.colors.surface,
            textColor: theme.colors.onSurface,
          },
        ]}
      >
        <View style={styles.heroStatRow}>
          {workspacePulse.map((item) => (
            <Chip
              key={item}
              style={[
                styles.heroStatPill,
                {
                  backgroundColor: theme.colors.surface,
                },
              ]}
              textStyle={[
                styles.heroStatLabel,
                { color: theme.colors.onSurface },
              ]}
            >
              {item}
            </Chip>
          ))}
        </View>
      </ScreenHero>

      <View style={styles.statRow}>
        {overviewStats.map((stat, index) => (
          <MotionView
            key={stat.label}
            delay={uiMotion.stagger * (index + 1)}
            style={styles.statCardMotion}
          >
            <Surface
              style={[styles.statCard, nestedCardSurfaceStyle]}
              elevation={1}
            >
              <Text style={[styles.statEyebrow, { color: palette.muted }]}>
                Live
              </Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>
                {stat.label}
              </Text>
            </Surface>
          </MotionView>
        ))}
      </View>

      <SectionSurface
        palette={palette}
        label="Feature groups"
        title="Focus on one workspace layer at a time"
        motionDelay={uiMotion.stagger * 4}
      >
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Switch between overview, capture, spaces, and management tools so the
          home screen stays organized instead of showing every feature at once.
        </Text>
        <View style={styles.sectionSwitcherGrid}>
          {homeSectionOptions.map((section, index) => {
            const isActive = activeSection === section.id;

            return (
              <MotionView
                key={section.id}
                delay={uiMotion.stagger * (index + 1)}
                style={styles.sectionSwitchMotionWrap}
              >
                <MotionPressable
                  accessibilityLabel={`Show ${section.label} section`}
                  onPress={() => setActiveSection(section.id)}
                  style={[
                    styles.sectionSwitchCard,
                    {
                      backgroundColor: isActive
                        ? theme.colors.primaryContainer
                        : theme.colors.elevation.level1,
                      borderColor: isActive
                        ? theme.colors.primary
                        : theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <View style={styles.sectionSwitchHeader}>
                    <View
                      style={[
                        styles.sectionSwitchIconWrap,
                        {
                          backgroundColor: isActive
                            ? theme.colors.elevation.level1
                            : theme.colors.elevation.level2,
                          borderColor: isActive
                            ? theme.colors.primary
                            : theme.colors.outlineVariant,
                        },
                      ]}
                    >
                      <SymbolView
                        name={section.icon}
                        size={18}
                        tintColor={
                          isActive
                            ? theme.colors.onPrimaryContainer
                            : theme.colors.onSurfaceVariant
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.sectionSwitchTitle,
                        {
                          color: isActive
                            ? theme.colors.onPrimaryContainer
                            : theme.colors.onSurface,
                        },
                      ]}
                    >
                      {section.label}
                    </Text>
                  </View>
                  <View style={styles.sectionSwitchBadgeRow}>
                    {section.badges.map((badge) => (
                      <View
                        key={`${section.id}-${badge}`}
                        style={[
                          styles.sectionSwitchBadge,
                          {
                            backgroundColor: isActive
                              ? theme.colors.elevation.level1
                              : theme.colors.elevation.level2,
                            borderColor: isActive
                              ? theme.colors.primary
                              : theme.colors.outlineVariant,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sectionSwitchBadgeLabel,
                            {
                              color: isActive
                                ? theme.colors.onPrimaryContainer
                                : theme.colors.onSurfaceVariant,
                            },
                          ]}
                        >
                          {badge}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text
                    style={[
                      styles.sectionSwitchHint,
                      {
                        color: isActive
                          ? theme.colors.onPrimaryContainer
                          : theme.colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {section.hint}
                  </Text>
                  <Text
                    style={[
                      styles.sectionSwitchMeta,
                      {
                        color: isActive
                          ? theme.colors.onPrimaryContainer
                          : palette.tint,
                      },
                    ]}
                  >
                    {section.meta}
                  </Text>
                </MotionPressable>
              </MotionView>
            );
          })}
        </View>
        <MotionView key={activeSectionOption.id} delay={uiMotion.stagger}>
          <Surface
            style={[styles.activeSectionCard, nestedCardSurfaceStyle]}
            elevation={1}
          >
            <View style={styles.activeSectionSummaryRow}>
              <View
                style={[
                  styles.activeSectionIconWrap,
                  {
                    backgroundColor: theme.colors.elevation.level3,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <SymbolView
                  name={activeSectionOption.icon}
                  size={18}
                  tintColor={theme.colors.onSurface}
                />
              </View>
              <Text style={styles.widgetListTitle}>
                {activeSectionOption.label} view
              </Text>
            </View>
            <Text style={[styles.widgetShortcutMeta, { color: palette.muted }]}>
              {activeSectionOption.hint}. Use the section switcher above to jump
              between feature clusters without scrolling through the full page.
            </Text>
          </Surface>
        </MotionView>
      </SectionSurface>

      <Animated.View style={sectionContentAnimatedStyle}>
        {activeSection === "overview" ? (
          <>
            <AiPromptComposerCard
              palette={palette}
              label="AI dashboard pulse"
              title="Generate a grounded dashboard brief"
              value={dashboardPulseRequest}
              onChangeText={setDashboardPulseRequest}
              onSubmit={() => void handleGenerateDashboardPulse()}
              isBusy={isGeneratingDashboardPulse}
              contextChips={[
                `${dashboardPulse.summary.recommendationCount} recommendation${dashboardPulse.summary.recommendationCount === 1 ? "" : "s"}`,
                `${dashboardPulse.attentionItems.length} attention item${dashboardPulse.attentionItems.length === 1 ? "" : "s"}`,
                `${dashboardPulse.activeSpaces.length} active space${dashboardPulse.activeSpaces.length === 1 ? "" : "s"}`,
              ]}
              placeholder="Example: Summarize what needs attention first across the dashboard and tell me which screen to open next."
              helperText={aiDashboardPulseCopy.helperText}
              consentLabel={aiDashboardPulseCopy.consentLabel}
              footerNote={aiDashboardPulseCopy.promptFooterNote}
              submitLabel="Generate pulse brief"
            />

            {dashboardPulseStatusMessage ? (
              <Surface
                style={[styles.focusCard, baseCardSurfaceStyle]}
                elevation={1}
              >
                <Text style={styles.widgetListTitle}>AI dashboard pulse</Text>
                <Text
                  style={[styles.widgetShortcutMeta, { color: palette.muted }]}
                >
                  {dashboardPulseStatusMessage}
                </Text>
              </Surface>
            ) : null}

            {generatedDashboardPulse ? (
              <AiDraftReviewCard
                palette={palette}
                title="Review the AI dashboard pulse"
                draftKindLabel="Home dashboard"
                summary={`Prompt: ${generatedDashboardPulse.request}`}
                consentLabel={generatedDashboardPulse.consentLabel}
                footerNote={aiDashboardPulseCopy.reviewFooterNote}
                statusLabel="Draft ready"
                modelLabel={generatedDashboardPulse.modelId}
                usage={generatedDashboardPulse.usage}
                contextChips={[
                  `${generatedDashboardPulse.draft.citedSourceIds.length} cited source${generatedDashboardPulse.draft.citedSourceIds.length === 1 ? "" : "s"}`,
                ]}
                items={buildAiDashboardPulseReviewItems(
                  generatedDashboardPulse.draft,
                  generatedDashboardPulse.sources,
                )}
                acceptLabel="Apply brief"
                editLabel="Dismiss draft"
                regenerateLabel="Generate again"
                onAccept={handleApplyDashboardPulse}
                onEdit={handleDismissDashboardPulse}
                onRegenerate={() => void handleGenerateDashboardPulse()}
                isBusy={isGeneratingDashboardPulse}
              />
            ) : null}

            {appliedDashboardPulse ? (
              <Surface
                style={[styles.focusCard, baseCardSurfaceStyle]}
                elevation={1}
              >
                <View style={styles.pulseHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    {appliedDashboardPulse.draft.headline}
                  </Text>
                  {appliedDashboardPulse.draft.suggestedDestination ? (
                    <Chip compact style={styles.heroStatPill}>
                      {formatAiDashboardPulseDestinationLabel(
                        appliedDashboardPulse.draft.suggestedDestination,
                      )}
                    </Chip>
                  ) : null}
                </View>
                {appliedDashboardPulse.draft.summary ? (
                  <Text style={[styles.spaceNote, { color: palette.muted }]}>
                    {appliedDashboardPulse.draft.summary}
                  </Text>
                ) : null}
                {appliedDashboardPulse.draft.priorities.map((priority) => (
                  <View key={priority} style={styles.focusItem}>
                    <View
                      style={[
                        styles.focusDot,
                        { backgroundColor: theme.colors.primary },
                      ]}
                    />
                    <Text style={[styles.focusText, { color: palette.muted }]}>
                      {priority}
                    </Text>
                  </View>
                ))}
                {appliedDashboardPulse.draft.caution ? (
                  <Text
                    style={[
                      styles.widgetShortcutMeta,
                      { color: palette.muted },
                    ]}
                  >
                    Caution: {appliedDashboardPulse.draft.caution}
                  </Text>
                ) : null}
                {appliedDashboardPulse.sources
                  .filter((source) =>
                    appliedDashboardPulse.draft.citedSourceIds.includes(
                      source.id,
                    ),
                  )
                  .map((source) => (
                    <Surface
                      key={source.id}
                      style={[styles.pulseSourceCard, nestedCardSurfaceStyle]}
                      elevation={1}
                    >
                      <View style={styles.widgetListCopy}>
                        <Text style={styles.widgetListTitle}>
                          {formatAiDashboardPulseSourceLabel(source)}
                        </Text>
                        <Text
                          style={[
                            styles.widgetShortcutMeta,
                            { color: palette.muted },
                          ]}
                        >
                          {source.snippet}
                        </Text>
                      </View>
                      <View style={styles.pulseSourceActionRow}>
                        <CardActionPill
                          label={formatAiDashboardPulseDestinationLabel(
                            source.route,
                          )}
                          onPress={() => openDashboardPulseSource(source)}
                        />
                      </View>
                    </Surface>
                  ))}
                <View style={styles.pulseActionRow}>
                  <CardActionPill
                    label="Clear brief"
                    onPress={() => setAppliedDashboardPulse(null)}
                  />
                  <CardActionPill
                    label={formatAiDashboardPulseDestinationLabel(
                      appliedDashboardPulse.draft.suggestedDestination ??
                        "action-center",
                    )}
                    onPress={() =>
                      openDashboardPulseDestination(
                        appliedDashboardPulse.draft.suggestedDestination,
                      )
                    }
                  />
                </View>
              </Surface>
            ) : null}

            <SectionSurface
              palette={palette}
              label="Next best actions"
              title="Recommended next actions"
            >
              <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
                TrackItUp now promotes the most useful next step from reminders,
                metrics, and asset history.
              </Text>
              {recommendations.length === 0 ? (
                <Text style={[styles.focusText, { color: palette.muted }]}>
                  Recommendations will appear here as your spaces build up
                  reminders, readings, and maintenance history.
                </Text>
              ) : (
                recommendations.slice(0, 3).map((recommendation) => {
                  const badgeColors = getSeverityBadgeColors(
                    recommendation.severity,
                  );

                  return (
                    <Pressable
                      key={recommendation.id}
                      onPress={() => openRecommendation(recommendation)}
                      style={({ pressed }) => [
                        styles.recommendationRow,
                        nestedCardSurfaceStyle,
                        { opacity: pressed ? 0.94 : 1 },
                      ]}
                    >
                      <View style={styles.widgetListCopy}>
                        <Text style={styles.widgetListTitle}>
                          {recommendation.title}
                        </Text>
                        <Text
                          style={[
                            styles.widgetShortcutMeta,
                            { color: palette.muted },
                          ]}
                        >
                          {recommendation.explanation}
                        </Text>
                      </View>
                      <View style={styles.recommendationAside}>
                        <View
                          style={[
                            styles.severityBadge,
                            {
                              backgroundColor: badgeColors.backgroundColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.severityBadgeLabel,
                              { color: badgeColors.color },
                            ]}
                          >
                            {recommendation.severity}
                          </Text>
                        </View>
                        <Text
                          style={[styles.actionCta, { color: palette.tint }]}
                        >
                          {recommendation.action.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </SectionSurface>

            <SectionSurface
              palette={palette}
              label="Attention"
              title="Items needing attention"
            >
              <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
                Safe-zone alerts and urgent reminders surfaced from the shared
                workspace.
              </Text>
              <Surface
                style={[styles.focusCard, baseCardSurfaceStyle]}
                elevation={1}
              >
                {attentionItems.map((item) => (
                  <View key={item} style={styles.focusItem}>
                    <View
                      style={[
                        styles.focusDot,
                        { backgroundColor: palette.tint },
                      ]}
                    />
                    <Text style={[styles.focusText, { color: palette.muted }]}>
                      {item}
                    </Text>
                  </View>
                ))}
              </Surface>
            </SectionSurface>
          </>
        ) : null}

        {activeSection === "capture" ? (
          <PageQuickActions
            palette={palette}
            title="Start recording"
            description="Choose what happened and TrackItUp will guide you into the right event-entry flow."
            actions={homeQuickActions}
          />
        ) : null}

        {activeSection === "spaces" ? (
          <SectionSurface
            palette={palette}
            label="Spaces"
            title="Active spaces"
          >
            <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
              Spaces from your real workspace appear here after you sync,
              import, or start tracking on this device.
            </Text>
            {spaceSummaries.length === 0 ? (
              <EmptyStateCard
                palette={palette}
                icon={{
                  ios: "square.grid.2x2",
                  android: "dashboard",
                  web: "dashboard",
                }}
                title="No tracked spaces yet"
                message="Create your first space to give new events, routines, and metrics a home in the workspace."
                actionLabel="Create first space"
                onAction={() => router.push("/space-create")}
                style={styles.emptyStateCard}
              />
            ) : (
              spaceSummaries.map((space) => (
                <Surface
                  key={space.id}
                  style={[styles.spaceCard, baseCardSurfaceStyle]}
                  elevation={1}
                >
                  <View style={styles.spaceHeader}>
                    <View style={styles.spaceHeadingCopy}>
                      <Text style={styles.spaceName}>{space.name}</Text>
                      <Text
                        style={[styles.spaceMeta, { color: palette.muted }]}
                      >
                        {space.category}
                      </Text>
                      {spacesById.get(space.id)?.parentSpaceId ? (
                        <Text
                          style={[styles.nestedMeta, { color: palette.muted }]}
                        >
                          Nested in{" "}
                          {
                            spacesById.get(
                              spacesById.get(space.id)?.parentSpaceId ?? "",
                            )?.name
                          }
                        </Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: `${space.accent}22` },
                      ]}
                    >
                      <Text
                        style={[styles.badgeLabel, { color: space.accent }]}
                      >
                        {space.status}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.spaceNote, { color: palette.muted }]}>
                    {space.note}
                  </Text>

                  <View style={styles.widgetToolbar}>
                    <CardActionPill
                      label={
                        spacePhotoMap.get(space.id)?.photoCount
                          ? `Visual history (${spacePhotoMap.get(space.id)?.photoCount})`
                          : "Visual history"
                      }
                      accentColor={space.accent}
                      onPress={() =>
                        router.push(
                          `/visual-history?spaceId=${space.id}` as never,
                        )
                      }
                    />
                  </View>

                  <View style={styles.spaceFooter}>
                    <Text style={styles.spaceFooterLabel}>
                      {space.pendingTasks} task(s)
                    </Text>
                    <Text style={[styles.spaceMeta, { color: palette.muted }]}>
                      {space.lastLog}
                    </Text>
                  </View>
                </Surface>
              ))
            )}
          </SectionSurface>
        ) : null}

        {activeSection === "manage" ? (
          <SectionSurface
            palette={palette}
            label="Workspace controls"
            title="Customize tools and reference panels"
          >
            <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
              Keep the dashboard focused, then expand setup and customization
              only when you need it.
            </Text>
            <Surface
              style={[styles.sidebarHintCard, nestedCardSurfaceStyle]}
              elevation={1}
            >
              <Text style={styles.widgetListTitle}>
                Open screens from the sidebar
              </Text>
              <Text
                style={[styles.widgetShortcutMeta, { color: palette.muted }]}
              >
                The new slide-out navigation menu keeps setup, import, scanner,
                and workspace-admin screens close by without packing extra jump
                buttons into the dashboard itself.
              </Text>
            </Surface>

            <CollapsibleSectionCard
              title="Dashboard widgets"
              description="Reorder, resize, and hide widgets so each hobby can keep a different dashboard layout."
              badge={`${visibleWidgets.length} visible`}
            >
              {visibleWidgets.map((widget, index) => (
                <ReorderGestureCard
                  key={widget.id}
                  axis="vertical"
                  onMoveBackward={
                    index > 0
                      ? () => moveWidgetWithFeedback(widget.id, "up")
                      : undefined
                  }
                  onMoveForward={
                    index < visibleWidgets.length - 1
                      ? () => moveWidgetWithFeedback(widget.id, "down")
                      : undefined
                  }
                >
                  <Surface
                    style={[styles.spaceCard, baseCardSurfaceStyle]}
                    elevation={1}
                  >
                    <View style={styles.spaceHeader}>
                      <View style={styles.spaceHeadingCopy}>
                        <Text style={styles.spaceName}>{widget.title}</Text>
                        <Text
                          style={[styles.spaceMeta, { color: palette.muted }]}
                        >
                          {widget.type} • {widget.size} card
                        </Text>
                      </View>
                      <View style={styles.widgetControls}>
                        <Button
                          onPress={() =>
                            moveWidgetWithFeedback(widget.id, "up")
                          }
                          mode="contained-tonal"
                          buttonColor={widgetButtonColor}
                          textColor={widgetButtonTextColor}
                          compact
                          style={styles.widgetButton}
                          contentStyle={styles.widgetButtonContent}
                          labelStyle={styles.widgetButtonLabel}
                        >
                          Up
                        </Button>
                        <Button
                          onPress={() =>
                            moveWidgetWithFeedback(widget.id, "down")
                          }
                          mode="contained-tonal"
                          buttonColor={widgetButtonColor}
                          textColor={widgetButtonTextColor}
                          compact
                          style={styles.widgetButton}
                          contentStyle={styles.widgetButtonContent}
                          labelStyle={styles.widgetButtonLabel}
                        >
                          Down
                        </Button>
                        <Button
                          onPress={() => cycleDashboardWidgetSize(widget.id)}
                          mode="contained-tonal"
                          buttonColor={widgetButtonColor}
                          textColor={widgetButtonTextColor}
                          compact
                          style={styles.widgetButton}
                          contentStyle={styles.widgetButtonContent}
                          labelStyle={styles.widgetButtonLabel}
                        >
                          Size
                        </Button>
                        <Button
                          onPress={() =>
                            toggleDashboardWidgetVisibility(widget.id)
                          }
                          mode="contained-tonal"
                          buttonColor={widgetButtonColor}
                          textColor={widgetButtonTextColor}
                          compact
                          style={styles.widgetButton}
                          contentStyle={styles.widgetButtonContent}
                          labelStyle={styles.widgetButtonLabel}
                        >
                          Hide
                        </Button>
                      </View>
                    </View>
                    <Text style={[styles.spaceNote, { color: palette.muted }]}>
                      {widget.description}
                    </Text>
                    <View style={styles.widgetBody}>
                      {renderWidgetBody(widget)}
                    </View>
                    <Text style={styles.spaceFooterLabel}>
                      Widget #{index + 1}
                    </Text>
                  </Surface>
                </ReorderGestureCard>
              ))}
              {hiddenWidgets.length > 0 ? (
                <Surface
                  style={[styles.focusCard, baseCardSurfaceStyle]}
                  elevation={1}
                >
                  <Text style={styles.sectionTitle}>Hidden widgets</Text>
                  {hiddenWidgets.map((widget) => (
                    <View key={widget.id} style={styles.hiddenWidgetRow}>
                      <View style={styles.widgetListCopy}>
                        <Text style={styles.widgetListTitle}>
                          {widget.title}
                        </Text>
                        <Text
                          style={[
                            styles.widgetShortcutMeta,
                            { color: palette.muted },
                          ]}
                        >
                          {widget.type} • {widget.size} card
                        </Text>
                      </View>
                      <CardActionPill
                        label="Show"
                        onPress={() =>
                          toggleDashboardWidgetVisibility(widget.id)
                        }
                      />
                    </View>
                  ))}
                </Surface>
              ) : null}
            </CollapsibleSectionCard>

            <CollapsibleSectionCard
              title="Template catalog"
              description="Official and community templates expose the schema engine and import paths."
              badge={`${workspace.templates.length} template${workspace.templates.length === 1 ? "" : "s"}`}
            >
              <Text
                style={[
                  styles.widgetShortcutMeta,
                  { color: palette.muted, marginBottom: 14 },
                ]}
              >
                Need to build a schema or import a shared template? Open the
                sidebar from the header and jump there when you need it.
              </Text>
              {workspace.templates.length === 0 ? (
                <EmptyStateCard
                  palette={palette}
                  icon={{
                    ios: "square.stack.3d.up",
                    android: "inventory_2",
                    web: "inventory_2",
                  }}
                  title="No templates in this workspace yet"
                  message="Import a template or build your own schema to populate this catalog."
                  actionLabel="Import template"
                  onAction={() => router.push("/template-import")}
                  style={styles.emptyStateCard}
                />
              ) : (
                workspace.templates.map((template) => (
                  <Surface
                    key={template.id}
                    style={[styles.spaceCard, baseCardSurfaceStyle]}
                    elevation={1}
                  >
                    <View style={styles.spaceHeader}>
                      <View style={styles.spaceHeadingCopy}>
                        <Text style={styles.spaceName}>{template.name}</Text>
                        <Text
                          style={[styles.spaceMeta, { color: palette.muted }]}
                        >
                          {template.origin} • {template.category}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: `${palette.tint}22` },
                        ]}
                      >
                        <Text
                          style={[styles.badgeLabel, { color: palette.tint }]}
                        >
                          {template.importMethods.join(" • ")}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.spaceNote, { color: palette.muted }]}>
                      {template.summary}
                    </Text>
                    <Text style={[styles.spaceMeta, { color: palette.muted }]}>
                      Fields:{" "}
                      {template.supportedFieldTypes.slice(0, 5).join(", ")}
                    </Text>
                    {template.formTemplate ? (
                      <View style={styles.widgetToolbar}>
                        <CardActionPill
                          label="Open form"
                          onPress={() =>
                            router.push({
                              pathname: "/logbook",
                              params: { templateId: template.id },
                            })
                          }
                        />
                      </View>
                    ) : null}
                  </Surface>
                ))
              )}
            </CollapsibleSectionCard>

            <CollapsibleSectionCard
              title="Workspace guide"
              description="Tips here reflect your current real workspace state."
              badge={`${workspaceGuidance.length} tip${workspaceGuidance.length === 1 ? "" : "s"}`}
            >
              <Surface
                style={[styles.focusCard, baseCardSurfaceStyle]}
                elevation={1}
              >
                {workspaceGuidance.map((item) => (
                  <View key={item} style={styles.focusItem}>
                    <View
                      style={[
                        styles.focusDot,
                        { backgroundColor: palette.tint },
                      ]}
                    />
                    <Text style={[styles.focusText, { color: palette.muted }]}>
                      {item}
                    </Text>
                  </View>
                ))}
              </Surface>
            </CollapsibleSectionCard>
          </SectionSurface>
        ) : null}
      </Animated.View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 168,
    gap: 18,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
  },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  heroBadge: {
    borderRadius: 999,
  },
  heroBadgeLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  heroStatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  heroStatPill: {
    borderRadius: 16,
  },
  heroStatLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  statCardMotion: {
    flex: 1,
    minWidth: 100,
  },
  sectionSwitcherGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  sectionSwitchCard: {
    flexGrow: 1,
    flexBasis: 148,
    minHeight: 116,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  sectionSwitchMotionWrap: {
    flexGrow: 1,
    flexBasis: 148,
    minWidth: 148,
  },
  sectionSwitchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionSwitchIconWrap: {
    width: 34,
    height: 34,
    borderRadius: uiRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionSwitchTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  sectionSwitchBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionSwitchBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: uiRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionSwitchBadgeLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  sectionSwitchHint: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  sectionSwitchMeta: {
    fontSize: 12,
    fontWeight: "700",
  },
  activeSectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 6,
    marginTop: 14,
  },
  activeSectionSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activeSectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: uiRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
  },
  statEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 0,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 21,
  },
  actionCta: {
    fontSize: 12,
    fontWeight: "700",
  },
  spaceCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
  },
  spaceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  spaceHeadingCopy: {
    flex: 1,
    marginRight: 12,
  },
  spaceName: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  spaceMeta: {
    fontSize: 13,
  },
  nestedMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  spaceNote: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  spaceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spaceFooterLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  focusCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
  },
  focusItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  focusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
    marginRight: 12,
  },
  focusText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  pulseHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  pulseSourceCard: {
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  pulseActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  pulseSourceActionRow: {
    alignItems: "flex-end",
  },
  widgetControls: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  widgetButton: {
    minWidth: 0,
    borderRadius: 16,
  },
  widgetButtonContent: {
    minHeight: 32,
  },
  widgetButtonLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginHorizontal: 2,
  },
  widgetBody: {
    marginBottom: 14,
  },
  hiddenWidgetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  widgetListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  widgetListCopy: {
    flex: 1,
  },
  widgetListTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  widgetShortcut: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  widgetShortcutLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  widgetRecommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  widgetShortcutMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  severityBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  severityBadgeLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  recommendationCard: {
    gap: 8,
  },
  recommendationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: uiSpace.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: uiRadius.panel,
    paddingHorizontal: uiSpace.surface,
    paddingVertical: uiSpace.lg,
    marginBottom: uiSpace.md,
  },
  recommendationAside: {
    alignItems: "flex-end",
    minWidth: 92,
    gap: 8,
  },
  widgetToolbar: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  sidebarHintCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 6,
    marginBottom: 14,
  },
  emptyStateCard: {
    marginBottom: uiSpace.md,
  },
  chartModeRow: {
    marginTop: 2,
  },
});
