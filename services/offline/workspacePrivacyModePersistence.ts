import { Directory, File, Paths } from "expo-file-system";

import {
  DEFAULT_WORKSPACE_PRIVACY_MODE,
  normalizeWorkspacePrivacyMode,
  WORKSPACE_PRIVACY_MODE_STORAGE_KEY,
  type WorkspacePrivacyMode,
} from "./workspacePrivacyMode.ts";

const WORKSPACE_DIRECTORY = "trackitup";
const WORKSPACE_PRIVACY_MODE_FILENAME = "workspace-privacy-mode-v1.json";

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

function getWorkspacePrivacyModeFile() {
  return new File(
    Paths.document,
    WORKSPACE_DIRECTORY,
    WORKSPACE_PRIVACY_MODE_FILENAME,
  );
}

function hasDocumentDirectory() {
  try {
    return Boolean(Paths.document?.uri || Paths.document);
  } catch {
    return false;
  }
}

function readFilePreference(): WorkspacePrivacyMode | null {
  if (!hasDocumentDirectory()) return null;

  try {
    const preferenceFile = getWorkspacePrivacyModeFile();
    if (!preferenceFile.exists) return null;

    const parsed = JSON.parse(preferenceFile.textSync()) as {
      mode?: unknown;
    };
    return normalizeWorkspacePrivacyMode(parsed.mode);
  } catch {
    return null;
  }
}

export async function loadWorkspacePrivacyMode(): Promise<WorkspacePrivacyMode> {
  const storage = getStorage();
  if (storage) {
    try {
      return normalizeWorkspacePrivacyMode(
        storage.getItem(WORKSPACE_PRIVACY_MODE_STORAGE_KEY),
      );
    } catch {
      return DEFAULT_WORKSPACE_PRIVACY_MODE;
    }
  }

  return readFilePreference() ?? DEFAULT_WORKSPACE_PRIVACY_MODE;
}

export async function persistWorkspacePrivacyMode(
  mode: WorkspacePrivacyMode,
): Promise<void> {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(WORKSPACE_PRIVACY_MODE_STORAGE_KEY, mode);
    } catch {
      // Keep the in-memory preference if browser storage is unavailable.
    }
    return;
  }

  if (!hasDocumentDirectory()) return;

  try {
    const directory = new Directory(Paths.document, WORKSPACE_DIRECTORY);
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const preferenceFile = getWorkspacePrivacyModeFile();
    if (!preferenceFile.exists) {
      preferenceFile.create({ intermediates: true, overwrite: true });
    }

    preferenceFile.write(JSON.stringify({ mode }));
  } catch {
    // Keep the in-memory preference if file persistence is unavailable.
  }
}