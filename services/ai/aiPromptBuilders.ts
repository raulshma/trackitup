import { getQuickActionFormTemplate } from "../../constants/TrackItUpFormTemplates.ts";
import type {
    FormFieldDefinition,
    QuickActionKind,
    TemplateCatalogItem,
    WorkspaceRecommendation,
    WorkspaceSnapshot,
} from "../../types/trackitup.ts";
import { buildWorkspaceDashboardPulse } from "../insights/workspaceDashboardPulse.ts";
import {
    getReminderDateKey,
    getReminderScheduleTimestamp,
} from "../insights/workspaceInsights.ts";
import { buildWorkspaceInventoryLifecycleSummary } from "../insights/workspaceInventoryLifecycle.ts";
import { buildWorkspacePlannerRiskSummary } from "../insights/workspacePlannerRisk.ts";
import { getWorkspaceRecommendations } from "../insights/workspaceRecommendations.ts";
import { buildWorkspaceTrackingQualitySummary } from "../insights/workspaceTrackingQuality.ts";
import { buildWorkspaceTrendSummary } from "../insights/workspaceTrendSummary.ts";
import {
    buildWorkspaceVisualHistory,
    type VisualHistoryScope,
} from "../insights/workspaceVisualHistory.ts";
import { buildReminderActionCenter } from "../reminders/reminderActionCenter.ts";
import { customSchemaFieldPresets } from "../templates/customSchema.ts";
import {
    aiActionCenterExplainerCopy,
    aiCrossSpaceTrendCopy,
    aiDashboardPulseCopy,
    aiInventoryLifecycleCopy,
    aiLogbookDraftCopy,
    aiPlannerCopilotCopy,
    aiPlannerRiskCopy,
    aiScannerAssistantCopy,
    aiSchemaBuilderCopy,
    aiTrackingQualityCopy,
    aiVisualRecapCopy,
    aiWorkspaceQaCopy,
} from "./aiConsentCopy.ts";
import { type AiCrossSpaceTrendSource } from "./aiCrossSpaceTrends.ts";
import { type AiDashboardPulseSource } from "./aiDashboardPulse.ts";
import { type AiInventoryLifecycleSource } from "./aiInventoryLifecycle.ts";
import { type AiPlannerRiskSource } from "./aiPlannerRisk.ts";
import { type AiTrackingQualitySource } from "./aiTrackingQuality.ts";
import {
    selectAiWorkspaceQaSources,
    type AiWorkspaceQaSource,
} from "./aiWorkspaceQa.ts";

const MAX_USER_TEXT_LENGTH = 600;
const MAX_NOTE_LENGTH = 220;
const MAX_SUMMARY_LENGTH = 140;
const MAX_SCHEMA_TEMPLATES = 5;
const MAX_SCHEMA_SPACES = 6;
const MAX_SCHEMA_METRICS = 8;
const MAX_LOGBOOK_RECENT_LOGS = 5;
const MAX_LOGBOOK_METRICS = 6;
const MAX_VISUAL_RECAP_HIGHLIGHTS = 6;
const MAX_PLANNER_DAY_REMINDERS = 6;
const MAX_PLANNER_RECOMMENDATIONS = 5;
const MAX_PLANNER_RECENT_ACTIVITY = 6;
const MAX_PLANNER_DAY_GROUPS = 5;
const MAX_ACTION_CENTER_NEXT_STEPS = 5;
const MAX_ACTION_CENTER_GROUPS = 4;
const MAX_ACTION_CENTER_RECENT_ACTIVITY = 6;
const MAX_ACTION_CENTER_RECOMMENDATIONS = 5;
const MAX_SCANNER_RECENT_LOGS = 4;
const MAX_WORKSPACE_QA_SOURCES = 6;
const MAX_DASHBOARD_PULSE_SOURCES = 8;
const MAX_INVENTORY_LIFECYCLE_SOURCES = 8;
const MAX_PLANNER_RISK_SOURCES = 8;
const MAX_TRACKING_QUALITY_SOURCES = 8;
const MAX_CROSS_SPACE_TREND_SPACES = 5;
const MAX_CROSS_SPACE_TREND_ANOMALIES = 6;

type AiPromptDraft<TContext> = {
  system: string;
  prompt: string;
  consentLabel: string;
  context: TContext;
};

export type SchemaBuilderPromptContext = {
  feature: "schema-builder";
  userGoal: string;
  quickActionKind: QuickActionKind;
  baseTemplate: {
    title: string;
    description: string;
    sections: {
      title: string;
      fieldCount: number;
      fields: Array<{
        label: string;
        type: string;
        required: boolean;
        source?: string;
      }>;
    }[];
  };
  presetFields: Array<{
    label: string;
    type: string;
    description?: string;
    source?: string;
  }>;
  recentTemplates: Array<{
    name: string;
    category: string;
    summary: string;
    supportedFieldTypes: string[];
  }>;
  workspaceSignals: {
    spaces: Array<{
      name: string;
      category: string;
      status: string;
      templateName?: string;
      summary: string;
    }>;
    metricDefinitions: Array<{
      name: string;
      valueType: string;
      unitLabel?: string;
      safeMin?: number;
      safeMax?: number;
      spaceName?: string;
    }>;
  };
};

export type LogbookPromptContext = {
  feature: "logbook-draft";
  userRequest: string;
  draftEntry: { title?: string; note?: string };
  targetSpace?: {
    name: string;
    category: string;
    status: string;
    summary: string;
  };
  selectedAssets: Array<{
    name: string;
    category: string;
    status: string;
    note: string;
  }>;
  relatedReminder?: {
    title: string;
    description: string;
    dueAt: string;
    status: string;
  };
  relatedRoutine?: { name: string; description: string; stepCount: number };
  relevantMetricDefinitions: Array<{
    name: string;
    valueType: string;
    unitLabel?: string;
    safeMin?: number;
    safeMax?: number;
  }>;
  recentLogs: Array<{
    occurredAt: string;
    kind: string;
    title: string;
    note: string;
    tags: string[];
    metricReadings: Array<{
      name: string;
      value: string | number | boolean;
      unitLabel?: string;
    }>;
  }>;
};

export type VisualRecapPromptContext = {
  feature: "visual-recap";
  request: string;
  scopeLabel: string;
  monthKey: string;
  scopeTotals: { photoCount: number; proofCount: number };
  recapTotals: { photoCount: number; proofCount: number };
  beforeAfter?: {
    beforeTitle: string;
    beforeDate: string;
    afterTitle: string;
    afterDate: string;
  };
  highlights: Array<{
    capturedAt: string;
    logTitle: string;
    logNote: string;
    spaceName: string;
    assetNames: string[];
    proofLabel?: string;
  }>;
};

export type PlannerCopilotPromptContext = {
  feature: "planner-copilot";
  userRequest: string;
  activeDateKey: string;
  selectedDayReminders: Array<{
    id: string;
    title: string;
    status: string;
    dueAt: string;
    spaceName?: string;
    description: string;
  }>;
  actionCenterSummary: {
    overdueCount: number;
    dueTodayCount: number;
    upcomingCount: number;
    recentActivity: Array<{
      reminderTitle: string;
      action: string;
      at: string;
      note: string;
    }>;
  };
  recommendations: Array<{
    title: string;
    severity: WorkspaceRecommendation["severity"];
    explanation: string;
    actionLabel: string;
    reminderId?: string;
  }>;
  upcomingAgenda: Array<{
    dateKey: string;
    reminderTitles: string[];
  }>;
};

