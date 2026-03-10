import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Button, Chip } from "react-native-paper";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
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

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Planner calendar</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Recurring schedules, conditional reminders, snooze/skip actions, and
          reminder history across every space.
        </Text>
      </View>

      <View
        style={[
          styles.calendarCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
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
              style={[styles.weekdayLabel, { color: palette.muted }]}
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
                    style={[styles.calendarDayMeta, { color: palette.muted }]}
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
      </View>

      <View
        style={[
          styles.dayAgendaCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>Selected day agenda</Text>
        <Text style={[styles.selectedDateMeta, { color: palette.muted }]}>
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
                <Text style={[styles.copy, { color: palette.muted }]}>
                  {space?.name ?? "Unknown space"} • Due{" "}
                  {formatDue(getReminderScheduleTimestamp(reminder))}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={[styles.copy, { color: palette.muted }]}>
            No reminders are scheduled for this day.
          </Text>
        )}
      </View>

      {plannerGroups.map((group) => (
        <View key={group.label} style={styles.group}>
          <Text style={styles.groupTitle}>{group.label}</Text>
          {group.reminders.map((reminder) => {
            const space = group.spacesById.get(reminder.spaceId);

            return (
              <View
                key={reminder.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                    borderLeftColor: space?.themeColor ?? palette.tint,
                  },
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
                <Text style={[styles.copy, { color: palette.muted }]}>
                  {reminder.description}
                </Text>
                <Text style={[styles.copy, { color: palette.muted }]}>
                  Due {formatDue(reminder.snoozedUntil ?? reminder.dueAt)}
                </Text>
                {reminder.ruleLabel || reminder.triggerCondition ? (
                  <Text style={[styles.copy, { color: palette.muted }]}>
                    {reminder.ruleLabel ?? reminder.triggerCondition}
                  </Text>
                ) : null}
                {reminder.skipReason ? (
                  <Text style={[styles.copy, { color: palette.muted }]}>
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
                    style={[styles.historyItem, { color: palette.muted }]}
                  >
                    • {item.action} — {item.note}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 18 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calendarTitle: { fontSize: 18, fontWeight: "700" },
  weekdayRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
  calendarWeek: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  calendarDay: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  calendarDayLabel: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  calendarDayMeta: { fontSize: 11, lineHeight: 16 },
  dayAgendaCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  selectedDateMeta: { fontSize: 12, fontWeight: "700", marginBottom: 10 },
  dayAgendaItem: { marginBottom: 10 },
  group: { marginBottom: 18 },
  groupTitle: { fontSize: 18, fontWeight: "700", marginBottom: 10 },
  card: {
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", marginBottom: 6 },
  listTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  meta: { fontSize: 12, fontWeight: "700" },
  copy: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 10 },
  button: { flex: 1 },
  historyItem: { fontSize: 12, lineHeight: 18, marginTop: 2 },
});
