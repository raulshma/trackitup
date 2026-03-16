import type { RecurringOccurrence, WorkspaceSnapshot } from "@/types/trackitup";

export type TodaysRoutineQueueItem = {
  occurrenceId: string;
  planId: string;
  title: string;
  proofRequired: boolean;
  dueAt: Date;
  spaceId: string;
  spaceIds: string[];
  lastCompletedAt?: Date;
};

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function findCompletionTimestamp(occurrence: RecurringOccurrence): number {
  if (occurrence.completedAt) {
    const completedAtMs = Date.parse(occurrence.completedAt);
    if (!Number.isNaN(completedAtMs)) return completedAtMs;
  }

  const completionEvent = (occurrence.history ?? []).find(
    (entry) => entry.action === "completed",
  );
  if (!completionEvent) return Number.NaN;

  const completionMs = Date.parse(completionEvent.at);
  return Number.isNaN(completionMs) ? Number.NaN : completionMs;
}

export function buildTodaysRoutineQueue(
  workspace: WorkspaceSnapshot,
  nowIso = workspace.generatedAt,
): TodaysRoutineQueueItem[] {
  const now = new Date(nowIso);
  const activePlansById = new Map(
    workspace.recurringPlans
      .filter((plan) => plan.status === "active")
      .map((plan) => [plan.id, plan] as const),
  );

  const lastCompletedByPlanId = new Map<string, number>();
  for (const occurrence of workspace.recurringOccurrences) {
    if (occurrence.status !== "completed") continue;
    const completionMs = findCompletionTimestamp(occurrence);
    if (Number.isNaN(completionMs)) continue;

    const previousCompletionMs = lastCompletedByPlanId.get(occurrence.planId);
    if (!previousCompletionMs || completionMs > previousCompletionMs) {
      lastCompletedByPlanId.set(occurrence.planId, completionMs);
    }
  }

  return workspace.recurringOccurrences
    .filter((occurrence) => occurrence.status === "scheduled")
    .flatMap((occurrence) => {
      const plan = activePlansById.get(occurrence.planId);
      if (!plan) return [];

      const effectiveDueAt = new Date(
        occurrence.snoozedUntil ?? occurrence.dueAt,
      );
      if (!isSameLocalDay(effectiveDueAt, now)) {
        return [];
      }

      const lastCompletedAtMs = lastCompletedByPlanId.get(plan.id);

      return [
        {
          occurrenceId: occurrence.id,
          planId: plan.id,
          title: plan.title,
          proofRequired: Boolean(plan.proofRequired),
          dueAt: effectiveDueAt,
          spaceId: plan.spaceId,
          spaceIds: normalizeSpaceIds(plan),
          lastCompletedAt:
            typeof lastCompletedAtMs === "number"
              ? new Date(lastCompletedAtMs)
              : undefined,
        } satisfies TodaysRoutineQueueItem,
      ];
    })
    .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());
}
