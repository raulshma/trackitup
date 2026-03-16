import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  Portal,
  Surface,
  TextInput,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/Themed";
import { ChipRow } from "@/components/ui/ChipRow";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import {
  buildSpaceCategoryOptions,
  DEFAULT_SPACE_CATEGORY,
  formatSpaceCategoryLabel,
  getSpaceCategoryNamePlaceholder,
  getSpaceCategorySummaryPlaceholder,
  normalizeSpaceCategoryValue,
} from "@/constants/TrackItUpSpaceCategories";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import { uiBorder, uiSpace, uiTypography } from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { getSpaceCreationSuggestion } from "@/services/spaces/spaceCreationSuggestions";
import type { SpaceCategory } from "@/types/trackitup";

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function SpaceCreateScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const params = useLocalSearchParams<{
    actionId?: string | string[];
    templateId?: string | string[];
    spaceId?: string | string[];
  }>();
  const actionId = pickParam(params.actionId);
  const templateId = pickParam(params.templateId);
  const spaceId = pickParam(params.spaceId);
  const { archiveSpace, createSpace, updateSpace, workspace } = useWorkspace();
  const editingSpace = useMemo(
    () => workspace.spaces.find((space) => space.id === spaceId),
    [spaceId, workspace.spaces],
  );
  const isEditMode = Boolean(editingSpace);
  const action = workspace.quickActions.find((item) => item.id === actionId);
  const selectedTemplate = workspace.templates.find(
    (item) => item.id === templateId,
  );
  const suggestion = useMemo(
    () => getSpaceCreationSuggestion(action, selectedTemplate),
    [action, selectedTemplate],
  );
  const [name, setName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SpaceCategory>(
    suggestion.suggestedCategory ?? DEFAULT_SPACE_CATEGORY,
  );
  const [customCategory, setCustomCategory] = useState("");
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [hasChangedCategory, setHasChangedCategory] = useState(false);
  const [summary, setSummary] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isArchiveDialogVisible, setIsArchiveDialogVisible] = useState(false);

  const isFirstSpace = workspace.spaces.length === 0;
  const categoryOptions = useMemo(
    () =>
      buildSpaceCategoryOptions(
        workspace.spaces.map((space) => space.category),
      ),
    [workspace.spaces],
  );
  const resolvedCategory = useMemo(
    () =>
      normalizeSpaceCategoryValue(
        isAddingCustomCategory ? customCategory : selectedCategory,
      ),
    [customCategory, isAddingCustomCategory, selectedCategory],
  );
  const currentCategoryLabel = resolvedCategory
    ? formatSpaceCategoryLabel(resolvedCategory)
    : "Add a category";
  const namePlaceholder =
    getSpaceCategoryNamePlaceholder(resolvedCategory) ??
    suggestion.namePlaceholder;
  const summaryPlaceholder =
    getSpaceCategorySummaryPlaceholder(resolvedCategory) ??
    suggestion.summaryPlaceholder;

  useEffect(() => {
    if (!editingSpace) return;

    setName(editingSpace.name);
    setSummary(editingSpace.summary ?? "");

    const normalizedCategory = normalizeSpaceCategoryValue(
      editingSpace.category,
    );
    setHasChangedCategory(true);
    if (normalizedCategory) {
      setSelectedCategory(normalizedCategory);
      setCustomCategory("");
      setIsAddingCustomCategory(false);
      return;
    }

    setIsAddingCustomCategory(true);
    setCustomCategory(editingSpace.category);
  }, [editingSpace]);

  useEffect(() => {
    if (!hasChangedCategory) {
      setSelectedCategory(
        suggestion.suggestedCategory ?? DEFAULT_SPACE_CATEGORY,
      );
      setCustomCategory("");
      setIsAddingCustomCategory(false);
    }
  }, [hasChangedCategory, suggestion.suggestedCategory]);

  const primaryActionLabel = isEditMode
    ? "Save changes"
    : actionId || templateId
      ? suggestion.primaryActionLabel
      : isFirstSpace
        ? "Create first space"
        : "Save space";

  function handleSave() {
    if (editingSpace) {
      const result = updateSpace(editingSpace.id, {
        name,
        category: resolvedCategory,
        summary,
      });
      setStatusMessage(result.message);
      if (result.status !== "updated") return;

      router.replace("/" as never);
      return;
    }

    const result = createSpace({ name, category: resolvedCategory, summary });
    setStatusMessage(result.message);
    if (result.status !== "created") return;

    if (actionId) {
      router.replace({
        pathname: "/logbook",
        params: {
          actionId,
          spaceId: result.spaceId,
          createdSpaceName: name.trim(),
        },
      });
      return;
    }
    if (templateId) {
      router.replace({
        pathname: "/logbook",
        params: {
          templateId,
          spaceId: result.spaceId,
          createdSpaceName: name.trim(),
        },
      });
      return;
    }
    router.replace({
      pathname: "/logbook",
      params: {
        spaceId: result.spaceId,
        createdSpaceName: name.trim(),
      },
    });
  }

  function handleArchiveSpace() {
    if (!editingSpace) return;

    const result = archiveSpace(editingSpace.id);
    setStatusMessage(result.message);
    setIsArchiveDialogVisible(false);

    if (result.status === "archived") {
      router.replace("/" as never);
    }
  }

  const pageQuickActions = [
    {
      id: "space-create-save",
      label: primaryActionLabel,
      hint: `Current category: ${currentCategoryLabel} • ${name.trim().length > 0 ? `name ready as ${name.trim()}` : "choose a clear name to finish setup"}`,
      onPress: handleSave,
      accentColor: palette.tint,
    },
    ...(isEditMode
      ? [
          {
            id: "space-edit-archive",
            label: "Archive space",
            hint: "Hide this space from active lists while keeping historical logs and records.",
            onPress: () => setIsArchiveDialogVisible(true),
            accentColor: palette.danger,
          },
        ]
      : []),
    {
      id: "space-create-logbook",
      label: "Open logbook",
      hint: suggestion.returnMessage,
      onPress: () => router.push("/logbook" as never),
      accentColor: palette.secondary,
    },
    {
      id: "space-create-builder",
      label: "Open schema builder",
      hint: "Need a custom form before you start tracking? Build it before finishing the space.",
      onPress: () => router.push("/schema-builder" as never),
    },
  ];

  function handleSelectCategory(category: SpaceCategory) {
    setHasChangedCategory(true);
    setSelectedCategory(category);
    setCustomCategory("");
    setIsAddingCustomCategory(false);
  }

  function handleStartCustomCategory() {
    setHasChangedCategory(true);
    setIsAddingCustomCategory(true);
  }

  return (
    <View style={[styles.screen, paletteStyles.screenBackground]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHero
          palette={palette}
          title={
            isEditMode
              ? `Edit ${editingSpace?.name ?? "space"}`
              : isFirstSpace
                ? "Create your first space"
                : "Add a new space"
          }
          subtitle={
            isEditMode
              ? "Update the space details, then save changes or archive the space when you want it hidden from active views."
              : suggestion.heroSubtitle
          }
          badges={[
            {
              label: isEditMode
                ? "Edit mode"
                : isFirstSpace
                  ? "First space"
                  : "New space",
            },
            ...(suggestion.badgeLabel
              ? [{ label: suggestion.badgeLabel }]
              : []),
          ]}
        />

        <PageQuickActions
          palette={palette}
          title="Set up the next space quickly"
          description={
            isEditMode
              ? "Save updated details, archive this space, or jump to nearby tools without leaving setup context."
              : "Finish the space, jump back to recording, or open the custom schema builder if this space needs a more tailored form setup."
          }
          actions={pageQuickActions}
        />

        <SectionSurface
          palette={palette}
          label="Setup"
          title="Name the place you want to track"
        >
          <TextInput
            mode="outlined"
            label="Space name"
            value={name}
            onChangeText={setName}
            placeholder={namePlaceholder}
          />
          <Text style={[styles.helperText, paletteStyles.mutedText]}>
            Keep the name short and obvious so it is easy to pick during
            recording.
          </Text>
          <Text style={[styles.helperText, paletteStyles.mutedText]}>
            Pick a suggested category or add a new one for this space.
          </Text>
          <ChipRow>
            {categoryOptions.map((option) => {
              const isActive =
                !isAddingCustomCategory && option.value === selectedCategory;
              return (
                <Chip
                  key={String(option.value)}
                  compact
                  selected={isActive}
                  onPress={() => handleSelectCategory(option.value)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isActive
                        ? palette.accentSoft
                        : palette.surface2,
                      borderColor: isActive ? palette.tint : palette.border,
                    },
                  ]}
                  textStyle={[
                    styles.categoryChipLabel,
                    { color: isActive ? palette.tint : palette.text },
                  ]}
                >
                  {option.label}
                </Chip>
              );
            })}
            <Chip
              compact
              selected={isAddingCustomCategory}
              onPress={handleStartCustomCategory}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isAddingCustomCategory
                    ? palette.accentSoft
                    : palette.surface2,
                  borderColor: isAddingCustomCategory
                    ? palette.tint
                    : palette.border,
                },
              ]}
              textStyle={[
                styles.categoryChipLabel,
                { color: isAddingCustomCategory ? palette.tint : palette.text },
              ]}
            >
              + New category
            </Chip>
          </ChipRow>
          {isAddingCustomCategory ? (
            <TextInput
              mode="outlined"
              label="New category"
              value={customCategory}
              onChangeText={(value) => {
                setHasChangedCategory(true);
                setCustomCategory(value);
              }}
              placeholder="Pet room, home office, workshop bench"
              autoCapitalize="words"
              style={styles.categoryInput}
            />
          ) : null}
          <TextInput
            mode="outlined"
            label="Summary"
            value={summary}
            onChangeText={setSummary}
            placeholder={summaryPlaceholder}
            multiline
            style={styles.summaryInput}
          />
          <Text style={[styles.helperText, paletteStyles.mutedText]}>
            {suggestion.returnMessage}
          </Text>
        </SectionSurface>

        {statusMessage ? (
          <SectionMessage
            palette={palette}
            label="Status"
            title="Space creation"
            message={statusMessage}
          />
        ) : null}
      </ScrollView>

      <Surface
        style={[
          styles.footer,
          {
            backgroundColor: palette.surface1,
            borderColor: palette.border,
            paddingBottom: uiSpace.lg + insets.bottom,
          },
        ]}
        elevation={2}
      >
        <View style={styles.footerActions}>
          {isEditMode ? (
            <Button
              mode="outlined"
              onPress={() => setIsArchiveDialogVisible(true)}
              style={styles.footerButton}
              contentStyle={styles.footerButtonContent}
            >
              Archive
            </Button>
          ) : null}
          <Button
            mode="outlined"
            onPress={() => router.back()}
            style={styles.footerButton}
            contentStyle={styles.footerButtonContent}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.footerButton}
            contentStyle={styles.footerButtonContent}
          >
            {primaryActionLabel}
          </Button>
        </View>
      </Surface>

      <Portal>
        <Dialog
          visible={isArchiveDialogVisible}
          onDismiss={() => setIsArchiveDialogVisible(false)}
        >
          <Dialog.Title>Archive this space?</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.archiveDialogText, paletteStyles.mutedText]}>
              Archiving hides the space from active lists while keeping history,
              logs, and related records available.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsArchiveDialogVisible(false)}>
              Cancel
            </Button>
            <Button onPress={handleArchiveSpace}>Archive</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: uiSpace.screen, paddingBottom: uiSpace.screenBottom },
  helperText: {
    ...uiTypography.bodySmall,
    marginTop: uiSpace.sm,
    marginBottom: uiSpace.lg,
  },
  categoryChip: {
    borderWidth: uiBorder.standard,
  },
  categoryChipLabel: uiTypography.bodySmall,
  categoryInput: {
    marginTop: uiSpace.lg,
  },
  summaryInput: {
    marginTop: uiSpace.lg,
    marginBottom: uiSpace.sm,
    minHeight: 100,
  },
  footer: {
    borderTopWidth: uiBorder.standard,
    paddingHorizontal: uiSpace.screen,
    paddingTop: uiSpace.lg,
  },
  footerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: uiSpace.md,
  },
  footerButton: {
    alignSelf: "flex-start",
  },
  footerButtonContent: {
    minHeight: 40,
  },
  archiveDialogText: {
    ...uiTypography.body,
  },
});
