export type OpenRouterCatalogModel = {
  id: string;
  name?: string | null;
  description?: string | null;
  created?: number | null;
  context_length?: number | null;
  pricing?: {
    prompt?: string;
    completion?: string;
  } | null;
  architecture?: {
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
  } | null;
};

export type OpenRouterModelTier = "free" | "paid";

export type OpenRouterModelSort =
  | "recommended"
  | "release-date"
  | "context-length"
  | "price";

export type OpenRouterHighlightedTextPart = {
  text: string;
  isHighlighted: boolean;
};

export type OpenRouterSelectableModel = {
  id: string;
  name: string;
  description: string | null;
  searchText: string;
  createdAt: number | null;
  contextLength: number | null;
  pricing: {
    prompt?: string;
    completion?: string;
  };
  tier: OpenRouterModelTier;
};

const OPENROUTER_PRICE_PER_MILLION_TOKENS = 1_000_000;

export const DEFAULT_OPENROUTER_MODEL_SORT: OpenRouterModelSort = "recommended";

function parseOpenRouterPrice(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareOpenRouterModelsByName(
  left: Pick<OpenRouterSelectableModel, "name">,
  right: Pick<OpenRouterSelectableModel, "name">,
) {
  return left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
  });
}

function getOpenRouterModelPriceSortValue(
  model: Pick<OpenRouterSelectableModel, "pricing">,
) {
  const promptPrice = parseOpenRouterPrice(model.pricing.prompt);
  const completionPrice = parseOpenRouterPrice(model.pricing.completion);

  if (promptPrice === null && completionPrice === null)
    return Number.POSITIVE_INFINITY;
  return (promptPrice ?? 0) + (completionPrice ?? 0);
}

function getOpenRouterModelCreatedSortValue(
  model: Pick<OpenRouterSelectableModel, "createdAt">,
) {
  return typeof model.createdAt === "number" && Number.isFinite(model.createdAt)
    ? model.createdAt
    : Number.NEGATIVE_INFINITY;
}

function formatOpenRouterPricePerMillionTokens(value: unknown) {
  const parsedPrice = parseOpenRouterPrice(value);
  if (parsedPrice === null) return null;

  const scaledPrice = parsedPrice * OPENROUTER_PRICE_PER_MILLION_TOKENS;
  const digits =
    scaledPrice >= 100 ? 0 : scaledPrice >= 1 ? 2 : scaledPrice >= 0.01 ? 4 : 6;

  return `$${scaledPrice.toFixed(digits)}/M`;
}

export function normalizeOpenRouterModelSort(
  value: unknown,
): OpenRouterModelSort {
  return value === "recommended" ||
    value === "release-date" ||
    value === "context-length" ||
    value === "price"
    ? value
    : DEFAULT_OPENROUTER_MODEL_SORT;
}

export function getOpenRouterSearchHighlightParts(
  text: string,
  query: string,
): OpenRouterHighlightedTextPart[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return [{ text, isHighlighted: false }];
  }

  const normalizedText = text.toLocaleLowerCase();
  const parts: OpenRouterHighlightedTextPart[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, startIndex);
    if (matchIndex === -1) {
      parts.push({ text: text.slice(startIndex), isHighlighted: false });
      break;
    }

    if (matchIndex > startIndex) {
      parts.push({
        text: text.slice(startIndex, matchIndex),
        isHighlighted: false,
      });
    }

    const nextIndex = matchIndex + normalizedQuery.length;
    parts.push({
      text: text.slice(matchIndex, nextIndex),
      isHighlighted: true,
    });
    startIndex = nextIndex;
  }

  return parts.length > 0 ? parts : [{ text, isHighlighted: false }];
}

export function supportsOpenRouterTextModel(model: OpenRouterCatalogModel) {
  const modelId = typeof model.id === "string" ? model.id.trim() : "";
  if (!modelId) return false;

  const inputModalities = model.architecture?.input_modalities ?? [];
  const outputModalities = model.architecture?.output_modalities ?? [];
  return inputModalities.includes("text") && outputModalities.includes("text");
}

export function classifyOpenRouterModelTier(
  model: Pick<OpenRouterCatalogModel, "pricing">,
): OpenRouterModelTier {
  const promptPrice = parseOpenRouterPrice(model.pricing?.prompt);
  const completionPrice = parseOpenRouterPrice(model.pricing?.completion);
  return promptPrice === 0 && completionPrice === 0 ? "free" : "paid";
}

