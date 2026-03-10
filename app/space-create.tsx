import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
    Button,
    SegmentedButtons,
    Surface,
    TextInput,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/Themed";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { createCommonPaletteStyles } from "@/constants/UiStyleBuilders";
import { uiBorder, uiSpace, uiTypography } from "@/constants/UiTokens";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { getSpaceCreationSuggestion } from "@/services/spaces/spaceCreationSuggestions";
import type { SpaceCategory } from "@/types/trackitup";

const categoryLabels: Record<SpaceCategory, string> = {
  aquarium: "Aquarium",
  gardening: "Gardening",
  "vehicle-maintenance": "Vehicle",
};

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
  }>();
  const actionId = pickParam(params.actionId);
  const templateId = pickParam(params.templateId);
  const { createSpace, workspace } = useWorkspace();
  const action = workspace.quickActions.find((item) => item.id === actionId);
  const selectedTemplate = workspace.templates.find(
    (item) => item.id === templateId,
  );
  const suggestion = useMemo(
    () => getSpaceCreationSuggestion(action, selectedTemplate),
    [action, selectedTemplate],
  );
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SpaceCategory>(
    suggestion.suggestedCategory ?? "aquarium",
  );
  const [hasChangedCategory, setHasChangedCategory] = useState(false);
  const [summary, setSummary] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isFirstSpace = workspace.spaces.length === 0;

  useEffect(() => {
    if (!hasChangedCategory && suggestion.suggestedCategory) {
      setCategory(suggestion.suggestedCategory);
    }
  }, [hasChangedCategory, suggestion.suggestedCategory]);

  const primaryActionLabel =
    actionId || templateId
      ? suggestion.primaryActionLabel
      : isFirstSpace
        ? "Create first space"
        : "Save space";

  function handleSave() {
    const result = createSpace({ name, category, summary });
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

  return (
    <View style={[styles.screen, paletteStyles.screenBackground]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHero
          palette={palette}
          title={isFirstSpace ? "Create your first space" : "Add a new space"}
          subtitle={suggestion.heroSubtitle}
          badges={[
            { label: isFirstSpace ? "First space" : "New space" },
            ...(suggestion.badgeLabel
              ? [{ label: suggestion.badgeLabel }]
              : []),
          ]}
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
            placeholder={suggestion.namePlaceholder}
          />
          <Text style={[styles.helperText, paletteStyles.mutedText]}>
            Keep the name short and obvious so it is easy to pick during
            recording.
          </Text>
          <SegmentedButtons
            value={category}
            onValueChange={(value: string) => {
              setHasChangedCategory(true);
              setCategory(value as SpaceCategory);
            }}
            buttons={Object.entries(categoryLabels).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <TextInput
            mode="outlined"
            label="Summary"
            value={summary}
            onChangeText={setSummary}
            placeholder={suggestion.summaryPlaceholder}
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
    gap: uiSpace.md,
  },
  footerButton: {
    flex: 1,
  },
  footerButtonContent: {
    minHeight: 40,
  },
});
