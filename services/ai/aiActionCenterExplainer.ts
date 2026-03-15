import type { AiDraftReviewItemInput } from "./aiDraftReview.ts";

export type AiActionCenterExplainerActionKind =
  | "complete-now"
  | "log-proof"
  | "snooze"
  | "open-planner"
  | "create-log"
  | "create-recurring-plan"
  | "complete-recurring-now"
  | "review-later";

export type AiActionCenterExplainerDraftAction = {
  reminderId?: string;
  recurringOccurrenceId?: string;
  recurringPlanId?: string;
  title: string;
  action: AiActionCenterExplainerActionKind;
  reason: string;
  formValues?: {
    spaceId?: string;
    occurredAt?: string;
    startDate?: string;
    timezone?: string;
    note?: string;
    tags?: string[];
    assetIds?: string[];
    reminderId?: string;
    scheduleType?: "daily" | "every-n-days" | "weekly" | "monthly";
    scheduleTimes?: string[];
    interval?: number;
    daysOfWeek?: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
    dayOfMonth?: number;
    nthWeekday?: {
      weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
      weekOfMonth: 1 | 2 | 3 | 4 | 5 | -1;
    };
    proofRequired?: boolean;
  };
};

export type AiActionCenterExplainerDraft = {
  headline: string;
  summary?: string;
  groupedInsights: string[];
  recommendationTakeaways: string[];
  suggestedActions: AiActionCenterExplainerDraftAction[];
  caution?: string;
};

type ActionFormValues = NonNullable<
  AiActionCenterExplainerDraftAction["formValues"]
>;

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

function isActionKind(
  value: unknown,
): value is AiActionCenterExplainerActionKind {
  return (
    value === "complete-now" ||
    value === "log-proof" ||
    value === "snooze" ||
    value === "open-planner" ||
    value === "create-log" ||
    value === "create-recurring-plan" ||
    value === "complete-recurring-now" ||
    value === "review-later"
  );
}

function getActionLabel(action: AiActionCenterExplainerActionKind) {
  if (action === "complete-now") return "Complete now";
  if (action === "log-proof") return "Log proof";
  if (action === "snooze") return "Snooze";
  if (action === "open-planner") return "Open planner";
  if (action === "create-log") return "Create log";
  if (action === "create-recurring-plan") return "Create recurring plan";
  if (action === "complete-recurring-now") return "Complete recurring now";
  return "Review later";
}

function normalizeStringArray(value: unknown, maxItems = 6, maxLength = 40) {
  if (!Array.isArray(value)) return undefined;
  const next = value
    .map((item) => compactText(item, maxLength))
    .filter((item): item is string => item.length > 0)
    .slice(0, maxItems);
  return next.length > 0 ? next : undefined;
}

function normalizeIsoDateTime(value: unknown) {
  if (typeof value !== "string") return undefined;
  const candidate = value.trim();
  if (!candidate) return undefined;
  const timestamp = Date.parse(candidate);
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
}

function normalizeTimezone(value: unknown) {
  if (typeof value !== "string") return undefined;
  const candidate = value.trim();
  if (!candidate) return undefined;
  return compactText(candidate, 80);
}

function normalizeScheduleTimes(value: unknown) {
  const times = normalizeStringArray(value, 6, 5);
  if (!times) return undefined;
  const valid = times.filter((time) => /^\d{1,2}:\d{2}$/.test(time));
  return valid.length > 0 ? valid : undefined;
}

