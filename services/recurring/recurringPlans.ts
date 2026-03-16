import type {
    LogEntry,
    RecurringCompletionAction,
    RecurringCompletionActionSource,
    RecurringCompletionHistoryEntry,
    RecurringOccurrence,
    RecurringOccurrenceStatus,
    RecurringPlan,
    RecurringPlanScheduleRule,
    WorkspaceSnapshot,
} from "@/types/trackitup";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_LOOKBACK_DAYS = 2;
const DEFAULT_WINDOW_DAYS = 30;

type LocalDate = { year: number; month: number; day: number };
type LocalDateTime = LocalDate & { hour: number; minute: number };

type TimeParts = { hour: number; minute: number };

type RecurringMatchSuggestion = {
  occurrenceId: string;
  planId: string;
  logId: string;
  mode: "off" | "prompt" | "auto";
  score: number;
  title: string;
};

export type RecurringPromptMatchSuggestion = RecurringMatchSuggestion;

export type RecurringPlanAnalytics = {
  planId: string;
  completionRate7d: number;
  completionRate30d: number;
  completionRate90d: number;
  missedCount: number;
  skipReasons: Array<{ reason: string; count: number }>;
  lastCompletedAt?: string;
  currentStreak: number;
  bestStreak: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string) {
  const key = `${timezone}-en-US`;
  const cached = formatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  formatterCache.set(key, formatter);
  return formatter;
}

function parseTimeText(value: string): TimeParts | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function partsFromDate(date: Date, timezone: string) {
  const values = getFormatter(timezone).formatToParts(date);
  const byType = new Map(values.map((part) => [part.type, part.value]));
  const weekdayLabel = byType.get("weekday")?.toLowerCase() ?? "sun";
  const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  const weekday = weekdays.indexOf(weekdayLabel.slice(0, 3));

  return {
    year: Number(byType.get("year")),
    month: Number(byType.get("month")),
    day: Number(byType.get("day")),
    hour: Number(byType.get("hour")),
    minute: Number(byType.get("minute")),
    second: Number(byType.get("second")),
    weekday: weekday >= 0 ? weekday : 0,
  };
}

function zonedDateTimeToUtc(value: LocalDateTime, timezone: string) {
  let guess = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    0,
    0,
  );

  const target = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    0,
    0,
  );

  for (let index = 0; index < 4; index += 1) {
    const parts = partsFromDate(new Date(guess), timezone);
    const observed = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
      0,
    );
    const delta = target - observed;
    guess += delta;

    if (Math.abs(delta) < 1000) {
      break;
    }
  }

  return new Date(guess);
}

