import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const WATERMELON_TABLES = {
  workspaceMeta: "workspace_meta",
  spaces: "spaces",
  assets: "assets",
  metricDefinitions: "metric_definitions",
  routines: "routines",
  reminders: "reminders",
  logs: "logs",
  quickActions: "quick_actions",
  expenses: "expenses",
  dashboardWidgets: "dashboard_widgets",
  templates: "templates",
} as const;

const payloadColumn = { name: "payload_json", type: "string" as const };
const positionColumn = {
  name: "position",
  type: "number" as const,
  isIndexed: true,
};

export const workspaceWatermelonSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: WATERMELON_TABLES.workspaceMeta,
      columns: [
        { name: "generated_at", type: "string", isIndexed: true },
        { name: "snapshot_version", type: "number" },
        { name: "payload_json", type: "string", isOptional: true },
      ],
    }),
    tableSchema({
      name: WATERMELON_TABLES.spaces,
      columns: [
        positionColumn,
        { name: "name", type: "string", isIndexed: true },
        { name: "category", type: "string", isIndexed: true },
        { name: "status", type: "string", isIndexed: true },
        { name: "space_created_at", type: "string" },
        { name: "parent_space_id", type: "string", isOptional: true },
        { name: "template_name", type: "string", isOptional: true },
        payloadColumn,
      ],
    }),
    tableSchema({
      name: WATERMELON_TABLES.assets,
      columns: [
        positionColumn,
        { name: "space_id", type: "string", isIndexed: true },
        { name: "name", type: "string", isIndexed: true },
        { name: "category", type: "string", isIndexed: true },
        { name: "status", type: "string", isIndexed: true },
        { name: "barcode_value", type: "string", isOptional: true },
        { name: "qr_code_value", type: "string", isOptional: true },
        payloadColumn,
      ],
    }),
    tableSchema({
      name: WATERMELON_TABLES.metricDefinitions,
      columns: [
        positionColumn,
        { name: "space_id", type: "string", isIndexed: true },
        { name: "asset_id", type: "string", isOptional: true },
        { name: "name", type: "string", isIndexed: true },
        { name: "value_type", type: "string" },
        payloadColumn,
      ],
    }),
    tableSchema({
      name: WATERMELON_TABLES.routines,
      columns: [
        positionColumn,
        { name: "space_id", type: "string", isIndexed: true },
        { name: "name", type: "string", isIndexed: true },
        { name: "next_due_at", type: "string", isOptional: true },
        payloadColumn,
      ],
    }),
    tableSchema({
      name: WATERMELON_TABLES.reminders,
      columns: [
        positionColumn,
        { name: "space_id", type: "string", isIndexed: true },
        { name: "title", type: "string", isIndexed: true },
        { name: "status", type: "string", isIndexed: true },
        { name: "due_at", type: "string", isIndexed: true },
        { name: "snoozed_until", type: "string", isOptional: true },
        payloadColumn,
      ],
    }),
    tableSchema({
      name: WATERMELON_TABLES.logs,
      columns: [
        positionColumn,
        { name: "space_id", type: "string", isIndexed: true },
        { name: "kind", type: "string", isIndexed: true },
        { name: "title", type: "string", isIndexed: true },
        { name: "occurred_at", type: "string", isIndexed: true },
        { name: "routine_id", type: "string", isOptional: true },
        { name: "reminder_id", type: "string", isOptional: true },
        { name: "attachments_count", type: "number", isOptional: true },
        payloadColumn,
      ],
    }),
    tableSchema({
      name: WATERMELON_TABLES.quickActions,
      columns: [
        positionColumn,
        { name: "space_id", type: "string", isOptional: true },
        { name: "routine_id", type: "string", isOptional: true },
        { name: "label", type: "string", isIndexed: true },
        { name: "kind", type: "string", isIndexed: true },
        payloadColumn,
      ],
    }),
    tableSchema({
      name: WATERMELON_TABLES.expenses,
      columns: [
        positionColumn,
        { name: "space_id", type: "string", isIndexed: true },
        { name: "asset_id", type: "string", isOptional: true },
        { name: "log_id", type: "string", isOptional: true },
        { name: "title", type: "string", isIndexed: true },
        { name: "category", type: "string", isIndexed: true },
        { name: "amount", type: "number" },
        { name: "occurred_at", type: "string", isIndexed: true },
        payloadColumn,
      ],
    }),
    tableSchema({
      name: WATERMELON_TABLES.dashboardWidgets,
      columns: [
        positionColumn,
        { name: "space_id", type: "string", isOptional: true },
        { name: "title", type: "string", isIndexed: true },
        { name: "type", type: "string", isIndexed: true },
        { name: "size", type: "string" },
        payloadColumn,
      ],
    }),
    tableSchema({
      name: WATERMELON_TABLES.templates,
      columns: [
        positionColumn,
        { name: "name", type: "string", isIndexed: true },
        { name: "category", type: "string", isIndexed: true },
        { name: "origin", type: "string", isIndexed: true },
        payloadColumn,
      ],
    }),
  ],
});
