import type { WorkspaceSnapshot } from "@/types/trackitup";

export type VisualHistoryScope = {
  spaceId?: string;
  assetId?: string;
};

export type VisualHistoryPhotoItem = {
  id: string;
  uri: string;
  capturedAt: string;
  monthKey: string;
  logId: string;
  logTitle: string;
  logNote: string;
  logKind: string;
  spaceId: string;
  spaceName: string;
  spaceColor: string;
  assetIds: string[];
  assetNames: string[];
  proofLabel?: string;
};

export type VisualHistoryGallerySummary = {
  id: string;
  label: string;
  photoCount: number;
  latestCapturedAt: string;
  latestUri: string;
  proofCount: number;
};

export type VisualHistoryMonthlyRecap = {
  monthKey: string;
  photoCount: number;
  proofCount: number;
  coverPhotoId?: string;
  coverUri?: string;
  highlightUris: string[];
  items: VisualHistoryPhotoItem[];
};

export type VisualRecapSelectionEntry = {
  coverPhotoId?: string;
  orderedPhotoIds?: string[];
};

export type VisualRecapCoverSelections = Record<
  string,
  VisualRecapSelectionEntry
>;

export type VisualHistoryView = {
  photoCount: number;
  proofCount: number;
  photos: VisualHistoryPhotoItem[];
  beforeAfter: {
    before: VisualHistoryPhotoItem;
    after: VisualHistoryPhotoItem;
  } | null;
  spaceGalleries: VisualHistoryGallerySummary[];
  assetGalleries: VisualHistoryGallerySummary[];
  monthlyRecaps: VisualHistoryMonthlyRecap[];
};

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function primarySpaceId(value: { spaceId?: string; spaceIds?: string[] }) {
  return normalizeSpaceIds(value)[0] ?? value.spaceId;
}

function belongsToSpace(
  value: { spaceId?: string; spaceIds?: string[] },
  spaceId: string,
) {
  return normalizeSpaceIds(value).includes(spaceId);
}

function sortNewestFirst<T extends { capturedAt: string; id: string }>(
  items: T[],
) {
  return [...items].sort((left, right) => {
    const byDate = right.capturedAt.localeCompare(left.capturedAt);
    return byDate !== 0 ? byDate : right.id.localeCompare(left.id);
  });
}

function getMonthKey(timestamp: string) {
  return timestamp.slice(0, 7);
}

export function getVisualHistoryScopeKey(scope: VisualHistoryScope) {
  if (scope.assetId) return `asset:${scope.assetId}`;
  if (scope.spaceId) return `space:${scope.spaceId}`;
  return "workspace";
}

export function getVisualRecapCoverSelectionKey(
  scope: VisualHistoryScope,
  monthKey: string,
) {
  return `${getVisualHistoryScopeKey(scope)}:${monthKey}`;
}

export function normalizeVisualRecapCoverSelections(
  value: unknown,
): VisualRecapCoverSelections {
  if (!value || typeof value !== "object") return {};

  const normalizedSelections: VisualRecapCoverSelections = {};

  for (const [key, selection] of Object.entries(value)) {
    if (typeof key !== "string") continue;

    if (typeof selection === "string") {
      normalizedSelections[key] = { coverPhotoId: selection };
      continue;
    }

    if (!selection || typeof selection !== "object") {
      continue;
    }

    normalizedSelections[key] = {
      coverPhotoId:
        typeof (selection as { coverPhotoId?: unknown }).coverPhotoId ===
        "string"
          ? (selection as { coverPhotoId: string }).coverPhotoId
          : undefined,
      orderedPhotoIds: Array.isArray(
        (selection as { orderedPhotoIds?: unknown }).orderedPhotoIds,
      )
        ? (selection as { orderedPhotoIds: unknown[] }).orderedPhotoIds.filter(
            (photoId): photoId is string => typeof photoId === "string",
          )
        : undefined,
    };
  }

  return normalizedSelections;
}

function applyVisualRecapCoverSelection(
  recap: VisualHistoryMonthlyRecap,
  selection?: VisualRecapSelectionEntry | string,
): VisualHistoryMonthlyRecap {
  const normalizedSelection =
    typeof selection === "string"
      ? ({ coverPhotoId: selection } satisfies VisualRecapSelectionEntry)
      : selection;

  const orderedItems = normalizedSelection?.orderedPhotoIds?.length
    ? [
        ...normalizedSelection.orderedPhotoIds
          .map((photoId) => recap.items.find((item) => item.id === photoId))
          .filter((item): item is VisualHistoryPhotoItem => Boolean(item)),
        ...recap.items.filter(
          (item) => !normalizedSelection.orderedPhotoIds?.includes(item.id),
        ),
      ]
    : recap.items;
  const selectedCover = normalizedSelection?.coverPhotoId
    ? orderedItems.find((item) => item.id === normalizedSelection.coverPhotoId)
    : orderedItems[0];
  const orderedWithCoverFirst = selectedCover
    ? [
        selectedCover,
        ...orderedItems.filter((item) => item.id !== selectedCover.id),
      ]
    : orderedItems;
  const resolvedCover = orderedWithCoverFirst[0];

  return {
    ...recap,
    coverPhotoId: resolvedCover?.id,
    coverUri: resolvedCover?.uri,
    highlightUris: orderedWithCoverFirst.slice(0, 3).map((item) => item.uri),
    items: orderedWithCoverFirst,
  };
}

