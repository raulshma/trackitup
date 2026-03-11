import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";

export type AiPlannerRiskDestination = "planner" | "action-center" | "logbook";

export type AiPlannerRiskSource = {
  id: string;
  title: string;
  kind: "reminder" | "deferral" | "space";
  snippet: string;
  route: AiPlannerRiskDestination;
  spaceId?: string;
  reminderId?: string;
};

export type AiPlannerRiskDraft = {
  headline: string;
  summary?: string;
  keyRisks: string[];
  citedSourceIds: string[];
  suggestedDestination?: AiPlannerRiskDestination;
  caution?: string;
};

const MAX_HEADLINE_LENGTH = 96;
const MAX_SUMMARY_LENGTH = 500;
const MAX_RISK_LENGTH = 140;

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

function isDestination(value: unknown): value is AiPlannerRiskDestination {
  return value === "planner" || value === "action-center" || value === "logbook";
}

export function formatAiPlannerRiskDestinationLabel(
  destination: AiPlannerRiskDestination,
) {
  if (destination === "action-center") return "Open action center";
  if (destination === "logbook") return "Open logbook";
  return "Stay in planner";
}

export function formatAiPlannerRiskSourceLabel(source: AiPlannerRiskSource) {
  return `${source.kind === "space" ? "Space" : source.kind === "deferral" ? "Deferral" : "Reminder"}: ${source.title}`;
}

export function buildAiPlannerRiskGenerationPrompt(prompt: string) {
  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  "headline": "string",\n  "summary": "string",\n  "keyRisks": ["string"],\n  "sourceIds": ["string"],\n  "suggestedDestination": "planner | action-center | logbook",\n  "caution": "string"\n}\nRules:\n- Use only the provided planner risk context and cited sources.\n- Cite 1 to 4 sourceIds that directly support the brief.\n- Keep this review-only and do not imply reminders, logs, or planner state already changed.\n- Explain deferrals and pressure plainly instead of guessing hidden causes.`;
}

export function parseAiPlannerRiskDraft(
  value: string,
  options: { allowedSourceIds: string[] },
): AiPlannerRiskDraft | null {
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
  const keyRisks = (Array.isArray(parsed.keyRisks) ? parsed.keyRisks : [])
    .map((item) => compactText(item, MAX_RISK_LENGTH))
    .filter((item): item is string => item.length > 0)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 5);
  const summary = compactText(parsed.summary, MAX_SUMMARY_LENGTH) || undefined;
  if ((!summary && keyRisks.length === 0) || citedSourceIds.length === 0) {
    return null;
  }

  return {
    headline:
      compactText(parsed.headline, MAX_HEADLINE_LENGTH) ||
      "TrackItUp planner risk brief",
    summary,
    keyRisks,
    citedSourceIds,
    suggestedDestination: isDestination(parsed.suggestedDestination)
      ? parsed.suggestedDestination
      : undefined,
    caution: compactText(parsed.caution, 140) || undefined,
  };
}

export function buildAiPlannerRiskReviewItems(
  draft: AiPlannerRiskDraft,
  sources: AiPlannerRiskSource[],
): AiDraftReviewItemInput[] {
  const sourceMap = new Map(sources.map((source) => [source.id, source] as const));
  return [
    { key: "headline", label: "Headline", value: draft.headline },
    { key: "summary", label: "Summary", value: draft.summary, maxTextLength: 440 },
    { key: "risks", label: "Key risks", value: draft.keyRisks, maxLines: 6 },
    {
      key: "sources",
      label: "Cited sources",
      value: draft.citedSourceIds
        .map((sourceId) => sourceMap.get(sourceId))
        .filter((source): source is AiPlannerRiskSource => Boolean(source))
        .map((source) => formatAiPlannerRiskSourceLabel(source)),
      maxLines: 6,
    },
    {
      key: "destination",
      label: "Suggested destination",
      value: draft.suggestedDestination
        ? formatAiPlannerRiskDestinationLabel(draft.suggestedDestination)
        : undefined,
    },
    { key: "caution", label: "Caution", value: draft.caution },
  ].filter((item) => {
    if (Array.isArray(item.value)) return item.value.length > 0;
    return typeof item.value === "string" && item.value.trim().length > 0;
  });
}