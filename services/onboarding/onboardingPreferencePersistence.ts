import { Directory, File, Paths } from "expo-file-system";

import {
  DEFAULT_ONBOARDING_COMPLETED,
  ONBOARDING_COMPLETION_STORAGE_KEY,
  normalizeOnboardingCompleted,
} from "@/services/onboarding/onboardingPreferences";

const ONBOARDING_DIRECTORY = "trackitup";
const ONBOARDING_FILENAME = "onboarding-preference-v1.json";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function getStorage(): StorageLike | null {
  const maybeStorage = (
    globalThis as typeof globalThis & { localStorage?: StorageLike }
  ).localStorage;
  return maybeStorage ?? null;
}

function getOnboardingPreferenceFile() {
  return new File(Paths.document, ONBOARDING_DIRECTORY, ONBOARDING_FILENAME);
}

function hasDocumentDirectory() {
  try {
    return Boolean(Paths.document?.uri || Paths.document);
  } catch {
    return false;
  }
}

function readFilePreference(): boolean | null {
  if (!hasDocumentDirectory()) return null;

  try {
    const preferenceFile = getOnboardingPreferenceFile();
    if (!preferenceFile.exists) return null;

    const parsed = JSON.parse(preferenceFile.textSync()) as {
      completed?: unknown;
    };
    return normalizeOnboardingCompleted(parsed.completed);
  } catch {
    return null;
  }
}

export async function loadOnboardingCompleted(): Promise<boolean> {
  const storage = getStorage();
  if (storage) {
    try {
      return normalizeOnboardingCompleted(
        storage.getItem(ONBOARDING_COMPLETION_STORAGE_KEY),
      );
    } catch {
      return DEFAULT_ONBOARDING_COMPLETED;
    }
  }

  return readFilePreference() ?? DEFAULT_ONBOARDING_COMPLETED;
}

export async function persistOnboardingCompleted(
  completed: boolean,
): Promise<void> {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(ONBOARDING_COMPLETION_STORAGE_KEY, String(completed));
    } catch {
      // Keep in-memory state if browser storage is unavailable.
    }
    return;
  }

  if (!hasDocumentDirectory()) return;

  try {
    const directory = new Directory(Paths.document, ONBOARDING_DIRECTORY);
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const preferenceFile = getOnboardingPreferenceFile();
    if (!preferenceFile.exists) {
      preferenceFile.create({ intermediates: true, overwrite: true });
    }

    preferenceFile.write(JSON.stringify({ completed }));
  } catch {
    // Keep in-memory state if file persistence is unavailable.
  }
}