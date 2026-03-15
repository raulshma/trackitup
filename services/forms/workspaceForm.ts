import type {
    CapturedLocation,
    FormFieldDefinition,
    FormFieldOption,
    FormTemplate,
    LogEntry,
    MediaAttachment,
    QuickAction,
    WorkspaceSnapshot,
} from "@/types/trackitup";

export type FormValue =
  | string
  | number
  | boolean
  | string[]
  | MediaAttachment[]
  | CapturedLocation
  | null;
export type FormValueMap = Record<string, FormValue>;
export type FormValidationErrors = Record<string, string>;

type FormContext = { action?: QuickAction; entry?: LogEntry };

function flattenFields(fields: FormFieldDefinition[]): FormFieldDefinition[] {
  return fields.flatMap((field) => [
    field,
    ...flattenFields(field.children ?? []),
  ]);
}

function flattenTemplate(template: FormTemplate) {
  return template.sections.flatMap((section) => flattenFields(section.fields));
}

function asString(value: FormValue) {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: FormValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asNumber(value: FormValue) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isCapturedLocation(value: FormValue): value is CapturedLocation {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as CapturedLocation).latitude === "number" &&
    typeof (value as CapturedLocation).longitude === "number",
  );
}

function asMediaAttachments(value: FormValue) {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is MediaAttachment =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.uri === "string",
  );
}

function asMetricValue(value: FormValue): string | number | boolean {
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (!value.trim()) return "";
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return "";
}

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function hasSelectedSpace(
  value: { spaceId?: string; spaceIds?: string[] },
  selectedSpaceIds: string[],
) {
  if (selectedSpaceIds.length === 0) return true;
  const entitySpaceIds = normalizeSpaceIds(value);
  return selectedSpaceIds.some((spaceId) => entitySpaceIds.includes(spaceId));
}

function getSelectedSpaceId(
  workspace: WorkspaceSnapshot,
  values: FormValueMap,
  context: FormContext,
) {
  const selectedSpaceIds = getSelectedSpaceIds(workspace, values, context);
  if (selectedSpaceIds.length > 0) {
    return selectedSpaceIds[0];
  }

  return (
    asString(values.spaceId) ||
    context.entry?.spaceId ||
    context.action?.spaceId ||
    workspace.spaces[0]?.id ||
    ""
  );
}

function getSelectedSpaceIds(
  workspace: WorkspaceSnapshot,
  values: FormValueMap,
  context: FormContext,
) {
  const fromValues = asStringArray(values.spaceIds);
  if (fromValues.length > 0) {
    return Array.from(new Set(fromValues));
  }

  const fromSingleValue = asString(values.spaceId);
  if (fromSingleValue) {
    return [fromSingleValue];
  }

  const fromEntry = normalizeSpaceIds({
    spaceId: context.entry?.spaceId,
    spaceIds: context.entry?.spaceIds,
  });
  if (fromEntry.length > 0) {
    return fromEntry;
  }

  if (context.action?.spaceId) {
    return [context.action.spaceId];
  }

  return workspace.spaces[0]?.id ? [workspace.spaces[0].id] : [];
}

function getMetricForValues(
  workspace: WorkspaceSnapshot,
  values: FormValueMap,
  context: FormContext,
) {
  const selectedSpaceId = getSelectedSpaceId(workspace, values, context);
  const metricId = asString(values.metricId);

  return (
    workspace.metricDefinitions.find((metric) => metric.id === metricId) ||
    (context.entry?.metricReadings?.[0]
      ? workspace.metricDefinitions.find(
          (metric) =>
            metric.id === context.entry?.metricReadings?.[0]?.metricId,
        )
      : undefined) ||
    workspace.metricDefinitions.find((metric) =>
      hasSelectedSpace(metric, [selectedSpaceId]),
    )
  );
}

