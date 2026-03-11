import type {
    FormFieldType,
    FormTemplate,
    LogKind,
    QuickActionKind,
} from "@/types/trackitup";

export const fieldTypeLabels: Record<FormFieldType, string> = {
  text: "Text",
  "rich-text": "Rich notes",
  textarea: "Long text",
  number: "Number",
  unit: "Unit selector",
  select: "Select",
  "multi-select": "Multi-select",
  "date-time": "Date & time",
  checkbox: "Checkbox",
  checklist: "Checklist",
  slider: "Slider",
  tags: "Tags",
  media: "Photo / video",
  location: "Location",
  formula: "Calculated field",
};

const quickActionTemplates: Record<QuickActionKind, FormTemplate> = {
  "quick-log": {
    id: "template-quick-log",
    title: "Quick log template",
    description:
      "A flexible event/log schema that adapts to different spaces and reminders.",
    quickActionKind: "quick-log",
    sections: [
      {
        id: "entry-basics",
        title: "Entry basics",
        description: "Core fields needed for any general-purpose log entry.",
        fields: [
          {
            id: "spaceId",
            label: "Space",
            type: "select",
            required: true,
            description:
              "Start here when you want the rest of the form to stay scoped to the right space.",
            source: "spaces",
          },
          {
            id: "title",
            label: "Title",
            type: "text",
            required: true,
            description:
              "Use a short, specific summary so the timeline stays easy to scan later.",
            placeholder: "Water change completed",
          },
          {
            id: "occurredAt",
            label: "Logged at",
            type: "date-time",
            required: true,
            description:
              "This defaults to now. Adjust it only if you are logging something after the fact.",
          },
          {
            id: "note",
            label: "Notes",
            type: "rich-text",
            description:
              "Optional details, observations, or follow-up context for future you.",
            placeholder: "Markdown notes, observations, or steps taken",
          },
        ],
      },
      {
        id: "entry-context",
        title: "Context and follow-up",
        fields: [
          {
            id: "assetIds",
            label: "Related assets",
            type: "multi-select",
            description:
              "Optional: link anything this event affected so it shows up in the right history.",
            source: "assets",
          },
          {
            id: "reminderId",
            label: "Linked reminder",
            type: "select",
            description:
              "Connect the event to an open reminder when this entry resolves or explains it.",
            source: "reminders",
          },
          { id: "tags", label: "Tags", type: "tags" },
          { id: "attachments", label: "Attachments", type: "media" },
          { id: "location", label: "Location", type: "location" },
        ],
      },
    ],
  },
  "metric-entry": {
    id: "template-metric-entry",
    title: "Metric entry template",
    description:
      "A structured schema for capturing readings, units, and safe-zone context.",
    quickActionKind: "metric-entry",
    sections: [
      {
        id: "metric-target",
        title: "Metric target",
        fields: [
          {
            id: "spaceId",
            label: "Space",
            type: "select",
            required: true,
            description:
              "Pick the space first so only relevant metrics appear below.",
            source: "spaces",
          },
          {
            id: "metricId",
            label: "Metric",
            type: "select",
            required: true,
            description: "Choose the metric you just measured.",
            source: "metrics",
          },
          {
            id: "occurredAt",
            label: "Recorded at",
            type: "date-time",
            required: true,
            description:
              "Usually this is the current reading time, but you can backfill older measurements.",
          },
        ],
      },
      {
        id: "metric-reading",
        title: "Reading",
        description:
          "These fields are driven by metric definitions and safe thresholds.",
        fields: [
          {
            id: "value",
            label: "Value",
            type: "number",
            required: true,
            description: "Enter the fresh reading exactly as it was captured.",
            placeholder: "8.4",
          },
          {
            id: "unitLabel",
            label: "Unit",
            type: "unit",
            required: true,
            description:
              "This is usually auto-filled from the selected metric.",
          },
          {
            id: "withinSafeZone",
            label: "Within safe zone",
            type: "checkbox",
            description:
              "Keep this aligned with whether the reading is in range.",
          },
          {
            id: "confidence",
            label: "Confidence",
            type: "slider",
            description: "Use this to note how trustworthy the reading feels.",
          },
          {
            id: "note",
            label: "Observation",
            type: "rich-text",
            description:
              "Optional context when the number alone is not enough.",
          },
        ],
      },
    ],
  },
  "routine-run": {
    id: "template-routine-run",
    title: "Routine run template",
    description:
      "A checklist-style schema for repeating workflows with reusable steps.",
    quickActionKind: "routine-run",
    sections: [
      {
        id: "routine-selection",
        title: "Routine selection",
        fields: [
          {
            id: "spaceId",
            label: "Space",
            type: "select",
            required: true,
            description:
              "Pick the space first so routines and assets stay relevant to the work area.",
            source: "spaces",
          },
          {
            id: "routineId",
            label: "Routine",
            type: "select",
            required: true,
            description: "Choose the routine you just completed.",
            source: "routines",
          },
          {
            id: "completedAt",
            label: "Completed at",
            type: "date-time",
            required: true,
            description:
              "Defaults to now so you can save quickly after finishing the routine.",
          },
        ],
      },
      {
        id: "routine-capture",
        title: "Step capture",
        fields: [
          {
            id: "steps",
            label: "Steps",
            type: "checklist",
            required: true,
            description:
              "Check every step you finished so TrackItUp can generate the right linked records.",
            source: "routines",
          },
          {
            id: "attachments",
            label: "Proof photos",
            type: "media",
            description:
              "Optional but recommended: capture a proof photo before you leave the space so visual history and completion evidence stay linked to this routine run.",
          },
          {
            id: "assetIds",
            label: "Assets touched",
            type: "multi-select",
            description:
              "Optional: link any equipment, plants, tanks, or other assets involved in the run.",
            source: "assets",
            children: [
              {
                id: "doseCost",
                label: "Calculated cost",
                type: "formula",
              },
            ],
          },
          {
            id: "note",
            label: "Notes",
            type: "rich-text",
            description:
              "Only add notes for anything unusual or worth repeating.",
          },
        ],
      },
    ],
  },
};

