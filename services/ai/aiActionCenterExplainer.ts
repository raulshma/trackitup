import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";

export type AiActionCenterExplainerActionKind =
  | "complete-now"
  | "log-proof"
  | "snooze"
  | "open-planner"
  | "review-later";

export type AiActionCenterExplainerDraftAction = {
  reminderId: string;
  title: string;
  action: AiActionCenterExplainerActionKind;
  reason: string;
};

export type AiActionCenterExplainerDraft = {
  headline: string;
  summary?: string;
  groupedInsights: string[];
  recommendationTakeaways: string[];
  suggestedActions: AiActionCenterExplainerDraftAction[];
  caution?: string;
};

const MAX_HEADLINE_LENGTH = 90;
const MAX_SUMMARY_LENGTH = 460;
const MAX_REASON_LENGTH = 140;
const MAX_LIST_ITEMS = 5;
const MAX_LIST_ITEM_LENGTH = 120;

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

function isActionKind(value: unknown): value is AiActionCenterExplainerActionKind {
  return (
    value === "complete-now" ||
    value === "log-proof" ||
    value === "snooze" ||
    value === "open-planner" ||
    value === "review-later"
  );
}

function getActionLabel(action: AiActionCenterExplainerActionKind) {
  if (action === "complete-now") return "Complete now";
  if (action === "log-proof") return "Log proof";
  if (action === "snooze") return "Snooze";
  if (action === "open-planner") return "Open planner";
  return "Review later";
}

export function buildAiActionCenterExplainerGenerationPrompt(prompt: string) {
  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  "headline": "string",\n  "summary": "string",\n  "groupedInsights": ["string"],\n  "recommendationTakeaways": ["string"],\n  "suggestedActions": [\n    {\n      "reminderId": "string",\n      "title": "string",\n      "action": "complete-now | log-proof | snooze | open-planner | review-later",\n      "reason": "string"\n    }\n  ],\n  "caution": "string"\n}\nRules:\n- Keep every explanation grounded in the provided action-center counts, grouped reminders, recent reminder activity, and recommendations.\n- Do not invent reminders, logs, automation, or state changes that are not present in the provided context.\n- Treat the output as a review-only explanation for the user.`;
}

export function parseAiActionCenterExplainerDraft(
  value: string,
  reminders: Array<{ id: string; title: string }>,
): AiActionCenterExplainerDraft | null {
  const jsonCandidate = extractJsonCandidate(value);
  if (!jsonCandidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  const reminderTitlesById = new Map(reminders.map((item) => [item.id, item.title] as const));
  const groupedInsights = (Array.isArray(parsed.groupedInsights) ? parsed.groupedInsights : [])
    .map((item) => compactText(item, MAX_LIST_ITEM_LENGTH))
    .filter((item): item is string => item.length > 0)
    .slice(0, MAX_LIST_ITEMS);
  const recommendationTakeaways = (
    Array.isArray(parsed.recommendationTakeaways)
      ? parsed.recommendationTakeaways
      : []
  )
    .map((item) => compactText(item, MAX_LIST_ITEM_LENGTH))
    .filter((item): item is string => item.length > 0)
    .slice(0, MAX_LIST_ITEMS);
  const suggestedActions = (
    Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : []
  )
    .map((item) => {
      if (!isRecord(item)) return null;
      if (typeof item.reminderId !== "string") return null;
      const title = reminderTitlesById.get(item.reminderId);
      if (!title || !isActionKind(item.action)) return null;

      return {
        reminderId: item.reminderId,
        title: compactText(item.title, 90) || title,
        action: item.action,
        reason: compactText(item.reason, MAX_REASON_LENGTH),
      };
    })
    .filter(
      (item): item is AiActionCenterExplainerDraftAction => Boolean(item?.reason),
    )
    .filter(
      (item, index, list) =>
        list.findIndex((candidate) => candidate.reminderId === item.reminderId) ===
        index,
    )
    .slice(0, 4);

  const summary = compactText(parsed.summary, MAX_SUMMARY_LENGTH) || undefined;
  if (!summary && groupedInsights.length === 0 && suggestedActions.length === 0) {
    return null;
  }

  return {
    headline:
      compactText(parsed.headline, MAX_HEADLINE_LENGTH) ||
      "TrackItUp action center explainer",
    summary,
    groupedInsights,
    recommendationTakeaways,
    suggestedActions,
    caution: compactText(parsed.caution, 120) || undefined,
  };
}

export function buildAiActionCenterExplainerReviewItems(
  draft: AiActionCenterExplainerDraft,
): AiDraftReviewItemInput[] {
  return [
    { key: "headline", label: "Headline", value: draft.headline },
    { key: "summary", label: "Summary", value: draft.summary, maxTextLength: 420 },
    {
      key: "groupedInsights",
      label: "Grouped workload insights",
      value: draft.groupedInsights,
      maxLines: 6,
    },
    {
      key: "recommendationTakeaways",
      label: "Recommendation takeaways",
      value: draft.recommendationTakeaways,
      maxLines: 6,
    },
    {
      key: "suggestedActions",
      label: "Suggested actions",
      value: draft.suggestedActions.map(
        (action) => `${action.title} — ${getActionLabel(action.action)} • ${action.reason}`,
      ),
      maxLines: 6,
    },
    { key: "caution", label: "Caution", value: draft.caution },
  ].filter((item) => {
    if (Array.isArray(item.value)) return item.value.length > 0;
    return typeof item.value === "string" && item.value.trim().length > 0;
  });
}