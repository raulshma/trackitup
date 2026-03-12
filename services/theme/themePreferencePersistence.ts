import { Directory, File, Paths } from "expo-file-system";

import {
    DEFAULT_THEME_ACCENT_COLOR,
    DEFAULT_THEME_PREFERENCE,
    THEME_ACCENT_STORAGE_KEY,
    THEME_PREFERENCE_STORAGE_KEY,
    normalizeThemeAccentColor,
    normalizeThemePreference,
    type ThemePreference,
} from "@/services/theme/themePreferences";

const THEME_DIRECTORY = "trackitup";
const THEME_FILENAME = "theme-preference-v1.json";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type ThemePreferenceSnapshot = {
  preference: ThemePreference;
  accentColor: string;
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

function readFileAccentColor(): string | null {
  if (!hasDocumentDirectory()) return null;

  try {
    const preferenceFile = getThemePreferenceFile();
    if (!preferenceFile.exists) return null;

    const parsed = JSON.parse(preferenceFile.textSync()) as {
      accentColor?: unknown;
    };
    return normalizeThemeAccentColor(parsed.accentColor);
  } catch {
    return null;
  }
}

async function loadThemePreferenceSnapshot(): Promise<ThemePreferenceSnapshot> {
  const storage = getStorage();
  if (storage) {
    try {
      return {
        preference: normalizeThemePreference(
          storage.getItem(THEME_PREFERENCE_STORAGE_KEY),
        ),
        accentColor: normalizeThemeAccentColor(
          storage.getItem(THEME_ACCENT_STORAGE_KEY),
        ),
      };
    } catch {
      return {
        preference: DEFAULT_THEME_PREFERENCE,
        accentColor: DEFAULT_THEME_ACCENT_COLOR,
      };
    }
  }

  return {
    preference: readFilePreference() ?? DEFAULT_THEME_PREFERENCE,
    accentColor: readFileAccentColor() ?? DEFAULT_THEME_ACCENT_COLOR,
  };
}

export async function loadThemePreference(): Promise<ThemePreference> {
  return (await loadThemePreferenceSnapshot()).preference;
}

export async function loadThemeAccentColor(): Promise<string> {
  return (await loadThemePreferenceSnapshot()).accentColor;
}

function persistNativeThemeSnapshot(snapshot: ThemePreferenceSnapshot) {
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

    preferenceFile.write(JSON.stringify(snapshot));
  } catch {
    // Keep the in-memory theme snapshot if file persistence is unavailable.
  }
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

  const snapshot = await loadThemePreferenceSnapshot();
  persistNativeThemeSnapshot({ ...snapshot, preference });
}

export async function persistThemeAccentColor(
  accentColor: string,
): Promise<void> {
  const normalizedAccentColor = normalizeThemeAccentColor(accentColor);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(THEME_ACCENT_STORAGE_KEY, normalizedAccentColor);
    } catch {
      // Keep the in-memory accent preference if browser storage is unavailable.
    }
    return;
  }

  const snapshot = await loadThemePreferenceSnapshot();
  persistNativeThemeSnapshot({
    ...snapshot,
    accentColor: normalizedAccentColor,
  });
}