export type PlannerRiskPromptContext = {
  feature: "planner-risk-brief";
  userRequest: string;
  activeDateKey: string;
  summary: {
    openReminderCount: number;
    selectedDayCount: number;
    overdueCount: number;
    deferralCount: number;
    hotspotCount: number;
  };
  highestRiskReminders: Array<{
    id: string;
    title: string;
    spaceName: string;
    status: string;
    dueAt: string;
    isSelectedDay: boolean;
    snoozeCount: number;
    skipCount: number;
    latestHistoryAction?: string;
    riskReasons: string[];
  }>;
  recentDeferrals: Array<{
    id: string;
    reminderTitle: string;
    spaceName: string;
    action: "snoozed" | "skipped";
    at: string;
    note: string;
  }>;
  spaceHotspots: Array<{
    id: string;
    name: string;
    overdueCount: number;
    dueTodayCount: number;
    deferredCount: number;
    nextDueAt?: string;
    reminderTitles: string[];
  }>;
  retrievedSources: AiPlannerRiskSource[];
  availableDestinations: Array<{
    id: "planner" | "action-center" | "logbook";
    label: string;
  }>;
};

export type ActionCenterExplainerPromptContext = {
  feature: "action-center-explainer";
  userRequest: string;
  summary: {
    overdueCount: number;
    dueTodayCount: number;
    upcomingCount: number;
    recurringOverdueCount: number;
    recurringDueTodayCount: number;
    recurringUpcomingCount: number;
    recentActivityCount: number;
    nextBestStepCount: number;
    recurringNextBestStepCount: number;
  };
  nextBestSteps: Array<{
    reminderId: string;
    reminderTitle: string;
    spaceName: string;
    status: string;
    dueAt: string;
    descriptionSnippet: string;
    isRecurringLike: boolean;
    scheduleHint?: string;
    latestHistoryAction?: string;
    latestHistoryAt?: string;
    recentDeferralCount: number;
    recentCompletionCount: number;
    proofAffinityHint?: string;
    priorityScore: number;
    suggestedAction: string;
    reason: string;
  }>;
  groupedBySpace: Array<{
    spaceName: string;
    reminderCount: number;
    overdueCount: number;
    dueTodayCount: number;
    nextDueAt?: string;
    reminderTitles: string[];
  }>;
  recurringNextBestSteps: Array<{
    occurrenceId: string;
    planId: string;
    title: string;
    dueAt: string;
    spaceName: string;
    suggestedAction: string;
    reason: string;
  }>;
  recentActivity: Array<{
    reminderTitle: string;
    action: string;
    at: string;
    note: string;
  }>;
  recommendations: Array<{
    title: string;
    severity: WorkspaceRecommendation["severity"];
    explanation: string;
    actionLabel: string;
    reminderId?: string;
  }>;
};

export type TrackingQualityPromptContext = {
  feature: "tracking-quality-brief";
  userRequest: string;
  summary: {
    recentLogCount: number;
    reminderGapCount: number;
    metricGapCount: number;
    sparseLogCount: number;
    spaceGapCount: number;
  };
  reminderGaps: Array<{
    id: string;
    title: string;
    spaceName: string;
    dueAt: string;
    status: string;
    recentLinkedLogCount: number;
    deferredCount: number;
    reasons: string[];
  }>;
  metricGaps: Array<{
    id: string;
    name: string;
    spaceName: string;
    lastRecordedAt?: string;
    openReminderCount: number;
    reasons: string[];
  }>;
  sparseLogs: Array<{
    id: string;
    title: string;
    spaceName: string;
    occurredAt: string;
    kind: string;
    signals: string[];
  }>;
  spaceGaps: Array<{
    id: string;
    name: string;
    overdueCount: number;
    openReminderCount: number;
    recentLogCount: number;
    recentProofCount: number;
    recentMetricCount: number;
    latestLogAt?: string;
    reasons: string[];
  }>;
  retrievedSources: AiTrackingQualitySource[];
  availableDestinations: Array<{
    id: "action-center" | "planner" | "logbook" | "workspace-tools";
    label: string;
  }>;
};

export type ScannerAssistantPromptContext = {
  feature: "scanner-assistant";
  userRequest: string;
  scan: {
    type: string;
    data: string;
    interpretation:
      | "asset-match"
      | "template-link"
      | "external-link"
      | "unmatched-code";
  };
  matchedAsset?: {
    name: string;
    category: string;
    status: string;
    note: string;
    spaceName?: string;
  };
  scannedTemplate?: {
    templateId?: string;
    name?: string;
    category?: string;
    origin?: string;
    importedVia: string;
    supportedFieldTypes: string[];
  };
  relatedSpace?: {
    name: string;
    category: string;
    status: string;
    summary: string;
  };
  recentLogs: Array<{
    occurredAt: string;
    kind: string;
    title: string;
    note: string;
    tags: string[];
  }>;
  availableDestinations: Array<{
    id: "inventory" | "logbook" | "template-import" | "workspace-tools";
    label: string;
  }>;
};

export type WorkspaceQaPromptContext = {
  feature: "workspace-q-and-a";
  question: string;
  workspaceOverview: {
    spaceCount: number;
    assetCount: number;
    openReminderCount: number;
    overdueCount: number;
    dueTodayCount: number;
    recommendationCount: number;
    logCount: number;
    templateCount: number;
  };
  retrievedSources: AiWorkspaceQaSource[];
  availableDestinations: Array<{
    id:
      | "action-center"
      | "planner"
      | "inventory"
      | "logbook"
      | "workspace-tools";
    label: string;
  }>;
};

export type DashboardPulsePromptContext = {
  feature: "dashboard-pulse";
  workspaceSummary: {
    spaceCount: number;
    assetCount: number;
    logCount: number;
    openReminderCount: number;
    recommendationCount: number;
    visibleWidgetCount: number;
    hiddenWidgetCount: number;
  };
  overviewStats: Array<{ label: string; value: string }>;
  recommendations: Array<{
    id: string;
    title: string;
    explanation: string;
    severity: string;
    actionLabel: string;
    spaceId?: string;
  }>;
  attentionItems: Array<{
    id: string;
    kind: string;
    title: string;
    detail: string;
    spaceId?: string;
  }>;
  activeSpaces: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    note: string;
    lastLog: string;
    pendingTasks: number;
    photoCount: number;
  }>;
  retrievedSources: AiDashboardPulseSource[];
  availableDestinations: Array<{
    id:
      | "action-center"
      | "planner"
      | "logbook"
      | "inventory"
      | "visual-history";
    label: string;
  }>;
};

export type InventoryLifecyclePromptContext = {
  feature: "inventory-lifecycle-brief";
  userRequest: string;
  summary: {
    assetCount: number;
    warrantyRiskCount: number;
    maintenanceCount: number;
    documentationGapCount: number;
    recommendationCount: number;
  };
  attentionAssets: Array<{
    id: string;
    name: string;
    spaceName: string;
    status: string;
    expenseTotal: number;
    purchasePrice?: number;
    warrantyExpiresAt?: string;
    relatedLogCount: number;
    recentLogCount: number;
    photoCount: number;
    proofCount: number;
    latestLogAt?: string;
    reasons: string[];
  }>;
  recommendations: Array<{
    id: string;
    title: string;
    explanation: string;
    severity: string;
    type: string;
    assetId?: string;
    spaceId?: string;
  }>;
  retrievedSources: AiInventoryLifecycleSource[];
  availableDestinations: Array<{
    id: "inventory" | "logbook" | "visual-history";
    label: string;
  }>;
};

