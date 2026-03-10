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
    loadThemePreference,
    persistThemePreference,
} from "@/services/theme/themePreferencePersistence";
import {
    DEFAULT_THEME_PREFERENCE,
    type ThemePreference,
} from "@/services/theme/themePreferences";

type ThemePreferenceContextValue = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  isLoaded: boolean;
};

const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
    DEFAULT_THEME_PREFERENCE,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const hasUserSelectedPreferenceRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const storedPreference = await loadThemePreference();
      if (!isMounted || hasUserSelectedPreferenceRef.current) return;

      setThemePreferenceState(storedPreference);
      setIsLoaded(true);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.documentElement.dataset.themePreference = themePreference;
    document.documentElement.style.colorScheme =
      themePreference === "light" ? "light" : "dark";

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute(
        "content",
        themePreference === "light"
          ? "#f7f9fc"
          : themePreference === "oled"
            ? "#000000"
            : "#111318",
      );
    }
  }, [themePreference]);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    hasUserSelectedPreferenceRef.current = true;
    setThemePreferenceState(preference);
    setIsLoaded(true);
    void persistThemePreference(preference);
  }, []);

  const value = useMemo(
    () => ({ themePreference, setThemePreference, isLoaded }),
    [isLoaded, setThemePreference, themePreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const value = useContext(ThemePreferenceContext);
  if (!value) {
    throw new Error(
      "useThemePreference must be used within a ThemePreferenceProvider.",
    );
  }

  return value;
}

export function useAppColorScheme() {
  return useThemePreference().themePreference;
}
