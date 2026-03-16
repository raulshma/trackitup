import type {
    LogEntry,
    LogKind,
    QuickActionKind,
    Reminder,
    SpaceStatus,
    WorkspaceSnapshot,
} from "@/types/trackitup";
import { formatSpaceCategoryLabel } from "./TrackItUpSpaceCategories.ts";
import { trackItUpTemplateCatalog } from "./TrackItUpTemplateCatalog.ts";

export type OverviewStat = {
  label: string;
  value: string;
};

export type SpaceSummary = {
  id: string;
  name: string;
  category: string;
  status: string;
  pendingTasks: number;
  lastLog: string;
  note: string;
  accent: string;
};

export type TimelineEntry = {
  id: string;
  type: string;
  title: string;
  detail: string;
  timestamp: string;
  occurredAt: string;
  kind: LogKind;
  spaceId: string;
  spaceName: string;
  accent: string;
};

export type QuickActionCard = {
  id: string;
  label: string;
  description: string;
  target: string;
  accent: string;
};

const statusLabels: Record<SpaceStatus, string> = {
  stable: "Stable",
  watch: "Watch",
  planned: "Planned",
  archived: "Archived",
};

const logTypeLabels: Record<LogKind, string> = {
  "metric-reading": "Metric",
  "routine-run": "Routine",
  "asset-update": "Asset",
  reminder: "Reminder",
};

const quickActionDetails: Record<
  QuickActionKind,
  { description: string; target: string; accent: string }
