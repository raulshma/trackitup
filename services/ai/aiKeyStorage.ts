import {
    normalizeOpenRouterApiKey,
    OPENROUTER_API_KEY_STORAGE_KEY,
} from "./aiPreferences.ts";

type SecureKeyStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
};

async function loadSecureStoreModule() {
  try {
    const secureStore = await import("expo-secure-store");
    if (
      typeof secureStore.isAvailableAsync === "function" &&
      (await secureStore.isAvailableAsync())
    ) {
      return secureStore;
    }
  } catch {
    // Secure storage is unavailable in this environment.
  }

  return null;
}

async function resolveAiKeyStore(): Promise<SecureKeyStore | null> {
  const secureStore = await loadSecureStoreModule();
  if (!secureStore) return null;

  const keychainAccessible =
    secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY ?? secureStore.WHEN_UNLOCKED;

  return {
    getItem: async (key) => secureStore.getItemAsync(key),
    setItem: async (key, value) =>
      secureStore.setItemAsync(key, value, { keychainAccessible }),
    deleteItem: async (key) => secureStore.deleteItemAsync(key),
  };
}

export async function isAiKeyStorageAvailable() {
  return Boolean(await resolveAiKeyStore());
}

export async function loadStoredOpenRouterApiKey() {
  const keyStore = await resolveAiKeyStore();
  if (!keyStore) return null;

  try {
    return normalizeOpenRouterApiKey(
      await keyStore.getItem(OPENROUTER_API_KEY_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export async function hasStoredOpenRouterApiKey() {
  return Boolean(await loadStoredOpenRouterApiKey());
}

export async function persistOpenRouterApiKey(apiKey: string) {
  const normalizedKey = normalizeOpenRouterApiKey(apiKey);
  if (!normalizedKey) {
    return { status: "invalid" as const };
  }

  const keyStore = await resolveAiKeyStore();
  if (!keyStore) {
    return { status: "unavailable" as const };
  }

  try {
    await keyStore.setItem(OPENROUTER_API_KEY_STORAGE_KEY, normalizedKey);
    return { status: "saved" as const };
  } catch {
    return { status: "unavailable" as const };
  }
}

export async function deleteStoredOpenRouterApiKey() {
  const keyStore = await resolveAiKeyStore();
  if (!keyStore) {
    return { status: "unavailable" as const };
  }

  try {
    await keyStore.deleteItem(OPENROUTER_API_KEY_STORAGE_KEY);
    return { status: "deleted" as const };
  } catch {
    return { status: "unavailable" as const };
  }
}