export function applyVisualRecapCoverSelections(
  history: VisualHistoryView,
  scope: VisualHistoryScope,
  selections: VisualRecapCoverSelections,
): VisualHistoryView {
  return {
    ...history,
    monthlyRecaps: history.monthlyRecaps.map((recap) =>
      applyVisualRecapCoverSelection(
        recap,
        selections[getVisualRecapCoverSelectionKey(scope, recap.monthKey)],
      ),
    ),
  };
}

function getProofLabel(workspace: WorkspaceSnapshot, logId: string) {
  const log = workspace.logs.find((item) => item.id === logId);
  if (!log) return undefined;

  if (log.routineId) {
    const routine = workspace.routines.find(
      (item) => item.id === log.routineId,
    );
    return routine ? `Routine proof • ${routine.name}` : "Routine proof";
  }

  if (log.reminderId) {
    const reminder = workspace.reminders.find(
      (item) => item.id === log.reminderId,
    );
    return reminder ? `Reminder proof • ${reminder.title}` : "Reminder proof";
  }

  if (log.kind === "routine-run") return "Routine proof";
  if (log.kind === "reminder") return "Reminder proof";
  return undefined;
}

function buildGallerySummaries(
  items: VisualHistoryPhotoItem[],
  getKey: (item: VisualHistoryPhotoItem) => { id: string; label: string }[],
) {
  const grouped = new Map<string, VisualHistoryGallerySummary>();

  items.forEach((item) => {
    getKey(item).forEach(({ id, label }) => {
      const existing = grouped.get(id);
      if (existing) {
        existing.photoCount += 1;
        existing.proofCount += item.proofLabel ? 1 : 0;
        if (item.capturedAt > existing.latestCapturedAt) {
          existing.latestCapturedAt = item.capturedAt;
          existing.latestUri = item.uri;
        }
        return;
      }

      grouped.set(id, {
        id,
        label,
        photoCount: 1,
        latestCapturedAt: item.capturedAt,
        latestUri: item.uri,
        proofCount: item.proofLabel ? 1 : 0,
      });
    });
  });

  return [...grouped.values()].sort((left, right) =>
    right.latestCapturedAt.localeCompare(left.latestCapturedAt),
  );
}

export function buildWorkspaceVisualHistory(
  workspace: WorkspaceSnapshot,
  scope: VisualHistoryScope = {},
): VisualHistoryView {
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const assetsById = new Map(
    workspace.assets.map((asset) => [asset.id, asset] as const),
  );

  const photos = sortNewestFirst(
    workspace.logs
      .filter((log) => {
        if (scope.assetId)
          return log.assetIds?.includes(scope.assetId) ?? false;
        if (scope.spaceId) return belongsToSpace(log, scope.spaceId);
        return true;
      })
      .flatMap((log) => {
        const logSpaceId = primarySpaceId(log) ?? "";
        const space = spacesById.get(logSpaceId);
        const assetIds = log.assetIds ?? [];
        const assetNames = assetIds
          .map((assetId) => assetsById.get(assetId)?.name)
          .filter((value): value is string => Boolean(value));

        return (log.attachments ?? [])
          .filter((attachment) => attachment.mediaType === "photo")
          .map((attachment) => ({
            id: `${log.id}:${attachment.id}`,
            uri: attachment.uri,
            capturedAt: attachment.capturedAt || log.occurredAt,
            monthKey: getMonthKey(attachment.capturedAt || log.occurredAt),
            logId: log.id,
            logTitle: log.title,
            logNote: log.note,
            logKind: log.kind,
            spaceId: logSpaceId,
            spaceName: space?.name ?? "Unknown space",
            spaceColor: space?.themeColor ?? "#0f766e",
            assetIds,
            assetNames,
            proofLabel: getProofLabel(workspace, log.id),
          }));
      }),
  );

  const monthlyRecaps = [...new Set(photos.map((item) => item.monthKey))].map(
    (monthKey) => {
      const items = photos.filter((item) => item.monthKey === monthKey);
      return {
        monthKey,
        photoCount: items.length,
        proofCount: items.filter((item) => item.proofLabel).length,
        coverPhotoId: items[0]?.id,
        coverUri: items[0]?.uri,
        highlightUris: items.slice(0, 3).map((item) => item.uri),
        items,
      };
    },
  );

  const beforeAfter =
    photos.length >= 2
      ? {
          before: photos[photos.length - 1],
          after: photos[0],
        }
      : null;

  return {
    photoCount: photos.length,
    proofCount: photos.filter((item) => item.proofLabel).length,
    photos,
    beforeAfter,
    spaceGalleries: buildGallerySummaries(photos, (item) => [
      { id: item.spaceId, label: item.spaceName },
    ]),
    assetGalleries: buildGallerySummaries(photos, (item) =>
      item.assetIds.map((assetId, index) => ({
        id: assetId,
        label: item.assetNames[index] ?? assetId,
      })),
    ),
    monthlyRecaps,
  };
}
