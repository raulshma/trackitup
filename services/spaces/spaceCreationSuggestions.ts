import type {
  QuickAction,
  QuickActionKind,
  SpaceCategory,
  TemplateCatalogItem,
} from "@/types/trackitup";

export type SpaceCreationSuggestion = {
  suggestedCategory?: SpaceCategory;
  namePlaceholder: string;
  summaryPlaceholder: string;
  heroSubtitle: string;
  returnMessage: string;
  primaryActionLabel: string;
  badgeLabel?: string;
};

const categoryPlaceholders: Record<SpaceCategory, string> = {
  aquarium: "Reef tank, quarantine tank, frag system",
  gardening: "Vegetable bed, greenhouse, monstera shelf",
  "vehicle-maintenance": "Daily driver, service bay, project car",
};

const actionPlaceholders: Record<QuickActionKind, string> = {
  "quick-log": "Reef tank, raised bed, daily driver",
  "metric-entry": "Propagation shelf, reef tank, service bay",
  "routine-run": "Grow tent, reef tank, garage bay",
};

const summaryPlaceholders: Record<SpaceCategory, string> = {
  aquarium: "Optional note about the livestock, equipment, or care focus here",
  gardening: "Optional note about the plants, beds, or growing setup here",
  "vehicle-maintenance": "Optional note about the vehicle, mileage, or maintenance focus here",
};

export function mapTemplateCategoryToSpaceCategory(category?: string) {
  const normalized = category?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes("aquarium") || normalized.includes("reef")) {
    return "aquarium" satisfies SpaceCategory;
  }
  if (
    normalized.includes("garden") ||
    normalized.includes("plant") ||
    normalized.includes("greenhouse")
  ) {
    return "gardening" satisfies SpaceCategory;
  }
  if (
    normalized.includes("vehicle") ||
    normalized.includes("car") ||
    normalized.includes("garage") ||
    normalized.includes("automotive")
  ) {
    return "vehicle-maintenance" satisfies SpaceCategory;
  }
  return undefined;
}

export function getSpaceCreationSuggestion(
  action?: QuickAction,
  template?: TemplateCatalogItem,
): SpaceCreationSuggestion {
  const suggestedCategory = mapTemplateCategoryToSpaceCategory(template?.category);
  const namePlaceholder = suggestedCategory
    ? categoryPlaceholders[suggestedCategory]
    : action
      ? actionPlaceholders[action.kind]
      : "Reef tank, greenhouse, daily driver";
  const summaryPlaceholder = suggestedCategory
    ? summaryPlaceholders[suggestedCategory]
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