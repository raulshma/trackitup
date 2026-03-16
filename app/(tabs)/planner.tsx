import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Button, Chip, Surface } from "react-native-paper";

import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { AiDraftReviewCard } from "@/components/ui/AiDraftReviewCard";
import { AiPromptComposerCard } from "@/components/ui/AiPromptComposerCard";
import { ChipRow } from "@/components/ui/ChipRow";
import {
    FeatureSectionSwitcher,
    type FeatureSectionItem,
} from "@/components/ui/FeatureSectionSwitcher";
import { WorkspacePageSkeleton } from "@/components/ui/LoadingSkeleton";
import { useMaterialCompactTopAppBarHeight } from "@/components/ui/MaterialCompactTopAppBar";
import { MotionView } from "@/components/ui/Motion";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { SwipeActionCard } from "@/components/ui/SwipeActionCard";
import { useTabHeaderScroll } from "@/components/ui/TabHeaderScrollContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    getShadowStyle,
    uiBorder,
    uiElevation,
    uiMotion,
    uiRadius,
    uiShadow,
    uiSize,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { generateOpenRouterText } from "@/services/ai/aiClient";
import {
    aiPlannerCopilotCopy,
    aiPlannerRiskCopy,
} from "@/services/ai/aiConsentCopy";
import {
    buildAiPlannerCopilotGenerationPrompt,
    buildAiPlannerCopilotReviewItems,
    parseAiPlannerCopilotDraft,
    type AiPlannerCopilotDraft,
} from "@/services/ai/aiPlannerCopilot";
import {
    buildAiPlannerRiskGenerationPrompt,
    buildAiPlannerRiskReviewItems,
    formatAiPlannerRiskDestinationLabel,
    formatAiPlannerRiskSourceLabel,
    parseAiPlannerRiskDraft,
    type AiPlannerRiskDraft,
    type AiPlannerRiskSource,
} from "@/services/ai/aiPlannerRisk";
import {
    buildPlannerCopilotPrompt,
    buildPlannerRiskPrompt,
} from "@/services/ai/aiPromptBuilders";
import { recordAiTelemetryEvent } from "@/services/ai/aiTelemetry";
import {
    buildReminderCalendar,
    getReminderDateKey,
    getReminderScheduleTimestamp,
} from "@/services/insights/workspaceInsights";
import { buildWorkspacePlannerRiskSummary } from "@/services/insights/workspacePlannerRisk";
import { findCurrentRecurringOccurrenceForPlan } from "@/services/recurring/recurringPlans";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type GeneratedAiPlannerDraft = {
  request: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  draft: AiPlannerCopilotDraft;
};

type GeneratedAiPlannerRiskBrief = {
  request: string;
  activeDateKey: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  sources: AiPlannerRiskSource[];
  draft: AiPlannerRiskDraft;
};

type PlannerSection = "focus" | "calendar" | "schedule";