function normalizeFormValues(value: unknown) {
  const normalizeScheduleType = (
    candidate: unknown,
  ): ActionFormValues["scheduleType"] => {
    if (
      candidate === "daily" ||
      candidate === "every-n-days" ||
      candidate === "weekly" ||
      candidate === "monthly"
    ) {
      return candidate;
    }
    return undefined;
  };

  if (!isRecord(value)) return undefined;

  const scheduleType = normalizeScheduleType(value.scheduleType);

  const daysOfWeek = Array.isArray(value.daysOfWeek)
    ? value.daysOfWeek
        .map((item) => (typeof item === "number" ? Math.floor(item) : NaN))
        .filter(
          (item): item is 0 | 1 | 2 | 3 | 4 | 5 | 6 =>
            Number.isInteger(item) && item >= 0 && item <= 6,
        )
    : undefined;

  const nthWeekday = isRecord(value.nthWeekday)
    ? {
        weekday:
          typeof value.nthWeekday.weekday === "number" &&
          Number.isInteger(value.nthWeekday.weekday) &&
          value.nthWeekday.weekday >= 0 &&
          value.nthWeekday.weekday <= 6
            ? (value.nthWeekday.weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6)
            : undefined,
        weekOfMonth:
          typeof value.nthWeekday.weekOfMonth === "number" &&
          Number.isInteger(value.nthWeekday.weekOfMonth) &&
          [1, 2, 3, 4, 5, -1].includes(value.nthWeekday.weekOfMonth)
            ? (value.nthWeekday.weekOfMonth as 1 | 2 | 3 | 4 | 5 | -1)
            : undefined,
      }
    : undefined;

  const normalized: AiActionCenterExplainerDraftAction["formValues"] = {
    spaceId:
      typeof value.spaceId === "string"
        ? compactText(value.spaceId, 80)
        : undefined,
    occurredAt: normalizeIsoDateTime(value.occurredAt),
    startDate: normalizeIsoDateTime(value.startDate),
    timezone: normalizeTimezone(value.timezone),
    note: compactText(value.note, 240) || undefined,
    tags: normalizeStringArray(value.tags, 8, 24),
    assetIds: normalizeStringArray(value.assetIds, 8, 80),
    reminderId:
      typeof value.reminderId === "string"
        ? compactText(value.reminderId, 80)
        : undefined,
    scheduleType,
    scheduleTimes: normalizeScheduleTimes(value.scheduleTimes),
    interval:
      typeof value.interval === "number" &&
      Number.isFinite(value.interval) &&
      value.interval > 0
        ? Math.max(1, Math.floor(value.interval))
        : undefined,
    daysOfWeek:
      daysOfWeek && daysOfWeek.length > 0
        ? Array.from(new Set(daysOfWeek))
        : undefined,
    dayOfMonth:
      typeof value.dayOfMonth === "number" &&
      Number.isFinite(value.dayOfMonth) &&
      value.dayOfMonth >= 1 &&
      value.dayOfMonth <= 31
        ? Math.floor(value.dayOfMonth)
        : undefined,
    nthWeekday:
      nthWeekday?.weekday !== undefined && nthWeekday?.weekOfMonth !== undefined
        ? {
            weekday: nthWeekday.weekday,
            weekOfMonth: nthWeekday.weekOfMonth,
          }
        : undefined,
    proofRequired:
      typeof value.proofRequired === "boolean"
        ? value.proofRequired
        : undefined,
  };

  if (!Object.values(normalized).some((item) => item !== undefined)) {
    return undefined;
  }

  return normalized;
}

export function buildAiActionCenterExplainerGenerationPrompt(prompt: string) {
  return `${prompt}\n\nReturn ONLY valid JSON with this shape:\n{\n  "headline": "string",\n  "summary": "string",\n  "groupedInsights": ["string"],\n  "recommendationTakeaways": ["string"],\n  "suggestedActions": [\n    {\n      "reminderId": "string (optional)",\n      "recurringOccurrenceId": "string (optional)",\n      "recurringPlanId": "string (optional)",\n      "title": "string",\n      "action": "complete-now | log-proof | snooze | open-planner | create-log | create-recurring-plan | complete-recurring-now | review-later",\n      "reason": "string",\n      "formValues": {\n        "occurredAt": "ISO datetime (optional)",\n        "startDate": "ISO datetime (optional)",\n        "timezone": "IANA timezone (optional)",\n        "note": "string (optional)",\n        "tags": ["string"],\n        "assetIds": ["string"],\n        "spaceId": "string (optional)",\n        "reminderId": "string (optional)",\n        "scheduleType": "daily | every-n-days | weekly | monthly",\n        "scheduleTimes": ["HH:mm"],\n        "interval": "number (for every-n-days)",\n        "daysOfWeek": [0,1,2,3,4,5,6],\n        "dayOfMonth": "number",\n        "nthWeekday": {"weekday":0,"weekOfMonth":1},\n        "proofRequired": "boolean"\n      }\n    }\n  ],\n  "caution": "string"\n}\nRules:\n- Keep every explanation grounded in the provided action-center counts, grouped reminders, next-step metadata, recurring queue context, recent reminder activity, and recommendations.\n- Prefer a short, high-confidence sequence of immediately executable next moves before lower-priority review steps.\n- Use reminder actions ('complete-now', 'log-proof', 'snooze') only when a valid reminderId is present.\n- Use recurring completion ('complete-recurring-now') only when a valid recurringOccurrenceId is present.\n- For 'create-log' and 'create-recurring-plan', include formValues when transcript provides date/time or other concrete form fields.\n- Suggested action reasons must reference only evidence present in the provided context (timing, grouped pressure, deferral/completion patterns, schedule hints, and recommendation details).\n- Do not invent reminders, recurring occurrences, logs, automation, user preferences, or state changes that are not present in the provided context.\n- Treat the output as a review-only explanation for the user.`;
}

