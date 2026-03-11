export type AiDraftReviewUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AiDraftReviewItemInput = {
  key: string;
  label: string;
  value: unknown;
  maxLines?: number;
  maxTextLength?: number;
};

export type AiDraftReviewItem = {
  key: string;
  label: string;
  valueText: string;
  valueLines?: string[];
};

const DEFAULT_MAX_TEXT_LENGTH = 220;
const DEFAULT_MAX_LINES = 6;

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function formatAiDraftReviewValue(
  value: unknown,
  maxTextLength = DEFAULT_MAX_TEXT_LENGTH,
): string | null {
  if (typeof value === "string") {
    return compactText(value, maxTextLength) || null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value == null) {
    return null;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => formatAiDraftReviewValue(item, maxTextLength))
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join(", ") : null;
  }

  if (typeof value === "object") {
    try {
      return compactText(JSON.stringify(value), maxTextLength) || null;
    } catch {
      return "[Unsupported draft value]";
    }
  }

  return compactText(String(value), maxTextLength) || null;
}

export function buildAiDraftReviewItems(
  items: AiDraftReviewItemInput[],
): AiDraftReviewItem[] {
  return items.flatMap((item) => {
    const maxTextLength = item.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;

    if (Array.isArray(item.value)) {
      const valueLines = item.value
        .map((entry) => formatAiDraftReviewValue(entry, maxTextLength))
        .filter((entry): entry is string => Boolean(entry));

      if (valueLines.length === 0) {
        return [];
      }

      const maxLines = item.maxLines ?? DEFAULT_MAX_LINES;
      const displayedLines = valueLines.slice(0, maxLines);
      const hiddenCount = valueLines.length - displayedLines.length;
      const finalizedLines =
        hiddenCount > 0
          ? [...displayedLines, `+${hiddenCount} more`]
          : displayedLines;

      return [
        {
          key: item.key,
          label: item.label,
          valueText: finalizedLines[0],
          valueLines: finalizedLines,
        },
      ];
    }

    const valueText = formatAiDraftReviewValue(item.value, maxTextLength);
    if (!valueText) {
      return [];
    }

    return [
      {
        key: item.key,
        label: item.label,
        valueText,
      },
    ];
  });
}

export function formatAiDraftUsageLabel(
  usage?: AiDraftReviewUsage | null,
): string | null {
  if (!usage) return null;

  const parts: string[] = [];
  if (typeof usage.inputTokens === "number") {
    parts.push(`${usage.inputTokens} in`);
  }
  if (typeof usage.outputTokens === "number") {
    parts.push(`${usage.outputTokens} out`);
  }

  if (parts.length > 0) {
    return parts.join(" • ");
  }

  if (typeof usage.totalTokens === "number") {
    return `${usage.totalTokens} total`;
  }

  return null;
}