> = {
  "quick-log": {
    description:
      "Capture a note, event, or checklist result from the unified logbook.",
    target: "Across all spaces",
    accent: "#0f766e",
  },
  "metric-entry": {
    description:
      "Record a fresh reading against tracked metrics and safe zones.",
    target: "Metrics ready to log",
    accent: "#0ea5e9",
  },
  "routine-run": {
    description:
      "Run a saved workflow with linked steps, assets, and reminders.",
    target: "Routine-guided entry",
    accent: "#8b5cf6",
  },
};

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export const trackItUpWorkspace: WorkspaceSnapshot = {
  generatedAt: "2026-03-09T19:30:00",
  spaces: [
    {
      id: "reef",
      name: "100G Reef Tank",
      category: "aquarium",
      status: "stable",
      themeColor: "#0f766e",
      summary: "Weekly maintenance routine due tomorrow.",
      createdAt: "2026-02-01T10:00:00",
      templateName: "Advanced Reef",
    },
    {
      id: "plants",
      name: "Indoor Plants",
      category: "gardening",
      status: "watch",
      themeColor: "#65a30d",
      summary: "Monstera moisture has trended low for 3 days.",
      createdAt: "2026-01-20T14:00:00",
      templateName: "Plant Care Starter",
    },
    {
      id: "living-room",
      name: "Living Room",
      category: "gardening",
      status: "stable",
      themeColor: "#84cc16",
      summary: "Nested plant space used for room-specific reminders and logs.",
      createdAt: "2026-02-15T08:30:00",
      parentSpaceId: "plants",
      templateName: "Room Plant Detail",
    },
    {
      id: "garage",
      name: "Project Garage",
      category: "vehicle-maintenance",
      status: "planned",
      themeColor: "#ea580c",
      summary: "Brake inspection and tire rotation are coming up.",
      createdAt: "2026-01-05T09:00:00",
      templateName: "Vehicle Maintenance Log",
    },
  ],
  assets: [
    {
      id: "asset-filter",
      spaceId: "reef",
      name: "Canister Filter",
      category: "Equipment",
      status: "active",
      note: "Warranty tracked through reminders and lifecycle logs.",
      purchaseDate: "2025-12-01",
      purchasePrice: 289.99,
      warrantyExpiresAt: "2027-12-01",
      warrantyNote: "Replace media baskets before warranty inspection.",
      barcodeValue: "TIU-REEF-FILTER-01",
    },
    {
      id: "asset-betta",
      spaceId: "reef",
      name: "Blue Betta",
      category: "Livestock",
      status: "deceased",
      note: "Lifecycle retained for medical history and parameter analysis.",
      purchaseDate: "2025-08-12",
      purchasePrice: 24.0,
      qrCodeValue: "reef-livestock-betta",
    },
    {
      id: "asset-monstera",
      spaceId: "plants",
      name: "Monstera Deliciosa",
      category: "Plant",
      status: "active",
      note: "Moisture trend is being watched this week.",
      purchaseDate: "2025-11-04",
      purchasePrice: 32.5,
    },
    {
      id: "asset-pothos",
      spaceId: "living-room",
      name: "Golden Pothos",
      category: "Plant",
      status: "active",
      note: "Uses room-level reminders and light exposure logs.",
      purchaseDate: "2026-02-16",
      purchasePrice: 18.0,
    },
    {
      id: "asset-brakes",
      spaceId: "garage",
      name: "Brake Pads",
      category: "Vehicle Part",
      status: "maintenance",
      note: "Inspection reminder is active before the next road trip.",
      purchasePrice: 139.99,
      barcodeValue: "TIU-GARAGE-BRAKES-02",
    },
  ],
  metricDefinitions: [
    {
      id: "metric-salinity",
      spaceId: "reef",
      name: "Salinity",
      valueType: "number",
      unitLabel: "SG",
      safeMin: 1.024,
      safeMax: 1.026,
    },
    {
      id: "metric-alkalinity",
      spaceId: "reef",
      name: "Alkalinity",
      valueType: "number",
      unitLabel: "dKH",
      safeMin: 8,
      safeMax: 9.5,
    },
    {
      id: "metric-moisture",
      spaceId: "plants",
      assetId: "asset-monstera",
      name: "Soil moisture",
      valueType: "number",
      unitLabel: "%",
      safeMin: 35,
      safeMax: 55,
    },
    {
      id: "metric-brake-thickness",
      spaceId: "garage",
      assetId: "asset-brakes",
      name: "Brake pad thickness",
      valueType: "number",
      unitLabel: "mm",
      safeMin: 4,
    },
  ],
  routines: [
    {
      id: "routine-reef-weekly",
      spaceId: "reef",
      name: "Weekly maintenance",
      macroLabel: "Weekly Maintenance",
      description: "Water change, filter cleaning, and supplement dosing.",
      nextDueAt: "2026-03-10T09:00:00",
      steps: [
        { id: "step-reef-water", label: "Log 20% water change", kind: "log" },
        {
          id: "step-reef-filter",
          label: "Clean filter media",
          kind: "asset",
          assetId: "asset-filter",
        },
        {
          id: "step-reef-dose",
          label: "Record supplement dose",
          kind: "metric",
          generatedLogKind: "asset-update",
        },
      ],
    },
    {
      id: "routine-plant-feed",
      spaceId: "plants",
      name: "Plant feeding routine",
      macroLabel: "Plant Feed",
      description: "Fertilizer dose, pruning, and observation notes.",
      nextDueAt: "2026-03-12T18:00:00",
      steps: [
        { id: "step-plant-feed", label: "Add fertilizer dose", kind: "metric" },
        { id: "step-plant-prune", label: "Capture pruning notes", kind: "log" },
      ],
    },
  ],
  reminders: [
    {
      id: "reminder-reef-ammonia",
      spaceId: "reef",
      title: "Ammonia follow-up check",
      description:
        "Validate stability 24 hours after the last livestock update.",
      dueAt: "2026-03-09T18:00:00",
      status: "due",
      triggerCondition: "24 hours after logging a 'New Fish Added' event.",
      triggerRules: [
        {
          logKind: "asset-update",
          titleIncludes: "fish",
          delayHours: 24,
        },
      ],
      history: [
        {
          id: "history-ammonia-scheduled",
          action: "scheduled",
          at: "2026-03-08T18:00:00",
          note: "Condition met from livestock onboarding log.",
        },
      ],
    },
    {
      id: "reminder-reef-weekly",
      spaceId: "reef",
      title: "Run weekly maintenance routine",
      description: "Water change, clean the filter, and update dosing notes.",
      dueAt: "2026-03-10T09:00:00",
      recurrence: "Weekly",
      ruleLabel: "Every Saturday at 9:00 AM",
      scheduleRule: { frequency: "weekly", weekday: 6, time: "09:00" },
      status: "scheduled",
      history: [
        {
          id: "history-reef-weekly",
          action: "scheduled",
          at: "2026-03-03T09:00:00",
          note: "Recurring task rolled forward automatically.",
        },
      ],
    },
    {
      id: "reminder-plant-water",
      spaceId: "plants",
      title: "Check Monstera moisture",
      description: "Inspect the soil and log a follow-up moisture reading.",
      dueAt: "2026-03-09T19:00:00",
      status: "due",
    },
    {
      id: "reminder-pothos-feed",
      spaceId: "living-room",
      title: "Fertilize Pothos",
      description: "Snoozed once because the soil was still moist yesterday.",
      dueAt: "2026-03-09T17:00:00",
      recurrence: "Monthly",
      ruleLabel: "First Sunday of every month",
      scheduleRule: {
        frequency: "monthly",
        weekday: 0,
        weekOfMonth: 1,
        time: "09:00",
      },
      snoozedUntil: "2026-03-10T09:30:00",
      status: "snoozed",
      history: [
        {
          id: "history-pothos-scheduled",
          action: "scheduled",
          at: "2026-03-01T09:00:00",
          note: "Monthly care schedule generated.",
        },
        {
          id: "history-pothos-snoozed",
          action: "snoozed",
          at: "2026-03-09T17:05:00",
          note: "Snoozed for 16 hours because the pot was still damp.",
        },
      ],
    },
    {
      id: "reminder-brake-inspection",
      spaceId: "garage",
      title: "Brake inspection",
      description: "Inspect pad wear before the next long drive.",
      dueAt: "2026-03-11T08:00:00",
      recurrence: "Monthly",
      ruleLabel: "Every 2nd Tuesday of the month",
      scheduleRule: {
        frequency: "monthly",
        weekday: 2,
        weekOfMonth: 2,
        time: "08:00",
      },
      status: "scheduled",
    },
    {
      id: "reminder-tire-rotation",
      spaceId: "garage",
      title: "Tire rotation",
      description: "Rotate tires and capture tread notes.",
      dueAt: "2026-03-15T08:00:00",
      recurrence: "Quarterly",
      scheduleRule: { frequency: "quarterly", dayOfMonth: 15, time: "08:00" },
      status: "scheduled",
    },
  ],
  recurringPlans: [
    {
      id: "plan-reef-feed",
      spaceId: "reef",
      title: "Feed fish",
      description: "Morning and evening feeding pass for reef livestock.",
      category: "feeding",
      tags: ["feeding", "reef"],
      scheduleRule: {
        type: "daily",
        times: ["08:00", "18:00"],
      },
      startDate: "2026-03-01T00:00:00.000Z",
      timezone: "America/New_York",
      gracePeriodMinutes: 360,
      proofRequired: false,
      smartMatchMode: "prompt",
      status: "active",
      createdAt: "2026-03-01T09:00:00.000Z",
      updatedAt: "2026-03-09T18:30:00.000Z",
    },
    {
      id: "plan-reef-water-change",
      spaceId: "reef",
      title: "Water change",
      description: "Run a 20% change and attach a quick proof entry.",
      category: "maintenance",
      tags: ["water-change", "maintenance", "reef"],
      scheduleRule: {
        type: "every-n-days",
        interval: 3,
        times: ["09:00"],
      },
      startDate: "2026-03-01T00:00:00.000Z",
      timezone: "America/New_York",
      gracePeriodMinutes: 720,
      proofRequired: true,
      smartMatchMode: "prompt",
      status: "active",
      createdAt: "2026-03-01T09:00:00.000Z",
      updatedAt: "2026-03-09T18:30:00.000Z",
    },
  ],
  recurringOccurrences: [
    {
      id: "occ-reef-feed-2026-03-09-08",
      planId: "plan-reef-feed",
      spaceId: "reef",
      dueAt: "2026-03-09T13:00:00.000Z",
      status: "completed",
      completedAt: "2026-03-09T13:05:00.000Z",
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-09T13:05:00.000Z",
    },
    {
      id: "occ-reef-feed-2026-03-09-18",
      planId: "plan-reef-feed",
      spaceId: "reef",
      dueAt: "2026-03-09T23:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-08T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
    },
    {
      id: "occ-reef-water-change-2026-03-09",
      planId: "plan-reef-water-change",
      spaceId: "reef",
      dueAt: "2026-03-09T14:00:00.000Z",
      status: "scheduled",
      createdAt: "2026-03-07T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
    },
  ],
  logs: [
    {
      id: "log-monstera-progress-start",
      spaceId: "plants",
      kind: "asset-update",
      title: "Monstera support pole installed",
      note: "Captured an early growth photo before feeding and adding a fresh support pole.",
      occurredAt: "2026-02-21T17:20:00",
      assetIds: ["asset-monstera"],
      tags: ["growth", "photo"],
      attachmentsCount: 1,
      attachments: [
        {
          id: "attachment-monstera-start-1",
          uri: "https://picsum.photos/seed/trackitup-monstera-start/900/700",
          mediaType: "photo",
          capturedAt: "2026-02-21T17:20:00",
          width: 900,
          height: 700,
        },
      ],
    },
    {
      id: "log-reef-chemistry-baseline",
      spaceId: "reef",
      kind: "metric-reading",
      title: "Reef chemistry baseline",
      note: "Captured salinity and alkalinity together before the weekly maintenance cycle.",
      occurredAt: "2026-03-05T08:10:00",
      metricReadings: [
        { metricId: "metric-salinity", value: 1.026, unitLabel: "SG" },
        { metricId: "metric-alkalinity", value: 8.9, unitLabel: "dKH" },
      ],
      tags: ["testing", "baseline"],
      attachmentsCount: 1,
      attachments: [
        {
          id: "attachment-reef-baseline-1",
          uri: "https://picsum.photos/seed/trackitup-reef-baseline/900/700",
          mediaType: "photo",
          capturedAt: "2026-03-05T08:10:00",
          width: 900,
          height: 700,
        },
      ],
    },
    {
      id: "log-reef-chemistry-follow-up",
      spaceId: "reef",
      kind: "metric-reading",
      title: "Reef chemistry follow-up",
      note: "Trend check after the midweek dose adjustment.",
      occurredAt: "2026-03-07T08:05:00",
      metricReadings: [
        { metricId: "metric-salinity", value: 1.025, unitLabel: "SG" },
        { metricId: "metric-alkalinity", value: 8.4, unitLabel: "dKH" },
      ],
      tags: ["testing", "trend"],
      attachmentsCount: 1,
      attachments: [
        {
          id: "attachment-reef-follow-up-1",
          uri: "https://picsum.photos/seed/trackitup-reef-followup/900/700",
          mediaType: "photo",
          capturedAt: "2026-03-07T08:05:00",
          width: 900,
          height: 700,
        },
      ],
    },
    {
      id: "log-salinity",
      spaceId: "reef",
      kind: "metric-reading",
      title: "Salinity check recorded",
      note: "100G Reef Tank • 1.025 SG • within target range",
      occurredAt: "2026-03-09T08:15:00",
      metricReadings: [
        { metricId: "metric-salinity", value: 1.025, unitLabel: "SG" },
      ],
      tags: ["testing", "water"],
      locationLabel: "Fish room",
    },
    {
      id: "log-alkalinity-low",
      spaceId: "reef",
      kind: "metric-reading",
      title: "Alkalinity trending low",
      note: "8.0 dKH target missed yesterday and 7.7 dKH today — flagged for attention.",
      occurredAt: "2026-03-09T07:40:00",
      metricReadings: [
        { metricId: "metric-alkalinity", value: 7.7, unitLabel: "dKH" },
      ],
      tags: ["testing", "alert"],
      attachmentsCount: 1,
      attachments: [
        {
          id: "attachment-reef-alert-1",
          uri: "https://picsum.photos/seed/trackitup-reef-alert/900/700",
          mediaType: "photo",
          capturedAt: "2026-03-09T07:40:00",
          width: 900,
          height: 700,
        },
      ],
    },
    {
      id: "log-plant-routine",
      spaceId: "plants",
      kind: "routine-run",
      title: "Indoor plant feeding routine",
      note: "Fertilizer dose + pruning notes + photo attachment",
      occurredAt: "2026-03-08T18:40:00",
      routineId: "routine-plant-feed",
      assetIds: ["asset-monstera"],
      tags: ["fertilizer", "photo"],
      attachmentsCount: 2,
      attachments: [
        {
          id: "attachment-monstera-feed-1",
          uri: "https://picsum.photos/seed/trackitup-monstera-feed-1/900/700",
          mediaType: "photo",
          capturedAt: "2026-03-08T18:35:00",
          width: 900,
          height: 700,
        },
        {
          id: "attachment-monstera-feed-2",
          uri: "https://picsum.photos/seed/trackitup-monstera-feed-2/900/700",
          mediaType: "photo",
          capturedAt: "2026-03-08T18:44:00",
          width: 900,
          height: 700,
        },
      ],
      cost: 18.5,
    },
    {
      id: "log-filter-reminder",
      spaceId: "reef",
      kind: "asset-update",
      title: "Canister filter warranty reminder created",
      note: "Asset lifecycle reminder scheduled for 90 days before expiry",
      occurredAt: "2026-03-08T13:20:00",
      assetIds: ["asset-filter"],
      tags: ["warranty", "inventory"],
      attachmentsCount: 1,
      attachments: [
        {
          id: "attachment-filter-lifecycle-1",
          uri: "https://picsum.photos/seed/trackitup-filter-lifecycle/900/700",
          mediaType: "photo",
          capturedAt: "2026-03-08T13:20:00",
          width: 900,
          height: 700,
        },
      ],
    },
    {
      id: "log-brake-reminder",
      spaceId: "garage",
      kind: "reminder",
      title: "Brake inspection due soon",
      note: "Project Garage • recurring maintenance reminder",
      occurredAt: "2026-03-07T09:00:00",
      reminderId: "reminder-brake-inspection",
      tags: ["safety", "maintenance"],
    },
    {
      id: "log-pothos-light",
      spaceId: "living-room",
      kind: "asset-update",
      title: "Light exposure adjusted for Pothos",
      note: "Moved the plant 2 feet from the west window and dropped a GPS pin for outdoor propagation notes.",
      occurredAt: "2026-03-06T17:15:00",
      assetIds: ["asset-pothos"],
      tags: ["location", "propagation"],
      attachmentsCount: 1,
      attachments: [
        {
          id: "attachment-pothos-light-1",
          uri: "https://picsum.photos/seed/trackitup-pothos-light/900/700",
          mediaType: "photo",
          capturedAt: "2026-03-06T17:15:00",
          width: 900,
          height: 700,
        },
      ],
      locationLabel: "Living room west window",
    },
  ],
  quickActions: [
    { id: "quick-log", label: "Quick log", kind: "quick-log" },
    { id: "quick-metric", label: "Add metric", kind: "metric-entry" },
    {
      id: "quick-routine",
      label: "Run routine",
      kind: "routine-run",
      spaceId: "reef",
      routineId: "routine-reef-weekly",
    },
  ],
  expenses: [
    {
      id: "expense-reef-supplements",
      spaceId: "reef",
      title: "Two-part supplement refill",
      category: "Consumables",
      amount: 24.99,
      currency: "USD",
      occurredAt: "2026-03-02T11:30:00",
      recurring: "Monthly",
    },
    {
      id: "expense-plant-feed",
      spaceId: "plants",
      title: "Fertilizer concentrate",
      category: "Plant care",
      amount: 18.5,
      currency: "USD",
      occurredAt: "2026-03-08T18:35:00",
      assetId: "asset-monstera",
      logId: "log-plant-routine",
    },
    {
      id: "expense-brakes",
      spaceId: "garage",
      title: "Brake pad replacement kit",
      category: "Maintenance",
      amount: 139.99,
      currency: "USD",
      occurredAt: "2026-02-21T09:20:00",
      assetId: "asset-brakes",
    },
  ],
  dashboardWidgets: [
    {
      id: "widget-attention",
      title: "Items needing attention",
      type: "attention",
      description:
        "Surfaces reminders due soon and metrics outside safe zones.",
      size: "large",
    },
    {
      id: "widget-reef-chart",
      title: "Reef chemistry comparison",
      type: "chart",
      description:
        "Overlay salinity and alkalinity trends on the same dashboard card.",
      size: "medium",
      spaceId: "reef",
      metricIds: ["metric-salinity", "metric-alkalinity"],
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
      description:
        "Pinned one-tap entry points for routines, logs, and metrics.",
      size: "small",
    },
  ],
  templates: cloneValue(trackItUpTemplateCatalog),
  syncQueue: [],
};

