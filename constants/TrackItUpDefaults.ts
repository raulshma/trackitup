import type {
    DashboardWidget,
    QuickAction,
    TemplateCatalogItem,
    WorkspaceSnapshot,
} from "../types/trackitup.ts";
import { trackItUpTemplateCatalog } from "./TrackItUpTemplateCatalog.ts";

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export const defaultQuickActions: QuickAction[] = [
  { id: "quick-log", label: "Quick log", kind: "quick-log" },
  { id: "quick-metric", label: "Add metric", kind: "metric-entry" },
  { id: "quick-routine", label: "Run routine", kind: "routine-run" },
];

export const defaultDashboardWidgets: DashboardWidget[] = [
  {
    id: "widget-attention",
    title: "Items needing attention",
    type: "attention",
    description: "Surfaces reminders due soon and metrics outside safe zones.",
    size: "large",
  },
  {
    id: "widget-recommendations",
    title: "Recommended next actions",
    type: "recommendations",
    description:
      "Turns logs, reminders, and safe ranges into practical next steps.",
    size: "medium",
  },
  {
    id: "widget-reminders",
    title: "Upcoming maintenance",
    type: "reminders",
    description: "Cross-space planner card for recurring work.",
    size: "medium",
  },
  {
    id: "widget-quick-actions",
    title: "Quick log shortcuts",
    type: "quick-actions",
    description: "Pinned one-tap entry points for routines, logs, and metrics.",
    size: "small",
  },
];

export const knownTemplateCatalog: TemplateCatalogItem[] = cloneValue(
  trackItUpTemplateCatalog,
);

export function createEmptyWorkspaceSnapshot(
  generatedAt = new Date().toISOString(),
): WorkspaceSnapshot {
  return {
    generatedAt,
    spaces: [],
    assets: [],
    metricDefinitions: [],
    routines: [],
    reminders: [],
    recurringPlans: [],
    recurringOccurrences: [],
    logs: [],
    quickActions: cloneValue(defaultQuickActions),
    expenses: [],
    dashboardWidgets: cloneValue(defaultDashboardWidgets),
    templates: [],
    syncQueue: [],
  };
}
