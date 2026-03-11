import { Directory, File, Paths } from "expo-file-system";

import {
  normalizeVisualRecapCoverSelections,
  type VisualRecapCoverSelections,
} from "@/services/insights/workspaceVisualHistory";

const VISUAL_RECAP_COVER_STORAGE_KEY = "trackitup.visual-recap-covers.v1";
const VISUAL_RECAP_DIRECTORY = "trackitup";
const VISUAL_RECAP_FILENAME = "visual-recap-covers-v1.json";

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

function getVisualRecapPreferenceFile() {
  return new File(Paths.document, VISUAL_RECAP_DIRECTORY, VISUAL_RECAP_FILENAME);
}

function hasDocumentDirectory() {
  try {
    return Boolean(Paths.document?.uri || Paths.document);
  } catch {
    return false;
  }
}

function readFileSelections(): VisualRecapCoverSelections | null {
  if (!hasDocumentDirectory()) return null;

  try {
    const preferenceFile = getVisualRecapPreferenceFile();
    if (!preferenceFile.exists) return null;

    const parsed = JSON.parse(preferenceFile.textSync()) as {
      selections?: unknown;
    };
    return normalizeVisualRecapCoverSelections(parsed.selections);
  } catch {
    return null;
  }
}

export async function loadVisualRecapCoverSelections() {
  const storage = getStorage();
  if (storage) {
    try {
      return normalizeVisualRecapCoverSelections(
        JSON.parse(storage.getItem(VISUAL_RECAP_COVER_STORAGE_KEY) ?? "null"),
      );
    } catch {
      return {};
    }
  }

  return readFileSelections() ?? {};
}

export async function persistVisualRecapCoverSelections(
  selections: VisualRecapCoverSelections,
) {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(
        VISUAL_RECAP_COVER_STORAGE_KEY,
        JSON.stringify(selections),
      );
    } catch {
      // Keep the in-memory selection if browser storage is unavailable.
    }
    return;
  }

  if (!hasDocumentDirectory()) return;

  try {
    const directory = new Directory(Paths.document, VISUAL_RECAP_DIRECTORY);
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const preferenceFile = getVisualRecapPreferenceFile();
    if (!preferenceFile.exists) {
      preferenceFile.create({ intermediates: true, overwrite: true });
    }

    preferenceFile.write(JSON.stringify({ selections }));
  } catch {
    // Keep the in-memory selection if file persistence is unavailable.
  }
}