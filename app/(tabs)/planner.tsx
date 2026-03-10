import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Button, Chip, Surface } from "react-native-paper";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    uiBorder,
    uiElevation,
    uiRadius,
    uiShadow,
    uiSize,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
    buildReminderCalendar,
    getReminderDateKey,
    getReminderScheduleTimestamp,
} from "@/services/insights/workspaceInsights";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDue(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PlannerScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const { completeReminder, skipReminder, snoozeReminder, workspace } =
    useWorkspace();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

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
  const plannerHighlights = [
    `${workspace.reminders.length} reminders tracked`,
    `${selectedDayReminders.length} on the selected day`,
    `${plannerGroups.length} upcoming day groups`,
  ];

  return (
    <ScrollView
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={styles.content}
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
                  <Text style={styles.calendarDayLabel}>{cell.label}</Text>
                  <Text
                    style={[styles.calendarDayMeta, paletteStyles.mutedText]}
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

      <View style={[styles.dayAgendaCard, paletteStyles.raisedCardSurface]}>
        <Text style={styles.sectionTitle}>Selected day agenda</Text>
        <Text style={[styles.selectedDateMeta, paletteStyles.mutedText]}>
          {activeDateKey}
        </Text>
        {selectedDayReminders.length > 0 ? (
          selectedDayReminders.map((reminder) => {
            const space = workspace.spaces.find(
              (item) => item.id === reminder.spaceId,
            );

            return (
              <View key={reminder.id} style={styles.dayAgendaItem}>
                <Text style={styles.listTitle}>{reminder.title}</Text>
                <Text style={[styles.copy, paletteStyles.mutedText]}>
                  {space?.name ?? "Unknown space"} • Due{" "}
                  {formatDue(getReminderScheduleTimestamp(reminder))}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={[styles.copy, paletteStyles.mutedText]}>
            No reminders are scheduled for this day.
          </Text>
        )}
      </View>

      {plannerGroups.length === 0 ? (
        <View
          style={[
            styles.card,
            paletteStyles.raisedCardSurface,
            { borderLeftColor: palette.border },
          ]}
        >
          <Text style={styles.cardTitle}>No reminders yet</Text>
          <Text style={[styles.copy, paletteStyles.mutedText]}>
            Upcoming reminders will appear here when real workspace tasks are
            synced, imported, or created.
          </Text>
        </View>
      ) : (
        plannerGroups.map((group) => (
          <View key={group.label} style={styles.group}>
            <Text style={styles.groupTitle}>{group.label}</Text>
            {group.reminders.map((reminder) => {
              const space = group.spacesById.get(reminder.spaceId);

              return (
                <View
                  key={reminder.id}
                  style={[
                    styles.card,
                    paletteStyles.raisedCardSurface,
                    { borderLeftColor: space?.themeColor ?? palette.tint },
                  ]}
                >
                  <Text style={styles.cardTitle}>{reminder.title}</Text>
                  <View style={styles.metaRow}>
                    <Text
                      style={[
                        styles.meta,
                        { color: space?.themeColor ?? palette.tint },
                      ]}
                    >
                      {space?.name ?? "Unknown space"}
                    </Text>
                    <Chip compact>{reminder.status.toUpperCase()}</Chip>
                  </View>
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    {reminder.description}
                  </Text>
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    Due {formatDue(reminder.snoozedUntil ?? reminder.dueAt)}
                  </Text>
                  {reminder.ruleLabel || reminder.triggerCondition ? (
                    <Text style={[styles.copy, paletteStyles.mutedText]}>
                      {reminder.ruleLabel ?? reminder.triggerCondition}
                    </Text>
                  ) : null}
                  {reminder.skipReason ? (
                    <Text style={[styles.copy, paletteStyles.mutedText]}>
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

                  {(reminder.history ?? []).slice(0, 2).map((item) => (
                    <Text
                      key={item.id}
                      style={[styles.historyItem, paletteStyles.mutedText]}
                    >
                      • {item.action} — {item.note}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
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
    ...uiShadow.raisedCard,
    elevation: uiElevation.raisedCard,
  },
  sectionTitle: { ...uiTypography.titleMd, fontWeight: "800", marginBottom: 6 },
  selectedDateMeta: { ...uiTypography.chip, marginBottom: uiSpace.md },
  dayAgendaItem: { marginBottom: uiSpace.md },
  group: { marginBottom: uiSpace.xs },
  groupTitle: { ...uiTypography.titleLg, marginBottom: uiSpace.md },
  card: {
    borderWidth: uiBorder.standard,
    borderLeftWidth: 5,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    marginBottom: uiSpace.lg,
    ...uiShadow.raisedCard,
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
    gap: uiSpace.sm,
    marginTop: uiSpace.lg,
    marginBottom: uiSpace.md,
  },
  button: { flex: 1 },
  historyItem: { ...uiTypography.support, marginTop: uiSpace.xxs },
});