function normalizeLocalDate(value: LocalDate) {
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function toLocalDate(value: Date, timezone: string): LocalDate {
  const parts = partsFromDate(value, timezone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function compareLocalDate(left: LocalDate, right: LocalDate) {
  if (left.year !== right.year) return left.year - right.year;
  if (left.month !== right.month) return left.month - right.month;
  return left.day - right.day;
}

function addDays(localDate: LocalDate, days: number): LocalDate {
  const next = new Date(
    Date.UTC(localDate.year, localDate.month - 1, localDate.day),
  );
  next.setUTCDate(next.getUTCDate() + days);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function daysBetween(start: LocalDate, end: LocalDate) {
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endUtc - startUtc) / DAY_MS);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isLastWeekdayOfMonth(localDate: LocalDate, weekday: number) {
  const thisDate = new Date(
    Date.UTC(localDate.year, localDate.month - 1, localDate.day),
  );
  if (thisDate.getUTCDay() !== weekday) return false;

  const nextSameWeekday = new Date(thisDate);
  nextSameWeekday.setUTCDate(nextSameWeekday.getUTCDate() + 7);
  return nextSameWeekday.getUTCMonth() !== thisDate.getUTCMonth();
}

function weekOfMonth(localDate: LocalDate) {
  return Math.floor((localDate.day - 1) / 7) + 1;
}

function localWeekday(localDate: LocalDate) {
  const utc = Date.UTC(localDate.year, localDate.month - 1, localDate.day);
  return new Date(utc).getUTCDay();
}

function ruleTimes(rule: RecurringPlanScheduleRule) {
  const times = rule.times.filter((time) => parseTimeText(time));
  const deduped = new Set(times);
  return Array.from(deduped.values()).sort();
}

function matchesScheduleOnLocalDate(
  rule: RecurringPlanScheduleRule,
  localDate: LocalDate,
  startDate: LocalDate,
) {
  if (rule.type === "daily") return true;

  if (rule.type === "every-n-days") {
    const interval = Math.max(1, Math.floor(rule.interval));
    const deltaDays = daysBetween(startDate, localDate);
    return deltaDays >= 0 && deltaDays % interval === 0;
  }

  if (rule.type === "weekly") {
    return rule.daysOfWeek.includes(
      localWeekday(localDate) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    );
  }

  if (rule.dayOfMonth) {
    const maxDay = getDaysInMonth(localDate.year, localDate.month);
    const wantedDay = Math.min(Math.max(1, rule.dayOfMonth), maxDay);
    return localDate.day === wantedDay;
  }

  if (!rule.nthWeekday) return false;

  const weekday = localWeekday(localDate);
  if (weekday !== rule.nthWeekday.weekday) return false;

  if (rule.nthWeekday.weekOfMonth === -1) {
    return isLastWeekdayOfMonth(localDate, weekday);
  }

  return weekOfMonth(localDate) === rule.nthWeekday.weekOfMonth;
}

function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function normalizePlan(plan: RecurringPlan): RecurringPlan {
  const timezone = plan.timezone?.trim() || defaultTimezone();
  const times = ruleTimes(plan.scheduleRule);
  const scheduleRule: RecurringPlanScheduleRule = {
    ...plan.scheduleRule,
    times: times.length > 0 ? times : ["09:00"],
  } as RecurringPlanScheduleRule;

  return {
    ...plan,
    timezone,
    scheduleRule,
    gracePeriodMinutes:
      typeof plan.gracePeriodMinutes === "number"
        ? Math.max(0, Math.floor(plan.gracePeriodMinutes))
        : undefined,
    smartMatchMode: plan.smartMatchMode ?? "prompt",
    status: plan.status ?? "active",
  };
}

function occurrenceEffectiveDueAt(occurrence: RecurringOccurrence) {
  return occurrence.snoozedUntil ?? occurrence.dueAt;
}

export function findCurrentRecurringOccurrenceForPlan(
  workspace: WorkspaceSnapshot,
  planId: string,
  now = workspace.generatedAt,
): RecurringOccurrence | undefined {
  const scheduled = workspace.recurringOccurrences
    .filter(
      (occurrence) =>
        occurrence.planId === planId && occurrence.status === "scheduled",
    )
    .sort((left, right) =>
      occurrenceEffectiveDueAt(left).localeCompare(
        occurrenceEffectiveDueAt(right),
      ),
    );

  if (scheduled.length === 0) return undefined;

  const dueOrOverdue = scheduled.find(
    (occurrence) => occurrenceEffectiveDueAt(occurrence) <= now,
  );
  return dueOrOverdue ?? scheduled[0];
}

function resolveMissDeadline(
  plan: RecurringPlan,
  occurrence: RecurringOccurrence,
): Date {
  const reference = occurrenceEffectiveDueAt(occurrence);
  const dueAtDate = new Date(reference);

  if (typeof plan.gracePeriodMinutes === "number") {
    return new Date(
      dueAtDate.getTime() + Math.max(0, plan.gracePeriodMinutes) * 60 * 1000,
    );
  }

  const dueParts = partsFromDate(dueAtDate, plan.timezone);
  return zonedDateTimeToUtc(
    {
      year: dueParts.year,
      month: dueParts.month,
      day: dueParts.day,
      hour: 23,
      minute: 59,
    },
    plan.timezone,
  );
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSpaceIds(value: {
  spaceId?: string;
  spaceIds?: string[];
}): string[] {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function pickPrimarySpaceId(value: {
  spaceId?: string;
  spaceIds?: string[];
}): string {
  return normalizeSpaceIds(value)[0] ?? value.spaceId ?? "";
}

function hasSpaceIntersection(
  left: { spaceId?: string; spaceIds?: string[] },
  right: { spaceId?: string; spaceIds?: string[] },
) {
  const leftSpaces = normalizeSpaceIds(left);
  const rightSpaces = normalizeSpaceIds(right);
  if (leftSpaces.length === 0 || rightSpaces.length === 0) return false;
  const rightSet = new Set(rightSpaces);
  return leftSpaces.some((spaceId) => rightSet.has(spaceId));
}

function toLatencyMinutes(dueAt: string, actionAt: string) {
  const dueMs = Date.parse(dueAt);
  const actionMs = Date.parse(actionAt);
  if (Number.isNaN(dueMs) || Number.isNaN(actionMs)) return undefined;
  return Math.round((actionMs - dueMs) / (60 * 1000));
}

function appendRecurringHistory(
  occurrence: RecurringOccurrence,
  action: RecurringCompletionAction,
  actionSource: RecurringCompletionActionSource,
  actionAt: string,
  options?: {
    logId?: string;
    note?: string;
    latencyReferenceDueAt?: string;
  },
): RecurringCompletionHistoryEntry[] {
  const entry: RecurringCompletionHistoryEntry = {
    id: `recurring-history-${occurrence.id}-${Date.now()}-${action}`,
    action,
    actionSource,
    at: actionAt,
    logId: options?.logId,
    note: options?.note,
    completionLatencyMinutes: toLatencyMinutes(
      options?.latencyReferenceDueAt ?? occurrenceEffectiveDueAt(occurrence),
      actionAt,
    ),
  };

  return [entry, ...(occurrence.history ?? [])];
}

function hasTagOverlap(
  left: string[] | undefined,
  right: string[] | undefined,
) {
  if (!left?.length || !right?.length) return false;
  const leftSet = new Set(
    left.map((item) => normalizeText(item)).filter(Boolean),
  );
  return right.some((item) => leftSet.has(normalizeText(item)));
}

function toPendingStatus(status: RecurringOccurrenceStatus) {
  return status === "scheduled";
}

export function validateRecurringPlanDraft(
  draft: Omit<RecurringPlan, "createdAt" | "updatedAt">,
) {
  const errors: Record<string, string> = {};

  if (normalizeSpaceIds(draft).length === 0) {
    errors.spaceId = "Pick at least one space.";
  }

  if (!draft.title?.trim()) {
    errors.title = "Title is required.";
  }

  const times = draft.scheduleRule.times
    .map((time) => time.trim())
    .filter((time) => time.length > 0);

  if (times.length === 0) {
    errors.schedule = "At least one valid time is required.";
  }

  const invalidTime = times.find((time) => !parseTimeText(time));
  if (invalidTime) {
    errors.schedule = `Invalid time '${invalidTime}'. Use HH:mm.`;
  }

  if (new Set(times).size !== times.length) {
    errors.schedule = "Duplicate times are not allowed.";
  }

  if (
    draft.scheduleRule.type === "every-n-days" &&
    (!Number.isFinite(draft.scheduleRule.interval) ||
      draft.scheduleRule.interval <= 0)
  ) {
    errors.schedule = "Every-N-days interval must be greater than 0.";
  }

  if (
    draft.scheduleRule.type === "weekly" &&
    draft.scheduleRule.daysOfWeek.length === 0
  ) {
    errors.schedule = "Pick at least one weekday.";
  }

  if (
    draft.scheduleRule.type === "monthly" &&
    typeof draft.scheduleRule.dayOfMonth !== "number" &&
    !draft.scheduleRule.nthWeekday
  ) {
    errors.schedule =
      "Monthly schedule must use a day-of-month or an nth weekday rule.";
  }

  if (!draft.timezone?.trim()) {
    errors.timezone = "Timezone is required.";
  }

  if (draft.proofRequired && draft.smartMatchMode === "auto") {
    errors.smartMatchMode =
      "Auto-link can complete proof-required plans without review. Use prompt mode instead.";
  }

  return errors;
}

export function upsertRecurringPlan(
  workspace: WorkspaceSnapshot,
  draft: Omit<RecurringPlan, "createdAt" | "updatedAt">,
  now = workspace.generatedAt,
): WorkspaceSnapshot {
  const normalizedSpaceIds = normalizeSpaceIds(draft);
  const primarySpaceId = normalizedSpaceIds[0] ?? draft.spaceId;
  if (!primarySpaceId || normalizedSpaceIds.length === 0) {
    return workspace;
  }

  const normalized = normalizePlan({
    ...draft,
    spaceId: primarySpaceId,
    spaceIds: normalizedSpaceIds,
    createdAt: now,
    updatedAt: now,
  });

  const existingIndex = workspace.recurringPlans.findIndex(
    (item) => item.id === normalized.id,
  );

  if (existingIndex < 0) {
    return {
      ...workspace,
      generatedAt: now,
      recurringPlans: [
        { ...normalized, createdAt: now, updatedAt: now },
        ...workspace.recurringPlans,
      ],
    };
  }

  const filteredOccurrences = workspace.recurringOccurrences.filter(
    (occurrence) => {
      if (occurrence.planId !== normalized.id) return true;
      if (occurrence.status !== "scheduled") return true;

      const effectiveDueAt = occurrence.snoozedUntil ?? occurrence.dueAt;
      return effectiveDueAt.localeCompare(now) < 0;
    },
  );

  return {
    ...workspace,
    generatedAt: now,
    recurringOccurrences: filteredOccurrences,
    recurringPlans: workspace.recurringPlans.map((item) =>
      item.id === normalized.id
        ? {
            ...item,
            ...normalized,
            createdAt: item.createdAt,
            updatedAt: now,
          }
        : item,
    ),
  };
}

export function ensureRecurringOccurrencesWindow(
  workspace: WorkspaceSnapshot,
  options?: {
    now?: string;
    windowDays?: number;
  },
): WorkspaceSnapshot {
  const now = options?.now ?? workspace.generatedAt;
  const windowDays = Math.max(1, options?.windowDays ?? DEFAULT_WINDOW_DAYS);
  const nowDate = new Date(now);
  const windowStartDate = new Date(
    nowDate.getTime() - WINDOW_LOOKBACK_DAYS * DAY_MS,
  );
  const windowEndDate = new Date(nowDate.getTime() + windowDays * DAY_MS);

  const planById = new Map(
    workspace.recurringPlans.map(
      (plan) => [plan.id, normalizePlan(plan)] as const,
    ),
  );
  const existingByPlan = workspace.recurringOccurrences.reduce<
    Map<string, RecurringOccurrence[]>
  >((map, occurrence) => {
    map.set(occurrence.planId, [
      ...(map.get(occurrence.planId) ?? []),
      occurrence,
    ]);
    return map;
  }, new Map());

  const nextOccurrences = [...workspace.recurringOccurrences];

  for (const rawPlan of workspace.recurringPlans) {
    const plan = planById.get(rawPlan.id);
    if (!plan || plan.status !== "active") continue;

    const startDate = toLocalDate(new Date(plan.startDate), plan.timezone);
    const fromDate = toLocalDate(windowStartDate, plan.timezone);
    const throughDate = toLocalDate(windowEndDate, plan.timezone);
    const cursorStart =
      compareLocalDate(fromDate, startDate) < 0 ? startDate : fromDate;

    const existing = existingByPlan.get(plan.id) ?? [];
    const existingDueAt = new Set(existing.map((item) => item.dueAt));

    for (
      let cursor = cursorStart;
      compareLocalDate(cursor, throughDate) <= 0;
      cursor = addDays(cursor, 1)
    ) {
      if (!matchesScheduleOnLocalDate(plan.scheduleRule, cursor, startDate)) {
        continue;
      }

      for (const timeText of ruleTimes(plan.scheduleRule)) {
        const parsedTime = parseTimeText(timeText);
        if (!parsedTime) continue;

        const dueAt = zonedDateTimeToUtc(
          {
            ...cursor,
            hour: parsedTime.hour,
            minute: parsedTime.minute,
          },
          plan.timezone,
        );
        const dueAtIso = dueAt.toISOString();

        if (dueAtIso < plan.startDate) continue;
        if (dueAt < windowStartDate || dueAt > windowEndDate) continue;
        if (existingDueAt.has(dueAtIso)) continue;

        nextOccurrences.push({
          id: `rec-occ-${plan.id}-${normalizeLocalDate(cursor)}-${timeText.replace(":", "")}`,
          planId: plan.id,
          spaceId: pickPrimarySpaceId(plan),
          spaceIds: normalizeSpaceIds(plan),
          dueAt: dueAtIso,
          status: "scheduled",
          createdAt: now,
          updatedAt: now,
        });
        existingDueAt.add(dueAtIso);
      }
    }
  }

  const transitioned = nextOccurrences.map((occurrence) => {
    if (occurrence.status !== "scheduled") return occurrence;

    const plan = planById.get(occurrence.planId);
    if (!plan) return occurrence;

    const missedAt = resolveMissDeadline(plan, occurrence);
    if (missedAt.toISOString() > now) {
      return occurrence;
    }

    return {
      ...occurrence,
      status: "missed" as const,
      updatedAt: now,
    };
  });

  const sortedOccurrences = transitioned.sort((left, right) =>
    left.dueAt.localeCompare(right.dueAt),
  );

  const unchanged =
    sortedOccurrences.length === workspace.recurringOccurrences.length &&
    sortedOccurrences.every(
      (occurrence, index) =>
        occurrence === workspace.recurringOccurrences[index],
    );

  if (unchanged) {
    return workspace;
  }

  return {
    ...workspace,
    recurringOccurrences: sortedOccurrences,
  };
}

export function completeRecurringOccurrence(
  workspace: WorkspaceSnapshot,
  occurrenceId: string,
  options?: {
    actionAt?: string;
    logId?: string;
    actionSource?: RecurringCompletionActionSource;
    note?: string;
  },
): WorkspaceSnapshot {
  const actionAt = options?.actionAt ?? workspace.generatedAt;
  const occurrence = workspace.recurringOccurrences.find(
    (item) => item.id === occurrenceId,
  );
  if (!occurrence) return workspace;

  const plan = workspace.recurringPlans.find(
    (item) => item.id === occurrence.planId,
  );
  if (!plan) return workspace;

  if (plan.proofRequired && !options?.logId && !occurrence.logId) {
    return workspace;
  }

  return {
    ...workspace,
    generatedAt: actionAt,
    recurringOccurrences: workspace.recurringOccurrences.map((item) =>
      item.id === occurrenceId
        ? {
            ...item,
            status: "completed",
            completedAt: actionAt,
            logId: options?.logId ?? item.logId,
            snoozedUntil: undefined,
            history: appendRecurringHistory(
              item,
              "completed",
              options?.actionSource ?? "manual",
              actionAt,
              {
                logId: options?.logId ?? item.logId,
                note: options?.note,
              },
            ),
            updatedAt: actionAt,
          }
        : item,
    ),
  };
}

export function snoozeRecurringOccurrence(
  workspace: WorkspaceSnapshot,
  occurrenceId: string,
  snoozedUntil: string,
  actionAt = workspace.generatedAt,
  options?: {
    actionSource?: RecurringCompletionActionSource;
    note?: string;
  },
): WorkspaceSnapshot {
  const exists = workspace.recurringOccurrences.some(
    (item) => item.id === occurrenceId,
  );
  if (!exists) return workspace;

  return {
    ...workspace,
    generatedAt: actionAt,
    recurringOccurrences: workspace.recurringOccurrences.map((item) =>
      item.id === occurrenceId
        ? {
            ...item,
            snoozedUntil,
            history: appendRecurringHistory(
              item,
              "snoozed",
              options?.actionSource ?? "manual",
              actionAt,
              {
                note: options?.note,
              },
            ),
            updatedAt: actionAt,
          }
        : item,
    ),
  };
}

export function skipRecurringOccurrence(
  workspace: WorkspaceSnapshot,
  occurrenceId: string,
  reason = "Skipped from action center",
  actionAt = workspace.generatedAt,
  options?: {
    actionSource?: RecurringCompletionActionSource;
  },
): WorkspaceSnapshot {
  const exists = workspace.recurringOccurrences.some(
    (item) => item.id === occurrenceId,
  );
  if (!exists) return workspace;

  return {
    ...workspace,
    generatedAt: actionAt,
    recurringOccurrences: workspace.recurringOccurrences.map((item) =>
      item.id === occurrenceId
        ? {
            ...item,
            status: "skipped",
            skipReason: reason,
            snoozedUntil: undefined,
            history: appendRecurringHistory(
              item,
              "skipped",
              options?.actionSource ?? "manual",
              actionAt,
              {
                note: reason,
              },
            ),
            updatedAt: actionAt,
          }
        : item,
    ),
  };
}

export function bulkCompleteRecurringOccurrences(
  workspace: WorkspaceSnapshot,
  occurrenceIds: string[],
  actionAt = workspace.generatedAt,
): WorkspaceSnapshot {
  if (occurrenceIds.length === 0) return workspace;

  const wanted = new Set(occurrenceIds);
  const plansById = new Map(
    workspace.recurringPlans.map((plan) => [plan.id, plan] as const),
  );

  return {
    ...workspace,
    generatedAt: actionAt,
    recurringOccurrences: workspace.recurringOccurrences.map((item) => {
      if (!wanted.has(item.id)) return item;
      const plan = plansById.get(item.planId);
      if (plan?.proofRequired && !item.logId) {
        return item;
      }

      return {
        ...item,
        status: "completed",
        completedAt: actionAt,
        snoozedUntil: undefined,
        history: appendRecurringHistory(item, "completed", "bulk", actionAt, {
          logId: item.logId,
          note: "Completed in bulk",
        }),
        updatedAt: actionAt,
      };
    }),
  };
}

export function bulkSnoozeRecurringOccurrences(
  workspace: WorkspaceSnapshot,
  occurrenceIds: string[],
  snoozedUntil: string,
  actionAt = workspace.generatedAt,
): WorkspaceSnapshot {
  if (occurrenceIds.length === 0) return workspace;

  const wanted = new Set(occurrenceIds);

  return {
    ...workspace,
    generatedAt: actionAt,
    recurringOccurrences: workspace.recurringOccurrences.map((item) => {
      if (!wanted.has(item.id)) return item;
      if (item.status !== "scheduled") return item;

      return {
        ...item,
        snoozedUntil,
        history: appendRecurringHistory(item, "snoozed", "bulk", actionAt, {
          note: "Snoozed in bulk",
        }),
        updatedAt: actionAt,
      };
    }),
  };
}

export function resolveRecurringPromptMatchWithLog(
  workspace: WorkspaceSnapshot,
  occurrenceId: string,
  logId: string,
  actionAt = workspace.generatedAt,
): WorkspaceSnapshot {
  const occurrence = workspace.recurringOccurrences.find(
    (item) => item.id === occurrenceId,
  );
  if (!occurrence) return workspace;

  const plan = workspace.recurringPlans.find(
    (item) => item.id === occurrence.planId,
  );
  if (!plan) return workspace;

  const log = workspace.logs.find((item) => item.id === logId);
  if (!log) return workspace;

  const nextWorkspace = completeRecurringOccurrence(workspace, occurrenceId, {
    actionAt,
    logId,
    actionSource: "manual",
    note: "Resolved from smart-match prompt",
  });

  return {
    ...nextWorkspace,
    logs: nextWorkspace.logs.map((item) =>
      item.id === logId
        ? {
            ...item,
            recurringPlanId: plan.id,
            recurringOccurrenceId: occurrenceId,
          }
        : item,
    ),
  };
}

export function buildRecurringPlanAnalytics(
  workspace: WorkspaceSnapshot,
  planId: string,
  now = workspace.generatedAt,
): RecurringPlanAnalytics {
  const occurrences = workspace.recurringOccurrences
    .filter((item) => item.planId === planId)
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));

  const nowMs = Date.parse(now);

  function completionRate(windowDays: number) {
    const startMs = nowMs - windowDays * DAY_MS;
    const inWindow = occurrences.filter(
      (item) =>
        Date.parse(item.dueAt) >= startMs && Date.parse(item.dueAt) <= nowMs,
    );
    const completed = inWindow.filter(
      (item) => item.status === "completed",
    ).length;
    const missed = inWindow.filter((item) => item.status === "missed").length;
    const denominator = completed + missed;
    if (denominator === 0) return 0;
    return completed / denominator;
  }

  const missedCount = occurrences.filter(
    (item) => item.status === "missed",
  ).length;
  const skipReasonMap = occurrences.reduce<Map<string, number>>((map, item) => {
    if (item.status !== "skipped") return map;
    const key = item.skipReason?.trim() || "Skipped without a reason";
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());

  let currentStreak = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  for (const occurrence of occurrences) {
    if (occurrence.status === "completed") {
      runningStreak += 1;
      bestStreak = Math.max(bestStreak, runningStreak);
    } else if (
      occurrence.status === "missed" ||
      occurrence.status === "skipped"
    ) {
      runningStreak = 0;
    }
  }

  for (let index = occurrences.length - 1; index >= 0; index -= 1) {
    const item = occurrences[index];
    if (item.status === "completed") {
      currentStreak += 1;
      continue;
    }
    if (item.status === "missed" || item.status === "skipped") {
      break;
    }
  }

  const lastCompletedAt = [...occurrences]
    .reverse()
    .find((item) => item.status === "completed")?.completedAt;

  return {
    planId,
    completionRate7d: completionRate(7),
    completionRate30d: completionRate(30),
    completionRate90d: completionRate(90),
    missedCount,
    skipReasons: Array.from(skipReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count),
    lastCompletedAt,
    currentStreak,
    bestStreak,
  };
}

export function findRecurringLogMatchSuggestions(
  workspace: WorkspaceSnapshot,
  newLogs: LogEntry[],
): RecurringMatchSuggestion[] {
  const plansById = new Map(
    workspace.recurringPlans.map(
      (plan) => [plan.id, normalizePlan(plan)] as const,
    ),
  );
  const pendingOccurrences = workspace.recurringOccurrences.filter((item) =>
    toPendingStatus(item.status),
  );

  const suggestions: RecurringMatchSuggestion[] = [];

  for (const log of newLogs) {
    if (log.recurringOccurrenceId || log.recurringPlanId) continue;

    const logTitle = normalizeText(log.title);
    const logNote = normalizeText(log.note ?? "");

    const candidates = pendingOccurrences
      .map((occurrence) => {
        const plan = plansById.get(occurrence.planId);
        if (!plan || plan.status !== "active") return null;
        if (!hasSpaceIntersection(plan, log)) return null;

        const effectiveDue = new Date(occurrenceEffectiveDueAt(occurrence));
        const missDeadline = resolveMissDeadline(plan, occurrence);
        const logAt = new Date(log.occurredAt);

        if (logAt < effectiveDue) return null;
        if (logAt > missDeadline) return null;

        const planTitle = normalizeText(plan.title);
        const planCategory = normalizeText(plan.category ?? "");
        let score = 0;

        if (planTitle && logTitle === planTitle) score += 4;
        if (planTitle && logTitle.includes(planTitle)) score += 2;
        if (planTitle && planTitle.includes(logTitle) && logTitle) score += 1;
        if (
          planCategory &&
          (logTitle.includes(planCategory) || logNote.includes(planCategory))
        ) {
          score += 1;
        }
        if (hasTagOverlap(plan.tags, log.tags)) {
          score += 2;
        }

        return score > 0
          ? {
              occurrence,
              plan,
              score,
            }
          : null;
      })
      .filter(
        (
          item,
        ): item is {
          occurrence: RecurringOccurrence;
          plan: RecurringPlan;
          score: number;
        } => Boolean(item),
      )
      .sort((left, right) => right.score - left.score);

    const best = candidates[0];
    if (!best) continue;

    suggestions.push({
      occurrenceId: best.occurrence.id,
      planId: best.plan.id,
      logId: log.id,
      mode: best.plan.smartMatchMode ?? "prompt",
      score: best.score,
      title: best.plan.title,
    });
  }

  return suggestions;
}

export function applyRecurringLogAutoMatches(
  workspace: WorkspaceSnapshot,
  suggestions: RecurringMatchSuggestion[],
  now = workspace.generatedAt,
): WorkspaceSnapshot {
  const autoSuggestions = suggestions.filter((item) => item.mode === "auto");
  if (autoSuggestions.length === 0) return workspace;

  const byOccurrence = new Map(
    autoSuggestions.map((item) => [item.occurrenceId, item] as const),
  );
  const byLog = new Map(
    autoSuggestions.map((item) => [item.logId, item] as const),
  );

  return {
    ...workspace,
    generatedAt: now,
    recurringOccurrences: workspace.recurringOccurrences.map((occurrence) => {
      const match = byOccurrence.get(occurrence.id);
      if (!match) return occurrence;
      return {
        ...occurrence,
        status: "completed",
        completedAt: now,
        logId: match.logId,
        history: appendRecurringHistory(
          occurrence,
          "completed",
          "auto-match",
          now,
          {
            logId: match.logId,
            note: "Completed automatically from recurring smart match",
          },
        ),
        updatedAt: now,
      };
    }),
    logs: workspace.logs.map((log) => {
      const match = byLog.get(log.id);
      if (!match) return log;
      return {
        ...log,
        recurringPlanId: match.planId,
        recurringOccurrenceId: match.occurrenceId,
      };
    }),
  };
}

export function summarizeRecurringSmartMatches(
  workspace: WorkspaceSnapshot,
  newLogs: LogEntry[],
  now = workspace.generatedAt,
): {
  workspace: WorkspaceSnapshot;
  promptMatches: RecurringPromptMatchSuggestion[];
  autoMatchCount: number;
} {
  const suggestions = findRecurringLogMatchSuggestions(workspace, newLogs);
  const nextWorkspace = applyRecurringLogAutoMatches(
    workspace,
    suggestions,
    now,
  );
  return {
    workspace: nextWorkspace,
    promptMatches: suggestions.filter((item) => item.mode === "prompt"),
    autoMatchCount: suggestions.filter((item) => item.mode === "auto").length,
  };
}
