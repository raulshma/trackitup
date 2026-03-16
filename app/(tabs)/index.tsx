import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Chip, useTheme, type MD3Theme } from "react-native-paper";

import { Text } from "@/components/Themed";
import { useMaterialCompactTopAppBarHeight } from "@/components/ui/MaterialCompactTopAppBar";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useTabHeaderScroll } from "@/components/ui/TabHeaderScrollContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors, { withAlpha } from "@/constants/Colors";
import {
  getShadowStyle,
  uiRadius,
  uiSpace
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { generateOpenRouterText } from "@/services/ai/aiClient";
import {
  buildAiDashboardPulseGenerationPrompt,
  parseAiDashboardPulseDraft,
  type AiDashboardPulseDraft,
  type AiDashboardPulseSource
} from "@/services/ai/aiDashboardPulse";
import { buildDashboardPulsePrompt } from "@/services/ai/aiPromptBuilders";
import { recordAiTelemetryEvent } from "@/services/ai/aiTelemetry";
import { buildWorkspaceDashboardPulse } from "@/services/insights/workspaceDashboardPulse";
import { getReminderScheduleTimestamp } from "@/services/insights/workspaceInsights";
import { buildWorkspaceVisualHistory } from "@/services/insights/workspaceVisualHistory";
import { buildTodaysRoutineQueue } from "@/services/recurring/todaysRoutineQueue";
import { buildReminderActionCenter } from "@/services/reminders/reminderActionCenter";
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

export default function TabOneScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const theme = useTheme<MD3Theme>();
  const router = useRouter();
  const headerHeight = useMaterialCompactTopAppBarHeight();
  const headerScroll = useTabHeaderScroll("index");
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
    completeRecurringOccurrence,
    overviewStats,
    recommendations,
    quickActionCards,
    spaceSummaries,
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
  const dashboardPulse = useMemo(
    () => buildWorkspaceDashboardPulse(workspace),
    [workspace],
  );
  const reminderActionCenter = useMemo(
    () => buildReminderActionCenter(workspace),
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
  const todaysRoutineOccurrences = useMemo(
    () => buildTodaysRoutineQueue(workspace),
    [workspace],
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
  const dashboardQuickActionCount = quickActionCards.length + 5;
  const attentionSummary =
    recommendations.length > 0
      ? `${recommendations.length} recommendation${recommendations.length === 1 ? "" : "s"} ready`
      : "Everything looks steady";
  const raisedCardShadow = useMemo(
    () =>
      getShadowStyle(palette.shadow, {
        shadowOpacity: 0.08,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
      }),
    [palette.shadow],
  );

  const baseCardSurfaceStyle = {
    backgroundColor: theme.colors.elevation.level1,
    borderColor: withAlpha(theme.colors.outlineVariant, 0.5),
    ...raisedCardShadow,
  };

  const nestedCardSurfaceStyle = {
    backgroundColor: theme.colors.elevation.level2,
    borderColor: withAlpha(theme.colors.outlineVariant, 0.4),
    ...raisedCardShadow,
  };

  const homeQuickActions = useMemo(() => {
    const actions = [
      ...(reminderActionCenter.summary.overdueCount > 0 ||
      reminderActionCenter.summary.dueTodayCount > 0
        ? [
            {
              id: "dashboard-open-action-center",
              label: "Resolve due queue",
              hint: "Overdue and due-today reminders are ready for action in one queue.",
              accentColor: theme.colors.error,
              onPress: () => router.push("/action-center"),
            },
          ]
        : []),
      ...quickActionCards.slice(0, 2).map((action) => ({
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
      {
        id: "dashboard-open-planner",
        label: "Open planner",
        hint: "Check calendar timelines, due reminders, and recurring plans.",
        accentColor: theme.colors.tertiary,
        onPress: () => router.push("/planner"),
      },
      ...(workspace.logs.length === 0
        ? [
            {
              id: "dashboard-open-logbook",
              label: "Record first log",
              hint: "Start capturing updates so trends and recommendations become useful.",
              accentColor: theme.colors.primary,
              onPress: () => router.push("/logbook"),
            },
          ]
        : []),
      ...(recommendations.some(
        (recommendation) => recommendation.action.kind === "open-inventory",
      )
        ? [
            {
              id: "dashboard-open-inventory",
              label: "Review inventory",
              hint: "Inventory signals suggest one or more assets need attention.",
              accentColor: theme.colors.secondary,
              onPress: () => router.push("/inventory"),
            },
          ]
        : []),
      ...(totalSpacePhotos > 0
        ? [
            {
              id: "dashboard-open-visual-history",
              label: "Open visual history",
              hint: "Review photos and timeline snapshots across tracked spaces.",
              accentColor: theme.colors.secondary,
              onPress: () => router.push("/visual-history"),
            },
          ]
        : []),
      {
        id: "dashboard-open-workspace-tools",
        label: "Open workspace tools",
        hint: "Export, import, and run workspace maintenance from one place.",
        accentColor: palette.tint,
        onPress: () => router.push("/workspace-tools"),
      },
    ];

    return actions.slice(0, 6);
  }, [
    reminderActionCenter.summary.dueTodayCount,
    reminderActionCenter.summary.overdueCount,
    palette.tint,
    quickActionCards,
    recommendations,
    router,
    theme.colors.error,
    theme.colors.primary,
    theme.colors.secondary,
    theme.colors.tertiary,
    totalSpacePhotos,
    workspace.logs.length,
  ]);

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

  function getNextStepActionLabel(
    suggestedAction: "complete-now" | "log-proof" | "snooze" | "open-planner",
  ) {
    if (suggestedAction === "complete-now") return "Complete now";
    if (suggestedAction === "log-proof") return "Log proof";
    if (suggestedAction === "snooze") return "Review snooze";
    return "Open planner";
  }

  function formatLastCompleted(lastCompletedAt?: Date) {
    if (!lastCompletedAt) return "No previous completion";
    return `Last completed ${lastCompletedAt.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  function handleRoutineDone(item: (typeof todaysRoutineOccurrences)[number]) {
    if (!item.proofRequired) {
      completeRecurringOccurrence(item.occurrenceId);
      return;
    }

    router.push({
      pathname: "/logbook",
      params: {
        actionId: "quick-log",
        spaceId: item.spaceIds[0] ?? item.spaceId,
        ...(item.spaceIds.length ? { spaceIds: item.spaceIds.join(",") } : {}),
        recurringOccurrenceId: item.occurrenceId,
        recurringPlanId: item.planId,
        source: "home-routine-queue",
      },
    });
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
        eyebrow="Routine-first home"
        title="Track what’s due and mark it done."
        subtitle="Built for repeatable care tasks like water changes, feeding, and cleaning—with clear proof status and last completion transparency."
        badges={[
          {
            label: "Today’s routine queue",
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
          <Chip compact style={styles.heroStatPill}>
            {`${reminderActionCenter.summary.overdueCount} overdue`}
          </Chip>
          <Chip compact style={styles.heroStatPill}>
            {`${reminderActionCenter.summary.dueTodayCount} due today`}
          </Chip>
        </View>
      </ScreenHero>

      <SectionSurface
        palette={palette}
        label="Today's routine"
        title="One queue for today’s recurring work"
      >
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Tap done to complete now. If proof is required, TrackItUp opens proof
          capture first.
        </Text>
        {todaysRoutineOccurrences.length === 0 ? (
          <Text style={[styles.focusText, { color: palette.muted }]}>
            No recurring occurrences are due today.
          </Text>
        ) : (
          todaysRoutineOccurrences.slice(0, 12).map((item) => {
            const space = spacesById.get(item.spaceId);
            return (
              <Pressable
                key={item.occurrenceId}
                onPress={() =>
                  router.push({
                    pathname: "/action-center",
                    params: {
                      recurringOccurrenceId: item.occurrenceId,
                      source: "home-routine-queue",
                    },
                  })
                }
                style={({ pressed }) => [
                  styles.recommendationRow,
                  nestedCardSurfaceStyle,
                  { opacity: pressed ? 0.94 : 1 },
                ]}
              >
                <View style={styles.widgetListCopy}>
                  <Text style={styles.widgetListTitle}>{item.title}</Text>
                  <Text
                    style={[
                      styles.widgetShortcutMeta,
                      { color: palette.muted },
                    ]}
                  >
                    {space?.name ?? "Unknown space"} • due{" "}
                    {item.dueAt.toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Text
                    style={[
                      styles.widgetShortcutMeta,
                      { color: palette.muted },
                    ]}
                  >
                    {formatLastCompleted(item.lastCompletedAt)}
                  </Text>
                </View>
                <View style={styles.recommendationAside}>
                  <View
                    style={[
                      styles.severityBadge,
                      {
                        backgroundColor: item.proofRequired
                          ? theme.colors.secondaryContainer
                          : theme.colors.primaryContainer,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.severityBadgeLabel,
                        {
                          color: item.proofRequired
                            ? theme.colors.onSecondaryContainer
                            : theme.colors.onPrimaryContainer,
                        },
                      ]}
                    >
                      {item.proofRequired ? "proof required" : "routine"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRoutineDone(item)}
                    style={({ pressed }) => [
                      styles.routineDoneButton,
                      {
                        opacity: pressed ? 0.9 : 1,
                        backgroundColor: item.proofRequired
                          ? theme.colors.secondaryContainer
                          : theme.colors.primaryContainer,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.routineDoneButtonLabel,
                        {
                          color: item.proofRequired
                            ? theme.colors.onSecondaryContainer
                            : theme.colors.onPrimaryContainer,
                        },
                      ]}
                    >
                      {item.proofRequired ? "Log proof" : "Done"}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}
      </SectionSurface>
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
    borderRadius: uiRadius.xl,
    padding: 18,
    gap: 8,
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
    borderRadius: uiRadius.xl,
    padding: 16,
    gap: 6,
    marginTop: uiSpace.surface,
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
    borderRadius: uiRadius.xl,
    padding: 20,
    paddingVertical: 24,
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
    borderRadius: uiRadius.xl,
    padding: 22,
    paddingBottom: 24,
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
    borderRadius: uiRadius.xl,
    padding: 20,
    paddingVertical: 22,
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
  routineDoneButton: {
    minWidth: 92,
    borderRadius: uiRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: "center",
  },
  routineDoneButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
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
