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

import { DynamicFormRenderer } from "@/components/DynamicFormRenderer";
import { Text } from "@/components/Themed";
import { ScreenHero } from "@/components/ui/ScreenHero";
import { SectionSurface } from "@/components/ui/SectionSurface";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
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
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
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
        <Text style={[styles.helperCopy, { color: palette.muted }]}>
          Previewing {totalFieldCount} total form fields across{" "}
          {builtTemplate.formTemplate?.sections.length ?? 0} sections.
        </Text>
      </SectionSurface>

      <SectionSurface
        palette={palette}
        label="Custom fields"
        title="Add extra schema inputs"
      >
        <Text style={[styles.helperCopy, { color: palette.muted }]}>
          Start from a preset or define a field manually. Duplicate labels are
          blocked to keep saved schemas clean.
        </Text>
        <View style={styles.chipRow}>
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
        </View>
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
        <View style={styles.chipRow}>
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
        </View>
        {fieldDraft.type === "select" ||
        fieldDraft.type === "multi-select" ||
        fieldDraft.type === "checklist" ? (
          <View style={styles.chipRow}>
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
          </View>
        ) : null}
        <View style={styles.switchRow}>
          <Text style={[styles.switchCopy, { color: palette.muted }]}>
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
                style={[styles.fieldRow, { borderColor: palette.border }]}
                elevation={0}
              >
                <View style={styles.fieldCopy}>
                  <Text style={styles.fieldTitle}>{field.label}</Text>
                  <Text style={[styles.fieldMeta, { color: palette.muted }]}>
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
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          This is the actual dynamic form that will be saved with the template.
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
        <SectionSurface
          palette={palette}
          label="Status"
          title="Template builder update"
        >
          <Text style={[styles.subtitle, { color: palette.tint }]}>
            {statusMessage}
          </Text>
        </SectionSurface>
      ) : null}

      <View style={styles.buttonRow}>
        <Button
          mode="contained"
          onPress={handleSaveTemplate}
          style={styles.button}
        >
          Save template
        </Button>
        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.button}
        >
          Cancel
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  helperCopy: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  input: { marginTop: 12 },
  segmentedButtons: { marginTop: 12 },
  chipRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 12 },
  chip: {
    borderRadius: 999,
  },
  chipLabel: { fontSize: 12, fontWeight: "700" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 14,
  },
  switchCopy: { fontSize: 14 },
  fieldList: { marginTop: 16, gap: 10 },
  fieldRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  fieldCopy: { flex: 1 },
  fieldTitle: { fontSize: 14, fontWeight: "700", marginBottom: 3 },
  fieldMeta: { fontSize: 12, lineHeight: 18 },
  removeLabel: { fontSize: 13, fontWeight: "700" },
  buttonRow: { flexDirection: "row", gap: 12 },
  button: { flex: 1 },
});