export type CrossSpaceTrendPromptContext = {
  feature: "cross-space-trends";
  monthKey: string;
  previousMonthKey: string;
  workspaceTotals: {
    spaceCount: number;
    activeSpaceCount: number;
    currentPhotoCount: number;
    previousPhotoCount: number;
    currentProofCount: number;
    previousProofCount: number;
  };
  spaces: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    currentPhotoCount: number;
    previousPhotoCount: number;
    currentProofCount: number;
    previousProofCount: number;
    photoDelta: number;
    proofDelta: number;
    overdueReminderCount: number;
    dueSoonReminderCount: number;
    metricAlerts: Array<{
      metricName: string;
      value: number;
      unitLabel?: string;
      safeMin?: number;
      safeMax?: number;
      occurredAt: string;
    }>;
    latestLogTitle?: string;
    latestLogAt?: string;
  }>;
  anomalies: Array<{
    id: string;
    kind: string;
    title: string;
    explanation: string;
    spaceName: string;
    route: string;
  }>;
  retrievedSources: AiCrossSpaceTrendSource[];
  availableDestinations: Array<{
    id: "visual-history" | "planner" | "inventory" | "workspace-tools";
    label: string;
  }>;
};

function compactText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function flattenFields(fields: FormFieldDefinition[]): FormFieldDefinition[] {
  return fields.flatMap((field) => [
    field,
    ...(field.children ? flattenFields(field.children) : []),
  ]);
}

function summarizeTemplateFields(
  template: TemplateCatalogItem["formTemplate"],
) {
  if (!template) return [];

  return template.sections.map((section) => ({
    title: section.title,
    fieldCount: flattenFields(section.fields).length,
    fields: flattenFields(section.fields)
      .slice(0, 6)
      .map((field) => ({
        label: field.label,
        type: field.type,
        required: Boolean(field.required),
        source: field.source,
      })),
  }));
}

function summarizeRecentTemplates(templates: TemplateCatalogItem[]) {
  return templates.slice(0, MAX_SCHEMA_TEMPLATES).map((template) => ({
    name: template.name,
    category: template.category,
    summary: compactText(template.summary, MAX_SUMMARY_LENGTH),
    supportedFieldTypes: template.supportedFieldTypes.slice(0, 8),
  }));
}

function stringifyContext(context: unknown) {
  return JSON.stringify(context, null, 2);
}

function buildPromptBody(instructions: string[], context: unknown) {
  return `${instructions.join("\n\n")}\n\nContext:\n${stringifyContext(context)}`;
}

export function buildWorkspaceQaPrompt(options: {
  workspace: WorkspaceSnapshot;
  question: string;
}): AiPromptDraft<WorkspaceQaPromptContext> {
  const actionCenter = buildReminderActionCenter(options.workspace);
  const retrievedSources = selectAiWorkspaceQaSources(
    options.workspace,
    options.question,
    MAX_WORKSPACE_QA_SOURCES,
  );
  const context: WorkspaceQaPromptContext = {
    feature: "workspace-q-and-a",
    question: compactText(options.question, MAX_USER_TEXT_LENGTH),
    workspaceOverview: {
      spaceCount: options.workspace.spaces.length,
      assetCount: options.workspace.assets.length,
      openReminderCount: options.workspace.reminders.length,
      overdueCount: actionCenter.summary.overdueCount,
      dueTodayCount: actionCenter.summary.dueTodayCount,
      recommendationCount: getWorkspaceRecommendations(options.workspace)
        .length,
      logCount: options.workspace.logs.length,
      templateCount: options.workspace.templates.length,
    },
    retrievedSources,
    availableDestinations: [
      { id: "action-center", label: "Open action center" },
      { id: "planner", label: "Open planner" },
      { id: "inventory", label: "Open inventory" },
      { id: "logbook", label: "Open logbook" },
      { id: "workspace-tools", label: "Open workspace tools" },
    ],
  };

  return {
    system:
      "You are a TrackItUp workspace Q&A assistant. Answer only from the provided workspace overview and retrieved sources. If the sources are insufficient, say so plainly instead of guessing.",
    consentLabel: aiWorkspaceQaCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User question: ${context.question}`,
        "Answer the question using only the provided TrackItUp sources, cite the supporting sourceIds, and suggest the best follow-up destination only when it clearly helps.",
        "Do not invent reminder outcomes, maintenance history, template contents, or inventory details that are not present in the retrieved context.",
      ],
      context,
    ),
    context,
  };
}

export function buildDashboardPulsePrompt(options: {
  workspace: WorkspaceSnapshot;
  userRequest: string;
}): AiPromptDraft<DashboardPulsePromptContext> {
  const pulse = buildWorkspaceDashboardPulse(options.workspace);
  const retrievedSources: AiDashboardPulseSource[] = [
    ...pulse.recommendations.slice(0, 3).map((recommendation) => ({
      id: `recommendation:${recommendation.id}`,
      title: recommendation.title,
      kind: "recommendation" as const,
      snippet: compactText(recommendation.explanation, 160),
      route: recommendation.route,
      spaceId: recommendation.spaceId,
    })),
    ...pulse.attentionItems.slice(0, 3).map((item) => ({
      id: `attention:${item.id}`,
      title: item.title,
      kind: "attention" as const,
      snippet: compactText(item.detail, 160),
      route: item.route,
      spaceId: item.spaceId,
    })),
    ...pulse.activeSpaces.slice(0, 2).map((space) => ({
      id: `space:${space.id}`,
      title: space.name,
      kind: "space" as const,
      snippet: compactText(
        `${space.pendingTasks} pending task(s), ${space.photoCount} photo(s), last log ${space.lastLog}.`,
        160,
      ),
      route: "visual-history" as const,
      spaceId: space.id,
    })),
  ].slice(0, MAX_DASHBOARD_PULSE_SOURCES);

  const context: DashboardPulsePromptContext = {
    feature: "dashboard-pulse",
    workspaceSummary: pulse.summary,
    overviewStats: pulse.overviewStats,
    recommendations: pulse.recommendations.map((recommendation) => ({
      id: recommendation.id,
      title: recommendation.title,
      explanation: recommendation.explanation,
      severity: recommendation.severity,
      actionLabel: recommendation.actionLabel,
      spaceId: recommendation.spaceId,
    })),
    attentionItems: pulse.attentionItems.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      spaceId: item.spaceId,
    })),
    activeSpaces: pulse.activeSpaces.map((space) => ({
      id: space.id,
      name: space.name,
      category: space.category,
      status: space.status,
      note: space.note,
      lastLog: space.lastLog,
      pendingTasks: space.pendingTasks,
      photoCount: space.photoCount,
    })),
    retrievedSources,
    availableDestinations: [
      { id: "action-center", label: "Open action center" },
      { id: "planner", label: "Open planner" },
      { id: "logbook", label: "Open logbook" },
      { id: "inventory", label: "Open inventory" },
      { id: "visual-history", label: "Open visual history" },
    ],
  };

  return {
    system:
      "You are a TrackItUp dashboard pulse assistant. Summarize the workspace status only from the compact dashboard overview and cited sources. If the dashboard evidence is thin, say so plainly instead of guessing.",
    consentLabel: aiDashboardPulseCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User request: ${compactText(options.userRequest, MAX_USER_TEXT_LENGTH)}`,
        "Summarize the most important dashboard takeaways, what needs attention first, and which TrackItUp destination is the best follow-up based only on the provided overview and sources.",
        "Keep the response grounded in recommendation items, attention items, and active spaces that are explicitly listed in the context, and cite the supporting sourceIds.",
      ],
      context,
    ),
    context,
  };
}