function getRoutineForValues(
  workspace: WorkspaceSnapshot,
  values: FormValueMap,
  context: FormContext,
) {
  const selectedSpaceIds = getSelectedSpaceIds(workspace, values, context);
  const routineId = asString(values.routineId);

  return (
    workspace.routines.find((routine) => routine.id === routineId) ||
    (context.action?.routineId
      ? workspace.routines.find(
          (routine) => routine.id === context.action?.routineId,
        )
      : undefined) ||
    (context.entry?.routineId
      ? workspace.routines.find(
          (routine) => routine.id === context.entry?.routineId,
        )
      : undefined) ||
    workspace.routines.find((routine) =>
      hasSelectedSpace(routine, selectedSpaceIds),
    )
  );
}

function isMetricInSafeZone(
  workspace: WorkspaceSnapshot,
  values: FormValueMap,
  context: FormContext,
) {
  const metric = getMetricForValues(workspace, values, context);
  const value = asNumber(values.value);
  if (!metric || value === undefined) return true;
  if (metric.safeMin !== undefined && value < metric.safeMin) return false;
  if (metric.safeMax !== undefined && value > metric.safeMax) return false;
  return true;
}

export function getFieldOptions(
  field: FormFieldDefinition,
  workspace: WorkspaceSnapshot,
  values: FormValueMap,
  context: FormContext = {},
): FormFieldOption[] {
  if (field.options?.length) return field.options;

  const selectedSpaceIds = getSelectedSpaceIds(workspace, values, context);

  switch (field.source) {
    case "spaces":
      return workspace.spaces.map((space) => ({
        label: space.name,
        value: space.id,
      }));
    case "assets":
      return workspace.assets
        .filter((asset) => hasSelectedSpace(asset, selectedSpaceIds))
        .map((asset) => ({ label: asset.name, value: asset.id }));
    case "metrics":
      return workspace.metricDefinitions
        .filter((metric) => hasSelectedSpace(metric, selectedSpaceIds))
        .map((metric) => ({
          label: metric.unitLabel
            ? `${metric.name} (${metric.unitLabel})`
            : metric.name,
          value: metric.id,
        }));
    case "routines": {
      if (field.id === "steps") {
        const routine = getRoutineForValues(workspace, values, context);
        return (routine?.steps ?? []).map((step) => ({
          label: step.label,
          value: step.id,
        }));
      }

      return workspace.routines
        .filter((routine) => hasSelectedSpace(routine, selectedSpaceIds))
        .map((routine) => ({ label: routine.name, value: routine.id }));
    }
    case "reminders":
      return workspace.reminders
        .filter((reminder) => hasSelectedSpace(reminder, selectedSpaceIds))
        .map((reminder) => ({ label: reminder.title, value: reminder.id }));
    case "logs":
      return workspace.logs
        .filter((log) => hasSelectedSpace(log, selectedSpaceIds))
        .slice(0, 8)
        .map((log) => ({ label: log.title, value: log.id }));
    default:
      return [];
  }
}

export function formatCapturedLocation(value: CapturedLocation) {
  const accuracyLabel =
    value.accuracy !== undefined ? ` • ±${Math.round(value.accuracy)}m` : "";
  return `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}${accuracyLabel}`;
}

