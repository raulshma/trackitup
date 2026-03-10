import { Model } from "@nozbe/watermelondb";

import { WATERMELON_TABLES } from "@/services/offline/watermelon/workspaceSchema";

export class WorkspaceMetaModel extends Model {
  static table = WATERMELON_TABLES.workspaceMeta;
}

export class SpaceModel extends Model {
  static table = WATERMELON_TABLES.spaces;
}

export class AssetModel extends Model {
  static table = WATERMELON_TABLES.assets;
}

export class MetricDefinitionModel extends Model {
  static table = WATERMELON_TABLES.metricDefinitions;
}

export class RoutineModel extends Model {
  static table = WATERMELON_TABLES.routines;
}

export class ReminderModel extends Model {
  static table = WATERMELON_TABLES.reminders;
}

export class LogModel extends Model {
  static table = WATERMELON_TABLES.logs;
}

export class QuickActionModel extends Model {
  static table = WATERMELON_TABLES.quickActions;
}

export class ExpenseModel extends Model {
  static table = WATERMELON_TABLES.expenses;
}

export class DashboardWidgetModel extends Model {
  static table = WATERMELON_TABLES.dashboardWidgets;
}

export class TemplateModel extends Model {
  static table = WATERMELON_TABLES.templates;
}

export const workspaceWatermelonModels = [
  WorkspaceMetaModel,
  SpaceModel,
  AssetModel,
  MetricDefinitionModel,
  RoutineModel,
  ReminderModel,
  LogModel,
  QuickActionModel,
  ExpenseModel,
  DashboardWidgetModel,
  TemplateModel,
];