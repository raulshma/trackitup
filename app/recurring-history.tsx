import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import {
    Button,
    Chip,
    SegmentedButtons,
    Surface,
    useTheme,
    type MD3Theme,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { ChipRow } from "@/components/ui/ChipRow";
import { EmptyStateCard } from "@/components/ui/EmptyStateCard";
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
import { buildRecurringPlanAnalytics } from "@/services/recurring/recurringPlans";

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RecurringHistoryScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const theme = useTheme<MD3Theme>();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const params = useLocalSearchParams<{ planId?: string }>();
  const planId = pickParam(params.planId);

  const { workspace } = useWorkspace();
  const [statusFilter, setStatusFilter] = useState<
    "all" | "completed" | "skipped" | "missed" | "scheduled"
  >("all");
  const [sortMode, setSortMode] = useState<"dueAt" | "actionAt">("dueAt");
  const plan = planId
    ? workspace.recurringPlans.find((item) => item.id === planId)
    : undefined;

  const analytics = useMemo(() => {
    if (!planId) return null;
    return buildRecurringPlanAnalytics(
      workspace,
      planId,
      workspace.generatedAt,
    );
  }, [planId, workspace]);

  const timeline = useMemo(() => {
    const filtered = [...workspace.recurringOccurrences].filter((item) => {
      if (item.planId !== planId) return false;
      if (statusFilter === "all") return true;
      return item.status === statusFilter;
    });

    if (sortMode === "actionAt") {
      return filtered.sort((left, right) => {
        const leftActionAt =
          left.completedAt ?? left.history?.[0]?.at ?? left.dueAt;
        const rightActionAt =
          right.completedAt ?? right.history?.[0]?.at ?? right.dueAt;
        return rightActionAt.localeCompare(leftActionAt);
      });
    }

    return filtered.sort((left, right) =>
      right.dueAt.localeCompare(left.dueAt),
    );
  }, [planId, sortMode, statusFilter, workspace.recurringOccurrences]);

  const activityTimeline = useMemo(
    () =>
      timeline
        .flatMap((occurrence) =>
          (occurrence.history ?? []).map((entry) => ({
            occurrenceId: occurrence.id,
            dueAt: occurrence.dueAt,
            ...entry,
          })),
        )
        .sort((left, right) => right.at.localeCompare(left.at))
        .slice(0, 20),
    [timeline],
  );

  return (
    <ScrollView
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={styles.content}
      scrollEventThrottle={Platform.OS === "web" ? 64 : 32}
      removeClippedSubviews={Platform.OS === "android"}
      nestedScrollEnabled={Platform.OS === "android"}
    >
      <Stack.Screen options={{ title: "Recurring history" }} />

      <ScreenHero
        palette={palette}
        title={plan ? `${plan.title} history` : "Recurring history"}
        subtitle="Review adherence, streaks, and every occurrence outcome from one timeline."
        badges={[
          {
            label: plan?.status ?? "Unknown",
            backgroundColor: theme.colors.surface,
            textColor: theme.colors.onSurface,
          },
          {
            label: `${timeline.length} occurrence${timeline.length === 1 ? "" : "s"}`,
            backgroundColor: theme.colors.secondaryContainer,
            textColor: theme.colors.onSecondaryContainer,
          },
        ]}
      />

      {!plan || !analytics ? (
        <EmptyStateCard
          palette={palette}
          icon={{
            ios: "clock.arrow.circlepath",
            android: "history",
            web: "history",
          }}
          title="No recurring plan selected"
          message="Open this screen from a recurring plan card to inspect its full history and analytics."
          actionLabel="Open planner"
          onAction={() => router.push("/planner")}
        />
      ) : (
        <>
          <Surface
            style={[styles.sectionCard, paletteStyles.cardSurface]}
            elevation={1}
          >
            <Text style={styles.sectionTitle}>Adherence metrics</Text>
            <ChipRow>
              <Chip compact style={styles.infoChip}>
                7d {(analytics.completionRate7d * 100).toFixed(0)}%
              </Chip>
              <Chip compact style={styles.infoChip}>
                30d {(analytics.completionRate30d * 100).toFixed(0)}%
              </Chip>
              <Chip compact style={styles.infoChip}>
                90d {(analytics.completionRate90d * 100).toFixed(0)}%
              </Chip>
            </ChipRow>
            <ChipRow style={styles.metricRow}>
              <Chip compact style={styles.infoChip}>
                🔥 Current streak {analytics.currentStreak}
              </Chip>
              <Chip compact style={styles.infoChip}>
                🏆 Best streak {analytics.bestStreak}
              </Chip>
              <Chip compact style={styles.infoChip}>
                Missed {analytics.missedCount}
              </Chip>
            </ChipRow>
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Last completed:{" "}
              {analytics.lastCompletedAt
                ? formatTime(analytics.lastCompletedAt)
                : "Not completed yet"}
            </Text>
          </Surface>

          <Surface
            style={[styles.sectionCard, paletteStyles.cardSurface]}
            elevation={1}
          >
            <Text style={styles.sectionTitle}>Skip reasons</Text>
            {analytics.skipReasons.length === 0 ? (
              <Text style={[styles.copy, paletteStyles.mutedText]}>
                No skipped occurrences recorded yet.
              </Text>
            ) : (
              analytics.skipReasons.map((item) => (
                <View key={item.reason} style={styles.listItem}>
                  <Text style={styles.listTitle}>{item.reason}</Text>
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    {item.count} time(s)
                  </Text>
                </View>
              ))
            )}
          </Surface>

          <Surface
            style={[styles.sectionCard, paletteStyles.cardSurface]}
            elevation={1}
          >
            <Text style={styles.sectionTitle}>Timeline</Text>
            <SegmentedButtons
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(
                  value as
                    | "all"
                    | "completed"
                    | "skipped"
                    | "missed"
                    | "scheduled",
                )
              }
              buttons={[
                { value: "all", label: "All" },
                { value: "completed", label: "Completed" },
                { value: "skipped", label: "Skipped" },
                { value: "missed", label: "Missed" },
                { value: "scheduled", label: "Scheduled" },
              ]}
              style={styles.segmented}
            />
            <SegmentedButtons
              value={sortMode}
              onValueChange={(value) =>
                setSortMode(value as "dueAt" | "actionAt")
              }
              buttons={[
                { value: "dueAt", label: "Sort by due" },
                { value: "actionAt", label: "Sort by action" },
              ]}
              style={styles.segmented}
            />
            {timeline.map((occurrence) => (
              <View key={occurrence.id} style={styles.listItemCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.listTitle}>
                    {formatTime(occurrence.snoozedUntil ?? occurrence.dueAt)}
                  </Text>
                  <Chip compact>{occurrence.status}</Chip>
                </View>
                {occurrence.completedAt ? (
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    Completed at {formatTime(occurrence.completedAt)}
                  </Text>
                ) : null}
                {occurrence.skipReason ? (
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    Skip reason: {occurrence.skipReason}
                  </Text>
                ) : null}
              </View>
            ))}
          </Surface>

          <Surface
            style={[styles.sectionCard, paletteStyles.cardSurface]}
            elevation={1}
          >
            <Text style={styles.sectionTitle}>Done history activity</Text>
            {activityTimeline.length === 0 ? (
              <Text style={[styles.copy, paletteStyles.mutedText]}>
                No completion activity yet. Completed/skipped/snoozed actions
                will appear here.
              </Text>
            ) : (
              activityTimeline.map((activity) => (
                <View key={activity.id} style={styles.listItemCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.listTitle}>
                      {activity.action} via {activity.actionSource}
                    </Text>
                    <Chip compact>{activity.action}</Chip>
                  </View>
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    {formatTime(activity.at)}
                    {typeof activity.completionLatencyMinutes === "number"
                      ? ` • ${activity.completionLatencyMinutes} min vs due`
                      : ""}
                  </Text>
                  {activity.logId ? (
                    <Text style={[styles.copy, paletteStyles.mutedText]}>
                      Proof log: {activity.logId}
                    </Text>
                  ) : null}
                  {activity.note ? (
                    <Text style={[styles.copy, paletteStyles.mutedText]}>
                      {activity.note}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </Surface>

          <ActionButtonRow style={styles.actionRow}>
            <Button mode="outlined" onPress={() => router.push("/planner")}>
              Back to planner
            </Button>
            <Button
              mode="outlined"
              onPress={() => router.push("/action-center")}
            >
              Open action center
            </Button>
          </ActionButtonRow>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  sectionCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
    marginBottom: uiSpace.xl,
  },
  sectionTitle: { ...uiTypography.titleMd, marginBottom: uiSpace.md },
  copy: uiTypography.body,
  listItem: { marginBottom: uiSpace.md },
  segmented: { marginBottom: uiSpace.md },
  listItemCard: {
    borderWidth: uiBorder.hairline,
    borderRadius: uiRadius.md,
    borderColor: "rgba(128,128,128,0.3)",
    padding: uiSpace.md,
    marginBottom: uiSpace.md,
  },
  listTitle: uiTypography.bodyStrong,
  actionRow: { marginTop: uiSpace.sm, marginBottom: uiSpace.md },
  infoChip: { borderRadius: uiRadius.pill },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: uiSpace.md,
  },
  metricRow: { marginTop: uiSpace.sm },
});
