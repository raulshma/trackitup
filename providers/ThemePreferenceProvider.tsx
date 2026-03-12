import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { setThemeAccentColor as setRuntimeThemeAccentColor } from "@/constants/Colors";
import {
    loadThemeAccentColor,
    loadThemePreference,
    persistThemeAccentColor,
    persistThemePreference,
} from "@/services/theme/themePreferencePersistence";
import {
    DEFAULT_THEME_ACCENT_COLOR,
    DEFAULT_THEME_PREFERENCE,
    getThemeBackgroundColor,
    normalizeThemeAccentColor,
    type ThemePreference,
} from "@/services/theme/themePreferences";

type ThemePreferenceContextValue = {
  themePreference: ThemePreference;
  themeAccentColor: string;
  setThemePreference: (preference: ThemePreference) => void;
  setThemeAccentColor: (color: string) => void;
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
  const [themeAccentColor, setThemeAccentColorState] = useState<string>(
    DEFAULT_THEME_ACCENT_COLOR,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const hasUserSelectedPreferenceRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const [storedPreference, storedAccentColor] = await Promise.all([
        loadThemePreference(),
        loadThemeAccentColor(),
      ]);
      if (!isMounted || hasUserSelectedPreferenceRef.current) return;

      setThemePreferenceState(storedPreference);
      setThemeAccentColorState(storedAccentColor);
      setIsLoaded(true);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const runtimeAccentColor =
      themePreference === "monotone-light" ||
      themePreference === "monotone-dark"
        ? themePreference === "monotone-light"
          ? "#000000"
          : "#ffffff"
        : themeAccentColor;

    document.documentElement.dataset.themePreference = themePreference;
    document.documentElement.style.colorScheme =
      themePreference === "light" || themePreference === "monotone-light"
        ? "light"
        : "dark";

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute(
        "content",
        getThemeBackgroundColor(themePreference),
      );
    }
    document.documentElement.style.setProperty(
      "--trackitup-accent",
      runtimeAccentColor,
    );
  }, [themeAccentColor, themePreference]);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    hasUserSelectedPreferenceRef.current = true;
    setThemePreferenceState(preference);
    setIsLoaded(true);
    void persistThemePreference(preference);
  }, []);

  const setAccentPreference = useCallback((color: string) => {
    hasUserSelectedPreferenceRef.current = true;
    const normalizedColor = normalizeThemeAccentColor(color);
    setThemeAccentColorState(normalizedColor);
    setIsLoaded(true);
    void persistThemeAccentColor(normalizedColor);
  }, []);

  setRuntimeThemeAccentColor(
    themePreference === "monotone-light"
      ? "#000000"
      : themePreference === "monotone-dark"
        ? "#ffffff"
        : themeAccentColor,
  );

  const value = useMemo(
    () => ({
      themePreference,
      themeAccentColor,
      setThemePreference,
      setThemeAccentColor: setAccentPreference,
      isLoaded,
    }),
    [
      isLoaded,
      setAccentPreference,
      setThemePreference,
      themeAccentColor,
      themePreference,
    ],
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
