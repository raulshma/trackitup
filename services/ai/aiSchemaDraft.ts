import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";
import {
  customSchemaFieldTypes,
  customSchemaQuickActionLabels,
  customSchemaSourceOptions,
  type CustomSchemaFieldDraft,
  type CustomSchemaTemplateDraft,
} from "../templates/customSchema.ts";
import type { FormFieldSource, FormFieldType, QuickActionKind } from "../../types/trackitup.ts";

const MAX_SCHEMA_NAME_LENGTH = 80;
const MAX_SCHEMA_SUMMARY_LENGTH = 180;
const MAX_SCHEMA_CATEGORY_LENGTH = 40;
const MAX_SCHEMA_FIELD_LABEL_LENGTH = 60;
const MAX_SCHEMA_FIELD_TEXT_LENGTH = 140;
const MAX_SCHEMA_EXTRA_FIELDS = 8;

const quickActionKinds = Object.keys(
  customSchemaQuickActionLabels,
) as QuickActionKind[];

function compactText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isQuickActionKind(value: unknown): value is QuickActionKind {
  return typeof value === "string" && quickActionKinds.includes(value as QuickActionKind);
}

function isSupportedFieldType(value: unknown): value is FormFieldType {
  return typeof value === "string" && customSchemaFieldTypes.includes(value as FormFieldType);
}

function isSupportedFieldSource(value: unknown): value is FormFieldSource {
  return (
    typeof value === "string" &&
    customSchemaSourceOptions.includes(value as FormFieldSource)
  );
}

function extractJsonCandidate(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fencedMatch?.[1] ?? text;
  const startIndex = source.indexOf("{");
  if (startIndex < 0) return null;

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === "\\") {
        isEscaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function normalizeAiSchemaFieldDraft(value: unknown): CustomSchemaFieldDraft | null {
  if (!isRecord(value)) return null;

  const label = compactText(value.label, MAX_SCHEMA_FIELD_LABEL_LENGTH);
  if (!label) return null;

  const type = isSupportedFieldType(value.type) ? value.type : "text";
  const nextField: CustomSchemaFieldDraft = {
    label,
    type,
    description:
      compactText(value.description, MAX_SCHEMA_FIELD_TEXT_LENGTH) || undefined,
    placeholder:
      compactText(value.placeholder, MAX_SCHEMA_FIELD_TEXT_LENGTH) || undefined,
    required: value.required === true,
  };

  const canUseSource =
    type === "select" || type === "multi-select" || type === "checklist";
  if (canUseSource && isSupportedFieldSource(value.source)) {
    nextField.source = value.source;
  }

  return nextField;
}

export function buildAiSchemaGenerationPrompt(prompt: string) {
  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  "name": "string",\n  "summary": "string",\n  "category": "string",\n  "quickActionKind": "quick-log | metric-entry | routine-run",\n  "extraFields": [\n    {\n      "label": "string",\n      "type": "text | rich-text | textarea | number | unit | select | multi-select | date-time | checkbox | checklist | slider | tags | media | location",\n      "description": "string",\n      "placeholder": "string",\n      "required": true,\n      "source": "spaces | assets | metrics | routines | reminders | logs"\n    }\n  ]\n}\nUse source only for select, multi-select, or checklist fields. Keep the field list concise and review-friendly.`;
}

export function parseAiSchemaTemplateDraft(
  value: string,
  fallbackQuickActionKind: QuickActionKind,
): CustomSchemaTemplateDraft | null {
  const jsonCandidate = extractJsonCandidate(value);
  if (!jsonCandidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;

  const nextQuickActionKind = isQuickActionKind(parsed.quickActionKind)
    ? parsed.quickActionKind
    : fallbackQuickActionKind;
  const nextExtraFields = (
    Array.isArray(parsed.extraFields) ? parsed.extraFields : []
  )
    .map(normalizeAiSchemaFieldDraft)
    .filter((field): field is CustomSchemaFieldDraft => Boolean(field))
    .filter((field, index, fields) => {
      const normalizedLabel = field.label.trim().toLowerCase();
      return (
        fields.findIndex(
          (candidate) => candidate.label.trim().toLowerCase() === normalizedLabel,
        ) === index
      );
    })
    .slice(0, MAX_SCHEMA_EXTRA_FIELDS);

  return {
    name:
      compactText(parsed.name, MAX_SCHEMA_NAME_LENGTH) ||
      `AI ${customSchemaQuickActionLabels[nextQuickActionKind]} schema`,
    summary:
      compactText(parsed.summary, MAX_SCHEMA_SUMMARY_LENGTH) ||
      "AI-assisted schema draft for review in TrackItUp.",
    category:
      compactText(parsed.category, MAX_SCHEMA_CATEGORY_LENGTH) || "Custom",
    quickActionKind: nextQuickActionKind,
    extraFields: nextExtraFields,
  };
}

export function buildAiSchemaDraftReviewItems(
  draft: CustomSchemaTemplateDraft,
): AiDraftReviewItemInput[] {
  return [
    { key: "name", label: "Template name", value: draft.name },
    { key: "summary", label: "Summary", value: draft.summary },
    { key: "category", label: "Category", value: draft.category },
    {
      key: "family",
      label: "Schema family",
      value: customSchemaQuickActionLabels[draft.quickActionKind],
    },
    {
      key: "fields",
      label: "Suggested fields",
      value: draft.extraFields.map((field) =>
        `${field.label} — ${field.type}${field.source ? ` • ${field.source}` : ""}`,
      ),
      maxLines: 6,
    },
  ];
}