import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Surface } from "react-native-paper";

import { DynamicFormRenderer } from "@/components/DynamicFormRenderer";
import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import {
    getLogKindFormTemplate,
    getQuickActionFormTemplate,
} from "@/constants/TrackItUpFormTemplates";
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
    entryId?: string;
    templateId?: string;
  }>();

  const actionId = pickParam(params.actionId);
  const entryId = pickParam(params.entryId);
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

  const activeTemplate = action
    ? getQuickActionFormTemplate(action.kind)
    : entry
      ? getLogKindFormTemplate(entry.kind)
      : selectedTemplate?.formTemplate;

  const initialFormValues = useMemo(
    () =>
      activeTemplate
        ? buildInitialFormValues(activeTemplate, workspace, { action, entry })
        : {},
    [activeTemplate, action, entry, workspace],
  );

  useEffect(() => {
    setFormValues(initialFormValues);
    setFormErrors({});
  }, [initialFormValues]);

  const screenTitle = entry
    ? "Log detail"
    : action
      ? action.label
      : (selectedTemplate?.name ?? "Logbook");
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

  function handleSaveEntry() {
    if ((!action && !selectedTemplate) || !activeTemplate) return;

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

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: screenTitle }} />

      <Surface
        style={[
          styles.hero,
          { backgroundColor: palette.hero, borderColor: palette.heroBorder },
        ]}
        elevation={2}
      >
        <View style={styles.heroBadgeRow}>
          <Chip
            compact
            style={[styles.heroBadge, { backgroundColor: palette.card }]}
            textStyle={[styles.heroBadgeText, { color: palette.tint }]}
          >
            TrackItUp logbook
          </Chip>
          <Chip
            compact
            style={[styles.heroBadge, { backgroundColor: palette.accentSoft }]}
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
        <Text style={[styles.subtitle, { color: palette.muted }]}>
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
        style={[
          styles.statusCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
        elevation={1}
      >
        <View style={styles.statusHeader}>
          <Text style={styles.sectionTitle}>Workspace persistence</Text>
          <Chip
            compact
            style={[
              styles.statusBadge,
              { backgroundColor: palette.primaryContainer },
            ]}
            textStyle={[
              styles.statusBadgeText,
              { color: palette.onPrimaryContainer },
            ]}
          >
            {isHydrated ? persistenceLabel : "Hydrating snapshot"}
          </Chip>
        </View>
        <Text style={[styles.listCopy, { color: palette.muted }]}>
          {logEntries.length} logs and {workspace.spaces.length} spaces are
          currently loaded from the shared workspace store.
        </Text>
        {feedbackMessage ? (
          <Text style={[styles.statusMessage, { color: palette.tint }]}>
            {feedbackMessage}
          </Text>
        ) : null}
        <View style={styles.actionButtonRow}>
          {action || selectedTemplate ? (
            <Button
              onPress={handleSaveEntry}
              mode="contained"
              style={styles.paperActionButton}
              contentStyle={styles.paperActionButtonContent}
            >
              Save log entry
            </Button>
          ) : null}
          <Button
            onPress={handleResetWorkspace}
            mode="outlined"
            style={styles.paperActionButton}
            contentStyle={styles.paperActionButtonContent}
          >
            Clear workspace data
          </Button>
        </View>
      </Surface>

      {activeTemplate ? (
        <Surface
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
          elevation={1}
        >
          <Text style={[styles.sectionLabel, { color: palette.tint }]}>
            Form
          </Text>
          <Text style={styles.sectionTitle}>{activeTemplate.title}</Text>
          <Text style={[styles.templateIntro, { color: palette.muted }]}>
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
              {
                backgroundColor: palette.card,
                borderColor: entrySpace.themeColor,
              },
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
              <Text style={[styles.metaText, { color: palette.muted }]}>
                {formatDateTime(entry.occurredAt)}
              </Text>
            </View>
            <Text style={styles.cardTitle}>{entry.title}</Text>
            <Text style={[styles.cardCopy, { color: palette.muted }]}>
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
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              elevation={1}
            >
              <Text style={[styles.sectionLabel, { color: palette.tint }]}>
                Metrics
              </Text>
              <Text style={styles.sectionTitle}>Metric readings</Text>
              {relatedMetrics.map(({ reading, definition }) => (
                <View key={reading.metricId} style={styles.listItem}>
                  <Text style={styles.listTitle}>
                    {definition?.name ?? "Unknown metric"}
                  </Text>
                  <Text style={[styles.listCopy, { color: palette.muted }]}>
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
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              elevation={1}
            >
              <Text style={[styles.sectionLabel, { color: palette.tint }]}>
                Assets
              </Text>
              <Text style={styles.sectionTitle}>Related assets</Text>
              {relatedAssets.map((asset) => (
                <View key={asset.id} style={styles.listItem}>
                  <Text style={styles.listTitle}>{asset.name}</Text>
                  <Text style={[styles.listCopy, { color: palette.muted }]}>
                    {asset.category} • {asset.note}
                  </Text>
                </View>
              ))}
            </Surface>
          ) : null}

          {relatedRoutine || relatedReminder ? (
            <Surface
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              elevation={1}
            >
              <Text style={[styles.sectionLabel, { color: palette.tint }]}>
                Workflow
              </Text>
              <Text style={styles.sectionTitle}>Linked workflow</Text>
              {relatedRoutine ? (
                <View style={styles.listItem}>
                  <Text style={styles.listTitle}>{relatedRoutine.name}</Text>
                  <Text style={[styles.listCopy, { color: palette.muted }]}>
                    {relatedRoutine.description}
                  </Text>
                </View>
              ) : null}
              {relatedReminder ? (
                <View style={styles.listItem}>
                  <Text style={styles.listTitle}>{relatedReminder.title}</Text>
                  <Text style={[styles.listCopy, { color: palette.muted }]}>
                    Due {formatDateTime(relatedReminder.dueAt)}
                  </Text>
                </View>
              ) : null}
            </Surface>
          ) : null}

          {parentEntry || childEntries.length > 0 ? (
            <Surface
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              elevation={1}
            >
              <Text style={[styles.sectionLabel, { color: palette.tint }]}>
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
                    <Text style={[styles.listCopy, { color: palette.muted }]}>
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

          {entry.attachmentsCount || entry.locationLabel || entry.cost ? (
            <Surface
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              elevation={1}
            >
              <Text style={[styles.sectionLabel, { color: palette.tint }]}>
                Context
              </Text>
              <Text style={styles.sectionTitle}>Extended context</Text>
              {entry.attachmentsCount ? (
                <Text style={[styles.listCopy, { color: palette.muted }]}>
                  Attachments: {entry.attachmentsCount}
                </Text>
              ) : null}
              {entry.attachments?.length ? (
                <Text style={[styles.listCopy, { color: palette.muted }]}>
                  Types:{" "}
                  {entry.attachments.map((item) => item.mediaType).join(" • ")}
                </Text>
              ) : null}
              {entry.locationLabel ? (
                <Text style={[styles.listCopy, { color: palette.muted }]}>
                  Location: {entry.locationLabel}
                </Text>
              ) : null}
              {entry.locationPoint ? (
                <Text style={[styles.listCopy, { color: palette.muted }]}>
                  GPS: {entry.locationPoint.latitude.toFixed(4)},{" "}
                  {entry.locationPoint.longitude.toFixed(4)}
                </Text>
              ) : null}
              {entry.cost ? (
                <Text style={[styles.listCopy, { color: palette.muted }]}>
                  Linked cost: {formatCurrency(entry.cost)}
                </Text>
              ) : null}
            </Surface>
          ) : null}
          {entry.customFieldValues ? (
            <Surface
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              elevation={1}
            >
              <Text style={[styles.sectionLabel, { color: palette.tint }]}>
                Custom fields
              </Text>
              <Text style={styles.sectionTitle}>Custom schema fields</Text>
              {Object.entries(entry.customFieldValues).map(([label, value]) => (
                <View key={label} style={styles.listItem}>
                  <Text style={styles.listTitle}>{label}</Text>
                  <Text style={[styles.listCopy, { color: palette.muted }]}>
                    {formatCustomFieldValue(value)}
                  </Text>
                </View>
              ))}
            </Surface>
          ) : null}
        </>
      ) : action || selectedTemplate ? (
        <>
          <Surface
            style={[
              styles.heroCard,
              {
                backgroundColor: palette.card,
                borderColor: linkedSpace?.themeColor ?? palette.tint,
              },
            ]}
            elevation={1}
          >
            <Text style={styles.cardTitle}>
              {action?.label ?? selectedTemplate?.name}
            </Text>
            <Text style={[styles.cardCopy, { color: palette.muted }]}>
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

          <Surface
            style={[
              styles.sectionCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
            elevation={1}
          >
            <Text style={[styles.sectionLabel, { color: palette.tint }]}>
              Suggestions
            </Text>
            <Text style={styles.sectionTitle}>Suggested spaces</Text>
            {suggestedSpaces.map((space) => (
              <View key={space.id} style={styles.listItem}>
                <Text style={styles.listTitle}>{space.name}</Text>
                <Text style={[styles.listCopy, { color: palette.muted }]}>
                  {space.templateName ?? "Custom space"} • {space.summary}
                </Text>
              </View>
            ))}
          </Surface>

          {action?.kind === "metric-entry" ||
          selectedTemplate?.formTemplate?.quickActionKind === "metric-entry" ? (
            <Surface
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              elevation={1}
            >
              <Text style={[styles.sectionLabel, { color: palette.tint }]}>
                Metrics
              </Text>
              <Text style={styles.sectionTitle}>Ready-to-log metrics</Text>
              {suggestedMetrics.map((metric) => (
                <View key={metric.id} style={styles.listItem}>
                  <Text style={styles.listTitle}>{metric.name}</Text>
                  <Text style={[styles.listCopy, { color: palette.muted }]}>
                    {metric.unitLabel ?? "No unit"} • Safe zone{" "}
                    {formatSafeZone(metric.safeMin, metric.safeMax)}
                  </Text>
                </View>
              ))}
            </Surface>
          ) : null}

          {action?.kind === "routine-run" ||
          selectedTemplate?.formTemplate?.quickActionKind === "routine-run" ? (
            <Surface
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              elevation={1}
            >
              <Text style={[styles.sectionLabel, { color: palette.tint }]}>
                Routine
              </Text>
              <Text style={styles.sectionTitle}>Routine steps</Text>
              {suggestedRoutines.map((routine) => (
                <View key={routine.id} style={styles.listItem}>
                  <Text style={styles.listTitle}>{routine.name}</Text>
                  <Text style={[styles.listCopy, { color: palette.muted }]}>
                    {routine.steps.map((step) => step.label).join(" • ")}
                  </Text>
                </View>
              ))}
            </Surface>
          ) : null}

          {action?.kind === "quick-log" ||
          selectedTemplate?.formTemplate?.quickActionKind === "quick-log" ? (
            <Surface
              style={[
                styles.sectionCard,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
              elevation={1}
            >
              <Text style={[styles.sectionLabel, { color: palette.tint }]}>
                Reminders
              </Text>
              <Text style={styles.sectionTitle}>Open reminders to capture</Text>
              {suggestedReminders.map((reminder) => (
                <View key={reminder.id} style={styles.listItem}>
                  <Text style={styles.listTitle}>{reminder.title}</Text>
                  <Text style={[styles.listCopy, { color: palette.muted }]}>
                    {reminder.description}
                  </Text>
                </View>
              ))}
            </Surface>
          ) : null}
        </>
      ) : (
        <Surface
          style={[
            styles.sectionCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
          elevation={1}
        >
          <Text style={[styles.sectionLabel, { color: palette.tint }]}>
            Empty state
          </Text>
          <Text style={styles.sectionTitle}>No selection yet</Text>
          <Text style={[styles.listCopy, { color: palette.muted }]}>
            Start from Home quick actions or tap a timeline card to inspect a
            real logbook item.
          </Text>
        </Surface>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
  },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  heroBadge: {
    borderRadius: 999,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  eyebrow: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  title: { fontSize: 30, fontWeight: "bold", lineHeight: 38 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  heroCard: { borderWidth: 1, borderRadius: 24, padding: 18, marginBottom: 16 },
  statusCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  statusBadge: { borderRadius: 999 },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  statusMessage: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  actionButtonRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  paperActionButton: {
    flex: 1,
  },
  paperActionButtonContent: { paddingVertical: 4 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: { borderRadius: 999 },
  badgeText: { color: "#f8fafc", fontSize: 12, fontWeight: "700" },
  cardTitle: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  cardCopy: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  metaText: { fontSize: 12, fontWeight: "700" },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  templateIntro: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  templateSection: { marginTop: 4, marginBottom: 12 },
  templateSectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  templateSectionCopy: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  fieldCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  fieldLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
  fieldMeta: { fontSize: 12, fontWeight: "700" },
  fieldDescription: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  fieldPreview: { fontSize: 13, lineHeight: 18 },
  navButton: { marginBottom: 12, alignSelf: "flex-start" },
  linkedLogRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  linkedLogCopy: { flex: 1 },
  listItem: { marginBottom: 12 },
  listTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  listCopy: { fontSize: 14, lineHeight: 20 },
});