function sortByNewest<T extends { occurredAt: string }>(items: T[]) {
  return [...items].sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt),
  );
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isYesterday(date: Date, now: Date) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return isSameDay(date, yesterday);
}

function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatMonthDay(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "2-digit" });
}

function formatRelativeLogTime(timestamp: string, nowTimestamp: string) {
  const now = new Date(nowTimestamp);
  const date = new Date(timestamp);
  const differenceMs = now.getTime() - date.getTime();
  const minutes = Math.max(1, Math.round(differenceMs / (1000 * 60)));

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);
  if (isSameDay(date, now)) {
    return `${hours} hr ago`;
  }

  if (isYesterday(date, now)) {
    return "yesterday";
  }

  return formatMonthDay(date);
}

function formatTimelineTimestamp(timestamp: string, nowTimestamp: string) {
  const now = new Date(nowTimestamp);
  const date = new Date(timestamp);

  if (isSameDay(date, now)) {
    return `Today • ${formatClock(date)}`;
  }

  if (isYesterday(date, now)) {
    return `Yesterday • ${formatClock(date)}`;
  }

  return `${formatMonthDay(date)} • ${formatClock(date)}`;
}

function isReminderOpen(reminder: Reminder) {
  return (
    reminder.status === "due" ||
    reminder.status === "scheduled" ||
    reminder.status === "snoozed"
  );
}