function getDefaultValue(
  field: FormFieldDefinition,
  workspace: WorkspaceSnapshot,
  context: FormContext,
) {
  const entry = context.entry;
  const metric = entry?.metricReadings?.[0]
    ? workspace.metricDefinitions.find(
        (item) => item.id === entry.metricReadings?.[0]?.metricId,
      )
    : undefined;
  const routine = entry?.routineId
    ? workspace.routines.find((item) => item.id === entry.routineId)
    : context.action?.routineId
      ? workspace.routines.find((item) => item.id === context.action?.routineId)
      : undefined;

  switch (field.id) {
    case "spaceId":
      return (
        entry?.spaceId ??
        context.action?.spaceId ??
        workspace.spaces[0]?.id ??
        ""
      );
    case "spaceIds": {
      const selected = normalizeSpaceIds({
        spaceId: entry?.spaceId ?? context.action?.spaceId,
        spaceIds: entry?.spaceIds,
      });
      return selected.length > 0
        ? selected
        : workspace.spaces[0]?.id
          ? [workspace.spaces[0].id]
          : [];
    }
    case "title":
      return entry?.title ?? "";
    case "occurredAt":
    case "completedAt":
      return entry?.occurredAt ?? workspace.generatedAt;
    case "note":
      return entry?.note ?? "";
    case "metricId":
      return entry?.metricReadings?.[0]?.metricId ?? metric?.id ?? "";
    case "metricReadings":
      return entry?.metricReadings?.map((reading) => reading.metricId) ?? [];
    case "value":
      return entry?.metricReadings?.[0]?.value ?? "";
    case "unitLabel":
      return entry?.metricReadings?.[0]?.unitLabel ?? metric?.unitLabel ?? "";
    case "withinSafeZone":
      return entry?.metricReadings?.[0]
        ? isMetricInSafeZone(
            workspace,
            { value: entry.metricReadings[0].value },
            context,
          )
        : true;
    case "confidence":
      return 75;
    case "routineId":
      return entry?.routineId ?? routine?.id ?? "";
    case "steps":
      return routine?.steps.map((step) => step.id) ?? [];
    case "assetIds":
      return entry?.assetIds ?? [];
    case "reminderId":
      return entry?.reminderId ?? "";
    case "tags":
      return entry?.tags ?? [];
    case "attachments":
      return entry?.attachments ?? [];
    case "location":
      return entry?.locationPoint ?? entry?.locationLabel ?? null;
    case "doseCost":
      return entry?.cost ?? null;
    default:
      switch (field.type) {
        case "checkbox":
          return false;
        case "checklist":
        case "multi-select":
        case "tags":
          return [];
        case "formula":
          return null;
        default:
          return "";
      }
  }
}

export function buildInitialFormValues(
  template: FormTemplate,
  workspace: WorkspaceSnapshot,
  context: FormContext = {},
): FormValueMap {
  const values = flattenTemplate(template).reduce<FormValueMap>(
    (current, field) => {
      current[field.id] = getDefaultValue(field, workspace, context);
      return current;
    },
    {},
  );

  return normalizeFormValues(template, workspace, values, context);
}

export function normalizeFormValues(
  template: FormTemplate,
  workspace: WorkspaceSnapshot,
  values: FormValueMap,
  context: FormContext = {},
) {
  const nextValues = { ...values };
  const fields = flattenTemplate(template);

  const metricField = fields.find((field) => field.id === "metricId");
  const metricOptions = metricField
    ? getFieldOptions(metricField, workspace, nextValues, context)
    : [];
  const selectedMetricId = asString(nextValues.metricId);
  if (
    metricField &&
    selectedMetricId &&
    !metricOptions.some((option) => option.value === selectedMetricId)
  ) {
    nextValues.metricId = metricOptions[0]?.value ?? "";
  }

  const routineField = fields.find((field) => field.id === "routineId");
  const routineOptions = routineField
    ? getFieldOptions(routineField, workspace, nextValues, context)
    : [];
  const selectedRoutineId = asString(nextValues.routineId);
  if (
    routineField &&
    selectedRoutineId &&
    !routineOptions.some((option) => option.value === selectedRoutineId)
  ) {
    nextValues.routineId = routineOptions[0]?.value ?? "";
  }

  const reminderField = fields.find((field) => field.id === "reminderId");
  const reminderOptions = reminderField
    ? getFieldOptions(reminderField, workspace, nextValues, context)
    : [];
  const selectedReminderId = asString(nextValues.reminderId);
  if (
    reminderField &&
    selectedReminderId &&
    !reminderOptions.some((option) => option.value === selectedReminderId)
  ) {
    nextValues.reminderId = "";
  }

  const assetField = fields.find((field) => field.id === "assetIds");
  const assetOptions = assetField
    ? getFieldOptions(assetField, workspace, nextValues, context)
    : [];
  nextValues.assetIds = asStringArray(nextValues.assetIds).filter((value) =>
    assetOptions.some((option) => option.value === value),
  );

  const stepsField = fields.find((field) => field.id === "steps");
  const stepOptions = stepsField
    ? getFieldOptions(stepsField, workspace, nextValues, context)
    : [];
  nextValues.steps = asStringArray(nextValues.steps).filter((value) =>
    stepOptions.some((option) => option.value === value),
  );

  if (fields.some((field) => field.id === "unitLabel")) {
    const metric = getMetricForValues(workspace, nextValues, context);
    if (!asString(nextValues.unitLabel) && metric?.unitLabel) {
      nextValues.unitLabel = metric.unitLabel;
    }
  }

  if (fields.some((field) => field.id === "withinSafeZone")) {
    nextValues.withinSafeZone = isMetricInSafeZone(
      workspace,
      nextValues,
      context,
    );
  }

  if (fields.some((field) => field.id === "doseCost")) {
    nextValues.doseCost = getFormulaValue("doseCost", workspace, nextValues);
  }

  return nextValues;
}

