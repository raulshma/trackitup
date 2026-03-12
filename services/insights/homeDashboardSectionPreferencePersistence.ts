import { Directory, File, Paths } from "expo-file-system";

import {
    DEFAULT_HOME_DASHBOARD_SECTION,
    HOME_DASHBOARD_SECTION_STORAGE_KEY,
    normalizeHomeDashboardSection,
    type HomeDashboardSection,
} from "@/services/insights/homeDashboardSectionPreferences";

const HOME_DASHBOARD_DIRECTORY = "trackitup";
const HOME_DASHBOARD_FILENAME = "home-dashboard-section-v1.json";

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

function getHomeDashboardSectionFile() {
  return new File(
    Paths.document,
    HOME_DASHBOARD_DIRECTORY,
    HOME_DASHBOARD_FILENAME,
  );
}

function hasDocumentDirectory() {
  try {
    return Boolean(Paths.document?.uri || Paths.document);
  } catch {
    return false;
  }
}

function readFilePreference(): HomeDashboardSection | null {
  if (!hasDocumentDirectory()) return null;

  try {
    const preferenceFile = getHomeDashboardSectionFile();
    if (!preferenceFile.exists) return null;

    const parsed = JSON.parse(preferenceFile.textSync()) as {
      section?: unknown;
    };
    return normalizeHomeDashboardSection(parsed.section);
  } catch {
    return null;
  }
}

export async function loadHomeDashboardSectionPreference(): Promise<HomeDashboardSection> {
  const storage = getStorage();
  if (storage) {
    try {
      return normalizeHomeDashboardSection(
        storage.getItem(HOME_DASHBOARD_SECTION_STORAGE_KEY),
      );
    } catch {
      return DEFAULT_HOME_DASHBOARD_SECTION;
    }
  }

  return readFilePreference() ?? DEFAULT_HOME_DASHBOARD_SECTION;
}

export async function persistHomeDashboardSectionPreference(
  section: HomeDashboardSection,
): Promise<void> {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(HOME_DASHBOARD_SECTION_STORAGE_KEY, section);
    } catch {
      // Keep in-memory section if browser storage is unavailable.
    }
    return;
  }

  if (!hasDocumentDirectory()) return;

  try {
    const directory = new Directory(Paths.document, HOME_DASHBOARD_DIRECTORY);
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const preferenceFile = getHomeDashboardSectionFile();
    if (!preferenceFile.exists) {
      preferenceFile.create({ intermediates: true, overwrite: true });
    }

    preferenceFile.write(JSON.stringify({ section }));
  } catch {
    // Keep in-memory section if file persistence is unavailable.
  }
}