const logKindTemplates: Record<LogKind, FormTemplate> = {
  "metric-reading": {
    id: "template-log-metric-reading",
    title: "Metric log detail template",
    description: "Shows the schema used to review metric-based log entries.",
    logKind: "metric-reading",
    sections: [
      {
        id: "metric-summary",
        title: "Reading summary",
        fields: [
          { id: "title", label: "Title", type: "text", required: true },
          {
            id: "occurredAt",
            label: "Occurred at",
            type: "date-time",
            required: true,
          },
          {
            id: "metricReadings",
            label: "Metric readings",
            type: "checklist",
            source: "metrics",
          },
          { id: "note", label: "Notes", type: "rich-text" },
        ],
      },
    ],
  },
  "routine-run": {
    id: "template-log-routine-run",
    title: "Routine log detail template",
    description: "Shows the schema used to inspect a completed routine run.",
    logKind: "routine-run",
    sections: [
      {
        id: "routine-summary",
        title: "Routine summary",
        fields: [
          {
            id: "routineId",
            label: "Routine",
            type: "select",
            source: "routines",
          },
          {
            id: "occurredAt",
            label: "Occurred at",
            type: "date-time",
            required: true,
          },
          {
            id: "steps",
            label: "Captured steps",
            type: "checklist",
            source: "routines",
          },
          { id: "note", label: "Notes", type: "rich-text" },
        ],
      },
    ],
  },
  "asset-update": {
    id: "template-log-asset-update",
    title: "Asset update template",
    description:
      "Shows the schema used to connect asset lifecycle events to logs and reminders.",
    logKind: "asset-update",
    sections: [
      {
        id: "asset-summary",
        title: "Asset event",
        fields: [
          {
            id: "assetIds",
            label: "Assets",
            type: "multi-select",
            source: "assets",
          },
          { id: "title", label: "Title", type: "text", required: true },
          { id: "note", label: "Notes", type: "rich-text" },
          {
            id: "reminderId",
            label: "Follow-up reminder",
            type: "select",
            source: "reminders",
          },
        ],
      },
    ],
  },
  reminder: {
    id: "template-log-reminder",
    title: "Reminder log template",
    description:
      "Shows the schema used when reminders create or annotate timeline items.",
    logKind: "reminder",
    sections: [
      {
        id: "reminder-summary",
        title: "Reminder context",
        fields: [
          {
            id: "reminderId",
            label: "Reminder",
            type: "select",
            source: "reminders",
          },
          { id: "title", label: "Title", type: "text", required: true },
          {
            id: "occurredAt",
            label: "Occurred at",
            type: "date-time",
            required: true,
          },
          { id: "note", label: "Notes", type: "rich-text" },
          {
            id: "attachments",
            label: "Proof photos",
            type: "media",
            description:
              "Capture proof photos so reminder completion evidence flows into linked logs and visual history.",
          },
        ],
      },
    ],
  },
};

export function getQuickActionFormTemplate(kind: QuickActionKind) {
  return quickActionTemplates[kind];
}

export function getLogKindFormTemplate(kind: LogKind) {
  return logKindTemplates[kind];
}
