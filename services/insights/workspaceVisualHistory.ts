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

export type VisualRecapCoverSelections = Record<string, string>;

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

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string",
    ),
  );
}

function applyVisualRecapCoverSelection(
  recap: VisualHistoryMonthlyRecap,
  selectedPhotoId?: string,
): VisualHistoryMonthlyRecap {
  const coverItem = selectedPhotoId
    ? recap.items.find((item) => item.id === selectedPhotoId)
    : undefined;
  const orderedItems = coverItem
    ? [coverItem, ...recap.items.filter((item) => item.id !== coverItem.id)]
    : recap.items;
  const resolvedCover = orderedItems[0];

  return {
    ...recap,
    coverPhotoId: resolvedCover?.id,
    coverUri: resolvedCover?.uri,
    highlightUris: orderedItems.slice(0, 3).map((item) => item.uri),
    items: orderedItems,
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
        if (scope.spaceId) return log.spaceId === scope.spaceId;
        return true;
      })
      .flatMap((log) => {
        const space = spacesById.get(log.spaceId);
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
            spaceId: log.spaceId,
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
