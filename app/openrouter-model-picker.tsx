import { Stack, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  InteractionManager,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Chip,
  RadioButton,
  SegmentedButtons,
  TextInput,
  TouchableRipple,
} from "react-native-paper";

import { Text } from "@/components/Themed";
import { ChipRow } from "@/components/ui/ChipRow";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import { uiRadius, uiSpace, uiTypography } from "@/constants/UiTokens";
import { useAiPreferences } from "@/providers/AiPreferencesProvider";
import { aiAccountSettingsCopy } from "@/services/ai/aiConsentCopy";
import {
  loadOpenRouterModelSortPreference,
  persistOpenRouterModelSortPreference,
} from "@/services/ai/aiPreferencePersistence";
import {
  DEFAULT_OPENROUTER_MODEL_SORT,
  filterOpenRouterSelectableModels,
  formatOpenRouterModelPricingLabel,
  getDefaultOpenRouterModelTier,
  getOpenRouterSearchHighlightParts,
  loadOpenRouterSelectableModels,
  normalizeOpenRouterModelSort,
  sortOpenRouterSelectableModels,
  type OpenRouterModelSort,
  type OpenRouterModelTier,
  type OpenRouterSelectableModel,
} from "@/services/ai/openRouterModels";

const OpenRouterHighlightedText = memo(function OpenRouterHighlightedText({
  value,
  query,
  style,
  highlightStyle,
  numberOfLines,
}: {
  value: string;
  query: string;
  style: object | object[];
  highlightStyle: object | object[];
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={style}>
      {getOpenRouterSearchHighlightParts(value, query).map((part, index) => (
        <Text
          key={`${value}-${index}`}
          style={part.isHighlighted ? highlightStyle : undefined}
        >
          {part.text}
        </Text>
      ))}
    </Text>
  );
});

const OpenRouterModelListItem = memo(function OpenRouterModelListItem({
  model,
  isSelected,
  highlightQuery,
  palette,
  mutedTextStyle,
  onSelect,
}: {
  model: OpenRouterSelectableModel;
  isSelected: boolean;
  highlightQuery: string;
  palette: (typeof Colors)[keyof typeof Colors];
  mutedTextStyle: object | object[];
  onSelect: (model: OpenRouterSelectableModel) => void;
}) {
  return (
    <TouchableRipple
      borderless={false}
      onPress={() => onSelect(model)}
      style={[
        styles.modelOption,
        {
          borderColor: isSelected ? palette.tint : palette.border,
          backgroundColor: isSelected ? palette.accentSoft : palette.surface2,
        },
      ]}
    >
      <View style={styles.modelOptionContent}>
        <View style={styles.modelOptionHeader}>
          <View style={styles.modelOptionTextBlock}>
            <OpenRouterHighlightedText
              value={model.name}
              query={highlightQuery}
              style={styles.modelOptionTitle}
              highlightStyle={[
                styles.modelSearchHighlight,
                { backgroundColor: palette.accentSoft, color: palette.text },
              ]}
            />
            <OpenRouterHighlightedText
              value={model.id}
              query={highlightQuery}
              style={mutedTextStyle}
              highlightStyle={[
                styles.modelSearchHighlight,
                { backgroundColor: palette.accentSoft, color: palette.text },
              ]}
            />
            <Text style={mutedTextStyle}>
              {formatOpenRouterModelPricingLabel(model)}
              {model.contextLength
                ? ` • ${model.contextLength.toLocaleString()} context`
                : ""}
            </Text>
          </View>
          <RadioButton
            value={model.id}
            status={isSelected ? "checked" : "unchecked"}
            onPress={() => onSelect(model)}
          />
        </View>
        {model.description ? (
          <OpenRouterHighlightedText
            value={model.description}
            query={highlightQuery}
            style={mutedTextStyle}
            highlightStyle={[
              styles.modelSearchHighlight,
              { backgroundColor: palette.accentSoft, color: palette.text },
            ]}
            numberOfLines={3}
          />
        ) : null}
      </View>
    </TouchableRipple>
  );
});

