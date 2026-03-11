import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";

export type AiTrackingQualityDestination =
  | "action-center"
  | "planner"
  | "logbook"
  | "workspace-tools";

export type AiTrackingQualitySource = {
  id: string;
  title: string;
  kind: "reminder-gap" | "metric-gap" | "space-gap" | "log-gap";
  snippet: string;
  route: AiTrackingQualityDestination;
  spaceId?: string;
  reminderId?: string;
  actionId?: "quick-log" | "quick-metric";
};

export type AiTrackingQualityDraft = {
  headline: string;
  summary?: string;
  keyGaps: string[];
  citedSourceIds: string[];
  suggestedDestination?: AiTrackingQualityDestination;
  caution?: string;
};

const MAX_HEADLINE_LENGTH = 96;
const MAX_SUMMARY_LENGTH = 520;
const MAX_GAP_LENGTH = 140;

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
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(startIndex, index + 1);
    }
  }
  return null;
}

function isDestination(value: unknown): value is AiTrackingQualityDestination {
  return (
    value === "action-center" ||
    value === "planner" ||
    value === "logbook" ||
    value === "workspace-tools"
  );
}

export function formatAiTrackingQualityDestinationLabel(
  destination: AiTrackingQualityDestination,
) {
  if (destination === "planner") return "Open planner";
  if (destination === "logbook") return "Open logbook";
  if (destination === "workspace-tools") return "Open workspace tools";
  return "Stay in action center";
}

export function formatAiTrackingQualitySourceLabel(source: AiTrackingQualitySource) {
  if (source.kind === "metric-gap") return `Metric gap: ${source.title}`;
  if (source.kind === "space-gap") return `Space gap: ${source.title}`;
  if (source.kind === "log-gap") return `Sparse log: ${source.title}`;
  return `Reminder gap: ${source.title}`;
}

export function buildAiTrackingQualityGenerationPrompt(prompt: string) {
  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  "headline": "string",\n  "summary": "string",\n  "keyGaps": ["string"],\n  "sourceIds": ["string"],\n  "suggestedDestination": "action-center | planner | logbook | workspace-tools",\n  "caution": "string"\n}\nRules:\n- Use only the provided tracking-quality context and cited sources.\n- Cite 1 to 4 sourceIds that directly support the brief.\n- Keep this review-only and do not imply logs, reminders, or workspace state were changed.\n- Explain what should be recorded next; do not invent hidden causes or unseen proof.`;
}

export function parseAiTrackingQualityDraft(
  value: string,
  options: { allowedSourceIds: string[] },
): AiTrackingQualityDraft | null {
  const jsonCandidate = extractJsonCandidate(value);
  if (!jsonCandidate) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const allowedSourceIds = new Set(options.allowedSourceIds);
  const citedSourceIds = (Array.isArray(parsed.sourceIds) ? parsed.sourceIds : [])
    .filter((item): item is string => typeof item === "string")
    .filter((item) => allowedSourceIds.has(item))
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4);
  const keyGaps = (Array.isArray(parsed.keyGaps) ? parsed.keyGaps : [])
    .map((item) => compactText(item, MAX_GAP_LENGTH))
    .filter((item): item is string => item.length > 0)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 5);
  const summary = compactText(parsed.summary, MAX_SUMMARY_LENGTH) || undefined;

  if ((!summary && keyGaps.length === 0) || citedSourceIds.length === 0) {
    return null;
  }

  return {
    headline:
      compactText(parsed.headline, MAX_HEADLINE_LENGTH) ||
      "TrackItUp tracking quality brief",
    summary,
    keyGaps,
    citedSourceIds,
    suggestedDestination: isDestination(parsed.suggestedDestination)
      ? parsed.suggestedDestination
      : undefined,
    caution: compactText(parsed.caution, 140) || undefined,
  };
}

export function buildAiTrackingQualityReviewItems(
  draft: AiTrackingQualityDraft,
  sources: AiTrackingQualitySource[],
): AiDraftReviewItemInput[] {
  const sourceMap = new Map(sources.map((source) => [source.id, source] as const));
  return [
    { key: "headline", label: "Headline", value: draft.headline },
    { key: "summary", label: "Summary", value: draft.summary, maxTextLength: 460 },
    { key: "gaps", label: "Key gaps", value: draft.keyGaps, maxLines: 6 },
    {
      key: "sources",
      label: "Cited sources",
      value: draft.citedSourceIds
        .map((sourceId) => sourceMap.get(sourceId))
        .filter((source): source is AiTrackingQualitySource => Boolean(source))
        .map((source) => formatAiTrackingQualitySourceLabel(source)),
      maxLines: 6,
    },
    {
      key: "destination",
      label: "Suggested destination",
      value: draft.suggestedDestination
        ? formatAiTrackingQualityDestinationLabel(draft.suggestedDestination)
        : undefined,
    },
    { key: "caution", label: "Caution", value: draft.caution },
  ].filter((item) => {
    if (Array.isArray(item.value)) return item.value.length > 0;
    return typeof item.value === "string" && item.value.trim().length > 0;
  });
}