function countDueToday(reminders: Reminder[], nowTimestamp: string) {
  const today = new Date(nowTimestamp);
  return reminders.filter(
    (reminder) =>
      isReminderOpen(reminder) && isSameDay(new Date(reminder.dueAt), today),
  ).length;
}

function countLogsThisWeek(logs: LogEntry[], nowTimestamp: string) {
  const now = new Date(nowTimestamp).getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  return logs.filter(
    (log) => now - new Date(log.occurredAt).getTime() <= weekMs,
  ).length;
}

const latestLogsBySpace = new Map(
  trackItUpWorkspace.spaces.map((space) => {
    const latestLog = sortByNewest(
      trackItUpWorkspace.logs.filter((log) => log.spaceId === space.id),
    )[0];

    return [space.id, latestLog] as const;
  }),
);

const spacesById = new Map(
  trackItUpWorkspace.spaces.map((space) => [space.id, space] as const),
);

export const overviewStats: OverviewStat[] = [
  { label: "Active spaces", value: String(trackItUpWorkspace.spaces.length) },
  {
    label: "Due today",
    value: String(
      countDueToday(
        trackItUpWorkspace.reminders,
        trackItUpWorkspace.generatedAt,
      ),
    ),
  },
  {
    label: "Logs this week",
    value: String(
      countLogsThisWeek(
        trackItUpWorkspace.logs,
        trackItUpWorkspace.generatedAt,
      ),
    ),
  },
];

