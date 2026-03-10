import {
    fieldTypeLabels,
    getQuickActionFormTemplate,
} from "../../constants/TrackItUpFormTemplates.ts";
import type {
    FormFieldDefinition,
    FormFieldSource,
    FormFieldType,
    FormTemplate,
    QuickActionKind,
    TemplateCatalogItem,
} from "../../types/trackitup.ts";

export type CustomSchemaFieldDraft = {
  label: string;
  type: FormFieldType;
  description?: string;
  placeholder?: string;
  required?: boolean;
  source?: FormFieldSource;
};

export type CustomSchemaTemplateDraft = {
  name: string;
  summary: string;
  category: string;
  quickActionKind: QuickActionKind;
  extraFields: CustomSchemaFieldDraft[];
};

export const customSchemaQuickActionLabels: Record<QuickActionKind, string> = {
  "quick-log": "General log",
  "metric-entry": "Metric schema",
  "routine-run": "Routine macro",
};

export const customSchemaFieldTypes: FormFieldType[] = [
  "text",
  "rich-text",
  "textarea",
  "number",
  "unit",
  "select",
  "multi-select",
  "date-time",
  "checkbox",
  "checklist",
  "slider",
  "tags",
  "media",
  "location",
];

export const customSchemaSourceOptions: FormFieldSource[] = [
  "spaces",
  "assets",
  "metrics",
  "routines",
  "reminders",
  "logs",
];

export const customSchemaFieldPresets: {
  id: string;
  label: string;
  draft: CustomSchemaFieldDraft;
}[] = [
  {
    id: "preset-observation",
    label: "Observation note",
    draft: {
      label: "Observation note",
      type: "rich-text",
      description: "Capture the main observation for this log.",
      placeholder: "What changed?",
    },
  },
  {
    id: "preset-cost",
    label: "Extra cost",
    draft: {
      label: "Extra cost",
      type: "number",
      description: "Track a numeric cost or dosage amount.",
      placeholder: "0",
    },
  },
  {
    id: "preset-checklist",
    label: "Inspection checklist",
    draft: {
      label: "Inspection checklist",
      type: "checklist",
      description: "Choose from existing workspace records.",
      source: "assets",
    },
  },
  {
    id: "preset-location",
    label: "Field location",
    draft: {
      label: "Field location",
      type: "location",
      description: "Attach a GPS location to the entry.",
    },
  },
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function cloneTemplate(template: FormTemplate): FormTemplate {
  return {
    ...template,
    sections: template.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => ({ ...field })),
    })),
  };
}

function buildCustomField(draft: CustomSchemaFieldDraft, index: number) {
  const slug = slugify(draft.label) || `field-${index + 1}`;
  const field: FormFieldDefinition = {
    id: `custom-${slug}`,
    label: draft.label.trim() || `Custom field ${index + 1}`,
    type: draft.type,
    description: draft.description?.trim() || undefined,
    placeholder: draft.placeholder?.trim() || undefined,
    required: draft.required,
  };

  if (
    draft.source &&
    (draft.type === "select" ||
      draft.type === "multi-select" ||
      draft.type === "checklist")
  ) {
    field.source = draft.source;
  }

  return field;
}

function getSupportedFieldTypes(template: FormTemplate) {
  return Array.from(
    new Set(
      template.sections.flatMap((section) =>
        section.fields.map((field) => field.type),
      ),
    ),
  );
}

export function hasCustomSchemaFieldLabelConflict(
  extraFields: CustomSchemaFieldDraft[],
  label: string,
) {
  const normalizedLabel = label.trim().toLowerCase();
  if (!normalizedLabel) return false;

  return extraFields.some(
    (field) => field.label.trim().toLowerCase() === normalizedLabel,
  );
}

export function buildCustomSchemaTemplate(
  draft: CustomSchemaTemplateDraft,
): TemplateCatalogItem {
  const now = new Date().toISOString();
  const slug = slugify(draft.name) || "custom-schema";
  const baseTemplate = cloneTemplate(
    getQuickActionFormTemplate(draft.quickActionKind),
  );
  const extraFields = draft.extraFields.map(buildCustomField);

  const formTemplate: FormTemplate = {
    ...baseTemplate,
    id: `template-${slug}`,
    title: draft.name.trim() || "Custom schema",
    description:
      draft.summary.trim() ||
      `${customSchemaQuickActionLabels[draft.quickActionKind]} captured with a local schema builder.`,
    sections:
      extraFields.length > 0
        ? [
            ...baseTemplate.sections,
            {
              id: `custom-section-${slug}`,
              title: "Custom capture fields",
              description:
                "These extra fields were added from the in-app schema builder.",
              fields: extraFields,
            },
          ]
        : baseTemplate.sections,
  };

  return {
    id: `template-${slug}-${Date.now()}`,
    name: formTemplate.title,
    summary: draft.summary.trim() || formTemplate.description,
    category: draft.category.trim() || "Custom",
    origin: "community",
    importMethods: ["local"],
    supportedFieldTypes: getSupportedFieldTypes(formTemplate),
    createdAt: now,
    formTemplate,
  };
}

export function getBuilderFieldTypeLabel(type: FormFieldType) {
  return fieldTypeLabels[type] ?? type;
}
