import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  Portal,
  Surface,
  TextInput,
  useTheme,
  type MD3Theme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DynamicFormRenderer } from "@/components/DynamicFormRenderer";
import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { AiDraftReviewCard } from "@/components/ui/AiDraftReviewCard";
import { AiPromptComposerCard } from "@/components/ui/AiPromptComposerCard";
import { WorkspacePageSkeleton } from "@/components/ui/LoadingSkeleton";
import { MotionView } from "@/components/ui/Motion";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SwipeActionCard } from "@/components/ui/SwipeActionCard";
import { useColorScheme } from "@/components/useColorScheme";
import Colors, { getReadableTextColor } from "@/constants/Colors";
import {
  getLogKindFormTemplate,
  getQuickActionFormTemplate,
} from "@/constants/TrackItUpFormTemplates";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
  uiBorder,
  uiMotion,
  uiRadius,
  uiSpace,
  uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { generateOpenRouterText } from "@/services/ai/aiClient";
import { aiLogbookDraftCopy } from "@/services/ai/aiConsentCopy";
import {
  buildAiLogbookDraftReviewItems,
  buildAiLogbookGenerationPrompt,
  parseAiLogbookDraft,
  type AiLogbookDraft,
} from "@/services/ai/aiLogbookDraft";
import { buildLogbookDraftPrompt } from "@/services/ai/aiPromptBuilders";
import { recordAiTelemetryEvent } from "@/services/ai/aiTelemetry";
import {
  buildInitialFormValues,
  normalizeFormValues,
  validateFormValues,
  type FormValidationErrors,
  type FormValue,
  type FormValueMap,
} from "@/services/forms/workspaceForm";
import { getLinkedLogEntries } from "@/services/logs/logRelationships";
import type {
  FormFieldDefinition,
  QuickActionKind,
  Reminder,
} from "@/types/trackitup";

type GeneratedAiLogbookDraft = {
  request: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  draft: AiLogbookDraft;
};

type PendingRecurringPromptMatch = {
  occurrenceId: string;
  planId: string;
  logId: string;
  score: number;
  title: string;
};

function buildReminderDraftPatch(reminder: Reminder) {
  const spaceIds = reminder.spaceIds?.length
    ? reminder.spaceIds
    : reminder.spaceId
      ? [reminder.spaceId]
      : [];

  return {
    reminderId: reminder.id,
    spaceId: spaceIds[0] ?? reminder.spaceId,
    spaceIds,
    title: `${reminder.title} completed`,
    note: reminder.description
      ? `Proof captured for reminder completion. ${reminder.description}`
      : "Proof captured for reminder completion.",
  };
}

function buildRecurringDraftPatch(
  occurrenceId: string,
  plan: {
    id: string;
    spaceId: string;
    spaceIds?: string[];
    title: string;
    description?: string;
  },
) {
  const spaceIds = plan.spaceIds?.length
    ? plan.spaceIds
    : plan.spaceId
      ? [plan.spaceId]
      : [];

  return {
    recurringOccurrenceId: occurrenceId,
    recurringPlanId: plan.id,
    spaceId: spaceIds[0] ?? plan.spaceId,
    spaceIds,
    title: `${plan.title} completed`,
    note: plan.description
      ? `Proof captured for recurring routine completion. ${plan.description}`
      : "Proof captured for recurring routine completion.",
  };
}

const actionDescriptions = {
  "quick-log": "Start a flexible event entry using the unified logbook.",
  "metric-entry": "Capture a fresh reading against tracked metrics.",
  "routine-run": "Run a saved workflow with guided steps and reminders.",
};

const logTypeLabels = {
  "metric-reading": "Metric",
  "routine-run": "Routine",
  "asset-update": "Asset",
  reminder: "Reminder",
};

const actionTitles = {
  "quick-log": "Record an event",
  "metric-entry": "Record a metric",
  "routine-run": "Record a routine",
} satisfies Record<QuickActionKind, string>;

const actionStepGuidance = {
  "quick-log": [
    "Confirm the space so related assets and reminders stay relevant.",
    "Use a short title that explains what happened at a glance.",
    "Add notes, photos, or tags only if they help future you.",
  ],
  "metric-entry": [
    "Pick the space first so the metric list narrows automatically.",
    "Enter the fresh reading and verify the unit before saving.",
    "Add an observation only when the number needs extra context.",
  ],
  "routine-run": [
    "Choose the routine that matches the work you just finished.",
    "Check off the completed steps to generate the right linked logs.",
    "Attach notes only for anything unusual or worth repeating later.",
  ],
} satisfies Record<QuickActionKind, string[]>;

const logbookFooterMinHeight = 96;

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseSpaceIdsParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value;
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function formatDateTime(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSafeZone(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `${min} - ${max}`;
  if (min !== undefined) return `≥ ${min}`;
  if (max !== undefined) return `≤ ${max}`;
  return "Not set";
}

function formatCurrency(value?: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value ?? 0);
}

function formatCustomFieldValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatCustomFieldValue(item)).join(" • ");
  }

  if (
    value &&
    typeof value === "object" &&
    "latitude" in value &&
    "longitude" in value &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number"
  ) {
    return `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}`;
  }

  if (
    value &&
    typeof value === "object" &&
    "mediaType" in value &&
    typeof value.mediaType === "string"
  ) {
    return value.mediaType;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return value ? "Captured" : "";
}

function collectFieldIds(fields: FormFieldDefinition[]): string[] {
  return fields.flatMap((field) => [
    field.id,
    ...(Array.isArray(field.children) ? collectFieldIds(field.children) : []),
  ]);
}

function getStringValue(value: FormValue) {
  return typeof value === "string" ? value : "";
}

