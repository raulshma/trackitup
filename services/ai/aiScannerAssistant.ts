import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";

export type AiScannerAssistantDestination =
  | "inventory"
  | "logbook"
  | "template-import"
  | "workspace-tools";

export type AiScannerAssistantDraft = {
  headline: string;
  summary?: string;
  reasons: string[];
  suggestedDestination: AiScannerAssistantDestination;
  suggestedEntry?: { title?: string; note?: string; tags?: string[] };
  caution?: string;
};

const MAX_HEADLINE_LENGTH = 90;
const MAX_SUMMARY_LENGTH = 420;
const MAX_REASON_LENGTH = 120;

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
      if (character === '"') inString = false;
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
      if (depth === 0) return source.slice(startIndex, index + 1);
    }
  }

  return null;
}

function isDestination(value: unknown): value is AiScannerAssistantDestination {
  return (
    value === "inventory" ||
    value === "logbook" ||
    value === "template-import" ||
    value === "workspace-tools"
  );
}

export function formatAiScannerAssistantDestinationLabel(
  value: AiScannerAssistantDestination,
) {
  if (value === "inventory") return "Open inventory";
  if (value === "logbook") return "Start quick log";
  if (value === "template-import") return "Review template import";
  return "Open workspace tools";
}

export function buildAiScannerAssistantGenerationPrompt(prompt: string) {
  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  "headline": "string",\n  "summary": "string",\n  "reasons": ["string"],\n  "suggestedDestination": "inventory | logbook | template-import | workspace-tools",\n  "suggestedEntry": {\n    "title": "string",\n    "note": "string",\n    "tags": ["string"]\n  },\n  "caution": "string"\n}\nRules:\n- Keep every recommendation grounded in the scanned code and compact TrackItUp context only.\n- Prefer template-import when the scan is a valid TrackItUp template payload.\n- Prefer inventory when the scan matches an existing asset.\n- Use logbook only for a review-only entry outline; do not invent maintenance facts from a bare barcode.\n- Use workspace-tools when the scan is ambiguous and needs manual follow-up.`;
}

export function parseAiScannerAssistantDraft(
  value: string,
): AiScannerAssistantDraft | null {
  const jsonCandidate = extractJsonCandidate(value);
  if (!jsonCandidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !isDestination(parsed.suggestedDestination)) {
    return null;
  }

  const reasons = (Array.isArray(parsed.reasons) ? parsed.reasons : [])
    .map((item) => compactText(item, MAX_REASON_LENGTH))
    .filter((item): item is string => item.length > 0)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 5);
  const suggestedEntrySource = isRecord(parsed.suggestedEntry)
    ? parsed.suggestedEntry
    : null;
  const suggestedEntry = suggestedEntrySource
    ? {
        title: compactText(suggestedEntrySource.title, 120) || undefined,
        note: compactText(suggestedEntrySource.note, 260) || undefined,
        tags: (Array.isArray(suggestedEntrySource.tags)
          ? suggestedEntrySource.tags
          : []
        )
          .map((item) => compactText(item, 24))
          .filter((item): item is string => item.length > 0)
          .filter((item, index, list) => list.indexOf(item) === index)
          .slice(0, 5),
      }
    : undefined;
  const hasSuggestedEntry = Boolean(
    suggestedEntry?.title ||
      suggestedEntry?.note ||
      (suggestedEntry?.tags?.length ?? 0) > 0,
  );
  const summary = compactText(parsed.summary, MAX_SUMMARY_LENGTH) || undefined;

  if (!summary && reasons.length === 0 && !hasSuggestedEntry) {
    return null;
  }

  return {
    headline:
      compactText(parsed.headline, MAX_HEADLINE_LENGTH) ||
      "TrackItUp scanner assistant",
    summary,
    reasons,
    suggestedDestination: parsed.suggestedDestination,
    suggestedEntry: hasSuggestedEntry ? suggestedEntry : undefined,
    caution: compactText(parsed.caution, 120) || undefined,
  };
}

export function buildAiScannerAssistantReviewItems(
  draft: AiScannerAssistantDraft,
): AiDraftReviewItemInput[] {
  return [
    { key: "headline", label: "Headline", value: draft.headline },
    {
      key: "summary",
      label: "Summary",
      value: draft.summary,
      maxTextLength: 360,
    },
    {
      key: "destination",
      label: "Suggested destination",
      value: formatAiScannerAssistantDestinationLabel(draft.suggestedDestination),
    },
    { key: "reasons", label: "Why this next", value: draft.reasons, maxLines: 5 },
    {
      key: "draftTitle",
      label: "Draft log title",
      value: draft.suggestedEntry?.title,
    },
    {
      key: "draftNote",
      label: "Draft log note",
      value: draft.suggestedEntry?.note,
      maxTextLength: 280,
    },
    { key: "draftTags", label: "Draft tags", value: draft.suggestedEntry?.tags },
    { key: "caution", label: "Caution", value: draft.caution },
  ].filter((item) => {
    if (Array.isArray(item.value)) return item.value.length > 0;
    return typeof item.value === "string" && item.value.trim().length > 0;
  });
}