import type { LogEntry, LogKind, WorkspaceSnapshot } from "@/types/trackitup";

const logKinds = new Set<LogKind>([
  "metric-reading",
  "routine-run",
  "asset-update",
  "reminder",
]);

export type WorkspaceLogCsvImportResult = {
  logs: LogEntry[];
  warnings: string[];
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === '"') {
      if (inQuotes && input[index + 1] === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";

      if (character === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }

    currentValue += character;
  }

  currentRow.push(currentValue);
  rows.push(currentRow);

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function splitListCell(value: string) {
  return value
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp)
    ? undefined
    : new Date(timestamp).toISOString();
}

export function parseWorkspaceLogCsv(
  csv: string,
  workspace: WorkspaceSnapshot,
): WorkspaceLogCsvImportResult {
  const rows = parseCsvRows(csv.trim());
  if (rows.length < 2) {
    return {
      logs: [],
      warnings: [
        "Add a header row and at least one data row before importing.",
      ],
    };
  }

  const headers = rows[0].map(normalizeHeader);
  const warnings: string[] = [];
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const spacesByName = new Map(
    workspace.spaces.map(
      (space) => [space.name.trim().toLowerCase(), space] as const,
    ),
  );
  const assetsById = new Set(workspace.assets.map((asset) => asset.id));
  const getColumnIndex = (...names: string[]) =>
    headers.findIndex((header) => names.includes(header));

  if (
    getColumnIndex("title") < 0 ||
    getColumnIndex("spaceid", "spacename", "space") < 0
  ) {
    return {
      logs: [],
      warnings: [
        "CSV must include `title` and either `spaceId` or `spaceName`/`space` columns.",
      ],
    };
  }

  const logs = rows.slice(1).flatMap((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const getValue = (...names: string[]) => {
      const index = getColumnIndex(...names);
      return index >= 0 ? (cells[index]?.trim() ?? "") : "";
    };

    const title = getValue("title");
    if (!title) {
      warnings.push(`Row ${rowNumber}: skipped because title is missing.`);
      return [];
    }

    const rawSpaceId = getValue("spaceid");
    const rawSpaceIds = splitListCell(getValue("spaceids"));
    const rawSpaceName = getValue("spacename", "space").toLowerCase();
    const resolvedSpaceIds = Array.from(
      new Set(
        [
          ...rawSpaceIds,
          rawSpaceId,
          spacesByName.get(rawSpaceName)?.id ?? "",
        ].filter(Boolean),
      ),
    ).filter((spaceId) => spacesById.has(spaceId));

    const resolvedSpaceId = resolvedSpaceIds[0];

    if (!resolvedSpaceId || resolvedSpaceIds.length === 0) {
      warnings.push(
        `Row ${rowNumber}: skipped because the space could not be resolved from '${rawSpaceId || rawSpaceName || "blank"}'.`,
      );
      return [];
    }

    const rawKind = getValue("kind");
    const kind = logKinds.has(rawKind as LogKind)
      ? (rawKind as LogKind)
      : "asset-update";
    const rawOccurredAt = getValue("occurredat", "timestamp", "date");
    const occurredAt =
      parseTimestamp(rawOccurredAt) ?? new Date().toISOString();
    if (rawOccurredAt && !parseTimestamp(rawOccurredAt)) {
      warnings.push(
        `Row ${rowNumber}: invalid occurredAt '${rawOccurredAt}', using the current time.`,
      );
    }

    const requestedAssetIds = splitListCell(getValue("assetids"));
    const assetIds = requestedAssetIds.filter((assetId) =>
      assetsById.has(assetId),
    );
    if (requestedAssetIds.length > assetIds.length) {
      warnings.push(
        `Row ${rowNumber}: some assetIds were ignored because they do not exist in the workspace.`,
      );
    }

    return [
      {
        id: `log-import-${Date.now()}-${rowIndex}`,
        spaceId: resolvedSpaceId,
        spaceIds: resolvedSpaceIds,
        kind,
        title,
        note: getValue("note") || "Imported from CSV",
        occurredAt,
        assetIds: assetIds.length ? assetIds : undefined,
        tags: splitListCell(getValue("tags")).length
          ? splitListCell(getValue("tags"))
          : undefined,
        cost: parseNumber(getValue("cost")),
        locationLabel: getValue("locationlabel") || undefined,
        attachmentsCount: parseNumber(getValue("attachmentscount")),
      } satisfies LogEntry,
    ];
  });

  return { logs, warnings };
}
