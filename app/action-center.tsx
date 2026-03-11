import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip } from "react-native-paper";

import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { ChipRow } from "@/components/ui/ChipRow";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import { uiRadius, uiSpace, uiTypography } from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { getReminderScheduleTimestamp } from "@/services/insights/workspaceInsights";
import { buildReminderActionCenter } from "@/services/reminders/reminderActionCenter";
import type { WorkspaceRecommendation } from "@/types/trackitup";

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ActionCenterScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const {
    completeReminder,
    recommendations,
    skipReminder,
    snoozeReminder,
    workspace,
  } = useWorkspace();
  const actionCenter = useMemo(
    () => buildReminderActionCenter(workspace),
    [workspace],
  );
  const spacesById = useMemo(
    () => new Map(workspace.spaces.map((space) => [space.id, space] as const)),
    [workspace.spaces],
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

  const reminderSections = [
    { label: "Overdue now", reminders: actionCenter.overdue },
    { label: "Due today", reminders: actionCenter.dueToday },
    { label: "Coming up", reminders: actionCenter.upcoming.slice(0, 6) },
  ];
  const quickActionReminder =
    actionCenter.overdue[0] ??
    actionCenter.dueToday[0] ??
    actionCenter.upcoming[0];
  const pageQuickActions = [
    {
      id: "action-center-planner",
      label: "Open planner",
      hint: `${actionCenter.summary.overdueCount} overdue • ${actionCenter.summary.dueTodayCount} due today`,
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
        router.push(
          quickActionReminder
            ? (`/logbook?actionId=quick-log&spaceId=${quickActionReminder.spaceId}&reminderId=${quickActionReminder.id}` as never)
            : ("/logbook" as never),
        ),
      accentColor: palette.secondary,
    },
    {
      id: "action-center-inventory",
      label: "Review inventory",
      hint: `${workspace.assets.length} asset${workspace.assets.length === 1 ? "" : "s"} can be tied back to reminder work and recommendations.`,
      onPress: () => router.push("/inventory" as never),
    },
  ];

  return (
    <ScrollView
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={styles.content}
    >
      <ScreenHero
        palette={palette}
        title="Action center"
        subtitle="See what needs attention right now, work through reminder actions quickly, and review the latest planner activity from one place."
        badges={[
          {
            label: `${actionCenter.summary.overdueCount} overdue`,
            backgroundColor: palette.card,
            textColor: palette.tint,
          },
          {
            label: `${actionCenter.summary.dueTodayCount} due today`,
            backgroundColor: palette.accentSoft,
          },
          {
            label: `${recommendations.length} recommendations`,
            backgroundColor: palette.card,
          },
        ]}
      />

      <PageQuickActions
        palette={palette}
        title="Handle the next best move"
        description="These shortcuts keep the action center connected to planning, proof capture, and the asset context behind the work."
        actions={pageQuickActions}
      />

      <SectionSurface
        palette={palette}
        label="Next best actions"
        title="Recommendations"
      >
        {recommendations.length === 0 ? (
          <Text style={[styles.copy, paletteStyles.mutedText]}>
            Recommendations will appear here once your reminders, logs, and
            tracked metrics create enough history.
          </Text>
        ) : (
          recommendations.map((recommendation) => (
            <View key={recommendation.id} style={styles.listCard}>
              <View style={styles.listHeader}>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{recommendation.title}</Text>
                  <Text style={[styles.copy, paletteStyles.mutedText]}>
                    {recommendation.explanation}
                  </Text>
                </View>
                <Chip compact style={styles.severityChip}>
                  {recommendation.severity}
                </Chip>
              </View>
              <ActionButtonRow style={styles.actionRow}>
                <Button
                  mode="contained"
                  onPress={() => openRecommendation(recommendation)}
                  style={styles.inlineButton}
                >
                  {recommendation.action.label}
                </Button>
              </ActionButtonRow>
            </View>
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
            <Text style={[styles.copy, paletteStyles.mutedText]}>
              Nothing in this bucket right now.
            </Text>
          ) : (
            section.reminders.map((reminder) => {
              const space = spacesById.get(reminder.spaceId);
              return (
                <View key={reminder.id} style={styles.listCard}>
                  <View style={styles.listHeader}>
                    <View style={styles.listCopy}>
                      <Text style={styles.listTitle}>{reminder.title}</Text>
                      <Text style={[styles.copy, paletteStyles.mutedText]}>
                        {space?.name ?? "Unknown space"} •{" "}
                        {formatTimestamp(
                          getReminderScheduleTimestamp(reminder),
                        )}
                      </Text>
                      <Text style={[styles.meta, paletteStyles.mutedText]}>
                        {reminder.description}
                      </Text>
                    </View>
                    <Chip compact style={styles.statusChip}>
                      {reminder.status}
                    </Chip>
                  </View>
                  <ActionButtonRow style={styles.actionRow}>
                    <Button
                      mode="contained"
                      onPress={() => completeReminder(reminder.id)}
                      style={styles.inlineButton}
                    >
                      Complete
                    </Button>
                    <Button
                      mode="contained-tonal"
                      onPress={() =>
                        router.push(
                          `/logbook?actionId=quick-log&spaceId=${reminder.spaceId}&reminderId=${reminder.id}` as never,
                        )
                      }
                      style={styles.inlineButton}
                    >
                      Log proof
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => snoozeReminder(reminder.id)}
                      style={styles.inlineButton}
                    >
                      Snooze
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => skipReminder(reminder.id)}
                      style={styles.inlineButton}
                    >
                      Skip
                    </Button>
                  </ActionButtonRow>
                </View>
              );
            })
          )}
        </SectionSurface>
      ))}

      <SectionSurface
        palette={palette}
        label="Recent history"
        title="Reminder activity"
      >
        {actionCenter.recentActivity.length === 0 ? (
          <Text style={[styles.copy, paletteStyles.mutedText]}>
            Completed, snoozed, and skipped reminder actions will appear here.
          </Text>
        ) : (
          actionCenter.recentActivity.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>{item.reminderTitle}</Text>
                <Text style={[styles.copy, paletteStyles.mutedText]}>
                  {item.action} • {formatTimestamp(item.at)}
                </Text>
                <Text style={[styles.meta, paletteStyles.mutedText]}>
                  {item.note}
                </Text>
              </View>
            </View>
          ))
        )}
        <ChipRow style={styles.chipRow}>
          <Chip compact style={styles.infoChip}>
            {actionCenter.summary.recentActivityCount} recent actions
          </Chip>
          <Chip compact style={styles.infoChip}>
            {workspace.reminders.length} reminders tracked
          </Chip>
        </ChipRow>
        <ActionButtonRow style={styles.actionRow}>
          <Button
            mode="outlined"
            onPress={() => router.push("/planner")}
            style={styles.inlineButton}
          >
            Open planner
          </Button>
          <Button
            mode="outlined"
            onPress={() => router.push("/logbook")}
            style={styles.inlineButton}
          >
            Open logbook
          </Button>
        </ActionButtonRow>
      </SectionSurface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  copy: { ...uiTypography.body },
  meta: { ...uiTypography.label, marginTop: uiSpace.xxs, lineHeight: 18 },
  listCard: {
    borderRadius: uiRadius.xl,
    paddingVertical: uiSpace.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.2)",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: uiSpace.md,
  },
  listCopy: { flex: 1, gap: uiSpace.xxs },
  listTitle: { ...uiTypography.titleMd },
  actionRow: { marginTop: uiSpace.md },
  inlineButton: { flex: 1 },
  severityChip: { borderRadius: uiRadius.pill },
  statusChip: { borderRadius: uiRadius.pill },
  activityRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(148, 163, 184, 0.2)",
    paddingVertical: uiSpace.md,
  },
  chipRow: { marginTop: uiSpace.md },
  infoChip: { borderRadius: uiRadius.pill },
});
