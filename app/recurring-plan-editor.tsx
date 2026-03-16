import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  SegmentedButtons,
  Surface,
  Switch,
  TextInput,
  useTheme,
  type MD3Theme,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { ChipRow } from "@/components/ui/ChipRow";
import { ScreenHero } from "@/components/ui/ScreenHero";
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
import type {
  RecurringPlan,
  RecurringPlanScheduleRule,
  RecurringSmartMatchMode,
} from "@/types/trackitup";

const weekdayChoices = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
] as const;

type ScheduleKind = RecurringPlanScheduleRule["type"];

type PlanEditorState = {
  id: string;
  title: string;
  description: string;
  category: string;
  tagsText: string;
  spaceIds: string[];
  timezone: string;
  startDate: string;
  status: RecurringPlan["status"];
  gracePeriodMinutesText: string;
  proofRequired: boolean;
  smartMatchMode: RecurringSmartMatchMode;
  scheduleType: ScheduleKind;
  timesText: string;
  everyNDaysIntervalText: string;
  weeklyDays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
  monthlyMode: "day-of-month" | "nth-weekday";
  monthlyDayOfMonthText: string;
  monthlyNthWeekText: "1" | "2" | "3" | "4" | "5" | "-1";
  monthlyWeekdayText: "0" | "1" | "2" | "3" | "4" | "5" | "6";
};

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function parseIsoDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseTimes(timesText: string) {
  return Array.from(
    new Set(
      timesText
        .split(",")
        .map((part) => part.trim())
        .filter((part) => /^\d{1,2}:\d{2}$/.test(part)),
    ),
  );
}

function deriveWeekdayFromDateInput(
  value: string,
): 0 | 1 | 2 | 3 | 4 | 5 | 6 | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

function toEditorState(
  plan?: RecurringPlan,
  options?: { duplicateMode?: boolean },
): PlanEditorState {
  const startDateInput =
    !options?.duplicateMode && plan?.startDate
      ? plan.startDate.slice(0, 16)
      : new Date().toISOString().slice(0, 16);
  const schedule = plan?.scheduleRule;
  const scheduleType = schedule?.type ?? "daily";
  let everyNInterval = 3;
  let weeklyDays: Array<0 | 1 | 2 | 3 | 4 | 5 | 6> = [
    deriveWeekdayFromDateInput(startDateInput) ?? 1,
  ];
  let monthlyMode: "day-of-month" | "nth-weekday" = "day-of-month";
  let monthlyDayOfMonth = "1";
  let monthlyNthWeekText: "1" | "2" | "3" | "4" | "5" | "-1" = "1";
  let monthlyWeekdayText: "0" | "1" | "2" | "3" | "4" | "5" | "6" = "1";

  if (schedule?.type === "every-n-days") {
    everyNInterval = Math.max(1, schedule.interval);
  }

  if (schedule?.type === "weekly" && schedule.daysOfWeek.length > 0) {
    weeklyDays = schedule.daysOfWeek;
  }

  if (schedule?.type === "monthly") {
    if (schedule.dayOfMonth) {
      monthlyDayOfMonth = String(schedule.dayOfMonth);
    }

    if (schedule.nthWeekday) {
      monthlyMode = "nth-weekday";
      monthlyNthWeekText = String(schedule.nthWeekday.weekOfMonth) as
        | "1"
        | "2"
        | "3"
        | "4"
        | "5"
        | "-1";
      monthlyWeekdayText = String(schedule.nthWeekday.weekday) as
        | "0"
        | "1"
        | "2"
        | "3"
        | "4"
        | "5"
        | "6";
    }
  }

  return {
    id: options?.duplicateMode || !plan ? `plan-${Date.now()}` : plan.id,
    title:
      options?.duplicateMode && plan
        ? `${plan.title} (copy)`
        : (plan?.title ?? ""),
    description: plan?.description ?? "",
    category: plan?.category ?? "",
    tagsText: (plan?.tags ?? []).join(", "),
    spaceIds: plan?.spaceIds?.length
      ? plan.spaceIds
      : plan?.spaceId
        ? [plan.spaceId]
        : [],
    timezone: plan?.timezone ?? defaultTimezone(),
    startDate: startDateInput,
    status: options?.duplicateMode ? "active" : (plan?.status ?? "active"),
    gracePeriodMinutesText:
      typeof plan?.gracePeriodMinutes === "number"
        ? String(plan.gracePeriodMinutes)
        : "",
    proofRequired: Boolean(plan?.proofRequired),
    smartMatchMode: plan?.smartMatchMode ?? "prompt",
    scheduleType,
    timesText: (schedule?.times ?? ["09:00"]).join(", "),
    everyNDaysIntervalText: String(everyNInterval),
    weeklyDays,
    monthlyMode,
    monthlyDayOfMonthText: monthlyDayOfMonth,
    monthlyNthWeekText,
    monthlyWeekdayText,
  };
}

