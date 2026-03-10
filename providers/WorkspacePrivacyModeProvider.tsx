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
  loadWorkspacePrivacyMode,
  persistWorkspacePrivacyMode,
} from "@/services/offline/workspacePrivacyModePersistence";
import {
  DEFAULT_WORKSPACE_PRIVACY_MODE,
  type WorkspacePrivacyMode,
} from "@/services/offline/workspacePrivacyMode";

type WorkspacePrivacyModeContextValue = {
  workspacePrivacyMode: WorkspacePrivacyMode;
  setWorkspacePrivacyModePreference: (mode: WorkspacePrivacyMode) => void;
  isLoaded: boolean;
};

const WorkspacePrivacyModeContext =
  createContext<WorkspacePrivacyModeContextValue | null>(null);

export function WorkspacePrivacyModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [workspacePrivacyMode, setWorkspacePrivacyModeState] =
    useState<WorkspacePrivacyMode>(DEFAULT_WORKSPACE_PRIVACY_MODE);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasUserSelectedPreferenceRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const storedPreference = await loadWorkspacePrivacyMode();
      if (!isMounted || hasUserSelectedPreferenceRef.current) return;

      setWorkspacePrivacyModeState(storedPreference);
      setIsLoaded(true);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setWorkspacePrivacyModePreference = useCallback(
    (mode: WorkspacePrivacyMode) => {
      hasUserSelectedPreferenceRef.current = true;
      setWorkspacePrivacyModeState(mode);
      setIsLoaded(true);
      void persistWorkspacePrivacyMode(mode);
    },
    [],
  );

  const value = useMemo(
    () => ({
      workspacePrivacyMode,
      setWorkspacePrivacyModePreference,
      isLoaded,
    }),
    [isLoaded, setWorkspacePrivacyModePreference, workspacePrivacyMode],
  );

  return (
    <WorkspacePrivacyModeContext.Provider value={value}>
      {children}
    </WorkspacePrivacyModeContext.Provider>
  );
}

export function useWorkspacePrivacyMode() {
  const value = useContext(WorkspacePrivacyModeContext);
  if (!value) {
    throw new Error(
      "useWorkspacePrivacyMode must be used within a WorkspacePrivacyModeProvider.",
    );
  }

  return value;
}