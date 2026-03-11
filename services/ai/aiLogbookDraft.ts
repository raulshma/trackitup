import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";

const MAX_LOGBOOK_TITLE_LENGTH = 100;
const MAX_LOGBOOK_NOTE_LENGTH = 700;
const MAX_LOGBOOK_TAG_LENGTH = 24;
const MAX_LOGBOOK_TAG_COUNT = 6;

export type AiLogbookDraft = {
  title?: string;
  note?: string;
  tags?: string[];
};

function compactText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

export function buildAiLogbookGenerationPrompt(
  prompt: string,
  options: { allowTitle: boolean; allowTags: boolean },
) {
  const allowedFields = [
    options.allowTitle ? '"title": "string"' : null,
    '"note": "string"',
    options.allowTags ? '"tags": ["short-tag"]' : null,
  ].filter((value): value is string => Boolean(value));

  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  ${allowedFields.join(",\n  ")}\n}\nRules:\n- Only include keys shown above.\n- Keep the note grounded in the provided draft and context.\n- Keep tags short, lowercase-friendly, and useful for later filtering.\n- Do not invent photos, measurements, locations, reminders, or asset changes that were not supplied.`;
}

export function parseAiLogbookDraft(
  value: string,
  options: { allowTitle: boolean; allowTags: boolean },
): AiLogbookDraft | null {
  const jsonCandidate = extractJsonCandidate(value);
  if (!jsonCandidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;

  const title = options.allowTitle
    ? compactText(parsed.title, MAX_LOGBOOK_TITLE_LENGTH) || undefined
    : undefined;
  const note = compactText(parsed.note, MAX_LOGBOOK_NOTE_LENGTH) || undefined;
  const tags = options.allowTags
    ? (Array.isArray(parsed.tags) ? parsed.tags : [])
        .map((tag) => compactText(tag, MAX_LOGBOOK_TAG_LENGTH).replace(/^#+/, ""))
        .map((tag) => tag.toLowerCase())
        .filter((tag): tag is string => tag.length > 0)
        .filter((tag, index, list) => list.indexOf(tag) === index)
        .slice(0, MAX_LOGBOOK_TAG_COUNT)
    : undefined;

  if (!title && !note && (!tags || tags.length === 0)) {
    return null;
  }

  return {
    ...(title ? { title } : {}),
    ...(note ? { note } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
  };
}

export function buildAiLogbookDraftReviewItems(
  draft: AiLogbookDraft,
): AiDraftReviewItemInput[] {
  return [
    { key: "title", label: "Title", value: draft.title },
    { key: "note", label: "Notes", value: draft.note, maxTextLength: 420 },
    {
      key: "tags",
      label: "Suggested tags",
      value: draft.tags,
      maxLines: 6,
    },
  ].filter((item) => {
    if (Array.isArray(item.value)) {
      return item.value.length > 0;
    }

    return typeof item.value === "string" && item.value.trim().length > 0;
  });
}