export const knownSpaceCategories = [
  "aquarium",
  "gardening",
  "vehicle-maintenance",
  "pets",
  "home-maintenance",
  "workshop",
  "fitness",
  "storage",
] as const;

export type KnownSpaceCategory = (typeof knownSpaceCategories)[number];

export type SpaceCategory = KnownSpaceCategory | (string & {});

export type SpaceStatus = "stable" | "watch" | "planned";

export type AssetStatus = "active" | "archived" | "maintenance" | "deceased";

export type MetricValueType = "number" | "boolean" | "text";

export type LogKind =
  | "metric-reading"
  | "routine-run"
  | "asset-update"
  | "reminder";

export type ReminderStatus =
  | "due"
  | "scheduled"
  | "completed"
  | "skipped"
  | "snoozed";

export type QuickActionKind = "quick-log" | "metric-entry" | "routine-run";

export type FormFieldType =
  | "text"
  | "rich-text"
  | "textarea"
  | "number"
  | "unit"
  | "select"
  | "multi-select"
  | "date-time"
  | "checkbox"
  | "checklist"
  | "slider"
  | "tags"
  | "media"
  | "location"
  | "formula";

export type FormFieldSource =
  | "spaces"
  | "assets"
  | "metrics"
  | "routines"
  | "reminders"
  | "logs";

export type FormFieldOption = {
  label: string;
  value: string;
};

export type FormFieldDefinition = {
  id: string;
  label: string;
  type: FormFieldType;
  description?: string;
  placeholder?: string;
  required?: boolean;
  source?: FormFieldSource;
  options?: FormFieldOption[];
  children?: FormFieldDefinition[];
};

export type FormSectionDefinition = {
  id: string;
  title: string;
  description?: string;
  fields: FormFieldDefinition[];
};

export type FormTemplate = {
  id: string;
  title: string;
  description: string;
  sections: FormSectionDefinition[];
  quickActionKind?: QuickActionKind;
  logKind?: LogKind;
};

export type CustomFieldValue =
  | string
  | number
  | boolean
  | string[]
  | MediaAttachment[]
  | CapturedLocation;

export type Space = {
  id: string;
  name: string;
  category: SpaceCategory;
  status: SpaceStatus;
  themeColor: string;
  summary: string;
  createdAt: string;
  parentSpaceId?: string;
  templateName?: string;
};

export type Asset = {
  id: string;
  spaceId: string;
  name: string;
  category: string;
  status: AssetStatus;
  note: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpiresAt?: string;
  warrantyNote?: string;
  barcodeValue?: string;
  qrCodeValue?: string;
  currentValue?: number;
};

export type MetricDefinition = {
  id: string;
  spaceId: string;
  assetId?: string;
  name: string;
  valueType: MetricValueType;
  unitLabel?: string;
  safeMin?: number;
  safeMax?: number;
};

export type RoutineStep = {
  id: string;
  label: string;
  kind: "log" | "metric" | "asset";
  assetId?: string;
  metricId?: string;
  generatedLogKind?: LogKind;
};

export type Routine = {
  id: string;
  spaceId: string;
  name: string;
  description: string;
  macroLabel?: string;
  nextDueAt?: string;
  steps: RoutineStep[];
};

export type ReminderHistoryAction =
  | "scheduled"
  | "completed"
  | "snoozed"
  | "skipped";

export type ReminderHistoryEntry = {
  id: string;
  action: ReminderHistoryAction;
  at: string;
  note: string;
};

export type ReminderScheduleRule = {
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  interval?: number;
  weekday?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  weekOfMonth?: 1 | 2 | 3 | 4 | 5 | -1;
  dayOfMonth?: number;
  time?: string;
};

export type ReminderTriggerRule = {
  logKind?: LogKind;
  titleIncludes?: string;
  tagIncludes?: string;
  delayHours?: number;
};

