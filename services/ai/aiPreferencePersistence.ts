import { Directory, File, Paths } from "expo-file-system";

import {
    AI_PROMPT_HISTORY_STORAGE_KEY,
    DEFAULT_AI_PROMPT_HISTORY_ENABLED,
    DEFAULT_OPENROUTER_TEXT_MODEL,
    normalizeAiPromptHistoryEnabled,
    normalizeOpenRouterTextModel,
    OPENROUTER_MODEL_SORT_STORAGE_KEY,
    OPENROUTER_TEXT_MODEL_STORAGE_KEY,
} from "./aiPreferences.ts";
import {
    DEFAULT_OPENROUTER_MODEL_SORT,
    normalizeOpenRouterModelSort,
    type OpenRouterModelSort,
} from "./openRouterModels.ts";

const AI_DIRECTORY = "trackitup";
const AI_PREFERENCE_FILENAME = "ai-preferences-v1.json";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type RawAiPreferenceFilePayload = {
  promptHistoryEnabled?: unknown;
  openRouterTextModel?: unknown;
  openRouterModelSort?: unknown;
};

let cachedOpenRouterTextModel: string | null = null;
let cachedOpenRouterModelSort: OpenRouterModelSort | null = null;

function getStorage(): StorageLike | null {
  const maybeStorage = (
    globalThis as typeof globalThis & { localStorage?: StorageLike }
  ).localStorage;
  return maybeStorage ?? null;
}

function getAiPreferenceFile() {
  return new File(Paths.document, AI_DIRECTORY, AI_PREFERENCE_FILENAME);
}

function hasDocumentDirectory() {
  try {
    return Boolean(Paths.document?.uri || Paths.document);
  } catch {
    return false;
  }
}

function readAiPreferenceFilePayload(): RawAiPreferenceFilePayload | null {
  if (!hasDocumentDirectory()) return null;

  try {
    const preferenceFile = getAiPreferenceFile();
    if (!preferenceFile.exists) return null;

    return JSON.parse(preferenceFile.textSync()) as RawAiPreferenceFilePayload;
  } catch {
    return null;
  }
}

function readPromptHistoryPreference(): boolean | null {
  const parsed = readAiPreferenceFilePayload();
  return parsed
    ? normalizeAiPromptHistoryEnabled(parsed.promptHistoryEnabled)
    : null;
}

function writeAiPreferenceFilePayload(
  patch: Partial<RawAiPreferenceFilePayload>,
) {
  if (!hasDocumentDirectory()) return;

  try {
    const directory = new Directory(Paths.document, AI_DIRECTORY);
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const preferenceFile = getAiPreferenceFile();
    if (!preferenceFile.exists) {
      preferenceFile.create({ intermediates: true, overwrite: true });
    }

    const nextPayload = {
      ...(readAiPreferenceFilePayload() ?? {}),
      ...patch,
    };

    preferenceFile.write(JSON.stringify(nextPayload));
  } catch {
    // Keep the in-memory preference if file persistence is unavailable.
  }
}

export async function loadAiPromptHistoryPreference(): Promise<boolean> {
  const storage = getStorage();
  if (storage) {
    try {
      return normalizeAiPromptHistoryEnabled(
        storage.getItem(AI_PROMPT_HISTORY_STORAGE_KEY),
      );
    } catch {
      return DEFAULT_AI_PROMPT_HISTORY_ENABLED;
    }
  }

  return readPromptHistoryPreference() ?? DEFAULT_AI_PROMPT_HISTORY_ENABLED;
}

export async function persistAiPromptHistoryPreference(
  promptHistoryEnabled: boolean,
): Promise<void> {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(
        AI_PROMPT_HISTORY_STORAGE_KEY,
        String(promptHistoryEnabled),
      );
    } catch {
      // Keep the in-memory preference if browser storage is unavailable.
    }
    return;
  }

  writeAiPreferenceFilePayload({ promptHistoryEnabled });
}

export async function loadOpenRouterTextModelPreference(): Promise<string> {
  if (cachedOpenRouterTextModel) {
    return cachedOpenRouterTextModel;
  }

  const storage = getStorage();
  if (storage) {
    try {
      const normalizedModel = normalizeOpenRouterTextModel(
        storage.getItem(OPENROUTER_TEXT_MODEL_STORAGE_KEY),
      );
      cachedOpenRouterTextModel = normalizedModel;
      return normalizedModel;
    } catch {
      return DEFAULT_OPENROUTER_TEXT_MODEL;
    }
  }

  const parsed = readAiPreferenceFilePayload();
  const normalizedModel = parsed
    ? normalizeOpenRouterTextModel(parsed.openRouterTextModel)
    : DEFAULT_OPENROUTER_TEXT_MODEL;
  cachedOpenRouterTextModel = normalizedModel;
  return normalizedModel;
}

export async function persistOpenRouterTextModelPreference(model: string) {
  const normalizedModel = normalizeOpenRouterTextModel(model);
  cachedOpenRouterTextModel = normalizedModel;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(OPENROUTER_TEXT_MODEL_STORAGE_KEY, normalizedModel);
    } catch {
      // Keep the in-memory preference if browser storage is unavailable.
    }
    return normalizedModel;
  }

  writeAiPreferenceFilePayload({ openRouterTextModel: normalizedModel });
  return normalizedModel;
}

export async function loadOpenRouterModelSortPreference(): Promise<OpenRouterModelSort> {
  if (cachedOpenRouterModelSort) {
    return cachedOpenRouterModelSort;
  }

  const storage = getStorage();
  if (storage) {
    try {
      const normalizedSort = normalizeOpenRouterModelSort(
        storage.getItem(OPENROUTER_MODEL_SORT_STORAGE_KEY),
      );
      cachedOpenRouterModelSort = normalizedSort;
      return normalizedSort;
    } catch {
      return DEFAULT_OPENROUTER_MODEL_SORT;
    }
  }

  const parsed = readAiPreferenceFilePayload();
  const normalizedSort = parsed
    ? normalizeOpenRouterModelSort(parsed.openRouterModelSort)
    : DEFAULT_OPENROUTER_MODEL_SORT;
  cachedOpenRouterModelSort = normalizedSort;
  return normalizedSort;
}

export async function persistOpenRouterModelSortPreference(
  sort: OpenRouterModelSort,
) {
  const normalizedSort = normalizeOpenRouterModelSort(sort);
  cachedOpenRouterModelSort = normalizedSort;

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(OPENROUTER_MODEL_SORT_STORAGE_KEY, normalizedSort);
    } catch {
      // Keep the in-memory preference if browser storage is unavailable.
    }
    return normalizedSort;
  }

  writeAiPreferenceFilePayload({ openRouterModelSort: normalizedSort });
  return normalizedSort;
}
