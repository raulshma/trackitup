import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import {
    Button,
    Chip,
    Surface,
    useTheme,
    type MD3Theme,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
import { MotionPressable, MotionView } from "@/components/ui/Motion";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors, { withAlpha } from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    uiBorder,
    uiRadius,
    uiSize,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import type {
    LogEntry,
    LogKind,
    RecurringOccurrenceStatus,
} from "@/types/trackitup";

const weekdayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const logKindLabels: Record<LogKind, string> = {
  "asset-update": "Asset update",
  "metric-reading": "Metric reading",
  reminder: "Reminder",
  "routine-run": "Routine run",
};

function toDayKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(value: Date) {
  return `${value.getFullYear()}-${`${value.getMonth() + 1}`.padStart(2, "0")}`;
}

function parseMonthKey(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  return { year, month };
}

function startOfMonthDate(monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month - 1, 1);
}

function getKindAccent(
  kind: LogKind,
  palette: (typeof Colors)["light"],
  theme: MD3Theme,
) {
  switch (kind) {
    case "metric-reading":
      return palette.tertiary;
    case "routine-run":
      return palette.secondary;
    case "reminder":
      return theme.colors.primary;
    case "asset-update":
    default:
      return palette.tint;
  }
}

function getRecurringStatusAccent(
  status: RecurringOccurrenceStatus,
  palette: (typeof Colors)["light"],
  theme: MD3Theme,
) {
  if (status === "completed") return theme.colors.primary;
  if (status === "missed") return theme.colors.error;
  if (status === "skipped") return theme.colors.tertiary;
  return palette.secondary;
}

function findPreviousMonthKey(monthKey: string, allMonths: string[]) {
  const index = allMonths.indexOf(monthKey);
  if (index < 0 || index === allMonths.length - 1) return monthKey;
  return allMonths[index + 1];
}

function findNextMonthKey(monthKey: string, allMonths: string[]) {
  const index = allMonths.indexOf(monthKey);
  if (index <= 0) return monthKey;
  return allMonths[index - 1];
}

