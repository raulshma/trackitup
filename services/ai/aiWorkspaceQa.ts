import { formatSpaceCategoryLabel } from "../../constants/TrackItUpSpaceCategories.ts";
import type { WorkspaceSnapshot } from "../../types/trackitup.ts";
import { getReminderScheduleTimestamp } from "../insights/workspaceInsights.ts";
import { getWorkspaceRecommendations } from "../insights/workspaceRecommendations.ts";
import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";

export type AiWorkspaceQaDestination =
  | "action-center"
  | "planner"
  | "inventory"
  | "logbook"
  | "workspace-tools";

export type AiWorkspaceQaSourceKind =
  | "space"
  | "asset"
  | "reminder"
  | "log"
  | "recommendation"
  | "template";

export type AiWorkspaceQaSource = {
  id: string;
  kind: AiWorkspaceQaSourceKind;
  title: string;
  snippet: string;
  route: AiWorkspaceQaDestination;
};

export type AiWorkspaceQaDraft = {
  headline: string;
  answer?: string;
  keyPoints: string[];
  citedSourceIds: string[];
  suggestedDestination?: AiWorkspaceQaDestination;
  caution?: string;
};

const MAX_HEADLINE_LENGTH = 100;
const MAX_ANSWER_LENGTH = 520;
const MAX_POINT_LENGTH = 140;
const STOP_WORDS = new Set([
  "about",
  "after",
  "before",
  "from",
  "have",
  "into",
  "that",
  "them",
  "there",
  "these",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "should",
  "could",
  "tell",
  "give",
  "show",
  "latest",
  "please",
]);

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

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function isDestination(value: unknown): value is AiWorkspaceQaDestination {
  return (
    value === "action-center" ||
    value === "planner" ||
    value === "inventory" ||
    value === "logbook" ||
    value === "workspace-tools"
  );
}

function getSourceKindLabel(kind: AiWorkspaceQaSourceKind) {
  if (kind === "space") return "Space";
  if (kind === "asset") return "Asset";
  if (kind === "reminder") return "Reminder";
  if (kind === "log") return "Log";
  if (kind === "recommendation") return "Recommendation";
  return "Template";
}

export function formatAiWorkspaceQaDestinationLabel(
  destination: AiWorkspaceQaDestination,
) {
  if (destination === "planner") return "Open planner";
  if (destination === "inventory") return "Open inventory";
  if (destination === "logbook") return "Open logbook";
  if (destination === "workspace-tools") return "Open workspace tools";
  return "Open action center";
}

export function formatAiWorkspaceQaSourceLabel(source: AiWorkspaceQaSource) {
  return `${getSourceKindLabel(source.kind)}: ${source.title}`;
}

type SourceCandidate = AiWorkspaceQaSource & {
  priority: number;
  searchText: string;
};

export function selectAiWorkspaceQaSources(
  workspace: WorkspaceSnapshot,
  question: string,
  maxSources = 6,
) {
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const normalizedQuestion = compactText(question, 240).toLowerCase();
  const tokens = tokenize(normalizedQuestion);
  const candidates: SourceCandidate[] = [
    ...workspace.spaces.map((space) => {
      const categoryLabel = formatSpaceCategoryLabel(space.category);
      return {
        id: `space:${space.id}`,
        kind: "space" as const,
        title: space.name,
        snippet: compactText(
          `${categoryLabel} • ${space.status} • ${space.summary}`,
          140,
        ),
        route: "workspace-tools" as const,
        priority: 1,
        searchText:
          `${space.name} ${categoryLabel} ${space.category} ${space.status} ${space.summary}`.toLowerCase(),
      };
    }),
    ...workspace.assets.map((asset) => ({
      id: `asset:${asset.id}`,
      kind: "asset" as const,
      title: asset.name,
      snippet: compactText(
        `${asset.category} • ${asset.status} • ${spacesById.get(asset.spaceId)?.name ?? "Unknown space"} • ${asset.note}`,
        150,
      ),
      route: "inventory" as const,
      priority: 2,
      searchText:
        `${asset.name} ${asset.category} ${asset.status} ${asset.note} ${spacesById.get(asset.spaceId)?.name ?? ""}`.toLowerCase(),
    })),
    ...workspace.reminders.map((reminder) => ({
      id: `reminder:${reminder.id}`,
      kind: "reminder" as const,
      title: reminder.title,
      snippet: compactText(
        `${reminder.status} • ${getReminderScheduleTimestamp(reminder)} • ${reminder.description}`,
        150,
      ),
      route: "planner" as const,
      priority: 4,
      searchText:
        `${reminder.title} ${reminder.description} ${reminder.status} ${spacesById.get(reminder.spaceId)?.name ?? ""}`.toLowerCase(),
    })),
    ...[...workspace.logs]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 18)
      .map((log) => ({
        id: `log:${log.id}`,
        kind: "log" as const,
        title: log.title,
        snippet: compactText(
          `${log.kind} • ${log.occurredAt} • ${log.note} ${(log.tags ?? []).join(" ")}`,
          160,
        ),
        route: "logbook" as const,
        priority: 3,
        searchText:
          `${log.title} ${log.note} ${log.kind} ${(log.tags ?? []).join(" ")} ${spacesById.get(log.spaceId)?.name ?? ""}`.toLowerCase(),
      })),
    ...getWorkspaceRecommendations(workspace)
      .slice(0, 6)
      .map((recommendation) => ({
        id: `recommendation:${recommendation.id}`,
        kind: "recommendation" as const,
        title: recommendation.title,
        snippet: compactText(
          `${recommendation.severity} • ${recommendation.explanation} • ${recommendation.action.label}`,
          160,
        ),
        route:
          recommendation.action.kind === "open-inventory"
            ? ("inventory" as const)
            : recommendation.action.kind === "open-logbook"
              ? ("logbook" as const)
              : ("planner" as const),
        priority: 5,
        searchText:
          `${recommendation.title} ${recommendation.explanation} ${recommendation.action.label} ${recommendation.severity}`.toLowerCase(),
      })),
    ...workspace.templates.slice(0, 6).map((template) => ({
      id: `template:${template.id}`,
      kind: "template" as const,
      title: template.name,
      snippet: compactText(`${template.category} • ${template.summary}`, 140),
      route: "workspace-tools" as const,
      priority: 1,
      searchText:
        `${template.name} ${template.category} ${template.summary} ${template.origin}`.toLowerCase(),
    })),
  ];

  const scored = candidates
    .map((candidate) => {
      let score = candidate.priority;
      if (
        normalizedQuestion &&
        candidate.searchText.includes(normalizedQuestion)
      ) {
        score += 8;
      }
      tokens.forEach((token) => {
        if (candidate.title.toLowerCase().includes(token)) {
          score += 3;
        } else if (candidate.searchText.includes(token)) {
          score += 1;
        }
      });
      return { ...candidate, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.priority - left.priority;
    });

  return scored
    .slice(0, maxSources)
    .map(({ priority, searchText, score, ...source }) => source);
}