function formatDue(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function getPlannerSuggestedActionLabel(
  action: AiPlannerCopilotDraft["suggestedActions"][number]["action"],
) {
  if (action === "do-now") return "Do now";
  if (action === "log-proof") return "Log proof";
  if (action === "snooze") return "Snooze";
  return "Review later";
}

function getMonthOffsetForDate(referenceTimestamp: string, dateKey: string) {
  const referenceDate = new Date(referenceTimestamp);
  const targetDate = new Date(`${dateKey}T00:00:00`);
  return (
    (targetDate.getFullYear() - referenceDate.getFullYear()) * 12 +
    (targetDate.getMonth() - referenceDate.getMonth())
  );
}

export default function PlannerScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const headerHeight = useMaterialCompactTopAppBarHeight();
  const headerScroll = useTabHeaderScroll("planner");
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
  const {
    completeRecurringOccurrence,
    completeReminder,
    isHydrated,
    recommendations,
    skipReminder,
    snoozeReminder,
    workspace,
  } = useWorkspace();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [aiRequest, setAiRequest] = useState("");
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [generatedAiDraft, setGeneratedAiDraft] =
    useState<GeneratedAiPlannerDraft | null>(null);
  const [appliedAiDraft, setAppliedAiDraft] =
    useState<GeneratedAiPlannerDraft | null>(null);
  const [riskRequest, setRiskRequest] = useState("");
  const [riskStatusMessage, setRiskStatusMessage] = useState<string | null>(
    null,
  );
  const [isGeneratingRiskBrief, setIsGeneratingRiskBrief] = useState(false);
  const [generatedRiskBrief, setGeneratedRiskBrief] =
    useState<GeneratedAiPlannerRiskBrief | null>(null);
  const [appliedRiskBrief, setAppliedRiskBrief] =
    useState<GeneratedAiPlannerRiskBrief | null>(null);
  const [activeSection, setActiveSection] = useState<PlannerSection>("focus");

  const referenceMonth = useMemo(() => {
    const date = new Date(workspace.generatedAt);
    date.setMonth(date.getMonth() + monthOffset);
    return date;
  }, [monthOffset, workspace.generatedAt]);

  const calendar = useMemo(
    () =>
      buildReminderCalendar(
        referenceMonth.toISOString(),
        workspace.reminders,
        workspace.generatedAt,
      ),
    [referenceMonth, workspace.generatedAt, workspace.reminders],
  );

  const activeDateKey = useMemo(() => {
    if (selectedDateKey) return selectedDateKey;

    const todayKey = workspace.generatedAt.slice(0, 10);
    const todayCell = calendar.weeks
      .flat()
      .find((cell) => cell.key === todayKey);
    if (todayCell && todayCell.inMonth) return todayKey;

    return (
      calendar.weeks
        .flat()
        .find((cell) => cell.inMonth && cell.reminders.length > 0)?.key ??
      calendar.weeks.flat().find((cell) => cell.inMonth)?.key ??
      todayKey
    );
  }, [calendar.weeks, selectedDateKey, workspace.generatedAt]);

  const selectedDayReminders = useMemo(
    () =>
      [...workspace.reminders]
        .filter((reminder) => getReminderDateKey(reminder) === activeDateKey)
        .sort((left, right) =>
          getReminderScheduleTimestamp(left).localeCompare(
            getReminderScheduleTimestamp(right),
          ),
        ),
    [activeDateKey, workspace.reminders],
  );

  const plannerGroups = useMemo(() => {
    const spacesById = new Map(
      workspace.spaces.map((space) => [space.id, space] as const),
    );
    const grouped = new Map<string, typeof workspace.reminders>();

    [...workspace.reminders]
      .sort((left, right) =>
        (left.snoozedUntil ?? left.dueAt).localeCompare(
          right.snoozedUntil ?? right.dueAt,
        ),
      )
      .forEach((reminder) => {
        const key = new Date(
          reminder.snoozedUntil ?? reminder.dueAt,
        ).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          weekday: "short",
        });
        grouped.set(key, [...(grouped.get(key) ?? []), reminder]);
      });

    return Array.from(grouped.entries()).map(([label, reminders]) => ({
      label,
      reminders,
      spacesById,
    }));
  }, [workspace.reminders, workspace.spaces]);
  const currentRecurringOccurrenceByPlanId = useMemo(() => {
    const map = new Map<
      string,
      (typeof workspace.recurringOccurrences)[number]
    >();

    for (const plan of workspace.recurringPlans) {
      const currentOccurrence = findCurrentRecurringOccurrenceForPlan(
        workspace,
        plan.id,
        workspace.generatedAt,
      );
      if (currentOccurrence) {
        map.set(plan.id, currentOccurrence);
      }
    }

    return map;
  }, [workspace]);
  const plannerHighlights = [
    `${workspace.reminders.length} reminders tracked`,
    `${workspace.recurringPlans.filter((plan) => plan.status === "active").length} active routines`,
    `${selectedDayReminders.length} on the selected day`,
    `${plannerGroups.length} upcoming day groups`,
  ];
  const reminderTitlesById = useMemo(
    () =>
      new Map(
        workspace.reminders.map((reminder) => [reminder.id, reminder] as const),
      ),
    [workspace.reminders],
  );
  const allowedPlannerDateKeys = useMemo(
    () =>
      Array.from(
        new Set([
          activeDateKey,
          ...workspace.reminders.map((reminder) =>
            getReminderDateKey(reminder),
          ),
        ]),
      ),
    [activeDateKey, workspace.reminders],
  );
  const selectedReminderForQuickAction = selectedDayReminders[0];
  const plannerRiskSummary = useMemo(
    () => buildWorkspacePlannerRiskSummary(workspace, activeDateKey),
    [activeDateKey, workspace],
  );
  const pageQuickActions = [
    {
      id: "planner-today",
      label: "Focus today",
      hint: `${selectedDayReminders.length} reminder${selectedDayReminders.length === 1 ? "" : "s"} are on the currently selected day.`,
      onPress: () => {
        setMonthOffset(0);
        setSelectedDateKey(workspace.generatedAt.slice(0, 10));
      },
      accentColor: palette.tint,
    },
    {
      id: "planner-log-proof",
      label: selectedReminderForQuickAction ? "Log proof" : "Open logbook",
      hint: selectedReminderForQuickAction
        ? `Ready to capture proof for ${selectedReminderForQuickAction.title}.`
        : "Open the logbook and attach proof to a reminder when needed.",
      onPress: () =>
        router.push({
          pathname: "/logbook",
          params: selectedReminderForQuickAction
            ? {
                actionId: "quick-log",
                reminderId: selectedReminderForQuickAction.id,
                spaceId: selectedReminderForQuickAction.spaceId,
              }
            : { actionId: "quick-log" },
        }),
      accentColor: palette.secondary,
    },
    {
      id: "planner-action-center",
      label: "Open action center",
      hint: "Complete, snooze, or skip reminder work from a single queue.",
      onPress: () => router.push("/action-center" as never),
    },
    {
      id: "planner-recurring-new",
      label: "New recurring plan",
      hint: "Create a first-class routine with times, grace period, and proof settings.",
      onPress: () =>
        router.push({
          pathname: "/recurring-plan-editor",
          params: { from: "planner" },
        }),
      accentColor: palette.tint,
    },
  ];
  const plannerSections = useMemo<FeatureSectionItem<PlannerSection>[]>(
    () => [
      {
        id: "focus",
        label: "Focus",
        icon: {
          ios: "brain.head.profile",
          android: "psychology",
          web: "psychology",
        },
        hint: "AI copilot, risk briefs, and selected-day guidance",
        meta: `${selectedDayReminders.length} on selected day`,
        badges: [
          `${plannerRiskSummary.summary.overdueCount} overdue`,
          `${plannerRiskSummary.summary.deferralCount} deferral${plannerRiskSummary.summary.deferralCount === 1 ? "" : "s"}`,
        ],
        accentColor: palette.tint,
      },
      {
        id: "calendar",
        label: "Calendar",
        icon: {
          ios: "calendar",
          android: "calendar_month",
          web: "calendar_month",
        },
        hint: "Month view and the currently selected day agenda",
        meta: calendar.monthLabel,
        badges: [
          `${calendar.weeks.length} week${calendar.weeks.length === 1 ? "" : "s"}`,
          activeDateKey,
        ],
        accentColor: palette.secondary,
      },
      {
        id: "schedule",
        label: "Schedule",
        icon: {
          ios: "list.bullet.rectangle.portrait.fill",
          android: "view_agenda",
          web: "view_agenda",
        },
        hint: "Upcoming grouped reminders and action-ready schedule lanes",
        meta: `${plannerGroups.length} day group${plannerGroups.length === 1 ? "" : "s"}`,
        badges: [
          `${workspace.reminders.length} reminder${workspace.reminders.length === 1 ? "" : "s"}`,
          recommendations.length > 0 ? "Recommendations live" : "No alerts",
        ],
        accentColor: palette.tint,
      },
    ],
    [
      activeDateKey,
      calendar.monthLabel,
      calendar.weeks.length,
      palette.secondary,
      palette.tint,
      plannerGroups.length,
      plannerRiskSummary.summary.deferralCount,
      plannerRiskSummary.summary.overdueCount,
      recommendations.length,
      selectedDayReminders.length,
      workspace.reminders.length,
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

  async function handleGenerateAiDraft() {
    const trimmedRequest = aiRequest.trim();
    if (!trimmedRequest) {
      setAiStatusMessage(
        "Describe the kind of planner help you want before generating a copilot draft.",
      );
      return;
    }

    const promptDraft = buildPlannerCopilotPrompt({
      workspace,
      userRequest: trimmedRequest,
      activeDateKey,
    });
    setIsGeneratingAiDraft(true);
    void recordAiTelemetryEvent({
      surface: "planner-copilot",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: promptDraft.system,
      prompt: buildAiPlannerCopilotGenerationPrompt(promptDraft.prompt),
      temperature: 0.35,
      maxOutputTokens: 950,
    });
    setIsGeneratingAiDraft(false);

    if (result.status !== "success") {
      setGeneratedAiDraft(null);
      setAiStatusMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "planner-copilot",
        action: "generate-failed",
      });
      return;
    }

    const parsedDraft = parseAiPlannerCopilotDraft(result.text, {
      allowedDateKeys: allowedPlannerDateKeys,
      reminders: workspace.reminders.map((reminder) => ({
        id: reminder.id,
        title: reminder.title,
      })),
    });
    if (!parsedDraft) {
      setGeneratedAiDraft(null);
      setAiStatusMessage(
        "TrackItUp received an AI response but could not turn it into a reviewable planner draft. Try asking for a smaller, more specific plan.",
      );
      void recordAiTelemetryEvent({
        surface: "planner-copilot",
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
      "Generated an AI planner draft. Review it carefully before applying it to the planner.",
    );
    void recordAiTelemetryEvent({
      surface: "planner-copilot",
      action: "generate-succeeded",
    });
  }

  function handleApplyAiDraft() {
    if (!generatedAiDraft) return;

    if (generatedAiDraft.draft.focusDateKey) {
      setSelectedDateKey(generatedAiDraft.draft.focusDateKey);
      setMonthOffset(
        getMonthOffsetForDate(
          workspace.generatedAt,
          generatedAiDraft.draft.focusDateKey,
        ),
      );
    }

    setAppliedAiDraft(generatedAiDraft);
    setGeneratedAiDraft(null);
    setAiStatusMessage(
      "Applied the AI planner draft. Review the suggested day and actions before changing any reminder state.",
    );
    void recordAiTelemetryEvent({
      surface: "planner-copilot",
      action: "draft-applied",
    });
  }

  function handleDismissAiDraft() {
    setGeneratedAiDraft(null);
    setAiStatusMessage(
      "Dismissed the AI planner draft. Your current planner state is unchanged.",
    );
  }

  function openPlannerRiskDestination(
    destination?: AiPlannerRiskDraft["suggestedDestination"],
    source?: Pick<AiPlannerRiskSource, "spaceId" | "reminderId">,
  ) {
    if (!destination || destination === "planner") {
      return;
    }

    if (destination === "action-center") {
      router.push("/action-center" as never);
      return;
    }

    router.push({
      pathname: "/logbook",
      params: source?.reminderId
        ? {
            actionId: "quick-log",
            reminderId: source.reminderId,
            spaceId: source.spaceId,
          }
        : source?.spaceId
          ? { spaceId: source.spaceId }
          : { actionId: "quick-log" },
    });
  }

  function openPlannerRiskSource(source: AiPlannerRiskSource) {
    openPlannerRiskDestination(source.route, source);
  }

  function openRecurringOccurrenceLogbook(
    occurrenceId: string,
    planId: string,
    spaceId: string,
    spaceIds?: string[],
  ) {
    router.push({
      pathname: "/logbook",
      params: {
        actionId: "quick-log",
        spaceId,
        recurringOccurrenceId: occurrenceId,
        recurringPlanId: planId,
        ...(spaceIds?.length ? { spaceIds: spaceIds.join(",") } : {}),
      },
    });
  }

  async function handleGenerateRiskBrief() {
    const trimmedRequest = riskRequest.trim();
    if (!trimmedRequest) {
      setRiskStatusMessage(
        "Describe the planner risk or deferral question you want answered before generating a brief.",
      );
      return;
    }

    const promptDraft = buildPlannerRiskPrompt({
      workspace,
      userRequest: trimmedRequest,
      activeDateKey,
    });
    setIsGeneratingRiskBrief(true);
    void recordAiTelemetryEvent({
      surface: "planner-risk-brief",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: promptDraft.system,
      prompt: buildAiPlannerRiskGenerationPrompt(promptDraft.prompt),
      temperature: 0.2,
      maxOutputTokens: 900,
    });
    setIsGeneratingRiskBrief(false);

    if (result.status !== "success") {
      setGeneratedRiskBrief(null);
      setRiskStatusMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "planner-risk-brief",
        action: "generate-failed",
      });
      return;
    }

    const parsedDraft = parseAiPlannerRiskDraft(result.text, {
      allowedSourceIds: promptDraft.context.retrievedSources.map(
        (source) => source.id,
      ),
    });
    if (!parsedDraft) {
      setGeneratedRiskBrief(null);
      setRiskStatusMessage(
        "TrackItUp received an AI response but could not turn it into a grounded planner risk brief. Try asking a narrower question about what can wait or what keeps slipping.",
      );
      void recordAiTelemetryEvent({
        surface: "planner-risk-brief",
        action: "generate-failed",
      });
      return;
    }

    setGeneratedRiskBrief({
      request: trimmedRequest,
      activeDateKey,
      consentLabel: promptDraft.consentLabel,
      modelId: result.modelId,
      usage: result.usage,
      sources: promptDraft.context.retrievedSources,
      draft: parsedDraft,
    });
    setRiskStatusMessage(
      `Generated a grounded planner risk brief for ${activeDateKey}. Review the cited reminders and deferrals before applying it.`,
    );
    void recordAiTelemetryEvent({
      surface: "planner-risk-brief",
      action: "generate-succeeded",
    });
  }

  function handleApplyRiskBrief() {
    if (!generatedRiskBrief) return;

    setAppliedRiskBrief(generatedRiskBrief);
    setGeneratedRiskBrief(null);
    setRiskStatusMessage(
      "Applied the planner risk brief. Review the cited reminders, deferrals, and hotspots before changing any reminder state.",
    );
    void recordAiTelemetryEvent({
      surface: "planner-risk-brief",
      action: "draft-applied",
    });
  }

  function handleDismissRiskBrief() {
    setGeneratedRiskBrief(null);
    setRiskStatusMessage(
      "Dismissed the AI planner risk brief. Your current planner state is unchanged.",
    );
  }

  const appliedAiReminder = appliedAiDraft?.draft.suggestedActions[0]
    ? reminderTitlesById.get(
        appliedAiDraft.draft.suggestedActions[0].reminderId,
      )
    : undefined;

  if (!isHydrated) {
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
              Planner
            </Chip>
            <Chip
              compact
              style={[styles.headerBadge, paletteStyles.accentChipSurface]}
              textStyle={styles.headerBadgeLabel}
            >
              Loading
            </Chip>
          </View>
          <Text style={styles.title}>Planner calendar</Text>
          <Text style={[styles.subtitle, paletteStyles.mutedText]}>
            TrackItUp is hydrating reminder schedules and preparing the next
            calendar view.
          </Text>
        </Surface>
        <WorkspacePageSkeleton palette={palette} sectionCount={4} />
      </Animated.ScrollView>
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
            Planner
          </Chip>
          <Chip
            compact
            style={[styles.headerBadge, paletteStyles.accentChipSurface]}
            textStyle={styles.headerBadgeLabel}
          >
            {calendar.monthLabel}
          </Chip>
        </View>
        <Text style={styles.title}>Planner calendar</Text>
        <Text style={[styles.subtitle, paletteStyles.mutedText]}>
          See recurring work at a glance, focus on one day, and take the next
          action without bouncing between screens.
        </Text>
        <View style={styles.highlightRow}>
          {plannerHighlights.map((item) => (
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
        title="Keep planner work flowing"
        description="Jump straight into today’s work, capture proof from the selected day, or move into the action queue without losing planner context."
        actions={pageQuickActions}
      />

      <FeatureSectionSwitcher
        palette={palette}
        label="Feature groups"
        title="Focus on one planner layer at a time"
        description="Switch between AI focus tools, the calendar view, and the schedule lanes so the planner stays organized instead of showing every layer at once."
        items={plannerSections}
        activeId={activeSection}
        onChange={setActiveSection}
      />

      <Animated.View style={sectionContentAnimatedStyle}>
        {activeSection === "focus" ? (
          <>
            <AiPromptComposerCard
              palette={palette}
              label="AI planner copilot"
              title="Draft the next best plan for the current calendar"
              value={aiRequest}
              onChangeText={setAiRequest}
              onSubmit={() => void handleGenerateAiDraft()}
              isBusy={isGeneratingAiDraft}
              contextChips={[
                activeDateKey,
                `${selectedDayReminders.length} on selected day`,
                `${plannerGroups.length} day groups visible`,
              ]}
              helperText={aiPlannerCopilotCopy.getHelperText(activeDateKey)}
              consentLabel={aiPlannerCopilotCopy.consentLabel}
              footerNote={aiPlannerCopilotCopy.promptFooterNote}
              placeholder="Example: Prioritize the selected day, call out what I should log proof for, and tell me what can wait until later this week."
              submitLabel="Generate planner draft"
            />

            {aiStatusMessage ? (
              <SectionMessage
                palette={palette}
                label="AI planner"
                title="Latest copilot status"
                message={aiStatusMessage}
              />
            ) : null}

            {generatedAiDraft ? (
              <AiDraftReviewCard
                palette={palette}
                title="Review the AI planner draft"
                draftKindLabel={`Planner • ${activeDateKey}`}
                summary={`Prompt: ${generatedAiDraft.request}`}
                consentLabel={generatedAiDraft.consentLabel}
                footerNote={aiPlannerCopilotCopy.reviewFooterNote}
                statusLabel="Draft ready"
                modelLabel={generatedAiDraft.modelId}
                usage={generatedAiDraft.usage}
                contextChips={[
                  generatedAiDraft.draft.focusDateKey ?? activeDateKey,
                  `${generatedAiDraft.draft.suggestedActions.length} suggested action${generatedAiDraft.draft.suggestedActions.length === 1 ? "" : "s"}`,
                ]}
                items={buildAiPlannerCopilotReviewItems(generatedAiDraft.draft)}
                acceptLabel="Apply to planner"
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
                label="AI plan"
                title={appliedAiDraft.draft.headline}
              >
                <ChipRow style={styles.aiChipRow}>
                  <Chip compact>
                    Focus {appliedAiDraft.draft.focusDateKey ?? activeDateKey}
                  </Chip>
                  <Chip compact>
                    {recommendations.length} recommendations live
                  </Chip>
                </ChipRow>
                {appliedAiDraft.draft.summary ? (
                  <Text style={styles.copy}>
                    {appliedAiDraft.draft.summary}
                  </Text>
                ) : null}
                {appliedAiDraft.draft.groupedPlan.length > 0 ? (
                  <View style={styles.aiList}>
                    {appliedAiDraft.draft.groupedPlan.map((item) => (
                      <Text key={item} style={styles.historyItem}>
                        • {item}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {appliedAiDraft.draft.suggestedActions.length > 0 ? (
                  <View style={styles.aiList}>
                    {appliedAiDraft.draft.suggestedActions.map((item) => (
                      <Text key={item.reminderId} style={styles.historyItem}>
                        • {item.title} —{" "}
                        {getPlannerSuggestedActionLabel(item.action)} •{" "}
                        {item.reason}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {appliedAiDraft.draft.caution ? (
                  <Text style={styles.historyItem}>
                    Caution: {appliedAiDraft.draft.caution}
                  </Text>
                ) : null}
                <ActionButtonRow style={styles.buttonRow}>
                  <Button
                    mode="outlined"
                    onPress={() => setAppliedAiDraft(null)}
                    style={styles.button}
                  >
                    Clear plan
                  </Button>
                  {appliedAiDraft.draft.focusDateKey ? (
                    <Button
                      mode="outlined"
                      onPress={() => {
                        setSelectedDateKey(
                          appliedAiDraft.draft.focusDateKey ?? activeDateKey,
                        );
                        setMonthOffset(
                          getMonthOffsetForDate(
                            workspace.generatedAt,
                            appliedAiDraft.draft.focusDateKey ?? activeDateKey,
                          ),
                        );
                      }}
                      style={styles.button}
                    >
                      Focus suggested day
                    </Button>
                  ) : null}
                  <Button
                    mode="outlined"
                    onPress={() => router.push("/action-center" as never)}
                    style={styles.button}
                  >
                    Open action center
                  </Button>
                  {appliedAiReminder ? (
                    <Button
                      mode="contained"
                      onPress={() =>
                        router.push({
                          pathname: "/logbook",
                          params: {
                            actionId: "quick-log",
                            reminderId: appliedAiReminder.id,
                            spaceId: appliedAiReminder.spaceId,
                          },
                        })
                      }
                      style={styles.button}
                    >
                      Log proof
                    </Button>
                  ) : null}
                  <Button
                    mode="contained-tonal"
                    onPress={() => void handleGenerateAiDraft()}
                    style={styles.button}
                    disabled={isGeneratingAiDraft}
                  >
                    Refresh plan
                  </Button>
                </ActionButtonRow>
              </SectionSurface>
            ) : null}

            <AiPromptComposerCard
              palette={palette}
              label="AI planner risk"
              title="Explain what looks risky or safely deferrable"
              value={riskRequest}
              onChangeText={setRiskRequest}
              onSubmit={() => void handleGenerateRiskBrief()}
              isBusy={isGeneratingRiskBrief}
              contextChips={[
                activeDateKey,
                `${plannerRiskSummary.summary.overdueCount} overdue`,
                `${plannerRiskSummary.summary.deferralCount} recent deferral${plannerRiskSummary.summary.deferralCount === 1 ? "" : "s"}`,
              ]}
              helperText={aiPlannerRiskCopy.getHelperText(activeDateKey)}
              consentLabel={aiPlannerRiskCopy.consentLabel}
              footerNote={aiPlannerRiskCopy.promptFooterNote}
              placeholder="Example: Explain what can safely wait until later this week, what is most likely to slip, and whether I should jump to action center or logbook next."
              submitLabel="Generate risk brief"
            />

            {riskStatusMessage ? (
              <SectionMessage
                palette={palette}
                label="AI planner risk"
                title="Latest risk brief status"
                message={riskStatusMessage}
              />
            ) : null}

            {generatedRiskBrief ? (
              <AiDraftReviewCard
                palette={palette}
                title="Review the AI planner risk brief"
                draftKindLabel={`Planner risk • ${generatedRiskBrief.activeDateKey}`}
                summary={`Prompt: ${generatedRiskBrief.request}`}
                consentLabel={generatedRiskBrief.consentLabel}
                footerNote={aiPlannerRiskCopy.reviewFooterNote}
                statusLabel="Draft ready"
                modelLabel={generatedRiskBrief.modelId}
                usage={generatedRiskBrief.usage}
                contextChips={[
                  generatedRiskBrief.activeDateKey,
                  `${generatedRiskBrief.draft.citedSourceIds.length} cited source${generatedRiskBrief.draft.citedSourceIds.length === 1 ? "" : "s"}`,
                ]}
                items={buildAiPlannerRiskReviewItems(
                  generatedRiskBrief.draft,
                  generatedRiskBrief.sources,
                )}
                acceptLabel="Apply brief"
                editLabel="Dismiss draft"
                regenerateLabel="Generate again"
                onAccept={handleApplyRiskBrief}
                onEdit={handleDismissRiskBrief}
                onRegenerate={() => void handleGenerateRiskBrief()}
                isBusy={isGeneratingRiskBrief}
              />
            ) : null}

            {appliedRiskBrief ? (
              <SectionSurface
                palette={palette}
                label="AI risk"
                title={appliedRiskBrief.draft.headline}
              >
                <ChipRow style={styles.aiChipRow}>
                  <Chip compact>Day {appliedRiskBrief.activeDateKey}</Chip>
                  <Chip compact>
                    {formatAiPlannerRiskDestinationLabel(
                      appliedRiskBrief.draft.suggestedDestination ?? "planner",
                    )}
                  </Chip>
                </ChipRow>
                {appliedRiskBrief.draft.summary ? (
                  <Text style={styles.copy}>
                    {appliedRiskBrief.draft.summary}
                  </Text>
                ) : null}
                {appliedRiskBrief.draft.keyRisks.length > 0 ? (
                  <View style={styles.aiList}>
                    {appliedRiskBrief.draft.keyRisks.map((risk) => (
                      <Text
                        key={risk}
                        style={[styles.meta, paletteStyles.mutedText]}
                      >
                        • {risk}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {appliedRiskBrief.draft.caution ? (
                  <Text style={[styles.meta, paletteStyles.mutedText]}>
                    Caution: {appliedRiskBrief.draft.caution}
                  </Text>
                ) : null}
                {appliedRiskBrief.sources
                  .filter((source) =>
                    appliedRiskBrief.draft.citedSourceIds.includes(source.id),
                  )
                  .map((source) => (
                    <Surface
                      key={source.id}
                      style={[
                        styles.riskSourceCard,
                        paletteStyles.raisedCardSurface,
                        raisedCardShadow,
                        { borderColor: palette.border },
                      ]}
                      elevation={uiElevation.raisedCard}
                    >
                      <View>
                        <Text style={styles.listTitle}>
                          {formatAiPlannerRiskSourceLabel(source)}
                        </Text>
                        <Text style={[styles.copy, paletteStyles.mutedText]}>
                          {source.snippet}
                        </Text>
                      </View>
                      <Button
                        mode="outlined"
                        onPress={() => openPlannerRiskSource(source)}
                        style={styles.button}
                      >
                        {formatAiPlannerRiskDestinationLabel(source.route)}
                      </Button>
                    </Surface>
                  ))}
                <ActionButtonRow style={styles.riskActionRow}>
                  <Button
                    mode="outlined"
                    onPress={() => setAppliedRiskBrief(null)}
                    style={styles.button}
                  >
                    Clear brief
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() =>
                      openPlannerRiskDestination(
                        appliedRiskBrief.draft.suggestedDestination,
                      )
                    }
                    style={styles.button}
                  >
                    {formatAiPlannerRiskDestinationLabel(
                      appliedRiskBrief.draft.suggestedDestination ?? "planner",
                    )}
                  </Button>
                  <Button
                    mode="contained-tonal"
                    onPress={() => void handleGenerateRiskBrief()}
                    style={styles.button}
                    disabled={isGeneratingRiskBrief}
                  >
                    Refresh brief
                  </Button>
                </ActionButtonRow>
              </SectionSurface>
            ) : null}
          </>
        ) : null}

        {activeSection === "calendar" ? (
          <>
            <Surface
              style={[styles.calendarCard, paletteStyles.cardSurface]}
              elevation={uiElevation.card}
            >
              <View style={styles.calendarHeader}>
                <Button
                  mode="text"
                  onPress={() => setMonthOffset((current) => current - 1)}
                >
                  Previous
                </Button>
                <Text style={styles.calendarTitle}>{calendar.monthLabel}</Text>
                <Button
                  mode="text"
                  onPress={() => setMonthOffset((current) => current + 1)}
                >
                  Next
                </Button>
              </View>

              <View style={styles.weekdayRow}>
                {weekdayLabels.map((label) => (
                  <Text
                    key={label}
                    style={[styles.weekdayLabel, paletteStyles.mutedText]}
                  >
                    {label}
                  </Text>
                ))}
              </View>

              {calendar.weeks.map((week, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.calendarWeek}>
                  {week.map((cell) => {
                    const isSelected = cell.key === activeDateKey;

                    return (
                      <Pressable
                        key={cell.key}
                        onPress={() => setSelectedDateKey(cell.key)}
                        style={[
                          styles.calendarDay,
                          {
                            backgroundColor: isSelected
                              ? `${palette.tint}16`
                              : palette.background,
                            borderColor: isSelected
                              ? palette.tint
                              : cell.isToday
                                ? `${palette.tint}77`
                                : palette.border,
                            opacity: cell.inMonth ? 1 : 0.55,
                          },
                        ]}
                      >
                        <Text style={styles.calendarDayLabel}>
                          {cell.label}
                        </Text>
                        <Text
                          style={[
                            styles.calendarDayMeta,
                            paletteStyles.mutedText,
                          ]}
                        >
                          {cell.reminders.length > 0
                            ? `${cell.reminders.length} task${cell.reminders.length === 1 ? "" : "s"}`
                            : "—"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </Surface>

            <View
              style={[
                styles.dayAgendaCard,
                paletteStyles.raisedCardSurface,
                raisedCardShadow,
              ]}
            >
              <Text style={styles.sectionTitle}>Selected day agenda</Text>
              <Text style={[styles.selectedDateMeta, paletteStyles.mutedText]}>
                {activeDateKey}
              </Text>
              {selectedDayReminders.length > 0 ? (
                selectedDayReminders.map((reminder, index) => {
                  const space = workspace.spaces.find(
                    (item) => item.id === reminder.spaceId,
                  );

                  return (
                    <MotionView
                      key={reminder.id}
                      delay={uiMotion.stagger * (index + 1)}
                    >
                      <View style={styles.dayAgendaItem}>
                        <Text style={styles.listTitle}>{reminder.title}</Text>
                        <Text style={[styles.copy, paletteStyles.mutedText]}>
                          {space?.name ?? "Unknown space"} • Due{" "}
                          {formatDue(getReminderScheduleTimestamp(reminder))}
                        </Text>
                      </View>
                    </MotionView>
                  );
                })
              ) : (
                <Text style={[styles.copy, paletteStyles.mutedText]}>
                  No reminders are scheduled for this day.
                </Text>
              )}
            </View>
          </>
        ) : null}

        {activeSection === "schedule" ? (
          <>
            <SectionSurface
              palette={palette}
              label="Recurring plans"
              title="Routine plan management"
            >
              {workspace.recurringPlans.length === 0 ? (
                <View
                  style={[
                    styles.card,
                    paletteStyles.raisedCardSurface,
                    raisedCardShadow,
                    { borderLeftColor: palette.tint },
                  ]}
                >
                  <Text style={styles.cardTitle}>No recurring plans yet</Text>
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    Create your first recurring routine and TrackItUp will
                    generate scheduled occurrences in the planner and action
                    center.
                  </Text>
                  <ActionButtonRow style={styles.buttonRow}>
                    <Button
                      mode="contained"
                      onPress={() =>
                        router.push({
                          pathname: "/recurring-plan-editor",
                          params: { from: "planner" },
                        })
                      }
                      style={styles.button}
                    >
                      Create recurring plan
                    </Button>
                  </ActionButtonRow>
                </View>
              ) : (
                workspace.recurringPlans.map((plan, index) => {
                  const space = workspace.spaces.find(
                    (item) => item.id === plan.spaceId,
                  );
                  const currentOccurrence =
                    currentRecurringOccurrenceByPlanId.get(plan.id);
                  const planSpaceIds = normalizeSpaceIds(plan);

                  return (
                    <MotionView
                      key={plan.id}
                      delay={uiMotion.stagger * (index + 1)}
                    >
                      <View
                        style={[
                          styles.card,
                          paletteStyles.raisedCardSurface,
                          raisedCardShadow,
                          {
                            borderLeftColor: space?.themeColor ?? palette.tint,
                          },
                        ]}
                      >
                        <Text style={styles.cardTitle}>{plan.title}</Text>
                        <View style={styles.metaRow}>
                          <Text
                            style={[
                              styles.meta,
                              { color: space?.themeColor ?? palette.tint },
                            ]}
                          >
                            {space?.name ?? "Unknown space"}
                          </Text>
                          <Chip compact>{plan.status.toUpperCase()}</Chip>
                        </View>
                        <Text style={[styles.copy, paletteStyles.mutedText]}>
                          {plan.description?.trim() ?? "Recurring routine plan"}
                        </Text>
                        <Text style={[styles.copy, paletteStyles.mutedText]}>
                          {plan.scheduleRule.type} • {plan.timezone}
                          {plan.proofRequired ? " • proof required" : ""}
                        </Text>
                        <Text style={[styles.copy, paletteStyles.mutedText]}>
                          {currentOccurrence
                            ? `Current occurrence due ${formatDue(currentOccurrence.snoozedUntil ?? currentOccurrence.dueAt)}`
                            : "No current occurrence in the active schedule window"}
                        </Text>
                        <ActionButtonRow style={styles.buttonRow}>
                          <Button
                            mode="contained"
                            onPress={() => {
                              if (!currentOccurrence) return;

                              if (plan.proofRequired) {
                                openRecurringOccurrenceLogbook(
                                  currentOccurrence.id,
                                  plan.id,
                                  planSpaceIds[0] ?? plan.spaceId,
                                  planSpaceIds,
                                );
                                return;
                              }

                              completeRecurringOccurrence(currentOccurrence.id);
                            }}
                            style={styles.button}
                            disabled={!currentOccurrence}
                          >
                            {plan.proofRequired
                              ? "Log current proof"
                              : "Mark current done"}
                          </Button>
                          <Button
                            mode="outlined"
                            onPress={() =>
                              router.push({
                                pathname: "/recurring-plan-editor",
                                params: {
                                  planId: plan.id,
                                  from: "planner",
                                },
                              })
                            }
                            style={styles.button}
                          >
                            Edit plan
                          </Button>
                          <Button
                            mode="outlined"
                            onPress={() =>
                              router.push({
                                pathname: "/recurring-history",
                                params: {
                                  planId: plan.id,
                                },
                              })
                            }
                            style={styles.button}
                          >
                            History
                          </Button>
                          <Button
                            mode="contained-tonal"
                            onPress={() =>
                              router.push({
                                pathname: "/recurring-plan-editor",
                                params: {
                                  duplicateFromPlanId: plan.id,
                                  from: "planner",
                                },
                              })
                            }
                            style={styles.button}
                          >
                            Duplicate
                          </Button>
                        </ActionButtonRow>
                      </View>
                    </MotionView>
                  );
                })
              )}
            </SectionSurface>

            {plannerGroups.length === 0 ? (
              <View
                style={[
                  styles.card,
                  paletteStyles.raisedCardSurface,
                  raisedCardShadow,
                  { borderLeftColor: palette.border },
                ]}
              >
                <Text style={styles.cardTitle}>No reminders yet</Text>
                <Text style={[styles.copy, paletteStyles.mutedText]}>
                  Upcoming reminders will appear here when real workspace tasks
                  are synced, imported, or created.
                </Text>
              </View>
            ) : (
              plannerGroups.map((group) => (
                <View key={group.label} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.label}</Text>
                  {group.reminders.map((reminder, index) => {
                    const space = group.spacesById.get(reminder.spaceId);

                    return (
                      <MotionView
                        key={reminder.id}
                        delay={uiMotion.stagger * (index + 1)}
                      >
                        <SwipeActionCard
                          rightActions={[
                            {
                              label: "Proof",
                              accentColor: palette.secondary,
                              onPress: () =>
                                router.push({
                                  pathname: "/logbook",
                                  params: {
                                    actionId: "quick-log",
                                    reminderId: reminder.id,
                                    spaceId: reminder.spaceId,
                                  },
                                }),
                            },
                            {
                              label: "Done",
                              accentColor: palette.tint,
                              onPress: () => completeReminder(reminder.id),
                            },
                            {
                              label: "Snooze",
                              accentColor: palette.muted,
                              onPress: () => snoozeReminder(reminder.id),
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.card,
                              paletteStyles.raisedCardSurface,
                              raisedCardShadow,
                              {
                                borderLeftColor:
                                  space?.themeColor ?? palette.tint,
                              },
                            ]}
                          >
                            <Text style={styles.cardTitle}>
                              {reminder.title}
                            </Text>
                            <View style={styles.metaRow}>
                              <Text
                                style={[
                                  styles.meta,
                                  { color: space?.themeColor ?? palette.tint },
                                ]}
                              >
                                {space?.name ?? "Unknown space"}
                              </Text>
                              <Chip compact>
                                {reminder.status.toUpperCase()}
                              </Chip>
                            </View>
                            <Text
                              style={[styles.copy, paletteStyles.mutedText]}
                            >
                              {reminder.description}
                            </Text>
                            <Text
                              style={[styles.copy, paletteStyles.mutedText]}
                            >
                              Due{" "}
                              {formatDue(
                                reminder.snoozedUntil ?? reminder.dueAt,
                              )}
                            </Text>
                            {reminder.ruleLabel || reminder.triggerCondition ? (
                              <Text
                                style={[styles.copy, paletteStyles.mutedText]}
                              >
                                {reminder.ruleLabel ??
                                  reminder.triggerCondition}
                              </Text>
                            ) : null}
                            {reminder.skipReason ? (
                              <Text
                                style={[styles.copy, paletteStyles.mutedText]}
                              >
                                Last skip: {reminder.skipReason}
                              </Text>
                            ) : null}

                            <View style={styles.buttonRow}>
                              <Button
                                mode="contained"
                                onPress={() => completeReminder(reminder.id)}
                                style={styles.button}
                              >
                                Complete
                              </Button>
                              <Button
                                mode="outlined"
                                onPress={() => snoozeReminder(reminder.id)}
                                style={styles.button}
                              >
                                Snooze
                              </Button>
                              <Button
                                mode="outlined"
                                onPress={() => skipReminder(reminder.id)}
                                style={styles.button}
                              >
                                Skip
                              </Button>
                            </View>

                            {(reminder.history ?? [])
                              .slice(0, 2)
                              .map((item) => (
                                <Text
                                  key={item.id}
                                  style={[
                                    styles.historyItem,
                                    paletteStyles.mutedText,
                                  ]}
                                >
                                  • {item.action} — {item.note}
                                </Text>
                              ))}
                          </View>
                        </SwipeActionCard>
                      </MotionView>
                    );
                  })}
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
  calendarCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: uiSpace.md,
  },
  calendarTitle: uiTypography.titleLg,
  weekdayRow: {
    flexDirection: "row",
    gap: uiSpace.sm,
    marginBottom: uiSpace.sm,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    ...uiTypography.chip,
  },
  calendarWeek: {
    flexDirection: "row",
    gap: uiSpace.sm,
    marginBottom: uiSpace.sm,
  },
  calendarDay: {
    flex: 1,
    minHeight: uiSize.calendarDayMin,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.md,
    padding: uiSpace.md,
  },
  calendarDayLabel: { ...uiTypography.bodyStrong, marginBottom: 6 },
  calendarDayMeta: { fontSize: 11, lineHeight: 16 },
  dayAgendaCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    elevation: uiElevation.raisedCard,
  },
  sectionTitle: { ...uiTypography.titleMd, fontWeight: "800", marginBottom: 6 },
  selectedDateMeta: { ...uiTypography.chip, marginBottom: uiSpace.md },
  dayAgendaItem: { marginBottom: uiSpace.md },
  aiChipRow: { marginTop: uiSpace.sm },
  aiList: { marginTop: uiSpace.md, gap: uiSpace.xs },
  riskSourceCard: {
    marginTop: uiSpace.md,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    gap: uiSpace.md,
  },
  riskActionRow: {
    marginTop: uiSpace.md,
    paddingTop: uiSpace.md,
    borderTopWidth: uiBorder.hairline,
  },
  group: { marginBottom: uiSpace.xs },
  groupTitle: { ...uiTypography.titleLg, marginBottom: uiSpace.md },
  card: {
    borderWidth: uiBorder.standard,
    borderLeftWidth: 5,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    marginBottom: uiSpace.lg,
    elevation: uiElevation.raisedCard,
  },
  cardTitle: { ...uiTypography.titleSection, marginBottom: 6 },
  listTitle: { ...uiTypography.titleSm, marginBottom: uiSpace.xs },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: uiSpace.sm,
  },
  meta: uiTypography.chip,
  copy: { ...uiTypography.body, marginBottom: uiSpace.xs },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: uiSpace.sm,
    marginTop: uiSpace.lg,
    marginBottom: uiSpace.md,
  },
  button: { alignSelf: "flex-start" },
  historyItem: { ...uiTypography.support, marginTop: uiSpace.xxs },
});