export function validateFormValues(
  template: FormTemplate,
  values: FormValueMap,
) {
  return flattenTemplate(template).reduce<FormValidationErrors>(
    (errors, field) => {
      if (!field.required) return errors;

      const value = values[field.id];
      const isMissing =
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim().length === 0) ||
        (Array.isArray(value) && value.length === 0);

      if (isMissing) {
        errors[field.id] = `${field.label} is required.`;
      }

      return errors;
    },
    {},
  );
}

export function getFormulaValue(
  fieldId: string,
  workspace: WorkspaceSnapshot,
  values: FormValueMap,
) {
  if (fieldId !== "doseCost") return "";

  const total = asStringArray(values.assetIds)
    .map(
      (assetId) =>
        workspace.assets.find((asset) => asset.id === assetId)?.purchasePrice ??
        0,
    )
    .reduce((sum, value) => sum + value, 0);

  return total.toFixed(2);
}

function getLocationDetails(value: FormValue) {
  if (isCapturedLocation(value)) {
    return {
      locationPoint: value,
      locationLabel: formatCapturedLocation(value),
    };
  }

  if (typeof value === "string" && value.trim()) {
    return {
      locationPoint: undefined,
      locationLabel: value.trim(),
    };
  }

  return {
    locationPoint: undefined,
    locationLabel: undefined,
  };
}

const systemFieldIds = new Set([
  "spaceId",
  "spaceIds",
  "title",
  "occurredAt",
  "completedAt",
  "note",
  "assetIds",
  "reminderId",
  "tags",
  "location",
  "attachments",
  "metricId",
  "value",
  "unitLabel",
  "withinSafeZone",
  "confidence",
  "routineId",
  "steps",
  "doseCost",
]);

function getCustomFieldValues(
  template: FormTemplate | undefined,
  values: FormValueMap,
) {
  if (!template) return undefined;

  const customFieldValues = flattenTemplate(template).reduce<
    Record<string, Exclude<FormValue, null>>
  >((current, field) => {
    if (systemFieldIds.has(field.id)) return current;

    const value = values[field.id];
    const isEmpty =
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim().length === 0) ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) return current;
    current[field.label] = value as Exclude<FormValue, null>;
    return current;
  }, {});

  return Object.keys(customFieldValues).length > 0
    ? customFieldValues
    : undefined;
}

