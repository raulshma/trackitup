import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
    Button,
    Chip,
    SegmentedButtons,
    Surface,
    Switch,
    TextInput,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DynamicFormRenderer } from "@/components/DynamicFormRenderer";
import { Text } from "@/components/Themed";
import { ChipRow } from "@/components/ui/ChipRow";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionMessage } from "@/components/ui/SectionMessage";
import { SectionSurface } from "@/components/ui/SectionSurface";
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
import {
    buildInitialFormValues,
    normalizeFormValues,
    type FormValidationErrors,
    type FormValue,
    type FormValueMap,
} from "@/services/forms/workspaceForm";
import {
    buildCustomSchemaTemplate,
    customSchemaFieldPresets,
    customSchemaFieldTypes,
    customSchemaQuickActionLabels,
    customSchemaSourceOptions,
    getBuilderFieldTypeLabel,
    hasCustomSchemaFieldLabelConflict,
    type CustomSchemaFieldDraft,
} from "@/services/templates/customSchema";
import type { QuickActionKind } from "@/types/trackitup";

const quickActionKinds = Object.keys(
  customSchemaQuickActionLabels,
) as QuickActionKind[];

export default function SchemaBuilderScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const { saveCustomTemplate, workspace } = useWorkspace();
  const [name, setName] = useState("Custom hobby schema");
  const [summary, setSummary] = useState(
    "A local template built from the TrackItUp schema builder.",
  );
  const [category, setCategory] = useState("Custom");
  const [quickActionKind, setQuickActionKind] =
    useState<QuickActionKind>("quick-log");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [extraFields, setExtraFields] = useState<CustomSchemaFieldDraft[]>([]);
  const [fieldDraft, setFieldDraft] = useState<CustomSchemaFieldDraft>({
    label: "",
    type: "text",
    description: "",
    placeholder: "",
    required: false,
  });
  const [previewValues, setPreviewValues] = useState<FormValueMap>({});
  const [previewErrors, setPreviewErrors] = useState<FormValidationErrors>({});

  const builtTemplate = useMemo(
    () =>
      buildCustomSchemaTemplate({
        name,
        summary,
        category,
        quickActionKind,
        extraFields,
      }),
    [category, extraFields, name, quickActionKind, summary],
  );
  const totalFieldCount = useMemo(
    () =>
      builtTemplate.formTemplate?.sections.reduce(
        (count, section) => count + section.fields.length,
        0,
      ) ?? 0,
    [builtTemplate.formTemplate],
  );

  useEffect(() => {
    setPreviewValues(
      buildInitialFormValues(builtTemplate.formTemplate!, workspace),
    );
    setPreviewErrors({});
  }, [builtTemplate, workspace]);

  function handlePreviewValueChange(fieldId: string, value: FormValue) {
    const template = builtTemplate.formTemplate;
    if (!template) return;

    setPreviewValues((currentValues) =>
      normalizeFormValues(template, workspace, {
        ...currentValues,
        [fieldId]: value,
      }),
    );
    setPreviewErrors((currentErrors) => {
      if (!currentErrors[fieldId]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldId];
      return nextErrors;
    });
  }

  function handleAddField() {
    if (!fieldDraft.label.trim()) {
      setStatusMessage("Give the field a label before adding it.");
      return;
    }

    if (hasCustomSchemaFieldLabelConflict(extraFields, fieldDraft.label)) {
      setStatusMessage("A custom field with that label already exists.");
      return;
    }

    setExtraFields((currentFields) => [...currentFields, fieldDraft]);
    setFieldDraft({
      label: "",
      type: fieldDraft.type,
      description: "",
      placeholder: "",
      required: false,
      source: undefined,
    });
    setStatusMessage("Custom field added to the schema preview.");
  }

  function handleAddPresetField(field: CustomSchemaFieldDraft) {
    if (hasCustomSchemaFieldLabelConflict(extraFields, field.label)) {
      setStatusMessage("That preset is already part of the schema.");
      return;
    }

    setExtraFields((currentFields) => [...currentFields, field]);
    setStatusMessage(`Added the '${field.label}' preset field.`);
  }

  function handleSaveTemplate() {
    if (!name.trim()) {
      setStatusMessage("Name the schema before saving it.");
      return;
    }

    const result = saveCustomTemplate(builtTemplate);
    setStatusMessage(result.message);
    if (result.status === "saved" && result.templateId) {
      router.replace({
        pathname: "/logbook",
        params: { templateId: result.templateId },
      });
    }
  }

  return (
    <View style={[styles.screen, paletteStyles.screenBackground]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: "Schema builder" }} />

        <ScreenHero
          palette={palette}
          eyebrow="Schema builder"
          title="Build a local template with real form fields."
          subtitle="Base tracking fields come from the selected template family, and the extra fields below are saved into the form schema."
        />

        <SectionSurface
          palette={palette}
          label="Template setup"
          title="Choose the base schema family"
        >
          <TextInput
            mode="outlined"
            label="Template name"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            mode="outlined"
            label="Summary"
            value={summary}
            onChangeText={setSummary}
            multiline
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label="Category"
            value={category}
            onChangeText={setCategory}
            style={styles.input}
          />
          <SegmentedButtons
            value={quickActionKind}
            onValueChange={(value: string) =>
              setQuickActionKind(value as QuickActionKind)
            }
            style={styles.segmentedButtons}
            buttons={quickActionKinds.map((kind) => ({
              value: kind,
              label: customSchemaQuickActionLabels[kind],
            }))}
          />
          <Text style={[styles.helperCopy, paletteStyles.mutedText]}>
            Previewing {totalFieldCount} total form fields across{" "}
            {builtTemplate.formTemplate?.sections.length ?? 0} sections.
          </Text>
        </SectionSurface>

        <SectionSurface
          palette={palette}
          label="Custom fields"
          title="Add extra schema inputs"
        >
          <Text style={[styles.helperCopy, paletteStyles.mutedText]}>
            Start from a preset or define a field manually. Duplicate labels are
            blocked to keep saved schemas clean.
          </Text>
          <ChipRow style={styles.chipRow}>
            {customSchemaFieldPresets.map((preset) => (
              <Chip
                key={preset.id}
                onPress={() => handleAddPresetField(preset.draft)}
                style={styles.chip}
                textStyle={styles.chipLabel}
              >
                + {preset.label}
              </Chip>
            ))}
          </ChipRow>
          <TextInput
            mode="outlined"
            label="Field label"
            value={fieldDraft.label}
            onChangeText={(label) =>
              setFieldDraft((current) => ({ ...current, label }))
            }
          />
          <TextInput
            mode="outlined"
            label="Description"
            value={fieldDraft.description}
            onChangeText={(description) =>
              setFieldDraft((current) => ({ ...current, description }))
            }
            multiline
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label="Placeholder"
            value={fieldDraft.placeholder}
            onChangeText={(placeholder) =>
              setFieldDraft((current) => ({ ...current, placeholder }))
            }
            style={styles.input}
          />
          <ChipRow style={styles.chipRow}>
            {customSchemaFieldTypes.map((type) => {
              const isActive = fieldDraft.type === type;
              return (
                <Chip
                  key={type}
                  onPress={() =>
                    setFieldDraft((current) => ({
                      ...current,
                      type,
                      source: undefined,
                    }))
                  }
                  selected={isActive}
                  showSelectedCheck={false}
                  style={styles.chip}
                  textStyle={[
                    styles.chipLabel,
                    { color: isActive ? palette.tint : palette.text },
                  ]}
                >
                  {getBuilderFieldTypeLabel(type)}
                </Chip>
              );
            })}
          </ChipRow>
          {fieldDraft.type === "select" ||
          fieldDraft.type === "multi-select" ||
          fieldDraft.type === "checklist" ? (
            <ChipRow style={styles.chipRow}>
              {customSchemaSourceOptions.map((source) => {
                const isActive = fieldDraft.source === source;
                return (
                  <Chip
                    key={source}
                    onPress={() =>
                      setFieldDraft((current) => ({ ...current, source }))
                    }
                    selected={isActive}
                    showSelectedCheck={false}
                    style={styles.chip}
                    textStyle={[
                      styles.chipLabel,
                      { color: isActive ? palette.tint : palette.text },
                    ]}
                  >
                    Source: {source}
                  </Chip>
                );
              })}
            </ChipRow>
          ) : null}
          <View style={styles.switchRow}>
            <Text style={[styles.switchCopy, paletteStyles.mutedText]}>
              Required field
            </Text>
            <Switch
              value={Boolean(fieldDraft.required)}
              onValueChange={(required) =>
                setFieldDraft((current) => ({ ...current, required }))
              }
            />
          </View>
          <Button mode="contained" onPress={handleAddField}>
            Add field
          </Button>
          {extraFields.length > 0 ? (
            <View style={styles.fieldList}>
              {extraFields.map((field, index) => (
                <Surface
                  key={`${field.label}-${index}`}
                  style={[styles.fieldRow, paletteStyles.cardSurface]}
                  elevation={0}
                >
                  <View style={styles.fieldCopy}>
                    <Text style={styles.fieldTitle}>{field.label}</Text>
                    <Text style={[styles.fieldMeta, paletteStyles.mutedText]}>
                      {getBuilderFieldTypeLabel(field.type)}
                      {field.source ? ` • ${field.source}` : ""}
                    </Text>
                  </View>
                  <Button
                    mode="text"
                    onPress={() =>
                      setExtraFields((current) =>
                        current.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      )
                    }
                    compact
                    labelStyle={styles.removeLabel}
                  >
                    Remove
                  </Button>
                </Surface>
              ))}
            </View>
          ) : null}
        </SectionSurface>

        <SectionSurface
          palette={palette}
          label="Preview"
          title="Review the generated form"
        >
          <Text style={[styles.subtitle, paletteStyles.mutedText]}>
            This is the actual dynamic form that will be saved with the
            template.
          </Text>
          {builtTemplate.formTemplate ? (
            <DynamicFormRenderer
              template={builtTemplate.formTemplate}
              workspace={workspace}
              values={previewValues}
              errors={previewErrors}
              palette={palette}
              onChange={handlePreviewValueChange}
            />
          ) : null}
        </SectionSurface>

        {statusMessage ? (
          <SectionMessage
            palette={palette}
            label="Status"
            title="Template builder update"
            message={statusMessage}
            messageColor={palette.tint}
            messageStyle={styles.subtitle}
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
            onPress={handleSaveTemplate}
            style={styles.footerButton}
            contentStyle={styles.footerButtonContent}
          >
            Save template
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
  subtitle: { ...uiTypography.body, marginTop: uiSpace.sm },
  helperCopy: { ...uiTypography.bodySmall, marginTop: uiSpace.md },
  input: { marginTop: uiSpace.lg },
  segmentedButtons: { marginTop: uiSpace.lg },
  chipRow: { marginTop: uiSpace.lg },
  chip: {
    borderRadius: uiRadius.pill,
  },
  chipLabel: uiTypography.chip,
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: uiSpace.xl,
  },
  switchCopy: uiTypography.body,
  fieldList: { marginTop: uiSpace.xxl, gap: uiSpace.md },
  fieldRow: {
    borderWidth: uiBorder.standard,
    borderRadius: uiRadius.sm,
    padding: uiSpace.lg,
    flexDirection: "row",
    gap: uiSpace.lg,
    alignItems: "center",
  },
  fieldCopy: { flex: 1 },
  fieldTitle: { ...uiTypography.bodyStrong, marginBottom: 3 },
  fieldMeta: uiTypography.support,
  removeLabel: { fontSize: 13, fontWeight: "700" },
  footer: {
    borderTopWidth: uiBorder.standard,
    paddingHorizontal: uiSpace.screen,
    paddingTop: uiSpace.lg,
  },
  footerActions: {
    flexDirection: "row",
    gap: uiSpace.md,
  },
  footerButton: { flex: 1 },
  footerButtonContent: { minHeight: 40 },
});
