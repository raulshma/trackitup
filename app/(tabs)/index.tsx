import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Button, Chip, SegmentedButtons, Surface } from "react-native-paper";

import { MiniMetricChart, type ChartMode } from "@/components/MiniMetricChart";
import { Text } from "@/components/Themed";
import { useMaterialCompactTopAppBarHeight } from "@/components/ui/MaterialCompactTopAppBar";
import { useTabHeaderScroll } from "@/components/ui/TabHeaderScrollContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import {
    buildMetricChartPoints,
    getReminderScheduleTimestamp,
} from "@/services/insights/workspaceInsights";
import { buildWorkspaceVisualHistory } from "@/services/insights/workspaceVisualHistory";
import type { WorkspaceRecommendation } from "@/types/trackitup";

export default function TabOneScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const router = useRouter();
  const headerHeight = useMaterialCompactTopAppBarHeight();
  const headerScroll = useTabHeaderScroll("index");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const {
    cycleDashboardWidgetSize,
    moveDashboardWidget,
    overviewStats,
    recommendations,
    quickActionCards,
    spaceSummaries,
    toggleDashboardWidgetVisibility,
    workspace,
  } = useWorkspace();

  const spacesById = useMemo(
    () => new Map(workspace.spaces.map((space) => [space.id, space] as const)),
    [workspace.spaces],
  );
  const spacePhotoMap = useMemo(
    () =>
      new Map(
        buildWorkspaceVisualHistory(workspace).spaceGalleries.map((gallery) => [
          gallery.id,
          gallery,
        ]),
      ),
    [workspace],
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
  const workspacePulse = [
    `${workspace.spaces.length} spaces`,
    `${workspace.assets.length} assets`,
    `${workspace.logs.length} logs`,
  ];
  const attentionSummary =
    recommendations.length > 0
      ? `${recommendations.length} recommendation${recommendations.length === 1 ? "" : "s"} ready`
      : "Everything looks steady";
  const workspaceGuidance = useMemo(() => {
    const items: string[] = [];

    if (workspace.spaces.length === 0) {
      items.push("Add or sync a space to start tracking real activity.");
    }
    if (workspace.logs.length === 0) {
      items.push(
        "Use Quick log to capture your first real entry on this device.",
      );
    }
    if (workspace.reminders.length === 0) {
      items.push("Create routines or reminders to populate the planner.");
    }
    if (workspace.templates.length === 0) {
      items.push("Import or build a template when you want reusable forms.");
    }

    if (items.length > 0) return items;

    return [
      `${workspace.logs.length} real logs are available in your unified timeline.`,
      `${workspace.reminders.length} reminders are currently scheduled across your spaces.`,
      `${workspace.assets.length} assets are linked to tracked spaces in this workspace.`,
    ];
  }, [
    workspace.assets.length,
    workspace.logs.length,
    workspace.reminders.length,
    workspace.spaces.length,
    workspace.templates.length,
  ]);

  const baseCardSurfaceStyle = {
    backgroundColor: palette.surface2,
    borderColor: palette.borderSoft,
    shadowColor: palette.shadow,
  };

  const nestedCardSurfaceStyle = {
    backgroundColor: palette.surface3,
    borderColor: palette.borderSoft,
    shadowColor: palette.shadow,
  };

  const toolbarButtonColor = palette.secondaryContainer;
  const toolbarButtonTextColor = palette.onSecondaryContainer;
  const widgetButtonColor = palette.surface4;
  const widgetButtonTextColor = palette.text;

  function getSeverityBadgeColors(
    severity: WorkspaceRecommendation["severity"],
  ) {
    if (severity === "high") {
      return {
        backgroundColor: palette.dangerContainer,
        color: palette.onDangerContainer,
      };
    }

    if (severity === "medium") {
      return {
        backgroundColor: `${palette.warning}22`,
        color: palette.warning,
      };
    }

    return {
      backgroundColor: `${palette.success}22`,
      color: palette.success,
    };
  }

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

    router.push("/action-center");
  }

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
          style={({ pressed }) => [
            styles.widgetShortcut,
            nestedCardSurfaceStyle,
            {
              borderColor: `${action.accent}22`,
              opacity: pressed ? 0.94 : 1,
            },
          ]}
        >
          <Text style={styles.widgetShortcutLabel}>{action.label}</Text>
          <Text style={[styles.widgetShortcutMeta, { color: palette.muted }]}>
            {action.target}
          </Text>
        </Pressable>
      ));
    }

    if (widget.type === "recommendations") {
      return recommendations.slice(0, itemLimit).map((recommendation) => (
        <Pressable
          key={recommendation.id}
          onPress={() => openRecommendation(recommendation)}
          style={({ pressed }) => [
            styles.widgetShortcut,
            styles.recommendationCard,
            nestedCardSurfaceStyle,
            { opacity: pressed ? 0.94 : 1 },
          ]}
        >
          {(() => {
            const badgeColors = getSeverityBadgeColors(recommendation.severity);

            return (
              <View style={styles.widgetRecommendationHeader}>
                <Text style={styles.widgetShortcutLabel}>
                  {recommendation.title}
                </Text>
                <View
                  style={[
                    styles.severityBadge,
                    { backgroundColor: badgeColors.backgroundColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.severityBadgeLabel,
                      { color: badgeColors.color },
                    ]}
                  >
                    {recommendation.severity}
                  </Text>
                </View>
              </View>
            );
          })()}
          <Text style={[styles.widgetShortcutMeta, { color: palette.muted }]}>
            {recommendation.explanation}
          </Text>
          <Text style={[styles.actionCta, { color: palette.tint }]}>
            {recommendation.action.label}
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
          <SegmentedButtons
            value={chartMode}
            onValueChange={(value: string) => setChartMode(value as ChartMode)}
            density="small"
            style={styles.chartModeRow}
            buttons={(["line", "bar", "scatter"] as ChartMode[]).map(
              (mode) => ({
                value: mode,
                label: mode,
              }),
            )}
          />
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
    <Animated.ScrollView
      {...headerScroll}
      scrollIndicatorInsets={{ top: headerHeight }}
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: 20 + headerHeight },
      ]}
    >
      <Surface
        style={[
          styles.hero,
          {
            backgroundColor: palette.hero,
            borderColor: palette.heroBorder,
          },
        ]}
        elevation={2}
      >
        <View style={styles.heroBadgeRow}>
          <Chip
            compact
            style={[
              styles.heroBadge,
              { backgroundColor: palette.primaryContainer },
            ]}
            textStyle={[
              styles.heroBadgeLabel,
              { color: palette.onPrimaryContainer },
            ]}
          >
            TrackItUp
          </Chip>
          <Chip
            compact
            style={[styles.heroBadge, { backgroundColor: palette.surface3 }]}
            textStyle={[styles.heroBadgeLabel, { color: palette.text }]}
          >
            {attentionSummary}
          </Chip>
        </View>
        <Text style={[styles.eyebrow, { color: palette.tint }]}>
          Streamlined workspace command center
        </Text>
        <Text style={styles.title}>
          Run every space, routine, and asset from one calm dashboard.
        </Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Review what needs attention, jump into quick actions, and keep every
          hobby organized without losing the bigger picture.
        </Text>
        <View style={styles.heroStatRow}>
          {workspacePulse.map((item) => (
            <Chip
              key={item}
              style={[
                styles.heroStatPill,
                {
                  backgroundColor: palette.surface3,
                },
              ]}
              textStyle={[styles.heroStatLabel, { color: palette.text }]}
            >
              {item}
            </Chip>
          ))}
        </View>
      </Surface>

      <View style={styles.statRow}>
        {overviewStats.map((stat) => (
          <Surface
            key={stat.label}
            style={[styles.statCard, nestedCardSurfaceStyle]}
            elevation={1}
          >
            <Text style={[styles.statEyebrow, { color: palette.muted }]}>
              Live
            </Text>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: palette.muted }]}>
              {stat.label}
            </Text>
          </Surface>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recommended next actions</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          TrackItUp now promotes the most useful next step from reminders,
          metrics, and asset history.
        </Text>
      </View>
      <Surface style={[styles.focusCard, baseCardSurfaceStyle]} elevation={1}>
        {recommendations.length === 0 ? (
          <Text style={[styles.focusText, { color: palette.muted }]}>
            Recommendations will appear here as your spaces build up reminders,
            readings, and maintenance history.
          </Text>
        ) : (
          recommendations.slice(0, 3).map((recommendation) => {
            const badgeColors = getSeverityBadgeColors(recommendation.severity);

            return (
              <Pressable
                key={recommendation.id}
                onPress={() => openRecommendation(recommendation)}
                style={({ pressed }) => [
                  styles.recommendationRow,
                  nestedCardSurfaceStyle,
                  { opacity: pressed ? 0.94 : 1 },
                ]}
              >
                <View style={styles.widgetListCopy}>
                  <Text style={styles.widgetListTitle}>
                    {recommendation.title}
                  </Text>
                  <Text
                    style={[
                      styles.widgetShortcutMeta,
                      { color: palette.muted },
                    ]}
                  >
                    {recommendation.explanation}
                  </Text>
                </View>
                <View style={styles.recommendationAside}>
                  <View
                    style={[
                      styles.severityBadge,
                      { backgroundColor: badgeColors.backgroundColor },
                    ]}
                  >
                    <Text
                      style={[
                        styles.severityBadgeLabel,
                        { color: badgeColors.color },
                      ]}
                    >
                      {recommendation.severity}
                    </Text>
                  </View>
                  <Text style={[styles.actionCta, { color: palette.tint }]}>
                    {recommendation.action.label}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </Surface>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Start recording</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Choose what happened and TrackItUp will guide you into the right
          event-entry flow.
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
            style={({ pressed }) => [
              styles.actionPressable,
              { opacity: pressed ? 0.96 : 1 },
            ]}
          >
            <Surface
              style={[
                styles.actionButton,
                baseCardSurfaceStyle,
                { borderColor: `${action.accent}24` },
              ]}
              elevation={3}
            >
              <View
                style={[
                  styles.actionAccentBar,
                  { backgroundColor: action.accent },
                ]}
              />
              <Text style={styles.actionLabel}>{action.label}</Text>
              <Text
                style={[styles.actionDescription, { color: palette.muted }]}
              >
                {action.description}
              </Text>
              <View style={styles.actionFooter}>
                <View
                  style={[
                    styles.actionMetaPill,
                    { backgroundColor: palette.surface3 },
                  ]}
                >
                  <Text style={[styles.actionMeta, { color: palette.muted }]}>
                    {action.target}
                  </Text>
                </View>
                <View
                  style={[
                    styles.actionCtaPill,
                    { backgroundColor: `${action.accent}24` },
                  ]}
                >
                  <Text style={[styles.actionCta, { color: action.accent }]}>
                    Record now
                  </Text>
                </View>
              </View>
            </Surface>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active spaces</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Spaces from your real workspace appear here after you sync, import, or
          start tracking on this device.
        </Text>
      </View>
      {spaceSummaries.length === 0 ? (
        <Surface style={[styles.spaceCard, baseCardSurfaceStyle]} elevation={1}>
          <Text style={styles.spaceName}>No tracked spaces yet</Text>
          <Text style={[styles.spaceNote, { color: palette.muted }]}>
            Create your first space to give new events, routines, and metrics a
            home in the workspace.
          </Text>
          <View style={styles.widgetToolbar}>
            <Button
              onPress={() => router.push("/space-create")}
              mode="contained"
              style={styles.toolbarButton}
              contentStyle={styles.toolbarButtonContent}
              labelStyle={styles.toolbarButtonLabel}
            >
              Create first space
            </Button>
          </View>
        </Surface>
      ) : (
        spaceSummaries.map((space) => (
          <Surface
            key={space.id}
            style={[styles.spaceCard, baseCardSurfaceStyle]}
            elevation={1}
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

            <View style={styles.widgetToolbar}>
              <Button
                onPress={() =>
                  router.push(`/visual-history?spaceId=${space.id}` as never)
                }
                mode="contained-tonal"
                buttonColor={toolbarButtonColor}
                textColor={toolbarButtonTextColor}
                style={styles.toolbarButton}
                contentStyle={styles.toolbarButtonContent}
                labelStyle={styles.toolbarButtonLabel}
              >
                {spacePhotoMap.get(space.id)?.photoCount
                  ? `Visual history (${spacePhotoMap.get(space.id)?.photoCount})`
                  : "Visual history"}
              </Button>
            </View>

            <View style={styles.spaceFooter}>
              <Text style={styles.spaceFooterLabel}>
                {space.pendingTasks} task(s)
              </Text>
              <Text style={[styles.spaceMeta, { color: palette.muted }]}>
                {space.lastLog}
              </Text>
            </View>
          </Surface>
        ))
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Dashboard widgets</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Reorder, resize, and hide widgets so each hobby can keep a different
          dashboard layout.
        </Text>
      </View>
      {visibleWidgets.map((widget, index) => (
        <Surface
          key={widget.id}
          style={[styles.spaceCard, baseCardSurfaceStyle]}
          elevation={1}
        >
          <View style={styles.spaceHeader}>
            <View style={styles.spaceHeadingCopy}>
              <Text style={styles.spaceName}>{widget.title}</Text>
              <Text style={[styles.spaceMeta, { color: palette.muted }]}>
                {widget.type} • {widget.size} card
              </Text>
            </View>
            <View style={styles.widgetControls}>
              <Button
                onPress={() => moveDashboardWidget(widget.id, "up")}
                mode="contained-tonal"
                buttonColor={widgetButtonColor}
                textColor={widgetButtonTextColor}
                compact
                style={styles.widgetButton}
                contentStyle={styles.widgetButtonContent}
                labelStyle={styles.widgetButtonLabel}
              >
                Up
              </Button>
              <Button
                onPress={() => moveDashboardWidget(widget.id, "down")}
                mode="contained-tonal"
                buttonColor={widgetButtonColor}
                textColor={widgetButtonTextColor}
                compact
                style={styles.widgetButton}
                contentStyle={styles.widgetButtonContent}
                labelStyle={styles.widgetButtonLabel}
              >
                Down
              </Button>
              <Button
                onPress={() => cycleDashboardWidgetSize(widget.id)}
                mode="contained-tonal"
                buttonColor={widgetButtonColor}
                textColor={widgetButtonTextColor}
                compact
                style={styles.widgetButton}
                contentStyle={styles.widgetButtonContent}
                labelStyle={styles.widgetButtonLabel}
              >
                Size
              </Button>
              <Button
                onPress={() => toggleDashboardWidgetVisibility(widget.id)}
                mode="contained-tonal"
                buttonColor={widgetButtonColor}
                textColor={widgetButtonTextColor}
                compact
                style={styles.widgetButton}
                contentStyle={styles.widgetButtonContent}
                labelStyle={styles.widgetButtonLabel}
              >
                Hide
              </Button>
            </View>
          </View>
          <Text style={[styles.spaceNote, { color: palette.muted }]}>
            {widget.description}
          </Text>
          <View style={styles.widgetBody}>{renderWidgetBody(widget)}</View>
          <Text style={styles.spaceFooterLabel}>Widget #{index + 1}</Text>
        </Surface>
      ))}
      {hiddenWidgets.length > 0 ? (
        <Surface style={[styles.focusCard, baseCardSurfaceStyle]} elevation={1}>
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
              <Button
                onPress={() => toggleDashboardWidgetVisibility(widget.id)}
                mode="contained-tonal"
                buttonColor={widgetButtonColor}
                textColor={widgetButtonTextColor}
                compact
                style={styles.widgetButton}
                contentStyle={styles.widgetButtonContent}
                labelStyle={styles.widgetButtonLabel}
              >
                Show
              </Button>
            </View>
          ))}
        </Surface>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Items needing attention</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Safe-zone alerts and urgent reminders surfaced from the shared
          workspace.
        </Text>
      </View>
      <Surface style={[styles.focusCard, baseCardSurfaceStyle]} elevation={1}>
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
      </Surface>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Template catalog</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Official and community templates expose the schema engine and import
          paths.
        </Text>
      </View>
      <View style={styles.widgetToolbar}>
        <Button
          onPress={() => router.push("/schema-builder")}
          mode="contained-tonal"
          buttonColor={toolbarButtonColor}
          textColor={toolbarButtonTextColor}
          style={styles.toolbarButton}
          contentStyle={styles.toolbarButtonContent}
          labelStyle={styles.toolbarButtonLabel}
        >
          Build custom schema
        </Button>
        <Button
          onPress={() => router.push("/template-import")}
          mode="contained-tonal"
          buttonColor={toolbarButtonColor}
          textColor={toolbarButtonTextColor}
          style={styles.toolbarButton}
          contentStyle={styles.toolbarButtonContent}
          labelStyle={styles.toolbarButtonLabel}
        >
          Import template
        </Button>
      </View>
      {workspace.templates.length === 0 ? (
        <Surface style={[styles.spaceCard, baseCardSurfaceStyle]} elevation={1}>
          <Text style={styles.spaceName}>
            No templates in this workspace yet
          </Text>
          <Text style={[styles.spaceNote, { color: palette.muted }]}>
            Import a template or build your own schema to populate this catalog.
          </Text>
        </Surface>
      ) : (
        workspace.templates.map((template) => (
          <Surface
            key={template.id}
            style={[styles.spaceCard, baseCardSurfaceStyle]}
            elevation={1}
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
                <Button
                  onPress={() =>
                    router.push({
                      pathname: "/logbook",
                      params: { templateId: template.id },
                    })
                  }
                  mode="contained-tonal"
                  buttonColor={toolbarButtonColor}
                  textColor={toolbarButtonTextColor}
                  style={styles.toolbarButton}
                  contentStyle={styles.toolbarButtonContent}
                  labelStyle={styles.toolbarButtonLabel}
                >
                  Open form
                </Button>
              </View>
            ) : null}
          </Surface>
        ))
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Workspace guide</Text>
        <Text style={[styles.sectionSubtitle, { color: palette.muted }]}>
          Tips here reflect your current real workspace state.
        </Text>
      </View>
      <Surface style={[styles.focusCard, baseCardSurfaceStyle]} elevation={1}>
        {workspaceGuidance.map((item) => (
          <View key={item} style={styles.focusItem}>
            <View
              style={[styles.focusDot, { backgroundColor: palette.tint }]}
            />
            <Text style={[styles.focusText, { color: palette.muted }]}>
              {item}
            </Text>
          </View>
        ))}
      </Surface>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 168,
    gap: 20,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
  },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  heroBadge: {
    borderRadius: 999,
  },
  heroBadgeLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  heroStatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  heroStatPill: {
    borderRadius: 16,
  },
  heroStatLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
  },
  statEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
  },
  sectionHeader: {
    marginTop: 2,
    marginBottom: 2,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionPressable: {
    flex: 1,
    minWidth: 200,
  },
  actionButton: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-start",
    minHeight: 176,
  },
  actionAccentBar: {
    width: 40,
    height: 5,
    borderRadius: 999,
    marginBottom: 16,
  },
  actionLabel: {
    fontSize: 17,
    fontWeight: "700",
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    marginBottom: 16,
    flex: 1,
  },
  actionFooter: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: "auto",
  },
  actionMetaPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 1,
  },
  actionMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionCtaPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionCta: {
    fontSize: 12,
    fontWeight: "700",
  },
  spaceCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
  },
  spaceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  spaceHeadingCopy: {
    flex: 1,
    marginRight: 12,
  },
  spaceName: {
    fontSize: 17,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 20,
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
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  widgetButton: {
    minWidth: 0,
    borderRadius: 16,
  },
  widgetButtonContent: {
    minHeight: 32,
  },
  widgetButtonLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginHorizontal: 2,
  },
  widgetBody: {
    marginBottom: 14,
  },
  hiddenWidgetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  widgetShortcutLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  widgetRecommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  widgetShortcutMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  severityBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  severityBadgeLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  recommendationCard: {
    gap: 8,
  },
  recommendationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  recommendationAside: {
    alignItems: "flex-end",
    gap: 8,
  },
  widgetToolbar: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  toolbarButton: {
    borderRadius: 999,
  },
  toolbarButtonContent: {
    minHeight: 42,
    paddingHorizontal: 8,
  },
  toolbarButtonLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  chartModeRow: {
    marginTop: 2,
  },
});
