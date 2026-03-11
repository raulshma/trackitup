import {
    knownSpaceCategories,
    type KnownSpaceCategory,
    type SpaceCategory,
} from "../types/trackitup.ts";

export const DEFAULT_SPACE_CATEGORY = "aquarium" satisfies KnownSpaceCategory;

type SpaceCategoryDefinition = {
  label: string;
  defaultColor: string;
  namePlaceholder: string;
  summaryPlaceholder: string;
  templateKeywords: string[];
};

const spaceCategoryDefinitions: Record<
  KnownSpaceCategory,
  SpaceCategoryDefinition
> = {
  aquarium: {
    label: "Aquarium",
    defaultColor: "#0f766e",
    namePlaceholder: "Reef tank, quarantine tank, frag system",
    summaryPlaceholder:
      "Optional note about the livestock, equipment, or care focus here",
    templateKeywords: [
      "aquarium",
      "reef",
      "marine",
      "freshwater",
      "coral",
      "fish",
    ],
  },
  gardening: {
    label: "Gardening",
    defaultColor: "#65a30d",
    namePlaceholder: "Vegetable bed, greenhouse, monstera shelf",
    summaryPlaceholder:
      "Optional note about the plants, beds, or growing setup here",
    templateKeywords: [
      "gardening",
      "garden",
      "plant",
      "greenhouse",
      "hydroponic",
      "grow tent",
    ],
  },
  "vehicle-maintenance": {
    label: "Vehicle Maintenance",
    defaultColor: "#2563eb",
    namePlaceholder: "Daily driver, service bay, project car",
    summaryPlaceholder:
      "Optional note about the vehicle, mileage, or maintenance focus here",
    templateKeywords: [
      "vehicle maintenance",
      "vehicle",
      "car",
      "garage",
      "automotive",
      "truck",
      "mileage",
    ],
  },
  pets: {
    label: "Pets",
    defaultColor: "#ec4899",
    namePlaceholder: "Dog run, cat room, reptile corner",
    summaryPlaceholder:
      "Optional note about the pets, habitat, or care routine here",
    templateKeywords: [
      "pets",
      "pet",
      "dog",
      "cat",
      "bird",
      "reptile",
      "litter",
    ],
  },
  "home-maintenance": {
    label: "Home Maintenance",
    defaultColor: "#f59e0b",
    namePlaceholder: "HVAC closet, laundry room, kitchen upkeep",
    summaryPlaceholder:
      "Optional note about the household systems, chores, or upkeep here",
    templateKeywords: [
      "home maintenance",
      "household",
      "appliance",
      "hvac",
      "cleaning",
      "property",
    ],
  },
  workshop: {
    label: "Workshop",
    defaultColor: "#7c3aed",
    namePlaceholder: "Workbench, maker station, tool wall",
    summaryPlaceholder:
      "Optional note about the tools, builds, or repair focus here",
    templateKeywords: [
      "workshop",
      "tool",
      "diy",
      "maker",
      "bench",
      "fabrication",
    ],
  },
  fitness: {
    label: "Fitness",
    defaultColor: "#ef4444",
    namePlaceholder: "Home gym, training plan, bike setup",
    summaryPlaceholder:
      "Optional note about the workouts, equipment, or training goals here",
    templateKeywords: [
      "fitness",
      "gym",
      "workout",
      "training",
      "cycling",
      "running",
    ],
  },
  storage: {
    label: "Storage",
    defaultColor: "#64748b",
    namePlaceholder: "Pantry, attic bins, supply closet",
    summaryPlaceholder:
      "Optional note about what is stored, tracked, or replenished here",
    templateKeywords: [
      "storage",
      "pantry",
      "closet",
      "freezer",
      "supplies",
      "inventory",
    ],
  },
};

const knownSpaceCategorySet = new Set<string>(knownSpaceCategories);
const customCategoryPalette = [
  "#0ea5e9",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#84cc16",
  "#d946ef",
];

export function sanitizeSpaceCategory(category?: string) {
  return category?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeSpaceCategoryKey(category?: string) {
  return sanitizeSpaceCategory(category)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getKnownSpaceCategory(
  category?: string,
): KnownSpaceCategory | undefined {
  const normalized = normalizeSpaceCategoryKey(category);
  if (!knownSpaceCategorySet.has(normalized)) return undefined;
  return normalized as KnownSpaceCategory;
}

function titleCaseWords(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeSpaceCategoryValue(
  category?: string,
): SpaceCategory | "" {
  const sanitized = sanitizeSpaceCategory(category);
  if (!sanitized) return "";
  return getKnownSpaceCategory(sanitized) ?? sanitized;
}

export function formatSpaceCategoryLabel(category?: string) {
  const normalizedValue = normalizeSpaceCategoryValue(category);
  if (!normalizedValue) return "Uncategorized";

  const knownCategory = getKnownSpaceCategory(normalizedValue);
  if (knownCategory) return spaceCategoryDefinitions[knownCategory].label;
  if (/[A-Z]/.test(normalizedValue)) return normalizedValue;

  return titleCaseWords(normalizedValue.replaceAll("-", " "));
}

export function getSpaceCategoryNamePlaceholder(category?: string) {
  const knownCategory = getKnownSpaceCategory(category);
  return knownCategory
    ? spaceCategoryDefinitions[knownCategory].namePlaceholder
    : undefined;
}

export function getSpaceCategorySummaryPlaceholder(category?: string) {
  const knownCategory = getKnownSpaceCategory(category);
  return knownCategory
    ? spaceCategoryDefinitions[knownCategory].summaryPlaceholder
    : undefined;
}

export function getDefaultSpaceThemeColor(category?: string) {
  const knownCategory = getKnownSpaceCategory(category);
  if (knownCategory)
    return spaceCategoryDefinitions[knownCategory].defaultColor;

  const seed = normalizeSpaceCategoryKey(category);
  const hash = [...seed].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return (
    customCategoryPalette[hash % customCategoryPalette.length] ?? "#6366f1"
  );
}

export function buildSpaceCategoryOptions(existingCategories: string[] = []) {
  const seen = new Set<string>(knownSpaceCategories);
  const customOptions = existingCategories
    .map((category) => normalizeSpaceCategoryValue(category))
    .filter((category): category is SpaceCategory => Boolean(category))
    .filter((category) => {
      const normalized = normalizeSpaceCategoryKey(category);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .sort((left, right) =>
      formatSpaceCategoryLabel(left).localeCompare(
        formatSpaceCategoryLabel(right),
      ),
    )
    .map((value) => ({ value, label: formatSpaceCategoryLabel(value) }));

  return [
    ...knownSpaceCategories.map((value) => ({
      value,
      label: spaceCategoryDefinitions[value].label,
    })),
    ...customOptions,
  ];
}

export function mapTemplateCategoryToSpaceCategory(category?: string) {
  const searchableText = sanitizeSpaceCategory(category)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!searchableText) return undefined;

  const tokens = new Set(searchableText.split(" ").filter(Boolean));

  return knownSpaceCategories.find((value) =>
    spaceCategoryDefinitions[value].templateKeywords.some((keyword) =>
      keyword.includes(" ")
        ? searchableText.includes(keyword)
        : tokens.has(keyword),
    ),
  );
}