export function buildInventoryLifecyclePrompt(options: {
  workspace: WorkspaceSnapshot;
  userRequest: string;
}): AiPromptDraft<InventoryLifecyclePromptContext> {
  const lifecycle = buildWorkspaceInventoryLifecycleSummary(options.workspace);
  const retrievedSources: AiInventoryLifecycleSource[] = [
    ...lifecycle.attentionAssets.slice(0, 5).map((asset) => ({
      id: `asset:${asset.id}`,
      title: asset.name,
      kind: "asset" as const,
      snippet: compactText(asset.reasons.join(" "), 170),
      route: asset.route,
      assetId: asset.id,
      spaceId: asset.spaceId,
    })),
    ...lifecycle.recommendations.slice(0, 3).map((recommendation) => ({
      id: `recommendation:${recommendation.id}`,
      title: recommendation.title,
      kind: "recommendation" as const,
      snippet: compactText(recommendation.explanation, 170),
      route: recommendation.route,
      assetId: recommendation.assetId,
      spaceId: recommendation.spaceId,
    })),
  ].slice(0, MAX_INVENTORY_LIFECYCLE_SOURCES);

  const context: InventoryLifecyclePromptContext = {
    feature: "inventory-lifecycle-brief",
    userRequest: compactText(options.userRequest, MAX_USER_TEXT_LENGTH),
    summary: lifecycle.summary,
    attentionAssets: lifecycle.attentionAssets.map((asset) => ({
      id: asset.id,
      name: compactText(asset.name, 90),
      spaceName: compactText(asset.spaceName, 60),
      status: asset.status,
      expenseTotal: asset.expenseTotal,
      purchasePrice: asset.purchasePrice,
      warrantyExpiresAt: asset.warrantyExpiresAt,
      relatedLogCount: asset.relatedLogCount,
      recentLogCount: asset.recentLogCount,
      photoCount: asset.photoCount,
      proofCount: asset.proofCount,
      latestLogAt: asset.latestLogAt,
      reasons: asset.reasons.map((reason) => compactText(reason, 110)),
    })),
    recommendations: lifecycle.recommendations.map((recommendation) => ({
      id: recommendation.id,
      title: compactText(recommendation.title, 100),
      explanation: compactText(recommendation.explanation, 150),
      severity: recommendation.severity,
      type: recommendation.type,
      assetId: recommendation.assetId,
      spaceId: recommendation.spaceId,
    })),
    retrievedSources,
    availableDestinations: [
      { id: "inventory", label: "Stay in inventory" },
      { id: "logbook", label: "Open logbook" },
      { id: "visual-history", label: "Open visual history" },
    ],
  };

  return {
    system:
      "You are a TrackItUp inventory lifecycle analyst. Explain which assets need review next using only the provided asset status, ownership cost, warranty timing, linked logs, photo proof coverage, and cited recommendations. If the inventory signal is thin, say so plainly instead of guessing.",
    consentLabel: aiInventoryLifecycleCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User request: ${context.userRequest}`,
        "Summarize the most important inventory lifecycle takeaways, which assets need review next, and which TrackItUp destination should be opened based only on the provided asset and recommendation context.",
        "Keep the response grounded in the listed assets and recommendations only, and cite the supporting sourceIds.",
      ],
      context,
    ),
    context,
  };
}

export function buildCrossSpaceTrendPrompt(options: {
  workspace: WorkspaceSnapshot;
  monthKey: string;
  userRequest: string;
}): AiPromptDraft<CrossSpaceTrendPromptContext> {
  const trendSummary = buildWorkspaceTrendSummary(
    options.workspace,
    options.monthKey,
  );
  const spacesById = new Map(
    options.workspace.spaces.map((space) => [space.id, space] as const),
  );
  const retrievedSources: AiCrossSpaceTrendSource[] = [
    ...trendSummary.spaces
      .slice(0, MAX_CROSS_SPACE_TREND_SPACES)
      .map((space) => ({
        id: `space:${space.id}`,
        title: space.name,
        kind: "space" as const,
        snippet: compactText(
          `${space.currentPhotoCount} photos in ${trendSummary.monthKey} vs ${space.previousPhotoCount} in ${trendSummary.previousMonthKey}; ${space.overdueReminderCount} overdue reminder(s); ${space.metricAlerts.length} metric alert(s).`,
          160,
        ),
        route:
          space.overdueReminderCount > 0 || space.metricAlerts.length > 0
            ? ("planner" as const)
            : ("visual-history" as const),
        spaceId: space.id,
      })),
    ...trendSummary.anomalies
      .slice(0, MAX_CROSS_SPACE_TREND_ANOMALIES)
      .map((anomaly) => ({
        id: `anomaly:${anomaly.id}`,
        title: anomaly.title,
        kind: "anomaly" as const,
        snippet: compactText(anomaly.explanation, 170),
        route:
          anomaly.route === "inventory"
            ? ("inventory" as const)
            : anomaly.route === "planner"
              ? ("planner" as const)
              : ("visual-history" as const),
        spaceId: anomaly.spaceId,
      })),
  ];
  const context: CrossSpaceTrendPromptContext = {
    feature: "cross-space-trends",
    monthKey: trendSummary.monthKey,
    previousMonthKey: trendSummary.previousMonthKey,
    workspaceTotals: {
      spaceCount: trendSummary.totals.spaceCount,
      activeSpaceCount: trendSummary.totals.activeSpaceCount,
      currentPhotoCount: trendSummary.totals.currentPhotoCount,
      previousPhotoCount: trendSummary.totals.previousPhotoCount,
      currentProofCount: trendSummary.totals.currentProofCount,
      previousProofCount: trendSummary.totals.previousProofCount,
    },
    spaces: trendSummary.spaces
      .slice(0, MAX_CROSS_SPACE_TREND_SPACES)
      .map((space) => ({
        id: space.id,
        name: space.name,
        category: space.category,
        status: space.status,
        currentPhotoCount: space.currentPhotoCount,
        previousPhotoCount: space.previousPhotoCount,
        currentProofCount: space.currentProofCount,
        previousProofCount: space.previousProofCount,
        photoDelta: space.photoDelta,
        proofDelta: space.proofDelta,
        overdueReminderCount: space.overdueReminderCount,
        dueSoonReminderCount: space.dueSoonReminderCount,
        metricAlerts: space.metricAlerts.map((alert) => ({
          metricName: alert.metricName,
          value: alert.value,
          unitLabel: alert.unitLabel,
          safeMin: alert.safeMin,
          safeMax: alert.safeMax,
          occurredAt: alert.occurredAt,
        })),
        latestLogTitle: space.latestLogTitle,
        latestLogAt: space.latestLogAt,
      })),
    anomalies: trendSummary.anomalies
      .slice(0, MAX_CROSS_SPACE_TREND_ANOMALIES)
      .map((anomaly) => ({
        id: anomaly.id,
        kind: anomaly.kind,
        title: anomaly.title,
        explanation: anomaly.explanation,
        spaceName: spacesById.get(anomaly.spaceId)?.name ?? "Unknown space",
        route: anomaly.route,
      })),
    retrievedSources,
    availableDestinations: [
      { id: "visual-history", label: "Open visual history" },
      { id: "planner", label: "Open planner" },
      { id: "inventory", label: "Open inventory" },
      { id: "workspace-tools", label: "Open workspace tools" },
    ],
  };

  return {
    system:
      "You are a TrackItUp cross-space trend analyst. Summarize changes and anomalies only from the provided month-over-month workspace context and cited sources. If the data is thin, say so plainly instead of guessing causes.",
    consentLabel: aiCrossSpaceTrendCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User request: ${compactText(options.userRequest, MAX_USER_TEXT_LENGTH)}`,
        `Compare ${context.monthKey} against ${context.previousMonthKey} and explain the strongest cross-space changes or anomalies using only the provided sources.`,
        "Highlight trend shifts, unusual spikes/drops, metric alerts, or overdue follow-up when supported by the retrieved context, and cite the supporting sourceIds.",
      ],
      context,
    ),
    context,
  };
}