function getStringListValue(value: FormValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

type RecurringMatchConfidence = "high" | "medium" | "low";

function getRecurringMatchConfidence(score: number): RecurringMatchConfidence {
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function getRecurringMatchConfidenceLabel(
  confidence: RecurringMatchConfidence,
) {
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Medium confidence";
  return "Low confidence";
}

export default function LogbookScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const theme = useTheme<MD3Theme>();
  const insets = useSafeAreaInsets();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const {
    archiveLog,
    completeRecurringOccurrence,
    createRestorePoint,
    isHydrated,
    logEntries,
    persistenceMode,
    resetWorkspace,
    resolveRecurringPromptMatch,
    saveLogForAction,
    saveLogForTemplate,
    updateLog,
    workspace,
  } = useWorkspace();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [aiRequest, setAiRequest] = useState("");
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [generatedAiDraft, setGeneratedAiDraft] =
    useState<GeneratedAiLogbookDraft | null>(null);
  const [pendingRecurringPromptMatches, setPendingRecurringPromptMatches] =
    useState<PendingRecurringPromptMatch[]>([]);
  const [pendingPromptLogId, setPendingPromptLogId] = useState<string | null>(
    null,
  );
  const [isEditLogDialogVisible, setIsEditLogDialogVisible] = useState(false);
  const [isArchiveLogDialogVisible, setIsArchiveLogDialogVisible] =
    useState(false);
  const [editableLogTitle, setEditableLogTitle] = useState("");
  const [editableLogNote, setEditableLogNote] = useState("");
  const [editableLogTags, setEditableLogTags] = useState("");
  const [formValues, setFormValues] = useState<FormValueMap>({});
  const [formErrors, setFormErrors] = useState<FormValidationErrors>({});
  const params = useLocalSearchParams<{
    actionId?: string;
    createdSpaceName?: string;
    entryId?: string;
    recurringOccurrenceId?: string;
    recurringPlanId?: string;
    reminderId?: string;
    spaceId?: string;
    spaceIds?: string;
    templateId?: string;
  }>();

  const actionId = pickParam(params.actionId);
  const createdSpaceName = pickParam(params.createdSpaceName);
  const entryId = pickParam(params.entryId);
  const recurringOccurrenceId = pickParam(params.recurringOccurrenceId);
  const recurringPlanId = pickParam(params.recurringPlanId);
  const initialReminderId = pickParam(params.reminderId);
  const initialSpaceId = pickParam(params.spaceId);
  const initialSpaceIds = parseSpaceIdsParam(params.spaceIds);
  const templateId = pickParam(params.templateId);

  const action = workspace.quickActions.find((item) => item.id === actionId);
  const entry = logEntries.find((item) => item.id === entryId);
  const selectedTemplate = workspace.templates.find(
    (item) => item.id === templateId,
  );
  const { parentEntry, childEntries } = useMemo(
    () => getLinkedLogEntries(logEntries, entry),
    [entry, logEntries],
  );
  const entrySpace = entry
    ? workspace.spaces.find((space) => space.id === entry.spaceId)
    : undefined;

  const relatedAssets = entry
    ? workspace.assets.filter((asset) => entry.assetIds?.includes(asset.id))
    : [];
  const relatedRoutine = entry?.routineId
    ? workspace.routines.find((routine) => routine.id === entry.routineId)
    : undefined;
  const relatedReminder = entry?.reminderId
    ? workspace.reminders.find((reminder) => reminder.id === entry.reminderId)
    : undefined;
  const photoAttachments =
    entry?.attachments?.filter(
      (attachment) => attachment.mediaType === "photo",
    ) ?? [];
  const relatedMetrics =
    entry?.metricReadings?.map((reading) => ({
      reading,
      definition: workspace.metricDefinitions.find(
        (metric) => metric.id === reading.metricId,
      ),
    })) ?? [];

  const linkedSpace = action?.spaceId
    ? workspace.spaces.find((space) => space.id === action.spaceId)
    : undefined;
  const activeQuickActionKind =
    action?.kind ?? selectedTemplate?.formTemplate?.quickActionKind;
  const suggestedSpaces = linkedSpace
    ? [linkedSpace]
    : workspace.spaces.slice(0, 3);
  const suggestedMetrics = workspace.metricDefinitions.filter(
    (metric) => !linkedSpace || metric.spaceId === linkedSpace.id,
  );
  const suggestedRoutines = workspace.routines.filter(
    (routine) => !linkedSpace || routine.spaceId === linkedSpace.id,
  );
  const suggestedReminders = workspace.reminders.filter(
    (reminder) =>
      (reminder.status === "due" || reminder.status === "scheduled") &&
      (!linkedSpace || reminder.spaceId === linkedSpace.id),
  );
  const initialReminder = initialReminderId
    ? workspace.reminders.find((reminder) => reminder.id === initialReminderId)
    : undefined;
  const initialRecurringOccurrence = recurringOccurrenceId
    ? workspace.recurringOccurrences.find(
        (occurrence) => occurrence.id === recurringOccurrenceId,
      )
    : undefined;
  const initialRecurringPlan = recurringPlanId
    ? workspace.recurringPlans.find((plan) => plan.id === recurringPlanId)
    : initialRecurringOccurrence
      ? workspace.recurringPlans.find(
          (plan) => plan.id === initialRecurringOccurrence.planId,
        )
      : undefined;

  const activeTemplate = action
    ? getQuickActionFormTemplate(action.kind)
    : entry
      ? getLogKindFormTemplate(entry.kind)
      : selectedTemplate?.formTemplate;

  const initialFormValues = useMemo(() => {
    if (!activeTemplate) return {};

    const values = buildInitialFormValues(activeTemplate, workspace, {
      action,
      entry,
    });

    return normalizeFormValues(
      activeTemplate,
      workspace,
      {
        ...values,
        ...(!entry &&
        (initialSpaceIds.length > 0 || initialSpaceId) &&
        workspace.spaces.some((space) =>
          (initialSpaceIds.length > 0
            ? initialSpaceIds
            : [initialSpaceId]
          ).includes(space.id),
        )
          ? {
              spaceIds:
                initialSpaceIds.length > 0
                  ? initialSpaceIds
                  : initialSpaceId
                    ? [initialSpaceId]
                    : [],
              ...(initialSpaceId ? { spaceId: initialSpaceId } : {}),
            }
          : {}),
        ...(!entry && initialReminder
          ? buildReminderDraftPatch(initialReminder)
          : {}),
        ...(!entry && initialRecurringOccurrence && initialRecurringPlan
          ? buildRecurringDraftPatch(
              initialRecurringOccurrence.id,
              initialRecurringPlan,
            )
          : {}),
      },
      { action, entry },
    );
  }, [
    activeTemplate,
    action,
    entry,
    initialReminder,
    initialRecurringOccurrence,
    initialRecurringPlan,
    initialSpaceId,
    workspace,
  ]);

  useEffect(() => {
    setFormValues(initialFormValues);
    setFormErrors({});
  }, [initialFormValues]);

  useEffect(() => {
    if (!createdSpaceName || entry) return;

    setFeedbackMessage(
      `Space created — ready to record in ${createdSpaceName}.`,
    );
  }, [createdSpaceName, entry]);

  useEffect(() => {
    if (!entry) {
      setIsEditLogDialogVisible(false);
      setIsArchiveLogDialogVisible(false);
      return;
    }

    setEditableLogTitle(entry.title);
    setEditableLogNote(entry.note);
    setEditableLogTags((entry.tags ?? []).join(", "));
  }, [entry]);

  const screenTitle = entry
    ? "Log detail"
    : action
      ? action.label
      : (selectedTemplate?.name ?? "Logbook");
  const recentEntries = logEntries.slice(0, 3);
  const featuredTemplates = workspace.templates.slice(0, 3);
  const hasSpaces = workspace.spaces.length > 0;
  const selectedSpaceId =
    typeof formValues.spaceId === "string"
      ? formValues.spaceId
      : Array.isArray(formValues.spaceIds)
        ? formValues.spaceIds.find(
            (item): item is string => typeof item === "string",
          )
        : undefined;
  const selectedSpace = selectedSpaceId
    ? workspace.spaces.find((space) => space.id === selectedSpaceId)
    : linkedSpace;
  const selectedMetricId =
    typeof formValues.metricId === "string" ? formValues.metricId : undefined;
  const selectedMetric = selectedMetricId
    ? workspace.metricDefinitions.find(
        (metric) => metric.id === selectedMetricId,
      )
    : undefined;
  const draftProofPhotoCount = Array.isArray(formValues.attachments)
    ? formValues.attachments.filter(
        (attachment) =>
          Boolean(attachment) &&
          typeof attachment === "object" &&
          "mediaType" in attachment &&
          attachment.mediaType === "photo",
      ).length
    : 0;
  const selectedRoutineId =
    typeof formValues.routineId === "string" ? formValues.routineId : undefined;
  const selectedRoutine = selectedRoutineId
    ? workspace.routines.find((routine) => routine.id === selectedRoutineId)
    : undefined;
  const selectedReminderId =
    typeof formValues.reminderId === "string"
      ? formValues.reminderId
      : undefined;
  const selectedReminder = selectedReminderId
    ? workspace.reminders.find((reminder) => reminder.id === selectedReminderId)
    : undefined;
  const selectedAssetIds = getStringListValue(formValues.assetIds);
  const activeTemplateFieldIds = activeTemplate
    ? new Set(
        activeTemplate.sections.flatMap((section) =>
          collectFieldIds(section.fields),
        ),
      )
    : new Set<string>();
  const supportsAiTitle = activeTemplateFieldIds.has("title");
  const supportsAiNote = activeTemplateFieldIds.has("note");
  const supportsAiTags = activeTemplateFieldIds.has("tags");
  const supportsAiDrafting =
    !entry &&
    Boolean(activeTemplate) &&
    (supportsAiTitle || supportsAiNote || supportsAiTags);
  const activeFlowSteps = activeQuickActionKind
    ? actionStepGuidance[activeQuickActionKind]
    : [];
  const showEntryFooter = !entry && Boolean(action || selectedTemplate);
  const saveButtonLabel = action
    ? actionTitles[action.kind]
    : selectedTemplate
      ? "Save template entry"
      : "Save log entry";
  const footerPrimaryLabel = hasSpaces ? saveButtonLabel : "Create first space";
  const persistenceLabel =
    persistenceMode === "watermelondb"
      ? "WatermelonDB workspace active"
      : persistenceMode === "local-storage"
        ? "Local storage snapshot active"
        : persistenceMode === "file-system"
          ? "File-system snapshot active"
          : "Memory snapshot active";

  function handleFormValueChange(fieldId: string, value: FormValue) {
    if (!activeTemplate || entry) return;

    setFormValues((currentValues) =>
      normalizeFormValues(
        activeTemplate,
        workspace,
        {
          ...currentValues,
          [fieldId]: value,
        },
        { action, entry },
      ),
    );
    setFormErrors((currentErrors) => {
      if (!currentErrors[fieldId]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldId];
      return nextErrors;
    });
    setFeedbackMessage(null);
  }

  function handleSelectReminder(reminder: Reminder) {
    if (!activeTemplate || entry) return;

    setFormValues((currentValues) =>
      normalizeFormValues(
        activeTemplate,
        workspace,
        {
          ...currentValues,
          ...buildReminderDraftPatch(reminder),
          title:
            typeof currentValues.title === "string" &&
            currentValues.title.trim().length > 0
              ? currentValues.title
              : buildReminderDraftPatch(reminder).title,
          note:
            typeof currentValues.note === "string" &&
            currentValues.note.trim().length > 0
              ? currentValues.note
              : buildReminderDraftPatch(reminder).note,
        },
        { action, entry },
      ),
    );
    setFeedbackMessage(`Ready to capture proof for ${reminder.title}.`);
  }

  async function handleGenerateAiDraft() {
    if (!activeTemplate || entry) return;

    const trimmedRequest = aiRequest.trim();
    if (!trimmedRequest) {
      setFeedbackMessage(
        "Describe how you want the log entry rewritten before generating a draft.",
      );
      return;
    }

    setIsGeneratingAiDraft(true);
    const promptDraft = buildLogbookDraftPrompt({
      workspace,
      userRequest: trimmedRequest,
      draftTitle: getStringValue(formValues.title),
      draftNote: getStringValue(formValues.note),
      spaceId: selectedSpaceId,
      assetIds: selectedAssetIds,
      reminderId: selectedReminderId,
      routineId: selectedRoutineId,
    });
    void recordAiTelemetryEvent({
      surface: "logbook-draft",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: promptDraft.system,
      prompt: buildAiLogbookGenerationPrompt(promptDraft.prompt, {
        allowTitle: supportsAiTitle,
        allowTags: supportsAiTags,
      }),
      temperature: 0.35,
      maxOutputTokens: 900,
    });
    setIsGeneratingAiDraft(false);

    if (result.status !== "success") {
      setGeneratedAiDraft(null);
      setFeedbackMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "logbook-draft",
        action: "generate-failed",
      });
      return;
    }

    const parsedDraft = parseAiLogbookDraft(result.text, {
      allowTitle: supportsAiTitle,
      allowTags: supportsAiTags,
    });

    if (!parsedDraft) {
      setGeneratedAiDraft(null);
      setFeedbackMessage(
        "TrackItUp received an AI response but could not turn it into a reviewable log draft. Try narrowing the request or keeping it closer to the current entry.",
      );
      void recordAiTelemetryEvent({
        surface: "logbook-draft",
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
    setFeedbackMessage(
      "Generated an AI log draft. Review it carefully before applying it to the form.",
    );
    void recordAiTelemetryEvent({
      surface: "logbook-draft",
      action: "generate-succeeded",
    });
  }

  function handleApplyAiDraft() {
    if (!activeTemplate || !generatedAiDraft || entry) return;

    setFormValues((currentValues) =>
      normalizeFormValues(
        activeTemplate,
        workspace,
        {
          ...currentValues,
          ...(supportsAiTitle && generatedAiDraft.draft.title
            ? { title: generatedAiDraft.draft.title }
            : {}),
          ...(supportsAiNote && generatedAiDraft.draft.note
            ? { note: generatedAiDraft.draft.note }
            : {}),
          ...(supportsAiTags && generatedAiDraft.draft.tags
            ? { tags: generatedAiDraft.draft.tags }
            : {}),
        },
        { action, entry },
      ),
    );
    setFormErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors.title;
      delete nextErrors.note;
      delete nextErrors.tags;
      return nextErrors;
    });
    setGeneratedAiDraft(null);
    setFeedbackMessage(
      "Applied the AI writing draft to the form. Review the result and save when you're ready.",
    );
    void recordAiTelemetryEvent({
      surface: "logbook-draft",
      action: "draft-applied",
    });
  }

  function handleDismissAiDraft() {
    setGeneratedAiDraft(null);
    setFeedbackMessage(
      "Dismissed the AI writing draft. Your current log entry form values were left unchanged.",
    );
  }

  function handleSaveEntry() {
    if ((!action && !selectedTemplate) || !activeTemplate) return;
    if (!hasSpaces) {
      setFeedbackMessage("Create a space before recording the first event.");
      return;
    }

    const nextErrors = validateFormValues(activeTemplate, formValues);
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      setFeedbackMessage(
        "Complete the required fields before saving this entry.",
      );
      return;
    }

    const result = action
      ? saveLogForAction(action.id, formValues)
      : selectedTemplate
        ? saveLogForTemplate(selectedTemplate.id, formValues)
        : undefined;
    if (!result?.entryId) {
      setFeedbackMessage("Unable to save the entry right now.");
      return;
    }

    const recurringOccurrenceIdValue =
      (typeof formValues.recurringOccurrenceId === "string"
        ? formValues.recurringOccurrenceId
        : undefined) ?? recurringOccurrenceId;
    if (recurringOccurrenceIdValue) {
      completeRecurringOccurrence(recurringOccurrenceIdValue, {
        logId: result.entryId,
      });
    }

    if ((result.recurringPromptMatches?.length ?? 0) > 0 && result.entryId) {
      setPendingRecurringPromptMatches(result.recurringPromptMatches ?? []);
      setPendingPromptLogId(result.entryId);
      setFeedbackMessage(
        `Saved log entry. ${result.recurringPromptMatches?.length ?? 0} recurring occurrence match suggestion(s) are ready to resolve.`,
      );
      return;
    }

    setFeedbackMessage(
      result.createdCount > 1
        ? `Saved ${result.createdCount} log entries from one routine/template run.${result.scheduledReminderCount ? ` Triggered ${result.scheduledReminderCount} reminder(s).` : ""}${result.recurringAutoLinkedCount ? ` Auto-linked ${result.recurringAutoLinkedCount} recurring occurrence(s).` : ""}${result.recurringPromptMatchCount ? ` ${result.recurringPromptMatchCount} recurring match suggestion(s) need review.` : ""}`
        : `Log entry saved to your workspace.${result.scheduledReminderCount ? ` Triggered ${result.scheduledReminderCount} reminder(s).` : ""}${result.recurringAutoLinkedCount ? ` Auto-linked ${result.recurringAutoLinkedCount} recurring occurrence(s).` : ""}${result.recurringPromptMatchCount ? ` ${result.recurringPromptMatchCount} recurring match suggestion(s) need review.` : ""}`,
    );
    router.replace({
      pathname: "/logbook",
      params: { entryId: result.entryId },
    });
  }

  function resolvePendingRecurringPromptMatch(occurrenceId: string) {
    if (!pendingPromptLogId) return;

    resolveRecurringPromptMatch(occurrenceId, pendingPromptLogId);
    setPendingRecurringPromptMatches((current) =>
      current.filter((item) => item.occurrenceId !== occurrenceId),
    );
    setFeedbackMessage("Resolved recurring occurrence with this saved log.");
  }

  function dismissPendingRecurringPromptMatch(occurrenceId: string) {
    setPendingRecurringPromptMatches((current) =>
      current.filter((item) => item.occurrenceId !== occurrenceId),
    );
  }

  async function handleResetWorkspace() {
    const restorePointResult = await createRestorePoint({
      reason: "before-reset",
      label: "Before workspace reset",
    });
    resetWorkspace();
    setFeedbackMessage(
      restorePointResult.status === "created" ||
        restorePointResult.status === "unavailable"
        ? `${restorePointResult.message} Local workspace data cleared.`
        : "Local workspace data cleared.",
    );

    if (action) {
      router.replace({ pathname: "/logbook", params: { actionId: action.id } });
      return;
    }

    if (selectedTemplate) {
      router.replace({
        pathname: "/logbook",
        params: { templateId: selectedTemplate.id },
      });
      return;
    }

    router.replace({ pathname: "/logbook" });
  }

  function openSpaceCreation() {
    router.push({
      pathname: "/space-create",
      params: {
        ...(actionId ? { actionId } : {}),
        ...(templateId ? { templateId } : {}),
      },
    });
  }

  function handleCancelEntry() {
    router.replace({ pathname: "/logbook" });
  }

  function handleOpenEditLogDialog() {
    if (!entry) return;

    setEditableLogTitle(entry.title);
    setEditableLogNote(entry.note);
    setEditableLogTags((entry.tags ?? []).join(", "));
    setIsEditLogDialogVisible(true);
  }

  function handleSaveLogEdits() {
    if (!entry) return;

    const parsedTags = editableLogTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const result = updateLog(entry.id, {
      title: editableLogTitle,
      note: editableLogNote,
      tags: parsedTags,
    });
    setFeedbackMessage(result.message);

    if (result.status === "updated") {
      setIsEditLogDialogVisible(false);
    }
  }

  function handleArchiveLogEntry() {
    if (!entry) return;

    const result = archiveLog(entry.id);
    setFeedbackMessage(result.message);
    setIsArchiveLogDialogVisible(false);

    if (result.status === "archived") {
      router.replace({ pathname: "/logbook" });
    }
  }

  if (!isHydrated) {
    return (
      <View style={[styles.screen, paletteStyles.screenBackground]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={Platform.OS === "web" ? 64 : 32}
          removeClippedSubviews={Platform.OS === "android"}
        >
          <Stack.Screen options={{ title: screenTitle }} />
          <ScreenHero
            palette={palette}
            title={screenTitle}
            subtitle="TrackItUp is hydrating your workspace snapshot and preparing the next recording flow."
            badges={[
              {
                label: "TrackItUp logbook",
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          showEntryFooter
            ? {
                paddingBottom:
                  uiSpace.screenBottom + insets.bottom + logbookFooterMinHeight,
              }
            : null,
        ]}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={Platform.OS === "web" ? 64 : 32}
        removeClippedSubviews={Platform.OS === "android"}
      >
        <Stack.Screen options={{ title: screenTitle }} />

        <ScreenHero
          palette={palette}
          title={screenTitle}
          subtitle={
            entry
              ? "Review the selected timeline event and its linked tracking context."
              : action
                ? actionDescriptions[action.kind]
                : selectedTemplate
                  ? "Run a saved custom schema and capture the extra fields directly into the workspace logbook."
                  : "Choose a quick action or timeline item to start this flow."
          }
          badges={[
            {
              label: "TrackItUp logbook",
              backgroundColor: theme.colors.primaryContainer,
              textColor: theme.colors.onPrimaryContainer,
            },
            {
              label: entry
                ? "Detail view"
                : action || selectedTemplate
                  ? "New entry"
                  : "Workspace overview",
              backgroundColor: theme.colors.surface,
              textColor: theme.colors.onSurface,
            },
          ]}
        />

        <Surface
          style={[styles.statusCard, paletteStyles.cardSurface]}
          elevation={1}
        >
          <View style={styles.statusHeader}>
            <Text style={styles.sectionTitle}>Workspace persistence</Text>
            <Chip
              compact
              style={[
                styles.statusBadge,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
              textStyle={[
                styles.statusBadgeText,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {isHydrated ? persistenceLabel : "Hydrating snapshot"}
            </Chip>
          </View>
          <Text style={[styles.listCopy, paletteStyles.mutedText]}>
            {logEntries.length} logs and {workspace.spaces.length} spaces are
            currently loaded from the shared workspace store.
          </Text>
          {feedbackMessage ? (
            <Text style={[styles.statusMessage, paletteStyles.tintText]}>
              {feedbackMessage}
            </Text>
          ) : null}
        </Surface>

        {!entry && activeQuickActionKind && hasSpaces ? (
          <Surface
            style={[styles.sectionCard, paletteStyles.cardSurface]}
            elevation={1}
          >
            <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
              Recommended path
            </Text>
            <Text style={styles.sectionTitle}>Start with the essentials</Text>
            <Text style={[styles.templateIntro, paletteStyles.mutedText]}>
              TrackItUp fills in space and time whenever it can. Most entries
              only need the first few fields.
            </Text>
            <View style={styles.heroBadgeRow}>
              {selectedSpace ? (
                <Chip
                  compact
                  style={[
                    styles.heroBadge,
                    { backgroundColor: selectedSpace.themeColor },
                  ]}
                  textStyle={[
                    styles.badgeText,
                    { color: getReadableTextColor(selectedSpace.themeColor) },
                  ]}
                >
                  {selectedSpace.name}
                </Chip>
              ) : null}
              {selectedMetric ? (
                <Chip
                  compact
                  style={[styles.heroBadge, paletteStyles.cardChipSurface]}
                  textStyle={[styles.heroBadgeText, paletteStyles.tintText]}
                >
                  {selectedMetric.name}
                </Chip>
              ) : null}
              {selectedRoutine ? (
                <Chip
                  compact
                  style={[styles.heroBadge, paletteStyles.cardChipSurface]}
                  textStyle={[styles.heroBadgeText, paletteStyles.tintText]}
                >
                  {selectedRoutine.name}
                </Chip>
              ) : null}
            </View>
            {activeFlowSteps.map((step, index) => (
              <View key={step} style={styles.guidanceRow}>
                <View
                  style={[
                    styles.guidanceStep,
                    {
                      backgroundColor: linkedSpace?.themeColor ?? palette.tint,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.guidanceStepText,
                      {
                        color: getReadableTextColor(
                          linkedSpace?.themeColor ?? palette.tint,
                        ),
                      },
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                  {step}
                </Text>
              </View>
            ))}
          </Surface>
        ) : null}

        {supportsAiDrafting && hasSpaces ? (
          <AiPromptComposerCard
            palette={palette}
            label="AI log drafting"
            title="Rewrite the current entry draft"
            value={aiRequest}
            onChangeText={setAiRequest}
            onSubmit={() => void handleGenerateAiDraft()}
            isBusy={isGeneratingAiDraft}
            contextChips={[
              action?.label ??
                selectedTemplate?.name ??
                activeTemplate?.title ??
                "Log draft",
              selectedSpace ? `Space: ${selectedSpace.name}` : "Pick a space",
              selectedReminder ? "Reminder linked" : "Manual entry",
            ]}
            helperText={aiLogbookDraftCopy.helperText}
            consentLabel={aiLogbookDraftCopy.consentLabel}
            footerNote={aiLogbookDraftCopy.promptFooterNote}
            submitLabel="Generate writing draft"
          />
        ) : null}

        {generatedAiDraft ? (
          <AiDraftReviewCard
            palette={palette}
            title="Review the AI log draft"
            draftKindLabel={
              action?.label ??
              selectedTemplate?.name ??
              activeTemplate?.title ??
              "Log draft"
            }
            summary={`Prompt: ${generatedAiDraft.request}`}
            consentLabel={generatedAiDraft.consentLabel}
            footerNote={aiLogbookDraftCopy.reviewFooterNote}
            statusLabel="Draft ready"
            modelLabel={generatedAiDraft.modelId}
            usage={generatedAiDraft.usage}
            contextChips={[
              selectedSpace
                ? `Space: ${selectedSpace.name}`
                : "No space selected",
              selectedReminder ? "Reminder linked" : "No reminder linked",
            ]}
            items={buildAiLogbookDraftReviewItems(generatedAiDraft.draft)}
            acceptLabel="Apply to form"
            editLabel="Dismiss draft"
            regenerateLabel="Generate again"
            onAccept={handleApplyAiDraft}
            onEdit={handleDismissAiDraft}
            onRegenerate={() => void handleGenerateAiDraft()}
            isBusy={isGeneratingAiDraft}
          />
        ) : null}

        {activeTemplate && (entry || hasSpaces) ? (
          <Surface
            style={[styles.sectionCard, paletteStyles.cardSurface]}
            elevation={1}
          >
            <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
              Form
            </Text>
            <Text style={styles.sectionTitle}>{activeTemplate.title}</Text>
            <Text style={[styles.templateIntro, paletteStyles.mutedText]}>
              {activeTemplate.description}
            </Text>
            <DynamicFormRenderer
              template={activeTemplate}
              workspace={workspace}
              values={formValues}
              errors={formErrors}
              palette={palette}
              readOnly={Boolean(entry)}
              action={action}
              entry={entry}
              onChange={handleFormValueChange}
            />
          </Surface>
        ) : null}

        {pendingRecurringPromptMatches.length > 0 ? (
          <Surface
            style={[styles.sectionCard, paletteStyles.cardSurface]}
            elevation={1}
          >
            <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
              Recurring smart matching
            </Text>
            <Text style={styles.sectionTitle}>Resolve due occurrence?</Text>
            <Text style={[styles.templateIntro, paletteStyles.mutedText]}>
              This saved log matches one or more scheduled recurring
              occurrences. Resolve any match you want to link now.
            </Text>
            {pendingRecurringPromptMatches.map((match, index) => (
              <MotionView
                key={`${match.occurrenceId}-${match.logId}`}
                delay={uiMotion.stagger * (index + 1)}
              >
                <View style={styles.listItemCard}>
                  {(() => {
                    const confidence = getRecurringMatchConfidence(match.score);
                    const confidenceChipColors =
                      confidence === "high"
                        ? {
                            backgroundColor: theme.colors.primaryContainer,
                            color: theme.colors.onPrimaryContainer,
                          }
                        : confidence === "medium"
                          ? {
                              backgroundColor: theme.colors.tertiaryContainer,
                              color: theme.colors.onTertiaryContainer,
                            }
                          : {
                              backgroundColor: theme.colors.errorContainer,
                              color: theme.colors.onErrorContainer,
                            };

                    return (
                      <>
                        <Text style={styles.listTitle}>{match.title}</Text>
                        <ActionButtonRow>
                          <Chip
                            compact
                            style={{
                              backgroundColor:
                                confidenceChipColors.backgroundColor,
                            }}
                            textStyle={{ color: confidenceChipColors.color }}
                          >
                            {getRecurringMatchConfidenceLabel(confidence)}
                          </Chip>
                          <Chip compact>Score {match.score}</Chip>
                        </ActionButtonRow>
                        <Text
                          style={[styles.listCopy, paletteStyles.mutedText]}
                        >
                          Review this suggestion and resolve only if the saved
                          entry clearly maps to this due occurrence.
                        </Text>
                        <ActionButtonRow>
                          <Button
                            mode="contained"
                            onPress={() =>
                              resolvePendingRecurringPromptMatch(
                                match.occurrenceId,
                              )
                            }
                          >
                            Resolve with saved log
                          </Button>
                          <Button
                            mode="outlined"
                            onPress={() =>
                              dismissPendingRecurringPromptMatch(
                                match.occurrenceId,
                              )
                            }
                          >
                            Dismiss
                          </Button>
                        </ActionButtonRow>
                      </>
                    );
                  })()}
                </View>
              </MotionView>
            ))}
            <ActionButtonRow style={styles.actionButtonRow}>
              <Button
                mode="outlined"
                onPress={() => {
                  if (!pendingPromptLogId) return;
                  router.replace({
                    pathname: "/logbook",
                    params: { entryId: pendingPromptLogId },
                  });
                }}
              >
                Open saved log
              </Button>
              <Button
                mode="outlined"
                onPress={() => router.push("/action-center")}
              >
                Open action center
              </Button>
            </ActionButtonRow>
          </Surface>
        ) : null}

        {entry && entrySpace ? (
          <>
            <Surface
              style={[
                styles.heroCard,
                paletteStyles.cardChipSurface,
                { borderColor: entrySpace.themeColor },
              ]}
              elevation={1}
            >
              <View style={styles.cardHeader}>
                <Chip
                  compact
                  style={[
                    styles.badge,
                    { backgroundColor: entrySpace.themeColor },
                  ]}
                  textStyle={[
                    styles.badgeText,
                    { color: getReadableTextColor(entrySpace.themeColor) },
                  ]}
                >
                  {logTypeLabels[entry.kind]}
                </Chip>
                <Text style={[styles.metaText, paletteStyles.mutedText]}>
                  {formatDateTime(entry.occurredAt)}
                </Text>
              </View>
              <Text style={styles.cardTitle}>{entry.title}</Text>
              <Text style={[styles.cardCopy, paletteStyles.mutedText]}>
                {entry.note}
              </Text>
              <Text style={[styles.metaText, { color: entrySpace.themeColor }]}>
                {entrySpace.name}
              </Text>
              {entry.tags?.length ? (
                <View style={styles.heroBadgeRow}>
                  {entry.tags.map((tag) => (
                    <Chip
                      key={tag}
                      compact
                      style={styles.heroBadge}
                      textStyle={styles.heroBadgeText}
                    >
                      {tag}
                    </Chip>
                  ))}
                </View>
              ) : null}
              <ActionButtonRow style={styles.actionButtonRow}>
                <Button mode="outlined" onPress={handleOpenEditLogDialog}>
                  Edit entry
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => setIsArchiveLogDialogVisible(true)}
                >
                  Archive entry
                </Button>
              </ActionButtonRow>
            </Surface>

            {relatedMetrics.length > 0 ? (
              <Surface
                style={[styles.sectionCard, paletteStyles.cardSurface]}
                elevation={1}
              >
                <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                  Metrics
                </Text>
                <Text style={styles.sectionTitle}>Metric readings</Text>
                {relatedMetrics.map(({ reading, definition }, index) => (
                  <MotionView
                    key={reading.metricId}
                    delay={uiMotion.stagger * (index + 1)}
                  >
                    <View style={styles.listItem}>
                      <Text style={styles.listTitle}>
                        {definition?.name ?? "Unknown metric"}
                      </Text>
                      <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                        {String(reading.value)}{" "}
                        {reading.unitLabel ?? definition?.unitLabel ?? ""} •
                        Safe zone{" "}
                        {formatSafeZone(
                          definition?.safeMin,
                          definition?.safeMax,
                        )}
                      </Text>
                    </View>
                  </MotionView>
                ))}
              </Surface>
            ) : null}

            {relatedAssets.length > 0 ? (
              <Surface
                style={[styles.sectionCard, paletteStyles.cardSurface]}
                elevation={1}
              >
                <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                  Assets
                </Text>
                <Text style={styles.sectionTitle}>Related assets</Text>
                {relatedAssets.map((asset, index) => (
                  <MotionView
                    key={asset.id}
                    delay={uiMotion.stagger * (index + 1)}
                  >
                    <View style={styles.listItem}>
                      <Text style={styles.listTitle}>{asset.name}</Text>
                      <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                        {asset.category} • {asset.note}
                      </Text>
                    </View>
                  </MotionView>
                ))}
              </Surface>
            ) : null}

            {relatedRoutine || relatedReminder ? (
              <Surface
                style={[styles.sectionCard, paletteStyles.cardSurface]}
                elevation={1}
              >
                <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                  Workflow
                </Text>
                <Text style={styles.sectionTitle}>Linked workflow</Text>
                {relatedRoutine ? (
                  <View style={styles.listItem}>
                    <Text style={styles.listTitle}>{relatedRoutine.name}</Text>
                    <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                      {relatedRoutine.description}
                    </Text>
                  </View>
                ) : null}
                {relatedReminder ? (
                  <View style={styles.listItem}>
                    <Text style={styles.listTitle}>
                      {relatedReminder.title}
                    </Text>
                    <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                      Due {formatDateTime(relatedReminder.dueAt)}
                    </Text>
                  </View>
                ) : null}
              </Surface>
            ) : null}

            {parentEntry || childEntries.length > 0 ? (
              <Surface
                style={[styles.sectionCard, paletteStyles.cardSurface]}
                elevation={1}
              >
                <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                  Navigation
                </Text>
                <Text style={styles.sectionTitle}>Macro-linked logs</Text>
                {parentEntry ? (
                  <Button
                    mode="outlined"
                    onPress={() =>
                      router.replace({
                        pathname: "/logbook",
                        params: { entryId: parentEntry.id },
                      })
                    }
                    style={styles.navButton}
                  >
                    Open parent run: {parentEntry.title}
                  </Button>
                ) : null}
                {childEntries.map((childEntry, index) => (
                  <MotionView
                    key={childEntry.id}
                    delay={uiMotion.stagger * (index + 1)}
                  >
                    <SwipeActionCard
                      rightActions={[
                        {
                          label: "Open",
                          accentColor: palette.tint,
                          onPress: () =>
                            router.replace({
                              pathname: "/logbook",
                              params: { entryId: childEntry.id },
                            }),
                        },
                      ]}
                    >
                      <View style={styles.linkedLogRow}>
                        <View style={styles.linkedLogCopy}>
                          <Text style={styles.listTitle}>
                            {childEntry.title}
                          </Text>
                          <Text
                            style={[styles.listCopy, paletteStyles.mutedText]}
                          >
                            {logTypeLabels[childEntry.kind]} •{" "}
                            {formatDateTime(childEntry.occurredAt)}
                          </Text>
                        </View>
                        <Button
                          mode="text"
                          onPress={() =>
                            router.replace({
                              pathname: "/logbook",
                              params: { entryId: childEntry.id },
                            })
                          }
                          compact
                        >
                          Open
                        </Button>
                      </View>
                    </SwipeActionCard>
                  </MotionView>
                ))}
              </Surface>
            ) : null}

            {entry.attachmentsCount ||
            entry.attachments?.length ||
            entry.locationLabel ||
            entry.cost ? (
              <Surface
                style={[styles.sectionCard, paletteStyles.cardSurface]}
                elevation={1}
              >
                <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                  Context
                </Text>
                <Text style={styles.sectionTitle}>Extended context</Text>
                {entry.attachmentsCount ? (
                  <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                    Attachments: {entry.attachmentsCount}
                  </Text>
                ) : null}
                {entry.attachments?.length ? (
                  <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                    Types:{" "}
                    {entry.attachments
                      .map((item) => item.mediaType)
                      .join(" • ")}
                  </Text>
                ) : null}
                {photoAttachments.length > 0 ? (
                  <>
                    <View style={styles.photoPreviewRow}>
                      {photoAttachments.slice(0, 3).map((attachment) => (
                        <Image
                          key={attachment.id}
                          source={{ uri: attachment.uri }}
                          style={[
                            styles.photoPreview,
                            { backgroundColor: palette.surface3 },
                          ]}
                        />
                      ))}
                    </View>
                    {(entry.routineId || entry.reminderId) && (
                      <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                        These photos can serve as proof-of-completion for the
                        linked workflow.
                      </Text>
                    )}
                    <ActionButtonRow>
                      <Button
                        mode="outlined"
                        onPress={() =>
                          router.push(
                            (entry.assetIds?.length === 1
                              ? `/visual-history?assetId=${entry.assetIds[0]}`
                              : `/visual-history?spaceId=${entry.spaceId}`) as never,
                          )
                        }
                      >
                        Open visual history
                      </Button>
                    </ActionButtonRow>
                  </>
                ) : null}
                {entry.locationLabel ? (
                  <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                    Location: {entry.locationLabel}
                  </Text>
                ) : null}
                {entry.locationPoint ? (
                  <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                    GPS: {entry.locationPoint.latitude.toFixed(4)},{" "}
                    {entry.locationPoint.longitude.toFixed(4)}
                  </Text>
                ) : null}
                {entry.cost ? (
                  <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                    Linked cost: {formatCurrency(entry.cost)}
                  </Text>
                ) : null}
              </Surface>
            ) : null}
            {entry.customFieldValues ? (
              <Surface
                style={[styles.sectionCard, paletteStyles.cardSurface]}
                elevation={1}
              >
                <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                  Custom fields
                </Text>
                <Text style={styles.sectionTitle}>Custom schema fields</Text>
                {Object.entries(entry.customFieldValues).map(
                  ([label, value]) => (
                    <View key={label} style={styles.listItem}>
                      <Text style={styles.listTitle}>{label}</Text>
                      <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                        {formatCustomFieldValue(value)}
                      </Text>
                    </View>
                  ),
                )}
              </Surface>
            ) : null}
          </>
        ) : action || selectedTemplate ? (
          <>
            <Surface
              style={[
                styles.heroCard,
                paletteStyles.cardChipSurface,
                { borderColor: linkedSpace?.themeColor ?? palette.tint },
              ]}
              elevation={1}
            >
              <Text style={styles.cardTitle}>
                {action?.label ?? selectedTemplate?.name}
              </Text>
              <Text style={[styles.cardCopy, paletteStyles.mutedText]}>
                {action
                  ? actionDescriptions[action.kind]
                  : selectedTemplate?.summary}
              </Text>
              <Text
                style={[
                  styles.metaText,
                  { color: linkedSpace?.themeColor ?? palette.tint },
                ]}
              >
                {linkedSpace
                  ? `Suggested space: ${linkedSpace.name}`
                  : selectedTemplate
                    ? `${selectedTemplate.origin} • ${selectedTemplate.category}`
                    : "Available across your active spaces"}
              </Text>
            </Surface>

            {!hasSpaces ? (
              <Surface
                style={[styles.sectionCard, paletteStyles.cardSurface]}
                elevation={1}
              >
                <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                  First step
                </Text>
                <Text style={styles.sectionTitle}>
                  Create a space before recording
                </Text>
                <Text style={[styles.templateIntro, paletteStyles.mutedText]}>
                  Every event belongs to a space. Create one first and TrackItUp
                  will bring you right back here to finish the record.
                </Text>
              </Surface>
            ) : (
              <>
                <Surface
                  style={[styles.sectionCard, paletteStyles.cardSurface]}
                  elevation={1}
                >
                  <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                    Suggestions
                  </Text>
                  <Text style={styles.sectionTitle}>Suggested spaces</Text>
                  {suggestedSpaces.map((space, index) => (
                    <MotionView
                      key={space.id}
                      delay={uiMotion.stagger * (index + 1)}
                    >
                      <View style={styles.listItem}>
                        <Text style={styles.listTitle}>{space.name}</Text>
                        <Text
                          style={[styles.listCopy, paletteStyles.mutedText]}
                        >
                          {space.templateName ?? "Custom space"} •{" "}
                          {space.summary}
                        </Text>
                      </View>
                    </MotionView>
                  ))}
                </Surface>

                {action?.kind === "metric-entry" ||
                selectedTemplate?.formTemplate?.quickActionKind ===
                  "metric-entry" ? (
                  <Surface
                    style={[styles.sectionCard, paletteStyles.cardSurface]}
                    elevation={1}
                  >
                    <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                      Metrics
                    </Text>
                    <Text style={styles.sectionTitle}>
                      Ready-to-log metrics
                    </Text>
                    {suggestedMetrics.map((metric, index) => (
                      <MotionView
                        key={metric.id}
                        delay={uiMotion.stagger * (index + 1)}
                      >
                        <View style={styles.listItem}>
                          <Text style={styles.listTitle}>{metric.name}</Text>
                          <Text
                            style={[styles.listCopy, paletteStyles.mutedText]}
                          >
                            {metric.unitLabel ?? "No unit"} • Safe zone{" "}
                            {formatSafeZone(metric.safeMin, metric.safeMax)}
                          </Text>
                        </View>
                      </MotionView>
                    ))}
                  </Surface>
                ) : null}

                {action?.kind === "routine-run" ||
                selectedTemplate?.formTemplate?.quickActionKind ===
                  "routine-run" ? (
                  <Surface
                    style={[styles.sectionCard, paletteStyles.cardSurface]}
                    elevation={1}
                  >
                    <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                      Routine
                    </Text>
                    <Text style={styles.sectionTitle}>Routine steps</Text>
                    <Text
                      style={[styles.templateIntro, paletteStyles.mutedText]}
                    >
                      Capture a proof photo in the form below before you leave
                      the space. Attached images will flow into visual history,
                      completion evidence, and monthly recaps.
                    </Text>
                    <ActionButtonRow>
                      <Chip compact>
                        {draftProofPhotoCount} proof photo(s) attached
                      </Chip>
                    </ActionButtonRow>
                    {suggestedRoutines.map((routine, index) => (
                      <MotionView
                        key={routine.id}
                        delay={uiMotion.stagger * (index + 1)}
                      >
                        <View style={styles.listItem}>
                          <Text style={styles.listTitle}>{routine.name}</Text>
                          <Text
                            style={[styles.listCopy, paletteStyles.mutedText]}
                          >
                            {routine.steps
                              .map((step) => step.label)
                              .join(" • ")}
                          </Text>
                        </View>
                      </MotionView>
                    ))}
                  </Surface>
                ) : null}

                {action?.kind === "quick-log" ||
                selectedTemplate?.formTemplate?.quickActionKind ===
                  "quick-log" ? (
                  <Surface
                    style={[styles.sectionCard, paletteStyles.cardSurface]}
                    elevation={1}
                  >
                    <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                      Reminders
                    </Text>
                    <Text style={styles.sectionTitle}>
                      Open reminders to capture
                    </Text>
                    <Text
                      style={[styles.templateIntro, paletteStyles.mutedText]}
                    >
                      Pick a reminder, then capture a proof photo in the form
                      below so completion evidence stays attached to the
                      reminder and appears in visual history.
                    </Text>
                    <ActionButtonRow>
                      <Chip compact>
                        {draftProofPhotoCount} proof photo(s) attached
                      </Chip>
                      {selectedReminder ? (
                        <Chip compact>{selectedReminder.title}</Chip>
                      ) : null}
                    </ActionButtonRow>
                    {suggestedReminders.map((reminder, index) => (
                      <MotionView
                        key={reminder.id}
                        delay={uiMotion.stagger * (index + 1)}
                      >
                        <SwipeActionCard
                          rightActions={[
                            {
                              label: "Select",
                              accentColor: palette.tint,
                              onPress: () => handleSelectReminder(reminder),
                            },
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
                          ]}
                        >
                          <View style={styles.listItemCard}>
                            <Text style={styles.listTitle}>
                              {reminder.title}
                            </Text>
                            <Text
                              style={[styles.listCopy, paletteStyles.mutedText]}
                            >
                              {reminder.description}
                            </Text>
                            <ActionButtonRow>
                              <Button
                                mode={
                                  selectedReminder?.id === reminder.id
                                    ? "contained-tonal"
                                    : "outlined"
                                }
                                onPress={() => handleSelectReminder(reminder)}
                              >
                                {selectedReminder?.id === reminder.id
                                  ? "Selected for proof"
                                  : "Log with proof"}
                              </Button>
                            </ActionButtonRow>
                          </View>
                        </SwipeActionCard>
                      </MotionView>
                    ))}
                  </Surface>
                ) : null}
              </>
            )}
          </>
        ) : (
          <>
            {!hasSpaces ? (
              <Surface
                style={[styles.sectionCard, paletteStyles.cardSurface]}
                elevation={1}
              >
                <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                  First step
                </Text>
                <Text style={styles.sectionTitle}>Create your first space</Text>
                <Text style={[styles.templateIntro, paletteStyles.mutedText]}>
                  Before you record an event, give it a home. Your first space
                  makes metrics, routines, and reminders much easier to
                  organize.
                </Text>
                <ActionButtonRow style={styles.actionButtonRow}>
                  <Button
                    mode="contained"
                    onPress={openSpaceCreation}
                    style={styles.paperActionButton}
                    contentStyle={styles.paperActionButtonContent}
                  >
                    Create first space
                  </Button>
                </ActionButtonRow>
              </Surface>
            ) : null}

            <Surface
              style={[styles.sectionCard, paletteStyles.cardSurface]}
              elevation={1}
            >
              <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                Get started
              </Text>
              <Text style={styles.sectionTitle}>Record what just happened</Text>
              <Text style={[styles.templateIntro, paletteStyles.mutedText]}>
                Choose the flow that best matches the event. TrackItUp will
                guide the rest of the fields from there.
              </Text>
              {workspace.quickActions.map((quickAction, index) => (
                <MotionView
                  key={quickAction.id}
                  delay={uiMotion.stagger * (index + 1)}
                >
                  <SwipeActionCard contentStyle={styles.getStartedCardContent}>
                    <View style={styles.linkedLogRow}>
                      <View style={styles.linkedLogCopy}>
                        <Text style={styles.listTitle}>
                          {quickAction.label}
                        </Text>
                        <Text
                          style={[styles.listCopy, paletteStyles.mutedText]}
                        >
                          {actionDescriptions[quickAction.kind]}
                        </Text>
                      </View>
                      <Button
                        mode={
                          quickAction.kind === "quick-log"
                            ? "contained"
                            : "outlined"
                        }
                        onPress={() =>
                          hasSpaces
                            ? router.push({
                                pathname: "/logbook",
                                params: { actionId: quickAction.id },
                              })
                            : router.push({
                                pathname: "/space-create",
                                params: { actionId: quickAction.id },
                              })
                        }
                        compact
                      >
                        {hasSpaces ? "Start" : "Create space first"}
                      </Button>
                    </View>
                  </SwipeActionCard>
                </MotionView>
              ))}
            </Surface>

            {featuredTemplates.length > 0 ? (
              <Surface
                style={[styles.sectionCard, paletteStyles.cardSurface]}
                elevation={1}
              >
                <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                  Templates
                </Text>
                <Text style={styles.sectionTitle}>Use a saved schema</Text>
                <Text style={[styles.templateIntro, paletteStyles.mutedText]}>
                  If you already know the exact format you want, jump straight
                  into a saved template.
                </Text>
                {featuredTemplates.map((template, index) => (
                  <MotionView
                    key={template.id}
                    delay={uiMotion.stagger * (index + 1)}
                  >
                    <SwipeActionCard
                      rightActions={[
                        {
                          label: hasSpaces ? "Open" : "Space",
                          accentColor: palette.tint,
                          onPress: () =>
                            hasSpaces
                              ? router.push({
                                  pathname: "/logbook",
                                  params: { templateId: template.id },
                                })
                              : router.push({
                                  pathname: "/space-create",
                                  params: { templateId: template.id },
                                }),
                        },
                      ]}
                    >
                      <View style={styles.linkedLogRow}>
                        <View style={styles.linkedLogCopy}>
                          <Text style={styles.listTitle}>{template.name}</Text>
                          <Text
                            style={[styles.listCopy, paletteStyles.mutedText]}
                          >
                            {template.summary}
                          </Text>
                        </View>
                        <Button
                          mode="outlined"
                          onPress={() =>
                            hasSpaces
                              ? router.push({
                                  pathname: "/logbook",
                                  params: { templateId: template.id },
                                })
                              : router.push({
                                  pathname: "/space-create",
                                  params: { templateId: template.id },
                                })
                          }
                          compact
                        >
                          {hasSpaces ? "Open" : "Create space first"}
                        </Button>
                      </View>
                    </SwipeActionCard>
                  </MotionView>
                ))}
              </Surface>
            ) : null}

            {recentEntries.length > 0 ? (
              <Surface
                style={[styles.sectionCard, paletteStyles.cardSurface]}
                elevation={1}
              >
                <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
                  Recent activity
                </Text>
                <Text style={styles.sectionTitle}>Open a recent entry</Text>
                <Text style={[styles.templateIntro, paletteStyles.mutedText]}>
                  Need context before you record? Use a recent entry as your
                  reference point.
                </Text>
                {recentEntries.map((recentEntry, index) => (
                  <MotionView
                    key={recentEntry.id}
                    delay={uiMotion.stagger * (index + 1)}
                  >
                    <SwipeActionCard
                      rightActions={[
                        {
                          label: "View",
                          accentColor: palette.tint,
                          onPress: () =>
                            router.push({
                              pathname: "/logbook",
                              params: { entryId: recentEntry.id },
                            }),
                        },
                      ]}
                    >
                      <View style={styles.linkedLogRow}>
                        <View style={styles.linkedLogCopy}>
                          <Text style={styles.listTitle}>
                            {recentEntry.title}
                          </Text>
                          <Text
                            style={[styles.listCopy, paletteStyles.mutedText]}
                          >
                            {logTypeLabels[recentEntry.kind]} •{" "}
                            {formatDateTime(recentEntry.occurredAt)}
                          </Text>
                        </View>
                        <Button
                          mode="text"
                          onPress={() =>
                            router.push({
                              pathname: "/logbook",
                              params: { entryId: recentEntry.id },
                            })
                          }
                          compact
                        >
                          View
                        </Button>
                      </View>
                    </SwipeActionCard>
                  </MotionView>
                ))}
              </Surface>
            ) : null}

            <SectionMessage
              palette={palette}
              label="Tip"
              title={hasSpaces ? "Want the fastest path?" : "No spaces yet?"}
              message={
                hasSpaces
                  ? "Start with Quick log for most events. Use Add metric for readings and Run routine when you want linked step-by-step records."
                  : "Create one space first, then TrackItUp can naturally guide you into the right recording flow."
              }
            />
          </>
        )}

        {!action && !selectedTemplate ? (
          <Surface
            style={[styles.sectionCard, paletteStyles.cardSurface]}
            elevation={1}
          >
            <Text style={[styles.sectionLabel, paletteStyles.tintText]}>
              Workspace tools
            </Text>
            <Text style={styles.sectionTitle}>Maintenance</Text>
            <Text style={[styles.templateIntro, paletteStyles.mutedText]}>
              These tools affect local workspace data, so they stay away from
              the main recording flow.
            </Text>
            <ActionButtonRow style={styles.actionButtonRow}>
              <Button
                onPress={handleResetWorkspace}
                mode="outlined"
                style={styles.paperActionButton}
                contentStyle={styles.paperActionButtonContent}
              >
                Clear workspace data
              </Button>
            </ActionButtonRow>
          </Surface>
        ) : null}
      </ScrollView>

      {showEntryFooter ? (
        <Surface
          style={[
            styles.footer,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.outlineVariant,
              paddingBottom: uiSpace.lg + insets.bottom,
            },
          ]}
          elevation={2}
        >
          <View style={styles.footerActions}>
            <Button
              mode="outlined"
              onPress={handleCancelEntry}
              style={styles.footerButton}
              contentStyle={styles.footerButtonContent}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={hasSpaces ? handleSaveEntry : openSpaceCreation}
              style={styles.footerButton}
              contentStyle={styles.footerButtonContent}
            >
              {footerPrimaryLabel}
            </Button>
          </View>
        </Surface>
      ) : null}

      <Portal>
        <Dialog
          visible={isEditLogDialogVisible}
          onDismiss={() => setIsEditLogDialogVisible(false)}
        >
          <Dialog.Title>Edit log entry</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Title"
              value={editableLogTitle}
              onChangeText={setEditableLogTitle}
              style={styles.dialogInput}
            />
            <TextInput
              mode="outlined"
              label="Note"
              value={editableLogNote}
              onChangeText={setEditableLogNote}
              multiline
              style={styles.dialogInput}
            />
            <TextInput
              mode="outlined"
              label="Tags"
              value={editableLogTags}
              onChangeText={setEditableLogTags}
              placeholder="comma, separated, tags"
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsEditLogDialogVisible(false)}>
              Cancel
            </Button>
            <Button onPress={handleSaveLogEdits}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={isArchiveLogDialogVisible}
          onDismiss={() => setIsArchiveLogDialogVisible(false)}
        >
          <Dialog.Title>Archive this log entry?</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogCopy, paletteStyles.mutedText]}>
              This removes the entry from active log views and timelines while
              keeping it in local history.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsArchiveLogDialogVisible(false)}>
              Cancel
            </Button>
            <Button onPress={handleArchiveLogEntry}>Archive</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  hero: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.hero,
    padding: uiSpace.hero,
    marginBottom: uiSpace.surface,
  },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
    marginBottom: uiSpace.lg,
  },
  heroBadge: {
    borderRadius: uiRadius.pill,
  },
  heroBadgeText: uiTypography.chip,
  eyebrow: { ...uiTypography.heroEyebrow, marginBottom: uiSpace.sm },
  title: uiTypography.heroTitle,
  subtitle: { ...uiTypography.subtitle, marginTop: uiSpace.md },
  heroCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    marginBottom: uiSpace.xxl,
  },
  statusCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    marginBottom: uiSpace.xxl,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: uiSpace.lg,
    marginBottom: uiSpace.lg,
  },
  statusBadge: { borderRadius: uiRadius.pill },
  statusBadgeText: uiTypography.chip,
  statusMessage: { ...uiTypography.bodySmall, marginTop: uiSpace.md },
  actionButtonRow: { marginTop: uiSpace.xl },
  paperActionButton: {
    alignSelf: "flex-start",
  },
  paperActionButtonContent: { paddingVertical: uiSpace.xs },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: uiSpace.lg,
  },
  badge: { borderRadius: uiRadius.pill },
  badgeText: uiTypography.chip,
  cardTitle: { ...uiTypography.titleXl, marginBottom: 6 },
  cardCopy: { ...uiTypography.body, marginBottom: uiSpace.md },
  metaText: uiTypography.chip,
  sectionCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    marginBottom: uiSpace.xxl,
  },
  sectionLabel: {
    ...uiTypography.label,
    marginBottom: uiSpace.sm,
    textTransform: "uppercase",
  },
  sectionTitle: { ...uiTypography.titleSection, marginBottom: uiSpace.lg },
  templateIntro: { ...uiTypography.body, marginBottom: uiSpace.lg },
  guidanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiSpace.md,
    marginBottom: uiSpace.md,
  },
  guidanceStep: {
    width: 28,
    height: 28,
    borderRadius: uiRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  guidanceStepText: {
    ...uiTypography.chip,
  },
  templateSection: { marginTop: uiSpace.xs, marginBottom: uiSpace.lg },
  templateSectionTitle: { ...uiTypography.titleSm, marginBottom: uiSpace.xs },
  templateSectionCopy: { ...uiTypography.bodySmall, marginBottom: uiSpace.md },
  fieldCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.sm,
    padding: uiSpace.xl,
    marginBottom: uiSpace.md,
  },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: uiSpace.sm,
  },
  fieldLabel: { flex: 1, ...uiTypography.bodyStrong },
  fieldMeta: uiTypography.chip,
  fieldDescription: { ...uiTypography.bodySmall, marginBottom: 6 },
  fieldPreview: uiTypography.bodySmall,
  navButton: { marginBottom: uiSpace.lg, alignSelf: "flex-start" },
  linkedLogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiSpace.lg,
    marginBottom: uiSpace.lg,
  },
  linkedLogCopy: { flex: 1 },
  getStartedCardContent: {
    paddingHorizontal: uiSpace.lg,
    paddingTop: uiSpace.sm,
  },
  listItem: { marginBottom: uiSpace.lg },
  listItemCard: {
    paddingTop: uiSpace.xs,
  },
  listTitle: { ...uiTypography.titleSm, marginBottom: uiSpace.xs },
  listCopy: uiTypography.body,
  photoPreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.sm,
    marginTop: uiSpace.md,
    marginBottom: uiSpace.md,
  },
  photoPreview: {
    width: 92,
    height: 92,
    borderRadius: uiRadius.lg,
  },
  footer: {
    minHeight: logbookFooterMinHeight,
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
  dialogInput: { marginBottom: uiSpace.md },
  dialogCopy: uiTypography.body,
});
