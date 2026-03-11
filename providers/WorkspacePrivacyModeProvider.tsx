import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { useAppAuth } from "@/providers/AuthProvider";
import { getWorkspaceOwnerScopeKey } from "@/services/offline/workspaceOwnership";
import {
    DEFAULT_WORKSPACE_PRIVACY_MODE,
    type WorkspacePrivacyMode,
} from "@/services/offline/workspacePrivacyMode";
import {
    loadWorkspacePrivacyMode,
    persistWorkspacePrivacyMode,
} from "@/services/offline/workspacePrivacyModePersistence";

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
  const auth = useAppAuth();
  const [workspacePrivacyMode, setWorkspacePrivacyModeState] =
    useState<WorkspacePrivacyMode>(DEFAULT_WORKSPACE_PRIVACY_MODE);
  const [isLoaded, setIsLoaded] = useState(false);
  const ownerScopeKey = useMemo(
    () => getWorkspaceOwnerScopeKey(auth.isSignedIn ? auth.userId : null),
    [auth.isSignedIn, auth.userId],
  );

  useEffect(() => {
    let isMounted = true;

    if (!auth.isLoaded) {
      setIsLoaded(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoaded(false);

    void (async () => {
      const storedPreference = await loadWorkspacePrivacyMode(ownerScopeKey);
      if (!isMounted) return;

      setWorkspacePrivacyModeState(storedPreference);
      setIsLoaded(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [auth.isLoaded, ownerScopeKey]);

  const setWorkspacePrivacyModePreference = useCallback(
    (mode: WorkspacePrivacyMode) => {
      setWorkspacePrivacyModeState(mode);
      setIsLoaded(true);
      void persistWorkspacePrivacyMode(mode, ownerScopeKey);
    },
    [ownerScopeKey],
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