export function buildScannerAssistantPrompt(options: {
  workspace: WorkspaceSnapshot;
  userRequest: string;
  scan: { type: string; data: string };
  matchedAsset?: WorkspaceSnapshot["assets"][number];
  scannedTemplate?: {
    templateId?: string;
    name?: string;
    category?: string;
    origin?: string;
    importedVia: string;
    supportedFieldTypes: string[];
  } | null;
}): AiPromptDraft<ScannerAssistantPromptContext> {
  const relatedSpace = options.matchedAsset
    ? options.workspace.spaces.find(
        (space) => space.id === options.matchedAsset?.spaceId,
      )
    : undefined;
  const recentLogs = options.matchedAsset
    ? options.workspace.logs.filter((log) =>
        log.assetIds?.includes(options.matchedAsset?.id ?? ""),
      )
    : relatedSpace
      ? options.workspace.logs.filter((log) => log.spaceId === relatedSpace.id)
      : [];
  const interpretation = options.matchedAsset
    ? "asset-match"
    : options.scannedTemplate
      ? "template-link"
      : /^(https?:\/\/|trackitup:\/\/)/i.test(options.scan.data)
        ? "external-link"
        : "unmatched-code";
  const context: ScannerAssistantPromptContext = {
    feature: "scanner-assistant",
    userRequest: compactText(options.userRequest, MAX_USER_TEXT_LENGTH),
    scan: {
      type: compactText(options.scan.type, 40),
      data: compactText(options.scan.data, 180),
      interpretation,
    },
    matchedAsset: options.matchedAsset
      ? {
          name: options.matchedAsset.name,
          category: options.matchedAsset.category,
          status: options.matchedAsset.status,
          note: compactText(options.matchedAsset.note, 120),
          spaceName: relatedSpace?.name,
        }
      : undefined,
    scannedTemplate: options.scannedTemplate
      ? {
          templateId: options.scannedTemplate.templateId,
          name: options.scannedTemplate.name,
          category: options.scannedTemplate.category,
          origin: options.scannedTemplate.origin,
          importedVia: options.scannedTemplate.importedVia,
          supportedFieldTypes:
            options.scannedTemplate.supportedFieldTypes.slice(0, 8),
        }
      : undefined,
    relatedSpace: relatedSpace
      ? {
          name: relatedSpace.name,
          category: relatedSpace.category,
          status: relatedSpace.status,
          summary: compactText(relatedSpace.summary, MAX_SUMMARY_LENGTH),
        }
      : undefined,
    recentLogs: summarizeRecentLogs(recentLogs, options.workspace)
      .slice(0, MAX_SCANNER_RECENT_LOGS)
      .map(({ occurredAt, kind, title, note, tags }) => ({
        occurredAt,
        kind,
        title,
        note,
        tags,
      })),
    availableDestinations: [
      { id: "inventory", label: "Open inventory" },
      { id: "logbook", label: "Start quick log" },
      { id: "template-import", label: "Review template import" },
      { id: "workspace-tools", label: "Open workspace tools" },
    ],
  };

  return {
    system:
      "You are a TrackItUp scanner assistant. Recommend the safest next step from the scanned code and compact workspace context only. Treat every suggestion as review-only and never assume facts that are not present in the scan metadata.",
    consentLabel: aiScannerAssistantCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User request: ${context.userRequest}`,
        `Scan interpretation: ${context.scan.interpretation}`,
        "Choose the most appropriate next destination from the provided TrackItUp destinations and optionally draft a short log outline if a manual logbook follow-up would help.",
        "Do not invent product names, maintenance events, attachments, or template contents from a bare barcode or URL.",
      ],
      context,
    ),
    context,
  };
}

export function buildSchemaBuilderPrompt(options: {
  workspace: WorkspaceSnapshot;
  userGoal: string;
  quickActionKind: QuickActionKind;
}): AiPromptDraft<SchemaBuilderPromptContext> {
  const baseTemplate = getQuickActionFormTemplate(options.quickActionKind);
  const context: SchemaBuilderPromptContext = {
    feature: "schema-builder",
    userGoal: compactText(options.userGoal, MAX_USER_TEXT_LENGTH),
    quickActionKind: options.quickActionKind,
    baseTemplate: {
      title: baseTemplate.title,
      description: compactText(baseTemplate.description, MAX_SUMMARY_LENGTH),
      sections: summarizeTemplateFields(baseTemplate),
    },
    presetFields: customSchemaFieldPresets.map((preset) => ({
      label: preset.label,
      type: preset.draft.type,
      description: compactText(preset.draft.description, 100) || undefined,
      source: preset.draft.source,
    })),
    recentTemplates: summarizeRecentTemplates(options.workspace.templates),
    workspaceSignals: {
      spaces: options.workspace.spaces
        .slice(0, MAX_SCHEMA_SPACES)
        .map((space) => ({
          name: space.name,
          category: space.category,
          status: space.status,
          templateName: space.templateName,
          summary: compactText(space.summary, MAX_SUMMARY_LENGTH),
        })),
      metricDefinitions: options.workspace.metricDefinitions
        .slice(0, MAX_SCHEMA_METRICS)
        .map((metric) => ({
          name: metric.name,
          valueType: metric.valueType,
          unitLabel: metric.unitLabel,
          safeMin: metric.safeMin,
          safeMax: metric.safeMax,
          spaceName: options.workspace.spaces.find(
            (space) => space.id === metric.spaceId,
          )?.name,
        })),
    },
  };

  return {
    system:
      "You are drafting a TrackItUp schema suggestion. Propose a reviewable local template draft that fits the app's existing form field types and never assumes access to data outside the provided context.",
    consentLabel: aiSchemaBuilderCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User goal: ${context.userGoal}`,
        `Base schema family: ${context.quickActionKind}`,
        "Return a draft plan with a name, summary, category, and suggested extra fields. Prefer fields that map cleanly to TrackItUp's existing form field types.",
        "Treat the result as a draft for user review. Do not assume photos, location, reminders, or automation are needed unless the goal explicitly asks for them.",
      ],
      context,
    ),
    context,
  };
}

function summarizeRecentLogs(
  logs: WorkspaceSnapshot["logs"],
  workspace: WorkspaceSnapshot,
) {
  const metricDefinitionsById = new Map(
    workspace.metricDefinitions.map((metric) => [metric.id, metric] as const),
  );

  return [...logs]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, MAX_LOGBOOK_RECENT_LOGS)
    .map((log) => ({
      occurredAt: log.occurredAt,
      kind: log.kind,
      title: compactText(log.title, 90),
      note: compactText(log.note, MAX_NOTE_LENGTH),
      tags: (log.tags ?? []).slice(0, 5),
      metricReadings: (log.metricReadings ?? []).slice(0, 4).map((reading) => ({
        name:
          metricDefinitionsById.get(reading.metricId)?.name ?? reading.metricId,
        value: reading.value,
        unitLabel: reading.unitLabel,
      })),
    }));
}

function summarizePlannerRecommendations(
  recommendations: WorkspaceRecommendation[],
) {
  return recommendations.slice(0, MAX_PLANNER_RECOMMENDATIONS).map((item) => ({
    title: compactText(item.title, 90),
    severity: item.severity,
    explanation: compactText(item.explanation, MAX_NOTE_LENGTH),
    actionLabel: item.action.label,
    reminderId: item.reminderId,
  }));
}

function summarizeActionCenterRecommendations(
  recommendations: WorkspaceRecommendation[],
) {
  return recommendations
    .slice(0, MAX_ACTION_CENTER_RECOMMENDATIONS)
    .map((item) => ({
      title: compactText(item.title, 90),
      severity: item.severity,
      explanation: compactText(item.explanation, MAX_NOTE_LENGTH),
      actionLabel: item.action.label,
      reminderId: item.reminderId,
    }));
}

