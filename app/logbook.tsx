import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Surface } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DynamicFormRenderer } from "@/components/DynamicFormRenderer";
import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import {
    getLogKindFormTemplate,
    getQuickActionFormTemplate,
} from "@/constants/TrackItUpFormTemplates";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
    buildInitialFormValues,
    normalizeFormValues,
    validateFormValues,
    type FormValidationErrors,
    type FormValue,
    type FormValueMap,
} from "@/services/forms/workspaceForm";
import { getLinkedLogEntries } from "@/services/logs/logRelationships";
import type { QuickActionKind, Reminder } from "@/types/trackitup";

function buildReminderDraftPatch(reminder: Reminder) {
  return {
    reminderId: reminder.id,
    spaceId: reminder.spaceId,
    title: `${reminder.title} completed`,
    note: reminder.description
      ? `Proof captured for reminder completion. ${reminder.description}`
      : "Proof captured for reminder completion.",
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

export default function LogbookScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const {
    isHydrated,
    logEntries,
    persistenceMode,
    resetWorkspace,
    saveLogForAction,
    saveLogForTemplate,
    workspace,
  } = useWorkspace();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValueMap>({});
  const [formErrors, setFormErrors] = useState<FormValidationErrors>({});
  const params = useLocalSearchParams<{
    actionId?: string;
    createdSpaceName?: string;
    entryId?: string;
    reminderId?: string;
    spaceId?: string;
    templateId?: string;
  }>();

  const actionId = pickParam(params.actionId);
  const createdSpaceName = pickParam(params.createdSpaceName);
  const entryId = pickParam(params.entryId);
  const initialReminderId = pickParam(params.reminderId);
  const initialSpaceId = pickParam(params.spaceId);
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
        initialSpaceId &&
        workspace.spaces.some((space) => space.id === initialSpaceId)
          ? { spaceId: initialSpaceId }
          : {}),
        ...(!entry && initialReminder
          ? buildReminderDraftPatch(initialReminder)
          : {}),
      },
      { action, entry },
    );
  }, [
    activeTemplate,
    action,
    entry,
    initialReminder,
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

  const screenTitle = entry
    ? "Log detail"
    : action
      ? action.label
      : (selectedTemplate?.name ?? "Logbook");
  const recentEntries = logEntries.slice(0, 3);
  const featuredTemplates = workspace.templates.slice(0, 3);
  const hasSpaces = workspace.spaces.length > 0;
  const selectedSpaceId =
    typeof formValues.spaceId === "string" ? formValues.spaceId : undefined;
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

    setFeedbackMessage(
      result.createdCount > 1
        ? `Saved ${result.createdCount} log entries from one routine/template run.${result.scheduledReminderCount ? ` Triggered ${result.scheduledReminderCount} reminder(s).` : ""}`
        : `Log entry saved to your workspace.${result.scheduledReminderCount ? ` Triggered ${result.scheduledReminderCount} reminder(s).` : ""}`,
    );
    router.replace({
      pathname: "/logbook",
      params: { entryId: result.entryId },
    });
  }

  function handleResetWorkspace() {
    resetWorkspace();
    setFeedbackMessage("Local workspace data cleared.");

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
      >
        <Stack.Screen options={{ title: screenTitle }} />

        <Surface style={[styles.hero, paletteStyles.heroSurface]} elevation={2}>
          <View style={styles.heroBadgeRow}>
            <Chip
              compact
              style={[styles.heroBadge, paletteStyles.cardChipSurface]}
              textStyle={[styles.heroBadgeText, paletteStyles.tintText]}
            >
              TrackItUp logbook
            </Chip>
            <Chip
              compact
              style={[styles.heroBadge, paletteStyles.accentChipSurface]}
              textStyle={styles.heroBadgeText}
            >
              {entry
                ? "Detail view"
                : action || selectedTemplate
                  ? "New entry"
                  : "Workspace overview"}
            </Chip>
          </View>
          <Text style={styles.title}>{screenTitle}</Text>
          <Text style={[styles.subtitle, paletteStyles.mutedText]}>
            {entry
              ? "Review the selected timeline event and its linked tracking context."
              : action
                ? actionDescriptions[action.kind]
                : selectedTemplate
                  ? "Run a saved custom schema and capture the extra fields directly into the workspace logbook."
                  : "Choose a quick action or timeline item to start this flow."}
          </Text>
        </Surface>

        <Surface
          style={[styles.statusCard, paletteStyles.cardSurface]}
          elevation={1}
        >
          <View style={styles.statusHeader}>
            <Text style={styles.sectionTitle}>Workspace persistence</Text>
            <Chip
              compact
              style={[styles.statusBadge, paletteStyles.primaryChipSurface]}
              textStyle={[
                styles.statusBadgeText,
                paletteStyles.onPrimaryChipText,
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
                  textStyle={styles.badgeText}
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
                  <Text style={styles.guidanceStepText}>{index + 1}</Text>
                </View>
                <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                  {step}
                </Text>
              </View>
            ))}
          </Surface>
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
                  textStyle={styles.badgeText}
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
                {relatedMetrics.map(({ reading, definition }) => (
                  <View key={reading.metricId} style={styles.listItem}>
                    <Text style={styles.listTitle}>
                      {definition?.name ?? "Unknown metric"}
                    </Text>
                    <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                      {String(reading.value)}{" "}
                      {reading.unitLabel ?? definition?.unitLabel ?? ""} • Safe
                      zone{" "}
                      {formatSafeZone(definition?.safeMin, definition?.safeMax)}
                    </Text>
                  </View>
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
                {relatedAssets.map((asset) => (
                  <View key={asset.id} style={styles.listItem}>
                    <Text style={styles.listTitle}>{asset.name}</Text>
                    <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                      {asset.category} • {asset.note}
                    </Text>
                  </View>
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
                {childEntries.map((childEntry) => (
                  <View key={childEntry.id} style={styles.linkedLogRow}>
                    <View style={styles.linkedLogCopy}>
                      <Text style={styles.listTitle}>{childEntry.title}</Text>
                      <Text style={[styles.listCopy, paletteStyles.mutedText]}>
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
                          style={styles.photoPreview}
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
                  {suggestedSpaces.map((space) => (
                    <View key={space.id} style={styles.listItem}>
                      <Text style={styles.listTitle}>{space.name}</Text>
                      <Text style={[styles.listCopy, paletteStyles.mutedText]}>
                        {space.templateName ?? "Custom space"} • {space.summary}
                      </Text>
                    </View>
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
                    {suggestedMetrics.map((metric) => (
                      <View key={metric.id} style={styles.listItem}>
                        <Text style={styles.listTitle}>{metric.name}</Text>
                        <Text
                          style={[styles.listCopy, paletteStyles.mutedText]}
                        >
                          {metric.unitLabel ?? "No unit"} • Safe zone{" "}
                          {formatSafeZone(metric.safeMin, metric.safeMax)}
                        </Text>
                      </View>
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
                    {suggestedRoutines.map((routine) => (
                      <View key={routine.id} style={styles.listItem}>
                        <Text style={styles.listTitle}>{routine.name}</Text>
                        <Text
                          style={[styles.listCopy, paletteStyles.mutedText]}
                        >
                          {routine.steps.map((step) => step.label).join(" • ")}
                        </Text>
                      </View>
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
                    {suggestedReminders.map((reminder) => (
                      <View key={reminder.id} style={styles.listItem}>
                        <Text style={styles.listTitle}>{reminder.title}</Text>
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
              {workspace.quickActions.map((quickAction) => (
                <View key={quickAction.id} style={styles.linkedLogRow}>
                  <View style={styles.linkedLogCopy}>
                    <Text style={styles.listTitle}>{quickAction.label}</Text>
                    <Text style={[styles.listCopy, paletteStyles.mutedText]}>
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
                {featuredTemplates.map((template) => (
                  <View key={template.id} style={styles.linkedLogRow}>
                    <View style={styles.linkedLogCopy}>
                      <Text style={styles.listTitle}>{template.name}</Text>
                      <Text style={[styles.listCopy, paletteStyles.mutedText]}>
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
                {recentEntries.map((recentEntry) => (
                  <View key={recentEntry.id} style={styles.linkedLogRow}>
                    <View style={styles.linkedLogCopy}>
                      <Text style={styles.listTitle}>{recentEntry.title}</Text>
                      <Text style={[styles.listCopy, paletteStyles.mutedText]}>
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
    flex: 1,
  },
  paperActionButtonContent: { paddingVertical: uiSpace.xs },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: uiSpace.lg,
  },
  badge: { borderRadius: uiRadius.pill },
  badgeText: { color: "#f8fafc", ...uiTypography.chip },
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
    color: "#f8fafc",
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
  listItem: { marginBottom: uiSpace.lg },
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
    backgroundColor: "#00000014",
  },
  footer: {
    minHeight: logbookFooterMinHeight,
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
