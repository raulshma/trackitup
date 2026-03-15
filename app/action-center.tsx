import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, ScrollView, StyleSheet, View } from "react-native";
import {
  Checkbox,
  Chip,
  Surface,
  useTheme,
  type MD3Theme,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { AiActionPlanReviewCard } from "@/components/ui/AiActionPlanReviewCard";
import { AiDraftReviewCard } from "@/components/ui/AiDraftReviewCard";
import { AiPromptComposerCard } from "@/components/ui/AiPromptComposerCard";
import { CardActionPill } from "@/components/ui/CardActionPill";
import { ChipRow } from "@/components/ui/ChipRow";
import { CollapsibleSectionCard } from "@/components/ui/CollapsibleSectionCard";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import {
  FeatureSectionSwitcher,
  type FeatureSectionItem,
} from "@/components/ui/FeatureSectionSwitcher";
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
  uiSpace,
  uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
  buildAiActionCenterExplainerGenerationPrompt,
  buildAiActionCenterExplainerReviewItems,
  parseAiActionCenterExplainerDraft,
  type AiActionCenterExplainerActionKind,
  type AiActionCenterExplainerDraft,
  type AiActionCenterExplainerDraftAction,
} from "@/services/ai/aiActionCenterExplainer";
import {
  buildAiActionPlanFromActionCenterDraft,
  executeAiActionPlan,
  setAiActionPlanStepApproved,
} from "@/services/ai/aiActionPlan";
import { generateOpenRouterText } from "@/services/ai/aiClient";
import {
  aiActionCenterExplainerCopy,
  aiTrackingQualityCopy,
  aiWorkspaceQaCopy,
} from "@/services/ai/aiConsentCopy";
import {
  buildActionCenterExplainerPrompt,
  buildTrackingQualityPrompt,
  buildWorkspaceQaPrompt,
} from "@/services/ai/aiPromptBuilders";
import { recordAiTelemetryEvent } from "@/services/ai/aiTelemetry";
import {
  buildAiTrackingQualityGenerationPrompt,
  buildAiTrackingQualityReviewItems,
  formatAiTrackingQualityDestinationLabel,
  formatAiTrackingQualitySourceLabel,
  parseAiTrackingQualityDraft,
  type AiTrackingQualityDraft,
  type AiTrackingQualitySource,
} from "@/services/ai/aiTrackingQuality";
import {
  buildAiWorkspaceQaGenerationPrompt,
  buildAiWorkspaceQaReviewItems,
  formatAiWorkspaceQaDestinationLabel,
  formatAiWorkspaceQaSourceLabel,
  parseAiWorkspaceQaDraft,
  type AiWorkspaceQaDraft,
  type AiWorkspaceQaSource,
} from "@/services/ai/aiWorkspaceQa";
import { getReminderScheduleTimestamp } from "@/services/insights/workspaceInsights";
import { buildWorkspaceTrackingQualitySummary } from "@/services/insights/workspaceTrackingQuality";
import { buildReminderActionCenter } from "@/services/reminders/reminderActionCenter";
import type {
  AiActionPlan,
  RecurringPlanScheduleRule,
  WorkspaceRecommendation,
} from "@/types/trackitup";

type GeneratedAiActionCenterDraft = {
  request: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  draft: AiActionCenterExplainerDraft;
};

type GeneratedAiWorkspaceQaDraft = {
  question: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  sources: AiWorkspaceQaSource[];
  draft: AiWorkspaceQaDraft;
};

type GeneratedAiTrackingQualityDraft = {
  request: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  sources: AiTrackingQualitySource[];
  draft: AiTrackingQualityDraft;
};

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSuggestedActionLabel(action: AiActionCenterExplainerActionKind) {
  if (action === "complete-now") return "Complete now";
  if (action === "log-proof") return "Log proof";
  if (action === "snooze") return "Snooze";
  if (action === "open-planner") return "Open planner";
  if (action === "create-log") return "Create log";
  if (action === "create-recurring-plan") return "Create recurring plan";
  if (action === "complete-recurring-now") return "Complete recurring now";
  return "Review later";
}

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildDefaultRecurringTime(now = new Date()) {
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function parseIsoDateTime(value: string | undefined) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
}

function isValidWeekday(value: unknown): value is 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 6
  );
}

type ActionFormValues = AiActionCenterExplainerDraftAction["formValues"];

type ActionCenterSection = "queue" | "assist" | "review";