function summarizePlannerAgenda(workspace: WorkspaceSnapshot) {
  const grouped = new Map<string, string[]>();
  [...workspace.reminders]
    .sort((left, right) =>
      getReminderScheduleTimestamp(left).localeCompare(
        getReminderScheduleTimestamp(right),
      ),
    )
    .forEach((reminder) => {
      const dateKey = getReminderDateKey(reminder);
      grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), reminder.title]);
    });

  return Array.from(grouped.entries())
    .slice(0, MAX_PLANNER_DAY_GROUPS)
    .map(([dateKey, reminderTitles]) => ({
      dateKey,
      reminderTitles: reminderTitles.slice(0, 4),
    }));
}

export function buildLogbookDraftPrompt(options: {
  workspace: WorkspaceSnapshot;
  userRequest: string;
  draftTitle?: string;
  draftNote?: string;
  spaceId?: string;
  assetIds?: string[];
  reminderId?: string;
  routineId?: string;
}): AiPromptDraft<LogbookPromptContext> {
  const assets = options.workspace.assets.filter((asset) =>
    options.assetIds?.includes(asset.id),
  );
  const targetSpaceId =
    options.spaceId ??
    assets[0]?.spaceId ??
    options.workspace.reminders.find((item) => item.id === options.reminderId)
      ?.spaceId ??
    options.workspace.routines.find((item) => item.id === options.routineId)
      ?.spaceId;
  const targetSpace = options.workspace.spaces.find(
    (space) => space.id === targetSpaceId,
  );
  const recentLogs = options.workspace.logs.filter((log) => {
    if (targetSpaceId && log.spaceId !== targetSpaceId) return false;
    if (options.assetIds?.length) {
      return options.assetIds.some((assetId) =>
        log.assetIds?.includes(assetId),
      );
    }
    return Boolean(targetSpaceId);
  });
  const relatedReminder = options.workspace.reminders.find(
    (reminder) => reminder.id === options.reminderId,
  );
  const relatedRoutine = options.workspace.routines.find(
    (routine) => routine.id === options.routineId,
  );
  const relevantMetricDefinitions = options.workspace.metricDefinitions
    .filter((metric) => {
      if (targetSpaceId && metric.spaceId !== targetSpaceId) return false;
      if (!options.assetIds?.length) return true;
      return !metric.assetId || options.assetIds.includes(metric.assetId);
    })
    .slice(0, MAX_LOGBOOK_METRICS)
    .map((metric) => ({
      name: metric.name,
      valueType: metric.valueType,
      unitLabel: metric.unitLabel,
      safeMin: metric.safeMin,
      safeMax: metric.safeMax,
    }));

  const context: LogbookPromptContext = {
    feature: "logbook-draft",
    userRequest: compactText(options.userRequest, MAX_USER_TEXT_LENGTH),
    draftEntry: {
      title: compactText(options.draftTitle, 120) || undefined,
      note: compactText(options.draftNote, 420) || undefined,
    },
    targetSpace: targetSpace
      ? {
          name: targetSpace.name,
          category: targetSpace.category,
          status: targetSpace.status,
          summary: compactText(targetSpace.summary, MAX_SUMMARY_LENGTH),
        }
      : undefined,
    selectedAssets: assets.map((asset) => ({
      name: asset.name,
      category: asset.category,
      status: asset.status,
      note: compactText(asset.note, 100),
    })),
    relatedReminder: relatedReminder
      ? {
          title: relatedReminder.title,
          description: compactText(
            relatedReminder.description,
            MAX_SUMMARY_LENGTH,
          ),
          dueAt: relatedReminder.dueAt,
          status: relatedReminder.status,
        }
      : undefined,
    relatedRoutine: relatedRoutine
      ? {
          name: relatedRoutine.name,
          description: compactText(
            relatedRoutine.description,
            MAX_SUMMARY_LENGTH,
          ),
          stepCount: relatedRoutine.steps.length,
        }
      : undefined,
    relevantMetricDefinitions,
    recentLogs: summarizeRecentLogs(recentLogs, options.workspace),
  };

  return {
    system:
      "You are helping draft a TrackItUp log entry. Improve clarity and consistency, but keep the result grounded only in the provided draft text and compact workspace context. The user remains the final editor.",
    consentLabel: aiLogbookDraftCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User request: ${context.userRequest}`,
        "Use the draft entry and compact context to suggest a cleaner title, polished note, and a small set of relevant tags.",
        "Do not invent attachments, image contents, locations, or reminder changes that are not present in the provided context.",
      ],
      context,
    ),
    context,
  };
}

export function buildVisualRecapPrompt(options: {
  workspace: WorkspaceSnapshot;
  scopeLabel: string;
  scope?: VisualHistoryScope;
  monthKey?: string;
  request?: string;
}): AiPromptDraft<VisualRecapPromptContext> | null {
  const history = buildWorkspaceVisualHistory(options.workspace, options.scope);
  const recap = options.monthKey
    ? history.monthlyRecaps.find((item) => item.monthKey === options.monthKey)
    : history.monthlyRecaps[0];

  if (!recap) return null;

  const context: VisualRecapPromptContext = {
    feature: "visual-recap",
    request: compactText(
      options.request ??
        "Write a concise recap from the selected TrackItUp history slice.",
      MAX_USER_TEXT_LENGTH,
    ),
    scopeLabel: compactText(options.scopeLabel, 80),
    monthKey: recap.monthKey,
    scopeTotals: {
      photoCount: history.photoCount,
      proofCount: history.proofCount,
    },
    recapTotals: {
      photoCount: recap.photoCount,
      proofCount: recap.proofCount,
    },
    beforeAfter: history.beforeAfter
      ? {
          beforeTitle: compactText(history.beforeAfter.before.logTitle, 90),
          beforeDate: history.beforeAfter.before.capturedAt,
          afterTitle: compactText(history.beforeAfter.after.logTitle, 90),
          afterDate: history.beforeAfter.after.capturedAt,
        }
      : undefined,
    highlights: recap.items
      .slice(0, MAX_VISUAL_RECAP_HIGHLIGHTS)
      .map((item) => ({
        capturedAt: item.capturedAt,
        logTitle: compactText(item.logTitle, 90),
        logNote: compactText(item.logNote, MAX_NOTE_LENGTH),
        spaceName: item.spaceName,
        assetNames: item.assetNames.slice(0, 4),
        proofLabel: item.proofLabel,
      })),
  };

  return {
    system:
      "You are writing a TrackItUp visual recap. Narrate only from the supplied recap metadata and log text. Do not claim to have directly seen photos or infer visual details beyond the provided log context.",
    consentLabel: aiVisualRecapCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User request: ${context.request}`,
        `Scope label: ${context.scopeLabel}`,
        `Selected month: ${context.monthKey}`,
        "Write a grounded recap that highlights progress, proof moments, and notable changes without pretending to inspect the underlying images.",
      ],
      context,
    ),
    context,
  };
}

