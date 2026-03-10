import { Directory, File, Paths } from "expo-file-system";

import {
    DEFAULT_THEME_PREFERENCE,
    THEME_PREFERENCE_STORAGE_KEY,
    normalizeThemePreference,
    type ThemePreference,
} from "@/services/theme/themePreferences";

const THEME_DIRECTORY = "trackitup";
const THEME_FILENAME = "theme-preference-v1.json";

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

function getThemePreferenceFile() {
  return new File(Paths.document, THEME_DIRECTORY, THEME_FILENAME);
}

function hasDocumentDirectory() {
  try {
    return Boolean(Paths.document?.uri || Paths.document);
  } catch {
    return false;
  }
}

function readFilePreference(): ThemePreference | null {
  if (!hasDocumentDirectory()) return null;

  try {
    const preferenceFile = getThemePreferenceFile();
    if (!preferenceFile.exists) return null;

    const parsed = JSON.parse(preferenceFile.textSync()) as {
      preference?: unknown;
    };
    return normalizeThemePreference(parsed.preference);
  } catch {
    return null;
  }
}

export async function loadThemePreference(): Promise<ThemePreference> {
  const storage = getStorage();
  if (storage) {
    try {
      return normalizeThemePreference(
        storage.getItem(THEME_PREFERENCE_STORAGE_KEY),
      );
    } catch {
      return DEFAULT_THEME_PREFERENCE;
    }
  }

  return readFilePreference() ?? DEFAULT_THEME_PREFERENCE;
}

export async function persistThemePreference(
  preference: ThemePreference,
): Promise<void> {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
    } catch {
      // Keep the in-memory preference if browser storage is unavailable.
    }
    return;
  }

  if (!hasDocumentDirectory()) return;

  try {
    const directory = new Directory(Paths.document, THEME_DIRECTORY);
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const preferenceFile = getThemePreferenceFile();
    if (!preferenceFile.exists) {
      preferenceFile.create({ intermediates: true, overwrite: true });
    }

    preferenceFile.write(JSON.stringify({ preference }));
  } catch {
    // Keep the in-memory preference if file persistence is unavailable.
  }
}