export default function LogCalendarScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const theme = useTheme<MD3Theme>();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const { isHydrated, logEntries, workspace } = useWorkspace();

  const logsByDay = useMemo(() => {
    const map = new Map<string, LogEntry[]>();

    [...logEntries]
      .filter((entry) => !Number.isNaN(new Date(entry.occurredAt).getTime()))
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime(),
      )
      .forEach((entry) => {
        const key = toDayKey(new Date(entry.occurredAt));
        const existing = map.get(key) ?? [];
        existing.push(entry);
        map.set(key, existing);
      });

    return map;
  }, [logEntries]);

  const recurringByDay = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        occurrenceId: string;
        planId: string;
        title: string;
        status: RecurringOccurrenceStatus;
        dueAt: string;
      }>
    >();
    const plansById = new Map(
      workspace.recurringPlans.map((plan) => [plan.id, plan] as const),
    );

    workspace.recurringOccurrences.forEach((occurrence) => {
      const plan = plansById.get(occurrence.planId);
      if (!plan) return;

      const key = toDayKey(new Date(occurrence.dueAt));
      map.set(key, [
        ...(map.get(key) ?? []),
        {
          occurrenceId: occurrence.id,
          planId: plan.id,
          title: plan.title,
          status: occurrence.status,
          dueAt: occurrence.snoozedUntil ?? occurrence.dueAt,
        },
      ]);
    });

    map.forEach((items, key) => {
      map.set(
        key,
        [...items].sort((left, right) => left.dueAt.localeCompare(right.dueAt)),
      );
    });

    return map;
  }, [workspace.recurringOccurrences, workspace.recurringPlans]);

  const monthKeys = useMemo(() => {
    const keys = new Set<string>();
    logsByDay.forEach((_, dayKey) => keys.add(dayKey.slice(0, 7)));
    recurringByDay.forEach((_, dayKey) => keys.add(dayKey.slice(0, 7)));

    if (keys.size === 0) {
      keys.add(toMonthKey(new Date()));
    }

    return [...keys].sort((left, right) => right.localeCompare(left));
  }, [logsByDay, recurringByDay]);

  const fallbackMonth = monthKeys[0] ?? toMonthKey(new Date());
  const [activeMonthKey, setActiveMonthKey] = useState(fallbackMonth);

  useEffect(() => {
    if (!monthKeys.includes(activeMonthKey)) {
      setActiveMonthKey(monthKeys[0] ?? toMonthKey(new Date()));
    }
  }, [activeMonthKey, monthKeys]);

  const activeMonthDate = useMemo(
    () => startOfMonthDate(activeMonthKey),
    [activeMonthKey],
  );

  const monthDayKeys = useMemo(() => {
    const { year, month } = parseMonthKey(activeMonthKey);
    const daysInMonth = new Date(year, month, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = `${index + 1}`.padStart(2, "0");
      return `${activeMonthKey}-${day}`;
    });
  }, [activeMonthKey]);

  const defaultDayForMonth = useMemo(() => {
    const firstDayWithLogs = monthDayKeys.find(
      (dayKey) => (logsByDay.get(dayKey)?.length ?? 0) > 0,
    );
    return firstDayWithLogs ?? monthDayKeys[0] ?? toDayKey(new Date());
  }, [logsByDay, monthDayKeys]);

  const [selectedDayKey, setSelectedDayKey] = useState(defaultDayForMonth);

  useEffect(() => {
    if (!monthDayKeys.includes(selectedDayKey)) {
      setSelectedDayKey(defaultDayForMonth);
    }
  }, [defaultDayForMonth, monthDayKeys, selectedDayKey]);

  const selectedDayLogs = logsByDay.get(selectedDayKey) ?? [];
  const selectedDayRecurring = recurringByDay.get(selectedDayKey) ?? [];
  const selectedDayDate = useMemo(
    () => new Date(`${selectedDayKey}T12:00:00`),
    [selectedDayKey],
  );

  const isTodayVisible = monthDayKeys.includes(toDayKey(new Date()));

  const monthSummary = useMemo<{
    count: number;
    activeDays: number;
    busiest: { key: string; count: number } | null;
  }>(() => {
    let count = 0;
    let activeDays = 0;
    let busiest: { key: string; count: number } | null = null;

    monthDayKeys.forEach((dayKey) => {
      const dayCount = logsByDay.get(dayKey)?.length ?? 0;
      count += dayCount;

      if (dayCount > 0) {
        activeDays += 1;
      }

      if (!busiest || dayCount > busiest.count) {
        busiest = { key: dayKey, count: dayCount };
      }
    });

    return {
      count,
      activeDays,
      busiest,
    };
  }, [logsByDay, monthDayKeys]);

  const spacesById = useMemo(
    () => new Map(workspace.spaces.map((space) => [space.id, space] as const)),
    [workspace.spaces],
  );

  const firstWeekdayOffset = useMemo(() => {
    const jsWeekday = activeMonthDate.getDay();
    return (jsWeekday + 6) % 7;
  }, [activeMonthDate]);

  const calendarCells = useMemo(() => {
    const emptyLeadingCells = Array.from(
      { length: firstWeekdayOffset },
      () => null as string | null,
    );
    return [...emptyLeadingCells, ...monthDayKeys];
  }, [firstWeekdayOffset, monthDayKeys]);

  const pageQuickActions = [
    {
      id: "log-calendar-new-log",
      label: "Record new log",
      hint: "Capture another event to populate this calendar in real time.",
      onPress: () => router.push("/logbook"),
      accentColor: palette.tint,
    },
    {
      id: "log-calendar-latest",
      label: "Open latest log",
      hint:
        logEntries.length > 0
          ? "Jump straight into the newest entry and all of its context."
          : "No logs yet — start your first one from Logbook.",
      onPress: () => {
        const latestLog = [...logEntries]
          .sort(
            (left, right) =>
              new Date(right.occurredAt).getTime() -
              new Date(left.occurredAt).getTime(),
          )
          .at(0);

        if (latestLog) {
          router.push(`/logbook?entryId=${latestLog.id}` as never);
          return;
        }

        router.push("/logbook");
      },
      accentColor: palette.secondary,
    },
    {
      id: "log-calendar-visual-history",
      label: "Open visual history",
      hint: "Cross-reference photos and proof captures with day-level logs.",
      onPress: () => router.push("/visual-history"),
      accentColor: palette.tertiary,
    },
  ];

  if (!isHydrated) {
    return (
      <View style={[styles.centeredState, paletteStyles.screenBackground]}>
        <Text style={styles.loadingTitle}>Loading calendar timeline…</Text>
        <Text style={[styles.loadingCopy, paletteStyles.mutedText]}>
          Hydrating your workspace logs before rendering day-level history.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={styles.content}
      scrollEventThrottle={Platform.OS === "web" ? 64 : 32}
      removeClippedSubviews={Platform.OS === "android"}
      nestedScrollEnabled={Platform.OS === "android"}
    >
      <ScreenHero
        palette={palette}
        eyebrow="Workspace timeline"
        title="Log calendar"
        subtitle="See every log mapped to calendar days, identify dense activity windows, and drill into exact entries without leaving the timeline context."
        badges={[
          {
            label: `${logEntries.length} total log${logEntries.length === 1 ? "" : "s"}`,
            backgroundColor: palette.card,
            textColor: palette.tint,
          },
          {
            label: `${monthSummary.count} this month`,
            backgroundColor: palette.accentSoft,
          },
          {
            label: `${monthSummary.activeDays} active day${monthSummary.activeDays === 1 ? "" : "s"}`,
            backgroundColor: palette.card,
          },
        ]}
      />

      <PageQuickActions
        palette={palette}
        actions={pageQuickActions}
        title="Navigate from the calendar"
        description="Move quickly between logging, visual proof, and detailed entry inspection while preserving timeline context."
      />

      <SectionSurface
        palette={palette}
        label="Calendar"
        title="Monthly log density"
      >
        <View style={styles.monthHeaderRow}>
          <View style={styles.monthHeaderCopy}>
            <Text style={styles.monthTitle}>
              {monthFormatter.format(activeMonthDate)}
            </Text>
            <Text style={[styles.monthMeta, paletteStyles.mutedText]}>
              {monthSummary.count} log{monthSummary.count === 1 ? "" : "s"}{" "}
              across {monthSummary.activeDays} day
              {monthSummary.activeDays === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.monthActionRow}>
            <Button
              mode="outlined"
              compact
              onPress={() =>
                setActiveMonthKey(
                  findPreviousMonthKey(activeMonthKey, monthKeys),
                )
              }
              disabled={
                monthKeys.indexOf(activeMonthKey) === monthKeys.length - 1
              }
            >
              Prev
            </Button>
            <Button
              mode="outlined"
              compact
              onPress={() =>
                setActiveMonthKey(findNextMonthKey(activeMonthKey, monthKeys))
              }
              disabled={monthKeys.indexOf(activeMonthKey) === 0}
            >
              Next
            </Button>
            <Button
              mode="contained-tonal"
              compact
              onPress={() => {
                const today = toDayKey(new Date());
                setActiveMonthKey(today.slice(0, 7));
                setSelectedDayKey(today);
              }}
              disabled={
                !isTodayVisible && activeMonthKey === toMonthKey(new Date())
              }
            >
              Today
            </Button>
          </View>
        </View>

        <ChipRow style={styles.monthStatsRow}>
          <Chip compact icon="calendar-check-outline" style={styles.metaChip}>
            {monthSummary.activeDays} active day
            {monthSummary.activeDays === 1 ? "" : "s"}
          </Chip>
          <Chip compact icon="format-list-bulleted" style={styles.metaChip}>
            {monthSummary.count} entries this month
          </Chip>
          {monthSummary.busiest && monthSummary.busiest.count > 0 ? (
            <Chip compact icon="fire" style={styles.metaChip}>
              Peak: {monthSummary.busiest.count} on{" "}
              {new Date(`${monthSummary.busiest.key}T12:00:00`).getDate()}
            </Chip>
          ) : null}
        </ChipRow>

        <View style={styles.weekdayRow}>
          {weekdayHeaders.map((weekday) => (
            <Text
              key={weekday}
              style={[styles.weekdayLabel, paletteStyles.mutedText]}
            >
              {weekday}
            </Text>
          ))}
        </View>

        <View style={styles.gridWrap}>
          {calendarCells.map((dayKey, index) => {
            if (!dayKey) {
              return (
                <View key={`empty-${index}`} style={styles.emptyDayCell} />
              );
            }

            const dayLogs = logsByDay.get(dayKey) ?? [];
            const dayRecurring = recurringByDay.get(dayKey) ?? [];
            const isSelected = dayKey === selectedDayKey;
            const isToday = dayKey === toDayKey(new Date());
            const hasLogs = dayLogs.length > 0;
            const hasRecurring = dayRecurring.length > 0;
            const uniqueKinds = Array.from(
              new Set(dayLogs.map((entry) => entry.kind)),
            ).slice(0, 3);
            const recurringStatuses = Array.from(
              new Set(dayRecurring.map((entry) => entry.status)),
            ).slice(0, 3);

            return (
              <MotionView key={dayKey} style={styles.dayCellWrap}>
                <MotionPressable
                  accessibilityLabel={`View logs for ${dayFormatter.format(new Date(`${dayKey}T12:00:00`))}`}
                  onPress={() => setSelectedDayKey(dayKey)}
                  style={[
                    styles.dayCell,
                    {
                      backgroundColor: isSelected
                        ? theme.colors.primaryContainer
                        : hasLogs
                          ? theme.colors.elevation.level2
                          : theme.colors.elevation.level1,
                      borderColor: isSelected
                        ? theme.colors.primary
                        : isToday
                          ? palette.secondary
                          : theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <View style={styles.dayCellHeader}>
                    <Text
                      style={[
                        styles.dayNumber,
                        {
                          color: isSelected
                            ? theme.colors.onPrimaryContainer
                            : theme.colors.onSurface,
                        },
                      ]}
                    >
                      {new Date(`${dayKey}T12:00:00`).getDate()}
                    </Text>
                    {isToday ? (
                      <View
                        style={[
                          styles.todayBadge,
                          {
                            backgroundColor: withAlpha(palette.secondary, 0.18),
                            borderColor: withAlpha(palette.secondary, 0.32),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.todayBadgeLabel,
                            { color: palette.secondary },
                          ]}
                        >
                          Now
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {hasLogs ? (
                    <>
                      <View style={styles.kindDotsRow}>
                        {uniqueKinds.map((kind) => (
                          <View
                            key={`${dayKey}-${kind}`}
                            style={[
                              styles.kindDot,
                              {
                                backgroundColor: getKindAccent(
                                  kind,
                                  palette,
                                  theme,
                                ),
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text
                        style={[
                          styles.dayCount,
                          {
                            color: isSelected
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {dayLogs.length} log{dayLogs.length === 1 ? "" : "s"}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.noLogText, paletteStyles.mutedText]}>
                      No logs
                    </Text>
                  )}
                  {hasRecurring ? (
                    <>
                      <View style={styles.kindDotsRow}>
                        {recurringStatuses.map((status) => (
                          <View
                            key={`${dayKey}-${status}`}
                            style={[
                              styles.kindDot,
                              {
                                backgroundColor: getRecurringStatusAccent(
                                  status,
                                  palette,
                                  theme,
                                ),
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text
                        style={[
                          styles.dayCount,
                          {
                            color: isSelected
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {dayRecurring.length} routine
                        {dayRecurring.length === 1 ? "" : "s"}
                      </Text>
                    </>
                  ) : null}
                </MotionPressable>
              </MotionView>
            );
          })}
        </View>
      </SectionSurface>

      <SectionSurface
        palette={palette}
        label="Day details"
        title={dayFormatter.format(selectedDayDate)}
      >
        {selectedDayRecurring.length > 0 ? (
          <View style={styles.dayLogsList}>
            {selectedDayRecurring.map((item, index) => (
              <MotionView key={item.occurrenceId} delay={index * 30}>
                <Surface
                  style={[
                    styles.dayLogCard,
                    {
                      backgroundColor: theme.colors.elevation.level1,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                  elevation={1}
                >
                  <View style={styles.dayLogHeader}>
                    <View style={styles.dayLogHeaderCopy}>
                      <Text style={styles.dayLogTitle}>{item.title}</Text>
                      <Text
                        style={[styles.dayLogMeta, paletteStyles.mutedText]}
                      >
                        {timeFormatter.format(new Date(item.dueAt))} • routine
                        occurrence
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.kindPill,
                        {
                          backgroundColor: withAlpha(
                            getRecurringStatusAccent(
                              item.status,
                              palette,
                              theme,
                            ),
                            0.14,
                          ),
                          borderColor: withAlpha(
                            getRecurringStatusAccent(
                              item.status,
                              palette,
                              theme,
                            ),
                            0.3,
                          ),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.kindPillLabel,
                          {
                            color: getRecurringStatusAccent(
                              item.status,
                              palette,
                              theme,
                            ),
                          },
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.dayLogActionRow}>
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => router.push("/action-center")}
                    >
                      Resolve in action center
                    </Button>
                  </View>
                </Surface>
              </MotionView>
            ))}
          </View>
        ) : null}
        {selectedDayLogs.length === 0 ? (
          <EmptyStateCard
            palette={palette}
            icon={{
              ios: "calendar.badge.plus",
              android: "event_available",
              web: "event_available",
            }}
            title="No logs on this day"
            message={
              selectedDayRecurring.length > 0
                ? "This date has recurring routine activity but no standalone logs yet."
                : "This date does not yet have timeline activity. Record a log to start building your calendar trail."
            }
            actionLabel="Open logbook"
            onAction={() => router.push("/logbook")}
            actionAccentColor={palette.tint}
          />
        ) : (
          <View style={styles.dayLogsList}>
            {selectedDayLogs.map((entry, index) => {
              const space = spacesById.get(entry.spaceId);
              const accent = getKindAccent(entry.kind, palette, theme);

              return (
                <MotionView key={entry.id} delay={index * 40}>
                  <Surface
                    style={[
                      styles.dayLogCard,
                      {
                        backgroundColor: theme.colors.elevation.level1,
                        borderColor: theme.colors.outlineVariant,
                      },
                    ]}
                    elevation={1}
                  >
                    <View style={styles.dayLogHeader}>
                      <View style={styles.dayLogHeaderCopy}>
                        <Text style={styles.dayLogTitle}>{entry.title}</Text>
                        <Text
                          style={[styles.dayLogMeta, paletteStyles.mutedText]}
                        >
                          {timeFormatter.format(new Date(entry.occurredAt))} •{" "}
                          {space?.name ?? "Unknown space"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.kindPill,
                          {
                            backgroundColor: withAlpha(accent, 0.14),
                            borderColor: withAlpha(accent, 0.3),
                          },
                        ]}
                      >
                        <Text style={[styles.kindPillLabel, { color: accent }]}>
                          {logKindLabels[entry.kind]}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.dayLogNote, paletteStyles.mutedText]}>
                      {entry.note ||
                        "No additional note was captured for this entry."}
                    </Text>
                    <ChipRow style={styles.dayLogChipRow}>
                      {entry.tags?.slice(0, 3).map((tag) => (
                        <Chip
                          key={`${entry.id}-${tag}`}
                          compact
                          style={styles.metaChip}
                        >
                          #{tag}
                        </Chip>
                      ))}
                      {entry.attachmentsCount ? (
                        <Chip compact icon="paperclip" style={styles.metaChip}>
                          {entry.attachmentsCount} attachment
                          {entry.attachmentsCount === 1 ? "" : "s"}
                        </Chip>
                      ) : null}
                      {entry.assetIds?.length ? (
                        <Chip
                          compact
                          icon="cube-outline"
                          style={styles.metaChip}
                        >
                          {entry.assetIds.length} asset
                          {entry.assetIds.length === 1 ? "" : "s"}
                        </Chip>
                      ) : null}
                    </ChipRow>
                    <View style={styles.dayLogActionRow}>
                      <Button
                        mode="outlined"
                        compact
                        onPress={() =>
                          router.push(`/logbook?entryId=${entry.id}` as never)
                        }
                      >
                        Open in logbook
                      </Button>
                    </View>
                  </Surface>
                </MotionView>
              );
            })}
          </View>
        )}
      </SectionSurface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: uiSpace.screen,
    paddingBottom: uiSpace.screenBottom,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: uiSpace.screen,
    gap: uiSpace.sm,
  },
  loadingTitle: {
    ...uiTypography.titleMd,
    textAlign: "center",
  },
  loadingCopy: {
    ...uiTypography.body,
    textAlign: "center",
  },
  monthHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: uiSpace.lg,
    marginBottom: uiSpace.md,
    flexWrap: "wrap",
  },
  monthHeaderCopy: {
    gap: uiSpace.xs,
    flex: 1,
    minWidth: 200,
  },
  monthTitle: {
    ...uiTypography.titleSection,
  },
  monthMeta: {
    ...uiTypography.support,
  },
  monthActionRow: {
    flexDirection: "row",
    gap: uiSpace.sm,
    flexWrap: "wrap",
  },
  monthStatsRow: {
    marginBottom: uiSpace.lg,
  },
  metaChip: {
    borderRadius: uiRadius.pill,
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: uiSpace.sm,
  },
  weekdayLabel: {
    width: "14.2857%",
    textAlign: "center",
    ...uiTypography.label,
    textTransform: "uppercase",
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -2,
  },
  dayCellWrap: {
    width: "14.2857%",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  emptyDayCell: {
    width: "14.2857%",
    minHeight: uiSize.calendarDayMin,
  },
  dayCell: {
    minHeight: uiSize.calendarDayMin,
    borderRadius: uiRadius.md,
    borderWidth: uiBorder.hairline,
    paddingHorizontal: uiSpace.sm,
    paddingVertical: uiSpace.sm,
    justifyContent: "space-between",
  },
  dayCellHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: uiSpace.xs,
  },
  dayNumber: {
    ...uiTypography.bodyStrong,
  },
  todayBadge: {
    borderWidth: uiBorder.hairline,
    borderRadius: uiRadius.pill,
    paddingHorizontal: uiSpace.xs,
    paddingVertical: 2,
  },
  todayBadgeLabel: {
    ...uiTypography.microLabel,
    fontSize: 9,
  },
  kindDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: uiSpace.xs,
  },
  kindDot: {
    width: 7,
    height: 7,
    borderRadius: uiRadius.pill,
  },
  dayCount: {
    ...uiTypography.microLabel,
    textTransform: "uppercase",
  },
  noLogText: {
    ...uiTypography.support,
  },
  dayLogsList: {
    gap: uiSpace.md,
  },
  dayLogCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.lg,
    gap: uiSpace.sm,
  },
  dayLogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: uiSpace.md,
  },
  dayLogHeaderCopy: {
    flex: 1,
    gap: uiSpace.xs,
  },
  dayLogTitle: {
    ...uiTypography.titleMd,
  },
  dayLogMeta: {
    ...uiTypography.support,
  },
  dayLogNote: {
    ...uiTypography.body,
  },
  dayLogChipRow: {
    marginTop: uiSpace.xs,
  },
  dayLogActionRow: {
    marginTop: uiSpace.xs,
    alignItems: "flex-start",
  },
  kindPill: {
    borderWidth: uiBorder.hairline,
    borderRadius: uiRadius.pill,
    paddingHorizontal: uiSpace.md,
    paddingVertical: uiSpace.xs,
  },
  kindPillLabel: {
    ...uiTypography.label,
    textTransform: "none",
  },
});