export function parseAiActionCenterExplainerDraft(
  value: string,
  options: {
    reminders: Array<{ id: string; title: string }>;
    recurringOccurrences?: Array<{
      id: string;
      title: string;
      planId?: string;
    }>;
  },
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
  const reminderTitlesById = new Map(
    options.reminders.map((item) => [item.id, item.title] as const),
  );
  const recurringTitlesById = new Map(
    (options.recurringOccurrences ?? []).map(
      (item) => [item.id, { title: item.title, planId: item.planId }] as const,
    ),
  );
  const groupedInsights = (
    Array.isArray(parsed.groupedInsights) ? parsed.groupedInsights : []
  )
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
    .flatMap<AiActionCenterExplainerDraftAction>((item) => {
      if (!isRecord(item)) return [];
      if (!isActionKind(item.action)) return [];

      const reminderId =
        typeof item.reminderId === "string" ? item.reminderId : undefined;
      const recurringOccurrenceId =
        typeof item.recurringOccurrenceId === "string"
          ? item.recurringOccurrenceId
          : undefined;
      const recurringPlanId =
        typeof item.recurringPlanId === "string"
          ? item.recurringPlanId
          : undefined;
      const reminderTitle = reminderId
        ? reminderTitlesById.get(reminderId)
        : undefined;
      const recurringOccurrence = recurringOccurrenceId
        ? recurringTitlesById.get(recurringOccurrenceId)
        : undefined;

      if (
        (item.action === "complete-now" ||
          item.action === "log-proof" ||
          item.action === "snooze") &&
        (!reminderId || !reminderTitle)
      ) {
        return [];
      }

      if (item.action === "complete-recurring-now" && !recurringOccurrence) {
        return [];
      }

      if (
        reminderId &&
        (item.action === "open-planner" ||
          item.action === "create-log" ||
          item.action === "review-later") &&
        !reminderTitle
      ) {
        return [];
      }

      const resolvedTitle =
        reminderTitle ??
        recurringOccurrence?.title ??
        compactText(item.title, 90);
      const reason = compactText(item.reason, MAX_REASON_LENGTH);
      if (!reason) return [];

      const formValues = normalizeFormValues(item.formValues);

      return [
        {
          ...(reminderId ? { reminderId } : {}),
          ...(recurringOccurrenceId ? { recurringOccurrenceId } : {}),
          ...(recurringPlanId || recurringOccurrence?.planId
            ? {
                recurringPlanId: recurringPlanId ?? recurringOccurrence?.planId,
              }
            : {}),
          title: resolvedTitle || "TrackItUp action",
          action: item.action,
          reason,
          ...(formValues ? { formValues } : {}),
        },
      ];
    })
    .filter(
      (item, index, list) =>
        list.findIndex((candidate) => {
          const candidateKey = `${candidate.action}:${candidate.reminderId ?? ""}:${candidate.recurringOccurrenceId ?? ""}:${candidate.title}`;
          const itemKey = `${item.action}:${item.reminderId ?? ""}:${item.recurringOccurrenceId ?? ""}:${item.title}`;
          return candidateKey === itemKey;
        }) === index,
    )
    .slice(0, 4);

  const summary = compactText(parsed.summary, MAX_SUMMARY_LENGTH) || undefined;
  if (
    !summary &&
    groupedInsights.length === 0 &&
    suggestedActions.length === 0
  ) {
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
    {
      key: "summary",
      label: "Summary",
      value: draft.summary,
      maxTextLength: 420,
    },
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
        (action) =>
          `${action.title} — ${getActionLabel(action.action)} • ${action.reason}`,
      ),
      maxLines: 6,
    },
    { key: "caution", label: "Caution", value: draft.caution },
  ].filter((item) => {
    if (Array.isArray(item.value)) return item.value.length > 0;
    return typeof item.value === "string" && item.value.trim().length > 0;
  });
}