export function normalizeOpenRouterSelectableModels(
  models: OpenRouterCatalogModel[],
) {
  return sortOpenRouterSelectableModels(
    models.filter(supportsOpenRouterTextModel).map((model) => {
      const modelId = model.id.trim();
      const modelName =
        typeof model.name === "string" && model.name.trim().length > 0
          ? model.name.trim()
          : modelId;
      const modelDescription =
        typeof model.description === "string" &&
        model.description.trim().length > 0
          ? model.description.trim()
          : null;

      return {
        id: modelId,
        name: modelName,
        description: modelDescription,
        searchText: [modelName, modelId, modelDescription]
          .filter((value): value is string => typeof value === "string")
          .join("\n")
          .toLocaleLowerCase(),
        createdAt:
          typeof model.created === "number" && Number.isFinite(model.created)
            ? model.created
            : null,
        contextLength:
          typeof model.context_length === "number" &&
          Number.isFinite(model.context_length)
            ? model.context_length
            : null,
        pricing: {
          prompt: model.pricing?.prompt,
          completion: model.pricing?.completion,
        },
        tier: classifyOpenRouterModelTier(model),
      } satisfies OpenRouterSelectableModel;
    }),
    DEFAULT_OPENROUTER_MODEL_SORT,
  );
}

export function filterOpenRouterSelectableModels(
  models: OpenRouterSelectableModel[],
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return models;

  return models.filter((model) =>
    (
      model.searchText ??
      [model.name, model.id, model.description].join("\n").toLocaleLowerCase()
    ).includes(normalizedQuery),
  );
}

export function sortOpenRouterSelectableModels(
  models: OpenRouterSelectableModel[],
  sort: OpenRouterModelSort,
) {
  return [...models].sort((left, right) => {
    if (sort === "context-length") {
      const contextDifference =
        (right.contextLength ?? Number.NEGATIVE_INFINITY) -
        (left.contextLength ?? Number.NEGATIVE_INFINITY);
      return contextDifference !== 0
        ? contextDifference
        : compareOpenRouterModelsByName(left, right);
    }

    if (sort === "price") {
      const priceDifference =
        getOpenRouterModelPriceSortValue(left) -
        getOpenRouterModelPriceSortValue(right);
      return priceDifference !== 0
        ? priceDifference
        : compareOpenRouterModelsByName(left, right);
    }

    if (sort === "release-date") {
      const createdDifference =
        getOpenRouterModelCreatedSortValue(right) -
        getOpenRouterModelCreatedSortValue(left);
      return createdDifference !== 0
        ? createdDifference
        : compareOpenRouterModelsByName(left, right);
    }

    if (left.tier !== right.tier) {
      return left.tier === "free" ? -1 : 1;
    }

    return compareOpenRouterModelsByName(left, right);
  });
}

export function getDefaultOpenRouterModelTier(
  models: OpenRouterSelectableModel[],
  selectedModelId: string,
): OpenRouterModelTier {
  const selectedModel = models.find((model) => model.id === selectedModelId);
  return selectedModel?.tier ?? "free";
}

export function formatOpenRouterModelPricingLabel(
  model: Pick<OpenRouterSelectableModel, "tier" | "pricing">,
) {
  if (model.tier === "free") return "Free";

  const promptPrice = formatOpenRouterPricePerMillionTokens(
    model.pricing.prompt,
  );
  const completionPrice = formatOpenRouterPricePerMillionTokens(
    model.pricing.completion,
  );

  if (promptPrice && completionPrice) {
    return `Input ${promptPrice} • Output ${completionPrice}`;
  }

  if (promptPrice) {
    return `Input ${promptPrice}`;
  }

  if (completionPrice) {
    return `Output ${completionPrice}`;
  }

  return "Paid";
}

export async function loadOpenRouterSelectableModels() {
  const response = await fetch("https://openrouter.ai/api/v1/models");
  if (!response.ok) {
    throw new Error(
      `OpenRouter returned ${response.status} while loading models.`,
    );
  }

  const payload = (await response.json()) as {
    data?: OpenRouterCatalogModel[];
  };
  return normalizeOpenRouterSelectableModels(
    Array.isArray(payload.data) ? payload.data : [],
  );
}
