import type { WorkspaceSnapshot } from "../../types/trackitup.ts";

import { getWorkspaceRecommendations } from "./workspaceRecommendations.ts";
import { buildWorkspaceVisualHistory } from "./workspaceVisualHistory.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_ASSET_LOG_DAYS = 30;
const UPCOMING_WARRANTY_DAYS = 30;

function normalizeSpaceIds(value: { spaceId?: string; spaceIds?: string[] }) {
  const next = value.spaceIds?.filter(Boolean) ?? [];
  if (next.length > 0) return Array.from(new Set(next));
  if (value.spaceId) return [value.spaceId];
  return [];
}

function primarySpaceId(value: { spaceId?: string; spaceIds?: string[] }) {
  return normalizeSpaceIds(value)[0] ?? value.spaceId;
}

export type WorkspaceInventoryLifecycleRoute =
  | "inventory"
  | "logbook"
  | "visual-history";

export type WorkspaceInventoryLifecycleAsset = {
  id: string;
  name: string;
  spaceId: string;
  spaceName: string;
  status: string;
  expenseTotal: number;
  purchasePrice?: number;
  warrantyExpiresAt?: string;
  relatedLogCount: number;
  recentLogCount: number;
  photoCount: number;
  proofCount: number;
  latestLogAt?: string;
  reasons: string[];
  route: WorkspaceInventoryLifecycleRoute;
};

export type WorkspaceInventoryLifecycleRecommendation = {
  id: string;
  title: string;
  explanation: string;
  severity: "high" | "medium" | "low";
  type: string;
  assetId?: string;
  spaceId?: string;
  route: WorkspaceInventoryLifecycleRoute;
};

export type WorkspaceInventoryLifecycleSummary = {
  summary: {
    assetCount: number;
    warrantyRiskCount: number;
    maintenanceCount: number;
    documentationGapCount: number;
    recommendationCount: number;
  };
  attentionAssets: WorkspaceInventoryLifecycleAsset[];
  recommendations: WorkspaceInventoryLifecycleRecommendation[];
};

function addDays(timestamp: string, days: number) {
  return new Date(new Date(timestamp).getTime() + days * DAY_MS).toISOString();
}

function getRouteForAsset(options: {
  hasWarrantyRisk: boolean;
  status: string;
  relatedLogCount: number;
  photoCount: number;
}) {
  if (options.hasWarrantyRisk || options.status === "maintenance") {
    return "inventory" as const;
  }
  if (options.relatedLogCount === 0 || options.photoCount === 0) {
    return "logbook" as const;
  }
  return "visual-history" as const;
}

