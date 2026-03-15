import type {
    AiActionCenterExplainerActionKind,
    AiActionCenterExplainerDraft,
    AiActionCenterExplainerDraftAction,
} from "@/services/ai/aiActionCenterExplainer";
import type {
    AiActionPlan,
    AiActionPlanExecutionState,
    AiActionPlanStep,
    AiTranscriptRecord,
    RecurringOccurrence,
    Reminder,
    WorkspaceSnapshot,
} from "@/types/trackitup";

type BuildAiActionPlanFromActionCenterDraftOptions = {
  draft: AiActionCenterExplainerDraft;
  request: string;
  consentLabel: string;
  modelId: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  workspace: WorkspaceSnapshot;
};

type ExecuteAiActionPlanBindings = {
  completeReminder: (reminderId: string) => void;
  snoozeReminder: (reminderId: string) => void;
  completeRecurringOccurrence: (occurrenceId: string) => void;
  openPlanner: () => void;
  createLog: (options: {
    title: string;
    reason: string;
    reminder?: Reminder;
    formValues?: AiActionCenterExplainerDraftAction["formValues"];
  }) => void;
  createRecurringPlan: (options: {
    title: string;
    reason: string;
    reminder?: Reminder;
    formValues?: AiActionCenterExplainerDraftAction["formValues"];
  }) => void;
  openReminderLogbook: (
    reminderId: string,
    spaceId: string,
    spaceIds?: string[],
  ) => void;
};

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

type ExecuteAiActionPlanResult = {
  updatedPlan: AiActionPlan;
  executedCount: number;
  skippedCount: number;
  failedCount: number;
};

function buildStepActionClass(action: AiActionCenterExplainerActionKind) {
  if (action === "complete-now") return "complete-reminder" as const;
  if (action === "snooze") return "snooze-reminder" as const;
  if (action === "log-proof") return "log-reminder-proof" as const;
  if (action === "open-planner") return "navigate-planner" as const;
  if (
    action === "create-log" ||
    action === "create-recurring-plan" ||
    action === "complete-recurring-now"
  ) {
    return "custom" as const;
  }
  return "review-later" as const;
}

function buildStepExecutionNote(action: AiActionCenterExplainerActionKind) {
  if (action === "complete-now") return "Reminder marked complete.";
  if (action === "snooze") return "Reminder snoozed.";
  if (action === "log-proof") return "Opened logbook proof capture.";
  if (action === "open-planner") return "Opened planner route.";
  if (action === "create-log") return "Opened quick log flow.";
  if (action === "create-recurring-plan") {
    return "Opened recurring plan creation flow.";
  }
  if (action === "complete-recurring-now") {
    return "Current recurring occurrence marked complete.";
  }
  return "Marked for later review.";
}

function defaultStepRiskLevel(action: AiActionCenterExplainerActionKind) {
  if (action === "review-later") return "safe" as const;
  if (action === "open-planner") return "safe" as const;
  if (action === "create-log") return "safe" as const;
  if (action === "create-recurring-plan") return "safe" as const;
  return "elevated" as const;
}

function updatePlanStep(
  step: AiActionPlanStep,
  updates: Partial<AiActionPlanStep>,
): AiActionPlanStep {
  return {
    ...step,
    ...updates,
    executionState:
      (updates.executionState as AiActionPlanExecutionState | undefined) ??
      step.executionState,
  };
}

function formatIntentSummary(
  request: string,
  draft: AiActionCenterExplainerDraft,
) {
  const headline = draft.headline.trim();
  const requestLabel = request.trim();
  const actionCount = draft.suggestedActions.length;
  const actionLabel =
    actionCount === 1
      ? "1 suggested action"
      : `${actionCount} suggested actions`;

  return [
    headline,
    requestLabel ? `Request: ${requestLabel}` : null,
    actionLabel,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" • ");
}

function findReminderById(
  reminders: Reminder[],
  reminderId: string | undefined,
): Reminder | undefined {
  if (!reminderId) return undefined;
  return reminders.find((reminder) => reminder.id === reminderId);
}

function findRecurringOccurrenceById(
  occurrences: RecurringOccurrence[],
  occurrenceId: string | undefined,
): RecurringOccurrence | undefined {
  if (!occurrenceId) return undefined;
  return occurrences.find((occurrence) => occurrence.id === occurrenceId);
}

function parseStepActionKind(
  step: AiActionPlanStep,
): AiActionCenterExplainerActionKind {
  const rawNote = step.executionNote ?? "";
  if (rawNote.startsWith("seed:")) {
    try {
      const parsed = JSON.parse(rawNote.slice("seed:".length));
      const kind = parsed?.kind;
      if (
        kind === "complete-now" ||
        kind === "log-proof" ||
        kind === "snooze" ||
        kind === "open-planner" ||
        kind === "create-log" ||
        kind === "create-recurring-plan" ||
        kind === "complete-recurring-now" ||
        kind === "review-later"
      ) {
        return kind;
      }
    } catch {
      // Fall through to legacy parsing.
    }
  }

  if (rawNote.startsWith("kind:")) {
    const kind = rawNote.slice("kind:".length);
    if (
      kind === "complete-now" ||
      kind === "log-proof" ||
      kind === "snooze" ||
      kind === "open-planner" ||
      kind === "create-log" ||
      kind === "create-recurring-plan" ||
      kind === "complete-recurring-now" ||
      kind === "review-later"
    ) {
      return kind;
    }
  }

  if (step.actionClass === "complete-reminder") return "complete-now";
  if (step.actionClass === "snooze-reminder") return "snooze";
  if (step.actionClass === "log-reminder-proof") return "log-proof";
  if (step.actionClass === "navigate-planner") return "open-planner";
  return "review-later";
}