export type Reminder = {
  id: string;
  spaceId: string;
  title: string;
  description: string;
  dueAt: string;
  recurrence?: string;
  ruleLabel?: string;
  triggerCondition?: string;
  scheduleRule?: ReminderScheduleRule;
  triggerRules?: ReminderTriggerRule[];
  snoozedUntil?: string;
  skipReason?: string;
  status: ReminderStatus;
  history?: ReminderHistoryEntry[];
};

export type MetricReading = {
  metricId: string;
  value: string | number | boolean;
  unitLabel?: string;
};

export type MediaAttachment = {
  id: string;
  uri: string;
  mediaType: "photo" | "video" | "file";
  capturedAt: string;
  width?: number;
  height?: number;
  mimeType?: string;
};

export type CapturedLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
};

export type LogEntry = {
  id: string;
  spaceId: string;
  kind: LogKind;
  title: string;
  note: string;
  occurredAt: string;
  assetIds?: string[];
  routineId?: string;
  reminderId?: string;
  metricReadings?: MetricReading[];
  tags?: string[];
  cost?: number;
  locationLabel?: string;
  locationPoint?: CapturedLocation;
  attachmentsCount?: number;
  attachments?: MediaAttachment[];
  parentLogId?: string;
  childLogIds?: string[];
  customFieldValues?: Record<string, CustomFieldValue>;
};

export type QuickAction = {
  id: string;
  label: string;
  kind: QuickActionKind;
  spaceId?: string;
  routineId?: string;
};

export type ExpenseEntry = {
  id: string;
  spaceId: string;
  title: string;
  category: string;
  amount: number;
  currency: string;
  occurredAt: string;
  assetId?: string;
  logId?: string;
  recurring?: string;
};

export type DashboardWidgetType =
  | "chart"
  | "attention"
  | "recommendations"
  | "quick-actions"
  | "reminders"
  | "timeline";

export type DashboardWidget = {
  id: string;
  title: string;
  type: DashboardWidgetType;
  description: string;
  size: "small" | "medium" | "large";
  spaceId?: string;
  metricIds?: string[];
  hidden?: boolean;
};

export type WorkspaceRecommendationSeverity = "high" | "medium" | "low";

export type WorkspaceRecommendationType =
  | "overdue-reminder"
  | "metric-alert"
  | "stale-space"
  | "warranty-expiring";

export type WorkspaceRecommendationAction = {
  kind: "open-planner" | "open-logbook" | "open-inventory";
  label: string;
  actionId?: string;
};

export type WorkspaceRecommendation = {
  id: string;
  type: WorkspaceRecommendationType;
  severity: WorkspaceRecommendationSeverity;
  title: string;
  explanation: string;
  createdAt: string;
  action: WorkspaceRecommendationAction;
  spaceId?: string;
  assetId?: string;
  metricId?: string;
  reminderId?: string;
};

export type TemplateOrigin = "official" | "community";

export type TemplateImportMethod = "deep-link" | "qr-code" | "local";

export type TemplateCatalogItem = {
  id: string;
  name: string;
  summary: string;
  category: string;
  origin: TemplateOrigin;
  importMethods: TemplateImportMethod[];
  supportedFieldTypes: FormFieldType[];
  createdAt?: string;
  formTemplate?: FormTemplate;
};

export type SyncOperationKind =
  | "space-created"
  | "log-created"
  | "reminder-updated"
  | "dashboard-reordered"
  | "dashboard-customized"
  | "logs-imported"
  | "template-imported"
  | "template-saved";

export type SyncQueueEntry = {
  id: string;
  kind: SyncOperationKind;
  summary: string;
  createdAt: string;
  workspaceGeneratedAt: string;
};

export type WorkspaceSnapshot = {
  generatedAt: string;
  spaces: Space[];
  assets: Asset[];
  metricDefinitions: MetricDefinition[];
  routines: Routine[];
  reminders: Reminder[];
  logs: LogEntry[];
  quickActions: QuickAction[];
  expenses: ExpenseEntry[];
  dashboardWidgets: DashboardWidget[];
  templates: TemplateCatalogItem[];
  syncQueue: SyncQueueEntry[];
  lastSyncAt?: string;
  lastSyncError?: string;
};