export const quickActionCards: QuickActionCard[] =
  trackItUpWorkspace.quickActions.map((action) => {
    const linkedSpace = action.spaceId
      ? spacesById.get(action.spaceId)
      : undefined;
    const detail = quickActionDetails[action.kind];

    return {
      id: action.id,
      label: action.label,
      description: detail.description,
      target: linkedSpace ? linkedSpace.name : detail.target,
      accent: linkedSpace?.themeColor ?? detail.accent,
    };
  });

export const quickActions = quickActionCards.map((action) => action.label);

export const spaceSummaries: SpaceSummary[] = trackItUpWorkspace.spaces.map(
  (space) => {
    const pendingTasks = trackItUpWorkspace.reminders.filter(
      (reminder) => reminder.spaceId === space.id && isReminderOpen(reminder),
    ).length;
    const latestLog = latestLogsBySpace.get(space.id);

    return {
      id: space.id,
      name: space.name,
      category: formatSpaceCategoryLabel(space.category),
      status: statusLabels[space.status],
      pendingTasks,
      lastLog: latestLog
        ? `${latestLog.title} • ${formatRelativeLogTime(latestLog.occurredAt, trackItUpWorkspace.generatedAt)}`
        : "No logs yet",
      note: space.summary,
      accent: space.themeColor,
    };
  },
);

