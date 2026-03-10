import { Q, type Database, type Model } from "@nozbe/watermelondb";

import { WATERMELON_TABLES } from "@/services/offline/watermelon/workspaceSchema";
import { normalizeWorkspaceSnapshot } from "@/services/offline/workspacePersistenceStrategy";
import type {
    Asset,
    DashboardWidget,
    ExpenseEntry,
    LogEntry,
    MetricDefinition,
    QuickAction,
    Reminder,
    Routine,
    Space,
    TemplateCatalogItem,
    WorkspaceSnapshot,
} from "@/types/trackitup";

type CloneWorkspaceSnapshot = (
  snapshot: WorkspaceSnapshot,
) => WorkspaceSnapshot;

type PersistedRaw = Model["_raw"] & {
  payload_json?: string | null;
  generated_at?: string | null;
};

type WorkspaceMetaPayload = Pick<
  WorkspaceSnapshot,
  "syncQueue" | "lastSyncAt" | "lastSyncError"
>;

const SNAPSHOT_VERSION = 1;
const META_RECORD_ID = "workspace";

function getPersistedRaw(record: Model) {
  return record._raw as PersistedRaw;
}

function parsePayload<T>(record: Model): T | null {
  const raw = getPersistedRaw(record);
  if (typeof raw.payload_json !== "string") return null;

  try {
    return JSON.parse(raw.payload_json) as T;
  } catch {
    return null;
  }
}

async function fetchOrderedPayloads<T>(database: Database, tableName: string) {
  const records = await database
    .get(tableName)
    .query(Q.sortBy("position", Q.asc))
    .fetch();
  return records
    .map((record) => parsePayload<T>(record))
    .filter((value): value is T => value !== null);
}

function createRawRecord(
  id: string,
  position: number,
  payload: object,
  columns: Record<string, string | number | boolean | null | undefined>,
) {
  return {
    id,
    position,
    payload_json: JSON.stringify(payload),
    ...columns,
  };
}

export async function loadWorkspaceSnapshotFromWatermelon(
  database: Database,
  defaultWorkspace: WorkspaceSnapshot,
  cloneWorkspaceSnapshot: CloneWorkspaceSnapshot,
): Promise<WorkspaceSnapshot | null> {
  const [
    metaRecords,
    spaces,
    assets,
    metricDefinitions,
    routines,
    reminders,
    logs,
    quickActions,
    expenses,
    dashboardWidgets,
    templates,
  ] = await Promise.all([
    database.get(WATERMELON_TABLES.workspaceMeta).query().fetch(),
    fetchOrderedPayloads<Space>(database, WATERMELON_TABLES.spaces),
    fetchOrderedPayloads<Asset>(database, WATERMELON_TABLES.assets),
    fetchOrderedPayloads<MetricDefinition>(
      database,
      WATERMELON_TABLES.metricDefinitions,
    ),
    fetchOrderedPayloads<Routine>(database, WATERMELON_TABLES.routines),
    fetchOrderedPayloads<Reminder>(database, WATERMELON_TABLES.reminders),
    fetchOrderedPayloads<LogEntry>(database, WATERMELON_TABLES.logs),
    fetchOrderedPayloads<QuickAction>(database, WATERMELON_TABLES.quickActions),
    fetchOrderedPayloads<ExpenseEntry>(database, WATERMELON_TABLES.expenses),
    fetchOrderedPayloads<DashboardWidget>(
      database,
      WATERMELON_TABLES.dashboardWidgets,
    ),
    fetchOrderedPayloads<TemplateCatalogItem>(
      database,
      WATERMELON_TABLES.templates,
    ),
  ]);

  if (metaRecords.length === 0) {
    return null;
  }

  const metaRecord = metaRecords[0];
  const generatedAt =
    getPersistedRaw(metaRecord).generated_at ?? defaultWorkspace.generatedAt;
  const metaPayload = parsePayload<WorkspaceMetaPayload>(metaRecord) ?? {
    syncQueue: defaultWorkspace.syncQueue,
    lastSyncAt: defaultWorkspace.lastSyncAt,
    lastSyncError: defaultWorkspace.lastSyncError,
  };

  return normalizeWorkspaceSnapshot(
    {
      generatedAt,
      spaces,
      assets,
      metricDefinitions,
      routines,
      reminders,
      logs,
      quickActions,
      expenses,
      dashboardWidgets,
      templates,
      syncQueue: metaPayload.syncQueue,
      lastSyncAt: metaPayload.lastSyncAt,
      lastSyncError: metaPayload.lastSyncError,
    },
    defaultWorkspace,
    cloneWorkspaceSnapshot,
  );
}

