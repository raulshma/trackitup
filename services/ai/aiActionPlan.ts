import type {
    AiActionCenterExplainerActionKind,
    AiActionCenterExplainerDraft,
} from "@/services/ai/aiActionCenterExplainer";
import type {
    AiActionPlan,
    AiActionPlanExecutionState,
    AiActionPlanStep,
    AiTranscriptRecord,
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
  openPlanner: () => void;
  openReminderLogbook: (reminderId: string, spaceId: string) => void;
};

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
  return "review-later" as const;
}

function buildStepExecutionNote(action: AiActionCenterExplainerActionKind) {
  if (action === "complete-now") return "Reminder marked complete.";
  if (action === "snooze") return "Reminder snoozed.";
  if (action === "log-proof") return "Opened logbook proof capture.";
  if (action === "open-planner") return "Opened planner route.";
  return "Marked for later review.";
}

function defaultStepRiskLevel(action: AiActionCenterExplainerActionKind) {
  if (action === "review-later") return "safe" as const;
  if (action === "open-planner") return "safe" as const;
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
    const reminder = remindersById.get(action.reminderId);

    return {
      id: `ai-plan-step-${Date.now()}-${index}`,
      stepNumber: index + 1,
      title: action.title,
      reason: action.reason,
      actionClass: buildStepActionClass(action.action),
      riskLevel: defaultStepRiskLevel(action.action),
      approved: true,
      targetId: action.reminderId,
      targetLabel: reminder?.title ?? action.title,
      executionState: "pending",
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

function findReminderById(
  reminders: Reminder[],
  reminderId: string | undefined,
): Reminder | undefined {
  if (!reminderId) return undefined;
  return reminders.find((reminder) => reminder.id === reminderId);
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

    const reminder = findReminderById(workspace.reminders, step.targetId);

    try {
      if (step.actionClass === "complete-reminder") {
        if (!reminder) throw new Error("Reminder target no longer exists.");
        bindings.completeReminder(reminder.id);
      } else if (step.actionClass === "snooze-reminder") {
        if (!reminder) throw new Error("Reminder target no longer exists.");
        bindings.snoozeReminder(reminder.id);
      } else if (step.actionClass === "log-reminder-proof") {
        if (!reminder) throw new Error("Reminder target no longer exists.");
        bindings.openReminderLogbook(reminder.id, reminder.spaceId);
      } else if (step.actionClass === "navigate-planner") {
        bindings.openPlanner();
      }

      executedCount += 1;
      return updatePlanStep(step, {
        executionState: "completed",
        executionNote: buildStepExecutionNote(
          step.actionClass === "complete-reminder"
            ? "complete-now"
            : step.actionClass === "snooze-reminder"
              ? "snooze"
              : step.actionClass === "log-reminder-proof"
                ? "log-proof"
                : step.actionClass === "navigate-planner"
                  ? "open-planner"
                  : "review-later",
        ),
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