export function buildWorkspaceInventoryLifecycleSummary(
  workspace: WorkspaceSnapshot,
): WorkspaceInventoryLifecycleSummary {
  const now = workspace.generatedAt;
  const recentLogThreshold = addDays(now, -RECENT_ASSET_LOG_DAYS);
  const upcomingWarrantyThreshold = addDays(now, UPCOMING_WARRANTY_DAYS);
  const spacesById = new Map(
    workspace.spaces.map((space) => [space.id, space] as const),
  );
  const visualHistory = buildWorkspaceVisualHistory(workspace);
  const assetGalleryById = new Map(
    visualHistory.assetGalleries.map(
      (gallery) => [gallery.id, gallery] as const,
    ),
  );
  const expenseTotals = new Map(
    workspace.assets.map(
      (asset) =>
        [
          asset.id,
          workspace.expenses
            .filter((expense) => expense.assetId === asset.id)
            .reduce(
              (total, expense) => total + expense.amount,
              asset.purchasePrice ?? 0,
            ),
        ] as const,
    ),
  );
  const highOwnershipAssetIds = new Set(
    [...expenseTotals.entries()]
      .sort((left, right) => right[1] - left[1])
      .filter((entry) => entry[1] > 0)
      .slice(0, 2)
      .map((entry) => entry[0]),
  );

  const attentionAssets = workspace.assets
    .map<WorkspaceInventoryLifecycleAsset & { score: number }>((asset) => {
      const relatedLogs = workspace.logs
        .filter((log) => log.assetIds?.includes(asset.id))
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
      const recentLogCount = relatedLogs.filter(
        (log) => log.occurredAt >= recentLogThreshold,
      ).length;
      const gallery = assetGalleryById.get(asset.id);
      const photoCount = gallery?.photoCount ?? 0;
      const proofCount = gallery?.proofCount ?? 0;
      const hasWarrantyRisk = Boolean(
        asset.warrantyExpiresAt &&
        asset.warrantyExpiresAt <= upcomingWarrantyThreshold,
      );
      const reasons: string[] = [];
      let score = 0;

      if (asset.status === "maintenance") {
        reasons.push("This asset is already marked in maintenance status.");
        score += 3;
      }
      if (asset.warrantyExpiresAt && asset.warrantyExpiresAt <= now) {
        reasons.push("Its warranty coverage has already expired.");
        score += 3;
      } else if (hasWarrantyRisk) {
        reasons.push(
          `Its warranty coverage expires within ${UPCOMING_WARRANTY_DAYS} days.`,
        );
        score += 2;
      }
      if (relatedLogs.length === 0) {
        reasons.push("No linked asset logs have been recorded yet.");
        score += 2;
      } else if (recentLogCount === 0) {
        reasons.push(
          `No linked asset log was recorded in the last ${RECENT_ASSET_LOG_DAYS} days.`,
        );
        score += 1;
      }
      if (photoCount === 0) {
        reasons.push("No photo history is attached to this asset yet.");
        score += 1;
      } else if (proofCount === 0) {
        reasons.push(
          "The asset has photos, but none are flagged as proof evidence.",
        );
        score += 1;
      }
      if (highOwnershipAssetIds.has(asset.id)) {
        reasons.push(
          "Its ownership cost is among the highest tracked asset totals.",
        );
        score += 1;
      }

      return {
        id: asset.id,
        name: asset.name,
        spaceId: primarySpaceId(asset) ?? "",
        spaceName:
          spacesById.get(primarySpaceId(asset) ?? "")?.name ?? "Unknown space",
        status: asset.status,
        expenseTotal: expenseTotals.get(asset.id) ?? 0,
        purchasePrice: asset.purchasePrice,
        warrantyExpiresAt: asset.warrantyExpiresAt,
        relatedLogCount: relatedLogs.length,
        recentLogCount,
        photoCount,
        proofCount,
        latestLogAt: relatedLogs[0]?.occurredAt,
        reasons,
        route: getRouteForAsset({
          hasWarrantyRisk,
          status: asset.status,
          relatedLogCount: relatedLogs.length,
          photoCount,
        }),
        score,
      };
    })
    .filter((asset) => asset.reasons.length > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.expenseTotal - left.expenseTotal;
    })
    .slice(0, 5)
    .map(({ score: _score, ...asset }) => asset);

  const recommendations = getWorkspaceRecommendations(workspace, 8)
    .filter(
      (item) => item.type === "warranty-expiring" || Boolean(item.assetId),
    )
    .map<WorkspaceInventoryLifecycleRecommendation>((item) => ({
      id: item.id,
      title: item.title,
      explanation: item.explanation,
      severity: item.severity,
      type: item.type,
      assetId: item.assetId,
      spaceId: item.spaceId,
      route: item.action.kind === "open-logbook" ? "logbook" : "inventory",
    }))
    .slice(0, 4);

  return {
    summary: {
      assetCount: workspace.assets.length,
      warrantyRiskCount: workspace.assets.filter(
        (asset) =>
          asset.warrantyExpiresAt &&
          asset.warrantyExpiresAt <= upcomingWarrantyThreshold,
      ).length,
      maintenanceCount: workspace.assets.filter(
        (asset) => asset.status === "maintenance",
      ).length,
      documentationGapCount: workspace.assets.filter((asset) => {
        const gallery = assetGalleryById.get(asset.id);
        const relatedLogCount = workspace.logs.filter((log) =>
          log.assetIds?.includes(asset.id),
        ).length;
        return relatedLogCount === 0 || (gallery?.photoCount ?? 0) === 0;
      }).length,
      recommendationCount: recommendations.length,
    },
    attentionAssets,
    recommendations,
  };
}