function buildScheduleRule(state: PlanEditorState): RecurringPlanScheduleRule {
  const times = parseTimes(state.timesText);

  if (state.scheduleType === "every-n-days") {
    return {
      type: "every-n-days",
      interval: Math.max(
        1,
        Number.parseInt(state.everyNDaysIntervalText, 10) || 1,
      ),
      times,
    };
  }

  if (state.scheduleType === "weekly") {
    return {
      type: "weekly",
      daysOfWeek: state.weeklyDays,
      times,
    };
  }

  if (state.scheduleType === "monthly") {
    if (state.monthlyMode === "nth-weekday") {
      return {
        type: "monthly",
        times,
        nthWeekday: {
          weekOfMonth: Number.parseInt(state.monthlyNthWeekText, 10) as
            | 1
            | 2
            | 3
            | 4
            | 5
            | -1,
          weekday: Number.parseInt(state.monthlyWeekdayText, 10) as
            | 0
            | 1
            | 2
            | 3
            | 4
            | 5
            | 6,
        },
      };
    }

    return {
      type: "monthly",
      times,
      dayOfMonth: Math.max(
        1,
        Math.min(31, Number.parseInt(state.monthlyDayOfMonthText, 10) || 1),
      ),
    };
  }

  return {
    type: "daily",
    times,
  };
}

