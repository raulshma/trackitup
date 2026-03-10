import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Searchbar } from "react-native-paper";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
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

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: palette.hero,
            borderColor: palette.heroBorder,
            shadowColor: palette.shadow,
          },
        ]}
      >
        <View style={styles.headerBadgeRow}>
          <View
            style={[
              styles.headerBadge,
              {
                backgroundColor: palette.card,
                borderColor: palette.heroBorder,
              },
            ]}
          >
            <Text style={[styles.headerBadgeLabel, { color: palette.tint }]}>
              Smart feed
            </Text>
          </View>
          <View
            style={[
              styles.headerBadge,
              {
                backgroundColor: palette.accentSoft,
                borderColor: palette.heroBorder,
              },
            ]}
          >
            <Text style={styles.headerBadgeLabel}>{resultSummary}</Text>
          </View>
        </View>
        <Text style={styles.title}>Unified Timeline</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Search, scan, and narrow every log, reminder, metric reading, and
          asset event from one clean chronological feed.
        </Text>
      </View>

      <View
        style={[
          styles.searchCard,
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
            shadowColor: palette.shadow,
          },
        ]}
      >
        <Text style={styles.filterGroupTitle}>Search the logbook</Text>
        <Searchbar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search titles, details, or spaces"
          style={styles.searchInput}
        />
        <Text style={[styles.resultsMeta, { color: palette.muted }]}>
          {resultSummary} • {activeFilterCount} active filter
          {activeFilterCount === 1 ? "" : "s"}
        </Text>
      </View>

      <View
        style={[
          styles.filterPanel,
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
            shadowColor: palette.shadow,
          },
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
                      backgroundColor: isActive ? palette.tint : palette.card,
                      borderColor: isActive ? palette.tint : palette.border,
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
                      backgroundColor: isActive ? palette.tint : palette.card,
                      borderColor: isActive ? palette.tint : palette.border,
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
                      backgroundColor: isActive ? palette.tint : palette.card,
                      borderColor: isActive ? palette.tint : palette.border,
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
                      backgroundColor: isActive ? palette.tint : palette.card,
                      borderColor: isActive ? palette.tint : palette.border,
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
                      backgroundColor: isActive ? palette.tint : palette.card,
                      borderColor: isActive ? palette.tint : palette.border,
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
                      backgroundColor: isActive ? palette.tint : palette.card,
                      borderColor: isActive ? palette.tint : palette.border,
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

      {filteredEntries.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              shadowColor: palette.shadow,
            },
          ]}
        >
          <Text style={styles.noteTitle}>
            {timelineEntries.length === 0
              ? "No log entries yet"
              : "No entries match these filters"}
          </Text>
          <Text style={[styles.noteCopy, { color: palette.muted }]}>
            {timelineEntries.length === 0
              ? "Real log history will appear here after your workspace data is synced, imported, or recorded on this device."
              : "Try clearing the search, switching spaces, or broadening the kind filter."}
          </Text>
        </View>
      ) : null}

      {filteredEntries.map((entry) => (
        <Pressable
          key={entry.id}
          onPress={() =>
            router.push({ pathname: "/logbook", params: { entryId: entry.id } })
          }
          style={[
            styles.timelineCard,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              borderLeftColor: entry.accent,
              shadowColor: palette.shadow,
            },
          ]}
        >
          <View style={styles.timelineHeader}>
            <View style={[styles.typeBadge, { backgroundColor: entry.accent }]}>
              <Text style={styles.typeLabel}>{entry.type}</Text>
            </View>
            <Text style={[styles.timestamp, { color: palette.muted }]}>
              {entry.timestamp}
            </Text>
          </View>
          <Text style={styles.entryTitle}>{entry.title}</Text>
          <Text style={[styles.spaceLabel, { color: entry.accent }]}>
            {entry.spaceName}
          </Text>
          <Text style={[styles.entryDetail, { color: palette.muted }]}>
            {entry.detail}
          </Text>
          {logsById.get(entry.id)?.tags?.length ? (
            <Text style={[styles.tagSummary, { color: palette.muted }]}>
              Tags: {logsById.get(entry.id)?.tags?.join(" • ")}
            </Text>
          ) : null}
          <Text style={[styles.tapHint, { color: entry.accent }]}>
            Open logbook →
          </Text>
        </Pressable>
      ))}

      <View
        style={[
          styles.noteCard,
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
            shadowColor: palette.shadow,
          },
        ]}
      >
        <Text style={styles.noteTitle}>Timeline tips</Text>
        <Text style={[styles.noteCopy, { color: palette.muted }]}>
          {timelineEntries.length === 0
            ? "Real activity will appear here once logs, reminders, or metric readings are captured in your workspace."
            : "Use the search and filters above to narrow your real workspace history by time, type, space, asset, tag, or safe-zone alerts."}
        </Text>
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
    paddingBottom: 120,
    gap: 16,
  },
  header: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 22,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 4,
  },
  headerBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  headerBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerBadgeLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  searchCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  searchInput: {
    marginTop: 10,
  },
  resultsMeta: {
    fontSize: 12,
    marginTop: 10,
  },
  filterPanel: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  filterGroup: {
    marginBottom: 18,
  },
  filterGroupTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 999,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  timelineCard: {
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: 22,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  typeLabel: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  timestamp: {
    fontSize: 12,
  },
  entryTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  spaceLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  entryDetail: {
    fontSize: 14,
    lineHeight: 20,
  },
  tagSummary: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  tapHint: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 12,
  },
  noteCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  noteCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
});