export const focusItems = [
  "Completed: unified timeline filtering covers spaces, kinds, assets, tags, and safe-zone alerts.",
  "Completed: workspace tools now support JSON/CSV/PDF export, pasted or file-picked CSV log import, and surfaced device capability checks.",
  "Completed: dashboard widgets now render live overlay charts, planner month views, and inventory-linked barcode scanning.",
  "Completed: dynamic forms now support camera/file attachments, GPS capture, and dictation-friendly text entry when logging work.",
  "Completed: the workspace now hydrates through a WatermelonDB-backed bridge when the runtime supports it.",
  "Next: wire a production sync backend endpoint and conflict-aware premium replication.",
];

export const timelineEntries: TimelineEntry[] = sortByNewest(
  trackItUpWorkspace.logs,
).map((log) => {
  const space = spacesById.get(log.spaceId);

  return {
    id: log.id,
    type: logTypeLabels[log.kind],
    title: log.title,
    detail: log.note,
    occurredAt: log.occurredAt,
    kind: log.kind,
    spaceId: log.spaceId,
    spaceName: space?.name ?? "Unknown space",
    accent: space?.themeColor ?? "#0f766e",
    timestamp: formatTimelineTimestamp(
      log.occurredAt,
      trackItUpWorkspace.generatedAt,
    ),
  };
});

