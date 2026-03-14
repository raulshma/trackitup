import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Chip, Searchbar, Surface } from "react-native-paper";

import { Text } from "@/components/Themed";
import { useMaterialCompactTopAppBarHeight } from "@/components/ui/MaterialCompactTopAppBar";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { useTabHeaderScroll } from "@/components/ui/TabHeaderScrollContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors, { getReadableTextColor } from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
  getShadowStyle,
  uiBorder,
  uiElevation,
  uiRadius,
  uiShadow,
  uiSpace,
  uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";

const timeFilters = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "recent", label: "Last 48h" },
] as const;

const kindFilters = [
  { id: "all", label: "All kinds" },
  { id: "metric-reading", label: "Metrics" },
  { id: "routine-run", label: "Routines" },
  { id: "asset-update", label: "Assets" },
  { id: "reminder", label: "Reminders" },
] as const;

type TimeFilterId = (typeof timeFilters)[number]["id"];
type KindFilterId = (typeof kindFilters)[number]["id"];

export default function TabTwoScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const headerHeight = useMaterialCompactTopAppBarHeight();
  const headerScroll = useTabHeaderScroll("two");
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const raisedCardShadow = useMemo(
    () => getShadowStyle(palette.shadow, uiShadow.raisedCard),
    [palette.shadow],
  );
  const router = useRouter();
  const { logEntries, timelineEntries, workspace } = useWorkspace();
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilterId>("all");
  const [activeKindFilter, setActiveKindFilter] = useState<KindFilterId>("all");
  const [activeSpaceId, setActiveSpaceId] = useState<string>("all");
  const [activeAssetId, setActiveAssetId] = useState<string>("all");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [thresholdMode, setThresholdMode] = useState<"all" | "alerts">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const spaceFilters = useMemo(
    () => [
      { id: "all", label: "All spaces" },
      ...workspace.spaces.map((space) => ({ id: space.id, label: space.name })),
    ],
    [workspace.spaces],
  );

  const assetFilters = useMemo(
    () => [
      { id: "all", label: "All assets" },
      ...workspace.assets.map((asset) => ({ id: asset.id, label: asset.name })),
    ],
    [workspace.assets],
  );

  const tagFilters = useMemo(
    () => [
      { id: "all", label: "All tags" },
      ...Array.from(new Set(logEntries.flatMap((log) => log.tags ?? []))).map(
        (tag) => ({
          id: tag,
          label: tag,
        }),
      ),
    ],
    [logEntries],
  );

  const logsById = useMemo(
    () => new Map(logEntries.map((log) => [log.id, log] as const)),
    [logEntries],
  );
  const preferredQuickLogAction =
    workspace.quickActions.find((action) => action.kind === "quick-log") ??
    workspace.quickActions[0];

  const filteredEntries = useMemo(() => {
    const now = new Date(workspace.generatedAt).getTime();
    const recentWindowMs = 48 * 60 * 60 * 1000;
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const metricsById = new Map(
      workspace.metricDefinitions.map((metric) => [metric.id, metric] as const),
    );

    return timelineEntries.filter((entry) => {
      const log = logsById.get(entry.id);

      if (
        activeTimeFilter === "today" &&
        !entry.timestamp.startsWith("Today")
      ) {
        return false;
      }

      if (
        activeTimeFilter === "recent" &&
        now - new Date(entry.occurredAt).getTime() > recentWindowMs
      ) {
        return false;
      }

      if (activeKindFilter !== "all" && entry.kind !== activeKindFilter) {
        return false;
      }

      if (activeSpaceId !== "all" && entry.spaceId !== activeSpaceId) {
        return false;
      }

      if (activeAssetId !== "all" && !log?.assetIds?.includes(activeAssetId)) {
        return false;
      }

      if (activeTag !== "all" && !log?.tags?.includes(activeTag)) {
        return false;
      }

      if (thresholdMode === "alerts") {
        const hasMetricAlert = (log?.metricReadings ?? []).some((reading) => {
          const metric = metricsById.get(reading.metricId);
          if (!metric || typeof reading.value !== "number") return false;

          return (
            (metric.safeMin !== undefined && reading.value < metric.safeMin) ||
            (metric.safeMax !== undefined && reading.value > metric.safeMax)
          );
        });

        if (!hasMetricAlert) return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      return [
        entry.title,
        entry.detail,
        entry.spaceName,
        entry.type,
        ...(log?.tags ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [
    activeAssetId,
    activeKindFilter,
    activeSpaceId,
    activeTag,
    activeTimeFilter,
    searchQuery,
    thresholdMode,
    logsById,
    timelineEntries,
    workspace.generatedAt,
    workspace.metricDefinitions,
  ]);

  const resultSummary = `${filteredEntries.length} of ${timelineEntries.length} entries shown`;
  const activeFilterCount = [
    activeTimeFilter !== "all",
    activeKindFilter !== "all",
    activeSpaceId !== "all",
    activeAssetId !== "all",
    activeTag !== "all",
    thresholdMode !== "all",
    searchQuery.trim().length > 0,
  ].filter(Boolean).length;

  const pageQuickActions = [
    {
      id: "timeline-record",
      label: preferredQuickLogAction?.label ?? "Record event",
      hint: "Capture something new and jump straight back into the unified feed.",
      onPress: () =>
        router.push({
          pathname: "/logbook",
          params: preferredQuickLogAction
            ? { actionId: preferredQuickLogAction.id }
            : {},
        }),
      accentColor: palette.tint,
    },
    {
      id: "timeline-alerts",
      label:
        thresholdMode === "alerts"
          ? "Alert filter on"
          : "Show safe-zone alerts",
      hint:
        thresholdMode === "alerts"
          ? "You are already focused on out-of-range metric readings."
          : "Narrow the feed to entries that crossed a tracked safe zone.",
      onPress: () => {
        setThresholdMode("alerts");
        setSearchQuery("");
      },
      accentColor: palette.secondary,
    },
    {
      id: "timeline-reset",
      label: activeFilterCount === 0 ? "Feed is reset" : "Clear filters",
      hint:
        activeFilterCount === 0
          ? resultSummary
          : `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"} are shaping this view.`,
      onPress: () => {
        setActiveTimeFilter("all");
        setActiveKindFilter("all");
        setActiveSpaceId("all");
        setActiveAssetId("all");
        setActiveTag("all");
        setThresholdMode("all");
        setSearchQuery("");
      },
      disabled: activeFilterCount === 0,
    },
  ];

  const renderTimelineItem = useMemo(
    () =>
      ({ item: entry }: { item: (typeof filteredEntries)[number] }) => (
        <Pressable
          onPress={() =>
            router.push({ pathname: "/logbook", params: { entryId: entry.id } })
          }
          style={[
            styles.timelineCard,
            paletteStyles.cardSurface,
            { borderLeftColor: entry.accent },
          ]}
        >
          <View style={styles.timelineHeader}>
            <View style={[styles.typeBadge, { backgroundColor: entry.accent }]}>
              <Text
                style={[
                  styles.typeLabel,
                  { color: getReadableTextColor(entry.accent) },
                ]}
              >
                {entry.type}
              </Text>
            </View>
            <Text style={[styles.timestamp, paletteStyles.mutedText]}>
              {entry.timestamp}
            </Text>
          </View>
          <Text style={styles.entryTitle}>{entry.title}</Text>
          <Text style={[styles.spaceLabel, { color: entry.accent }]}>
            {entry.spaceName}
          </Text>
          <Text style={[styles.entryDetail, paletteStyles.mutedText]}>
            {entry.detail}
          </Text>
          {logsById.get(entry.id)?.tags?.length ? (
            <Text style={[styles.tagSummary, paletteStyles.mutedText]}>
              Tags: {logsById.get(entry.id)?.tags?.join(" • ")}
            </Text>
          ) : null}
          <Text style={[styles.tapHint, { color: entry.accent }]}>
            Open logbook →
          </Text>
        </Pressable>
      ),
    [logsById, paletteStyles.cardSurface, paletteStyles.mutedText, router],
  );

  return (
    <Animated.FlatList
      {...headerScroll}
      data={filteredEntries}
      keyExtractor={(entry) => entry.id}
      renderItem={renderTimelineItem}
      scrollIndicatorInsets={{ top: headerHeight }}
      style={[styles.screen, paletteStyles.screenBackground]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: uiSpace.screen + headerHeight },
      ]}
      removeClippedSubviews
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={9}
      updateCellsBatchingPeriod={50}
      ListHeaderComponent={
        <>
          <View style={styles.sectionSpacing}>
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
                  Smart feed
                </Chip>
                <Chip
                  compact
                  style={[styles.headerBadge, paletteStyles.accentChipSurface]}
                  textStyle={styles.headerBadgeLabel}
                >
                  {resultSummary}
                </Chip>
              </View>
              <Text style={styles.title}>Unified Timeline</Text>
              <Text style={[styles.subtitle, paletteStyles.mutedText]}>
                Search, scan, and narrow every log, reminder, metric reading,
                and asset event from one clean chronological feed.
              </Text>
            </Surface>
          </View>

          <View style={styles.sectionSpacing}>
            <PageQuickActions
              palette={palette}
              title="Move through the timeline faster"
              description="These shortcuts stay focused on the current feed so you can record, isolate issues, and reset the view without hunting through filters."
              actions={pageQuickActions}
            />
          </View>

          <View style={styles.sectionSpacing}>
            <Surface
              style={[styles.searchCard, paletteStyles.cardSurface]}
              elevation={uiElevation.card}
            >
              <Text style={styles.filterGroupTitle}>Search the logbook</Text>
              <Searchbar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search titles, details, or spaces"
                style={styles.searchInput}
              />
              <Text style={[styles.resultsMeta, paletteStyles.mutedText]}>
                {resultSummary} • {activeFilterCount} active filter
                {activeFilterCount === 1 ? "" : "s"}
              </Text>
            </Surface>
          </View>

          <View style={styles.sectionSpacing}>
            <View
              style={[
                styles.filterPanel,
                paletteStyles.raisedCardSurface,
                raisedCardShadow,
              ]}
            >
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Time</Text>
                <View style={styles.filterRow}>
                  {timeFilters.map((filter) => {
                    const isActive = activeTimeFilter === filter.id;

                    return (
                      <Pressable
                        key={filter.id}
                        onPress={() => setActiveTimeFilter(filter.id)}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: isActive
                              ? palette.tint
                              : palette.card,
                            borderColor: isActive
                              ? palette.tint
                              : palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterLabel,
                            { color: isActive ? palette.card : palette.text },
                          ]}
                        >
                          {filter.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Kind</Text>
                <View style={styles.filterRow}>
                  {kindFilters.map((filter) => {
                    const isActive = activeKindFilter === filter.id;

                    return (
                      <Pressable
                        key={filter.id}
                        onPress={() => setActiveKindFilter(filter.id)}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: isActive
                              ? palette.tint
                              : palette.card,
                            borderColor: isActive
                              ? palette.tint
                              : palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterLabel,
                            { color: isActive ? palette.card : palette.text },
                          ]}
                        >
                          {filter.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Space</Text>
                <View style={styles.filterRow}>
                  {spaceFilters.map((filter) => {
                    const isActive = activeSpaceId === filter.id;

                    return (
                      <Pressable
                        key={filter.id}
                        onPress={() => setActiveSpaceId(filter.id)}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: isActive
                              ? palette.tint
                              : palette.card,
                            borderColor: isActive
                              ? palette.tint
                              : palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterLabel,
                            { color: isActive ? palette.card : palette.text },
                          ]}
                        >
                          {filter.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Asset</Text>
                <View style={styles.filterRow}>
                  {assetFilters.map((filter) => {
                    const isActive = activeAssetId === filter.id;

                    return (
                      <Pressable
                        key={filter.id}
                        onPress={() => setActiveAssetId(filter.id)}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: isActive
                              ? palette.tint
                              : palette.card,
                            borderColor: isActive
                              ? palette.tint
                              : palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterLabel,
                            { color: isActive ? palette.card : palette.text },
                          ]}
                        >
                          {filter.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Tag</Text>
                <View style={styles.filterRow}>
                  {tagFilters.map((filter) => {
                    const isActive = activeTag === filter.id;

                    return (
                      <Pressable
                        key={filter.id}
                        onPress={() => setActiveTag(filter.id)}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: isActive
                              ? palette.tint
                              : palette.card,
                            borderColor: isActive
                              ? palette.tint
                              : palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterLabel,
                            { color: isActive ? palette.card : palette.text },
                          ]}
                        >
                          {filter.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>Metric thresholds</Text>
                <View style={styles.filterRow}>
                  {[
                    { id: "all", label: "All entries" },
                    { id: "alerts", label: "Safe-zone alerts" },
                  ].map((filter) => {
                    const isActive = thresholdMode === filter.id;

                    return (
                      <Pressable
                        key={filter.id}
                        onPress={() =>
                          setThresholdMode(filter.id as "all" | "alerts")
                        }
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: isActive
                              ? palette.tint
                              : palette.card,
                            borderColor: isActive
                              ? palette.tint
                              : palette.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterLabel,
                            { color: isActive ? palette.card : palette.text },
                          ]}
                        >
                          {filter.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={[styles.emptyCard, paletteStyles.cardSurface]}>
          <Text style={styles.noteTitle}>
            {timelineEntries.length === 0
              ? "No log entries yet"
              : "No entries match these filters"}
          </Text>
          <Text style={[styles.noteCopy, paletteStyles.mutedText]}>
            {timelineEntries.length === 0
              ? "Real log history will appear here after your workspace data is synced, imported, or recorded on this device."
              : "Try clearing the search, switching spaces, or broadening the kind filter."}
          </Text>
        </View>
      }
      ListFooterComponent={
        <View style={[styles.noteCard, paletteStyles.cardSurface]}>
          <Text style={styles.noteTitle}>Timeline tips</Text>
          <Text style={[styles.noteCopy, paletteStyles.mutedText]}>
            {timelineEntries.length === 0
              ? "Real activity will appear here once logs, reminders, or metric readings are captured in your workspace."
              : "Use the search and filters above to narrow your real workspace history by time, type, space, asset, tag, or safe-zone alerts."}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: uiSpace.screen,
    paddingBottom: uiSpace.screenBottomTabs,
  },
  sectionSpacing: {
    marginBottom: uiSpace.xxl,
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
  searchCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
  },
  searchInput: {
    marginTop: uiSpace.md,
  },
  resultsMeta: {
    ...uiTypography.chip,
    marginTop: uiSpace.md,
  },
  filterPanel: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    elevation: uiElevation.raisedCard,
  },
  filterGroup: {
    marginBottom: uiSpace.surface,
  },
  filterGroupTitle: {
    ...uiTypography.bodyStrong,
    marginBottom: uiSpace.md,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: uiSpace.md,
  },
  filterChip: {
    paddingHorizontal: uiSpace.xl,
    paddingVertical: uiSpace.sm,
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.pill,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  timelineCard: {
    borderWidth: uiBorder.standard,
    borderLeftWidth: 5,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    marginBottom: uiSpace.lg,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: uiSpace.lg,
  },
  typeBadge: {
    borderRadius: uiRadius.pill,
    paddingHorizontal: uiSpace.md,
    paddingVertical: 5,
  },
  typeLabel: {
    ...uiTypography.chip,
  },
  timestamp: {
    fontSize: 12,
  },
  entryTitle: {
    ...uiTypography.titleSection,
    marginBottom: 6,
  },
  spaceLabel: {
    ...uiTypography.chip,
    marginBottom: 6,
  },
  entryDetail: uiTypography.body,
  tagSummary: {
    ...uiTypography.support,
    marginTop: uiSpace.sm,
  },
  tapHint: {
    ...uiTypography.microLabel,
    marginTop: uiSpace.lg,
  },
  noteCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
  },
  emptyCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.panel,
    padding: uiSpace.surface,
    marginBottom: uiSpace.md,
  },
  noteTitle: {
    ...uiTypography.titleMd,
    marginBottom: 6,
  },
  noteCopy: uiTypography.body,
});