export function buildPlannerCopilotPrompt(options: {
  workspace: WorkspaceSnapshot;
  userRequest: string;
  activeDateKey: string;
}): AiPromptDraft<PlannerCopilotPromptContext> {
  const spacesById = new Map(
    options.workspace.spaces.map((space) => [space.id, space] as const),
  );
  const selectedDayReminders = [...options.workspace.reminders]
    .filter(
      (reminder) => getReminderDateKey(reminder) === options.activeDateKey,
    )
    .sort((left, right) =>
      getReminderScheduleTimestamp(left).localeCompare(
        getReminderScheduleTimestamp(right),
      ),
    )
    .slice(0, MAX_PLANNER_DAY_REMINDERS)
    .map((reminder) => ({
      id: reminder.id,
      title: compactText(reminder.title, 90),
      status: reminder.status,
      dueAt: getReminderScheduleTimestamp(reminder),
      spaceName: spacesById.get(reminder.spaceId)?.name,
      description: compactText(reminder.description, MAX_SUMMARY_LENGTH),
    }));
  const actionCenter = buildReminderActionCenter(options.workspace);
  const context: PlannerCopilotPromptContext = {
    feature: "planner-copilot",
    userRequest: compactText(options.userRequest, MAX_USER_TEXT_LENGTH),
    activeDateKey: options.activeDateKey,
    selectedDayReminders,
    actionCenterSummary: {
      overdueCount: actionCenter.summary.overdueCount,
      dueTodayCount: actionCenter.summary.dueTodayCount,
      upcomingCount: actionCenter.summary.upcomingCount,
      recentActivity: actionCenter.recentActivity
        .slice(0, MAX_PLANNER_RECENT_ACTIVITY)
        .map((item) => ({
          reminderTitle: compactText(item.reminderTitle, 90),
          action: item.action,
          at: item.at,
          note: compactText(item.note, 120),
        })),
    },
    recommendations: summarizePlannerRecommendations(
      getWorkspaceRecommendations(options.workspace),
    ),
    upcomingAgenda: summarizePlannerAgenda(options.workspace),
  };

  return {
    system:
      "You are a TrackItUp planner copilot. Suggest a grounded next-step plan using only the provided reminder schedule, recent reminder activity, and recommendation context. The user stays in control of every reminder action.",
    consentLabel: aiPlannerCopilotCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User request: ${context.userRequest}`,
        `Selected planner day: ${context.activeDateKey}`,
        "Recommend the next best reminder actions for the selected day and near-term planner queue. Keep the plan concise, realistic, and review-only.",
        "Do not invent reminders, completion state changes, automation, or evidence that is not present in the provided context.",
      ],
      context,
    ),
    context,
  };
}

export function buildPlannerRiskPrompt(options: {
  workspace: WorkspaceSnapshot;
  userRequest: string;
  activeDateKey: string;
}): AiPromptDraft<PlannerRiskPromptContext> {
  const riskSummary = buildWorkspacePlannerRiskSummary(
    options.workspace,
    options.activeDateKey,
  );
  const retrievedSources: AiPlannerRiskSource[] = [
    ...riskSummary.highestRiskReminders.slice(0, 3).map((reminder) => ({
      id: `reminder:${reminder.id}`,
      title: reminder.title,
      kind: "reminder" as const,
      snippet: compactText(reminder.riskReasons.join(" "), 170),
      route: reminder.route,
      spaceId: reminder.spaceId,
      reminderId: reminder.id,
    })),
    ...riskSummary.recentDeferrals.slice(0, 3).map((deferral) => ({
      id: `deferral:${deferral.id}`,
      title: `${deferral.reminderTitle} (${deferral.action})`,
      kind: "deferral" as const,
      snippet: compactText(
        deferral.note || `${deferral.action} at ${deferral.at}`,
        170,
      ),
      route: deferral.route,
      spaceId: deferral.spaceId,
      reminderId: deferral.reminderId,
    })),
    ...riskSummary.spaceHotspots.slice(0, 2).map((space) => ({
      id: `space:${space.id}`,
      title: space.name,
      kind: "space" as const,
      snippet: compactText(
        `${space.overdueCount} overdue, ${space.dueTodayCount} due today, ${space.deferredCount} recent deferral(s).`,
        170,
      ),
      route: space.route,
      spaceId: space.id,
    })),
  ].slice(0, MAX_PLANNER_RISK_SOURCES);

  const context: PlannerRiskPromptContext = {
    feature: "planner-risk-brief",
    userRequest: compactText(options.userRequest, MAX_USER_TEXT_LENGTH),
    activeDateKey: options.activeDateKey,
    summary: riskSummary.summary,
    highestRiskReminders: riskSummary.highestRiskReminders.map((reminder) => ({
      id: reminder.id,
      title: compactText(reminder.title, 90),
      spaceName: compactText(reminder.spaceName, 60),
      status: reminder.status,
      dueAt: reminder.dueAt,
      isSelectedDay: reminder.isSelectedDay,
      snoozeCount: reminder.snoozeCount,
      skipCount: reminder.skipCount,
      latestHistoryAction: reminder.latestHistoryAction,
      riskReasons: reminder.riskReasons.map((reason) =>
        compactText(reason, 110),
      ),
    })),
    recentDeferrals: riskSummary.recentDeferrals.map((deferral) => ({
      id: deferral.id,
      reminderTitle: compactText(deferral.reminderTitle, 90),
      spaceName: compactText(deferral.spaceName, 60),
      action: deferral.action,
      at: deferral.at,
      note: compactText(deferral.note, 110),
    })),
    spaceHotspots: riskSummary.spaceHotspots.map((space) => ({
      id: space.id,
      name: compactText(space.name, 60),
      overdueCount: space.overdueCount,
      dueTodayCount: space.dueTodayCount,
      deferredCount: space.deferredCount,
      nextDueAt: space.nextDueAt,
      reminderTitles: space.reminderTitles.map((title) =>
        compactText(title, 90),
      ),
    })),
    retrievedSources,
    availableDestinations: [
      { id: "planner", label: "Stay in planner" },
      { id: "action-center", label: "Open action center" },
      { id: "logbook", label: "Open logbook" },
    ],
  };

  return {
    system:
      "You are a TrackItUp planner risk analyst. Explain what looks risky or deferrable using only the provided reminder timing, deferral history, and grouped space pressure. If the signal is thin, say so plainly instead of guessing.",
    consentLabel: aiPlannerRiskCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User request: ${context.userRequest}`,
        `Selected planner day: ${context.activeDateKey}`,
        "Explain which reminders or spaces look most at risk of slipping, what can probably wait, and which TrackItUp destination should be opened next based only on the provided planner context.",
        "Use cited sourceIds from the retrieved reminders, deferrals, and space hotspots. Keep the answer concise and review-only.",
      ],
      context,
    ),
    context,
  };
}

