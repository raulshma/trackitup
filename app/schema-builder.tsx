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
import { AiDraftReviewCard } from "@/components/ui/AiDraftReviewCard";
import { AiPromptComposerCard } from "@/components/ui/AiPromptComposerCard";
import { ChipRow } from "@/components/ui/ChipRow";
import { PageQuickActions } from "@/components/ui/PageQuickActions";
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
import { generateOpenRouterText } from "@/services/ai/aiClient";
import { aiSchemaBuilderCopy } from "@/services/ai/aiConsentCopy";
import { buildSchemaBuilderPrompt } from "@/services/ai/aiPromptBuilders";
import {
    buildAiSchemaDraftReviewItems,
    buildAiSchemaGenerationPrompt,
    parseAiSchemaTemplateDraft,
} from "@/services/ai/aiSchemaDraft";
import { recordAiTelemetryEvent } from "@/services/ai/aiTelemetry";
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
    type CustomSchemaTemplateDraft,
} from "@/services/templates/customSchema";
import type { QuickActionKind } from "@/types/trackitup";

const quickActionKinds = Object.keys(
  customSchemaQuickActionLabels,
) as QuickActionKind[];

type GeneratedAiSchemaDraft = {
  request: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  draft: CustomSchemaTemplateDraft;
};

export default function SchemaBuilderScreen() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const paletteStyles = useMemo(
    () => createCommonPaletteStyles(palette),
    [palette],
  );
  const router = useRouter();
  const { createRestorePoint, saveCustomTemplate, workspace } = useWorkspace();
  const [name, setName] = useState("Custom hobby schema");
  const [summary, setSummary] = useState(
    "A local template built from the TrackItUp schema builder.",
  );
  const [category, setCategory] = useState("Custom");
  const [quickActionKind, setQuickActionKind] =
    useState<QuickActionKind>("quick-log");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [aiGoal, setAiGoal] = useState("");
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [generatedAiDraft, setGeneratedAiDraft] =
    useState<GeneratedAiSchemaDraft | null>(null);
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

  async function handleSaveTemplate() {
    if (!name.trim()) {
      setStatusMessage("Name the schema before saving it.");
      return;
    }

    const restorePointResult = await createRestorePoint({
      reason: "before-template-save",
      label: "Before saving custom template",
    });
    const result = saveCustomTemplate(builtTemplate);
    setStatusMessage(
      restorePointResult.status === "created" ||
        restorePointResult.status === "unavailable"
        ? `${restorePointResult.message} ${result.message}`
        : result.message,
    );
    if (result.status === "saved" && result.templateId) {
      router.replace({
        pathname: "/logbook",
        params: { templateId: result.templateId },
      });
    }
  }

  async function handleGenerateAiDraft() {
    const trimmedGoal = aiGoal.trim();
    if (!trimmedGoal) {
      setStatusMessage(
        "Describe the schema you want before generating a draft.",
      );
      return;
    }

    setIsGeneratingAiDraft(true);
    const schemaPrompt = buildSchemaBuilderPrompt({
      workspace,
      userGoal: trimmedGoal,
      quickActionKind,
    });
    void recordAiTelemetryEvent({
      surface: "schema-builder",
      action: "generate-requested",
    });
    const result = await generateOpenRouterText({
      system: schemaPrompt.system,
      prompt: buildAiSchemaGenerationPrompt(schemaPrompt.prompt),
      temperature: 0.3,
      maxOutputTokens: 1_100,
    });
    setIsGeneratingAiDraft(false);

    if (result.status !== "success") {
      setGeneratedAiDraft(null);
      setStatusMessage(result.message);
      void recordAiTelemetryEvent({
        surface: "schema-builder",
        action: "generate-failed",
      });
      return;
    }

    const parsedDraft = parseAiSchemaTemplateDraft(
      result.text,
      quickActionKind,
    );
    if (!parsedDraft) {
      setGeneratedAiDraft(null);
      setStatusMessage(
        "TrackItUp received an AI response but could not turn it into a schema draft. Try asking for a smaller, more specific template.",
      );
      void recordAiTelemetryEvent({
        surface: "schema-builder",
        action: "generate-failed",
      });
      return;
    }

    setGeneratedAiDraft({
      request: trimmedGoal,
      consentLabel: schemaPrompt.consentLabel,
      modelId: result.modelId,
      usage: result.usage,
      draft: parsedDraft,
    });
    setStatusMessage(
      "Generated an AI schema draft. Review it carefully before applying it to the builder.",
    );
    void recordAiTelemetryEvent({
      surface: "schema-builder",
      action: "generate-succeeded",
    });
  }

  function handleApplyAiDraft() {
    if (!generatedAiDraft) return;

    setName(generatedAiDraft.draft.name);
    setSummary(generatedAiDraft.draft.summary);
    setCategory(generatedAiDraft.draft.category);
    setQuickActionKind(generatedAiDraft.draft.quickActionKind);
    setExtraFields(
      generatedAiDraft.draft.extraFields.map((field) => ({ ...field })),
    );
    setGeneratedAiDraft(null);
    setStatusMessage(
      "Applied the AI schema draft to the builder. Review the fields below, then save when you're ready.",
    );
    void recordAiTelemetryEvent({
      surface: "schema-builder",
      action: "draft-applied",
    });
  }

  function handleDismissAiDraft() {
    setGeneratedAiDraft(null);
    setStatusMessage(
      "Dismissed the AI schema draft. Your current manual builder inputs are unchanged.",
    );
  }

  const pageQuickActions = [
    {
      id: "schema-builder-save",
      label: "Save template",
      hint: `${totalFieldCount} field${totalFieldCount === 1 ? "" : "s"} are currently mapped into this template preview.`,
      onPress: handleSaveTemplate,
      accentColor: palette.tint,
    },
    {
      id: "schema-builder-logbook",
      label: "Open logbook",
      hint: `${workspace.templates.length} template${workspace.templates.length === 1 ? "" : "s"} already live in the local catalog.`,
      onPress: () => router.push("/logbook" as never),
      accentColor: palette.secondary,
    },
    {
      id: "schema-builder-tools",
      label: "Open workspace tools",
      hint: "Jump to import, export, scanner, and capability checks while building your schema.",
      onPress: () => router.push("/workspace-tools" as never),
    },
  ];

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

        <PageQuickActions
          palette={palette}
          title="Keep schema building moving"
          description="Save the current template, jump into the live logbook, or open supporting tools without losing the builder context."
          actions={pageQuickActions}
        />

        <AiPromptComposerCard
          palette={palette}
          label="AI schema builder"
          title="Generate a template from a plain-language goal"
          value={aiGoal}
          onChangeText={setAiGoal}
          onSubmit={() => void handleGenerateAiDraft()}
          isBusy={isGeneratingAiDraft}
          contextChips={[
            customSchemaQuickActionLabels[quickActionKind],
            `${totalFieldCount} field${totalFieldCount === 1 ? "" : "s"} in preview`,
          ]}
          helperText={aiSchemaBuilderCopy.getHelperText(
            customSchemaQuickActionLabels[quickActionKind],
          )}
          consentLabel={aiSchemaBuilderCopy.consentLabel}
          footerNote={aiSchemaBuilderCopy.promptFooterNote}
          submitLabel="Generate template"
        />

        {generatedAiDraft ? (
          <AiDraftReviewCard
            palette={palette}
            title="Review the AI schema draft"
            draftKindLabel={
              customSchemaQuickActionLabels[
                generatedAiDraft.draft.quickActionKind
              ]
            }
            summary={`Prompt: ${generatedAiDraft.request}`}
            consentLabel={generatedAiDraft.consentLabel}
            footerNote={aiSchemaBuilderCopy.reviewFooterNote}
            statusLabel="Draft ready"
            modelLabel={generatedAiDraft.modelId}
            usage={generatedAiDraft.usage}
            contextChips={[
              `${generatedAiDraft.draft.extraFields.length} custom field${generatedAiDraft.draft.extraFields.length === 1 ? "" : "s"}`,
            ]}
            items={buildAiSchemaDraftReviewItems(generatedAiDraft.draft)}
            acceptLabel="Apply to builder"
            editLabel="Dismiss draft"
            regenerateLabel="Generate again"
            onAccept={handleApplyAiDraft}
            onEdit={handleDismissAiDraft}
            onRegenerate={() => void handleGenerateAiDraft()}
            isBusy={isGeneratingAiDraft}
          />
        ) : null}

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
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: uiSpace.md,
  },
  footerButton: { alignSelf: "flex-start" },
  footerButtonContent: { minHeight: 40 },
});