export async function persistWorkspaceSnapshotToWatermelon(
  database: Database,
  snapshot: WorkspaceSnapshot,
) {
  await database.unsafeResetDatabase();

  const operations = [
    database.get(WATERMELON_TABLES.workspaceMeta).prepareCreateFromDirtyRaw({
      id: META_RECORD_ID,
      generated_at: snapshot.generatedAt,
      snapshot_version: SNAPSHOT_VERSION,
      payload_json: JSON.stringify({
        syncQueue: snapshot.syncQueue,
        lastSyncAt: snapshot.lastSyncAt,
        lastSyncError: snapshot.lastSyncError,
      }),
    }),
    ...snapshot.spaces.map((item, index) =>
      database.get(WATERMELON_TABLES.spaces).prepareCreateFromDirtyRaw(
        createRawRecord(item.id, index, item, {
          name: item.name,
          category: item.category,
          status: item.status,
          space_created_at: item.createdAt,
          parent_space_id: item.parentSpaceId,
          template_name: item.templateName,
        }),
      ),
    ),
    ...snapshot.assets.map((item, index) =>
      database.get(WATERMELON_TABLES.assets).prepareCreateFromDirtyRaw(
        createRawRecord(item.id, index, item, {
          space_id: item.spaceId,
          name: item.name,
          category: item.category,
          status: item.status,
          barcode_value: item.barcodeValue,
          qr_code_value: item.qrCodeValue,
        }),
      ),
    ),
    ...snapshot.metricDefinitions.map((item, index) =>
      database
        .get(WATERMELON_TABLES.metricDefinitions)
        .prepareCreateFromDirtyRaw(
          createRawRecord(item.id, index, item, {
            space_id: item.spaceId,
            asset_id: item.assetId,
            name: item.name,
            value_type: item.valueType,
          }),
        ),
    ),
    ...snapshot.routines.map((item, index) =>
      database.get(WATERMELON_TABLES.routines).prepareCreateFromDirtyRaw(
        createRawRecord(item.id, index, item, {
          space_id: item.spaceId,
          name: item.name,
          next_due_at: item.nextDueAt,
        }),
      ),
    ),
    ...snapshot.reminders.map((item, index) =>
      database.get(WATERMELON_TABLES.reminders).prepareCreateFromDirtyRaw(
        createRawRecord(item.id, index, item, {
          space_id: item.spaceId,
          title: item.title,
          status: item.status,
          due_at: item.dueAt,
          snoozed_until: item.snoozedUntil,
        }),
      ),
    ),
    ...snapshot.logs.map((item, index) =>
      database.get(WATERMELON_TABLES.logs).prepareCreateFromDirtyRaw(
        createRawRecord(item.id, index, item, {
          space_id: item.spaceId,
          kind: item.kind,
          title: item.title,
          occurred_at: item.occurredAt,
          routine_id: item.routineId,
          reminder_id: item.reminderId,
          attachments_count: item.attachmentsCount,
        }),
      ),
    ),
    ...snapshot.quickActions.map((item, index) =>
      database.get(WATERMELON_TABLES.quickActions).prepareCreateFromDirtyRaw(
        createRawRecord(item.id, index, item, {
          space_id: item.spaceId,
          routine_id: item.routineId,
          label: item.label,
          kind: item.kind,
        }),
      ),
    ),
    ...snapshot.expenses.map((item, index) =>
      database.get(WATERMELON_TABLES.expenses).prepareCreateFromDirtyRaw(
        createRawRecord(item.id, index, item, {
          space_id: item.spaceId,
          asset_id: item.assetId,
          log_id: item.logId,
          title: item.title,
          category: item.category,
          amount: item.amount,
          occurred_at: item.occurredAt,
        }),
      ),
    ),
    ...snapshot.dashboardWidgets.map((item, index) =>
      database
        .get(WATERMELON_TABLES.dashboardWidgets)
        .prepareCreateFromDirtyRaw(
          createRawRecord(item.id, index, item, {
            space_id: item.spaceId,
            title: item.title,
            type: item.type,
            size: item.size,
          }),
        ),
    ),
    ...snapshot.templates.map((item, index) =>
      database.get(WATERMELON_TABLES.templates).prepareCreateFromDirtyRaw(
        createRawRecord(item.id, index, item, {
          name: item.name,
          category: item.category,
          origin: item.origin,
        }),
      ),
    ),
  ];

  await database.write(async () => {
    await database.batch(operations);
  });
}