export default function OpenRouterModelPickerScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const aiPreferences = useAiPreferences();
  const [isLoadingOpenRouterModels, setIsLoadingOpenRouterModels] =
    useState(false);
  const [openRouterModelQuery, setOpenRouterModelQuery] = useState("");
  const [debouncedOpenRouterModelQuery, setDebouncedOpenRouterModelQuery] =
    useState("");
  const [showSelectedOpenRouterModelOnly, setShowSelectedOpenRouterModelOnly] =
    useState(false);
  const [openRouterModelSort, setOpenRouterModelSort] =
    useState<OpenRouterModelSort>(DEFAULT_OPENROUTER_MODEL_SORT);
  const [openRouterModelTier, setOpenRouterModelTier] =
    useState<OpenRouterModelTier>("free");
  const [openRouterModels, setOpenRouterModels] = useState<
    OpenRouterSelectableModel[]
  >([]);
  const [openRouterModelError, setOpenRouterModelError] = useState<
    string | null
  >(null);
  const [isTransitionSettled, setIsTransitionSettled] = useState(false);
  const hasLoadedOpenRouterModelSortPreferenceRef = useRef(false);

  const selectedOpenRouterModel = useMemo(
    () =>
      openRouterModels.find(
        (model) => model.id === aiPreferences.openRouterTextModel,
      ) ?? null,
    [aiPreferences.openRouterTextModel, openRouterModels],
  );
  const openRouterTierModels = useMemo(
    () =>
      showSelectedOpenRouterModelOnly
        ? openRouterModels.filter(
            (model) => model.id === aiPreferences.openRouterTextModel,
          )
        : openRouterModels.filter(
            (model) => model.tier === openRouterModelTier,
          ),
    [
      aiPreferences.openRouterTextModel,
      openRouterModelTier,
      openRouterModels,
      showSelectedOpenRouterModelOnly,
    ],
  );
  const visibleOpenRouterModels = useMemo(
    () =>
      sortOpenRouterSelectableModels(
        filterOpenRouterSelectableModels(
          openRouterTierModels,
          debouncedOpenRouterModelQuery,
        ),
        openRouterModelSort,
      ),
    [debouncedOpenRouterModelQuery, openRouterModelSort, openRouterTierModels],
  );
  const freeOpenRouterModelCount = useMemo(
    () => openRouterModels.filter((model) => model.tier === "free").length,
    [openRouterModels],
  );
  const paidOpenRouterModelCount = useMemo(
    () => openRouterModels.filter((model) => model.tier === "paid").length,
    [openRouterModels],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedOpenRouterModelQuery(openRouterModelQuery);
    }, 180);

    return () => clearTimeout(timeoutId);
  }, [openRouterModelQuery]);

  useEffect(() => {
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      setIsTransitionSettled(true);
    });

    return () => {
      interactionTask.cancel();
    };
  }, []);

  useEffect(() => {
    if (!isTransitionSettled) return;

    let isMounted = true;

    void loadOpenRouterModelSortPreference()
      .then((storedSort) => {
        if (!isMounted) return;
        setOpenRouterModelSort(normalizeOpenRouterModelSort(storedSort));
      })
      .finally(() => {
        if (isMounted) {
          hasLoadedOpenRouterModelSortPreferenceRef.current = true;
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isTransitionSettled]);

  useEffect(() => {
    if (!hasLoadedOpenRouterModelSortPreferenceRef.current) return;
    void persistOpenRouterModelSortPreference(openRouterModelSort);
  }, [openRouterModelSort]);

  const loadOpenRouterModels = useCallback(
    async (forceRefresh = false) => {
      if (isLoadingOpenRouterModels && !forceRefresh) return;
      if (!forceRefresh && openRouterModels.length > 0) return;

      setIsLoadingOpenRouterModels(true);
      setOpenRouterModelError(null);
      try {
        const loadedModels = await loadOpenRouterSelectableModels();
        setOpenRouterModels(loadedModels);
        setOpenRouterModelTier(
          getDefaultOpenRouterModelTier(
            loadedModels,
            aiPreferences.openRouterTextModel,
          ),
        );
      } catch (error) {
        setOpenRouterModelError(
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "TrackItUp could not load the OpenRouter model catalog right now.",
        );
      } finally {
        setIsLoadingOpenRouterModels(false);
      }
    },
    [
      aiPreferences.openRouterTextModel,
      isLoadingOpenRouterModels,
      openRouterModels.length,
    ],
  );

  useEffect(() => {
    if (!isTransitionSettled) return;
    void loadOpenRouterModels();
  }, [isTransitionSettled, loadOpenRouterModels]);

  const handleSelectOpenRouterModel = useCallback(
    (model: OpenRouterSelectableModel) => {
      aiPreferences.setOpenRouterTextModel(model.id);
      router.back();
    },
    [aiPreferences, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: OpenRouterSelectableModel }) => (
      <OpenRouterModelListItem
        model={item}
        isSelected={item.id === aiPreferences.openRouterTextModel}
        highlightQuery={debouncedOpenRouterModelQuery}
        palette={palette}
        mutedTextStyle={[styles.meta, paletteStyles.mutedText]}
        onSelect={handleSelectOpenRouterModel}
      />
    ),
    [
      aiPreferences.openRouterTextModel,
      debouncedOpenRouterModelQuery,
      handleSelectOpenRouterModel,
      palette,
      paletteStyles.mutedText,
    ],
  );

  return (
    <View style={[styles.screen, paletteStyles.screenBackground]}>
      <Stack.Screen options={{ title: "OpenRouter models" }} />
      <View style={styles.content}>
        <Text style={[styles.copy, paletteStyles.mutedText]}>
          Browse the live OpenRouter catalog and choose the default model for
          TrackItUp AI requests on this device.
        </Text>
        <View
          style={[
            styles.selectedModelSummary,
            {
              borderColor: palette.border,
              backgroundColor: palette.surface2,
            },
          ]}
        >
          <Text style={styles.selectedModelSummaryTitle}>Selected model</Text>
          <Text style={styles.modelOptionTitle}>
            {selectedOpenRouterModel?.name ?? aiPreferences.openRouterTextModel}
          </Text>
          <Text style={[styles.meta, paletteStyles.mutedText]}>
            {selectedOpenRouterModel?.id ?? aiPreferences.openRouterTextModel}
          </Text>
          <Text style={[styles.meta, paletteStyles.mutedText]}>
            {selectedOpenRouterModel
              ? `${formatOpenRouterModelPricingLabel(selectedOpenRouterModel)}${selectedOpenRouterModel.contextLength ? ` • ${selectedOpenRouterModel.contextLength.toLocaleString()} context` : ""}`
              : "Saved locally. Refresh the catalog if this model is missing from the current list."}
          </Text>
          <Text style={[styles.meta, paletteStyles.mutedText]}>
            {aiAccountSettingsCopy.modelSelectionDefault}
          </Text>
        </View>
        <SegmentedButtons
          value={openRouterModelTier}
          onValueChange={(value: string) =>
            setOpenRouterModelTier(value as OpenRouterModelTier)
          }
          style={styles.themeSelector}
          buttons={[
            {
              value: "free",
              label:
                freeOpenRouterModelCount > 0
                  ? `Free (${freeOpenRouterModelCount})`
                  : "Free",
              disabled: isLoadingOpenRouterModels,
            },
            {
              value: "paid",
              label:
                paidOpenRouterModelCount > 0
                  ? `Paid (${paidOpenRouterModelCount})`
                  : "Paid",
              disabled: isLoadingOpenRouterModels,
            },
          ]}
        />
        <TextInput
          mode="outlined"
          label="Search models"
          value={openRouterModelQuery}
          onChangeText={setOpenRouterModelQuery}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Search by name, id, or description"
          style={styles.modelSearchInput}
          disabled={isLoadingOpenRouterModels}
        />
        <ChipRow style={styles.modelFilterChipRow}>
          <Chip
            compact
            selected={showSelectedOpenRouterModelOnly}
            onPress={() => {
              setShowSelectedOpenRouterModelOnly((value) => {
                const nextValue = !value;
                if (nextValue && selectedOpenRouterModel) {
                  setOpenRouterModelTier(selectedOpenRouterModel.tier);
                }
                return nextValue;
              });
            }}
            disabled={isLoadingOpenRouterModels}
            style={styles.themeChip}
            icon="check-circle-outline"
          >
            Selected
          </Chip>
          {openRouterModelQuery.trim().length > 0 ? (
            <Chip
              compact
              onPress={() => {
                setOpenRouterModelQuery("");
                setDebouncedOpenRouterModelQuery("");
              }}
              disabled={isLoadingOpenRouterModels}
              style={styles.themeChip}
              icon="close-circle-outline"
            >
              Clear search
            </Chip>
          ) : null}
          <Chip
            compact
            onPress={() => void loadOpenRouterModels(true)}
            disabled={isLoadingOpenRouterModels}
            style={styles.themeChip}
            icon="refresh"
          >
            Refresh
          </Chip>
        </ChipRow>
        <SegmentedButtons
          value={openRouterModelSort}
          onValueChange={(value: string) =>
            setOpenRouterModelSort(value as OpenRouterModelSort)
          }
          style={styles.modelSortSelector}
          buttons={[
            { value: "recommended", label: "A-Z" },
            { value: "release-date", label: "Newest" },
            { value: "context-length", label: "Context" },
            { value: "price", label: "Price" },
          ]}
        />
        {!isTransitionSettled || isLoadingOpenRouterModels ? (
          <ActivityIndicator style={styles.loader} />
        ) : openRouterModelError ? (
          <View style={styles.emptyState}>
            <Text style={[styles.meta, paletteStyles.mutedText]}>
              {openRouterModelError}
            </Text>
            <Button onPress={() => void loadOpenRouterModels(true)}>
              Retry
            </Button>
          </View>
        ) : (
          <View style={styles.modelListContainer}>
            <FlatList
              data={visibleOpenRouterModels}
              extraData={`${aiPreferences.openRouterTextModel}:${debouncedOpenRouterModelQuery}`}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.modelList}
              contentContainerStyle={styles.modelListContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={6}
              updateCellsBatchingPeriod={34}
              removeClippedSubviews={Platform.OS !== "web"}
              ListEmptyComponent={
                <Text style={[styles.meta, paletteStyles.mutedText]}>
                  {openRouterModelQuery.trim().length > 0
                    ? `No ${showSelectedOpenRouterModelOnly ? "selected" : openRouterModelTier} text models match “${openRouterModelQuery.trim()}” right now.`
                    : showSelectedOpenRouterModelOnly
                      ? "The currently selected model is not available in the OpenRouter catalog right now."
                      : `No ${openRouterModelTier} text models are available from OpenRouter right now.`}
                </Text>
              }
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 },
  content: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: uiSpace.screen,
    paddingTop: uiSpace.screen,
    paddingBottom: uiSpace.screenBottom,
  },
  copy: { ...uiTypography.body, marginBottom: uiSpace.sm },
  meta: { ...uiTypography.label, marginTop: uiSpace.xxs, lineHeight: 18 },
  loader: { marginVertical: uiSpace.lg },
  emptyState: { marginTop: uiSpace.lg, alignItems: "flex-start" },
  selectedModelSummary: {
    marginBottom: uiSpace.sm,
    padding: uiSpace.md,
    borderRadius: uiRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selectedModelSummaryTitle: {
    ...uiTypography.label,
    fontWeight: "600",
    marginBottom: uiSpace.xs,
  },
  themeSelector: { marginTop: uiSpace.sm },
  modelSearchInput: { marginTop: uiSpace.md },
  modelFilterChipRow: { marginTop: uiSpace.sm, marginBottom: uiSpace.xs },
  modelSortSelector: { marginTop: uiSpace.sm },
  modelListContainer: { flex: 1, minHeight: 0 },
  modelList: { flex: 1, minHeight: 0, marginTop: uiSpace.md },
  modelListContent: { paddingBottom: uiSpace.screenBottom },
  modelOption: {
    borderRadius: uiRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: uiSpace.sm,
    overflow: "hidden",
  },
  modelOptionContent: { padding: uiSpace.md },
  modelOptionHeader: { flexDirection: "row", alignItems: "flex-start" },
  modelOptionTextBlock: { flex: 1, paddingRight: uiSpace.sm },
  modelOptionTitle: {
    ...uiTypography.body,
    fontWeight: "600",
    marginBottom: uiSpace.xxs,
  },
  modelSearchHighlight: {
    fontWeight: "700",
    borderRadius: uiRadius.sm,
  },
  themeChip: { borderRadius: uiRadius.pill },
});
