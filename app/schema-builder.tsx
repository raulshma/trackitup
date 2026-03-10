import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";

import { DynamicFormRenderer } from "@/components/DynamicFormRenderer";
import { Text, View } from "@/components/Themed";
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

      <View style={styles.hero}>
        <Text style={[styles.eyebrow, { color: palette.tint }]}>
          Schema builder
        </Text>
        <Text style={styles.title}>
          Build a local template with real form fields.
        </Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          Base tracking fields come from the selected template family, and the
          extra fields below are saved into the form schema.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>Template setup</Text>
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
        <View style={styles.chipRow}>
          {quickActionKinds.map((kind) => {
            const isActive = quickActionKind === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => setQuickActionKind(kind)}
                style={[
                  styles.chip,
                  {
                    borderColor: isActive ? palette.tint : palette.border,
                    backgroundColor: isActive
                      ? `${palette.tint}22`
                      : palette.card,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: isActive ? palette.tint : palette.text },
                  ]}
                >
                  {customSchemaQuickActionLabels[kind]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.helperCopy, { color: palette.muted }]}>
          Previewing {totalFieldCount} total form fields across{" "}
          {builtTemplate.formTemplate?.sections.length ?? 0} sections.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>Add custom fields</Text>
        <Text style={[styles.helperCopy, { color: palette.muted }]}>
          Start from a preset or define a field manually. Duplicate labels are
          blocked to keep saved schemas clean.
        </Text>
        <View style={styles.chipRow}>
          {customSchemaFieldPresets.map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() => handleAddPresetField(preset.draft)}
              style={[styles.chip, { borderColor: palette.border }]}
            >
              <Text style={styles.chipLabel}>+ {preset.label}</Text>
            </Pressable>
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
              <Pressable
                key={type}
                onPress={() =>
                  setFieldDraft((current) => ({
                    ...current,
                    type,
                    source: undefined,
                  }))
                }
                style={[
                  styles.chip,
                  {
                    borderColor: isActive ? palette.tint : palette.border,
                    backgroundColor: isActive
                      ? `${palette.tint}22`
                      : palette.card,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: isActive ? palette.tint : palette.text },
                  ]}
                >
                  {getBuilderFieldTypeLabel(type)}
                </Text>
              </Pressable>
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
                <Pressable
                  key={source}
                  onPress={() =>
                    setFieldDraft((current) => ({ ...current, source }))
                  }
                  style={[
                    styles.chip,
                    {
                      borderColor: isActive ? palette.tint : palette.border,
                      backgroundColor: isActive
                        ? `${palette.tint}22`
                        : palette.card,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: isActive ? palette.tint : palette.text },
                    ]}
                  >
                    Source: {source}
                  </Text>
                </Pressable>
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
              <View
                key={`${field.label}-${index}`}
                style={[styles.fieldRow, { borderColor: palette.border }]}
              >
                <View style={styles.fieldCopy}>
                  <Text style={styles.fieldTitle}>{field.label}</Text>
                  <Text style={[styles.fieldMeta, { color: palette.muted }]}>
                    {getBuilderFieldTypeLabel(field.type)}
                    {field.source ? ` • ${field.source}` : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    setExtraFields((current) =>
                      current.filter(
                        (_, currentIndex) => currentIndex !== index,
                      ),
                    )
                  }
                >
                  <Text style={[styles.removeLabel, { color: palette.tint }]}>
                    Remove
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Text style={styles.sectionTitle}>Preview</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>
          This is the actual dynamic form that will be saved with the template.
        </Text>
        {builtTemplate.formTemplate ? (
          <DynamicFormRenderer
            template={builtTemplate.formTemplate}
            workspace={workspace}
            values={previewValues}
            errors={previewErrors}
            onValueChange={handlePreviewValueChange}
          />
        ) : null}
      </View>

      {statusMessage ? (
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.subtitle, { color: palette.tint }]}>
            {statusMessage}
          </Text>
        </View>
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
  hero: { marginBottom: 18 },
  eyebrow: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  title: { fontSize: 30, fontWeight: "bold", lineHeight: 38 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  helperCopy: { fontSize: 13, lineHeight: 18, marginTop: 10 },
  input: { marginTop: 12 },
  chipRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 12 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
