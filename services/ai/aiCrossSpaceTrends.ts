import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";

export type AiCrossSpaceTrendDestination =
  | "visual-history"
  | "planner"
  | "inventory"
  | "workspace-tools";

export type AiCrossSpaceTrendSource = {
  id: string;
  title: string;
  kind: "space" | "anomaly";
  snippet: string;
  route: AiCrossSpaceTrendDestination;
  spaceId?: string;
};

export type AiCrossSpaceTrendDraft = {
  headline: string;
  summary?: string;
  keySignals: string[];
  citedSourceIds: string[];
  suggestedDestination?: AiCrossSpaceTrendDestination;
  caution?: string;
};

const MAX_HEADLINE_LENGTH = 96;
const MAX_SUMMARY_LENGTH = 520;
const MAX_SIGNAL_LENGTH = 140;

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

function isDestination(value: unknown): value is AiCrossSpaceTrendDestination {
  return (
    value === "visual-history" ||
    value === "planner" ||
    value === "inventory" ||
    value === "workspace-tools"
  );
}

export function formatAiCrossSpaceTrendDestinationLabel(
  destination: AiCrossSpaceTrendDestination,
) {
  if (destination === "planner") return "Open planner";
  if (destination === "inventory") return "Open inventory";
  if (destination === "workspace-tools") return "Open workspace tools";
  return "Open visual history";
}

export function formatAiCrossSpaceTrendSourceLabel(
  source: AiCrossSpaceTrendSource,
) {
  return `${source.kind === "space" ? "Space" : "Anomaly"}: ${source.title}`;
}

export function buildAiCrossSpaceTrendGenerationPrompt(prompt: string) {
  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  "headline": "string",\n  "summary": "string",\n  "keySignals": ["string"],\n  "sourceIds": ["string"],\n  "suggestedDestination": "visual-history | planner | inventory | workspace-tools",\n  "caution": "string"\n}\nRules:\n- Use only the provided workspace trend context and cited sources.\n- Cite 1 to 4 sourceIds that directly support the summary.\n- Explain changes or anomalies plainly instead of guessing causes that are not in the data.\n- Keep this review-only and do not imply any reminder, inventory, or log change has already happened.`;
}

export function parseAiCrossSpaceTrendDraft(
  value: string,
  options: { allowedSourceIds: string[] },
): AiCrossSpaceTrendDraft | null {
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
  const keySignals = (Array.isArray(parsed.keySignals) ? parsed.keySignals : [])
    .map((item) => compactText(item, MAX_SIGNAL_LENGTH))
    .filter((item): item is string => item.length > 0)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 5);
  const summary = compactText(parsed.summary, MAX_SUMMARY_LENGTH) || undefined;
  if ((!summary && keySignals.length === 0) || citedSourceIds.length === 0) {
    return null;
  }
  return {
    headline:
      compactText(parsed.headline, MAX_HEADLINE_LENGTH) ||
      "TrackItUp trend summary",
    summary,
    keySignals,
    citedSourceIds,
    suggestedDestination: isDestination(parsed.suggestedDestination)
      ? parsed.suggestedDestination
      : undefined,
    caution: compactText(parsed.caution, 140) || undefined,
  };
}

export function buildAiCrossSpaceTrendReviewItems(
  draft: AiCrossSpaceTrendDraft,
  sources: AiCrossSpaceTrendSource[],
): AiDraftReviewItemInput[] {
  const sourceMap = new Map(sources.map((source) => [source.id, source] as const));
  return [
    { key: "headline", label: "Headline", value: draft.headline },
    { key: "summary", label: "Summary", value: draft.summary, maxTextLength: 460 },
    { key: "signals", label: "Key signals", value: draft.keySignals, maxLines: 6 },
    {
      key: "sources",
      label: "Cited sources",
      value: draft.citedSourceIds
        .map((sourceId) => sourceMap.get(sourceId))
        .filter((source): source is AiCrossSpaceTrendSource => Boolean(source))
        .map((source) => formatAiCrossSpaceTrendSourceLabel(source)),
      maxLines: 6,
    },
    {
      key: "destination",
      label: "Suggested destination",
      value: draft.suggestedDestination
        ? formatAiCrossSpaceTrendDestinationLabel(draft.suggestedDestination)
        : undefined,
    },
    { key: "caution", label: "Caution", value: draft.caution },
  ].filter((item) => {
    if (Array.isArray(item.value)) return item.value.length > 0;
    return typeof item.value === "string" && item.value.trim().length > 0;
  });
}