export const roadmapSections = {
  completed: [
    "TrackItUp shell",
    "Starter dashboard",
    "Core tracking models",
    "First real logbook flow",
    "Template-driven forms",
    "Offline persistence powered by local models",
    "Advanced timeline search and filters",
    "Planner calendar and reminder history",
    "Inventory and expense summaries",
    "Dashboard attention widgets",
    "Workspace export and CSV import tools",
    "Device capability checks for camera and location",
    "Live dashboard chart visualizations",
    "Planner month calendar view",
    "Barcode / QR asset scan lookup",
    "Rich-media and GPS capture in dynamic forms",
    "Local schema builder and saved template launcher",
    "Routine macro child-log generation",
    "Cloud backup pull and force restore controls",
  ],
  current: [
    "Deeper WatermelonDB query usage and backend sync contract hardening",
  ],
  next: [
    "Hosted premium sync backend and entitlement gating",
    "Conflict resolution plus richer reporting polish",
  ],
};

export type RequirementCoverageStatus = "implemented" | "partial" | "blocked";

export type RequirementCoverageSection = {
  title: string;
  items: {
    label: string;
    status: RequirementCoverageStatus;
    note: string;
  }[];
};

export const requirementCoverage: RequirementCoverageSection[] = [
  {
    title: "Core engine",
    items: [
      {
        label: "Spaces, assets, metrics, logs, routines",
        status: "implemented",
        note: "Typed workspace snapshot and interactive UI flows are live.",
      },
      {
        label: "Nested spaces",
        status: "implemented",
        note: "Parent-child space relationships are now represented in the workspace model and selectors.",
      },
      {
        label: "Template-driven schema and form surface",
        status: "implemented",
        note: "Template catalogs now drive editable, recursive react-native-paper forms with validation, dependent option filtering, saved quick-action log entries, and an in-app custom schema builder that can save local templates.",
      },
    ],
  },
  {
    title: "Product modules",
    items: [
      {
        label: "Template catalog and import paths",
        status: "implemented",
        note: "Official and community templates are surfaced in the workspace, and shared deep links or QR scans now route through a real import screen that can add catalog items locally.",
      },
      {
        label: "Unified timeline + advanced filters",
        status: "implemented",
        note: "Date/kind/space/asset/tag/threshold filters run against persisted data.",
      },
      {
        label: "Voice-to-text logging",
        status: "implemented",
        note: "Log forms now expose dictation actions that capture browser speech recognition when available and otherwise guide users into device keyboard dictation for hands-free entry.",
      },
      {
        label: "Dashboards, alerts, and chart overlays",
        status: "implemented",
        note: "Dashboard widgets now surface live attention lists, quick shortcuts, planner previews, real line/bar/scatter metric overlays, and per-widget reorder/resize/hide customization from workspace data.",
      },
      {
        label: "Planner calendar + reminder history",
        status: "implemented",
        note: "Structured recurring rules, conditional reminders, snooze, skip, history, and a dedicated monthly calendar view are all surfaced from the shared planner workspace.",
      },
      {
        label: "Inventory lifecycle + expenses",
        status: "implemented",
        note: "Assets now expose lifecycle, warranty, barcode/QR metadata, scan lookup, and total cost rollups.",
      },
      {
        label: "Data portability + reporting",
        status: "implemented",
        note: "Workspace tools now generate richer JSON/CSV/PDF exports, include formatted summary reporting, and accept both pasted and file-picked CSV log imports.",
      },
      {
        label: "Authentication + premium sync",
        status: "partial",
        note: "No-login local use is live, Clerk sign-in is wired when configured, and the client now supports queued push plus authenticated pull/force-restore against a configured endpoint, but hosted backend deployment and subscription entitlements are still needed for full premium sync.",
      },
    ],
  },
  {
    title: "Technical strategy",
    items: [
      {
        label: "Local-first persistence",
        status: "partial",
        note: "Now hydrates through a WatermelonDB-backed async bridge when available, while preserving localStorage/file-system fallback paths for unsupported runtimes.",
      },
      {
        label: "Material Design 3 with react-native-paper",
        status: "implemented",
        note: "The root theme uses react-native-paper MD3 tokens and core actions/search inputs are already backed by Paper components.",
      },
      {
        label: "Device APIs for camera/location/files",
        status: "implemented",
        note: "Expo camera, location, and file-system now cover permission checks, exports, barcode/QR scanning, dynamic media capture, and GPS field attachment flows.",
      },
      {
        label: "WatermelonDB + premium sync engine",
        status: "partial",
        note: "WatermelonDB-backed tables, hydration, persistence, richer collection-driven log reads, and a client sync queue with push/pull restore flows are now wired, but production backend replication and conflict handling still require deployed infrastructure.",
      },
    ],
  },
];
