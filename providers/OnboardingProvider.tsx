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
    loadOnboardingCompleted,
    persistOnboardingCompleted,
} from "@/services/onboarding/onboardingPreferencePersistence";
import { DEFAULT_ONBOARDING_COMPLETED } from "@/services/onboarding/onboardingPreferences";

type OnboardingContextValue = {
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboardingPreference: (completed: boolean) => void;
  isLoaded: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(
    DEFAULT_ONBOARDING_COMPLETED,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const hasUserSelectedPreferenceRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const completed = await loadOnboardingCompleted();
        if (!isMounted || hasUserSelectedPreferenceRef.current) return;

        setHasCompletedOnboarding(completed);
      } catch {
        if (!isMounted || hasUserSelectedPreferenceRef.current) return;

        setHasCompletedOnboarding(DEFAULT_ONBOARDING_COMPLETED);
      } finally {
        if (!isMounted || hasUserSelectedPreferenceRef.current) return;
        setIsLoaded(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setHasCompletedOnboardingPreference = useCallback(
    (completed: boolean) => {
      hasUserSelectedPreferenceRef.current = true;
      setHasCompletedOnboarding(completed);
      setIsLoaded(true);
      void persistOnboardingCompleted(completed);
    },
    [],
  );

  const value = useMemo(
    () => ({
      hasCompletedOnboarding,
      setHasCompletedOnboardingPreference,
      isLoaded,
    }),
    [hasCompletedOnboarding, isLoaded, setHasCompletedOnboardingPreference],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) {
    throw new Error("useOnboarding must be used within an OnboardingProvider.");
  }

  return value;
}
