import { Directory, File, Paths } from "expo-file-system";

import {
    DEFAULT_WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT,
    normalizeWorkspaceBiometricReauthTimeout,
    type WorkspaceBiometricReauthTimeout,
} from "@/services/offline/workspaceBiometricSessionPolicy";

const WORKSPACE_BIOMETRIC_LOCK_STORAGE_KEY =
  "trackitup.workspace.biometric-lock.v1";
const WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_STORAGE_KEY =
  "trackitup.workspace.biometric-reauth-timeout.v1";
const WORKSPACE_DIRECTORY = "trackitup";
const WORKSPACE_BIOMETRIC_LOCK_FILENAME = "workspace-biometric-lock-v1.json";
const WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_FILENAME =
  "workspace-biometric-reauth-timeout-v1.json";

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

function hasDocumentDirectory() {
  try {
    return Boolean(Paths.document?.uri || Paths.document);
  } catch {
    return false;
  }
}

function getWorkspaceBiometricLockFile() {
  return new File(
    Paths.document,
    WORKSPACE_DIRECTORY,
    WORKSPACE_BIOMETRIC_LOCK_FILENAME,
  );
}

function getWorkspaceBiometricReauthTimeoutFile() {
  return new File(
    Paths.document,
    WORKSPACE_DIRECTORY,
    WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_FILENAME,
  );
}

export async function loadWorkspaceBiometricLockPreference() {
  const storage = getStorage();
  if (storage) {
    try {
      return storage.getItem(WORKSPACE_BIOMETRIC_LOCK_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  if (!hasDocumentDirectory()) return false;

  try {
    const preferenceFile = getWorkspaceBiometricLockFile();
    if (!preferenceFile.exists) return false;

    const parsed = JSON.parse(preferenceFile.textSync()) as {
      enabled?: boolean;
    };
    return parsed.enabled === true;
  } catch {
    return false;
  }
}

export async function persistWorkspaceBiometricLockPreference(
  enabled: boolean,
) {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(WORKSPACE_BIOMETRIC_LOCK_STORAGE_KEY, String(enabled));
    } catch {
      // Keep in-memory state if browser storage is unavailable.
    }
    return;
  }

  if (!hasDocumentDirectory()) return;

  try {
    const directory = new Directory(Paths.document, WORKSPACE_DIRECTORY);
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const preferenceFile = getWorkspaceBiometricLockFile();
    if (!preferenceFile.exists) {
      preferenceFile.create({ intermediates: true, overwrite: true });
    }

    preferenceFile.write(JSON.stringify({ enabled }));
  } catch {
    // Keep in-memory state if file persistence is unavailable.
  }
}

export async function loadWorkspaceBiometricReauthTimeoutPreference(): Promise<WorkspaceBiometricReauthTimeout> {
  const storage = getStorage();
  if (storage) {
    try {
      return normalizeWorkspaceBiometricReauthTimeout(
        storage.getItem(WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_STORAGE_KEY),
      );
    } catch {
      return DEFAULT_WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT;
    }
  }

  if (!hasDocumentDirectory()) {
    return DEFAULT_WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT;
  }

  try {
    const preferenceFile = getWorkspaceBiometricReauthTimeoutFile();
    if (!preferenceFile.exists) {
      return DEFAULT_WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT;
    }

    const parsed = JSON.parse(preferenceFile.textSync()) as {
      timeout?: unknown;
    };
    return normalizeWorkspaceBiometricReauthTimeout(parsed.timeout);
  } catch {
    return DEFAULT_WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT;
  }
}

export async function persistWorkspaceBiometricReauthTimeoutPreference(
  timeout: WorkspaceBiometricReauthTimeout,
) {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(WORKSPACE_BIOMETRIC_REAUTH_TIMEOUT_STORAGE_KEY, timeout);
    } catch {
      // Keep in-memory state if browser storage is unavailable.
    }
    return;
  }

  if (!hasDocumentDirectory()) return;

  try {
    const directory = new Directory(Paths.document, WORKSPACE_DIRECTORY);
    if (!directory.exists) {
      directory.create({ idempotent: true, intermediates: true });
    }

    const preferenceFile = getWorkspaceBiometricReauthTimeoutFile();
    if (!preferenceFile.exists) {
      preferenceFile.create({ intermediates: true, overwrite: true });
    }

    preferenceFile.write(JSON.stringify({ timeout }));
  } catch {
    // Keep in-memory state if file persistence is unavailable.
  }
}
