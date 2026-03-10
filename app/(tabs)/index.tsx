import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";

import { MiniMetricChart, type ChartMode } from "@/components/MiniMetricChart";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
    buildMetricChartPoints,
    getReminderScheduleTimestamp,
} from "@/services/insights/workspaceInsights";

export default function TabOneScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const router = useRouter();
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const {
    cycleDashboardWidgetSize,
    focusItems,
    moveDashboardWidget,
    overviewStats,
    quickActionCards,
    spaceSummaries,
    toggleDashboardWidgetVisibility,
    workspace,
  } = useWorkspace();

  const spacesById = useMemo(
    () => new Map(workspace.spaces.map((space) => [space.id, space] as const)),
    [workspace.spaces],
  );
  const metricDefinitionsById = useMemo(
    () =>
      new Map(
        workspace.metricDefinitions.map(
          (metric) => [metric.id, metric] as const,
        ),
      ),
    [workspace.metricDefinitions],
  );

  const attentionItems = useMemo(() => {
    const metricAlerts = workspace.logs.flatMap((log) =>
      (log.metricReadings ?? []).flatMap((reading) => {
        const metric = metricDefinitionsById.get(reading.metricId);
        if (!metric || typeof reading.value !== "number") return [];

        const belowSafeMin =
          metric.safeMin !== undefined && reading.value < metric.safeMin;
        const aboveSafeMax =
          metric.safeMax !== undefined && reading.value > metric.safeMax;
        if (!belowSafeMin && !aboveSafeMax) return [];

        return [
          `${metric.name} is outside the safe zone in ${spacesById.get(log.spaceId)?.name ?? "Unknown space"}`,
        ];
      }),
    );

    const reminderAlerts = workspace.reminders
      .filter(
        (reminder) =>
          reminder.status === "due" || reminder.status === "snoozed",
      )
      .map(
        (reminder) =>
          `${reminder.title} • ${reminder.ruleLabel ?? reminder.triggerCondition ?? "Needs follow-up"}`,
      );

    return [...metricAlerts, ...reminderAlerts].slice(0, 4);
  }, [
    spacesById,
    workspace.logs,
    workspace.metricDefinitions,
    workspace.reminders,
  ]);

  const upcomingReminders = useMemo(
    () =>
      [...workspace.reminders]
        .filter(
          (reminder) =>
            reminder.status === "due" ||
            reminder.status === "scheduled" ||
            reminder.status === "snoozed",
        )
        .sort((left, right) =>
          getReminderScheduleTimestamp(left).localeCompare(
            getReminderScheduleTimestamp(right),
          ),
        )
        .slice(0, 3),
    [workspace.reminders],
  );

  const visibleWidgets = useMemo(
    () => workspace.dashboardWidgets.filter((widget) => !widget.hidden),
    [workspace.dashboardWidgets],
  );
  const hiddenWidgets = useMemo(
    () => workspace.dashboardWidgets.filter((widget) => widget.hidden),
    [workspace.dashboardWidgets],
  );

  function renderWidgetBody(
    widget: (typeof workspace.dashboardWidgets)[number],
  ) {
    const itemLimit =
      widget.size === "small" ? 2 : widget.size === "medium" ? 3 : 5;

    if (widget.type === "attention") {
      return attentionItems.slice(0, itemLimit).map((item) => (
        <View key={item} style={styles.widgetListItem}>
          <View style={[styles.focusDot, { backgroundColor: palette.tint }]} />
          <Text style={[styles.focusText, { color: palette.muted }]}>
            {item}
          </Text>
        </View>
      ));
    }

    if (widget.type === "quick-actions") {
      return quickActionCards.slice(0, itemLimit).map((action) => (
        <Pressable
          key={action.id}
          onPress={() =>
            router.push({
              pathname: "/logbook",
              params: { actionId: action.id },
            })
          }
          style={[styles.widgetShortcut, { borderColor: action.accent }]}
        >
          <Text style={styles.widgetShortcutLabel}>{action.label}</Text>
          <Text style={[styles.widgetShortcutMeta, { color: palette.muted }]}>
            {action.target}
          </Text>
        </Pressable>
      ));
    }

    if (widget.type === "reminders") {
      return upcomingReminders.slice(0, itemLimit).map((reminder) => {
        const space = spacesById.get(reminder.spaceId);

        return (
          <View key={reminder.id} style={styles.widgetListItem}>
            <View
              style={[
                styles.focusDot,
                { backgroundColor: space?.themeColor ?? palette.tint },
              ]}
            />
            <View style={styles.widgetListCopy}>
              <Text style={styles.widgetListTitle}>{reminder.title}</Text>
              <Text
                style={[styles.widgetShortcutMeta, { color: palette.muted }]}
              >
                {space?.name ?? "Unknown space"} •{" "}
                {new Date(
                  getReminderScheduleTimestamp(reminder),
                ).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
        );
      });
    }

    if (widget.type === "chart" && widget.metricIds?.length) {
      const metrics = widget.metricIds.flatMap((metricId, index) => {
        const metric = metricDefinitionsById.get(metricId);
        if (!metric) return [];

        return [
          {
            id: metric.id,
            label: metric.name,
            unitLabel: metric.unitLabel,
            color: ["#0f766e", "#8b5cf6", "#ea580c"][index] ?? palette.tint,
          },
        ];
      });
      const points = buildMetricChartPoints(
        workspace,
        metrics.map((metric) => metric.id),
      );

      return (
        <>
          <View style={styles.chartModeRow}>
            {(["line", "bar", "scatter"] as ChartMode[]).map((mode) => {
              const isActive = chartMode === mode;

              return (
                <Pressable
                  key={mode}
                  onPress={() => setChartMode(mode)}
                  style={[
                    styles.chartModeChip,
                    {
                      backgroundColor: isActive
                        ? palette.tint
                        : palette.background,
                      borderColor: isActive ? palette.tint : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chartModeLabel,
                      { color: isActive ? palette.card : palette.text },
                    ]}
                  >
                    {mode}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <MiniMetricChart
            points={points}
            metrics={metrics}
            mode={chartMode}
            mutedColor={palette.muted}
            borderColor={palette.border}
          />
        </>
      );
    }

    return null;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: palette.tint }]}>
          Flexible tracking for every hobby
        </Text>
        <Text style={styles.title}>
          One workspace for spaces, assets, metrics, logs, and routines.
        </Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          We have replaced the starter scaffold with the first TrackItUp home
          shell and sample workspace data.
        </Text>
      </View>

      <View style={styles.statRow}>
        {overviewStats.map((stat) => (
          <View
            key={stat.label}
            style={[
              styles.statCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: palette.muted }]}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Open the first interactive logbook flow powered by the typed workspace
          data.
        </Text>
      </View>
      <View style={styles.actionRow}>
        {quickActionCards.map((action) => (
          <Pressable
            key={action.id}
            onPress={() =>
              router.push({
                pathname: "/logbook",
                params: { actionId: action.id },
              })
            }
            style={[
              styles.actionButton,
              {
                backgroundColor: palette.card,
                borderColor: action.accent,
              },
            ]}
          >
            <Text style={styles.actionLabel}>{action.label}</Text>
            <Text style={[styles.actionMeta, { color: palette.muted }]}>
              {action.target}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active spaces</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Starter cards that mirror the flexible multi-hobby model in the
          product requirements.
        </Text>
      </View>
      {spaceSummaries.map((space) => (
        <View
          key={space.id}
          style={[
            styles.spaceCard,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              borderLeftColor: space.accent,
            },
          ]}
        >
          <View style={styles.spaceHeader}>
            <View style={styles.spaceHeadingCopy}>
              <Text style={styles.spaceName}>{space.name}</Text>
              <Text style={[styles.spaceMeta, { color: palette.muted }]}>
                {space.category}
              </Text>
              {spacesById.get(space.id)?.parentSpaceId ? (
                <Text style={[styles.nestedMeta, { color: palette.muted }]}>
                  Nested in{" "}
                  {
                    spacesById.get(
                      spacesById.get(space.id)?.parentSpaceId ?? "",
                    )?.name
                  }
                </Text>
              ) : null}
            </View>
            <View
              style={[styles.badge, { backgroundColor: `${space.accent}22` }]}
            >
              <Text style={[styles.badgeLabel, { color: space.accent }]}>
                {space.status}
              </Text>
            </View>
          </View>

          <Text style={[styles.spaceNote, { color: palette.muted }]}>
            {space.note}
          </Text>

          <View style={styles.spaceFooter}>
            <Text style={styles.spaceFooterLabel}>
              {space.pendingTasks} task(s)
            </Text>
            <Text style={[styles.spaceMeta, { color: palette.muted }]}>
              {space.lastLog}
            </Text>
          </View>
        </View>
      ))}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Dashboard widgets</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Reorder, resize, and hide widgets so each hobby can keep a different
          dashboard layout.
        </Text>
      </View>
      {visibleWidgets.map((widget, index) => (
        <View
          key={widget.id}
          style={[
            styles.spaceCard,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              borderLeftColor: palette.tint,
            },
          ]}
        >
          <View style={styles.spaceHeader}>
            <View style={styles.spaceHeadingCopy}>
              <Text style={styles.spaceName}>{widget.title}</Text>
              <Text style={[styles.spaceMeta, { color: palette.muted }]}>
                {widget.type} • {widget.size} card
              </Text>
            </View>
            <View style={styles.widgetControls}>
              <Pressable
                onPress={() => moveDashboardWidget(widget.id, "up")}
                style={[styles.widgetButton, { borderColor: palette.border }]}
              >
                <Text style={styles.widgetButtonLabel}>↑</Text>
              </Pressable>
              <Pressable
                onPress={() => moveDashboardWidget(widget.id, "down")}
                style={[styles.widgetButton, { borderColor: palette.border }]}
              >
                <Text style={styles.widgetButtonLabel}>↓</Text>
              </Pressable>
              <Pressable
                onPress={() => cycleDashboardWidgetSize(widget.id)}
                style={[styles.widgetButton, { borderColor: palette.border }]}
              >
                <Text style={styles.widgetButtonLabel}>Size</Text>
              </Pressable>
              <Pressable
                onPress={() => toggleDashboardWidgetVisibility(widget.id)}
                style={[styles.widgetButton, { borderColor: palette.border }]}
              >
                <Text style={styles.widgetButtonLabel}>Hide</Text>
              </Pressable>
            </View>
          </View>
          <Text style={[styles.spaceNote, { color: palette.muted }]}>
            {widget.description}
          </Text>
          <View style={styles.widgetBody}>{renderWidgetBody(widget)}</View>
          <Text style={styles.spaceFooterLabel}>Widget #{index + 1}</Text>
        </View>
      ))}
      {hiddenWidgets.length > 0 ? (
        <View
          style={[
            styles.focusCard,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={styles.sectionTitle}>Hidden widgets</Text>
          {hiddenWidgets.map((widget) => (
            <View key={widget.id} style={styles.hiddenWidgetRow}>
              <View style={styles.widgetListCopy}>
                <Text style={styles.widgetListTitle}>{widget.title}</Text>
                <Text
                  style={[styles.widgetShortcutMeta, { color: palette.muted }]}
                >
                  {widget.type} • {widget.size} card
                </Text>
              </View>
              <Pressable
                onPress={() => toggleDashboardWidgetVisibility(widget.id)}
                style={[styles.widgetButton, { borderColor: palette.border }]}
              >
                <Text style={styles.widgetButtonLabel}>Show</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Items needing attention</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Safe-zone alerts and urgent reminders surfaced from the shared
          workspace.
        </Text>
      </View>
      <View
        style={[
          styles.focusCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        {attentionItems.map((item) => (
          <View key={item} style={styles.focusItem}>
            <View
              style={[styles.focusDot, { backgroundColor: palette.tint }]}
            />
            <Text style={[styles.focusText, { color: palette.muted }]}>
              {item}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Template catalog</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Official and community templates expose the schema engine and import
          paths.
        </Text>
      </View>
      <View style={styles.widgetToolbar}>
        <Pressable
          onPress={() => router.push("/schema-builder")}
          style={[styles.toolbarButton, { borderColor: palette.border }]}
        >
          <Text style={styles.toolbarButtonLabel}>Build custom schema</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/template-import")}
          style={[styles.toolbarButton, { borderColor: palette.border }]}
        >
          <Text style={styles.toolbarButtonLabel}>Import template</Text>
        </Pressable>
      </View>
      {workspace.templates.map((template) => (
        <View
          key={template.id}
          style={[
            styles.spaceCard,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              borderLeftColor: palette.tint,
            },
          ]}
        >
          <View style={styles.spaceHeader}>
            <View style={styles.spaceHeadingCopy}>
              <Text style={styles.spaceName}>{template.name}</Text>
              <Text style={[styles.spaceMeta, { color: palette.muted }]}>
                {template.origin} • {template.category}
              </Text>
            </View>
            <View
              style={[styles.badge, { backgroundColor: `${palette.tint}22` }]}
            >
              <Text style={[styles.badgeLabel, { color: palette.tint }]}>
                {template.importMethods.join(" • ")}
              </Text>
            </View>
          </View>
          <Text style={[styles.spaceNote, { color: palette.muted }]}>
            {template.summary}
          </Text>
          <Text style={[styles.spaceMeta, { color: palette.muted }]}>
            Fields: {template.supportedFieldTypes.slice(0, 5).join(", ")}
          </Text>
          {template.formTemplate ? (
            <View style={styles.widgetToolbar}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/logbook",
                    params: { templateId: template.id },
                  })
                }
                style={[styles.toolbarButton, { borderColor: palette.border }]}
              >
                <Text style={styles.toolbarButtonLabel}>Open form</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today&apos;s focus</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          The next implementation slices after the shell is in place.
        </Text>
      </View>
      <View
        style={[
          styles.focusCard,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        {focusItems.map((item) => (
          <View key={item} style={styles.focusItem}>
            <View
              style={[styles.focusDot, { backgroundColor: palette.tint }]}
            />
            <Text style={[styles.focusText, { color: palette.muted }]}>
              {item}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  hero: {
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
    minHeight: 84,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionMeta: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  spaceCard: {
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  spaceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  spaceHeadingCopy: {
    flex: 1,
    marginRight: 12,
  },
  spaceName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  spaceMeta: {
    fontSize: 13,
  },
  nestedMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  spaceNote: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  spaceFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spaceFooterLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  focusCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  focusItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  focusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
    marginRight: 12,
  },
  focusText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  widgetControls: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  widgetButton: {
    minWidth: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  widgetButtonLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  widgetBody: {
    marginBottom: 12,
  },
  hiddenWidgetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  widgetListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  widgetListCopy: {
    flex: 1,
  },
  widgetListTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  widgetShortcut: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  widgetShortcutLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  widgetShortcutMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  widgetToolbar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  toolbarButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toolbarButtonLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  chartModeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  chartModeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chartModeLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
});