export default function ActionCenterScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const theme = useTheme<MD3Theme>();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const params = useLocalSearchParams<{
    reminderId?: string;
    recurringOccurrenceId?: string;
    source?: string;
    dictatedRequest?: string;
    autoGenerate?: string;
  }>();
  const focusedReminderId = pickParam(params.reminderId);
  const focusedRecurringOccurrenceId = pickParam(params.recurringOccurrenceId);
  const openedFromNotification = pickParam(params.source) === "notification";
  const dictatedRequest = pickParam(params.dictatedRequest);
  const shouldAutoGenerateFromDictation =
    pickParam(params.autoGenerate) === "1";
  const scrollViewRef = useRef<ScrollView>(null);
  const hasClearedFocusParamsRef = useRef(false);
  const handledDictationRequestRef = useRef<string | null>(null);
  const sectionTransition = useState(() => new Animated.Value(1))[0];
  const {
    bulkSnoozeRecurringOccurrences,
    bulkCompleteRecurringOccurrences,
    completeRecurringOccurrence,
    completeReminder,
    isWorkspaceLocked,
    recommendations,
    skipRecurringOccurrence,
    skipReminder,
    snoozeRecurringOccurrence,
    snoozeReminder,
    saveLogForAction,
    saveRecurringPlan,
    workspace,
  } = useWorkspace();
  const [aiRequest, setAiRequest] = useState("");
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [generatedAiDraft, setGeneratedAiDraft] =
    useState<GeneratedAiActionCenterDraft | null>(null);
  const [pendingAiActionPlan, setPendingAiActionPlan] =
    useState<AiActionPlan | null>(null);
  const [pendingAiActionPlanSourceDraft, setPendingAiActionPlanSourceDraft] =
    useState<GeneratedAiActionCenterDraft | null>(null);
  const [isExecutingAiActionPlan, setIsExecutingAiActionPlan] = useState(false);
  const [aiActionPlanResultMessage, setAiActionPlanResultMessage] = useState<
    string | null
  >(null);
  const [appliedAiDraft, setAppliedAiDraft] =
    useState<GeneratedAiActionCenterDraft | null>(null);
  const [trackingQualityRequest, setTrackingQualityRequest] = useState("");
  const [trackingQualityStatusMessage, setTrackingQualityStatusMessage] =
    useState<string | null>(null);
  const [
    isGeneratingTrackingQualityDraft,
    setIsGeneratingTrackingQualityDraft,
  ] = useState(false);
  const [generatedTrackingQualityDraft, setGeneratedTrackingQualityDraft] =
    useState<GeneratedAiTrackingQualityDraft | null>(null);
  const [appliedTrackingQualityDraft, setAppliedTrackingQualityDraft] =
    useState<GeneratedAiTrackingQualityDraft | null>(null);
  const [workspaceQaQuestion, setWorkspaceQaQuestion] = useState("");
  const [workspaceQaStatusMessage, setWorkspaceQaStatusMessage] = useState<
    string | null
  >(null);
  const [activeSection, setActiveSection] =
    useState<ActionCenterSection>("queue");
  const [focusedTargetY, setFocusedTargetY] = useState<number | null>(null);
  const [selectedRecurringOccurrenceIds, setSelectedRecurringOccurrenceIds] =
    useState<string[]>([]);
  const shouldAnimateSectionTransition = Platform.OS === "ios";
  useEffect(() => {
    if (!shouldAnimateSectionTransition) {
      sectionTransition.setValue(1);
      return;
    }

    sectionTransition.setValue(0);
    Animated.timing(sectionTransition, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [activeSection, sectionTransition, shouldAnimateSectionTransition]);

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

  const [isGeneratingWorkspaceQaDraft, setIsGeneratingWorkspaceQaDraft] =
    useState(false);
  const [generatedWorkspaceQaDraft, setGeneratedWorkspaceQaDraft] =
    useState<GeneratedAiWorkspaceQaDraft | null>(null);
  const [appliedWorkspaceQaDraft, setAppliedWorkspaceQaDraft] =
    useState<GeneratedAiWorkspaceQaDraft | null>(null);
  const actionCenter = useMemo(
    () => buildReminderActionCenter(workspace),
    [workspace],
  );
  const trackingQualitySummary = useMemo(
    () => buildWorkspaceTrackingQualitySummary(workspace),
    [workspace],
  );
  const spacesById = useMemo(
    () => new Map(workspace.spaces.map((space) => [space.id, space] as const)),
    [workspace.spaces],
  );
  const remindersById = useMemo(
    () =>
      new Map(
        workspace.reminders.map((reminder) => [reminder.id, reminder] as const),
      ),
    [workspace.reminders],
  );

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

    router.push("/planner");
  }

  function getSeverityChipColors(
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

  function getReminderStatusColors(status: string) {
    if (status === "overdue") {
      return {
        backgroundColor: theme.colors.errorContainer,
        color: theme.colors.onErrorContainer,
      };
    }

    if (status === "due-today") {
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

  function openReminderLogbook(
    reminderId: string,
    spaceId: string,
    spaceIds?: string[],
  ) {
    router.push({
      pathname: "/logbook",
      params: {
        actionId: "quick-log",
        reminderId,
        spaceId,
        ...(spaceIds?.length ? { spaceIds: spaceIds.join(",") } : {}),
      },
    });
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

  function handleOpenTrackingQualityDestination(
    destination?: AiTrackingQualityDraft["suggestedDestination"],
    source?: Pick<
      AiTrackingQualitySource,
      "actionId" | "spaceId" | "reminderId"
    >,
  ) {
    if (!destination || destination === "action-center") {
      router.push("/action-center" as never);
      return;
    }

    if (destination === "planner") {
      router.push("/planner" as never);
      return;
    }

    if (destination === "workspace-tools") {
      router.push("/workspace-tools" as never);
      return;
    }

    router.push({
      pathname: "/logbook",
      params: {
        ...(source?.actionId ? { actionId: source.actionId } : {}),
        ...(source?.spaceId ? { spaceId: source.spaceId } : {}),
        ...(source?.reminderId ? { reminderId: source.reminderId } : {}),
      },
    });
  }

  function handleOpenTrackingQualitySource(source: AiTrackingQualitySource) {
    handleOpenTrackingQualityDestination(source.route, source);
  }

  function handleOpenWorkspaceQaDestination(
    destination?: AiWorkspaceQaDraft["suggestedDestination"],
  ) {
    if (!destination || destination === "action-center") {
      router.push("/action-center" as never);
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

    if (destination === "logbook") {
      router.push("/logbook" as never);
      return;
    }

    router.push("/workspace-tools" as never);
  }

  function handleOpenWorkspaceQaSource(source: AiWorkspaceQaSource) {
    handleOpenWorkspaceQaDestination(source.route);
  }

  function handleSuggestedAction(options: {
    reminderId?: string;
    recurringOccurrenceId?: string;
    action: AiActionCenterExplainerActionKind;
  }) {
    const reminder = options.reminderId
      ? remindersById.get(options.reminderId)
      : undefined;

    if (options.action === "complete-now") {
      if (!reminder) return;
      completeReminder(reminder.id);
      return;
    }

    if (options.action === "log-proof") {
      if (!reminder) return;
      openReminderLogbook(
        reminder.id,
        reminder.spaceId,
        normalizeSpaceIds(reminder),
      );
      return;
    }

    if (options.action === "snooze") {
      if (!reminder) return;
      snoozeReminder(reminder.id);
      return;
    }

    if (options.action === "create-log") {
      router.push({
        pathname: "/logbook",
        params: {
          actionId: "quick-log",
          ...(reminder?.id ? { reminderId: reminder.id } : {}),
          ...(reminder?.spaceId ? { spaceId: reminder.spaceId } : {}),
          ...(reminder?.spaceIds?.length
            ? { spaceIds: reminder.spaceIds.join(",") }
            : {}),
        },
      });
      return;
    }

    if (options.action === "create-recurring-plan") {
      router.push({
        pathname: "/recurring-plan-editor",
        params: { from: "action-center" },
      });
      return;
    }

    if (options.action === "complete-recurring-now") {
      if (!options.recurringOccurrenceId) return;
      completeRecurringOccurrence(options.recurringOccurrenceId);
      return;
    }

    router.push("/planner");
  }

  const reminderSections = [
    { label: "Overdue now", reminders: actionCenter.overdue },
    { label: "Due today", reminders: actionCenter.dueToday },
    { label: "Coming up", reminders: actionCenter.upcoming.slice(0, 6) },
  ];
  const quickActionReminder =
    actionCenter.overdue[0] ??
    actionCenter.dueToday[0] ??
    actionCenter.upcoming[0];
  const overdueCompletableRecurringIds = actionCenter.recurringOverdue
    .filter((item) => !item.proofRequired)
    .map((item) => item.occurrenceId);

  function toggleRecurringSelection(occurrenceId: string) {
    setSelectedRecurringOccurrenceIds((current) =>
      current.includes(occurrenceId)
        ? current.filter((item) => item !== occurrenceId)
        : [...current, occurrenceId],
    );
  }

  const selectedCompletableRecurringIds = selectedRecurringOccurrenceIds.filter(
    (occurrenceId) => {
      const occurrence =
        actionCenter.recurringOverdue.find(
          (item) => item.occurrenceId === occurrenceId,
        ) ??
        actionCenter.recurringDueToday.find(
          (item) => item.occurrenceId === occurrenceId,
        ) ??
        actionCenter.recurringUpcoming.find(
          (item) => item.occurrenceId === occurrenceId,
        );

      return Boolean(occurrence && !occurrence.proofRequired);
    },
  );
  const visibleRecurringOccurrenceIds = actionCenter.recurringNextBestSteps.map(
    (item) => item.occurrenceId,
  );
  const focusedReminder = focusedReminderId
    ? actionCenter.nextBestSteps.find(
        (item) => item.reminderId === focusedReminderId,
      )
    : undefined;
  const focusedRecurringOccurrence = focusedRecurringOccurrenceId
    ? actionCenter.recurringNextBestSteps.find(
        (item) => item.occurrenceId === focusedRecurringOccurrenceId,
      )
    : undefined;

  useEffect(() => {
    if (!focusedRecurringOccurrenceId) return;

    setSelectedRecurringOccurrenceIds((current) =>
      current.includes(focusedRecurringOccurrenceId)
        ? current
        : [...current, focusedRecurringOccurrenceId],
    );
  }, [focusedRecurringOccurrenceId]);

  useEffect(() => {
    if (!focusedReminderId && !focusedRecurringOccurrenceId) return;
    if (activeSection === "queue") return;
    setActiveSection("queue");
  }, [activeSection, focusedRecurringOccurrenceId, focusedReminderId]);

  useEffect(() => {
    if (!focusedReminderId && !focusedRecurringOccurrenceId) return;
    setFocusedTargetY(null);
  }, [focusedRecurringOccurrenceId, focusedReminderId]);

  useEffect(() => {
    if (focusedReminderId || focusedRecurringOccurrenceId) return;
    hasClearedFocusParamsRef.current = false;
  }, [focusedRecurringOccurrenceId, focusedReminderId]);

  useEffect(() => {
    if (focusedTargetY === null) return;
    if (activeSection !== "queue") return;
    if (!focusedReminderId && !focusedRecurringOccurrenceId) return;

    let clearFocusTimeout: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(
      () => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, focusedTargetY - 120),
          animated: true,
        });

        if (!hasClearedFocusParamsRef.current) {
          hasClearedFocusParamsRef.current = true;
          clearFocusTimeout = setTimeout(
            () => {
              router.replace("/action-center" as never);
            },
            openedFromNotification ? 220 : 120,
          );
        }
      },
      openedFromNotification ? 80 : 40,
    );

    return () => {
      clearTimeout(timeout);
      if (clearFocusTimeout) clearTimeout(clearFocusTimeout);
    };
  }, [
    activeSection,
    focusedRecurringOccurrenceId,
    focusedReminderId,
    focusedTargetY,
    openedFromNotification,
    router,
  ]);

  const areAllVisibleRecurringSelected =
    visibleRecurringOccurrenceIds.length > 0 &&
    visibleRecurringOccurrenceIds.every((occurrenceId) =>
      selectedRecurringOccurrenceIds.includes(occurrenceId),
    );
  const pageQuickActions = [
    {
      id: "action-center-planner",
      label: "Open planner",
      hint: `${actionCenter.summary.recurringOverdueCount + actionCenter.summary.overdueCount} overdue • ${actionCenter.summary.recurringDueTodayCount + actionCenter.summary.dueTodayCount} due today`,
      onPress: () => router.push("/planner" as never),
      accentColor: palette.tint,
    },
    {
      id: "action-center-proof",
      label: quickActionReminder ? "Log proof" : "Open logbook",
      hint: quickActionReminder
        ? `Capture completion evidence for ${quickActionReminder.title}.`
        : "Jump into the logbook when you need to record proof or context.",
      onPress: () =>
        quickActionReminder
          ? router.push({
              pathname: "/logbook",
              params: {
                actionId: "quick-log",
                spaceId: quickActionReminder.spaceId,
                reminderId: quickActionReminder.id,
                ...(quickActionReminder.spaceIds?.length
                  ? { spaceIds: quickActionReminder.spaceIds.join(",") }
                  : {}),
              },
            })
          : router.push("/logbook" as never),
      accentColor: palette.secondary,
    },
    {
      id: "action-center-inventory",
      label: "Review inventory",
      hint: `${workspace.assets.length} asset${workspace.assets.length === 1 ? "" : "s"} can be tied back to reminder work and recommendations.`,
      onPress: () => router.push("/inventory" as never),
    },
    {
      id: "action-center-recurring-create",
      label: "New recurring plan",
      hint: "Create a recurring routine with due windows, proof policy, and smart matching.",
      onPress: () =>
        router.push({
          pathname: "/recurring-plan-editor",
          params: { from: "action-center" },
        }),
      accentColor: palette.tint,
    },
  ];
  const actionCenterSections = useMemo<
    FeatureSectionItem<ActionCenterSection>[]
  >(
    () => [
      {
        id: "queue" as const,
        label: "Queue",
        icon: {
          ios: "bell.badge.fill",
          android: "notifications_active",
          web: "notifications_active",
        },
        hint: "Priority reminders, grouped workload, and planner buckets",
        meta: `${actionCenter.summary.nextBestStepCount} next step${actionCenter.summary.nextBestStepCount === 1 ? "" : "s"}`,
        badges: [
          `${actionCenter.summary.overdueCount} overdue`,
          `${actionCenter.summary.groupedSpaceCount} space${actionCenter.summary.groupedSpaceCount === 1 ? "" : "s"}`,
        ],
        accentColor: palette.tint,
      },
      {
        id: "assist" as const,
        label: "Assist",
        icon: {
          ios: "brain.head.profile",
          android: "psychology",
          web: "psychology",
        },
        hint: "Action-center explainer, tracking gaps, and grounded Q&A",
        meta: "3 AI assistants ready",
        badges: [
          `${trackingQualitySummary.summary.reminderGapCount} gap${trackingQualitySummary.summary.reminderGapCount === 1 ? "" : "s"}`,
          `${workspace.logs.length} logs`,
        ],
        accentColor: palette.secondary,
      },
      {
        id: "review" as const,
        label: "Review",
        icon: {
          ios: "clock.arrow.circlepath",
          android: "history",
          web: "history",
        },
        hint: "Recommendations and recent reminder activity",
        meta: `${recommendations.length} recommendation${recommendations.length === 1 ? "" : "s"}`,
        badges: [
          `${actionCenter.summary.recentActivityCount} recent`,
          `${workspace.reminders.length} tracked`,
        ],
        accentColor: theme.colors.tertiary,
      },
    ],
    [
      actionCenter.summary.groupedSpaceCount,
      actionCenter.summary.nextBestStepCount,
      actionCenter.summary.overdueCount,
      actionCenter.summary.recentActivityCount,
      palette.secondary,
      palette.tint,
      recommendations.length,
      theme.colors.tertiary,
      trackingQualitySummary.summary.reminderGapCount,
      workspace.logs.length,
      workspace.reminders.length,
    ],
  );

  async function handleGenerateAiDraft(requestOverride?: string) {
    const trimmedRequest = (requestOverride ?? aiRequest).trim();
    if (!trimmedRequest) {
      setAiStatusMessage(
        "Describe what kind of queue explanation or next-step guidance you want before generating an AI explainer.",
      );
      return;
    }

    const promptDraft = buildActionCenterExplainerPrompt({
      workspace,
      userRequest: trimmedRequest,
    });
    setIsGeneratingAiDraft(true);
    void recordAiTelemetryEvent({
      surface: "action-center-explainer",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: promptDraft.system,
      prompt: buildAiActionCenterExplainerGenerationPrompt(promptDraft.prompt),
      temperature: 0.35,
      maxOutputTokens: 950,
    });
    setIsGeneratingAiDraft(false);

    if (result.status !== "success") {
      setGeneratedAiDraft(null);
      setAiStatusMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "action-center-explainer",
        action: "generate-failed",
      });
      return;
    }

    const parsedDraft = parseAiActionCenterExplainerDraft(result.text, {
      reminders: workspace.reminders.map((reminder) => ({
        id: reminder.id,
        title: reminder.title,
      })),
      recurringOccurrences: actionCenter.recurringNextBestSteps.map((item) => ({
        id: item.occurrenceId,
        title: item.title,
        planId: item.planId,
      })),
    });
    if (!parsedDraft) {
      setGeneratedAiDraft(null);
      setAiStatusMessage(
        "TrackItUp received an AI response but could not turn it into a reviewable action-center explainer. Try asking for a shorter, more specific explanation.",
      );
      void recordAiTelemetryEvent({
        surface: "action-center-explainer",
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
      "Generated an AI action-center explainer. Review it carefully before applying it to the queue.",
    );
    void recordAiTelemetryEvent({
      surface: "action-center-explainer",
      action: "generate-succeeded",
    });
  }

  useEffect(() => {
    if (!dictatedRequest) return;
    if (handledDictationRequestRef.current === dictatedRequest) return;

    handledDictationRequestRef.current = dictatedRequest;
    setAiRequest(dictatedRequest);
    setActiveSection("assist");
    setAiStatusMessage(
      "Voice transcript loaded. Review the prompt, then generate or approve the plan.",
    );

    if (shouldAutoGenerateFromDictation) {
      void handleGenerateAiDraft(dictatedRequest);
    }
  }, [dictatedRequest, shouldAutoGenerateFromDictation]);

  function handleApplyAiDraft() {
    if (!generatedAiDraft) return;
    const actionPlan = buildAiActionPlanFromActionCenterDraft({
      draft: generatedAiDraft.draft,
      request: generatedAiDraft.request,
      consentLabel: generatedAiDraft.consentLabel,
      modelId: generatedAiDraft.modelId,
      usage: generatedAiDraft.usage,
      workspace,
    });

    setPendingAiActionPlan(actionPlan);
    setPendingAiActionPlanSourceDraft(generatedAiDraft);
    setAiActionPlanResultMessage(null);
    setGeneratedAiDraft(null);
    setAiStatusMessage(
      "Generated a transparent action plan. Approve or deselect each step before execution.",
    );
    void recordAiTelemetryEvent({
      surface: "action-center-explainer",
      action: "action-plan-created",
    });
  }

  function handleToggleAiActionPlanStepApproval(
    stepId: string,
    approved: boolean,
  ) {
    setPendingAiActionPlan((current) => {
      if (!current) return current;
      return setAiActionPlanStepApproved(current, stepId, approved);
    });
  }

  function handleRejectAiActionPlan() {
    setPendingAiActionPlan(null);
    setPendingAiActionPlanSourceDraft(null);
    setAiActionPlanResultMessage(null);
    setAiStatusMessage(
      "Action plan rejected. No reminder or navigation actions were executed.",
    );
    void recordAiTelemetryEvent({
      surface: "action-center-explainer",
      action: "action-plan-rejected",
    });
  }

  function handleApproveAiActionPlan() {
    if (!pendingAiActionPlan) return;
    if (isWorkspaceLocked) {
      setAiStatusMessage(
        "Workspace is locked. Unlock first, then approve and execute the action plan.",
      );
      return;
    }

    setIsExecutingAiActionPlan(true);
    void recordAiTelemetryEvent({
      surface: "action-center-explainer",
      action: "action-plan-approved",
    });

    const executionResult = executeAiActionPlan(
      pendingAiActionPlan,
      workspace,
      {
        completeReminder,
        snoozeReminder,
        completeRecurringOccurrence,
        openPlanner: () => router.push("/planner" as never),
        createLog: ({
          title,
          reason,
          reminder,
          formValues,
        }: {
          title: string;
          reason: string;
          reminder?: (typeof workspace.reminders)[number];
          formValues?: ActionFormValues;
        }) => {
          const fallbackSpaceId = workspace.spaces[0]?.id;
          const reminderSpaceIds = reminder ? normalizeSpaceIds(reminder) : [];
          const targetSpaceId =
            formValues?.spaceId ??
            reminderSpaceIds[0] ??
            reminder?.spaceId ??
            fallbackSpaceId;
          if (!targetSpaceId) {
            throw new Error("No space is available to save the quick log.");
          }

          const occurredAt =
            parseIsoDateTime(formValues?.occurredAt) ??
            new Date().toISOString();
          const tagValues = formValues?.tags?.filter(Boolean) ?? undefined;
          const assetIds = formValues?.assetIds?.filter(Boolean) ?? undefined;

          const saved = saveLogForAction("quick-log", {
            spaceId: targetSpaceId,
            title: compactText(title || "Action center quick log", 120),
            note: compactText(
              formValues?.note ||
                reason ||
                "Logged from AI action plan execution.",
              280,
            ),
            occurredAt,
            ...(tagValues?.length ? { tags: tagValues } : {}),
            ...(assetIds?.length ? { assetIds } : {}),
            ...(formValues?.reminderId
              ? { reminderId: formValues.reminderId }
              : reminder?.id
                ? { reminderId: reminder.id }
                : {}),
          });

          if (saved.createdCount <= 0) {
            throw new Error("Quick log could not be created from this step.");
          }
        },
        createRecurringPlan: ({
          title,
          reason,
          reminder,
          formValues,
        }: {
          title: string;
          reason: string;
          reminder?: (typeof workspace.reminders)[number];
          formValues?: ActionFormValues;
        }) => {
          const fallbackSpaceId = workspace.spaces[0]?.id;
          const reminderSpaceIds = reminder ? normalizeSpaceIds(reminder) : [];
          const targetSpaceId =
            formValues?.spaceId ??
            reminderSpaceIds[0] ??
            reminder?.spaceId ??
            fallbackSpaceId;

          if (!targetSpaceId) {
            throw new Error(
              "No space is available to create a recurring plan from this step.",
            );
          }

          const now = new Date();
          const startDate =
            parseIsoDateTime(formValues?.startDate) ?? now.toISOString();
          const timezone =
            formValues?.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "UTC";
          const scheduleTimes =
            formValues?.scheduleTimes?.filter((time: string) =>
              /^\d{1,2}:\d{2}$/.test(time),
            ) ?? [];

          const scheduleRule: RecurringPlanScheduleRule =
            formValues?.scheduleType === "every-n-days"
              ? {
                  type: "every-n-days" as const,
                  interval:
                    typeof formValues.interval === "number" &&
                    formValues.interval > 0
                      ? Math.floor(formValues.interval)
                      : 1,
                  times:
                    scheduleTimes.length > 0
                      ? scheduleTimes
                      : [buildDefaultRecurringTime(now)],
                }
              : formValues?.scheduleType === "weekly"
                ? {
                    type: "weekly" as const,
                    daysOfWeek:
                      (formValues.daysOfWeek ?? []).filter(isValidWeekday)
                        .length > 0
                        ? Array.from(
                            new Set(
                              (formValues.daysOfWeek ?? []).filter(
                                isValidWeekday,
                              ),
                            ),
                          )
                        : [now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6],
                    times:
                      scheduleTimes.length > 0
                        ? scheduleTimes
                        : [buildDefaultRecurringTime(now)],
                  }
                : formValues?.scheduleType === "monthly"
                  ? {
                      type: "monthly" as const,
                      ...(typeof formValues.dayOfMonth === "number"
                        ? {
                            dayOfMonth: Math.max(
                              1,
                              Math.min(31, Math.floor(formValues.dayOfMonth)),
                            ),
                          }
                        : formValues?.nthWeekday
                          ? {
                              nthWeekday: {
                                weekday: formValues.nthWeekday.weekday,
                                weekOfMonth: formValues.nthWeekday.weekOfMonth,
                              },
                            }
                          : { dayOfMonth: now.getDate() }),
                      times:
                        scheduleTimes.length > 0
                          ? scheduleTimes
                          : [buildDefaultRecurringTime(now)],
                    }
                  : {
                      type: "daily" as const,
                      times:
                        scheduleTimes.length > 0
                          ? scheduleTimes
                          : [buildDefaultRecurringTime(now)],
                    };

          const recurringDraft = {
            id: `plan-ai-${Date.now()}`,
            title: compactText(title || "AI recurring plan", 100),
            description: compactText(
              formValues?.note ||
                reason ||
                "Created from AI action plan execution.",
              220,
            ),
            spaceId: targetSpaceId,
            spaceIds: [targetSpaceId],
            category: "Action center",
            tags:
              formValues?.tags && formValues.tags.length > 0
                ? [...formValues.tags]
                : ["ai", "action-center"],
            scheduleRule,
            startDate,
            timezone,
            proofRequired: formValues?.proofRequired ?? false,
            smartMatchMode: "prompt" as const,
            status: "active" as const,
            gracePeriodMinutes: 120,
          };

          const result = saveRecurringPlan(recurringDraft);
          if (result.status !== "saved") {
            throw new Error(
              result.message || "Recurring plan could not be created.",
            );
          }
        },
        openReminderLogbook,
      },
    );

    setIsExecutingAiActionPlan(false);
    setPendingAiActionPlan(executionResult.updatedPlan);
    setAppliedAiDraft(pendingAiActionPlanSourceDraft);
    setPendingAiActionPlanSourceDraft(null);
    setAiActionPlanResultMessage(
      `Executed ${executionResult.executedCount} step${executionResult.executedCount === 1 ? "" : "s"}. Skipped ${executionResult.skippedCount}. Failed ${executionResult.failedCount}.`,
    );
    setAiStatusMessage(
      "Action plan executed with full transparency. Review step outcomes before running another plan.",
    );
    void recordAiTelemetryEvent({
      surface: "action-center-explainer",
      action: "action-plan-executed",
    });
  }

  function handleDismissAiDraft() {
    setGeneratedAiDraft(null);
    setAiStatusMessage(
      "Dismissed the AI action-center draft. Your current queue is unchanged.",
    );
  }

  async function handleGenerateTrackingQualityDraft() {
    const trimmedRequest = trackingQualityRequest.trim();
    if (!trimmedRequest) {
      setTrackingQualityStatusMessage(
        "Describe what tracking-quality gap you want explained before generating a brief.",
      );
      return;
    }

    const promptDraft = buildTrackingQualityPrompt({
      workspace,
      userRequest: trimmedRequest,
    });
    setIsGeneratingTrackingQualityDraft(true);
    void recordAiTelemetryEvent({
      surface: "tracking-quality-brief",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: promptDraft.system,
      prompt: buildAiTrackingQualityGenerationPrompt(promptDraft.prompt),
      temperature: 0.2,
      maxOutputTokens: 900,
    });
    setIsGeneratingTrackingQualityDraft(false);

    if (result.status !== "success") {
      setGeneratedTrackingQualityDraft(null);
      setTrackingQualityStatusMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "tracking-quality-brief",
        action: "generate-failed",
      });
      return;
    }

    const parsedDraft = parseAiTrackingQualityDraft(result.text, {
      allowedSourceIds: promptDraft.context.retrievedSources.map(
        (source) => source.id,
      ),
    });
    if (!parsedDraft) {
      setGeneratedTrackingQualityDraft(null);
      setTrackingQualityStatusMessage(
        "TrackItUp received an AI response but could not turn it into a grounded tracking-quality brief. Try asking what should be recorded next for one space, reminder group, or metric set.",
      );
      void recordAiTelemetryEvent({
        surface: "tracking-quality-brief",
        action: "generate-failed",
      });
      return;
    }

    setGeneratedTrackingQualityDraft({
      request: trimmedRequest,
      consentLabel: promptDraft.consentLabel,
      modelId: result.modelId,
      usage: result.usage,
      sources: promptDraft.context.retrievedSources,
      draft: parsedDraft,
    });
    setTrackingQualityStatusMessage(
      "Generated a grounded tracking-quality brief. Review the cited reminders, logs, spaces, and metrics before applying it.",
    );
    void recordAiTelemetryEvent({
      surface: "tracking-quality-brief",
      action: "generate-succeeded",
    });
  }

  function handleApplyTrackingQualityDraft() {
    if (!generatedTrackingQualityDraft) return;
    setAppliedTrackingQualityDraft(generatedTrackingQualityDraft);
    setGeneratedTrackingQualityDraft(null);
    setTrackingQualityStatusMessage(
      "Applied the grounded tracking-quality brief. Use the cited destination before recording anything new.",
    );
    void recordAiTelemetryEvent({
      surface: "tracking-quality-brief",
      action: "draft-applied",
    });
  }

  function handleDismissTrackingQualityDraft() {
    setGeneratedTrackingQualityDraft(null);
    setTrackingQualityStatusMessage(
      "Dismissed the grounded tracking-quality brief. Your workspace is unchanged.",
    );
  }

  async function handleGenerateWorkspaceQaDraft() {
    const trimmedQuestion = workspaceQaQuestion.trim();
    if (!trimmedQuestion) {
      setWorkspaceQaStatusMessage(
        "Ask a specific workspace question before generating a grounded AI answer.",
      );
      return;
    }

    const promptDraft = buildWorkspaceQaPrompt({
      workspace,
      question: trimmedQuestion,
    });
    setIsGeneratingWorkspaceQaDraft(true);
    void recordAiTelemetryEvent({
      surface: "workspace-q-and-a",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: promptDraft.system,
      prompt: buildAiWorkspaceQaGenerationPrompt(promptDraft.prompt),
      temperature: 0.2,
      maxOutputTokens: 950,
    });
    setIsGeneratingWorkspaceQaDraft(false);

    if (result.status !== "success") {
      setGeneratedWorkspaceQaDraft(null);
      setWorkspaceQaStatusMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "workspace-q-and-a",
        action: "generate-failed",
      });
      return;
    }

    const parsedDraft = parseAiWorkspaceQaDraft(result.text, {
      allowedSourceIds: promptDraft.context.retrievedSources.map(
        (source) => source.id,
      ),
    });
    if (!parsedDraft) {
      setGeneratedWorkspaceQaDraft(null);
      setWorkspaceQaStatusMessage(
        "TrackItUp received an AI response but could not turn it into a grounded reviewable answer. Try asking a narrower question that points to a specific asset, reminder, space, or recent log.",
      );
      void recordAiTelemetryEvent({
        surface: "workspace-q-and-a",
        action: "generate-failed",
      });
      return;
    }

    setGeneratedWorkspaceQaDraft({
      question: trimmedQuestion,
      consentLabel: promptDraft.consentLabel,
      modelId: result.modelId,
      usage: result.usage,
      sources: promptDraft.context.retrievedSources,
      draft: parsedDraft,
    });
    setWorkspaceQaStatusMessage(
      "Generated a grounded AI workspace answer. Review the cited sources before applying it.",
    );
    void recordAiTelemetryEvent({
      surface: "workspace-q-and-a",
      action: "generate-succeeded",
    });
  }

  function handleApplyWorkspaceQaDraft() {
    if (!generatedWorkspaceQaDraft) return;
    setAppliedWorkspaceQaDraft(generatedWorkspaceQaDraft);
    setGeneratedWorkspaceQaDraft(null);
    setWorkspaceQaStatusMessage(
      "Applied the grounded workspace answer. Review the cited sources before acting on it.",
    );
    void recordAiTelemetryEvent({
      surface: "workspace-q-and-a",
      action: "draft-applied",
    });
  }

  function handleDismissWorkspaceQaDraft() {
    setGeneratedWorkspaceQaDraft(null);
    setWorkspaceQaStatusMessage(
      "Dismissed the grounded workspace answer draft. Your queue is unchanged.",
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={styles.content}
      scrollEventThrottle={Platform.OS === "web" ? 64 : 32}
      removeClippedSubviews={Platform.OS === "android"}
      nestedScrollEnabled={Platform.OS === "android"}
    >
      <ScreenHero
        palette={palette}
        title="Action center"
        subtitle="See what needs attention right now, work through reminder actions quickly, and review the latest planner activity from one place."
        badges={[
          {
            label: `${actionCenter.summary.overdueCount} overdue`,
            backgroundColor: theme.colors.errorContainer,
            textColor: theme.colors.onErrorContainer,
          },
          {
            label: `${actionCenter.summary.dueTodayCount} due today`,
            backgroundColor: theme.colors.tertiaryContainer,
            textColor: theme.colors.onTertiaryContainer,
          },
          {
            label: `${recommendations.length} recommendations`,
            backgroundColor: theme.colors.surface,
            textColor: theme.colors.onSurface,
          },
        ]}
      />

      <PageQuickActions
        palette={palette}
        title="Handle the next best move"
        description="These shortcuts keep the action center connected to planning, proof capture, and the asset context behind the work."
        actions={pageQuickActions}
      />

      <FeatureSectionSwitcher
        palette={palette}
        label="Feature groups"
        title="Focus on one action-center layer at a time"
        description="Switch between the live queue, AI assistance, and review tools so the action center stays easier to scan under pressure."
        items={actionCenterSections}
        activeId={activeSection}
        onChange={setActiveSection}
      />

      <Animated.View style={sectionContentAnimatedStyle}>
        {activeSection === "queue" ? (
          <>
            <SectionSurface
              palette={palette}
              label="Priority queue"
              title="Next best reminder moves"
            >
              {focusedReminder ? (
                <SectionMessage
                  palette={palette}
                  label={openedFromNotification ? "Notification" : "Focus"}
                  title="Focused reminder from alert"
                  message={`${focusedReminder.reminderTitle} • ${focusedReminder.spaceName} • ${formatTimestamp(focusedReminder.dueAt)}`}
                />
              ) : null}
              {actionCenter.nextBestSteps.length === 0 ? (
                <EmptyStateCard
                  palette={palette}
                  icon={{
                    ios: "checkmark.circle",
                    android: "task_alt",
                    web: "task_alt",
                  }}
                  title="The queue is clear right now"
                  message="As open reminders appear, TrackItUp will surface the next best moves here."
                  actionLabel="Open planner"
                  onAction={() => router.push("/planner")}
                />
              ) : (
                actionCenter.nextBestSteps.map((item) => (
                  <Surface
                    key={item.reminderId}
                    onLayout={
                      item.reminderId === focusedReminderId
                        ? (event) =>
                            setFocusedTargetY(event.nativeEvent.layout.y)
                        : undefined
                    }
                    style={[
                      styles.listCard,
                      {
                        backgroundColor: theme.colors.elevation.level1,
                        borderColor:
                          item.reminderId === focusedReminderId
                            ? theme.colors.primary
                            : theme.colors.outlineVariant,
                      },
                    ]}
                    elevation={1}
                  >
                    <View style={styles.listHeader}>
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>
                          {item.reminderTitle}
                        </Text>
                        <Text style={[styles.copy, paletteStyles.mutedText]}>
                          {item.spaceName} • {formatTimestamp(item.dueAt)}
                        </Text>
                        <Text style={[styles.meta, paletteStyles.mutedText]}>
                          {item.reason}
                        </Text>
                      </View>
                      <Chip compact style={styles.infoChip}>
                        {getSuggestedActionLabel(item.suggestedAction)}
                      </Chip>
                    </View>
                    <ActionButtonRow
                      separated
                      separatorColor={theme.colors.outlineVariant}
                      style={styles.actionRow}
                    >
                      <CardActionPill
                        label={getSuggestedActionLabel(item.suggestedAction)}
                        onPress={() =>
                          handleSuggestedAction({
                            reminderId: item.reminderId,
                            action: item.suggestedAction,
                          })
                        }
                      />
                      <CardActionPill
                        label="Open planner"
                        onPress={() => router.push("/planner")}
                      />
                    </ActionButtonRow>
                  </Surface>
                ))
              )}
            </SectionSurface>

            <SectionSurface
              palette={palette}
              label="Today's routine"
              title="Recurring routine occurrences"
            >
              {focusedRecurringOccurrence ? (
                <SectionMessage
                  palette={palette}
                  label={openedFromNotification ? "Notification" : "Focus"}
                  title="Focused routine from alert"
                  message={`${focusedRecurringOccurrence.title} • ${focusedRecurringOccurrence.spaceName} • ${formatTimestamp(focusedRecurringOccurrence.dueAt)}`}
                />
              ) : null}
              <Text style={[styles.copy, paletteStyles.mutedText]}>
                Select routine cards with the checkbox to run bulk actions.
                Proof-required items stay selectable for bulk snooze but are
                excluded from bulk complete.
              </Text>
              {visibleRecurringOccurrenceIds.length > 0 ? (
                <ActionButtonRow
                  separated
                  separatorColor={theme.colors.outlineVariant}
                  style={styles.actionRow}
                >
                  <CardActionPill
                    label={
                      areAllVisibleRecurringSelected
                        ? "Clear visible selection"
                        : `Select visible (${visibleRecurringOccurrenceIds.length})`
                    }
                    onPress={() => {
                      setSelectedRecurringOccurrenceIds((current) =>
                        areAllVisibleRecurringSelected
                          ? current.filter(
                              (item) =>
                                !visibleRecurringOccurrenceIds.includes(item),
                            )
                          : Array.from(
                              new Set([
                                ...current,
                                ...visibleRecurringOccurrenceIds,
                              ]),
                            ),
                      );
                    }}
                  />
                  <CardActionPill
                    label="Clear all selection"
                    onPress={() => setSelectedRecurringOccurrenceIds([])}
                    disabled={selectedRecurringOccurrenceIds.length === 0}
                  />
                </ActionButtonRow>
              ) : null}
              {actionCenter.recurringNextBestSteps.length === 0 ? (
                <EmptyStateCard
                  palette={palette}
                  icon={{
                    ios: "repeat.circle",
                    android: "repeat",
                    web: "repeat",
                  }}
                  title="No routine occurrences in the queue"
                  message="Recurring plans will surface here once due windows open."
                />
              ) : (
                actionCenter.recurringNextBestSteps.map((item) => {
                  const occurrence =
                    actionCenter.recurringOverdue.find(
                      (entry) => entry.occurrenceId === item.occurrenceId,
                    ) ??
                    actionCenter.recurringDueToday.find(
                      (entry) => entry.occurrenceId === item.occurrenceId,
                    ) ??
                    actionCenter.recurringUpcoming.find(
                      (entry) => entry.occurrenceId === item.occurrenceId,
                    );

                  if (!occurrence) return null;

                  return (
                    <Surface
                      key={item.occurrenceId}
                      onLayout={
                        item.occurrenceId === focusedRecurringOccurrenceId
                          ? (event) =>
                              setFocusedTargetY(event.nativeEvent.layout.y)
                          : undefined
                      }
                      style={[
                        styles.listCard,
                        {
                          backgroundColor: theme.colors.elevation.level1,
                          borderColor:
                            item.occurrenceId === focusedRecurringOccurrenceId
                              ? theme.colors.primary
                              : theme.colors.outlineVariant,
                        },
                      ]}
                      elevation={1}
                    >
                      <View style={styles.listHeader}>
                        <Checkbox
                          status={
                            selectedRecurringOccurrenceIds.includes(
                              item.occurrenceId,
                            )
                              ? "checked"
                              : "unchecked"
                          }
                          onPress={() =>
                            toggleRecurringSelection(item.occurrenceId)
                          }
                        />
                        <View style={styles.listCopy}>
                          <Text style={styles.listTitle}>{item.title}</Text>
                          <Text style={[styles.copy, paletteStyles.mutedText]}>
                            {item.spaceName} • {formatTimestamp(item.dueAt)}
                          </Text>
                          <Text style={[styles.meta, paletteStyles.mutedText]}>
                            {item.reason}
                          </Text>
                        </View>
                        <Chip compact style={styles.infoChip}>
                          {occurrence.proofRequired ? "Proof" : "Routine"}
                        </Chip>
                      </View>
                      <ActionButtonRow
                        separated
                        separatorColor={theme.colors.outlineVariant}
                        style={styles.actionRow}
                      >
                        <CardActionPill
                          label={
                            occurrence.proofRequired ? "Log proof" : "Complete"
                          }
                          onPress={() =>
                            occurrence.proofRequired
                              ? openRecurringOccurrenceLogbook(
                                  occurrence.occurrenceId,
                                  occurrence.planId,
                                  occurrence.spaceId,
                                  occurrence.spaceIds,
                                )
                              : completeRecurringOccurrence(
                                  occurrence.occurrenceId,
                                )
                          }
                        />
                        <CardActionPill
                          label="Snooze"
                          onPress={() =>
                            snoozeRecurringOccurrence(occurrence.occurrenceId)
                          }
                        />
                        <CardActionPill
                          label="Skip"
                          onPress={() =>
                            skipRecurringOccurrence(occurrence.occurrenceId)
                          }
                        />
                        <CardActionPill
                          label="Duplicate"
                          onPress={() =>
                            router.push({
                              pathname: "/recurring-plan-editor",
                              params: {
                                duplicateFromPlanId: occurrence.planId,
                                from: "action-center",
                              },
                            })
                          }
                        />
                        <CardActionPill
                          label="History"
                          onPress={() =>
                            router.push({
                              pathname: "/recurring-history",
                              params: {
                                planId: occurrence.planId,
                              },
                            })
                          }
                        />
                      </ActionButtonRow>
                    </Surface>
                  );
                })
              )}
              {overdueCompletableRecurringIds.length > 1 ? (
                <ActionButtonRow
                  separated
                  separatorColor={theme.colors.outlineVariant}
                  style={styles.actionRow}
                >
                  <CardActionPill
                    label={`Complete ${overdueCompletableRecurringIds.length} overdue`}
                    onPress={() =>
                      bulkCompleteRecurringOccurrences(
                        overdueCompletableRecurringIds,
                      )
                    }
                  />
                </ActionButtonRow>
              ) : null}
              {selectedRecurringOccurrenceIds.length > 0 ? (
                <ActionButtonRow
                  separated
                  separatorColor={theme.colors.outlineVariant}
                  style={styles.actionRow}
                >
                  <CardActionPill
                    label={`Complete selected (${selectedCompletableRecurringIds.length})`}
                    onPress={() => {
                      if (selectedCompletableRecurringIds.length === 0) return;
                      bulkCompleteRecurringOccurrences(
                        selectedCompletableRecurringIds,
                      );
                      setSelectedRecurringOccurrenceIds([]);
                    }}
                    disabled={selectedCompletableRecurringIds.length === 0}
                  />
                  <CardActionPill
                    label={`Snooze selected (${selectedRecurringOccurrenceIds.length})`}
                    onPress={() => {
                      bulkSnoozeRecurringOccurrences(
                        selectedRecurringOccurrenceIds,
                      );
                      setSelectedRecurringOccurrenceIds([]);
                    }}
                  />
                </ActionButtonRow>
              ) : null}

              <Text style={[styles.sectionCaption, paletteStyles.mutedText]}>
                Recent recurring activity
              </Text>
              {actionCenter.recurringRecentActivity.length === 0 ? (
                <Text style={[styles.copy, paletteStyles.mutedText]}>
                  No recurring completion activity yet. Complete, snooze, or
                  skip routines to build a trackable history.
                </Text>
              ) : (
                actionCenter.recurringRecentActivity.map((activity) => (
                  <Surface
                    key={activity.id}
                    style={[
                      styles.listCard,
                      {
                        backgroundColor: theme.colors.elevation.level1,
                        borderColor: theme.colors.outlineVariant,
                      },
                    ]}
                    elevation={1}
                  >
                    <View style={styles.listHeader}>
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>
                          {activity.planTitle}
                        </Text>
                        <Text style={[styles.copy, paletteStyles.mutedText]}>
                          {activity.spaceName} • {formatTimestamp(activity.at)}
                        </Text>
                        <Text style={[styles.meta, paletteStyles.mutedText]}>
                          {activity.action} via {activity.actionSource}
                          {typeof activity.completionLatencyMinutes === "number"
                            ? ` • ${activity.completionLatencyMinutes} min vs due`
                            : ""}
                        </Text>
                        {activity.note ? (
                          <Text style={[styles.meta, paletteStyles.mutedText]}>
                            {activity.note}
                          </Text>
                        ) : null}
                      </View>
                      <Chip compact style={styles.infoChip}>
                        {activity.action}
                      </Chip>
                    </View>
                  </Surface>
                ))
              )}
            </SectionSurface>

            <SectionSurface
              palette={palette}
              label="Grouped workload"
              title="Reminder pressure by space"
            >
              {actionCenter.groupedBySpace.length === 0 ? (
                <EmptyStateCard
                  palette={palette}
                  icon={{
                    ios: "square.stack.3d.up",
                    android: "inventory_2",
                    web: "inventory_2",
                  }}
                  title="No grouped workload yet"
                  message="Open reminder groups will appear here once more than one workload bucket is active."
                />
              ) : (
                actionCenter.groupedBySpace.map((group) => (
                  <Surface
                    key={group.spaceId}
                    style={[
                      styles.listCard,
                      {
                        backgroundColor: theme.colors.elevation.level1,
                        borderColor: theme.colors.outlineVariant,
                      },
                    ]}
                    elevation={1}
                  >
                    <View style={styles.listHeader}>
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>{group.spaceName}</Text>
                        <Text style={[styles.copy, paletteStyles.mutedText]}>
                          {group.reminderCount} open reminder
                          {group.reminderCount === 1 ? "" : "s"}
                          {group.nextDueAt
                            ? ` • next ${formatTimestamp(group.nextDueAt)}`
                            : ""}
                        </Text>
                        <Text style={[styles.meta, paletteStyles.mutedText]}>
                          {group.reminderTitles.join(" • ")}
                        </Text>
                      </View>
                    </View>
                    <ChipRow style={styles.chipRow}>
                      <Chip compact style={styles.infoChip}>
                        {group.overdueCount} overdue
                      </Chip>
                      <Chip compact style={styles.infoChip}>
                        {group.dueTodayCount} due today
                      </Chip>
                    </ChipRow>
                  </Surface>
                ))
              )}
            </SectionSurface>
            {reminderSections.map((section) => (
              <SectionSurface
                key={section.label}
                palette={palette}
                label="Planner"
                title={section.label}
              >
                {section.reminders.length === 0 ? (
                  <EmptyStateCard
                    palette={palette}
                    icon={{
                      ios: "calendar.badge.clock",
                      android: "event",
                      web: "event",
                    }}
                    title="Nothing in this bucket right now"
                    message="This reminder lane will fill automatically as due, scheduled, and snoozed tasks change state."
                  />
                ) : (
                  section.reminders.map((reminder) => {
                    const space = spacesById.get(reminder.spaceId);
                    const statusColors = getReminderStatusColors(
                      reminder.status,
                    );
                    return (
                      <Surface
                        key={reminder.id}
                        style={[
                          styles.listCard,
                          {
                            backgroundColor: theme.colors.elevation.level1,
                            borderColor: theme.colors.outlineVariant,
                          },
                        ]}
                        elevation={1}
                      >
                        <View style={styles.listHeader}>
                          <View style={styles.listCopy}>
                            <Text style={styles.listTitle}>
                              {reminder.title}
                            </Text>
                            <Text
                              style={[styles.copy, paletteStyles.mutedText]}
                            >
                              {space?.name ?? "Unknown space"} •{" "}
                              {formatTimestamp(
                                getReminderScheduleTimestamp(reminder),
                              )}
                            </Text>
                            <Text
                              style={[styles.meta, paletteStyles.mutedText]}
                            >
                              {reminder.description}
                            </Text>
                          </View>
                          <Chip
                            compact
                            style={[
                              styles.statusChip,
                              { backgroundColor: statusColors.backgroundColor },
                            ]}
                            textStyle={[
                              styles.chipText,
                              { color: statusColors.color },
                            ]}
                          >
                            {reminder.status}
                          </Chip>
                        </View>
                        <ActionButtonRow
                          separated
                          separatorColor={theme.colors.outlineVariant}
                          style={styles.actionRow}
                        >
                          <CardActionPill
                            label="Complete"
                            onPress={() => completeReminder(reminder.id)}
                          />
                          <CardActionPill
                            label="Log proof"
                            onPress={() =>
                              openReminderLogbook(
                                reminder.id,
                                reminder.spaceId,
                                normalizeSpaceIds(reminder),
                              )
                            }
                          />
                          <CardActionPill
                            label="Snooze"
                            onPress={() => snoozeReminder(reminder.id)}
                          />
                          <CardActionPill
                            label="Skip"
                            onPress={() => skipReminder(reminder.id)}
                          />
                        </ActionButtonRow>
                      </Surface>
                    );
                  })
                )}
              </SectionSurface>
            ))}
          </>
        ) : null}

        {activeSection === "assist" ? (
          <SectionSurface
            palette={palette}
            label="AI workspace assistant"
            title="Grounded help, only when you need it"
          >
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Keep the live queue front and center, then open one assistant at a
              time for explainers, recording gaps, or workspace Q&A.
            </Text>

            <View style={styles.aiToolsStack}>
              <CollapsibleSectionCard
                title="AI action center"
                description="Explain what matters most in the queue."
                badge={`${actionCenter.summary.overdueCount} overdue`}
                defaultExpanded
              >
                <AiPromptComposerCard
                  palette={palette}
                  label="AI action center"
                  title="Explain what matters most in the queue"
                  value={aiRequest}
                  onChangeText={setAiRequest}
                  onSubmit={() => void handleGenerateAiDraft()}
                  isBusy={isGeneratingAiDraft}
                  contextChips={[
                    `${actionCenter.summary.overdueCount} overdue`,
                    `${actionCenter.summary.groupedSpaceCount} grouped spaces`,
                    `${actionCenter.summary.nextBestStepCount} next steps`,
                  ]}
                  helperText={aiActionCenterExplainerCopy.helperText}
                  consentLabel={aiActionCenterExplainerCopy.consentLabel}
                  footerNote={aiActionCenterExplainerCopy.promptFooterNote}
                  placeholder="Example: Explain what is truly urgent, summarize which spaces are creating the most pressure, and tell me the best next three reminder moves."
                  submitLabel="Generate action-center explainer"
                />

                {aiStatusMessage ? (
                  <SectionMessage
                    palette={palette}
                    label="AI action center"
                    title="Latest explainer status"
                    message={aiStatusMessage}
                  />
                ) : null}

                {generatedAiDraft ? (
                  <AiDraftReviewCard
                    palette={palette}
                    title="Review the AI action-center explainer"
                    draftKindLabel="Action center"
                    summary={`Prompt: ${generatedAiDraft.request}`}
                    consentLabel={generatedAiDraft.consentLabel}
                    footerNote={aiActionCenterExplainerCopy.reviewFooterNote}
                    statusLabel="Draft ready"
                    modelLabel={generatedAiDraft.modelId}
                    usage={generatedAiDraft.usage}
                    contextChips={[
                      `${generatedAiDraft.draft.suggestedActions.length} suggested action${generatedAiDraft.draft.suggestedActions.length === 1 ? "" : "s"}`,
                      `${actionCenter.summary.overdueCount} overdue live`,
                    ]}
                    items={buildAiActionCenterExplainerReviewItems(
                      generatedAiDraft.draft,
                    )}
                    acceptLabel="Apply explainer"
                    editLabel="Dismiss draft"
                    regenerateLabel="Generate again"
                    onAccept={handleApplyAiDraft}
                    onEdit={handleDismissAiDraft}
                    onRegenerate={() => void handleGenerateAiDraft()}
                    isBusy={isGeneratingAiDraft}
                  />
                ) : null}

                {pendingAiActionPlan ? (
                  <AiActionPlanReviewCard
                    palette={palette}
                    plan={pendingAiActionPlan}
                    busy={isExecutingAiActionPlan}
                    onToggleStepApproval={handleToggleAiActionPlanStepApproval}
                    onReject={handleRejectAiActionPlan}
                    onApprove={handleApproveAiActionPlan}
                  />
                ) : null}

                {aiActionPlanResultMessage ? (
                  <SectionMessage
                    palette={palette}
                    label="Action plan"
                    title="Latest execution result"
                    message={aiActionPlanResultMessage}
                  />
                ) : null}

                {appliedAiDraft ? (
                  <SectionSurface
                    palette={palette}
                    label="AI explainer"
                    title={appliedAiDraft.draft.headline}
                    style={styles.nestedSectionSurface}
                  >
                    <ChipRow style={styles.chipRow}>
                      <Chip compact style={styles.infoChip}>
                        {appliedAiDraft.draft.suggestedActions.length} suggested
                        action
                        {appliedAiDraft.draft.suggestedActions.length === 1
                          ? ""
                          : "s"}
                      </Chip>
                      <Chip compact style={styles.infoChip}>
                        {actionCenter.summary.overdueCount} overdue live
                      </Chip>
                    </ChipRow>
                    {appliedAiDraft.draft.summary ? (
                      <Text style={styles.copy}>
                        {appliedAiDraft.draft.summary}
                      </Text>
                    ) : null}
                    {appliedAiDraft.draft.groupedInsights.length > 0 ? (
                      <View style={styles.aiList}>
                        {appliedAiDraft.draft.groupedInsights.map((item) => (
                          <Text key={item} style={styles.historyItem}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {appliedAiDraft.draft.recommendationTakeaways.length > 0 ? (
                      <View style={styles.aiList}>
                        {appliedAiDraft.draft.recommendationTakeaways.map(
                          (item) => (
                            <Text key={item} style={styles.historyItem}>
                              • {item}
                            </Text>
                          ),
                        )}
                      </View>
                    ) : null}
                    {appliedAiDraft.draft.caution ? (
                      <Text style={[styles.meta, paletteStyles.mutedText]}>
                        Caution: {appliedAiDraft.draft.caution}
                      </Text>
                    ) : null}
                    {appliedAiDraft.draft.suggestedActions.map((item) => {
                      const reminder = item.reminderId
                        ? remindersById.get(item.reminderId)
                        : undefined;

                      return (
                        <Surface
                          key={`${item.action}-${item.reminderId ?? "no-reminder"}-${item.recurringOccurrenceId ?? "no-occurrence"}-${item.title}`}
                          style={[
                            styles.listCard,
                            styles.aiActionCard,
                            {
                              backgroundColor: theme.colors.elevation.level1,
                              borderColor: theme.colors.outlineVariant,
                            },
                          ]}
                          elevation={1}
                        >
                          <View style={styles.listHeader}>
                            <View style={styles.listCopy}>
                              <Text style={styles.listTitle}>{item.title}</Text>
                              <Text
                                style={[styles.copy, paletteStyles.mutedText]}
                              >
                                {reminder
                                  ? `${spacesById.get(reminder.spaceId)?.name ?? "Unknown space"} • ${formatTimestamp(
                                      getReminderScheduleTimestamp(reminder),
                                    )}`
                                  : item.recurringOccurrenceId
                                    ? `Recurring occurrence • ${item.recurringOccurrenceId}`
                                    : "Workspace action"}
                              </Text>
                              <Text
                                style={[styles.meta, paletteStyles.mutedText]}
                              >
                                {item.reason}
                              </Text>
                            </View>
                            <Chip compact style={styles.infoChip}>
                              {getSuggestedActionLabel(item.action)}
                            </Chip>
                          </View>
                          <ActionButtonRow
                            separated
                            separatorColor={theme.colors.outlineVariant}
                            style={styles.actionRow}
                          >
                            <CardActionPill
                              label={getSuggestedActionLabel(item.action)}
                              onPress={() =>
                                handleSuggestedAction({
                                  reminderId: item.reminderId,
                                  recurringOccurrenceId:
                                    item.recurringOccurrenceId,
                                  action: item.action,
                                })
                              }
                            />
                            {reminder ? (
                              <CardActionPill
                                label="Log proof"
                                onPress={() =>
                                  openReminderLogbook(
                                    reminder.id,
                                    reminder.spaceId,
                                    normalizeSpaceIds(reminder),
                                  )
                                }
                              />
                            ) : null}
                          </ActionButtonRow>
                        </Surface>
                      );
                    })}
                    <ActionButtonRow
                      separated
                      separatorColor={theme.colors.outlineVariant}
                      style={styles.actionRow}
                    >
                      <CardActionPill
                        label="Clear explainer"
                        onPress={() => setAppliedAiDraft(null)}
                      />
                      <CardActionPill
                        label="Refresh explainer"
                        onPress={() => void handleGenerateAiDraft()}
                        disabled={isGeneratingAiDraft}
                      />
                    </ActionButtonRow>
                  </SectionSurface>
                ) : null}
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="AI tracking quality"
                description="Explain what to record next to improve tracking quality."
                badge={`${trackingQualitySummary.summary.reminderGapCount} reminder gap${trackingQualitySummary.summary.reminderGapCount === 1 ? "" : "s"}`}
              >
                <AiPromptComposerCard
                  palette={palette}
                  label="AI tracking quality"
                  title="Explain what to record next to improve tracking quality"
                  value={trackingQualityRequest}
                  onChangeText={setTrackingQualityRequest}
                  onSubmit={() => void handleGenerateTrackingQualityDraft()}
                  isBusy={isGeneratingTrackingQualityDraft}
                  contextChips={[
                    `${trackingQualitySummary.summary.reminderGapCount} reminder gap${trackingQualitySummary.summary.reminderGapCount === 1 ? "" : "s"}`,
                    `${trackingQualitySummary.summary.metricGapCount} metric gap${trackingQualitySummary.summary.metricGapCount === 1 ? "" : "s"}`,
                    `${trackingQualitySummary.summary.sparseLogCount} sparse log${trackingQualitySummary.summary.sparseLogCount === 1 ? "" : "s"}`,
                  ]}
                  helperText={aiTrackingQualityCopy.helperText}
                  consentLabel={aiTrackingQualityCopy.consentLabel}
                  footerNote={aiTrackingQualityCopy.promptFooterNote}
                  placeholder="Example: Explain which reminders, spaces, or metrics need better recording next, and tell me whether I should jump to planner, logbook, or workspace tools first."
                  submitLabel="Generate tracking-quality brief"
                />

                {trackingQualityStatusMessage ? (
                  <SectionMessage
                    palette={palette}
                    label="AI tracking quality"
                    title="Latest tracking-quality status"
                    message={trackingQualityStatusMessage}
                  />
                ) : null}

                {generatedTrackingQualityDraft ? (
                  <AiDraftReviewCard
                    palette={palette}
                    title="Review the AI tracking-quality brief"
                    draftKindLabel="Tracking quality"
                    summary={`Prompt: ${generatedTrackingQualityDraft.request}`}
                    consentLabel={generatedTrackingQualityDraft.consentLabel}
                    footerNote={aiTrackingQualityCopy.reviewFooterNote}
                    statusLabel="Draft ready"
                    modelLabel={generatedTrackingQualityDraft.modelId}
                    usage={generatedTrackingQualityDraft.usage}
                    contextChips={[
                      `${generatedTrackingQualityDraft.draft.citedSourceIds.length} cited source${generatedTrackingQualityDraft.draft.citedSourceIds.length === 1 ? "" : "s"}`,
                      generatedTrackingQualityDraft.draft.suggestedDestination
                        ? formatAiTrackingQualityDestinationLabel(
                            generatedTrackingQualityDraft.draft
                              .suggestedDestination,
                          )
                        : "No route suggestion",
                    ]}
                    items={buildAiTrackingQualityReviewItems(
                      generatedTrackingQualityDraft.draft,
                      generatedTrackingQualityDraft.sources,
                    )}
                    acceptLabel="Apply brief"
                    editLabel="Dismiss draft"
                    regenerateLabel="Generate again"
                    onAccept={handleApplyTrackingQualityDraft}
                    onEdit={handleDismissTrackingQualityDraft}
                    onRegenerate={() =>
                      void handleGenerateTrackingQualityDraft()
                    }
                    isBusy={isGeneratingTrackingQualityDraft}
                  />
                ) : null}

                {appliedTrackingQualityDraft ? (
                  <SectionSurface
                    palette={palette}
                    label="AI tracking quality"
                    title={appliedTrackingQualityDraft.draft.headline}
                    style={styles.nestedSectionSurface}
                  >
                    <ChipRow style={styles.chipRow}>
                      <Chip compact style={styles.infoChip}>
                        {
                          appliedTrackingQualityDraft.draft.citedSourceIds
                            .length
                        }{" "}
                        cited source
                        {appliedTrackingQualityDraft.draft.citedSourceIds
                          .length === 1
                          ? ""
                          : "s"}
                      </Chip>
                      {appliedTrackingQualityDraft.draft
                        .suggestedDestination ? (
                        <Chip compact style={styles.infoChip}>
                          {formatAiTrackingQualityDestinationLabel(
                            appliedTrackingQualityDraft.draft
                              .suggestedDestination,
                          )}
                        </Chip>
                      ) : null}
                    </ChipRow>
                    {appliedTrackingQualityDraft.draft.summary ? (
                      <Text style={styles.copy}>
                        {appliedTrackingQualityDraft.draft.summary}
                      </Text>
                    ) : null}
                    {appliedTrackingQualityDraft.draft.keyGaps.length > 0 ? (
                      <View style={styles.aiList}>
                        {appliedTrackingQualityDraft.draft.keyGaps.map(
                          (gap) => (
                            <Text key={gap} style={styles.historyItem}>
                              • {gap}
                            </Text>
                          ),
                        )}
                      </View>
                    ) : null}
                    {appliedTrackingQualityDraft.draft.caution ? (
                      <Text style={[styles.meta, paletteStyles.mutedText]}>
                        Caution: {appliedTrackingQualityDraft.draft.caution}
                      </Text>
                    ) : null}
                    {appliedTrackingQualityDraft.sources
                      .filter((source) =>
                        appliedTrackingQualityDraft.draft.citedSourceIds.includes(
                          source.id,
                        ),
                      )
                      .map((source) => (
                        <Surface
                          key={source.id}
                          style={[
                            styles.listCard,
                            styles.aiActionCard,
                            {
                              backgroundColor: theme.colors.elevation.level1,
                              borderColor: theme.colors.outlineVariant,
                            },
                          ]}
                          elevation={1}
                        >
                          <View style={styles.listHeader}>
                            <View style={styles.listCopy}>
                              <Text style={styles.listTitle}>
                                {formatAiTrackingQualitySourceLabel(source)}
                              </Text>
                              <Text
                                style={[styles.meta, paletteStyles.mutedText]}
                              >
                                {source.snippet}
                              </Text>
                            </View>
                          </View>
                          <ActionButtonRow
                            separated
                            separatorColor={theme.colors.outlineVariant}
                            style={styles.actionRow}
                          >
                            <CardActionPill
                              label={formatAiTrackingQualityDestinationLabel(
                                source.route,
                              )}
                              onPress={() =>
                                handleOpenTrackingQualitySource(source)
                              }
                            />
                          </ActionButtonRow>
                        </Surface>
                      ))}
                    <ActionButtonRow
                      separated
                      separatorColor={theme.colors.outlineVariant}
                      style={styles.actionRow}
                    >
                      <CardActionPill
                        label="Clear brief"
                        onPress={() => setAppliedTrackingQualityDraft(null)}
                      />
                      <CardActionPill
                        label={formatAiTrackingQualityDestinationLabel(
                          appliedTrackingQualityDraft.draft
                            .suggestedDestination ?? "action-center",
                        )}
                        onPress={() =>
                          handleOpenTrackingQualityDestination(
                            appliedTrackingQualityDraft.draft
                              .suggestedDestination,
                          )
                        }
                      />
                    </ActionButtonRow>
                  </SectionSurface>
                ) : null}
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                title="AI workspace Q&A"
                description="Ask a grounded question about this workspace."
                badge={`${workspace.logs.length} log${workspace.logs.length === 1 ? "" : "s"}`}
              >
                <AiPromptComposerCard
                  palette={palette}
                  label="AI workspace Q&A"
                  title="Ask a grounded question about this workspace"
                  value={workspaceQaQuestion}
                  onChangeText={setWorkspaceQaQuestion}
                  onSubmit={() => void handleGenerateWorkspaceQaDraft()}
                  isBusy={isGeneratingWorkspaceQaDraft}
                  contextChips={[
                    `${workspace.reminders.length} reminders`,
                    `${workspace.logs.length} logs`,
                    `${recommendations.length} recommendations`,
                  ]}
                  helperText={aiWorkspaceQaCopy.helperText}
                  consentLabel={aiWorkspaceQaCopy.consentLabel}
                  footerNote={aiWorkspaceQaCopy.promptFooterNote}
                  placeholder="Example: What do the current reminders and recent logs suggest I should prioritize for the reef setup this week?"
                  submitLabel="Generate grounded answer"
                />

                {workspaceQaStatusMessage ? (
                  <SectionMessage
                    palette={palette}
                    label="AI workspace Q&A"
                    title="Latest grounded answer status"
                    message={workspaceQaStatusMessage}
                  />
                ) : null}

                {generatedWorkspaceQaDraft ? (
                  <AiDraftReviewCard
                    palette={palette}
                    title="Review the grounded workspace answer"
                    draftKindLabel="Workspace Q&A"
                    summary={`Question: ${generatedWorkspaceQaDraft.question}`}
                    consentLabel={generatedWorkspaceQaDraft.consentLabel}
                    footerNote={aiWorkspaceQaCopy.reviewFooterNote}
                    statusLabel="Draft ready"
                    modelLabel={generatedWorkspaceQaDraft.modelId}
                    usage={generatedWorkspaceQaDraft.usage}
                    contextChips={[
                      `${generatedWorkspaceQaDraft.draft.citedSourceIds.length} source${generatedWorkspaceQaDraft.draft.citedSourceIds.length === 1 ? "" : "s"}`,
                      generatedWorkspaceQaDraft.draft.suggestedDestination
                        ? formatAiWorkspaceQaDestinationLabel(
                            generatedWorkspaceQaDraft.draft
                              .suggestedDestination,
                          )
                        : "No route suggestion",
                    ]}
                    items={buildAiWorkspaceQaReviewItems(
                      generatedWorkspaceQaDraft.draft,
                      generatedWorkspaceQaDraft.sources,
                    )}
                    acceptLabel="Apply answer"
                    editLabel="Dismiss draft"
                    regenerateLabel="Generate again"
                    onAccept={handleApplyWorkspaceQaDraft}
                    onEdit={handleDismissWorkspaceQaDraft}
                    onRegenerate={() => void handleGenerateWorkspaceQaDraft()}
                    isBusy={isGeneratingWorkspaceQaDraft}
                  />
                ) : null}

                {appliedWorkspaceQaDraft ? (
                  <SectionSurface
                    palette={palette}
                    label="AI workspace Q&A"
                    title={appliedWorkspaceQaDraft.draft.headline}
                    style={styles.nestedSectionSurface}
                  >
                    <ChipRow style={styles.chipRow}>
                      <Chip compact style={styles.infoChip}>
                        {appliedWorkspaceQaDraft.draft.citedSourceIds.length}{" "}
                        cited source
                        {appliedWorkspaceQaDraft.draft.citedSourceIds.length ===
                        1
                          ? ""
                          : "s"}
                      </Chip>
                      {appliedWorkspaceQaDraft.draft.suggestedDestination ? (
                        <Chip compact style={styles.infoChip}>
                          {formatAiWorkspaceQaDestinationLabel(
                            appliedWorkspaceQaDraft.draft.suggestedDestination,
                          )}
                        </Chip>
                      ) : null}
                    </ChipRow>
                    {appliedWorkspaceQaDraft.draft.answer ? (
                      <Text style={styles.copy}>
                        {appliedWorkspaceQaDraft.draft.answer}
                      </Text>
                    ) : null}
                    {appliedWorkspaceQaDraft.draft.keyPoints.length > 0 ? (
                      <View style={styles.aiList}>
                        {appliedWorkspaceQaDraft.draft.keyPoints.map(
                          (point) => (
                            <Text key={point} style={styles.historyItem}>
                              • {point}
                            </Text>
                          ),
                        )}
                      </View>
                    ) : null}
                    {appliedWorkspaceQaDraft.draft.caution ? (
                      <Text style={[styles.meta, paletteStyles.mutedText]}>
                        Caution: {appliedWorkspaceQaDraft.draft.caution}
                      </Text>
                    ) : null}
                    {appliedWorkspaceQaDraft.sources
                      .filter((source) =>
                        appliedWorkspaceQaDraft.draft.citedSourceIds.includes(
                          source.id,
                        ),
                      )
                      .map((source) => (
                        <Surface
                          key={source.id}
                          style={[
                            styles.listCard,
                            styles.aiActionCard,
                            {
                              backgroundColor: theme.colors.elevation.level1,
                              borderColor: theme.colors.outlineVariant,
                            },
                          ]}
                          elevation={1}
                        >
                          <View style={styles.listHeader}>
                            <View style={styles.listCopy}>
                              <Text style={styles.listTitle}>
                                {formatAiWorkspaceQaSourceLabel(source)}
                              </Text>
                              <Text
                                style={[styles.meta, paletteStyles.mutedText]}
                              >
                                {source.snippet}
                              </Text>
                            </View>
                          </View>
                          <ActionButtonRow
                            separated
                            separatorColor={theme.colors.outlineVariant}
                            style={styles.actionRow}
                          >
                            <CardActionPill
                              label={formatAiWorkspaceQaDestinationLabel(
                                source.route,
                              )}
                              onPress={() =>
                                handleOpenWorkspaceQaSource(source)
                              }
                            />
                          </ActionButtonRow>
                        </Surface>
                      ))}
                    <ActionButtonRow
                      separated
                      separatorColor={theme.colors.outlineVariant}
                      style={styles.actionRow}
                    >
                      <CardActionPill
                        label="Clear answer"
                        onPress={() => setAppliedWorkspaceQaDraft(null)}
                      />
                      <CardActionPill
                        label={formatAiWorkspaceQaDestinationLabel(
                          appliedWorkspaceQaDraft.draft.suggestedDestination ??
                            "action-center",
                        )}
                        onPress={() =>
                          handleOpenWorkspaceQaDestination(
                            appliedWorkspaceQaDraft.draft.suggestedDestination,
                          )
                        }
                      />
                    </ActionButtonRow>
                  </SectionSurface>
                ) : null}
              </CollapsibleSectionCard>
            </View>
          </SectionSurface>
        ) : null}

        {activeSection === "review" ? (
          <>
            <SectionSurface
              palette={palette}
              label="Next best actions"
              title="Recommendations"
            >
              {recommendations.length === 0 ? (
                <EmptyStateCard
                  palette={palette}
                  icon={{
                    ios: "sparkles",
                    android: "auto_awesome",
                    web: "auto_awesome",
                  }}
                  title="Recommendations are still warming up"
                  message="They will appear here once your reminders, logs, and tracked metrics create enough history."
                />
              ) : (
                recommendations.map((recommendation) => {
                  const severityColors = getSeverityChipColors(
                    recommendation.severity,
                  );

                  return (
                    <Surface
                      key={recommendation.id}
                      style={[
                        styles.listCard,
                        {
                          backgroundColor: theme.colors.elevation.level1,
                          borderColor: theme.colors.outlineVariant,
                        },
                      ]}
                      elevation={1}
                    >
                      <View style={styles.listHeader}>
                        <View style={styles.listCopy}>
                          <Text style={styles.listTitle}>
                            {recommendation.title}
                          </Text>
                          <Text style={[styles.copy, paletteStyles.mutedText]}>
                            {recommendation.explanation}
                          </Text>
                        </View>
                        <Chip
                          compact
                          style={[
                            styles.severityChip,
                            { backgroundColor: severityColors.backgroundColor },
                          ]}
                          textStyle={[
                            styles.chipText,
                            { color: severityColors.color },
                          ]}
                        >
                          {recommendation.severity}
                        </Chip>
                      </View>
                      <ActionButtonRow
                        separated
                        separatorColor={theme.colors.outlineVariant}
                        style={styles.actionRow}
                      >
                        <CardActionPill
                          label={recommendation.action.label}
                          onPress={() => openRecommendation(recommendation)}
                        />
                      </ActionButtonRow>
                    </Surface>
                  );
                })
              )}
            </SectionSurface>

            <SectionSurface
              palette={palette}
              label="Recent history"
              title="Reminder activity"
            >
              {actionCenter.recentActivity.length === 0 ? (
                <EmptyStateCard
                  palette={palette}
                  icon={{
                    ios: "clock.arrow.circlepath",
                    android: "history",
                    web: "history",
                  }}
                  title="No recent reminder activity yet"
                  message="Completed, snoozed, and skipped reminder actions will appear here once you start working through the queue."
                  actionLabel="Open planner"
                  onAction={() => router.push("/planner")}
                />
              ) : (
                actionCenter.recentActivity.map((item) => (
                  <Surface
                    key={item.id}
                    style={[
                      styles.activityRow,
                      {
                        backgroundColor: theme.colors.elevation.level1,
                        borderColor: theme.colors.outlineVariant,
                      },
                    ]}
                    elevation={1}
                  >
                    <View style={styles.listCopy}>
                      <Text style={styles.listTitle}>{item.reminderTitle}</Text>
                      <Text style={[styles.copy, paletteStyles.mutedText]}>
                        {item.action} • {formatTimestamp(item.at)}
                      </Text>
                      <Text style={[styles.meta, paletteStyles.mutedText]}>
                        {item.note}
                      </Text>
                    </View>
                  </Surface>
                ))
              )}
              <ChipRow style={styles.chipRow}>
                <Chip
                  compact
                  style={[
                    styles.infoChip,
                    { backgroundColor: theme.colors.secondaryContainer },
                  ]}
                  textStyle={[
                    styles.chipText,
                    { color: theme.colors.onSecondaryContainer },
                  ]}
                >
                  {actionCenter.summary.recentActivityCount} recent actions
                </Chip>
                <Chip
                  compact
                  style={[
                    styles.infoChip,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                  textStyle={[
                    styles.chipText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {workspace.reminders.length} reminders tracked
                </Chip>
              </ChipRow>
              <ActionButtonRow
                separated
                separatorColor={theme.colors.outlineVariant}
                style={styles.actionRow}
              >
                <CardActionPill
                  label="Open planner"
                  onPress={() => router.push("/planner")}
                />
                <CardActionPill
                  label="Open logbook"
                  onPress={() => router.push("/logbook")}
                />
              </ActionButtonRow>
            </SectionSurface>
          </>
        ) : null}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  copy: { ...uiTypography.body },
  sectionCaption: { ...uiTypography.label, marginTop: uiSpace.md },
  meta: { ...uiTypography.label, marginTop: uiSpace.xxs, lineHeight: 18 },
  listCard: {
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    borderWidth: uiBorder.standard,
    marginBottom: uiSpace.lg,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: uiSpace.lg,
  },
  listCopy: { flex: 1, gap: uiSpace.xs },
  listTitle: { ...uiTypography.titleMd },
  actionRow: { marginTop: uiSpace.lg },
  chipText: uiTypography.chip,
  severityChip: { borderRadius: uiRadius.pill },
  statusChip: { borderRadius: uiRadius.pill },
  aiList: { marginTop: uiSpace.md, gap: uiSpace.xs },
  aiToolsStack: { marginTop: uiSpace.lg, gap: uiSpace.md },
  aiActionCard: { marginTop: uiSpace.md, marginBottom: 0 },
  nestedSectionSurface: { marginBottom: 0 },
  activityRow: {
    borderRadius: uiRadius.xl,
    borderWidth: uiBorder.standard,
    padding: uiSpace.lg,
    marginBottom: uiSpace.md,
  },
  historyItem: { ...uiTypography.body },
  chipRow: { marginTop: uiSpace.md, marginBottom: uiSpace.xs },
  infoChip: { borderRadius: uiRadius.pill },
});