function buildBaseLogEntry(
  workspace: WorkspaceSnapshot,
  action: QuickAction,
  values: FormValueMap,
  template?: FormTemplate,
) {
  const spaceIds = getSelectedSpaceIds(workspace, values, { action });
  const spaceId = spaceIds[0];
  if (!spaceId || spaceIds.length === 0) return undefined;

  const occurredAt =
    asString(values.completedAt) ||
    asString(values.occurredAt) ||
    new Date().toISOString();
  const note = asString(values.note);
  const assetIds = asStringArray(values.assetIds);
  const tags = asStringArray(values.tags);
  const { locationLabel, locationPoint } = getLocationDetails(values.location);
  const attachments = asMediaAttachments(values.attachments);
  const attachmentsCount = attachments.length || asNumber(values.attachments);
  const customFieldValues = getCustomFieldValues(template, values);

  return {
    spaceId,
    spaceIds,
    occurredAt,
    note,
    assetIds,
    tags,
    locationLabel,
    locationPoint,
    attachments,
    attachmentsCount,
    customFieldValues,
  };
}

function getRoutineMetricReading(
  workspace: WorkspaceSnapshot,
  spaceIds: string[],
  routine: ReturnType<typeof getRoutineForValues>,
  step: NonNullable<ReturnType<typeof getRoutineForValues>>["steps"][number],
) {
  const metric =
    (step.metricId &&
      workspace.metricDefinitions.find((item) => item.id === step.metricId)) ||
    workspace.metricDefinitions.find((item) =>
      hasSelectedSpace(item, spaceIds),
    );
  if (!metric) return undefined;

  if (metric.valueType === "boolean") {
    return { metricId: metric.id, value: true, unitLabel: metric.unitLabel };
  }

  if (metric.valueType === "text") {
    return {
      metricId: metric.id,
      value: `Captured during ${routine?.name ?? "routine"}`,
      unitLabel: metric.unitLabel,
    };
  }

  const safeFloor = metric.safeMin ?? 1;
  const safeCeiling = metric.safeMax ?? safeFloor;
  const value = Number(
    ((safeFloor + safeCeiling) / 2).toFixed(metric.unitLabel === "SG" ? 3 : 1),
  );

  return { metricId: metric.id, value, unitLabel: metric.unitLabel };
}

function buildRoutineStepLogEntries(
  workspace: WorkspaceSnapshot,
  action: QuickAction,
  values: FormValueMap,
  parentLogId: string,
  template?: FormTemplate,
) {
  const baseEntry = buildBaseLogEntry(workspace, action, values, template);
  const routine = getRoutineForValues(workspace, values, { action });
  if (!baseEntry || !routine) return [];

  const selectedStepIds = asStringArray(values.steps);
  const selectedSteps = routine.steps.filter((step) =>
    selectedStepIds.length > 0 ? selectedStepIds.includes(step.id) : true,
  );

  return selectedSteps.map((step) => {
    const relatedAssetIds = [step.assetId, ...baseEntry.assetIds].filter(
      (item): item is string => Boolean(item),
    );
    const routineTags = Array.from(
      new Set([...(baseEntry.tags ?? []), "routine-macro", step.kind]),
    );
    const metricReading =
      step.kind === "metric"
        ? getRoutineMetricReading(workspace, baseEntry.spaceIds, routine, step)
        : undefined;
    const kind =
      step.generatedLogKind ??
      (metricReading ? "metric-reading" : "asset-update");

    return {
      id: `${parentLogId}-${step.id}`,
      parentLogId,
      spaceId: baseEntry.spaceId,
      spaceIds: baseEntry.spaceIds,
      kind,
      title: `${routine.name} • ${step.label}`,
      note:
        baseEntry.note ||
        `Generated automatically from the ${routine.macroLabel ?? action.label} routine macro.`,
      occurredAt: baseEntry.occurredAt,
      assetIds: relatedAssetIds.length > 0 ? relatedAssetIds : undefined,
      metricReadings: metricReading ? [metricReading] : undefined,
      tags: routineTags,
      locationLabel: baseEntry.locationLabel,
      locationPoint: baseEntry.locationPoint,
    };
  });
}

