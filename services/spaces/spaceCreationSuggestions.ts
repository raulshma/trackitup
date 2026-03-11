import type {
    QuickAction,
    QuickActionKind,
    SpaceCategory,
    TemplateCatalogItem,
} from "@/types/trackitup";
import {
    getSpaceCategoryNamePlaceholder,
    getSpaceCategorySummaryPlaceholder,
    mapTemplateCategoryToSpaceCategory,
} from "../../constants/TrackItUpSpaceCategories.ts";

export type SpaceCreationSuggestion = {
  suggestedCategory?: SpaceCategory;
  namePlaceholder: string;
  summaryPlaceholder: string;
  heroSubtitle: string;
  returnMessage: string;
  primaryActionLabel: string;
  badgeLabel?: string;
};

const actionPlaceholders: Record<QuickActionKind, string> = {
  "quick-log": "Reef tank, raised bed, daily driver",
  "metric-entry": "Propagation shelf, reef tank, service bay",
  "routine-run": "Grow tent, reef tank, garage bay",
};

export { mapTemplateCategoryToSpaceCategory };

export function getSpaceCreationSuggestion(
  action?: QuickAction,
  template?: TemplateCatalogItem,
): SpaceCreationSuggestion {
  const suggestedCategory = mapTemplateCategoryToSpaceCategory(
    template?.category,
  );
  const namePlaceholder = suggestedCategory
    ? (getSpaceCategoryNamePlaceholder(suggestedCategory) ??
      "Reef tank, greenhouse, daily driver")
    : action
      ? actionPlaceholders[action.kind]
      : "Reef tank, greenhouse, daily driver";
  const summaryPlaceholder = suggestedCategory
    ? (getSpaceCategorySummaryPlaceholder(suggestedCategory) ??
      "Optional note about what belongs in this space")
    : "Optional note about what belongs in this space";
  const sourceLabel = action?.label ?? template?.name;

  return {
    suggestedCategory,
    namePlaceholder,
    summaryPlaceholder,
    heroSubtitle: sourceLabel
      ? `Create a space first so ${sourceLabel} opens with the right home already selected.`
      : "Every event belongs to a space. Start here so TrackItUp can guide recordings, reminders, and metrics in the right place.",
    returnMessage: sourceLabel
      ? `After saving, TrackItUp will open ${sourceLabel} with this space preselected.`
      : "You can start recording as soon as this space is saved.",
    primaryActionLabel: sourceLabel
      ? "Create space and continue"
      : "Create first space",
    badgeLabel: sourceLabel,
  };
}
