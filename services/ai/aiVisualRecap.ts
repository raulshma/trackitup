import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";

const MAX_HEADLINE_LENGTH = 90;
const MAX_SUMMARY_LENGTH = 560;
const MAX_HIGHLIGHT_LENGTH = 140;
const MAX_HIGHLIGHT_COUNT = 5;
const MAX_NEXT_FOCUS_LENGTH = 140;

export type AiVisualRecapDraft = {
  headline: string;
  summary?: string;
  highlights: string[];
  nextFocus?: string;
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

export function buildAiVisualRecapGenerationPrompt(prompt: string) {
  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  "headline": "string",\n  "summary": "string",\n  "highlights": ["string"],\n  "nextFocus": "string"\n}\nRules:\n- Keep every claim grounded in the provided recap metadata and log text.\n- Do not imply direct visual inspection of the underlying photos.\n- Keep highlights concise and specific.\n- Use nextFocus for one practical follow-up suggestion only.`;
}

export function parseAiVisualRecapDraft(value: string): AiVisualRecapDraft | null {
  const jsonCandidate = extractJsonCandidate(value);
  if (!jsonCandidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;

  const summary = compactText(parsed.summary, MAX_SUMMARY_LENGTH) || undefined;
  const highlights = (Array.isArray(parsed.highlights) ? parsed.highlights : [])
    .map((item) => compactText(item, MAX_HIGHLIGHT_LENGTH))
    .filter((item): item is string => item.length > 0)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, MAX_HIGHLIGHT_COUNT);

  if (!summary && highlights.length === 0) {
    return null;
  }

  return {
    headline:
      compactText(parsed.headline, MAX_HEADLINE_LENGTH) || "TrackItUp visual recap",
    summary,
    highlights,
    nextFocus: compactText(parsed.nextFocus, MAX_NEXT_FOCUS_LENGTH) || undefined,
  };
}

export function buildAiVisualRecapReviewItems(
  draft: AiVisualRecapDraft,
): AiDraftReviewItemInput[] {
  return [
    { key: "headline", label: "Headline", value: draft.headline },
    { key: "summary", label: "Summary", value: draft.summary, maxTextLength: 420 },
    {
      key: "highlights",
      label: "Highlights",
      value: draft.highlights,
      maxLines: 6,
    },
    { key: "nextFocus", label: "Next focus", value: draft.nextFocus },
  ].filter((item) => {
    if (Array.isArray(item.value)) {
      return item.value.length > 0;
    }

    return typeof item.value === "string" && item.value.trim().length > 0;
  });
}