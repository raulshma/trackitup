import { Q, type Database, type Model } from "@nozbe/watermelondb";

import { buildTimelineEntriesFromLogs } from "@/constants/TrackItUpSelectors";
import { WATERMELON_TABLES } from "@/services/offline/watermelon/workspaceSchema";
import type { LogEntry, Space } from "@/types/trackitup";

type PersistedRaw = Model["_raw"] & {
  payload_json?: string | null;
};

function parsePayload<T>(record: Model) {
  const raw = record._raw as PersistedRaw;
  if (typeof raw.payload_json !== "string") return null;

  try {
    return JSON.parse(raw.payload_json) as T;
  } catch {
    return null;
  }
}

async function fetchPayloads<T>(
  database: Database,
  tableName: string,
  sortColumn?: string,
) {
  const collection = database.get(tableName);
  const records = await (sortColumn
    ? collection.query(Q.sortBy(sortColumn, Q.desc)).fetch()
    : collection.query().fetch());

  return records
    .map((record) => parsePayload<T>(record))
    .filter((value): value is T => value !== null);
}

export async function loadLogEntriesFromWatermelon(database: Database) {
  return fetchPayloads<LogEntry>(
    database,
    WATERMELON_TABLES.logs,
    "occurred_at",
  );
}

export async function loadLogReadModelFromWatermelon(
  database: Database,
  generatedAt: string,
) {
  const [logEntries, spaces] = await Promise.all([
    loadLogEntriesFromWatermelon(database),
    fetchPayloads<Space>(database, WATERMELON_TABLES.spaces),
  ]);

  return {
    logEntries,
    timelineEntries: buildTimelineEntriesFromLogs(
      logEntries,
      spaces,
      generatedAt,
    ),
  };
}

export async function loadTimelineEntriesFromWatermelon(
  database: Database,
  generatedAt: string,
) {
  const { timelineEntries } = await loadLogReadModelFromWatermelon(
    database,
    generatedAt,
  );
  return timelineEntries;
}
