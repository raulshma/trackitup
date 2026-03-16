import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
    FlatList,
    Platform,
    Pressable,
    StyleSheet,
    View,
    useWindowDimensions,
    type ListRenderItem,
} from "react-native";
import {
    Button,
    Chip,
    Dialog,
    Portal,
    Searchbar,
    SegmentedButtons,
    Surface,
    TextInput,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import { ActionButtonRow } from "@/components/ui/ActionButtonRow";
import { ChipRow } from "@/components/ui/ChipRow";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { formatSpaceCategoryLabel } from "@/constants/TrackItUpSpaceCategories";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import {
    uiBorder,
    uiRadius,
    uiSpace,
    uiTypography,
} from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import type { Space, SpaceStatus } from "@/types/trackitup";
import { knownSpaceCategories } from "@/types/trackitup";

type SpaceTableFilter = "active" | "archived" | "all";
type SpaceTableSort = "name-asc" | "name-desc" | "created-desc" | "created-asc";

type EditableSpaceDraft = {
  name: string;
  category: string;
  summary: string;
  themeColor: string;
  status: SpaceStatus;
};

const spaceStatusOrder: SpaceStatus[] = [
  "planned",
  "stable",
  "watch",
  "archived",
];

function getNextStatus(current: SpaceStatus): SpaceStatus {
  const currentIndex = spaceStatusOrder.indexOf(current);
  if (currentIndex < 0) return "planned";
  return (
    spaceStatusOrder[(currentIndex + 1) % spaceStatusOrder.length] ?? "planned"
  );
}

function sortSpaces(spaces: Space[], sort: SpaceTableSort) {
  const next = [...spaces];

  next.sort((left, right) => {
    if (sort === "name-asc") {
      return left.name.localeCompare(right.name);
    }

    if (sort === "name-desc") {
      return right.name.localeCompare(left.name);
    }

    if (sort === "created-asc") {
      return Date.parse(left.createdAt) - Date.parse(right.createdAt);
    }

    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });

  return next;
}

function buildEditDraft(space: Space): EditableSpaceDraft {
  return {
    name: space.name,
    category: String(space.category),
    summary: space.summary,
    themeColor: space.themeColor,
    status: space.status,
  };
}

function formatDate(timestamp: string) {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return "Unknown";
  return new Date(parsed).toLocaleDateString();
}

function statusChipLabel(status: SpaceStatus) {
  switch (status) {
    case "planned":
      return "Planned";
    case "stable":
      return "Stable";
    case "watch":
      return "Watch";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

export default function WorkspaceDatabaseScreen() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const palette = Colors[colorScheme];
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const { workspace, createSpace, updateSpace, archiveSpace } = useWorkspace();
  const isCompactLayout = width < 1024;

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<SpaceTableFilter>("active");
  const [sort, setSort] = useState<SpaceTableSort>("name-asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<EditableSpaceDraft | null>(
    null,
  );
  const [pendingArchive, setPendingArchive] = useState<Space | null>(null);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<string>(
    knownSpaceCategories[0],
  );
  const [newSummary, setNewSummary] = useState("");
  const [newThemeColor, setNewThemeColor] = useState("");
  const [newStatus, setNewStatus] = useState<SpaceStatus>("planned");
  const [message, setMessage] = useState<string | null>(null);

  const visibleSpaces = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = workspace.spaces.filter((space) => {
      if (filter === "active" && space.status === "archived") return false;
      if (filter === "archived" && space.status !== "archived") return false;

      if (!normalizedQuery) return true;

      const searchable = [
        space.name,
        String(space.category),
        space.summary,
        space.status,
        space.themeColor,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });

    return sortSpaces(filtered, sort);
  }, [filter, searchQuery, sort, workspace.spaces]);

  const activeCount = useMemo(
    () =>
      workspace.spaces.filter((space) => space.status !== "archived").length,
    [workspace.spaces],
  );

  const archivedCount = workspace.spaces.length - activeCount;

  function beginEdit(space: Space) {
    setEditingId(space.id);
    setEditingDraft(buildEditDraft(space));
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingDraft(null);
  }

  function saveEdit(space: Space) {
    if (!editingDraft) return;

    const result = updateSpace(space.id, {
      name: editingDraft.name,
      category: editingDraft.category,
      summary: editingDraft.summary,
      themeColor: editingDraft.themeColor,
      status: editingDraft.status,
    });

    setMessage(result.message);

    if (result.status === "updated") {
      setEditingId(null);
      setEditingDraft(null);
    }
  }

  function createNewSpace() {
    const result = createSpace({
      name: newName,
      category: newCategory,
      summary: newSummary,
      themeColor: newThemeColor.trim() || undefined,
      status: newStatus,
    });

    setMessage(result.message);

    if (result.status === "created") {
      setNewName("");
      setNewSummary("");
      setNewThemeColor("");
      setNewStatus("planned");
    }
  }

  function confirmArchive() {
    if (!pendingArchive) return;

    const result = archiveSpace(pendingArchive.id);
    setMessage(result.message);
    setPendingArchive(null);

    if (editingId === pendingArchive.id) {
      setEditingId(null);
      setEditingDraft(null);
    }
  }

  const renderSpaceRow: ListRenderItem<Space> = ({ item }) => {
    const isEditing = editingId === item.id && editingDraft !== null;

    if (isCompactLayout) {
      return (
        <Surface
          style={[styles.compactRow, paletteStyles.cardSurface]}
          elevation={0}
        >
          <View style={styles.compactHeaderRow}>
            <Text style={styles.tableBodyStrong}>{item.name}</Text>
            {isEditing ? (
              <Button
                mode="contained-tonal"
                onPress={() =>
                  setEditingDraft((current) =>
                    current
                      ? {
                          ...current,
                          status: getNextStatus(current.status),
                        }
                      : current,
                  )
                }
                compact
              >
                {statusChipLabel(editingDraft.status)}
              </Button>
            ) : (
              <Chip compact>{statusChipLabel(item.status)}</Chip>
            )}
          </View>

          <View style={styles.compactFieldGroup}>
            <Text style={[styles.compactLabel, paletteStyles.mutedText]}>
              Category
            </Text>
            {isEditing ? (
              <TextInput
                mode="outlined"
                dense
                value={editingDraft.category}
                onChangeText={(value) =>
                  setEditingDraft((current) =>
                    current ? { ...current, category: value } : current,
                  )
                }
              />
            ) : (
              <Text style={styles.tableBody}>
                {formatSpaceCategoryLabel(item.category)}
              </Text>
            )}
          </View>

          <View style={styles.compactFieldGroup}>
            <Text style={[styles.compactLabel, paletteStyles.mutedText]}>
              Summary
            </Text>
            {isEditing ? (
              <TextInput
                mode="outlined"
                dense
                multiline
                value={editingDraft.summary}
                onChangeText={(value) =>
                  setEditingDraft((current) =>
                    current ? { ...current, summary: value } : current,
                  )
                }
              />
            ) : (
              <Text style={[styles.tableBody, paletteStyles.mutedText]}>
                {item.summary}
              </Text>
            )}
          </View>

          <View style={styles.compactMetaRow}>
            <View style={styles.compactMetaCell}>
              <Text style={[styles.compactLabel, paletteStyles.mutedText]}>
                Created
              </Text>
              <Text style={styles.tableBody}>{formatDate(item.createdAt)}</Text>
            </View>
            <View style={styles.compactMetaCell}>
              <Text style={[styles.compactLabel, paletteStyles.mutedText]}>
                Theme
              </Text>
              {isEditing ? (
                <TextInput
                  mode="outlined"
                  dense
                  value={editingDraft.themeColor}
                  onChangeText={(value) =>
                    setEditingDraft((current) =>
                      current ? { ...current, themeColor: value } : current,
                    )
                  }
                />
              ) : (
                <Text style={styles.tableBody}>{item.themeColor}</Text>
              )}
            </View>
          </View>

          {isEditing ? (
            <View style={styles.compactFieldGroup}>
              <Text style={[styles.compactLabel, paletteStyles.mutedText]}>
                Name
              </Text>
              <TextInput
                mode="outlined"
                dense
                value={editingDraft.name}
                onChangeText={(value) =>
                  setEditingDraft((current) =>
                    current ? { ...current, name: value } : current,
                  )
                }
              />
            </View>
          ) : null}

          <ActionButtonRow style={styles.compactActionRow}>
            {isEditing ? (
              <>
                <Button mode="contained" onPress={() => saveEdit(item)} compact>
                  Save
                </Button>
                <Button mode="text" onPress={cancelEdit} compact>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button mode="text" onPress={() => beginEdit(item)} compact>
                  Edit
                </Button>
                <Button
                  mode="text"
                  onPress={() => setPendingArchive(item)}
                  compact
                  disabled={item.status === "archived"}
                >
                  Archive
                </Button>
              </>
            )}
          </ActionButtonRow>
        </Surface>
      );
    }

    return (
      <Surface
        style={[styles.tableRow, paletteStyles.cardSurface]}
        elevation={0}
      >
        <View style={styles.nameColumn}>
          {isEditing ? (
            <TextInput
              mode="outlined"
              dense
              value={editingDraft.name}
              onChangeText={(value) =>
                setEditingDraft((current) =>
                  current ? { ...current, name: value } : current,
                )
              }
            />
          ) : (
            <Text style={styles.tableBodyStrong}>{item.name}</Text>
          )}
        </View>

        <View style={styles.categoryColumn}>
          {isEditing ? (
            <TextInput
              mode="outlined"
              dense
              value={editingDraft.category}
              onChangeText={(value) =>
                setEditingDraft((current) =>
                  current ? { ...current, category: value } : current,
                )
              }
            />
          ) : (
            <Text style={styles.tableBody}>
              {formatSpaceCategoryLabel(item.category)}
            </Text>
          )}
        </View>

        <View style={styles.statusColumn}>
          {isEditing ? (
            <Button
              mode="contained-tonal"
              onPress={() =>
                setEditingDraft((current) =>
                  current
                    ? {
                        ...current,
                        status: getNextStatus(current.status),
                      }
                    : current,
                )
              }
              compact
            >
              {statusChipLabel(editingDraft.status)}
            </Button>
          ) : (
            <Chip compact>{statusChipLabel(item.status)}</Chip>
          )}
        </View>

        <View style={styles.summaryColumn}>
          {isEditing ? (
            <TextInput
              mode="outlined"
              dense
              value={editingDraft.summary}
              onChangeText={(value) =>
                setEditingDraft((current) =>
                  current ? { ...current, summary: value } : current,
                )
              }
            />
          ) : (
            <Text
              style={[styles.tableBody, paletteStyles.mutedText]}
              numberOfLines={4}
            >
              {item.summary}
            </Text>
          )}
        </View>

        <View style={styles.createdColumn}>
          <Text style={[styles.tableBody, paletteStyles.mutedText]}>
            {formatDate(item.createdAt)}
          </Text>
        </View>

        <View style={styles.themeColumn}>
          {isEditing ? (
            <TextInput
              mode="outlined"
              dense
              value={editingDraft.themeColor}
              onChangeText={(value) =>
                setEditingDraft((current) =>
                  current ? { ...current, themeColor: value } : current,
                )
              }
            />
          ) : (
            <Text style={styles.tableBody}>{item.themeColor}</Text>
          )}
        </View>

        <View style={styles.actionsColumn}>
          {isEditing ? (
            <ActionButtonRow style={styles.inlineActionRow}>
              <Button mode="contained" onPress={() => saveEdit(item)} compact>
                Save
              </Button>
              <Button mode="text" onPress={cancelEdit} compact>
                Cancel
              </Button>
            </ActionButtonRow>
          ) : (
            <ActionButtonRow style={styles.inlineActionRow}>
              <Button mode="text" onPress={() => beginEdit(item)} compact>
                Edit
              </Button>
              <Button
                mode="text"
                onPress={() => setPendingArchive(item)}
                compact
                disabled={item.status === "archived"}
              >
                Archive
              </Button>
            </ActionButtonRow>
          )}
        </View>
      </Surface>
    );
  };

  const listHeader = (
    <>
      <ScreenHero
        palette={palette}
        title="Workspace database viewer"
        subtitle="Browse and quick-edit your Spaces like a lightweight database table."
        badges={[
          {
            label: "Entity: Spaces",
            backgroundColor: palette.card,
            textColor: palette.tint,
          },
          {
            label: `${activeCount} active`,
            backgroundColor: palette.accentSoft,
          },
          {
            label: `${archivedCount} archived`,
            backgroundColor: palette.card,
          },
        ]}
      />

      <SectionSurface
        palette={palette}
        label="Create row"
        title="Insert a new Space record"
        style={styles.sectionCardSpacing}
      >
        <Text style={[styles.helperText, paletteStyles.mutedText]}>
          V1 scope is Spaces only with archive-only destructive actions.
        </Text>
        <View style={styles.createGrid}>
          <TextInput
            mode="outlined"
            label="Name"
            value={newName}
            onChangeText={setNewName}
            style={styles.createField}
          />
          <TextInput
            mode="outlined"
            label="Category"
            value={newCategory}
            onChangeText={setNewCategory}
            style={styles.createField}
          />
          <TextInput
            mode="outlined"
            label="Summary"
            value={newSummary}
            onChangeText={setNewSummary}
            style={styles.createField}
          />
          <TextInput
            mode="outlined"
            label="Theme color"
            value={newThemeColor}
            onChangeText={setNewThemeColor}
            style={styles.createField}
            placeholder="#0f766e"
          />
        </View>

        <ChipRow style={styles.categoryHintRow}>
          {knownSpaceCategories.slice(0, 6).map((category) => (
            <Pressable key={category} onPress={() => setNewCategory(category)}>
              <Chip compact selected={newCategory === category}>
                {formatSpaceCategoryLabel(category)}
              </Chip>
            </Pressable>
          ))}
        </ChipRow>

        <ActionButtonRow style={styles.toolButtonRow}>
          <Button
            mode="contained"
            onPress={createNewSpace}
            disabled={newName.trim().length === 0}
          >
            Insert row
          </Button>
          <Button
            mode="contained-tonal"
            onPress={() => setNewStatus(getNextStatus(newStatus))}
          >
            Status: {statusChipLabel(newStatus)}
          </Button>
        </ActionButtonRow>
      </SectionSurface>

      <SectionSurface
        palette={palette}
        label="Query"
        title="Search, filter, and sort rows"
        style={styles.sectionCardSpacing}
      >
        <Searchbar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search name, category, summary, status, color"
        />

        <SegmentedButtons
          value={filter}
          onValueChange={(value) => setFilter(value as SpaceTableFilter)}
          style={styles.segmentSpacing}
          buttons={[
            { label: "Active", value: "active" },
            { label: "Archived", value: "archived" },
            { label: "All", value: "all" },
          ]}
        />

        <SegmentedButtons
          value={sort}
          onValueChange={(value) => setSort(value as SpaceTableSort)}
          style={styles.segmentSpacing}
          buttons={[
            { label: "Name ↑", value: "name-asc" },
            { label: "Name ↓", value: "name-desc" },
            { label: "Newest", value: "created-desc" },
            { label: "Oldest", value: "created-asc" },
          ]}
        />
      </SectionSurface>

      {isCompactLayout ? (
        <Text style={[styles.compactHint, paletteStyles.mutedText]}>
          Compact layout enabled for easier reading on smaller screens.
        </Text>
      ) : (
        <Surface
          style={[styles.tableHeader, paletteStyles.cardSurface]}
          elevation={0}
        >
          <Text style={[styles.tableHeaderLabel, styles.nameColumn]}>Name</Text>
          <Text style={[styles.tableHeaderLabel, styles.categoryColumn]}>
            Category
          </Text>
          <Text style={[styles.tableHeaderLabel, styles.statusColumn]}>
            Status
          </Text>
          <Text style={[styles.tableHeaderLabel, styles.summaryColumn]}>
            Summary
          </Text>
          <Text style={[styles.tableHeaderLabel, styles.createdColumn]}>
            Created
          </Text>
          <Text style={[styles.tableHeaderLabel, styles.themeColumn]}>
            Theme
          </Text>
          <Text style={[styles.tableHeaderLabel, styles.actionsColumn]}>
            Actions
          </Text>
        </Surface>
      )}
    </>
  );

  return (
    <View style={[styles.screen, paletteStyles.screenBackground]}>
      <FlatList
        data={visibleSpaces}
        renderItem={renderSpaceRow}
        keyExtractor={(space) => space.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Surface
            style={[styles.emptyStateCard, paletteStyles.cardSurface]}
            elevation={0}
          >
            <Text style={styles.emptyStateTitle}>No matching rows</Text>
            <Text style={[styles.helperText, paletteStyles.mutedText]}>
              Adjust filters or create a new space row.
            </Text>
          </Surface>
        }
        contentContainerStyle={styles.content}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={9}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === "android"}
        scrollEventThrottle={Platform.OS === "web" ? 64 : 32}
      />

      {message ? (
        <SectionMessage
          palette={palette}
          label="Mutation result"
          title="Latest database action"
          message={message}
          style={styles.resultMessage}
        />
      ) : null}

      <Portal>
        <Dialog
          visible={pendingArchive !== null}
          onDismiss={() => setPendingArchive(null)}
        >
          <Dialog.Title>Archive this space row?</Dialog.Title>
          <Dialog.Content>
            <Text>
              {pendingArchive
                ? `${pendingArchive.name} will be soft-archived. This row remains in workspace data and can still be viewed with Archived or All filters.`
                : "Archive this space row?"}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingArchive(null)}>Cancel</Button>
            <Button onPress={confirmArchive}>Archive</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <StatusBar style={colorScheme === "light" ? "dark" : "light"} />
    </View>
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
  sectionCardSpacing: {
    marginBottom: uiSpace.xl,
  },
  helperText: {
    ...uiTypography.support,
  },
  compactHint: {
    ...uiTypography.support,
    marginBottom: uiSpace.sm,
  },
  createGrid: {
    gap: uiSpace.md,
    marginTop: uiSpace.md,
  },
  createField: {
    width: "100%",
  },
  categoryHintRow: {
    marginTop: uiSpace.md,
  },
  toolButtonRow: {
    marginTop: uiSpace.md,
  },
  segmentSpacing: {
    marginTop: uiSpace.md,
  },
  tableHeader: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    paddingHorizontal: uiSpace.md,
    paddingVertical: uiSpace.sm,
    marginBottom: uiSpace.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: uiSpace.sm,
  },
  tableHeaderLabel: {
    ...uiTypography.microLabel,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  tableRow: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    paddingHorizontal: uiSpace.md,
    paddingVertical: uiSpace.sm,
    marginBottom: uiSpace.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: uiSpace.sm,
  },
  tableBodyStrong: {
    ...uiTypography.bodyStrong,
  },
  tableBody: {
    ...uiTypography.body,
  },
  nameColumn: {
    flex: 1.2,
    minWidth: 0,
  },
  categoryColumn: {
    flex: 1.1,
    minWidth: 0,
  },
  statusColumn: {
    flex: 0.9,
    minWidth: 0,
  },
  summaryColumn: {
    flex: 1.8,
    minWidth: 0,
  },
  createdColumn: {
    flex: 0.9,
    minWidth: 0,
  },
  themeColumn: {
    flex: 0.9,
    minWidth: 0,
  },
  actionsColumn: {
    flex: 1.2,
    minWidth: 0,
  },
  inlineActionRow: {
    marginTop: 0,
    marginBottom: 0,
    gap: uiSpace.xs,
  },
  compactRow: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.md,
    marginBottom: uiSpace.sm,
    gap: uiSpace.sm,
  },
  compactHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: uiSpace.md,
  },
  compactFieldGroup: {
    gap: uiSpace.xs,
  },
  compactLabel: {
    ...uiTypography.microLabel,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  compactMetaRow: {
    flexDirection: "row",
    gap: uiSpace.md,
  },
  compactMetaCell: {
    flex: 1,
    gap: uiSpace.xs,
  },
  compactActionRow: {
    marginTop: uiSpace.xs,
    marginBottom: 0,
  },
  emptyStateCard: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.xl,
    padding: uiSpace.surface,
  },
  emptyStateTitle: {
    ...uiTypography.titleMd,
    marginBottom: uiSpace.xs,
  },
  resultMessage: {
    marginHorizontal: uiSpace.screen,
    marginBottom: uiSpace.md,
  },
});