function formatErrors(errors?: Record<string, string>) {
  if (!errors || Object.keys(errors).length === 0) return null;
  return Object.entries(errors)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

export default function RecurringPlanEditorScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const theme = useTheme<MD3Theme>();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const params = useLocalSearchParams<{
    planId?: string;
    duplicateFromPlanId?: string;
    from?: string;
  }>();

  const planId = pickParam(params.planId);
  const duplicateFromPlanId = pickParam(params.duplicateFromPlanId);
  const from = pickParam(params.from);

  const { workspace, saveRecurringPlan } = useWorkspace();

  const editingPlan = planId
    ? workspace.recurringPlans.find((item) => item.id === planId)
    : undefined;
  const duplicateSourcePlan = duplicateFromPlanId
    ? workspace.recurringPlans.find((item) => item.id === duplicateFromPlanId)
    : undefined;
  const duplicateMode = !editingPlan && Boolean(duplicateSourcePlan);
  const editorSeedPlan = editingPlan ?? duplicateSourcePlan;

  const [state, setState] = useState<PlanEditorState>(() =>
    toEditorState(editorSeedPlan, { duplicateMode }),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const spaces = workspace.spaces;
  const selectedSpaces = spaces.filter((space) =>
    state.spaceIds.includes(space.id),
  );

  function updateState(patch: Partial<PlanEditorState>) {
    setState((current) => ({ ...current, ...patch }));
    setSaveErrors({});
    setStatusMessage(null);
  }

  function toggleWeeklyDay(day: 0 | 1 | 2 | 3 | 4 | 5 | 6) {
    const hasDay = state.weeklyDays.includes(day);
    const nextDays = hasDay
      ? state.weeklyDays.filter((value) => value !== day)
      : [...state.weeklyDays, day];

    updateState({ weeklyDays: nextDays.sort((left, right) => left - right) });
  }

  function toggleSpace(spaceId: string) {
    const hasSpace = state.spaceIds.includes(spaceId);
    const nextSpaceIds = hasSpace
      ? state.spaceIds.filter((value) => value !== spaceId)
      : [...state.spaceIds, spaceId];
    updateState({ spaceIds: nextSpaceIds });
  }

  function onSave() {
    const startDateIso = parseIsoDateInput(state.startDate);
    if (!startDateIso) {
      setSaveErrors({ startDate: "Start date/time must be valid." });
      setStatusMessage("Fix the start date before saving.");
      return;
    }

    const tags = state.tagsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (state.spaceIds.length === 0) {
      setSaveErrors({ spaceId: "Pick at least one space." });
      setStatusMessage("Select one or more spaces before saving.");
      return;
    }

    const primarySpaceId = state.spaceIds[0];

    const result = saveRecurringPlan({
      id: state.id,
      spaceId: primarySpaceId,
      spaceIds: state.spaceIds,
      title: state.title,
      description: state.description || undefined,
      category: state.category || undefined,
      tags: tags.length > 0 ? tags : undefined,
      scheduleRule: buildScheduleRule(state),
      startDate: startDateIso,
      timezone: state.timezone.trim(),
      gracePeriodMinutes: state.gracePeriodMinutesText.trim()
        ? Math.max(0, Number.parseInt(state.gracePeriodMinutesText, 10) || 0)
        : undefined,
      proofRequired: state.proofRequired,
      smartMatchMode: state.smartMatchMode,
      status: state.status,
    });

    if (result.status === "invalid") {
      setSaveErrors(result.errors ?? {});
      setStatusMessage(formatErrors(result.errors) ?? result.message);
      return;
    }

    setStatusMessage(result.message);

    const returnRoute =
      from === "action-center" ? "/action-center" : "/planner";
    router.replace(returnRoute as never);
  }

  return (
    <ScrollView
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={styles.content}
      scrollEventThrottle={Platform.OS === "web" ? 64 : 32}
      removeClippedSubviews={Platform.OS === "android"}
      nestedScrollEnabled={Platform.OS === "android"}
    >
      <Stack.Screen
        options={{
          title: editingPlan
            ? "Edit recurring plan"
            : duplicateMode
              ? "Duplicate recurring plan"
              : "New recurring plan",
        }}
      />

      <ScreenHero
        palette={palette}
        title={
          editingPlan
            ? "Edit recurring plan"
            : duplicateMode
              ? "Duplicate recurring plan"
              : "Create recurring plan"
        }
        subtitle="Define a reusable schedule with timezone-safe timing, grace windows, and optional proof capture."
        badges={[
          {
            label:
              selectedSpaces.length > 0
                ? `${selectedSpaces.length} space${selectedSpaces.length === 1 ? "" : "s"}`
                : "Pick spaces",
            backgroundColor:
              selectedSpaces[0]?.themeColor ?? theme.colors.primaryContainer,
            textColor: theme.colors.onPrimaryContainer,
          },
          {
            label: state.scheduleType,
            backgroundColor: theme.colors.surface,
            textColor: theme.colors.onSurface,
          },
          {
            label: state.proofRequired ? "Proof required" : "Proof optional",
            backgroundColor: theme.colors.secondaryContainer,
            textColor: theme.colors.onSecondaryContainer,
          },
        ]}
      />

      <Surface
        style={[styles.sectionCard, paletteStyles.cardSurface]}
        elevation={1}
      >
        <Text style={styles.sectionTitle}>Plan details</Text>

        <TextInput
          mode="outlined"
          label="Title"
          value={state.title}
          onChangeText={(title) => updateState({ title })}
          error={Boolean(saveErrors.title)}
          style={styles.field}
        />

        <TextInput
          mode="outlined"
          label="Description (optional)"
          value={state.description}
          onChangeText={(description) => updateState({ description })}
          multiline
          style={styles.field}
        />

        <TextInput
          mode="outlined"
          label="Category (optional)"
          value={state.category}
          onChangeText={(category) => updateState({ category })}
          style={styles.field}
        />

        <TextInput
          mode="outlined"
          label="Tags (comma separated)"
          value={state.tagsText}
          onChangeText={(tagsText) => updateState({ tagsText })}
          style={styles.field}
        />

        <Text style={[styles.fieldLabel, paletteStyles.mutedText]}>Spaces</Text>
        <ChipRow style={styles.choiceRow}>
          {spaces.map((space) => (
            <Chip
              key={space.id}
              selected={state.spaceIds.includes(space.id)}
              onPress={() => toggleSpace(space.id)}
              style={styles.choiceChip}
            >
              {space.name}
            </Chip>
          ))}
        </ChipRow>
        {saveErrors.spaceId ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {saveErrors.spaceId}
          </Text>
        ) : null}

        <TextInput
          mode="outlined"
          label="Start date/time (ISO or local input)"
          value={state.startDate}
          onChangeText={(startDate) => {
            if (state.scheduleType !== "weekly") {
              updateState({ startDate });
              return;
            }

            const nextWeekday = deriveWeekdayFromDateInput(startDate);
            const previousWeekday = deriveWeekdayFromDateInput(state.startDate);
            const shouldSyncWeeklyDayToStartDate =
              typeof nextWeekday === "number" &&
              typeof previousWeekday === "number" &&
              state.weeklyDays.length === 1 &&
              state.weeklyDays[0] === previousWeekday;

            if (shouldSyncWeeklyDayToStartDate) {
              updateState({ startDate, weeklyDays: [nextWeekday] });
              return;
            }

            updateState({ startDate });
          }}
          error={Boolean(saveErrors.startDate)}
          style={styles.field}
        />

        <TextInput
          mode="outlined"
          label="Timezone"
          value={state.timezone}
          onChangeText={(timezone) => updateState({ timezone })}
          error={Boolean(saveErrors.timezone)}
          style={styles.field}
        />
      </Surface>

      <Surface
        style={[styles.sectionCard, paletteStyles.cardSurface]}
        elevation={1}
      >
        <Text style={styles.sectionTitle}>Schedule</Text>

        <SegmentedButtons
          value={state.scheduleType}
          onValueChange={(value) => {
            const nextScheduleType = value as ScheduleKind;
            if (nextScheduleType !== "weekly") {
              updateState({ scheduleType: nextScheduleType });
              return;
            }

            const startWeekday = deriveWeekdayFromDateInput(state.startDate);
            updateState({
              scheduleType: nextScheduleType,
              weeklyDays:
                typeof startWeekday === "number"
                  ? [startWeekday]
                  : state.weeklyDays.length > 0
                    ? state.weeklyDays
                    : [1],
            });
          }}
          buttons={[
            { value: "daily", label: "Daily" },
            { value: "every-n-days", label: "Every N days" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]}
          style={styles.segmented}
        />

        <TextInput
          mode="outlined"
          label="Times (comma separated HH:mm)"
          value={state.timesText}
          onChangeText={(timesText) => updateState({ timesText })}
          error={Boolean(saveErrors.schedule)}
          style={styles.field}
        />

        {state.scheduleType === "every-n-days" ? (
          <TextInput
            mode="outlined"
            label="Interval (days)"
            value={state.everyNDaysIntervalText}
            onChangeText={(everyNDaysIntervalText) =>
              updateState({ everyNDaysIntervalText })
            }
            keyboardType="number-pad"
            style={styles.field}
          />
        ) : null}

        {state.scheduleType === "weekly" ? (
          <>
            <Text style={[styles.fieldLabel, paletteStyles.mutedText]}>
              Weekdays
            </Text>
            <ChipRow style={styles.choiceRow}>
              {weekdayChoices.map((day) => (
                <Chip
                  key={day.value}
                  selected={state.weeklyDays.includes(day.value)}
                  onPress={() => toggleWeeklyDay(day.value)}
                  style={styles.choiceChip}
                >
                  {day.label}
                </Chip>
              ))}
            </ChipRow>
          </>
        ) : null}

        {state.scheduleType === "monthly" ? (
          <>
            <SegmentedButtons
              value={state.monthlyMode}
              onValueChange={(value) =>
                updateState({
                  monthlyMode: value as "day-of-month" | "nth-weekday",
                })
              }
              buttons={[
                { value: "day-of-month", label: "Day of month" },
                { value: "nth-weekday", label: "Nth weekday" },
              ]}
              style={styles.segmented}
            />

            {state.monthlyMode === "day-of-month" ? (
              <TextInput
                mode="outlined"
                label="Day of month (1-31)"
                value={state.monthlyDayOfMonthText}
                onChangeText={(monthlyDayOfMonthText) =>
                  updateState({ monthlyDayOfMonthText })
                }
                keyboardType="number-pad"
                style={styles.field}
              />
            ) : (
              <>
                <SegmentedButtons
                  value={state.monthlyNthWeekText}
                  onValueChange={(value) =>
                    updateState({
                      monthlyNthWeekText: value as
                        | "1"
                        | "2"
                        | "3"
                        | "4"
                        | "5"
                        | "-1",
                    })
                  }
                  buttons={[
                    { value: "1", label: "1st" },
                    { value: "2", label: "2nd" },
                    { value: "3", label: "3rd" },
                    { value: "4", label: "4th" },
                    { value: "5", label: "5th" },
                    { value: "-1", label: "Last" },
                  ]}
                  style={styles.segmented}
                />

                <SegmentedButtons
                  value={state.monthlyWeekdayText}
                  onValueChange={(value) =>
                    updateState({
                      monthlyWeekdayText: value as
                        | "0"
                        | "1"
                        | "2"
                        | "3"
                        | "4"
                        | "5"
                        | "6",
                    })
                  }
                  buttons={weekdayChoices.map((day) => ({
                    value: String(day.value),
                    label: day.label,
                  }))}
                  style={styles.segmented}
                />
              </>
            )}
          </>
        ) : null}

        {saveErrors.schedule ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {saveErrors.schedule}
          </Text>
        ) : null}
      </Surface>

      <Surface
        style={[styles.sectionCard, paletteStyles.cardSurface]}
        elevation={1}
      >
        <Text style={styles.sectionTitle}>Behavior and tracking</Text>

        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Proof required</Text>
            <Text style={[styles.switchDescription, paletteStyles.mutedText]}>
              Requires a linked log before an occurrence can be completed.
            </Text>
          </View>
          <Switch
            value={state.proofRequired}
            onValueChange={(proofRequired) => updateState({ proofRequired })}
          />
        </View>

        <TextInput
          mode="outlined"
          label="Grace period minutes (blank = end of local day)"
          value={state.gracePeriodMinutesText}
          onChangeText={(gracePeriodMinutesText) =>
            updateState({ gracePeriodMinutesText })
          }
          keyboardType="number-pad"
          style={styles.field}
        />

        <Text style={[styles.fieldLabel, paletteStyles.mutedText]}>
          Smart matching
        </Text>
        <SegmentedButtons
          value={state.smartMatchMode}
          onValueChange={(value) =>
            updateState({ smartMatchMode: value as RecurringSmartMatchMode })
          }
          buttons={[
            { value: "off", label: "Off" },
            { value: "prompt", label: "Prompt" },
            { value: "auto", label: "Auto" },
          ]}
          style={styles.segmented}
        />

        <Text style={[styles.fieldLabel, paletteStyles.mutedText]}>
          Plan status
        </Text>
        <SegmentedButtons
          value={state.status}
          onValueChange={(value) =>
            updateState({ status: value as RecurringPlan["status"] })
          }
          buttons={[
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
            { value: "archived", label: "Archived" },
          ]}
          style={styles.segmented}
        />

        {saveErrors.smartMatchMode ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {saveErrors.smartMatchMode}
          </Text>
        ) : null}
      </Surface>

      {statusMessage ? (
        <Surface
          style={[styles.sectionCard, paletteStyles.cardSurface]}
          elevation={1}
        >
          <Text style={styles.sectionTitle}>Save status</Text>
          <Text style={[styles.statusText, paletteStyles.mutedText]}>
            {statusMessage}
          </Text>
        </Surface>
      ) : null}

      <ActionButtonRow style={styles.footerRow}>
        <Button mode="outlined" onPress={() => router.back()}>
          Cancel
        </Button>
        <Button mode="contained" onPress={onSave}>
          {editingPlan
            ? "Save changes"
            : duplicateMode
              ? "Create duplicate"
              : "Create plan"}
        </Button>
      </ActionButtonRow>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: uiSpace.screen,
    paddingBottom: uiSpace.screenBottom,
  },
  sectionCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    marginBottom: uiSpace.xl,
  },
  sectionTitle: {
    ...uiTypography.titleMd,
    marginBottom: uiSpace.md,
  },
  field: {
    marginBottom: uiSpace.md,
  },
  fieldLabel: {
    ...uiTypography.label,
    marginBottom: uiSpace.sm,
  },
  segmented: {
    marginBottom: uiSpace.md,
  },
  choiceRow: {
    marginBottom: uiSpace.md,
  },
  choiceChip: {
    borderRadius: uiRadius.pill,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: uiSpace.md,
    marginBottom: uiSpace.md,
  },
  switchCopy: {
    flex: 1,
  },
  switchTitle: {
    ...uiTypography.bodyStrong,
  },
  switchDescription: {
    ...uiTypography.support,
    marginTop: uiSpace.xs,
  },
  errorText: {
    ...uiTypography.support,
    marginTop: uiSpace.xs,
  },
  statusText: {
    ...uiTypography.body,
    lineHeight: 20,
  },
  footerRow: {
    marginTop: uiSpace.sm,
    marginBottom: uiSpace.md,
  },
});
