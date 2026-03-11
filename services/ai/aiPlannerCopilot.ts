import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";

export type AiPlannerCopilotActionKind =
  | "do-now"
  | "log-proof"
  | "snooze"
  | "review-later";

export type AiPlannerCopilotDraftAction = {
  reminderId: string;
  title: string;
  action: AiPlannerCopilotActionKind;
  reason: string;
};

export type AiPlannerCopilotDraft = {
  headline: string;
  summary?: string;
  focusDateKey?: string;
  groupedPlan: string[];
  suggestedActions: AiPlannerCopilotDraftAction[];
  caution?: string;
};

const MAX_HEADLINE_LENGTH = 90;
const MAX_SUMMARY_LENGTH = 460;
const MAX_REASON_LENGTH = 140;
const MAX_GROUPED_PLAN_COUNT = 5;
const MAX_GROUPED_PLAN_TEXT_LENGTH = 120;
const MAX_ACTION_COUNT = 4;

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

function isPlannerActionKind(value: unknown): value is AiPlannerCopilotActionKind {
  return (
    value === "do-now" ||
    value === "log-proof" ||
    value === "snooze" ||
    value === "review-later"
  );
}

function getPlannerActionLabel(action: AiPlannerCopilotActionKind) {
  if (action === "do-now") return "Do now";
  if (action === "log-proof") return "Log proof";
  if (action === "snooze") return "Snooze";
  return "Review later";
}

export function buildAiPlannerCopilotGenerationPrompt(prompt: string) {
  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  "headline": "string",\n  "summary": "string",\n  "focusDateKey": "YYYY-MM-DD",\n  "groupedPlan": ["string"],\n  "suggestedActions": [\n    {\n      "reminderId": "string",\n      "title": "string",\n      "action": "do-now | log-proof | snooze | review-later",\n      "reason": "string"\n    }\n  ],\n  "caution": "string"\n}\nRules:\n- Keep every recommendation grounded in the provided reminder schedule, recent activity, and recommendation context.\n- Do not invent reminders, logs, automation, or completion state changes.\n- Treat the output as a review-only next-step suggestion for the user.`;
}

export function parseAiPlannerCopilotDraft(
  value: string,
  options: {
    allowedDateKeys: string[];
    reminders: Array<{ id: string; title: string }>;
  },
): AiPlannerCopilotDraft | null {
  const jsonCandidate = extractJsonCandidate(value);
  if (!jsonCandidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;

  const reminderTitlesById = new Map(
    options.reminders.map((reminder) => [reminder.id, reminder.title] as const),
  );
  const focusDateKey =
    typeof parsed.focusDateKey === "string" &&
    options.allowedDateKeys.includes(parsed.focusDateKey)
      ? parsed.focusDateKey
      : undefined;
  const groupedPlan = (Array.isArray(parsed.groupedPlan) ? parsed.groupedPlan : [])
    .map((item) => compactText(item, MAX_GROUPED_PLAN_TEXT_LENGTH))
    .filter((item): item is string => item.length > 0)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, MAX_GROUPED_PLAN_COUNT);
  const suggestedActions = (
    Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : []
  )
    .map((item) => {
      if (!isRecord(item)) return null;
      if (typeof item.reminderId !== "string") return null;
      const title = reminderTitlesById.get(item.reminderId);
      if (!title) return null;
      if (!isPlannerActionKind(item.action)) return null;

      return {
        reminderId: item.reminderId,
        title: compactText(item.title, 90) || title,
        action: item.action,
        reason: compactText(item.reason, MAX_REASON_LENGTH),
      };
    })
    .filter(
      (item): item is AiPlannerCopilotDraftAction => Boolean(item?.reason),
    )
    .filter((item, index, list) => {
      return list.findIndex((candidate) => candidate.reminderId === item.reminderId) === index;
    })
    .slice(0, MAX_ACTION_COUNT);

  const summary = compactText(parsed.summary, MAX_SUMMARY_LENGTH) || undefined;
  if (!summary && groupedPlan.length === 0 && suggestedActions.length === 0) {
    return null;
  }

  return {
    headline:
      compactText(parsed.headline, MAX_HEADLINE_LENGTH) ||
      "TrackItUp planner copilot",
    summary,
    focusDateKey,
    groupedPlan,
    suggestedActions,
    caution: compactText(parsed.caution, 120) || undefined,
  };
}

export function buildAiPlannerCopilotReviewItems(
  draft: AiPlannerCopilotDraft,
): AiDraftReviewItemInput[] {
  return [
    { key: "headline", label: "Headline", value: draft.headline },
    { key: "summary", label: "Summary", value: draft.summary, maxTextLength: 420 },
    {
      key: "groupedPlan",
      label: "Suggested plan",
      value: draft.groupedPlan,
      maxLines: 6,
    },
    {
      key: "suggestedActions",
      label: "Reminder actions",
      value: draft.suggestedActions.map(
        (action) => `${action.title} — ${getPlannerActionLabel(action.action)} • ${action.reason}`,
      ),
      maxLines: 6,
    },
    { key: "caution", label: "Caution", value: draft.caution },
  ].filter((item) => {
    if (Array.isArray(item.value)) {
      return item.value.length > 0;
    }

    return typeof item.value === "string" && item.value.trim().length > 0;
  });
}