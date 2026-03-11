import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    deleteStoredOpenRouterApiKey,
    hasStoredOpenRouterApiKey,
    isAiKeyStorageAvailable,
    persistOpenRouterApiKey,
} from "@/services/ai/aiKeyStorage";
import {
    loadAiPromptHistoryPreference,
    loadOpenRouterTextModelPreference,
    persistAiPromptHistoryPreference,
    persistOpenRouterTextModelPreference,
} from "@/services/ai/aiPreferencePersistence";
import {
    DEFAULT_AI_PROMPT_HISTORY_ENABLED,
    DEFAULT_OPENROUTER_TEXT_MODEL,
    normalizeOpenRouterTextModel,
} from "@/services/ai/aiPreferences";

type AiPreferencesContextValue = {
  promptHistoryEnabled: boolean;
  openRouterTextModel: string;
  hasOpenRouterApiKey: boolean;
  isSecureStorageAvailable: boolean;
  isLoaded: boolean;
  setPromptHistoryEnabled: (enabled: boolean) => void;
  setOpenRouterTextModel: (model: string) => void;
  saveOpenRouterApiKey: (
    apiKey: string,
  ) => Promise<{ status: "success" | "error"; message: string }>;
  clearOpenRouterApiKey: () => Promise<{
    status: "success" | "error";
    message: string;
  }>;
};

const AiPreferencesContext = createContext<AiPreferencesContextValue | null>(
  null,
);

export function AiPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [promptHistoryEnabled, setPromptHistoryEnabledState] =
    useState<boolean>(DEFAULT_AI_PROMPT_HISTORY_ENABLED);
  const [openRouterTextModel, setOpenRouterTextModelState] = useState<string>(
    DEFAULT_OPENROUTER_TEXT_MODEL,
  );
  const [hasOpenRouterApiKey, setHasOpenRouterApiKey] = useState(false);
  const [isSecureStorageAvailable, setIsSecureStorageAvailable] =
    useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasUserSelectedPromptHistoryRef = useRef(false);
  const hasUserSelectedOpenRouterTextModelRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const [
        storedPromptHistoryEnabled,
        storedOpenRouterTextModel,
        secureStorageAvailable,
        storedAiKey,
      ] = await Promise.all([
        loadAiPromptHistoryPreference(),
        loadOpenRouterTextModelPreference(),
        isAiKeyStorageAvailable(),
        hasStoredOpenRouterApiKey(),
      ]);

      if (!isMounted) return;

      if (!hasUserSelectedPromptHistoryRef.current) {
        setPromptHistoryEnabledState(storedPromptHistoryEnabled);
      }
      if (!hasUserSelectedOpenRouterTextModelRef.current) {
        setOpenRouterTextModelState(storedOpenRouterTextModel);
      }
      setIsSecureStorageAvailable(secureStorageAvailable);
      setHasOpenRouterApiKey(storedAiKey);
      setIsLoaded(true);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setPromptHistoryEnabled = useCallback((enabled: boolean) => {
    hasUserSelectedPromptHistoryRef.current = true;
    setPromptHistoryEnabledState(enabled);
    setIsLoaded(true);
    void persistAiPromptHistoryPreference(enabled);
  }, []);

  const setOpenRouterTextModel = useCallback((model: string) => {
    const normalizedModel = normalizeOpenRouterTextModel(model);
    hasUserSelectedOpenRouterTextModelRef.current = true;
    setOpenRouterTextModelState(normalizedModel);
    setIsLoaded(true);
    void persistOpenRouterTextModelPreference(normalizedModel);
  }, []);

  const saveOpenRouterApiKey = useCallback(async (apiKey: string) => {
    const result = await persistOpenRouterApiKey(apiKey);
    if (result.status === "saved") {
      setHasOpenRouterApiKey(true);
      setIsSecureStorageAvailable(true);
      setIsLoaded(true);
      return {
        status: "success" as const,
        message:
          "OpenRouter key saved securely on this device. It will not be included in workspace sync.",
      };
    }

    if (result.status === "invalid") {
      return {
        status: "error" as const,
        message: "Enter a valid OpenRouter API key before saving.",
      };
    }

    setHasOpenRouterApiKey(false);
    setIsSecureStorageAvailable(false);
    setIsLoaded(true);
    return {
      status: "error" as const,
      message:
        "Secure device storage is unavailable here, so the OpenRouter key could not be saved.",
    };
  }, []);

  const clearOpenRouterApiKey = useCallback(async () => {
    const result = await deleteStoredOpenRouterApiKey();
    if (result.status === "deleted") {
      setHasOpenRouterApiKey(false);
      setIsLoaded(true);
      return {
        status: "success" as const,
        message: "The saved OpenRouter key was removed from this device.",
      };
    }

    return {
      status: "error" as const,
      message:
        "TrackItUp could not remove the saved OpenRouter key because secure device storage is unavailable.",
    };
  }, []);

  const value = useMemo(
    () => ({
      promptHistoryEnabled,
      openRouterTextModel,
      hasOpenRouterApiKey,
      isSecureStorageAvailable,
      isLoaded,
      setPromptHistoryEnabled,
      setOpenRouterTextModel,
      saveOpenRouterApiKey,
      clearOpenRouterApiKey,
    }),
    [
      clearOpenRouterApiKey,
      hasOpenRouterApiKey,
      isLoaded,
      isSecureStorageAvailable,
      openRouterTextModel,
      promptHistoryEnabled,
      saveOpenRouterApiKey,
      setOpenRouterTextModel,
      setPromptHistoryEnabled,
    ],
  );

  return (
    <AiPreferencesContext.Provider value={value}>
      {children}
    </AiPreferencesContext.Provider>
  );
}

export function useAiPreferences() {
  const value = useContext(AiPreferencesContext);
  if (!value) {
    throw new Error(
      "useAiPreferences must be used within an AiPreferencesProvider.",
    );
  }

  return value;
}