export function buildAiWorkspaceQaGenerationPrompt(prompt: string) {
  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  "headline": "string",\n  "answer": "string",\n  "keyPoints": ["string"],\n  "sourceIds": ["string"],\n  "suggestedDestination": "action-center | planner | inventory | logbook | workspace-tools",\n  "caution": "string"\n}\nRules:\n- Answer only from the provided TrackItUp context and retrieved sources.\n- Cite 1 to 4 sourceIds that directly support the answer.\n- If the sources are insufficient, say so plainly instead of guessing.\n- Keep the result review-only and do not imply any reminder, log, or inventory change has already happened.`;
}

export function parseAiWorkspaceQaDraft(
  value: string,
  options: { allowedSourceIds: string[] },
): AiWorkspaceQaDraft | null {
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
  const keyPoints = (Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [])
    .map((item) => compactText(item, MAX_POINT_LENGTH))
    .filter((item): item is string => item.length > 0)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 5);
  const citedSourceIds = (
    Array.isArray(parsed.sourceIds) ? parsed.sourceIds : []
  )
    .filter((item): item is string => typeof item === "string")
    .filter((item) => allowedSourceIds.has(item))
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4);
  const answer = compactText(parsed.answer, MAX_ANSWER_LENGTH) || undefined;

  if ((!answer && keyPoints.length === 0) || citedSourceIds.length === 0) {
    return null;
  }

  return {
    headline:
      compactText(parsed.headline, MAX_HEADLINE_LENGTH) ||
      "TrackItUp workspace answer",
    answer,
    keyPoints,
    citedSourceIds,
    suggestedDestination: isDestination(parsed.suggestedDestination)
      ? parsed.suggestedDestination
      : undefined,
    caution: compactText(parsed.caution, 140) || undefined,
  };
}

export function buildAiWorkspaceQaReviewItems(
  draft: AiWorkspaceQaDraft,
  sources: AiWorkspaceQaSource[],
): AiDraftReviewItemInput[] {
  const sourceMap = new Map(
    sources.map((source) => [source.id, source] as const),
  );
  return [
    { key: "headline", label: "Headline", value: draft.headline },
    { key: "answer", label: "Answer", value: draft.answer, maxTextLength: 460 },
    { key: "points", label: "Key points", value: draft.keyPoints, maxLines: 6 },
    {
      key: "sources",
      label: "Cited sources",
      value: draft.citedSourceIds
        .map((sourceId) => sourceMap.get(sourceId))
        .filter((source): source is AiWorkspaceQaSource => Boolean(source))
        .map((source) => formatAiWorkspaceQaSourceLabel(source)),
      maxLines: 6,
    },
    {
      key: "destination",
      label: "Suggested destination",
      value: draft.suggestedDestination
        ? formatAiWorkspaceQaDestinationLabel(draft.suggestedDestination)
        : undefined,
    },
    { key: "caution", label: "Caution", value: draft.caution },
  ].filter((item) => {
    if (Array.isArray(item.value)) return item.value.length > 0;
    return typeof item.value === "string" && item.value.trim().length > 0;
  });
}
