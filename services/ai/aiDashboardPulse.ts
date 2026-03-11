import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";

export type AiDashboardPulseDestination =
  | "action-center"
  | "planner"
  | "logbook"
  | "inventory"
  | "visual-history";

export type AiDashboardPulseSource = {
  id: string;
  title: string;
  kind: "recommendation" | "attention" | "space";
  snippet: string;
  route: AiDashboardPulseDestination;
  spaceId?: string;
};

export type AiDashboardPulseDraft = {
  headline: string;
  summary?: string;
  priorities: string[];
  citedSourceIds: string[];
  suggestedDestination?: AiDashboardPulseDestination;
  caution?: string;
};

const MAX_HEADLINE_LENGTH = 96;
const MAX_SUMMARY_LENGTH = 480;
const MAX_PRIORITY_LENGTH = 140;

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

function isDestination(value: unknown): value is AiDashboardPulseDestination {
  return (
    value === "action-center" ||
    value === "planner" ||
    value === "logbook" ||
    value === "inventory" ||
    value === "visual-history"
  );
}

export function formatAiDashboardPulseDestinationLabel(
  destination: AiDashboardPulseDestination,
) {
  if (destination === "planner") return "Open planner";
  if (destination === "logbook") return "Open logbook";
  if (destination === "inventory") return "Open inventory";
  if (destination === "visual-history") return "Open visual history";
  return "Open action center";
}

export function formatAiDashboardPulseSourceLabel(source: AiDashboardPulseSource) {
  return `${source.kind === "space" ? "Space" : source.kind === "attention" ? "Attention" : "Recommendation"}: ${source.title}`;
}

export function buildAiDashboardPulseGenerationPrompt(prompt: string) {
  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  "headline": "string",\n  "summary": "string",\n  "priorities": ["string"],\n  "sourceIds": ["string"],\n  "suggestedDestination": "action-center | planner | logbook | inventory | visual-history",\n  "caution": "string"\n}\nRules:\n- Use only the provided dashboard overview and cited sources.\n- Cite 1 to 4 sourceIds that directly support the brief.\n- Keep the output review-only; do not imply reminders, logs, or inventory already changed.\n- If the workspace is light or ambiguous, say so plainly instead of guessing.`;
}

export function parseAiDashboardPulseDraft(
  value: string,
  options: { allowedSourceIds: string[] },
): AiDashboardPulseDraft | null {
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
  const priorities = (Array.isArray(parsed.priorities) ? parsed.priorities : [])
    .map((item) => compactText(item, MAX_PRIORITY_LENGTH))
    .filter((item): item is string => item.length > 0)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 5);
  const summary = compactText(parsed.summary, MAX_SUMMARY_LENGTH) || undefined;
  if ((!summary && priorities.length === 0) || citedSourceIds.length === 0) {
    return null;
  }

  return {
    headline:
      compactText(parsed.headline, MAX_HEADLINE_LENGTH) ||
      "TrackItUp dashboard pulse",
    summary,
    priorities,
    citedSourceIds,
    suggestedDestination: isDestination(parsed.suggestedDestination)
      ? parsed.suggestedDestination
      : undefined,
    caution: compactText(parsed.caution, 140) || undefined,
  };
}

export function buildAiDashboardPulseReviewItems(
  draft: AiDashboardPulseDraft,
  sources: AiDashboardPulseSource[],
): AiDraftReviewItemInput[] {
  const sourceMap = new Map(sources.map((source) => [source.id, source] as const));
  return [
    { key: "headline", label: "Headline", value: draft.headline },
    { key: "summary", label: "Summary", value: draft.summary, maxTextLength: 420 },
    { key: "priorities", label: "Priorities", value: draft.priorities, maxLines: 6 },
    {
      key: "sources",
      label: "Cited sources",
      value: draft.citedSourceIds
        .map((sourceId) => sourceMap.get(sourceId))
        .filter((source): source is AiDashboardPulseSource => Boolean(source))
        .map((source) => formatAiDashboardPulseSourceLabel(source)),
      maxLines: 6,
    },
    {
      key: "destination",
      label: "Suggested destination",
      value: draft.suggestedDestination
        ? formatAiDashboardPulseDestinationLabel(draft.suggestedDestination)
        : undefined,
    },
    { key: "caution", label: "Caution", value: draft.caution },
  ].filter((item) => {
    if (Array.isArray(item.value)) return item.value.length > 0;
    return typeof item.value === "string" && item.value.trim().length > 0;
  });
}