export function buildTrackingQualityPrompt(options: {
  workspace: WorkspaceSnapshot;
  userRequest: string;
}): AiPromptDraft<TrackingQualityPromptContext> {
  const quality = buildWorkspaceTrackingQualitySummary(options.workspace);
  const retrievedSources: AiTrackingQualitySource[] = [
    ...quality.reminderGaps.slice(0, 2).map((gap) => ({
      id: `reminder:${gap.id}`,
      title: gap.title,
      kind: "reminder-gap" as const,
      snippet: compactText(gap.reasons.join(" "), 170),
      route: gap.route,
      spaceId: gap.spaceId,
      reminderId: gap.id,
      actionId: gap.route === "logbook" ? ("quick-log" as const) : undefined,
    })),
    ...quality.metricGaps.slice(0, 2).map((gap) => ({
      id: `metric:${gap.id}`,
      title: gap.name,
      kind: "metric-gap" as const,
      snippet: compactText(gap.reasons.join(" "), 170),
      route: gap.route,
      spaceId: gap.spaceId,
      actionId: "quick-metric" as const,
    })),
    ...quality.spaceGaps.slice(0, 2).map((gap) => ({
      id: `space:${gap.id}`,
      title: gap.name,
      kind: "space-gap" as const,
      snippet: compactText(gap.reasons.join(" "), 170),
      route: gap.route,
      spaceId: gap.id,
      actionId: gap.route === "logbook" ? ("quick-log" as const) : undefined,
    })),
    ...quality.sparseLogs.slice(0, 2).map((gap) => ({
      id: `log:${gap.id}`,
      title: gap.title,
      kind: "log-gap" as const,
      snippet: compactText(gap.signals.join(" "), 170),
      route: gap.route,
      spaceId: gap.spaceId,
      actionId: "quick-log" as const,
    })),
  ].slice(0, MAX_TRACKING_QUALITY_SOURCES);

  const context: TrackingQualityPromptContext = {
    feature: "tracking-quality-brief",
    userRequest: compactText(options.userRequest, MAX_USER_TEXT_LENGTH),
    summary: quality.summary,
    reminderGaps: quality.reminderGaps.map((gap) => ({
      id: gap.id,
      title: compactText(gap.title, 90),
      spaceName: compactText(gap.spaceName, 60),
      dueAt: gap.dueAt,
      status: gap.status,
      recentLinkedLogCount: gap.recentLinkedLogCount,
      deferredCount: gap.deferredCount,
      reasons: gap.reasons.map((reason) => compactText(reason, 110)),
    })),
    metricGaps: quality.metricGaps.map((gap) => ({
      id: gap.id,
      name: compactText(gap.name, 80),
      spaceName: compactText(gap.spaceName, 60),
      lastRecordedAt: gap.lastRecordedAt,
      openReminderCount: gap.openReminderCount,
      reasons: gap.reasons.map((reason) => compactText(reason, 110)),
    })),
    sparseLogs: quality.sparseLogs.map((gap) => ({
      id: gap.id,
      title: compactText(gap.title, 90),
      spaceName: compactText(gap.spaceName, 60),
      occurredAt: gap.occurredAt,
      kind: gap.kind,
      signals: gap.signals.map((signal) => compactText(signal, 110)),
    })),
    spaceGaps: quality.spaceGaps.map((gap) => ({
      id: gap.id,
      name: compactText(gap.name, 60),
      overdueCount: gap.overdueCount,
      openReminderCount: gap.openReminderCount,
      recentLogCount: gap.recentLogCount,
      recentProofCount: gap.recentProofCount,
      recentMetricCount: gap.recentMetricCount,
      latestLogAt: gap.latestLogAt,
      reasons: gap.reasons.map((reason) => compactText(reason, 110)),
    })),
    retrievedSources,
    availableDestinations: [
      { id: "action-center", label: "Stay in action center" },
      { id: "planner", label: "Open planner" },
      { id: "logbook", label: "Open logbook" },
      { id: "workspace-tools", label: "Open workspace tools" },
    ],
  };

  return {
    system:
      "You are a TrackItUp tracking quality analyst. Explain what should be recorded next using only the provided evidence gaps, sparse recent logs, stale metric coverage, and open reminder pressure. If the signal is thin, say so plainly instead of guessing.",
    consentLabel: aiTrackingQualityCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User request: ${context.userRequest}`,
        "Explain what should be recorded next and which reminders, metrics, spaces, or recent logs most need better recording to improve workspace tracking quality.",
        "Use cited sourceIds from the retrieved quality gaps and suggest the best TrackItUp destination only when it clearly helps.",
      ],
      context,
    ),
    context,
  };
}

export function buildActionCenterExplainerPrompt(options: {
  workspace: WorkspaceSnapshot;
  userRequest: string;
}): AiPromptDraft<ActionCenterExplainerPromptContext> {
  const actionCenter = buildReminderActionCenter(options.workspace);
  const context: ActionCenterExplainerPromptContext = {
    feature: "action-center-explainer",
    userRequest: compactText(options.userRequest, MAX_USER_TEXT_LENGTH),
    summary: {
      overdueCount: actionCenter.summary.overdueCount,
      dueTodayCount: actionCenter.summary.dueTodayCount,
      upcomingCount: actionCenter.summary.upcomingCount,
      recurringOverdueCount: actionCenter.summary.recurringOverdueCount,
      recurringDueTodayCount: actionCenter.summary.recurringDueTodayCount,
      recurringUpcomingCount: actionCenter.summary.recurringUpcomingCount,
      recentActivityCount: actionCenter.summary.recentActivityCount,
      nextBestStepCount: actionCenter.summary.nextBestStepCount,
      recurringNextBestStepCount:
        actionCenter.summary.recurringNextBestStepCount,
    },
    nextBestSteps: actionCenter.nextBestSteps
      .slice(0, MAX_ACTION_CENTER_NEXT_STEPS)
      .map((item) => ({
        reminderId: item.reminderId,
        reminderTitle: compactText(item.reminderTitle, 90),
        spaceName: compactText(item.spaceName, 60),
        status: item.status,
        dueAt: item.dueAt,
        descriptionSnippet: compactText(item.descriptionSnippet, 120),
        isRecurringLike: item.isRecurringLike,
        scheduleHint: compactText(item.scheduleHint, 60) || undefined,
        latestHistoryAction: item.latestHistoryAction,
        latestHistoryAt: item.latestHistoryAt,
        recentDeferralCount: item.recentDeferralCount,
        recentCompletionCount: item.recentCompletionCount,
        proofAffinityHint:
          compactText(item.proofAffinityHint, 120) || undefined,
        priorityScore: item.priorityScore,
        suggestedAction: item.suggestedAction,
        reason: compactText(item.reason, 120),
      })),
    groupedBySpace: actionCenter.groupedBySpace
      .slice(0, MAX_ACTION_CENTER_GROUPS)
      .map((item) => ({
        spaceName: compactText(item.spaceName, 60),
        reminderCount: item.reminderCount,
        overdueCount: item.overdueCount,
        dueTodayCount: item.dueTodayCount,
        nextDueAt: item.nextDueAt,
        reminderTitles: item.reminderTitles
          .slice(0, 4)
          .map((title) => compactText(title, 90)),
      })),
    recurringNextBestSteps: actionCenter.recurringNextBestSteps
      .slice(0, MAX_ACTION_CENTER_NEXT_STEPS)
      .map((item) => ({
        occurrenceId: item.occurrenceId,
        planId: item.planId,
        title: compactText(item.title, 90),
        dueAt: item.dueAt,
        spaceName: compactText(item.spaceName, 60),
        suggestedAction: item.suggestedAction,
        reason: compactText(item.reason, 120),
      })),
    recentActivity: actionCenter.recentActivity
      .slice(0, MAX_ACTION_CENTER_RECENT_ACTIVITY)
      .map((item) => ({
        reminderTitle: compactText(item.reminderTitle, 90),
        action: item.action,
        at: item.at,
        note: compactText(item.note, 120),
      })),
    recommendations: summarizeActionCenterRecommendations(
      getWorkspaceRecommendations(options.workspace),
    ),
  };

  return {
    system:
      "You are a TrackItUp action-center explainer. Prioritize immediate, executable reminder and recurring-queue moves using only the provided queue pressure, grouped workload, reminder behavior signals, recurring signals, recent activity, and recommendation context.",
    consentLabel: aiActionCenterExplainerCopy.consentLabel,
    prompt: buildPromptBody(
      [
        `User request: ${context.userRequest}`,
        "Explain what matters most in the current action center, highlight grouped workload pressure, and recommend a short review-only next-step sequence ordered by actionability.",
        "Prefer suggestions that map directly to TrackItUp-native actions (complete-now, log-proof, snooze, open-planner, create-log, create-recurring-plan, complete-recurring-now, review-later) and account for recent deferrals or completion patterns when provided.",
        "Do not invent reminders, completion state changes, automation, or evidence that is not present in the provided context.",
      ],
      context,
    ),
    context,
  };
}