function parseStepFormValues(
  step: AiActionPlanStep,
): AiActionCenterExplainerDraftAction["formValues"] | undefined {
  const rawNote = step.executionNote ?? "";
  if (!rawNote.startsWith("seed:")) return undefined;

  try {
    const parsed = JSON.parse(rawNote.slice("seed:".length));
    return parsed?.formValues;
  } catch {
    return undefined;
  }
}

export function buildAiActionPlanFromActionCenterDraft(
  options: BuildAiActionPlanFromActionCenterDraftOptions,
): AiActionPlan {
  const createdAt = new Date().toISOString();
  const remindersById = new Map(
    options.workspace.reminders.map(
      (reminder) => [reminder.id, reminder] as const,
    ),
  );

  const transcript: AiTranscriptRecord = {
    id: `ai-transcript-${Date.now()}`,
    surface: "action-center-explainer",
    transcript: options.request.trim(),
    interpretedIntentSummary: formatIntentSummary(
      options.request,
      options.draft,
    ),
    dataSentLabel: options.consentLabel,
    modelId: options.modelId,
    usage: options.usage,
    createdAt,
  };

  const steps = options.draft.suggestedActions.map((action, index) => {
    const reminder = action.reminderId
      ? remindersById.get(action.reminderId)
      : undefined;

    return {
      id: `ai-plan-step-${Date.now()}-${index}`,
      stepNumber: index + 1,
      title: action.title,
      reason: action.reason,
      actionClass: buildStepActionClass(action.action),
      riskLevel: defaultStepRiskLevel(action.action),
      approved: true,
      targetId: action.recurringOccurrenceId ?? action.reminderId,
      targetLabel: reminder?.title ?? action.title,
      executionState: "pending",
      executionNote: `seed:${JSON.stringify({
        kind: action.action,
        formValues: action.formValues,
      })}`,
    } satisfies AiActionPlanStep;
  });

  return {
    id: `ai-plan-${Date.now()}`,
    surface: "action-center-explainer",
    status: "pending-review",
    transcript,
    steps,
    createdAt,
  };
}

export function setAiActionPlanStepApproved(
  plan: AiActionPlan,
  stepId: string,
  approved: boolean,
): AiActionPlan {
  const nextSteps = plan.steps.map((step) =>
    step.id === stepId ? updatePlanStep(step, { approved }) : step,
  );

  return {
    ...plan,
    status: nextSteps.every((step) => step.approved)
      ? "approved"
      : nextSteps.some((step) => step.approved)
        ? "partially-approved"
        : "rejected",
    steps: nextSteps,
  };
}

export function executeAiActionPlan(
  plan: AiActionPlan,
  workspace: WorkspaceSnapshot,
  bindings: ExecuteAiActionPlanBindings,
): ExecuteAiActionPlanResult {
  const executionAt = new Date().toISOString();
  let executedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const nextSteps = plan.steps.map((step) => {
    if (!step.approved) {
      skippedCount += 1;
      return updatePlanStep(step, {
        executionState: "skipped",
        executionNote: "Skipped because approval was removed.",
      });
    }

    const action = parseStepActionKind(step);
    const formValues = parseStepFormValues(step);
    const reminder = findReminderById(workspace.reminders, step.targetId);
    const recurringOccurrence = findRecurringOccurrenceById(
      workspace.recurringOccurrences,
      step.targetId,
    );

    try {
      if (action === "complete-now") {
        if (!reminder) throw new Error("Reminder target no longer exists.");
        bindings.completeReminder(reminder.id);
      } else if (action === "snooze") {
        if (!reminder) throw new Error("Reminder target no longer exists.");
        bindings.snoozeReminder(reminder.id);
      } else if (action === "log-proof") {
        if (!reminder) throw new Error("Reminder target no longer exists.");
        const spaceIds = normalizeSpaceIds(reminder);
        bindings.openReminderLogbook(
          reminder.id,
          spaceIds[0] ?? reminder.spaceId,
          spaceIds,
        );
      } else if (action === "open-planner") {
        bindings.openPlanner();
      } else if (action === "create-log") {
        bindings.createLog({
          title: step.title,
          reason: step.reason,
          reminder,
          formValues,
        });
      } else if (action === "create-recurring-plan") {
        bindings.createRecurringPlan({
          title: step.title,
          reason: step.reason,
          reminder,
          formValues,
        });
      } else if (action === "complete-recurring-now") {
        if (!recurringOccurrence) {
          throw new Error("Recurring occurrence target no longer exists.");
        }
        bindings.completeRecurringOccurrence(recurringOccurrence.id);
      }

      executedCount += 1;
      return updatePlanStep(step, {
        executionState: "completed",
        executionNote: buildStepExecutionNote(action),
        executedAt: executionAt,
      });
    } catch (error) {
      failedCount += 1;
      return updatePlanStep(step, {
        executionState: "failed",
        executionNote:
          error instanceof Error
            ? error.message
            : "Could not execute this planned action.",
      });
    }
  });

  return {
    updatedPlan: {
      ...plan,
      status: "executed",
      steps: nextSteps,
      executedAt: executionAt,
    },
    executedCount,
    skippedCount,
    failedCount,
  };
}
