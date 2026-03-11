export const AI_PROMPT_HISTORY_STORAGE_KEY = "trackitup.ai.prompt-history.v1";
export const OPENROUTER_API_KEY_STORAGE_KEY =
  "trackitup.ai.openrouter-api-key.v1";
export const OPENROUTER_TEXT_MODEL_STORAGE_KEY =
  "trackitup.ai.openrouter-text-model.v1";
export const OPENROUTER_MODEL_SORT_STORAGE_KEY =
  "trackitup.ai.openrouter-model-sort.v1";

export const DEFAULT_AI_PROMPT_HISTORY_ENABLED = false;
export const DEFAULT_OPENROUTER_TEXT_MODEL = "openai/gpt-4.1-mini";

export function normalizeAiPromptHistoryEnabled(value: unknown): boolean {
  return value === true || value === "true";
}

export function normalizeOpenRouterApiKey(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function normalizeOpenRouterTextModel(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_OPENROUTER_TEXT_MODEL;
}