export function buildLogEntriesFromActionDraft(
  workspace: WorkspaceSnapshot,
  action: QuickAction,
  values: FormValueMap,
  template?: FormTemplate,
) {
  const baseEntry = buildBaseLogEntry(workspace, action, values, template);
  if (!baseEntry) return [];

  if (action.kind === "metric-entry") {
    const metric = getMetricForValues(workspace, values, { action });
    const metricValue = asMetricValue(values.value);

    return [
      {
        id: `log-${action.id}-${Date.now()}`,
        spaceId: baseEntry.spaceId,
        spaceIds: baseEntry.spaceIds,
        kind: "metric-reading" as const,
        title: asString(values.title) || `${metric?.name ?? "Metric"} captured`,
        note:
          baseEntry.note || `Captured from the ${action.label} dynamic form.`,
        occurredAt: baseEntry.occurredAt,
        metricReadings: metric
          ? [
              {
                metricId: metric.id,
                value: metricValue,
                unitLabel: asString(values.unitLabel) || metric.unitLabel,
              },
            ]
          : undefined,
        tags: baseEntry.tags.length > 0 ? baseEntry.tags : undefined,
        locationLabel: baseEntry.locationLabel,
        locationPoint: baseEntry.locationPoint,
        attachmentsCount: baseEntry.attachmentsCount,
        attachments:
          baseEntry.attachments.length > 0 ? baseEntry.attachments : undefined,
        customFieldValues: baseEntry.customFieldValues,
      },
    ];
  }

  if (action.kind === "routine-run") {
    const routine = getRoutineForValues(workspace, values, { action });
    const cost = asNumber(values.doseCost);
    const parentId = `log-${action.id}-${Date.now()}`;
    const stepLogs = buildRoutineStepLogEntries(
      workspace,
      action,
      values,
      parentId,
      template,
    );

    return [
      {
        id: parentId,
        spaceId: baseEntry.spaceId,
        spaceIds: baseEntry.spaceIds,
        kind: "routine-run" as const,
        title:
          asString(values.title) || `${routine?.name ?? "Routine"} completed`,
        note:
          baseEntry.note ||
          `Completed from the ${action.label} dynamic form with ${stepLogs.length} automated step log(s).`,
        occurredAt: baseEntry.occurredAt,
        routineId: routine?.id,
        assetIds:
          baseEntry.assetIds.length > 0 ? baseEntry.assetIds : undefined,
        cost,
        tags: baseEntry.tags.length > 0 ? baseEntry.tags : undefined,
        locationLabel: baseEntry.locationLabel,
        locationPoint: baseEntry.locationPoint,
        attachmentsCount: baseEntry.attachmentsCount,
        attachments:
          baseEntry.attachments.length > 0 ? baseEntry.attachments : undefined,
        childLogIds: stepLogs.map((item) => item.id),
        customFieldValues: baseEntry.customFieldValues,
      },
      ...stepLogs,
    ];
  }

  return [
    {
      id: `log-${action.id}-${Date.now()}`,
      spaceId: baseEntry.spaceId,
      spaceIds: baseEntry.spaceIds,
      kind: "asset-update" as const,
      title: asString(values.title) || `Quick log for ${action.label}`,
      note: baseEntry.note || "Captured from the dynamic quick-log form.",
      occurredAt: baseEntry.occurredAt,
      assetIds: baseEntry.assetIds.length > 0 ? baseEntry.assetIds : undefined,
      reminderId: asString(values.reminderId) || undefined,
      tags: baseEntry.tags.length > 0 ? baseEntry.tags : undefined,
      locationLabel: baseEntry.locationLabel,
      locationPoint: baseEntry.locationPoint,
      attachmentsCount: baseEntry.attachmentsCount,
      attachments:
        baseEntry.attachments.length > 0 ? baseEntry.attachments : undefined,
      customFieldValues: baseEntry.customFieldValues,
    },
  ];
}

export function buildLogEntryFromActionDraft(
  workspace: WorkspaceSnapshot,
  action: QuickAction,
  values: FormValueMap,
  template?: FormTemplate,
) {
  return buildLogEntriesFromActionDraft(workspace, action, values, template)[0];
}
