import {
    ANONYMOUS_WORKSPACE_SCOPE_KEY,
    buildWorkspacePrivacyModeFilename,
    buildWorkspacePrivacyModeStorageKey,
    SNAPSHOT_DIRECTORY,
} from "./workspaceOwnership.ts";
import {
    DEFAULT_WORKSPACE_PRIVACY_MODE,
    normalizeWorkspacePrivacyMode,
    WORKSPACE_PRIVACY_MODE_STORAGE_KEY,
    type WorkspacePrivacyMode,
} from "./workspacePrivacyMode.ts";

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

async function getExpoFileSystem() {
  try {
    return await import("expo-file-system");
  } catch {
    return null;
  }
}

function hasDocumentDirectory(paths: {
  document?: { uri?: string } | unknown;
}) {
  try {
    return Boolean(
      paths.document &&
      ((paths.document as { uri?: string }).uri || paths.document),
    );
  } catch {
    return false;
  }
}

async function readScopedFilePreference(
  ownerScopeKey: string,
): Promise<WorkspacePrivacyMode | null> {
  const expoFileSystem = await getExpoFileSystem();
  if (!expoFileSystem || !hasDocumentDirectory(expoFileSystem.Paths))
    return null;

  try {
    const preferenceFile = new expoFileSystem.File(
      expoFileSystem.Paths.document,
      SNAPSHOT_DIRECTORY,
      buildWorkspacePrivacyModeFilename(ownerScopeKey),
    );
    if (!preferenceFile.exists) return null;

    const parsed = JSON.parse(preferenceFile.textSync()) as {
      mode?: unknown;
    };
    return normalizeWorkspacePrivacyMode(parsed.mode);
  } catch {
    return null;
  }
}

async function readLegacyFilePreference(): Promise<WorkspacePrivacyMode | null> {
  const expoFileSystem = await getExpoFileSystem();
  if (!expoFileSystem || !hasDocumentDirectory(expoFileSystem.Paths))
    return null;

  try {
    const preferenceFile = new expoFileSystem.File(
      expoFileSystem.Paths.document,
      SNAPSHOT_DIRECTORY,
      "workspace-privacy-mode-v1.json",
    );
    if (!preferenceFile.exists) return null;

    const parsed = JSON.parse(preferenceFile.textSync()) as {
      mode?: unknown;
    };
    return normalizeWorkspacePrivacyMode(parsed.mode);
  } catch {
    return null;
  }
}

export async function loadWorkspacePrivacyMode(
  ownerScopeKey = ANONYMOUS_WORKSPACE_SCOPE_KEY,
): Promise<WorkspacePrivacyMode> {
  const storage = getStorage();
  if (storage) {
    try {
      const scopedPreference = storage.getItem(
        buildWorkspacePrivacyModeStorageKey(ownerScopeKey),
      );
      if (scopedPreference) {
        return normalizeWorkspacePrivacyMode(scopedPreference);
      }

      return normalizeWorkspacePrivacyMode(
        storage.getItem(WORKSPACE_PRIVACY_MODE_STORAGE_KEY),
      );
    } catch {
      return DEFAULT_WORKSPACE_PRIVACY_MODE;
    }
  }

  return (
    (await readScopedFilePreference(ownerScopeKey)) ??
    (await readLegacyFilePreference()) ??
    DEFAULT_WORKSPACE_PRIVACY_MODE
  );
}

export async function persistWorkspacePrivacyMode(
  mode: WorkspacePrivacyMode,
  ownerScopeKey = ANONYMOUS_WORKSPACE_SCOPE_KEY,
): Promise<void> {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(buildWorkspacePrivacyModeStorageKey(ownerScopeKey), mode);
    } catch {
      // Keep the in-memory preference if browser storage is unavailable.
    }
    return;
  }

  const expoFileSystem = await getExpoFileSystem();
  if (!expoFileSystem || !hasDocumentDirectory(expoFileSystem.Paths)) return;

  try {
    const directory = new expoFileSystem.Directory(
      expoFileSystem.Paths.document,
      SNAPSHOT_DIRECTORY,
    );
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const preferenceFile = new expoFileSystem.File(
      expoFileSystem.Paths.document,
      SNAPSHOT_DIRECTORY,
      buildWorkspacePrivacyModeFilename(ownerScopeKey),
    );
    if (!preferenceFile.exists) {
      preferenceFile.create({ intermediates: true, overwrite: true });
    }

    preferenceFile.write(JSON.stringify({ mode }));
  } catch {
    // Keep the in-memory preference if file persistence is unavailable.
  }
}
